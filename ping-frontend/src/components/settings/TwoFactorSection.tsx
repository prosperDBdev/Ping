"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import useAuthStore from "@/store/authStore";
import { CodeChallenge, confirmTwoFactor, disableTwoFactor, startTwoFactor } from "@/lib/security";
import { apiErrorMessage } from "@/lib/messages";

type Step = "idle" | "code" | "password";

/**
 * Two-step verification (Stage 13): when on, signing in needs a code from
 * your email as well as your password.
 *
 * Turning it ON sends a code first, to prove the email actually arrives
 * (otherwise you could lock yourself out). Turning it OFF asks for your
 * password, so someone holding your unlocked phone can't quietly remove it.
 */
export default function TwoFactorSection() {
  const { user, updateProfile } = useAuthStore();
  const enabled = !!user?.twoFactorEnabled;
  const [step, setStep] = useState<Step>("idle");
  const [challenge, setChallenge] = useState<CodeChallenge | null>(null);
  const [value, setValue] = useState("");
  const [working, setWorking] = useState(false);

  const reset = () => {
    setStep("idle");
    setChallenge(null);
    setValue("");
  };

  const begin = async () => {
    setWorking(true);
    try {
      setChallenge(await startTwoFactor());
      setStep("code");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't send a code. Try again."));
    } finally {
      setWorking(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorking(true);
    try {
      if (step === "code" && challenge) {
        await confirmTwoFactor(challenge.challenge, value);
        updateProfile({ twoFactorEnabled: true });
        toast.success("Two-step verification is on");
      } else {
        await disableTwoFactor(value);
        updateProfile({ twoFactorEnabled: false });
        toast.success("Two-step verification is off");
      }
      reset();
    } catch (err) {
      toast.error(apiErrorMessage(err, "That didn't work. Try again."));
      setValue("");
      // 410: the code is used up or expired; start over for a fresh one.
      if ((err as { response?: { status?: number } }).response?.status === 410) reset();
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="bg-white dark:bg-ping-night-card rounded-3xl border border-ping-sand/60 dark:border-ping-night-border p-5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ping-text-light dark:text-ping-night-text-light">
          Two-step verification
        </p>
        <span
          className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
            enabled
              ? "bg-ping-teal/10 text-ping-teal dark:text-ping-teal-light"
              : "bg-ping-cream dark:bg-ping-night-surface text-ping-text-light dark:text-ping-night-text-light"
          }`}
        >
          {enabled ? "On" : "Off"}
        </span>
      </div>
      <p className="text-xs text-ping-text-light dark:text-ping-night-text-light mb-4 leading-relaxed">
        {enabled
          ? "Signing in needs your password and a code we email you. Someone who learns your password still can't get in."
          : "Ask for a code from your email as well as your password when you sign in on a new device."}
      </p>

      {step === "idle" ? (
        <button
          onClick={() => (enabled ? setStep("password") : void begin())}
          disabled={working}
          className={`w-full py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50 ${
            enabled
              ? "border border-ping-sand dark:border-ping-night-border text-ping-dark dark:text-ping-night-text hover:bg-ping-cream dark:hover:bg-ping-night-surface"
              : "bg-ping-dark text-white hover:bg-ping-dark/90"
          }`}
        >
          {enabled ? "Turn off" : working ? "Sending a code…" : "Turn on"}
        </button>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <label htmlFor="two-factor-input" className="block text-xs font-semibold text-ping-dark dark:text-ping-night-text">
            {step === "code"
              ? `Enter the 6-digit code we sent to ${challenge?.emailHint ?? "your email"}`
              : "Enter your password to turn it off"}
          </label>
          <input
            id="two-factor-input"
            type={step === "password" ? "password" : "text"}
            value={value}
            onChange={(e) => setValue(step === "code" ? e.target.value.replace(/\D/g, "").slice(0, 6) : e.target.value)}
            inputMode={step === "code" ? "numeric" : undefined}
            autoComplete={step === "code" ? "one-time-code" : "current-password"}
            autoFocus
            className="w-full px-3.5 py-2.5 bg-ping-cream dark:bg-ping-night-surface border border-ping-sand dark:border-ping-night-border rounded-xl text-sm text-ping-dark dark:text-ping-night-text focus:outline-none focus:ring-2 focus:ring-ping-teal/30 transition"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="flex-1 py-2.5 rounded-xl border border-ping-sand dark:border-ping-night-border text-sm font-semibold text-ping-dark dark:text-ping-night-text hover:bg-ping-cream dark:hover:bg-ping-night-surface transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={working || (step === "code" ? value.length !== 6 : !value)}
              className="flex-1 py-2.5 rounded-xl bg-ping-dark text-white text-sm font-semibold hover:bg-ping-dark/90 transition disabled:opacity-50"
            >
              {working ? "Checking…" : step === "code" ? "Turn on" : "Turn off"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
