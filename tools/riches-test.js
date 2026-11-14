// Checks the mouth's growth, the treasure that moves with the life, what creatures love, and
// the creatures' own powers (systems/growth.js, riches.js, cherish.js, wiles.js).
// Part of npm run check. Usage: node tools/riches-test.js [--quiet]
const { load } = require("./headless");
const { run } = load();
const hush = process.argv.includes("--quiet");
const quiet = (code) => { try { return run(code); } catch (e) { if (!/setProperty|Node|style|dialog|close|showModal|classList|offsetWidth/.test(e.message)) console.log("ERR", e.message); } };
let failures = 0;
const check = (ok, label) => {
  if (!ok) failures += 1;
  if (!ok || !hush) console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
};

quiet("newRun(makeLegacyCharacter())");
quiet("beginNewDelve()");

// 1. The mouth: life grows without limit toward it, and creatures grow with it.
const levels = JSON.parse(run(`JSON.stringify((() => {
  const fed = (floor) => { const data = floor === state.run.dungeonFloor ? state.run : state.run.dungeonFloors[String(floor)];
    return (data.enemies || []).filter((e) => e.alive !== false && Number.isInteger(e.level) && !e.guardian).map((e) => e.level); };
  return { shares: [1, 7, 12, 13].map((f) => mouthShare(f)), top: fed(1), bottom: fed(13),
    boss: (state.run.dungeonFloors["13"].enemies || []).find((e) => e.templateId === "tzitzimitl")?.level || 0 };
})())`));
check(levels.shares[0] < levels.shares[1] && levels.shares[2] - levels.shares[1] < levels.shares[3] - levels.shares[2],
  `the mouth's share rises faster the nearer the mouth (${levels.shares.map((s) => s.toFixed(2)).join(", ")})`);
check(levels.top.length > 0 && Math.max(...levels.top) <= 5 && Math.min(...levels.top) >= 1, `floor 1 creatures are levels 1–5 (${Math.min(...levels.top)}–${Math.max(...levels.top)})`);
const deepAverage = levels.bottom.reduce((a, b) => a + b, 0) / Math.max(1, levels.bottom.length);
check(levels.bottom.length >= 10 && deepAverage >= 16, `floor 13 holds a population near level 20 (${levels.bottom.length} creatures, average ${deepAverage.toFixed(1)})`);
check(levels.boss >= 22, `the tzitzimitl at the mouth is the strongest thing in the tomb (level ${levels.boss})`);

// 2. Treasure: the earth gives back more near the mouth.
const rise = JSON.parse(run(`JSON.stringify((() => {
  const count = (floor) => { loadDungeonFloorForWork(floor); const before = state.run.treasures.filter((c) => c.earth).length;
    for (let i = 0; i < 400; i += 1) richesEarthGives(ecoState(), floor, 1);
    const after = state.run.treasures.filter((c) => c.earth).length; saveDungeonFloorState(); return after - before; };
  return { top: count(2), bottom: count(12) };
})())`));
check(rise.bottom > rise.top * 2, `the ground gives up more near the mouth (400 hours: floor 2 ${rise.top}, floor 12 ${rise.bottom})`);

