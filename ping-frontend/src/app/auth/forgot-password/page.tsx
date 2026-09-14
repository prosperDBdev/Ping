"use client";

import { useState } from "react";
import Link from "next/link";
import { AxiosError } from "axios";
import AuthSplitLayout from "@/components/auth/AuthSplitLayout";
import api from "@/lib/api";

/**
 * Ask for a password reset link.
 *
 * The confirmation says the same thing whether or not the email has an account.
 * That's on purpose — a page that says "no account with that email" can be used
 * to check which emails are registered on Ping. The server behaves the same way.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/auth/forgot-password", { email: email.trim() });
      setSent(true);
    } catch (err) {
      const status = (err as AxiosError)?.response?.status;
      const message = ((err as AxiosError)?.response?.data as { message?: string })?.message;
      setError(
        status === 429
          ? message ?? "Too many requests. Please wait a while and try again."
          : status === 400
          ? message ?? "Enter a valid email address."
          : "Something went wrong. Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthSplitLayout
      eyebrow="It happens to everyone"
      titleLines={[{ text: "Let's get" }, { text: "you back", accent: true }, { text: "in." }]}
      description="We'll email you a link to choose a new password. It works once and expires after 15 minutes."
    >
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-ping-teal mb-3">Forgot password</p>

      {sent ? (
        <div>
          <h2 className="text-3xl font-black text-ping-dark leading-tight mb-3">Check your inbox.</h2>
          <p className="text-ping-text-light mb-6">
            If an account exists for <span className="font-semibold text-ping-dark">{email.trim()}</span>, we&apos;ve
            sent a link to reset your password. It expires in 15 minutes.
          </p>
          <p className="text-sm text-ping-text-light mb-8">
            Nothing arrived? Check your spam folder, or wait a minute and try again.
          </p>
          <Link href="/auth/login" className="text-ping-teal text-sm font-semibold hover:underline">
            ← Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <h2 className="text-3xl font-black text-ping-dark leading-tight mb-2">Reset your password.</h2>
          <p className="text-ping-text-light mb-8">Enter the email you signed up with.</p>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-ping-dark mb-2">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 bg-white border border-ping-sand rounded-xl text-ping-dark placeholder-ping-text-light/60 focus:outline-none focus:ring-2 focus:ring-ping-teal/30"
                placeholder="you@example.com"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-ping-dark text-white py-4 rounded-xl font-semibold hover:bg-ping-dark/90 transition disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>

            <p className="text-center text-sm text-ping-text-light">
              Remembered it?{" "}
              <Link href="/auth/login" className="text-ping-teal font-semibold hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </>
      )}
    </AuthSplitLayout>
  );
}
