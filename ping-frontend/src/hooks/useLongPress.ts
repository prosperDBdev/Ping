"use client";

import { useCallback, useRef } from "react";

/** How long a finger has to stay down to count as "holding". WhatsApp is about this. */
const HOLD_MS = 450;
/** Moving further than this means scrolling, not holding. */
const MOVE_TOLERANCE_PX = 10;

/**
 * Press-and-hold on touch screens, right-click on computers.
 *
 * Returns handlers to spread onto an element, plus `wasLongPress()` for its
 * click handler: a hold ends with the finger lifting, which the browser also
 * reports as a click, and that click must not ALSO open the chat.
 *
 * A hold is cancelled as soon as the finger moves, so scrolling the list
 * never selects anything by accident.
 */
export default function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  }, []);

  const trigger = useCallback(() => {
    fired.current = true;
    // A short buzz, like other apps, so you feel the selection happen.
    navigator.vibrate?.(25);
    onLongPress();
  }, [onLongPress]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Every new press starts fresh, so a click after an earlier hold or
      // right-click is never mistaken for the end of one.
      fired.current = false;
      // Mouse users get right-click (below); only touch and pen hold.
      if (e.pointerType === "mouse") return;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        timer.current = null;
        trigger();
      }, HOLD_MS);
    },
    [trigger]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!start.current) return;
      if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > MOVE_TOLERANCE_PX) cancel();
    },
    [cancel]
  );

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      // Stops the phone's own long-press menu (copy / open link) and makes
      // right-click on a computer do the same as holding on a phone.
      e.preventDefault();
      // Android sends this too when a finger is held. Whichever of the timer
      // and this event comes first selects; the other does nothing.
      if (fired.current) return;
      cancel();
      trigger();
    },
    [cancel, trigger]
  );

  /** For the click handler: true (once) if this click was the end of a hold. */
  const wasLongPress = useCallback(() => {
    const was = fired.current;
    fired.current = false;
    return was;
  }, []);

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
      onContextMenu,
    },
    wasLongPress,
  };
}
