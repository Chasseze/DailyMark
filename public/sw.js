/* DailyMark service worker — caches the app shell; never caches Supabase API. */
// Bumped whenever the caching rules change, so activate() drops shells that an
// older revision may have stored under the previous rules.
const CACHE = "dailymark-shell-v4";
const SHELL = ["/", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Never intercept API / auth / storage — always network.
  if (
    url.hostname.includes("supabase") ||
    url.port === "54321" ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/rest/") ||
    url.pathname.startsWith("/storage/")
  ) {
    return;
  }

  // Navigations: network first, fall back to cached shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only a good document may become the offline shell — caching a 404
          // or a 502 here would serve that error page to every later visit.
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE).then((cache) => cache.put("/", copy));
          }
          return response;
        })
        .catch(async () => {
          // caches.match() returns a promise, so `a || b` would always take the
          // first branch and resolve to undefined when the shell is missing.
          const shell = await caches.match("/");
          if (shell) return shell;
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response(
            "<!doctype html><title>Offline</title><p>DailyMark is offline.</p>",
            { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
          );
        })
    );
    return;
  }

  // Static assets: cache first, then network.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (
              response.ok &&
              (url.pathname.startsWith("/assets/") ||
                url.pathname.startsWith("/fonts/") ||
                url.pathname.startsWith("/img/") ||
                url.pathname.endsWith(".svg"))
            ) {
              const copy = response.clone();
              void caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
  }
});
