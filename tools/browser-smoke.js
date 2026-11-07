// Opens the built game (www/) in a real headless browser and plays a little: title screen,
// a new character in town, the first dungeon floors. Fails if the page logs an error, the
// security policy blocks something, or an art file is missing.
// Usage: npm run build && node tools/browser-smoke.js      (needs playwright installed)
const path = require("path");
const { chromium } = require("playwright");
const { createGameServer } = require("../scripts/static-server");

(async () => {
  const server = createGameServer(path.join(__dirname, "..", "www"));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const problems = [];
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") problems.push(`console: ${message.text()}`); });
  page.on("response", (response) => { if (response.status() >= 400) problems.push(`${response.status()} ${response.url().replace(url, "")}`); });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => console.error(`CSP blocked ${event.blockedURI || "inline"} (${event.violatedDirective})`));
  });

  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => typeof newRun === "function");
  const steps = [
    ["new character in town", "newRun(makeLegacyCharacter()); render();"],
    ["first floor", "beginNewDelve(); render();"],
    ["a few turns", "for (let i = 0; i < 20; i += 1) finishPlayerTurn(10); render();"],
    ["floor 4", "travelToFloor(4, 'connection-3-1'); state.run.location = 'dungeon'; render();"],
    ["back to town", "returnToChiltomatlan(); render();"]
  ];
  for (const [label, code] of steps) {
    try {
      await page.evaluate(code);
      await page.waitForTimeout(600);
      console.log(`ok  ${label}`);
    } catch (error) {
      problems.push(`${label}: ${error.message.split("\n")[0]}`);
    }
  }
  // Surroundings: with three creatures around you, every view agrees on which one is which.
  try {
    await page.evaluate(() => {
      travelToFloor(5, "connection-4-1"); state.run.location = "dungeon";
      const p = state.run.player;
      const room = Math.max(0, state.run.rooms.findIndex((r) => p.x >= r.mapX && p.x < r.mapX + r.mapW && p.y >= r.mapY && p.y < r.mapY + r.mapH));
      const spots = [[1, 0], [0, 1], [-1, 0], [1, 1], [-1, -1], [0, -1], [1, -1], [-1, 1]].map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy }))
        .filter((s) => isWalkable(s.x, s.y) && !tileHasCreature(s.x, s.y));
      ["jungle-jaguar", "cave-turkey", "dungeonrabbit"].forEach((id, i) => state.run.enemies.push(ecoNewCreature(id, spots[i], room)));
      state.targetId = null;
      render();
    });
    const result = await page.evaluate(() => {
      const chips = [...document.querySelectorAll("#nearby-strip .nearby-chip")];
      const second = chips[1];
      second.click();
      const picked = state.run.enemies.find((e) => String(e.id) === second.dataset.creatureId);
      const frameId = document.getElementById("encounter").dataset.creatureId;
      const ringOn = document.querySelector(".map-tile.is-target")?.dataset.x;
      document.getElementById("encounter").click();
      const cardTitle = document.querySelector(".creature-card h2, .creature-card h3")?.textContent || "";
      document.querySelector("[data-creature-close]")?.click();
      const adjacentShown = nearbyCreatures().filter((c) => distanceInSquares(c, state.run.player) === 1).length;
      return { chips: chips.length, pickedName: picked?.name, frameMatches: frameId === String(picked?.id), ringMatches: Number(ringOn) === picked?.x, cardTitle, adjacentShown, label: attackButtonLabel(attackTargets()) };
    });
    if (result.chips < 3) problems.push(`nearby row shows ${result.chips} creatures, expected at least 3`);
    if (!result.frameMatches) problems.push("target frame doesn't show the creature picked in the nearby row");
    if (!result.ringMatches) problems.push("map ring isn't on the picked creature");
    if (!result.cardTitle.includes(result.pickedName)) problems.push(`frame opened "${result.cardTitle}", expected ${result.pickedName}`);
    console.log(`ok  surroundings: ${result.chips} nearby, picked ${result.pickedName}, card "${result.cardTitle.trim()}", button "${result.label}"`);
  } catch (error) {
    problems.push(`surroundings: ${error.message.split("\n")[0]}`);
  }

  // No action button's words are cut off (the big button and its tab may use two lines).
  const clipped = await page.evaluate(() => [...document.querySelectorAll("#action-primary .button .action-label")]
    .filter((label) => label.offsetParent && label.scrollHeight > label.clientHeight + 2)
    .map((label) => label.textContent));
  const tab = await page.evaluate(() => document.querySelector("#interact-switch .action-label")?.textContent || "");
  // The "next" tab may shorten a very long name; every other button must show all its words.
  const cut = clipped.filter((text) => text !== tab);
  if (cut.length) problems.push(`action buttons cut off: ${cut.join(" | ")}`);
  else console.log("ok  no action button is cut off");

  // The safety net records an unexpected error and keeps the game going.
  await page.evaluate(() => setTimeout(() => { throw new Error("smoke-test deliberate error"); }));
  await page.waitForTimeout(300);
  const report = await page.evaluate(() => safetyProblemReport());
  if (!report.includes("smoke-test deliberate error")) problems.push("safety net did not record an error");
  else console.log("ok  safety net recorded a test error");
  const relevant = problems.filter((p) => !p.includes("smoke-test deliberate error"));

  await browser.close();
  server.close();
  if (relevant.length) {
    console.log(`\n${relevant.length} problem(s):`);
    for (const p of [...new Set(relevant)].slice(0, 30)) console.log(`  ${p}`);
    process.exitCode = 1;
  } else console.log("\nNo problems.");
})();
