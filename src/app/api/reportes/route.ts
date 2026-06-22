import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/requireRole";

type SaleAggregate = Prisma.PrismaPromise<{
  _sum: { total: number | null };
  _count: number;
}>;

type EmployeeWithSales = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  role: string;
  active: boolean;
  startDate: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type SaleForEmployee = {
  total: number;
  employeeId: number | null;
  date: Date;
};

export async function GET(request: Request) {
  const auth = await requireRole(request, ["ADMIN"]);
  if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();

    // Custom date range from query params
    const customStart = searchParams.get("startDate");
    const customEnd = searchParams.get("endDate");
    const employeeId = searchParams.get("employeeId");

    // Fechas de referencia para periodos predefinidos
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const startOf3Months = new Date(now);
    startOf3Months.setMonth(now.getMonth() - 3);
    startOf3Months.setDate(1);
    startOf3Months.setHours(0, 0, 0, 0);

    const allTimeStart = new Date(0);

    function buildEmployeeFilter(): Prisma.SaleWhereInput | undefined {
      if (!employeeId) return undefined;
      if (employeeId === "_unassigned") return { employeeId: null };
      return { employeeId: Number(employeeId) };
    }

    function salesAggregate(gte: Date, lte?: Date): SaleAggregate {
      const where: Prisma.SaleWhereInput = { date: { gte } };
      if (lte) {
        where.date = { gte, lte };
      }
      const empFilter = buildEmployeeFilter();
      if (empFilter) {
        where.employeeId = empFilter.employeeId;
      }
      return prisma.sale.aggregate({
        _sum: { total: true },
        _count: true,
        where,
      });
    }

    // Construir promesas base (tipadas individualmente)
    const p1 = salesAggregate(allTimeStart);
    const p2 = salesAggregate(startOf3Months);
    const p3 = salesAggregate(startOfMonth);
    const p4 = salesAggregate(startOfWeek);
    const p5: Prisma.PrismaPromise<EmployeeWithSales[]> = prisma.employee.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });

    // Si hay rango personalizado, filtrar ventas de empleadas por ese rango
    let customStartDate: Date | null = null;
    let customEndDate: Date | null = null;
    let salesWhereEmployees: Prisma.SaleWhereInput = { employeeId: { not: null } };

    if (customStart) {
      customStartDate = new Date(customStart + "T00:00:00");
      customEndDate = customEnd ? new Date(customEnd + "T23:59:59") : new Date();
      salesWhereEmployees = {
        employeeId: { not: null },
        date: { gte: customStartDate, lte: customEndDate },
      };
    }

    // Apply employee filter to employee sales query
    const empFilter = buildEmployeeFilter();
    if (empFilter && salesWhereEmployees.employeeId) {
      salesWhereEmployees.employeeId = empFilter.employeeId;
    }

    const p6: Prisma.PrismaPromise<SaleForEmployee[]> = prisma.sale.findMany({
      where: salesWhereEmployees,
      select: {
        total: true,
        employeeId: true,
        date: true,
      },
      orderBy: { date: "desc" },
    });

    // Consulta para evolución mensual (todas las ventas, o filtradas por rango)
    let allSalesWhere: Prisma.SaleWhereInput = {};
    if (customStart && customStartDate) {
      allSalesWhere = { date: { gte: customStartDate, lte: customEndDate! } };
    }
    const empFilterAll = buildEmployeeFilter();
    if (empFilterAll) {
      allSalesWhere.employeeId = empFilterAll.employeeId;
    }

    const p7: Prisma.PrismaPromise<{ total: number; date: Date }[]> = prisma.sale.findMany({
      where: allSalesWhere,
      select: { total: true, date: true },
      orderBy: { date: "asc" },
    });

    // Si hay rango personalizado, agregar consulta de agregación extra
    let p8: SaleAggregate | null = null;

    if (customStart && customStartDate) {
      p8 = salesAggregate(customStartDate, customEndDate!);
    }

    const [allTime, last3Months, lastMonth, lastWeek, employees, salesWithEmployee, allSales, customRange] = p8
      ? await Promise.all([p1, p2, p3, p4, p5, p6, p7, p8])
      : await Promise.all([p1, p2, p3, p4, p5, p6, p7]);

    // Agrupar ventas por mes para evolución mensual
    const monthlyMap = new Map<string, { total: number; count: number }>();
    for (const sale of allSales) {
      const key = `${sale.date.getFullYear()}-${String(sale.date.getMonth() + 1).padStart(2, "0")}`;
      const entry = monthlyMap.get(key) || { total: 0, count: 0 };
      entry.total += sale.total;
      entry.count += 1;
      monthlyMap.set(key, entry);
    }
    const monthNames = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    const monthlyEvolution = Array.from(monthlyMap.entries()).map(([month, data]) => {
      const [yearStr, monthStr] = month.split("-");
      const m = parseInt(monthStr) - 1;
      return {
        month,
        label: `${monthNames[m]} ${yearStr}`,
        total: data.total,
        count: data.count,
      };
    });

    // Rendimiento por empleada
    const employeePerformance = employees.map((emp: EmployeeWithSales) => {
      const sales = salesWithEmployee.filter((s: SaleForEmployee) => s.employeeId === emp.id);
      const totalBilled = sales.reduce((sum: number, s: SaleForEmployee) => sum + s.total, 0);
      const saleCount = sales.length;

      const monthlySales = sales
        .filter((s: SaleForEmployee) => s.date >= startOfMonth)
        .reduce((sum: number, s: SaleForEmployee) => sum + s.total, 0);

      return {
        id: emp.id,
        name: emp.name,
        totalBilled,
        saleCount,
        monthlySales,
        averageTicket: saleCount > 0 ? totalBilled / saleCount : 0,
      };
    });

    employeePerformance.sort((a, b) => b.totalBilled - a.totalBilled);

    const response: {
      billing: {
        allTime: { total: number; count: number };
        last3Months: { total: number; count: number };
        lastMonth: { total: number; count: number };
        lastWeek: { total: number; count: number };
        customRange?: { total: number; count: number; startDate: string; endDate: string };
      };
      employeePerformance: typeof employeePerformance;
      monthlyEvolution: typeof monthlyEvolution;
    } = {
      billing: {
        allTime: {
          total: allTime._sum.total || 0,
          count: allTime._count,
        },
        last3Months: {
          total: last3Months._sum.total || 0,
          count: last3Months._count,
        },
        lastMonth: {
          total: lastMonth._sum.total || 0,
          count: lastMonth._count,
        },
        lastWeek: {
          total: lastWeek._sum.total || 0,
          count: lastWeek._count,
        },
      },
      employeePerformance,
      monthlyEvolution,
    };

    if (customRange && customStartDate) {
      response.billing.customRange = {
        total: customRange._sum.total || 0,
        count: customRange._count,
        startDate: customStart!,
        endDate: customEnd || now.toISOString().split("T")[0],
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al obtener datos de reportes" },
      { status: 500 }
    );
  }
}
