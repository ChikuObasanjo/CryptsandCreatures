"use strict";

// The tomb's energy: where it comes from, how it moves up the food chain, and what that
// lets live on each floor.
//
// Energy comes up out of the mouth in the deepest chamber of floor 13 (the end of the road,
// where the tzitzimitl lies) and thins out on the way to the surface, so each floor can feed
// a fixed amount of life. Everything is counted in one unit, the upkeep point: one unit of
// plant growth, and one day's keep of the smallest creatures. A species' `upkeep` is what it
// eats in a day; a bigger animal costs more to keep, has to eat more often and in bigger
// bites, and in turn is worth more to whatever kills it.
//
//   herb layer   grazers and omnivores, fed by plants:  seeded to ECO_HERB_FILL of the budget
//   pred layer   hunters, fed by the grazers:           a share of the herb layer in use
//   scav layer   scavengers, fed by kills and carcasses: a share of the layers below
//
// Nothing here is a spawn table. A species lives on a floor when the floor can feed a
// breeding pair of it, and the tiered species (the grasshoppers, turkey-raptors, and rabbits
// that graze, the mapachines that scavenge) are pushed off the richer floors by their own
// bigger kin: where a big grazer can live, it strips the beds before the small ones can
// breed. So the tiers sort themselves by depth.
//
// Spirits, guardians, and raiders don't eat the tomb's food, so they aren't counted. The
// great guardians are placed after all of this, whatever the food says.

// Tuning can be overridden before load (tools/tune.js does this to test settings).
const ECO_TUNE = window.CryptsEcoTuning || {};
const ECO_BUDGET_TOP = ECO_TUNE.budgetTop ?? 150;       // upkeep points floor 13 can carry, per chamber-sized share of floor
// Floors are lived on a grid twice as fine as they're planned (systems/grid.js): four times
// the ground, so twice the life. The kinds a floor can feed are still judged per share of
// floor (a jaguar needs the same range it always did), so this changes how many, not which.
const ECO_ROOMINESS = ECO_TUNE.roominess ?? 2;
const ECO_HERB_FILL = ECO_TUNE.herbFill ?? 0.45;        // share of the budget a new floor's herb layer is filled to
const ECO_HERB_CEILING = ECO_TUNE.herbCeiling ?? 0.95;  // the most grazing the plants could ever carry
const ECO_NICHE_HIGH = ECO_TUNE.nicheHigh ?? 0.5;       // a breeding pair of grazers or scavengers has to fit in this share of its layer
const ECO_NICHE_HIGH_PRED = ECO_TUNE.nicheHighPred ?? 1; // hunters are few and far between: a pair (or a lone hunter) may take the whole layer
const ECO_NICHE_LOW = ECO_TUNE.nicheLow ?? 0.26;        // a tiered species whose pair is below this share is outcompeted
const ECO_NICHE_LOW_PRED = ECO_TUNE.nicheLowPred ?? 0.4;
const ECO_PRED_SHARE = ECO_TUNE.predShare ?? 0.35;      // predator upkeep carried per point of herb upkeep in use
const ECO_PRED_BASE = ECO_TUNE.predBase ?? 0.08;        // ...plus this share of the floor budget (carrion, eggs, insects)
const ECO_SCAV_SHARE = ECO_TUNE.scavShare ?? 0.3;       // scavenger upkeep carried per point of herb + pred upkeep in use
const ECO_SCAV_BASE = ECO_TUNE.scavBase ?? 0.05;
const ECO_PLANT_ENERGY = ECO_TUNE.plantEnergy ?? 0.35;  // what one unit of plant growth costs the floor's energy pool
const ECO_POOL_HOURS = 20;                              // how much unspent energy a floor can store, in hours of inflow
const ECO_CROWDED = ECO_TUNE.crowded ?? 1.45;           // herb layer above this share of its fill is overcrowded
const ECO_CROWDED_CLEAR = ECO_TUNE.crowdedClear ?? 1.2; // ...and calms down again below this
const ECO_MEAL_SAT = 30;                                // satiety a full bite gives
const ECO_TICKS_PER_DAY = 144;
const ECO_PREY_DAYS = 3;                                // a kill is worth this many days of the prey's own upkeep
const ECO_GORGED_CAP = 200;                              // a big kill can stuff a hunter well past full

