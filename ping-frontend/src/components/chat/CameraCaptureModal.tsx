"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface CameraCaptureModalProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

/**
 * Takes a photo from the device camera.
 *
 * This exists because the `capture` attribute on a file input is only a hint
 * to MOBILE browsers — on desktop it's ignored entirely and you just get the
 * ordinary file picker again, which is exactly the "camera button doesn't open
 * my camera" behaviour. getUserMedia works on both, so this replaces that
 * approach rather than sitting alongside it.
 */
export default function CameraCaptureModal({ onCapture, onClose }: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        // The permission prompt can outlive the modal. Without this the
        // camera light would stay on with no UI attached to it.
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsReady(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : "";
        setError(
          name === "NotAllowedError"
            ? "Camera permission was denied."
            : name === "NotFoundError"
            ? "No camera found on this device."
            : "Couldn't start the camera."
        );
      });

    return () => {
      cancelled = true;
      // Releasing every track is what actually turns the camera light off.
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const handleShoot = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    // Draw the current video frame to a canvas, then export it as a real
    // File so it flows through exactly the same upload path as a picked
    // photo — nothing downstream needs to know where the image came from.
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92
    );
  }, [onCapture]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-ping-night-card rounded-3xl overflow-hidden w-full max-w-3xl lg:max-w-4xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-ping-sand/60 dark:border-ping-night-border">
          <p className="text-sm font-bold text-ping-dark dark:text-ping-night-text">Take a photo</p>
          <button
            onClick={onClose}
            aria-label="Close camera"
            className="w-8 h-8 rounded-full flex items-center justify-center text-ping-text-light dark:text-ping-night-text-light hover:bg-ping-cream-dark dark:hover:bg-ping-night-card-active transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Capped against the viewport as well as the aspect ratio, so the
            frame gets as large as the screen allows without the shutter
            button being pushed off the bottom on a short window. */}
        <div className="bg-black aspect-video max-h-[70vh] flex items-center justify-center">
          {error ? (
            <p className="text-white/70 text-sm px-6 text-center">{error}</p>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          )}
        </div>

        <div className="px-5 py-4 flex justify-center">
          <button
            onClick={handleShoot}
            disabled={!isReady || !!error}
            aria-label="Capture photo"
            className="w-14 h-14 rounded-full bg-ping-orange hover:bg-ping-orange-light disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center ring-4 ring-ping-orange/20"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
