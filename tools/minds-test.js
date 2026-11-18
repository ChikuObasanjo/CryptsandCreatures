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
// Creatures grow with the floor (systems/growth.js): the scenes meet them as a delver of the
// floor's own level would.
quiet(`(() => { state.run.level = Math.round(floorVigor(8)); state.run.maxHp = 18 + 4 * (state.run.level - 1); state.run.hp = state.run.maxHp; })()`);

const args = process.argv.slice(2);
const hush = args.includes("--quiet");
const only = args.find((arg) => !arg.startsWith("--")) || "";
const print = (...lines) => { if (!hush) console.log(...lines); };
const debug = Boolean(process.env.MINDS_DEBUG);
let failures = 0;

// One creature of `id`, `gap` squares from you in open floor, with the given state.
// `expect.has` must match what it did over the turns, `expect.not` must not ("gone" = it
// went on, the way the dead do).
// Scenes are written in the tomb's planned squares; on the fine grid (systems/grid.js) a
// gap of more than one is MAP_SCALE times as many tiles. One square away is still beside you.
let MAP_SCALE_IN_GAME = null;
const scene = (label, id, { gap: planGap = 3, sat = 70, hp = 1, provoke = false, mind = null, turns = 3, before = "", gold = 10, food = true, guardian = false, post = null, hour = 9, expect = {} } = {}) => {
  MAP_SCALE_IN_GAME ??= run("MAP_SCALE");
  const gap = planGap <= 1 ? planGap : planGap * MAP_SCALE_IN_GAME;
  const width = Math.max(7, gap + 2);
  if (only && !label.includes(only)) return;
  const out = run(`(() => {
    state.run.enemies = state.run.enemies.filter((e) => e.guardian);
    // Every scene is set at the same hour (nine in the morning unless it says otherwise) on
    // a day with no leaning of its own, so the time of day doesn't decide it by accident.
    state.run.gameMinutes = 40 * 1440 + ${hour} * 60;
    if (state.run.ecology) { state.run.ecology.air = {}; state.run.ecology.features = state.run.ecology.features.filter((f) => f.kind !== "carcass");
      // (The biggest clear room is often a shrine now. Empty its bowl, so the dead in a scene
      // are as hungry as the scene says.)
      for (const f of state.run.ecology.features) if (f.kind === "offering") f.amount = 0; }
    state.run.lurkers = []; state.run.hp = state.run.maxHp; state.run.lost = false;
    state.run.tomb = null; state.run.unsecuredLoot = { gold: 0, items: [] };
    // A clear row in a big room: eight open squares in a line, nothing between you and the
    // creature, and room for a second creature beside it.
    const open = (x, y, index) => state.run.terrain[tileIndex(x, y)] === "floor" && roomIndexAt(x, y) === index;
    let room = null, x0 = 0, y = 0;
    search: for (const r of state.run.rooms.filter((r) => r.mapW >= 7 && !r.planned).sort((a, b) => b.mapW * b.mapH - a.mapW * a.mapH)) {
      const index = state.run.rooms.indexOf(r);
      for (let row = r.mapY; row < r.mapY + r.mapH; row += 1) for (let col = r.mapX; col + ${width - 1} < r.mapX + r.mapW; col += 1) {
        if ([...Array(${width}).keys()].every((dx) => open(col + dx, row, index) && hasLineOfSight({ x: col, y: row }, { x: col + dx, y: row })) &&
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
    mindFor(creature).sign = -1;
    state.run.gold = ${gold};
    if (!${food}) state.run.inventory = state.run.inventory.filter((entry) => !FOOD_ITEMS[entry.id]);
    if (${guardian}) creature.guardian = true;
    creature.post = ${post === null ? "{ x: spot.x, y: spot.y }" : `{ x: spot.x + ${post * MAP_SCALE_IN_GAME}, y: spot.y }`};
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

print("\n-- its own kind (the Holding) --");
const flock = (id, n, extra = "") => `for (let k = 0; k < ${n}; k += 1) { const mate = ecoNewCreature("${id}", { x: spot.x + 1 + (k % 2), y: spot.y + (k < 2 ? 0 : 1) }, roomIndex); mate.eco.sat = 70; mindFor(mate).sign = -1; state.run.enemies.push(mate); ${extra} }`;
scene("cave turkey, you hurt its one flockmate", "cave-turkey", { gap: 3, mind: { calm: 6, met: 6 },
  before: flock("cave-turkey", 1, "provokeCreature(mate); mate.hp = 2;"), turns: 2, expect: { has: /flee/, not: /fight/ } });
scene("giant turkey in a flock of five, you hurt one", "giant-turkey", { gap: 3, mind: { calm: 6, met: 6 },
  before: flock("giant-turkey", 4, "if (k === 0) { provokeCreature(mate); mate.hp = Math.ceil(mate.maxHp / 2); }"), turns: 2, expect: { has: /fight/ } });
scene("giant turkey in the same flock, nobody hurt", "giant-turkey", { gap: 3, mind: { calm: 6, met: 6 },
  before: flock("giant-turkey", 4), turns: 2, expect: { not: /fight|flee/ } });
scene("jaguar feeding at its kill, you come close", "jungle-jaguar", { sat: 80, gap: 2,
  before: "mindFor(creature); creature.mind.home = creature.eco.home; creature.mind.since = (ecoState().ticks || 0) - 10; ecoAddFeature('carcass', { x: spot.x + 1, y: spot.y }, roomIndex, { species: 'cave-turkey', meat: 3, tonalli: 2, age: 0, fresh: true, maxMeat: 4 }); creature.eco.feeding = 6;",
  turns: 1, expect: { has: /watch|fight/ } });

print("\n-- the country's own (data/xalisco.js) --");
scene("opossum, you walk up to it", "tlacuatzin", { gap: 2, turns: 2, expect: { has: /feign/, not: /fight/ } });
scene("opossum, you keep your distance", "tlacuatzin", { gap: 6, turns: 2, expect: { not: /feign|fight/ } });
scene("lone coyote, fed, you come close", "coyotl", { gap: 2, hour: 19, turns: 2, expect: { not: /fight/ } });
scene("coyote in a pack of four, you hurt one", "coyotl", { gap: 3, hour: 19, mind: { calm: 6, met: 6 },
  before: flock("coyotl", 3, "if (k === 0) { provokeCreature(mate); mate.hp = Math.ceil(mate.maxHp / 2); }"), turns: 2, expect: { has: /fight/ } });
scene("ash bundle, hungry, at noon, you pass at 6", "tlacanexquimilli", { sat: 40, gap: 6, hour: 12, turns: 2, expect: { not: /fight/ } });
scene("ash bundle, hungry, at midnight, you pass at 4", "tlacanexquimilli", { sat: 40, gap: 4, hour: 0, turns: 2, expect: { has: /fight/ } });

print("\n-- the hours (olin) --");
scene("cave turkey, roosting at midnight, you pass at 6", "cave-turkey", { gap: 6, hour: 0, turns: 2, expect: { not: /flee|fight|watch/ } });
scene("cave turkey, at noon, you pass at 6", "cave-turkey", { gap: 6, hour: 12, turns: 2, expect: { has: /flee|watch/ } });
scene("Night Axe, hungry, at noon, you pass at 6", "yohualtepoztli", { sat: 40, gap: 6, hour: 12, turns: 2, expect: { not: /fight/ } });
scene("Night Axe, hungry, at midnight, you pass at 6", "yohualtepoztli", { sat: 40, gap: 6, hour: 0, turns: 2, expect: { has: /fight/ } });

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
print("\n-- the body (systems/soma.js) --");
const body = (fields) => `Object.assign(somaFor(creature), ${JSON.stringify(fields)});`;
scene("jaguar, starving but spent from a chase, you keep away", "jungle-jaguar", { sat: 5, gap: 4,
  before: body({ fatigue: 0.95, heart: 0.6 }), expect: { has: /watch/, not: /fight/ } });
scene("jaguar, starving, rested", "jungle-jaguar", { sat: 5, gap: 4, expect: { has: /fight/ } });
scene("cave turkey, spent, you close in", "cave-turkey", { gap: 2, before: body({ fatigue: 0.95 }), expect: { has: /fight/, not: /flee/ } });
scene("cave turkey used to you, calm, you pass at 4", "cave-turkey", { gap: 4, mind: { calm: 6, met: 6 }, expect: { not: /flee/ } });
scene("cave turkey used to you, still jumpy from a fright", "cave-turkey", { gap: 4, mind: { calm: 6, met: 6 },
  before: body({ tension: 0.9, heart: 0.45 }), expect: { has: /flee/ } });
scene("cave turkey used to you, hurt, the wound stinging", "cave-turkey", { gap: 4, hp: 0.75, mind: { calm: 6, met: 6 },
  before: body({ pain: 1, heart: 0.1 }), expect: { has: /flee/ } });
scene("cave turkey used to you, hurt, an old wound", "cave-turkey", { gap: 4, hp: 0.75, mind: { calm: 6, met: 6 },
  before: body({ pain: 0.12, heart: 0.1 }), expect: { not: /flee/ } });

print("\n-- keepers --");
scene("Camazotz at the inner seal, you close", "camazotz", { gap: 2, guardian: true, expect: { has: /fight/ } });
scene("Camazotz, nearly dead, you close", "camazotz", { gap: 2, guardian: true, hp: 0.15, provoke: true, expect: { has: /fight/, not: /flee/ } });

// Sleep and what it does with the day (systems/sleep.js). Each check builds its creatures in
// a clear room far from you and returns { ok, note }.
const check = (label, code) => {
  if (only && !label.includes(only)) return;
  let r;
  try { r = JSON.parse(run(code)); } catch (error) { r = { ok: false, note: `ERR ${error.message.split("\n")[0]}` }; }
  if (!r.ok) failures += 1;
  (r.ok ? print : console.log)(`${r.ok ? "ok  " : "FAIL"} ${label.padEnd(62)} ${r.note || ""}`);
};
run(`var sleepScene = (id, count = 1, { hour = 9, sat = 80 } = {}) => {
  // (Nothing else on the floor: the scenes above leave their keepers behind, and a keeper hunts.)
  state.run.enemies = [];
  state.run.lurkers = [];
  state.run.gameMinutes = 40 * 1440 + hour * 60;
  state.run.lost = false; state.run.hp = state.run.maxHp;
  const eco = ensureEcology(); eco.minute = state.run.gameMinutes; eco.air = {};
  const rooms = state.run.rooms.map((room, index) => ({ room, index })).filter(({ room }) => room.mapW >= 6 && room.mapH >= 5 && !room.planned && room.env?.water !== "basin");
  const centre = (room) => ({ x: room.anchorX ?? room.mapX, y: room.anchorY ?? room.mapY });
  rooms.sort((a, b) => distanceInSquares(centre(b.room), state.run.player) - distanceInSquares(centre(a.room), state.run.player));
  const home = rooms[0];
  const taken = ecoOccupiedTiles();
  const creatures = [];
  for (let k = 0; k < count; k += 1) {
    const spot = ecoFreeTile(home.room, taken);
    taken.add(tileIndex(spot.x, spot.y));
    const creature = ecoNewCreature(id, spot, home.index);
    creature.eco.sat = sat; creature.asleep = 0; mindFor(creature).sign = -1;
    state.run.enemies.push(creature); creatures.push(creature);
  }
  return { creatures, roomIndex: home.index };
}; var sleepAdvance = (turns) => { for (let i = 0; i < turns; i += 1) { state.run.steps += 1; state.run.gameMinutes += 10; enemiesTakeTurn(); ecologyAdvance(); } };`);

print("\n-- sleep and dreams (systems/sleep.js) --");
check("a day grazer sleeps the night through in its den, and is up by morning", `(() => {
  const { creatures: [turkey], roomIndex } = sleepScene("cave-turkey", 1, { hour: 17, sat: 95 });
  somaFor(turkey).pressure = 0.55;
  const seen = [];
  for (const hours of [6, 4, 7]) { sleepAdvance(hours * 6); seen.push((turkey.asleep && turkey.eco.sleeping ? "asleep" : "awake") + "@" + Math.floor((state.run.gameMinutes / 60) % 24)); }
  const ok = turkey.alive && seen[0].startsWith("asleep") && seen[1].startsWith("asleep") && seen[2].startsWith("awake") && turkey.mind.bed?.r === roomIndex;
  return JSON.stringify({ ok, note: seen.join(" ") + " bed in its den: " + (turkey.mind.bed?.r === roomIndex) });
})()`);
check("a flock beds down together", `(() => {
  const { creatures } = sleepScene("cave-turkey", 4, { hour: 18, sat: 95 });
  for (const turkey of creatures) somaFor(turkey).pressure = 0.6;
  sleepAdvance(8 * 6);
  const beds = creatures.filter((c) => c.alive && c.mind.bed).map((c) => c.mind.bed);
  let spread = 0;
  for (const a of beds) for (const b of beds) spread = Math.max(spread, distanceInSquares(a, b));
  const huddled = creatures.filter((c) => c.alive && (c.soma?.touch || 0) >= 0.5).length;
  return JSON.stringify({ ok: beds.length >= 3 && spread <= 6, note: beds.length + " beds, at most " + spread + " tiles apart; " + huddled + " pressed together" });
})()`);
check("a night's sleep: it still knows you hurt it, but the charge is off", `(() => {
  const { creatures: [turkey], roomIndex } = sleepScene("cave-turkey");
  somaFor(turkey).heart = 0.9;
  const mind = mindFor(turkey);
  mindHurt(mind, turkey);
  const before = { value: mind.value, dread: mind.dread, known: mind.known };
  sleepDream(turkey, ecoSpecies(turkey), 1);
  const ok = mind.value === before.value && mind.dread < before.dread * 0.6 && mind.known > before.known &&
    memoryReady(turkey, "you") >= 0.3 && (mind.places[roomIndex] || 0) < 0 && mind.day.length === 0;
  return JSON.stringify({ ok, note: "dread " + before.dread + " -> " + mind.dread + ", ready for you " + memoryReady(turkey, "you") + ", this chamber " + mind.places[roomIndex] });
})()`);
check("what it went over it keeps; the day's small things are let go", `(() => {
  const { creatures: [turkey], roomIndex } = sleepScene("cave-turkey");
  somaFor(turkey).heart = 0.1;
  for (let room = 0; room < 8; room += 1) memoryNote(turkey, "met", { valence: 0.15, about: "you", room, weight: 0.3 });
  somaFor(turkey).heart = 0.9;
  memoryNote(turkey, "hunted", { valence: -1, about: "jungle-jaguar", weight: 1 });
  sleepDream(turkey, ecoSpecies(turkey), 0.5);
  const places = Object.keys(turkey.mind.places);
  const ok = places.length <= 2 && turkey.mind.places[roomIndex] < 0 && memoryReady(turkey, "jungle-jaguar") > 0.2;
  return JSON.stringify({ ok, note: places.length + " chamber(s) kept; ready for the jaguar " + memoryReady(turkey, "jungle-jaguar") });
})()`);
check("kept awake, it is short-tempered", `(() => {
  const { creatures: [rested, sleepless] } = sleepScene("jungle-jaguar", 2);
  Object.assign(somaFor(rested), { pressure: 0.2, strain: 0 });
  Object.assign(somaFor(sleepless), { pressure: 0.98, strain: 0.6 });
  const anger = (c) => mindDrives(c, ecoSpecies(c), mindFor(c), 8).anger;
  const a = anger(rested), b = anger(sleepless);
  return JSON.stringify({ ok: b > a + 0.1, note: "anger rested " + a.toFixed(2) + ", sleepless " + b.toFixed(2) });
})()`);
check("woken in its bed by a blow, it won't lie down there again", `(() => {
  const { creatures: [turkey], roomIndex } = sleepScene("cave-turkey", 1, { hour: 1 });
  const mind = mindFor(turkey);
  mind.bed = { x: turkey.x, y: turkey.y, r: roomIndex };
  sleepBegin(turkey, ecoSpecies(turkey), { quiet: true });
  turkey.hp -= 2;
  sleepTick(turkey, ecoSpecies(turkey), 1);
  const ok = !turkey.asleep && !mind.bed && mind.badBed && mind.day.some((m) => m.k === "harm");
  return JSON.stringify({ ok, note: "awake " + !turkey.asleep + ", bed given up " + !mind.bed });
})()`);
check("a light sleeper you blunder into wakes with a start", `(() => {
  const { creatures: [turkey] } = sleepScene("cave-turkey", 1, { hour: 1 });
  sleepBegin(turkey, ecoSpecies(turkey), { quiet: true });
  turkey.mind.sleep.depth = 0.3;
  const spot = freeTileNear(turkey, ecoOccupiedTiles(), 1);
  state.run.player = { ...state.run.player, x: spot.x, y: spot.y };
  const random = Math.random; Math.random = () => 0.01;
  try { sleepStir(); } finally { Math.random = random; }
  const woke = !turkey.asleep;
  state.run.steps += 1; enemiesTakeTurn();
  return JSON.stringify({ ok: woke && ["flee", "fight"].includes(turkey.mind.intent), note: "woke " + woke + ", then " + turkey.mind.intent });
})()`);
check("hungry, with nothing in reach, it goes where it remembers eating", `(() => {
  const { creatures: [turkey], roomIndex } = sleepScene("cave-turkey");
  const other = state.run.rooms.findIndex((room, index) => index !== roomIndex && room.mapW >= 4);
  turkey.mind.food = { [other]: 0.8, [roomIndex]: 0.5 };
  const spot = memoryForage(turkey);
  const ok = spot && roomIndexAt(spot.x, spot.y) === other && (turkey.mind.food[roomIndex] || 0) < 0.5;
  return JSON.stringify({ ok, note: "heads for chamber " + (spot ? roomIndexAt(spot.x, spot.y) : "none") + "; finding nothing here, it now expects " + (turkey.mind.food[roomIndex] || 0) + " here" });
})()`);
check("the dead don't sleep, and nothing settles overnight", `(() => {
  const { creatures: [dead] } = sleepScene("mictlaneca", 1, { hour: 9 });
  const mind = mindFor(dead);
  mindHurt(mind, dead);
  const dread = mind.dread;
  sleepAdvance(24 * 6);
  const ok = dead.alive && mind.dread === dread && !mind.sleep && !dead.soma;
  return JSON.stringify({ ok, note: "dread " + dread + " after a day: " + mind.dread });
})()`);

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
