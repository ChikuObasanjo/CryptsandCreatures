// Plays the persistence flow: new game, travel, death, new delve, lift, drift. Checks the tomb stays whole.
const { load } = require("./headless");
const { run } = load();
const quiet = (code) => { try { return run(code); } catch (e) { if (!/setProperty|Node|style|dialog|close/.test(e.message)) { console.log("ERR", code.slice(0, 60), "->", e.message); } } };
quiet("newRun(makeLegacyCharacter())");
const check = (label) => {
  const r = JSON.parse(run(`(() => {
    const size = MAP_TILE_SIZE; const bad = [];
    const floors = { ...state.run.dungeonFloors, [state.run.dungeonFloor]: state.run };
    const walk = (t, i) => ["floor","corridor","door"].includes(t[i]);
    for (const [f, d] of Object.entries(floors)) {
      // every chamber reachable from chamber 0 by walkable tiles
      const seen = new Set(); const start = d.rooms[0].anchorY * size + d.rooms[0].anchorX; const q = [start]; seen.add(start);
      while (q.length) { const c = q.pop(); for (const n of [c+1,c-1,c+size,c-size]) if (!seen.has(n) && n>=0 && n<size*size && walk(d.terrain, n)) { seen.add(n); q.push(n); } }
      const unreachable = d.rooms.filter((r) => !seen.has(r.anchorY * size + r.anchorX)).length;
      const stuck = [...d.enemies, ...(d.lurkers||[]), ...d.treasures].filter((e) => e.alive !== false && !walk(d.terrain, e.y * size + e.x)).length;
      if (unreachable || stuck) bad.push({ f, unreachable, stuck });
    }
    return JSON.stringify({ active: state.run.dungeonFloor, stored: Object.keys(state.run.dungeonFloors).length, loc: state.run.location, bad });
  })()`));
  console.log(label.padEnd(34), JSON.stringify(r));
};
check("after newRun");
const sig = (f) => run(`(() => { const d = ${f} === state.run.dungeonFloor ? state.run : state.run.dungeonFloors[${f}]; return d.terrain.map((t,i)=> t==="corridor"?i:-1).filter(i=>i>=0).join(","); })()`);
quiet("beginNewDelve()"); check("beginNewDelve (floor 1)");
quiet(`travelToFloor(5, "warden-lift")`); check("lift to floor 5");
const before = sig(5);
const eventsBefore = run("state.run.ecology.ticks");
quiet("state.run.player = { ...state.run.player }; state.run.hp = 0; state.run.lost = true; recoverInChiltomatlan()");
check("after death + recover");
const after = quiet("state.run.dungeonFloors[5] ? state.run.dungeonFloors[5].terrain.map((t,i)=> t==='corridor'?i:-1).filter(i=>i>=0).join(',') : ''");
console.log("floor 5 corridors changed:", before !== after, "| body carcass on floor 5:", run("(state.run.dungeonFloors[5].ecology.features.filter(f=>f.kind==='carcass'&&f.delver).length)"), "| active floor", run("state.run.dungeonFloor"), "location", run("state.run.location"));
quiet("state.run.hp = state.run.maxHp; beginNewDelve()"); check("delve again after death");
quiet("state.run.gameMinutes += 60*100; for (const f of Object.keys(state.run.dungeonFloors)) state.run.dungeonFloors[f].leftMinute = 0;");
let shifted = 0; for (let i = 0; i < 6; i += 1) { quiet(`travelToFloor(${3 + i}, "warden-lift")`); } check("after 6 drift-checked trips");
console.log("floors flagged shifted:", run("Object.values(state.run.dungeonFloors).filter(d=>d.shifted).length"));
