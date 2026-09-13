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
import StatusRing from "@/components/status/StatusRing";
import { StatusFeedEntry } from "@/types";
import { formatRelativeTime } from "@/lib/time";

/**
 * The status page: your own posts first, then everyone else's split into what
 * you haven't seen and what you have.
 *
 * Note there is no client-side filtering of WHO appears here. The server
 * returns exactly the people this user is allowed to see — anything this page
 * did to narrow that further would be a second copy of a visibility rule that
 * already has one home. Splitting into "recent" and "viewed" is presentation,
 * not permission, which is why it's fine to do here.
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

  // The server already orders unseen first, so these two slices together are
  // the feed in its original order — which matters, because the viewer is
  // handed the whole feed and pages straight from one person to the next.
  const recent = feed.filter((e) => e.hasUnviewed);
  const viewed = feed.filter((e) => !e.hasUnviewed);

  const totalViews = mine.reduce((n, s) => n + (s.viewerCount ?? 0), 0);
  const totalReactions = mine.reduce((n, s) => n + (s.reactionCount ?? 0), 0);

  const openFeedEntry = (entry: StatusFeedEntry) =>
    setViewing({ entries: feed, index: feed.indexOf(entry), own: false });

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
        <div className="flex items-center justify-between gap-4 px-4 sm:px-8 py-4 border-b border-ping-sand/60 dark:border-ping-night-border flex-shrink-0 safe-top">
          <div className="lg:hidden">
            <PingLogo compact />
          </div>
          <h1 className="text-lg font-black hidden lg:block">Status</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setComposing(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-ping-orange hover:bg-ping-orange-light px-3.5 py-2 rounded-xl transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
              </svg>
              New
            </button>
            <ThemeToggle variant="pill" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin pb-20 lg:pb-0">
          <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8">
            {/* My status */}
            <div className="flex items-center gap-4 p-4 bg-white dark:bg-ping-night-card rounded-2xl border border-ping-sand/60 dark:border-ping-night-border mb-8">
              <button
                onClick={() =>
                  ownEntry
                    ? setViewing({ entries: [ownEntry], index: 0, own: true })
                    : setComposing(true)
                }
                className="relative"
                aria-label={ownEntry ? "View my status" : "Add a status"}
              >
                {ownEntry ? (
                  <StatusRing statuses={mine} label={user?.username ?? "Me"} allSeen={false} />
                ) : (
                  <div className="w-[52px] h-[52px] rounded-full bg-slate-400 dark:bg-slate-600 flex items-center justify-center text-white font-bold text-xs">
                    {user?.username.slice(0, 2).toUpperCase() ?? "ME"}
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-ping-orange rounded-full flex items-center justify-center text-white text-sm leading-none font-bold border-2 border-white dark:border-ping-night-card">
                  +
                </span>
              </button>

              <button
                onClick={() =>
                  ownEntry
                    ? setViewing({ entries: [ownEntry], index: 0, own: true })
                    : setComposing(true)
                }
                className="min-w-0 flex-1 text-left"
              >
                <p className="text-sm font-bold">My status</p>
                <p className="text-xs text-ping-text-light dark:text-ping-night-text-light">
                  {ownEntry
                    ? `${mine.length} update${mine.length === 1 ? "" : "s"} · ${formatRelativeTime(ownEntry.latestAt)}`
                    : "Tap to share a thought or a photo"}
                </p>
              </button>

              {/* A glance at how your posts are landing, without opening each one. */}
              {ownEntry && (
                <div className="flex items-center gap-3 text-xs font-semibold text-ping-text-light dark:text-ping-night-text-light flex-shrink-0">
                  <span className="flex items-center gap-1" title="Views across your statuses">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {totalViews}
                  </span>
                  {totalReactions > 0 && (
                    <span className="flex items-center gap-1" title="Reactions across your statuses">
                      <span aria-hidden="true">{"❤️"}</span>
                      {totalReactions}
                    </span>
                  )}
                </div>
              )}
            </div>

            {isLoading && feed.length === 0 ? (
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
              <div className="bg-white dark:bg-ping-night-card rounded-2xl border border-ping-sand/60 dark:border-ping-night-border p-10 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-dashed border-ping-sand dark:border-ping-night-border" />
                <p className="text-sm font-semibold mb-1">No updates right now</p>
                <p className="text-xs text-ping-text-light dark:text-ping-night-text-light max-w-xs mx-auto">
                  When someone you chat with posts a status, it shows up here for 24 hours.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {recent.length > 0 && (
                  <FeedSection title="Recent updates" entries={recent} onOpen={openFeedEntry} />
                )}
                {viewed.length > 0 && (
                  <FeedSection title="Viewed updates" entries={viewed} onOpen={openFeedEntry} muted />
                )}
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

      {composing && (
        <StatusComposer
          onClose={() => {
            setComposing(false);
            void load();
          }}
        />
      )}

      {viewing && (
        <StatusViewer
          entries={viewing.entries}
          startEntryIndex={viewing.index}
          isOwn={viewing.own}
          onClose={() => {
            setViewing(null);
            // Reactions and new views change counts on the author's side, and
            // closing is the natural moment to catch up without a spinner mid-reel.
            void load();
          }}
        />
      )}
    </div>
  );
}

function FeedSection({
  title,
  entries,
  onOpen,
  muted = false,
}: {
  title: string;
  entries: StatusFeedEntry[];
  onOpen: (entry: StatusFeedEntry) => void;
  muted?: boolean;
}) {
  return (
    <section>
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ping-teal dark:text-ping-teal-light mb-3">
        {title}
      </p>
      <div className="bg-white dark:bg-ping-night-card rounded-2xl border border-ping-sand/60 dark:border-ping-night-border overflow-hidden">
        {entries.map((entry) => {
          const latest = entry.statuses[entry.statuses.length - 1];
          const preview =
            latest?.type === "TEXT"
              ? latest.text
              : latest?.text
              ? `📷 ${latest.text}`
              : "📷 Photo";

          return (
            <button
              key={entry.authorId}
              onClick={() => onOpen(entry)}
              className={`w-full flex items-center gap-4 p-4 text-left hover:bg-ping-cream-dark/40 dark:hover:bg-ping-night-bg transition border-b border-ping-sand/40 dark:border-ping-night-border last:border-b-0 ${
                muted ? "opacity-80" : ""
              }`}
            >
              <StatusRing statuses={entry.statuses} label={entry.authorUsername} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-bold truncate">{entry.authorUsername}</p>
                  <span className="text-[11px] text-ping-text-light dark:text-ping-night-text-light flex-shrink-0">
                    {formatRelativeTime(entry.latestAt)}
                  </span>
                </div>
                <p className="text-xs text-ping-text-light dark:text-ping-night-text-light truncate">
                  {preview}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
