"use client";

import { useRef, useState } from "react";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/media";
import { STATUS_COLORS } from "@/lib/status";
import useStatusStore from "@/store/statusStore";

/**
 * Compose a status — words on a colour, or an image with an optional caption.
 *
 * The file checks below duplicate limits the backend already enforces. That
 * duplication is intentional and one-directional: these exist so picking a
 * 40MB photo fails instantly instead of after a long upload, and they are
 * never the thing that keeps a bad file out. The server re-detects the real
 * type from the bytes and re-encodes the image regardless of what this said.
 */
export default function StatusComposer({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"TEXT" | "IMAGE">("TEXT");
  const [text, setText] = useState("");
  const [colour, setColour] = useState(STATUS_COLORS[0]);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const postText = useStatusStore((s) => s.postText);
  const postImage = useStatusStore((s) => s.postImage);

  const pickFile = (picked: File | null) => {
    setError(null);
    if (!picked) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(picked.type)) {
      setError("Pick a JPEG, PNG or WebP image.");
      return;
    }
    if (picked.size > MAX_IMAGE_BYTES) {
      setError("That image is over the 10MB limit.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
  };

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === "TEXT") {
        if (!text.trim()) {
          setError("Write something first.");
          setBusy(false);
          return;
        }
        await postText(text.trim(), colour);
      } else {
        if (!file) {
          setError("Choose an image first.");
          setBusy(false);
          return;
        }
        await postImage(file, caption);
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      onClose();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Couldn't post that status.";
      setError(message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-ping-night-card rounded-2xl border border-ping-sand/60 dark:border-ping-night-border w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ping-sand/60 dark:border-ping-night-border">
          <p className="text-sm font-bold text-ping-dark dark:text-ping-night-text">New status</p>
          <button
            onClick={onClose}
            className="text-ping-text-light dark:text-ping-night-text-light hover:opacity-70"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex gap-2 px-5 pt-4">
          {(["TEXT", "IMAGE"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`text-xs font-bold px-4 py-2 rounded-xl transition ${
                mode === m
                  ? "bg-ping-teal text-white"
                  : "bg-ping-cream-dark dark:bg-ping-night-bg text-ping-text-light dark:text-ping-night-text-light"
              }`}
            >
              {m === "TEXT" ? "Text" : "Photo"}
            </button>
          ))}
        </div>

        <div className="p-5">
          {mode === "TEXT" ? (
            <>
              <div
                className="rounded-xl p-6 mb-4 min-h-[9rem] flex items-center justify-center"
                style={{ backgroundColor: colour }}
              >
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 700))}
                  placeholder="Say something…"
                  className="w-full bg-transparent text-white text-center text-lg font-bold placeholder-white/50 resize-none focus:outline-none"
                  rows={3}
                />
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {STATUS_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColour(c)}
                    aria-label={`Background ${c}`}
                    className={`w-7 h-7 rounded-full transition ${
                      colour === c ? "ring-2 ring-offset-2 ring-ping-teal dark:ring-offset-ping-night-card" : ""
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <p className="text-[11px] text-ping-text-light dark:text-ping-night-text-light">
                {text.length}/700
              </p>
            </>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_IMAGE_TYPES.join(",")}
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
              {previewUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element -- local blob: preview */
                <img
                  src={previewUrl}
                  alt="Selected"
                  className="w-full max-h-64 object-contain rounded-xl bg-ping-cream-dark dark:bg-ping-night-bg mb-3"
                />
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-40 rounded-xl border-2 border-dashed border-ping-sand dark:border-ping-night-border flex flex-col items-center justify-center gap-2 text-ping-text-light dark:text-ping-night-text-light hover:border-ping-teal transition mb-3"
                >
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V18a2 2 0 002 2h14a2 2 0 002-2v-1.5M12 3v13m0-13l-4 4m4-4l4 4" />
                  </svg>
                  <span className="text-xs font-semibold">Choose a photo</span>
                </button>
              )}
              {previewUrl && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] font-semibold text-ping-teal mb-3"
                >
                  Choose a different photo
                </button>
              )}
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, 700))}
                placeholder="Add a caption (optional)"
                className="w-full px-3.5 py-2.5 bg-ping-cream-dark dark:bg-ping-night-bg border border-ping-sand/60 dark:border-ping-night-border rounded-xl text-sm text-ping-dark dark:text-ping-night-text placeholder-ping-text-light/60 focus:outline-none focus:ring-2 focus:ring-ping-teal/30"
              />
            </>
          )}

          {error && <p className="text-xs text-red-500 mt-3">{error}</p>}

          <div className="flex justify-end gap-2 mt-5">
            <button
              onClick={onClose}
              className="text-xs font-semibold text-ping-text-light dark:text-ping-night-text-light px-4 py-2"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={busy}
              className="text-xs font-bold text-white bg-ping-orange hover:bg-ping-orange-light px-5 py-2 rounded-xl transition disabled:opacity-50"
            >
              {busy ? "Posting…" : "Post"}
            </button>
          </div>

          <p className="text-[11px] text-ping-text-light dark:text-ping-night-text-light mt-3">
            Visible for 24 hours to people you have a conversation with.
          </p>
        </div>
      </div>
    </div>
  );
}
