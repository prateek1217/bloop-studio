import jwt from "jsonwebtoken";

// Port of backend/internal/auth/jwt.go — same claims shape (sub = userId,
// email, iat/exp), same HS256 signing, so either side could still read a
// token the other issued if you ever needed to run both during a migration.

interface TokenClaims {
  sub: string;
  email: string;
}

export function issueToken(secret: string, userId: string, email: string, ttlMs: number): string {
  return jwt.sign({ email } satisfies Omit<TokenClaims, "sub">, secret, {
    subject: userId,
    expiresIn: Math.floor(ttlMs / 1000),
    algorithm: "HS256",
  });
}

export function verifyToken(secret: string, token: string): { userId: string; email: string } {
  const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] }) as jwt.JwtPayload;
  if (!decoded.sub || typeof decoded.email !== "string") throw new Error("invalid token");
  return { userId: decoded.sub, email: decoded.email };
}
