"use strict";

// Arriving somewhere new (a floor, the tomb from town, town from the tomb, a loaded save)
// shouldn't show a half-drawn screen. render() calls arrivalCheck() first; when the place
// has changed, a veil covers the screen before the first frame is painted. The new place
// is drawn under it, every picture it uses (tile art, creatures, items, the player) is
// loaded and decoded, the place is drawn once more, and only then does the veil lift.

const ARRIVAL_MAX_WAIT = 1500;   // never hold the player longer than this
const ARRIVAL_MIN_SHOW = 140;    // long enough that the veil reads as a transition, not a flicker
const arrivalDecoded = new Set();
const arrival = { key: null, veil: null, token: 0 };

function arrivalPlaceKey() {
  const run = state.run;
  if (!run || !state.gameStarted) return null;
  if (run.location === "dungeon") return `dungeon:${run.dungeonFloor}:${state.activeSaveId || ""}`;
  return `town:${state.activeSaveId || ""}`;
}

function arrivalVeil() {
  if (arrival.veil) return arrival.veil;
  const veil = document.createElement("div");
  veil.className = "arrival-veil";
  veil.setAttribute("aria-hidden", "true");
  veil.innerHTML = '<p class="arrival-caption"></p>';
  document.body.append(veil);
  arrival.veil = veil;
  return veil;
}

function arrivalCaption() {
  const run = state.run;
  if (run.location !== "dungeon") return t("Chiltomatlan");
  return `${t("Floor")} ${run.dungeonFloor} · ${DUNGEON_FLOOR_COUNT}`;
}

// Called at the top of render(). Returns nothing; it only arranges the veil.
function arrivalCheck() {
  const key = arrivalPlaceKey();
  if (!key || key === arrival.key) return;
  const first = arrival.key === null;
  arrival.key = key;
  // A step's slide animation from the place you left must not carry over.
  state.playerMoveEffect = null;
  const veil = arrivalVeil();
  veil.querySelector(".arrival-caption").textContent = first ? "" : arrivalCaption();
  veil.classList.remove("lifting");
  veil.classList.add("shown");
  const token = ++arrival.token;
  const shownAt = performance.now();
  // render() finishes drawing the new place under the veil; then wait for its pictures.
  window.setTimeout(() => arrivalSettle(token, shownAt), 0);
}

async function arrivalSettle(token, shownAt) {
  const urls = arrivalImageUrls();
  const textures = typeof characterTexturesPending === "function" ? characterTexturesPending() : Promise.resolve();
  await Promise.race([
    Promise.all([...urls.map(arrivalDecode), textures]),
    new Promise((resolve) => window.setTimeout(resolve, ARRIVAL_MAX_WAIT))
  ]);
  if (token !== arrival.token) return;
  // Draw once more now that everything is decoded, then give it two frames to paint.
  if (typeof render === "function") render();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const wait = ARRIVAL_MIN_SHOW - (performance.now() - shownAt);
  if (wait > 0) await new Promise((resolve) => window.setTimeout(resolve, wait));
  if (token !== arrival.token) return;
  arrival.veil.classList.add("lifting");
  arrival.veil.classList.remove("shown");
}

// Every picture the visible screen uses: <img> sources and CSS backgrounds, including the
// ::before and ::after layers the map tiles draw with.
function arrivalImageUrls() {
  const roots = ["dungeon-map", "town-map"].map((id) => document.getElementById(id)).filter(Boolean);
  const urls = new Set();
  for (const image of document.querySelectorAll("#game-layout img")) if (image.src) urls.add(image.currentSrc || image.src);
  const addBackground = (value) => {
    if (!value || value === "none") return;
    for (const match of value.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      if (!match[1].startsWith("data:")) urls.add(match[1]);
    }
  };
  const seen = new Set();
  for (const root of roots) {
    for (const element of [root, ...root.querySelectorAll("*")]) {
      if (seen.has(element)) continue;
      seen.add(element);
      if (element.tagName === "IMG" && element.src) urls.add(element.currentSrc || element.src);
      if (!element.getClientRects().length) continue;
      addBackground(getComputedStyle(element).backgroundImage);
      addBackground(getComputedStyle(element, "::before").backgroundImage);
      addBackground(getComputedStyle(element, "::after").backgroundImage);
    }
  }
  return [...urls].filter((url) => !arrivalDecoded.has(url));
}

function arrivalDecode(url) {
  return new Promise((resolve) => {
    const image = new Image();
    const done = () => { arrivalDecoded.add(url); resolve(); };
    image.onload = () => (image.decode ? image.decode().then(done, done) : done());
    image.onerror = done;
    image.src = url;
  });
}

// While the player is in town, quietly decode the tomb's tile and creature art so the
// first descent has little to wait for.
function arrivalWarmUp() {
  const sprites = window.CryptsEnemies?.sprites || [];
  const aliases = window.CryptsEnemies?.spriteAliases || {};
  const urls = sprites.map((name) => `./resources/enemies/${aliases[name]?.base || name}.png?v=${typeof SPRITE_RESOURCE_VERSION !== "undefined" ? SPRITE_RESOURCE_VERSION : 1}`);
  let index = 0;
  const step = () => {
    if (index >= urls.length) return;
    const url = urls[index++];
    if (arrivalDecoded.has(url)) { step(); return; }
    arrivalDecode(url).then(() => (window.requestIdleCallback ? requestIdleCallback(step) : window.setTimeout(step, 30)));
  };
  window.setTimeout(step, 2000);
}
window.addEventListener("load", arrivalWarmUp);
