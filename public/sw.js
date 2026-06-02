/*
 * The Ment Shop — Service Worker
 * Provides installability + a lightweight offline app shell.
 * Structured so Web Push (push / notificationclick listeners) can be
 * layered on later without restructuring this file.
 *
 * Strategy:
 *  - Navigations: NetworkFirst (never lock the device to a stale shell).
 *  - Static assets (icons/manifest): StaleWhileRevalidate-ish cache.
 *  - Everything else: pass through to the network.
 */

const CACHE_VERSION = "tms-v1";
const APP_SHELL = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests; let the browser deal with the rest.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never touch cross-origin requests (Supabase, Stripe, CDNs, etc.).
  if (url.origin !== self.location.origin) return;

  // Never cache OAuth/internal routes — these must always hit the network.
  if (url.pathname.startsWith("/~oauth")) return;

  // HTML navigations: NetworkFirst with offline fallback to cached shell.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE_VERSION);
          cache.put("/", fresh.clone());
          return fresh;
        } catch (err) {
          const cached = await caches.match("/");
          return cached || Response.error();
        }
      })(),
    );
    return;
  }

  // Static same-origin assets: serve from cache, refresh in background.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })(),
  );
});

/*
 * --- Web Push placeholder (enable when push is wired up) ---
 *
 * self.addEventListener("push", (event) => {
 *   const data = event.data ? event.data.json() : {};
 *   event.waitUntil(
 *     self.registration.showNotification(data.title || "The Ment Shop", {
 *       body: data.body,
 *       icon: "/icon-192.png",
 *       badge: "/icon-192.png",
 *       data: data.url ? { url: data.url } : {},
 *     }),
 *   );
 * });
 *
 * self.addEventListener("notificationclick", (event) => {
 *   event.notification.close();
 *   const target = (event.notification.data && event.notification.data.url) || "/";
 *   event.waitUntil(self.clients.openWindow(target));
 * });
 */
