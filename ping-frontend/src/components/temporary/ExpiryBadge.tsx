"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/time";

interface ExpiryBadgeProps {
  expiresAt: string;
  size?: "sm" | "md";
}

export default function ExpiryBadge({ expiresAt, size = "md" }: ExpiryBadgeProps) {
  const [remaining, setRemaining] = useState(() => new Date(expiresAt).getTime() - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(new Date(expiresAt).getTime() - Date.now());
    }, 30000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const expired = remaining <= 0;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold whitespace-nowrap ${
        size === "sm" ? "text-[9px] px-2 py-0.5" : "text-[10px] px-2.5 py-1"
      } ${
        expired
          ? "bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400"
          : "bg-[#fdf3d9] text-[#8a6d1f] dark:bg-[#3a3320] dark:text-[#f4ce62]"
      }`}
      title={`Expires ${new Date(expiresAt).toLocaleString()}`}
    >
      <svg className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {expired ? "Expired" : `Expires in ${formatCountdown(remaining)}`}
    </span>
  );
}
