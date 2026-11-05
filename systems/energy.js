"use strict";

// The tomb's energy: where it comes from, how it moves up the food chain, and what that
// lets live on each floor.
//
// Energy comes up from the mouth on floor 13 and thins out on the way to the surface, so
// each floor can feed a fixed amount of life. That amount is counted in upkeep points, the
// cost of keeping a creature alive (species.upkeep in data/ecology.js). A floor's plants
// carry the grazers, the grazers carry the hunters, and the hunters and dead carry the
// scavengers. Nothing here is a spawn table: a bigger creature is simply too expensive to
// keep until a floor is rich enough to feed a breeding pair of it.
//
//   herb layer   grazers and omnivores, fed by plants:    up to ECO_HERB_FILL of the budget
//   pred layer   hunters, fed by the grazers:             a share of the herb layer in use
//   scav layer   scavengers, fed by kills and carcasses:  a share of the layers below
//
// Spirits, guardians, and raiders don't eat the tomb's food, so they aren't counted.

// Tuning can be overridden before load (tools/tune.js does this to test settings).
const ECO_TUNE = window.CryptsEcoTuning || {};
const ECO_BUDGET_TOP = ECO_TUNE.budgetTop ?? 100;       // upkeep points the plants of floor 13 can carry
const ECO_HERB_FILL = ECO_TUNE.herbFill ?? 0.45;        // share of the budget the herb layer may fill
const ECO_HERB_CARRY = ECO_TUNE.herbCarry ?? 0.65;       // what the plants can feed at most; a herd with no hunters grows toward this
const ECO_HERB_VIABLE = ECO_TUNE.herbViable ?? 0.6;      // a species needs its minimum population to fit in this share
const ECO_PRED_SHARE = ECO_TUNE.predShare ?? 0.35;      // predator upkeep carried per point of herb upkeep in use
const ECO_PRED_BASE = ECO_TUNE.predBase ?? 0.08;       // ...plus this share of the floor budget (carrion, eggs, insects)
const ECO_SCAV_SHARE = ECO_TUNE.scavShare ?? 0.3;       // scavenger upkeep carried per point of herb + pred upkeep in use
const ECO_SCAV_BASE = ECO_TUNE.scavBase ?? 0.05;
const ECO_PLANT_ENERGY = ECO_TUNE.plantEnergy ?? 0.35;    // what one unit of plant growth costs the floor's energy pool
const ECO_POOL_HOURS = 20;        // how much unspent energy a floor can store, in hours of inflow
const ECO_CROWDED = ECO_TUNE.crowded ?? 1.45;         // herb layer above this share of its budget is overcrowded
const ECO_CROWDED_CLEAR = ECO_TUNE.crowdedClear ?? 1.2;    // ...and calms down again below this

const ECO_LAYER_OF_ROLE = { grazer: "herb", omnivore: "herb", predator: "pred", scavenger: "scav" };

// Share of the mouth's energy that reaches a floor: 1 at the mouth, falling toward the surface.
function ecoFloorShare(floor = state.run?.dungeonFloor || 1) {
  return Math.pow(ECO_ENERGY_DECAY, Math.max(0, DUNGEON_FLOOR_COUNT - floor));
}

function ecoFloorBudget(floor = state.run?.dungeonFloor || 1) {
  return ECO_BUDGET_TOP * ecoFloorShare(floor);
}

function ecoLayer(species) {
  return ECO_LAYER_OF_ROLE[species?.role] || null;
}

function ecoUpkeep(species) {
  if (!species) return 0;
  if (Number.isFinite(species.upkeep)) return species.upkeep;
  return Math.max(0.5, (species.appetite || 0.5) * (1 + (species.size || 0)));
}

// How many a breeding population needs: lone territorial hunters and big ones keep a range
// to themselves, so one is enough to hold a floor.
function ecoMinimumPopulation(species) {
  return species.territorial || (species.size || 0) >= 4 ? 1 : 2;
}

// Is this creature one the tomb's food feeds (as against spirits, guardians, raiders)?
function ecoIsFed(species) {
  return Boolean(ecoLayer(species));
}

// What the herb layer's plants and the animals it feeds can carry on a floor, in upkeep
// points, given what is already alive there.
function ecoLayerUse(creatures = ecoLivingCreatures()) {
  const use = { herb: 0, pred: 0, scav: 0 };
  for (const creature of creatures) {
    if (creature.guardian) continue;
    const species = ECO.species[creature.templateId];
    const layer = ecoLayer(species);
    if (layer) use[layer] += ecoUpkeep(species);
  }
  return use;
}

