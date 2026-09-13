"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MobileTab, SWIPE_DIRECTION_KEY, neighbourTab, rememberDirection } from "@/lib/mobileTabs";

/** How far a finger must travel sideways before it counts as a swipe. */
const MIN_DISTANCE_PX = 70;
/** Slower than this and it's a drag or a read, not a flick. */
const MAX_DURATION_MS = 700;
/** Horizontal movement must beat vertical by this factor — otherwise it's a scroll. */
const HORIZONTAL_DOMINANCE = 1.5;
/**
 * Touches starting this close to either screen edge are ignored.
 *
 * iOS uses an edge swipe for "back", and Android's gesture navigation does the
 * same. Claiming those touches would fight the operating system over a gesture
 * the user learned before they ever opened this app — and the OS would win.
 */
const EDGE_GUARD_PX = 24;

/** Elements where a sideways finger movement already means something. */
const OWNS_HORIZONTAL_GESTURES = 'input, textarea, select, [contenteditable="true"], [data-no-swipe]';

/** True if the touch started inside something that scrolls sideways on its own. */
function insideHorizontalScroller(start: Element | null): boolean {
  for (let el = start; el && el !== document.body; el = el.parentElement) {
    const overflowX = getComputedStyle(el).overflowX;
    if ((overflowX === "auto" || overflowX === "scroll") && el.scrollWidth > el.clientWidth) {
      return true;
    }
  }
  return false;
}

/**
 * Swipe left and right between the four main tabs on a phone.
 *
 * WHAT MAKES THIS HARD is not detecting a swipe — that's a few lines of
 * arithmetic — but NOT detecting one. A page is full of sideways finger
 * movements that mean something else, and a gesture that fires during any of
 * them is worse than no gesture at all:
 *
 *   - a vertical scroll that drifts a little sideways    -> dominance check
 *   - the OS back gesture from the screen edge           -> edge guard
 *   - moving the cursor in a text box                    -> inputs excluded
 *   - scrolling a horizontal carousel or code block      -> scroller check
 *   - selecting text                                     -> selection check
 *   - anything happening inside an open overlay          -> [data-no-swipe]
 *
 * Every one of those is a real way a user would get yanked off the screen
 * they were using. The rule of thumb: when in doubt, don't navigate. A missed
 * swipe costs a second attempt; a false one costs whatever they were doing.
 *
 * Listeners are passive, so they never block scrolling — this only watches
 * where the finger went and decides afterwards.
 */
export default function useSwipeTabs(current: MobileTab, enabled = true) {
  const router = useRouter();

  // Slide the page in from the side the user moved towards. Runs once per
  // mount, reading the direction the previous page left behind. It touches
  // the DOM directly rather than going through state — this is a one-shot
  // visual flourish, and routing it through React would mean a second render
  // for every tab change just to add and remove a class.
  useEffect(() => {
    let direction: string | null = null;
    try {
      direction = sessionStorage.getItem(SWIPE_DIRECTION_KEY);
      sessionStorage.removeItem(SWIPE_DIRECTION_KEY);
    } catch {
      return;
    }
    if (!direction) return;

    const page = document.querySelector<HTMLElement>("[data-swipe-page]");
    if (!page) return;

    const className = direction === "left" ? "swipe-enter-from-right" : "swipe-enter-from-left";
    page.classList.add(className);
    const done = () => page.classList.remove(className);
    page.addEventListener("animationend", done, { once: true });
    return () => {
      page.removeEventListener("animationend", done);
      page.classList.remove(className);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const phone = window.matchMedia("(max-width: 767px)");

    // Warm up both neighbours so a swipe lands on a page that's already loaded
    // rather than a blank one — the gesture should feel instant.
    for (const direction of [1, -1] as const) {
      const tab = neighbourTab(current, direction);
      if (tab) router.prefetch(tab.href);
    }

    let start: { x: number; y: number; time: number } | null = null;

    const onTouchStart = (e: TouchEvent) => {
      start = null;
      if (!phone.matches || e.touches.length !== 1) return;

      // An overlay being open anywhere — a status viewer, a composer, a
      // confirmation dialog — means the user is doing something else.
      if (document.querySelector("[data-no-swipe]")) return;

      const touch = e.touches[0];
      if (touch.clientX < EDGE_GUARD_PX || touch.clientX > window.innerWidth - EDGE_GUARD_PX) return;

      const target = e.target as Element | null;
      if (target?.closest(OWNS_HORIZONTAL_GESTURES)) return;
      if (insideHorizontalScroller(target)) return;

      start = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!start) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      const elapsed = Date.now() - start.time;
      start = null;

      if (elapsed > MAX_DURATION_MS) return;
      if (Math.abs(dx) < MIN_DISTANCE_PX) return;
      if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_DOMINANCE) return;
      if (window.getSelection()?.toString()) return;

      // Finger moves left -> content moves left -> the NEXT tab comes in from
      // the right. Same convention as every photo gallery on the phone.
      const next = neighbourTab(current, dx < 0 ? 1 : -1);
      if (!next) return;

      rememberDirection(current, next.id);
      router.push(next.href);
    };

    const onTouchCancel = () => {
      start = null;
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [current, enabled, router]);
}
