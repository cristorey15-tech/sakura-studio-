import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { getJwtSecret } from "@/lib/jwt";
import { deriveCsrfToken } from "@/lib/csrf";

const JWT_SECRET = getJwtSecret();

// GET /api/auth/login — devuelve empleadas que tienen contraseña (para el selector)
// Si no hay ninguna, crea el admin por defecto automáticamente.
export async function GET() {
  try {
    let employees = await prisma.employee.findMany({
      where: { active: true, password: { not: null } },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    });

    // Auto-seed: si no hay empleados con contraseña, SIEMPRE crear el admin por defecto
    // Esto cubre tanto DB vacía como DB con empleados importados sin contraseña.
    if (employees.length === 0) {
      // Check if Admin user already exists (with or without password)
      const existingAdmin = await prisma.employee.findFirst({
        where: { name: "Admin", active: true },
      });

      if (existingAdmin) {
        // Admin exists but has no password — assign one
        if (!existingAdmin.password) {
          const hashedPassword = await bcrypt.hash("0000", 10);
          await prisma.employee.update({
            where: { id: existingAdmin.id },
            data: { password: hashedPassword },
          });
        }
        employees = [{ id: existingAdmin.id, name: existingAdmin.name, role: existingAdmin.role }];
      } else {
        // No Admin exists at all — create it
        const hashedPassword = await bcrypt.hash("0000", 10);
        const admin = await prisma.employee.create({
          data: {
            name: "Admin",
            phone: "555-0000",
            email: "admin@sakurastudio.com",
            role: "ADMIN",
            password: hashedPassword,
            notes: "Administrador por defecto. Contraseña: 0000",
            startDate: new Date(),
          },
        });
        employees = [{ id: admin.id, name: admin.name, role: admin.role }];
      }

      // Also seed a default client if none exist
      const totalClients = await prisma.client.count();
      if (totalClients === 0) {
        const existingClient = await prisma.client.findFirst({
          where: { name: "Cliente de Paso" },
        });
        if (!existingClient) {
          await prisma.client.create({
            data: { name: "Cliente de Paso" },
          });
        }
      }
    }

    return NextResponse.json({ employees });
  } catch (error) {
    console.error("Login GET error:", error);
    return NextResponse.json({ employees: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, password } = await request.json();

    if (!name || !password) {
      return NextResponse.json(
        { error: "Nombre y contraseña son requeridos" },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findFirst({
      where: { name, active: true },
    });

    if (!employee || !employee.password) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, employee.password);
    if (!valid) {
      return NextResponse.json(
        { error: "Contraseña incorrecta" },
        { status: 401 }
      );
    }

    // Crear JWT
    const token = await new SignJWT({
      id: employee.id,
      name: employee.name,
      role: employee.role,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(JWT_SECRET);

    const response = NextResponse.json({
      user: { id: employee.id, name: employee.name, role: employee.role },
    });

    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 horas
      path: "/",
    });

    // CSRF token (non-httpOnly para que JS lo lea)
    const csrfToken = deriveCsrfToken(token);
    response.cookies.set("csrf-token", csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 horas
      path: "/",
    });

    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al iniciar sesión" },
      { status: 500 }
    );
  }
}
