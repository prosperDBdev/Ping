"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { User } from "@/types";
import useAuthStore from "@/store/authStore";
import useChatStore from "@/store/chatStore";
import { colorFor, initialsFor } from "@/lib/avatar";
import { fetchStatusPrivacy, updateStatusPrivacy } from "@/lib/status";

interface Person {
  id: string;
  username: string;
}

/**
 * Who can see your statuses, and whether they can pass them on.
 *
 * THE LIST IS YOUR CONTACTS, not a search over every account. An earlier
 * version let you search all users, which offered a choice that does nothing:
 * statuses are already only shown to people you share a conversation with, so
 * hiding them from a stranger changes nothing, and the search results buried
 * the people it would actually matter for. The contacts here are exactly the
 * audience the server's visibility rule would otherwise show your status to.
 *
 * Kept separate from blocking on purpose. Blocking is mutual and total; hiding
 * a status is one-directional and only touches statuses. Someone who wants to
 * keep their photos from a colleague shouldn't feel they have to block them.
 */
export default function StatusPrivacySection() {
  const { user } = useAuthStore();
  const conversations = useChatStore((s) => s.conversations);
  const fetchConversations = useChatStore((s) => s.fetchConversations);

  const [hiddenFrom, setHiddenFrom] = useState<string[]>([]);
  const [allowResharing, setAllowResharing] = useState(true);
  // Names for hidden people who are no longer contacts — e.g. you hid your
  // status from someone, then that conversation was deleted. They'd otherwise
  // be hidden with no way to see or undo it.
  const [hiddenNames, setHiddenNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  // Nothing here touches component state before the first await, so calling
  // it from the mount effect costs no extra render. isLoading already starts
  // true; the retry button sets it itself.
  const load = useCallback(async () => {
    try {
      const privacy = await fetchStatusPrivacy();
      setFailed(false);
      setHiddenFrom(privacy.hiddenStatusFrom);
      setAllowResharing(privacy.allowResharing);

      const resolved = await Promise.all(
        privacy.hiddenStatusFrom.map((id) =>
          api
            .get(`/users/${id}`)
            .then((r) => [id, (r.data as User).username] as const)
            .catch(() => [id, "Someone"] as const)
        )
      );
      setHiddenNames(Object.fromEntries(resolved));
    } catch {
      setFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // The contact list comes from conversations. On a page that didn't load them
  // (this section also appears on the status page), fetch once.
  useEffect(() => {
    if (conversations.length === 0) void fetchConversations();
  }, [conversations.length, fetchConversations]);

  const people: Person[] = useMemo(() => {
    const byId = new Map<string, Person>();
    for (const conversation of conversations) {
      for (const p of conversation.participants) {
        if (p.id !== user?.id && !byId.has(p.id)) {
          byId.set(p.id, { id: p.id, username: p.username });
        }
      }
    }
    for (const id of hiddenFrom) {
      if (!byId.has(id)) byId.set(id, { id, username: hiddenNames[id] ?? "Someone" });
    }

    const q = filter.trim().toLowerCase();
    return [...byId.values()]
      .filter((p) => !q || p.username.toLowerCase().includes(q))
      // Hidden people first — they're the ones this screen is for, and the
      // likeliest reason to open it is to check or undo one.
      .sort((a, b) => {
        const ah = hiddenFrom.includes(a.id) ? 0 : 1;
        const bh = hiddenFrom.includes(b.id) ? 0 : 1;
        return ah - bh || a.username.localeCompare(b.username);
      });
  }, [conversations, hiddenFrom, hiddenNames, filter, user?.id]);

  const persist = async (next: { hiddenStatusFrom?: string[]; allowResharing?: boolean }) => {
    try {
      const saved = await updateStatusPrivacy(next);
      setHiddenFrom(saved.hiddenStatusFrom);
      setAllowResharing(saved.allowResharing);
    } catch {
      // Reload rather than trust the optimistic state: a privacy toggle that
      // LOOKS on but isn't is the worst failure this screen could have.
      void load();
    }
  };

  const toggleHidden = async (person: Person) => {
    const isHidden = hiddenFrom.includes(person.id);
    const next = isHidden
      ? hiddenFrom.filter((id) => id !== person.id)
      : [...hiddenFrom, person.id];

    setHiddenNames((names) => ({ ...names, [person.id]: person.username }));
    setHiddenFrom(next);
    setSavingId(person.id);
    await persist({ hiddenStatusFrom: next });
    setSavingId(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-ping-sand dark:border-ping-night-border border-t-ping-teal rounded-full animate-spin" />
      </div>
    );
  }

  if (failed) {
    return (
      <div className="text-center py-6">
        <p className="text-xs text-ping-text-light dark:text-ping-night-text-light mb-3">
          Couldn&apos;t load your status privacy settings.
        </p>
        <button
          onClick={() => {
            setIsLoading(true);
            void load();
          }}
          className="text-xs font-bold text-white bg-ping-orange px-4 py-2 rounded-xl"
        >
          Try again
        </button>
      </div>
    );
  }

  const hiddenCount = hiddenFrom.length;

  return (
    <div className="space-y-6">
      {/* Resharing */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ping-dark dark:text-ping-night-text">Allow resharing</p>
          <p className="text-xs text-ping-text-light dark:text-ping-night-text-light mt-0.5">
            Lets people post your status to their own, where people you haven&apos;t chosen can see it.
          </p>
        </div>
        <Switch
          checked={allowResharing}
          label="Allow resharing"
          onChange={() => void persist({ allowResharing: !allowResharing })}
        />
      </div>

      {/* Hidden from */}
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-ping-dark dark:text-ping-night-text">
            Who can see my status
          </p>
          <span className="text-[11px] font-semibold text-ping-text-light dark:text-ping-night-text-light flex-shrink-0">
            {hiddenCount === 0 ? "Everyone you chat with" : `Hidden from ${hiddenCount}`}
          </span>
        </div>
        <p className="text-xs text-ping-text-light dark:text-ping-night-text-light mt-0.5 mb-3">
          Turn someone off and your updates stop appearing for them. You can still message each other normally.
        </p>

        {people.length > 6 && (
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Find a contact…"
            className="w-full mb-3 px-3.5 py-2.5 bg-ping-cream-dark dark:bg-ping-night-bg border border-ping-sand/60 dark:border-ping-night-border rounded-xl text-sm text-ping-dark dark:text-ping-night-text placeholder-ping-text-light/60 focus:outline-none focus:ring-2 focus:ring-ping-teal/30"
          />
        )}

        {people.length === 0 ? (
          <p className="text-xs text-ping-text-light dark:text-ping-night-text-light py-4 text-center">
            {filter
              ? "No contacts match that."
              : "No contacts yet. Statuses are only shown to people you have a conversation with."}
          </p>
        ) : (
          <ul className="divide-y divide-ping-sand/50 dark:divide-ping-night-border rounded-xl border border-ping-sand/60 dark:border-ping-night-border overflow-hidden">
            {people.map((person) => {
              const canSee = !hiddenFrom.includes(person.id);
              return (
                <li key={person.id} className="flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-ping-night-card">
                  <div
                    className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${colorFor(person.username)} ${
                      canSee ? "" : "opacity-50"
                    }`}
                  >
                    {initialsFor(person.username)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ping-dark dark:text-ping-night-text truncate">{person.username}</p>
                    <p className={`text-[11px] ${canSee ? "text-ping-text-light dark:text-ping-night-text-light" : "text-ping-orange font-semibold"}`}>
                      {canSee ? "Can see your status" : "Can't see your status"}
                    </p>
                  </div>
                  <Switch
                    checked={canSee}
                    busy={savingId === person.id}
                    label={`${person.username} can see my status`}
                    onChange={() => void toggleHidden(person)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Switch({
  checked,
  onChange,
  label,
  busy = false,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  busy?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={busy}
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition flex-shrink-0 disabled:opacity-60 ${
        checked ? "bg-ping-teal" : "bg-ping-sand dark:bg-ping-night-border"
      }`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-xs transition-all ${
          checked ? "left-[1.375rem]" : "left-0.5"
        }`}
      />
    </button>
  );
}
