import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { likePattern, removeAccentsSql } from "@/lib/search";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();

    if (!q || q.length < 1) {
      return NextResponse.json({ clients: [], services: [], employees: [] });
    }

    const pattern = likePattern(q);

    // Accent-insensitive search across Client, Service, Employee tables
    const nameSql = (col: string) => Prisma.raw(removeAccentsSql(col));
    const [clients, services, employees] = await Promise.all([
      prisma.$queryRaw<any[]>`
        SELECT * FROM "Client"
        WHERE ${nameSql("name")} LIKE ${Prisma.raw(pattern)}
           OR ${nameSql("phone")} LIKE ${Prisma.raw(pattern)}
           OR ${nameSql("email")} LIKE ${Prisma.raw(pattern)}
        ORDER BY name ASC
        LIMIT 5
      `,
      prisma.$queryRaw<any[]>`
        SELECT * FROM "Service"
        WHERE active = 1
          AND (${nameSql("name")} LIKE ${Prisma.raw(pattern)}
               OR ${nameSql("category")} LIKE ${Prisma.raw(pattern)})
        ORDER BY name ASC
        LIMIT 5
      `,
      prisma.$queryRaw<any[]>`
        SELECT * FROM "Employee"
        WHERE active = 1
          AND (${nameSql("name")} LIKE ${Prisma.raw(pattern)}
               OR ${nameSql("role")} LIKE ${Prisma.raw(pattern)})
        ORDER BY name ASC
        LIMIT 5
      `,
    ]);

    return NextResponse.json({ clients, services, employees });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Error en la búsqueda" },
      { status: 500 }
    );
  }
}