const ECO_LAYER_OF_ROLE = { grazer: "herb", omnivore: "herb", predator: "pred", scavenger: "scav" };

// Share of the mouth's energy that reaches a floor: 1 on floor 13, falling toward the
// surface as one over the distance to the mouth (systems/growth.js).
function ecoFloorShare(floor = state.run?.dungeonFloor || 1) {
  return mouthShare(floor);
}

function ecoFloorBudget(floor = state.run?.dungeonFloor || 1) {
  return ECO_BUDGET_TOP * ECO_ROOMINESS * ecoFloorShare(floor);
}

function ecoLayer(species) {
  if (species?.important) return null;
  return ECO_LAYER_OF_ROLE[species?.role] || null;
}

function ecoUpkeep(species) {
  if (!species) return 0;
  if (Number.isFinite(species.upkeep)) return species.upkeep;
  return Math.max(0.5, (species.appetite || 0.5) * (1 + (species.size || 0)));
}

// ---------- Metabolism ----------
// One rule for everything the food feeds, on screen and off: a creature eats its upkeep in
// a day, in bites that grow with its size, and burns satiety at the rate that takes.

function ecoBite(species) {
  return Math.max(1, Math.round(Math.sqrt(ecoUpkeep(species))));
}

// Satiety lost per ten-minute tick.
function ecoBurn(species) {
  if (!species) return 0;
  if (!ecoIsFed(species)) return species.appetite || 0.2;
  return ECO_MEAL_SAT * ecoUpkeep(species) / (ecoBite(species) * ECO_TICKS_PER_DAY);
}

// Satiety a meal of `units` of food gives this creature (a bite is a full meal).
function ecoMealSatiety(species, units = 1) {
  return ECO_MEAL_SAT * Math.min(2, units / ecoBite(species));
}

// What a kill is worth to the hunter: big prey feeds a big hunter, small prey barely does.
// (A hunter eats a kill over the following days: satiety past 100 is what it has in its belly.)
function ecoKillSatiety(hunterSpecies, preySpecies) {
  const units = ecoUpkeep(preySpecies) * ECO_PREY_DAYS;
  return Math.min(ECO_GORGED_CAP, ECO_MEAL_SAT * units / ecoBite(hunterSpecies));
}

// How many a breeding population needs: lone territorial hunters and big ones keep a range
// to themselves, so one is enough to hold a floor. The tiered grazers always need a pair.
function ecoMinimumPopulation(species) {
  if (species.rank) return 2;
  return species.territorial || (species.size || 0) >= 4 ? 1 : 2;
}

// Is this creature one the tomb's food feeds (as against spirits, guardians, raiders)?
function ecoIsFed(species) {
  return Boolean(ecoLayer(species));
}

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

// What each layer can carry on a floor, given what is alive there now.
function ecoLayerBudgets(floor, use) {
  const budget = ecoFloorBudget(floor);
  return {
    herb: budget * ECO_HERB_CEILING,
    pred: use.herb * ECO_PRED_SHARE + budget * ECO_PRED_BASE,
    scav: (use.herb + use.pred) * ECO_SCAV_SHARE + budget * ECO_SCAV_BASE
  };
}

// What each layer holds on a floor that is seeded and in balance.
function ecoLayerCapacity(floor) {
  const budget = ecoFloorBudget(floor);
  const herb = budget * ECO_HERB_FILL;
  const pred = herb * ECO_PRED_SHARE + budget * ECO_PRED_BASE;
  return { herb, pred, scav: (herb + pred) * ECO_SCAV_SHARE + budget * ECO_SCAV_BASE };
}

