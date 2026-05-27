import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCsrf } from "@/lib/withCsrf";
import { getUserFromCookie } from "@/lib/jwt";
import { createAuditLog } from "@/lib/auditLog";
import { requireWriteAdmin } from "@/lib/requireRole";

export const PUT = withCsrf(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const auth = await requireWriteAdmin(request);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const data = await request.json();
    const oldService = await prisma.service.findUnique({ where: { id: Number(id) } });
    const service = await prisma.service.update({
      where: { id: Number(id) },
      data,
    });
    const user = await getUserFromCookie(request);
    await createAuditLog({
      action: "UPDATE",
      entity: "Service",
      entityId: service.id,
      description: `Servicio actualizado: ${service.name} (${oldService?.name !== service.name ? `${oldService?.name} → ${service.name}` : ""})`,
      userId: user?.id,
      userName: user?.name,
    });
    return NextResponse.json(service);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al actualizar servicio" },
      { status: 500 }
    );
  }
});

export const DELETE = withCsrf(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const auth = await requireWriteAdmin(_request);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const service = await prisma.service.findUnique({ where: { id: Number(id) } });
    await prisma.service.delete({ where: { id: Number(id) } });
    const user = await getUserFromCookie(_request);
    await createAuditLog({
      action: "DELETE",
      entity: "Service",
      entityId: Number(id),
      description: `Servicio eliminado: ${service?.name || `ID ${id}`}`,
      userId: user?.id,
      userName: user?.name,
    });
    return NextResponse.json({ message: "Servicio eliminado" });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al eliminar servicio" },
      { status: 500 }
    );
  }
});
