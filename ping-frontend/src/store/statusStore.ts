import { create } from "zustand";
import { Status, StatusFeedEntry } from "@/types";
import {
  createImageStatus,
  createTextStatus,
  deleteStatus as deleteStatusApi,
  fetchMyStatuses,
  fetchStatusFeed,
  markStatusViewed,
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
  reshare: (statusId: string) => Promise<void>;
  remove: (statusId: string) => Promise<void>;
}

const useStatusStore = create<StatusState>((set, get) => ({
  feed: [],
  mine: [],
  isLoading: false,
  failed: false,

  /**
   * The feed and your own statuses are fetched together because the UI shows
   * them in one row — "Your status" sits at the head of the same list of
   * rings, and loading them separately would make that row assemble in two
   * visible steps.
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
   * The ring turning grey the instant you open something is the whole point of
   * the interaction, and waiting for a round-trip to do it feels broken. If
   * the call fails the next load() corrects it — the cost of being briefly
   * wrong about a read receipt is nothing, unlike being wrong about who can
   * see a post, which is why that decision is never made here.
   */
  markViewed: async (statusId: string) => {
    set((state) => ({
      feed: state.feed.map((entry) => {
        const statuses = entry.statuses.map((s) =>
          s.id === statusId ? { ...s, viewed: true } : s
        );
        return { ...entry, statuses, hasUnviewed: statuses.some((s) => !s.viewed) };
      }),
    }));

    try {
      await markStatusViewed(statusId);
    } catch {
      // Deliberately silent — see above.
    }
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
