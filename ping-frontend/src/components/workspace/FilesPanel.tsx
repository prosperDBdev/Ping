"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Conversation } from "@/types";
import EmptyState from "@/components/workspace/EmptyState";
import { formatFileSize } from "@/lib/time";
import {
  ConversationMediaItem,
  fetchConversationMedia,
  fetchMediaBlobUrl,
} from "@/lib/media";

interface FilesPanelProps {
  conversation: Conversation;
  onJumpToMessage?: (messageId: string) => void;
}

function isImage(mimeType: string) {
  return mimeType.startsWith("image/");
}

function isAudio(mimeType: string) {
  return mimeType.startsWith("audio/") || mimeType === "application/x-matroska";
}

function displayName(item: ConversationMediaItem) {
  if (item.fileName) return item.fileName;
  if (isAudio(item.mimeType)) return "Voice note";
  if (isImage(item.mimeType)) return "Photo";
  return "File";
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

/**
 * Every file actually shared in this conversation.
 *
 * Fetched from the server rather than derived from the loaded message list:
 * the message store only holds the page currently in view, so anything shared
 * further back would silently vanish from this panel.
 */
export default function FilesPanel({ conversation, onJumpToMessage }: FilesPanelProps) {
  const [files, setFiles] = useState<ConversationMediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setFailed(false);

    fetchConversationMedia(conversation.id)
      .then((items) => {
        if (!cancelled) setFiles(items);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [conversation.id]);

  // Downloads go through the authenticated api instance rather than a plain
  // link, for the same reason images do: the endpoint needs a JWT the browser
  // won't attach on its own. Fetch the bytes, then hand the browser a blob URL
  // and revoke it once the click has been dispatched.
  const handleDownload = useCallback(async (item: ConversationMediaItem) => {
    try {
      const url = await fetchMediaBlobUrl(item.key);
      const link = document.createElement("a");
      link.href = url;
      link.download = displayName(item);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Couldn't download that file.");
    }
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 sm:px-6 pt-4 pb-3 flex-shrink-0">
        <h3 className="text-base font-black text-ping-dark dark:text-ping-night-text">Files</h3>
        <p className="text-xs text-ping-text-light dark:text-ping-night-text-light">
          {isLoading
            ? "Loading…"
            : `${files.length} file${files.length !== 1 ? "s" : ""} shared in this conversation`}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 sm:px-6 pb-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-ping-sand dark:border-ping-night-border border-t-ping-teal rounded-full animate-spin" />
          </div>
        ) : failed ? (
          <p className="text-center text-xs text-ping-text-light dark:text-ping-night-text-light py-10">
            Couldn&apos;t load files for this conversation.
          </p>
        ) : files.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            }
            title="No files yet"
            description="Photos and voice notes shared in this conversation collect here, so you don't have to scroll back to find them."
          />
        ) : (
          <div className="space-y-1.5 pt-1">
            {files.map((f) => (
              <div
                key={f.key}
                className="flex items-center gap-3 bg-white dark:bg-ping-night-card rounded-2xl border border-ping-sand/60 dark:border-ping-night-border p-3.5"
              >
                <div className="w-10 h-10 rounded-xl bg-ping-cream-dark dark:bg-ping-night-card-active flex items-center justify-center text-ping-teal dark:text-ping-teal-light flex-shrink-0">
                  {isImage(f.mimeType) ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                  ) : isAudio(f.mimeType) ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-ping-dark dark:text-ping-night-text truncate">
                    {displayName(f)}
                  </p>
                  <button
                    onClick={() => onJumpToMessage?.(f.messageId)}
                    className="text-xs text-ping-text-light dark:text-ping-night-text-light hover:text-ping-teal dark:hover:text-ping-teal-light transition truncate text-left"
                  >
                    {formatFileSize(f.sizeBytes)} · {f.senderUsername} · {formatWhen(f.createdAt)}
                  </button>
                </div>

                <button
                  onClick={() => handleDownload(f)}
                  aria-label={`Download ${displayName(f)}`}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-ping-text-light dark:text-ping-night-text-light hover:bg-ping-cream-dark dark:hover:bg-ping-night-card-active transition flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
