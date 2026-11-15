// Finds game text that no catalog translates. Opens the built game (www/) in a headless
// browser in another language, then (1) runs every string in the game's data through the
// translator and (2) plays through town, menus, and the tomb with the page's live
// translation on. Every piece of text the translator gives up on (data/locales.js calls
// window.cryptsLocaleMiss) is written to tools/translation-audit.json, most-seen first.
// Usage: npm run build && node tools/translation-audit.js [language, default es]
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { createGameServer } = require("../scripts/static-server");

const language = process.argv[2] || "es";

(async () => {
  const server = createGameServer(path.join(__dirname, "..", "www"));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript((lang) => {
    try { localStorage.setItem("crypts-and-creatures.language.v1", lang); } catch (error) { /* private */ }
    window.__misses = new Map();
    window.__where = "start";
    window.cryptsLocaleMiss = (text) => {
      const clean = String(text).trim();
      if (!/[A-Za-z]{2}/.test(clean)) return;
      const entry = window.__misses.get(clean) || { count: 0, where: new Set() };
      entry.count += 1;
      entry.where.add(window.__where);
      window.__misses.set(clean, entry);
    };
  }, language);
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "load" });
  await page.waitForFunction(() => typeof newRun === "function" && window.cryptsLocale);
  await page.waitForTimeout(800);

  // 1. Every string in the game's data.
  await page.evaluate(() => {
    window.__where = "data";
    const seen = new Set();
    const strings = new Set();
    const skipKeys = new Set(["id", "sprite", "icon", "art", "image", "templateId", "kind", "slot", "role", "code", "glyph", "key", "class", "className", "url", "src", "file", "tilePrefix", "base", "filter", "type", "habit", "tier", "category", "temperament", "is", "eats", "takes", "keeps"]);
    const walk = (value, key, depth) => {
      if (depth > 9 || value == null) return;
      if (typeof value === "string") {
        if (skipKeys.has(key)) return;
        const text = value.trim();
        // Ids and file names are lowercase words joined by - or _; text has spaces or capitals.
        if (!/[A-Za-z]{2}/.test(text) || /^[a-z0-9_\-:./]+$/.test(text) || /^\.\/|\.png|\.svg|^#|^rgb|^var\(/.test(text)) return;
        strings.add(text);
        return;
      }
      if (typeof value !== "object" || seen.has(value)) return;
      if (value instanceof Node || value === window) return;
      seen.add(value);
      for (const [childKey, child] of Object.entries(value)) walk(child, childKey, depth + 1);
    };
    const roots = Object.keys(window).filter((name) => /^Crypts/.test(name)).map((name) => window[name]);
    for (const name of ["PROGRESSION", "ECO", "CREATURE_HABITS", "TOWN_NPCS", "TOWN_BUILDINGS", "HOUSE_STYLES", "VILLAGE", "WILES_SOUNDS"]) {
      try { roots.push(eval(name)); } catch (error) { /* not in this build */ }
    }
    roots.push(state.pack);
    for (const root of roots) walk(root, "", 0);
    for (const text of strings) window.cryptsLocale.translateText(text);
  });

  // 2. Playing.
  const steps = [
    ["town", "newRun(makeLegacyCharacter()); render();"],
    ["town npcs", "for (const npc of TOWN_NPCS) { try { state.run.townPosition = { x: npc.x - 1, y: npc.y }; render(); talkToTownNpc(npc.id); render(); document.querySelectorAll('dialog[open]').forEach((d) => d.close()); } catch (e) {} }"],
    ["projects", "openProjectsDialog(); render(); document.querySelectorAll('dialog[open]').forEach((d) => d.close());"],
    ["house", "typeof openHouse === 'function' && openHouse(); render(); document.querySelectorAll('dialog[open]').forEach((d) => d.close());"],
    ["patolli", "typeof openPatolli === 'function' && openPatolli(); render(); document.querySelectorAll('dialog[open]').forEach((d) => d.close());"],
    ["drawers", "for (const drawer of ['journal', 'inventory', 'character', 'party', 'bestiary', 'settings', 'map']) { try { toggleUtilityDrawer(drawer); render(); toggleUtilityDrawer(drawer); } catch (e) {} }"],
    ["first floor", "beginNewDelve(); render();"],
    ...Array.from({ length: 12 }, (_, n) => [`floor ${n + 2}`, `travelToFloor(${n + 2}, 'connection-${n + 1}-1'); state.run.location = 'dungeon'; render();
      for (let i = 0; i < 40; i += 1) {
        state.run.hp = state.run.maxHp; state.run.lost = false;
        const d = MOVEMENT_DIRECTIONS[Math.floor(Math.random() * 8)];
        const x = state.run.player.x + d.x, y = state.run.player.y + d.y;
        if (isWalkable(x, y) && !tileHasCreature(x, y)) state.run.player = { ...state.run.player, x, y };
        finishPlayerTurn(10);
        const near = state.run.enemies.find((e) => e.alive && distanceInSquares(e, state.run.player) <= 1 && !e.friendly);
        if (near && Math.random() < 0.5) { try { attackEnemy(near); } catch (e) {} }
        if (i % 10 === 0) { state.targetId = state.run.enemies.find((e) => e.alive)?.id ?? null; render(); try { ecologyInteractions(); } catch (e) {} }
      }
      render();`]),
    ["back to town", "returnToChiltomatlan(); render();"]
  ];
  for (const [label, code] of steps) {
    await page.evaluate((where) => { window.__where = where; }, label);
    try {
      await page.evaluate(code);
      await page.waitForTimeout(400);
    } catch (error) {
      console.log(`(step "${label}" stopped: ${error.message.split("\n")[0]})`);
    }
  }

  const misses = await page.evaluate(() => [...window.__misses.entries()]
    .map(([text, entry]) => ({ text, count: entry.count, where: [...entry.where].slice(0, 4) }))
    .sort((a, b) => b.count - a.count));
  const out = path.join(__dirname, "translation-audit.json");
  fs.writeFileSync(out, JSON.stringify({ language, total: misses.length, misses }, null, 1));
  console.log(`${misses.length} untranslated pieces of text in ${language}; list in tools/translation-audit.json`);
  await browser.close();
  server.close();
})();
