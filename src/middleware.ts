import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { getJwtSecret } from "@/lib/jwt";

// Rutas que solo ADMIN puede ver
const ADMIN_ONLY_ROUTES = [
  "/empleadas",
  "/reportes",
  "/inventario",
  "/auditoria",
  "/configuracion",
];

// Rutas de ventas — solo ADMIN (empleadas no pueden vender)
const ADMIN_SALES_ROUTES = ["/ventas"];

const PUBLIC_ROUTES = ["/login", "/api/auth"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Permitir rutas públicas siempre
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // Omitir archivos estáticos y API internas
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/logo") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Leer cookie de sesión
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader.split("; ").filter(Boolean).map((c) => {
      const [key, ...val] = c.split("=");
      return [key, val.join("=")];
    })
  );

  const token = cookies["session"];

  if (!token) {
    // No hay sesión → redirigir a login
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const role = payload.role as string;

    // Verificar rutas ADMIN-only
    const isAdminRoute = ADMIN_ONLY_ROUTES.some((r) => pathname.startsWith(r));
    const isSalesRoute = ADMIN_SALES_ROUTES.some((r) => pathname.startsWith(r));

    if ((isAdminRoute || isSalesRoute) && role !== "ADMIN") {
      // Redirigir al dashboard con mensaje
      return NextResponse.redirect(new URL("/?access=denied", request.url));
    }

    return NextResponse.next();
  } catch {
    // Token inválido → redirigir a login
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: [
    // Aplicar a todas las rutas excepto las que empiezan con _next/static, etc.
    "/((?!_next/static|_next/image|favicon.ico|logo).*)",
  ],
};
