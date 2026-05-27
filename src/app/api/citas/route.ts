import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCsrf } from "@/lib/withCsrf";
import { createAuditLog } from "@/lib/auditLog";
import { getUserFromCookie } from "@/lib/jwt";
import { requireRole } from "@/lib/requireRole";

export async function GET() {
  try {
    const appointments = await prisma.appointment.findMany({
      include: {
        client: true,
        service: true,
        employee: true,
      },
      orderBy: { date: "asc" },
    });
    return NextResponse.json(appointments);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al obtener citas" },
      { status: 500 }
    );
  }
}

export const POST = withCsrf(async (request: Request) => {
  const auth = await requireRole(request, ["ADMIN", "EMPLEADA", "ESTETICISTA"]);
  if (auth.error) return auth.error;
  try {
    const data = await request.json();
    const appointment = await prisma.appointment.create({
      data: {
        date: new Date(data.date),
        status: data.status || "PENDIENTE",
        notes: data.notes,
        clientId: Number(data.clientId),
        serviceId: Number(data.serviceId),
        ...(data.employeeId && { employeeId: Number(data.employeeId) }),
      },
      include: {
        client: true,
        service: true,
        employee: true,
      },
    });
    const user = await getUserFromCookie(request);
    createAuditLog({
      action: "CREATE",
      entity: "Appointment",
      entityId: appointment.id,
      description: `Cita creada para ${appointment.client?.name || "cliente"} - ${appointment.service?.name || "servicio"}`,
      userId: user?.id,
      userName: user?.name,
    });
    return NextResponse.json(appointment, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al crear cita" },
      { status: 500 }
    );
  }
});
