import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCsrf } from "@/lib/withCsrf";
import { requireRole } from "@/lib/requireRole";

export const PUT = withCsrf(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const auth = await requireRole(request, ["ADMIN", "EMPLEADA", "ESTETICISTA"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const data = await request.json();

    // Si la cita se está marcando como COMPLETADA, incrementar visitCount del cliente
    if (data.status === "COMPLETADA") {
      const currentAppointment = await prisma.appointment.findUnique({
        where: { id: Number(id) },
        select: { clientId: true, status: true },
      });

      if (currentAppointment && currentAppointment.status !== "COMPLETADA") {
        const client = await prisma.client.findUnique({
          where: { id: currentAppointment.clientId },
          select: { visitCount: true },
        });

        if (client) {
          const newVisitCount = client.visitCount + 1;
          // Cada 5 visitas → servicio gratis disponible
          const shouldHaveFreeService = newVisitCount > 0 && newVisitCount % 5 === 0;

          await prisma.client.update({
            where: { id: currentAppointment.clientId },
            data: {
              visitCount: newVisitCount,
              freeServiceAvailable: shouldHaveFreeService ? true : undefined,
            },
          });
        }
      }
    }

    const appointment = await prisma.appointment.update({
      where: { id: Number(id) },
      data: {
        ...(data.date && { date: new Date(data.date) }),
        ...(data.status && { status: data.status }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.clientId && { clientId: Number(data.clientId) }),
        ...(data.serviceId && { serviceId: Number(data.serviceId) }),
        ...(data.employeeId !== undefined && { employeeId: data.employeeId ? Number(data.employeeId) : null }),
      },
      include: {
        client: true,
        service: true,
        employee: true,
      },
    });
    return NextResponse.json(appointment);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al actualizar cita" },
      { status: 500 }
    );
  }
});

export const DELETE = withCsrf(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const auth = await requireRole(_request, ["ADMIN", "EMPLEADA", "ESTETICISTA"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    await prisma.appointment.delete({ where: { id: Number(id) } });
    return NextResponse.json({ message: "Cita eliminada" });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al eliminar cita" },
      { status: 500 }
    );
  }
});
