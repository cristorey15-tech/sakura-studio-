import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/jwt";

interface MonthlyPoint {
  month: string;
  label: string;
  total: number;
  count: number;
}

function getMonthLabel(m: number): string {
  const labels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return labels[m] || "";
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromCookie(request);
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");

    function buildEmpFilter(): { employeeId?: number | null } | undefined {
      if (!employeeId) return undefined;
      if (employeeId === "_unassigned") return { employeeId: null };
      return { employeeId: Number(employeeId) };
    }
    const empFilter = buildEmpFilter();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 86400000);

    // Calcular semana actual: domingo → sábado
    const dayOfWeek = now.getDay(); // 0=domingo, 6=sábado
    const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
    const saturday = new Date(sunday.getTime() + 7 * 86400000);

    // Comparativas
    const lastWeekStart = new Date(sunday.getTime() - 7 * 86400000);
    const lastWeekEnd = sunday;
    const yesterdayStart = new Date(startOfToday.getTime() - 86400000);
    const yesterdayEnd = startOfToday;
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const startOfMonthMinus1 = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Últimos 12 meses para tendencia
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1);

    const [
      totalClients,
      totalServices,
      totalAppointments,
      todayAppointments,
      monthlySales,
      todaySales,
      recentAppointments,
      servicesByCategory,
      completedThisWeek,
      lowStockProducts,
      // Para tendencia mensual
      allSales,
      // Servicios más populares
      topServicesRaw,
      // Top clientes
      topClientsRaw,
      // Servicios individuales completados esta semana
      weeklyServices,
      // Nuevas comparativas
      lastWeekSalesAgg,
      yesterdayAppointments,
      newClientsThisMonth,
      lastMonthSalesAgg,
      // Servicios completados esta semana por cada empleada
      servicesByEmployee,
    ] = await Promise.all([
      prisma.client.count(),
      prisma.service.count({ where: { active: true } }),
      prisma.appointment.count(),
      prisma.appointment.count({
        where: {
          date: { gte: startOfToday, lt: endOfToday },
          status: { not: "CANCELADA" },
        },
      }),
      prisma.sale.aggregate({
        _sum: { total: true },
        where: { date: { gte: startOfMonth }, ...empFilter },
      }),
      prisma.sale.aggregate({
        _sum: { total: true },
        where: { date: { gte: startOfToday, lt: endOfToday }, ...empFilter },
      }),
      prisma.appointment.findMany({
        take: 5,
        orderBy: { date: "asc" },
        where: {
          date: { gte: now },
          status: { not: "CANCELADA" },
        },
        include: {
          client: true,
          service: true,
        },
      }),
      prisma.service.groupBy({
        by: ["category"],
        _count: true,
      }),
      // Citas COMPLETADAS esta semana
      prisma.appointment.findMany({
        where: {
          date: { gte: sunday, lt: saturday },
          status: "COMPLETADA",
        },
        include: {
          service: { select: { category: true } },
        },
      }),
      prisma.product.findMany().then((products) =>
        products.filter((p) => p.quantity <= p.minStock)
      ),
      // Ventas de los últimos 12 meses
      prisma.sale.findMany({
        where: { date: { gte: twelveMonthsAgo }, ...empFilter },
        select: { date: true, total: true },
        orderBy: { date: "asc" },
      }),
      // Servicios más reservados (top 5)
      prisma.appointment.groupBy({
        by: ["serviceId"],
        _count: true,
        orderBy: { _count: { serviceId: "desc" } },
        take: 5,
      }).then(async (groups) => {
        if (groups.length === 0) return [];
        const serviceIds = groups.map((g) => g.serviceId);
        const services = await prisma.service.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true, name: true, category: true },
        });
        const serviceMap = new Map(services.map((s) => [s.id, s]));
        return groups.map((g) => ({
          id: g.serviceId,
          name: serviceMap.get(g.serviceId)?.name || "—",
          category: serviceMap.get(g.serviceId)?.category || "",
          count: g._count,
        }));
      }),
      // Top 5 clientes por gasto total
      prisma.sale.groupBy({
        by: ["clientId"],
        _sum: { total: true },
        _count: true,
        orderBy: { _sum: { total: "desc" } },
        take: 5,
        where: empFilter as any,
      }).then(async (groups) => {
        const valid = groups.filter((g) => g.clientId !== null);
        if (valid.length === 0) return [];
        const clientIds = valid.map((g) => g.clientId!);
        const clients = await prisma.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, name: true, phone: true },
        });
        const clientMap = new Map(clients.map((c) => [c.id, c]));
        return valid.map((g) => ({
          id: g.clientId,
          name: clientMap.get(g.clientId!)?.name || "—",
          phone: clientMap.get(g.clientId!)?.phone || null,
          totalSpent: g._sum.total || 0,
          saleCount: g._count,
        }));
      }),
      // Servicios individuales completados esta semana (filtrados por empleada logueada si no es admin)
      prisma.appointment.groupBy({
        by: ["serviceId"],
        where: {
          date: { gte: sunday, lt: saturday },
          status: "COMPLETADA",
          ...(user && user.role !== "ADMIN" ? { employeeId: user.id } : {}),
        },
        _count: true,
      }).then(async (groups) => {
        if (groups.length === 0) return [];
        const serviceIds = groups.map(g => g.serviceId);
        const services = await prisma.service.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true, name: true, category: true },
        });
        const serviceMap = new Map(services.map(s => [s.id, s]));
        return groups
          .map(g => ({
            serviceId: g.serviceId,
            serviceName: serviceMap.get(g.serviceId)?.name || "—",
            category: serviceMap.get(g.serviceId)?.category || "",
            count: g._count,
          }))
          .sort((a, b) => b.count - a.count);
      }),
      // Ventas de la semana pasada (para comparativa)
      prisma.sale.aggregate({
        _sum: { total: true },
        _count: true,
        where: { date: { gte: lastWeekStart, lt: lastWeekEnd }, ...empFilter },
      }),
      // Citas de ayer
      prisma.appointment.count({
        where: {
          date: { gte: yesterdayStart, lt: yesterdayEnd },
          status: { not: "CANCELADA" },
        },
      }),
      // Clientes nuevos este mes
      prisma.client.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      // Ventas del mes pasado
      prisma.sale.aggregate({
        _sum: { total: true },
        where: { date: { gte: startOfMonthMinus1, lt: startOfMonth }, ...empFilter },
      }),
      // Servicios completados esta semana por cada empleada
      prisma.appointment.groupBy({
        by: ["employeeId"],
        where: {
          date: { gte: sunday, lt: saturday },
          status: "COMPLETADA",
          employeeId: { not: null },
        },
        _count: true,
      }).then(async (groups) => {
        if (groups.length === 0) return [];
        const employeeIds = groups.map(g => g.employeeId!);
        const employees = await prisma.employee.findMany({
          where: { id: { in: employeeIds } },
          select: { id: true, name: true },
        });
        const employeeMap = new Map(employees.map(e => [e.id, e]));
        return groups
          .map(g => ({
            employeeId: g.employeeId,
            employeeName: employeeMap.get(g.employeeId!)?.name || "—",
            count: g._count,
          }))
          .sort((a, b) => b.count - a.count);
      }),
    ]);

    // Conteo de servicios completados esta semana por la empleada logueada
    const myWeeklyServices = user
      ? await prisma.appointment.count({
          where: {
            date: { gte: sunday, lt: saturday },
            status: "COMPLETADA",
            employeeId: user.id,
          },
        })
      : 0;

    // Fusionar completaciones semanales con todas las categorías existentes
    const counts: Record<string, number> = {};
    for (const apt of completedThisWeek) {
      const cat = apt.service.category;
      counts[cat] = (counts[cat] || 0) + 1;
    }
    const weeklyCompletedByCategory = servicesByCategory.map((s) => ({
      category: s.category,
      _count: counts[s.category] || 0,
    }));

    // Agrupar ventas por mes para la tendencia
    const monthlyMap = new Map<string, { total: number; count: number }>();
    for (const sale of allSales) {
      const d = new Date(sale.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthlyMap.get(key) || { total: 0, count: 0 };
      existing.total += sale.total;
      existing.count += 1;
      monthlyMap.set(key, existing);
    }

    // Construir los últimos 12 meses (incluyendo el actual aunque esté vacío)
    const monthlyTrend: MonthlyPoint[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const data = monthlyMap.get(key) || { total: 0, count: 0 };
      const monthLabel = getMonthLabel(d.getMonth());
      monthlyTrend.push({
        month: key,
        label: i === 0 ? `${monthLabel}` : `${monthLabel} ${String(d.getFullYear()).slice(2)}`,
        total: Number(data.total.toFixed(2)),
        count: data.count,
      });
    }

    return NextResponse.json({
      totalClients,
      totalServices,
      totalAppointments,
      todayAppointments,
      monthlySales: monthlySales._sum.total || 0,
      todaySales: todaySales._sum.total || 0,
      recentAppointments,
      servicesByCategory,
      weeklyCompletedByCategory,
      lowStockProducts,
      monthlyTrend,
      topServices: topServicesRaw,
      topClients: topClientsRaw,
      myWeeklyServices,
      myName: user?.name || null,
      servicesByEmployee,
      weeklyServices,
      lastWeekSales: lastWeekSalesAgg._sum.total || 0,
      lastWeekSalesCount: lastWeekSalesAgg._count,
      yesterdayAppointments,
      newClientsThisMonth,
      lastMonthSales: lastMonthSalesAgg._sum.total || 0,
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Error al obtener datos del dashboard" },
      { status: 500 }
    );
  }
}
