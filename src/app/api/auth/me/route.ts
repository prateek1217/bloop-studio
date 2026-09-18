import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/session";

export const runtime = "nodejs";

/** Port of Me in backend/internal/auth/handlers.go — "not logged in" is a
 * normal answer, always 200, never an error status. */
export async function GET(req: NextRequest) {
  const session = getSessionUser(req);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
  return NextResponse.json(
    { authenticated: true, user: { id: session.userId, email: session.email } },
    { status: 200 }
  );
}
