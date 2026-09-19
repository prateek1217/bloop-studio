import { NextRequest, NextResponse } from "next/server";
import { leadsCollection } from "@/lib/server/mongo";

export const runtime = "nodejs";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGE_LENGTH = 1000;

/** Business-inquiry form on the landing page footer. Every submission is
 * its own document (not upserted/deduped by email) — unlike a newsletter
 * signup, a second message from the same email is a separate inquiry
 * worth keeping, not a duplicate to collapse away. */
export async function POST(req: NextRequest) {
  let body: { email?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const message = (body.message ?? "").trim();

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "enter a valid email address" }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "enter a message" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `message must be ${MAX_MESSAGE_LENGTH} characters or fewer` }, { status: 400 });
  }

  try {
    const leads = await leadsCollection();
    await leads.insertOne({ email, message, createdAt: new Date() });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[/api/leads] failed", err);
    return NextResponse.json({ error: "something went wrong, try again" }, { status: 500 });
  }
}
