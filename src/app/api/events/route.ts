import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/jwt";

export async function GET(request: NextRequest) {
  // Require authentication
  const user = await getUserFromCookie(request);
  if (!user) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const channel = searchParams.get("channel") || "general";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial heartbeat
      controller.enqueue(encoder.encode(`data: {"type":"heartbeat","timestamp":"${new Date().toISOString()}"}\n\n`));

      // Send current data snapshot
      const sendSnapshot = async () => {
        try {
          const [todaySales, lowStock, todayAppts] = await Promise.all([
            prisma.sale.aggregate({
              _sum: { total: true },
              _count: true,
              where: {
                date: {
                  gte: new Date(new Date().setHours(0, 0, 0, 0)),
                },
              },
            }),
            prisma.product.findMany({
              select: { id: true, name: true, quantity: true, minStock: true },
            }).then((products) => products.filter((p) => p.quantity <= p.minStock)),
            prisma.appointment.count({
              where: {
                date: {
                  gte: new Date(new Date().setHours(0, 0, 0, 0)),
                  lt: new Date(new Date().setHours(23, 59, 59, 999)),
                },
                status: { not: "CANCELADA" },
              },
            }),
          ]);

          const data = {
            type: "snapshot",
            timestamp: new Date().toISOString(),
            todaySalesTotal: todaySales._sum.total || 0,
            todaySalesCount: todaySales._count || 0,
            lowStockCount: lowStock.length,
            lowStockProducts: lowStock.map((p) => ({ id: p.id, name: p.name, quantity: p.quantity })),
            todayAppointments: todayAppts,
          };

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          controller.enqueue(encoder.encode(`data: {"type":"error","message":"Failed to fetch data"}\n\n`));
        }
      };

      // Send initial snapshot
      sendSnapshot();

      // Send updates every 30 seconds
      const interval = setInterval(sendSnapshot, 30000);

      // Heartbeat every 15 seconds to keep connection alive
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`data: {"type":"heartbeat","timestamp":"${new Date().toISOString()}"}\n\n`));
      }, 15000);

      // Cleanup on close
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        clearInterval(heartbeat);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
