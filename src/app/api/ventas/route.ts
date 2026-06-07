import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { withCsrf } from "@/lib/withCsrf";
import { createAuditLog } from "@/lib/auditLog";
import { getUserFromCookie } from "@/lib/jwt";
import { requireRole } from "@/lib/requireRole";
import { likePattern, removeAccentsSql } from "@/lib/search";

export async function GET(request: Request) {
  const auth = await requireRole(request, ["ADMIN"]);
  if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "15", 10)));
    const skip = (page - 1) * limit;
    const q = searchParams.get("q") || "";
    const currency = searchParams.get("currency") || "ALL";

    if (q) {
      // Accent-insensitive search: find matching client IDs and service IDs first
      const pattern = likePattern(q);

      const nameSql = (col: string) => Prisma.raw(removeAccentsSql(col));
      const [matchingClients, matchingServices] = await Promise.all([
        prisma.$queryRaw<{ id: number }[]>`
          SELECT id FROM "Client"
          WHERE ${nameSql("name")} LIKE ${Prisma.raw(pattern)}
             OR ${nameSql("phone")} LIKE ${Prisma.raw(pattern)}
        `,
        prisma.$queryRaw<{ id: number }[]>`
          SELECT id FROM "Service"
          WHERE ${nameSql("name")} LIKE ${Prisma.raw(pattern)}
        `,
      ]);

      const clientIds = matchingClients.map((c) => c.id);
      const serviceIds = matchingServices.map((s) => s.id);

      // Build where with accent-insensitive IDs + currency filter
      const where: any = {};
      if (currency === "USD") where.totalBs = null;
      else if (currency === "BS") where.totalBs = { not: null };

      if (clientIds.length > 0 || serviceIds.length > 0) {
        where.OR = [];
        if (clientIds.length > 0) {
          where.OR.push({ clientId: { in: clientIds } });
        }
        if (serviceIds.length > 0) {
          where.OR.push({ items: { some: { serviceId: { in: serviceIds } } } });
        }
      } else {
        // No matches found — return empty
        return NextResponse.json({
          data: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
          stats: { todaySalesCount: 0, todayTotalUSD: 0, todayTotalBs: 0, monthlyTotalUSD: 0, monthlyTotalBs: 0 },
        });
      }

      const [sales, total] = await Promise.all([
        prisma.sale.findMany({
          skip,
          take: limit,
          where,
          include: {
            client: true,
            employee: { select: { id: true, name: true } },
            items: { include: { service: true, product: true } },
          },
          orderBy: { date: "desc" },
        }),
        prisma.sale.count({ where }),
      ]);

      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(todayStart.getTime() + 86400000);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      const [todaySales, monthlySales] = await Promise.all([
        prisma.sale.findMany({ where: { date: { gte: todayStart, lt: todayEnd } }, select: { total: true, totalBs: true } }),
        prisma.sale.findMany({ where: { date: { gte: monthStart } }, select: { total: true, totalBs: true } }),
      ]);

      const stats = {
        todaySalesCount: todaySales.length,
        todayTotalUSD: todaySales.reduce((s, r) => s + r.total, 0),
        todayTotalBs: todaySales.reduce((s, r) => s + (r.totalBs || 0), 0),
        monthlyTotalUSD: monthlySales.reduce((s, r) => s + r.total, 0),
        monthlyTotalBs: monthlySales.reduce((s, r) => s + (r.totalBs || 0), 0),
      };

      return NextResponse.json({ data: sales, total, page, limit, totalPages: Math.ceil(total / limit), stats });
    }

    // No search term — regular query
    const where: any = {};
    if (currency === "USD") where.totalBs = null;
    else if (currency === "BS") where.totalBs = { not: null };

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        skip,
        take: limit,
        where,
        include: {
          client: true,
          employee: { select: { id: true, name: true } },
          items: { include: { service: true, product: true } },
        },
        orderBy: { date: "desc" },
      }),
      prisma.sale.count({ where }),
    ]);

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [todaySales, monthlySales] = await Promise.all([
      prisma.sale.findMany({ where: { date: { gte: todayStart, lt: todayEnd } }, select: { total: true, totalBs: true } }),
      prisma.sale.findMany({ where: { date: { gte: monthStart } }, select: { total: true, totalBs: true } }),
    ]);

    const stats = {
      todaySalesCount: todaySales.length,
      todayTotalUSD: todaySales.reduce((s, r) => s + r.total, 0),
      todayTotalBs: todaySales.reduce((s, r) => s + (r.totalBs || 0), 0),
      monthlyTotalUSD: monthlySales.reduce((s, r) => s + r.total, 0),
      monthlyTotalBs: monthlySales.reduce((s, r) => s + (r.totalBs || 0), 0),
    };

    return NextResponse.json({ data: sales, total, page, limit, totalPages: Math.ceil(total / limit), stats });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al obtener ventas" },
      { status: 500 }
    );
  }
}

export const POST = withCsrf(async (request: Request) => {
  const auth = await requireRole(request, ["ADMIN"]);
  if (auth.error) return auth.error;
  try {
    const data = await request.json();
    const clientId = data.clientId ? Number(data.clientId) : null;
    const user = await getUserFromCookie(request);

    const sale = await prisma.$transaction(async (tx) => {
      const s = await tx.sale.create({
        data: {
          total: data.total,
          totalBs: data.totalBs || null,
          exchangeRate: data.exchangeRate || null,
          paymentMethod: data.paymentMethod,
          notes: data.notes,
          clientId: clientId,
          employeeId: data.employeeId ? Number(data.employeeId) : null,
          items: {
            create: data.items.map((item: { quantity: number; price: number; serviceId?: number; productId?: number }) => ({
              quantity: item.quantity,
              price: item.price,
              serviceId: item.serviceId ? Number(item.serviceId) : null,
              productId: item.productId ? Number(item.productId) : null,
            })),
          },
        },
        include: {
          client: true,
          items: { include: { service: true, product: true } },
        },
      });

      if (data.appointmentId) {
        // Update existing appointment from agenda instead of creating duplicate
        await tx.appointment.update({
          where: { id: Number(data.appointmentId) },
          data: {
            status: "COMPLETADA",
            employeeId: data.employeeId ? Number(data.employeeId) : null,
          },
        });
      } else if (clientId) {
        const serviceDate = data.serviceDate
          ? (() => {
              const [y, m, d] = data.serviceDate.split("-").map(Number);
              return new Date(y, m - 1, d, 12, 0, 0);
            })()
          : new Date();
        for (const item of data.items) {
          if (item.serviceId) {
            await tx.appointment.create({
              data: {
                date: serviceDate,
                status: "COMPLETADA",
                notes: data.notes || "Venta directa",
                clientId,
                employeeId: data.employeeId ? Number(data.employeeId) : null,
                serviceId: Number(item.serviceId),
              },
            });
          }
        }
      }

      return s;
    });

    createAuditLog({
      action: "CREATE",
      entity: "Sale",
      entityId: sale.id,
      description: `Venta #${sale.id} creada - $${sale.total.toFixed(2)}`,
      userId: user?.id,
      userName: user?.name,
    });

    return NextResponse.json(sale, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al crear venta" },
      { status: 500 }
    );
  }
});
