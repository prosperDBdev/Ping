"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/authStore";
import useStatusStore from "@/store/statusStore";
import NavSidebar from "@/components/sidebar/NavSidebar";
import MobileBottomNav from "@/components/common/MobileBottomNav";
import PingLogo from "@/components/common/PingLogo";
import ThemeToggle from "@/components/common/ThemeToggle";
import StatusComposer from "@/components/status/StatusComposer";
import StatusViewer from "@/components/status/StatusViewer";
import { StatusFeedEntry } from "@/types";
import { formatRelativeTime } from "@/lib/time";

/**
 * The status page: your own posts, then everyone else's, as rings.
 *
 * Note there is no client-side filtering of who appears here. The server
 * returns exactly the people this user is allowed to see, already grouped —
 * anything this page did to narrow that further would be a second copy of a
 * visibility rule that already has one home.
 */
export default function StatusPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { feed, mine, isLoading, failed, load } = useStatusStore();

  const [composing, setComposing] = useState(false);
  const [viewing, setViewing] = useState<{ entries: StatusFeedEntry[]; index: number; own: boolean } | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  // Your own posts, shaped like a feed entry so the viewer can page through
  // them with exactly the same component as everyone else's.
  const ownEntry: StatusFeedEntry | null = useMemo(() => {
    if (!user || mine.length === 0) return null;
    return {
      authorId: user.id,
      authorUsername: user.username,
      authorAvatarUrl: null,
      statuses: mine,
      latestAt: mine[mine.length - 1].createdAt,
      hasUnviewed: false,
    };
  }, [user, mine]);

  const initials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="h-screen bg-ping-cream dark:bg-ping-night-bg flex overflow-hidden font-sans text-ping-dark dark:text-ping-night-text">
      <NavSidebar
        activeView="status"
        onGoDashboard={() => router.push("/dashboard")}
        onGoMemories={() => router.push("/memories")}
        onGoStatus={() => {}}
        onSelectConversations={() => router.push("/chat")}
        onNewChat={() => router.push("/chat?view=new-private")}
        onNewGroup={() => router.push("/chat?view=new-group")}
        onOpenSettings={() => router.push("/chat?view=settings")}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-4 sm:px-8 py-4 border-b border-ping-sand/60 dark:border-ping-night-border flex-shrink-0">
          <div className="lg:hidden">
            <PingLogo compact />
          </div>
          <h1 className="text-lg font-black hidden lg:block">Status</h1>
          <ThemeToggle variant="pill" />
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin pb-20 lg:pb-0">
          <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8">
            {/* Your status */}
            <button
              onClick={() =>
                ownEntry
                  ? setViewing({ entries: [ownEntry], index: 0, own: true })
                  : setComposing(true)
              }
              className="w-full flex items-center gap-4 p-4 bg-white dark:bg-ping-night-card rounded-2xl border border-ping-sand/60 dark:border-ping-night-border mb-6 text-left hover:border-ping-teal/50 transition"
            >
              <div className="relative">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                    ownEntry ? "ring-2 ring-ping-teal ring-offset-2 dark:ring-offset-ping-night-card" : ""
                  } bg-slate-400 dark:bg-slate-600`}
                >
                  {user ? initials(user.username) : "U"}
                </div>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setComposing(true);
                  }}
                  className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-ping-orange rounded-full flex items-center justify-center text-white text-sm leading-none font-bold border-2 border-white dark:border-ping-night-card"
                >
                  +
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold">Your status</p>
                <p className="text-xs text-ping-text-light dark:text-ping-night-text-light">
                  {ownEntry
                    ? `${mine.length} update${mine.length === 1 ? "" : "s"} · ${formatRelativeTime(ownEntry.latestAt)}`
                    : "Tap to add an update"}
                </p>
              </div>
            </button>

            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ping-teal dark:text-ping-teal-light mb-3">
              Recent updates
            </p>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-ping-sand dark:border-ping-night-border border-t-ping-teal rounded-full animate-spin" />
              </div>
            ) : failed ? (
              <div className="bg-white dark:bg-ping-night-card rounded-2xl border border-ping-sand/60 dark:border-ping-night-border p-8 text-center">
                <p className="text-sm font-semibold mb-1">Couldn&apos;t load statuses</p>
                <button
                  onClick={() => void load()}
                  className="text-xs font-bold text-white bg-ping-orange px-4 py-2 rounded-xl mt-3"
                >
                  Try again
                </button>
              </div>
            ) : feed.length === 0 ? (
              <div className="bg-white dark:bg-ping-night-card rounded-2xl border border-ping-sand/60 dark:border-ping-night-border p-8 text-center">
                <p className="text-sm font-semibold mb-1">Nothing here yet</p>
                <p className="text-xs text-ping-text-light dark:text-ping-night-text-light">
                  Statuses from people you chat with show up here for 24 hours.
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-ping-night-card rounded-2xl border border-ping-sand/60 dark:border-ping-night-border overflow-hidden">
                {feed.map((entry, index) => (
                  <button
                    key={entry.authorId}
                    onClick={() => setViewing({ entries: feed, index, own: false })}
                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-ping-cream-dark/40 dark:hover:bg-ping-night-bg transition border-b border-ping-sand/40 dark:border-ping-night-border last:border-b-0"
                  >
                    <div
                      className={`w-12 h-12 rounded-full bg-slate-400 dark:bg-slate-600 flex items-center justify-center text-white font-bold text-sm ${
                        entry.hasUnviewed
                          ? "ring-2 ring-ping-orange ring-offset-2 dark:ring-offset-ping-night-card"
                          : "opacity-70"
                      }`}
                    >
                      {initials(entry.authorUsername)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{entry.authorUsername}</p>
                      <p className="text-xs text-ping-text-light dark:text-ping-night-text-light">
                        {entry.statuses.length} update{entry.statuses.length === 1 ? "" : "s"} ·{" "}
                        {formatRelativeTime(entry.latestAt)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <MobileBottomNav
        active="moments"
        onHome={() => router.push("/dashboard")}
        onPings={() => router.push("/chat")}
        onMoments={() => {}}
        onSettings={() => router.push("/chat?view=settings")}
      />

      {composing && <StatusComposer onClose={() => { setComposing(false); void load(); }} />}

      {viewing && (
        <StatusViewer
          entries={viewing.entries}
          startEntryIndex={viewing.index}
          isOwn={viewing.own}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
