import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/jwt";
import { getAuditLogs } from "@/lib/auditLog";
import { requireRole } from "@/lib/requireRole";

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["ADMIN"]);
  if (auth.error) return auth.error;
  const user = auth.user;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const entity = searchParams.get("entity") || undefined;
  const action = searchParams.get("action") || undefined;

  try {
    const result = await getAuditLogs({ page, limit, entity, action });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return NextResponse.json({ error: "Error al obtener registros" }, { status: 500 });
  }
}
