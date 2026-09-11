"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

export type Platform = "android" | "ios" | "desktop" | "unknown";

/**
 * Chrome's install prompt event. It isn't in the TypeScript DOM library because
 * it is not a web standard — only Chromium implements it, which is the whole
 * reason iOS needs a completely different flow below.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Detect the platform from the user agent.
 *
 * User-agent sniffing is normally the wrong tool — browsers lie, and feature
 * detection is almost always better. This is one of the genuine exceptions:
 * there is no feature to detect. iOS Safari has no install API at all, so the
 * question "can I show an install button or must I show instructions?" cannot
 * be answered by asking the browser what it supports. The absence is the thing
 * we're detecting.
 *
 * The iPad check is separate on purpose: since iPadOS 13, iPads report
 * themselves as "Macintosh". The giveaway is a Mac claiming to have a
 * touchscreen, which no real Mac does.
 */
function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";

  const ua = navigator.userAgent;

  if (/android/i.test(ua)) return "android";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return "ios";
  if (/Windows|Macintosh|Linux|CrOS/.test(ua)) return "desktop";

  return "unknown";
}

/** True when the page is running as an installed app rather than in a browser tab. */
function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;

  // The standard way, supported by Chromium and, since 16.4, iOS.
  if (window.matchMedia("(display-mode: standalone)").matches) return true;

  // Older iOS only exposes this non-standard property, hence the cast.
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export interface PwaInstall {
  platform: Platform;
  /** Already installed and running from the home screen — hide the button entirely. */
  isStandalone: boolean;
  /** Chrome has offered us a prompt we can fire on a click. */
  canPromptInstall: boolean;
  /** This platform can only be talked through it — iOS. */
  needsManualInstructions: boolean;
  /** Fires the native prompt. Returns whether the user accepted. */
  promptInstall: () => Promise<boolean>;
}

/**
 * Everything the "Download app" button needs to know.
 *
 * The two platforms are not variations on a theme, they're different
 * interactions. On Android, Chrome decides the site is installable, fires
 * `beforeinstallprompt`, and we stash that event so a later click can show a
 * real one-tap system dialog. On iOS no such event exists and no API can
 * trigger installation — the only route is Share → Add to Home Screen, done by
 * hand. So the honest button is a different button on each platform, and that's
 * what this hook reports rather than pretending one flow fits both.
 */
/** Nothing to subscribe to — the platform can't change mid-session. */
const noSubscribe = () => () => {};

/** Display mode can change: installing the app, or opening it from the icon. */
function subscribeToDisplayMode(onChange: () => void) {
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", onChange);
  window.addEventListener("appinstalled", onChange);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener("appinstalled", onChange);
  };
}

export default function usePwaInstall(): PwaInstall {
  // useSyncExternalStore rather than useState + useEffect, for two reasons.
  //
  // The obvious one: reading `navigator` in an effect means the first render is
  // always wrong and immediately re-renders, which React now warns about.
  //
  // The subtle one that actually matters: this page is server-rendered, and on
  // the server there is no navigator at all. Anything that computes a value
  // during render from a browser API produces different HTML on the server than
  // on the client, and React tears the whole tree down and rebuilds it. The
  // third argument here is the server snapshot — it lets us say explicitly
  // "during prerender, the answer is 'unknown' / 'not installed'", so the two
  // renders agree and the real value arrives on hydration.
  const platform = useSyncExternalStore<Platform>(
    noSubscribe,
    detectPlatform,
    () => "unknown"
  );

  const isStandalone = useSyncExternalStore(
    subscribeToDisplayMode,
    detectStandalone,
    () => false
  );

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      // Chrome would otherwise show its own mini-infobar at a moment of its
      // choosing. Suppressing it lets the install happen from our button, where
      // the user has just read what they're installing.
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Fires when the install completes, including from Chrome's own menu rather
    // than our button. The standalone flag updates itself — subscribeToDisplayMode
    // is listening for this same event — so all this has to do is drop the now
    // spent prompt.
    const onInstalled = () => setDeferredPrompt(null);

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    // The event is single-use. Chrome will fire a fresh one if the user
    // dismisses and remains eligible, so throw this one away either way.
    setDeferredPrompt(null);
    return outcome === "accepted";
  }, [deferredPrompt]);

  return {
    platform,
    isStandalone,
    canPromptInstall: deferredPrompt !== null,
    needsManualInstructions: platform === "ios",
    promptInstall,
  };
}
