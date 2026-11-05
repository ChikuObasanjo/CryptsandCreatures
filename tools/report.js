// Per-floor report of who lives where and what the energy budget says. Usage: node tools/report.js
const { load } = require("./headless");
const { errors, run } = load();
if (errors.length) console.log("load errors:", errors);
try { run("newRun(makeLegacyCharacter())"); } catch (e) { console.log("newRun:", e.message); }
const out = run(`(() => {
  const rows = [];
  const floors = { ...state.run.dungeonFloors, [state.run.dungeonFloor]: { enemies: state.run.enemies, lurkers: state.run.lurkers, ecology: state.run.ecology } };
  for (let f = 1; f <= DUNGEON_FLOOR_COUNT; f += 1) {
    const snap = floors[f]; if (!snap) { rows.push({ f, missing: true }); continue; }
    const living = [...snap.enemies, ...(snap.lurkers || [])].filter((e) => e.alive !== false);
    const by = {};
    let use = { herb: 0, pred: 0, scav: 0 };
    for (const e of living) {
      by[e.templateId] = (by[e.templateId] || 0) + 1;
      const sp = ECO.species[e.templateId]; const l = ecoLayer(sp); if (l) use[l] += ecoUpkeep(sp);
    }
    const eco = snap.ecology || {};
    const plants = (eco.features || []).filter((x) => x.kind === "fungus" || x.kind === "plants");
    rows.push({ f, budget: +ecoFloorBudget(f).toFixed(1), use: { herb: +use.herb.toFixed(1), pred: +use.pred.toFixed(1), scav: +use.scav.toFixed(1) },
      n: living.length, plants: plants.length, plantAmt: plants.reduce((a, x) => a + x.amount, 0), pool: +(eco.energy || 0).toFixed(2), by });
  }
  return JSON.stringify(rows);
})()`);
for (const r of JSON.parse(out)) {
  if (r.missing) { console.log("floor", r.f, "missing"); continue; }
  console.log(`F${r.f} budget ${r.budget} herb ${r.use.herb} pred ${r.use.pred} scav ${r.use.scav} | n=${r.n} plants=${r.plants}/${r.plantAmt} pool=${r.pool}`);
  console.log("   ", Object.entries(r.by).map(([k, v]) => `${k}×${v}`).join(" "));
}
