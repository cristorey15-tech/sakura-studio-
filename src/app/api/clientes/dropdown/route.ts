import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { likePattern, removeAccentsSql } from "@/lib/search";

/**
 * Lightweight endpoint for client dropdowns.
 * Returns only the fields needed for select/autocomplete components.
 * Supports search via `q` parameter with accent-insensitive matching.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "100", 10)));

    let clients: any[];

    if (q && q.length >= 1) {
      // Accent-insensitive + case-insensitive search using raw SQL
      const pattern = likePattern(q);
      const nameCol = removeAccentsSql("name");
      const phoneCol = removeAccentsSql("phone");
      const whereClause = `(${nameCol} LIKE ${pattern} OR ${phoneCol} LIKE ${pattern})`;

      const nameSql = (col: string) => Prisma.raw(removeAccentsSql(col));
      const rawPattern = Prisma.raw(pattern);
      const sql = Prisma.raw(whereClause);
      // Get matching client IDs first, then fetch with full relations
      const matchingRows = await prisma.$queryRaw<{ id: number }[]>`
        SELECT id FROM "Client"
        WHERE ${sql}
        ORDER BY name ASC
        LIMIT ${limit}
      `;
      const ids = matchingRows.map((r) => r.id);

      if (ids.length === 0) {
        return NextResponse.json([]);
      }

      // Fetch matching clients with visit info
      clients = await prisma.client.findMany({
        where: { id: { in: ids } },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          phone: true,
          freeServiceAvailable: true,
          visitCount: true,
          _count: { select: { sales: true, appointments: true } },
          sales: {
            take: 1,
            orderBy: { date: "desc" },
            select: { date: true },
          },
        },
      });
    } else {
      // No search — get clients with visit info for sorting
      clients = await prisma.client.findMany({
        take: limit,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          phone: true,
          freeServiceAvailable: true,
          visitCount: true,
          _count: { select: { sales: true, appointments: true } },
          sales: {
            take: 1,
            orderBy: { date: "desc" },
            select: { date: true },
          },
        },
      });
    }

    // Enrich with last visit info and sort by recency
    const enriched = clients.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      freeServiceAvailable: c.freeServiceAvailable,
      visitCount: c.visitCount,
      saleCount: c._count?.sales ?? 0,
      appointmentCount: c._count?.appointments ?? 0,
      lastVisit: c.sales?.[0]?.date ?? null,
    }));

    // Sort: clients with recent visits first, then alphabetical
    enriched.sort((a, b) => {
      if (a.lastVisit && b.lastVisit) {
        return new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime();
      }
      if (a.lastVisit) return -1;
      if (b.lastVisit) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json(enriched);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al obtener clientes" },
      { status: 500 }
    );
  }
}
