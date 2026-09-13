import { create } from "zustand";
import { Status, StatusFeedEntry } from "@/types";
import {
  createImageStatus,
  createTextStatus,
  deleteStatus as deleteStatusApi,
  fetchMyStatuses,
  fetchStatusFeed,
  markStatusViewed,
  reactToStatus,
  replyToStatus,
  reshareStatus as reshareStatusApi,
} from "@/lib/status";

interface StatusState {
  feed: StatusFeedEntry[];
  mine: Status[];
  isLoading: boolean;
  failed: boolean;

  load: () => Promise<void>;
  postText: (text: string, backgroundColor: string) => Promise<void>;
  postImage: (file: File, caption: string) => Promise<void>;
  markViewed: (statusId: string) => Promise<void>;
  react: (statusId: string, emoji: string) => Promise<void>;
  reply: (statusId: string, text: string) => Promise<void>;
  reshare: (statusId: string) => Promise<void>;
  remove: (statusId: string) => Promise<void>;
}

/** Apply a change to one status wherever it appears in the feed. */
function patchFeed(
  feed: StatusFeedEntry[],
  statusId: string,
  patch: (s: Status) => Status
): StatusFeedEntry[] {
  return feed.map((entry) => {
    const statuses = entry.statuses.map((s) => (s.id === statusId ? patch(s) : s));
    return { ...entry, statuses, hasUnviewed: statuses.some((s) => !s.viewed) };
  });
}

const useStatusStore = create<StatusState>((set, get) => ({
  feed: [],
  mine: [],
  isLoading: false,
  failed: false,

  /**
   * The feed and your own statuses are fetched together because the UI shows
   * them in one view — "Your status" sits at the head of the same list, and
   * loading them separately would make it assemble in two visible steps.
   */
  load: async () => {
    set({ isLoading: true });
    try {
      const [feed, mine] = await Promise.all([fetchStatusFeed(), fetchMyStatuses()]);
      set({ feed, mine, isLoading: false, failed: false });
    } catch {
      set({ isLoading: false, failed: true });
    }
  },

  postText: async (text: string, backgroundColor: string) => {
    const created = await createTextStatus(text, backgroundColor);
    set((state) => ({ mine: [...state.mine, created] }));
  },

  postImage: async (file: File, caption: string) => {
    const created = await createImageStatus(file, caption);
    set((state) => ({ mine: [...state.mine, created] }));
  },

  /**
   * Marked viewed optimistically.
   *
   * The ring greying out the instant you open something is the whole point of
   * the interaction, and waiting for a round-trip to do it feels broken. If the
   * call fails the next load() corrects it — the cost of being briefly wrong
   * about a read receipt is nothing, unlike being wrong about who can see a
   * post, which is why that decision is never made here.
   */
  markViewed: async (statusId: string) => {
    set((state) => ({ feed: patchFeed(state.feed, statusId, (s) => ({ ...s, viewed: true })) }));
    try {
      await markStatusViewed(statusId);
    } catch {
      // Deliberately silent — see above.
    }
  },

  /**
   * Also optimistic, but NOT silent on failure.
   *
   * The toggle is mirrored locally so the tap feels instant — same emoji as
   * the current one clears it, anything else replaces it. But unlike a read
   * receipt, a reaction is something the user chose to express: if the server
   * rejects it, quietly leaving the old state on screen would tell them their
   * reaction landed when it didn't. So the previous value is restored and the
   * error is rethrown for the viewer to show.
   */
  react: async (statusId: string, emoji: string) => {
    const previous = get()
      .feed.flatMap((e) => e.statuses)
      .find((s) => s.id === statusId)?.myReaction ?? null;
    const next = previous === emoji ? null : emoji;

    set((state) => ({
      feed: patchFeed(state.feed, statusId, (s) => ({ ...s, myReaction: next, viewed: true })),
    }));

    try {
      const updated = await reactToStatus(statusId, emoji);
      set((state) => ({
        feed: patchFeed(state.feed, statusId, (s) => ({ ...s, myReaction: updated.myReaction })),
      }));
    } catch (err) {
      set((state) => ({
        feed: patchFeed(state.feed, statusId, (s) => ({ ...s, myReaction: previous })),
      }));
      throw err;
    }
  },

  /**
   * Nothing in this store changes on a reply. It becomes a chat message, and
   * the chat store hears about it over the WebSocket like any other message —
   * so there's no status-side state to keep in step.
   */
  reply: async (statusId: string, text: string) => {
    await replyToStatus(statusId, text);
  },

  reshare: async (statusId: string) => {
    const created = await reshareStatusApi(statusId);
    set((state) => ({ mine: [...state.mine, created] }));
  },

  remove: async (statusId: string) => {
    await deleteStatusApi(statusId);
    set((state) => ({ mine: state.mine.filter((s) => s.id !== statusId) }));
    // A reshare of a deleted status stays alive on purpose (the backend keeps
    // the object until nothing references it), so the feed can still hold
    // copies of what was just removed. Refetching keeps that honest rather
    // than pruning by author id here and quietly getting it wrong.
    void get().load();
  },
}));

export default useStatusStore;
