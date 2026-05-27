import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();

    if (!q || q.length < 1) {
      return NextResponse.json({ clients: [], services: [], employees: [] });
    }

    const [clients, services, employees] = await Promise.all([
      prisma.client.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            { phone: { contains: q } },
            { email: { contains: q } },
          ],
        },
        take: 5,
        orderBy: { name: "asc" },
      }),
      prisma.service.findMany({
        where: {
          active: true,
          OR: [
            { name: { contains: q } },
            { category: { contains: q } },
          ],
        },
        take: 5,
        orderBy: { name: "asc" },
      }),
      prisma.employee.findMany({
        where: {
          active: true,
          OR: [
            { name: { contains: q } },
            { role: { contains: q } },
          ],
        },
        take: 5,
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({ clients, services, employees });
  } catch (error) {
    return NextResponse.json(
      { error: "Error en la búsqueda" },
      { status: 500 }
    );
  }
}
