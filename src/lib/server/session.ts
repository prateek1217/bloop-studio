import type { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, TOKEN_TTL_MS, getAuthConfig } from "./authConfig";
import { issueToken, verifyToken } from "./jwt";

// Port of issueSession/Me in backend/internal/auth/handlers.go.

export function issueSessionCookie(res: NextResponse, userId: string, email: string): void {
  const { jwtSecret, cookieSecure } = getAuthConfig();
  const token = issueToken(jwtSecret, userId, email, TOKEN_TTL_MS);
  res.cookies.set(COOKIE_NAME, token, {
    path: "/",
    expires: new Date(Date.now() + TOKEN_TTL_MS),
    httpOnly: true,
    secure: cookieSecure,
    sameSite: "lax",
  });
}

export function clearSessionCookie(res: NextResponse): void {
  const { cookieSecure } = getAuthConfig();
  res.cookies.set(COOKIE_NAME, "", {
    path: "/",
    maxAge: -1,
    httpOnly: true,
    secure: cookieSecure,
    sameSite: "lax",
  });
}

export function getSessionUser(req: NextRequest): { userId: string; email: string } | null {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { jwtSecret } = getAuthConfig();
    return verifyToken(jwtSecret, token);
  } catch {
    return null;
  }
}
