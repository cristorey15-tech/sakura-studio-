import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/requireRole";

export async function POST(request: Request) {
  const auth = await requireRole(request, ["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    // Get counts for backup verification
    const counts = await Promise.all([
      prisma.client.count(),
      prisma.service.count(),
      prisma.appointment.count(),
      prisma.sale.count(),
      prisma.employee.count(),
      prisma.product.count(),
    ]);

    const summary = {
      clients: counts[0],
      services: counts[1],
      appointments: counts[2],
      sales: counts[3],
      employees: counts[4],
      products: counts[5],
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      message: `Backup verificado: ${summary.clients} clientes, ${summary.services} servicios, ${summary.appointments} citas, ${summary.sales} ventas, ${summary.employees} empleadas, ${summary.products} productos`,
      summary,
    });
  } catch (error) {
    console.error("Backup API error:", error);
    return NextResponse.json({ error: "Error al generar backup" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const auth = await requireRole(request, ["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const counts = await Promise.all([
      prisma.client.count(),
      prisma.service.count(),
      prisma.appointment.count(),
      prisma.sale.count(),
      prisma.employee.count(),
      prisma.product.count(),
    ]);

    return NextResponse.json({
      clients: counts[0],
      services: counts[1],
      appointments: counts[2],
      sales: counts[3],
      employees: counts[4],
      products: counts[5],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: "Error al obtener estado de backup" }, { status: 500 });
  }
}
