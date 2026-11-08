// Puts creatures near you in set situations, prints what their minds decide, and checks it
// against what they should do. Part of npm run check.
// Usage: node tools/minds-test.js [part of a scene's name] [--quiet]   (MINDS_DEBUG=1 prints drives)
//   --quiet prints only what went wrong (npm run check uses it).
const { load } = require("./headless");
const { run } = load();
const quiet = (code) => { try { return run(code); } catch (e) { if (!/setProperty|Node|style|dialog|close|showModal/.test(e.message)) console.log("ERR", e.message); } };
quiet("newRun(makeLegacyCharacter())");
quiet("beginNewDelve()");
quiet(`(() => { travelToFloor(8, "connection-7-1"); state.run.location = "dungeon"; })()`);

const args = process.argv.slice(2);
const hush = args.includes("--quiet");
const only = args.find((arg) => !arg.startsWith("--")) || "";
const print = (...lines) => { if (!hush) console.log(...lines); };
const debug = Boolean(process.env.MINDS_DEBUG);
let failures = 0;

// One creature of `id`, `gap` squares from you in open floor, with the given state.
// `expect.has` must match what it did over the turns, `expect.not` must not ("gone" = it
// went on, the way the dead do).
const scene = (label, id, { gap = 3, sat = 70, hp = 1, provoke = false, mind = null, turns = 3, before = "", gold = 10, food = true, guardian = false, post = null, expect = {} } = {}) => {
  if (only && !label.includes(only)) return;
  const out = run(`(() => {
    state.run.enemies = state.run.enemies.filter((e) => e.guardian);
    state.run.lurkers = []; state.run.hp = state.run.maxHp; state.run.lost = false;
    state.run.tomb = null; state.run.unsecuredLoot = { gold: 0, items: [] };
    // A clear row in a big room: eight open squares in a line, nothing between you and the
    // creature, and room for a second creature beside it.
    const open = (x, y, index) => state.run.terrain[tileIndex(x, y)] === "floor" && roomIndexAt(x, y) === index;
    let room = null, x0 = 0, y = 0;
    search: for (const r of state.run.rooms.filter((r) => r.mapW >= 7 && !r.planned).sort((a, b) => b.mapW * b.mapH - a.mapW * a.mapH)) {
      const index = state.run.rooms.indexOf(r);
      for (let row = r.mapY; row < r.mapY + r.mapH; row += 1) for (let col = r.mapX; col + 6 < r.mapX + r.mapW; col += 1) {
        if ([...Array(7).keys()].every((dx) => open(col + dx, row, index) && hasLineOfSight({ x: col, y: row }, { x: col + dx, y: row })) &&
          open(col + 4, row + 1, index)) { room = r; x0 = col; y = row; break search; }
      }
    }
    if (!room) throw new Error("no clear room on this floor");
    const roomIndex = state.run.rooms.indexOf(room);
    state.run.player = { ...state.run.player, x: x0, y };
    const spot = { x: x0 + ${gap}, y };
    const creature = ecoNewCreature("${id}", spot, roomIndex);
    creature.eco.sat = ${sat};
    creature.asleep = false;
    creature.hp = Math.max(1, Math.round(creature.maxHp * ${hp}));
    ${mind ? `creature.mind = Object.assign({ harmed: 0, witnessed: 0, fed: 0, met: 0, calm: 0, focus: null, intent: null, step: -1, seen: false, lastHp: creature.hp, said: null }, ${JSON.stringify(mind)});` : ""}
    state.run.gold = ${gold};
    if (!${food}) state.run.inventory = state.run.inventory.filter((entry) => !FOOD_ITEMS[entry.id]);
    if (${guardian}) creature.guardian = true;
    creature.post = ${post === null ? "{ x: spot.x, y: spot.y }" : `{ x: spot.x + ${post}, y: spot.y }`};
    state.run.enemies.push(creature);
    ${provoke ? "provokeCreature(creature);" : ""}
    ${before}
    const log0 = state.run.log.length;
    const seen = [];
    const probes = [];
    for (let i = 0; i < ${turns}; i += 1) {
      state.run.steps += 1;
      if (${debug} && creature.alive) {
        const d = distanceInSquares(creature, state.run.player), m = mindFor(creature), drives = mindDrives(creature, ecoSpecies(creature), m, d);
        const tokens = mindAttend(drives, mindSenses(creature, ecoSpecies(creature), drives));
        probes.push("d=" + d + " " + MIND_DRIVES.map((k) => k + "=" + drives[k].toFixed(2)).join(" ") + " | " + tokens.map((t) => t.id + ":" + t.score.toFixed(2)).join(" "));
      }
      enemiesTakeTurn();
      seen.push(!creature.alive && creature.wentOn ? "gone" : creature.mind ? creature.mind.intent + "@" + creature.mind.attention : "-");
      if (!creature.alive) break;
    }
    const said = state.run.log.slice(0, Math.max(0, state.run.log.length - log0)).filter((l) => /watches|bolts|shies|made up|starving|interest|attack|hits|misses|runs|hunger|comes|forgotten|post|place|plants|keeping|enough|theft|pack|carrying|slips|rises|fed|warmth|face|draws|snatches|grabs|ground|closer|road|west|parents/.test(l)).slice(0, 2);
    return JSON.stringify({ intents: seen.join(" "), threat: creatureIsThreat(creature), manner: creature.alive ? mindDescription(creature) : "", said, probes });
  })()`);
  const r = JSON.parse(out);
  const ok = (!expect.has || expect.has.test(r.intents)) && (!expect.not || !expect.not.test(r.intents));
  if (!ok) failures += 1;
  (ok ? print : console.log)(`${ok ? "ok  " : "FAIL"} ${label.padEnd(52)} ${r.intents.padEnd(34)} threat=${r.threat}`);
  if (r.manner) print(`${"".padEnd(57)} "${r.manner}"`);
  if (r.said.length) print(`${"".padEnd(57)} log: ${r.said.join(" / ")}`);
  for (const line of r.probes) print(`${"".padEnd(8)}${line}`);
};

