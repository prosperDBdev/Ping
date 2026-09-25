import api from "@/lib/api";
import { notificationsEnabled, systemPermission } from "@/lib/notifications";

/**
 * Web Push registration for this device.
 *
 * The browser creates the subscription (a push-service URL plus keys) and we
 * hand it to our server, which sends through it when a message arrives, even
 * with Ping closed. The server only accepts addresses on real push services;
 * see PushService on the backend.
 *
 * Needs the service worker, which is only registered in production builds, so
 * all of this quietly does nothing in development.
 */

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

/**
 * Make sure this device is registered, if the person wants notifications and
 * the browser allows them. Safe to call as often as you like: it reuses an
 * existing subscription and re-sends it, which also re-links the device to
 * whoever is signed in now.
 */
export async function ensurePushSubscription(): Promise<void> {
  if (!pushSupported() || systemPermission() !== "granted" || !notificationsEnabled()) return;

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;

  const { publicKey } = (await api.get("/push/public-key")).data as { publicKey: string | null };
  if (!publicKey) return; // push is switched off on the server

  let subscription = await registration.pushManager.getSubscription();
  // A subscription made with a different server key can't receive our pushes.
  if (subscription && toBase64Url(subscription.options.applicationServerKey) !== publicKey) {
    await subscription.unsubscribe();
    subscription = null;
  }
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      // Required by browsers: every push must show a visible notification.
      userVisibleOnly: true,
      applicationServerKey: fromBase64Url(publicKey),
    });
  }

  await api.post("/push/subscriptions", {
    endpoint: subscription.endpoint,
    p256dh: toBase64Url(subscription.getKey("p256dh")),
    auth: toBase64Url(subscription.getKey("auth")),
  });
}

/**
 * Stop pushes to this device: on sign-out, or when notifications are turned
 * off. `token` is passed explicitly for sign-out, where the request runs after
 * the app has already dropped its own copy of the token.
 */
export async function removePushSubscription(token?: string): Promise<void> {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  try {
    await api.delete("/push/subscriptions", {
      data: { endpoint: subscription.endpoint },
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    });
  } finally {
    await subscription.unsubscribe();
  }
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function toBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  let binary = "";
  new Uint8Array(buffer).forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
