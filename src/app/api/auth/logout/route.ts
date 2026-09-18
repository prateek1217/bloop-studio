import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/server/session";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true }, { status: 200 });
  clearSessionCookie(res);
  return res;
}
