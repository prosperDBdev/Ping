/**
 * Message notifications: the on/off preference and system notifications.
 *
 * Both are per device, on purpose. Notification permission belongs to one
 * browser on one device, so allowing notifications on a phone says nothing
 * about a laptop. The preference follows the same rule and lives in
 * localStorage. That's fine for a convenience setting: if it's ever lost,
 * it falls back to "on".
 */

const PREF_KEY = "ping-notifications";

export type SystemPermission = NotificationPermission | "unsupported";

/** Whether this device wants message notifications. Defaults to on. */
export function notificationsEnabled(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setNotificationsEnabled(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? "on" : "off");
  } catch {
    // Storage blocked (private window). The toggle still works for this visit.
  }
}

/**
 * "unsupported" covers iPhone Safari in a normal tab: Apple only allows web
 * notifications once a site has been added to the Home Screen.
 */
export function systemPermission(): SystemPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/**
 * Ask the browser for permission. Must be called from a tap or click:
 * browsers ignore or auto-deny requests that don't come from a user gesture.
 */
export async function requestSystemPermission(): Promise<SystemPermission> {
  if (systemPermission() === "unsupported") return "unsupported";
  return Notification.requestPermission();
}

/**
 * Show a system notification for a new message.
 *
 * Goes through the service worker whenever there is one, because Android
 * Chrome refuses the simpler `new Notification(...)` and throws "Illegal
 * constructor". The service worker route works everywhere notifications do.
 *
 * `tag` is the conversation id, so a burst of messages in one chat replaces a
 * single notification instead of stacking twenty of them. `renotify` makes
 * each replacement alert again; without it the replacement is silent and
 * never pops up on a phone (see the push handler in public/sw.js).
 */
export async function showSystemNotification(
  title: string,
  body: string,
  conversationId: string,
  messageId?: string
): Promise<void> {
  if (systemPermission() !== "granted") return;

  // renotify and vibrate are real, widely supported options that TypeScript's
  // built-in NotificationOptions type doesn't list yet, hence the widening.
  const options: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
    body,
    tag: conversationId,
    renotify: true,
    silent: false,
    vibrate: [200, 100, 200],
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { conversationId, messageId },
  };

  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      // The push for this message may have beaten the open tab to it.
      const shown = await registration.getNotifications({ tag: conversationId });
      if (messageId && shown.some((n) => n.data?.messageId === messageId)) return;
      await registration.showNotification(title, options);
      return;
    }
  } catch {
    // Fall through to the page-level notification.
  }

  try {
    const notification = new Notification(title, options);
    notification.onclick = () => {
      window.focus();
      // Handed to MessageNotifier, which opens the chat with the app's own
      // router instead of reloading the whole page.
      window.dispatchEvent(new CustomEvent("ping:open-conversation", { detail: conversationId }));
    };
  } catch {
    // No service worker and no page-level notifications (Android without the
    // worker registered yet). The unread badge still shows it.
  }
}
