"use client";

import { useRouter } from "next/navigation";
import useSwipeTabs from "@/hooks/useSwipeTabs";
import { MOBILE_TABS, MobileTab, rememberDirection } from "@/lib/mobileTabs";

interface MobileBottomNavProps {
  active: MobileTab;
  /**
   * Turn the swipe gesture off while the page is showing something that owns
   * sideways movement itself — an open conversation, for instance, where a
   * swipe should never throw you out of the chat you're typing in.
   */
  swipeEnabled?: boolean;
}

const ICONS: Record<MobileTab, React.ReactNode> = {
  home: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
  ),
  pings: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
  ),
  moments: (
    <>
      <circle cx="12" cy="12" r="9" strokeDasharray="4 3" />
      <circle cx="12" cy="12" r="3.5" />
    </>
  ),
  settings: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </>
  ),
};

/**
 * The phone's bottom navigation — and, through useSwipeTabs, its swipe gesture.
 *
 * The nav knows its own destinations now. It used to take four click handlers
 * from whichever page rendered it, and four pages writing the same four
 * handlers is four chances to get one wrong: the chat page's Moments button had
 * quietly become a no-op while Moments everywhere else opened /status. The
 * swipe gesture lives here for the same reason — every page that shows the nav
 * gets swiping, and no page can show the nav and forget to add it.
 *
 * Visible below lg rather than below md. The desktop sidebar only appears from
 * lg upward, so hiding this at md left tablets between 768px and 1023px with no
 * navigation of any kind.
 */
export default function MobileBottomNav({ active, swipeEnabled = true }: MobileBottomNavProps) {
  const router = useRouter();
  useSwipeTabs(active, swipeEnabled);

  return (
    <nav
      aria-label="Main"
      className="safe-bottom flex-shrink-0 flex items-center justify-around py-2 bg-ping-cream dark:bg-ping-night-card border-t border-ping-sand/60 dark:border-ping-night-border lg:hidden"
    >
      {MOBILE_TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => {
              if (isActive) return;
              rememberDirection(active, tab.id);
              router.push(tab.href);
            }}
            aria-current={isActive ? "page" : undefined}
            // 44px minimum tap target — Apple's guideline, and the size below
            // which people start hitting the neighbouring tab by accident.
            className={`flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[44px] rounded-xl transition ${
              isActive
                ? "text-ping-orange font-bold"
                : "text-ping-text-light dark:text-ping-night-text-light font-medium active:bg-ping-cream-dark dark:active:bg-ping-night-bg"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              {ICONS[tab.id]}
            </svg>
            <span className="text-[10px]">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
