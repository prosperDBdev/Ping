import api from "@/lib/api";

export interface UploadedVoiceNote {
  key: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Uploads a recorded voice note. The backend re-detects the real file type and
 * enforces its own size cap — this call doesn't get to skip that just because
 * the recording happened in a "trusted" browser tab.
 */
export async function uploadVoiceNote(blob: Blob): Promise<UploadedVoiceNote> {
  const formData = new FormData();
  // The filename here is cosmetic only — the backend never trusts it for
  // anything (see MediaStorageService's object-key generation).
  formData.append("file", blob, "voice-note");

  const res = await api.post("/media/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data as UploadedVoiceNote;
}

/** What the browser is allowed to pick, mirroring the backend's allow-list. */
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Client-side size cap. Deliberately the same number the backend enforces —
 * this one exists purely so someone picking a 40MB photo finds out instantly
 * instead of after a long upload that ends in a 400. The server's copy is the
 * one that actually protects anything.
 */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export interface UploadedImage {
  key: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Uploads an image. Note the response's mimeType and sizeBytes describe what
 * the SERVER produced, not what was sent: images are re-encoded (and possibly
 * downscaled) on arrival, so a PNG in can legitimately come back as image/jpeg
 * at a fraction of the size. Always use these returned values rather than the
 * File's own — they're what's actually stored.
 */
export async function uploadImage(file: File): Promise<UploadedImage> {
  const formData = new FormData();
  formData.append("file", file, file.name);

  const res = await api.post("/media/upload/image", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data as UploadedImage;
}

export interface ConversationMediaItem {
  messageId: string;
  key: string;
  mimeType: string;
  sizeBytes: number;
  fileName: string | null;
  durationSeconds: number | null;
  senderId: string;
  senderUsername: string;
  createdAt: string;
}

/**
 * Every file shared in a conversation. Comes from the server rather than being
 * derived from loaded messages, because the message list only holds the page
 * currently scrolled into view — a file shared 300 messages ago still belongs
 * in the Files panel.
 */
export async function fetchConversationMedia(
  conversationId: string
): Promise<ConversationMediaItem[]> {
  const res = await api.get(`/conversations/${conversationId}/messages/media`);
  return res.data as ConversationMediaItem[];
}

/**
 * Fetches a stored voice note and turns it into a URL an <audio> element can
 * play. This can't just be `<audio src="http://.../media/download?key=...">` —
 * that endpoint requires a JWT, and browsers don't attach custom Authorization
 * headers to media elements' own requests. So instead: fetch the bytes
 * ourselves (through the same `api` instance that already attaches the
 * header), get them back as a Blob, and hand the browser a local
 * `blob:` URL that points at bytes already sitting in memory — no further
 * request, no header needed.
 */
export async function fetchVoiceNoteBlobUrl(key: string): Promise<string> {
  const res = await api.get("/media/download", {
    params: { key },
    responseType: "blob",
  });

  return URL.createObjectURL(res.data as Blob);
}

/**
 * Same mechanism as fetchVoiceNoteBlobUrl, under a name that isn't a lie when
 * the bytes are an image. The download endpoint is type-agnostic; only the
 * reason we can't point an element straight at it (the JWT) is shared.
 */
export const fetchMediaBlobUrl = fetchVoiceNoteBlobUrl;
