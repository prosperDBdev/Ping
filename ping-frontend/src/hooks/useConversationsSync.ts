"use client";

import { useEffect } from "react";
import useChatStore from "@/store/chatStore";

/**
 * Keeps the conversation list current for any page that shows it.
 *
 * This exists as a hook rather than an effect copied into each page because
 * that copying is exactly what caused a bug: the chat page had recovery
 * behaviour and the dashboard didn't, so opening the app on the dashboard
 * while the backend was still starting left it stuck on "No conversations
 * yet" until you signed out and back in. Anything that lists conversations
 * should call this and get the same behaviour for free.
 *
 * Two layers of recovery, deliberately:
 *  - the store retries a failed fetch a few times (handles a backend that is
 *    seconds away from being ready);
 *  - returning to the tab refetches (handles a backend that took longer than
 *    that, or went away and came back).
 */
export default function useConversationsSync() {
  const fetchConversations = useChatStore((s) => s.fetchConversations);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    const refetchIfVisible = () => {
      if (document.visibilityState === "visible") void fetchConversations();
    };

    document.addEventListener("visibilitychange", refetchIfVisible);
    window.addEventListener("focus", refetchIfVisible);
    return () => {
      document.removeEventListener("visibilitychange", refetchIfVisible);
      window.removeEventListener("focus", refetchIfVisible);
    };
  }, [fetchConversations]);
}
