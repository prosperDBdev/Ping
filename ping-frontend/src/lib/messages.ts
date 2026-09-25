import api from "@/lib/api";
import { AxiosError } from "axios";
import { Message } from "@/types";

/**
 * React to a message. Sending the reaction you already have removes it.
 * Resolves with the updated message; everyone else in the chat receives the
 * same update live.
 */
export async function reactToMessage(conversationId: string, messageId: string, emoji: string): Promise<Message> {
  const res = await api.put(`/conversations/${conversationId}/messages/${messageId}/reaction`, { emoji });
  return res.data as Message;
}

/**
 * Change the text of a message you sent. The server decides whether it's still
 * within the 10-minute window, by its own clock, and rejects it otherwise.
 */
export async function editMessage(conversationId: string, messageId: string, content: string): Promise<Message> {
  const res = await api.patch(`/conversations/${conversationId}/messages/${messageId}`, { content });
  return res.data as Message;
}

/** Must match MessageService.DELETE_FOR_EVERYONE_WINDOW on the server. */
export const DELETE_FOR_EVERYONE_MS = 48 * 60 * 60 * 1000;

/** What the chat list shows in place of a message deleted for everyone. */
export const DELETED_PREVIEW = "This message was deleted";

/**
 * Delete a message you sent for everyone in the chat. Resolves with the
 * "This message was deleted" marker that replaces it; everyone with the chat
 * open receives the same marker live. The server enforces the 48 hours.
 */
export async function deleteForEveryone(conversationId: string, messageId: string): Promise<Message> {
  const res = await api.delete(`/conversations/${conversationId}/messages/${messageId}`, {
    params: { scope: "everyone" },
  });
  return res.data as Message;
}

/** Hide a message from yourself only. Nobody else's chat changes. */
export async function deleteForMe(conversationId: string, messageId: string): Promise<void> {
  await api.delete(`/conversations/${conversationId}/messages/${messageId}`, { params: { scope: "me" } });
}

/** The server's own explanation of a failure, or a fallback if there isn't one. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  return (err as AxiosError<{ message?: string }>)?.response?.data?.message || fallback;
}
