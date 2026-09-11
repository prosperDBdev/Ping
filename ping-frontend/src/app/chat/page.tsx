"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/authStore";
import useChatStore from "@/store/chatStore";
import useWorkspaceStore from "@/store/workspaceStore";
import useWebSocket from "@/hooks/useWebSocket";
import useResizableSidebar from "@/hooks/useResizableSidebar";
import useConversationsSync from "@/hooks/useConversationsSync";
import NavSidebar from "@/components/sidebar/NavSidebar";
import NewConversationPanel from "@/components/sidebar/NewConversationPanel";
import ConversationItem from "@/components/sidebar/ConversationItem";
import ChatHeader from "@/components/chat/ChatHeader";
import MessageBubble from "@/components/chat/MessageBubble";
import MessageInput, { SentImageAttachment, SentVoiceAttachment } from "@/components/chat/MessageInput";
import ConversationInfoPanel from "@/components/chat/ConversationInfoPanel";
import ProfileSettingsPanel from "@/components/settings/ProfileSettingsPanel";
import WorkspaceTabs from "@/components/workspace/WorkspaceTabs";
import TasksPanel from "@/components/workspace/TasksPanel";
import EventsPanel from "@/components/workspace/EventsPanel";
import FilesPanel from "@/components/workspace/FilesPanel";
import PinnedPanel from "@/components/workspace/PinnedPanel";
import TaskComposer from "@/components/workspace/TaskComposer";
import EventComposer from "@/components/workspace/EventComposer";
import MemorySaveSheet from "@/components/chat/MemorySaveSheet";
import MobileBottomNav from "@/components/common/MobileBottomNav";
import {
  Conversation,
  Message,
  TemporaryChatInvite,
  TypingEvent,
  WorkspaceSection,
} from "@/types";
import TemporaryChatInvitePrompt from "@/components/temporary/TemporaryChatInvitePrompt";
import { fetchPendingTemporaryChatInvites } from "@/lib/temporaryChat";
import { fetchBlockedUsers } from "@/lib/moderation";
import toast, { Toaster } from "react-hot-toast";
import PingLogo from "@/components/common/PingLogo";
import ThemeToggle from "@/components/common/ThemeToggle";
import { parseReplyQuote, snippetFor } from "@/lib/messageActions";

type MainView = "inbox" | "new-private" | "new-group" | "settings";

