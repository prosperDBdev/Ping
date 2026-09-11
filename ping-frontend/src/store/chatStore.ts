import { create } from "zustand";
import api from "@/lib/api";
import { Conversation, Message } from "@/types";
import { AxiosError } from "axios";

interface ChatState {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: Message[];
  isLoadingConversations: boolean;
  /** True when the last conversation fetch failed — lets the UI offer a retry
   *  instead of showing an empty inbox that looks like "you have no chats". */
  conversationsFailed: boolean;
  isLoadingMessages: boolean;
  hasMoreMessages: boolean;
  currentPage: number;

  /** @param attempt internal — used by the automatic retry, callers omit it. */
  fetchConversations: (attempt?: number) => Promise<void>;
  setActiveConversation: (conversation: Conversation) => void;
  fetchMessages: (conversationId: string, page?: number) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  addMessage: (message: Message) => void;
  upsertConversation: (conversation: Conversation) => void;
  updateConversationLastMessage: (conversationId: string, message: Message) => void;
  createPrivateConversation: (participantId: string) => Promise<Conversation>;
  createGroupConversation: (name: string, participantIds: string[]) => Promise<Conversation>;
  markAsRead: (conversationId: string) => Promise<void>;
  markAllMessagesAsSeen: (conversationId: string) => void;
  clearChat: () => void;
}

// Backoff for a conversation fetch that couldn't reach the server: 1s, 2s, 4s,
// 8s, 15s, then every 30s for as long as the server stays unreachable.
//
// It doesn't stop, on purpose. A fixed chain of a few seconds was tried first
// and wasn't enough — a cold Spring Boot start takes far longer than that to
// accept connections, so every retry was spent while the port was still closed
// and the inbox ended up waiting for a click anyway. One request every 30s
// costs nothing and means the app heals itself the moment the backend is ready.
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 15000];
const MAX_RETRY_DELAY_MS = 30000;

// After the quick attempts, show the failure UI — but keep retrying behind it,
// so the message is informative rather than a dead end.
const ATTEMPTS_BEFORE_SHOWING_FAILURE = 3;

// Only ever one retry chain in flight. Without this, a manual "Try again" or a
// tab refocus while a retry was queued would start a second chain, and every
// failure would fork again.
let retryTimer: ReturnType<typeof setTimeout> | null = null;

const cancelPendingRetry = () => {
  if (retryTimer !== null) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
};

