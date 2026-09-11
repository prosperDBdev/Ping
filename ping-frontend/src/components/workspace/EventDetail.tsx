"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import Sheet from "@/components/common/Sheet";
import useWorkspaceStore from "@/store/workspaceStore";
import { CalendarEvent, User } from "@/types";
import { formatEventDate } from "@/lib/time";
import { colorFor, initialsFor } from "@/lib/avatar";

interface EventDetailProps {
  event: CalendarEvent | null;
  onClose: () => void;
  conversationId: string;
  participants: User[];
  onJumpToMessage?: (messageId: string) => void;
}

function formatTime12h(time: string) {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

export default function EventDetail({
  event,
  onClose,
  conversationId,
  participants,
  onJumpToMessage,
}: EventDetailProps) {
  const { deleteEvent } = useWorkspaceStore();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (!event) return null;

  const attendees = participants.filter((p) => event.participantIds.includes(p.id));

  const handleDelete = () => {
    deleteEvent(conversationId, event.id);
    toast.success("Event removed");
    setConfirmingDelete(false);
    onClose();
  };

  return (
    <Sheet
      open={!!event}
      onClose={onClose}
      eyebrow="Event"
      title={event.title}
      footer={
        confirmingDelete ? (
          <div className="flex gap-2">
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
              Remove event
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="w-full py-2.5 rounded-xl border border-ping-sand dark:border-ping-night-border text-red-500 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition"
          >
            Remove event
          </button>
        )
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-ping-sage dark:bg-ping-night-sage text-ping-teal dark:text-ping-teal-light">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            {formatEventDate(event.date)}
            {event.time && ` · ${formatTime12h(event.time)}`}
          </span>
        </div>

        {event.description && (
          <p className="text-sm text-ping-dark/80 dark:text-ping-night-text/80 leading-relaxed whitespace-pre-wrap">
            {event.description}
          </p>
        )}

        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ping-text-light dark:text-ping-night-text-light mb-2">
            Participants · {attendees.length}
          </p>
          <div className="space-y-2">
            {attendees.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full ${colorFor(p.username)} flex items-center justify-center text-white text-xs font-bold`}>
                  {initialsFor(p.username)}
                </div>
                <p className="text-sm font-medium text-ping-dark dark:text-ping-night-text">{p.username}</p>
              </div>
            ))}
          </div>
        </div>

        {event.sourceMessageSnippet && (
          <button
            onClick={() => event.sourceMessageId && onJumpToMessage?.(event.sourceMessageId)}
            className="w-full text-left rounded-xl bg-ping-sage dark:bg-ping-night-sage border border-ping-sage-border dark:border-ping-night-border px-3.5 py-3 text-xs text-ping-dark/80 dark:text-ping-night-text/80 hover:bg-ping-sage-border/40 dark:hover:bg-ping-night-sage/60 transition"
          >
            <p className="font-bold text-ping-teal dark:text-ping-teal-light mb-0.5 text-[10px] uppercase tracking-wide">
              Created from a message
            </p>
            <p className="italic">&ldquo;{event.sourceMessageSnippet}&rdquo;</p>
          </button>
        )}
      </div>
    </Sheet>
  );
}
