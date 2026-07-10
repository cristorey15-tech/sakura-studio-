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
    // Para rutas API, devolver JSON de error (no redirigir con HTML)
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }
    // Para rutas de página, redirigir a login guardando la ruta original
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const role = payload.role as string;

    // Verificar rutas ADMIN-only
    const isAdminRoute = ADMIN_ONLY_ROUTES.some((r) => pathname.startsWith(r));
    const isSalesRoute = ADMIN_SALES_ROUTES.some((r) => pathname.startsWith(r));

    if ((isAdminRoute || isSalesRoute) && role !== "ADMIN") {
      // Para API routes, devolver error 403; para páginas, redirigir al dashboard
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "No tienes permisos para realizar esta acción" },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL("/?access=denied", request.url));
    }

    return NextResponse.next();
  } catch {
    // Token inválido/expirado
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Sesión expirada" },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    // Aplicar a todas las rutas excepto las que empiezan con _next/static, etc.
    "/((?!_next/static|_next/image|favicon.ico|logo).*)",
  ],
};
