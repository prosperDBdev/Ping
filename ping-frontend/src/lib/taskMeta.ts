import { TaskPriority, TaskStatus } from "@/types";

export const PRIORITY_META: Record<
  TaskPriority,
  { label: string; dot: string; text: string; bg: string }
> = {
  LOW: {
    label: "Low",
    dot: "bg-ping-teal-light",
    text: "text-ping-teal dark:text-ping-teal-light",
    bg: "bg-ping-sage dark:bg-ping-night-sage",
  },
  MEDIUM: {
    label: "Medium",
    dot: "bg-[#f4ce62]",
    text: "text-[#8a6d1f] dark:text-[#f4ce62]",
    bg: "bg-[#fdf3d9] dark:bg-[#3a3320]",
  },
  HIGH: {
    label: "High",
    dot: "bg-ping-orange",
    text: "text-ping-orange dark:text-ping-orange-light",
    bg: "bg-ping-orange/10 dark:bg-ping-orange/15",
  },
};

export const STATUS_META: Record<
  TaskStatus,
  { label: string; text: string; bg: string; dot: string }
> = {
  TODO: {
    label: "To do",
    text: "text-ping-text-light dark:text-ping-night-text-light",
    bg: "bg-ping-cream-dark dark:bg-ping-night-card",
    dot: "bg-ping-text-light dark:bg-ping-night-text-light",
  },
  IN_PROGRESS: {
    label: "In progress",
    text: "text-ping-teal dark:text-ping-teal-light",
    bg: "bg-ping-sage dark:bg-ping-night-sage",
    dot: "bg-ping-teal dark:bg-ping-teal-light",
  },
  COMPLETED: {
    label: "Completed",
    text: "text-ping-green",
    bg: "bg-ping-green/10 dark:bg-ping-green/15",
    dot: "bg-ping-green",
  },
};

export const TASK_STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "COMPLETED"];
export const TASK_PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH"];
