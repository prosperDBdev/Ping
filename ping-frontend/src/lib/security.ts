import api from "@/lib/api";

// ---------------------------------------------------------------- devices

/** One signed-in device (Stage 14). */
export interface Device {
  id: string;
  deviceName: string;
  /** How it signed in: PASSWORD, EMAIL_CODE, QR or REGISTER. */
  method: string;
  createdAt: string;
  lastActiveAt: string;
  /** The device you're using right now. */
  current: boolean;
}

export async function listDevices(): Promise<Device[]> {
  return (await api.get("/sessions")).data as Device[];
}

/** Sign one of your other devices out. It's refused on its very next request. */
export async function signOutDevice(id: string): Promise<void> {
  await api.delete(`/sessions/${encodeURIComponent(id)}`);
}

/** Sign out everywhere except here. Resolves with how many were signed out. */
export async function signOutOtherDevices(): Promise<number> {
  return ((await api.delete("/sessions/others")).data as { signedOut: number }).signedOut;
}

// ------------------------------------------------- two-step verification

/** A code was emailed: `challenge` identifies it, `emailHint` says where it went. */
export interface CodeChallenge {
  challenge: string;
  emailHint: string;
}

export async function startTwoFactor(): Promise<CodeChallenge> {
  return (await api.post("/users/me/two-factor/start")).data as CodeChallenge;
}

export async function confirmTwoFactor(challenge: string, code: string): Promise<void> {
  await api.post("/users/me/two-factor/confirm", { challenge, code });
}

export async function disableTwoFactor(password: string): Promise<void> {
  await api.post("/users/me/two-factor/disable", { password });
}

export async function resendLoginCode(challenge: string): Promise<void> {
  await api.post("/auth/login/resend", { challenge });
}

// ------------------------------------------------------------ QR sign-in

/**
 * The plain WebSocket a computer waits on for QR sign-in. Derived from the
 * STOMP address (…/ws becomes …/ws-pair) so there's no new setting to keep in
 * sync, and switched to ws:// or wss:// because this one is a raw WebSocket,
 * not SockJS (which speaks http:// and upgrades itself).
 */
export function pairingSocketUrl(): string {
  const url = new URL(process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:8080/ws");
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = url.pathname.replace(/\/ws\/?$/, "/ws-pair");
  return url.toString();
}

/**
 * What the QR code contains: a link to this site's approval page with the
 * code after "#". The part after # never leaves the browser (it isn't sent to
 * the server or written to its logs), so the code can't leak that way. A
 * phone's own camera app can open the link too.
 */
export function pairingLink(code: string): string {
  return `${window.location.origin}/link-device#${code}`;
}

/** Codes the server makes: 43 URL-safe characters (256 random bits). */
const PAIRING_CODE_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/**
 * The code inside a scanned QR, or null if it isn't one of ours. Only links to
 * THIS site count: a QR pointing anywhere else is refused rather than followed.
 */
export function codeFromScan(text: string): string | null {
  try {
    const url = new URL(text);
    if (url.origin !== window.location.origin || url.pathname !== "/link-device") return null;
    const code = url.hash.slice(1);
    return PAIRING_CODE_SHAPE.test(code) ? code : null;
  } catch {
    return null;
  }
}

export function isPairingCode(code: string): boolean {
  return PAIRING_CODE_SHAPE.test(code);
}

export async function lookupPairing(code: string): Promise<string> {
  return ((await api.post("/pairing/lookup", { code })).data as { deviceName: string }).deviceName;
}

export async function approvePairing(code: string): Promise<void> {
  await api.post("/pairing/approve", { code });
}

export async function denyPairing(code: string): Promise<void> {
  await api.post("/pairing/deny", { code });
}

// ----------------------------------------------------------------- shared

/** "5 min ago", "yesterday": for last-active times. */
export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 90) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
