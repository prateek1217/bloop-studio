// Thin client for the auth API — now a TypeScript rewrite of the old Go
// backend, living in this same Next.js app (see src/app/api/auth/), so
// there's no cross-origin/proxy concern at all: these routes are always
// same-origin by construction. (backend/ is kept around unused, in case of
// a rollback — see next.config.ts's still-present /api/go/* rewrite.)

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthCheckResult {
  authenticated: boolean;
  user?: AuthUser;
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = body && typeof body.error === "string" ? body.error : "Something went wrong, try again.";
    throw new Error(message);
  }
  return body as T;
}

export async function checkAuth(): Promise<AuthCheckResult> {
  const res = await fetch("/api/auth/me", { credentials: "same-origin" });
  if (!res.ok) return { authenticated: false };
  return (await res.json()) as AuthCheckResult;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJsonOrThrow<{ user: AuthUser }>(res);
  return data.user;
}

export async function signup(email: string, password: string, confirmPassword: string): Promise<AuthUser> {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, confirmPassword }),
  });
  const data = await parseJsonOrThrow<{ user: AuthUser }>(res);
  return data.user;
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
}
