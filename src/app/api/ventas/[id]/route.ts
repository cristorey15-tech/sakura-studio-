import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCsrf } from "@/lib/withCsrf";
import { getUserFromCookie } from "@/lib/jwt";
import { createAuditLog } from "@/lib/auditLog";
import { requireRole } from "@/lib/requireRole";

/**
 * PATCH /api/ventas/[id] — Actualizar campos de una venta (fecha, notas, método de pago)
 */
export const PATCH = withCsrf(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const auth = await requireRole(request, ["ADMIN"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const body = await request.json();
    const { date, notes, paymentMethod, exchangeRate, total, totalBs, employeeId } = body;

    // Build update data — only include fields that were sent
    const updateData: Record<string, unknown> = {};

    if (date) {
      const [y, m, d] = date.split("-").map(Number);
      updateData.date = new Date(y, m - 1, d, 12, 0, 0);
    }
    if (notes !== undefined) updateData.notes = notes;
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
    if (exchangeRate !== undefined) updateData.exchangeRate = exchangeRate || null;
    if (total !== undefined) updateData.total = Number(total);
    if (totalBs !== undefined) updateData.totalBs = totalBs !== null ? Number(totalBs) : null;
    if (employeeId !== undefined) updateData.employeeId = employeeId ? Number(employeeId) : null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    const sale = await prisma.sale.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        client: true,
        employee: { select: { id: true, name: true } },
      },
    });

    const user = await getUserFromCookie(request);
    const changes = Object.keys(updateData).join(", ");
    await createAuditLog({
      action: "UPDATE",
      entity: "Sale",
      entityId: Number(id),
      description: `Venta #${id} actualizada: ${changes} — ${sale.client?.name || "Sin cliente"} ($${sale.total?.toFixed(2) || 0})`,
      userId: user?.id,
      userName: user?.name,
    });

    return NextResponse.json(sale);
  } catch (error) {
    console.error("Error al actualizar venta:", error);
    return NextResponse.json(
      { error: "Error al actualizar la venta" },
      { status: 500 }
    );
  }
});

export const DELETE = withCsrf(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const auth = await requireRole(_request, ["ADMIN"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const sale = await prisma.sale.findUnique({
      where: { id: Number(id) },
      include: { client: true },
    });
    await prisma.saleItem.deleteMany({ where: { saleId: Number(id) } });
    await prisma.sale.delete({ where: { id: Number(id) } });
    const user = await getUserFromCookie(_request);
    await createAuditLog({
      action: "DELETE",
      entity: "Sale",
      entityId: Number(id),
      description: `Venta #${id} eliminada${sale?.client ? ` - ${sale.client.name}` : ""} ($${sale?.total || 0})`,
      userId: user?.id,
      userName: user?.name,
    });
    return NextResponse.json({ message: "Venta eliminada" });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al eliminar venta" },
      { status: 500 }
    );
  }
});
