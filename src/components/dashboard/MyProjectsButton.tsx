"use client";

import { useRouter } from "next/navigation";
import { useAuthGate } from "@/lib/auth/useAuthGate";
import AuthRequiredModal from "@/components/auth/AuthRequiredModal";

interface Props {
  className?: string;
}

/** Nav entry point into the projects dashboard — gated the same way Export
 * is, since both need a real account behind them. */
export default function MyProjectsButton({
  className = "text-sm text-neutral-400 transition-colors hover:text-white disabled:opacity-50",
}: Props) {
  const router = useRouter();
  const { checking, showAuthModal, authRedirectTo, closeAuthModal, requireAuth } = useAuthGate();

  function handleClick() {
    requireAuth("/projects", () => router.push("/projects"));
  }

  return (
    <>
      {/* suppressHydrationWarning: a browser extension (form-filler, same one
          noted on <body> in layout.tsx) stamps a jf-ext-button-ct attribute
          onto buttons before hydration — not a real SSR/client mismatch. */}
      <button onClick={handleClick} disabled={checking} className={className} suppressHydrationWarning>
        {checking ? "Checking…" : "My projects"}
      </button>
      {showAuthModal && (
        <AuthRequiredModal
          redirectTo={authRedirectTo}
          onClose={closeAuthModal}
          title="Log in to view your projects"
          description="Create a free account or log in to access your personal projects."
        />
      )}
    </>
  );
}
