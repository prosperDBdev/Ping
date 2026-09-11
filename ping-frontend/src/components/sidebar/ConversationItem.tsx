"use client";

import { Conversation } from "@/types";
import useAuthStore from "@/store/authStore";
import ExpiryBadge from "@/components/temporary/ExpiryBadge";

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

export default function ConversationItem({
  conversation,
  isActive,
  onClick,
}: ConversationItemProps) {
  const { user: currentUser } = useAuthStore();
  const isTemporary = conversation.temporary && conversation.expiresAt;
  const isGroup = conversation.type === "GROUP";

  const otherUser = conversation.participants.find(
    (p) => p.id !== currentUser?.id
  );

  const displayName = isGroup ? conversation.name : otherUser?.username || "Unknown";

  const initials = displayName
    ? displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const isOnline = otherUser?.status === "ONLINE";

  const avatarColors = [
    "bg-ping-orange",
    "bg-ping-teal",
    "bg-purple-400",
    "bg-yellow-500",
    "bg-blue-400",
  ];
  const colorIndex =
    (displayName?.charCodeAt(0) || 0) % avatarColors.length;

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0)
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7)
      return date.toLocaleDateString([], { weekday: "short" });
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <button
      onClick={onClick}
      className={`w-[calc(100%-1rem)] mx-2 my-1 flex items-center gap-3 px-3.5 py-3 rounded-2xl transition text-left ${
        isActive
          ? "bg-ping-cream-dark dark:bg-ping-night-card-active border border-[#DFD7CC]/60 dark:border-ping-night-border"
          : "hover:bg-ping-cream/80 dark:hover:bg-ping-night-card border border-transparent"
      }`}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {isGroup ? (
          <div className="w-10 h-10 rounded-full bg-ping-teal dark:bg-ping-teal-light text-white flex items-center justify-center shadow-xs">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
        ) : (
          <div
            className={`w-10 h-10 ${avatarColors[colorIndex]} rounded-full flex items-center justify-center text-white font-bold text-xs shadow-xs`}
          >
            {initials}
          </div>
        )}
        {!isGroup && isOnline && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-ping-green rounded-full border-2 border-white dark:border-ping-night-surface" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="font-bold text-ping-dark dark:text-ping-night-text text-xs sm:text-sm truncate">
            {displayName}
          </p>
          <span className="text-[10px] font-medium text-ping-text-light dark:text-ping-night-text-light ml-2 flex-shrink-0">
            {formatTime(conversation.lastMessage?.timestamp || null)}
          </span>
        </div>
        {isTemporary && (
          <div className="mt-1">
            <ExpiryBadge expiresAt={conversation.expiresAt!} size="sm" />
          </div>
        )}
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-xs text-ping-text-light dark:text-ping-night-text-light truncate max-w-[170px]">
            {conversation.lastMessage
              ? isGroup
                ? `${conversation.lastMessage.senderId === currentUser?.id ? "You" : conversation.lastMessage.senderUsername}: ${conversation.lastMessage.content}`
                : conversation.lastMessage.content
              : "No messages yet"}
          </p>
          {conversation.unreadCount > 0 && (
            <span className="ml-2 bg-ping-orange text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 shadow-xs">
              {conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}