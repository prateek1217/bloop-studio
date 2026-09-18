"use client";

import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

interface Props {
  redirectTo: string;
  onClose: () => void;
  title?: string;
  description?: string;
}

/** Shown when the user needs an account to continue (export, "My projects",
 * or a longer-than-the-free-limit upload) while logged out. */
export default function AuthRequiredModal({
  redirectTo,
  onClose,
  title = "Log in to export",
  description = "Create a free account or log in to download your finished video.",
}: Props) {
  const router = useRouter();
  const redirectParam = encodeURIComponent(redirectTo);

  // Portaled to <body>: this can be triggered from inside the nav pill,
  // which sets backdrop-filter — that makes the nav a containing block for
  // any `position: fixed` descendant, so without a portal the overlay would
  // center inside the small nav box instead of the viewport.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-center shadow-[0_0_60px_-15px_rgba(139,92,246,0.5)]"
      >
        <div className="pointer-events-none absolute inset-x-0 -top-24 h-40 bg-gradient-to-br from-violet-600/30 via-fuchsia-500/20 to-cyan-500/25 blur-2xl" />

        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 text-neutral-500 hover:text-neutral-300"
        >
          ✕
        </button>

        <div className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 shadow-[0_0_25px_-4px_rgba(139,92,246,0.7)]">
          <LockIcon />
        </div>

        <h2 className="relative mt-4 text-lg font-semibold text-white">{title}</h2>
        <p className="relative mt-1.5 text-sm text-neutral-400">{description}</p>

        <div className="relative mt-6 flex flex-col gap-2.5">
          <button
            onClick={() => router.push(`/login?redirect=${redirectParam}`)}
            className="w-full rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Log in
          </button>
          <button
            onClick={() => router.push(`/signup?redirect=${redirectParam}`)}
            className="w-full rounded-lg border border-neutral-700 px-4 py-2.5 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-800"
          >
            Sign up
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="white" strokeWidth="1.8" />
      <path d="M8 11V7a4 4 0 018 0v4" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
