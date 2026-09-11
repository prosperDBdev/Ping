"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { Message } from "@/types";
import { buildReplyQuote, parseReplyQuote, snippetFor } from "@/lib/messageActions";
import useVoiceRecorder, { VoiceRecordingResult } from "@/hooks/useVoiceRecorder";
import AttachmentMenu from "@/components/chat/AttachmentMenu";
import CameraCaptureModal from "@/components/chat/CameraCaptureModal";
import ImagePreviewModal from "@/components/chat/ImagePreviewModal";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES, uploadImage, uploadVoiceNote } from "@/lib/media";

// Conservative on purpose — see the earlier discussion on staying comfortably
// inside R2's free tier. This is what actually keeps files small in practice;
// the 8MB server-side cap is just the backstop for someone bypassing this.
const MAX_VOICE_NOTE_SECONDS = 60;

export interface SentVoiceAttachment {
  key: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number;
}

export interface SentImageAttachment {
  /** Optional text typed alongside the photo — becomes the message body. */
  caption: string;
  key: string;
  mimeType: string;
  sizeBytes: number;
  fileName: string;
}

interface MessageInputProps {
  /** Returns false if the message couldn't be sent (socket not connected). */
  onSend: (content: string) => boolean;
  onSendVoice: (attachment: SentVoiceAttachment) => void;
  onSendImage: (attachment: SentImageAttachment) => void;
  onTyping: (isTyping: boolean) => void;
  recipientName?: string;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
}

