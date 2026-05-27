import { NextResponse } from "next/server";

function parseCookies(request: Request): Record<string, string> {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const [key, ...val] = part.trim().split("=");
    if (key) cookies[key.trim()] = val.join("=");
  }
  return cookies;
}

/**
 * Wraps an API route handler with CSRF validation.
 * GET/HEAD requests are allowed without CSRF.
 * POST/PUT/DELETE/PATCH require a valid X-CSRF-Token header
 * matching the csrf-token cookie (double-submit cookie pattern).
 *
 * @param handler The route handler to wrap
 * @param opts.skipPaths Optional array of path prefixes to skip CSRF for
 */
export function withCsrf<T extends (...args: any[]) => Promise<Response>>(
  handler: T,
  opts?: { skipPaths?: string[] }
): T {
  return (async (request: Request, ...args: any[]) => {
    const method = request.method?.toUpperCase();

    // Skip CSRF for safe methods
    if (method === "GET" || method === "HEAD") {
      return handler(request, ...args);
    }

    // Skip CSRF for whitelisted paths (e.g., login which sets the CSRF cookie)
    if (opts?.skipPaths) {
      const url = new URL(request.url);
      for (const path of opts.skipPaths) {
        if (url.pathname === path || url.pathname.startsWith(path)) {
          return handler(request, ...args);
        }
      }
    }

    const cookies = parseCookies(request);
    const csrfCookie = cookies["csrf-token"];
    const csrfHeader = request.headers.get("X-CSRF-Token");

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return NextResponse.json(
        { error: "Token CSRF inválido. Recarga la página e intenta de nuevo." },
        { status: 403 }
      );
    }

    return handler(request, ...args);
  }) as T;
}
