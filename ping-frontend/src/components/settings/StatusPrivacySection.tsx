"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { User } from "@/types";
import api from "@/lib/api";
import { colorFor, initialsFor } from "@/lib/avatar";
import { fetchStatusPrivacy, updateStatusPrivacy } from "@/lib/status";

/**
 * Who can see your statuses, and whether they can pass them on.
 *
 * Kept separate from the blocked-users list on purpose, because the two are
 * different things and conflating them in the UI would teach people the wrong
 * model: blocking is mutual and total, hiding a status is one-directional and
 * only touches statuses. Someone who wants to keep their photos from a
 * colleague shouldn't feel they have to block them to do it.
 */
export default function StatusPrivacySection() {
  const [hiddenFrom, setHiddenFrom] = useState<string[]>([]);
  const [allowResharing, setAllowResharing] = useState(true);
  const [people, setPeople] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  // Nothing here touches state before the first await. isLoading already
  // starts true, so the mount path needs no extra render to get there; the
  // retry button sets it itself, since by then it's back to false.
  const load = useCallback(async () => {
    try {
      const privacy = await fetchStatusPrivacy();
      setFailed(false);
      setHiddenFrom(privacy.hiddenStatusFrom);
      setAllowResharing(privacy.allowResharing);

      // Anyone already on the hidden list needs a name to show. They're
      // resolved by id rather than kept in the settings payload so the server
      // stays the only owner of user records.
      if (privacy.hiddenStatusFrom.length > 0) {
        const resolved = await Promise.all(
          privacy.hiddenStatusFrom.map((id) =>
            api.get(`/users/${id}`).then((r) => r.data as User).catch(() => null)
          )
        );
        setPeople(resolved.filter((u): u is User => u !== null));
      } else {
        setPeople([]);
      }
    } catch {
      setFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = async (next: { hiddenStatusFrom?: string[]; allowResharing?: boolean }) => {
    setSaving(true);
    try {
      const saved = await updateStatusPrivacy(next);
      setHiddenFrom(saved.hiddenStatusFrom);
      setAllowResharing(saved.allowResharing);
    } catch {
      toast.error("Couldn't save that — try again.");
      // Reload rather than keep optimistic state: a privacy toggle that
      // *looks* off but isn't is the worst possible failure mode here.
      void load();
    } finally {
      setSaving(false);
    }
  };

  const addHidden = async (user: User) => {
    if (hiddenFrom.includes(user.id)) return;
    setPeople((prev) => [...prev, user]);
    setSearch("");
    await persist({ hiddenStatusFrom: [...hiddenFrom, user.id] });
    toast.success(`${user.username} won't see your statuses`);
  };

  const removeHidden = async (user: User) => {
    setPeople((prev) => prev.filter((u) => u.id !== user.id));
    await persist({ hiddenStatusFrom: hiddenFrom.filter((id) => id !== user.id) });
  };

  const [results, setResults] = useState<User[]>([]);
  useEffect(() => {
    const query = search.trim();
    let cancelled = false;

    // Everything — including clearing the list for an empty box — happens
    // inside the debounce callback rather than in the effect body. Typing a
    // character shouldn't cost a render before the search has even run.
    const timer = setTimeout(() => {
      if (!query) {
        setResults([]);
        return;
      }
      api
        .get(`/users/search?query=${encodeURIComponent(query)}`)
        .then((r) => {
          if (!cancelled) setResults(r.data as User[]);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

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

  return (
    <div className="space-y-6">
      {/* Resharing */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ping-dark dark:text-ping-night-text">
            Allow resharing
          </p>
          <p className="text-xs text-ping-text-light dark:text-ping-night-text-light mt-0.5">
            Lets people post your status to their own feed, where people you
            haven&apos;t chosen can see it.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={allowResharing}
          disabled={saving}
          onClick={() => void persist({ allowResharing: !allowResharing })}
          className={`relative w-11 h-6 rounded-full transition flex-shrink-0 disabled:opacity-50 ${
            allowResharing ? "bg-ping-teal" : "bg-ping-sand dark:bg-ping-night-border"
          }`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${
              allowResharing ? "left-[1.375rem]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      {/* Hidden from */}
      <div>
        <p className="text-sm font-semibold text-ping-dark dark:text-ping-night-text">
          Hide my status from
        </p>
        <p className="text-xs text-ping-text-light dark:text-ping-night-text-light mt-0.5 mb-3">
          They can still message you normally — they just won&apos;t see your
          updates.
        </p>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search for someone…"
          className="w-full px-3.5 py-2.5 bg-ping-cream-dark dark:bg-ping-night-bg border border-ping-sand/60 dark:border-ping-night-border rounded-xl text-sm text-ping-dark dark:text-ping-night-text placeholder-ping-text-light/60 focus:outline-none focus:ring-2 focus:ring-ping-teal/30"
        />

        {results.length > 0 && (
          <ul className="mt-2 border border-ping-sand/60 dark:border-ping-night-border rounded-xl overflow-hidden">
            {results
              .filter((u) => !hiddenFrom.includes(u.id))
              .map((u) => (
                <li key={u.id}>
                  <button
                    onClick={() => void addHidden(u)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-ping-cream-dark/50 dark:hover:bg-ping-night-bg transition"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${colorFor(u.username)}`}
                    >
                      {initialsFor(u.username)}
                    </div>
                    <span className="text-sm text-ping-dark dark:text-ping-night-text">
                      {u.username}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        )}

        {people.length === 0 ? (
          <p className="text-xs text-ping-text-light dark:text-ping-night-text-light mt-3">
            Your statuses are visible to everyone you chat with.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {people.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-3 px-3 py-2 bg-ping-cream-dark/50 dark:bg-ping-night-bg rounded-xl"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${colorFor(u.username)}`}
                >
                  {initialsFor(u.username)}
                </div>
                <span className="text-sm flex-1 min-w-0 truncate text-ping-dark dark:text-ping-night-text">
                  {u.username}
                </span>
                <button
                  onClick={() => void removeHidden(u)}
                  disabled={saving}
                  className="text-[11px] font-semibold text-ping-teal hover:underline disabled:opacity-50"
                >
                  Unhide
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
