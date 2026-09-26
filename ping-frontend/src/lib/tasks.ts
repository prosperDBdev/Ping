import { Task } from "@/types";

/**
 * What the server takes for a task: every editable field, every time (an edit
 * sends the whole task, so "no due time" is always an explicit null).
 */
export interface TaskRequest {
  title: string;
  description: string;
  assigneeId: string | null;
  dueAt: string | null;
  priority: Task["priority"];
  status: Task["status"];
  isReminder: boolean;
  sourceMessageId: string | null;
  sourceMessageSnippet: string | null;
  attachments: Task["attachments"];
}

export function toTaskRequest(task: Task): TaskRequest {
  return {
    title: task.title,
    description: task.description,
    assigneeId: task.assigneeId,
    dueAt: task.dueAt,
    priority: task.priority,
    status: task.status,
    isReminder: task.isReminder,
    sourceMessageId: task.sourceMessageId,
    sourceMessageSnippet: task.sourceMessageSnippet,
    attachments: task.attachments,
  };
}

/** Server ids are MongoDB ObjectIds; anything else is a task from before tasks were shared. */
export function isLegacyTaskId(id: string): boolean {
  return !/^[0-9a-f]{24}$/.test(id);
}

/** Tasks made before this change stored a date only ("2026-09-26"). */
export type LegacyTask = Task & { dueDate?: string | null };

/**
 * The same task for the server. It stays private (a personal reminder),
 * because until now nobody else could see it. Uploading it must not suddenly
 * show it to the rest of the chat. A date with no time is due at 09:00 local.
 */
export function legacyToRequest(task: LegacyTask): TaskRequest {
  const due = task.dueAt ?? (task.dueDate ? new Date(`${task.dueDate}T09:00`).toISOString() : null);
  return { ...toTaskRequest({ ...task, dueAt: due }), isReminder: true, assigneeId: null };
}

/** A local date ("2026-09-26") and time ("17:00") as the exact moment, for the server. */
export function localDueToIso(date: string, time: string): string | null {
  if (!date) return null;
  return new Date(`${date}T${time || "09:00"}`).toISOString();
}

/** The other way, for filling in the edit form in this phone's time zone. */
export function isoToLocalDue(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}
