"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { signup } from "@/lib/auth/client";
import { sanitizeRedirect } from "@/lib/auth/redirect";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = sanitizeRedirect(searchParams.get("redirect"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      await signup(email, password, confirmPassword);
      router.push(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong, try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px]">
        <div className="absolute left-1/2 top-[-260px] h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-br from-violet-600/25 via-fuchsia-500/15 to-cyan-500/20 blur-[110px]" />
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-2xl backdrop-blur">
        <Link href="/" className="mb-6 inline-block">
          <Image src="/logo/bloop-wordmark-white.png" alt="Bloop Studio" width={951} height={408} className="h-6 w-auto" />
        </Link>
        <h1 className="text-xl font-semibold text-white">Sign up</h1>
        <p className="mt-1 text-sm text-neutral-500">Create an account to export your videos.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            required
          />
          <Field
            label="Confirm password"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            required
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Creating account…" : "Sign up"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-neutral-500">
          Already have an account?{" "}
          <Link
            href={`/login?redirect=${encodeURIComponent(redirectTo)}`}
            className="font-medium text-violet-300 hover:text-violet-200"
          >
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  required,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-neutral-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
      />
    </label>
  );
}
