"use client";

import Sheet from "@/components/common/Sheet";
import { TemporaryChatInvite } from "@/types";
import { colorFor, initialsFor } from "@/lib/avatar";

interface TemporaryChatInvitePromptProps {
  invite: TemporaryChatInvite;
  /** How many more are queued behind this one. */
  remainingCount?: number;
  onRespond: (inviteId: string, accept: boolean) => void;
  onClose: () => void;
}

/**
 * Shown to the person being invited. Consent is the whole point of this
 * screen — a temporary conversation shouldn't be able to appear in someone's
 * inbox because a stranger decided it should.
 */
export default function TemporaryChatInvitePrompt({
  invite,
  remainingCount = 0,
  onRespond,
  onClose,
}: TemporaryChatInvitePromptProps) {
  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow={
        remainingCount > 0
          ? `Temporary conversation · ${remainingCount} more waiting`
          : "Temporary conversation"
      }
      title={`${invite.fromUsername} wants to start a temporary chat`}
      widthClass="sm:max-w-sm"
      footer={
        <div className="flex gap-2">
          <button
            onClick={() => onRespond(invite.id, false)}
            className="flex-1 py-2.5 rounded-xl border border-ping-sand dark:border-ping-night-border text-ping-dark dark:text-ping-night-text text-sm font-semibold hover:bg-ping-cream dark:hover:bg-ping-night-card transition"
          >
            Decline
          </button>
          <button
            onClick={() => onRespond(invite.id, true)}
            className="flex-1 py-2.5 rounded-xl bg-ping-orange text-white text-sm font-semibold hover:bg-ping-orange-light transition"
          >
            Accept
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-xl bg-ping-cream-dark/60 dark:bg-ping-night-card p-3">
          <div
            className={`w-10 h-10 rounded-full ${colorFor(invite.fromUsername)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
          >
            {initialsFor(invite.fromUsername)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-ping-dark dark:text-ping-night-text truncate">
              {invite.fromUsername}
            </p>
            <p className="text-xs text-ping-text-light dark:text-ping-night-text-light">
              Wants to talk for {invite.durationLabel}
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-[#fdf3d9] dark:bg-[#3a3320] border border-[#f4ce62]/40 px-3.5 py-3 text-xs text-[#8a6d1f] dark:text-[#f4ce62] leading-relaxed">
          If you accept, this conversation and everything in it is permanently deleted{" "}
          {invite.durationLabel} from now. It won&apos;t affect any other conversation you have with{" "}
          {invite.fromUsername}.
        </div>
      </div>
    </Sheet>
  );
}
