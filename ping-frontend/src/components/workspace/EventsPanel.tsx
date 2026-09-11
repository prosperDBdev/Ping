"use client";

import { useMemo, useState } from "react";
import { CalendarEvent, Conversation } from "@/types";
import useWorkspaceStore from "@/store/workspaceStore";
import EventCard from "@/components/workspace/EventCard";
import EventDetail from "@/components/workspace/EventDetail";
import EventComposer from "@/components/workspace/EventComposer";
import EmptyState from "@/components/workspace/EmptyState";

interface EventsPanelProps {
  conversation: Conversation;
  onJumpToMessage?: (messageId: string) => void;
}

export default function EventsPanel({ conversation, onJumpToMessage }: EventsPanelProps) {
  const { eventsByConversation } = useWorkspaceStore();
  const events = eventsByConversation[conversation.id] || [];

  const [composerOpen, setComposerOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);

  const { upcoming, past } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
    return {
      upcoming: sorted.filter((e) => new Date(e.date + "T00:00:00") >= now),
      past: sorted.filter((e) => new Date(e.date + "T00:00:00") < now).reverse(),
    };
  }, [events]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 sm:px-6 pt-4 pb-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h3 className="text-base font-black text-ping-dark dark:text-ping-night-text">Events</h3>
          <p className="text-xs text-ping-text-light dark:text-ping-night-text-light">
            {upcoming.length} upcoming
          </p>
        </div>
        <button
          onClick={() => setComposerOpen(true)}
          className="flex items-center gap-1.5 bg-ping-orange text-white text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-ping-orange-light transition shadow-xs flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New event
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 sm:px-6 pb-6">
        {events.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            }
            title="No events yet"
            description="Turn a message like 'Meeting tomorrow at 3pm' into an event, or add one manually."
            action={
              <button
                onClick={() => setComposerOpen(true)}
                className="text-xs font-bold text-ping-teal dark:text-ping-teal-light hover:underline"
              >
                Schedule your first event →
              </button>
            }
          />
        ) : (
          <div className="space-y-6 pt-1">
            {upcoming.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ping-text-light dark:text-ping-night-text-light mb-2.5">
                  Upcoming
                </p>
                <div className="space-y-2.5">
                  {upcoming.map((e) => (
                    <EventCard
                      key={e.id}
                      event={e}
                      participants={conversation.participants}
                      onClick={() => setActiveEvent(e)}
                    />
                  ))}
                </div>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ping-text-light dark:text-ping-night-text-light mb-2.5">
                  Past
                </p>
                <div className="space-y-2.5">
                  {past.map((e) => (
                    <EventCard
                      key={e.id}
                      event={e}
                      participants={conversation.participants}
                      onClick={() => setActiveEvent(e)}
                      isPast
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {composerOpen && (
        <EventComposer
          open
          onClose={() => setComposerOpen(false)}
          conversationId={conversation.id}
          participants={conversation.participants}
        />
      )}

      <EventDetail
        event={activeEvent}
        onClose={() => setActiveEvent(null)}
        conversationId={conversation.id}
        participants={conversation.participants}
        onJumpToMessage={onJumpToMessage}
      />
    </div>
  );
}
