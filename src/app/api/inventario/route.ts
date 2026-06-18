import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { withCsrf } from "@/lib/withCsrf";
import { createAuditLog } from "@/lib/auditLog";
import { getUserFromCookie } from "@/lib/jwt";
import { requireRole } from "@/lib/requireRole";
import { likePattern, removeAccentsSql } from "@/lib/search";
import { required, isString, isNumber, validate, validationErrorResponse } from "@/lib/validate";

export async function GET(request: Request) {
  const auth = await requireRole(request, ["ADMIN"]);
  if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
    const skip = (page - 1) * limit;
    const q = searchParams.get("q") || "";
    const category = searchParams.get("category") || "TODAS";
    const stockFilter = searchParams.get("stock") || "TODOS";

    const isStockFilterActive = stockFilter !== "TODOS";

    let products;
    let total: number;

    if (q) {
      // Accent-insensitive search: find matching product IDs first
      const pattern = likePattern(q);
      const nameSql = (col: string) => Prisma.raw(removeAccentsSql(col));
      const matchingRows = await prisma.$queryRaw<{ id: number }[]>`
        SELECT id FROM "Product"
        WHERE ${nameSql("name")} LIKE ${Prisma.raw(pattern)}
           OR ${nameSql("description")} LIKE ${Prisma.raw(pattern)}
      `;
      const matchingIds = matchingRows.map((r) => r.id);

      // Combine with category filter
      const baseWhere: any = { id: { in: matchingIds.length > 0 ? matchingIds : [-1] } };
      if (category !== "TODAS") {
        baseWhere.category = category;
      }

      if (isStockFilterActive) {
        const all = await prisma.product.findMany({ where: baseWhere, select: { id: true, quantity: true, minStock: true } });
        const filteredIds = all
          .filter((p) => stockFilter === "BAJO" ? p.quantity <= p.minStock : p.quantity > p.minStock)
          .map((p) => p.id);
        total = filteredIds.length;
        const pagedIds = filteredIds.slice(skip, skip + limit);
        products = await prisma.product.findMany({ where: { id: { in: pagedIds } }, orderBy: { name: "asc" } });
      } else {
        const [result, count] = await Promise.all([
          prisma.product.findMany({ skip, take: limit, where: baseWhere, orderBy: { name: "asc" } }),
          prisma.product.count({ where: baseWhere }),
        ]);
        products = result;
        total = count;
      }
    } else {
      // No search — regular query
      const baseWhere: any = {};
      if (category !== "TODAS") baseWhere.category = category;

      if (isStockFilterActive) {
        const all = await prisma.product.findMany({ where: baseWhere, select: { id: true, quantity: true, minStock: true } });
        const matchingIds = all
          .filter((p) => stockFilter === "BAJO" ? p.quantity <= p.minStock : p.quantity > p.minStock)
          .map((p) => p.id);
        total = matchingIds.length;
        const pagedIds = matchingIds.slice(skip, skip + limit);
        products = await prisma.product.findMany({ where: { id: { in: pagedIds } }, orderBy: { name: "asc" } });
      } else {
        const [result, count] = await Promise.all([
          prisma.product.findMany({ skip, take: limit, where: baseWhere, orderBy: { name: "asc" } }),
          prisma.product.count({ where: baseWhere }),
        ]);
        products = result;
        total = count;
      }
    }

    const allProducts = await prisma.product.findMany({ select: { quantity: true, minStock: true, category: true } });
    const lowStockCount = allProducts.filter((p) => p.quantity <= p.minStock).length;
    const categoryCount = new Set(allProducts.map((p) => p.category)).size;

    return NextResponse.json({
      data: products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats: { totalProducts: allProducts.length, lowStockCount, categoryCount },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al obtener productos" },
      { status: 500 }
    );
  }
}

export const POST = withCsrf(async (request: Request) => {
  const auth = await requireRole(request, ["ADMIN"]);
  if (auth.error) return auth.error;
  try {
    const data = await request.json();
    const { valid, errors } = validate(
      required(data, ["name", "category"]),
      isString(data, "name", { maxLength: 200 }),
      isString(data, "category", { maxLength: 50 }),
      isNumber(data, "price", { min: 0, required: false }),
      isNumber(data, "quantity", { min: 0, required: false }),
      isNumber(data, "minStock", { min: 0, required: false }),
    );
    if (!valid) return validationErrorResponse(errors);
    const product = await prisma.product.create({ data });
    const user = await getUserFromCookie(request);
    createAuditLog({
      action: "CREATE",
      entity: "Product",
      entityId: product.id,
      description: `Producto "${product.name}" creado`,
      userId: user?.id ?? undefined,
      userName: user?.name ?? undefined,
    });
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al crear producto" },
      { status: 500 }
    );
  }
});