const not = (word) => new RegExp(word);

print("-- animals --");
scene("jaguar, fed, first meeting", "jungle-jaguar", { sat: 75, expect: { has: /watch/, not: /fight|flee/ } });
scene("jaguar, starving", "jungle-jaguar", { sat: 5, expect: { has: /fight/ } });
scene("jaguar, badly hurt, attacked by you", "jungle-jaguar", { sat: 60, hp: 0.25, provoke: true, expect: { has: /flee/ } });
scene("jaguar, you killed its kind before", "jungle-jaguar", { sat: 75, mind: { witnessed: 3, met: 2 }, expect: { has: /fight/ } });
scene("ocelot, hungry (you're too big to eat)", "tlacoocelotl", { sat: 40, expect: { not: not("fight") } });
scene("cave turkey, first meeting, close", "cave-turkey", { gap: 2, expect: { has: /flee/ } });
scene("cave turkey, used to you (6 calm meetings)", "cave-turkey", { gap: 3, mind: { calm: 6, met: 6 }, expect: { not: /flee|fight/ } });
scene("cave turkey, you fed it twice", "cave-turkey", { gap: 3, mind: { fed: 2, met: 3 }, expect: { has: /follow/ } });
scene("tomb rabbit, herd crowded and bold", "dungeonrabbit", { gap: 2, before: "creature.eco.crowded = true;", expect: { has: /fight/ } });
scene("mapachin, fed, a little way off", "mapachin", { gap: 5, expect: { not: not("fight") } });

print("\n-- what it holds as its own --");
scene("jaguar, fed, long in its den, you walk right up", "jungle-jaguar", { sat: 75, gap: 2, expect: { has: /fight/ } });
scene("jaguar, fed, moved into this den today, same", "jungle-jaguar", { sat: 75, gap: 2,
  before: "mindFor(creature); creature.mind.home = creature.eco.home; creature.mind.since = (ecoState().ticks || 0) - 40;",
  expect: { not: not("fight") } });

print("\n-- what it has learned --");
scene("cave turkey born to a hen you fed", "cave-turkey", { gap: 3,
  before: "const hen = ecoNewCreature('cave-turkey', { x: spot.x + 2, y: spot.y }, roomIndex); hen.mind = { harmed: 0, witnessed: 0, fed: 3, met: 5, calm: 2, value: 0.85, known: 0.8, stress: 0 }; mindInherit(creature, hen);",
  expect: { has: /follow/ } });
