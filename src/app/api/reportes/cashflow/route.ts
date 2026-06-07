import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: Request) {
  const auth = await requireRole(request, ["ADMIN"]);
  if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate + "T00:00:00");
    else dateFilter.gte = startOfMonth;
    if (endDate) dateFilter.lte = new Date(endDate + "T23:59:59");
    else dateFilter.lte = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Fetch sales and expenses in parallel
    const [sales, expenses] = await Promise.all([
      prisma.sale.findMany({
        where: { date: dateFilter },
        select: { total: true, totalBs: true, date: true, paymentMethod: true },
      }),
      prisma.expense.findMany({
        where: { date: dateFilter },
        select: { amount: true, amountBs: true, category: true, date: true },
      }),
    ]);

    const totalIncomeUSD = sales.reduce((s, r) => s + r.total, 0);
    const totalIncomeBs = sales.reduce((s, r) => s + (r.totalBs || 0), 0);
    const totalExpensesUSD = expenses.reduce((s, r) => s + r.amount, 0);
    const totalExpensesBs = expenses.reduce((s, r) => s + (r.amountBs || 0), 0);

    // Group by category
    const expensesByCategory = expenses.reduce((acc: Record<string, number>, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {});

    // Income by payment method
    const incomeByMethod = sales.reduce((acc: Record<string, number>, s) => {
      const method = s.paymentMethod || "OTRO";
      acc[method] = (acc[method] || 0) + s.total;
      return acc;
    }, {});

    // Monthly trend
    const monthlyMap = new Map<string, { income: number; expenses: number }>();
    for (const sale of sales) {
      const key = `${sale.date.getFullYear()}-${String(sale.date.getMonth() + 1).padStart(2, "0")}`;
      const entry = monthlyMap.get(key) || { income: 0, expenses: 0 };
      entry.income += sale.total;
      monthlyMap.set(key, entry);
    }
    for (const expense of expenses) {
      const key = `${expense.date.getFullYear()}-${String(expense.date.getMonth() + 1).padStart(2, "0")}`;
      const entry = monthlyMap.get(key) || { income: 0, expenses: 0 };
      entry.expenses += expense.amount;
      monthlyMap.set(key, entry);
    }

    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const monthlyTrend = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]) => {
        const [yearStr, monthStr] = key.split("-");
        const m = parseInt(monthStr) - 1;
        return {
          month: key,
          label: `${monthNames[m]} ${yearStr}`,
          income: data.income,
          expenses: data.expenses,
          profit: data.income - data.expenses,
        };
      });

    return NextResponse.json({
      summary: {
        totalIncomeUSD,
        totalIncomeBs,
        totalExpensesUSD,
        totalExpensesBs,
        netProfitUSD: totalIncomeUSD - totalExpensesUSD,
        netProfitBs: totalIncomeBs - totalExpensesBs,
        saleCount: sales.length,
        expenseCount: expenses.length,
      },
      expensesByCategory,
      incomeByMethod,
      monthlyTrend,
      dateRange: {
        start: dateFilter.gte,
        end: dateFilter.lte,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error al obtener datos de flujo de caja" }, { status: 500 });
  }
}
