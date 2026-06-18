import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { getJwtSecret } from "@/lib/jwt";
import { deriveCsrfToken } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rateLimit";

const JWT_SECRET = getJwtSecret();

// Brute force protection: track failed login attempts per username
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function isLockedOut(name: string): boolean {
  const record = loginAttempts.get(name);
  if (!record) return false;
  if (Date.now() > record.lockedUntil) {
    loginAttempts.delete(name);
    return false;
  }
  return true;
}

function recordFailedAttempt(name: string): void {
  const record = loginAttempts.get(name) || { count: 0, lockedUntil: 0 };
  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_MS;
  }
  loginAttempts.set(name, record);
}

function clearAttempts(name: string): void {
  loginAttempts.delete(name);
}

// GET /api/auth/login — empleadas que tienen contraseña (selector)
export async function GET() {
  try {
    let employees = await prisma.employee.findMany({
      where: { active: true, password: { not: null } },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    });

    // Auto-seed admin if no employees with passwords
    if (employees.length === 0) {
      const existingAdmin = await prisma.employee.findFirst({
        where: { name: "Admin", active: true },
      });

      if (existingAdmin) {
        if (!existingAdmin.password) {
          const hashedPassword = await bcrypt.hash("0000", 10);
          await prisma.employee.update({
            where: { id: existingAdmin.id },
            data: { password: hashedPassword },
          });
        }
        employees = [{ id: existingAdmin.id, name: existingAdmin.name, role: existingAdmin.role }];
      } else {
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

      const totalClients = await prisma.client.count();
      if (totalClients === 0) {
        const existingClient = await prisma.client.findFirst({
          where: { name: "Cliente de Paso" },
        });
        if (!existingClient) {
          await prisma.client.create({ data: { name: "Cliente de Paso" } });
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
  // Rate limit: 10 attempts per minute per IP
  const rateLimit = checkRateLimit(request, { windowMs: 60000, max: 10 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
      { status: 429 }
    );
  }

  try {
    const { name, password } = await request.json();

    if (!name || !password) {
      return NextResponse.json(
        { error: "Nombre y contraseña son requeridos" },
        { status: 400 }
      );
    }

    // Check brute force lockout
    if (isLockedOut(name)) {
      const record = loginAttempts.get(name);
      const minutesLeft = Math.ceil((record!.lockedUntil - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Cuenta bloqueada temporalmente. Intenta de nuevo en ${minutesLeft} minuto(s).` },
        { status: 423 }
      );
    }

    const employee = await prisma.employee.findFirst({
      where: { name, active: true },
    });

    if (!employee || !employee.password) {
      recordFailedAttempt(name);
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, employee.password);
    if (!valid) {
      recordFailedAttempt(name);
      const attempts = loginAttempts.get(name);
      const remaining = MAX_ATTEMPTS - (attempts?.count || 0);
      return NextResponse.json(
        {
          error: `Contraseña incorrecta${remaining > 0 && remaining < MAX_ATTEMPTS ? `. Te quedan ${remaining} intento(s)` : ""}`,
        },
        { status: 401 }
      );
    }

    // Success — clear attempts
    clearAttempts(name);

    // Create JWT with 12h expiry (shorter for security)
    const token = await new SignJWT({
      id: employee.id,
      name: employee.name,
      role: employee.role,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("12h")
      .sign(JWT_SECRET);

    const response = NextResponse.json({
      user: { id: employee.id, name: employee.name, role: employee.role },
    });

    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 12, // 12 horas
      path: "/",
    });

    const csrfToken = deriveCsrfToken(token);
    response.cookies.set("csrf-token", csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 12,
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
