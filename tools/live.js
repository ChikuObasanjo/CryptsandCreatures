// Runs the live per-turn ecology (not the off-screen settle) for many turns, and tests drift.
const { load } = require("./headless");
const { run } = load();
const quiet = (code) => { try { return run(code); } catch (e) { if (!/setProperty|Node|style|dialog|close/.test(e.message)) { console.log("ERR", e.message, "\n", e.stack.split("\n").slice(1,4).join("\n")); process.exitCode = 1; } } };
quiet("newRun(makeLegacyCharacter())");
for (const floor of [3, 7, 12]) {
  quiet(`travelToFloor(${floor}, "warden-lift"); state.run.location = "dungeon"; state.run.hp = state.run.maxHp;`);
  const t0 = Date.now();
  for (let turn = 0; turn < 400; turn += 1) {
    quiet(`ecologyCreaturesAct(); state.run.gameMinutes += 10; ecologyAdvance();`);
  }
  console.log(`floor ${floor}: 400 live turns ok in ${Date.now() - t0}ms; creatures ${run("ecoLivingCount()")}, events ${run("state.run.ecology.events.length")}, hazards ${run("state.run.hazards.length")}, pressure ${run("(state.run.ecology.pressure||0).toFixed(2)")}`);
}
// drift: leave a floor, let a long time pass, come back; the stone should shift sometimes
const trial = (floor, hours, runs) => {
  let shifts = 0;
  for (let i = 0; i < runs; i += 1) {
    quiet(`travelToFloor(${floor}, "warden-lift")`);
    quiet(`travelToFloor(${floor === 2 ? 3 : 2}, "warden-lift")`);
    quiet(`state.run.gameMinutes += 60 * ${hours}; state.run.log = []`);
    quiet(`travelToFloor(${floor}, "warden-lift")`);
    if (/Stone has shifted/.test(run("state.run.log[0] || ''"))) shifts += 1;
  }
  return shifts;
};
console.log("floor 9 (living rock), away 200h:", trial(9, 200, 30), "of 30 returns shifted");
console.log("floor 5 (fortress masonry), away 200h:", trial(5, 200, 30), "of 30 returns shifted");
console.log("floor 9, away 10h:", trial(9, 10, 30), "of 30 returns shifted");
