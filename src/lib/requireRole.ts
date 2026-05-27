import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/jwt";
import type { JWTPayload } from "@/lib/jwt";

type Role = "ADMIN" | "EMPLEADA" | "ESTETICISTA";

/**
 * Verifica que el usuario autenticado tenga el rol requerido.
 * Si no está autenticado, devuelve 401.
 * Si no tiene el rol, devuelve 403.
 * Si tiene el rol, devuelve el payload del JWT.
 */
export async function requireRole(
  request: Request,
  allowedRoles: Role[] = ["ADMIN"]
): Promise<{ user: JWTPayload; error: null } | { user: null; error: NextResponse }> {
  const user = await getUserFromCookie(request);

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }

  if (!allowedRoles.includes(user.role as Role)) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "No tienes permisos para realizar esta acción" },
        { status: 403 }
      ),
    };
  }

  return { user, error: null };
}

/**
 * Helper para determinar si una petición es de solo lectura (GET/HEAD/OPTIONS)
 */
export function isReadOnlyMethod(request: Request): boolean {
  const method = request.method.toUpperCase();
  return ["GET", "HEAD", "OPTIONS"].includes(method);
}

/**
 * Verifica que el usuario sea ADMIN para métodos de escritura.
 * Para GET permite cualquier rol autenticado.
 */
export async function requireWriteAdmin(
  request: Request
): Promise<{ user: JWTPayload; error: null } | { user: null; error: NextResponse }> {
  if (isReadOnlyMethod(request)) {
    // Solo validar que esté autenticado
    const user = await getUserFromCookie(request);
    if (!user) {
      return {
        user: null,
        error: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
      };
    }
    return { user, error: null };
  }

  return requireRole(request, ["ADMIN"]);
}
