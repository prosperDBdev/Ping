"use client";

import { useEffect, useRef, useState } from "react";
import { fetchVoiceNoteBlobUrl } from "@/lib/media";

interface VoiceMessagePlayerProps {
  attachmentKey: string;
  durationSeconds: number | null;
  isMine: boolean;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Fetches the audio lazily — only when the user actually presses play — rather
 * than downloading every voice note in a conversation the moment it renders.
 * A long chat history with several voice notes would otherwise mean fetching
 * (and holding, decoded, in memory) every single one on load.
 */
export default function VoiceMessagePlayer({
  attachmentKey,
  durationSeconds,
  isMine,
}: VoiceMessagePlayerProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [isPlaying, setIsPlaying] = useState(false);
  const [progressSeconds, setProgressSeconds] = useState(0);
  // The <audio> element's src comes from this state, not a ref — render output
  // has to come from state/props, never from reading a ref's .current directly.
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // A ref mirroring the same URL, touched only in the unmount cleanup below —
  // effects and event handlers are allowed to read refs, render is not.
  const blobUrlRef = useRef<string | null>(null);

  // Release the blob URL when this player is no longer on screen — otherwise
  // every voice note ever played in this tab keeps its decoded audio pinned
  // in memory for the lifetime of the page.
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const handleToggle = async () => {
    if (status === "idle" || status === "error") {
      setStatus("loading");
      try {
        const url = await fetchVoiceNoteBlobUrl(attachmentKey);
        blobUrlRef.current = url;
        setBlobUrl(url);
        setStatus("ready");
        // Wait a tick for the <audio> element to mount with its new src.
        requestAnimationFrame(() => {
          audioRef.current?.play();
          setIsPlaying(true);
        });
      } catch {
        setStatus("error");
      }
      return;
    }

    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const barColor = isMine ? "bg-white/40" : "bg-ping-teal/30 dark:bg-ping-teal-light/30";
  const fillColor = isMine ? "bg-white" : "bg-ping-teal dark:bg-ping-teal-light";
  const totalSeconds = durationSeconds ?? 0;
  const progressPct = totalSeconds > 0 ? Math.min(100, (progressSeconds / totalSeconds) * 100) : 0;

  return (
    <div className="flex items-center gap-2.5 min-w-[180px]">
      <button
        onClick={handleToggle}
        aria-label={isPlaying ? "Pause voice note" : "Play voice note"}
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition ${
          isMine ? "bg-white/20 hover:bg-white/30" : "bg-ping-teal/15 hover:bg-ping-teal/25 dark:bg-ping-teal-light/15"
        }`}
      >
        {status === "loading" ? (
          <div className={`w-3.5 h-3.5 border-2 rounded-full animate-spin ${isMine ? "border-white/30 border-t-white" : "border-ping-teal/30 border-t-ping-teal dark:border-t-ping-teal-light"}`} />
        ) : isPlaying ? (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className={`h-1.5 rounded-full overflow-hidden ${barColor}`}>
          <div className={`h-full rounded-full transition-all ${fillColor}`} style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <span className={`text-[11px] font-medium tabular-nums flex-shrink-0 ${isMine ? "text-white/80" : "text-ping-text-light dark:text-ping-night-text-light"}`}>
        {status === "error" ? "!" : formatTime(isPlaying || progressSeconds > 0 ? progressSeconds : totalSeconds)}
      </span>

      {status === "ready" && (
        <audio
          ref={audioRef}
          src={blobUrl ?? undefined}
          onTimeUpdate={(e) => setProgressSeconds(e.currentTarget.currentTime)}
          onEnded={() => {
            setIsPlaying(false);
            setProgressSeconds(0);
          }}
          className="hidden"
        />
      )}
    </div>
  );
}
