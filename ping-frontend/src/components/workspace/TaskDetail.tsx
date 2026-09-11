"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import Sheet from "@/components/common/Sheet";
import TaskComposer from "@/components/workspace/TaskComposer";
import useWorkspaceStore from "@/store/workspaceStore";
import { Task, User } from "@/types";
import { PRIORITY_META, STATUS_META, TASK_STATUSES } from "@/lib/taskMeta";
import { formatDueDate, formatFileSize, isOverdue } from "@/lib/time";
import { colorFor, initialsFor } from "@/lib/avatar";

interface TaskDetailProps {
  task: Task | null;
  onClose: () => void;
  conversationId: string;
  participants: User[];
  onJumpToMessage?: (messageId: string) => void;
}

export default function TaskDetail({
  task,
  onClose,
  conversationId,
  participants,
  onJumpToMessage,
}: TaskDetailProps) {
  const { updateTask, deleteTask } = useWorkspaceStore();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (!task) return null;

  const assignee = participants.find((p) => p.id === task.assigneeId);
  const priority = PRIORITY_META[task.priority];
  const overdue = isOverdue(task.dueDate, task.status);

  const handleDelete = () => {
    deleteTask(conversationId, task.id);
    toast.success("Task deleted");
    setConfirmingDelete(false);
    onClose();
  };

  return (
    <>
      <Sheet
        open={!editing}
        onClose={onClose}
        eyebrow={task.isReminder ? "Reminder" : "Task"}
        title={task.title}
        footer={
          <div className="flex gap-2">
            {confirmingDelete ? (
              <>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="flex-1 py-2.5 rounded-xl border border-ping-sand dark:border-ping-night-border text-ping-dark dark:text-ping-night-text text-sm font-semibold hover:bg-ping-cream dark:hover:bg-ping-night-card transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition"
                >
                  Delete for good
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setConfirmingDelete(true)}
                  className="py-2.5 px-4 rounded-xl border border-ping-sand dark:border-ping-night-border text-red-500 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                >
                  Delete
                </button>
                <button
                  onClick={() => setEditing(true)}
                  className="flex-1 py-2.5 rounded-xl bg-ping-dark dark:bg-ping-orange text-white text-sm font-semibold hover:opacity-90 transition"
                >
                  Edit task
                </button>
              </>
            )}
          </div>
        }
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-1.5">
            {!task.isReminder && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${priority.bg} ${priority.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
                {priority.label} priority
              </span>
            )}
            {task.dueDate && (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                  overdue
                    ? "bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400"
                    : "bg-ping-cream-dark dark:bg-ping-night-card-active text-ping-text-light dark:text-ping-night-text-light"
                }`}
              >
                {overdue ? "Overdue · " : "Due "}
                {formatDueDate(task.dueDate)}
              </span>
            )}
          </div>

          {task.description && (
            <p className="text-sm text-ping-dark/80 dark:text-ping-night-text/80 leading-relaxed whitespace-pre-wrap">
              {task.description}
            </p>
          )}

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ping-text-light dark:text-ping-night-text-light mb-2">
              Status
            </p>
            <div className="flex gap-2">
              {TASK_STATUSES.map((s) => {
                const meta = STATUS_META[s];
                const active = task.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => updateTask(conversationId, task.id, { status: s })}
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
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ping-text-light dark:text-ping-night-text-light mb-2">
              Assigned to
            </p>
            {assignee ? (
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full ${colorFor(assignee.username)} flex items-center justify-center text-white text-xs font-bold`}>
                  {initialsFor(assignee.username)}
                </div>
                <p className="text-sm font-semibold text-ping-dark dark:text-ping-night-text">{assignee.username}</p>
              </div>
            ) : (
              <p className="text-sm text-ping-text-light dark:text-ping-night-text-light">Unassigned</p>
            )}
          </div>

          {task.attachments.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ping-text-light dark:text-ping-night-text-light mb-2">
                Attachments
              </p>
              <div className="space-y-1.5">
                {task.attachments.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-ping-cream-dark/60 dark:bg-ping-night-card text-xs">
                    <svg className="w-4 h-4 text-ping-text-light dark:text-ping-night-text-light flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ping-dark dark:text-ping-night-text">{a.name}</p>
                      <p className="text-ping-text-light dark:text-ping-night-text-light">{formatFileSize(a.size)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {task.sourceMessageSnippet && (
            <button
              onClick={() => task.sourceMessageId && onJumpToMessage?.(task.sourceMessageId)}
              className="w-full text-left rounded-xl bg-ping-sage dark:bg-ping-night-sage border border-ping-sage-border dark:border-ping-night-border px-3.5 py-3 text-xs text-ping-dark/80 dark:text-ping-night-text/80 hover:bg-ping-sage-border/40 dark:hover:bg-ping-night-sage/60 transition"
            >
              <p className="font-bold text-ping-teal dark:text-ping-teal-light mb-0.5 text-[10px] uppercase tracking-wide flex items-center gap-1">
                Created from a message
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
                </svg>
              </p>
              <p className="italic">&ldquo;{task.sourceMessageSnippet}&rdquo;</p>
            </button>
          )}
        </div>
      </Sheet>

      {editing && (
        <TaskComposer
          open
          onClose={() => setEditing(false)}
          conversationId={conversationId}
          participants={participants}
          task={task}
        />
      )}
    </>
  );
}
