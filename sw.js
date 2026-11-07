"use strict";

// The build (scripts/build-web.js) replaces this with a fingerprint of the asset list, so
// there is no version to bump by hand.
const CACHE_NAME = "crypts-and-creatures-5e90c15b3a";

// Installing (or updating) the offline copy. The asset list carries a content hash for
// each file; files whose hash hasn't changed are copied from the previous offline cache
// instead of downloaded again, so an update only fetches what changed. Downloads run a
// few at a time, so a slow phone isn't swamped while the player is in the game.
const PRECACHE_PARALLEL = 6;

async function previousOfflineCopy(manifestUrl) {
  for (const key of await caches.keys()) {
    if (key === CACHE_NAME || !key.startsWith("crypts-and-creatures-")) continue;
    const cache = await caches.open(key);
    const response = await cache.match(manifestUrl);
    if (!response) continue;
    try {
      const manifest = await response.json();
      if (manifest && !Array.isArray(manifest) && manifest.files) return { cache, files: manifest.files };
    } catch { /* an unreadable old list: download everything */ }
  }
  return null;
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => {
    const manifestUrl = new URL("./precache-manifest.json", self.registration.scope);
    const manifestResponse = await fetch(new Request(manifestUrl, { cache: "reload" }));
    if (!manifestResponse.ok) throw new Error(`Could not load offline asset list: ${manifestResponse.status}`);
    const manifest = await manifestResponse.clone().json();
    // Older builds wrote a plain list of files; newer ones a { files: { path: hash } } map.
    const files = Array.isArray(manifest) ? Object.fromEntries(manifest.map((file) => [file, null])) : manifest?.files;
    if (!files || typeof files !== "object" || Object.keys(files).some((file) => typeof file !== "string")) {
      throw new Error("The offline asset list is invalid.");
    }
    const previous = await previousOfflineCopy(manifestUrl);
    const queue = Object.entries(files);
    const worker = async () => {
      while (queue.length) {
        const [file, hash] = queue.shift();
        const url = new URL(file, self.registration.scope);
        if (hash && previous && previous.files[file] === hash) {
          const kept = await previous.cache.match(url);
          if (kept) { await cache.put(url, kept); continue; }
        }
        const requestUrl = new URL(url);
        requestUrl.searchParams.set("precache", CACHE_NAME);
        const response = await fetch(new Request(requestUrl, { cache: "reload" }));
        if (!response.ok) throw new Error(`Could not cache ${file}: ${response.status}`);
        await cache.put(url, response);
      }
    };
    await Promise.all(Array.from({ length: PRECACHE_PARALLEL }, worker));
    // The list goes in last, so a half-finished install is never mistaken for a full copy.
    await cache.put(manifestUrl, manifestResponse);
  }));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys
      // Only old offline copies; other stores (the figure paintings) belong to the game.
      .filter((key) => key !== CACHE_NAME && key.startsWith("crypts-and-creatures-"))
      .map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