// A carrier picks up what lies loose and takes it home.
quiet(`(() => { travelToFloor(4, "connection-3-1"); state.run.location = "dungeon"; })()`);
const carried = JSON.parse(run(`JSON.stringify((() => {
  state.run.enemies = state.run.enemies.filter((e) => e.guardian);
  const room = state.run.rooms.find((r, i) => i > 0 && r.mapW >= 8 && r.mapH >= 6 && !r.mainTreasure);
  const index = state.run.rooms.indexOf(room);
  const spot = ecoFreeTile(room, ecoOccupiedTiles());
  const mapachin = ecoNewCreature("mapachin", spot, index);
  mapachin.eco.sat = 90; mapachin.eco.home = index;
  state.run.enemies.push(mapachin);
  const near = freeTileNear(spot, ecoOccupiedTiles(), 2);
  state.run.treasures.push({ id: "test-jade", x: near.x, y: near.y, gold: 0, items: [{ id: "jade-bead", quantity: 1 }], earth: true, since: 0 });
  const far = state.run.rooms.find((r, i) => i !== index && i > 0 && Math.abs(r.anchorX - room.anchorX) + Math.abs(r.anchorY - room.anchorY) > 40);
  state.run.player = { ...state.run.player, x: far.anchorX, y: far.anchorY };
  let picked = false;
  for (let i = 0; i < 40 && mapachin.alive; i += 1) { richesIdle(mapachin, ecoSpecies(mapachin), mapachin.eco, {}); if (mapachin.carrying) picked = true; }
  const hoard = state.run.treasures.find((c) => c.hoard && c.owner === mapachin.id);
  return { picked, gone: !state.run.treasures.some((c) => c.id === "test-jade"), hoard: Boolean(hoard && hoard.items.some((i) => i.id === "jade-bead")) };
})())`));
check(carried.picked && carried.gone, "a mapachin picks up a jade bead lying loose");
check(carried.hoard, "and puts it in its hoard at its den");

// Taking a shrine's offerings: unfed, the dead and the tomb remember; with the bowl full, it's an exchange.
const shrine = JSON.parse(run(`JSON.stringify((() => {
  const eco = ecoState();
  let bowl = eco.features.find((f) => f.kind === "offering");
  if (!bowl) { const room = state.run.rooms[2]; const spot = ecoFreeTile(room, ecoOccupiedTiles()); bowl = ecoAddFeature("offering", spot, 2, {}); bowl = eco.features[eco.features.length - 1]; }
  const cache = { id: "shrine-test", x: bowl.x, y: bowl.y, gold: 20, items: [{ id: "jade-frog", quantity: 1 }], shrine: bowl.id };
  state.run.player = { ...state.run.player, x: bowl.x, y: bowl.y };
  const spot = freeTileNear(bowl, ecoOccupiedTiles(), 3);
  const dead = ecoNewCreature("mictlaneca", spot, bowl.room);
  state.run.enemies.push(dead);
  state.run.tomb = null;
  bowl.amount = 0;
  const owed0 = tombBody().owed;
  richesTaken(cache);
  const unfed = { owed: tombBody().owed - owed0, angry: Boolean(dead.provoked) };
  dead.provoked = false; dead.mind = null;
  bowl.amount = 5;
  const owed1 = tombBody().owed;
  richesTaken({ ...cache, id: "shrine-test-2" });
  return { unfed, fed: { owed: tombBody().owed - owed1, angry: Boolean(dead.provoked) } };
})())`));
check(shrine.unfed.owed > 0 && shrine.unfed.angry, `taking a shrine's offerings angers the dead and the tomb (owed +${shrine.unfed.owed.toFixed(0)})`);
check(shrine.fed.owed === 0 && !shrine.fed.angry, "with the bowl full, taking them is an exchange");

// 3. What creatures love: a gift makes a friend; a theft a grudge.
const love = JSON.parse(run(`JSON.stringify((() => {
  state.run.enemies = state.run.enemies.filter((e) => e.guardian);
  const p = state.run.player;
  const spot = MOVEMENT_DIRECTIONS.map((d) => ({ x: p.x + d.x, y: p.y + d.y })).find((s) => isWalkable(s.x, s.y) && !tileHasCreature(s.x, s.y));
  const duende = ecoNewCreature("duende", spot, roomIndexAt(spot.x, spot.y));
  state.run.enemies.push(duende);
  const loves = cherishLoves(duende);
  const thing = window.CryptsRiches.kinds[loves].find((id) => itemDetails(id));
  addInventoryItem(thing);
  const longing = cherishLonging(duende);
  const offered = cherishGiftOptions().some((o) => o.enemy === duende && o.itemId === thing);
  const before = mindFor(duende).value;
  cherishGive(duende, thing);
  const after = mindFor(duende).value;
  const kept = duende.keepsake === thing;
  mindRobbed(duende, { items: [{ id: thing, quantity: 1 }] });
  return { loves, longing, offered, before, after, kept, grudge: cherishGrudge(duende) };
})())`));
check(Boolean(love.loves) && love.longing > 0.3, `a duende loves ${love.loves}, and wants it when you carry it (${love.longing.toFixed(2)})`);
check(love.offered && love.after > love.before + 0.4 && love.kept, `a gift of it wins it over (${love.before.toFixed(2)} → ${love.after.toFixed(2)}) and it keeps the thing`);
check(love.grudge > 0.5, `robbing it leaves a grudge (${love.grudge.toFixed(2)})`);

