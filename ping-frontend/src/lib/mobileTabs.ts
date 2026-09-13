/**
 * The four top-level tabs on a phone, in the order they sit in the bottom nav.
 *
 * This order is load-bearing: swiping left always means "the tab to the right
 * of this one in this list", so the nav bar and the swipe gesture can never
 * disagree about what's next door. They both read from here, and before this
 * existed each page hand-wrote its own four handlers — which is how the chat
 * page's Moments button ended up doing nothing at all while every other page's
 * Moments button went to /status.
 *
 * Every tab is its own route. Swiping is navigation, so a tab that was really
 * a view inside another page (settings used to be /chat?view=settings) has no
 * clean "next" or "previous" to move between.
 */
export type MobileTab = "home" | "pings" | "moments" | "settings";

export interface MobileTabDefinition {
  id: MobileTab;
  href: string;
  label: string;
}

export const MOBILE_TABS: readonly MobileTabDefinition[] = [
  { id: "home", href: "/dashboard", label: "Home" },
  { id: "pings", href: "/chat", label: "Pings" },
  { id: "moments", href: "/status", label: "Moments" },
  { id: "settings", href: "/settings", label: "Settings" },
];

/**
 * The tab one step away in the given direction, or null at either end.
 *
 * No wrap-around: swiping right from Home does nothing rather than jumping to
 * Settings. Wrapping sounds convenient and feels disorienting — the edge of the
 * list is a landmark people rely on to know where they are.
 */
export function neighbourTab(current: MobileTab, direction: 1 | -1): MobileTabDefinition | null {
  const index = MOBILE_TABS.findIndex((t) => t.id === current);
  return MOBILE_TABS[index + direction] ?? null;
}

/** Remembers which way the user moved, so the next page can slide in from that side. */
export const SWIPE_DIRECTION_KEY = "ping-swipe-direction";

/** Record the direction of a tab change, whether it came from a swipe or a tap. */
export function rememberDirection(from: MobileTab, to: MobileTab) {
  const a = MOBILE_TABS.findIndex((t) => t.id === from);
  const b = MOBILE_TABS.findIndex((t) => t.id === to);
  if (a === b) return;
  try {
    sessionStorage.setItem(SWIPE_DIRECTION_KEY, b > a ? "left" : "right");
  } catch {
    // Private mode or storage disabled — the page just appears without sliding.
  }
}
