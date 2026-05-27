import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { getJwtSecret } from "@/lib/jwt";
import { deriveCsrfToken } from "@/lib/csrf";

const JWT_SECRET = getJwtSecret();

// GET /api/auth/login — devuelve empleadas que tienen contraseña (para el selector)
export async function GET() {
  try {
    const employees = await prisma.employee.findMany({
      where: { active: true, password: { not: null } },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ employees });
  } catch {
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
