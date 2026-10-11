"use strict";

const CACHE_NAME = "crypts-and-creatures-v242";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => {
    const manifestUrl = new URL("./precache-manifest.json", self.registration.scope);
    const manifestResponse = await fetch(new Request(manifestUrl, { cache: "reload" }));
    if (!manifestResponse.ok) throw new Error(`Could not load offline asset list: ${manifestResponse.status}`);
    const files = await manifestResponse.clone().json();
    if (!Array.isArray(files) || files.some((file) => typeof file !== "string")) {
      throw new Error("The offline asset list is invalid.");
    }
    await cache.put(manifestUrl, manifestResponse);
    await Promise.all(files.map(async (file) => {
      const url = new URL(file, self.registration.scope);
      const requestUrl = new URL(url);
      requestUrl.searchParams.set("precache", CACHE_NAME);
      const response = await fetch(new Request(requestUrl, { cache: "reload" }));
      if (!response.ok) throw new Error(`Could not cache ${file}: ${response.status}`);
      await cache.put(url, response);
    }));
  }));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
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
