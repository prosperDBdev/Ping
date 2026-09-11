"use client";

import { CalendarEvent, User } from "@/types";
import { formatEventDate } from "@/lib/time";
import { colorFor, initialsFor } from "@/lib/avatar";

interface EventCardProps {
  event: CalendarEvent;
  participants: User[];
  onClick: () => void;
  isPast?: boolean;
}

function formatTime12h(time: string) {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

export default function EventCard({ event, participants, onClick, isPast }: EventCardProps) {
  const attendees = participants.filter((p) => event.participantIds.includes(p.id));
  const date = new Date(event.date + "T00:00:00");

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-stretch gap-4 bg-white dark:bg-ping-night-card rounded-2xl border border-ping-sand/60 dark:border-ping-night-border p-4 hover:border-ping-teal/40 dark:hover:border-ping-teal-light/40 hover:shadow-sm transition ${
        isPast ? "opacity-60" : ""
      }`}
    >
      <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-ping-cream-dark dark:bg-ping-night-card-active flex-shrink-0">
        <span className="text-[9px] font-bold uppercase text-ping-orange">
          {date.toLocaleDateString([], { month: "short" })}
        </span>
        <span className="text-lg font-black text-ping-dark dark:text-ping-night-text leading-none mt-0.5">
          {date.getDate()}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-ping-dark dark:text-ping-night-text truncate">{event.title}</p>
        <p className="text-xs text-ping-text-light dark:text-ping-night-text-light mt-0.5">
          {formatEventDate(event.date)}
          {event.time && ` · ${formatTime12h(event.time)}`}
        </p>
        {event.description && (
          <p className="text-xs text-ping-text-light dark:text-ping-night-text-light truncate mt-1">
            {event.description}
          </p>
        )}
      </div>

      {attendees.length > 0 && (
        <div className="flex items-center -space-x-2 flex-shrink-0 self-center">
          {attendees.slice(0, 3).map((p) => (
            <div
              key={p.id}
              title={p.username}
              className={`w-6 h-6 rounded-full ${colorFor(p.username)} border-2 border-white dark:border-ping-night-card flex items-center justify-center text-white text-[9px] font-bold`}
            >
              {initialsFor(p.username)}
            </div>
          ))}
          {attendees.length > 3 && (
            <div className="w-6 h-6 rounded-full bg-ping-cream-dark dark:bg-ping-night-card-active border-2 border-white dark:border-ping-night-card flex items-center justify-center text-ping-text-light dark:text-ping-night-text-light text-[9px] font-bold">
              +{attendees.length - 3}
            </div>
          )}
        </div>
      )}
    </button>
  );
}
