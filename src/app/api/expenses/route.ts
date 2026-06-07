import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCsrf } from "@/lib/withCsrf";
import { createAuditLog } from "@/lib/auditLog";
import { getUserFromCookie } from "@/lib/jwt";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: Request) {
  const auth = await requireRole(request, ["ADMIN"]);
  if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;
    const category = searchParams.get("category") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";

    const where: any = {};
    if (category) where.category = category;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate + "T00:00:00");
      if (endDate) where.date.lte = new Date(endDate + "T23:59:59");
    }

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        skip,
        take: limit,
        where,
        orderBy: { date: "desc" },
      }),
      prisma.expense.count({ where }),
    ]);

    // Summary stats
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [monthExpenses, todayExpenses] = await Promise.all([
      prisma.expense.findMany({
        where: { date: { gte: monthStart } },
        select: { amount: true, amountBs: true },
      }),
      prisma.expense.findMany({
        where: { date: { gte: todayStart } },
        select: { amount: true, amountBs: true },
      }),
    ]);

    const stats = {
      totalMonthUSD: monthExpenses.reduce((s, e) => s + e.amount, 0),
      totalMonthBs: monthExpenses.reduce((s, e) => s + (e.amountBs || 0), 0),
      totalTodayUSD: todayExpenses.reduce((s, e) => s + e.amount, 0),
      totalTodayBs: todayExpenses.reduce((s, e) => s + (e.amountBs || 0), 0),
      countMonth: monthExpenses.length,
    };

    return NextResponse.json({ data: expenses, total, page, limit, totalPages: Math.ceil(total / limit), stats });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error al obtener gastos" }, { status: 500 });
  }
}

export const POST = withCsrf(async (request: Request) => {
  const auth = await requireRole(request, ["ADMIN"]);
  if (auth.error) return auth.error;
  try {
    const data = await request.json();

    if (!data.concept || !data.amount || !data.category) {
      return NextResponse.json({ error: "Concepto, monto y categoría son obligatorios" }, { status: 400 });
    }

    const expense = await prisma.expense.create({
      data: {
        concept: data.concept,
        amount: Number(data.amount),
        amountBs: data.amountBs ? Number(data.amountBs) : null,
        category: data.category,
        date: data.date ? new Date(data.date) : new Date(),
        registeredBy: data.registeredBy || null,
        notes: data.notes || null,
      },
    });

    const user = await getUserFromCookie(request);
    createAuditLog({
      action: "CREATE",
      entity: "Expense",
      entityId: expense.id,
      description: `Gasto registrado: ${expense.concept} - $${expense.amount.toFixed(2)} (${expense.category})`,
      userId: user?.id,
      userName: user?.name,
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error al crear gasto" }, { status: 500 });
  }
});
