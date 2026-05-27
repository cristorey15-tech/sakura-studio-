import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCsrf } from "@/lib/withCsrf";
import { getUserFromCookie } from "@/lib/jwt";
import { createAuditLog } from "@/lib/auditLog";
import { requireRole } from "@/lib/requireRole";
import bcrypt from "bcryptjs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const employee = await prisma.employee.findUnique({
      where: { id: Number(id) },
      include: {
        _count: {
          select: {
            sales: true,
            appointments: true,
          },
        },
        appointments: {
          include: {
            service: { select: { name: true, category: true, price: true } },
            client: { select: { name: true } },
          },
          orderBy: { date: "desc" },
          take: 20,
        },
        sales: {
          include: {
            items: {
              include: {
                service: { select: { name: true, category: true } },
              },
            },
            client: { select: { name: true } },
          },
          orderBy: { date: "desc" },
          take: 20,
        },
        availabilities: true,
      },
    });
    if (!employee) {
      return NextResponse.json({ error: "Empleada no encontrada" }, { status: 404 });
    }
    const { password, ...safeEmployee } = employee;
    return NextResponse.json(safeEmployee);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al obtener empleada" },
      { status: 500 }
    );
  }
}

export const PUT = withCsrf(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const auth = await requireRole(request, ["ADMIN"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const data = await request.json();
    const updateData: any = {
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      role: data.role || "EMPLEADA",
      active: data.active ?? true,
      startDate: data.startDate ? new Date(data.startDate) : null,
      notes: data.notes || null,
    };
    // Only hash and update password if a new one is provided
    if (data.password && data.password.trim().length > 0) {
      if (data.password.length < 4) {
        return NextResponse.json(
          { error: "La contraseña debe tener al menos 4 caracteres" },
          { status: 400 }
        );
      }
      updateData.password = await bcrypt.hash(data.password, 10);
    }
    const employee = await prisma.employee.update({
      where: { id: Number(id) },
      data: updateData,
    });
    const user = await getUserFromCookie(request);
    await createAuditLog({
      action: "UPDATE",
      entity: "Employee",
      entityId: employee.id,
      description: `Empleada actualizada: ${employee.name}`,
      userId: user?.id,
      userName: user?.name,
    });
    return NextResponse.json(employee);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al actualizar empleada" },
      { status: 500 }
    );
  }
});

export const DELETE = withCsrf(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const auth = await requireRole(_request, ["ADMIN"]);
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const employee = await prisma.employee.findUnique({ where: { id: Number(id) } });
    await prisma.employee.delete({ where: { id: Number(id) } });
    const user = await getUserFromCookie(_request);
    await createAuditLog({
      action: "DELETE",
      entity: "Employee",
      entityId: Number(id),
      description: `Empleada eliminada: ${employee?.name || `ID ${id}`}`,
      userId: user?.id,
      userName: user?.name,
    });
    return NextResponse.json({ message: "Empleada eliminada" });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al eliminar empleada" },
      { status: 500 }
    );
  }
});
