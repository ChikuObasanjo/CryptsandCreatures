// Plays a floor turn by turn and reports any creature you can see that jumps more than one
// square between two frames, with which part of the turn moved it.
// Usage: node tools/teleport-test.js [turns] [floor]
const { load } = require("./headless");
const turns = Number(process.argv[2] || 600);
const floor = Number(process.argv[3] || 6);
const { run } = load();
const quiet = (code) => { try { return run(code); } catch (e) { if (!/setProperty|Node|style|dialog|close|showModal|classList|offsetWidth/.test(e.message)) process.exitCode = 1; console.log("ERR", e.message); } };
quiet("newRun(makeLegacyCharacter())");
quiet("beginNewDelve()");
quiet(`for (let f = 2; f <= ${floor}; f += 1) travelToFloor(f, "connection-" + (f - 1) + "-1"); state.run.location = "dungeon";`);
// Wrap each phase of the turn to see who moves what.
run(`(() => {
  const snap = () => new Map([...state.run.enemies, ...(state.run.lurkers || [])].filter((e) => e.alive).map((e) => [e, { x: e.x, y: e.y }]));
  window.__jumps = [];
  const visible = (p) => distanceInSquares(p, state.run.player) <= 8 && hasLineOfSight(state.run.player, p);
  const wrap = (name) => {
    const original = globalThis[name];
    globalThis[name] = function (...args) {
      const before = snap();
      const result = original.apply(this, args);
      for (const [creature, at] of before) {
        if (!creature.alive) continue;
        const jump = Math.max(Math.abs(creature.x - at.x), Math.abs(creature.y - at.y));
        if (jump > 1 && (visible(at) || visible(creature))) window.__jumps.push(name + " moved " + creature.templateId + " " + jump + " squares" + (creature.alerted ? " (alerted)" : ""));
      }
      return result;
    };
  };
  ["enemiesTakeTurn", "ecologyAdvance", "alliesTakeTurn", "abilityTurnTick", "ecologyCreaturesAct", "ecologySettle", "mindThink"].forEach(wrap);
})()`);
const actions = ["move", "move", "move", "move", "move", "move", "wait", "search"];
for (let i = 0; i < turns; i += 1) {
  const action = actions[i % actions.length];
  quiet(`(() => {
    if (state.run.lost) { state.run.lost = false; state.run.hp = state.run.maxHp; }
    state.run.hp = Math.max(state.run.hp, Math.ceil(state.run.maxHp / 2));
    if ("${action}" === "move") {
      const dirs = [[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,-1]];
      for (let k = 0; k < 6; k += 1) { const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
        const x = state.run.player.x + dx, y = state.run.player.y + dy;
        if (isWalkable(x, y) && !tileHasCreature(x, y)) { state.run.player = { ...state.run.player, x, y }; break; } }
      finishPlayerTurn(10);
    } else if ("${action}" === "wait") finishPlayerTurn(10);
    else finishPlayerTurn(30);
  })()`);
}
const jumps = JSON.parse(run("JSON.stringify(window.__jumps)"));
const tally = {};
for (const line of jumps) { const key = line.replace(/ \\d+ squares/, " N squares").replace(/ moved [a-z0-9-]+/, " moved X"); tally[key] = (tally[key] || 0) + 1; }
console.log(`${turns} turns on floor ${floor}: ${jumps.length} visible jumps`);
if (jumps.length) process.exitCode = 1;
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${v} × ${k}`);
console.log("  e.g.", jumps.slice(0, 6).join("; "));
