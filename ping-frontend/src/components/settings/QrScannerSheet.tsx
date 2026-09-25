"use client";

import { useEffect, useRef, useState } from "react";
import Sheet from "@/components/common/Sheet";
import { codeFromScan } from "@/lib/security";

interface QrScannerSheetProps {
  open: boolean;
  onClose: () => void;
  /** A Ping sign-in code was found. */
  onCode: (code: string) => void;
}

// Chrome and Android have a built-in QR reader; declared here because
// TypeScript's DOM types don't include it yet.
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike;
  }
}

/**
 * The camera view for "Link a device" (Stage 14).
 *
 * Uses the browser's built-in barcode reader where there is one (Chrome,
 * Android), and otherwise a small JavaScript QR decoder (jsQR), loaded only
 * when this opens so nobody else downloads it. Nothing leaves the phone: the
 * frames are read locally, and only a recognised Ping code is acted on.
 */
export default function QrScannerSheet({ open, onClose, onCode }: QrScannerSheetProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState("");
  const [wrongCode, setWrongCode] = useState(false);

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setProblem("This browser can't use the camera. Scan the code with your phone's camera app instead.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch {
        setProblem("Ping needs the camera to scan. Allow it in your browser settings, or use your camera app.");
        return;
      }
      if (stopped || !videoRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play().catch(() => {});

      const detector = window.BarcodeDetector ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
      const jsQR = detector ? null : (await import("jsqr")).default;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      timer = setInterval(async () => {
        if (stopped || video.readyState < 2) return;
        let text: string | null = null;
        if (detector) {
          const found = await detector.detect(video).catch(() => []);
          text = found[0]?.rawValue ?? null;
        } else if (jsQR && ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          text = jsQR(frame.data, frame.width, frame.height)?.data ?? null;
        }
        if (!text) return;
        const code = codeFromScan(text);
        if (code) {
          stopped = true;
          onCode(code);
        } else {
          setWrongCode(true);
        }
      }, 250);
    };

    void start();
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
      setProblem("");
      setWrongCode(false);
    };
  }, [open, onCode]);

  return (
    <Sheet open={open} onClose={onClose} title="Link a device" widthClass="sm:max-w-sm">
      <p className="text-sm text-ping-text-light dark:text-ping-night-text-light mb-4">
        On the computer, open Ping and choose <b>Sign in with a QR code</b>. Then point your phone at the code.
      </p>
      {problem ? (
        <p className="rounded-2xl bg-ping-cream dark:bg-ping-night-surface p-4 text-sm text-ping-dark dark:text-ping-night-text">
          {problem}
        </p>
      ) : (
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
          <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
          {/* A frame to aim with */}
          <div className="absolute inset-[18%] border-2 border-white/80 rounded-2xl pointer-events-none" />
        </div>
      )}
      {wrongCode && !problem && (
        <p className="mt-3 text-xs text-center text-red-500">That QR code isn&apos;t a Ping sign-in code.</p>
      )}
    </Sheet>
  );
}
