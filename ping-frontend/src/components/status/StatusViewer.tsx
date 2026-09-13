"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Status, StatusFeedEntry, StatusViewer as StatusViewerRow } from "@/types";
import { STATUS_REACTIONS, STATUS_SLIDE_MS, fetchStatusViewers } from "@/lib/status";
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

function errorMessage(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

/**
 * Full-screen status viewer.
 *
 * Three things here are less obvious than they look.
 *
 * THE CLOCK PAUSES AND RESUMES, rather than restarting. Holding the screen,
 * opening the viewers sheet, or starting to type a reply all stop the slide
 * advancing — and when they end, the slide carries on from where it was, not
 * from a fresh five seconds. The timer and the progress bar are kept in step
 * by tracking the time remaining in a ref and pausing the CSS animation with
 * animation-play-state, so the bar and the actual advance never disagree.
 *
 * TYPING HOLDS THE SLIDE. A status that moves on while you're halfway through
 * replying to it takes your reply with it — you'd be answering one post while
 * looking at another. So any text in the reply box, or focus on it, is a hold.
 *
 * VIEWS ARE RECORDED ON DISPLAY, not on close. Closing the tab mid-set is how
 * most people actually leave, and waiting for a close event would lose every
 * receipt in it.
 */
export default function StatusViewer({
  entries,
  startEntryIndex,
  isOwn,
  onClose,
}: StatusViewerProps) {
  const [entryIndex, setEntryIndex] = useState(startEntryIndex);
  const [slideIndex, setSlideIndex] = useState(0);
  const [pressed, setPressed] = useState(false);
  const [viewers, setViewers] = useState<StatusViewerRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyFocused, setReplyFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  const markViewed = useStatusStore((s) => s.markViewed);
  const reshare = useStatusStore((s) => s.reshare);
  const remove = useStatusStore((s) => s.remove);
  const react = useStatusStore((s) => s.react);
  const reply = useStatusStore((s) => s.reply);

  const entry = entries[entryIndex];
  const snapshot: Status | undefined = entry?.statuses[slideIndex];

  // The entries prop is a snapshot taken when the viewer opened, so it can't
  // see a reaction you just made. Read the live copy from the store by id and
  // fall back to the snapshot — your own statuses aren't in the feed at all.
  const live = useStatusStore((s) =>
    snapshot ? s.feed.flatMap((e) => e.statuses).find((x) => x.id === snapshot.id) : undefined
  );
  const status = live ?? snapshot;

  const held =
    pressed || viewers !== null || replyFocused || replyText.length > 0 || sending;

  // --- navigation ---------------------------------------------------------

  // Computed from the current indices directly. An earlier version called one
  // state setter from inside another's updater function, which React may run
  // twice and which made "previous" need a setTimeout to land on the right
  // slide. Plain values, plain branches.
  const goNext = useCallback(() => {
    setViewers(null);
    const current = entries[entryIndex];
    if (!current) return;

    if (slideIndex + 1 < current.statuses.length) {
      setSlideIndex(slideIndex + 1);
    } else if (entryIndex + 1 < entries.length) {
      setEntryIndex(entryIndex + 1);
      setSlideIndex(0);
    } else {
      onClose();
    }
  }, [entries, entryIndex, slideIndex, onClose]);

  const goPrev = useCallback(() => {
    setViewers(null);
    if (slideIndex > 0) {
      setSlideIndex(slideIndex - 1);
    } else if (entryIndex > 0) {
      // Land on the previous person's LAST slide, so going back feels like
      // rewinding one continuous reel rather than jumping to their start.
      const previous = entries[entryIndex - 1];
      setEntryIndex(entryIndex - 1);
      setSlideIndex(Math.max(0, previous.statuses.length - 1));
    }
  }, [entries, entryIndex, slideIndex]);

  // --- the clock ----------------------------------------------------------

  const remainingRef = useRef(STATUS_SLIDE_MS);
  const startedAtRef = useRef(0);

  // A new slide gets a full turn. This effect is declared before the timer so
  // that, on a slide change, the old timer's cleanup runs, then this reset,
  // then the new timer starts from the full duration.
  useEffect(() => {
    remainingRef.current = STATUS_SLIDE_MS;
  }, [status?.id]);

  useEffect(() => {
    if (!status || held) return;
    startedAtRef.current = Date.now();
    const timer = setTimeout(goNext, remainingRef.current);
    return () => {
      clearTimeout(timer);
      // Bank the time that was used, so resuming carries on rather than
      // starting the five seconds again.
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAtRef.current));
    };
  }, [status, held, goNext]);

  // --- side effects -------------------------------------------------------

  useEffect(() => {
    if (status && !isOwn && !status.viewed) {
      void markViewed(status.id);
    }
  }, [status, isOwn, markViewed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Arrow keys belong to the text box while someone is typing in it —
      // otherwise moving the cursor in a reply would skip to the next status.
      if ((e.target as HTMLElement)?.tagName === "INPUT") {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, onClose]);

  if (!entry || !status) return null;

  const flash = (text: string, tone: "ok" | "error") => {
    setNotice({ text, tone });
    setTimeout(() => setNotice(null), 2200);
  };

  // --- actions ------------------------------------------------------------

  const openViewers = async () => {
    try {
      setViewers(await fetchStatusViewers(status.id));
    } catch {
      setViewers([]);
    }
  };

  const doReact = async (emoji: string) => {
    try {
      await react(status.id, emoji);
    } catch (err) {
      flash(errorMessage(err, "Couldn't react to that"), "error");
    }
  };

  const doReply = async () => {
    const text = replyText.trim();
    if (!text) return;
    setSending(true);
    try {
      await reply(status.id, text);
      setReplyText("");
      flash(`Sent to your chat with ${entry.authorUsername}`, "ok");
    } catch (err) {
      flash(errorMessage(err, "Couldn't send that reply"), "error");
    } finally {
      setSending(false);
    }
  };

  const doReshare = async () => {
    setBusy(true);
    try {
      await reshare(status.id);
      onClose();
    } catch (err) {
      flash(errorMessage(err, "Couldn't reshare that"), "error");
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

  // --- render -------------------------------------------------------------

  return (
    // data-no-swipe: the viewer has its own left/right meaning (previous and
    // next status). Without this, a flick meant to reach the next status would
    // also throw the user onto a different tab.
    <div data-no-swipe className="fixed inset-0 z-50 bg-black flex flex-col">
      <style>{`@keyframes statusProgress { from { transform: scaleX(0) } to { transform: scaleX(1) } }`}</style>

      {/* Progress — one bar per slide in this person's set */}
      <div className="flex gap-1 px-3 pt-3 safe-top">
        {entry.statuses.map((s, i) => (
          <div key={s.id} className="flex-1 h-0.5 bg-white/25 rounded-full overflow-hidden">
            {i < slideIndex && <div className="h-full w-full bg-white" />}
            {i === slideIndex && (
              <div
                // Keyed on the slide so the animation restarts for each one.
                key={status.id}
                className="h-full w-full bg-white origin-left"
                style={{
                  animation: `statusProgress ${STATUS_SLIDE_MS}ms linear forwards`,
                  animationPlayState: held ? "paused" : "running",
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-slate-500 flex items-center justify-center text-white text-xs font-bold">
          {entry.authorUsername.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">
            {isOwn ? "My status" : entry.authorUsername}
          </p>
          <p className="text-[11px] text-white/60 truncate">
            {formatRelativeTime(status.createdAt)}
            {status.resharedFromAuthorUsername && <> · from {status.resharedFromAuthorUsername}</>}
          </p>
        </div>
        {!isOwn && status.reshareable && (
          <button
            onClick={doReshare}
            disabled={busy}
            aria-label="Reshare to your status"
            title="Reshare to your status"
            className="text-white/80 hover:text-white p-1.5 disabled:opacity-40"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7M16 6l-4-4-4 4M12 2v13" />
            </svg>
          </button>
        )}
        <button onClick={onClose} aria-label="Close" className="text-white/80 hover:text-white p-1.5">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Slide */}
      <div
        className="flex-1 relative flex items-center justify-center overflow-hidden"
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
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
              <p className="absolute bottom-6 left-0 right-0 px-8 text-center text-white text-sm break-words drop-shadow">
                {status.text}
              </p>
            )}
          </>
        )}

        {/* Tap zones: left third back, the rest forward. */}
        <button aria-label="Previous" onClick={goPrev} className="absolute inset-y-0 left-0 w-1/3 cursor-default" />
        <button aria-label="Next" onClick={goNext} className="absolute inset-y-0 right-0 w-2/3 cursor-default" />

        {notice && (
          <div
            className={`absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs font-semibold shadow-lg ${
              notice.tone === "ok" ? "bg-white text-ping-dark" : "bg-red-500 text-white"
            }`}
          >
            {notice.text}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 pt-3 pb-4 safe-bottom">
        {isOwn ? (
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={openViewers}
              className="flex items-center gap-2 text-xs font-semibold text-white/90 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {status.viewerCount ?? 0}
              {(status.reactionCount ?? 0) > 0 && (
                <span className="flex items-center gap-1 pl-2 ml-0.5 border-l border-white/20">
                  <span aria-hidden="true">{"❤️"}</span>
                  {status.reactionCount}
                </span>
              )}
            </button>
            <button
              onClick={doDelete}
              disabled={busy}
              className="text-xs font-semibold text-white/90 bg-white/10 hover:bg-red-500/70 px-4 py-2 rounded-xl transition disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        ) : (
          <>
            {/* Reactions */}
            <div className="flex items-center justify-center gap-1.5 mb-3">
              {STATUS_REACTIONS.map((emoji) => {
                const chosen = status.myReaction === emoji;
                return (
                  <button
                    key={emoji}
                    onClick={() => void doReact(emoji)}
                    aria-label={chosen ? `Remove ${emoji} reaction` : `React with ${emoji}`}
                    aria-pressed={chosen}
                    className={`w-10 h-10 rounded-full text-xl flex items-center justify-center transition active:scale-90 ${
                      chosen ? "bg-white/25 scale-110" : "hover:bg-white/10"
                    }`}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>

            {/* Reply */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void doReply();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value.slice(0, 2000))}
                onFocus={() => setReplyFocused(true)}
                onBlur={() => setReplyFocused(false)}
                placeholder={`Reply to ${entry.authorUsername}…`}
                className="flex-1 min-w-0 bg-white/10 border border-white/15 rounded-full px-4 py-2.5 text-sm text-white placeholder-white/50 focus:outline-none focus:border-white/40"
              />
              <button
                type="submit"
                disabled={sending || !replyText.trim()}
                aria-label="Send reply"
                className="w-10 h-10 flex-shrink-0 rounded-full bg-ping-orange text-white flex items-center justify-center disabled:opacity-40 transition"
              >
                {sending ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                )}
              </button>
            </form>
            <p className="text-center text-[10px] text-white/40 mt-2">
              Replies go privately to {entry.authorUsername}. Reactions are only visible to them.
            </p>
          </>
        )}
      </div>

      {/* Viewers sheet — author only */}
      {viewers !== null && (
        <div className="absolute inset-0 bg-black/40 flex items-end" onClick={() => setViewers(null)}>
          <div
            className="w-full bg-ping-night-card rounded-t-2xl max-h-[65%] overflow-y-auto p-5 safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-ping-night-text">
                Viewed by {viewers.length}
                {viewers.some((v) => v.reaction) && (
                  <span className="text-ping-night-text-light font-normal">
                    {" "}· {viewers.filter((v) => v.reaction).length} reacted
                  </span>
                )}
              </p>
              <button onClick={() => setViewers(null)} className="text-xs text-ping-night-text-light">
                Close
              </button>
            </div>
            {viewers.length === 0 ? (
              <p className="text-xs text-ping-night-text-light">No one has seen this yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {viewers.map((v) => (
                  <li key={v.id} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-500 flex items-center justify-center text-white text-xs font-bold">
                      {v.username.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm text-ping-night-text flex-1 min-w-0 truncate">{v.username}</span>
                    {v.reaction && <span className="text-xl" aria-label={`reacted ${v.reaction}`}>{v.reaction}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
