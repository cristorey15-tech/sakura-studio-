import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCsrf } from "@/lib/withCsrf";
import { createAuditLog } from "@/lib/auditLog";
import { getUserFromCookie } from "@/lib/jwt";
import { requireRole } from "@/lib/requireRole";

const WALKIN_NAME = "Cliente de Paso";

async function getOrCreateWalkinClient() {
  let client = await prisma.client.findFirst({
    where: { name: WALKIN_NAME },
  });
  if (!client) {
    client = await prisma.client.create({
      data: { name: WALKIN_NAME, notes: "Cliente ocasional — creado automáticamente" },
    });
  }
  return client;
}

export const POST = withCsrf(async (req: NextRequest) => {
  const auth = await requireRole(req, ["ADMIN"]);
  if (auth.error) return auth.error;
  try {
    const body = await req.json();
    const { clientId, employeeId, paymentMethod, exchangeRate, totalBs, items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Debes seleccionar al menos un servicio" }, { status: 400 });
    }

    // Obtener los IDs de servicios
    const serviceIds = items.map((item: { serviceId: number }) => Number(item.serviceId));

    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, active: true },
    });

    if (services.length === 0) {
      return NextResponse.json({ error: "Servicios no encontrados o inactivos" }, { status: 404 });
    }

    // Determinar cliente
    let finalClientId = clientId ? Number(clientId) : null;
    if (!finalClientId) {
      const walkin = await getOrCreateWalkinClient();
      finalClientId = walkin.id;
    }

    // Construir items con precios personalizados (usar el enviado, o el default del servicio)
    const saleItems = items.map((item: { serviceId: number; price?: number }) => {
      const service = services.find((s) => s.id === Number(item.serviceId));
      return {
        quantity: 1,
        price: item.price ?? service?.price ?? 0,
        serviceId: service?.id,
      };
    });

    const total = saleItems.reduce((sum: number, item: { price: number }) => sum + item.price, 0);

    // Crear la venta con items
    const sale = await prisma.sale.create({
      data: {
        total,
        paymentMethod: paymentMethod || "EFECTIVO",
        exchangeRate: exchangeRate || null,
        totalBs: totalBs || null,
        clientId: finalClientId,
        employeeId: employeeId ? Number(employeeId) : null,
        items: { create: saleItems },
      },
      include: {
        client: true,
        employee: true,
        items: { include: { service: true } },
      },
    });

    // Audit log
    const user = await getUserFromCookie(req);
    await createAuditLog({
      action: "CREATE",
      entity: "Sale",
      entityId: sale.id,
      description: `Venta rápida: ${saleItems.map((item: { price: number }) => `$${item.price.toFixed(2)}`).join(" + ")} — ${sale.client?.name || "Cliente de Paso"}`,
      userId: user?.id?.toString(),
      userName: user?.name ?? undefined,
    });

    return NextResponse.json(sale, { status: 201 });
  } catch (error) {
    console.error("Quick sale error:", error);
    return NextResponse.json({ error: "Error al procesar la venta rápida" }, { status: 500 });
  }
});
