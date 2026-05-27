import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { requireRole } from "@/lib/requireRole";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireRole(request, ["ADMIN"]);
  if (auth.error) return auth.error;
  try {
    // Fetch all data from all models
    const [services, clients, appointments, sales, saleItems, templates, employees, products, settings] =
      await Promise.all([
        prisma.service.findMany(),
        prisma.client.findMany(),
        prisma.appointment.findMany(),
        prisma.sale.findMany(),
        prisma.saleItem.findMany(),
        prisma.wATemplate.findMany(),
        prisma.employee.findMany(),
        prisma.product.findMany(),
        prisma.studioSettings.findMany(),
      ]);

    const wb = XLSX.utils.book_new();

    // Serialize data — convert Date objects and BigInt to strings
    const serialize = (rows: unknown[]) =>
      rows.map((row: any) => {
        const obj: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(row)) {
          if (val instanceof Date) {
            obj[key] = val.toISOString();
          } else {
            obj[key] = val;
          }
        }
        return obj;
      });

    // Helper to add a sheet
    const addSheet = (name: string, data: unknown[]) => {
      const ws = XLSX.utils.json_to_sheet(serialize(data));
      // Auto-fit column widths
      const cols = Object.keys(data[0] || {}).map((key) => ({
        wch: Math.min(Math.max(key.length, 12), 30),
      }));
      ws["!cols"] = cols;
      XLSX.utils.book_append_sheet(wb, ws, name);
    };

    if (services.length > 0) addSheet("Servicios", services);
    if (clients.length > 0) addSheet("Clientes", clients);
    if (appointments.length > 0) addSheet("Citas", appointments);
    if (sales.length > 0) addSheet("Ventas", sales);
    if (saleItems.length > 0) addSheet("SaleItems", saleItems);
    if (templates.length > 0) addSheet("WATemplates", templates);
    if (employees.length > 0) addSheet("Empleadas", employees);
    if (products.length > 0) addSheet("Productos", products);
    if (settings.length > 0) addSheet("StudioSettings", settings);

    // If no data at all, create empty sheets as templates
    if (
      services.length === 0 &&
      clients.length === 0 &&
      appointments.length === 0 &&
      sales.length === 0 &&
      saleItems.length === 0 &&
      templates.length === 0 &&
      employees.length === 0 &&
      products.length === 0 &&
      settings.length === 0
    ) {
      const emptySheets = [
        "Servicios",
        "Clientes",
        "Citas",
        "Ventas",
        "SaleItems",
        "WATemplates",
        "Empleadas",
        "Productos",
        "StudioSettings",
      ];
      for (const name of emptySheets) {
        const ws = XLSX.utils.aoa_to_sheet([["(sin datos)"]]);
        XLSX.utils.book_append_sheet(wb, ws, name);
      }
    }

    // Generate buffer
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const filename = `sakura-backup-${new Date().toISOString().split("T")[0]}.xlsx`;

    return new NextResponse(buf, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error exporting database:", error);
    return NextResponse.json(
      { error: "Error al exportar la base de datos" },
      { status: 500 }
    );
  }
}
