import { NextRequest, NextResponse } from "next/server";
import { usersCollection } from "@/lib/server/mongo";
import { hashPassword } from "@/lib/server/password";
import { issueSessionCookie } from "@/lib/server/session";

export const runtime = "nodejs";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Port of Signup in backend/internal/auth/handlers.go — same validation
 * order and error messages, so the client's error handling doesn't need to change. */
export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; confirmPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const email = normalizeEmail(body.email ?? "");
  const password = body.password ?? "";
  const confirmPassword = body.confirmPassword ?? "";

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "enter a valid email address" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ error: "passwords do not match" }, { status: 400 });
  }

  try {
    const users = await usersCollection();

    const existing = await users.findOne({ email });
    if (existing) {
      return NextResponse.json({ error: "an account with that email already exists" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const createdAt = new Date();
    const { insertedId } = await users.insertOne({ email, passwordHash, createdAt });

    const user = { id: insertedId.toHexString(), email, createdAt };
    const res = NextResponse.json({ user }, { status: 201 });
    issueSessionCookie(res, user.id, user.email);
    return res;
  } catch (err) {
    console.error("[/api/auth/signup] failed", err);
    return NextResponse.json({ error: "something went wrong, try again" }, { status: 500 });
  }
}
