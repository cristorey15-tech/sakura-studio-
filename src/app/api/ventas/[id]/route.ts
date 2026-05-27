import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCsrf } from "@/lib/withCsrf";
import { getUserFromCookie } from "@/lib/jwt";
import { createAuditLog } from "@/lib/auditLog";
import { requireRole } from "@/lib/requireRole";

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