// Can this floor feed the species? A breeding population has to fit in its layer, and a
// tiered species must not be so small for the floor that its bigger kin crowd it out.
function ecoCanFeed(id, floor) {
  const species = ECO.species[id];
  const layer = ecoLayer(species);
  if (!layer) return true;
  // (Judged per share of floor: see ECO_ROOMINESS.)
  const capacity = ecoLayerCapacity(floor)[layer] / ECO_ROOMINESS;
  const need = ecoUpkeep(species) * ecoMinimumPopulation(species);
  if (need > capacity * (layer === "pred" ? ECO_NICHE_HIGH_PRED : ECO_NICHE_HIGH)) return false;
  if (species.rank && need < capacity * (layer === "pred" ? ECO_NICHE_LOW_PRED : ECO_NICHE_LOW) && ecoHasBiggerKin(id, floor)) return false;
  return true;
}

// Is there a bigger species of the same layer, tiered like this one, that this floor feeds?
function ecoHasBiggerKin(id, floor) {
  const species = ECO.species[id];
  const layer = ecoLayer(species);
  const capacity = ecoLayerCapacity(floor)[layer] / ECO_ROOMINESS;
  return Object.entries(ECO.species).some(([other, kin]) => other !== id && kin.rank && ecoLayer(kin) === layer &&
    ecoUpkeep(kin) > ecoUpkeep(species) &&
    ecoUpkeep(kin) * ecoMinimumPopulation(kin) <= capacity * (layer === "pred" ? ECO_NICHE_HIGH_PRED : ECO_NICHE_HIGH));
}

// Every creature the floor's food can carry, by id.
function ecoFeedableSpecies(floor) {
  return Object.keys(ECO.species).filter((id) => ecoIsFed(ECO.species[id]) && ecoCanFeed(id, floor));
}

// The floors a species can live on (for the journal and the tools).
function ecoSpeciesFloors(id) {
  const floors = [];
  for (let floor = 1; floor <= DUNGEON_FLOOR_COUNT; floor += 1) if (ecoCanFeed(id, floor)) floors.push(floor);
  return floors;
}

// ---------- Filling a floor, from the plants up ----------

// A chamber a creature may live in, and how well the chamber suits it.
// A species lives where its habitats are; on a floor that has none of them, it makes do with
// any chamber where its food is (grazers by the beds, hunters where their prey lives).
function ecoHomeRooms(id) {
  const species = ECO.species[id];
  const usable = (entry) => entry.room.type !== "boss" && !entry.room.mainTreasure && !entry.room.lore && entry.index > 0;
  const rooms = state.run.rooms.map((room, index) => ({ room, index, habitat: ecoHabitat(room) }));
  const listed = rooms.map((entry) => ({ ...entry, weight: ecoResidents(entry.habitat)[id] || 0 }))
    .filter((entry) => entry.weight > 0 && usable(entry));
  if (listed.length || !species) return listed;
  const feeds = (habitat) => {
    if (!habitat) return false;
    const grows = Object.keys(habitat.resources || {}).some((kind) => species.eats.includes(ECO.resources[kind]?.food));
    const prey = Object.keys(habitat.residents || {}).some((other) => ECO.species[other]?.is?.some((kind) => species.eats.includes(kind)));
    const dead = species.eats.includes("carrion") && habitat.resources?.bones;
    return grows || (species.role === "predator" && prey) || dead;
  };
  return rooms.filter((entry) => usable(entry) && feeds(entry.habitat)).map((entry) => ({ ...entry, weight: 0.5 }));
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
  if (typeof decorateEnemy === "function") decorateEnemy(creature);
  creature.post = { x: spot.x, y: spot.y };
  // Ambushers hide (the ahuizotl under the water, the deer serpent by a trail); sleepers lie
  // on a hoard. Swarms are left to the colonies: the energy decides how many there are.
  const habit = typeof creatureHabit === "function" ? creatureHabit(creature) : "";
  if (habit === "ambusher") {
    creature.stealthDc = 12 + Math.floor((state.run.dungeonFloor || 1) / 3);
    state.run.lurkers ||= [];
    state.run.lurkers.push(creature);
    return creature;
  }
  if (habit === "sleeper" && typeof placeCreature === "function") {
    state.run.enemies.push(...placeCreature(creature, { occupied }));
    return creature;
  }
  state.run.enemies.push(creature);
  return creature;
}