scene("cave turkey used to you; its flockmate remembers you", "cave-turkey", { gap: 3, mind: { calm: 6, met: 6 },
  before: "const mate = ecoNewCreature('cave-turkey', { x: spot.x + 1, y: spot.y }, roomIndex); mate.mind = { harmed: 3, witnessed: 1, fed: 0, met: 4, calm: 0, focus: null, intent: null, step: -1, seen: false, lastHp: mate.hp, said: null }; state.run.enemies.push(mate);",
  turns: 4, expect: { has: /flee|watch/ } });

print("\n-- the restless dead --");
scene("Mictecatl, hungry, you pass close", "mictlaneca", { sat: 20, gap: 3, expect: { has: /fight/ } });
scene("Mictecatl, fed, you pass at 3 squares", "mictlaneca", { sat: 95, gap: 3, expect: { not: /fight|flee/ } });
scene("Mictecatl, fed, you walk up to its post", "mictlaneca", { sat: 95, gap: 1, expect: { has: /watch/, not: not("fight") } });
scene("Mictecatl, fed, strayed 5 from post, you far", "mictlaneca", { sat: 95, gap: 6, post: 5, expect: { has: /return/ } });
scene("Night Axe, starving", "yohualtepoztli", { sat: 5, gap: 4, expect: { has: /fight/ } });
scene("Night Axe, given your offering", "yohualtepoztli", { sat: 100, gap: 3, mind: { fed: 1, met: 1 }, expect: { not: /fight/ } });
scene("Cihuateotl, fed, badly hurt by you", "cihuateotl", { sat: 95, gap: 2, hp: 0.25, provoke: true, expect: { has: /fight/ } });

print("\n-- going on --");
const offerings = (n) => `creature.eco.sat = 100; for (let i = 0; i < ${n}; i += 1) mindFedBy(creature, { offering: 6 });`;
scene("Mictecatl after one copal offering", "mictlaneca", { sat: 100, gap: 3, before: offerings(1), expect: { not: /gone|fight/ } });
scene("Mictecatl after two copal offerings", "mictlaneca", { sat: 100, gap: 3, before: offerings(2), expect: { has: /gone/ } });
scene("Cihuateotl after two copal offerings", "cihuateotl", { sat: 100, gap: 3, before: offerings(2), expect: { has: /gone/ } });
scene("Mictecatl after two copal, but you carry a fortune", "mictlaneca", { sat: 100, gap: 3,
  before: offerings(2) + " state.run.unsecuredLoot = { gold: 2500, items: [] };", expect: { not: /gone/ } });
scene("Night Axe after two copal (it doesn't go on)", "yohualtepoztli", { sat: 100, gap: 3, before: offerings(2), expect: { not: /gone|fight/ } });

print("\n-- the tomb's mood in the dead --");
scene("Night Axe, fed, the tomb still", "yohualtepoztli", { sat: 80, gap: 4, expect: { not: /fight/ } });
scene("Night Axe, fed, the tomb hungry (you carry 600 gp)", "yohualtepoztli", { sat: 80, gap: 4,
  before: "state.run.unsecuredLoot = { gold: 600, items: [] };", expect: { has: /fight/ } });
scene("Night Axe, just given an offering, the tomb hungry", "yohualtepoztli", { sat: 100, gap: 4,
  before: "state.run.unsecuredLoot = { gold: 600, items: [] };", expect: { not: /fight/ } });
scene("Night Axe, just given an offering, the tomb ravenous", "yohualtepoztli", { sat: 100, gap: 4,
  before: "state.run.unsecuredLoot = { gold: 1500, items: [] };", expect: { has: /fight/ } });
scene("Night Axe, hungry, the tomb at rest", "yohualtepoztli", { sat: 40, gap: 4,
  before: "tombBody().given = 400;", expect: { not: /fight/ } });

