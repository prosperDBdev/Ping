"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import Sheet from "@/components/common/Sheet";
import useWorkspaceStore from "@/store/workspaceStore";
import useAuthStore from "@/store/authStore";
import { CalendarEvent, User } from "@/types";
import { initialsFor, colorFor } from "@/lib/avatar";

interface EventComposerProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  participants: User[];
  sourceMessage?: { id: string; snippet: string } | null;
  onSaved?: (event: CalendarEvent) => void;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function EventComposer({
  open,
  onClose,
  conversationId,
  participants,
  sourceMessage,
  onSaved,
}: EventComposerProps) {
  const { user } = useAuthStore();
  const { createEvent } = useWorkspaceStore();

  // Conditionally mounted by its callers, so a fresh mount is the reset signal.
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>(participants.map((p) => p.id));

  const toggleParticipant = (id: string) => {
    setParticipantIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const handleSubmit = () => {
    if (!title.trim() || !date || !user) return;
    const created = createEvent({
      conversationId,
      title: title.trim(),
      description: description.trim(),
      date,
      time: time || null,
      participantIds,
      sourceMessageId: sourceMessage?.id ?? null,
      sourceMessageSnippet: sourceMessage?.snippet ?? null,
      createdBy: user.id,
    });
    toast.success("Event created");
    onSaved?.(created);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow={sourceMessage ? "Created from a message" : "Workspace"}
      title="Create an event"
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
            disabled={!title.trim() || !date}
            className="flex-1 py-2.5 rounded-xl bg-ping-dark dark:bg-ping-orange text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Create event
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
            Event title
          </label>
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Project sync"
            className="w-full px-3.5 py-2.5 bg-white dark:bg-ping-night-card border border-ping-sand dark:border-ping-night-border rounded-xl text-sm text-ping-dark dark:text-ping-night-text placeholder-ping-text-light/60 focus:outline-none focus:ring-2 focus:ring-ping-teal/30 focus:border-ping-teal transition"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-ping-dark dark:text-ping-night-text mb-1.5">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-ping-night-card border border-ping-sand dark:border-ping-night-border rounded-xl text-sm text-ping-dark dark:text-ping-night-text focus:outline-none focus:ring-2 focus:ring-ping-teal/30 focus:border-ping-teal transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ping-dark dark:text-ping-night-text mb-1.5">
              Time (optional)
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-ping-night-card border border-ping-sand dark:border-ping-night-border rounded-xl text-sm text-ping-dark dark:text-ping-night-text focus:outline-none focus:ring-2 focus:ring-ping-teal/30 focus:border-ping-teal transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-ping-dark dark:text-ping-night-text mb-1.5">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Agenda, location, or anything worth noting..."
            rows={3}
            className="w-full px-3.5 py-2.5 bg-white dark:bg-ping-night-card border border-ping-sand dark:border-ping-night-border rounded-xl text-sm text-ping-dark dark:text-ping-night-text placeholder-ping-text-light/60 focus:outline-none focus:ring-2 focus:ring-ping-teal/30 focus:border-ping-teal transition resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-ping-dark dark:text-ping-night-text mb-1.5">
            Participants
          </label>
          <div className="space-y-1.5">
            {participants.map((p) => {
              const checked = participantIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleParticipant(p.id)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition text-left ${
                    checked
                      ? "bg-ping-sage dark:bg-ping-night-sage border-ping-sage-border dark:border-ping-night-border"
                      : "border-transparent hover:bg-ping-cream-dark/60 dark:hover:bg-ping-night-card"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full ${colorFor(p.username)} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>
                    {initialsFor(p.username)}
                  </div>
                  <span className="flex-1 text-sm font-medium text-ping-dark dark:text-ping-night-text">
                    {p.username}
                  </span>
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition ${
                      checked
                        ? "bg-ping-teal dark:bg-ping-teal-light border-ping-teal dark:border-ping-teal-light text-white"
                        : "border-ping-sand dark:border-ping-night-border text-transparent"
                    }`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
