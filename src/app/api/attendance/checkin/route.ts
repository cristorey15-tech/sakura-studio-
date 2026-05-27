import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/jwt";

// Haversine formula to calculate distance between two GPS coordinates in meters
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromCookie(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Get employee info
    const employee = await prisma.employee.findUnique({
      where: { id: user.id },
    });
    if (!employee || !employee.active) {
      return NextResponse.json(
        { error: "Empleada no encontrada o inactiva" },
        { status: 400 }
      );
    }

    // Get body: { latitude, longitude, accuracy }
    const body = await request.json();
    const { latitude, longitude, accuracy } = body;

    if (latitude == null || longitude == null) {
      return NextResponse.json(
        { error: "No se pudo obtener la ubicación GPS" },
        { status: 400 }
      );
    }

    // ── Validate time: check if today's schedule allows check-in ──
    const today = new Date();
    const dayOfWeek = today.getDay();
    const schedule = await prisma.employeeAvailability.findFirst({
      where: {
        employeeId: user.id,
        dayOfWeek,
      },
    });

    if (!schedule) {
      return NextResponse.json(
        { error: "No tienes horario asignado para hoy. No puedes registrar asistencia." },
        { status: 400 }
      );
    }

    const currentMinutes = today.getHours() * 60 + today.getMinutes();
    const [startH, startM] = schedule.startTime.split(":").map(Number);
    const [endH, endM] = schedule.endTime.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    // Allow check-in 30 minutes before and up to end of shift
    const graceMinutes = 30;
    if (currentMinutes < startMinutes - graceMinutes || currentMinutes > endMinutes) {
      return NextResponse.json(
        {
          error: `Fuera de horario laboral. Tu horario hoy es ${schedule.startTime} - ${schedule.endTime}.`,
        },
        { status: 400 }
      );
    }

    // ── Validate location: check distance from configured work location ──
    const settings = await prisma.studioSettings.findFirst();
    if (settings?.workLatitude != null && settings?.workLongitude != null) {
      const radius = settings.workRadius || 200;
      const distance = haversineDistance(
        latitude,
        longitude,
        settings.workLatitude,
        settings.workLongitude
      );

      if (distance > radius) {
        return NextResponse.json(
          {
            error: `Estás demasiado lejos del estudio. Debes estar a menos de ${radius}m de ${settings.workLocationName || "la ubicación del estudio"} para registrar asistencia. Distancia actual: ${Math.round(distance)}m.`,
          },
          { status: 400 }
        );
      }
    }

    // ── Check if already checked in today ──
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 86400000);

    const existing = await prisma.attendance.findFirst({
      where: {
        employeeId: user.id,
        date: { gte: startOfDay, lt: endOfDay },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Ya registraste asistencia hoy", alreadyCheckedIn: true },
        { status: 400 }
      );
    }

    // ── Register attendance ──
    const attendance = await prisma.attendance.create({
      data: {
        employeeId: user.id,
        latitude: Math.round(latitude * 1000000) / 1000000,
        longitude: Math.round(longitude * 1000000) / 1000000,
        accuracy: accuracy != null ? Math.round(accuracy * 100) / 100 : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Asistencia registrada exitosamente",
      attendance: {
        id: attendance.id,
        date: attendance.date,
      },
    });
  } catch (error) {
    console.error("Attendance checkin error:", error);
    return NextResponse.json(
      { error: "Error al registrar asistencia" },
      { status: 500 }
    );
  }
}
