import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCsrf } from "@/lib/withCsrf";
import { getUserFromCookie } from "@/lib/jwt";
import { createAuditLog } from "@/lib/auditLog";
import { requireWriteAdmin } from "@/lib/requireRole";

export async function GET() {
  try {
    const services = await prisma.service.findMany({
      orderBy: { category: "asc" },
    });
    return NextResponse.json(services);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al obtener servicios" },
      { status: 500 }
    );
  }
}

export const POST = withCsrf(async (request: Request) => {
  const auth = await requireWriteAdmin(request);
  if (auth.error) return auth.error;
  try {
    const data = await request.json();
    const service = await prisma.service.create({ data });
    const user = await getUserFromCookie(request);
    await createAuditLog({
      action: "CREATE",
      entity: "Service",
      entityId: service.id,
      description: `Servicio creado: ${service.name} ($${service.price})`,
      userId: user?.id,
      userName: user?.name,
    });
    return NextResponse.json(service, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al crear servicio" },
      { status: 500 }
    );
  }
});
