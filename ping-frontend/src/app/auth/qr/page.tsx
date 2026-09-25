"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import toast from "react-hot-toast";
import AuthSplitLayout from "@/components/auth/AuthSplitLayout";
import useAuthStore, { SignedIn } from "@/store/authStore";
import { pairingLink, pairingSocketUrl } from "@/lib/security";

type Phase = "connecting" | "showing" | "expired" | "denied" | "limited";

/**
 * Sign in on this computer by scanning a QR code with your phone (Stage 14).
 *
 * The page holds a WebSocket open to the server. The server sends a one-time
 * code, which is drawn here as a QR code. When your phone approves it, the
 * server sends this page a login token down the same socket, and you're in.
 * No password is typed on this computer at all.
 */
export default function QrSignInPage() {
  const router = useRouter();
  const completeSignIn = useAuthStore((s) => s.completeSignIn);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [qrImage, setQrImage] = useState<string | null>(null);
  // Changing this opens a fresh socket, for a fresh code.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const socket = new WebSocket(pairingSocketUrl());
    let finished = false;

    socket.onmessage = async (event) => {
      let msg: { type?: string; code?: string } & Partial<SignedIn>;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type === "code" && msg.code) {
        const image = await QRCode.toDataURL(pairingLink(msg.code), {
          width: 280,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#1b2f35", light: "#ffffff" },
        });
        if (!finished) {
          setQrImage(image);
          setPhase("showing");
        }
      } else if (msg.type === "approved" && msg.token && msg.id && msg.username) {
        finished = true;
        completeSignIn({ token: msg.token, id: msg.id, username: msg.username, email: msg.email ?? "" });
        toast.success("Signed in from your phone 👋");
        router.push("/dashboard");
      } else if (msg.type === "denied" || msg.type === "expired") {
        finished = true;
        setQrImage(null);
        setPhase(msg.type);
      }
    };

    socket.onclose = (event) => {
      if (finished) return;
      setQrImage(null);
      setPhase(event.code === 4429 ? "limited" : "expired");
    };

    return () => {
      finished = true;
      socket.close();
    };
  }, [attempt, completeSignIn, router]);

  const newCode = () => {
    setPhase("connecting");
    setAttempt((n) => n + 1);
  };

  return (
    <>
      <AuthSplitLayout
        eyebrow="No password needed"
        titleLines={[{ text: "Point," }, { text: "tap,", accent: true }, { text: "you're in." }]}
        description="Your phone is already signed in to Ping. Let it vouch for this computer."
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-ping-teal mb-3">Sign in with a QR code</p>
        <h2 className="text-3xl font-black text-ping-dark leading-tight mb-6">Scan this with your phone.</h2>

        <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
          <div className="w-[248px] h-[248px] flex-shrink-0 rounded-2xl bg-white border border-ping-sand flex items-center justify-center overflow-hidden">
            {phase === "showing" && qrImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- a generated data: URL, nothing to optimise
              <img src={qrImage} alt="QR code for signing in to Ping" className="w-[232px] h-[232px]" />
            ) : phase === "connecting" ? (
              <div className="w-6 h-6 border-2 border-ping-sand border-t-ping-teal rounded-full animate-spin" />
            ) : (
              <div className="text-center px-5">
                <p className="text-sm font-semibold text-ping-dark mb-1">
                  {phase === "denied"
                    ? "Sign-in was declined on your phone."
                    : phase === "limited"
                      ? "Too many codes. Wait a few minutes."
                      : "This code has expired."}
                </p>
                {phase !== "limited" && (
                  <button onClick={newCode} className="mt-2 text-sm font-bold text-ping-teal hover:underline">
                    Show a new code
                  </button>
                )}
              </div>
            )}
          </div>

          <ol className="text-sm text-ping-dark space-y-3 list-decimal pl-5 marker:font-bold marker:text-ping-teal">
            <li>Open Ping on your phone.</li>
            <li>
              Go to <span className="font-semibold">Settings → Linked devices</span> and tap{" "}
              <span className="font-semibold">Link a device</span>.
            </li>
            <li>Point your phone at this code, then tap Approve.</li>
            <li className="list-none -ml-5 text-xs text-ping-text-light">
              Your phone&apos;s camera app can scan it too. Each code works once and lasts 2 minutes.
            </li>
          </ol>
        </div>

        <p className="mt-8 text-center text-sm text-ping-text-light">
          <Link href="/auth/login" className="text-ping-teal font-semibold hover:underline">
            ← Sign in with your password instead
          </Link>
        </p>
      </AuthSplitLayout>
    </>
  );
}
