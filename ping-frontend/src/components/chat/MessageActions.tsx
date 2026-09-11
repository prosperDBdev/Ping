"use client";

import { useEffect, useRef, useState } from "react";
import Sheet from "@/components/common/Sheet";
import { SuggestedActions } from "@/lib/messageActions";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🎉", "👀"];

interface ActionCallbacks {
  onReply: () => void;
  onPin: () => void;
  onCreateTask: () => void;
  onCreateEvent: () => void;
  onCreateReminder: () => void;
  onSaveToMemory: () => void;
  onReact: (emoji: string) => void;
}

interface HoverToolbarProps extends ActionCallbacks {
  isPinned: boolean;
  isMine: boolean;
  align: "left" | "right";
}

/** Desktop-only toolbar that appears on message hover (progressive disclosure). */
export function MessageHoverToolbar({
  isPinned,
  align,
  onReply,
  onPin,
  onCreateTask,
  onCreateEvent,
  onCreateReminder,
  onSaveToMemory,
  onReact,
}: HoverToolbarProps) {
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickAway = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setReactionsOpen(false);
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`hidden sm:flex items-center gap-0.5 absolute -top-4 ${
        align === "right" ? "right-0" : "left-0"
      } opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity bg-white dark:bg-ping-night-card border border-ping-sand/70 dark:border-ping-night-border rounded-full shadow-md p-1 z-10`}
    >
      <div className="relative">
        <button
          onClick={() => setReactionsOpen((v) => !v)}
          aria-label="React"
          className="w-7 h-7 rounded-full flex items-center justify-center text-ping-text-light dark:text-ping-night-text-light hover:bg-ping-cream-dark dark:hover:bg-ping-night-card-active transition text-sm"
        >
          🙂
        </button>
        {reactionsOpen && (
          <div className="absolute top-9 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white dark:bg-ping-night-card border border-ping-sand/70 dark:border-ping-night-border rounded-full shadow-md p-1.5 z-20">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onReact(emoji);
                  setReactionsOpen(false);
                }}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-ping-cream-dark dark:hover:bg-ping-night-card-active transition text-base hover:scale-110"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onReply}
        aria-label="Reply"
        className="w-7 h-7 rounded-full flex items-center justify-center text-ping-text-light dark:text-ping-night-text-light hover:bg-ping-cream-dark dark:hover:bg-ping-night-card-active transition"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 016 6v2" />
        </svg>
      </button>

      <button
        onClick={onPin}
        aria-label={isPinned ? "Unpin" : "Pin"}
        className={`w-7 h-7 rounded-full flex items-center justify-center transition ${
          isPinned
            ? "text-ping-orange"
            : "text-ping-text-light dark:text-ping-night-text-light hover:bg-ping-cream-dark dark:hover:bg-ping-night-card-active"
        }`}
      >
        <svg className="w-3.5 h-3.5" fill={isPinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
        </svg>
      </button>

      <div className="relative">
        <button
          onClick={() => setMoreOpen((v) => !v)}
          aria-label="More actions"
          className="w-7 h-7 rounded-full flex items-center justify-center text-ping-text-light dark:text-ping-night-text-light hover:bg-ping-cream-dark dark:hover:bg-ping-night-card-active transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
          </svg>
        </button>
        {moreOpen && (
          <div
            className={`absolute top-9 ${align === "right" ? "right-0" : "left-0"} w-52 bg-white dark:bg-ping-night-card border border-ping-sand/70 dark:border-ping-night-border rounded-2xl shadow-lg py-1.5 z-20`}
          >
            <MenuRow icon={taskIcon} label="Create task" onClick={() => { setMoreOpen(false); onCreateTask(); }} />
            <MenuRow icon={eventIcon} label="Create event" onClick={() => { setMoreOpen(false); onCreateEvent(); }} />
            <MenuRow icon={reminderIcon} label="Create reminder" onClick={() => { setMoreOpen(false); onCreateReminder(); }} />
            <MenuRow icon={memoryIcon} label="Save to Memory" onClick={() => { setMoreOpen(false); onSaveToMemory(); }} />
          </div>
        )}
      </div>
    </div>
  );
}

function MenuRow({ icon, label, onClick, badge }: { icon: React.ReactNode; label: string; onClick: () => void; badge?: string }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-ping-dark dark:text-ping-night-text hover:bg-ping-cream-dark/70 dark:hover:bg-ping-night-card-active transition text-left"
    >
      <span className="text-ping-teal dark:text-ping-teal-light flex-shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="text-[9px] font-bold uppercase tracking-wide text-ping-orange bg-ping-orange/10 px-1.5 py-0.5 rounded-full flex-shrink-0">
          {badge}
        </span>
      )}
    </button>
  );
}

const taskIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const eventIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
);
const reminderIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
  </svg>
);
const memoryIcon = <span className="text-sm leading-none">🧠</span>;
const replyIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 016 6v2" />
  </svg>
);
const pinIconOutline = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
  </svg>
);
const trashIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
);

interface SheetProps extends ActionCallbacks {
  open: boolean;
  onClose: () => void;
  isPinned: boolean;
  isMine: boolean;
  suggested: SuggestedActions;
}

/** Mobile primary entry point (tap ⋯) — also reachable from desktop for the full list. */
export function MessageActionSheet({
  open,
  onClose,
  isPinned,
  isMine,
  suggested,
  onReply,
  onPin,
  onCreateTask,
  onCreateEvent,
  onCreateReminder,
  onSaveToMemory,
  onReact,
}: SheetProps) {
  const wrap = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Message actions" widthClass="sm:max-w-sm">
      <div className="flex items-center justify-center gap-1.5 pb-4 mb-2 border-b border-ping-sand/60 dark:border-ping-night-border">
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={wrap(() => onReact(emoji))}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-ping-cream-dark dark:hover:bg-ping-night-card-active transition text-xl active:scale-90"
          >
            {emoji}
          </button>
        ))}
      </div>

      <div className="space-y-0.5">
        <MenuRow icon={replyIcon} label="Reply" onClick={wrap(onReply)} />
        <MenuRow icon={pinIconOutline} label={isPinned ? "Unpin message" : "Pin message"} onClick={wrap(onPin)} />
        <MenuRow icon={taskIcon} label="Create task" onClick={wrap(onCreateTask)} badge={suggested.task ? "Suggested" : undefined} />
        <MenuRow icon={eventIcon} label="Create event" onClick={wrap(onCreateEvent)} badge={suggested.event ? "Suggested" : undefined} />
        <MenuRow icon={reminderIcon} label="Create reminder" onClick={wrap(onCreateReminder)} badge={suggested.reminder ? "Suggested" : undefined} />
        <MenuRow icon={memoryIcon} label="Save to Memory" onClick={wrap(onSaveToMemory)} />
        {isMine && (
          <button
            disabled
            title="Deleting messages isn't connected to the backend yet"
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-red-400/60 dark:text-red-400/40 cursor-not-allowed text-left"
          >
            <span className="flex-shrink-0">{trashIcon}</span>
            <span className="flex-1">Delete</span>
            <span className="text-[9px] font-bold uppercase tracking-wide text-ping-text-light dark:text-ping-night-text-light">
              Soon
            </span>
          </button>
        )}
      </div>
    </Sheet>
  );
}
