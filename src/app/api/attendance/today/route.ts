import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/jwt";

export async function GET(request: Request) {
  try {
    const user = await getUserFromCookie(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 86400000);

    const attendance = await prisma.attendance.findFirst({
      where: {
        employeeId: user.id,
        date: { gte: startOfDay, lt: endOfDay },
      },
      orderBy: { date: "desc" },
    });

    // Get today's schedule for the employee
    const dayOfWeek = today.getDay();
    const schedule = await prisma.employeeAvailability.findFirst({
      where: {
        employeeId: user.id,
        dayOfWeek,
      },
    });

    // Get studio settings for location
    const settings = await prisma.studioSettings.findFirst();

    return NextResponse.json({
      checkedIn: !!attendance,
      attendance: attendance
        ? {
            id: attendance.id,
            date: attendance.date,
            latitude: attendance.latitude,
            longitude: attendance.longitude,
            accuracy: attendance.accuracy,
          }
        : null,
      schedule: schedule
        ? {
            startTime: schedule.startTime,
            endTime: schedule.endTime,
          }
        : null,
      workLocation: settings
        ? {
            latitude: settings.workLatitude,
            longitude: settings.workLongitude,
            name: settings.workLocationName || "Plaza Las Américas II, El Cafetal",
            radius: settings.workRadius || 200,
          }
        : null,
    });
  } catch (error) {
    console.error("Attendance today error:", error);
    return NextResponse.json(
      { error: "Error al verificar asistencia" },
      { status: 500 }
    );
  }
}
