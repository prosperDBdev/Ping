import api from "@/lib/api";
import { Status, StatusFeedEntry, StatusPrivacy } from "@/types";

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

export async function fetchStatusViewers(statusId: string) {
  const res = await api.get(`/statuses/${statusId}/viewers`);
  return res.data as { id: string; username: string; avatarUrl: string | null }[];
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
 * local URL. Callers must revoke it — see the cleanup in StatusViewer.
 */
export async function fetchStatusMediaBlobUrl(key: string): Promise<string> {
  const res = await api.get("/statuses/media", {
    params: { key },
    responseType: "blob",
  });
  return URL.createObjectURL(res.data as Blob);
}

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
