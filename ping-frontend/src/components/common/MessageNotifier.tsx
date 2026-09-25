"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/common/Avatar";
import { useRealtime } from "@/components/common/RealtimeProvider";
import useAuthStore from "@/store/authStore";
import useChatStore from "@/store/chatStore";
import { parseReplyQuote } from "@/lib/messageActions";
import { notificationsEnabled, showSystemNotification } from "@/lib/notifications";
import { Message } from "@/types";

interface Popup {
  conversationId: string;
  title: string;
  body: string;
  username: string;
  avatarUrl: string | null;
}

/** One line of preview text, the way a phone's lock screen would show it. */
function previewOf(message: Message): string {
  const mime = message.attachment?.mimeType ?? "";
  if (mime.startsWith("image/")) return "📷 Photo";
  if (mime.startsWith("audio/") || mime === "application/x-matroska" || mime === "video/webm") {
    return "🎤 Voice message";
  }
  const text = parseReplyQuote(message.content ?? "").body.trim();
  if (!text) return "New message";
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

/**
 * Tells you a message has arrived, wherever you are in the app.
 *
 * While Ping is in view: a small pop-up at the top of the screen. While it's
 * open but out of view (another tab, the phone's home screen): a system
 * notification. Nothing at all for the chat you're already reading, for your
 * own messages, for system notes like "Maya added Sam", or when you've turned
 * notifications off in Settings.
 *
 * This only works while Ping is open somewhere. Notifying a phone where Ping is
 * fully closed needs Web Push, which is a separate, server-side feature.
 */
export default function MessageNotifier() {
  const router = useRouter();
  const { onIncomingMessage } = useRealtime();
  const [popup, setPopup] = useState<Popup | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Ask the Chats page to open this conversation, going there if needed. */
  const openConversation = useCallback(
    (conversationId: string) => {
      setPopup(null);
      useChatStore.getState().requestOpenConversation(conversationId);
      if (!window.location.pathname.startsWith("/chat")) router.push("/chat");
    },
    [router]
  );

  useEffect(() => {
    onIncomingMessage((message) => {
      const me = useAuthStore.getState().user?.id;
      // senderId is null for system notes ("Maya created the group").
      if (!message.senderId || message.senderId === me) return;

      const chat = useChatStore.getState();
      if (chat.chatOnScreen && chat.activeConversation?.id === message.conversationId) return;
      if (!notificationsEnabled()) return;

      const conversation = chat.conversations.find((c) => c.id === message.conversationId);
      const sender = conversation?.participants.find((p) => p.id === message.senderId);
      const title =
        conversation?.type === "GROUP" && conversation.name
          ? `${message.senderUsername} · ${conversation.name}`
          : message.senderUsername;
      const body = previewOf(message);

      if (document.visibilityState === "visible") {
        setPopup({
          conversationId: message.conversationId,
          title,
          body,
          username: message.senderUsername,
          avatarUrl: sender?.avatarUrl ?? null,
        });
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setPopup(null), 5000);
      } else {
        void showSystemNotification(title, body, message.conversationId);
      }
    });
  }, [onIncomingMessage]);

  // A tap on a system notification: relayed by the service worker, or raised
  // directly by the page-level fallback in lib/notifications.
  useEffect(() => {
    const onWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "open-conversation" && typeof event.data.conversationId === "string") {
        openConversation(event.data.conversationId);
      }
    };
    const onPageEvent = (event: Event) => {
      const conversationId = (event as CustomEvent<unknown>).detail;
      if (typeof conversationId === "string") openConversation(conversationId);
    };
    const worker = navigator.serviceWorker;
    worker?.addEventListener("message", onWorkerMessage);
    window.addEventListener("ping:open-conversation", onPageEvent);
    return () => {
      worker?.removeEventListener("message", onWorkerMessage);
      window.removeEventListener("ping:open-conversation", onPageEvent);
    };
  }, [openConversation]);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  if (!popup) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-3 inset-x-3 z-[60] flex justify-center pointer-events-none"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="pointer-events-auto w-full max-w-sm flex items-center gap-3 rounded-2xl bg-white dark:bg-ping-night-card border border-ping-sand/60 dark:border-ping-night-border shadow-lg p-3">
        <button
          type="button"
          onClick={() => openConversation(popup.conversationId)}
          className="flex-1 min-w-0 flex items-center gap-3 text-left"
        >
          <Avatar
            username={popup.username}
            avatarUrl={popup.avatarUrl}
            className="w-10 h-10 flex-shrink-0"
            textClassName="text-xs"
            fallbackClassName="bg-ping-teal"
          />
          <span className="min-w-0">
            <span className="block text-sm font-bold text-ping-dark dark:text-ping-night-text truncate">
              {popup.title}
            </span>
            <span className="block text-xs text-ping-text-light dark:text-ping-night-text-light truncate">
              {popup.body}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setPopup(null)}
          aria-label="Dismiss"
          className="w-7 h-7 rounded-full flex items-center justify-center text-ping-text-light dark:text-ping-night-text-light hover:bg-ping-cream dark:hover:bg-ping-night-card-active transition flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
