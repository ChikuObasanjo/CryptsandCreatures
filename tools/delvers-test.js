// The other delvers and the Lord of the Mouth: weeks of the tomb's life with you in town,
// a delver's fight on your floor, the lord's fall and her vessels, and saving.
// Usage: node tools/delvers-test.js [--quiet]   (part of npm run check)
const { load } = require("./headless");
const { run } = load();
const hush = process.argv.includes("--quiet");
const print = (...lines) => { if (!hush) console.log(...lines); };
const quiet = (code) => { try { return run(code); } catch (e) { if (!/setProperty|Node|style|dialog|close|showModal/.test(e.message)) { console.log("ERR", e.message); process.exitCode = 1; } } };
let failures = 0;
const check = (ok, text) => { if (!ok) failures += 1; (ok ? print : console.log)(`${ok ? "ok  " : "FAIL"} ${text}`); };

quiet("newRun(makeLegacyCharacter())");

// 1. Ten weeks with you in town: who comes, how they do, who dies, who comes home.
const weeks = JSON.parse(run(`(() => {
  state.run.location = "city";
  delversSync();
  const start = state.run.gameMinutes;
  for (let hour = 0; hour < 24 * 70; hour += 1) { state.run.gameMinutes += 60; delversSync(); }
  const list = state.run.delvers.list.filter((d) => !d.lord);
  return JSON.stringify({
    days: (state.run.gameMinutes - start) / 1440,
    people: list.map((d) => ({ name: d.name, culture: d.culture, cls: d.cls, level: d.level, status: d.status, deepest: d.deepest, delves: d.delves, banked: d.banked, diedOn: d.diedOn, cause: d.cause })),
    news: state.run.log.filter((line) => line.startsWith("News")).length,
    tomb: tombMood().id
  });
})()`));
print(`-- ${weeks.days} days in town --`);
for (const d of weeks.people) print(`   ${d.name.padEnd(18)} ${d.culture.padEnd(8)} ${d.cls.padEnd(9)} lvl ${String(d.level).padEnd(3)} ${d.status.padEnd(11)} deepest ${String(d.deepest).padEnd(3)} delves ${d.delves} banked ${d.banked}${d.diedOn ? ` died on ${d.diedOn} (${d.cause})` : ""}`);
check(weeks.people.length >= 6, `delvers kept coming (${weeks.people.length} in all)`);
check(weeks.people.some((d) => d.level > 1), "some grew stronger");
check(weeks.people.some((d) => ["resting", "retired"].includes(d.status) || d.banked > 0), "some came home with treasure");
check(weeks.news > 0, `the town heard news (${weeks.news} lines)`);

// 2. On your floor: a delver and a starving jaguar.
quiet("beginNewDelve()");
quiet(`(() => { travelToFloor(4, "connection-3-1"); state.run.location = "dungeon"; delversSync(); })()`);
const fight = JSON.parse(run(`(() => {
  state.run.enemies = state.run.enemies.filter((e) => e.guardian);
  const room = state.run.rooms.filter((r) => r.mapW >= 7 && !r.planned).sort((a, b) => b.mapW * b.mapH - a.mapW * a.mapH)[0];
  const y = room.anchorY, x = room.anchorX;
  state.run.player = { ...state.run.player, ...delverOpenSpot(state.run, { x: x - 3, y }) };
  const delver = delverCreate({ culture: "norse", cls: "fighter", level: 3 });
  delver.status = "delving"; delver.floor = state.run.dungeonFloor;
  const entity = delverMaterialize(delver, { x, y });
  const jaguar = ecoNewCreature("jungle-jaguar", { x: x + 2, y }, state.run.rooms.indexOf(room));
  jaguar.eco.sat = 5; jaguar.asleep = false;
  state.run.enemies.push(jaguar);
  const hp0 = [entity.hp, jaguar.hp];
  for (let i = 0; i < 12 && entity.alive && jaguar.alive; i += 1) { state.run.steps += 1; enemiesTakeTurn(); }
  return JSON.stringify({ hp0, hp: [entity.hp, jaguar.hp], alive: [entity.alive && state.run.enemies.includes(entity), jaguar.alive],
    log: state.run.log.slice(0, 6), sprite: creatureSpriteKey(entity), near: nearbyCreatures().map((c) => c.name) });
})()`));
print("\n-- a delver and a starving jaguar --");
print(`   hp ${fight.hp0.join("/")} -> ${fight.hp.join("/")}  alive ${fight.alive.join("/")}`);
for (const line of fight.log) print(`   log: ${line}`);
check(fight.hp[0] < fight.hp0[0] || fight.hp[1] < fight.hp0[1], "they fought");
check(String(fight.sprite).startsWith("delver:"), "a delver is drawn as a figure, like you");

