import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCsrf } from "@/lib/withCsrf";
import { getUserFromCookie } from "@/lib/jwt";
import { createAuditLog } from "@/lib/auditLog";
import { requireWriteAdmin } from "@/lib/requireRole";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
    const skip = (page - 1) * limit;

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        skip,
        take: limit,
        orderBy: { name: "asc" },
        include: {
          _count: { select: { appointments: true, sales: true } },
        },
      }),
      prisma.client.count(),
    ]);

    return NextResponse.json({
      data: clients,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al obtener clientes" },
      { status: 500 }
    );
  }
}

export const POST = withCsrf(async (request: Request) => {
  const auth = await requireWriteAdmin(request);
  if (auth.error) return auth.error;
  try {
    const data = await request.json();
    const client = await prisma.client.create({ data });
    const user = await getUserFromCookie(request);
    await createAuditLog({
      action: "CREATE",
      entity: "Client",
      entityId: client.id,
      description: `Cliente creado: ${client.name}`,
      userId: user?.id,
      userName: user?.name,
    });
    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al crear cliente" },
      { status: 500 }
    );
  }
});
