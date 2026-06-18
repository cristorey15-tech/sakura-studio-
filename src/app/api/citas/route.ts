import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCsrf } from "@/lib/withCsrf";
import { createAuditLog } from "@/lib/auditLog";
import { getUserFromCookie } from "@/lib/jwt";
import { requireRole } from "@/lib/requireRole";
import { required, isString, isNumber, validate, validationErrorResponse } from "@/lib/validate";

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
    const { valid, errors } = validate(
      required(data, ["date", "clientId", "serviceId"]),
      isNumber(data, "clientId", { min: 1 }),
      isNumber(data, "serviceId", { min: 1 }),
      isNumber(data, "employeeId", { min: 1, required: false }),
    );
    if (!valid) return validationErrorResponse(errors);
    const appointmentDate = new Date(data.date);
    const serviceId = Number(data.serviceId);
    const employeeId = data.employeeId ? Number(data.employeeId) : null;

    // Check for scheduling conflicts
    if (employeeId) {
      const service = await prisma.service.findUnique({ where: { id: serviceId }, select: { duration: true } });
      if (service) {
        const aptStart = new Date(appointmentDate);
        const aptEnd = new Date(aptStart.getTime() + service.duration * 60000);

        // Find overlapping appointments: existing apt overlaps with new one if:
        // existing.aptStart < newAptEnd AND existing.aptEnd > newAptStart
        // We compute each existing appointment's end time as appointment date + service duration
        const overlapping = await prisma.$queryRaw<{ id: number }[]>`
          SELECT a.id FROM "Appointment" a
          JOIN "Service" existingSvc ON a."serviceId" = existingSvc.id
          WHERE a."employeeId" = ${employeeId}
            AND a."status" != 'CANCELADA'
            AND a."id" != 0
            AND datetime(a."date") < ${aptEnd.toISOString()}
            AND datetime(a."date", '+' || existingSvc.duration || ' minutes') > ${aptStart.toISOString()}
        `;

        if (overlapping.length > 0) {
          const conflictingApt = await prisma.appointment.findUnique({
            where: { id: overlapping[0].id },
            include: { client: true, service: true },
          });
          return NextResponse.json(
            { error: `Conflicto de horario: la empleada ya tiene una cita con ${conflictingApt?.client?.name || "un cliente"} (${conflictingApt?.service?.name || "servicio"}) en ese horario.` },
            { status: 409 }
          );
        }
      }
    }

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
