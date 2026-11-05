"use strict";

// The tomb as one place. On a new game the whole tomb is planned before any floor is dug,
// from the bottom up, the way it grew:
//
//   1  the mouth        floor 13: the end of the road, where the bound tzitzimitl lies
//                       across the opening and the tomb's energy comes up
//   6  lore chambers    one in each stratum of two floors (11–12, 9–10, … 1–2): the places
//                       the tomb's story is kept, three of them held by its great guardians
//   24 section rooms    the stairwells: two shafts between each pair of floors, so a stair
//                       down on one floor comes out at the same place on the floor below
//   …  to the surface   the broken seal on floor 1
//
// Each floor is then dug around its planned chambers (generateGtflDungeonV3), and only after
// every floor exists does life go in, from the plants up (initializeDungeon), with the
// guardians placed last, whatever the food says.

const TOMB_PLAN_VERSION = 1;
const TOMB_STRATA = [[11, 12], [9, 10], [7, 8], [5, 6], [3, 4], [1, 2]];
// Deep to shallow: the great guardians of the road and where the lore puts them.
const TOMB_KEEPERS = [
  { stratum: 0, keeper: "camazotz", loreId: "lords-antechamber", title: "the inner seal" },
  { stratum: 2, keeper: "yohualtepoztli", loreId: null, title: "the inner gates" },
  { stratum: 4, keeper: "mictlaneca", loreId: "downward-watch", title: "the downward watch" }
];
const TOMB_SPACING = 11;      // planned chambers on one floor keep at least this far apart (in x or y)
const TOMB_SHAFT_PAIR = 15;   // the two shafts between a pair of floors
const TOMB_ACROSS = 17;       // a floor's way up and its way down sit across the floor from each other

function tombPlanRandomSpot(margin = 6) {
  return { x: margin + randomInt(MAP_TILE_SIZE - 2 * margin) - 1, y: margin + randomInt(MAP_TILE_SIZE - 2 * margin) - 1 };
}

function tombPlanDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Everything already planned that stands on `floor`.
function tombPlanOnFloor(plan, floor) {
  const spots = [];
  if (plan.mouth && plan.mouth.floor === floor) spots.push({ ...plan.mouth, role: "mouth" });
  for (const lore of plan.lore) if (lore.floor === floor) spots.push({ ...lore, role: "lore" });
  for (const shaft of plan.shafts) {
    if (shaft.upper === floor) spots.push({ ...shaft, role: "down" });
    if (shaft.upper + 1 === floor) spots.push({ ...shaft, role: "up" });
  }
  if (plan.entrance && floor === 1) spots.push({ ...plan.entrance, role: "entrance" });
  return spots;
}

function tombPlanPick(plan, floors, rules = {}, attempts = 600) {
  let best = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const spot = tombPlanRandomSpot();
    let score = 0;
    let ok = true;
    for (const floor of floors) {
      for (const other of tombPlanOnFloor(plan, floor)) {
        const distance = tombPlanDistance(spot, other);
        // Chebyshev spacing, so the planned rooms (up to 11 wide) can never overlap.
        if (Math.max(Math.abs(spot.x - other.x), Math.abs(spot.y - other.y)) < TOMB_SPACING) { ok = false; break; }
        const across = rules.across?.[floor]?.includes(other.role);
        if (across && distance < TOMB_ACROSS) score -= (TOMB_ACROSS - distance);
        score += Math.min(distance, 24) * 0.05;
      }
      if (!ok) break;
    }
    if (!ok) continue;
    if (rules.apartFrom && tombPlanDistance(spot, rules.apartFrom) < TOMB_SHAFT_PAIR) score -= 8;
    if (!best || score > best.score) best = { spot, score };
    if (score >= 2 && attempt > 60) break;
  }
  return best?.spot || null;
}

function planTomb() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const plan = tryPlanTomb();
    if (plan) return plan;
  }
  throw new Error("Could not plan the tomb.");
}

