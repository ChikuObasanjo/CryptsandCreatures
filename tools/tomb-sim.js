// Makes a whole tomb and lets every floor live for a while; prints each floor before and after.
// Usage: node tools/tomb-sim.js [hours] [seedRuns]
const { load } = require("./headless");
const hours = Number(process.argv[2] || 600);
const { run } = load();
try { run("newRun(makeLegacyCharacter())"); } catch (e) { console.log("newRun:", e.message); }
run("saveDungeonFloorState()");
const snap = (f) => JSON.parse(run(`(() => { loadDungeonFloorForWork(${f}); const use = ecoLayerUse(); const by = {};
  for (const c of ecoLivingCreatures()) if (!c.guardian && ecoLayer(ecoSpecies(c))) by[c.templateId] = (by[c.templateId] || 0) + 1;
  const plants = ecoState().features.filter((x) => x.kind === "fungus" || x.kind === "plants");
  const r = { herb: +use.herb.toFixed(1), pred: +use.pred.toFixed(1), scav: +use.scav.toFixed(1), p: +ecoHerbPressure().toFixed(2), units: plants.reduce((a, x) => a + x.amount, 0),
    spores: state.run.hazards.filter((h) => h.kind === "fungal-spore").length, by,
    ev: Object.entries((ecoState().events || []).reduce((a, e) => { const k = e.text.replace(/^An? (Young )?/, "").replace(/ here\.?$/, ""); a[k] = (a[k] || 0) + 1; return a; }, {})).filter(([k]) => /starved|killed|climbed|left|bold|band/.test(k)).map(([k, v]) => k + " x" + v) };
  saveDungeonFloorState(); return JSON.stringify(r); })()`));
const fmt = (r) => `herb ${String(r.herb).padStart(5)} pred ${String(r.pred).padStart(4)} scav ${String(r.scav).padStart(4)} p=${r.p} units ${r.units} spores ${r.spores} | ${Object.entries(r.by).map(([k, v]) => `${k.replace(/maztican-cave-|dungeon/g, "")}×${v}`).join(" ")}`;
const before = {};
for (let f = 13; f >= 1; f -= 1) before[f] = snap(f);
for (let step = 0; step < hours / 50; step += 1) {
  for (let f = 13; f >= 1; f -= 1) run(`loadDungeonFloorForWork(${f}); ecologySettle(300); saveDungeonFloorState();`);
}
for (let f = 1; f <= 13; f += 1) {
  const after = snap(f);
  console.log(`F${String(f).padStart(2)} fill ${run(`(ecoFloorBudget(${f}) * ECO_HERB_FILL).toFixed(1)`).padStart(5)}  start ${fmt(before[f])}`);
  console.log(`              after ${fmt(after)}`);
  if (process.env.EV) console.log("              events:", after.ev.join("; "));
}
