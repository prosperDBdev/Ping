"use client";

import { useEffect, useRef, useState } from "react";
import { formatFileSize } from "@/lib/time";

interface ImagePreviewModalProps {
  file: File;
  isSending: boolean;
  onSend: (caption: string) => void;
  onCancel: () => void;
}

/**
 * Confirmation step between picking a photo and sending it.
 *
 * Picking a file used to send it immediately, which gives you no chance to
 * check you chose the right one, and no way to say anything about it. The
 * caption typed here becomes the message's own text, so an image and the words
 * about it stay one message instead of two.
 */
export default function ImagePreviewModal({
  file,
  isSending,
  onSend,
  onCancel,
}: ImagePreviewModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Local preview only — the file hasn't been uploaded yet, so this reads
    // the bytes already sitting in the browser rather than fetching anything.
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0">
        <button
          onClick={onCancel}
          disabled={isSending}
          aria-label="Cancel"
          className="w-9 h-9 rounded-full flex items-center justify-center text-white/80 hover:bg-white/10 transition disabled:opacity-40"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <p className="text-xs text-white/50 truncate max-w-[60%]">
          {file.name} · {formatFileSize(file.size)}
        </p>
        <div className="w-9" />
      </div>

      {/* Preview */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-5">
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={file.name}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        )}
      </div>

      {/* Caption + send */}
      <div className="flex-shrink-0 p-4 flex items-center gap-3">
        <input
          ref={inputRef}
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !isSending) onSend(caption.trim());
            if (e.key === "Escape" && !isSending) onCancel();
          }}
          placeholder="Add a caption..."
          disabled={isSending}
          className="flex-1 bg-white/10 text-white placeholder-white/40 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ping-orange/50 disabled:opacity-60"
        />
        <button
          onClick={() => onSend(caption.trim())}
          disabled={isSending}
          aria-label="Send photo"
          className="w-12 h-12 rounded-full bg-ping-orange hover:bg-ping-orange-light transition flex items-center justify-center flex-shrink-0 disabled:opacity-60"
        >
          {isSending ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5 text-white translate-x-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
