import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCsrf } from "@/lib/withCsrf";
import { createAuditLog } from "@/lib/auditLog";
import { getUserFromCookie } from "@/lib/jwt";
import { requireRole } from "@/lib/requireRole";

export const DELETE = withCsrf(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requireRole(request, ["ADMIN"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const expense = await prisma.expense.delete({ where: { id: Number(id) } });
    const user = await getUserFromCookie(request);
    createAuditLog({
      action: "DELETE",
      entity: "Expense",
      entityId: expense.id,
      description: `Gasto eliminado: ${expense.concept} - $${expense.amount.toFixed(2)}`,
      userId: user?.id,
      userName: user?.name,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error al eliminar gasto" }, { status: 500 });
  }
});

export const PUT = withCsrf(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requireRole(request, ["ADMIN"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const data = await request.json();
    const expense = await prisma.expense.update({
      where: { id: Number(id) },
      data: {
        concept: data.concept,
        amount: Number(data.amount),
        amountBs: data.amountBs ? Number(data.amountBs) : null,
        category: data.category,
        date: data.date ? new Date(data.date) : undefined,
        registeredBy: data.registeredBy || null,
        notes: data.notes || null,
      },
    });
    const user = await getUserFromCookie(request);
    createAuditLog({
      action: "UPDATE",
      entity: "Expense",
      entityId: expense.id,
      description: `Gasto actualizado: ${expense.concept} - $${expense.amount.toFixed(2)}`,
      userId: user?.id,
      userName: user?.name,
    });
    return NextResponse.json(expense);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error al actualizar gasto" }, { status: 500 });
  }
});
