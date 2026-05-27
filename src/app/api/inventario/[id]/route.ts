import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCsrf } from "@/lib/withCsrf";
import { createAuditLog } from "@/lib/auditLog";
import { getUserFromCookie } from "@/lib/jwt";
import { requireRole } from "@/lib/requireRole";

export const PUT = withCsrf(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const auth = await requireRole(request, ["ADMIN"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const data = await request.json();
    const product = await prisma.product.update({
      where: { id: Number(id) },
      data,
    });
    const user = await getUserFromCookie(request);
    createAuditLog({
      action: "UPDATE",
      entity: "Product",
      entityId: product.id,
      description: `Producto "${product.name}" actualizado`,
      userId: user?.id,
      userName: user?.name,
    });
    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al actualizar producto" },
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
    const product = await prisma.product.findUnique({ where: { id: Number(id) } });
    await prisma.product.delete({ where: { id: Number(id) } });
    const user = await getUserFromCookie(_request);
    createAuditLog({
      action: "DELETE",
      entity: "Product",
      entityId: Number(id),
      description: `Producto "${product?.name || id}" eliminado`,
      userId: user?.id,
      userName: user?.name,
    });
    return NextResponse.json({ message: "Producto eliminado" });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al eliminar producto" },
      { status: 500 }
    );
  }
});
