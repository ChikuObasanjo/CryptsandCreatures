// New game, cook, go down a few floors, die, come back: every save along the way must load.
const { load } = require("./headless");
const { run, errors } = load();
if (errors.length) console.log("load errors:", errors);
const quiet = (code) => { try { return run(code); } catch (e) { if (!/setProperty|Node|style|dialog|close|showModal/.test(e.message)) console.log("ERR", code.slice(0, 50), e.message); } };
quiet("newRun(makeLegacyCharacter())");
const check = (label) => console.log(label.padEnd(30), run(`(() => { const copy = JSON.parse(JSON.stringify(state.run)); for (const id of Object.keys(copy.dishes || {})) { delete FOOD_ITEMS[id]; delete GEAR_ITEMS[id]; }
  const ok = parseSavedRun(copy, state.pack); return ok ? "loads (" + Object.keys(copy.dishes || {}).length + " dishes, plan " + Boolean(copy.tombPlan) + ")" : "REJECTED"; })()`));
check("new game");
quiet(`state.run.inventory.push({ id: "monster-meat", quantity: 2 }, { id: "chilis", quantity: 1 }, { id: "salt-cakes", quantity: 1 }, { id: "clean-water", quantity: 3 }, { id: "nixtamal", quantity: 1 });
  cookDish({ "monster-meat": 1, chilis: 1, nixtamal: 1, "salt-cakes": 1, "clean-water": 1 }, "simmer", { free: true });`);
check("after cooking in town");
quiet("beginNewDelve()"); check("in the tomb, floor 1");
quiet(`travelToFloor(5, "warden-lift"); state.run.location = "dungeon";`); check("floor 5 by lift");
quiet(`state.run.inventory.push({ id: "monster-meat", quantity: 1 }); state.run.inventory.push({ id: "iron-pot", quantity: 1 });
  campAutoCook(2);`); check("after camp auto-cook");
quiet(`for (let i = 0; i < 30; i += 1) { state.run.gameMinutes += 10; ecologyAdvance(); }`); check("after 5 hours");
quiet("state.run.hp = 0; state.run.lost = true; recoverInChiltomatlan()"); check("after death");
quiet("pruneDishes()"); check("after prune");
