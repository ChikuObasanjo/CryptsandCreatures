// Leave a floor for a long time, come back, and check the floor you see on arrival is already
// up to date: one ordinary turn afterwards should change almost nothing.
const { load } = require("./headless");
const { run } = load();
const quiet = (code) => { try { return run(code); } catch (e) { if (!/setProperty|Node|style|dialog|close|showModal/.test(e.message)) process.exitCode = 1; console.log("ERR", e.message); } };
quiet("newRun(makeLegacyCharacter())");
quiet("beginNewDelve()");
const census = () => run(`JSON.stringify({ alive: state.run.enemies.filter((e) => e.alive).length, minute: state.run.ecology.minute, now: state.run.gameMinutes })`);
for (let trial = 0; trial < 3; trial += 1) {
  quiet(`{ const down = state.run.floorStairs.find((s) => s.type === "stairs-down"); state.run.player = { ...state.run.player, x: down.x, y: down.y }; traverseDungeonStair(down); }`);
  quiet(`state.run.gameMinutes += 60 * 150;`);
  quiet(`{ const up = state.run.floorStairs.find((s) => s.type === "stairs-up" && s.targetFloor === 1); state.run.player = { ...state.run.player, x: up.x, y: up.y }; traverseDungeonStair(up); }`);
  const arrived = census();
  quiet(`finishPlayerTurn(10)`);
  const after = census();
  console.log("on arrival", arrived, "| after one turn", after);
  const a = JSON.parse(arrived), b = JSON.parse(after);
  // Arriving must bring the floor up to the present, and one turn shouldn't reshuffle it.
  if (a.minute !== a.now || Math.abs(a.alive - b.alive) > 2) { console.log("  floor was stale on arrival"); process.exitCode = 1; }
}
