import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  CalendarEvent,
  MessageReaction,
  PinnedItem,
  Task,
  TaskAttachment,
} from "@/types";

/**
 * Local-first workspace layer.
 *
 * The Ping backend currently only models Users, Conversations and
 * Messages — there is no Task, Event, Pin or TemporaryConversation
 * collection yet. Rather than fake server persistence, this store keeps
 * that data in the browser (localStorage) so the workspace features are
 * genuinely usable today, per-conversation, per-browser.
 *
 * Every action below is written the way a future API-backed store would
 * be (`createTask`, `updateTask`, `deleteTask`, ...) so swapping the body
 * of each action for a real `api.post/put/delete` call is a contained
 * change — nothing above this store needs to know the difference.
 */

const genId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

interface CreateTaskInput {
  conversationId: string;
  title: string;
  description?: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  priority?: Task["priority"];
  status?: Task["status"];
  attachments?: TaskAttachment[];
  isReminder?: boolean;
  sourceMessageId?: string | null;
  sourceMessageSnippet?: string | null;
  createdBy: string;
}

interface CreateEventInput {
  conversationId: string;
  title: string;
  description?: string;
  date: string;
  time?: string | null;
  participantIds: string[];
  sourceMessageId?: string | null;
  sourceMessageSnippet?: string | null;
  createdBy: string;
}

interface WorkspaceState {
  tasksByConversation: Record<string, Task[]>;
  eventsByConversation: Record<string, CalendarEvent[]>;
  pinsByConversation: Record<string, PinnedItem[]>;
  reactionsByMessage: Record<string, MessageReaction[]>;

  createTask: (input: CreateTaskInput) => Task;
  updateTask: (conversationId: string, taskId: string, patch: Partial<Task>) => void;
  deleteTask: (conversationId: string, taskId: string) => void;

  createEvent: (input: CreateEventInput) => CalendarEvent;
  deleteEvent: (conversationId: string, eventId: string) => void;

  togglePin: (
    conversationId: string,
    messageId: string,
    messageSnippet: string,
    messageSenderUsername: string,
    userId: string
  ) => void;
  isPinned: (conversationId: string, messageId: string) => boolean;

  toggleReaction: (messageId: string, emoji: string, userId: string) => void;

  allTasks: () => Task[];
  allEvents: () => CalendarEvent[];
}

const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      tasksByConversation: {},
      eventsByConversation: {},
      pinsByConversation: {},
      reactionsByMessage: {},

      createTask: (input) => {
        const now = new Date().toISOString();
        const task: Task = {
          id: genId(),
          conversationId: input.conversationId,
          title: input.title,
          description: input.description || "",
          assigneeId: input.assigneeId ?? null,
          dueDate: input.dueDate ?? null,
          priority: input.priority || "MEDIUM",
          status: input.status || "TODO",
          attachments: input.attachments || [],
          isReminder: input.isReminder || false,
          sourceMessageId: input.sourceMessageId ?? null,
          sourceMessageSnippet: input.sourceMessageSnippet ?? null,
          createdBy: input.createdBy,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          tasksByConversation: {
            ...state.tasksByConversation,
            [input.conversationId]: [
              task,
              ...(state.tasksByConversation[input.conversationId] || []),
            ],
          },
        }));
        return task;
      },

      updateTask: (conversationId, taskId, patch) => {
        set((state) => ({
          tasksByConversation: {
            ...state.tasksByConversation,
            [conversationId]: (state.tasksByConversation[conversationId] || []).map((t) =>
              t.id === taskId
                ? { ...t, ...patch, updatedAt: new Date().toISOString() }
                : t
            ),
          },
        }));
      },

      deleteTask: (conversationId, taskId) => {
        set((state) => ({
          tasksByConversation: {
            ...state.tasksByConversation,
            [conversationId]: (state.tasksByConversation[conversationId] || []).filter(
              (t) => t.id !== taskId
            ),
          },
        }));
      },

      createEvent: (input) => {
        const event: CalendarEvent = {
          id: genId(),
          conversationId: input.conversationId,
          title: input.title,
          description: input.description || "",
          date: input.date,
          time: input.time ?? null,
          participantIds: input.participantIds,
          sourceMessageId: input.sourceMessageId ?? null,
          sourceMessageSnippet: input.sourceMessageSnippet ?? null,
          createdBy: input.createdBy,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          eventsByConversation: {
            ...state.eventsByConversation,
            [input.conversationId]: [
              event,
              ...(state.eventsByConversation[input.conversationId] || []),
            ],
          },
        }));
        return event;
      },

      deleteEvent: (conversationId, eventId) => {
        set((state) => ({
          eventsByConversation: {
            ...state.eventsByConversation,
            [conversationId]: (state.eventsByConversation[conversationId] || []).filter(
              (e) => e.id !== eventId
            ),
          },
        }));
      },

      togglePin: (conversationId, messageId, messageSnippet, messageSenderUsername, userId) => {
        set((state) => {
          const existing = state.pinsByConversation[conversationId] || [];
          const already = existing.find((p) => p.messageId === messageId);
          const next = already
            ? existing.filter((p) => p.messageId !== messageId)
            : [
                {
                  id: genId(),
                  conversationId,
                  messageId,
                  messageSnippet,
                  messageSenderUsername,
                  pinnedBy: userId,
                  pinnedAt: new Date().toISOString(),
                },
                ...existing,
              ];
          return {
            pinsByConversation: { ...state.pinsByConversation, [conversationId]: next },
          };
        });
      },

      isPinned: (conversationId, messageId) => {
        return (get().pinsByConversation[conversationId] || []).some(
          (p) => p.messageId === messageId
        );
      },

      toggleReaction: (messageId, emoji, userId) => {
        set((state) => {
          const existing = state.reactionsByMessage[messageId] || [];
          const idx = existing.findIndex((r) => r.emoji === emoji);
          let next: MessageReaction[];

          if (idx === -1) {
            next = [...existing, { emoji, userIds: [userId] }];
          } else {
            const reaction = existing[idx];
            const hasReacted = reaction.userIds.includes(userId);
            const userIds = hasReacted
              ? reaction.userIds.filter((id) => id !== userId)
              : [...reaction.userIds, userId];

            next = userIds.length
              ? existing.map((r, i) => (i === idx ? { ...r, userIds } : r))
              : existing.filter((_, i) => i !== idx);
          }

          return { reactionsByMessage: { ...state.reactionsByMessage, [messageId]: next } };
        });
      },

      allTasks: () => Object.values(get().tasksByConversation).flat(),
      allEvents: () => Object.values(get().eventsByConversation).flat(),
    }),
    { name: "ping-workspace" }
  )
);

export default useWorkspaceStore;
