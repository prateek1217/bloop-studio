// TypeScript port of backend/internal/config/config.go — same env vars, same
// fail-fast-on-missing-secret behavior, now read lazily per request instead
// of once at process startup (there's no persistent startup phase in a
// serverless function).

export const COOKIE_NAME = "session_token";
export const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours — see backend/internal/config/config.go

export interface AuthConfig {
  mongoUri: string;
  mongoDbName: string;
  jwtSecret: string;
  cookieSecure: boolean;
}

let cached: AuthConfig | null = null;

export function getAuthConfig(): AuthConfig {
  if (cached) return cached;

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI is not set");

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error("JWT_SECRET is not set");

  cached = {
    mongoUri,
    mongoDbName: process.env.MONGODB_DB || "subtitle_studio",
    jwtSecret,
    cookieSecure: process.env.COOKIE_SECURE === "true",
  };
  return cached;
}
