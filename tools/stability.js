// Runs one floor for a long time with no player and prints how it behaves.
// Usage: node tools/stability.js <floor> <scenario: base|cullPred|cullHerb> [hours]
const { load } = require("./headless");
const floor = Number(process.argv[2] || 8);
const scenario = process.argv[3] || "base";
const hours = Number(process.argv[4] || 1500);
const { run } = load();
const quiet = (fn) => { try { fn(); } catch (e) { if (!/setProperty|Node|style/.test(e.message)) throw e; } };
quiet(() => run(`newRun(makeLegacyCharacter())`));
quiet(() => run(`state.run.dungeonFloor = ${floor}; state.run.dungeonFloors = {}; initializeDungeon();`));
const sample = () => JSON.parse(run(`(() => {
  const use = ecoLayerUse(); const eco = ecoState();
  const plants = eco.features.filter((x) => x.kind === "fungus" || x.kind === "plants");
  const by = {}; for (const c of ecoLivingCreatures()) if (!c.guardian && ecoLayer(ecoSpecies(c))) by[c.templateId] = (by[c.templateId] || 0) + 1;
  return JSON.stringify({ herb: use.herb, pred: use.pred, scav: use.scav, beds: plants.length, units: plants.reduce((a, x) => a + x.amount, 0),
    crowded: !!eco.crowded, pressure: +(eco.pressure || 0).toFixed(2), spores: state.run.hazards.filter((h) => h.kind === "fungal-spore").length,
    bands: new Set(ecoLivingCreatures().map((c) => c.band).filter(Boolean)).size, by });
})()`));
const cull = (layer, share) => run(`(() => { let n = 0; for (const c of [...ecoLivingCreatures()]) { const l = ecoLayer(ecoSpecies(c)); if (c.guardian || l !== "${layer}") continue; if (Math.random() < ${share}) { ecologyCreatureDied(c); n += 1; } } return n; })()`);
console.log(`floor ${floor} scenario ${scenario}, budget ${run(`ecoFloorBudget(${floor}).toFixed(1)`)}`);
const events = scenario === "cullPred" ? { 400: ["pred", 1] } : scenario === "cullHerb" ? { 400: ["herb", 0.9] } : {};
for (let h = 0; h <= hours; h += 100) {
  if (h > 0) run(`ecologySettle(${100 * 6})`);
  for (const [at, [layer, share]] of Object.entries(events)) if (Number(at) === h) console.log(`   -- hour ${h}: culled ${cull(layer, share)} ${layer}`);
  const x = sample();
  console.log(`h${String(h).padStart(5)} herb ${x.herb.toFixed(1).padStart(5)} pred ${x.pred.toFixed(1).padStart(5)} scav ${x.scav.toFixed(1).padStart(5)} beds ${String(x.beds).padStart(2)} units ${String(x.units).padStart(3)} pressure ${x.pressure}${x.crowded ? " CROWDED" : ""} spores ${x.spores} bands ${x.bands}`);
}
console.log("final:", JSON.stringify(sample().by));