export default function ChatPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    conversations,
    activeConversation,
    messages,
    isLoadingConversations,
    conversationsFailed,
    isLoadingMessages,
    fetchConversations,
    setActiveConversation,
    fetchMessages,
    markAsRead,
    clearChat,
  } = useChatStore();
  const { createTask, tasksByConversation, eventsByConversation, pinsByConversation } =
    useWorkspaceStore();

  const {
    sendMessage,
    sendTyping,
    sendRead,
    onTyping,
    inviteToTemporaryChat,
    respondToTemporaryChat,
    onTemporaryChatInvite,
    onTemporaryChatResponse,
    onRemovedFromConversation,
  } = useWebSocket();
  // A dashboard quick action can deep-link straight into a panel, e.g. /chat?view=new-private.
  // ChatPage only ever mounts client-side (ProtectedRoute gates it behind a
  // hydration check), so reading location.search in the initializer is safe.
  const [mainView, setMainView] = useState<MainView>(() => {
    if (typeof window === "undefined") return "inbox";
    const view = new URLSearchParams(window.location.search).get("view");
    return view === "new-private" || view === "new-group" || view === "settings" ? view : "inbox";
  });
  const [typingUser, setTypingUser] = useState<TypingEvent | null>(null);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileTab, setMobileTab] = useState<"home" | "pings" | "moments" | "settings">("pings");
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [workspaceSection, setWorkspaceSection] = useState<WorkspaceSection>("messages");

  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [taskComposerFor, setTaskComposerFor] = useState<Message | null>(null);
  const [eventComposerFor, setEventComposerFor] = useState<Message | null>(null);
  const [memorySaveFor, setMemorySaveFor] = useState<Message | null>(null);
  // A queue, not a single invite: several can be waiting after time offline,
  // and one arriving over the WebSocket shouldn't overwrite one already on
  // screen. They're shown one at a time, oldest-first.
  const [pendingTempInvites, setPendingTempInvites] = useState<TemporaryChatInvite[]>([]);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    width: sidebarWidth,
    isDragging: isDraggingSidebar,
    startDragging,
    onKeyDown: onSidebarKeyDown,
  } = useResizableSidebar({ defaultWidth: 400, minWidth: 300, maxWidth: 640 });

  // Tailwind's responsive prefixes can't express "only above md" for an inline
  // style, so the media query is checked here and the width simply isn't
  // applied on small screens.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsDesktop(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const sidebarWidthStyle = isDesktop
    ? { width: `${sidebarWidth}px`, maxWidth: `${sidebarWidth}px` }
    : undefined;

  // Blocked ids are held here rather than re-fetched per conversation: the
  // header needs to know "is this person blocked" for whichever chat is open,
  // and one list answers that for all of them.
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);

  const refreshBlockedUsers = useCallback(() => {
    fetchBlockedUsers()
      .then((users) => setBlockedUserIds(users.map((u) => u.id)))
      .catch(() => {
        // Non-fatal. The server enforces blocking regardless of what this
        // list says — it only drives which label the menu shows.
      });
  }, []);

  useEffect(() => {
    refreshBlockedUsers();
  }, [refreshBlockedUsers]);

  const isActiveConversationBlocked = Boolean(
    activeConversation &&
      activeConversation.type === "PRIVATE" &&
      activeConversation.participants.some(
        (p) => p.id !== user?.id && blockedUserIds.includes(p.id)
      )
  );

  // Initial load plus recovery (store-level retry + refetch on focus), shared
  // with the dashboard so the two can't drift apart again.
  useConversationsSync();

  useEffect(() => {
    if (activeConversation) {
      fetchMessages(activeConversation.id);
      markAsRead(activeConversation.id);
      sendRead(activeConversation.id);
      // Local UI state tied to the same "conversation changed" signal as
      // the data sync above — reset alongside it rather than in a second effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWorkspaceSection("messages");
      setIsInfoOpen(false);
      setReplyingTo(null);
    }
  }, [activeConversation?.id]);

  useEffect(() => {
    if (workspaceSection === "messages") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, workspaceSection]);

  useEffect(() => {
    onTyping((event: TypingEvent) => {
      if (event.isTyping) {
        setTypingUser(event);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 3000);
      } else {
        setTypingUser(null);
      }
    });
  }, [onTyping]);

  // Catch up on invites that arrived while this user was offline — the
  // WebSocket push below only reaches someone already connected.
  useEffect(() => {
    fetchPendingTemporaryChatInvites()
      .then((invites) => {
        // Oldest first, so the person who's been waiting longest is answered
        // first. The API returns newest-first for display purposes.
        setPendingTempInvites([...invites].reverse());
      })
      .catch(() => {
        // Non-fatal: live invites still arrive over the WebSocket, and a
        // failed catch-up shouldn't block the whole chat page from loading.
      });
  }, []);

  useEffect(() => {
    onTemporaryChatInvite((invite) => {
      setPendingTempInvites((prev) =>
        // Guard against the same invite arriving twice — e.g. the catch-up
        // fetch resolving just after a live push for the same one.
        prev.some((i) => i.id === invite.id) ? prev : [...prev, invite]
      );
    });

    onTemporaryChatResponse((event) => {
      if (event.accepted) {
        toast.success(`${event.byUsername} accepted — temporary chat started`);
      } else {
        toast(`${event.byUsername} declined the temporary chat`, { icon: "🚫" });
      }
    });

    onRemovedFromConversation((event) => {
      toast(`${event.removedBy} removed you from a group`, { icon: "👋" });
      // Close it if they're looking at it right now — the server will refuse
      // every request for it from here on, so leaving it open would just
      // produce errors.
      if (useChatStore.getState().activeConversation?.id === event.conversationId) {
        clearChat();
      }
      fetchConversations();
    });
  }, [
    onTemporaryChatInvite,
    onTemporaryChatResponse,
    onRemovedFromConversation,
    clearChat,
    fetchConversations,
  ]);

  const dismissTempInvite = useCallback((inviteId: string) => {
    setPendingTempInvites((prev) => prev.filter((i) => i.id !== inviteId));
  }, []);

  const handleRespondToTempInvite = useCallback(
    (inviteId: string, accept: boolean) => {
      // Keep the invite in the queue if the response never went out, so it
      // can be answered again rather than disappearing unanswered.
      if (!respondToTemporaryChat(inviteId, accept)) {
        toast.error("Not connected — couldn't send your response. Try again in a moment.");
        return;
      }

      dismissTempInvite(inviteId);
      toast.success(accept ? "Temporary chat started" : "Invite declined");
    },
    [respondToTemporaryChat, dismissTempInvite]
  );

  const goToInbox = useCallback(() => {
    setMainView("inbox");
    setMobileTab("pings");
  }, []);

  const handleSelectConversation = useCallback(
    (conv: typeof conversations[0]) => {
      setActiveConversation(conv);
      setShowMobileChat(true);
      setMainView("inbox");
      setIsInfoOpen(false);
    },
    [setActiveConversation]
  );

  const handleConversationCreated = useCallback(
    (conv: Conversation) => {
      setActiveConversation(conv);
      setShowMobileChat(true);
      setMainView("inbox");
      setIsInfoOpen(false);
    },
    [setActiveConversation]
  );

  const handleBack = useCallback(() => {
    setShowMobileChat(false);
    clearChat();
  }, [clearChat]);

  const handleSendMessage = useCallback(
    (content: string): boolean => {
      if (!activeConversation) return false;
      return sendMessage(activeConversation.id, content);
    },
    [activeConversation, sendMessage]
  );

  const handleSendVoiceNote = useCallback(
    (attachment: SentVoiceAttachment) => {
      if (!activeConversation) return;
      // A fallback caption for the rare client that ever displays raw message
      // content without understanding the VOICE type/attachment shape.
      sendMessage(activeConversation.id, "🎤 Voice message", "VOICE", attachment);
    },
    [activeConversation, sendMessage]
  );

  const handleSendImage = useCallback(
    (attachment: SentImageAttachment) => {
      if (!activeConversation) return;
      // Fallback caption, same reasoning as voice notes: anything displaying
      // raw content without understanding the IMAGE type still shows something
      // meaningful rather than an empty bubble.
      // The caption becomes the message body, so a photo and the words about
      // it stay one message. Falls back to a label when there's no caption, so
      // anything showing raw content (the sidebar preview, a client that
      // doesn't understand IMAGE) still shows something meaningful.
      sendMessage(activeConversation.id, attachment.caption || "📷 Photo", "IMAGE", {
        key: attachment.key,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        fileName: attachment.fileName,
      });
    },
    [activeConversation, sendMessage]
  );

  const handleTyping = useCallback(
    (isTyping: boolean) => {
      if (!activeConversation) return;
      sendTyping(activeConversation.id, isTyping);
    },
    [activeConversation, sendTyping]
  );

  const handleJumpToMessage = useCallback((messageId: string) => {
    setWorkspaceSection("messages");
    setTimeout(() => {
      document.getElementById(`message-${messageId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      setHighlightedMessageId(messageId);
      setTimeout(() => setHighlightedMessageId(null), 2200);
    }, 80);
  }, []);

  const handleCreateReminder = useCallback(
    (message: Message) => {
      if (!activeConversation || !user) return;
      const { body } = parseReplyQuote(message.content);
      createTask({
        conversationId: activeConversation.id,
        title: snippetFor(body, 60),
        isReminder: true,
        priority: "MEDIUM",
        assigneeId: user.id,
        sourceMessageId: message.id,
        sourceMessageSnippet: snippetFor(body),
        createdBy: user.id,
      });
      toast.success("Reminder added to Tasks");
    },
    [activeConversation, user, createTask]
  );

  const otherUser = activeConversation?.participants.find(
    (p) => p.id !== user?.id
  );
  const isGroupChat = activeConversation?.type === "GROUP";

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "TODAY";
    if (date.toDateString() === yesterday.toDateString()) return "YESTERDAY";
    return date
      .toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
      .toUpperCase();
  };

  const groupMessagesByDate = () => {
    const groups: { date: string; messages: typeof messages }[] = [];
    let currentKey = "";

    messages.forEach((msg) => {
      // Group by the raw ISO date (unambiguous), not a locale-formatted
      // string — round-tripping something like toLocaleDateString()'s
      // "30/08/2026" back through `new Date()` in formatDateLabel is
      // exactly how you get "Invalid Date": JS's non-ISO string parsing
      // generally assumes US-style MM/DD/YYYY, so a DD/MM/YYYY locale
      // string parses as nonsense (or not at all) depending on the
      // runtime's locale. Keep the original ISO string intact instead.
      const key = msg.createdAt.slice(0, 10);
      if (key !== currentKey) {
        currentKey = key;
        groups.push({ date: msg.createdAt, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });

    return groups;
  };

  // Date formatting for headers
  const now = new Date();
  const currentDate = now.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).toUpperCase();

  const currentHour = now.getHours();
  const isEvening = currentHour >= 17 || currentHour < 5;
  const mobileTitle = isEvening ? "Your evening pings" : "Your pings";

  const totalUnreadCount = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  const userInitials = user?.username
    ? user.username.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery.trim()) return true;
    const other = conv.participants.find((p) => p.id !== user?.id);
    const name = conv.type === "GROUP" ? conv.name : other?.username;
    return name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Temporary conversations get their own section in the list — kept visually
  // and structurally separate from the regular inbox so it's obvious at a
  // glance which conversations expire and which don't. (They already can't
  // affect each other underneath — this is purely about not having to wonder.)
  const regularConversations = filteredConversations.filter((conv) => !conv.temporary);
  const temporaryConversations = filteredConversations.filter((conv) => conv.temporary);

  const groupBanner =
    isGroupChat &&
    (activeConversation?.description ||
      `A small circle for ${activeConversation?.participants.length} people. This thread is just for the two of you — and whatever comes up.`);

  const workspaceCounts = {
    messages: 0,
    tasks: activeConversation
      ? (tasksByConversation[activeConversation.id] || []).filter((t) => t.status !== "COMPLETED").length
      : 0,
    files: activeConversation
      ? (tasksByConversation[activeConversation.id] || []).reduce((acc, t) => acc + t.attachments.length, 0)
      : 0,
    events: activeConversation ? (eventsByConversation[activeConversation.id] || []).length : 0,
    pinned: activeConversation ? (pinsByConversation[activeConversation.id] || []).length : 0,
  };

  const taskComposerSourceMessage = taskComposerFor
    ? { id: taskComposerFor.id, snippet: snippetFor(parseReplyQuote(taskComposerFor.content).body) }
    : null;
  const eventComposerSourceMessage = eventComposerFor
    ? { id: eventComposerFor.id, snippet: snippetFor(parseReplyQuote(eventComposerFor.content).body) }
    : null;

  return (
    <>
      <Toaster position="top-center" />
      <div className="h-screen bg-ping-cream dark:bg-ping-night-bg flex overflow-hidden font-sans text-ping-dark dark:text-ping-night-text">
        {/* Left Nav Sidebar (Desktop only) */}
        <NavSidebar
          activeView={mainView}
          onGoDashboard={() => router.push("/dashboard")}
          onGoMemories={() => router.push("/memories")}
          onGoStatus={() => router.push("/status")}
          onSelectConversations={goToInbox}
          onNewChat={() => setMainView("new-private")}
          onNewGroup={() => setMainView("new-group")}
          onOpenSettings={() => setMainView("settings")}
        />

        {mainView === "new-private" || mainView === "new-group" ? (
          <NewConversationPanel
            initialTab={mainView === "new-group" ? "group" : "private"}
            onClose={goToInbox}
            onConversationCreated={handleConversationCreated}
            onInviteTemporary={inviteToTemporaryChat}
          />
        ) : mainView === "settings" ? (
          <ProfileSettingsPanel onBack={goToInbox} />
        ) : (
          <>
            {/* Middle — Conversation List & Desktop Header Area */}
            <div
              // Width is only applied from md upward: on mobile the list is
              // full-width and the drag handle isn't rendered at all, so a
              // pixel width from a previous desktop session mustn't leak in.
              style={sidebarWidthStyle}
              className={`w-full bg-ping-cream dark:bg-ping-night-surface border-r border-ping-sand/60 dark:border-ping-night-border flex flex-col flex-shrink-0 ${
                showMobileChat ? "hidden md:flex" : "flex"
              }`}
            >
              {/* Top Banner (Desktop & Mobile Header) */}
              <div className="p-4 sm:p-5 border-b border-ping-sand/60 dark:border-ping-night-border bg-ping-cream dark:bg-ping-night-bg">
                {/* Mobile Top Header (Image 1 replica: Logo on left, Theme Pill + Profile Avatar on right) */}
                <div className="flex items-center justify-between pb-3 md:hidden">
                  <PingLogo />
                  <div className="flex items-center gap-2">
                    <ThemeToggle variant="pill" />
                    <button
                      onClick={() => setMainView("settings")}
                      className="relative"
                    >
                      <div className="w-8 h-8 bg-slate-400 dark:bg-slate-600 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-xs">
                        {userInitials}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-ping-green rounded-full border border-white dark:border-ping-night-bg" />
                    </button>
                  </div>
                </div>

                {/* Title & Actions Row */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-ping-text-light dark:text-ping-night-text-light">
                      {currentDate}
                    </p>
                    {/* Desktop: "Your space". Mobile: "Your pings" / "Your evening pings" */}
                    <h1 className="hidden md:block text-xl sm:text-2xl font-black text-ping-dark dark:text-ping-night-text mt-0.5 tracking-tight">
                      Your space
                    </h1>
                    <h1 className="md:hidden text-xl sm:text-2xl font-black text-ping-dark dark:text-ping-night-text mt-0.5 tracking-tight">
                      {mobileTitle}
                    </h1>
                    {isEvening && (
                      <p className="md:hidden text-xs text-ping-text-light dark:text-ping-night-text-light mt-0.5">
                        A calm place to chat with the people you don&apos;t want to miss.
                      </p>
                    )}
                  </div>

                  {/* Mobile: Floating Coral '+' button next to "Your pings" heading (Image 1 replica) */}
                  <button
                    onClick={() => setMainView("new-private")}
                    className="w-9 h-9 bg-ping-orange rounded-full flex items-center justify-center text-white hover:bg-ping-orange-light transition shadow-xs md:hidden"
                    title="New conversation"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </button>

                  {/* Desktop Header Actions (Image 2 replica: Sync icon + Profile dropdown) */}
                  <div className="hidden md:flex items-center gap-3">
                    {/* Sync/status indicator */}
                    <div
                      className="w-5 h-5 rounded-full border-2 border-dashed border-ping-text-light/40 dark:border-ping-night-text-light/40"
                      title="Synced"
                    />
                    {/* Profile dropdown */}
                    <button
                      onClick={() => setMainView("settings")}
                      className="flex items-center gap-1.5"
                    >
                      <div className="relative">
                        <div className="w-8 h-8 bg-slate-400 dark:bg-slate-600 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-xs">
                          {userInitials}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-ping-green rounded-full border border-white dark:border-ping-night-bg" />
                      </div>
                      <svg className="w-3.5 h-3.5 text-ping-text-light dark:text-ping-night-text-light" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Inbox Title Bar */}
              <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-ping-text-light dark:text-ping-night-text-light">
                    INBOX
                  </p>
                  <h2 className="text-base sm:text-lg font-bold text-ping-dark dark:text-ping-night-text">
                    Conversations
                  </h2>
                </div>
                <button
                  onClick={() => setMainView("new-private")}
                  className="w-8 h-8 bg-ping-orange rounded-full flex items-center justify-center text-white hover:bg-ping-orange-light transition shadow-xs flex-shrink-0"
                  title="New conversation"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
              </div>

              {/* Search Bar */}
              <div className="px-4 pb-2">
                <div className="relative">
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
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search conversations..."
                    className="w-full pl-10 pr-4 py-2.5 bg-[#EFEAE2] dark:bg-ping-night-card border border-ping-sand/60 dark:border-ping-night-border rounded-xl text-xs sm:text-sm text-ping-dark dark:text-ping-night-text placeholder-ping-text-light/60 dark:placeholder-ping-night-text-light/60 focus:outline-none focus:ring-2 focus:ring-ping-teal/30 transition shadow-inner"
                  />
                </div>
              </div>

              {/* Conversation List */}
              <div className="flex-1 overflow-y-auto scrollbar-thin py-1">
                {isLoadingConversations ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-ping-sand dark:border-ping-night-border border-t-ping-teal rounded-full animate-spin" />
                  </div>
                ) : conversationsFailed ? (
                  // Distinguished from "you have no chats" on purpose — an
                  // empty list because the server was unreachable is a very
                  // different thing to tell someone, and it's actionable.
                  <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                    <p className="text-ping-dark dark:text-ping-night-text font-semibold text-sm mb-1">
                      Couldn&apos;t reach the server
                    </p>
                    <p className="text-ping-text-light dark:text-ping-night-text-light text-xs mb-4">
                      Your conversations are still there — this device just
                      couldn&apos;t load them.
                    </p>
                    <button
                      onClick={() => fetchConversations()}
                      className="text-xs font-bold text-white bg-ping-orange px-4 py-2 rounded-xl hover:bg-ping-orange-light transition"
                    >
                      Try again
                    </button>
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-6">
                    <div className="w-14 h-14 bg-ping-cream-dark dark:bg-ping-night-card rounded-full flex items-center justify-center mb-3">
                      <svg className="w-7 h-7 text-ping-text-light dark:text-ping-night-text-light" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                      </svg>
                    </div>
                    <p className="text-ping-dark dark:text-ping-night-text font-semibold text-sm mb-1">
                      No conversations found
                    </p>
                    <p className="text-ping-text-light dark:text-ping-night-text-light text-xs text-center">
                      Start a new conversation to start chatting.
                    </p>
                  </div>
                ) : (
                  <>
                    {regularConversations.map((conv) => (
                      <ConversationItem
                        key={conv.id}
                        conversation={conv}
                        isActive={activeConversation?.id === conv.id}
                        onClick={() => handleSelectConversation(conv)}
                      />
                    ))}

                    {temporaryConversations.length > 0 && (
                      <div className="mt-2">
                        <div className="px-5 pt-3 pb-1.5 flex items-center gap-1.5">
                          <svg className="w-3 h-3 text-[#8a6d1f] dark:text-[#f4ce62]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8a6d1f] dark:text-[#f4ce62]">
                            Temporary · {temporaryConversations.length}
                          </p>
                        </div>
                        {temporaryConversations.map((conv) => (
                          <ConversationItem
                            key={conv.id}
                            conversation={conv}
                            isActive={activeConversation?.id === conv.id}
                            onClick={() => handleSelectConversation(conv)}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Bottom Card: "Your week, lightly held" (as seen in Pic 2 & Pic 3) */}
              <div className="p-3">
                <div className="bg-ping-sage dark:bg-ping-night-sage border border-ping-sage-border dark:border-ping-night-border rounded-2xl p-3.5 shadow-2xs">
                  <div className="flex items-center gap-2 mb-1 text-ping-teal dark:text-ping-teal-light font-bold text-xs">
                    <span>✨</span>
                    <span>Your week, lightly held</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-ping-dark/80 dark:text-ping-night-text/80">
                    You have {totalUnreadCount} unread conversation{totalUnreadCount !== 1 ? "s" : ""} and one calm thing to look forward to.
                  </p>
                </div>
              </div>

              {/* Mobile Bottom Navigation Bar */}
              <MobileBottomNav
                active={mobileTab === "home" ? "home" : mobileTab}
                onHome={() => router.push("/dashboard")}
                onPings={() => setMobileTab("pings")}
                onMoments={() => setMobileTab("moments")}
                onSettings={() => {
                  setMobileTab("settings");
                  setMainView("settings");
                }}
              />
            </div>

            {/* Drag handle between the conversation list and the chat.
                Desktop only — on mobile the two are separate full-screen views,
                so there's no boundary to drag. The hit area is wider than the
                visible line so it's actually grabbable. */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize conversation list"
              tabIndex={0}
              onMouseDown={startDragging}
              onKeyDown={onSidebarKeyDown}
              className={`hidden md:block w-1.5 -ml-1.5 relative z-10 cursor-col-resize group focus:outline-none ${
                showMobileChat ? "hidden md:block" : ""
              }`}
            >
              <div
                className={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 transition-colors ${
                  isDraggingSidebar
                    ? "bg-ping-orange"
                    : "bg-transparent group-hover:bg-ping-orange/40 group-focus:bg-ping-orange/60"
                }`}
              />
            </div>

            {/* Right — Chat Area */}
            <div
              className={`flex-1 flex min-w-0 ${
                showMobileChat ? "flex" : "hidden md:flex"
              }`}
            >
              {activeConversation ? (
                <>
                  <div className="flex-1 flex flex-col min-w-0">
                    <ChatHeader
                      conversation={activeConversation}
                      typingUser={typingUser}
                      onBack={handleBack}
                      onToggleInfo={() => setIsInfoOpen((v) => !v)}
                      isInfoOpen={isInfoOpen}
                      onViewMedia={() => setWorkspaceSection("files")}
                      isBlocked={isActiveConversationBlocked}
                      onCleared={() => fetchMessages(activeConversation.id)}
                      onBlockChanged={refreshBlockedUsers}
                    />

                    <WorkspaceTabs
                      active={workspaceSection}
                      onChange={setWorkspaceSection}
                      counts={workspaceCounts}
                    />

                    {workspaceSection === "tasks" ? (
                      <TasksPanel conversation={activeConversation} onJumpToMessage={handleJumpToMessage} />
                    ) : workspaceSection === "events" ? (
                      <EventsPanel conversation={activeConversation} onJumpToMessage={handleJumpToMessage} />
                    ) : workspaceSection === "files" ? (
                      <FilesPanel
                        conversation={activeConversation}
                        onJumpToMessage={handleJumpToMessage}
                      />
                    ) : workspaceSection === "pinned" ? (
                      <PinnedPanel conversation={activeConversation} onJumpToMessage={handleJumpToMessage} />
                    ) : (
                      <>
                        {/* Messages Container */}
                        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 bg-ping-cream dark:bg-ping-night-bg scrollbar-thin">
                          {isGroupChat && groupBanner && (
                            <div className="mb-6 rounded-2xl bg-ping-sage dark:bg-ping-night-sage border border-ping-sage-border dark:border-ping-night-border p-4 text-sm text-ping-dark/80 dark:text-ping-night-text/80 leading-relaxed">
                              <span className="font-bold text-ping-teal dark:text-ping-teal-light">
                                A small circle for a big table.{" "}
                              </span>
                              {groupBanner}
                            </div>
                          )}

                          {isLoadingMessages ? (
                            <div className="flex items-center justify-center h-full">
                              <div className="w-6 h-6 border-2 border-ping-sand dark:border-ping-night-border border-t-ping-teal rounded-full animate-spin" />
                            </div>
                          ) : messages.length === 0 ? (
                            <div className="flex items-center justify-center h-full">
                              <p className="text-ping-text-light dark:text-ping-night-text-light text-sm">
                                No messages yet. Say hello! 👋
                              </p>
                            </div>
                          ) : (
                            groupMessagesByDate().map((group) => (
                              <div key={group.date}>
                                <div className="flex items-center justify-center my-6">
                                  <div className="h-px bg-ping-sand/80 dark:bg-ping-night-border flex-1" />
                                  <span className="text-[10px] font-bold tracking-[0.18em] text-ping-text-light dark:text-ping-night-text-light px-4 uppercase">
                                    {formatDateLabel(group.date)}
                                  </span>
                                  <div className="h-px bg-ping-sand/80 dark:bg-ping-night-border flex-1" />
                                </div>
                                {group.messages.map((msg) => (
                                  <MessageBubble
                                    key={msg.id}
                                    message={msg}
                                    showSender={isGroupChat}
                                    highlighted={highlightedMessageId === msg.id}
                                    onReply={setReplyingTo}
                                    onCreateTask={setTaskComposerFor}
                                    onCreateEvent={setEventComposerFor}
                                    onCreateReminder={handleCreateReminder}
                                    onSaveToMemory={setMemorySaveFor}
                                  />
                                ))}
                              </div>
                            ))
                          )}

                          {/* Typing bubble — shows inline in the conversation, not just the header status */}
                          {typingUser?.isTyping && (
                            <div className="flex justify-start mb-3">
                              <div className="max-w-[70%] sm:max-w-[65%]">
                                <div className="px-4 py-3 shadow-xs bg-[#EAE4DA] dark:bg-ping-night-card rounded-2xl rounded-tl-xs inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-ping-text-light dark:bg-ping-night-text-light animate-bounce [animation-delay:-0.3s]" />
                                  <span className="w-1.5 h-1.5 rounded-full bg-ping-text-light dark:bg-ping-night-text-light animate-bounce [animation-delay:-0.15s]" />
                                  <span className="w-1.5 h-1.5 rounded-full bg-ping-text-light dark:bg-ping-night-text-light animate-bounce" />
                                </div>
                              </div>
                            </div>
                          )}

                          <div ref={messagesEndRef} />
                        </div>

                        <MessageInput
                          onSend={handleSendMessage}
                          onSendVoice={handleSendVoiceNote}
                          onSendImage={handleSendImage}
                          onTyping={handleTyping}
                          recipientName={isGroupChat ? activeConversation.name || undefined : otherUser?.username}
                          replyingTo={replyingTo}
                          onCancelReply={() => setReplyingTo(null)}
                        />
                      </>
                    )}
                  </div>

                  {isInfoOpen && (
                    <ConversationInfoPanel
                      conversation={activeConversation}
                      onClose={() => setIsInfoOpen(false)}
                      onJumpToSection={setWorkspaceSection}
                      onMemberRemoved={() => fetchConversations()}
                    />
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center bg-ping-cream dark:bg-ping-night-bg p-6">
                  <div className="text-center max-w-sm">
                    <div className="relative w-16 h-16 mx-auto mb-5">
                      <div className="w-16 h-16 bg-ping-orange rounded-2xl flex items-center justify-center shadow-md">
                        <svg
                          className="w-9 h-9 text-white"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          viewBox="0 0 24 24"
                        >
                          <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
                        </svg>
                      </div>
                      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#f4d063] rounded-full border-2 border-ping-cream dark:border-ping-night-bg" />
                    </div>
                    <h2 className="text-xl font-bold text-ping-dark dark:text-ping-night-text mb-2">
                      Welcome to Ping
                    </h2>
                    <p className="text-ping-text-light dark:text-ping-night-text-light text-xs sm:text-sm leading-relaxed">
                      Select a conversation from your inbox or start a new chat to begin messaging.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {activeConversation && taskComposerFor && (
        <TaskComposer
          open={!!taskComposerFor}
          onClose={() => setTaskComposerFor(null)}
          conversationId={activeConversation.id}
          participants={activeConversation.participants}
          sourceMessage={taskComposerSourceMessage}
          onSaved={() => setWorkspaceSection("tasks")}
        />
      )}

      {activeConversation && eventComposerFor && (
        <EventComposer
          open={!!eventComposerFor}
          onClose={() => setEventComposerFor(null)}
          conversationId={activeConversation.id}
          participants={activeConversation.participants}
          sourceMessage={eventComposerSourceMessage}
          onSaved={() => setWorkspaceSection("events")}
        />
      )}

      {pendingTempInvites.length > 0 && (
        <TemporaryChatInvitePrompt
          // Keyed by id so switching to the next queued invite remounts the
          // sheet rather than reusing the previous one's mounted state.
          key={pendingTempInvites[0].id}
          invite={pendingTempInvites[0]}
          remainingCount={pendingTempInvites.length - 1}
          onRespond={handleRespondToTempInvite}
          onClose={() => dismissTempInvite(pendingTempInvites[0].id)}
        />
      )}

      {memorySaveFor && (
        <MemorySaveSheet
          open={!!memorySaveFor}
          onClose={() => setMemorySaveFor(null)}
          messageId={memorySaveFor.id}
          messageSnippet={snippetFor(parseReplyQuote(memorySaveFor.content).body)}
        />
      )}
    </>
  );
}
