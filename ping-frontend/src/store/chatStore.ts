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
  /** Drop a message from the open chat ("Delete for me"). */
  removeMessage: (messageId: string) => void;
  /**
   * Change the chat-list preview text, but only if it still shows the message
   * sent at `sentAt` (a deletion or edit of the latest message). Never touches
   * unread counts or ordering, unlike updateConversationLastMessage.
   */
  setLastMessagePreview: (conversationId: string, sentAt: string, content: string) => void;
  upsertConversation: (conversation: Conversation) => void;
  updateConversationLastMessage: (conversationId: string, message: Message) => void;
  /**
   * "Delete chat" for each id: gone from your list and cleared for you. The
   * other person keeps theirs. A chat comes back when a new message arrives.
   * Resolves with how many were deleted.
   */
  deleteConversationsForMe: (conversationIds: string[]) => Promise<number>;
  createPrivateConversation: (participantId: string) => Promise<Conversation>;
  createGroupConversation: (name: string, participantIds: string[]) => Promise<Conversation>;
  markAsRead: (conversationId: string) => Promise<void>;
  markAllMessagesAsSeen: (conversationId: string) => void;
  clearChat: () => void;
  /**
   * Whether the Chats page is actually on screen. The live connection now runs
   * on every page, so "the active conversation" on its own no longer means
   * "the chat you're looking at". It may just be the last one you opened
   * before going to Home. Anything that should only happen while you're
   * reading a chat (auto read receipts, holding back the unread count) checks
   * this as well.
   */
  chatOnScreen: boolean;
  setChatOnScreen: (onScreen: boolean) => void;
  /**
   * A conversation someone asked to open from outside the Chats page: a
   * message pop-up, a system notification, or a link. The Chats page picks it
   * up and opens it, because only that page knows how to show a thread (on a
   * phone, that means switching from the list to the conversation).
   */
  pendingOpenId: string | null;
  requestOpenConversation: (conversationId: string | null) => void;
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

  chatOnScreen: false,

  setChatOnScreen: (onScreen: boolean) => set({ chatOnScreen: onScreen }),

  pendingOpenId: null,

  requestOpenConversation: (conversationId: string | null) => set({ pendingOpenId: conversationId }),

  setActiveConversation: (conversation: Conversation) => {
    set((state) =>
      // Selecting the chat that's ALREADY open keeps its messages.
      //
      // This used to empty the list on every call. But the chat page only
      // reloads history when the conversation's id CHANGES, so tapping the
      // open chat a second time wiped the messages and nothing brought them
      // back: "No messages yet" for a chat full of messages. The two halves of
      // "switch conversation" (clear the old list, load the new one) have to
      // be triggered by the same condition, the id changing, or they drift.
      state.activeConversation?.id === conversation.id
        ? { activeConversation: conversation }
        : {
            activeConversation: conversation,
            messages: [],
            currentPage: 0,
            hasMoreMessages: true,
          }
    );
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

      // Already have it? Then this is an UPDATE (an edit or a reaction),
      // sent on the same channel as new messages. Replace our copy in place;
      // dropping it as a duplicate would silently discard the change.
      if (state.messages.some((m) => m.id === message.id)) {
        return { messages: state.messages.map((m) => (m.id === message.id ? message : m)) };
      }
      return { messages: [...state.messages, message] };
    });
  },

  removeMessage: (messageId: string) => {
    set((state) => ({ messages: state.messages.filter((m) => m.id !== messageId) }));
  },

  setLastMessagePreview: (conversationId: string, sentAt: string, content: string) => {
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId &&
        conv.lastMessage &&
        new Date(conv.lastMessage.timestamp).getTime() === new Date(sentAt).getTime()
          ? { ...conv, lastMessage: { ...conv.lastMessage, content } }
          : conv
      ),
    }));
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
    // A message for a chat that isn't in the list: one you deleted (it comes
    // back now, like WhatsApp), or one someone just started with you. Fetch
    // it: the server's copy already counts this message as unread and only
    // previews what's newer than your deletion.
    if (!get().conversations.some((c) => c.id === conversationId)) {
      api
        .get(`/conversations/${conversationId}`)
        .then((res) => get().upsertConversation(res.data as Conversation))
        .catch(() => {});
      return;
    }
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
            // Count it as unread unless you're looking at this exact chat
            // right now: on the Chats page with this conversation open.
            unreadCount:
              state.chatOnScreen && state.activeConversation?.id === conversationId
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

  deleteConversationsForMe: async (conversationIds: string[]) => {
    const results = await Promise.allSettled(
      conversationIds.map((id) => api.delete(`/conversations/${id}/from-my-list`))
    );
    const deleted = conversationIds.filter((_, i) => results[i].status === "fulfilled");
    set((state) => ({ conversations: state.conversations.filter((c) => !deleted.includes(c.id)) }));
    // Deleting the chat that's open closes it.
    const active = get().activeConversation;
    if (active && deleted.includes(active.id)) get().clearChat();
    return deleted.length;
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
        (error.response?.data as { message?: string } | undefined)?.message ||
          "Failed to create conversation"
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