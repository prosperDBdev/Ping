import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  CalendarEvent,
  MessageReaction,
  PinnedItem,
  Task,
  TaskAttachment,
} from "@/types";
import api from "@/lib/api";
import { AxiosError } from "axios";
import { isLegacyTaskId, LegacyTask, legacyToRequest, toTaskRequest } from "@/lib/tasks";

/**
 * TASKS ARE ON THE SERVER NOW. The task actions below call the API, so the
 * whole chat shares one list and the server can send deadline reminders.
 * Tasks made before that still sit in this browser's storage ("legacy" ids)
 * until loadTasks uploads them. Events, pins and reactions below are still
 * local, as described next.
 *
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
  dueAt?: string | null;
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

  /** Load a chat's tasks from the server (uploading any from before tasks were shared). */
  loadTasks: (conversationId: string) => Promise<void>;
  /** Every task you can see, for Home. */
  loadMyTasks: () => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<Task>;
  /** Applied straight away; put back if the server refuses (then it throws). */
  updateTask: (conversationId: string, taskId: string, patch: Partial<Task>) => Promise<void>;
  deleteTask: (conversationId: string, taskId: string) => Promise<void>;
  /** A change someone made, arriving over the live connection. */
  applyTaskEvent: (event: TaskEvent) => void;

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

export type TaskEvent =
  | { type: "upsert"; task: Task }
  | { type: "delete"; taskId: string; conversationId: string };

const withTask = (list: Task[], task: Task) =>
  list.some((t) => t.id === task.id) ? list.map((t) => (t.id === task.id ? task : t)) : [task, ...list];

const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      tasksByConversation: {},
      eventsByConversation: {},
      pinsByConversation: {},
      reactionsByMessage: {},

      loadTasks: async (conversationId) => {
        // First, upload anything made before tasks were shared. It stays
        // private to you (see legacyToRequest). A chat you've since left or
        // that expired can't take it any more, so it's dropped; anything else
        // (offline) stays here and is tried again next time.
        const legacy = (get().tasksByConversation[conversationId] || []).filter((t) => isLegacyTaskId(t.id));
        for (const task of legacy) {
          try {
            await api.post(`/conversations/${conversationId}/tasks`, legacyToRequest(task as LegacyTask));
          } catch (err) {
            const status = (err as AxiosError).response?.status;
            if (status !== 403 && status !== 404 && status !== 410) continue;
          }
          set((state) => ({
            tasksByConversation: {
              ...state.tasksByConversation,
              [conversationId]: (state.tasksByConversation[conversationId] || []).filter((t) => t.id !== task.id),
            },
          }));
        }

        const res = await api.get(`/conversations/${conversationId}/tasks`);
        set((state) => ({
          tasksByConversation: { ...state.tasksByConversation, [conversationId]: res.data as Task[] },
        }));
      },

      loadMyTasks: async () => {
        const res = await api.get("/tasks/mine");
        const grouped: Record<string, Task[]> = {};
        (res.data as Task[]).forEach((t) => {
          (grouped[t.conversationId] ||= []).push(t);
        });
        // Keep any not-yet-uploaded ones; they're uploaded when their chat opens.
        Object.entries(get().tasksByConversation).forEach(([cid, list]) => {
          const legacy = list.filter((t) => isLegacyTaskId(t.id));
          if (legacy.length) grouped[cid] = [...legacy, ...(grouped[cid] || [])];
        });
        set({ tasksByConversation: grouped });
      },

      createTask: async (input) => {
        const res = await api.post(`/conversations/${input.conversationId}/tasks`, {
          title: input.title,
          description: input.description || "",
          assigneeId: input.assigneeId ?? null,
          dueAt: input.dueAt ?? null,
          priority: input.priority || "MEDIUM",
          status: input.status || "TODO",
          isReminder: input.isReminder || false,
          sourceMessageId: input.sourceMessageId ?? null,
          sourceMessageSnippet: input.sourceMessageSnippet ?? null,
          attachments: input.attachments || [],
        });
        const task = res.data as Task;
        get().applyTaskEvent({ type: "upsert", task });
        return task;
      },

      updateTask: async (conversationId, taskId, patch) => {
        const before = (get().tasksByConversation[conversationId] || []).find((t) => t.id === taskId);
        if (!before) return;
        const next = { ...before, ...patch };
        get().applyTaskEvent({ type: "upsert", task: next });
        try {
          const res = await api.put(`/conversations/${conversationId}/tasks/${taskId}`, toTaskRequest(next));
          get().applyTaskEvent({ type: "upsert", task: res.data as Task });
        } catch (err) {
          get().applyTaskEvent({ type: "upsert", task: before });
          throw err;
        }
      },

      deleteTask: async (conversationId, taskId) => {
        const before = (get().tasksByConversation[conversationId] || []).find((t) => t.id === taskId);
        get().applyTaskEvent({ type: "delete", taskId, conversationId });
        try {
          await api.delete(`/conversations/${conversationId}/tasks/${taskId}`);
        } catch (err) {
          if (before) get().applyTaskEvent({ type: "upsert", task: before });
          throw err;
        }
      },

      applyTaskEvent: (event) => {
        set((state) => {
          const cid = event.type === "upsert" ? event.task.conversationId : event.conversationId;
          const list = state.tasksByConversation[cid] || [];
          const next =
            event.type === "upsert" ? withTask(list, event.task) : list.filter((t) => t.id !== event.taskId);
          return { tasksByConversation: { ...state.tasksByConversation, [cid]: next } };
        });
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
    {
      name: "ping-workspace",
      // Shared tasks come from the server on every visit and aren't kept in
      // this browser: on a shared computer, the next person to sign in must
      // not find the last person's task list here. Only tasks not yet
      // uploaded are kept, so they survive until they are.
      partialize: (state) => ({
        ...state,
        tasksByConversation: Object.fromEntries(
          Object.entries(state.tasksByConversation)
            .map(([cid, list]) => [cid, list.filter((t) => isLegacyTaskId(t.id))] as const)
            .filter(([, list]) => list.length > 0)
        ),
      }),
    }
  )
);

export default useWorkspaceStore;
