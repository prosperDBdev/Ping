"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AxiosError } from "axios";
import toast, { Toaster } from "react-hot-toast";
import AuthSplitLayout from "@/components/auth/AuthSplitLayout";
import api from "@/lib/api";

/**
 * Choose a new password, using the token from the emailed link.
 *
 * Wrapped in Suspense because useSearchParams reads the URL, which doesn't exist
 * while Next.js pre-renders the page on the server — without a Suspense boundary
 * the production build fails.
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Captured once, then the token is removed from the address bar (below).
  const [token] = useState(() => searchParams.get("token"));
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Strip the token out of the URL as soon as we have it.
   *
   * While it's in the address bar it's also in the browser history, in any
   * screenshot of the page, and in anything that records visited URLs. The token
   * only needs to live in this page's memory until the form is submitted.
   */
  useEffect(() => {
    if (token) window.history.replaceState(null, "", "/auth/reset-password");
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password.length > 72) return setError("Password must be 72 characters or fewer.");
    if (password !== confirm) return setError("The two passwords don't match.");

    setBusy(true);
    try {
      await api.post("/auth/reset-password", { token, newPassword: password });
      toast.success("Password changed. Sign in with your new password.");
      setTimeout(() => router.push("/auth/login"), 1200);
    } catch (err) {
      const status = (err as AxiosError)?.response?.status;
      const message = ((err as AxiosError)?.response?.data as { message?: string })?.message;
      setError(
        status === 429
          ? message ?? "Too many attempts. Please wait a while and try again."
          : message ?? "This reset link is invalid or has expired."
      );
      setBusy(false);
    }
  };

  return (
    <>
      <Toaster position="top-center" />
      <AuthSplitLayout
        eyebrow="Almost there"
        titleLines={[{ text: "A fresh" }, { text: "start", accent: true }, { text: "for your space." }]}
        description="Choose a new password. Once it's changed, you'll be signed out everywhere else."
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-ping-teal mb-3">New password</p>

        {!token ? (
          <div>
            <h2 className="text-3xl font-black text-ping-dark leading-tight mb-3">This link doesn&apos;t work.</h2>
            <p className="text-ping-text-light mb-8">
              Reset links work once and expire after 15 minutes. Request a new one and use it straight away.
            </p>
            <Link
              href="/auth/forgot-password"
              className="inline-block bg-ping-dark text-white px-6 py-3.5 rounded-xl font-semibold hover:bg-ping-dark/90 transition"
            >
              Send a new link
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-3xl font-black text-ping-dark leading-tight mb-2">Choose a new password.</h2>
            <p className="text-ping-text-light mb-8">At least 6 characters.</p>

            <form onSubmit={submit} className="space-y-5">
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-ping-dark mb-2">
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3.5 bg-white border border-ping-sand rounded-xl text-ping-dark focus:outline-none focus:ring-2 focus:ring-ping-teal/30"
                />
              </div>
              <div>
                <label htmlFor="confirm" className="block text-sm font-semibold text-ping-dark mb-2">
                  Confirm new password
                </label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full px-4 py-3.5 bg-white border border-ping-sand rounded-xl text-ping-dark focus:outline-none focus:ring-2 focus:ring-ping-teal/30"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600">
                  {error}{" "}
                  {error.includes("expired") && (
                    <Link href="/auth/forgot-password" className="font-semibold underline">
                      Get a new link
                    </Link>
                  )}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full bg-ping-dark text-white py-4 rounded-xl font-semibold hover:bg-ping-dark/90 transition disabled:opacity-50"
              >
                {busy ? "Saving…" : "Change password"}
              </button>
            </form>
          </>
        )}
      </AuthSplitLayout>
    </>
  );
}
