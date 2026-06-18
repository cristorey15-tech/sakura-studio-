import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCsrf } from "@/lib/withCsrf";
import { getUserFromCookie } from "@/lib/jwt";
import { createAuditLog } from "@/lib/auditLog";
import { requireRole } from "@/lib/requireRole";
import bcrypt from "bcryptjs";
import { required, isString, isEmail, validate, validationErrorResponse } from "@/lib/validate";

export async function GET(request: Request) {
  const auth = await requireRole(request, ["ADMIN"]);
  if (auth.error) return auth.error;
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        skip,
        take: limit,
        orderBy: { name: "asc" },
      }),
      prisma.employee.count(),
    ]);

    return NextResponse.json(employees, {
      headers: {
        "X-Total-Count": String(total),
        "X-Page": String(page),
        "X-Total-Pages": String(Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al obtener empleadas" },
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
      required(data, ["name"]),
      isString(data, "name", { maxLength: 200 }),
      isString(data, "phone", { required: false, maxLength: 30 }),
      isEmail(data, "email"),
    );
    if (!valid) return validationErrorResponse(errors);
    if (data.password && data.password.length < 4) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 4 caracteres" },
        { status: 400 }
      );
    }
    const hashedPassword = data.password
      ? await bcrypt.hash(data.password, 10)
      : null;
    const employee = await prisma.employee.create({
      data: {
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        password: hashedPassword,
        role: data.role || "EMPLEADA",
        active: data.active ?? true,
        startDate: data.startDate ? new Date(data.startDate) : null,
        notes: data.notes || null,
      },
    });
    const user = await getUserFromCookie(request);
    await createAuditLog({
      action: "CREATE",
      entity: "Employee",
      entityId: employee.id,
      description: `Empleada creada: ${employee.name}`,
      userId: user?.id,
      userName: user?.name,
    });
    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al crear empleada" },
      { status: 500 }
    );
  }
});