function ecoLayerBudgets(floor, use) {
  const budget = ecoFloorBudget(floor);
  return {
    herb: budget * ECO_HERB_CARRY,
    pred: use.herb * ECO_PRED_SHARE + budget * ECO_PRED_BASE,
    scav: (use.herb + use.pred) * ECO_SCAV_SHARE + budget * ECO_SCAV_BASE
  };
}

// Can this floor feed the species at all? A grazer needs a breeding population's worth of
// upkeep inside the herb budget. Hunters and scavengers are checked against the prey that
// is actually there when the floor is filled, so here they only need the floor to be able
// to carry them given a full herb layer.
function ecoCanFeed(id, floor) {
  const species = ECO.species[id];
  const layer = ecoLayer(species);
  if (!layer) return true;
  const budget = ecoFloorBudget(floor);
  const need = ecoUpkeep(species) * ecoMinimumPopulation(species);
  if (layer === "herb") return need <= budget * ECO_HERB_VIABLE;
  const full = { herb: budget * ECO_HERB_FILL, pred: 0 };
  const layers = {
    pred: full.herb * ECO_PRED_SHARE + budget * ECO_PRED_BASE,
    scav: (full.herb + full.herb * ECO_PRED_SHARE) * ECO_SCAV_SHARE + budget * ECO_SCAV_BASE
  };
  return need <= layers[layer];
}

// Every creature the floor's food can carry, by id.
function ecoFeedableSpecies(floor) {
  return Object.keys(ECO.species).filter((id) => ecoIsFed(ECO.species[id]) && ecoCanFeed(id, floor));
}

// ---------- Filling a floor, from the plants up ----------

// A chamber a creature may live in, and how well the chamber suits it.
function ecoHomeRooms(id) {
  return state.run.rooms.map((room, index) => ({
    room, index, weight: ecoResidents(ecoHabitat(room))[id] || 0
  })).filter((entry) => entry.weight > 0 && entry.room.type !== "boss" && !entry.room.mainTreasure && entry.index > 0);
}

function ecoPlaceCreature(id, occupied) {
  const species = ECO.species[id];
  const homes = ecoHomeRooms(id);
  if (!homes.length) return null;
  const choice = homes[ecoWeighted(homes.map((entry, n) => [n, entry.weight])) ?? 0];
  const spot = (species.aquatic && ecoDeepTile(choice.index, occupied)) || ecoFreeTile(choice.room, occupied);
  if (!spot) return null;
  occupied.add(tileIndex(spot.x, spot.y));
  const creature = ecoNewCreature(id, spot, choice.index);
  if (!creature) return null;
  state.run.enemies.push(creature);
  return creature;
}

// Seeds one layer: picks species the layer can carry, weighted toward the bigger ones in
// proportion to how much budget is left, until the budget or the floor's cap is spent.
function ecoFillLayer(layer, budget, floor, occupied) {
  const cap = ecoFloorCap(floor);
  const candidates = ecoFeedableSpecies(floor).filter((id) => ecoLayer(ECO.species[id]) === layer &&
    ecoHomeRooms(id).length && (layer !== "pred" || ecoHasPrey(id)));
  let spent = 0;
  let guard = 60;
  const placed = {};
  while (guard-- > 0 && candidates.length && ecoLivingCount() < cap) {
    const affordable = candidates.filter((id) => {
      const species = ECO.species[id];
      const limit = species.breeds?.cap ?? 3;
      return (placed[id] || 0) < limit && spent + ecoUpkeep(species) <= budget;
    });
    if (!affordable.length) break;
    // Big species are rare on any floor that can only just feed them; weighting by the
    // share of the remaining budget a species would take keeps every floor mixed.
    const id = ecoWeighted(affordable.map((entry) => {
      const species = ECO.species[entry];
      const rank = species.rank || 1 + (species.size || 1) / 2;
      return [entry, Math.pow(rank, 1.4) * (placed[entry] ? 0.6 : 1)];
    }));
    if (!id) break;
    if (!ecoPlaceCreature(id, occupied)) {
      candidates.splice(candidates.indexOf(id), 1);
      continue;
    }
    placed[id] = (placed[id] || 0) + 1;
    spent += ecoUpkeep(ECO.species[id]);
  }
  return spent;
}

// Is anything alive here that this hunter eats? Hunters aren't seeded on floors with no prey.
function ecoHasPrey(id) {
  const species = ECO.species[id];
  if (!species.eats.some((kind) => ["small", "large"].includes(kind))) return true; // insects, fish: colonies and pools
  return state.run.enemies.some((enemy) => enemy.alive && ECO.species[enemy.templateId]?.is.some((kind) => species.eats.includes(kind)));
}

