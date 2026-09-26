"use client";

import { useState } from "react";
import useWorkspaceStore from "@/store/workspaceStore";
import { parseReplyQuote, snippetFor } from "@/lib/messageActions";
import { PinnedItem } from "@/types";

/** A pinned message's one-line preview: its text, or what kind of file it is. */
export function pinPreview(pin: PinnedItem): string {
  if (pin.messageType === "VOICE") return "🎤 Voice note";
  const body = parseReplyQuote(pin.messageContent || "").body;
  if (pin.messageType === "IMAGE") return body && body !== "📷 Photo" ? `📷 ${snippetFor(body, 80)}` : "📷 Photo";
  return snippetFor(body, 80);
}

/**
 * The strip at the top of a chat showing its pinned messages, like WhatsApp.
 * Tapping it jumps to the pinned message; with more than one pin, each tap
 * moves on to the next (the bars on the left show which one you're on).
 */
export default function PinnedBanner({
  conversationId,
  onJump,
}: {
  conversationId: string;
  onJump: (messageId: string) => void;
}) {
  const pins = useWorkspaceStore((s) => s.pinsByConversation[conversationId]) ?? [];
  const [index, setIndex] = useState(0);
  if (pins.length === 0) return null;

  const current = pins[index % pins.length];

  return (
    <button
      onClick={() => {
        onJump(current.messageId);
        setIndex((i) => (i + 1) % pins.length);
      }}
      aria-label={`Pinned message: ${pinPreview(current)}. Tap to go to it.`}
      className="w-full flex items-center gap-3 px-4 sm:px-6 py-2.5 bg-white/90 dark:bg-ping-night-card/90 border-b border-ping-sand/60 dark:border-ping-night-border text-left hover:bg-white dark:hover:bg-ping-night-card transition flex-shrink-0"
    >
      {pins.length > 1 && (
        <div className="flex flex-col gap-0.5 self-stretch justify-center" aria-hidden>
          {pins.map((p, i) => (
            <span
              key={p.messageId}
              className={`w-0.5 flex-1 max-h-3 rounded-full ${
                i === index % pins.length ? "bg-ping-teal dark:bg-ping-teal-light" : "bg-ping-sand dark:bg-ping-night-border"
              }`}
            />
          ))}
        </div>
      )}
      <svg className="w-4 h-4 text-ping-teal dark:text-ping-teal-light flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path d="M16 3a1 1 0 01.894.553l1 2A1 1 0 0117 7v4.586l3.707 3.707A1 1 0 0120 17h-6v4a1 1 0 11-2 0v-4H6a1 1 0 01-.707-1.707L9 11.586V7a1 1 0 01.106-.447l1-2A1 1 0 0111 4h5a1 1 0 010-2z" />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wide text-ping-teal dark:text-ping-teal-light">
          Pinned{pins.length > 1 ? ` · ${(index % pins.length) + 1} of ${pins.length}` : ""}
        </p>
        <p className="text-sm text-ping-dark dark:text-ping-night-text truncate">{pinPreview(current)}</p>
      </div>
    </button>
  );
}
