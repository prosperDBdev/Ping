import api from "@/lib/api";
import { User } from "@/types";

/**
 * Block a user. Symmetric on the server: once this succeeds, neither of you
 * can message the other until it's undone.
 */
export async function blockUser(userId: string): Promise<void> {
  await api.post(`/users/${userId}/block`);
}

export async function unblockUser(userId: string): Promise<void> {
  await api.delete(`/users/${userId}/block`);
}

export async function fetchBlockedUsers(): Promise<User[]> {
  const res = await api.get("/users/me/blocked");
  return res.data as User[];
}

/**
 * Clear a conversation for the current user.
 *
 * Nothing is deleted — the server records a per-user marker and hides earlier
 * messages from you only. The other person's copy is untouched, which is worth
 * being clear about in the UI so nobody expects this to unsend anything.
 */
export async function clearConversation(conversationId: string): Promise<void> {
  await api.delete(`/conversations/${conversationId}/clear`);
}

/** Remove a member from a group. Admin only — the server enforces it. */
export async function removeGroupMember(
  conversationId: string,
  userId: string
): Promise<void> {
  await api.delete(`/conversations/${conversationId}/participants/${userId}`);
}
