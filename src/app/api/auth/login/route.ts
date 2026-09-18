import { NextRequest, NextResponse } from "next/server";
import { usersCollection } from "@/lib/server/mongo";
import { checkPassword } from "@/lib/server/password";
import { issueSessionCookie } from "@/lib/server/session";

export const runtime = "nodejs";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Port of Login in backend/internal/auth/handlers.go — deliberately the
 * same generic error for "unknown email" and "wrong password", so a caller
 * can't enumerate registered emails from the response. */
export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const email = normalizeEmail(body.email ?? "");
  const password = body.password ?? "";

  try {
    const users = await usersCollection();
    const user = await users.findOne({ email });
    if (!user || !(await checkPassword(user.passwordHash, password))) {
      return NextResponse.json({ error: "invalid email or password" }, { status: 401 });
    }

    const responseUser = { id: user._id.toHexString(), email: user.email, createdAt: user.createdAt };
    const res = NextResponse.json({ user: responseUser }, { status: 200 });
    issueSessionCookie(res, responseUser.id, responseUser.email);
    return res;
  } catch (err) {
    console.error("[/api/auth/login] failed", err);
    return NextResponse.json({ error: "something went wrong, try again" }, { status: 500 });
  }
}
