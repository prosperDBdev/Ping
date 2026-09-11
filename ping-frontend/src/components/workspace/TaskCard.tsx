"use client";

import { Task, User } from "@/types";
import { PRIORITY_META, STATUS_META } from "@/lib/taskMeta";
import { formatDueDate, isOverdue } from "@/lib/time";
import { colorFor, initialsFor } from "@/lib/avatar";

interface TaskCardProps {
  task: Task;
  assignee?: User | null;
  onClick: () => void;
  onToggleComplete: () => void;
}

export default function TaskCard({ task, assignee, onClick, onToggleComplete }: TaskCardProps) {
  const overdue = isOverdue(task.dueDate, task.status);
  const priority = PRIORITY_META[task.priority];
  const status = STATUS_META[task.status];
  const isDone = task.status === "COMPLETED";

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className="group w-full text-left bg-white dark:bg-ping-night-card rounded-2xl border border-ping-sand/60 dark:border-ping-night-border p-4 hover:border-ping-teal/40 dark:hover:border-ping-teal-light/40 hover:shadow-sm transition cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete();
          }}
          aria-label={isDone ? "Mark as not completed" : "Mark as completed"}
          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition ${
            isDone
              ? "bg-ping-green border-ping-green text-white"
              : "border-ping-sand dark:border-ping-night-border text-transparent hover:border-ping-teal dark:hover:border-ping-teal-light"
          }`}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p
              className={`text-sm font-bold text-ping-dark dark:text-ping-night-text leading-snug ${
                isDone ? "line-through text-ping-text-light dark:text-ping-night-text-light" : ""
              }`}
            >
              {task.isReminder && (
                <svg className="w-3.5 h-3.5 inline mr-1 -mt-0.5 text-ping-teal dark:text-ping-teal-light" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
              )}
              {task.title}
            </p>
          </div>

          {task.sourceMessageSnippet && (
            <p className="mt-1 text-[11px] text-ping-text-light dark:text-ping-night-text-light italic truncate">
              &ldquo;{task.sourceMessageSnippet}&rdquo;
            </p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {!task.isReminder && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${priority.bg} ${priority.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
                {priority.label}
              </span>
            )}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${status.bg} ${status.text}`}>
              {status.label}
            </span>
            {task.dueDate && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  overdue
                    ? "bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400"
                    : "bg-ping-cream-dark dark:bg-ping-night-card-active text-ping-text-light dark:text-ping-night-text-light"
                }`}
              >
                {overdue ? "Overdue · " : ""}
                {formatDueDate(task.dueDate)}
              </span>
            )}
          </div>
        </div>

        {assignee && (
          <div
            title={assignee.username}
            className={`w-7 h-7 rounded-full ${colorFor(assignee.username)} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}
          >
            {initialsFor(assignee.username)}
          </div>
        )}
      </div>
    </div>
  );
}
