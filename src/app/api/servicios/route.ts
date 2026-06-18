import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCsrf } from "@/lib/withCsrf";
import { getUserFromCookie } from "@/lib/jwt";
import { createAuditLog } from "@/lib/auditLog";
import { requireWriteAdmin } from "@/lib/requireRole";
import { required, isString, isNumber, validate, validationErrorResponse } from "@/lib/validate";


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    const [services, total] = await Promise.all([
      prisma.service.findMany({
        skip,
        take: limit,
        include: {
          _count: {
            select: { saleItems: true },
          },
        },
        orderBy: [
          { saleItems: { _count: "desc" } },
          { category: "asc" },
        ],
      }),
      prisma.service.count(),
    ]);

    return NextResponse.json(services, {
      headers: {
        "X-Total-Count": String(total),
        "X-Page": String(page),
        "X-Total-Pages": String(Math.ceil(total / limit)),
      },
    });
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
    const { valid, errors } = validate(
      required(data, ["name", "price", "category"]),
      isString(data, "name", { maxLength: 200 }),
      isNumber(data, "price", { min: 0 }),
      isNumber(data, "duration", { min: 0, required: false }),
      isNumber(data, "commissionPercent", { min: 0, max: 100, required: false }),
    );
    if (!valid) return validationErrorResponse(errors);
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
