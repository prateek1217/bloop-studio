"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkAuth, type AuthUser } from "./client";

/**
 * Guards a whole page (as opposed to useAuthGate, which guards a single
 * action with an in-place modal) — for someone landing directly on a
 * protected URL rather than clicking a gated button, there's nothing useful
 * to show without a session, so this redirects straight to /login.
 */
export function useRequireAuth(redirectTo: string) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    checkAuth()
      .catch(() => ({ authenticated: false as const }))
      .then((result) => {
        if (cancelled) return;
        if (result.authenticated && result.user) {
          setUser(result.user);
          setChecked(true);
        } else {
          router.replace(`/login?redirect=${encodeURIComponent(redirectTo)}`);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { user, checked };
}
