"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import {
  GroupInvite,
  createGroupInvite,
  getGroupInvite,
  revokeGroupInvite,
} from "@/lib/groups";
import { apiErrorMessage } from "@/lib/messages";

/**
 * The group's shareable link, for admins.
 *
 * ONE live link per group: "Make a new link" replaces the old one, so a link
 * that was posted somewhere public really does stop working. Turning it off
 * does the same. Anyone with a working link can join; that's the point, and
 * it's why the panel says how many people have used it.
 */
export default function GroupInvitePanel({
  conversationId,
  groupName,
}: {
  conversationId: string;
  groupName: string | null;
}) {
  const [invite, setInvite] = useState<GroupInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [confirming, setConfirming] = useState<"revoke" | "new" | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    getGroupInvite(conversationId)
      .then((i) => {
        if (live) setInvite(i);
      })
      .catch(() => {})
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [conversationId]);

  const share = async (url: string) => {
    // Phones have a share sheet, which is how a link actually gets into a
    // WhatsApp conversation — copying it by hand always loses to that.
    if (navigator.share) {
      try {
        await navigator.share({ title: groupName ?? "Join my Ping group", url });
        return;
      } catch {
        // Cancelled, or unsupported: fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Link copied — paste it anywhere");
    } catch {
      // Clipboard blocked (older apps, private windows): show the link so it
      // can be selected by hand.
      toast("Copy the link below", { icon: "🔗" });
    }
  };

  const run = async (action: "revoke" | "new") => {
    setWorking(true);
    try {
      if (action === "revoke") {
        await revokeGroupInvite(conversationId);
        setInvite(null);
        toast.success("Link turned off. It won't work for anyone now.");
      } else {
        setInvite(await createGroupInvite(conversationId));
        toast.success("New link made. The old one stopped working.");
      }
      setConfirming(null);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't change the link. Try again."));
    } finally {
      setWorking(false);
    }
  };

  const expiresIn = invite
    ? Math.max(0, Math.round((new Date(invite.expiresAt).getTime() - Date.now()) / 86400000))
    : 0;

  return (
    <div className="mt-5 pt-5 border-t border-ping-sand/60 dark:border-ping-night-border">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ping-text-light dark:text-ping-night-text-light mb-3">
        Invite link
      </p>

      {loading ? (
        <div className="h-9 w-full max-w-[220px] rounded-xl bg-ping-cream dark:bg-ping-night-surface animate-pulse" />
      ) : invite ? (
        <>
          <div className="rounded-2xl border border-ping-sand/60 dark:border-ping-night-border bg-ping-cream/60 dark:bg-ping-night-surface/60 p-3.5">
            <p className="text-xs text-ping-dark dark:text-ping-night-text break-all select-all">
              {invite.url}
            </p>
            <p className="mt-2 text-[11px] text-ping-text-light dark:text-ping-night-text-light">
              {invite.uses === 0
                ? "Nobody has used it yet."
                : `Used by ${invite.uses} ${invite.uses === 1 ? "person" : "people"}.`}{" "}
              {expiresIn > 0
                ? `Expires in ${expiresIn} day${expiresIn === 1 ? "" : "s"}.`
                : "Expiring soon."}
            </p>
          </div>
          <div className="flex gap-2 mt-2.5">
            <button
              onClick={() => void share(invite.url)}
              className="flex-1 py-2 rounded-xl bg-ping-teal text-white text-xs font-semibold hover:opacity-90 transition"
            >
              {copied ? "Copied ✓" : "Share link"}
            </button>
            <button
              onClick={() => setConfirming("new")}
              className="px-3 py-2 rounded-xl border border-ping-sand dark:border-ping-night-border text-xs font-semibold text-ping-dark dark:text-ping-night-text hover:bg-ping-cream dark:hover:bg-ping-night-card transition"
            >
              New link
            </button>
            <button
              onClick={() => setConfirming("revoke")}
              aria-label="Turn the invite link off"
              className="px-3 py-2 rounded-xl border border-ping-sand dark:border-ping-night-border text-xs font-semibold text-red-500 hover:bg-red-500/10 transition"
            >
              Turn off
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-ping-text-light dark:text-ping-night-text-light mb-2.5">
            Let anyone with a link join this group, without adding them one by one.
          </p>
          <button
            onClick={() => setConfirming("new")}
            disabled={working}
            className="w-full py-2.5 rounded-xl border border-ping-sand dark:border-ping-night-border text-xs font-semibold text-ping-dark dark:text-ping-night-text hover:bg-ping-cream dark:hover:bg-ping-night-card transition disabled:opacity-50"
          >
            Create an invite link
          </button>
        </>
      )}

      {confirming && (
        <ConfirmDialog
          title={confirming === "new" ? "Make a new invite link?" : "Turn the invite link off?"}
          body={
            confirming === "new"
              ? invite
                ? "The current link stops working immediately, for anyone who has it. Use this after sharing a link somewhere you shouldn't have."
                : "Anyone with the link will be able to join this group until it expires."
              : "The link stops working for everyone right away. You can make a new one later."
          }
          confirmLabel={confirming === "new" ? "Make link" : "Turn off"}
          destructive={confirming === "revoke"}
          isWorking={working}
          onConfirm={() => void run(confirming)}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  );
}
