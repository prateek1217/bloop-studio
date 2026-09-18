"use client";

import { useCallback, useState } from "react";
import { checkAuth } from "./client";

/**
 * Shared "is the user logged in?" gate for an in-place action (clicking
 * Export, clicking "My projects") — checks auth on demand and, if it fails,
 * hands back a redirect target for <AuthRequiredModal> instead of navigating
 * away immediately. Both call sites want the same friendly modal rather than
 * a hard redirect, so this lives in one place instead of being copy-pasted.
 */
export function useAuthGate() {
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const requireAuth = useCallback(async (redirectTo: string, onAuthenticated: () => void) => {
    setChecking(true);
    const { authenticated } = await checkAuth().catch(() => ({ authenticated: false }));
    setChecking(false);
    if (authenticated) {
      onAuthenticated();
    } else {
      setPendingRedirect(redirectTo);
    }
  }, []);

  return {
    checking,
    showAuthModal: pendingRedirect !== null,
    authRedirectTo: pendingRedirect ?? "/",
    closeAuthModal: () => setPendingRedirect(null),
    requireAuth,
  };
}
