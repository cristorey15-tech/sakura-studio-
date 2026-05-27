import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: Request) {
  const auth = await requireRole(request, ["ADMIN"]);
  if (auth.error) return auth.error;
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Domingo
    startOfWeek.setHours(0, 0, 0, 0);

    // Obtener todos los ítems de venta con servicios del mes actual
    const saleItems = await prisma.saleItem.findMany({
      where: {
        sale: {
          date: { gte: startOfMonth },
          employeeId: { not: null },
        },
        serviceId: { not: null },
        service: {
          commissionPercent: { gt: 0 },
        },
      },
      include: {
        sale: { select: { employeeId: true, date: true, employee: { select: { id: true, name: true } } } },
        service: { select: { id: true, name: true, commissionPercent: true, price: true } },
      },
      orderBy: { sale: { date: "desc" } },
    });

    // Agrupar por empleada
    const commissionMap = new Map<number, {
      employeeId: number;
      employeeName: string;
      monthlyCommission: number;
      weeklyCommission: number;
      totalServices: number;
      details: Array<{
        serviceName: string;
        price: number;
        commissionPercent: number;
        commissionAmount: number;
        date: string;
      }>;
    }>();

    for (const item of saleItems) {
      const empId = item.sale.employeeId!;
      const empName = item.sale.employee?.name || "—";
      const commissionAmount = (item.price * (item.service?.commissionPercent || 0)) / 100;

      if (!commissionMap.has(empId)) {
        commissionMap.set(empId, {
          employeeId: empId,
          employeeName: empName,
          monthlyCommission: 0,
          weeklyCommission: 0,
          totalServices: 0,
          details: [],
        });
      }

      const entry = commissionMap.get(empId)!;
      entry.monthlyCommission += commissionAmount;
      entry.totalServices += 1;
      entry.details.push({
        serviceName: item.service?.name || "—",
        price: item.price,
        commissionPercent: item.service?.commissionPercent || 0,
        commissionAmount,
        date: item.sale.date.toISOString(),
      });

      // Check if within this week
      if (item.sale.date >= startOfWeek) {
        entry.weeklyCommission += commissionAmount;
      }
    }

    // Convert to array sorted by monthly commission desc
    const commissions = Array.from(commissionMap.values())
      .map((c) => ({
        ...c,
        monthlyCommission: Math.round(c.monthlyCommission * 100) / 100,
        weeklyCommission: Math.round(c.weeklyCommission * 100) / 100,
      }))
      .sort((a, b) => b.monthlyCommission - a.monthlyCommission);

    return NextResponse.json(commissions);
  } catch (error) {
    console.error("Commissions API error:", error);
    return NextResponse.json(
      { error: "Error al calcular comisiones" },
      { status: 500 }
    );
  }
}
