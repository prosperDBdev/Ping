"use client";

import { useEffect } from "react";

/**
 * The iOS install walkthrough.
 *
 * This component exists because of a platform limitation, not a design choice.
 * iOS has no equivalent of Chrome's install prompt — there is no API a page can
 * call to add itself to the home screen, by design. The only route is the user
 * doing it themselves through the Share menu, so the best a site can do is tell
 * them exactly where to tap.
 *
 * The steps are numbered and name the real menu items, because "install the
 * app" is not an instruction anyone can follow on iOS.
 */
export default function IosInstallSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Add Ping to your Home Screen"
    >
      <div
        className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-base font-black text-[#1b2f35]">Add Ping to your Home Screen</h2>
            <p className="text-xs text-[#738086] mt-1">
              Three taps, and it opens like any other app — no App Store needed.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-[#738086] hover:text-[#1b2f35] flex-shrink-0 -mt-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <ol className="space-y-4">
          <Step n={1}>
            Tap the <strong>Share</strong> button at the bottom of Safari — the square with an
            arrow pointing up.
            <ShareGlyph />
          </Step>
          <Step n={2}>
            Scroll down the list and tap <strong>Add to Home Screen</strong>.
          </Step>
          <Step n={3}>
            Tap <strong>Add</strong>. Ping appears on your home screen.
          </Step>
        </ol>

        <p className="mt-5 text-[11px] leading-relaxed text-[#738086]">
          If you don&apos;t see &quot;Add to Home Screen&quot;, you&apos;re probably in a browser
          that can&apos;t do it — open this page in <strong>Safari</strong> and try again.
        </p>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-full bg-[#e0684b] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#d2593d]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#ece4d8] text-[#1b2f35] text-xs font-bold grid place-items-center">
        {n}
      </span>
      <span className="text-sm text-[#1b2f35] leading-relaxed">{children}</span>
    </li>
  );
}

/** The iOS share icon, drawn rather than described — it's what they're hunting for. */
function ShareGlyph() {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 align-middle ml-1.5 rounded-md bg-[#f4efe8]">
      <svg className="w-3.5 h-3.5 text-[#007aff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v13M12 3L8 7M12 3l4 4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
      </svg>
    </span>
  );
}
