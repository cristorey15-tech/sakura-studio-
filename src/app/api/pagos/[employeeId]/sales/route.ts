import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const { employeeId: empId } = await params;
    const employeeId = parseInt(empId, 10);
    if (isNaN(employeeId)) {
      return NextResponse.json({ error: "ID de empleada inválido" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build date filter
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate + "T00:00:00");
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate + "T23:59:59");
    } else if (startDate) {
      dateFilter.lte = new Date();
    }

    const salesWhere: { employeeId: number; date?: typeof dateFilter } = {
      employeeId,
    };
    if (Object.keys(dateFilter).length > 0) {
      salesWhere.date = dateFilter;
    }

    const [employee, sales] = await Promise.all([
      prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, name: true },
      }),
      prisma.sale.findMany({
        where: salesWhere,
        include: {
          client: { select: { id: true, name: true } },
          items: {
            include: { service: { select: { id: true, name: true } } },
          },
        },
        orderBy: { date: "desc" },
      }),
    ]);

    if (!employee) {
      return NextResponse.json({ error: "Empleada no encontrada" }, { status: 404 });
    }

    const detailSales = sales.map((sale) => ({
      id: sale.id,
      date: sale.date.toISOString(),
      clientName: sale.client?.name ?? null,
      services: sale.items
        .filter((item) => item.service)
        .map((item) => ({
          name: item.service!.name,
          quantity: item.quantity,
          price: item.price,
        })),
      paymentMethod: sale.paymentMethod,
      total: sale.total,
      totalBs: sale.totalBs,
      exchangeRate: sale.exchangeRate,
    }));

    const totalUsd = detailSales.reduce((sum, s) => sum + s.total, 0);
    const totalBs = detailSales.reduce((sum, s) => sum + (s.totalBs || 0), 0);

    return NextResponse.json({
      employee: { id: employee.id, name: employee.name },
      sales: detailSales,
      totals: {
        totalUsd,
        totalBs,
        saleCount: detailSales.length,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al obtener detalle de pagos" },
      { status: 500 }
    );
  }
}
