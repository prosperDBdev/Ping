import api from "@/lib/api";

/** Mirrors the backend's allow-list, so the file picker doesn't offer the impossible. */
export const ACCEPTED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Client-side size cap, the same number the server enforces. This one only
 * exists so picking a 40MB photo fails instantly instead of after a long
 * upload; the server's copy is the one that actually protects anything.
 */
export const MAX_AVATAR_BYTES = 10 * 1024 * 1024;

/**
 * Upload a new profile photo and get back the URL to display it from.
 *
 * There is no user id in this call. The endpoint is /users/me/avatar and the
 * server takes the identity from the token, so this function has no way to
 * express "change someone else's photo" even if it wanted to.
 *
 * The returned URL carries a version parameter that changes on every upload —
 * that's what makes the browser fetch the new picture instead of the cached
 * old one.
 */
export async function uploadAvatar(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file, file.name);

  const res = await api.post("/users/me/avatar", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return (res.data as { avatarUrl: string }).avatarUrl;
}

/** Remove your own profile photo. Succeeds even if there wasn't one. */
export async function removeAvatar(): Promise<void> {
  await api.delete("/users/me/avatar");
}

/**
 * Fetch an avatar and turn it into a URL an <img> can display.
 *
 * Same constraint as chat images: the endpoint needs a JWT, and the browser
 * won't attach an Authorization header to an <img> element's own request. So
 * the bytes come through the authenticated axios instance and the element is
 * handed a local blob: URL instead.
 *
 * The stored value is a full API path ("/api/users/.../avatar?v=..."), while
 * axios is configured with a baseURL that already ends in /api — hence the
 * strip, so the request doesn't go to /api/api/...
 */
export async function fetchAvatarBlobUrl(avatarUrl: string): Promise<string> {
  const path = avatarUrl.replace(/^\/api/, "");

  const res = await api.get(path, { responseType: "blob" });

  return URL.createObjectURL(res.data as Blob);
}
