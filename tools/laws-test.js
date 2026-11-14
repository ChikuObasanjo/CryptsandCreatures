// Checks the tomb's laws (systems/laws.js), the chamber forms (systems/forms.js), and the
// country's content (data/xalisco.js). Part of npm run check.
// Usage: node tools/laws-test.js [--quiet]
const { load } = require("./headless");
const { run } = load();
const hush = process.argv.includes("--quiet");
let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures += 1;
  if (!ok || !hush) console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `   (${detail})` : ""}`);
};
const fallbacks = [];
const warn = console.warn;
console.warn = (message) => { if (/Falling back/.test(String(message))) fallbacks.push(message); else warn(message); };
try { run("newRun(makeLegacyCharacter())"); } catch (error) { if (!/setProperty|Node|style|dialog|close|showModal/.test(error.message)) throw error; }
run("saveDungeonFloorState()");

// ---- The count ----
const days = JSON.parse(run(`JSON.stringify(Array.from({ length: 261 }, (unused, day) => lawCount(day * 1440)))`));
check("the count begins on One Crocodile and comes round after 260 days", days[0].name === "One Crocodile" && days[259].name === "Thirteen Flower" && days[260].name === "One Crocodile", `${days[0].name} … ${days[259].name} … ${days[260].name}`);
check("every day of the 260 has its own name", new Set(days.slice(0, 260).map((day) => day.name)).size === 260);
check("Four Movement comes once in the count", days.slice(0, 260).filter((day) => day.movement).length === 1, days.slice(0, 260).filter((day) => day.movement).map((day) => `day ${day.index + 1}: ${day.name}`).join(", "));
check("the Cihuateteo come down on five days", days.slice(0, 260).filter((day) => day.descent).length === 5, days.slice(0, 260).filter((day) => day.descent).map((day) => day.name).join(", "));
check("the days go round the four quarters in order", days.slice(0, 8).map((day) => day.quarter).join(" ") === "east north west south east north west south");

// ---- The breath, the middle, the bow, the way ----
const breath = JSON.parse(run(`JSON.stringify(Array.from({ length: 144 }, (unused, tick) => lawBreath(1440 + tick * 10)))`));
const mean = breath.reduce((sum, value) => sum + value, 0) / breath.length;
check("the mouth's breath averages 1 over a day, deepest before dawn", Math.abs(mean - 1) < 0.02 && breath.indexOf(Math.max(...breath)) === 30, `mean ${mean.toFixed(3)}, deepest at ${(breath.indexOf(Math.max(...breath)) / 6).toFixed(1)} h`);
check("the middle: at rest 0, at the edge of what it bears 1", run("lawMiddle(0.5, 0.5, 0.2)") === 0 && Math.abs(run("lawMiddle(0.7, 0.5, 0.2)") - 1) < 1e-9);
check("the bow: nothing until the limit, all of it at twice the limit", run("lawBow(4, 4)") === 0 && run("lawBow(6, 4)") === 0.5 && run("lawBow(12, 4)") === 1);
check("the way: the full gives the empty no more than it has room for", run("lawGive(90, 70, 5)") === 5 && run("lawGive(80, 70, 50)") === 5 && run("lawGive(60, 70, 50)") === 0);

// ---- One life: what a floor can't hold rises, and none is lost ----
const life = JSON.parse(run(`(() => { loadDungeonFloorForWork(9); const eco = ecoState(); const book = lawBook();
  eco.energy = ecoPoolCap(eco) - 0.01; book.rise = {}; const before = eco.energy; const inflow = ecoPoolInflow(eco);
  ecoPoolFill(eco, 6);
  const out = { before, after: eco.energy, inflow: inflow * 6, cap: ecoPoolCap(eco), rate: book.rise["9"] || 0, into8: 0 };
  saveDungeonFloorState(); loadDungeonFloorForWork(8); out.into8 = lawRiseInto(8); saveDungeonFloorState(); return JSON.stringify(out); })()`));
const spilled = life.before + life.inflow - life.after;
check("a full floor keeps what it can hold and lets the rest rise to the floor above", life.after === life.cap && spilled > 0 && life.rate > 0 && life.into8 > 0, `in ${life.inflow.toFixed(3)}, kept ${(life.after - life.before).toFixed(3)}, rose ${spilled.toFixed(3)}`);

// ---- The forms ----
const forms = JSON.parse(run(`(() => { const out = {}; for (const [name, form] of Object.entries(FORMS)) { let bad = 0; for (let i = 0; i < 60; i += 1) for (const [w, h] of form.sizes) {
  const built = form.build(w, h, i % 2 === 0); const at = built.anchor[1] * w + built.anchor[0];
  if (!Number.isInteger(built.anchor[0]) || !Number.isInteger(built.anchor[1]) || !built.floor.has(at) || formJoined(built.floor, at, w).size !== built.floor.size) bad += 1; }
  out[name] = bad; } return JSON.stringify(out); })()`));
check("every form builds in one piece around its middle", Object.values(forms).every((bad) => bad === 0), Object.entries(forms).filter(([, bad]) => bad).map(([name, bad]) => `${name} ${bad}`).join(", ") || `${Object.keys(forms).length} forms`);
const unnamed = JSON.parse(run(`JSON.stringify(Object.keys(FORMS).filter((form) => !state.pack.rooms.some((room) => room.forms && room.forms.includes(form))))`));
check("every form has a room written for it", unnamed.length === 0, unnamed.join(", "));

// ---- A whole tomb, as generated ----
const tomb = JSON.parse(run(`(() => { const out = { leafBad: 0, stairDens: 0, formed: 0, named: 0, floors: 0, dens: 0, basins: 0, rooms: 0 };
  for (let floor = 1; floor <= DUNGEON_FLOOR_COUNT; floor += 1) { loadDungeonFloorForWork(floor); out.floors += 1;
    for (const room of state.run.rooms) { out.rooms += 1;
      if (room.leaf && (room.links || []).length !== 1) out.leafBad += 1;
      if (room.planned && ["predator-den", "nesting-chamber"].includes(room.habitat)) out.stairDens += 1;
      if (formIs(room.shape)) { out.formed += 1; if (state.pack.rooms.some((entry) => entry.forms && entry.name === room.name)) out.named += 1; }
      if (room.purpose === "den") out.dens += 1;
      if (room.purpose === "basin") out.basins += 1; }
    saveDungeonFloorState(); }
  return JSON.stringify(out); })()`));
check("a new tomb is made with the purpose-first layout on every floor", fallbacks.length === 0 && tomb.floors === 13, `${tomb.rooms} chambers, ${tomb.formed} in the new forms`);
check("a chamber made to have one way in has one way in", tomb.leafBad === 0, `${tomb.dens} dens`);
check("nothing dens or nests on a stair", tomb.stairDens === 0);
check("every floor has somewhere for its water to gather", tomb.basins >= 13, `${tomb.basins} basins`);

// ---- The country's creatures ----
const country = JSON.parse(run(`JSON.stringify({ floors: Object.fromEntries(["coyotl", "tlacuatzin"].map((id) => [id, ecoSpeciesFloors(id)])),
  cards: window.CryptsXalisco.enemies.every((enemy) => state.pack.enemies.includes(enemy) && ENEMY_SPRITES.includes(enemy.sprite) && ecoSpecies({ templateId: enemy.id })),
  goods: Object.keys(window.CryptsXalisco.treasures).every((id) => itemDetails(id).name) })`));
check("the country's creatures have cards, pictures, and a place in the food web", country.cards && country.goods && country.floors.coyotl.length > 0 && country.floors.tlacuatzin.length > 0, `coyotes on floors ${country.floors.coyotl.join(", ")}`);

if (hush && !failures) console.log("Laws: every check passed.");
if (failures) { console.log(`\n${failures} check(s) failed.`); process.exitCode = 1; }
