"use client";

import { useCallback, useEffect, useState } from "react";
import { Status, StatusFeedEntry } from "@/types";
import { STATUS_SLIDE_MS, fetchStatusViewers } from "@/lib/status";
import useStatusStore from "@/store/statusStore";
import StatusMedia from "./StatusMedia";
import { formatRelativeTime } from "@/lib/time";

interface StatusViewerProps {
  entries: StatusFeedEntry[];
  startEntryIndex: number;
  /** True when the viewer is paging through the signed-in user's own posts. */
  isOwn: boolean;
  onClose: () => void;
}

/**
 * Full-screen status viewer.
 *
 * Two things here are less obvious than they look:
 *
 * The auto-advance timer is keyed on the current slide, so opening a status
 * restarts it rather than inheriting whatever was left of the previous one. A
 * single shared interval would make the last slide of one person's set flash
 * past in whatever time remained on the clock.
 *
 * Marking a status viewed happens on display, not on close. If it only fired
 * when the viewer was dismissed, closing the tab mid-set — which is most of
 * how people actually leave — would lose every read receipt in it.
 */
export default function StatusViewer({
  entries,
  startEntryIndex,
  isOwn,
  onClose,
}: StatusViewerProps) {
  const [entryIndex, setEntryIndex] = useState(startEntryIndex);
  const [slideIndex, setSlideIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [viewers, setViewers] = useState<{ id: string; username: string }[] | null>(null);
  const [busy, setBusy] = useState(false);

  const markViewed = useStatusStore((s) => s.markViewed);
  const reshare = useStatusStore((s) => s.reshare);
  const remove = useStatusStore((s) => s.remove);

  const entry = entries[entryIndex];
  const status: Status | undefined = entry?.statuses[slideIndex];

  const goNext = useCallback(() => {
    setViewers(null);
    setEntryIndex((currentEntry) => {
      const current = entries[currentEntry];
      if (!current) return currentEntry;

      let nextSlide = 0;
      let nextEntry = currentEntry;

      setSlideIndex((currentSlide) => {
        if (currentSlide + 1 < current.statuses.length) {
          nextSlide = currentSlide + 1;
          return nextSlide;
        }
        nextEntry = currentEntry + 1;
        return 0;
      });

      if (nextEntry >= entries.length) {
        // Past the last person's last slide — the set is finished.
        onClose();
        return currentEntry;
      }
      return nextEntry;
    });
  }, [entries, onClose]);

  const goPrev = useCallback(() => {
    setViewers(null);
    setSlideIndex((currentSlide) => {
      if (currentSlide > 0) return currentSlide - 1;
      setEntryIndex((currentEntry) => {
        if (currentEntry === 0) return currentEntry;
        const previous = entries[currentEntry - 1];
        // Land on the previous person's LAST slide, so going back feels like
        // rewinding a single continuous reel rather than jumping to their start.
        setTimeout(() => setSlideIndex(Math.max(0, previous.statuses.length - 1)), 0);
        return currentEntry - 1;
      });
      return 0;
    });
  }, [entries]);

  // Record the view as soon as a slide is on screen.
  useEffect(() => {
    if (status && !isOwn && !status.viewed) {
      void markViewed(status.id);
    }
  }, [status, isOwn, markViewed]);

  // Auto-advance. Keyed on the slide so every one gets a full turn.
  useEffect(() => {
    if (!status || paused || viewers !== null) return;
    const timer = setTimeout(goNext, STATUS_SLIDE_MS);
    return () => clearTimeout(timer);
  }, [status, paused, viewers, goNext]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, onClose]);

  if (!entry || !status) return null;

  const openViewers = async () => {
    try {
      const list = await fetchStatusViewers(status.id);
      setViewers(list);
    } catch {
      setViewers([]);
    }
  };

  const doReshare = async () => {
    setBusy(true);
    try {
      await reshare(status.id);
      onClose();
    } catch {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await remove(status.id);
      onClose();
    } catch {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Progress bars — one per slide in this person's set */}
      <div className="flex gap-1 px-3 pt-3">
        {entry.statuses.map((s, i) => (
          <div key={s.id} className="flex-1 h-0.5 bg-white/25 rounded-full overflow-hidden">
            <div
              className={`h-full bg-white ${i < slideIndex ? "w-full" : i === slideIndex ? "w-full origin-left" : "w-0"}`}
              style={
                i === slideIndex && !paused && viewers === null
                  ? { animation: `statusProgress ${STATUS_SLIDE_MS}ms linear forwards` }
                  : undefined
              }
            />
          </div>
        ))}
      </div>

      <style>{`@keyframes statusProgress { from { transform: scaleX(0) } to { transform: scaleX(1) } }`}</style>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-8 h-8 rounded-full bg-slate-500 flex items-center justify-center text-white text-xs font-bold">
          {entry.authorUsername.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">
            {isOwn ? "Your status" : entry.authorUsername}
          </p>
          <p className="text-[11px] text-white/60">
            {formatRelativeTime(status.createdAt)}
            {status.resharedFromAuthorUsername && (
              <> · reshared from {status.resharedFromAuthorUsername}</>
            )}
          </p>
        </div>
        <button onClick={onClose} aria-label="Close" className="text-white/80 hover:text-white p-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Slide */}
      <div
        className="flex-1 relative flex items-center justify-center overflow-hidden"
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerLeave={() => setPaused(false)}
      >
        {status.type === "TEXT" ? (
          <div
            className="w-full h-full flex items-center justify-center p-10"
            style={{ backgroundColor: status.backgroundColor ?? "#1F7A6C" }}
          >
            <p className="text-white text-2xl sm:text-3xl font-bold text-center break-words max-w-2xl">
              {status.text}
            </p>
          </div>
        ) : (
          <>
            {status.mediaKey && (
              // Keyed so paging to the next image remounts rather than
              // reusing the previous one's state — see StatusMedia.
              <StatusMedia key={status.mediaKey} mediaKey={status.mediaKey} alt="Status" />
            )}
            {status.text && (
              <p className="absolute bottom-6 left-0 right-0 px-8 text-center text-white text-sm break-words">
                {status.text}
              </p>
            )}
          </>
        )}

        {/* Tap zones. Left third goes back, right two-thirds go forward. */}
        <button
          aria-label="Previous"
          onClick={goPrev}
          className="absolute inset-y-0 left-0 w-1/3 cursor-default"
        />
        <button
          aria-label="Next"
          onClick={goNext}
          className="absolute inset-y-0 right-0 w-2/3 cursor-default"
        />
      </div>

      {/* Footer actions */}
      <div className="px-4 py-4 flex items-center justify-center gap-3">
        {isOwn ? (
          <>
            <button
              onClick={openViewers}
              className="flex items-center gap-2 text-xs font-semibold text-white/90 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {status.viewerCount ?? 0} {status.viewerCount === 1 ? "view" : "views"}
            </button>
            <button
              onClick={doDelete}
              disabled={busy}
              className="text-xs font-semibold text-white/90 bg-white/10 hover:bg-red-500/70 px-4 py-2 rounded-xl transition disabled:opacity-50"
            >
              Delete
            </button>
          </>
        ) : status.reshareable ? (
          <button
            onClick={doReshare}
            disabled={busy}
            className="text-xs font-semibold text-white bg-ping-orange hover:bg-ping-orange-light px-5 py-2 rounded-xl transition disabled:opacity-50"
          >
            {busy ? "Resharing…" : "Reshare"}
          </button>
        ) : (
          // Shown rather than hidden, so the absence of a button reads as a
          // deliberate choice by the author instead of a missing feature.
          <p className="text-[11px] text-white/50">
            {entry.authorUsername} doesn&apos;t allow resharing
          </p>
        )}
      </div>

      {/* Viewers sheet */}
      {viewers !== null && (
        <div className="absolute inset-x-0 bottom-0 bg-ping-night-card rounded-t-2xl max-h-[60%] overflow-y-auto p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-ping-night-text">
              Viewed by {viewers.length}
            </p>
            <button onClick={() => setViewers(null)} className="text-xs text-ping-night-text-light">
              Close
            </button>
          </div>
          {viewers.length === 0 ? (
            <p className="text-xs text-ping-night-text-light">No one has seen this yet.</p>
          ) : (
            <ul className="space-y-2">
              {viewers.map((v) => (
                <li key={v.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-500 flex items-center justify-center text-white text-xs font-bold">
                    {v.username.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm text-ping-night-text">{v.username}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
