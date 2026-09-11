/**
 * Ping's service worker.
 *
 * Two jobs, and it is deliberately bad at everything else:
 *
 *   1. Chrome will not offer to install a site unless it has a service worker
 *      with a fetch handler. No worker, no install prompt, no "Download app"
 *      button that does anything on Android.
 *   2. Give someone who opens an installed Ping with no signal a page that says
 *      so, instead of the browser's dinosaur.
 *
 * WHY IT CACHES SO LITTLE. A service worker sits between the app and the
 * network for every request, and it keeps running after the page closes. A
 * caching mistake here doesn't look like a caching mistake — it looks like the
 * app showing yesterday's messages, or refusing to update after a deploy, and
 * it persists in that browser until the worker is replaced. For a chat app,
 * where nothing on screen is supposed to be stale, aggressive caching is all
 * risk and almost no reward. So: never touch API calls, never cache anything
 * user-specific, and keep only enough to render an offline page.
 */

const CACHE = "ping-shell-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL]))
  );
  // Take over as soon as this worker is installed rather than waiting for
  // every tab to close. Without it, a deploy can leave the previous worker in
  // charge for days, which is exactly the "I fixed it but it's still broken"
  // bug that makes people hate service workers.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only ever consider page navigations. Everything else — API calls, images,
  // scripts, the WebSocket handshake — goes straight to the network untouched,
  // because this worker has nothing useful to say about any of them.
  if (request.mode !== "navigate") return;

  event.respondWith(
    fetch(request).catch(() =>
      caches.match(OFFLINE_URL).then((cached) => cached ?? Response.error())
    )
  );
});
