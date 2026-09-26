"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import useAuthStore from "@/store/authStore";
import useChatStore from "@/store/chatStore";

/**
 * "How do I open a chat?" — a first-run guide for people whose chat list is
 * empty. It points at the real buttons rather than describing them:
 *
 *   1. tap + (data-tour="new-chat")
 *   2. type a friend's username (data-tour="find-people")
 *   3. say hello (data-tour="composer")
 *
 * WHICH STEP is read from the screen, not stored: whatever the person has
 * open decides it. So they can wander off, go back, or do things in a
 * different order, and the guide simply follows. It ends by itself when their
 * first message is sent (any chat has a last message), or when they tap Skip.
 * Either way it's remembered per account on this device and never shows again.
 *
 * It only ever highlights; it doesn't block the page. The dimmed backdrop lets
 * every tap through, so the guide can't trap anyone.
 */

type Step = "welcome" | "new-chat" | "find-people" | "composer";

/**
 * Where each step's card goes. Never over the thing the person needs to tap
 * NEXT: the search results appear right under the search box, so step 2's
 * card docks to the bottom of the screen instead of sitting below the box.
 */
type Placement = "below" | "above" | "bottom";

const STEPS: Record<Exclude<Step, "welcome">, { n: number; title: string; body: string; hint?: string; place: Placement }> = {
  "new-chat": {
    place: "below",
    n: 1,
    title: "Start a new chat",
    body: "Tap + to find someone to message.",
  },
  "find-people": {
    place: "bottom",
    n: 2,
    title: "Find your friend",
    body: "Type their username, then tap their name to open the chat.",
    hint: "Not on Ping yet? Invite them from Settings → Invite friends.",
  },
  composer: {
    place: "above",
    n: 3,
    title: "Say hello",
    body: "Type your first message here and tap send.",
  },
};

const storageKey = (userId: string) => `ping-first-chat-guide:${userId}`;

function isDone(userId: string): boolean {
  try {
    return localStorage.getItem(storageKey(userId)) === "done";
  } catch {
    return false;
  }
}

function markDone(userId: string) {
  try {
    localStorage.setItem(storageKey(userId), "done");
  } catch {
    // Private mode: the guide may show again next visit, which is harmless.
  }
}

/** The target's box, if it's actually on screen (hidden panels measure 0×0). */
function visibleRect(selector: string): DOMRect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > window.innerHeight) return null;
  return r;
}

