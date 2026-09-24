import api from "@/lib/api";

/** Your own invite link. code and expiresAt are null when you have no live link. */
export interface MyInvite {
  code: string | null;
  expiresAt: string | null;
  invitedCount: number;
}

/**
 * Exactly what the server generates: 22 URL-safe characters.
 *
 * Checked before a code is used anywhere: in a request path, in a URL we
 * build, in a link we render. Anything else can't be a real code, so there's
 * no reason to send it to the server or put it in a page.
 */
export const INVITE_CODE_SHAPE = /^[A-Za-z0-9_-]{22}$/;

/** Read your current link. Never creates one: a GET must not change anything. */
export async function getMyInvite(): Promise<MyInvite> {
  const res = await api.get("/invites/mine");
  return res.data as MyInvite;
}

/** Make a new link. Your previous link stops working immediately. */
export async function createNewInvite(): Promise<MyInvite> {
  const res = await api.post("/invites/mine");
  return res.data as MyInvite;
}

/**
 * Who made this link. Works without being logged in, since the person
 * opening an invite usually doesn't have an account yet.
 * Rejects if the link is invalid or expired.
 */
export async function previewInvite(code: string): Promise<string> {
  const res = await api.get(`/auth/invites/${encodeURIComponent(code)}`);
  return (res.data as { inviterUsername: string }).inviterUsername;
}

/** The full shareable link, built from wherever this app is being served. */
export function inviteUrl(code: string): string {
  return `${window.location.origin}/invite/${code}`;
}
