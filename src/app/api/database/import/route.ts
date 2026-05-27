import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { createAuditLog } from "@/lib/auditLog";
import { getUserFromCookie } from "@/lib/jwt";
import { requireRole } from "@/lib/requireRole";

// Map sheet names to Prisma runtime model accessors (camelCase)
const MODEL_ACCESSORS: Record<string, { accessor: string }> = {
  SaleItems: { accessor: "saleItem" },
  Ventas: { accessor: "sale" },
  Citas: { accessor: "appointment" },
  Servicios: { accessor: "service" },
  Clientes: { accessor: "client" },
  Empleadas: { accessor: "employee" },
  Productos: { accessor: "product" },
  WATemplates: { accessor: "wATemplate" },
  StudioSettings: { accessor: "studioSettings" },
};

// Order of deletion (children before parents to avoid FK violations)
const DELETE_ORDER = [
  "SaleItems",
  "Ventas",
  "Citas",
  "Servicios",
  "Clientes",
  "Empleadas",
  "Productos",
  "WATemplates",
  "StudioSettings",
];

// Order of insertion (parents before children)
const INSERT_ORDER = [
  "Servicios",
  "Clientes",
  "Empleadas",
  "Productos",
  "WATemplates",
  "StudioSettings",
  "Citas",
  "Ventas",
  "SaleItems",
];

// Set of field names that should remain as numbers (not converted to string)
const NUMERIC_FIELDS = new Set([
  "id",
  "price",
  "duration",
  "quantity",
  "total",
  "totalBs",
  "exchangeRate",
  "minStock",
  "clientId",
  "serviceId",
  "employeeId",
  "productId",
  "saleId",
  "active",
  "commissionPercent",
  "visitCount",
  "freeServiceAvailable",
]);

// Fields that are Boolean in Prisma — convert 1/0 numbers to true/false
// Note: these fields MUST also be in NUMERIC_FIELDS to prevent prepareRow
// from converting them to strings before the boolean conversion runs.
const BOOLEAN_FIELDS = new Set(["active", "freeServiceAvailable"]);

function prepareRow(row: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (let [key, val] of Object.entries(row)) {
    if (key.startsWith("__")) continue;
    if (val == null || val === "") continue;

    // ── Auto-convert types for Excel compatibility ──
    // Excel stores phone numbers, zip codes, etc. as numbers, but Prisma expects strings
    if (typeof val === "number" && !NUMERIC_FIELDS.has(key)) {
      val = String(val);
    }

    // Convert 0/1 numbers to boolean for Prisma Boolean fields
    if (BOOLEAN_FIELDS.has(key) && typeof val === "number") {
      val = val === 1;
    }

    // Convert ISO date strings to Date objects for Prisma DateTime fields
    if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
      const parsed = new Date(val);
      if (!isNaN(parsed.getTime())) {
        val = parsed;
      }
    }

    cleaned[key] = val;
  }
  return cleaned;
}

