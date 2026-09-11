"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Conversation, TypingEvent } from "@/types";
import ChatMenu from "@/components/chat/ChatMenu";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { blockUser, clearConversation, unblockUser } from "@/lib/moderation";
import useAuthStore from "@/store/authStore";
import ExpiryBadge from "@/components/temporary/ExpiryBadge";

interface ChatHeaderProps {
  conversation: Conversation;
  typingUser: TypingEvent | null;
  onBack?: () => void;
  onToggleInfo?: () => void;
  isInfoOpen?: boolean;
  /** Jump to the Files panel. */
  onViewMedia?: () => void;
  /** Called after a successful clear, so the open thread can refresh. */
  onCleared?: () => void;
  /** Called after block/unblock, so the caller can refresh blocked state. */
  onBlockChanged?: () => void;
  isBlocked?: boolean;
}

function formatRelativeTime(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export default function ChatHeader({
  conversation,
  typingUser,
  onBack,
  onToggleInfo,
  isInfoOpen,
  onViewMedia,
  onCleared,
  onBlockChanged,
  isBlocked = false,
}: ChatHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState<"clear" | "block" | "unblock" | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const { user: currentUser } = useAuthStore();
  const isTemporary = conversation.temporary && conversation.expiresAt;
  const isGroup = conversation.type === "GROUP";

  const otherUser = conversation.participants.find(
    (p) => p.id !== currentUser?.id
  );

  const displayName = isGroup ? conversation.name : otherUser?.username || "Unknown";

  const initials = displayName
    ? displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const isOnline = otherUser?.status === "ONLINE";

  const avatarColors = ["bg-ping-orange", "bg-ping-teal", "bg-purple-400", "bg-yellow-500", "bg-blue-400"];
  const colorIndex = (displayName?.charCodeAt(0) || 0) % avatarColors.length;

  const getStatusText = () => {
    if (isGroup) {
      const lastActiveTimes = conversation.participants
        .map((p) => p.lastSeen)
        .filter((v): v is string => !!v)
        .map((v) => new Date(v).getTime());
      const mostRecent = lastActiveTimes.length ? Math.max(...lastActiveTimes) : null;
      const lastActive = mostRecent ? formatRelativeTime(new Date(mostRecent).toISOString()) : "recently";
      return `${conversation.participants.length} members · Last active ${lastActive}`;
    }
    if (typingUser?.isTyping) return "typing...";
    if (isOnline) return "Online now";
    if (otherUser?.lastSeen) {
      const date = new Date(otherUser.lastSeen);
      return `Last seen ${date.toLocaleDateString([], { month: "short", day: "numeric" })} at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    return "Offline";
  };

  const handleConfirm = async () => {
    if (!confirming) return;
    setIsWorking(true);
    try {
      if (confirming === "clear") {
        await clearConversation(conversation.id);
        toast.success("Chat cleared for you");
        onCleared?.();
      } else if (otherUser) {
        if (confirming === "block") {
          await blockUser(otherUser.id);
          toast.success(`${otherUser.username} blocked`);
        } else {
          await unblockUser(otherUser.id);
          toast.success(`${otherUser.username} unblocked`);
        }
        onBlockChanged?.();
      }
      setConfirming(null);
    } catch {
      toast.error("That didn't work — try again.");
    } finally {
      setIsWorking(false);
    }
  };

  const confirmCopy = {
    clear: {
      title: "Clear this chat?",
      // Stated plainly because the distinction genuinely matters and is easy
      // to assume wrong: this is not "delete for everyone".
      body: "Messages will be hidden from your side only. The other person keeps their copy of the conversation, and nothing is unsent.",
      confirmLabel: "Clear",
    },
    block: {
      title: `Block ${otherUser?.username ?? "this user"}?`,
      body: "Neither of you will be able to message the other, and they won't appear in your search results. You can undo this at any time.",
      confirmLabel: "Block",
    },
    unblock: {
      title: `Unblock ${otherUser?.username ?? "this user"}?`,
      body: "You'll be able to message each other again.",
      confirmLabel: "Unblock",
    },
  } as const;

  return (
    <div className="px-5 py-3.5 border-b border-ping-sand/60 dark:border-ping-night-border bg-ping-cream dark:bg-ping-night-surface flex items-center justify-between shadow-2xs">
      <button
        onClick={onToggleInfo}
        className={`flex items-center gap-3 min-w-0 text-left ${onToggleInfo ? "cursor-pointer" : "cursor-default"}`}
      >
        {/* Back button (mobile) */}
        {onBack && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onBack();
            }}
            className="md:hidden mr-1 p-1 text-ping-text-light dark:text-ping-night-text-light hover:text-ping-dark dark:hover:text-ping-night-text transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </span>
        )}

        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {isGroup ? (
            <div className="w-10 h-10 rounded-full bg-ping-teal dark:bg-ping-teal-light text-white flex items-center justify-center shadow-xs">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
          ) : (
            <div className={`w-10 h-10 ${avatarColors[colorIndex]} rounded-full flex items-center justify-center text-white font-bold text-xs shadow-xs`}>
              {initials}
            </div>
          )}
          {!isGroup && isOnline && (
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-ping-green rounded-full border-2 border-white dark:border-ping-night-surface" />
          )}
        </div>

        {/* Info */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-ping-dark dark:text-ping-night-text text-sm truncate">
              {displayName}
            </h2>
            {isTemporary && <ExpiryBadge expiresAt={conversation.expiresAt!} size="sm" />}
          </div>
          <p className={`text-xs truncate ${
            !isGroup && typingUser?.isTyping
              ? "text-ping-teal dark:text-ping-teal-light font-medium"
              : !isGroup && isOnline
              ? "text-ping-green font-medium"
              : "text-ping-text-light dark:text-ping-night-text-light"
          }`}>
            {getStatusText()}
          </p>
        </div>
      </button>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {onToggleInfo && (
          <button
            onClick={onToggleInfo}
            className={`w-8 h-8 rounded-full hidden md:flex items-center justify-center transition ${
              isInfoOpen
                ? "bg-ping-cream-dark dark:bg-ping-night-card text-ping-dark dark:text-ping-night-text"
                : "text-ping-text-light dark:text-ping-night-text-light hover:bg-ping-cream-dark/60 dark:hover:bg-ping-night-card"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
          </button>
        )}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Conversation options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="w-8 h-8 rounded-full flex items-center justify-center text-ping-text-light dark:text-ping-night-text-light hover:bg-ping-cream-dark/60 dark:hover:bg-ping-night-card transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
          </button>

          {menuOpen && (
            <ChatMenu
              isGroup={isGroup}
              isBlocked={isBlocked}
              otherUsername={otherUser?.username}
              onViewMedia={() => onViewMedia?.()}
              onClearChat={() => setConfirming("clear")}
              onToggleBlock={() => setConfirming(isBlocked ? "unblock" : "block")}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          title={confirmCopy[confirming].title}
          body={confirmCopy[confirming].body}
          confirmLabel={confirmCopy[confirming].confirmLabel}
          // Unblocking restores access rather than removing it, so it isn't
          // styled as a destructive action.
          destructive={confirming !== "unblock"}
          isWorking={isWorking}
          onConfirm={handleConfirm}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  );
}