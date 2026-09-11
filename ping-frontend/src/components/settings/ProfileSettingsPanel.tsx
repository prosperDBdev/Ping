"use client";

import { useState } from "react";
import BlockedUsersSection from "@/components/settings/BlockedUsersSection";
import StatusPrivacySection from "@/components/settings/StatusPrivacySection";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/authStore";

interface SettingsRowProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick?: () => void;
  right?: React.ReactNode;
}

function SettingsRow({ icon, label, description, onClick, right }: SettingsRowProps) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-4 text-left transition ${
        onClick ? "hover:bg-ping-cream/70 dark:hover:bg-ping-night-card-active" : ""
      }`}
    >
      <div className="w-9 h-9 rounded-xl bg-ping-cream dark:bg-ping-night-surface flex items-center justify-center text-ping-teal dark:text-ping-teal-light flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-ping-dark dark:text-ping-night-text text-sm">
          {label}
        </p>
        {description && (
          <p className="text-xs text-ping-text-light dark:text-ping-night-text-light truncate">
            {description}
          </p>
        )}
      </div>
      {right}
    </Comp>
  );
}

const chevron = (
  <svg className="w-4 h-4 text-ping-text-light dark:text-ping-night-text-light flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

interface ProfileSettingsPanelProps {
  onBack?: () => void;
}

export default function ProfileSettingsPanel({ onBack }: ProfileSettingsPanelProps) {
  const router = useRouter();
  const { user, logout, updateProfile } = useAuthStore();

  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(user?.username || "");
  const [draftNote, setDraftNote] = useState(user?.note || "Here for the good stuff");
  const [notificationsOn, setNotificationsOn] = useState(true);

  const initials = user?.username
    ? user.username.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const handle = user?.username ? user.username.toLowerCase().replace(/\s+/g, "") : "you";
  const note = user?.note || "Here for the good stuff";

  const openEdit = () => {
    setDraftName(user?.username || "");
    setDraftNote(note);
    setIsEditing(true);
  };

  const saveEdit = () => {
    updateProfile({ username: draftName.trim() || user?.username, note: draftNote.trim() });
    setIsEditing(false);
  };

  const handleLogout = () => {
    logout();
    router.push("/auth/login");
  };

  return (
    <div className="flex-1 h-full overflow-y-auto scrollbar-thin bg-ping-cream dark:bg-ping-night-bg px-6 sm:px-10 py-8">
      {onBack && (
        <button
          onClick={onBack}
          className="md:hidden mb-4 flex items-center gap-1.5 text-sm font-semibold text-ping-text-light dark:text-ping-night-text-light hover:text-ping-dark dark:hover:text-ping-night-text transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to conversations
        </button>
      )}
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ping-teal dark:text-ping-teal-light mb-1">
        Your space
      </p>
      <h1 className="text-2xl sm:text-3xl font-black text-ping-dark dark:text-ping-night-text mb-8">
        Profile & settings
      </h1>

      <div className="grid gap-8 lg:grid-cols-[320px_1fr] max-w-4xl">
        {/* Profile card */}
        <div>
          <div className="bg-ping-cream-dark dark:bg-ping-night-card rounded-3xl p-6 border border-ping-sand/60 dark:border-ping-night-border text-center">
            <div className="relative inline-block mb-4">
              <div className="w-20 h-20 rounded-full bg-ping-dark dark:bg-ping-night-card-active text-white flex items-center justify-center text-2xl font-bold mx-auto">
                {initials}
              </div>
              <div className="absolute bottom-1 right-1 w-4 h-4 bg-ping-green rounded-full border-2 border-ping-cream-dark dark:border-ping-night-card" />
            </div>
            <h2 className="font-bold text-ping-dark dark:text-ping-night-text text-lg">
              {user?.username}
            </h2>
            <p className="text-xs text-ping-text-light dark:text-ping-night-text-light mt-1">
              @{handle} · {note}
            </p>
            <button
              onClick={openEdit}
              className="mt-4 w-full border border-ping-sand dark:border-ping-night-border rounded-xl py-2.5 text-sm font-semibold text-ping-dark dark:text-ping-night-text flex items-center justify-center gap-2 hover:bg-white dark:hover:bg-ping-night-card-active transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
              Edit profile
            </button>
          </div>
          <p className="text-xs text-ping-text-light dark:text-ping-night-text-light mt-4 px-1 leading-relaxed">
            Your profile is only visible to people you choose to talk with.
          </p>
        </div>

        {/* Right column */}
        <div className="space-y-8">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ping-text-light dark:text-ping-night-text-light mb-3">
              Profile
            </p>
            <div className="bg-white dark:bg-ping-night-card rounded-2xl border border-ping-sand/60 dark:border-ping-night-border divide-y divide-ping-sand/60 dark:divide-ping-night-border overflow-hidden">
              <SettingsRow
                onClick={openEdit}
                label="Display name"
                description={user?.username}
                right={chevron}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                }
              />
              <SettingsRow
                onClick={openEdit}
                label="Your note"
                description={note}
                right={chevron}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                  </svg>
                }
              />
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ping-text-light dark:text-ping-night-text-light mb-3">
              Preferences
            </p>
            <div className="bg-white dark:bg-ping-night-card rounded-2xl border border-ping-sand/60 dark:border-ping-night-border divide-y divide-ping-sand/60 dark:divide-ping-night-border overflow-hidden">
              <SettingsRow
                label="Message notifications"
                description="A gentle nudge when someone pings you"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                }
                right={
                  <button
                    onClick={() => setNotificationsOn((v) => !v)}
                    className={`w-11 h-6 rounded-full flex-shrink-0 flex items-center transition px-0.5 ${
                      notificationsOn
                        ? "bg-ping-teal dark:bg-ping-teal-light justify-end"
                        : "bg-ping-sand dark:bg-ping-night-border justify-start"
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
                  </button>
                }
              />
              <SettingsRow
                label="Privacy"
                description="Private by default"
                right={chevron}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                }
              />
              <SettingsRow
                label="Security"
                description="Password & sessions"
                right={chevron}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                }
              />
            </div>
          </div>

          <BlockedUsersSection />

          <div className="pt-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ping-teal dark:text-ping-teal-light mb-4">
              Status privacy
            </p>
            <StatusPrivacySection />
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-red-500 font-semibold text-sm hover:underline"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Logout of this space
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-ping-night-card rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="text-lg font-bold text-ping-dark dark:text-ping-night-text mb-4">
              Edit profile
            </h3>
            <label className="block text-xs font-semibold text-ping-dark dark:text-ping-night-text mb-1.5">
              Display name
            </label>
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="w-full mb-4 px-3.5 py-2.5 bg-ping-cream dark:bg-ping-night-surface border border-ping-sand dark:border-ping-night-border rounded-xl text-sm text-ping-dark dark:text-ping-night-text focus:outline-none focus:ring-2 focus:ring-ping-teal/30 transition"
            />
            <label className="block text-xs font-semibold text-ping-dark dark:text-ping-night-text mb-1.5">
              Your note
            </label>
            <input
              type="text"
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              maxLength={40}
              className="w-full mb-6 px-3.5 py-2.5 bg-ping-cream dark:bg-ping-night-surface border border-ping-sand dark:border-ping-night-border rounded-xl text-sm text-ping-dark dark:text-ping-night-text focus:outline-none focus:ring-2 focus:ring-ping-teal/30 transition"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 py-2.5 rounded-xl border border-ping-sand dark:border-ping-night-border text-ping-dark dark:text-ping-night-text text-sm font-semibold hover:bg-ping-cream dark:hover:bg-ping-night-surface transition"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="flex-1 py-2.5 rounded-xl bg-ping-dark text-white text-sm font-semibold hover:bg-ping-dark/90 transition"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
