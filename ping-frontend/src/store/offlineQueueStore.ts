import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface QueuedMessage {
  id: string;
  conversationId: string;
  content: string;
  type: string;
  attachment?: {
    key: string;
    mimeType: string;
    sizeBytes: number;
    durationSeconds?: number;
    fileName?: string;
  };
  queuedAt: number;
}

interface OfflineQueueState {
  queuedMessages: QueuedMessage[];
  enqueueMessage: (message: Omit<QueuedMessage, "id" | "queuedAt">) => void;
  removeMessage: (id: string) => void;
  clearQueue: () => void;
}

export const useOfflineQueueStore = create<OfflineQueueState>()(
  persist(
    (set) => ({
      queuedMessages: [],

      enqueueMessage: (msg) => {
        const newMessage: QueuedMessage = {
          ...msg,
          id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          queuedAt: Date.now(),
        };
        set((state) => ({
          queuedMessages: [...state.queuedMessages, newMessage],
        }));
      },

      removeMessage: (id) => {
        set((state) => ({
          queuedMessages: state.queuedMessages.filter((m) => m.id !== id),
        }));
      },

      clearQueue: () => set({ queuedMessages: [] }),
    }),
    {
      name: "ping-offline-queue",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
