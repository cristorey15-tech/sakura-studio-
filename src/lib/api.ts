/** Return type for apiFetch calls */
export type ApiResponse<T> = { data: T | null; error: string | null; status: number };

/**
 * Obtiene el valor de una cookie por nombre.
 */
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}\\s*=\\s*([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

type RequestOptions = RequestInit & {
  /** Si es true, omite el header CSRF incluso en mutaciones */
  noCsrf?: boolean;
};

/**
 * Wrapper alrededor de fetch que automáticamente:
 * - Incluye el header X-CSRF-Token en requests mutativos (POST, PUT, DELETE, PATCH)
 * - Maneja errores de red
 * - Parsea JSON automáticamente
 */
export async function apiFetch<T = unknown>(
  url: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { noCsrf, ...fetchOptions } = options;

  const headers = new Headers(fetchOptions.headers);

  // Si no hay Content-Type explícito, usar JSON
  if (!headers.has("Content-Type") && !(fetchOptions.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Agregar CSRF token en mutaciones
  if (
    !noCsrf &&
    fetchOptions.method &&
    ["POST", "PUT", "DELETE", "PATCH"].includes(fetchOptions.method.toUpperCase())
  ) {
    const csrfToken = getCookie("csrf-token");
    if (csrfToken) {
      headers.set("X-CSRF-Token", csrfToken);
    }
  }

  try {
    const res = await fetch(url, { ...fetchOptions, headers, credentials: "include" });
    let data: T | null = null;
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await res.json();
    }
    if (!res.ok) {
      const errorMsg = data && typeof data === "object" && "error" in (data as Record<string, unknown>)
        ? (data as Record<string, string>).error
        : `Error ${res.status}`;
      return { data: null, error: errorMsg, status: res.status };
    }
    return { data, error: null, status: res.status };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Error de conexión",
      status: 0,
    };
  }
}