print("\n-- wardens --");
scene("Chaneque, you near its charge", "chaneque", { gap: 2, expect: { has: /watch/, not: not("fight") } });
scene("Chaneque, you pass at a distance", "chaneque", { gap: 5, post: 6, expect: { not: /fight/ } });
scene("Alux, robbed (offended)", "alux", { gap: 3, before: "creature.eco.offended = true;", expect: { has: /fight/ } });
print("\n-- raiders --");
scene("Duende, hungry, your pouch is full", "duende", { sat: 30, gap: 3, gold: 90, expect: { has: /fight/ } });
scene("Duende, fed, empty pouch and pack", "duende", { sat: 95, gap: 3, gold: 0, food: false, expect: { not: /fight/ } });
scene("Duende, badly hurt", "duende", { sat: 30, gap: 2, gold: 90, hp: 0.2, provoke: true, expect: { has: /flee/ } });
scene("Sea giant, hungry, you carry food", "caxtiltecatl", { sat: 30, gap: 3, expect: { has: /fight/ } });
print("\n-- keepers --");
scene("Camazotz at the inner seal, you close", "camazotz", { gap: 2, guardian: true, expect: { has: /fight/ } });
scene("Camazotz, nearly dead, you close", "camazotz", { gap: 2, guardian: true, hp: 0.15, provoke: true, expect: { has: /fight/, not: /flee/ } });

// The tomb's mood as you take and give (systems/tomb-body.js).
if (!only || "tomb".includes(only)) {
  print("\n-- the tomb --");
  const moods = JSON.parse(run(`(() => {
    state.run.tomb = null; state.run.unsecuredLoot = { gold: 0, items: [] };
    const out = [];
    const note = (what) => out.push(what.padEnd(44) + tombMood().id.padEnd(10) + " hunger " + tombHunger().toFixed(2) + "  rest " + tombRest().toFixed(2));
    note("you come in empty-handed");
    for (const gold of [100, 400, 800, 1600]) { state.run.unsecuredLoot.gold = gold; state.run.steps += 1; note("you carry " + gold + " gp"); }
    tombGive("offeringPerPoint", 6); tombGive("offeringPerPoint", 6); note("...and leave two copal offerings");
    tombReceivesFallen(); state.run.unsecuredLoot = { gold: 0, items: [] }; state.run.steps += 1; note("...and you fall (the loot goes back)");
    state.run.gameMinutes += 48 * 60; note("two days later");
    state.run.unsecuredLoot = { gold: 800, items: [] }; state.run.steps += 1; tombRemembersLoot(); state.run.unsecuredLoot = { gold: 0, items: [] }; state.run.steps += 1;
    note("you carried 800 gp home");
    state.run.gameMinutes += 8 * 60; note("after a night's sleep");
    return JSON.stringify(out);
  })()`));
  for (const line of moods) print(`     ${line}`);
  const order = JSON.parse(run(`JSON.stringify((() => {
    state.run.tomb = null; const ids = [];
    for (const gold of [0, 100, 400, 800, 1600]) { state.run.unsecuredLoot = { gold, items: [] }; state.run.steps += 1; ids.push(tombMood().id); }
    state.run.unsecuredLoot = { gold: 0, items: [] }; state.run.steps += 1; tombGive("fallen"); ids.push(tombMood().id);
    return ids;
  })())`));
  const ladder = ["still", "stirring", "hungry", "ravenous"];
  const climbs = order.slice(0, 5).every((id, i, all) => i === 0 || ladder.indexOf(id) >= ladder.indexOf(all[i - 1]));
  const ok = climbs && order[0] === "still" && order[4] === "ravenous" && order[5] === "at-rest";
  if (!ok) failures += 1;
  (ok ? print : console.log)(`${ok ? "ok  " : "FAIL"} the tomb grows hungrier as you carry more, and rests when you fall   (${order.join(" → ")})`);
}

// Minds and the tomb travel with the save.
const saved = run(`(() => { const copy = JSON.parse(JSON.stringify(state.run)); const withMind = copy.enemies.filter((e) => e.mind).length;
  return withMind + " minds and the tomb: " + (parseSavedRun(copy, state.pack) && copy.tomb ? "loads" : "REJECTED"); })()`);
if (!/loads/.test(saved)) failures += 1;
(/loads/.test(saved) ? print : console.log)(`${/loads/.test(saved) ? "ok  " : "FAIL"} save with ${saved}`);
if (hush && !failures) console.log("Minds: every scene went as it should.");
if (failures) {
  console.log(`\n${failures} scene(s) didn't go as they should.`);
  process.exitCode = 1;
}
