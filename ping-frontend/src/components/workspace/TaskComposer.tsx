"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";
import Sheet from "@/components/common/Sheet";
import useWorkspaceStore from "@/store/workspaceStore";
import useAuthStore from "@/store/authStore";
import { Task, TaskAttachment, TaskPriority, TaskStatus, User } from "@/types";
import { PRIORITY_META, STATUS_META, TASK_PRIORITIES, TASK_STATUSES } from "@/lib/taskMeta";
import { initialsFor, colorFor } from "@/lib/avatar";
import { formatFileSize } from "@/lib/time";

interface TaskComposerProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  participants: User[];
  task?: Task | null;
  sourceMessage?: { id: string; snippet: string } | null;
  onSaved?: (task: Task) => void;
}

const genId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export default function TaskComposer({
  open,
  onClose,
  conversationId,
  participants,
  task,
  sourceMessage,
  onSaved,
}: TaskComposerProps) {
  const { user } = useAuthStore();
  const { createTask, updateTask } = useWorkspaceStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // This component is conditionally mounted by its callers (only rendered
  // while the composer should be open), so a fresh mount is exactly the
  // signal to seed form state from `task` — no reset-on-open effect needed.
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [assigneeId, setAssigneeId] = useState<string | null>(task?.assigneeId ?? user?.id ?? null);
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "MEDIUM");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "TODO");
  const [attachments, setAttachments] = useState<TaskAttachment[]>(task?.attachments ?? []);

  const handleFiles = (files: FileList | null) => {
    if (!files || !files.length) return;
    const next: TaskAttachment[] = Array.from(files).map((f) => ({
      id: genId(),
      name: f.name,
      size: f.size,
      type: f.type || "application/octet-stream",
    }));
    setAttachments((prev) => [...prev, ...next]);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = () => {
    if (!title.trim() || !user) return;

    if (task) {
      const patch = {
        title: title.trim(),
        description: description.trim(),
        assigneeId,
        dueDate: dueDate || null,
        priority,
        status,
        attachments,
      };
      updateTask(conversationId, task.id, patch);
      toast.success("Task updated");
      onSaved?.({ ...task, ...patch });
    } else {
      const created = createTask({
        conversationId,
        title: title.trim(),
        description: description.trim(),
        assigneeId,
        dueDate: dueDate || null,
        priority,
        status,
        attachments,
        sourceMessageId: sourceMessage?.id ?? null,
        sourceMessageSnippet: sourceMessage?.snippet ?? null,
        createdBy: user.id,
      });
      toast.success("Task created");
      onSaved?.(created);
    }
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow={sourceMessage ? "Created from a message" : "Workspace"}
      title={task ? "Edit task" : "Create a task"}
      footer={
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-ping-sand dark:border-ping-night-border text-ping-dark dark:text-ping-night-text text-sm font-semibold hover:bg-ping-cream dark:hover:bg-ping-night-card transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="flex-1 py-2.5 rounded-xl bg-ping-dark dark:bg-ping-orange text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {task ? "Save changes" : "Create task"}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {sourceMessage && (
          <div className="rounded-xl bg-ping-sage dark:bg-ping-night-sage border border-ping-sage-border dark:border-ping-night-border px-3.5 py-2.5 text-xs text-ping-dark/80 dark:text-ping-night-text/80">
            <p className="font-bold text-ping-teal dark:text-ping-teal-light mb-0.5 text-[10px] uppercase tracking-wide">
              From the conversation
            </p>
            <p className="italic">&ldquo;{sourceMessage.snippet}&rdquo;</p>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-ping-dark dark:text-ping-night-text mb-1.5">
            Task title
          </label>
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Fix the authentication bug"
            className="w-full px-3.5 py-2.5 bg-white dark:bg-ping-night-card border border-ping-sand dark:border-ping-night-border rounded-xl text-sm text-ping-dark dark:text-ping-night-text placeholder-ping-text-light/60 focus:outline-none focus:ring-2 focus:ring-ping-teal/30 focus:border-ping-teal transition"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-ping-dark dark:text-ping-night-text mb-1.5">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add any detail worth capturing..."
            rows={3}
            className="w-full px-3.5 py-2.5 bg-white dark:bg-ping-night-card border border-ping-sand dark:border-ping-night-border rounded-xl text-sm text-ping-dark dark:text-ping-night-text placeholder-ping-text-light/60 focus:outline-none focus:ring-2 focus:ring-ping-teal/30 focus:border-ping-teal transition resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-ping-dark dark:text-ping-night-text mb-1.5">
              Due date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-ping-night-card border border-ping-sand dark:border-ping-night-border rounded-xl text-sm text-ping-dark dark:text-ping-night-text focus:outline-none focus:ring-2 focus:ring-ping-teal/30 focus:border-ping-teal transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ping-dark dark:text-ping-night-text mb-1.5">
              Assigned to
            </label>
            <select
              value={assigneeId ?? ""}
              onChange={(e) => setAssigneeId(e.target.value || null)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-ping-night-card border border-ping-sand dark:border-ping-night-border rounded-xl text-sm text-ping-dark dark:text-ping-night-text focus:outline-none focus:ring-2 focus:ring-ping-teal/30 focus:border-ping-teal transition"
            >
              <option value="">Unassigned</option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.username}
                  {p.id === user?.id ? " (you)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {assigneeId && (
          <div className="flex items-center gap-2 -mt-2">
            {participants
              .filter((p) => p.id === assigneeId)
              .map((p) => (
                <div key={p.id} className="flex items-center gap-1.5 text-xs text-ping-text-light dark:text-ping-night-text-light">
                  <div className={`w-5 h-5 rounded-full ${colorFor(p.username)} flex items-center justify-center text-white text-[9px] font-bold`}>
                    {initialsFor(p.username)}
                  </div>
                  Assigned to {p.username}
                </div>
              ))}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-ping-dark dark:text-ping-night-text mb-1.5">
            Priority
          </label>
          <div className="flex gap-2">
            {TASK_PRIORITIES.map((p) => {
              const meta = PRIORITY_META[p];
              const active = priority === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition ${
                    active
                      ? `${meta.bg} ${meta.text} border-transparent`
                      : "border-ping-sand dark:border-ping-night-border text-ping-text-light dark:text-ping-night-text-light hover:bg-ping-cream-dark/60 dark:hover:bg-ping-night-card"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-ping-dark dark:text-ping-night-text mb-1.5">
            Status
          </label>
          <div className="flex gap-2">
            {TASK_STATUSES.map((s) => {
              const meta = STATUS_META[s];
              const active = status === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                    active
                      ? `${meta.bg} ${meta.text} border-transparent`
                      : "border-ping-sand dark:border-ping-night-border text-ping-text-light dark:text-ping-night-text-light hover:bg-ping-cream-dark/60 dark:hover:bg-ping-night-card"
                  }`}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-ping-dark dark:text-ping-night-text mb-1.5">
            Attachments (optional)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-ping-sand dark:border-ping-night-border text-xs font-semibold text-ping-text-light dark:text-ping-night-text-light hover:bg-ping-cream-dark/60 dark:hover:bg-ping-night-card transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32" />
            </svg>
            Attach a file
          </button>

          {attachments.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {attachments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-ping-cream-dark/60 dark:bg-ping-night-card text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ping-dark dark:text-ping-night-text">{a.name}</p>
                    <p className="text-ping-text-light dark:text-ping-night-text-light">{formatFileSize(a.size)}</p>
                  </div>
                  <button
                    onClick={() => removeAttachment(a.id)}
                    aria-label={`Remove ${a.name}`}
                    className="text-ping-text-light dark:text-ping-night-text-light hover:text-red-500 transition flex-shrink-0"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}
