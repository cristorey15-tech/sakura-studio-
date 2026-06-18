import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCsrf } from "@/lib/withCsrf";
import { getUserFromCookie } from "@/lib/jwt";
import { createAuditLog } from "@/lib/auditLog";
import { requireWriteAdmin } from "@/lib/requireRole";
import { Prisma } from "@prisma/client";
import { normalizeForSearch, removeAccentsSql } from "@/lib/search";
import { required, isString, isEmail, validate, validationErrorResponse } from "@/lib/validate";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
    const skip = (page - 1) * limit;
    const q = searchParams.get("q")?.trim() || "";

    if (q) {
      // Accent-insensitive + case-insensitive search using raw SQL
      const pattern = `%${normalizeForSearch(q)}%`;
      const nameSql = (col: string) => Prisma.raw(removeAccentsSql(col));
      const [clients, countResult] = await Promise.all([
        prisma.$queryRaw<any[]>`
          SELECT * FROM "Client"
          WHERE ${nameSql("name")} LIKE ${pattern}
             OR ${nameSql("phone")} LIKE ${pattern}
             OR ${nameSql("email")} LIKE ${pattern}
          ORDER BY name ASC
          LIMIT ${limit} OFFSET ${skip}
        `,
        prisma.$queryRaw<[{ count: number }]>`
          SELECT COUNT(*) as count FROM "Client"
          WHERE ${nameSql("name")} LIKE ${pattern}
             OR ${nameSql("phone")} LIKE ${pattern}
             OR ${nameSql("email")} LIKE ${pattern}
        `,
      ]);

      return NextResponse.json({
        data: clients,
        total: Number(countResult[0]?.count ?? 0),
        page,
        limit,
        totalPages: Math.ceil(Number(countResult[0]?.count ?? 0) / limit),
      });
    }

    // No search term — return all clients
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
    const { valid, errors } = validate(
      required(data, ["name"]),
      isString(data, "name", { maxLength: 200 }),
      isString(data, "phone", { required: false, maxLength: 30 }),
      isEmail(data, "email"),
    );
    if (!valid) return validationErrorResponse(errors);
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
