"use strict";

const CACHE_NAME = "crypts-and-creatures-v240";
const ENEMY_SPRITES = [
  "cenote-stalker", "yohualtepoztli", "camazotz", "duende",
  "jungle-jaguar", "feathered-serpent", "tomb-bat", "maztican-cave-locust",
  "mictlaneca", "quinametli", "caxtiltecatl", "axolocatl", "tzitzimitl", "cihuateotl", "treasure-cache",
  "jade-pectoral", "incensario", "obsidian-mirror"
];
const TILE_SPRITES = [
  "wall", "floor", "corridor", "door", "fog",
  "town-street", "town-wall", "town-inn", "town-market", "town-gate"
];
const TOKEN_SPRITES = [
  "innkeeper", "merchant", "temple-keeper", "hazard-found", "hazard-mark",
  "entrance", "dungeon-entrance", "door-open", "door-closed",
  "door-mark", "archway-mark", "portcullis-mark", "secret-mark", "stairs-mark",
  "dungeon-well", "gear-mender", "patolli-board"
];
const ITEM_SPRITES = [
  "ration", "smoked-fish", "chilis", "soup", "water", "potion",
  "weapon", "armor", "tool", "kit", "supply", "treasure", "clothing", "keepsake",
  "coin-pile", "jade-bead", "terracotta-figurine", "gold-ring"
];
const UI_ART = ["title-temple"];
const APP_FILES = [
  "./", "./index.html", "./styles.css?v=202",
  "./data/locales.js?v=6", "./data/locales/en.json", "./data/locales/es.json",
  "./data/items.js?v=5", "./data/enemies.js?v=5", "./data/content.js?v=3", "./data/spells.js?v=1",
  "./data/character-options.js?v=3", "./systems/patolli.js?v=2",
  "./systems/characters.js?v=17", "./systems/dungeons.js?v=8",
  "./systems/rewarded-ads.js?v=1", "./admob.config.js?v=1", "./app.js?v=164",
  "./manifest.json", "./icon.png",
  ...ENEMY_SPRITES.map((sprite) => `./resources/enemies/${sprite}.png?v=77`),
  ...TILE_SPRITES.map((sprite) => `./resources/tiles/${sprite}.png?v=79`),
  ...TOKEN_SPRITES.map((sprite) => `./resources/tokens/${sprite}.png?v=77`),
  ...ITEM_SPRITES.map((sprite) => `./resources/items/${sprite}.png?v=77`),
  ...UI_ART.map((sprite) => `./resources/ui/${sprite}.png?v=79`),
  ...["wall", "floor", "corridor", "door", "fog"].map((sprite) => `./resources/tiles/${sprite}.png?v=79`),
  "./resources/ui/tomb-chamber.png?v=3"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => {
    await Promise.all(APP_FILES.map(async (file) => {
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
    caches.match(event.request).then((cached) => {
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
