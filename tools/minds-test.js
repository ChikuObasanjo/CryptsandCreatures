// Puts animals next to you in set situations and prints what their minds decide.
// Usage: node tools/minds-test.js
const { load } = require("./headless");
const { run } = load();
const quiet = (code) => { try { return run(code); } catch (e) { if (!/setProperty|Node|style|dialog|close|showModal/.test(e.message)) console.log("ERR", e.message); } };
quiet("newRun(makeLegacyCharacter())");
quiet("beginNewDelve()");
quiet(`(() => { travelToFloor(8, "connection-7-1"); state.run.location = "dungeon"; })()`);

// One creature of `id`, `gap` squares from you in open floor, with the given state.
const scene = (label, id, { gap = 3, sat = 70, hp = 1, provoke = false, mind = null, turns = 3, before = "" } = {}) => {
  const out = run(`(() => {
    state.run.enemies = state.run.enemies.filter((e) => e.guardian);
    state.run.lurkers = []; state.run.hp = state.run.maxHp; state.run.lost = false;
    const room = state.run.rooms.filter((r) => r.mapW >= 7 && r.mapH >= 5 && !r.planned).sort((a, b) => b.mapW * b.mapH - a.mapW * a.mapH)[0];
    const y = room.mapY + Math.floor(room.mapH / 2);
    state.run.player = { ...state.run.player, x: room.mapX + 1, y };
    const spot = { x: room.mapX + 1 + ${gap}, y };
    const creature = ecoNewCreature("${id}", spot, state.run.rooms.indexOf(room));
    creature.eco.sat = ${sat};
    creature.hp = Math.max(1, Math.round(creature.maxHp * ${hp}));
    ${mind ? `creature.mind = Object.assign({ harmed: 0, witnessed: 0, fed: 0, met: 0, calm: 0, focus: null, intent: null, step: -1, seen: false, lastHp: creature.hp, said: null }, ${JSON.stringify(mind)});` : ""}
    state.run.enemies.push(creature);
    ${provoke ? "provokeCreature(creature);" : ""}
    ${before}
    const log0 = state.run.log.length;
    const seen = [];
    for (let i = 0; i < ${turns}; i += 1) { state.run.steps += 1; enemiesTakeTurn(); seen.push(creature.mind ? creature.mind.intent + "@" + creature.mind.attention : "-"); }
    const said = state.run.log.slice(0, Math.max(0, state.run.log.length - log0)).filter((l) => /watches|bolts|shies|made up|starving|interest|attack|hits|misses|runs/.test(l)).slice(0, 2);
    return JSON.stringify({ intents: seen.join(" "), threat: creatureIsThreat(creature), manner: mindDescription(creature), said });
  })()`);
  const r = JSON.parse(out);
  console.log(`${label.padEnd(46)} ${r.intents.padEnd(34)} threat=${r.threat}`);
  if (r.manner) console.log(`${"".padEnd(46)} "${r.manner}"`);
  if (r.said.length) console.log(`${"".padEnd(46)} log: ${r.said.join(" / ")}`);
};

scene("jaguar, fed, first meeting", "jungle-jaguar", { sat: 75 });
scene("jaguar, starving", "jungle-jaguar", { sat: 5 });
scene("jaguar, badly hurt, attacked by you", "jungle-jaguar", { sat: 60, hp: 0.25, provoke: true });
scene("jaguar, you killed its kind before", "jungle-jaguar", { sat: 75, mind: { witnessed: 3, met: 2 } });
scene("ocelot, hungry (you're too big to eat)", "tlacoocelotl", { sat: 40 });
scene("cave turkey, first meeting, close", "cave-turkey", { gap: 2 });
scene("cave turkey, used to you (6 calm meetings)", "cave-turkey", { gap: 3, mind: { calm: 6, met: 6 } });
scene("cave turkey, you fed it twice", "cave-turkey", { gap: 3, mind: { fed: 2, met: 3 } });
scene("tomb rabbit, herd crowded and bold", "dungeonrabbit", { gap: 2, before: "creature.eco.crowded = true;" });
scene("mapachin, fed, a little way off", "mapachin", { gap: 5 });

// Minds travel with the save.
console.log(run(`(() => { const copy = JSON.parse(JSON.stringify(state.run)); const withMind = copy.enemies.filter((e) => e.mind).length;
  return "save with " + withMind + " minds: " + (parseSavedRun(copy, state.pack) ? "loads" : "REJECTED"); })()`));