// 4. The owl-man's trick: a sound where nothing is; go and look, and it laughs.
const owl = JSON.parse(run(`JSON.stringify((() => {
  state.run.enemies = state.run.enemies.filter((e) => e.guardian);
  state.run.wiles = null;
  const p = state.run.player;
  let spot = null;
  for (let r = 6; r < 30 && !spot; r += 1) for (const d of MOVEMENT_DIRECTIONS) { const s = { x: p.x + d.x * r, y: p.y + d.y * r }; if (isWalkable(s.x, s.y) && !playerSees(s)) { spot = s; break; } }
  const owl = ecoNewCreature("tlacatecolotl", spot, roomIndexAt(spot.x, spot.y));
  owl.mind = null;
  state.run.enemies.push(owl);
  const log0 = state.run.log.length;
  wilesMimic(owl, wilesState(), state.run.steps || 0);
  const decoy = state.run.wiles.decoy;
  const heard = state.run.log.slice(0, state.run.log.length - log0).some((line) => line.startsWith("You hear"));
  if (decoy) state.run.player = { ...state.run.player, x: decoy.x, y: decoy.y };
  wilesDecoyCheck(wilesState(), state.run.steps || 0);
  return { decoy: Boolean(decoy), heard, laughed: state.run.log[0].includes("laughs"), knows: Boolean(naturalist().tlacatecolotl?.facts?.includes("mimics")) };
})())`));
check(owl.decoy && owl.heard, "a tlacatecolotl makes a sound where nothing is");
check(owl.laughed && owl.knows, "going to look finds nothing, and you learn its trick");

// 5. The little guardians: stronger, warded against ordinary weapons, and with powers.
const guard = JSON.parse(run(`JSON.stringify((() => {
  const p = state.run.player;
  const spot = MOVEMENT_DIRECTIONS.map((d) => ({ x: p.x + d.x * 3, y: p.y + d.y * 3 })).find((s) => isWalkable(s.x, s.y) && !tileHasCreature(s.x, s.y) && hasLineOfSight(p, s)) ||
    MOVEMENT_DIRECTIONS.map((d) => ({ x: p.x + d.x, y: p.y + d.y })).find((s) => isWalkable(s.x, s.y) && !tileHasCreature(s.x, s.y));
  const chaneque = ecoNewCreature("chaneque", spot, roomIndexAt(spot.x, spot.y));
  const duende = ecoNewCreature("duende", spot, roomIndexAt(spot.x, spot.y));
  state.run.enemies.push(chaneque);
  const warded = applyStrike(chaneque, "edge", 20).damage;
  const sun = applyStrike(chaneque, "sun", 20).damage;
  progress().conditions = [];
  chaneque.spellAt = 0;
  for (let i = 0; i < 12 && !progress().conditions.some((c) => c.id === "susto"); i += 1) { chaneque.spellAt = 0; wilesChaneque(chaneque, distanceInSquares(chaneque, p)); }
  return { levels: [chaneque.level, duende.level], warded, sun, susto: progress().conditions.some((c) => c.id === "susto") };
})())`));
check(guard.levels[0] >= guard.levels[1] + 2, `a chaneque is stronger than a duende born beside it (level ${guard.levels[0]} vs ${guard.levels[1]})`);
check(guard.warded <= 10 && guard.sun >= 15, `ordinary weapons only half harm it (20 → ${guard.warded}); sun-fire bites (20 → ${guard.sun})`);
check(guard.susto, "it can frighten the soul out of you");

console.log(failures ? `\n${failures} check(s) failed.` : "Riches and wiles: every check passed.");
if (failures) process.exitCode = 1;
