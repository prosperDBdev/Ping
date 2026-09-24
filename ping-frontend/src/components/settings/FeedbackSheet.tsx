"use client";

import { useEffect, useRef, useState } from "react";
import { AxiosError } from "axios";
import Sheet from "@/components/common/Sheet";
import {
  FEEDBACK_TYPES,
  FeedbackType,
  MAX_FEEDBACK_LENGTH,
  sendFeedback,
} from "@/lib/feedback";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/media";

interface FeedbackSheetProps {
  open: boolean;
  onClose: () => void;
}

type Status = "idle" | "sending" | "sent";

/** The chosen file and the local preview URL made from it, which share a lifetime. */
interface PickedScreenshot {
  file: File;
  previewUrl: string;
}

export default function FeedbackSheet({ open, onClose }: FeedbackSheetProps) {
  const [type, setType] = useState<FeedbackType>("BUG_REPORT");
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<PickedScreenshot | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mirrors the current preview URL so the unmount cleanup below can revoke it
  // without needing the effect to depend on (and re-run for) every selection.
  const previewRef = useRef<string | null>(null);

  /**
   * The object URL is created and destroyed at the moment the selection
   * changes, rather than in an effect that watches the file. An effect would
   * have to setState in its body to publish the URL, which costs an extra
   * render pass on every pick; doing it here keeps one owner for the URL and
   * one place it gets revoked.
   */
  const choose = (next: File | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);

    if (!next) {
      previewRef.current = null;
      setScreenshot(null);
      return;
    }

    const previewUrl = URL.createObjectURL(next);
    previewRef.current = previewUrl;
    setScreenshot({ file: next, previewUrl });
  };

  // Mount-only: if the sheet disappears while a preview is on screen, the URL
  // would otherwise keep its bytes alive for the rest of the session.
  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    };
  }, []);

  const clearFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const reset = () => {
    setType("BUG_REPORT");
    setMessage("");
    choose(null);
    setError(null);
    setStatus("idle");
    clearFileInput();
  };

  const close = () => {
    reset();
    onClose();
  };

  const pickScreenshot = (file: File | undefined) => {
    setError(null);
    if (!file) return;

    // Both checks exist on the server too. These are here only so the person
    // finds out now rather than after uploading.
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError("Screenshots need to be a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("That image is larger than 10MB.");
      return;
    }

    choose(file);
  };

  const submit = async () => {
    if (!message.trim()) {
      setError("Please tell us a little about it first.");
      return;
    }

    setStatus("sending");
    setError(null);

    try {
      await sendFeedback({ type, message: message.trim(), screenshot: screenshot?.file ?? null });
      // Only reached if the server confirmed the email was accepted.
      setStatus("sent");
      setMessage("");
      choose(null);
      clearFileInput();
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>;
      // The server's message is already written for a person and already
      // stripped of anything internal — show it as-is, with a fallback for
      // the case where the request never arrived at all.
      setError(
        axiosError.response?.data?.message ||
          "We couldn't send that just now. Please try again in a moment."
      );
      setStatus("idle");
    }
  };

  const sending = status === "sending";

  return (
    <Sheet open={open} onClose={close} eyebrow="Help us improve" title="Send feedback">
      {status === "sent" ? (
        <div className="text-center py-6">
          <div className="w-14 h-14 rounded-full bg-ping-green/15 text-ping-green flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <p className="font-bold text-ping-dark dark:text-ping-night-text mb-1">
            Thanks for your feedback!
          </p>
          <p className="text-sm text-ping-text-light dark:text-ping-night-text-light mb-6">
            It went straight to the person who builds Ping.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setStatus("idle")}
              className="flex-1 py-2.5 rounded-xl border border-ping-sand dark:border-ping-night-border text-sm font-semibold text-ping-dark dark:text-ping-night-text hover:bg-white dark:hover:bg-ping-night-card transition"
            >
              Send another
            </button>
            <button
              onClick={close}
              className="flex-1 py-2.5 rounded-xl bg-ping-dark text-white text-sm font-semibold hover:bg-ping-dark/90 transition"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold text-ping-dark dark:text-ping-night-text mb-2">
              What kind of feedback is this?
            </p>
            <div className="space-y-2">
              {FEEDBACK_TYPES.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setType(option.value)}
                  disabled={sending}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition disabled:opacity-60 ${
                    type === option.value
                      ? "border-ping-teal bg-ping-teal/10 dark:bg-ping-teal-light/10"
                      : "border-ping-sand dark:border-ping-night-border hover:bg-ping-cream-dark dark:hover:bg-ping-night-card"
                  }`}
                >
                  <p className="text-sm font-semibold text-ping-dark dark:text-ping-night-text">
                    {option.label}
                  </p>
                  <p className="text-xs text-ping-text-light dark:text-ping-night-text-light">
                    {option.hint}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="feedback-message"
              className="block text-xs font-semibold text-ping-dark dark:text-ping-night-text mb-1.5"
            >
              Tell us more
            </label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={MAX_FEEDBACK_LENGTH}
              rows={5}
              disabled={sending}
              placeholder="What happened, or what would you like to see?"
              className="w-full px-3.5 py-2.5 bg-ping-cream dark:bg-ping-night-surface border border-ping-sand dark:border-ping-night-border rounded-xl text-sm text-ping-dark dark:text-ping-night-text resize-none focus:outline-none focus:ring-2 focus:ring-ping-teal/30 transition disabled:opacity-60"
            />
            <p className="text-[11px] text-ping-text-light dark:text-ping-night-text-light mt-1 text-right">
              {message.length}/{MAX_FEEDBACK_LENGTH}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-ping-dark dark:text-ping-night-text mb-2">
              Screenshot{" "}
              <span className="font-normal text-ping-text-light dark:text-ping-night-text-light">
                (optional)
              </span>
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              onChange={(e) => pickScreenshot(e.target.files?.[0])}
              className="hidden"
            />

            {screenshot ? (
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={screenshot.previewUrl}
                  alt="Screenshot to send"
                  className="max-h-40 rounded-xl border border-ping-sand dark:border-ping-night-border"
                />
                <button
                  onClick={() => {
                    choose(null);
                    clearFileInput();
                  }}
                  disabled={sending}
                  aria-label="Remove screenshot"
                  className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-ping-dark text-white flex items-center justify-center shadow-md hover:bg-ping-dark/90 transition disabled:opacity-60"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
                className="w-full py-3 rounded-xl border border-dashed border-ping-sand dark:border-ping-night-border text-sm font-semibold text-ping-text-light dark:text-ping-night-text-light hover:bg-ping-cream-dark dark:hover:bg-ping-night-card transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M18 14.25h.008v.008H18v-.008z" />
                </svg>
                Attach a screenshot
              </button>
            )}
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-500 font-medium">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={close}
              disabled={sending}
              className="flex-1 py-2.5 rounded-xl border border-ping-sand dark:border-ping-night-border text-sm font-semibold text-ping-dark dark:text-ping-night-text hover:bg-white dark:hover:bg-ping-night-card transition disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={sending || !message.trim()}
              className="flex-1 py-2.5 rounded-xl bg-ping-dark text-white text-sm font-semibold hover:bg-ping-dark/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sending && (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              )}
              {sending ? "Sending…" : "Send feedback"}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
