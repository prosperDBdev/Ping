"use client";

import { useEffect } from "react";

interface ConfirmDialogProps {
  title: string;
  body: string;
  confirmLabel: string;
  /** Destructive actions get a red button — the colour is the warning. */
  destructive?: boolean;
  isWorking?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation step for actions that are hard or impossible to undo.
 *
 * Deliberately generic: blocking, clearing a chat and removing a group member
 * are all "are you sure?" moments, and having one dialog means the wording is
 * the only thing that differs between them.
 */
export default function ConfirmDialog({
  title,
  body,
  confirmLabel,
  destructive = false,
  isWorking = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isWorking) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, isWorking]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-ping-night-card rounded-3xl w-full max-w-sm p-6 shadow-xl">
        <h3 className="text-base font-black text-ping-dark dark:text-ping-night-text mb-2">
          {title}
        </h3>
        <p className="text-sm text-ping-text-light dark:text-ping-night-text-light leading-relaxed mb-6">
          {body}
        </p>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={isWorking}
            className="flex-1 py-2.5 rounded-xl border border-ping-sand dark:border-ping-night-border text-ping-dark dark:text-ping-night-text text-sm font-semibold hover:bg-ping-cream dark:hover:bg-ping-night-card-active transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isWorking}
            className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition disabled:opacity-50 ${
              destructive ? "bg-red-500 hover:bg-red-600" : "bg-ping-orange hover:bg-ping-orange-light"
            }`}
          >
            {isWorking ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin align-middle" />
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
