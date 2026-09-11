"use client";

import { useEffect, useRef } from "react";

interface ChatMenuProps {
  /** Group chats get no block option — you block people, not rooms. */
  isGroup: boolean;
  isBlocked: boolean;
  otherUsername?: string;
  onViewMedia: () => void;
  onClearChat: () => void;
  onToggleBlock: () => void;
  onClose: () => void;
}

export default function ChatMenu({
  isGroup,
  isBlocked,
  otherUsername,
  onViewMedia,
  onClearChat,
  onToggleBlock,
  onClose,
}: ChatMenuProps) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickAway = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onClose();
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", onClickAway);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickAway);
      document.removeEventListener("keydown", onEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={wrapRef}
      role="menu"
      className="absolute right-0 top-10 w-56 bg-white dark:bg-ping-night-card border border-ping-sand/70 dark:border-ping-night-border rounded-2xl shadow-lg py-1.5 z-30"
    >
      <button
        role="menuitem"
        onClick={() => {
          onViewMedia();
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-ping-dark dark:text-ping-night-text hover:bg-ping-cream-dark/70 dark:hover:bg-ping-night-card-active transition text-left"
      >
        <svg className="w-4 h-4 text-ping-teal dark:text-ping-teal-light flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
        </svg>
        View shared media
      </button>

      <button
        role="menuitem"
        onClick={() => {
          onClearChat();
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-ping-dark dark:text-ping-night-text hover:bg-ping-cream-dark/70 dark:hover:bg-ping-night-card-active transition text-left"
      >
        <svg className="w-4 h-4 text-ping-teal dark:text-ping-teal-light flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.088 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951z" />
        </svg>
        Clear chat
      </button>

      {!isGroup && (
        <>
          <div className="h-px bg-ping-sand/70 dark:bg-ping-night-border my-1.5" />
          <button
            role="menuitem"
            onClick={() => {
              onToggleBlock();
              onClose();
            }}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium transition text-left hover:bg-ping-cream-dark/70 dark:hover:bg-ping-night-card-active ${
              isBlocked
                ? "text-ping-dark dark:text-ping-night-text"
                : "text-red-500"
            }`}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            {isBlocked ? `Unblock ${otherUsername ?? "user"}` : `Block ${otherUsername ?? "user"}`}
          </button>
        </>
      )}
    </div>
  );
}
