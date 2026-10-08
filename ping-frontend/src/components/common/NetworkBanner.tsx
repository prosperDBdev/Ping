"use client";

import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import useOfflineQueueStore from "@/store/offlineQueueStore";

interface NetworkBannerProps {
  isWebSocketConnected?: boolean;
}

export default function NetworkBanner({ isWebSocketConnected = true }: NetworkBannerProps) {
  const { isOnline } = useNetworkStatus();
  const queuedCount = useOfflineQueueStore((s) => s.queuedMessages.length);

  const isDisconnected = !isOnline || !isWebSocketConnected;

  if (!isDisconnected && queuedCount === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`w-full py-1.5 px-4 text-xs font-semibold text-center flex items-center justify-center gap-2 transition-all ${
        !isOnline
          ? "bg-amber-600 text-white"
          : !isWebSocketConnected
          ? "bg-ping-coral text-white"
          : "bg-ping-teal text-white"
      }`}
    >
      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
      <span>
        {!isOnline
          ? "Offline — Internet connection lost."
          : !isWebSocketConnected
          ? "Reconnecting to Ping servers…"
          : "Flushing queued messages…"}
      </span>
      {queuedCount > 0 && (
        <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
          {queuedCount} message{queuedCount > 1 ? "s" : ""} queued
        </span>
      )}
    </div>
  );
}
