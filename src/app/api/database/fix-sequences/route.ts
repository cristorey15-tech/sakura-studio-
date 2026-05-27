import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/requireRole";
import { createAuditLog } from "@/lib/auditLog";
import { getUserFromCookie } from "@/lib/jwt";
import { NextResponse } from "next/server";

const TABLES_WITH_SEQUENCES = [
  { table: '"Service"', label: "Servicios" },
  { table: '"Client"', label: "Clientes" },
  { table: '"Employee"', label: "Empleadas" },
  { table: '"Product"', label: "Productos" },
  { table: '"WATemplate"', label: "Plantillas WA" },
  { table: '"StudioSettings"', label: "Configuración" },
  { table: '"Appointment"', label: "Citas" },
  { table: '"Sale"', label: "Ventas" },
  { table: '"SaleItem"', label: "SaleItems" },
];

export async function POST(request: Request) {
  const auth = await requireRole(request, ["ADMIN"]);
  if (auth.error) return auth.error;

  const results: {
    table: string;
    label: string;
    newValue: number;
    success: boolean;
    error?: string;
  }[] = [];

  try {
    for (const { table, label } of TABLES_WITH_SEQUENCES) {
      try {
        // Get max ID in table
        const maxId = await prisma.$queryRawUnsafe<
          { max: number | null }[]
        >(`SELECT MAX(id) FROM ${table}`);

        const newSeqValue = (maxId[0]?.max ?? 0) + 1;

        // Reset the sequence to max(id) + 1
        await prisma.$executeRawUnsafe(
          `SELECT setval(pg_get_serial_sequence('${table}', 'id'), ${newSeqValue})`
        );

        results.push({
          table,
          label,
          newValue: newSeqValue,
          success: true,
        });
      } catch (err) {
        results.push({
          table,
          label,
          newValue: 0,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const user = await getUserFromCookie(request).catch(() => null);
    createAuditLog({
      action: "UPDATE",
      entity: "Database",
      description: "Secuencias auto-incrementales corregidas",
      userId: user?.id,
      userName: user?.name,
    });

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: failCount === 0,
      message: `${successCount} secuencias corregidas${failCount > 0 ? `, ${failCount} fallaron` : ""}`,
      results,
    });
  } catch (error) {
    console.error("Error fixing sequences:", error);
    return NextResponse.json(
      { error: "Error al corregir las secuencias" },
      { status: 500 }
    );
  }
}
