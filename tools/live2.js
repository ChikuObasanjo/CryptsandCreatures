const { load } = require("./headless");
const floor = Number(process.argv[2] || 12);
const { run } = load();
const quiet = (code) => { try { return run(code); } catch (e) { if (!/setProperty|Node|style|dialog|close/.test(e.message)) console.log("ERR", e.message); } };
quiet("newRun(makeLegacyCharacter())");
quiet(`travelToFloor(${floor}, "warden-lift"); state.run.location = "dungeon";`);
const snap = () => JSON.parse(run(`(() => { const u = ecoLayerUse(); const k = {}; for (const e of state.run.ecology.events) k[e.kind] = (k[e.kind]||0)+1;
  const fed = ecoLivingCreatures().filter(c => !c.guardian && ecoLayer(ecoSpecies(c))).map(c => c.templateId+":"+Math.round(c.eco.sat)+(c.alive?"":"x"));
  return JSON.stringify({ herb: u.herb, pred: u.pred, scav: u.scav, fed, kinds: k, beds: state.run.ecology.features.filter(f=>f.kind==="fungus"||f.kind==="plants").map(f=>f.amount).join("/") }); })()`));
console.log("start", JSON.stringify(snap()));
for (let block = 1; block <= 6; block += 1) {
  for (let t = 0; t < 100; t += 1) quiet(`ecologyCreaturesAct(); state.run.gameMinutes += 10; ecologyAdvance();`);
  const s = snap(); console.log(`t${block * 100}`, `herb ${s.herb} pred ${s.pred} scav ${s.scav} beds ${s.beds}`, JSON.stringify(s.kinds), s.fed.join(" "));
}
