"use client";

import Avatar from "@/components/common/Avatar";
import { useState } from "react";
import toast from "react-hot-toast";
import { apiErrorMessage } from "@/lib/messages";
import { Conversation, User, WorkspaceSection } from "@/types";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { removeGroupMember } from "@/lib/moderation";
import { canAddMembers, groupOwnerId, isGroupAdmin, leaveGroup, setGroupAdmin, setWhoCanAdd } from "@/lib/groups";
import AddParticipantsSheet from "@/components/chat/AddParticipantsSheet";
import GroupInvitePanel from "@/components/chat/GroupInvitePanel";
import useAuthStore from "@/store/authStore";
import { chatName, chatPartner, isSelfChat } from "@/lib/conversation";
import useWorkspaceStore from "@/store/workspaceStore";
import ExpiryBadge from "@/components/temporary/ExpiryBadge";
import { colorFor } from "@/lib/avatar";

interface ConversationInfoPanelProps {
  conversation: Conversation;
  onClose: () => void;
  onJumpToSection: (section: WorkspaceSection) => void;
  /** Called after a member is removed, so the caller can refresh. */
  onMemberRemoved?: () => void;
  /** Open (or create) a private chat with a member, from "Message @name". */
  onMessageMember?: (member: User) => void;
}

export default function ConversationInfoPanel({
  conversation,
  onClose,
  onJumpToSection,
  onMemberRemoved,
  onMessageMember,
}: ConversationInfoPanelProps) {
  // Which member's "Message @name" menu is open, if any.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const { user: currentUser } = useAuthStore();
  const [removingMember, setRemovingMember] = useState<User | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  // The server sends the full admin list, so the app can finally tell who is
  // one. It used to send a single `admin` id that the app never received, which
  // is why the admin-only buttons had never appeared for anyone.
  const isAdmin = isGroupAdmin(conversation, currentUser?.id);
  const ownerId = groupOwnerId(conversation);
  const mayAdd = canAddMembers(conversation, currentUser?.id);
  const everyoneCanAdd = conversation.addMembersBy === "EVERYONE";
  const [addingMembers, setAddingMembers] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const { tasksByConversation, eventsByConversation, pinsByConversation } =
    useWorkspaceStore();

  const isGroup = conversation.type === "GROUP";
  const otherUser = chatPartner(conversation, currentUser?.id);
  const displayName = chatName(conversation, currentUser?.id);
  const tagline = isGroup
    ? conversation.tagline || "A room for the unhurried."
    : isSelfChat(conversation)
      ? "Notes, links and files for yourself"
      : otherUser?.status === "ONLINE" ? "Online now" : "Offline";

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

  const handleLeave = async () => {
    setLeaving(true);
    try {
      await leaveGroup(conversation.id);
      toast.success(`You left "${conversation.name}"`);
      setConfirmingLeave(false);
      onMemberRemoved?.();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't leave the group"));
    } finally {
      setLeaving(false);
    }
  };

  const changeWhoCanAdd = async () => {
    try {
      await setWhoCanAdd(conversation.id, everyoneCanAdd ? "ADMINS_ONLY" : "EVERYONE");
      onMemberRemoved?.();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't change that setting"));
    }
  };

  const toggleAdmin = async (member: User) => {
    const making = !isGroupAdmin(conversation, member.id);
    try {
      await setGroupAdmin(conversation.id, member.id, making);
      toast.success(making ? `${member.username} is now an admin` : `${member.username} is no longer an admin`);
      onMemberRemoved?.();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't change that admin"));
    }
  };

  return (
    // Phones: a full-screen panel over the chat. It used to be "hidden md:flex",
    // which meant it simply didn't exist below 768px wide: tapping a group's
    // name on a phone "opened" it invisibly, so group members on phones could
    // never see who else was in the group. From md up it's the side panel again.
    // data-no-swipe: while it covers the screen, a sideways flick is scrolling
    // the member list, not a request to change tabs.
    <div data-no-swipe className="fixed inset-0 z-50 flex w-full md:static md:z-auto md:w-[300px] flex-shrink-0 h-full border-l border-ping-sand/60 dark:border-ping-night-border bg-ping-cream dark:bg-ping-night-surface flex-col overflow-y-auto scrollbar-thin">
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
          <Avatar
            username={otherUser?.username ?? displayName}
            avatarUrl={otherUser?.avatarUrl}
            className="w-16 h-16 mb-3"
            textClassName="text-xl"
            fallbackClassName={colorFor(displayName)}
            enlargeable
          />
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
        {mayAdd && (
          <button
            onClick={() => setAddingMembers(true)}
            className="w-full mb-3 py-2.5 rounded-xl border border-ping-sand dark:border-ping-night-border text-xs font-bold text-ping-teal dark:text-ping-teal-light hover:bg-ping-cream dark:hover:bg-ping-night-card-active transition flex items-center justify-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add participants
          </button>
        )}
        <div className="space-y-3">
          {conversation.participants.map((p) => (
            <div key={p.id}>
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <Avatar
                  username={p.username}
                  avatarUrl={p.avatarUrl}
                  className="w-8 h-8"
                  textClassName="text-[10px]"
                  fallbackClassName={colorFor(p.username)}
                />
                {p.status === "ONLINE" && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-ping-green rounded-full border-2 border-ping-cream dark:border-ping-night-surface" />
                )}
              </div>
              {/* Tap someone else's name for "Message @name", as in WhatsApp. */}
              <button
                type="button"
                disabled={p.id === currentUser?.id || !onMessageMember}
                onClick={() => setMenuFor((open) => (open === p.id ? null : p.id))}
                aria-expanded={menuFor === p.id}
                className="text-left text-sm font-medium text-ping-dark dark:text-ping-night-text truncate flex-1 enabled:hover:text-ping-teal dark:enabled:hover:text-ping-teal-light transition"
              >
                {p.username}
                {p.id === currentUser?.id ? " (you)" : ""}
              </button>
              {conversation.admins?.includes(p.id) && (
                <span className="text-[9px] font-bold uppercase tracking-wide text-ping-teal dark:text-ping-teal-light bg-ping-sage dark:bg-ping-night-sage px-2 py-0.5 rounded-full flex-shrink-0">
                  {p.id === ownerId ? "Owner" : "Admin"}
                </span>
              )}
              {/* Admin controls, as a menu rather than a row of icons, so a
                  group of 200 doesn't turn into a wall of buttons. Every
                  option here is enforced again by the server. */}
              {isAdmin && p.id !== currentUser?.id && (
                <button
                  onClick={() => setMenuFor(menuFor === p.id ? null : p.id)}
                  aria-label={`Manage ${p.username}`}
                  aria-expanded={menuFor === p.id}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-ping-text-light dark:text-ping-night-text-light hover:bg-ping-cream-dark dark:hover:bg-ping-night-card-active transition flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                  </svg>
                </button>
              )}
            </div>
            {/* The admin's menu for one member. Takes precedence over the
                "Message @name" menu, which is for everyone else. */}
            {isAdmin && menuFor === p.id && p.id !== currentUser?.id && (
              <div className="ml-11 mt-1.5 rounded-xl border border-ping-sand/60 dark:border-ping-night-border bg-white dark:bg-ping-night-card shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    setMenuFor(null);
                    void toggleAdmin(p);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-ping-dark dark:text-ping-night-text hover:bg-ping-cream dark:hover:bg-ping-night-card-active transition"
                >
                  <svg className="w-4 h-4 text-ping-teal dark:text-ping-teal-light" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {isGroupAdmin(conversation, p.id) ? "Dismiss as admin" : "Make admin"}
                </button>
                {onMessageMember && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuFor(null);
                      onMessageMember(p);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-ping-dark dark:text-ping-night-text hover:bg-ping-cream dark:hover:bg-ping-night-card-active transition"
                  >
                    <svg className="w-4 h-4 text-ping-teal dark:text-ping-teal-light" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                    </svg>
                    Message @{p.username}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMenuFor(null);
                    setRemovingMember(p);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-red-500 hover:bg-red-500/10 transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                  </svg>
                  Remove from group
                </button>
              </div>
            )}
            {/* For everyone else: the plain "Message @name" menu. Admins get
                the richer menu above instead of both. */}
            {menuFor === p.id && onMessageMember && !(isAdmin && p.id !== currentUser?.id) && (
              <div className="ml-11 mt-1.5 rounded-xl border border-ping-sand/60 dark:border-ping-night-border bg-white dark:bg-ping-night-card shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    setMenuFor(null);
                    onMessageMember(p);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-ping-dark dark:text-ping-night-text hover:bg-ping-cream dark:hover:bg-ping-night-card-active transition"
                >
                  <svg className="w-4 h-4 text-ping-teal dark:text-ping-teal-light" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                  Message @{p.username}
                </button>
              </div>
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

      {/* Group controls: only the bits that apply to you. */}
      {isGroup && (
        <>
          {isAdmin && (
            <>
              <div className="px-5 pb-5">
                <button
                  onClick={() => void changeWhoCanAdd()}
                  aria-pressed={everyoneCanAdd}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl border border-ping-sand/60 dark:border-ping-night-border text-left hover:bg-ping-cream dark:hover:bg-ping-night-card-active transition"
                >
                  <span
                    className={`w-9 h-5 rounded-full flex-shrink-0 flex items-center p-0.5 transition ${
                      everyoneCanAdd ? "bg-ping-teal justify-end" : "bg-ping-sand dark:bg-ping-night-border justify-start"
                    }`}
                    aria-hidden
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-ping-dark dark:text-ping-night-text">
                      Anyone can add people
                    </span>
                    <span className="block text-xs text-ping-text-light dark:text-ping-night-text-light">
                      {everyoneCanAdd
                        ? "On — any member can add anyone to this group"
                        : "Off — only admins can add people"}
                    </span>
                  </span>
                </button>
              </div>

              <div className="px-5">
                <GroupInvitePanel conversationId={conversation.id} groupName={conversation.name} />
              </div>
            </>
          )}

          <div className="px-5 py-5">
            <button
              onClick={() => setConfirmingLeave(true)}
              className="text-sm font-semibold text-red-500 hover:underline"
            >
              Leave group
            </button>            {currentUser?.id === ownerId && (
              <p className="mt-1.5 text-xs text-ping-text-light dark:text-ping-night-text-light">
                You're the owner. Make someone else an admin before you leave, so the group isn&apos;t left
                without one.
              </p>
            )}
          </div>
        </>
      )}

      {addingMembers && (
        <AddParticipantsSheet
          open
          onClose={() => setAddingMembers(false)}
          conversation={conversation}
          onAdded={() => onMemberRemoved?.()}
        />
      )}

      {confirmingLeave && (
        <ConfirmDialog
          title={`Leave "${conversation.name ?? "this group"}"?`}
          body="You'll stop getting its messages. The group and everything in it stay exactly as they are, and the owner can add you back."
          confirmLabel="Leave group"
          destructive
          isWorking={leaving}
          onConfirm={() => void handleLeave()}
          onCancel={() => setConfirmingLeave(false)}
        />
      )}
    </div>
  );
}
