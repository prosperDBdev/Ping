"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { User } from "@/types";
import { colorFor, initialsFor } from "@/lib/avatar";
import { fetchBlockedUsers, unblockUser } from "@/lib/moderation";
import ConfirmDialog from "@/components/common/ConfirmDialog";

/**
 * The list of people this user has blocked, with a way to undo it.
 *
 * Worth having its own place in settings rather than only living in the chat
 * menu: once you've blocked someone, you may well have no conversation open
 * with them to go back to, which would leave the block with no visible way to
 * reverse it.
 */
export default function BlockedUsersSection() {
  const [blocked, setBlocked] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [unblocking, setUnblocking] = useState<User | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const load = useCallback(() => {
    setIsLoading(true);
    setFailed(false);
    fetchBlockedUsers()
      .then(setBlocked)
      .catch(() => setFailed(true))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUnblock = async () => {
    if (!unblocking) return;
    setIsWorking(true);
    try {
      await unblockUser(unblocking.id);
      toast.success(`${unblocking.username} unblocked`);
      setBlocked((prev) => prev.filter((u) => u.id !== unblocking.id));
      setUnblocking(null);
    } catch {
      toast.error("Couldn't unblock them — try again.");
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="bg-white dark:bg-ping-night-card rounded-3xl border border-ping-sand/60 dark:border-ping-night-border p-5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ping-text-light dark:text-ping-night-text-light">
          Blocked
        </p>
        {!isLoading && !failed && blocked.length > 0 && (
          <span className="text-xs font-bold text-ping-text-light dark:text-ping-night-text-light">
            {blocked.length}
          </span>
        )}
      </div>
      <p className="text-xs text-ping-text-light dark:text-ping-night-text-light mb-4 leading-relaxed">
        Neither of you can message the other, and they won&apos;t show up in your search results.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 border-2 border-ping-sand dark:border-ping-night-border border-t-ping-teal rounded-full animate-spin" />
        </div>
      ) : failed ? (
        <div className="text-center py-4">
          <p className="text-xs text-ping-text-light dark:text-ping-night-text-light mb-2">
            Couldn&apos;t load your blocked list.
          </p>
          <button
            onClick={load}
            className="text-xs font-bold text-ping-teal dark:text-ping-teal-light hover:underline"
          >
            Try again
          </button>
        </div>
      ) : blocked.length === 0 ? (
        <p className="text-xs text-ping-text-light dark:text-ping-night-text-light py-2">
          You haven&apos;t blocked anyone.
        </p>
      ) : (
        <div className="space-y-1.5">
          {blocked.map((u) => (
            <div key={u.id} className="flex items-center gap-3">
              <div
                className={`w-8 h-8 ${colorFor(u.username)} rounded-full flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0`}
              >
                {initialsFor(u.username)}
              </div>
              <p className="text-sm font-medium text-ping-dark dark:text-ping-night-text truncate flex-1">
                {u.username}
              </p>
              <button
                onClick={() => setUnblocking(u)}
                className="text-xs font-bold text-ping-teal dark:text-ping-teal-light hover:underline flex-shrink-0"
              >
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}

      {unblocking && (
        <ConfirmDialog
          title={`Unblock ${unblocking.username}?`}
          body="You'll be able to message each other again, and they'll reappear in search."
          confirmLabel="Unblock"
          isWorking={isWorking}
          onConfirm={handleUnblock}
          onCancel={() => setUnblocking(null)}
        />
      )}
    </div>
  );
}