export async function POST(request: Request) {
  const auth = await requireRole(request, ["ADMIN"]);
  if (auth.error) return auth.error;

  let sheetsData: Record<string, Record<string, unknown>[]> = {};

  try {
    // ── Parse file BEFORE creating the stream ──
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json(
        { error: "No se recibió ningún archivo" },
        { status: 400 }
      );
    }

    // Use Buffer.from with type "buffer" for maximum compatibility with xlsx 0.18.5
    // type "array" expects Uint8Array, not raw ArrayBuffer, and can cause parse issues
    const buf = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buf, { type: "buffer", cellDates: true });
    console.log("Import: parsed workbook with sheets:", workbook.SheetNames);
    const sheetNames = workbook.SheetNames;

    if (sheetNames.length === 0) {
      return Response.json(
        { error: "El archivo Excel no contiene hojas" },
        { status: 400 }
      );
    }

    // Parse all sheets
    for (const name of sheetNames) {
      const ws = workbook.Sheets[name];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
      const filtered = json.filter(
        (row) => !Object.values(row).every((v) => v === "(sin datos)")
      );
      if (filtered.length > 0) {
        sheetsData[name] = filtered;
        console.log(`Import: sheet "${name}" — ${filtered.length} rows (${json.length} raw, ${json.length - filtered.length} filtered)`);
      } else {
        console.log(`Import: sheet "${name}" — 0 rows (all filtered out or empty)`);
      }
    }

    // Warn about unknown sheets
    const unknownSheets = sheetNames.filter(
      (name) => !MODEL_ACCESSORS[name] && !name.startsWith("_")
    );
    if (unknownSheets.length > 0) {
      console.warn("Unknown sheets in import:", unknownSheets);
    }
  } catch (parseError) {
    console.error("Error parsing Excel file:", parseError);
    return Response.json(
      { error: "Error al leer el archivo Excel. Verifica que el formato sea correcto." },
      { status: 400 }
    );
  }

  // ── Now create the streaming response ──
  // The file is already parsed; the stream only does DB work
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
        } catch {
          // Stream might be closed, ignore
        }
      };

      try {
        send({ type: "status", message: "Importando datos..." });

        interface TableCounts {
          deleted: number;
          total: number;
          inserted: number;
          errors?: number;
        }

        const results: Record<string, TableCounts> = {};

        await prisma.$transaction(
          async (tx) => {
            // ── Delete phase ──
            for (const sheetName of DELETE_ORDER) {
              const model = MODEL_ACCESSORS[sheetName];
              if (model) {
                const result = await (tx as any)[model.accessor].deleteMany();
                // Initialize results entry
                results[sheetName] = { deleted: result.count, total: 0, inserted: 0 };
                send({
                  type: "delete_done",
                  table: sheetName,
                  deleted: result.count,
                });
              }
            }

            // ── Insert phase ──
            for (const sheetName of INSERT_ORDER) {
              const rows = sheetsData[sheetName];
              if (!rows || rows.length === 0) {
                // Initialize results if not already set
                if (!results[sheetName]) {
                  results[sheetName] = { deleted: 0, total: 0, inserted: 0 };
                }
                send({
                  type: "insert_done",
                  table: sheetName,
                  total: 0,
                  inserted: 0,
                });
                continue;
              }

              const model = MODEL_ACCESSORS[sheetName];
              if (!model) continue;

              const prepared = rows.map(prepareRow);
              const total = prepared.length;

              // Notify start
              send({
                type: "insert_start",
                table: sheetName,
                total,
              });

              // Insert rows one by one
              let inserted = 0;
              let insertErrors = 0;
              for (const row of prepared) {
                try {
                  await (tx as any)[model.accessor].create({ data: row as any });
                  inserted++;
                } catch (err) {
                  insertErrors++;
                  const rowId = row.id ?? row.name ?? JSON.stringify(row).slice(0, 80);
                  const errMsg = err instanceof Error ? err.message : String(err);
                  console.error(
                    `Import error [${sheetName} row ${inserted + insertErrors}]:`,
                    errMsg,
                    JSON.stringify(row)
                  );
                  // Send individual row error so the UI can show it
                  send({
                    type: "insert_error",
                    table: sheetName,
                    row: rowId,
                    error: errMsg,
                  });
                }
              }

              if (insertErrors > 0) {
                console.warn(
                  `Import: ${insertErrors} of ${total} rows FAILED in ${sheetName}`
                );
              }

              results[sheetName].total = total;
              results[sheetName].inserted = inserted;
              results[sheetName].errors = insertErrors;

              send({
                type: "insert_done",
                table: sheetName,
                total,
                inserted,
              });
            }
          },
          { timeout: 60000 }
        );

        const user = await getUserFromCookie(request).catch(() => null);
      createAuditLog({
        action: "CREATE",
        entity: "Database",
        description: "Base de datos importada desde archivo Excel",
        userId: user?.id,
        userName: user?.name,
      });

      send({
          type: "done",
          message: "Base de datos importada exitosamente",
          results,
        });
      } catch (error) {
        console.error("Error importing database:", error);
        send({ type: "error", message: "Error al importar la base de datos" });
      } finally {
        try {
          controller.close();
        } catch {
          // Stream may already be closed, ignore
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
