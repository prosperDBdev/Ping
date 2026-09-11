"use client";

import { useMemo, useState } from "react";
import { Conversation, Task, TaskStatus } from "@/types";
import useWorkspaceStore from "@/store/workspaceStore";
import TaskCard from "@/components/workspace/TaskCard";
import TaskDetail from "@/components/workspace/TaskDetail";
import TaskComposer from "@/components/workspace/TaskComposer";
import EmptyState from "@/components/workspace/EmptyState";

interface TasksPanelProps {
  conversation: Conversation;
  onJumpToMessage?: (messageId: string) => void;
}

type Filter = "ALL" | TaskStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "TODO", label: "To do" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "COMPLETED", label: "Completed" },
];

export default function TasksPanel({ conversation, onJumpToMessage }: TasksPanelProps) {
  const { tasksByConversation, updateTask } = useWorkspaceStore();
  const tasks = tasksByConversation[conversation.id] || [];

  const [filter, setFilter] = useState<Filter>("ALL");
  const [composerOpen, setComposerOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const filtered = useMemo(
    () => (filter === "ALL" ? tasks : tasks.filter((t) => t.status === filter)),
    [tasks, filter]
  );

  const openCount = tasks.filter((t) => t.status !== "COMPLETED").length;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 sm:px-6 pt-4 pb-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h3 className="text-base font-black text-ping-dark dark:text-ping-night-text">Tasks</h3>
          <p className="text-xs text-ping-text-light dark:text-ping-night-text-light">
            {openCount} open · {tasks.length} total
          </p>
        </div>
        <button
          onClick={() => setComposerOpen(true)}
          className="flex items-center gap-1.5 bg-ping-orange text-white text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-ping-orange-light transition shadow-xs flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New task
        </button>
      </div>

      {tasks.length > 0 && (
        <div className="px-4 sm:px-6 pb-3 flex items-center gap-2 overflow-x-auto scrollbar-thin flex-shrink-0">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                filter === f.key
                  ? "bg-ping-dark dark:bg-ping-orange text-white"
                  : "bg-ping-cream-dark dark:bg-ping-night-card text-ping-text-light dark:text-ping-night-text-light hover:bg-ping-sand/60 dark:hover:bg-ping-night-card-active"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 sm:px-6 pb-6">
        {tasks.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            title="No tasks yet"
            description="Turn a message into a task with the action menu, or create one from scratch."
            action={
              <button
                onClick={() => setComposerOpen(true)}
                className="text-xs font-bold text-ping-teal dark:text-ping-teal-light hover:underline"
              >
                Create your first task →
              </button>
            }
          />
        ) : filtered.length === 0 ? (
          <p className="text-center text-xs text-ping-text-light dark:text-ping-night-text-light py-10">
            Nothing in this filter.
          </p>
        ) : (
          <div className="space-y-2.5 pt-1">
            {filtered.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                assignee={conversation.participants.find((p) => p.id === task.assigneeId)}
                onClick={() => setActiveTask(task)}
                onToggleComplete={() =>
                  updateTask(conversation.id, task.id, {
                    status: task.status === "COMPLETED" ? "TODO" : "COMPLETED",
                  })
                }
              />
            ))}
          </div>
        )}
      </div>

      {composerOpen && (
        <TaskComposer
          open
          onClose={() => setComposerOpen(false)}
          conversationId={conversation.id}
          participants={conversation.participants}
        />
      )}

      <TaskDetail
        task={activeTask}
        onClose={() => setActiveTask(null)}
        conversationId={conversation.id}
        participants={conversation.participants}
        onJumpToMessage={onJumpToMessage}
      />
    </div>
  );
}
