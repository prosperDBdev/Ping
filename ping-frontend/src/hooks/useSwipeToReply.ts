"use client";

import { useCallback, useRef, useState } from "react";

/** How far a message follows your finger, and how far counts as "reply". */
const MAX_PX = 80;
const TRIGGER_PX = 56;
/** Movement before we decide whether this is a swipe or a scroll. */
const DECIDE_PX = 8;

/**
 * Swipe a message to the right to reply, like WhatsApp.
 *
 * Touch only; on a computer the hover toolbar's Reply button does this. The
 * first few pixels of movement decide what the gesture is: mostly sideways and
 * to the right is a swipe, anything else is left to the browser as a scroll.
 * The element also gets `touch-action: pan-y`, which lets the browser keep
 * scrolling vertically but hands sideways movement to us.
 *
 * Past the trigger point the phone gives a small buzz, so you feel when
 * letting go will reply. Pulling back before letting go cancels it.
 */
export default function useSwipeToReply(onReply: () => void, enabled = true) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const mode = useRef<"undecided" | "swipe" | "scroll">("undecided");
  const armed = useRef(false);
  const justSwiped = useRef(false);

  const reset = useCallback(() => {
    start.current = null;
    mode.current = "undecided";
    armed.current = false;
    setDragging(false);
    setOffset(0);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || e.pointerType === "mouse") return;
      start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      mode.current = "undecided";
      armed.current = false;
    },
    [enabled]
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const s = start.current;
    if (!s || e.pointerId !== s.id || mode.current === "scroll") return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;

    if (mode.current === "undecided") {
      if (Math.abs(dx) < DECIDE_PX && Math.abs(dy) < DECIDE_PX) return;
      if (dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        mode.current = "swipe";
        setDragging(true);
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      } else {
        mode.current = "scroll";
        return;
      }
    }

    // Follows the finger up to the trigger, then resists, like a rubber band.
    const raw = Math.max(0, dx);
    const next = raw <= TRIGGER_PX ? raw : Math.min(MAX_PX, TRIGGER_PX + (raw - TRIGGER_PX) * 0.35);
    setOffset(next);
    if (!armed.current && next >= TRIGGER_PX) {
      armed.current = true;
      navigator.vibrate?.(15);
    } else if (armed.current && next < TRIGGER_PX) {
      armed.current = false;
    }
  }, []);

  const onPointerEnd = useCallback(() => {
    if (mode.current === "swipe") {
      // The lift after a swipe is reported as a click too; swallow that one.
      justSwiped.current = true;
      setTimeout(() => (justSwiped.current = false), 0);
      if (armed.current) onReply();
    }
    reset();
  }, [onReply, reset]);

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (justSwiped.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  return {
    offset,
    dragging,
    /** 0 → 1 as the swipe approaches the point where it will reply. */
    progress: Math.min(1, offset / TRIGGER_PX),
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: reset,
      onClickCapture,
    },
  };
}
