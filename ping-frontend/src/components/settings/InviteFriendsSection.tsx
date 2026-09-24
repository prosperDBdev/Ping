"use client";

import { useEffect, useState } from "react";
import { AxiosError } from "axios";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { MyInvite, createNewInvite, getMyInvite, inviteUrl } from "@/lib/invites";

/** A MyInvite plus the days remaining, worked out once when it arrives. */
type Loaded = MyInvite & { daysLeft: number | null };

/**
 * Computed when the data arrives, not while rendering. Reading the clock
 * during render makes a component's output depend on WHEN it happens to
 * render, which React treats as a bug.
 */
function withDaysLeft(invite: MyInvite): Loaded {
  if (!invite.expiresAt) return { ...invite, daysLeft: null };
  const ms = new Date(invite.expiresAt).getTime() - Date.now();
  return { ...invite, daysLeft: Math.max(0, Math.ceil(ms / 86_400_000)) };
}

export default function InviteFriendsSection() {
  const [invite, setInvite] = useState<Loaded | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMyInvite()
      .then((i) => {
        if (!cancelled) setInvite(withDaysLeft(i));
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const url = invite?.code ? inviteUrl(invite.code) : null;

  const makeLink = async () => {
    setBusy(true);
    setError(null);
    try {
      setInvite(withDaysLeft(await createNewInvite()));
    } catch (err) {
      const e = err as AxiosError<{ message?: string }>;
      setError(e.response?.data?.message || "Couldn't make a link just now. Please try again.");
    } finally {
      setBusy(false);
      setConfirmReplace(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy. Select the link and copy it yourself.");
    }
  };

  // The phone's own share sheet (WhatsApp, SMS…) where it exists; copying
  // everywhere else.
  const share = async () => {
    if (!url) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Join me on Ping", text: "I'm on Ping — come say hi.", url });
      } catch {
        // Dismissing the share sheet isn't an error.
      }
    } else {
      await copy();
    }
  };

  const count = invite?.invitedCount ?? 0;

  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ping-text-light dark:text-ping-night-text-light mb-3">
        Invite friends
      </p>
      <div className="bg-white dark:bg-ping-night-card rounded-2xl border border-ping-sand/60 dark:border-ping-night-border p-4 space-y-3">
        {loadFailed ? (
          <p className="text-sm text-ping-text-light dark:text-ping-night-text-light">
            Couldn&apos;t load your invite link. Try again later.
          </p>
        ) : !invite ? (
          <div className="h-10 rounded-xl bg-ping-cream dark:bg-ping-night-surface animate-pulse" />
        ) : url ? (
          <>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Your invite link"
                className="flex-1 min-w-0 px-3 py-2.5 bg-ping-cream dark:bg-ping-night-surface border border-ping-sand dark:border-ping-night-border rounded-xl text-xs text-ping-dark dark:text-ping-night-text truncate focus:outline-none"
              />
              <button
                onClick={copy}
                className="px-3.5 py-2.5 rounded-xl bg-ping-dark text-white text-xs font-semibold hover:bg-ping-dark/90 transition flex-shrink-0"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={share}
                className="px-3.5 py-2.5 rounded-xl border border-ping-sand dark:border-ping-night-border text-ping-dark dark:text-ping-night-text text-xs font-semibold hover:bg-ping-cream dark:hover:bg-ping-night-card-active transition flex-shrink-0"
              >
                Share
              </button>
            </div>
            <div className="flex items-center justify-between text-xs text-ping-text-light dark:text-ping-night-text-light">
              <span>
                {invite.daysLeft === 0
                  ? "Expires today"
                  : `Expires in ${invite.daysLeft} day${invite.daysLeft === 1 ? "" : "s"}`}
              </span>
              <button
                onClick={() => setConfirmReplace(true)}
                disabled={busy}
                className="font-semibold hover:text-ping-dark dark:hover:text-ping-night-text transition disabled:opacity-50"
              >
                New link
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-ping-text-light dark:text-ping-night-text-light">
              Bring your people. Your link works for 7 days and anyone can use it.
            </p>
            <button
              onClick={makeLink}
              disabled={busy}
              className="w-full py-2.5 rounded-xl bg-ping-dark text-white text-sm font-semibold hover:bg-ping-dark/90 transition disabled:opacity-50"
            >
              {busy ? "Making your link…" : "Create invite link"}
            </button>
          </>
        )}

        {invite && (
          <p className="text-xs text-ping-text-light dark:text-ping-night-text-light">
            {count === 0
              ? "Nobody has joined with your links yet."
              : `${count} ${count === 1 ? "person has" : "people have"} joined with your links.`}
          </p>
        )}

        {error && (
          <p role="alert" className="text-xs text-red-500 font-medium">
            {error}
          </p>
        )}
      </div>

      {confirmReplace && (
        <ConfirmDialog
          title="Make a new link?"
          body="Your current link will stop working straight away, including anywhere you've already shared it."
          confirmLabel="Make new link"
          destructive
          isWorking={busy}
          onConfirm={makeLink}
          onCancel={() => setConfirmReplace(false)}
        />
      )}
    </div>
  );
}
