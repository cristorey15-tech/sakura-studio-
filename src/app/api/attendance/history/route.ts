import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/jwt";

export async function GET(request: Request) {
  try {
    const user = await getUserFromCookie(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const employeeId = searchParams.get("employeeId");

    // Build where clause
    const where: any = {};

    if (startDate) {
      where.date = {
        gte: new Date(startDate + "T00:00:00"),
      };
      if (endDate) {
        where.date.lte = new Date(endDate + "T23:59:59");
      }
    }

    if (employeeId) {
      where.employeeId = parseInt(employeeId);
    }

    const attendances = await prisma.attendance.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { date: "desc" },
    });

    // Get studio settings for location name
    const settings = await prisma.studioSettings.findFirst();

    // Format response
    const records = attendances.map((a) => ({
      id: a.id,
      date: a.date.toISOString(),
      employeeId: a.employeeId,
      employeeName: a.employee.name,
      latitude: a.latitude,
      longitude: a.longitude,
      accuracy: a.accuracy,
    }));

    // Get daily stats
    const totalRecords = attendances.length;
    const uniqueEmployees = new Set(attendances.map((a) => a.employeeId)).size;

    // Group by date for daily counts
    const dailyCounts = new Map<string, number>();
    attendances.forEach((a) => {
      const dayKey = a.date.toISOString().split("T")[0];
      dailyCounts.set(dayKey, (dailyCounts.get(dayKey) || 0) + 1);
    });

    return NextResponse.json({
      records,
      stats: {
        totalRecords,
        uniqueEmployees,
        totalDays: dailyCounts.size,
      },
      workLocation: settings
        ? {
            name: settings.workLocationName || "Plaza Las Américas II, El Cafetal",
            latitude: settings.workLatitude,
            longitude: settings.workLongitude,
            radius: settings.workRadius || 200,
          }
        : null,
    });
  } catch (error) {
    console.error("Attendance history error:", error);
    return NextResponse.json(
      { error: "Error al obtener historial de asistencia" },
      { status: 500 }
    );
  }
}
