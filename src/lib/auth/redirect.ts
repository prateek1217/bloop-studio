// Only ever redirect back into this app after login/signup — an unvalidated
// `?redirect=` query param would otherwise be an open-redirect vector.
export function sanitizeRedirect(path: string | null): string {
  if (!path) return "/";
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  return path;
}
