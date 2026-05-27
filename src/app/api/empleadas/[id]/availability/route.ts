import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCsrf } from "@/lib/withCsrf";
import { requireRole } from "@/lib/requireRole";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(request, ["ADMIN"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const availabilities = await prisma.employeeAvailability.findMany({
      where: { employeeId: Number(id) },
      orderBy: { dayOfWeek: "asc" },
    });
    return NextResponse.json(availabilities);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al obtener disponibilidad" },
      { status: 500 }
    );
  }
}

export const PUT = withCsrf(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const auth = await requireRole(request, ["ADMIN"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const body: Array<{ dayOfWeek: number; startTime: string; endTime: string }> = await request.json();

    // Delete all existing availability for this employee
    await prisma.employeeAvailability.deleteMany({
      where: { employeeId: Number(id) },
    });

    // Create new availability entries
    if (body.length > 0) {
      await prisma.employeeAvailability.createMany({
        data: body.map((item) => ({
          employeeId: Number(id),
          dayOfWeek: item.dayOfWeek,
          startTime: item.startTime,
          endTime: item.endTime,
        })),
      });
    }

    const updated = await prisma.employeeAvailability.findMany({
      where: { employeeId: Number(id) },
      orderBy: { dayOfWeek: "asc" },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al actualizar disponibilidad" },
      { status: 500 }
    );
  }
});
