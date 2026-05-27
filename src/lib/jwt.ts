import { jwtVerify } from "jose";

export interface JWTPayload {
  id: number;
  name: string;
  role: string;
}

export function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "La variable de entorno JWT_SECRET no está configurada. " +
        "Defínela en el archivo .env.local para asegurar la autenticación.\n" +
        "Ejecuta: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"\n" +
        "y agrega JWT_SECRET=<ese-valor> a tu archivo .env.local"
    );
  }
  return new TextEncoder().encode(secret);
}

export async function getUserFromCookie(request: Request): Promise<JWTPayload | null> {
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const cookies = Object.fromEntries(
      cookieHeader.split("; ").filter(Boolean).map((c) => {
        const [key, ...val] = c.split("=");
        return [key, val.join("=")];
      })
    );
    const token = cookies["session"];
    if (!token) return null;

    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}