const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: [],
  isLoadingConversations: false,
  conversationsFailed: false,
  isLoadingMessages: false,
  hasMoreMessages: true,
  currentPage: 0,

  fetchConversations: async (attempt = 0) => {
    // Any fresh fetch supersedes a queued retry.
    cancelPendingRetry();
    set({ isLoadingConversations: true });
    try {
      const res = await api.get("/conversations");
      set({ conversations: res.data, isLoadingConversations: false, conversationsFailed: false });
    } catch (err) {
      // The failure that actually happens in practice: you start both servers
      // and open the app, but Spring Boot needs a while before it accepts
      // connections. The request fails, and with no retry the inbox sat empty
      // forever — which looked like being logged out. Signing out and back in
      // "fixed" it only because that fired a fresh fetch, by which time the
      // backend was up.
      //
      // Retry only when there's no response at all (server unreachable). A
      // 401 is already handled globally by the interceptor, and retrying a
      // real HTTP error would just spin against a server that's answering
      // perfectly well with "no".
      const noResponse = (err as AxiosError)?.response === undefined;
      if (!noResponse) {
        set({ isLoadingConversations: false, conversationsFailed: true });
        return;
      }

      const showFailure = attempt + 1 >= ATTEMPTS_BEFORE_SHOWING_FAILURE;
      set({
        // Stay on the spinner for the first few attempts rather than flashing
        // an error at a backend that's one second away from being ready.
        isLoadingConversations: !showFailure,
        conversationsFailed: showFailure,
      });

      const delayMs = RETRY_DELAYS_MS[attempt] ?? MAX_RETRY_DELAY_MS;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void get().fetchConversations(attempt + 1);
      }, delayMs);
    }
  },

  setActiveConversation: (conversation: Conversation) => {
    set({
      activeConversation: conversation,
      messages: [],
      currentPage: 0,
      hasMoreMessages: true,
    });
  },

  fetchMessages: async (conversationId: string, page: number = 0) => {
    set({ isLoadingMessages: true });
    try {
      const res = await api.get(
        `/conversations/${conversationId}/messages?page=${page}&size=50`
      );

      const newMessages: Message[] = res.data.content || [];
      const isLast = res.data.last;

      if (page === 0) {
        // First load — reverse so oldest is first
        set({
          messages: [...newMessages].reverse(),
          isLoadingMessages: false,
          hasMoreMessages: !isLast,
          currentPage: 0,
        });
      } else {
        // Loading older messages — prepend
        set((state) => ({
          messages: [...[...newMessages].reverse(), ...state.messages],
          isLoadingMessages: false,
          hasMoreMessages: !isLast,
          currentPage: page,
        }));
      }
    } catch {
      set({ isLoadingMessages: false });
    }
  },

  loadMoreMessages: async () => {
    const { activeConversation, currentPage, hasMoreMessages, isLoadingMessages } = get();
    if (!activeConversation || !hasMoreMessages || isLoadingMessages) return;

    await get().fetchMessages(activeConversation.id, currentPage + 1);
  },

  addMessage: (message: Message) => {
    set((state) => {
      // Only append messages that actually belong to the conversation on
      // screen. Without this, a frame arriving for ANY other conversation —
      // a subscription lingering through a chat switch, or a user-level
      // notification — gets rendered into whichever chat happens to be open.
      // That's how a message sent in a temporary chat ends up displayed in
      // the normal chat with the same person. The message list is
      // per-conversation, so it should enforce that itself rather than
      // trusting every caller to only ever hand it the right frames.
      if (!state.activeConversation || message.conversationId !== state.activeConversation.id) {
        return state;
      }

      // Prevent duplicates
      if (state.messages.find((m) => m.id === message.id)) {
        return state;
      }
      return { messages: [...state.messages, message] };
    });
  },

  // Insert a conversation, or replace it if it's already in the list. Used by
  // the /conversation-created WebSocket topic so an accepted temporary chat
  // appears in both users' inboxes without either one refetching.
  upsertConversation: (conversation: Conversation) => {
    set((state) => {
      const exists = state.conversations.some((c) => c.id === conversation.id);
      const next = exists
        ? state.conversations.map((c) => (c.id === conversation.id ? conversation : c))
        : [conversation, ...state.conversations];

      next.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      return { conversations: next };
    });
  },

  updateConversationLastMessage: (conversationId: string, message: Message) => {
    set((state) => {
      const updated = state.conversations.map((conv) => {
        if (conv.id === conversationId) {
          return {
            ...conv,
            lastMessage: {
              content: message.content,
              senderId: message.senderId,
              senderUsername: message.senderUsername,
              timestamp: message.createdAt,
            },
            updatedAt: message.createdAt,
            // Increment unread if not active conversation
            unreadCount:
              state.activeConversation?.id === conversationId
                ? conv.unreadCount
                : conv.unreadCount + 1,
          };
        }
        return conv;
      });

      // Sort by most recent
      updated.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      return { conversations: updated };
    });
  },

  createPrivateConversation: async (participantId: string) => {
    try {
      const res = await api.post("/conversations/private", {
        participantId,
      });
      const conversation: Conversation = res.data;

      // Add to list if not already there
      set((state) => {
        const exists = state.conversations.find((c) => c.id === conversation.id);
        if (!exists) {
          return { conversations: [conversation, ...state.conversations] };
        }
        return state;
      });

      return conversation;
    } catch (err: unknown) {
      const error = err as AxiosError;
      throw new Error(
        (error.response?.data as string) || "Failed to create conversation"
      );
    }
  },

  createGroupConversation: async (name: string, participantIds: string[]) => {
    try {
      const res = await api.post("/conversations/group", {
        name,
        participantIds,
      });
      const conversation: Conversation = res.data;

      set((state) => ({
        conversations: [conversation, ...state.conversations],
      }));

      return conversation;
    } catch (err: unknown) {
      const error = err as AxiosError;
      throw new Error(
        (error.response?.data as string) || "Failed to create group"
      );
    }
  },

  markAsRead: async (conversationId: string) => {
    try {
      await api.put(`/conversations/${conversationId}/messages/read`);

      // Reset unread count locally
      set((state) => ({
        conversations: state.conversations.map((conv) =>
          conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
        ),
      }));
    } catch {
      // Silently fail
    }
  },

  markAllMessagesAsSeen: (conversationId: string) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.conversationId === conversationId || !m.conversationId
          ? { ...m, status: "SEEN" }
          : m
      ),
    }));
  },

  clearChat: () => {
    // Signing out ends the retry chain too — otherwise it would keep polling
    // an endpoint the user no longer has a session for.
    cancelPendingRetry();
    set({
      activeConversation: null,
      messages: [],
      currentPage: 0,
      hasMoreMessages: true,
    });
  },
}));

export default useChatStore;