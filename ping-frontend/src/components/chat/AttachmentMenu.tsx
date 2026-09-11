"use client";

import { useEffect, useRef } from "react";

interface AttachmentMenuProps {
  onPickPhoto: () => void;
  onTakePhoto: () => void;
  onRecordVoice: () => void;
  onClose: () => void;
}

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  /** Tailwind classes for the icon tile — one colour per kind, like the OS pickers do. */
  tileClass: string;
  onClick?: () => void;
}

export default function AttachmentMenu({
  onPickPhoto,
  onTakePhoto,
  onRecordVoice,
  onClose,
}: AttachmentMenuProps) {
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

  const items: MenuItem[] = [
    {
      label: "Photos",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      ),
      tileClass: "bg-blue-500/15 text-blue-500",
      onClick: onPickPhoto,
    },
    {
      label: "Camera",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
        </svg>
      ),
      tileClass: "bg-pink-500/15 text-pink-500",
      onClick: onTakePhoto,
    },
    {
      label: "Voice note",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
        </svg>
      ),
      tileClass: "bg-orange-500/15 text-ping-orange",
      onClick: onRecordVoice,
    },
  ];
  // Deliberately no Document entry. Arbitrary file transfer is out of scope
  // for Ping: unlike an image, a PDF or Office file can't be decoded and
  // rewritten to strip whatever it's carrying, so shipping it safely would
  // mean running a malware scanner. That's a decision, not a gap — hence no
  // "coming soon" row promising something that isn't coming.

  return (
    <div
      ref={wrapRef}
      role="menu"
      aria-label="Attach"
      className="absolute bottom-full left-0 mb-3 w-56 bg-white dark:bg-ping-night-card border border-ping-sand/70 dark:border-ping-night-border rounded-2xl shadow-lg py-2 z-30"
    >
      {items.map((item) => (
        <button
          key={item.label}
          role="menuitem"
          onClick={() => {
            item.onClick?.();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-ping-cream-dark/70 dark:hover:bg-ping-night-card-active"
        >
          <span
            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${item.tileClass}`}
          >
            {item.icon}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ping-dark dark:text-ping-night-text">
              {item.label}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
