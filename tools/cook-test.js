// Cooks a set of pots headlessly and prints what each becomes. Usage: node tools/cook-test.js
const { load } = require("./headless");
const { run, errors } = load();
if (errors.length) console.log("load errors:", errors);
try { run("newRun(makeLegacyCharacter())"); } catch (e) { console.log("newRun:", e.message); }
run(`state.run.location = "city"; state.run.character.strength = 30; window.render = () => {};`);
const pots = [
  ["roast", { "monster-meat": 1 }],
  ["simmer", { "monster-meat": 1, chilis: 1, "salt-cakes": 1, "clean-water": 1 }],
  ["roast", { "caiman-tail": 1 }],
  ["pit", { "caiman-tail": 1, chilis: 1, "salt-cakes": 1 }],
  ["simmer", { "fowl-meat": 2, chilis: 1, "cacao-pouch": 1, ayohuachtli: 1, "clean-water": 1 }],
  ["simmer", { nixtamal: 1, "monster-meat": 1, chilis: 1, quilitl: 1, "salt-cakes": 1, "clean-water": 1 }],
  ["simmer", { etl: 2, epazotl: 1, nixtamal: 1, soup: 1, "salt-cakes": 1 }],
  ["steam", { nixtamal: 1, "cave-mushrooms": 1, "salt-cakes": 1, "clean-water": 1 }],
  ["steam", { blindfish: 2, quilitl: 1, miltomatl: 1, "salt-cakes": 1, "clean-water": 1 }],
  ["roast", { blindfish: 2 }],
  ["fresh", { chilis: 1, miltomatl: 2, epazotl: 1, "salt-cakes": 1 }],
  ["fresh", { blindfish: 1, miltomatl: 1 }],
  ["toast", { chapulines: 2, chilis: 1 }],
  ["roast", { "rabbit-meat": 2 }],
  ["roast", { "rabbit-meat": 1, ayohuachtli: 1, chilis: 1, "salt-cakes": 1 }],
  ["roast", { tlaxcalli: 1, "fowl-meat": 1, chilis: 1, miltomatl: 1 }],
  ["simmer", { "summit-cap": 1, honeycomb: 1, "clean-water": 1 }],
  ["roast", { etl: 1 }],
  ["simmer", { "chilis": 4, "clean-water": 1 }]
];
for (const [method, selection] of pots) {
  const out = run(`(() => {
    state.run.inventory = [];
    for (const [id, n] of Object.entries(${JSON.stringify(selection)})) { const ing = cookIngredient(id); const need = Math.ceil(n * (ing.uses || 1)) + 1; state.run.inventory.push({ id, quantity: need }); }
    state.run.inventory.push({ id: "clean-water", quantity: 2 });
    const a = cookAssess(${JSON.stringify(selection)}, "${method}");
    const id = cookDish(${JSON.stringify(selection)}, "${method}", { quiet: true, free: true });
    const d = id && state.run.dishes[id];
    return JSON.stringify({ name: d ? d.name : null, problem: a.problem, base: +a.base.toFixed(2), parts: Object.fromEntries(Object.entries(a.parts).map(([k,v]) => [k, +(+v).toFixed(2)])),
      food: d && d.food, n: d && d.nutrients, servings: id ? state.run.inventory.find((e) => e.id === id)?.quantity : 0, buff: d && [d.buff, ...(d.moreBuffs||[])].join("+"), sick: d && d.sickly, notes: a.notes.slice(0,3) });
  })()`);
  const r = JSON.parse(out);
  console.log(`${method.padEnd(6)} ${Object.entries(selection).map(([k, v]) => `${k}${v > 1 ? "×" + v : ""}`).join(" + ")}`);
  console.log(`   -> ${r.name || r.problem} | base ${r.base} ${JSON.stringify(r.parts)} | x${r.servings} food ${r.food} ${r.n ? `P${r.n.protein}/C${r.n.carbohydrates}/G${r.n.greens}` : ""} ${r.buff ? "buff " + r.buff : ""}${r.sick ? " SICKLY" : ""}`);
  for (const note of r.notes) console.log("      · " + note);
}
