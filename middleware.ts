import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { getJwtSecret } from "@/lib/jwt";

const JWT_SECRET = getJwtSecret();

// Extensiones de archivos estáticos que deben saltarse el middleware
const STATIC_EXTENSIONS = /\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|woff2?|ttf|eot|pdf|txt|xml|webmanifest)$/i;

const publicRoutes = ["/login"];
const authApiRoutes = ["/api/auth/login", "/api/auth/me"];

function isStaticFile(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/logo.png" ||
    STATIC_EXTENSIONS.test(pathname)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Permitir archivos estáticos (imágenes, fuentes, etc.)
  if (isStaticFile(pathname)) {
    return NextResponse.next();
  }

  // Permitir rutas públicas y endpoints de auth no protegidos
  if (
    publicRoutes.some((route) => pathname.startsWith(route)) ||
    authApiRoutes.some((route) => pathname.startsWith(route)) ||
    pathname.startsWith("/api/auth/logout") ||
    pathname.startsWith("/api/auth/clear")
  ) {
    return NextResponse.next();
  }

  // --- Verificación de sesión ---
  const token = request.cookies.get("session")?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    await jwtVerify(token, JWT_SECRET);
    return NextResponse.next();
  } catch {
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
    // Protege todas las rutas excepto static files de Next.js
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
