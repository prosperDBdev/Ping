"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { ensurePushSubscription } from "@/lib/push";
import { apiErrorMessage } from "@/lib/messages";

/**
 * "Make Ping notifications pop up like WhatsApp's."
 *
 * Whether a notification drops down over the top of the screen (a "heads-up"
 * notification) or goes quietly into the notification shade is decided by
 * Android, per app, in the phone's settings. WhatsApp is a native app and
 * marks its messages urgent itself. A website can't: Chrome creates Ping's
 * notification channel, and only the phone's owner can switch it to "Pop on
 * screen". So this does the two things an app CAN do: send a test, so you can
 * see exactly how they behave, and show the steps for your setup.
 */
export default function NotificationPopupHelp() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [open, setOpen] = useState(false);

  // Read once; these don't change while the page is open.
  const [isAndroid] = useState(() => typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent));
  const [installed] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches
  );

  const sendTest = async () => {
    setSending(true);
    try {
      await ensurePushSubscription();
      const res = await api.post("/push/test");
      const { enabled, devices } = res.data as { enabled: boolean; devices: number };
      if (!enabled) {
        toast.error("Notifications aren't switched on for Ping's server yet.");
      } else if (devices === 0) {
        toast.error("This device isn't set up for notifications yet. Allow notifications, then try again.");
      } else {
        setSent(true);
        setOpen(true);
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't send a test. Try again."));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-3 rounded-2xl border border-ping-sand/60 dark:border-ping-night-border bg-white dark:bg-ping-night-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ping-dark dark:text-ping-night-text">Pop-up notifications</p>
          <p className="text-xs text-ping-text-light dark:text-ping-night-text-light">
            {sent
              ? "Sent. Did it drop down over the top of your screen?"
              : "See how Ping's notifications appear on this device."}
          </p>
        </div>
        <button
          onClick={() => void sendTest()}
          disabled={sending}
          className="px-3.5 py-2 rounded-xl bg-ping-dark text-white text-xs font-semibold hover:bg-ping-dark/90 transition flex-shrink-0 disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send a test"}
        </button>
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-3 text-xs font-bold text-ping-teal dark:text-ping-teal-light hover:underline"
      >
        {open ? "Hide" : "Only showing in the notification shade?"} {open ? "▲" : "▼"}
      </button>

      {open && (
        <div className="mt-3 text-xs leading-relaxed text-ping-dark dark:text-ping-night-text space-y-2">
          <p className="text-ping-text-light dark:text-ping-night-text-light">
            Your phone decides whether notifications pop up over the screen. Apps like WhatsApp switch this on for
            themselves; for Ping it&apos;s one setting you turn on once:
          </p>
          {isAndroid && installed ? (
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open your phone&apos;s <b>Settings → Apps → Ping</b>.</li>
              <li>Tap <b>Notifications</b>, then the notification category (often <b>ping.ebitimi.dev</b> or <b>General</b>).</li>
              <li>Turn on <b>Pop on screen</b> and choose <b>Alerting</b> or <b>Default</b> with sound.</li>
            </ol>
          ) : isAndroid ? (
            <>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Open your phone&apos;s <b>Settings → Apps → Chrome → Notifications</b>.</li>
                <li>Find <b>ping.ebitimi.dev</b> (it may be under <b>Sites</b>) and tap it.</li>
                <li>Turn on <b>Pop on screen</b> and choose <b>Alerting</b> with sound.</li>
              </ol>
              <p className="text-ping-text-light dark:text-ping-night-text-light">
                Tip: install Ping (&ldquo;Download app&rdquo; / &ldquo;Add to Home screen&rdquo;). It then gets its own
                entry in your phone&apos;s Apps list with its own notification settings, just like WhatsApp.
              </p>
            </>
          ) : (
            <p>
              On an iPhone, add Ping to your Home Screen first (Share → Add to Home Screen), then allow notifications
              and set <b>Banner style: Temporary</b> for Ping in Settings → Notifications. On a computer,
              check your system&apos;s notification settings for your browser.
            </p>
          )}
          <p className="text-ping-text-light dark:text-ping-night-text-light">
            On Samsung phones the option is called <b>Pop-up notification style</b> (set it to <b>Brief</b>); on
            Xiaomi, <b>Floating notifications</b>.
          </p>
        </div>
      )}
    </div>
  );
}
