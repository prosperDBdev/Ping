"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/authStore";
import useChatStore from "@/store/chatStore";
import useConversationsSync from "@/hooks/useConversationsSync";
import useWorkspaceStore from "@/store/workspaceStore";
import NavSidebar from "@/components/sidebar/NavSidebar";
import ConversationItem from "@/components/sidebar/ConversationItem";
import MobileBottomNav from "@/components/common/MobileBottomNav";
import PingLogo from "@/components/common/PingLogo";
import ThemeToggle from "@/components/common/ThemeToggle";
import ExpiryBadge from "@/components/temporary/ExpiryBadge";
import { formatDueDate, formatEventDate } from "@/lib/time";
import { PRIORITY_META } from "@/lib/taskMeta";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="bg-white dark:bg-ping-night-card rounded-2xl border border-ping-sand/60 dark:border-ping-night-border p-5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-4 ${accent}`}>{icon}</div>
      <p className="text-2xl font-black text-ping-dark dark:text-ping-night-text leading-none">{value}</p>
      <p className="text-xs font-semibold text-ping-text-light dark:text-ping-night-text-light mt-1.5">{label}</p>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { conversations, isLoadingConversations, conversationsFailed, fetchConversations, setActiveConversation } =
    useChatStore();
  const { allTasks, allEvents } = useWorkspaceStore();

  const [search, setSearch] = useState("");

  useConversationsSync();

  const tasks = allTasks();
  const events = allEvents();

  const openTasks = useMemo(() => tasks.filter((t) => t.status !== "COMPLETED"), [tasks]);
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return events
      .filter((e) => new Date(e.date + "T00:00:00") >= now)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [events]);
  const fileCount = useMemo(
    () => tasks.reduce((acc, t) => acc + t.attachments.length, 0),
    [tasks]
  );
  // The backend already excludes expired temporary conversations from
  // /conversations, so anything still marked temporary here is live.
  const activeTemporary = useMemo(
    () => conversations.filter((c) => c.temporary),
    [conversations]
  );

  const filteredConversations = useMemo(() => {
    const sorted = [...conversations].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    if (!search.trim()) return sorted.slice(0, 6);
    const q = search.toLowerCase();
    return sorted
      .filter((c) => {
        const other = c.participants.find((p) => p.id !== user?.id);
        const name = c.type === "GROUP" ? c.name : other?.username;
        return name?.toLowerCase().includes(q);
      })
      .slice(0, 6);
  }, [conversations, search, user?.id]);

  const filteredTasks = useMemo(() => {
    if (!search.trim()) return openTasks.slice(0, 5);
    const q = search.toLowerCase();
    return openTasks.filter((t) => t.title.toLowerCase().includes(q)).slice(0, 5);
  }, [openTasks, search]);

  const conversationForTask = (conversationId: string) =>
    conversations.find((c) => c.id === conversationId);

  const goToConversation = (conversationId: string) => {
    const conv = conversations.find((c) => c.id === conversationId);
    if (conv) setActiveConversation(conv);
    router.push("/chat");
  };

  const userInitials = user?.username
    ? user.username.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <div className="h-screen bg-ping-cream dark:bg-ping-night-bg flex overflow-hidden font-sans text-ping-dark dark:text-ping-night-text">
      <NavSidebar
        activeView="dashboard"
        onGoDashboard={() => {}}
        onGoMemories={() => router.push("/memories")}
        onGoStatus={() => router.push("/status")}
        onSelectConversations={() => router.push("/chat")}
        onNewChat={() => router.push("/chat?view=new-private")}
        onNewGroup={() => router.push("/chat?view=new-group")}
        onOpenSettings={() => router.push("/chat?view=settings")}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4 px-4 sm:px-8 py-4 border-b border-ping-sand/60 dark:border-ping-night-border flex-shrink-0">
          <div className="md:hidden">
            <PingLogo compact />
          </div>
          <div className="relative flex-1 max-w-md">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ping-text-light dark:text-ping-night-text-light"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations and tasks..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#EFEAE2] dark:bg-ping-night-card border border-ping-sand/60 dark:border-ping-night-border rounded-xl text-sm text-ping-dark dark:text-ping-night-text placeholder-ping-text-light/60 dark:placeholder-ping-night-text-light/60 focus:outline-none focus:ring-2 focus:ring-ping-teal/30 transition"
            />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="hidden sm:block">
              <ThemeToggle variant="pill" />
            </div>
            <button
              onClick={() => router.push("/chat?view=settings")}
              className="relative"
              aria-label="Profile & settings"
            >
              <div className="w-9 h-9 bg-slate-400 dark:bg-slate-600 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-xs">
                {userInitials}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-ping-green rounded-full border border-white dark:border-ping-night-bg" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8">
            {/* Greeting */}
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ping-teal dark:text-ping-teal-light mb-1.5">
              Your workspace at a glance
            </p>
            <h1 className="text-2xl sm:text-3xl font-black text-ping-dark dark:text-ping-night-text mb-8">
              {greeting()}{user?.username ? `, ${user.username.split(" ")[0]}` : ""}
            </h1>

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-10">
              <StatCard
                label="Active conversations"
                value={conversations.length}
                accent="bg-ping-sage dark:bg-ping-night-sage text-ping-teal dark:text-ping-teal-light"
                icon={
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                }
              />
              <StatCard
                label="Open tasks"
                value={openTasks.length}
                accent="bg-ping-orange/10 text-ping-orange"
                icon={
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
              <StatCard
                label="Upcoming events"
                value={upcomingEvents.length}
                accent="bg-[#fdf3d9] dark:bg-[#3a3320] text-[#8a6d1f] dark:text-[#f4ce62]"
                icon={
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                }
              />
              <StatCard
                label="Recent files"
                value={fileCount}
                accent="bg-blue-50 dark:bg-blue-900/20 text-blue-500"
                icon={
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                }
              />
              <StatCard
                label="Temporary chats"
                value={activeTemporary.length}
                accent="bg-purple-50 dark:bg-purple-900/20 text-purple-500"
                icon={
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
            </div>

            <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8">
              {/* Recent conversations */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-black text-ping-dark dark:text-ping-night-text">
                    Recent conversations
                  </h2>
                  <button
                    onClick={() => router.push("/chat")}
                    className="text-xs font-bold text-ping-teal dark:text-ping-teal-light hover:underline"
                  >
                    Open inbox →
                  </button>
                </div>

                {isLoadingConversations ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-ping-sand dark:border-ping-night-border border-t-ping-teal rounded-full animate-spin" />
                  </div>
                ) : conversationsFailed ? (
                  // Distinct from the empty state on purpose. "No conversations
                  // yet" is a claim about your data; this is a claim about the
                  // connection, and telling someone the former when the latter
                  // is true is how a transient outage gets mistaken for lost
                  // data.
                  <div className="bg-white dark:bg-ping-night-card rounded-2xl border border-ping-sand/60 dark:border-ping-night-border p-8 text-center">
                    <p className="text-sm font-semibold text-ping-dark dark:text-ping-night-text mb-1">
                      Couldn&apos;t reach the server
                    </p>
                    <p className="text-xs text-ping-text-light dark:text-ping-night-text-light mb-4">
                      Your conversations are still there — this device just couldn&apos;t load
                      them. Still trying; they&apos;ll appear on their own once it connects.
                    </p>
                    <button
                      onClick={() => fetchConversations()}
                      className="text-xs font-bold text-white bg-ping-orange px-4 py-2 rounded-xl hover:bg-ping-orange-light transition"
                    >
                      Try again
                    </button>
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="bg-white dark:bg-ping-night-card rounded-2xl border border-ping-sand/60 dark:border-ping-night-border p-8 text-center">
                    <p className="text-sm font-semibold text-ping-dark dark:text-ping-night-text mb-1">
                      No conversations yet
                    </p>
                    <p className="text-xs text-ping-text-light dark:text-ping-night-text-light mb-4">
                      Start one to see it show up here.
                    </p>
                    <button
                      onClick={() => router.push("/chat?view=new-private")}
                      className="text-xs font-bold text-white bg-ping-orange px-4 py-2 rounded-xl hover:bg-ping-orange-light transition"
                    >
                      New conversation
                    </button>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-ping-night-card rounded-2xl border border-ping-sand/60 dark:border-ping-night-border overflow-hidden">
                    {filteredConversations.map((conv) => (
                      <ConversationItem
                        key={conv.id}
                        conversation={conv}
                        isActive={false}
                        onClick={() => goToConversation(conv.id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Open tasks + upcoming events */}
              <div className="space-y-8">
                <div>
                  <h2 className="text-base font-black text-ping-dark dark:text-ping-night-text mb-3">
                    Open tasks
                  </h2>
                  {filteredTasks.length === 0 ? (
                    <div className="bg-white dark:bg-ping-night-card rounded-2xl border border-ping-sand/60 dark:border-ping-night-border p-6 text-center">
                      <p className="text-xs text-ping-text-light dark:text-ping-night-text-light">
                        Nothing open. Turn a message into a task from any conversation.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredTasks.map((task) => {
                        const conv = conversationForTask(task.conversationId);
                        const priority = PRIORITY_META[task.priority];
                        return (
                          <button
                            key={task.id}
                            onClick={() => goToConversation(task.conversationId)}
                            className="w-full text-left bg-white dark:bg-ping-night-card rounded-xl border border-ping-sand/60 dark:border-ping-night-border p-3.5 hover:border-ping-teal/40 transition flex items-center gap-3"
                          >
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${priority.dot}`} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-ping-dark dark:text-ping-night-text truncate">
                                {task.title}
                              </p>
                              <p className="text-[11px] text-ping-text-light dark:text-ping-night-text-light truncate">
                                {conv?.type === "GROUP" ? conv.name : conv?.participants.find((p) => p.id !== user?.id)?.username || "Conversation"}
                                {task.dueDate ? ` · ${formatDueDate(task.dueDate)}` : ""}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <h2 className="text-base font-black text-ping-dark dark:text-ping-night-text mb-3">
                    Upcoming events
                  </h2>
                  {upcomingEvents.length === 0 ? (
                    <div className="bg-white dark:bg-ping-night-card rounded-2xl border border-ping-sand/60 dark:border-ping-night-border p-6 text-center">
                      <p className="text-xs text-ping-text-light dark:text-ping-night-text-light">
                        Nothing scheduled yet.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {upcomingEvents.slice(0, 4).map((event) => (
                        <button
                          key={event.id}
                          onClick={() => goToConversation(event.conversationId)}
                          className="w-full text-left bg-white dark:bg-ping-night-card rounded-xl border border-ping-sand/60 dark:border-ping-night-border p-3.5 hover:border-ping-teal/40 transition"
                        >
                          <p className="text-sm font-semibold text-ping-dark dark:text-ping-night-text truncate">
                            {event.title}
                          </p>
                          <p className="text-[11px] text-ping-text-light dark:text-ping-night-text-light">
                            {formatEventDate(event.date)}
                            {event.time ? ` · ${event.time}` : ""}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {activeTemporary.length > 0 && (
                  <div>
                    <h2 className="text-base font-black text-ping-dark dark:text-ping-night-text mb-3">
                      Temporary conversations
                    </h2>
                    <div className="space-y-2">
                      {activeTemporary.map((conv) => (
                        <button
                          key={conv.id}
                          onClick={() => goToConversation(conv.id)}
                          className="w-full flex items-center justify-between bg-white dark:bg-ping-night-card rounded-xl border border-ping-sand/60 dark:border-ping-night-border p-3.5 hover:border-ping-teal/40 transition"
                        >
                          <span className="text-sm font-semibold text-ping-dark dark:text-ping-night-text">
                            {conv.participants.find((p) => p.id !== user?.id)?.username || "Conversation"}
                          </span>
                          {conv.expiresAt && <ExpiryBadge expiresAt={conv.expiresAt} size="sm" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <MobileBottomNav
          active="home"
          onHome={() => {}}
          onPings={() => router.push("/chat")}
          onMoments={() => router.push("/status")}
          onSettings={() => router.push("/chat?view=settings")}
        />
      </div>
    </div>
  );
}
