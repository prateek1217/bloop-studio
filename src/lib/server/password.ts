import bcrypt from "bcryptjs";

// Port of backend/internal/auth/password.go. bcrypt is a standardized hash
// format ($2a$/$2b$ prefix) — hashes this writes are just as valid to Go's
// golang.org/x/crypto/bcrypt as they are here, and vice versa, so switching
// libraries doesn't invalidate any password hash already stored.
const COST = 10; // matches bcrypt.DefaultCost in the Go version

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function checkPassword(hash: string, plain: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
