import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build date filter for sales
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate + "T00:00:00");
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate + "T23:59:59");
    } else if (startDate) {
      dateFilter.lte = new Date();
    }

    const salesWhere: { employeeId: { not: null }; date?: typeof dateFilter } = {
      employeeId: { not: null },
    };
    if (Object.keys(dateFilter).length > 0) {
      salesWhere.date = dateFilter;
    }

    const [employees, sales] = await Promise.all([
      prisma.employee.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
      }),
      prisma.sale.findMany({
        where: salesWhere,
        select: {
          total: true,
          totalBs: true,
          employeeId: true,
          date: true,
        },
        orderBy: { date: "desc" },
      }),
    ]);

    // Calculate totals per employee
    const employeePayments = employees.map((emp) => {
      const empSales = sales.filter((s) => s.employeeId === emp.id);
      const totalUsd = empSales.reduce((sum, s) => sum + s.total, 0);
      const totalBs = empSales.reduce((sum, s) => sum + (s.totalBs || 0), 0);
      const saleCount = empSales.length;
      const usdSales = empSales.filter((s) => !s.totalBs);
      const bsSales = empSales.filter((s) => s.totalBs != null);
      const usdCount = usdSales.length;
      const bsCount = bsSales.length;

      return {
        id: emp.id,
        name: emp.name,
        totalUsd,
        totalBs,
        saleCount,
        usdCount,
        bsCount,
      };
    });

    // Sort by total combined descending
    employeePayments.sort((a, b) => {
      const aCombined = a.totalUsd + a.totalBs;
      const bCombined = b.totalUsd + b.totalBs;
      return bCombined - aCombined;
    });

    // Totals
    const grandTotalUsd = employeePayments.reduce((s, e) => s + e.totalUsd, 0);
    const grandTotalBs = employeePayments.reduce((s, e) => s + e.totalBs, 0);

    return NextResponse.json({
      employees: employeePayments,
      totals: {
        totalUsd: grandTotalUsd,
        totalBs: grandTotalBs,
        totalEmployees: employeePayments.length,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al obtener datos de pagos" },
      { status: 500 }
    );
  }
}