function formatTimer(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function MessageInput({
  onSend,
  onSendVoice,
  onSendImage,
  onTyping,
  recipientName,
  replyingTo,
  onCancelReply,
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleRecordingComplete = useCallback(
    async (result: VoiceRecordingResult) => {
      setIsUploadingVoice(true);
      try {
        const uploaded = await uploadVoiceNote(result.blob);
        onSendVoice({ ...uploaded, durationSeconds: result.durationSeconds });
      } catch (err) {
        // Surface the backend's actual rejection reason (e.g. "Unsupported
        // audio type: ...") instead of a generic message — a silent catch
        // here is exactly what made the last bug take longer to track down
        // than it needed to.
        const message =
          axios.isAxiosError(err) && typeof err.response?.data?.message === "string"
            ? err.response.data.message
            : "Couldn't send that voice note — try again.";
        toast.error(message);
      } finally {
        setIsUploadingVoice(false);
      }
    },
    [onSendVoice]
  );

  // Staging only — nothing uploads until the preview is confirmed. Picking a
  // photo used to fire it off immediately, with no chance to check you'd
  // chosen the right one or to say anything about it.
  const handleImageSelected = useCallback((file: File) => {
    // Fail fast on something obviously too big rather than making someone
    // wait through an upload that the server is going to reject anyway. The
    // server enforces the same cap — this is UX, not security.
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("That image is over 10MB — pick a smaller one.");
      return;
    }
    setPendingImage(file);
  }, []);

  const handleSendPendingImage = useCallback(
    async (caption: string) => {
      if (!pendingImage) return;

      setIsUploadingImage(true);
      try {
        const uploaded = await uploadImage(pendingImage);
        // Pass the server's reported mimeType/size, not the File's: images are
        // re-encoded and downscaled server-side, so the File's own values
        // describe something that no longer exists.
        onSendImage({ ...uploaded, fileName: pendingImage.name, caption });
        setPendingImage(null);
      } catch (err) {
        const message =
          axios.isAxiosError(err) && typeof err.response?.data?.message === "string"
            ? err.response.data.message
            : "Couldn't send that image — try again.";
        toast.error(message);
      } finally {
        setIsUploadingImage(false);
      }
    },
    [pendingImage, onSendImage]
  );

  const recorder = useVoiceRecorder({
    maxDurationSeconds: MAX_VOICE_NOTE_SECONDS,
    onRecordingComplete: handleRecordingComplete,
  });

  useEffect(() => {
    if (recorder.error) toast.error(recorder.error);
  }, [recorder.error]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    onTyping(true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => onTyping(false), 2000);
  };

  const handleSend = useCallback(() => {
    if (!message.trim()) return;
    const trimmed = message.trim();
    const finalContent = replyingTo
      ? buildReplyQuote(
          replyingTo.senderUsername,
          snippetFor(parseReplyQuote(replyingTo.content).body, 60),
          trimmed
        )
      : trimmed;

    // Only clear the composer once the message has actually gone out. It used
    // to clear unconditionally, so a send attempted while the socket was
    // reconnecting wiped what you'd typed and sent nothing.
    if (!onSend(finalContent)) {
      toast.error("Not connected — your message wasn't sent. Try again in a moment.");
      return;
    }

    setMessage("");
    onTyping(false);
    onCancelReply?.();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }, [message, onSend, onTyping, replyingTo, onCancelReply]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape" && replyingTo) {
      onCancelReply?.();
    }
  };

  return (
    <div className="px-5 py-4 bg-ping-cream dark:bg-ping-night-bg border-t border-ping-sand/60 dark:border-ping-night-border">
      {cameraOpen && (
        <CameraCaptureModal
          onCapture={(file) => {
            setCameraOpen(false);
            // Straight into the same preview step a picked photo gets, so a
            // shot you're unhappy with can still be discarded before sending.
            handleImageSelected(file);
          }}
          onClose={() => setCameraOpen(false)}
        />
      )}

      {pendingImage && (
        <ImagePreviewModal
          file={pendingImage}
          isSending={isUploadingImage}
          onSend={handleSendPendingImage}
          onCancel={() => setPendingImage(null)}
        />
      )}

      {replyingTo && !recorder.isRecording && (
        <div className="mb-2.5 flex items-center justify-between gap-2 bg-ping-sage/70 dark:bg-ping-night-sage/70 border border-ping-sage-border dark:border-ping-night-border rounded-xl pl-3.5 pr-2 py-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-ping-teal dark:text-ping-teal-light uppercase tracking-wide">
              Replying to {replyingTo.senderUsername}
            </p>
            <p className="text-xs text-ping-dark/70 dark:text-ping-night-text/70 truncate">
              {parseReplyQuote(replyingTo.content).body}
            </p>
          </div>
          <button
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="w-6 h-6 rounded-full flex items-center justify-center text-ping-text-light dark:text-ping-night-text-light hover:bg-white/60 dark:hover:bg-black/20 transition flex-shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {recorder.isRecording ? (
        <div className="bg-[#EFEAE2] dark:bg-ping-night-surface border border-[#E3DDD3] dark:border-ping-night-border rounded-2xl px-4 py-2.5 flex items-center gap-3 shadow-xs">
          <button
            onClick={recorder.cancel}
            aria-label="Cancel recording"
            className="text-ping-text-light dark:text-ping-night-text-light hover:text-red-500 transition flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex-1 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            <span className="text-sm font-semibold text-ping-dark dark:text-ping-night-text tabular-nums">
              {formatTimer(recorder.elapsedSeconds)}
            </span>
            <span className="text-xs text-ping-text-light dark:text-ping-night-text-light">
              / {formatTimer(MAX_VOICE_NOTE_SECONDS)}
            </span>
          </div>

          <button
            onClick={recorder.stop}
            aria-label="Stop and send"
            className="w-9 h-9 bg-ping-orange rounded-full flex items-center justify-center text-white hover:bg-ping-orange-light transition flex-shrink-0 shadow-xs"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="bg-[#EFEAE2] dark:bg-ping-night-surface border border-[#E3DDD3] dark:border-ping-night-border rounded-2xl px-4 py-2.5 flex items-center gap-3 shadow-xs">
          {/* Attachment */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Reset immediately so picking the same file twice in a row still
              // fires a change event.
              e.target.value = "";
              if (file) handleImageSelected(file);
            }}
          />
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setAttachMenuOpen((open) => !open)}
              disabled={isUploadingImage}
              aria-label="Attach"
              aria-haspopup="menu"
              aria-expanded={attachMenuOpen}
              className="text-ping-text-light dark:text-ping-night-text-light hover:text-ping-dark dark:hover:text-ping-night-text transition disabled:opacity-40 flex items-center"
            >
              {isUploadingImage ? (
                <div className="w-5 h-5 border-2 border-ping-text-light/30 border-t-ping-teal rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
              )}
            </button>

            {attachMenuOpen && (
              <AttachmentMenu
                onPickPhoto={() => fileInputRef.current?.click()}
                onTakePhoto={() => setCameraOpen(true)}
                onRecordVoice={recorder.start}
                onClose={() => setAttachMenuOpen(false)}
              />
            )}
          </div>

          {/* Input */}
          <input
            type="text"
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={isUploadingVoice}
            placeholder={replyingTo ? "Write your reply..." : "Write something worth sending..."}
            className="flex-1 bg-transparent text-sm text-ping-dark dark:text-ping-night-text placeholder-ping-text-light/60 dark:placeholder-ping-night-text-light/60 focus:outline-none disabled:opacity-50"
          />

          {message.trim() ? (
            /* Send */
            <button
              onClick={handleSend}
              className="w-9 h-9 bg-ping-orange rounded-full flex items-center justify-center text-white hover:bg-ping-orange-light transition flex-shrink-0 shadow-xs"
            >
              <svg className="w-4 h-4 translate-x-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          ) : isUploadingVoice ? (
            <div className="w-9 h-9 flex items-center justify-center flex-shrink-0">
              <div className="w-4 h-4 border-2 border-ping-sand dark:border-ping-night-border border-t-ping-orange rounded-full animate-spin" />
            </div>
          ) : (
            /* Mic — only meaningful when there's no text being typed */
            <button
              onClick={recorder.start}
              aria-label="Record a voice note"
              className="text-ping-text-light dark:text-ping-night-text-light hover:text-ping-dark dark:hover:text-ping-night-text transition flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            </button>
          )}
        </div>
      )}

      <p className="text-[10px] font-medium text-ping-text-light dark:text-ping-night-text-light mt-2 text-center">
        {recorder.isRecording
          ? "Recording... tap the checkmark to send, or the X to cancel"
          : "Press Enter to send · Shift + Enter for a new line"}
      </p>
    </div>
  );
}
