import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/jwt";

export async function GET(request: Request) {
  try {
    const user = await getUserFromCookie(request);
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ user: null });
  }
}
