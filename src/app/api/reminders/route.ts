import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/jwt";

/**
 * GET /api/reminders
 * Returns upcoming appointments that are candidates for WhatsApp reminders.
 * Finds confirmed/pending appointments in the next 24-48 hours with client phone numbers.
 *
 * POST /api/reminders
 * Marks a reminder as sent for a specific appointment (stores in notes).
 */
export async function GET(request: Request) {
  const user = await getUserFromCookie(request);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // Find appointments in the next 24-48 hours that are PENDIENTE or CONFIRMADA
    // and have a client with a phone number, and haven't been reminded yet
    const appointments = await prisma.appointment.findMany({
      where: {
        date: { gte: in24h, lte: in48h },
        status: { in: ["PENDIENTE", "CONFIRMADA"] },
        client: { phone: { not: null } },
      },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        service: { select: { name: true, duration: true } },
        employee: { select: { name: true } },
      },
      orderBy: { date: "asc" },
    });

    // Filter out already-reminded appointments (check notes for "reminder_sent")
    const needsReminder = appointments.filter((apt) => {
      const notes = apt.notes || "";
      return !notes.includes("reminder_sent");
    });

    return NextResponse.json({
      appointments: needsReminder.map((apt) => ({
        id: apt.id,
        date: apt.date,
        status: apt.status,
        client: apt.client,
        service: apt.service,
        employee: apt.employee,
      })),
      count: needsReminder.length,
    });
  } catch (error) {
    console.error("Reminders API error:", error);
    return NextResponse.json({ error: "Error al obtener recordatorios" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromCookie(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { appointmentId } = await request.json();

    if (!appointmentId) {
      return NextResponse.json({ error: "appointmentId es requerido" }, { status: 400 });
    }

    const apt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!apt) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }

    const existingNotes = apt.notes || "";
    if (existingNotes.includes("reminder_sent")) {
      return NextResponse.json({ success: true, alreadyReminded: true });
    }

    const updatedNotes = `${existingNotes}\n[reminder_sent:${new Date().toISOString()}]`.trim();

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { notes: updatedNotes },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reminders mark error:", error);
    return NextResponse.json({ error: "Error al marcar recordatorio" }, { status: 500 });
  }
}