// Seeds one layer: picks species the layer can carry, weighted toward the bigger ones,
// until the budget or the floor's cap is spent.
function ecoFillLayer(layer, budget, floor, occupied) {
  const cap = ecoFloorCap(floor);
  const candidates = ecoFeedableSpecies(floor).filter((id) => ecoLayer(ECO.species[id]) === layer &&
    ecoHomeRooms(id).length && (layer !== "pred" || ecoHasPrey(id)));
  let spent = 0;
  let guard = 80;
  const placed = {};
  while (guard-- > 0 && candidates.length && ecoFedCount() < cap) {
    // The tiered chains are held only by the food; the others (the axolocatl in its pools,
    // the scorpions in the hot chambers) are held by how much of their habitat there is too.
    const affordable = candidates.filter((id) => spent + ecoUpkeep(ECO.species[id]) <= budget &&
      (ECO.species[id].rank || (placed[id] || 0) + ecoLivingCount(id) < ecoSpeciesCap(ECO.species[id])));
    if (!affordable.length) break;
    // A species is seeded as a breeding population, then the others get their turn.
    const id = ecoWeighted(affordable.map((entry) => {
      const species = ECO.species[entry];
      const short = (placed[entry] || 0) < ecoMinimumPopulation(species);
      return [entry, Math.pow(species.rank || 1 + (species.size || 1) / 2, 1.2) * (short && placed[entry] ? 3 : placed[entry] ? 0.5 : 1)];
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
  return [...state.run.enemies, ...(state.run.lurkers || [])].some((enemy) => enemy.alive &&
    ECO.species[enemy.templateId]?.is.some((kind) => species.eats.includes(kind)));
}

// Clears what the tomb's food feeds from a floor, so the energy budget alone decides who
// lives there. Spirits, guardians, and bosses stay.
function ecoClearFed() {
  state.run.enemies = state.run.enemies.filter((enemy) => !ecoIsFed(ECO.species[enemy.templateId]) || enemy.guardian);
  state.run.lurkers = (state.run.lurkers || []).filter((enemy) => !ecoIsFed(ECO.species[enemy.templateId]));
}

// One layer of a floor. The whole tomb is filled a layer at a time (initializeDungeon): the
// grazers of every floor, then the hunters, then the scavengers.
function ecoPopulateLayer(layer) {
  const floor = state.run.dungeonFloor || 1;
  const occupied = ecoOccupiedTiles();
  const budget = ecoFloorBudget(floor);
  const use = ecoLayerUse();
  const target = layer === "herb" ? budget * ECO_HERB_FILL
    : layer === "pred" ? use.herb * ECO_PRED_SHARE + budget * ECO_PRED_BASE
      : (use.herb + use.pred) * ECO_SCAV_SHARE + budget * ECO_SCAV_BASE;
  return ecoFillLayer(layer, Math.max(0, target - use[layer]), floor, occupied);
}

// After the tomb has lived a while at new game, a floor whose herds died out is restocked,
// so a new tomb starts as a working world (hunters too, if they starved with the herds).
function ecoTopUpFloor() {
  const floor = state.run.dungeonFloor || 1;
  const capacity = ecoLayerCapacity(floor);
  const use = ecoLayerUse();
  if (use.herb < capacity.herb * 0.6) ecoFillLayer("herb", capacity.herb * 0.8 - use.herb, floor, ecoOccupiedTiles());
  const after = ecoLayerUse();
  if (after.pred < capacity.pred * 0.3) ecoFillLayer("pred", capacity.pred * 0.6 - after.pred, floor, ecoOccupiedTiles());
}

// A single floor made on its own (an old save): all three layers at once.
function ecoPopulateFloor() {
  ecoClearFed();
  for (const layer of ["herb", "pred", "scav"]) ecoPopulateLayer(layer);
}

// How many animals the floor's food feeds are alive here (the cap on a floor counts these;
// the dead and the guardians don't eat).
function ecoFedCount() {
  return ecoLivingCreatures().filter((creature) => !creature.guardian && ecoIsFed(ecoSpecies(creature))).length;
}

// How many of an untiered species a floor holds at most.
function ecoSpeciesCap(species) {
  return Math.round((species.breeds?.cap ?? 3) * ECO_ROOMINESS);
}

// ---------- Hunting off screen ----------
// Prey is easy to find when the herds are full and hard when they're thin (the last few
// keep to the deep beds and the narrow places). So hunters can't eat a floor bare: their
// luck falls with the herd, and the herd recovers.
function ecoHuntOdds(floor = state.run.dungeonFloor || 1) {
  const pressure = ecoHerbPressure(floor);
  // On the south's days, the dry quarter, hunters range farther.
  return Math.max(0.03, Math.min(1.4, pressure * pressure)) * (lawLeans("south") ? 1.2 : 1);
}

// A starving animal leaves by the nearest stair for a floor that can feed its kind. The
// stairs line up between floors, so it comes out at the same place on the other floor.
function ecoEmigrate(creature) {
  const species = ecoSpecies(creature);
  const floor = state.run.dungeonFloor || 1;
  if (!species || !ecoIsFed(species) || creature.guardian) return false;
  const stairs = (state.run.floorStairs || []).filter((stair) => Number.isInteger(stair.targetFloor) &&
    ecoCanFeed(creature.templateId, stair.targetFloor) && state.run.dungeonFloors?.[String(stair.targetFloor)]);
  if (!stairs.length) return false;
  const stair = stairs.sort((a, b) => distanceInSquares(a, creature) - distanceInSquares(b, creature))[0];
  const target = state.run.dungeonFloors[String(stair.targetFloor)];
  if ((target.enemies || []).filter((enemy) => enemy.alive !== false && !enemy.guardian && ecoIsFed(ECO.species[enemy.templateId])).length >= ecoFloorCap(stair.targetFloor)) return false;
  const arrival = (target.floorStairs || []).find((entry) => entry.x === stair.x && entry.y === stair.y) || target.floorStairs?.[0];
  if (!arrival) return false;
  const walk = (x, y) => ["floor", "corridor", "door"].includes(target.terrain[tileIndex(x, y)]);
  const taken = new Set([...(target.enemies || []), ...(target.lurkers || [])].map((enemy) => tileIndex(enemy.x, enemy.y)));
  let spot = null;
  for (let r = 1; r <= 3 && !spot; r += 1) {
    for (let dy = -r; dy <= r && !spot; dy += 1) for (let dx = -r; dx <= r && !spot; dx += 1) {
      const x = arrival.x + dx; const y = arrival.y + dy;
      if (x > 0 && y > 0 && x < MAP_TILE_SIZE && y < MAP_TILE_SIZE && walk(x, y) && !taken.has(tileIndex(x, y))) spot = { x, y };
    }
  }
  if (!spot) return false;
  state.run.enemies = state.run.enemies.filter((enemy) => enemy !== creature);
  state.run.lurkers = (state.run.lurkers || []).filter((enemy) => enemy !== creature);
  const roomIndex = target.rooms.findIndex((room) => spot.x >= room.mapX && spot.x < room.mapX + room.mapW && spot.y >= room.mapY && spot.y < room.mapY + room.mapH);
  // A new id on the new floor (ids are only unique within a floor).
  target.ecology ||= { nextId: 1 };
  const freshId = `eco-creature-${target.ecology.nextId++}`;
  const moved = { ...creature, id: freshId, x: spot.x, y: spot.y, post: { ...spot }, alerted: false, roomIndex: -1,
    eco: { ...creature.eco, home: Math.max(0, roomIndex), hungerTicks: 0, sat: 20, target: null, route: null } };
  target.enemies = [...(target.enemies || []), moved];
  ecoEvent(roomIndexAt(creature.x, creature.y), `A starving ${creature.name} went ${stair.targetFloor > floor ? "down" : "up"} the stairs.`, "left");
  return true;
}

// ---------- Breeding ----------
// Births are per head: each well-fed adult has a chance each hour, paced by its kind's
// `breeds.every` (ticks per birth per adult). Grazers breed as long as there is food standing
// in the beds, so with no hunters to thin them they overshoot what the plants can keep
// (and turn bold). Hunters and scavengers can only grow as far as the layer below carries.

function ecoBreed(eco, cap) {
  const floor = state.run.dungeonFloor || 1;
  const counts = {};
  for (const creature of ecoLivingCreatures()) counts[creature.templateId] = (counts[creature.templateId] || 0) + 1;
  for (const [id, species] of Object.entries(ECO.species)) {
    if (!species.breeds || species.role === "colony" || !counts[id]) continue;
    const layer = ecoLayer(species);
    const count = counts[id];
    if (count < 2 && ecoMinimumPopulation(species) >= 2) continue;
    const parents = state.run.enemies.filter((enemy) => enemy.alive && enemy.templateId === id && !enemy.alerted &&
      !enemy.guardian && ecoCreature(enemy).sat >= 55 && !ecoIsSick(enemy));
    if (!parents.length) continue;
    let chance = Math.min(0.9, parents.length * ECO_CENSUS_EVERY / species.breeds.every);
    // A herd breeds more slowly as it nears what the plants can feed (a little past the
    // crowding line, so a herd no one hunts does get crowded).
    if (layer === "herb") chance *= Math.max(0, 1 - ecoHerbPressure(floor) / 1.75);
    // On the west's days, the quarter of women and of birth, more young are born.
    if (lawLeans("west")) chance *= 1.25;
    if (Math.random() >= chance) continue;
    if (ecoFedCount() >= cap) return;
    if (layer) {
      const use = ecoLayerUse();
      const room = ecoLayerBudgets(floor, use)[layer] - use[layer];
      if (room < ecoUpkeep(species)) continue;
      // Grazers need a day's food standing for the herd and one more mouth.
      if (layer === "herb" && ecoFoodFor(species, eco) < (count + 1) * ecoUpkeep(species) * 0.75) continue;
    }
    if (!species.rank && count >= ecoSpeciesCap(species)) continue;
    const parent = parents[randomInt(parents.length) - 1];
    const spot = freeTileNear(parent, ecoOccupiedTiles(), 2);
    if (!spot || ecoSeen(spot)) continue;
    const young = ecoNewCreature(id, spot, ecoCreature(parent).home);
    if (!young) continue;
    young.eco.sat = 50;
    // Its parent feeds it while it is small (ecoNurse), until it has grown.
    young.eco.parent = parent.id;
    young.eco.born = eco.ticks || 0;
    // Born knowing some of what its parent learned about you (systems/minds.js).
    if (typeof mindInherit === "function") mindInherit(young, parent);
    state.run.enemies.push(young);
    counts[id] += 1;
    ecoEvent(parent.eco.home, `Young ${ecoName(id)} were born here.`, "born");
  }
}

// ---------- Overcrowding ----------

// How full the herb layer is against its fill: 1 is the fill the floor was made with.
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
  // (In the hours before dawn, when the mouth breathes deepest, the road is busier: that is
  // when the small things set out up it. systems/laws.js)
  const wait = lawBreath() > 1.25 ? ECO_TICKS_PER_DAY / 4 : ECO_TICKS_PER_DAY / 2;
  if ((eco.ticks || 0) - (eco.lastMigrant ?? -9999) < wait) return;
  const floor = state.run.dungeonFloor || 1;
  const use = ecoLayerUse();
  const capacity = ecoLayerCapacity(floor);
  const layer = ["herb", "pred", "scav"].find((name) => use[name] < capacity[name] * 0.4 &&
    (name === "herb" || use.herb > capacity.herb * 0.4));
  if (!layer) return;
  const room = capacity[layer] - use[layer];
  const fits = (id) => ecoLayer(ECO.species[id]) === layer && ecoCanFeed(id, floor) && ecoUpkeep(ECO.species[id]) <= room &&
    (layer !== "pred" || ecoHasPrey(id));
  let donor = null;
  let donorFloor = null;
  let id = null;
  // Mostly from below, up the road; failing that, down from above.
  for (const from of [floor + 1, floor - 1]) {
    const neighbor = state.run.dungeonFloors?.[String(from)];
    if (!neighbor) continue;
    const pool = (neighbor.enemies || []).filter((enemy) => enemy.alive !== false && !enemy.guardian && fits(enemy.templateId));
    // A lone survivor up here draws its own kind: one more makes a pair.
    const lonely = pool.filter((enemy) => ecoLivingCount(enemy.templateId) === 1);
    const choices = lonely.length ? lonely : pool;
    donor = choices[randomInt(choices.length) - 1] || null;
    if (donor) { donorFloor = from; id = donor.templateId; break; }
  }
  // Nothing on the neighboring floors can live here: the mouth gives something back, slowly.
  if (!donor) {
    if (floor !== DUNGEON_FLOOR_COUNT && (eco.ticks || 0) - (eco.lastSourced ?? -9999) < ECO_TICKS_PER_DAY * 3) return;
    const kinds = Object.keys(ECO.species).filter(fits);
    id = ecoWeighted(kinds.map((kind) => [kind, 1 / (ECO.species[kind].rank || 1)]));
    if (!id) return;
    eco.lastSourced = eco.ticks || 0;
  }
  const way = donorFloor && donorFloor < floor ? "stairs-up" : "stairs-down";
  const stair = (state.run.floorStairs || []).find((entry) => entry.type === way) ||
    (state.run.floorStairs || [])[0];
  const origin = stair || state.run.rooms[0];
  const spot = freeTileNear({ x: origin.x ?? origin.anchorX, y: origin.y ?? origin.anchorY }, ecoOccupiedTiles(), 3);
  if (!spot || ecoSeen(spot)) return;
  const roomIndex = Math.max(0, roomIndexAt(spot.x, spot.y));
  const migrant = ecoNewCreature(id, spot, roomIndex);
  if (!migrant) return;
  if (donor) {
    const neighbor = state.run.dungeonFloors[String(donorFloor)];
    neighbor.enemies = neighbor.enemies.filter((enemy) => enemy !== donor);
  }
  state.run.enemies.push(migrant);
  eco.lastMigrant = eco.ticks || 0;
  ecoEvent(roomIndex, donorFloor && donorFloor < floor ? `A ${migrant.name} came down from above.` : `A ${migrant.name} climbed up from below.`, "arrived");
}

// ---------- The Bow: sickness ----------
// Every gathering breeds its own undoing (systems/laws.js). A herd crowded into one chamber,
// a floor with more grazers than its beds can feed, a heap of carrion left lying: each of
// these breeds sickness. It passes between animals of a kind that share a chamber, wears
// them thin, kills some, and leaves the rest proof against it for a while. So a herd with
// no hunters to thin it is thinned anyway, and the scavengers and the dead eat well.

const ECO_SICK_HOURS = [36, 84];        // how long a sickness lasts
const ECO_SICK_IMMUNE_DAYS = 10;        // how long a creature that came through it is safe
const ECO_SICK_DEATH = 0.006;           // chance an hour that a sick creature dies (three times that when starving)
const ECO_SICK_CATCH = 0.015;            // chance an hour to catch it from each sick housemate of its kind

// How many of a kind a chamber holds without crowding: a flock, or a few. (The ones that
// keep a range to themselves settle that with their teeth: ecoDispute.)
function ecoRoomHolds(species) {
  return species.packs ? 4 : 3;
}

function ecoIsSick(creature) {
  return (creature?.eco?.sick || 0) > 0;
}

function ecoSickness(eco) {
  const floor = state.run.dungeonFloor || 1;
  const living = ecoLivingCreatures().filter((creature) => !creature.guardian && creature.eco && ecoIsFed(ecoSpecies(creature)));
  const housed = {};
  const sickHoused = {};
  for (const creature of living) {
    const key = `${creature.templateId}@${creature.eco.home}`;
    housed[key] = (housed[key] || 0) + 1;
    if (ecoIsSick(creature)) sickHoused[key] = (sickHoused[key] || 0) + 1;
  }
  const carrion = {};
  for (const feature of eco.features) if (feature.kind === "carcass") carrion[feature.room] = (carrion[feature.room] || 0) + (feature.meat || 0);
  const overgrazed = lawBow(ecoHerbPressure(floor), 1.2);
  for (const creature of living) {
    const species = ecoSpecies(creature);
    const data = creature.eco;
    const key = `${creature.templateId}@${data.home}`;
    if (ecoIsSick(creature)) {
      data.sick -= 1;
      // It burns through its food faster, and it may not come through.
      data.sat = Math.max(0, data.sat - ecoBurn(species) * ECO_CENSUS_EVERY * 0.5);
      if (Math.random() < ECO_SICK_DEATH * (data.sat < ECO_STARVING ? 3 : 1)) {
        ecoLog(creature, `${creature.name} lies down, sick, and does not get up.`);
        ecoEvent(roomIndexAt(creature.x, creature.y), `A ${creature.name} died of sickness here.`, "sick");
        if ((state.run.lurkers || []).includes(creature)) state.run.lurkers = state.run.lurkers.filter((entry) => entry !== creature);
        ecologyCreatureDied(creature, { sick: true });
        continue;
      }
      if (data.sick <= 0) {
        data.sick = 0;
        data.immune = (eco.ticks || 0) + ECO_SICK_IMMUNE_DAYS * ECO_TICKS_PER_DAY;
      }
      continue;
    }
    if ((data.immune || 0) > (eco.ticks || 0)) continue;
    const crowd = lawBow(housed[key] || 0, ecoRoomHolds(species));
    const herd = ecoLayer(species) === "herb" ? overgrazed : 0;
    // Scavengers are made for the dead; nothing else is.
    const rot = species.role === "scavenger" ? 0 : lawBow(carrion[data.home] || 0, 6);
    const risk = 0.002 * crowd + 0.005 * herd + 0.002 * rot + ECO_SICK_CATCH * (sickHoused[key] || 0);
    if (risk <= 0 || Math.random() >= risk) continue;
    data.sick = ECO_SICK_HOURS[0] + randomInt(ECO_SICK_HOURS[1] - ECO_SICK_HOURS[0]);
    if (!sickHoused[key]) {
      ecoEvent(data.home, `A sickness started among the ${creature.name}s here.`, "sick");
      ecoLog(creature, `${creature.name} is off its food, and its eyes are dull. It is sick.`);
    }
    sickHoused[key] = (sickHoused[key] || 0) + 1;
  }
}

// ---------- The Way: the fed give to their own ----------
// What has too much gives to what has too little (systems/laws.js). A fed parent feeds its
// hungry young from its own belly.
function ecoNurse(eco) {
  const byId = new Map(state.run.enemies.filter((enemy) => enemy.alive).map((enemy) => [enemy.id, enemy]));
  for (const young of state.run.enemies) {
    if (!young.alive || !young.eco?.parent) continue;
    // It is grown in a couple of days, and feeds itself.
    if ((eco.ticks || 0) - (young.eco.born || 0) > 2 * ECO_TICKS_PER_DAY) {
      delete young.eco.parent;
      continue;
    }
    if (young.eco.sat >= ECO_HUNGRY) continue;
    const parent = byId.get(young.eco.parent);
    if (!parent || parent.eco.home !== young.eco.home || ecoIsSick(parent)) continue;
    const gift = lawGive(parent.eco.sat, 70, ECO_HUNGRY + 15 - young.eco.sat, 0.6);
    if (gift < 2) continue;
    parent.eco.sat -= gift;
    young.eco.sat += gift;
    young.eco.hungerTicks = 0;
  }
}
