import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeForSearch } from "@/lib/search";

const SELECT_FIELDS = {
  id: true,
  name: true,
  phone: true,
  freeServiceAvailable: true,
  visitCount: true,
  sales: {
    take: 1,
    orderBy: { date: "desc" } as const,
    select: { date: true },
  },
};

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
      // Fetch a broad set, then filter in JS for accent + case insensitivity
      const searchLower = normalizeForSearch(q);
      const allClients = await prisma.client.findMany({
        take: 500,
        orderBy: { name: "asc" },
        select: SELECT_FIELDS,
      });
      clients = allClients.filter((c) => {
        const name = normalizeForSearch(c.name || "");
        const phone = normalizeForSearch(c.phone || "");
        return name.includes(searchLower) || phone.includes(searchLower);
      }).slice(0, limit);
    } else {
      // No search — get clients with visit info for sorting
      clients = await prisma.client.findMany({
        take: limit,
        orderBy: { name: "asc" },
        select: SELECT_FIELDS,
      });
    }

    // Enrich with last visit info and sort by recency
    const enriched = clients.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      freeServiceAvailable: c.freeServiceAvailable,
      visitCount: c.visitCount,
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
