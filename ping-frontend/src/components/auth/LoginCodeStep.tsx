"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import useAuthStore from "@/store/authStore";
import { resendLoginCode } from "@/lib/security";
import { apiErrorMessage } from "@/lib/messages";

interface LoginCodeStepProps {
  challenge: string;
  emailHint: string;
  onSignedIn: () => void;
  /** The pending sign-in is over (expired, used up): go back to the password. */
  onStartAgain: () => void;
}

/**
 * The second step of a two-step sign-in (Stage 13): the 6-digit code that was
 * just emailed. The password was already right; without this code there is
 * still no token.
 */
export default function LoginCodeStep({ challenge, emailHint, onSignedIn, onStartAgain }: LoginCodeStepProps) {
  const { verifyLoginCode, isLoading } = useAuthStore();
  const [code, setCode] = useState("");
  const [resending, setResending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await verifyLoginCode(challenge, code);
      onSignedIn();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That code didn't work");
      if ((err as { expired?: boolean }).expired) onStartAgain();
      else setCode("");
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      await resendLoginCode(challenge);
      toast.success("New code sent. The old one no longer works.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't send a new code"));
    } finally {
      setResending(false);
    }
  };

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-ping-teal mb-3">Two-step verification</p>
      <h2 className="text-3xl font-black text-ping-dark leading-tight mb-2">Check your email.</h2>
      <p className="text-ping-text-light mb-8">
        We sent a 6-digit code to <span className="font-semibold text-ping-dark">{emailHint}</span>. It expires in
        10 minutes.
      </p>

      <form onSubmit={submit} className="space-y-5">
        <div>
          <label htmlFor="login-code" className="block text-sm font-semibold text-ping-dark mb-2">
            Code
          </label>
          {/* one-time-code lets phones offer the code from the email or an SMS
              straight from the keyboard; numeric brings up the number pad. */}
          <input
            id="login-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="000000"
            className="w-full px-4 py-3.5 bg-ping-cream border border-ping-sand rounded-xl text-2xl font-bold tracking-[0.5em] text-center text-ping-dark placeholder-ping-text-light/30 focus:outline-none focus:ring-2 focus:ring-ping-teal/30 focus:border-ping-teal transition"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || code.length !== 6}
          className="w-full bg-ping-dark text-white py-4 rounded-xl font-semibold hover:bg-ping-dark/90 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Verify and sign in <span>→</span>
            </>
          )}
        </button>
      </form>

      <div className="mt-6 flex items-center justify-between text-sm">
        <button type="button" onClick={onStartAgain} className="text-ping-text-light hover:text-ping-dark font-medium">
          ← Back
        </button>
        <button
          type="button"
          onClick={() => void resend()}
          disabled={resending}
          className="text-ping-teal font-semibold hover:underline disabled:opacity-50"
        >
          {resending ? "Sending…" : "Send a new code"}
        </button>
      </div>
    </div>
  );
}
