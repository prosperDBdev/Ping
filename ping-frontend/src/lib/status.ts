import api from "@/lib/api";
import { Message, Status, StatusFeedEntry, StatusPrivacy, StatusViewer } from "@/types";

/**
 * Status API client.
 *
 * Every one of these hits an endpoint that re-derives visibility server-side.
 * Nothing here decides who may see what — the client's job is to render what
 * it is given, and a client that started filtering on its own would be a
 * second, weaker copy of a rule that already exists in StatusService.
 */

export async function fetchStatusFeed(): Promise<StatusFeedEntry[]> {
  const res = await api.get("/statuses");
  return res.data as StatusFeedEntry[];
}

export async function fetchMyStatuses(): Promise<Status[]> {
  const res = await api.get("/statuses/mine");
  return res.data as Status[];
}

export async function createTextStatus(
  text: string,
  backgroundColor: string
): Promise<Status> {
  const res = await api.post("/statuses/text", { text, backgroundColor });
  return res.data as Status;
}

export async function createImageStatus(file: File, caption: string): Promise<Status> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  if (caption.trim()) formData.append("caption", caption.trim());

  const res = await api.post("/statuses/image", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data as Status;
}

export async function markStatusViewed(statusId: string): Promise<void> {
  await api.post(`/statuses/${statusId}/view`);
}

export async function reshareStatus(statusId: string): Promise<Status> {
  const res = await api.post(`/statuses/${statusId}/reshare`);
  return res.data as Status;
}

export async function deleteStatus(statusId: string): Promise<void> {
  await api.delete(`/statuses/${statusId}`);
}

export async function fetchStatusViewers(statusId: string): Promise<StatusViewer[]> {
  const res = await api.get(`/statuses/${statusId}/viewers`);
  return res.data as StatusViewer[];
}

/**
 * React, or take a reaction back. Sending the reaction you already have
 * removes it — the server toggles, so the client never has to decide whether
 * to "add" or "remove".
 */
export async function reactToStatus(statusId: string, emoji: string): Promise<Status> {
  const res = await api.post(`/statuses/${statusId}/react`, { emoji });
  return res.data as Status;
}

/**
 * Reply to a status. The server delivers this as a private message in your
 * 1:1 chat with the author and hands back that message.
 */
export async function replyToStatus(statusId: string, text: string): Promise<Message> {
  const res = await api.post(`/statuses/${statusId}/reply`, { text });
  return res.data as Message;
}

export async function fetchStatusPrivacy(): Promise<StatusPrivacy> {
  const res = await api.get("/statuses/privacy");
  return res.data as StatusPrivacy;
}

export async function updateStatusPrivacy(
  update: Partial<StatusPrivacy>
): Promise<StatusPrivacy> {
  const res = await api.put("/statuses/privacy", update);
  return res.data as StatusPrivacy;
}

/**
 * Fetch a status image as a blob: URL.
 *
 * Same reason as chat attachments: the endpoint requires a JWT and the browser
 * won't attach an Authorization header to an <img>'s own request, so the bytes
 * come through the authenticated axios instance and the element is handed a
 * local URL. Callers must revoke it — see the cleanup in StatusMedia.
 */
export async function fetchStatusMediaBlobUrl(key: string): Promise<string> {
  const res = await api.get("/statuses/media", {
    params: { key },
    responseType: "blob",
  });
  return URL.createObjectURL(res.data as Blob);
}

/**
 * The reactions offered — and the only ones the server accepts.
 *
 * These must stay byte-for-byte identical to ALLOWED_REACTIONS in
 * StatusService. The heart in particular includes U+FE0F, the variation
 * selector that makes it render in colour; a heart without it looks the same
 * on most screens and is rejected by the server as a different string.
 */
export const STATUS_REACTIONS = ["❤️", "😂", "😮", "😢", "👏", "🔥"];

/** The palette offered by the composer. Hex only — the backend rejects anything else. */
export const STATUS_COLORS = [
  "#1F7A6C",
  "#D97757",
  "#2D3E50",
  "#7C5CBF",
  "#B23A48",
  "#3A7CA5",
  "#4F7942",
  "#1A1A1A",
];

/** How long each status is shown before the viewer advances, in ms. */
export const STATUS_SLIDE_MS = 5000;
