"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "done" | "error";

const MAX_MESSAGE_LENGTH = 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Business-inquiry form, footer placement — email first, then reveals a
 * message box (not submitted until the message is sent too), storing both
 * to the "leads" Mongo collection via /api/leads. Separate from signup: no
 * password, no account, just a way to reach out. */
export default function LeadCaptureForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [showMessage, setShowMessage] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError("Enter a valid email address");
      return;
    }
    setError(null);
    setShowMessage(true);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong, try again.");
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong, try again.");
    }
  }

  if (status === "done") {
    return <p className="mt-4 max-w-xs text-xs font-medium text-emerald-600">Thanks — we&apos;ll be in touch.</p>;
  }

  return (
    <div className="mt-4 max-w-xs">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-900">Contact us for business</p>

      {!showMessage ? (
        <form onSubmit={handleContinue} className="mt-2 flex items-center gap-2">
          {/* suppressHydrationWarning: a browser extension (form-filler, same
              one noted on <body> in layout.tsx) stamps jf-ext-* attributes onto
              inputs/buttons before hydration — not a real SSR/client mismatch. */}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="w-full min-w-0 rounded-full border border-neutral-300 bg-white px-3.5 py-2 text-sm text-neutral-900 outline-none focus:border-violet-400"
            suppressHydrationWarning
          />
          <button
            type="submit"
            className="shrink-0 rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            suppressHydrationWarning
          >
            Continue
          </button>
        </form>
      ) : (
        <form onSubmit={handleSend} className="mt-2">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span className="truncate">{email}</span>
            <button
              type="button"
              onClick={() => setShowMessage(false)}
              className="shrink-0 pl-2 underline hover:text-neutral-900"
            >
              change
            </button>
          </div>
          <textarea
            required
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            maxLength={MAX_MESSAGE_LENGTH}
            rows={4}
            placeholder="What can we help with?"
            className="mt-2 w-full resize-none rounded-xl border border-neutral-300 bg-white p-3 text-sm text-neutral-900 outline-none focus:border-violet-400"
            suppressHydrationWarning
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[11px] text-neutral-400">
              {message.length}/{MAX_MESSAGE_LENGTH}
            </span>
            <button
              type="submit"
              disabled={status === "submitting" || !message.trim()}
              className="rounded-full bg-neutral-900 px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              suppressHydrationWarning
            >
              {status === "submitting" ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      )}

      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}
