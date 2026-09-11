"use client";

import { useEffect } from "react";

/**
 * Registers the service worker.
 *
 * Deliberately registered from a client component after mount rather than in a
 * script tag, so it never runs during server rendering and never competes with
 * the initial page load for bandwidth.
 *
 * Development is excluded on purpose. A service worker caching a dev server
 * produces the single most confusing bug in web development: you change a file,
 * the browser serves the old one, and nothing you do to the code has any
 * effect. Ask anyone who has lost an afternoon to it.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // Registration failing is not worth bothering the user about — the app
    // works fine without it, it just isn't installable.
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
