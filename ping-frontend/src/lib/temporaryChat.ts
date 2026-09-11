import api from "@/lib/api";
import { TemporaryChatInvite } from "@/types";

/**
 * Invites addressed to the current user that are still awaiting a response.
 *
 * The WebSocket push only reaches someone who already has the app open, so
 * without this an invite sent while they were offline would sit in the
 * database forever, unseen. Called on load to catch up.
 */
export async function fetchPendingTemporaryChatInvites(): Promise<TemporaryChatInvite[]> {
  const res = await api.get("/temporary-chats/invites/pending");
  return res.data as TemporaryChatInvite[];
}
