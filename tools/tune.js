// Runs several new worlds under one tuning and prints per-floor averages.
// Usage: node tools/tune.js '{"herbFill":0.45}' [worlds]
const { load } = require("./headless");
const tuning = JSON.parse(process.argv[2] || "{}");
const worlds = Number(process.argv[3] || 4);
const agg = {};
for (let w = 0; w < worlds; w += 1) {
  const { run } = load(undefined, tuning);
  try { run("newRun(makeLegacyCharacter())"); } catch (e) { if (!/setProperty|Node/.test(e.message)) console.log("newRun:", e.message); }
  const rows = JSON.parse(run(`(() => {
    const floors = { ...state.run.dungeonFloors, [state.run.dungeonFloor]: { enemies: state.run.enemies, lurkers: state.run.lurkers, ecology: state.run.ecology } };
    const out = [];
    for (let f = 1; f <= DUNGEON_FLOOR_COUNT; f += 1) {
      const snap = floors[f]; const living = [...snap.enemies, ...(snap.lurkers || [])].filter((e) => e.alive !== false && !e.guardian);
      const use = { herb: 0, pred: 0, scav: 0 }; const big = {};
      for (const e of living) { const sp = ECO.species[e.templateId]; const l = ecoLayer(sp); if (l) { use[l] += ecoUpkeep(sp); if (sp.rank >= 3) big[e.templateId] = 1; } }
      const plants = (snap.ecology.features || []).filter((x) => x.kind === "fungus" || x.kind === "plants");
      out.push({ f, herb: use.herb, pred: use.pred, scav: use.scav, beds: plants.length, amt: plants.reduce((a, x) => a + x.amount, 0), budget: ecoFloorBudget(f), tiers: Object.keys(big).length });
    }
    return JSON.stringify(out);
  })()`));
  for (const r of rows) {
    const a = (agg[r.f] ||= { n: 0, herb: 0, pred: 0, scav: 0, beds: 0, amt: 0, budget: r.budget, tiers: 0 });
    a.n += 1; for (const k of ["herb", "pred", "scav", "beds", "amt", "tiers"]) a[k] += r[k];
  }
}
console.log("tuning", JSON.stringify(tuning), "worlds", worlds);
for (const [f, a] of Object.entries(agg)) {
  const m = (k) => (a[k] / a.n).toFixed(1);
  console.log(`F${String(f).padStart(2)} budget ${a.budget.toFixed(1).padStart(5)} | herb ${m("herb").padStart(5)} (${(a.herb / a.n / a.budget * 100).toFixed(0)}%) pred ${m("pred").padStart(5)} scav ${m("scav").padStart(5)} | beds ${m("beds").padStart(4)} units ${m("amt").padStart(5)} | big-species ${m("tiers")}`);
}