// Fills a freshly made floor: herb layer to its fill, then the hunters its prey carries,
// then the scavengers. Called once per floor when the dungeon is made.
function ecoPopulateFloor() {
  const floor = state.run.dungeonFloor || 1;
  const occupied = ecoOccupiedTiles();
  // Anything the layout already placed that the tomb's food feeds is cleared, so the energy
  // budget alone decides who lives here. Spirits, guardians, and bosses stay.
  state.run.enemies = state.run.enemies.filter((enemy) => !ecoIsFed(ECO.species[enemy.templateId]) || enemy.guardian);
  state.run.lurkers = (state.run.lurkers || []).filter((enemy) => !ecoIsFed(ECO.species[enemy.templateId]));
  const budget = ecoFloorBudget(floor);
  const herb = ecoFillLayer("herb", budget * ECO_HERB_FILL, floor, occupied);
  ecoFillLayer("pred", herb * ECO_PRED_SHARE + budget * ECO_PRED_BASE, floor, occupied);
  const use = ecoLayerUse();
  ecoFillLayer("scav", (use.herb + use.pred) * ECO_SCAV_SHARE + budget * ECO_SCAV_BASE, floor, occupied);
  // Species that hide (the ahuizotl under the water, the deer serpent) are lurkers, not walkers.
  if (typeof ecoSortLurkers === "function") ecoSortLurkers();
}

// ---------- Overcrowding ----------

// How full the herb layer is against its budget: 1 is the fill the floor was made with.
function ecoHerbPressure(floor = state.run.dungeonFloor || 1) {
  const use = ecoLayerUse();
  return use.herb / Math.max(1, ecoFloorBudget(floor) * ECO_HERB_FILL);
}

// ---------- Recolonizing a thin layer ----------

// Life climbs the road. When a layer on a floor has been thinned to almost nothing, one
// creature a day may climb up the stairs from the floor below, taken from that floor's own
// population so nothing is made from nothing. The mouth floor has no floor below; it is
// the source, so its migrants come up out of the mouth.
function ecoMigrate(eco) {
  if ((eco.ticks || 0) - (eco.lastMigrant ?? -9999) < 144) return;
  const floor = state.run.dungeonFloor || 1;
  const use = ecoLayerUse();
  const budgets = ecoLayerBudgets(floor, use);
  const layer = ["herb", "pred", "scav"].find((name) => use[name] < budgets[name] * 0.3 &&
    (name === "herb" || use.herb > ecoFloorBudget(floor) * ECO_HERB_FILL * 0.4));
  if (!layer) return;
  const room = budgets[layer] - use[layer];
  const fits = (id) => ecoLayer(ECO.species[id]) === layer && ecoCanFeed(id, floor) && ecoUpkeep(ECO.species[id]) <= room;
  let donor = null;
  let id = null;
  if (floor < DUNGEON_FLOOR_COUNT) {
    const below = state.run.dungeonFloors?.[String(floor + 1)];
    const pool = (below?.enemies || []).filter((enemy) => enemy.alive !== false && !enemy.guardian && fits(enemy.templateId));
    donor = pool[randomInt(pool.length) - 1] || null;
    id = donor?.templateId || null;
    if (!donor) return;
  } else {
    const kinds = Object.keys(ECO.species).filter(fits);
    id = ecoWeighted(kinds.map((kind) => [kind, 1 / (ECO.species[kind].rank || 1)]));
    if (!id) return;
  }
  const stair = (state.run.floorStairs || []).find((entry) => entry.type === "stairs-down") ||
    (state.run.floorStairs || [])[0];
  const origin = stair || state.run.rooms[0];
  const spot = freeTileNear({ x: origin.x ?? origin.anchorX, y: origin.y ?? origin.anchorY }, ecoOccupiedTiles(), 3);
  if (!spot || ecoSeen(spot)) return;
  const roomIndex = Math.max(0, roomIndexAt(spot.x, spot.y));
  const migrant = ecoNewCreature(id, spot, roomIndex);
  if (!migrant) return;
  if (donor) {
    const below = state.run.dungeonFloors[String(floor + 1)];
    below.enemies = below.enemies.filter((enemy) => enemy !== donor);
  }
  state.run.enemies.push(migrant);
  eco.lastMigrant = eco.ticks || 0;
  ecoEvent(roomIndex, `A ${migrant.name} climbed up from below.`, "arrived");
}
