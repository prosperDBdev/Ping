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

/** The server's own explanation of a failure, or a fallback if there isn't one. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  return (err as AxiosError<{ message?: string }>)?.response?.data?.message || fallback;
}
