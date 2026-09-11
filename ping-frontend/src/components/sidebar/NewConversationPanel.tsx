"use client";

import { useMemo, useState } from "react";
import api from "@/lib/api";
import useChatStore from "@/store/chatStore";
import useAuthStore from "@/store/authStore";
import { Conversation, User } from "@/types";
import toast from "react-hot-toast";
import TemporaryConversationModal from "@/components/temporary/TemporaryConversationModal";

interface NewConversationPanelProps {
  initialTab?: "private" | "group";
  onClose: () => void;
  onConversationCreated: (conversation: Conversation) => void;
  /** Returns false if the invite couldn't be sent (socket not connected). */
  onInviteTemporary: (toUserId: string, durationMs: number, durationLabel: string) => boolean;
}

const avatarColors = [
  "bg-ping-orange",
  "bg-ping-teal",
  "bg-purple-400",
  "bg-yellow-500",
  "bg-blue-400",
];

function initialsFor(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function colorFor(name: string) {
  return avatarColors[(name?.charCodeAt(0) || 0) % avatarColors.length];
}

type ConversationTab = "private" | "group" | "temporary";

export default function NewConversationPanel({
  initialTab = "private",
  onClose,
  onConversationCreated,
  onInviteTemporary,
}: NewConversationPanelProps) {
  const [tab, setTab] = useState<ConversationTab>(initialTab);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selected, setSelected] = useState<User[]>([]);
  const [groupName, setGroupName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [tempTarget, setTempTarget] = useState<User | null>(null);
  const [isCreatingTemp, setIsCreatingTemp] = useState(false);

  const { user: currentUser } = useAuthStore();
  const { conversations, createPrivateConversation, createGroupConversation } =
    useChatStore();

  const suggestedUsers = useMemo(() => {
    const map = new Map<string, User>();
    conversations.forEach((conv) => {
      conv.participants.forEach((p) => {
        if (p.id !== currentUser?.id) map.set(p.id, p);
      });
    });
    return Array.from(map.values());
  }, [conversations, currentUser?.id]);

  const handleSearch = async (value: string) => {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await api.get(`/users/search?q=${encodeURIComponent(value)}`);
      setResults(res.data);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const list = query.trim().length >= 2 ? results : suggestedUsers;

  const isSelected = (id: string) => selected.some((u) => u.id === id);

  const toggleSelected = (u: User) => {
    setSelected((prev) =>
      prev.some((s) => s.id === u.id)
        ? prev.filter((s) => s.id !== u.id)
        : [...prev, u]
    );
  };

  const handleRowClick = async (u: User) => {
    if (tab === "group") {
      toggleSelected(u);
      return;
    }

    if (tab === "temporary") {
      setTempTarget(u);
      return;
    }

    try {
      const conversation = await createPrivateConversation(u.id);
      onConversationCreated(conversation);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to start conversation";
      toast.error(message);
    }
  };

  // Sends an invite rather than creating anything: the other person has to
  // accept before a temporary conversation exists. It'll appear in both
  // inboxes via the /conversation-created WebSocket topic once they do.
  const handleConfirmTemporary = (durationMs: number, label: string) => {
    if (!tempTarget) return;
    setIsCreatingTemp(true);
    try {
      // Don't claim it was sent unless it actually was — this used to toast
      // success even when the socket wasn't connected and the invite was
      // silently dropped, leaving the recipient with nothing.
      if (!onInviteTemporary(tempTarget.id, durationMs, label)) {
        toast.error("Not connected — invite wasn't sent. Try again in a moment.");
        return;
      }

      toast.success(`Invite sent to ${tempTarget.username}`);
      setTempTarget(null);
      onClose();
    } finally {
      setIsCreatingTemp(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selected.length < 2 || isCreating) return;
    setIsCreating(true);
    try {
      const conversation = await createGroupConversation(
        groupName.trim(),
        selected.map((u) => u.id)
      );
      onConversationCreated(conversation);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create group";
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-ping-cream dark:bg-ping-night-bg overflow-hidden">
      {/* Header */}
      <div className="px-6 sm:px-10 pt-8 pb-5 flex items-start justify-between border-b border-ping-sand/60 dark:border-ping-night-border flex-shrink-0">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ping-teal dark:text-ping-teal-light mb-1">
            Start something good
          </p>
          <h1 className="text-2xl sm:text-3xl font-black text-ping-dark dark:text-ping-night-text">
            New conversation
          </h1>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center text-ping-text-light dark:text-ping-night-text-light hover:bg-ping-cream-dark dark:hover:bg-ping-night-card transition flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-6 sm:px-10 py-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          {/* Left: tabs, search, list */}
          <div>
            {/* Tabs */}
            <div className="inline-flex p-1 bg-ping-cream-dark dark:bg-ping-night-card rounded-full mb-5">
              <button
                onClick={() => setTab("private")}
                className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition ${
                  tab === "private"
                    ? "bg-white dark:bg-ping-night-card-active text-ping-dark dark:text-ping-night-text shadow-xs"
                    : "text-ping-text-light dark:text-ping-night-text-light"
                }`}
              >
                Private conversation
              </button>
              <button
                onClick={() => setTab("group")}
                className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition ${
                  tab === "group"
                    ? "bg-white dark:bg-ping-night-card-active text-ping-dark dark:text-ping-night-text shadow-xs"
                    : "text-ping-text-light dark:text-ping-night-text-light"
                }`}
              >
                Create a group
              </button>
              <button
                onClick={() => setTab("temporary")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition ${
                  tab === "temporary"
                    ? "bg-white dark:bg-ping-night-card-active text-ping-dark dark:text-ping-night-text shadow-xs"
                    : "text-ping-text-light dark:text-ping-night-text-light"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Temporary
              </button>
            </div>

            {tab === "temporary" && (
              <div className="mb-4 rounded-xl bg-[#fdf3d9] dark:bg-[#3a3320] border border-[#f4ce62]/40 px-3.5 py-2.5 text-xs text-[#8a6d1f] dark:text-[#f4ce62] leading-relaxed">
                Pick someone below, then choose how long the conversation should stick around.
              </div>
            )}

            {/* Search */}
            <div className="relative mb-4">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ping-text-light dark:text-ping-night-text-light"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by name or handle..."
                autoFocus
                className="w-full pl-11 pr-4 py-3 bg-white dark:bg-ping-night-card border border-ping-sand/70 dark:border-ping-night-border rounded-xl text-sm text-ping-dark dark:text-ping-night-text placeholder-ping-text-light/60 focus:outline-none focus:ring-2 focus:ring-ping-teal/30 focus:border-ping-teal transition"
              />
            </div>

            {tab === "group" && (
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Name your group"
                className="w-full mb-5 px-4 py-3 bg-white dark:bg-ping-night-card border border-ping-sand/70 dark:border-ping-night-border rounded-xl text-sm text-ping-dark dark:text-ping-night-text placeholder-ping-text-light/60 focus:outline-none focus:ring-2 focus:ring-ping-teal/30 focus:border-ping-teal transition"
              />
            )}

            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ping-text-light dark:text-ping-night-text-light mb-3">
              {query.trim().length >= 2 ? "Search results" : "People you may want to hear from"}
            </p>

            <div className="space-y-1">
              {isSearching && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-ping-sand dark:border-ping-night-border border-t-ping-teal rounded-full animate-spin" />
                </div>
              )}

              {!isSearching && list.length === 0 && (
                <p className="text-ping-text-light dark:text-ping-night-text-light text-sm py-6 text-center">
                  {query.trim().length >= 2
                    ? "No people found."
                    : "Search by name or handle to find someone."}
                </p>
              )}

              {!isSearching &&
                list.map((u) => {
                  const selectedRow = tab === "group" && isSelected(u.id);
                  return (
                    <button
                      key={u.id}
                      onClick={() => handleRowClick(u)}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl transition text-left border ${
                        selectedRow
                          ? "bg-ping-sage dark:bg-ping-night-sage border-ping-sage-border dark:border-ping-night-border"
                          : "border-transparent hover:bg-ping-cream-dark/70 dark:hover:bg-ping-night-card"
                      }`}
                    >
                      <div className="relative flex-shrink-0">
                        <div
                          className={`w-10 h-10 ${colorFor(u.username)} rounded-full flex items-center justify-center text-white font-bold text-xs shadow-xs`}
                        >
                          {initialsFor(u.username)}
                        </div>
                        {u.status === "ONLINE" && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-ping-green rounded-full border-2 border-white dark:border-ping-night-surface" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-ping-dark dark:text-ping-night-text text-sm truncate">
                          {u.username}
                        </p>
                        <p className="text-xs text-ping-text-light dark:text-ping-night-text-light truncate">
                          {u.email}
                        </p>
                      </div>

                      {tab === "group" ? (
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition ${
                            selectedRow
                              ? "bg-ping-teal dark:bg-ping-teal-light border-ping-teal dark:border-ping-teal-light text-white"
                              : "border-ping-sand dark:border-ping-night-border text-transparent"
                          }`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        </div>
                      ) : tab === "temporary" ? (
                        <svg className="w-4 h-4 text-[#8a6d1f] dark:text-[#f4ce62] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-ping-text-light dark:text-ping-night-text-light flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Right: tip card */}
          <div>
            <div className="bg-ping-cream-dark dark:bg-ping-night-card rounded-3xl p-6 border border-ping-sand/60 dark:border-ping-night-border sticky top-0">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-4 ${
                tab === "temporary" ? "bg-[#f4ce62]/20 text-[#8a6d1f] dark:text-[#f4ce62]" : "bg-ping-orange/15 text-ping-orange"
              }`}>
                {tab === "temporary" ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </div>
              <h3 className="text-lg font-black text-ping-dark dark:text-ping-night-text mb-2">
                {tab === "temporary" ? "Here for now, not forever." : "Keep it human."}
              </h3>
              <p className="text-sm text-ping-text-light dark:text-ping-night-text-light leading-relaxed">
                {tab === "temporary"
                  ? "Perfect for a quick coordination thread that doesn't need to live in your inbox forever."
                  : "A first message does not need a reason. It only needs to be true."}
              </p>

              {tab !== "temporary" && (
                <>
                  <div className="h-px bg-ping-sand/70 dark:bg-ping-night-border my-4" />
                  <p className="text-xs font-bold text-ping-dark dark:text-ping-night-text">
                    Selected · {selected.length}
                  </p>
                </>
              )}

              {tab === "group" && (
                <>
                  {selected.length > 0 && selected.length < 2 && (
                    <p className="text-[11px] text-ping-text-light dark:text-ping-night-text-light mt-2">
                      Pick at least one more person for a group.
                    </p>
                  )}
                  <button
                    onClick={handleCreateGroup}
                    disabled={!groupName.trim() || selected.length < 2 || isCreating}
                    className="mt-4 w-full bg-ping-dark dark:bg-ping-orange text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isCreating ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      "Create group"
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {tempTarget && (
        <TemporaryConversationModal
          open={!!tempTarget}
          onClose={() => setTempTarget(null)}
          participant={tempTarget}
          onConfirm={handleConfirmTemporary}
          isCreating={isCreatingTemp}
        />
      )}
    </div>
  );
}
