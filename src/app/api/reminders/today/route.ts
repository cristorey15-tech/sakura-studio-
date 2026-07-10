import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/requireRole";

interface TomorrowAppointment {
  id: number;
  time: string;
  clientName: string;
  clientPhone: string | null;
  serviceName: string;
  employeeName: string | null;
}

interface WATemplate {
  id: number;
  label: string;
  message: string;
}

const DEFAULT_TEMPLATES = [
  { id: 0, label: "Recordatorio", message: "Hola {nombre}, recordatorio de tu cita para MAÑANA {hora} en Sakura Studio. ¡Te esperamos! 🌟" },
  { id: 0, label: "Promoción", message: "Hola {nombre}, en Sakura Studio tenemos promociones especiales esta semana. ¿Te gustaría agendar una cita? 🎉" },
  { id: 0, label: "Saludo", message: "Hola {nombre}, ¿cómo estás? Queríamos saber si todo ha estado bien. ¡Un saludo! 👋" },
];

function getTomorrowRange() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);
  
  return { start: tomorrow, end: dayAfter };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["ADMIN"]);
    if (auth.error) return auth.error;

    const { start, end } = getTomorrowRange();

    // Fetch tomorrow's appointments with client and service info
    const appointments = await prisma.appointment.findMany({
      where: {
        date: { gte: start, lt: end },
        status: { in: ["PENDIENTE", "CONFIRMADA"] },
      },
      include: {
        client: { select: { name: true, phone: true } },
        service: { select: { name: true } },
        employee: { select: { name: true } },
      },
      orderBy: { date: "asc" },
    });

    // Fetch WA templates from DB, fall back to defaults
    let templates: WATemplate[] = [];
    try {
      templates = await prisma.wATemplate.findMany({ orderBy: { id: "asc" } });
    } catch {
      // DB templates not available, use defaults
    }

    if (templates.length === 0) {
      templates = DEFAULT_TEMPLATES.map((t, i) => ({ ...t, id: i + 1 }));
    }

    const tomorrowAppointments: TomorrowAppointment[] = appointments.map((apt) => ({
      id: apt.id,
      time: apt.date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
      clientName: apt.client.name,
      clientPhone: apt.client.phone,
      serviceName: apt.service.name,
      employeeName: apt.employee?.name || null,
    }));

    return NextResponse.json({
      appointments: tomorrowAppointments,
      templates,
      dateLabel: start.toLocaleDateString("es-MX", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    });
  } catch (error) {
    console.error("Reminders error:", error);
    return NextResponse.json(
      { error: "Error al obtener recordatorios" },
      { status: 500 }
    );
  }
}
