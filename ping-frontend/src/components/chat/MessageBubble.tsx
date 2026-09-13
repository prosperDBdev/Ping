"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Message } from "@/types";
import useAuthStore from "@/store/authStore";
import useWorkspaceStore from "@/store/workspaceStore";
import { parseReplyQuote, snippetFor, suggestActionsForMessage } from "@/lib/messageActions";
import { MessageActionSheet, MessageHoverToolbar } from "@/components/chat/MessageActions";
import VoiceMessagePlayer from "@/components/chat/VoiceMessagePlayer";
import ImageAttachment from "@/components/chat/ImageAttachment";

interface MessageBubbleProps {
  message: Message;
  showSender?: boolean;
  highlighted?: boolean;
  onReply: (message: Message) => void;
  onCreateTask: (message: Message) => void;
  onCreateEvent: (message: Message) => void;
  onCreateReminder: (message: Message) => void;
  onSaveToMemory: (message: Message) => void;
}

export default function MessageBubble({
  message,
  showSender = false,
  highlighted = false,
  onReply,
  onCreateTask,
  onCreateEvent,
  onCreateReminder,
  onSaveToMemory,
}: MessageBubbleProps) {
  const { user } = useAuthStore();
  const { isPinned, togglePin, toggleReaction, reactionsByMessage } = useWorkspaceStore();
  const [sheetOpen, setSheetOpen] = useState(false);

  const isMine = message.senderId === user?.id;
  const pinned = isPinned(message.conversationId, message.id);
  const reactions = reactionsByMessage[message.id] || [];
  const { quoted, body } = parseReplyQuote(message.content);
  const suggested = suggestActionsForMessage(body);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusText = () => {
    if (!isMine) return null;
    switch (message.status) {
      case "SEEN":
        return (
          <span className="text-ping-teal dark:text-ping-teal-light text-[10px] font-semibold ml-1 flex items-center gap-0.5">
            · Read <span className="tracking-tighter">✓✓</span>
          </span>
        );
      case "DELIVERED":
        return (
          <span className="text-ping-text-light dark:text-ping-night-text-light text-[10px] ml-1 tracking-tighter">
            ✓✓
          </span>
        );
      default:
        return (
          <span className="text-ping-text-light dark:text-ping-night-text-light text-[10px] ml-1">
            ✓
          </span>
        );
    }
  };

  const handlePin = () => {
    togglePin(
      message.conversationId,
      message.id,
      snippetFor(body),
      message.senderUsername,
      user?.id || ""
    );
    toast.success(pinned ? "Unpinned" : "Pinned to Important");
  };

  const handleReact = (emoji: string) => {
    if (!user) return;
    toggleReaction(message.id, emoji, user.id);
  };

  if (message.type === "SYSTEM") {
    return (
      <div className="flex justify-center my-3">
        <p className="text-[11px] text-ping-text-light dark:text-ping-night-text-light bg-white dark:bg-ping-night-card px-4 py-1.5 rounded-full border border-ping-sand dark:border-ping-night-border italic">
          {message.content}
        </p>
      </div>
    );
  }

  return (
    <div
      id={`message-${message.id}`}
      className={`group flex ${isMine ? "justify-end" : "justify-start"} mb-3 scroll-mt-6 transition-colors rounded-2xl ${
        highlighted ? "bg-[#f4ce62]/20" : ""
      }`}
    >
      <div className={`relative max-w-[78%] sm:max-w-[65%] ${isMine ? "items-end" : "items-start"}`}>
        {/* Sender name above incoming message — group chats only */}
        {!isMine && showSender && (
          <p className="text-[11px] font-semibold text-ping-teal dark:text-ping-teal-light mb-1 ml-1">
            {message.senderUsername}
          </p>
        )}

        <MessageHoverToolbar
          isPinned={pinned}
          isMine={isMine}
          align={isMine ? "right" : "left"}
          onReply={() => onReply(message)}
          onPin={handlePin}
          onCreateTask={() => onCreateTask(message)}
          onCreateEvent={() => onCreateEvent(message)}
          onCreateReminder={() => onCreateReminder(message)}
          onSaveToMemory={() => onSaveToMemory(message)}
          onReact={handleReact}
        />

        <div className={`flex items-end gap-1 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
          {/* Message bubble */}
          <div
            className={`px-4 py-3 shadow-xs relative ${
              isMine
                ? "bg-ping-orange text-white rounded-2xl rounded-tr-xs"
                : "bg-[#EAE4DA] dark:bg-ping-night-card text-ping-dark dark:text-ping-night-text rounded-2xl rounded-tl-xs"
            }`}
          >
            {pinned && (
              <svg
                className={`w-3 h-3 absolute -top-1.5 ${isMine ? "-left-1.5" : "-right-1.5"} ${
                  isMine ? "text-ping-dark dark:text-ping-night-text" : "text-ping-orange"
                }`}
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M16 3a1 1 0 01.894.553l1 2A1 1 0 0117 7v4.586l3.707 3.707A1 1 0 0120 17h-6v4a1 1 0 11-2 0v-4H6a1 1 0 01-.707-1.707L9 11.586V7a1 1 0 01.106-.447l1-2A1 1 0 0111 4h5a1 1 0 010-2z" />
              </svg>
            )}
            {/* Reply to a status. In a private chat the only other person is
                the author, so a reply you didn't send was always to YOUR
                status. The colour bar is the status's own background, copied
                at reply time — the status itself is long gone by tomorrow. */}
            {message.statusReply && (
              <div
                className={`mb-2 rounded-lg overflow-hidden flex items-stretch text-xs ${
                  isMine ? "bg-white/15" : "bg-black/5 dark:bg-white/5"
                }`}
              >
                <div
                  className="w-1 flex-shrink-0"
                  style={{ backgroundColor: message.statusReply.backgroundColor ?? "#1F7A6C" }}
                />
                <div className="px-2.5 py-1.5 min-w-0">
                  <p
                    className={`font-bold text-[11px] ${
                      isMine ? "text-white/90" : "text-ping-teal dark:text-ping-teal-light"
                    }`}
                  >
                    {isMine ? "You replied to their status" : "Replied to your status"}
                  </p>
                  <p
                    className={`truncate ${
                      isMine ? "text-white/75" : "text-ping-dark/60 dark:text-ping-night-text/60"
                    }`}
                  >
                    {message.statusReply.statusType === "IMAGE" ? "📷 " : ""}
                    {message.statusReply.snippet}
                  </p>
                </div>
              </div>
            )}
            {quoted && (
              <div
                className={`mb-1.5 pl-2 border-l-2 text-xs leading-snug ${
                  isMine
                    ? "border-white/40 text-white/80"
                    : "border-ping-teal/50 dark:border-ping-teal-light/50 text-ping-dark/60 dark:text-ping-night-text/60"
                }`}
              >
                <p className="font-bold">{quoted.sender}</p>
                <p className="truncate">{quoted.snippet}</p>
              </div>
            )}
            {message.type === "VOICE" && message.attachment ? (
              <VoiceMessagePlayer
                attachmentKey={message.attachment.key}
                durationSeconds={message.attachment.durationSeconds}
                isMine={isMine}
              />
            ) : message.type === "IMAGE" && message.attachment ? (
              <div className="space-y-1.5">
                <ImageAttachment
                  attachmentKey={message.attachment.key}
                  fileName={message.attachment.fileName}
                  isMine={isMine}
                />
                {/* The body doubles as the caption. "📷 Photo" is the
                    placeholder used when none was typed, so it's suppressed
                    here rather than shown as if the sender wrote it. */}
                {body && body !== "📷 Photo" && (
                  <p className="text-sm leading-relaxed break-words font-normal">{body}</p>
                )}
              </div>
            ) : (
              <p className="text-sm leading-relaxed break-words font-normal">{body}</p>
            )}
          </div>

          {/* Mobile action trigger — no hover on touch, so this stays tappable */}
          <button
            onClick={() => setSheetOpen(true)}
            aria-label="Message actions"
            className="sm:hidden mb-1 w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full text-ping-text-light/50 dark:text-ping-night-text-light/50 active:bg-ping-cream-dark dark:active:bg-ping-night-card transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
          </button>
        </div>

        {reactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isMine ? "justify-end" : "justify-start"}`}>
            {reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => handleReact(r.emoji)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] border transition ${
                  user && r.userIds.includes(user.id)
                    ? "bg-ping-sage dark:bg-ping-night-sage border-ping-sage-border dark:border-ping-night-border"
                    : "bg-white dark:bg-ping-night-card border-ping-sand/70 dark:border-ping-night-border"
                }`}
              >
                <span>{r.emoji}</span>
                <span className="text-ping-text-light dark:text-ping-night-text-light font-semibold">
                  {r.userIds.length}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Timestamp + read receipt */}
        <div
          className={`flex items-center mt-1 ${
            isMine ? "justify-end mr-1" : "justify-start ml-1"
          }`}
        >
          <span className="text-[10px] font-medium text-ping-text-light dark:text-ping-night-text-light">
            {formatTime(message.createdAt)}
          </span>
          {getStatusText()}
        </div>
      </div>

      <MessageActionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        isPinned={pinned}
        isMine={isMine}
        suggested={suggested}
        onReply={() => onReply(message)}
        onPin={handlePin}
        onCreateTask={() => onCreateTask(message)}
        onCreateEvent={() => onCreateEvent(message)}
        onCreateReminder={() => onCreateReminder(message)}
        onSaveToMemory={() => onSaveToMemory(message)}
        onReact={handleReact}
      />
    </div>
  );
}
