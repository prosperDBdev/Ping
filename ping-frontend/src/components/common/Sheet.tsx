"use client";

import { useEffect, useState } from "react";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClass?: string;
}

/**
 * Shared overlay shell: a centered modal on desktop, a bottom sheet on
 * mobile. Used for every "create/edit X" and detail surface in the
 * workspace so those flows feel consistent everywhere they appear.
 */
export default function Sheet({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  widthClass = "sm:max-w-lg",
}: SheetProps) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!open) {
      const raf = requestAnimationFrame(() => setEntered(false));
      return () => cancelAnimationFrame(raf);
    }
    const raf = requestAnimationFrame(() => setEntered(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className={`absolute inset-0 bg-ping-dark/40 dark:bg-black/60 transition-opacity duration-200 ${
          entered ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full ${widthClass} bg-ping-cream dark:bg-ping-night-surface rounded-t-3xl sm:rounded-3xl shadow-xl border border-ping-sand/60 dark:border-ping-night-border max-h-[88vh] flex flex-col transition-all duration-200 ${
          entered
            ? "translate-y-0 opacity-100"
            : "translate-y-6 sm:translate-y-2 opacity-0"
        }`}
      >
        <div className="flex items-start justify-between px-6 pt-6 pb-4 flex-shrink-0 border-b border-ping-sand/60 dark:border-ping-night-border">
          <div>
            {eyebrow && (
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ping-teal dark:text-ping-teal-light mb-1">
                {eyebrow}
              </p>
            )}
            <h2 className="text-xl font-black text-ping-dark dark:text-ping-night-text">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center text-ping-text-light dark:text-ping-night-text-light hover:bg-ping-cream-dark dark:hover:bg-ping-night-card transition flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5">{children}</div>

        {footer && (
          <div className="px-6 py-4 border-t border-ping-sand/60 dark:border-ping-night-border flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