// 3. A delver takes treasure in front of you.
const loot = JSON.parse(run(`(() => {
  state.run.enemies = state.run.enemies.filter((e) => e.guardian);
  const delver = delverCreate({ culture: "maya", cls: "ranger" });
  delver.status = "delving"; delver.floor = state.run.dungeonFloor; delver.greeted = true;
  const room = state.run.rooms.filter((r) => r.mapW >= 6 && !r.planned)[0];
  const spot = { x: room.anchorX, y: room.anchorY };
  const entity = delverMaterialize(delver, spot);
  // (Beside the delver on open floor: some chamber forms have an altar or a column there.)
  const beside = MOVEMENT_DIRECTIONS.map((d) => ({ x: entity.x + d.x, y: entity.y + d.y }))
    .find((p) => isWalkable(p.x, p.y) && !tileHasCreature(p.x, p.y)) || { x: entity.x + 1, y: entity.y };
  state.run.treasures.push({ id: "test-cache", x: beside.x, y: beside.y, gold: 30, items: [] });
  for (let i = 0; i < 4; i += 1) { state.run.steps += 1; enemiesTakeTurn(); }
  return JSON.stringify({ gold: delver.gold, left: state.run.treasures.some((t) => t.id === "test-cache") });
})()`));
check(loot.gold >= 30 && !loot.left, `a delver picks up treasure (${loot.gold} gold)`);

// 4. Saving: figures are left out and rebuilt.
const saved = run(`(() => { const copy = JSON.parse(JSON.stringify(state.run));
  const figures = copy.enemies.filter((e) => e.delver).length;
  const ok = parseSavedRun(copy, state.pack);
  return figures + " figures; " + (ok ? "loads, " + copy.enemies.filter((e) => e.delver).length + " kept, " + copy.delvers.list.length + " records" : "REJECTED"); })()`);
check(/loads, 0 kept/.test(saved), `save: ${saved}`);

// 5. The Lord of the Mouth.
quiet(`(() => { state.run.player.x = state.run.floorStairs[0].x; state.run.player.y = state.run.floorStairs[0].y; })()`);
quiet(`(() => { travelToFloor(13, "connection-12-1"); state.run.location = "dungeon"; delversSync(); })()`);
const lord = JSON.parse(run(`(() => {
  const tenoch = state.run.enemies.find((e) => e.lord);
  const bound = state.run.enemies.filter((e) => e.templateId === "tzitzimitl" && e.alive).length;
  const before = { name: tenoch && tenoch.name, hp: tenoch && tenoch.maxHp, ac: tenoch && tenoch.ac, atk: tenoch && tenoch.attackBonus, dmg: tenoch && tenoch.damage, bound };
  tenoch.hp = 0; tenoch.alive = true;
  resolveEnemyDefeat(tenoch);
  const spirit = state.run.enemies.find((e) => e.templateId === "tzitzimitl" && e.alive);
  const regalia = state.run.treasures.some((t) => t.items.some((i) => i.id.includes("--lordly")));
  return JSON.stringify({ before, spirit: Boolean(spirit), regalia, throne: state.run.delvers.throne, log: state.run.log.slice(0, 3) });
})()`));
print("\n-- the Lord of the Mouth --");
print(`   ${JSON.stringify(lord.before)}`);
for (const line of lord.log) print(`   log: ${line}`);
check(lord.before.name === "Tenoch" && lord.before.bound === 0, "Tenoch holds the throne, and she is inside him");
check(lord.before.hp >= 150 && lord.before.ac >= 20, `he is very strong (${lord.before.hp} HP, AC ${lord.before.ac}, +${lord.before.atk}, ${lord.before.dmg})`);
check(lord.spirit && lord.regalia, "when he falls, the Tzitzimitl comes out of him and his regalia lies there");
check(lord.throne.spirit === "emerged" && lord.throne.nextVessel > 0, "she will call a new vessel in a week");

// She calls a vessel; he comes down. Leave the floor so the world runs on its own.
const vessel = JSON.parse(run(`(() => {
  state.run.player.x = state.run.floorStairs[0].x; state.run.player.y = state.run.floorStairs[0].y;
  travelToFloor(12, state.run.floorStairs[0].id);
  state.run.location = "city";
  delversSync();
  const events = [];
  for (let hour = 0; hour < 24 * 90 && state.run.delvers.throne.spirit === "emerged" || hour < 24 * 8; hour += 1) {
    state.run.gameMinutes += 60; delversSync();
    const v = state.run.delvers.list.filter((d) => d.vessel || (d.lord && d.name !== "Tenoch"));
    const tag = v.map((d) => d.name + ":" + d.status + "@" + d.floor + " lvl " + d.level).join(", ");
    if (tag && events[events.length - 1] !== tag) events.push(tag);
    if (state.run.delvers.throne.lordId) break;
  }
  const lordNow = delverLord();
  return JSON.stringify({ events: events.slice(-6), lord: lordNow && lordNow.name, throne: state.run.delvers.throne,
    vessels: state.run.delvers.list.filter((d) => d.cls === "paladin" && d.name !== "Tenoch" && (d.lord || d.status === "dead" && d.diedOn)).length });
})()`));
for (const line of vessel.events) print(`   ${line}`);
check(vessel.lord && vessel.lord !== "Tenoch", `a vessel reached her and became the new lord (${vessel.lord}; regalia ${vessel.throne.regalia})`);

// Slay the spirit: no more vessels.
const slain = JSON.parse(run(`(() => {
  delverSpiritSlain();
  state.run.delvers.throne.lordId = null; state.run.delvers.throne.spirit = "slain";
  for (let hour = 0; hour < 24 * 21; hour += 1) { state.run.gameMinutes += 60; delversSync(); }
  return JSON.stringify({ vessels: state.run.delvers.list.filter((d) => d.vessel).length });
})()`));
check(slain.vessels === 0, "once she is destroyed, no more vessels come");

if (failures) { console.log(`\n${failures} check(s) failed.`); process.exitCode = 1; }
else if (hush) console.log("Delvers: every check passed.");
