// Makes several whole tombs, lets each live with no player, and counts what went wrong:
// layers that died out, herds left crowded, floors with nothing alive. A measure of how
// well the tomb's laws hold a food web together. (Slow; not part of `npm run check`.)
// Usage: node tools/tomb-health.js [tombs] [hours]
const { load } = require("./headless");
const tombs = Number(process.argv[2] || 6);
const hours = Number(process.argv[3] || 600);
const total = { floors: 0, herbGone: 0, predGone: 0, scavGone: 0, crowded: 0, empty: 0, sick: 0, kinds: 0, creatures: 0, rise: 0 };
const perFloor = {};
for (let n = 0; n < tombs; n += 1) {
  const { run } = load();
  try { run("newRun(makeLegacyCharacter())"); } catch (error) { if (!/setProperty|Node|style/.test(error.message)) throw error; }
  run("saveDungeonFloorState()");
  for (let step = 0; step < hours / 50; step += 1) {
    for (let floor = 13; floor >= 1; floor -= 1) run(`loadDungeonFloorForWork(${floor}); ecologySettle(300); saveDungeonFloorState();`);
  }
  for (let floor = 1; floor <= 13; floor += 1) {
    const r = JSON.parse(run(`(() => { loadDungeonFloorForWork(${floor}); const use = ecoLayerUse(); const cap = ecoLayerCapacity(${floor});
      const living = ecoLivingCreatures().filter((c) => !c.guardian && ecoLayer(ecoSpecies(c)));
      const r = { use, cap, p: ecoHerbPressure(), kinds: new Set(living.map((c) => c.templateId)).size, n: living.length,
        sick: living.filter((c) => c.eco && c.eco.sick > 0).length };
      saveDungeonFloorState(); return JSON.stringify(r); })()`));
    const f = perFloor[floor] ||= { herbGone: 0, predGone: 0, scavGone: 0, crowded: 0, n: 0, kinds: 0 };
    total.floors += 1;
    if (r.use.herb <= 0) { total.herbGone += 1; f.herbGone += 1; }
    if (r.use.pred <= 0) { total.predGone += 1; f.predGone += 1; }
    if (r.use.scav <= 0) { total.scavGone += 1; f.scavGone += 1; }
    if (r.p > 1.45) { total.crowded += 1; f.crowded += 1; }
    if (!r.n) total.empty += 1;
    total.sick += r.sick; total.kinds += r.kinds; total.creatures += r.n; f.n += r.n; f.kinds += r.kinds;
  }
  total.rise += Number(run(`typeof lawBook === "function" ? (lawBook().surfaced || 0) : 0`)) || 0;
}
const pct = (value) => `${(100 * value / total.floors).toFixed(0)}%`;
console.log(`${tombs} tombs, ${hours} hours each, ${total.floors} floors`);
console.log(`  grazers gone ${pct(total.herbGone)}   hunters gone ${pct(total.predGone)}   scavengers gone ${pct(total.scavGone)}   crowded ${pct(total.crowded)}   nothing alive ${pct(total.empty)}`);
console.log(`  per floor: ${(total.creatures / total.floors).toFixed(1)} animals of ${(total.kinds / total.floors).toFixed(1)} kinds; sick now ${total.sick}; walked out at the top ${(total.rise / tombs).toFixed(0)} per tomb`);
if (process.env.FLOORS) for (const [floor, f] of Object.entries(perFloor)) console.log(`  F${String(floor).padStart(2)} herb gone ${f.herbGone}/${tombs} pred gone ${f.predGone} scav gone ${f.scavGone} crowded ${f.crowded} avg ${(f.n / tombs).toFixed(1)} of ${(f.kinds / tombs).toFixed(1)} kinds`);
