"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Client } from "@stomp/stompjs";
import { createStompClient, disconnectStomp } from "@/lib/stompClient";
import useAuthStore from "@/store/authStore";
import useChatStore from "@/store/chatStore";
import {
  Conversation,
  Message,
  TemporaryChatInvite,
  TemporaryChatResponseEvent,
  TypingEvent,
} from "@/types";

export default function useWebSocket() {
  const clientRef = useRef<Client | null>(null);
  const { user } = useAuthStore();
  const {
    activeConversation,
    addMessage,
    updateConversationLastMessage,
    fetchConversations,
    markAsRead,
    markAllMessagesAsSeen,
    upsertConversation,
  } = useChatStore();

  // Two separate lifetimes: session-wide subscriptions (opened once on
  // connect, torn down only on disconnect) vs. per-conversation ones (swapped
  // every time you open a different chat).
  const subscriptionsRef = useRef<Map<string, { unsubscribe: () => void }>>(new Map());
  const conversationSubsRef = useRef<Map<string, { unsubscribe: () => void }>>(new Map());
  // Real state, not a ref read from a dependency array: the per-conversation
  // effect below has to re-run once the socket actually connects, and a ref
  // mutation doesn't trigger that. Reading clientRef.current?.connected in the
  // deps only appeared to work — it was evaluated during render, before the
  // connection existed, so subscriptions could silently fail to attach after
  // a reconnect.
  const [isConnected, setIsConnected] = useState(false);
  const typingCallbackRef = useRef<((event: TypingEvent) => void) | null>(null);
  const tempInviteCallbackRef = useRef<((invite: TemporaryChatInvite) => void) | null>(null);
  const tempResponseCallbackRef = useRef<((event: TemporaryChatResponseEvent) => void) | null>(null);
  const removedFromConversationCallbackRef =
    useRef<((event: { conversationId: string; removedBy: string }) => void) | null>(null);

  // Connect to WebSocket
  useEffect(() => {
    if (!user?.id) return;

    const client = createStompClient(user.id);
    clientRef.current = client;

    client.onConnect = () => {
      console.log("[WS] Connected as", user.username);
      // Refresh conversations on connect
      fetchConversations();

      // User-scoped subscriptions (as opposed to the per-conversation ones
      // below) — these stay open for the whole session, since a temp-chat
      // invite can arrive at any time regardless of which chat is open.
      const inviteSub = client.subscribe(
        `/topic/user/${user.id}/temp-chat-invite`,
        (frame) => {
          const invite: TemporaryChatInvite = JSON.parse(frame.body);
          tempInviteCallbackRef.current?.(invite);
        }
      );
      subscriptionsRef.current.set("temp-chat-invite", inviteSub);

      const responseSub = client.subscribe(
        `/topic/user/${user.id}/temp-chat-response`,
        (frame) => {
          const event: TemporaryChatResponseEvent = JSON.parse(frame.body);
          tempResponseCallbackRef.current?.(event);
        }
      );
      subscriptionsRef.current.set("temp-chat-response", responseSub);

      // Fired for both parties when an accepted invite produces a real
      // conversation, so it shows up without either client refetching.
      const createdSub = client.subscribe(
        `/topic/user/${user.id}/conversation-created`,
        (frame) => {
          const conversation: Conversation = JSON.parse(frame.body);
          upsertConversation(conversation);
        }
      );
      subscriptionsRef.current.set("conversation-created", createdSub);

      // Every message in every conversation this user is part of, regardless
      // of which chat is on screen. This is what keeps the sidebar honest:
      // previously the only carrier of new messages was the per-conversation
      // subscription for the OPEN chat, so a message arriving anywhere else
      // updated nothing — the conversation kept showing "No messages yet" and
      // never raised an unread badge. Sidebar state is driven solely from
      // here now; the per-conversation subscription below is only responsible
      // for the open thread's message list.
      const inboxSub = client.subscribe(`/topic/user/${user.id}/inbox`, (frame) => {
        const message: Message = JSON.parse(frame.body);
        updateConversationLastMessage(message.conversationId, message);
      });
      subscriptionsRef.current.set("inbox", inboxSub);

      // Told directly when removed from a group. Nothing sent to the
      // conversation itself would reach this user any more — they're off the
      // participant list — so without a dedicated channel their client would
      // keep showing a group they've silently lost access to.
      const removedSub = client.subscribe(
        `/topic/user/${user.id}/removed-from-conversation`,
        (frame) => {
          const event: { conversationId: string; removedBy: string } = JSON.parse(frame.body);
          removedFromConversationCallbackRef.current?.(event);
        }
      );
      subscriptionsRef.current.set("removed-from-conversation", removedSub);

      setIsConnected(true);
    };

    client.onWebSocketClose = () => {
      setIsConnected(false);
    };

    client.onStompError = (frame) => {
      console.error("[WS] Error:", frame.headers["message"]);
    };

    client.activate();

    return () => {
      disconnectStomp();
      subscriptionsRef.current.clear();
      setIsConnected(false);
    };
  }, [user?.id]);

  // Subscribe to active conversation
  useEffect(() => {
    const client = clientRef.current;
    if (!client || !client.connected || !activeConversation) return;

    const convId = activeConversation.id;

    // Unsubscribe from the PREVIOUS conversation's topics only. These live in
    // their own map, separate from the session-wide subscriptions set up in
    // onConnect — a blanket clear here would silently tear down the temp-chat
    // invite listeners the moment you opened any conversation, and you'd
    // never receive an invite again until a full reconnect.
    conversationSubsRef.current.forEach((sub) => sub.unsubscribe());
    conversationSubsRef.current.clear();

    // Subscribe to new messages
    const messageSub = client.subscribe(
      `/topic/conversation/${convId}`,
      (frame) => {
        const message: Message = JSON.parse(frame.body);
        // Sidebar preview/unread is handled by the inbox subscription above,
        // which fires for every conversation — updating it here too would
        // just be a second write for the one chat that's open.
        addMessage(message);

        // If message is from someone else and chat is active, automatically send read receipt
        if (message.senderId !== user?.id) {
          markAsRead(convId);
          if (client && client.connected) {
            client.publish({
              destination: "/app/chat.read",
              body: JSON.stringify({ conversationId: convId }),
            });
          }
        }
      }
    );
    conversationSubsRef.current.set("messages", messageSub);

    // Subscribe to typing indicators
    const typingSub = client.subscribe(
      `/topic/conversation/${convId}/typing`,
      (frame) => {
        const event: TypingEvent = JSON.parse(frame.body);
        if (event.userId !== user?.id && typingCallbackRef.current) {
          typingCallbackRef.current(event);
        }
      }
    );
    conversationSubsRef.current.set("typing", typingSub);

    // Subscribe to read receipts
    const readSub = client.subscribe(
      `/topic/conversation/${convId}/read`,
      () => {
        // Mark all messages in the active conversation as SEEN
        markAllMessagesAsSeen(convId);
      }
    );
    conversationSubsRef.current.set("read", readSub);

    return () => {
      conversationSubsRef.current.forEach((sub) => sub.unsubscribe());
      conversationSubsRef.current.clear();
    };
  }, [activeConversation?.id, isConnected]);

  /**
   * Publish a frame, reporting whether it actually went out.
   *
   * The boolean matters: STOMP publishes are fire-and-forget, and if the
   * socket is still connecting (or reconnecting) there is nothing to publish
   * to. Returning void here meant callers assumed success and told the user
   * so — a message would clear from the input and simply never exist. Every
   * caller that cares now has something to check.
   */
  const publish = useCallback((destination: string, body: unknown): boolean => {
    const client = clientRef.current;
    if (!client || !client.connected) return false;

    client.publish({ destination, body: JSON.stringify(body) });
    return true;
  }, []);

  // Send a message. `attachment` is only set for voice notes today, but the
  // shape matches Message.Attachment on the backend so this same path will
  // carry images/files later without changing again.
  const sendMessage = useCallback(
    (
      conversationId: string,
      content: string,
      type: string = "TEXT",
      attachment?: {
        key: string;
        mimeType: string;
        sizeBytes: number;
        // Voice notes only.
        durationSeconds?: number;
        // Images/files only — display metadata, never used as a storage path.
        fileName?: string;
      }
    ): boolean =>
      publish("/app/chat.send", {
        conversationId,
        content,
        type,
        attachmentKey: attachment?.key,
        attachmentMimeType: attachment?.mimeType,
        attachmentSizeBytes: attachment?.sizeBytes,
        attachmentDurationSeconds: attachment?.durationSeconds,
        attachmentFileName: attachment?.fileName,
      }),
    [publish]
  );

  // Typing indicators are genuinely best-effort — a dropped one is invisible
  // and self-corrects on the next keystroke, so nothing checks this result.
  const sendTyping = useCallback(
    (conversationId: string, isTyping: boolean): boolean =>
      publish("/app/chat.typing", { conversationId, isTyping: String(isTyping) }),
    [publish]
  );

  const sendRead = useCallback(
    (conversationId: string): boolean => publish("/app/chat.read", { conversationId }),
    [publish]
  );

  // Propose a temporary conversation — creates nothing until accepted.
  const inviteToTemporaryChat = useCallback(
    (toUserId: string, durationMs: number, durationLabel: string): boolean =>
      publish("/app/temp-chat.invite", { toUserId, durationMs, durationLabel }),
    [publish]
  );

  const respondToTemporaryChat = useCallback(
    (inviteId: string, accept: boolean): boolean =>
      publish("/app/temp-chat.respond", { inviteId, accept }),
    [publish]
  );

  // Set typing callback
  const onTyping = useCallback((callback: (event: TypingEvent) => void) => {
    typingCallbackRef.current = callback;
  }, []);

  const onTemporaryChatInvite = useCallback(
    (callback: (invite: TemporaryChatInvite) => void) => {
      tempInviteCallbackRef.current = callback;
    },
    []
  );

  const onTemporaryChatResponse = useCallback(
    (callback: (event: TemporaryChatResponseEvent) => void) => {
      tempResponseCallbackRef.current = callback;
    },
    []
  );

  const onRemovedFromConversation = useCallback(
    (callback: (event: { conversationId: string; removedBy: string }) => void) => {
      removedFromConversationCallbackRef.current = callback;
    },
    []
  );

  return {
    // Exposed so the UI can reflect connection state up front, rather than
    // only discovering there's no socket at the moment someone hits send.
    isConnected,
    sendMessage,
    sendTyping,
    sendRead,
    onTyping,
    inviteToTemporaryChat,
    respondToTemporaryChat,
    onTemporaryChatInvite,
    onTemporaryChatResponse,
    onRemovedFromConversation,
  };
}