"use client";

import { createContext, useContext, useMemo } from "react";
import useWebSocket from "@/hooks/useWebSocket";

type Realtime = ReturnType<typeof useWebSocket>;

const RealtimeContext = createContext<Realtime | null>(null);

/**
 * One live connection for the whole app.
 *
 * The WebSocket used to be opened by the Chats page itself, so it existed only
 * while that page was on screen. Leaving it closed the connection, which had
 * two visible effects:
 *
 *   - New messages arrived silently on Home, Moments and Settings. The unread
 *     counter only moves when the socket delivers a message, so there was no
 *     badge until the page reloaded.
 *   - You showed as offline to everyone the moment you left Chats, because
 *     presence is counted per open connection.
 *
 * Mounted once in the root layout, it connects when someone signs in and
 * disconnects when they sign out (the hook keys off the user and token), and
 * stays up across every page in between. Pages that need to send things use
 * useRealtime() rather than opening a connection of their own. A second
 * connection would be a parallel system to keep in step with this one.
 */
export default function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const {
    isConnected,
    sendMessage,
    sendTyping,
    sendRead,
    onTyping,
    inviteToTemporaryChat,
    respondToTemporaryChat,
    onTemporaryChatInvite,
    onTemporaryChatResponse,
    onRemovedFromConversation,
  } = useWebSocket();

  // Every function here is stable (useCallback inside the hook), so the value
  // only changes when the connection state does. Without this, every chat
  // store update would hand consumers a new object and re-render them.
  const value = useMemo(
    () => ({
      isConnected,
      sendMessage,
      sendTyping,
      sendRead,
      onTyping,
      inviteToTemporaryChat,
      respondToTemporaryChat,
      onTemporaryChatInvite,
      onTemporaryChatResponse,
      onRemovedFromConversation,
    }),
    [
      isConnected,
      sendMessage,
      sendTyping,
      sendRead,
      onTyping,
      inviteToTemporaryChat,
      respondToTemporaryChat,
      onTemporaryChatInvite,
      onTemporaryChatResponse,
      onRemovedFromConversation,
    ]
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): Realtime {
  const realtime = useContext(RealtimeContext);
  if (!realtime) {
    throw new Error("useRealtime() must be used inside <RealtimeProvider>");
  }
  return realtime;
}
