import { MemoryCategory } from "@/types";

export const CATEGORY_META: Record<MemoryCategory, { label: string; emoji: string; bg: string; text: string }> = {
  IMPORTANT: { label: "Important", emoji: "📌", bg: "bg-ping-orange/10", text: "text-ping-orange" },
  EVENT: { label: "Event", emoji: "📅", bg: "bg-ping-sage dark:bg-ping-night-sage", text: "text-ping-teal dark:text-ping-teal-light" },
  FINANCIAL: { label: "Financial", emoji: "💰", bg: "bg-[#fdf3d9] dark:bg-[#3a3320]", text: "text-[#8a6d1f] dark:text-[#f4ce62]" },
  LOCATION: { label: "Location", emoji: "📍", bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-500" },
  PERSON: { label: "Person", emoji: "👤", bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-500" },
  NOTE: { label: "Note", emoji: "📝", bg: "bg-ping-cream-dark dark:bg-ping-night-card", text: "text-ping-text-light dark:text-ping-night-text-light" },
};

export const MEMORY_CATEGORIES: MemoryCategory[] = [
  "IMPORTANT",
  "EVENT",
  "FINANCIAL",
  "LOCATION",
  "PERSON",
  "NOTE",
];
