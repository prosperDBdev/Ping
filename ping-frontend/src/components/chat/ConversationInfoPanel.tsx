"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Conversation, User, WorkspaceSection } from "@/types";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { removeGroupMember } from "@/lib/moderation";
import useAuthStore from "@/store/authStore";
import useWorkspaceStore from "@/store/workspaceStore";
import ExpiryBadge from "@/components/temporary/ExpiryBadge";
import { colorFor, initialsFor } from "@/lib/avatar";

interface ConversationInfoPanelProps {
  conversation: Conversation;
  onClose: () => void;
  onJumpToSection: (section: WorkspaceSection) => void;
  /** Called after a member is removed, so the caller can refresh. */
  onMemberRemoved?: () => void;
}

export default function ConversationInfoPanel({
  conversation,
  onClose,
  onJumpToSection,
  onMemberRemoved,
}: ConversationInfoPanelProps) {
  const { user: currentUser } = useAuthStore();
  const [removingMember, setRemovingMember] = useState<User | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const isAdmin = conversation.type === "GROUP" && conversation.admin === currentUser?.id;
  const { tasksByConversation, eventsByConversation, pinsByConversation } =
    useWorkspaceStore();

  const isGroup = conversation.type === "GROUP";
  const otherUser = conversation.participants.find((p) => p.id !== currentUser?.id);
  const displayName = isGroup ? conversation.name : otherUser?.username || "Unknown";
  const tagline = isGroup ? conversation.tagline || "A room for the unhurried." : otherUser?.status === "ONLINE" ? "Online now" : "Offline";

  const isTemporary = conversation.temporary && conversation.expiresAt;
  const tasks = tasksByConversation[conversation.id] || [];
  const events = eventsByConversation[conversation.id] || [];
  const pins = pinsByConversation[conversation.id] || [];
  const openTasks = tasks.filter((t) => t.status !== "COMPLETED").length;

  const sections: { key: WorkspaceSection; label: string; count: number; icon: React.ReactNode }[] = [
    {
      key: "tasks",
      label: "Tasks",
      count: openTasks,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      key: "files",
      label: "Files",
      count: tasks.reduce((acc, t) => acc + t.attachments.length, 0),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
    },
    {
      key: "events",
      label: "Events",
      count: events.length,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      ),
    },
    {
      key: "pinned",
      label: "Pinned",
      count: pins.length,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="hidden md:flex w-[300px] flex-shrink-0 h-full border-l border-ping-sand/60 dark:border-ping-night-border bg-ping-cream dark:bg-ping-night-surface flex-col overflow-y-auto scrollbar-thin">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ping-text-light dark:text-ping-night-text-light">
          Details
        </p>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full flex items-center justify-center text-ping-text-light dark:text-ping-night-text-light hover:bg-ping-cream-dark dark:hover:bg-ping-night-card transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Identity */}
      <div className="flex flex-col items-center px-5 pb-6 text-center border-b border-ping-sand/60 dark:border-ping-night-border">
        {isGroup ? (
          <div className="w-16 h-16 rounded-full bg-ping-teal dark:bg-ping-teal-light text-white flex items-center justify-center mb-3">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
        ) : (
          <div className={`w-16 h-16 rounded-full ${colorFor(displayName)} text-white flex items-center justify-center mb-3 text-xl font-bold`}>
            {initialsFor(displayName)}
          </div>
        )}
        <h2 className="font-bold text-ping-dark dark:text-ping-night-text text-base">{displayName}</h2>
        <p className="text-xs text-ping-text-light dark:text-ping-night-text-light mt-1">{tagline}</p>
        {isTemporary && (
          <div className="mt-3">
            <ExpiryBadge expiresAt={conversation.expiresAt!} />
          </div>
        )}
      </div>

      {/* Workspace quick links */}
      <div className="px-5 py-5 border-b border-ping-sand/60 dark:border-ping-night-border">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ping-text-light dark:text-ping-night-text-light mb-3">
          Workspace
        </p>
        <div className="space-y-1">
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => onJumpToSection(s.key)}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-ping-cream-dark/70 dark:hover:bg-ping-night-card-active transition text-left"
            >
              <span className="w-8 h-8 rounded-lg bg-ping-cream-dark dark:bg-ping-night-card flex items-center justify-center text-ping-teal dark:text-ping-teal-light flex-shrink-0">
                {s.icon}
              </span>
              <span className="flex-1 text-sm font-semibold text-ping-dark dark:text-ping-night-text">
                {s.label}
              </span>
              {s.count > 0 && (
                <span className="text-xs font-bold text-ping-text-light dark:text-ping-night-text-light">
                  {s.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Members */}
      <div className="px-5 py-5 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ping-text-light dark:text-ping-night-text-light mb-3">
          Members · {conversation.participants.length}
        </p>
        <div className="space-y-3">
          {conversation.participants.map((p) => (
            <div key={p.id} className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <div className={`w-8 h-8 ${colorFor(p.username)} rounded-full flex items-center justify-center text-white font-bold text-[10px]`}>
                  {initialsFor(p.username)}
                </div>
                {p.status === "ONLINE" && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-ping-green rounded-full border-2 border-ping-cream dark:border-ping-night-surface" />
                )}
              </div>
              <p className="text-sm font-medium text-ping-dark dark:text-ping-night-text truncate flex-1">
                {p.username}
                {p.id === currentUser?.id ? " (you)" : ""}
              </p>
              {conversation.admin === p.id && (
                <span className="text-[9px] font-bold uppercase tracking-wide text-ping-teal dark:text-ping-teal-light bg-ping-sage dark:bg-ping-night-sage px-2 py-0.5 rounded-full flex-shrink-0">
                  Admin
                </span>
              )}
              {/* Only shown to the admin, and never against themselves. The
                  server enforces both rules independently — this just avoids
                  offering a button that would be refused. */}
              {isAdmin && p.id !== currentUser?.id && (
                <button
                  onClick={() => setRemovingMember(p)}
                  aria-label={`Remove ${p.username} from the group`}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-ping-text-light dark:text-ping-night-text-light hover:bg-red-500/10 hover:text-red-500 transition flex-shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {removingMember && (
        <ConfirmDialog
          title={`Remove ${removingMember.username}?`}
          body={`They'll be removed from "${conversation.name ?? "this group"}" and won't receive new messages. Everyone still in the group will see a note about it.`}
          confirmLabel="Remove"
          destructive
          isWorking={isRemoving}
          onConfirm={async () => {
            setIsRemoving(true);
            try {
              await removeGroupMember(conversation.id, removingMember.id);
              toast.success(`${removingMember.username} removed`);
              setRemovingMember(null);
              onMemberRemoved?.();
            } catch {
              toast.error("Couldn't remove them — try again.");
            } finally {
              setIsRemoving(false);
            }
          }}
          onCancel={() => setRemovingMember(null)}
        />
      )}
    </div>
  );
}
