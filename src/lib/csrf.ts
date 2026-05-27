import { createHash } from "crypto";

/**
 * Genera un token CSRF derivado del session token (para validación sin estado extra).
 */
export function deriveCsrfToken(sessionToken: string): string {
  const hash = createHash("sha256");
  hash.update(sessionToken);
  return hash.digest("hex");
}