export default function FirstChatGuide() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const conversations = useChatStore((s) => s.conversations);
  const loaded = useChatStore((s) => s.conversationsLoaded);
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState<Step | null>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const finishedRef = useRef(false);

  const hasMessaged = conversations.some((c) => c.lastMessage);
  const onGuidedPage = pathname === "/dashboard" || pathname === "/chat";
  const active =
    !!user && onGuidedPage && loaded && !hasMessaged && !dismissed && !isDone(user.id);

  // Finished: a chat has a message. Congratulate only someone we actually saw
  // start with an empty list; people who already had chats are just marked
  // done quietly, so they never see the guide at all.
  const sawEmptyRef = useRef(false);
  useEffect(() => {
    if (!user || !loaded) return;
    if (!hasMessaged) {
      sawEmptyRef.current = true;
      return;
    }
    if (finishedRef.current || isDone(user.id)) return;
    finishedRef.current = true;
    markDone(user.id);
    if (sawEmptyRef.current) toast.success("That's your first chat. Nice! 🎉");
  }, [user, loaded, hasMessaged]);

  // Follow the screen: find the furthest step whose target is visible.
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      let next: Step | null = null;
      let box: DOMRect | null = null;
      if (pathname === "/dashboard") {
        next = "welcome";
      } else {
        for (const s of ["composer", "find-people", "new-chat"] as const) {
          box = visibleRect(`[data-tour="${s}"]`);
          if (box) {
            next = s;
            break;
          }
        }
      }
      setStep((prev) => (prev === next ? prev : next));
      setRect((prev) => {
        if (!box) return prev === null ? prev : null;
        const nextRect = {
          top: Math.round(box.top),
          left: Math.round(box.left),
          width: Math.round(box.width),
          height: Math.round(box.height),
        };
        return prev && prev.top === nextRect.top && prev.left === nextRect.left
          && prev.width === nextRect.width && prev.height === nextRect.height ? prev : nextRect;
      });
    };
    tick();
    const timer = setInterval(tick, 200);
    window.addEventListener("resize", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("resize", tick);
    };
  }, [active, pathname]);

  const skip = useCallback(() => {
    if (user) markDone(user.id);
    setDismissed(true);
  }, [user]);

  if (!active || !step) return null;

  const skipButton = (
    <button
      type="button"
      onClick={skip}
      className="text-xs font-semibold text-ping-text-light dark:text-ping-night-text-light hover:text-ping-dark dark:hover:text-ping-night-text transition px-2 py-1"
    >
      Skip
    </button>
  );

  // ---- Before the chat page: a welcome card with the way in.
  if (step === "welcome") {
    return (
      <div className="fixed inset-x-0 bottom-0 sm:inset-0 z-[60] flex items-end sm:items-center justify-center p-4 pb-24 sm:pb-4 pointer-events-none">
        <div
          role="dialog"
          aria-labelledby="first-chat-title"
          className="pointer-events-auto w-full max-w-sm bg-white dark:bg-ping-night-card rounded-3xl border border-ping-sand/70 dark:border-ping-night-border shadow-2xl p-6"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ping-teal dark:text-ping-teal-light mb-2">
            Getting started
          </p>
          <h2 id="first-chat-title" className="text-xl font-black text-ping-dark dark:text-ping-night-text leading-tight mb-2">
            Welcome to Ping, {user?.username} 👋
          </h2>
          <p className="text-sm text-ping-text-light dark:text-ping-night-text-light mb-5">
            Your chats will show up here. Let&apos;s send your first message: it takes three quick steps.
          </p>
          <div className="flex items-center justify-between gap-3">
            {skipButton}
            <button
              type="button"
              onClick={() => router.push("/chat")}
              className="px-5 py-2.5 rounded-xl bg-ping-dark text-white text-sm font-semibold hover:bg-ping-dark/90 transition"
            >
              Show me how
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- On the chat page: spotlight the real control, explain it next to it.
  if (!rect) return null;
  const info = STEPS[step];
  const pad = 6;
  const cardWidth = Math.min(300, window.innerWidth - 32);
  const fitsBelow = rect.top + rect.height + 200 < window.innerHeight;
  const place: Placement = info.place === "below" && !fitsBelow ? "above" : info.place;
  const cardLeft =
    place === "bottom"
      ? (window.innerWidth - cardWidth) / 2
      : Math.max(16, Math.min(rect.left + rect.width / 2 - cardWidth / 2, window.innerWidth - cardWidth - 16));
  const cardPosition =
    place === "below"
      ? { top: rect.top + rect.height + pad + 12 }
      : place === "above"
        ? { bottom: window.innerHeight - rect.top + pad + 12 }
        : { bottom: "calc(24px + env(safe-area-inset-bottom, 0px))" };

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none" aria-live="polite">
      {/* The spotlight: a hole in a dim layer, around the control to tap. */}
      <div
        className="absolute rounded-2xl ring-2 ring-ping-orange"
        style={{
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          boxShadow: "0 0 0 9999px rgba(12, 22, 25, 0.55)",
        }}
      />
      <div
        role="dialog"
        aria-labelledby="first-chat-step"
        className="absolute pointer-events-auto bg-white dark:bg-ping-night-card rounded-2xl border border-ping-sand/70 dark:border-ping-night-border shadow-2xl p-4"
        style={{
          width: cardWidth,
          left: cardLeft,
          ...cardPosition,
        }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ping-orange mb-1">
          Step {info.n} of 3
        </p>
        <p id="first-chat-step" className="text-base font-bold text-ping-dark dark:text-ping-night-text mb-1">
          {info.title}
        </p>
        <p className="text-sm text-ping-text-light dark:text-ping-night-text-light">{info.body}</p>
        {info.hint && (
          <p className="mt-2 text-xs text-ping-text-light/80 dark:text-ping-night-text-light/80">{info.hint}</p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1" aria-hidden>
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === info.n ? "w-5 bg-ping-orange" : "w-1.5 bg-ping-sand dark:bg-ping-night-border"
                }`}
              />
            ))}
          </div>
          {skipButton}
        </div>
      </div>
    </div>
  );
}