function tryPlanTomb() {
  const plan = { version: TOMB_PLAN_VERSION, mouth: null, lore: [], shafts: [], entrance: null };
  // 1. The mouth, at the heart of the bottom floor.
  plan.mouth = { floor: DUNGEON_FLOOR_COUNT, x: 18 + randomInt(9) - 1, y: 18 + randomInt(9) - 1, id: "mouth" };

  // 2. Six lore chambers, deepest first, one in each stratum.
  const loreRooms = window.CryptsLore?.rooms || [];
  const usedLore = new Set();
  for (let stratum = 0; stratum < TOMB_STRATA.length; stratum += 1) {
    const [low, high] = TOMB_STRATA[stratum];
    const keeper = TOMB_KEEPERS.find((entry) => entry.stratum === stratum);
    // Floor 1 already holds the seal; its stratum's chamber sits on floor 2 unless it can't.
    const floor = stratum === TOMB_STRATA.length - 1 ? 2 : low + randomInt(high - low + 1) - 1;
    const fitting = loreRooms.filter((room) => !usedLore.has(room.id) && floor >= room.minFloor && floor <= room.maxFloor &&
      room.type !== "boss" && room.type !== "combat");
    const chosen = (keeper?.loreId && loreRooms.find((room) => room.id === keeper.loreId)) ||
      fitting[randomInt(fitting.length) - 1] || null;
    if (chosen) usedLore.add(chosen.id);
    const spot = tombPlanPick(plan, [floor]);
    if (!spot) return null;
    plan.lore.push({
      id: `lore-${stratum + 1}`, floor, x: spot.x, y: spot.y, stratum,
      loreId: chosen?.id || null, keeper: keeper?.keeper || null, title: keeper?.title || null
    });
  }

  // 3. The stairwells, from the mouth up: two shafts between each pair of floors. A floor's
  // ways up sit across the floor from its ways down, so every floor is a crossing.
  for (let upper = DUNGEON_FLOOR_COUNT - 1; upper >= 1; upper -= 1) {
    let first = null;
    for (let n = 1; n <= 2; n += 1) {
      const spot = tombPlanPick(plan, [upper, upper + 1], {
        across: { [upper + 1]: ["down", "mouth"], [upper]: ["up"] },
        apartFrom: first
      });
      if (!spot) return null;
      plan.shafts.push({ id: `shaft-${upper}-${n}`, upper, n, x: spot.x, y: spot.y });
      first ||= spot;
    }
  }

  // 4. The broken seal: the way out to the surface, across floor 1 from its stairs down.
  const seal = tombPlanPick(plan, [1], { across: { 1: ["down"] } });
  if (!seal) return null;
  plan.entrance = { floor: 1, x: seal.x, y: seal.y, id: "entrance" };
  return plan;
}

// The chambers a floor must be dug around, as the floor generator wants them.
function tombPlannedChambers(floor, plan = state.run?.tombPlan) {
  if (!plan || plan.version !== TOMB_PLAN_VERSION) return [];
  const lore = window.CryptsLore?.rooms || [];
  return tombPlanOnFloor(plan, floor).map((spot) => {
    if (spot.role === "mouth") return { ...spot, shape: "pillared", w: 11, h: 9 };
    if (spot.role === "lore") {
      const room = lore.find((entry) => entry.id === spot.loreId);
      return { ...spot, shape: spot.keeper ? "pillared" : "hall", w: spot.keeper ? 9 : 7, h: 7, lore: room || null };
    }
    if (spot.role === "entrance") return { ...spot, shape: "hall", w: 7, h: 5 };
    return { ...spot, shape: "hall", w: 5, h: 5 };
  });
}

// Floors made before the tomb was planned keep their old layout; this only reports.
function tombPlanSummary(plan = state.run?.tombPlan) {
  if (!plan) return null;
  return {
    mouth: plan.mouth.floor,
    lore: plan.lore.map((entry) => `${entry.floor}:${entry.loreId || "-"}${entry.keeper ? `(${entry.keeper})` : ""}`),
    shafts: plan.shafts.length
  };
}
