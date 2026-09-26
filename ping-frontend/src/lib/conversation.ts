import { Conversation, User } from "@/types";

/** Your chat with yourself ("Message yourself"): a private chat with only you in it. */
export function isSelfChat(conversation: Conversation): boolean {
  return conversation.type !== "GROUP" && conversation.participants.length === 1;
}

/**
 * The person a private chat is with. In your chat with yourself, that's you,
 * so everything that shows "the other person" (avatar, name) shows you.
 */
export function chatPartner(conversation: Conversation, myId: string | undefined): User | undefined {
  return (
    conversation.participants.find((p) => p.id !== myId) ??
    (isSelfChat(conversation) ? conversation.participants[0] : undefined)
  );
}

/** The name a chat is shown under: the group's name, the other person, or "you (You)". */
export function chatName(conversation: Conversation, myId: string | undefined): string {
  if (conversation.type === "GROUP") return conversation.name || "Group";
  const partner = chatPartner(conversation, myId);
  if (!partner) return "Unknown";
  return isSelfChat(conversation) ? `${partner.username} (You)` : partner.username;
}
