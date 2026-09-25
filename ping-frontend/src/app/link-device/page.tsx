"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import ProtectedRoute from "@/components/common/ProtectedRoute";
import PingLogo from "@/components/common/PingLogo";
import { approvePairing, denyPairing, isPairingCode, lookupPairing } from "@/lib/security";
import { apiErrorMessage } from "@/lib/messages";

type Phase = "checking" | "ask" | "working" | "approved" | "denied" | "invalid";

/**
 * The phone's side of QR sign-in (Stage 14): "Sign in on Chrome on Windows?"
 *
 * Reached by scanning a computer's QR code, either from Settings → Linked
 * devices, or with the phone's own camera app (the QR is a link to here). The
 * code is in the part after "#", which browsers never send to a server.
 */
function LinkDevice() {
  const router = useRouter();
  // Read once. This component only ever renders in the browser (ProtectedRoute
  // shows a spinner until the sign-in check has run), so window exists here.
  const [code] = useState(() => window.location.hash.slice(1));
  const [phase, setPhase] = useState<Phase>(() => (isPairingCode(code) ? "checking" : "invalid"));
  const [deviceName, setDeviceName] = useState("");
  const [problem, setProblem] = useState("");

  useEffect(() => {
    // Take the code out of the address bar, so it isn't left in history.
    window.history.replaceState(null, "", window.location.pathname);
    if (!isPairingCode(code)) return;
    lookupPairing(code)
      .then((name) => {
        setDeviceName(name);
        setPhase("ask");
      })
      .catch((err) => {
        setProblem(apiErrorMessage(err, "This QR code isn't valid any more."));
        setPhase("invalid");
      });
  }, [code]);

  const approve = async () => {
    setPhase("working");
    try {
      await approvePairing(code);
      setPhase("approved");
    } catch (err) {
      setProblem(apiErrorMessage(err, "That didn't work. Show a new code on the computer and try again."));
      setPhase("invalid");
    }
  };

  const deny = async () => {
    setPhase("working");
    await denyPairing(code).catch(() => {});
    setPhase("denied");
    toast("Declined. Nobody was signed in.");
  };

  return (
    <div className="min-h-dvh bg-ping-cream dark:bg-ping-night-bg flex flex-col items-center px-4 py-8">
      <PingLogo />
      <div className="w-full max-w-sm mt-10 bg-white dark:bg-ping-night-card rounded-3xl border border-ping-sand/60 dark:border-ping-night-border p-6">
        {phase === "checking" || phase === "working" ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-ping-sand border-t-ping-teal rounded-full animate-spin" />
          </div>
        ) : phase === "ask" ? (
          <>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ping-teal mb-2">Link a device</p>
            <h1 className="text-2xl font-black text-ping-dark dark:text-ping-night-text leading-tight mb-2">
              Sign in on {deviceName}?
            </h1>
            <p className="text-sm text-ping-text-light dark:text-ping-night-text-light mb-4">
              It will have full access to your account: your chats, your contacts, everything.
            </p>
            {/* The defence against someone else's QR code: say plainly when
                NOT to approve, at the moment of deciding. */}
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300/70 dark:border-amber-400/30 p-3.5 mb-5 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
              <p className="font-bold mb-1">Only approve a computer that&apos;s in front of you right now.</p>
              If someone sent you this code, or you scanned it anywhere else, tap <b>Not me</b>. Scanning a
              stranger&apos;s code would sign <i>them</i> in as you.
            </div>
            <div className="space-y-2">
              <button
                onClick={() => void approve()}
                className="w-full py-3 rounded-xl bg-ping-dark text-white font-semibold hover:bg-ping-dark/90 transition"
              >
                Approve
              </button>
              <button
                onClick={() => void deny()}
                className="w-full py-3 rounded-xl border border-ping-sand dark:border-ping-night-border text-ping-dark dark:text-ping-night-text font-semibold hover:bg-ping-cream dark:hover:bg-ping-night-surface transition"
              >
                Not me
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-3xl mb-3">{phase === "approved" ? "✅" : phase === "denied" ? "🛑" : "⌛"}</p>
            <h1 className="text-lg font-bold text-ping-dark dark:text-ping-night-text mb-1">
              {phase === "approved"
                ? `${deviceName} is signed in`
                : phase === "denied"
                  ? "Declined"
                  : "This code can't be used"}
            </h1>
            <p className="text-sm text-ping-text-light dark:text-ping-night-text-light mb-5">
              {phase === "approved"
                ? "You can see it, and sign it out, in Settings → Linked devices."
                : phase === "denied"
                  ? "Nobody was signed in."
                  : problem || "That isn't a Ping sign-in code."}
            </p>
            <button
              onClick={() => router.push("/settings")}
              className="text-sm font-bold text-ping-teal dark:text-ping-teal-light hover:underline"
            >
              Go to Settings
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LinkDevicePage() {
  return (
    <ProtectedRoute>
      <LinkDevice />
    </ProtectedRoute>
  );
}
