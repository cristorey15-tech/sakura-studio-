import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCsrf } from "@/lib/withCsrf";
import { getUserFromCookie } from "@/lib/jwt";
import { createAuditLog } from "@/lib/auditLog";
import { requireWriteAdmin } from "@/lib/requireRole";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const appPage = Math.max(1, Number(searchParams.get("appPage")) || 1);
    const appLimit = Math.min(50, Math.max(1, Number(searchParams.get("appLimit")) || 5));
    const salesPage = Math.max(1, Number(searchParams.get("salesPage")) || 1);
    const salesLimit = Math.min(50, Math.max(1, Number(searchParams.get("salesLimit")) || 5));

    const clientId = Number(id);

    const [client, appointmentsTotal, salesTotal, salesAgg] = await Promise.all([
      prisma.client.findUnique({ where: { id: clientId } }),
      prisma.appointment.count({ where: { clientId } }),
      prisma.sale.count({ where: { clientId } }),
      prisma.sale.aggregate({
        where: { clientId },
        _sum: { total: true, totalBs: true },
      }),
    ]);

    if (!client) {
      return NextResponse.json(
        { error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    const [appointments, sales] = await Promise.all([
      prisma.appointment.findMany({
        where: { clientId },
        include: { service: true },
        orderBy: { date: "desc" },
        skip: (appPage - 1) * appLimit,
        take: appLimit,
      }),
      prisma.sale.findMany({
        where: { clientId },
        include: {
          items: {
            include: { service: true, product: true },
          },
        },
        orderBy: { date: "desc" },
        skip: (salesPage - 1) * salesLimit,
        take: salesLimit,
      }),
    ]);

    return NextResponse.json({
      ...client,
      appointments,
      appointmentsTotal,
      appointmentsPage: appPage,
      appointmentsTotalPages: Math.ceil(appointmentsTotal / appLimit),
      sales,
      salesTotal,
      salesPage: salesPage,
      salesTotalPages: Math.ceil(salesTotal / salesLimit),
      totalSpent: salesAgg._sum.total || 0,
      totalSpentBs: salesAgg._sum.totalBs || 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al obtener cliente" },
      { status: 500 }
    );
  }
}

export const PUT = withCsrf(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const auth = await requireWriteAdmin(request);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const data = await request.json();
    const client = await prisma.client.update({
      where: { id: Number(id) },
      data,
    });
    const user = await getUserFromCookie(request);
    await createAuditLog({
      action: "UPDATE",
      entity: "Client",
      entityId: client.id,
      description: `Cliente actualizado: ${client.name}`,
      userId: user?.id?.toString(),
      userName: user?.name,
    });
    return NextResponse.json(client);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al actualizar cliente" },
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
    const client = await prisma.client.findUnique({ where: { id: Number(id) } });
    await prisma.client.delete({ where: { id: Number(id) } });
    const user = await getUserFromCookie(_request);
    await createAuditLog({
      action: "DELETE",
      entity: "Client",
      entityId: Number(id),
      description: `Cliente eliminado: ${client?.name || `ID ${id}`}`,
      userId: user?.id?.toString(),
      userName: user?.name,
    });
    return NextResponse.json({ message: "Cliente eliminado" });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al eliminar cliente" },
      { status: 500 }
    );
  }
});
