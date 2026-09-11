"use client";

import toast from "react-hot-toast";
import { Conversation } from "@/types";
import useWorkspaceStore from "@/store/workspaceStore";
import EmptyState from "@/components/workspace/EmptyState";
import { colorFor, initialsFor } from "@/lib/avatar";

interface PinnedPanelProps {
  conversation: Conversation;
  onJumpToMessage: (messageId: string) => void;
}

function formatRelative(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export default function PinnedPanel({ conversation, onJumpToMessage }: PinnedPanelProps) {
  const { pinsByConversation, togglePin } = useWorkspaceStore();
  const pins = pinsByConversation[conversation.id] || [];

  const handleUnpin = (messageId: string, snippet: string, sender: string) => {
    togglePin(conversation.id, messageId, snippet, sender, "");
    toast.success("Unpinned");
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 sm:px-6 pt-4 pb-3 flex-shrink-0">
        <h3 className="text-base font-black text-ping-dark dark:text-ping-night-text">Pinned & important</h3>
        <p className="text-xs text-ping-text-light dark:text-ping-night-text-light">
          {pins.length} message{pins.length !== 1 ? "s" : ""} saved for easy access
        </p>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 sm:px-6 pb-6">
        {pins.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
              </svg>
            }
            title="Nothing pinned yet"
            description="Use the message action menu to pin decisions and important messages so they're never lost in the scroll."
          />
        ) : (
          <div className="space-y-2.5 pt-1">
            {pins.map((pin) => (
              <div
                key={pin.id}
                className="bg-white dark:bg-ping-night-card rounded-2xl border border-ping-sand/60 dark:border-ping-night-border p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full ${colorFor(pin.messageSenderUsername)} flex items-center justify-center text-white text-[9px] font-bold`}>
                      {initialsFor(pin.messageSenderUsername)}
                    </div>
                    <span className="text-xs font-bold text-ping-dark dark:text-ping-night-text">
                      {pin.messageSenderUsername}
                    </span>
                    <span className="text-[10px] text-ping-text-light dark:text-ping-night-text-light">
                      · pinned {formatRelative(pin.pinnedAt)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleUnpin(pin.messageId, pin.messageSnippet, pin.messageSenderUsername)}
                    aria-label="Unpin"
                    className="text-ping-text-light dark:text-ping-night-text-light hover:text-ping-orange transition"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16 3a1 1 0 01.894.553l1 2A1 1 0 0117 7v4.586l3.707 3.707A1 1 0 0120 17h-6v4a1 1 0 11-2 0v-4H6a1 1 0 01-.707-1.707L9 11.586V7a1 1 0 01.106-.447l1-2A1 1 0 0111 4h5a1 1 0 010-2z" />
                    </svg>
                  </button>
                </div>
                <button
                  onClick={() => onJumpToMessage(pin.messageId)}
                  className="text-sm text-ping-dark/80 dark:text-ping-night-text/80 leading-relaxed text-left hover:text-ping-teal dark:hover:text-ping-teal-light transition"
                >
                  &ldquo;{pin.messageSnippet}&rdquo;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
