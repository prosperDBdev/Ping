import api from "@/lib/api";
import { Conversation, User } from "@/types";

/**
 * Managing a group: its members, its admins, and its invite link.
 * Every call here is enforced again on the server; these functions exist so
 * the rule lives in one place per operation rather than in each component.
 */

/** A group's shareable link, as the panel and the join page see it. */
export interface GroupInvite {
  conversationId: string;
  groupName: string;
  inviterUsername: string;
  memberCount: number;
  uses: number;
  expiresAt: string;
  url: string;
}

/** Codes the server makes: 22 URL-safe characters (128 random bits). */
export const GROUP_CODE_SHAPE = /^[A-Za-z0-9_-]{22}$/;

/** Add people to a group. Admins only, unless the group allows everyone. */
export async function addParticipants(conversationId: string, userIds: string[]): Promise<Conversation> {
  const res = await api.post(`/groups/${conversationId}/participants`, { userIds });
  return res.data as Conversation;
}

export async function removeGroupMember(conversationId: string, userId: string): Promise<void> {
  await api.delete(`/groups/${conversationId}/participants/${userId}`);
}

/** Promote a member to admin, or take it away. Admins only. */
export async function setGroupAdmin(
  conversationId: string,
  userId: string,
  makeAdmin: boolean
): Promise<Conversation> {
  const res = await api.put(`/groups/${conversationId}/participants/${userId}/admin`, { makeAdmin });
  return res.data as Conversation;
}

export async function leaveGroup(conversationId: string): Promise<void> {
  await api.post(`/groups/${conversationId}/leave`);
}

/** ADMINS_ONLY (the default) or EVERYONE. Admins only. */
export async function setWhoCanAdd(
  conversationId: string,
  addMembersBy: "ADMINS_ONLY" | "EVERYONE"
): Promise<Conversation> {
  const res = await api.put(`/groups/${conversationId}/settings`, { addMembersBy });
  return res.data as Conversation;
}

/**
 * The group's link, or null when it doesn't have a live one. Never creates
 * one: a GET must not change anything, because browsers prefetch links.
 */
export async function getGroupInvite(conversationId: string): Promise<GroupInvite | null> {
  const res = await api.get(`/groups/${conversationId}/invite`);
  return (res.data as GroupInvite | undefined) ?? null;
}

/** Make a link, replacing any previous one so that one stops working at once. */
export async function createGroupInvite(conversationId: string): Promise<GroupInvite> {
  const res = await api.post(`/groups/${conversationId}/invite`);
  return res.data as GroupInvite;
}

export async function revokeGroupInvite(conversationId: string): Promise<void> {
  await api.delete(`/groups/${conversationId}/invite`);
}

/** What group is this link for? Public: whoever was sent it may not have an account. */
export async function previewGroupInvite(code: string): Promise<GroupInvite> {
  return (await api.get(`/group-invites/${encodeURIComponent(code)}`)).data as GroupInvite;
}

/** Join. Needs a signed-in account; the code is in the path, never a body. */
export async function joinGroup(code: string): Promise<Conversation> {
  const res = await api.post(`/group-invites/${encodeURIComponent(code)}/join`, {});
  return res.data as Conversation;
}

/** True when this user may add people to this group, mirroring the server's rule. */
export function canAddMembers(conversation: Conversation, userId: string | undefined): boolean {
  if (conversation.type !== "GROUP" || !userId) return false;
  if (!conversation.participants.some((p) => p.id === userId)) return false;
  return isGroupAdmin(conversation, userId) || conversation.addMembersBy === "EVERYONE";
}

export function isGroupAdmin(conversation: Conversation, userId: string | undefined): boolean {
  if (!userId) return false;
  return conversation.admin === userId || !!conversation.admins?.includes(userId);
}

/** The group's owner: the first admin, who can never be removed or demoted. */
export function groupOwnerId(conversation: Conversation): string | null {
  return conversation.admins?.[0] ?? null;
}

/** People who could be added: everyone in the group except you is already excluded. */
export function addableFrom(group: Conversation): Set<string> {
  return new Set(group.participants.map((p: User) => p.id));
}
