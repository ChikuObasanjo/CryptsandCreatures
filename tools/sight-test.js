// Checks the sight rules (systems/sight.js) on real floors:
//   - sight lines are the same both ways,
//   - moving never adds squares behind a wall to your map,
//   - creatures out of view don't show on the map or in the nearby row,
//   - you're not told what a creature did out of sight (a trap it walked into),
//   - creatures notice you through walls only when you're close enough to be heard.
// Usage: node tools/sight-test.js
const { load } = require("./headless");
const { run } = load();
const quiet = (code) => { try { return run(code); } catch (e) { if (!/setProperty|Node|style|dialog|close|showModal|classList/.test(e.message)) console.log("ERR", e.message); } };
quiet("newRun(makeLegacyCharacter())");
quiet("beginNewDelve()");
let failures = 0;
const check = (label, ok, detail = "") => { console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `  (${detail})` : ""}`); if (!ok) failures += 1; };

for (const floor of [3, 7, 11]) {
  quiet(`travelToFloor(${floor}, "connection-${floor - 1}-1"); state.run.location = "dungeon";`);
  const r = JSON.parse(run(`(() => {
    const size = MAP_TILE_SIZE, open = (i) => ["floor", "corridor"].includes(state.run.terrain[i]);
    const tiles = [...state.run.terrain.keys()].filter(open).map((i) => ({ x: i % size, y: Math.floor(i / size) }));
    const pick = () => tiles[Math.floor(Math.random() * tiles.length)];
    // 1. symmetry
    let asym = 0;
    for (let k = 0; k < 3000; k += 1) { const a = pick(), b = pick(); if (distanceInSquares(a, b) > 9) continue; if (hasLineOfSight(a, b) !== hasLineOfSight(b, a)) asym += 1; }
    // 2. reveal: walk around; every square newly added to the map must have been in sight.
    let leaked = 0;
    for (let k = 0; k < 40; k += 1) {
      state.run.player = { ...state.run.player, ...pick() };
      const before = state.run.seen.slice();
      revealAroundPlayer();
      state.run.seen.forEach((s, i) => { if (s && !before[i] && !hasLineOfSight(state.run.player, { x: i % size, y: Math.floor(i / size) })) leaked += 1; });
    }
    // 3 + 4 + 5: a creature close by but behind a wall.
    let hidden = null;
    for (let k = 0; k < 4000 && !hidden; k += 1) {
      const p = pick(), c = pick(), d = distanceInSquares(p, c);
      if (d >= 3 && d <= 5 && !hasLineOfSight(p, c) && !tileHasCreature(c.x, c.y)) hidden = { p, c };
    }
    if (!hidden) return JSON.stringify({ asym, leaked, skipped: true });
    state.run.player = { ...state.run.player, ...hidden.p };
    const room = Math.max(0, roomIndexAt(hidden.c.x, hidden.c.y));
    const creature = ecoNewCreature("cave-turkey", hidden.c, room);
    state.run.enemies.push(creature);
    const inRow = nearbyCreatures().includes(creature);
    const log0 = state.run.log.length;
    state.run.hazards.push({ id: "test-trap", name: "test trap", x: hidden.c.x, y: hidden.c.y, dc: 99, damage: "1d4", triggered: false, revealed: false });
    state.run.hazards = state.run.hazards.filter((h) => h.id !== "test-trap");
    // Walk it onto a trap out of sight: no details may reach the log.
    const nextTo = [[1,0],[-1,0],[0,1],[0,-1]].map(([dx, dy]) => ({ x: hidden.c.x + dx, y: hidden.c.y + dy })).find((s) => isWalkable(s.x, s.y) && !tileHasCreature(s.x, s.y) && !(s.x === state.run.player.x && s.y === state.run.player.y));
    let leakedLog = [];
    if (nextTo && !playerSees(nextTo)) {
      state.run.hazards.push({ id: "test-trap", name: "test trap", x: nextTo.x, y: nextTo.y, dc: 99, damage: "1d4", triggered: false, revealed: false });
      moveCreature(creature, nextTo);
      leakedLog = state.run.log.slice(0, state.run.log.length - log0).filter((line) => /test trap/.test(line));
    }
    const notices = creatureSensesPlayer(creature, 7);
    return JSON.stringify({ asym, leaked, inRow, sees: playerSees(creature), trapTested: Boolean(nextTo && !playerSees(nextTo)), leakedLog, notices, distance: distanceInSquares(creature, state.run.player), hearing: creatureHearingRange() });
  })()`));
  check(`floor ${floor}: sight lines are the same both ways`, r.asym === 0, `${r.asym} one-way lines`);
  check(`floor ${floor}: nothing added to the map through walls`, r.leaked === 0, `${r.leaked} squares`);
  if (r.skipped) continue;
  check(`floor ${floor}: a creature behind a wall isn't in view or in the nearby row`, !r.sees && !r.inRow);
  if (r.trapTested) check(`floor ${floor}: its trap out of sight isn't described`, r.leakedLog.length === 0, r.leakedLog.join(" / "));
  check(`floor ${floor}: it senses you through the wall only within hearing (${r.distance} squares away, hearing ${r.hearing})`, r.notices === (r.distance <= r.hearing));
}
if (failures) process.exitCode = 1;
