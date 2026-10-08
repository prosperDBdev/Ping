import { useOfflineQueueStore } from "../store/offlineQueueStore";

describe("Offline Message Queue Store", () => {
  beforeEach(() => {
    useOfflineQueueStore.getState().clearQueue();
  });

  it("enqueues an offline message correctly", () => {
    useOfflineQueueStore.getState().enqueueMessage({
      conversationId: "conv-123",
      content: "Hello offline world",
      type: "TEXT",
    });

    const queue = useOfflineQueueStore.getState().queuedMessages;
    expect(queue.length).toBe(1);
    expect(queue[0].content).toBe("Hello offline world");
    expect(queue[0].conversationId).toBe("conv-123");
  });

  it("removes a specific message from queue after sending", () => {
    useOfflineQueueStore.getState().enqueueMessage({
      conversationId: "conv-123",
      content: "Message 1",
      type: "TEXT",
    });
    useOfflineQueueStore.getState().enqueueMessage({
      conversationId: "conv-123",
      content: "Message 2",
      type: "TEXT",
    });

    const queueBefore = useOfflineQueueStore.getState().queuedMessages;
    expect(queueBefore.length).toBe(2);

    const firstMsgId = queueBefore[0].id;
    useOfflineQueueStore.getState().removeMessage(firstMsgId);

    const queueAfter = useOfflineQueueStore.getState().queuedMessages;
    expect(queueAfter.length).toBe(1);
    expect(queueAfter[0].content).toBe("Message 2");
  });

  it("clears all queued messages on clearQueue", () => {
    useOfflineQueueStore.getState().enqueueMessage({
      conversationId: "conv-123",
      content: "Test message",
      type: "TEXT",
    });

    useOfflineQueueStore.getState().clearQueue();
    expect(useOfflineQueueStore.getState().queuedMessages.length).toBe(0);
  });
});
