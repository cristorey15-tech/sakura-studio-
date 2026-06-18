import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCsrf } from "@/lib/withCsrf";
import { createAuditLog } from "@/lib/auditLog";
import { getUserFromCookie } from "@/lib/jwt";
import { requireRole } from "@/lib/requireRole";
import { checkRateLimit } from "@/lib/rateLimit";

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
  // Rate limit: max 30 sales per minute per IP
  const rateLimit = checkRateLimit(req, { windowMs: 60000, max: 30 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
      { status: 429 }
    );
  }

  const auth = await requireRole(req, ["ADMIN"]);
  if (auth.error) return auth.error;
  try {
    const body = await req.json();
    const { clientId, employeeId, paymentMethod, exchangeRate, totalBs, items, paymentSplits } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Debes seleccionar al menos un servicio o producto" }, { status: 400 });
    }

    // Separate services and products
    const serviceIds = items.filter((item: any) => item.serviceId).map((item: any) => Number(item.serviceId));
    const productIds = items.filter((item: any) => item.productId).map((item: any) => Number(item.productId));

    const [services, products] = await Promise.all([
      serviceIds.length > 0 ? prisma.service.findMany({ where: { id: { in: serviceIds }, active: true } }) : [],
      productIds.length > 0 ? prisma.product.findMany({ where: { id: { in: productIds }, quantity: { gt: 0 } } }) : [],
    ]);

    // Validate all requested items exist
    const foundServiceIds = new Set(services.map(s => s.id));
    const foundProductIds = new Set(products.map(p => p.id));
    const missingServices = serviceIds.filter((id: number) => !foundServiceIds.has(id));
    const missingProducts = productIds.filter((id: number) => !foundProductIds.has(id));
    if (missingServices.length > 0 || missingProducts.length > 0) {
      return NextResponse.json({ error: "Servicios o productos no encontrados, inactivos o sin stock" }, { status: 404 });
    }

    // Check stock for products
    for (const item of items.filter((i: any) => i.productId)) {
      const product = products.find(p => p.id === Number(item.productId));
      if (product && product.quantity < (item.quantity || 1)) {
        return NextResponse.json({ error: `Stock insuficiente para "${product.name}" (disponible: ${product.quantity})` }, { status: 400 });
      }
    }

    // Determinar cliente
    let finalClientId = clientId ? Number(clientId) : null;
    if (!finalClientId) {
      const walkin = await getOrCreateWalkinClient();
      finalClientId = walkin.id;
    }

    // Build sale items with prices from services or products
    const saleItems = items.map((item: any) => {
      if (item.productId) {
        const product = products.find(p => p.id === Number(item.productId));
        return {
          quantity: item.quantity || 1,
          price: item.price ?? product?.price ?? 0,
          productId: product?.id,
        };
      }
      const service = services.find(s => s.id === Number(item.serviceId));
      return {
        quantity: 1,
        price: item.price ?? service?.price ?? 0,
        serviceId: service?.id,
      };
    });

    const total = saleItems.reduce((sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity, 0);

    const serviceDate = body.serviceDate
      ? (() => {
          const [y, m, d] = body.serviceDate.split("-").map(Number);
          return new Date(y, m - 1, d, 12, 0, 0);
        })()
      : new Date();

    // Create sale + deduct stock + create completed appointments atomically
    const sale = await prisma.$transaction(async (tx) => {
      const s = await tx.sale.create({
        data: {
          total,
          paymentMethod: paymentSplits && paymentSplits.length > 0 ? null : (paymentMethod || "EFECTIVO"),
          exchangeRate: exchangeRate || null,
          totalBs: totalBs || null,
          clientId: finalClientId,
          employeeId: employeeId ? Number(employeeId) : null,
          items: { create: saleItems },
          ...(paymentSplits && paymentSplits.length > 0 ? {
            paymentSplits: {
              create: paymentSplits.map((split: { paymentMethod: string; amount: number; amountBs?: number }) => ({
                paymentMethod: split.paymentMethod,
                amount: Number(split.amount),
                amountBs: split.amountBs ? Number(split.amountBs) : null,
              })),
            },
          } : {}),
        },
        include: {
          client: true,
          employee: true,
          items: { include: { service: true } },
          paymentSplits: true,
        },
      });

      // Create completed appointments for each service (to track service flow)
      if (body.appointmentId) {
        // Update existing appointment from agenda instead of creating duplicate
        await tx.appointment.update({
          where: { id: Number(body.appointmentId) },
          data: {
            status: "COMPLETADA",
            employeeId: employeeId ? Number(employeeId) : null,
          },
        });
      } else {
        for (const item of saleItems) {
          if (item.serviceId) {
            await tx.appointment.create({
              data: {
                date: serviceDate,
                status: "COMPLETADA",
                notes: "Venta rápida",
                clientId: finalClientId,
                employeeId: employeeId ? Number(employeeId) : null,
                serviceId: item.serviceId,
              },
            });
          }
        }
      }

      // Deduct stock atomically with conditional check
      for (const item of items.filter((i: any) => i.productId)) {
        const qty = item.quantity || 1;
        const pid = Number(item.productId);
        const updated = await tx.$executeRaw`
          UPDATE "Product" SET quantity = quantity - ${qty}
          WHERE id = ${pid} AND quantity >= ${qty}
        `;
        if (updated === 0) {
          const p = products.find((pp: any) => pp.id === pid);
          throw new Error(`Stock insuficiente para "${p?.name || "producto"}" (disponible: ${p?.quantity ?? 0})`);
        }
      }

      return s;
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
