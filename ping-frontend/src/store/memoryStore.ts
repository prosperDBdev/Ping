import { create } from "zustand";
import api from "@/lib/api";
import { Memory, MemoryCategory } from "@/types";

/**
 * Backed by the real /api/memories endpoints (Stage 7) — unlike
 * workspaceStore's Tasks/Events/Pins, memories don't need a client-only
 * fallback, since MemoryController/MemoryService already exist server-side.
 */
interface MemoryState {
  memories: Memory[];
  isLoading: boolean;
  categoryFilter: MemoryCategory | null;
  searchQuery: string;

  fetchMemories: () => Promise<void>;
  setCategoryFilter: (category: MemoryCategory | null) => void;
  setSearchQuery: (query: string) => void;
  saveMemory: (messageId: string, category: MemoryCategory) => Promise<Memory>;
  deleteMemory: (id: string) => Promise<void>;
}

const useMemoryStore = create<MemoryState>((set, get) => ({
  memories: [],
  isLoading: false,
  categoryFilter: null,
  searchQuery: "",

  fetchMemories: async () => {
    const { categoryFilter, searchQuery } = get();
    set({ isLoading: true });
    try {
      const res = await api.get("/memories", {
        params: {
          category: categoryFilter || undefined,
          q: searchQuery.trim() || undefined,
        },
      });
      set({ memories: res.data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  setCategoryFilter: (category) => {
    set({ categoryFilter: category });
    get().fetchMemories();
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
    get().fetchMemories();
  },

  saveMemory: async (messageId, category) => {
    const res = await api.post("/memories", { messageId, category });
    const memory: Memory = res.data;
    set((state) => ({ memories: [memory, ...state.memories] }));
    return memory;
  },

  deleteMemory: async (id) => {
    await api.delete(`/memories/${id}`);
    set((state) => ({ memories: state.memories.filter((m) => m.id !== id) }));
  },
}));

export default useMemoryStore;
