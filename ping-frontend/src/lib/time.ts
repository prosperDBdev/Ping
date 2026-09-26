export function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return "Expired";
  const totalMinutes = Math.floor(msRemaining / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return "<1m";
}

/**
 * A task's due moment in this phone's own time: "Today, 17:00",
 * "Tomorrow, 09:00", "Friday, 14:30", "3 Oct, 09:00".
 */
export function formatDueDate(dueAt: string | null): string {
  if (!dueAt) return "No due date";
  const date = new Date(dueAt);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((day.getTime() - today.getTime()) / 86400000);
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  let label: string;
  if (diffDays === 0) label = "Today";
  else if (diffDays === 1) label = "Tomorrow";
  else if (diffDays === -1) label = "Yesterday";
  else if (diffDays > 1 && diffDays < 7) label = date.toLocaleDateString([], { weekday: "long" });
  else
    label = date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
    });
  return `${label}, ${time}`;
}

/** Past its due moment and not done. */
export function isOverdue(dueAt: string | null, status: string): boolean {
  if (!dueAt || status === "COMPLETED") return false;
  return new Date(dueAt).getTime() < Date.now();
}

export function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";

  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * "just now" / "12m ago" / "5h ago" — the granularity a 24-hour status needs.
 *
 * Nothing here goes past hours on purpose: a status can't be older than its
 * expiry window, so a "days ago" branch would be dead code that only ever
 * fired on a clock-skew bug.
 */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}
