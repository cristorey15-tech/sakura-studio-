import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCsrf } from "@/lib/withCsrf";
import { createAuditLog } from "@/lib/auditLog";
import { getUserFromCookie } from "@/lib/jwt";
import { requireRole } from "@/lib/requireRole";

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

    // Build where clause
    const where: any = {};
    if (currency === "USD") where.totalBs = null;
    else if (currency === "BS") where.totalBs = { not: null };

    if (q) {
      where.OR = [
        { client: { name: { contains: q } } },
        { items: { some: { service: { name: { contains: q } } } } },
      ];
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        skip,
        take: limit,
        where,
        include: {
          client: true,
          employee: { select: { id: true, name: true } },
          items: {
            include: { service: true, product: true },
          },
        },
        orderBy: { date: "desc" },
      }),
      prisma.sale.count({ where }),
    ]);

    // Stats (computed from all sales, ignoring filters)
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    const todaySales = await prisma.sale.findMany({
      where: { date: { gte: todayStart, lt: todayEnd } },
      select: { total: true, totalBs: true },
    });

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthlySales = await prisma.sale.findMany({
      where: { date: { gte: monthStart } },
      select: { total: true, totalBs: true },
    });

    const stats = {
      todaySalesCount: todaySales.length,
      todayTotalUSD: todaySales.reduce((s, r) => s + r.total, 0),
      todayTotalBs: todaySales.reduce((s, r) => s + (r.totalBs || 0), 0),
      monthlyTotalUSD: monthlySales.reduce((s, r) => s + r.total, 0),
      monthlyTotalBs: monthlySales.reduce((s, r) => s + (r.totalBs || 0), 0),
    };

    return NextResponse.json({
      data: sales,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats,
    });
  } catch (error) {
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
          items: {
            include: { service: true, product: true },
          },
        },
      });

      // Crear citas COMPLETADAS automáticas para cada servicio vendido
      if (clientId) {
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
