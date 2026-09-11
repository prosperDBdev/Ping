"use client";

import PingLogo from "@/components/common/PingLogo";
import ThemeToggle from "@/components/common/ThemeToggle";
import useAuthStore from "@/store/authStore";

 type MainView = "dashboard" | "status" | "inbox" | "memories" | "new-private" | "new-group" | "settings";

interface NavSidebarProps {
  activeView: MainView;
  onGoDashboard?: () => void;
  onGoMemories?: () => void;
  onGoStatus?: () => void;
  onSelectConversations: () => void;
  onNewChat: () => void;
  onNewGroup: () => void;
  onOpenSettings: () => void;
}

export default function NavSidebar({
  activeView,
  onGoDashboard,
  onGoMemories,
  onGoStatus,
  onSelectConversations,
  onNewChat,
  onNewGroup,
  onOpenSettings,
}: NavSidebarProps) {
  const { user, logout } = useAuthStore();
  const initials = user?.username
    ? user.username.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <div className="w-52 bg-ping-cream dark:bg-ping-night-bg border-r border-ping-sand/60 dark:border-ping-night-border flex-col flex-shrink-0 hidden lg:flex">
      {/* Logo */}
      <div className="p-5 pb-6">
        <PingLogo />
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-3 space-y-1">
        {onGoDashboard && (
          <button
            onClick={onGoDashboard}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
              activeView === "dashboard"
                ? "bg-ping-cream-dark dark:bg-ping-night-card text-ping-dark dark:text-ping-night-text shadow-2xs"
                : "text-ping-text-light dark:text-ping-night-text-light font-medium hover:bg-ping-cream-dark/60 dark:hover:bg-ping-night-card"
            }`}
          >
            <svg className={`w-4 h-4 ${activeView === "dashboard" ? "text-ping-teal dark:text-ping-teal-light" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            Dashboard
          </button>
        )}
        <button
          onClick={onSelectConversations}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
            activeView === "inbox"
              ? "bg-ping-cream-dark dark:bg-ping-night-card text-ping-dark dark:text-ping-night-text shadow-2xs"
              : "text-ping-text-light dark:text-ping-night-text-light font-medium hover:bg-ping-cream-dark/60 dark:hover:bg-ping-night-card"
          }`}
        >
          <svg className={`w-4 h-4 ${activeView === "inbox" ? "text-ping-teal dark:text-ping-teal-light" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </svg>
          Conversations
        </button>

        {onGoStatus && (
          <button
            onClick={onGoStatus}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
              activeView === "status"
                ? "bg-ping-cream-dark dark:bg-ping-night-card text-ping-dark dark:text-ping-night-text shadow-2xs"
                : "text-ping-text-light dark:text-ping-night-text-light font-medium hover:bg-ping-cream-dark/60 dark:hover:bg-ping-night-card"
            }`}
          >
            <svg className={`w-4 h-4 ${activeView === "status" ? "text-ping-teal dark:text-ping-teal-light" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" strokeDasharray="4 3" />
              <circle cx="12" cy="12" r="3.5" />
            </svg>
            Status
          </button>
        )}

        {onGoMemories && (
          <button
            onClick={onGoMemories}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
              activeView === "memories"
                ? "bg-ping-cream-dark dark:bg-ping-night-card text-ping-dark dark:text-ping-night-text shadow-2xs"
                : "text-ping-text-light dark:text-ping-night-text-light font-medium hover:bg-ping-cream-dark/60 dark:hover:bg-ping-night-card"
            }`}
          >
            <span className="w-4 h-4 flex items-center justify-center text-sm leading-none">🧠</span>
            Memories
          </button>
        )}

        <button
          onClick={onNewChat}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition ${
            activeView === "new-private"
              ? "bg-ping-cream-dark dark:bg-ping-night-card text-ping-dark dark:text-ping-night-text font-semibold shadow-2xs"
              : "text-ping-text-light dark:text-ping-night-text-light font-medium hover:bg-ping-cream-dark/60 dark:hover:bg-ping-night-card"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
          New conversation
        </button>

        <button
          onClick={onNewGroup}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition ${
            activeView === "new-group"
              ? "bg-ping-cream-dark dark:bg-ping-night-card text-ping-dark dark:text-ping-night-text font-semibold shadow-2xs"
              : "text-ping-text-light dark:text-ping-night-text-light font-medium hover:bg-ping-cream-dark/60 dark:hover:bg-ping-night-card"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
          Create a group
        </button>
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-ping-sand/60 dark:border-ping-night-border space-y-2">
        <button
          onClick={onOpenSettings}
          className={`w-full flex items-center gap-2.5 p-2 rounded-xl transition ${
            activeView === "settings"
              ? "bg-ping-cream-dark dark:bg-ping-night-card"
              : "hover:bg-ping-cream-dark/60 dark:hover:bg-ping-night-card"
          }`}
        >
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-ping-dark dark:bg-ping-night-card-active text-white flex items-center justify-center text-[11px] font-bold">
              {initials}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-ping-green rounded-full border-2 border-ping-cream dark:border-ping-night-bg" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-bold text-ping-dark dark:text-ping-night-text truncate">
              {user?.username || "You"}
            </p>
            <p className="text-[10px] text-ping-text-light dark:text-ping-night-text-light">
              Your space
            </p>
          </div>
          <svg className="w-3.5 h-3.5 text-ping-text-light dark:text-ping-night-text-light flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        <ThemeToggle variant="card" />

        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-ping-text-light dark:text-ping-night-text-light hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 text-sm font-medium transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          Sign out
        </button>
      </div>
    </div>
  );
}