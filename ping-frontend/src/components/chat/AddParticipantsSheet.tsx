"use client";

import { useEffect, useState } from "react";
import Sheet from "@/components/common/Sheet";
import Avatar from "@/components/common/Avatar";
import api from "@/lib/api";
import { addParticipants } from "@/lib/groups";
import { apiErrorMessage } from "@/lib/messages";
import { colorFor } from "@/lib/avatar";
import { Conversation, User } from "@/types";

/**
 * Add people to a group after it's been created.
 *
 * The server does the real work (including refusing duplicates and enforcing
 * the size cap); this searches for usernames and sends the list.
 */
export default function AddParticipantsSheet({
  open,
  onClose,
  conversation,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  conversation: Conversation;
  onAdded: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const inGroup = new Set(conversation.participants.map((p) => p.id));

  // Search as you type, skipping requests whose answer is now out of date.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let live = true;
    setSearching(true);
    const timer = setTimeout(() => {
      api
        .get("/users/search", { params: { q } })
        .then((res) => {
          if (live) setResults(res.data as User[]);
        })
        .catch(() => {
          if (live) setError("Couldn't search right now. Try again.");
        })
        .finally(() => {
          if (live) setSearching(false);
        });
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setChosen([]);
      setError("");
    }
  }, [open]);

  const toggle = (id: string) =>
    setChosen((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await addParticipants(conversation.id, chosen);
      onAdded();
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't add them. Try again."));
    } finally {
      setSaving(false);
    }
  };

  const shown = results.filter((u) => !inGroup.has(u.id));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add participants"
      eyebrow={conversation.name ?? "Group"}
      widthClass="sm:max-w-md"
      footer={
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-ping-sand dark:border-ping-night-border text-ping-dark dark:text-ping-night-text text-sm font-semibold hover:bg-ping-cream dark:hover:bg-ping-night-card transition"
          >
            Cancel
          </button>
          <button
            onClick={() => void save()}
            disabled={chosen.length === 0 || saving}
            className="flex-1 py-2.5 rounded-xl bg-ping-dark text-white text-sm font-semibold hover:bg-ping-dark/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Adding…" : chosen.length ? `Add ${chosen.length}` : "Add"}
          </button>
        </div>
      }
    >
      <div className="relative mb-4">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ping-text-light dark:text-ping-night-text-light"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username…"
          aria-label="Search by username"
          autoFocus
          className="w-full pl-10 pr-4 py-2.5 bg-ping-cream dark:bg-ping-night-surface border border-ping-sand dark:border-ping-night-border rounded-xl text-sm text-ping-dark dark:text-ping-night-text placeholder-ping-text-light/60 focus:outline-none focus:ring-2 focus:ring-ping-teal/30 transition"
        />
      </div>

      {error && <p className="mb-3 text-xs text-red-500">{error}</p>}

      {query.trim().length < 2 ? (
        <p className="text-sm text-ping-text-light dark:text-ping-night-text-light py-4 text-center">
          Type at least two letters to find someone.
        </p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-ping-text-light dark:text-ping-night-text-light py-4 text-center">
          {searching
            ? "Searching…"
            : results.length > 0
              ? "They're already in this group."
              : "Nobody with that username."}
        </p>
      ) : (
        <ul className="space-y-1 max-h-72 overflow-y-auto">
          {shown.map((u) => {
            const picked = chosen.includes(u.id);
            return (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => toggle(u.id)}
                  aria-pressed={picked}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition ${
                    picked
                      ? "bg-ping-sage dark:bg-ping-night-sage"
                      : "hover:bg-ping-cream dark:hover:bg-ping-night-card-active"
                  }`}
                >
                  <Avatar
                    username={u.username}
                    avatarUrl={u.avatarUrl}
                    className="w-9 h-9"
                    textClassName="text-[11px]"
                    fallbackClassName={colorFor(u.username)}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-ping-dark dark:text-ping-night-text truncate">
                      {u.username}
                    </span>
                    <span className="block text-xs text-ping-text-light dark:text-ping-night-text-light truncate">
                      @{u.username.toLowerCase().replace(/\s+/g, "")}
                    </span>
                  </span>
                  <span
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      picked
                        ? "bg-ping-teal border-ping-teal text-white"
                        : "border-ping-sand dark:border-ping-night-border text-transparent"
                    }`}
                    aria-hidden
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
