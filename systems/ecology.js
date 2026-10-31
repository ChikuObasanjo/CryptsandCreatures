"use strict";

// The living tomb. Every floor is a small world: its chambers' habitats come from the lay
// of the land (systems/biome.js), food grows in them, and everything that lives there eats
// something. All of it is data (data/ecology.js).
//
// How it runs, cheaply:
//   every tick (ten minutes)  hunger, regrowth, rot; creatures near you act one by one
//   every 3 ticks             colonies (grasshoppers, ants, beetles, water bugs) grow or
//                             shrink with their food, and are eaten from
//   every 6 ticks (an hour)   the census: births when food is plenty, starvation when it
//                             isn't, moving house, territorial fights, abandoned nests,
//                             gardens spreading or dying back, newcomers into empty habitat
//   away from a floor         the hours are settled in census-sized steps, no movement
//
// Small, numerous life (chapolines, ants, beetles, water bugs) lives as colonies, not as
// creatures: you see them, catch them, and things eat from them, but they never crowd the
// halls. Only the big grasshoppers (hueychapolin) are creatures, and they only band
// together when a big swarm runs out of food.
//
// Each floor keeps a short record of what changed (who moved in, what died, what spread),
// and coming back after a while you're told what's different.

const ECO = window.CryptsEcology;
const ECO_VERSION = 2;
const ECO_TICK_MINUTES = 10;
const ECO_LIVE_TICK_LIMIT = 48;
const ECO_HUNGRY = 55;
const ECO_STARVING = 20;
const ECO_SPIRIT_SATED = 70;
const ECO_SEARCH_RADIUS = 11;
const ECO_COLONY_EVERY = 3;
const ECO_CENSUS_EVERY = 6;
const ECO_MEAT_ITEMS = new Set(["monster-meat", "blindfish", "colotl-tail", "caiman-tail", "turkey-leg", "smoked-fish", "chapulines", "mazacoatl-meat"]);

function ecoSpecies(creature) {
  return ECO.species[creature?.templateId] || null;
}

function ecoState() {
  return state.run?.ecology || null;
}

function ecoFloorCap(floor = state.run?.dungeonFloor || 1) {
  return Math.min(22, 11 + Math.floor(floor * 0.8));
}

// ---------- Habitats ----------

// Older floors (made before the land had a shape) get habitats the old way.
function assignHabitats(rooms, floor = state.run.dungeonFloor || 1) {
  const counts = {};
  const eligible = rooms.map((room, index) => ({ room, index }))
    .filter(({ room, index }) => index > 0 && !room.mainTreasure && !["boss", "exit", "entrance"].includes(room.type));
  for (const { room } of shuffle([...eligible])) {
    if (room.habitat !== undefined) continue;
    if (Math.random() < 0.25) {
      room.habitat = null;
      continue;
    }
    const options = Object.entries(ECO.habitats)
      .filter(([, habitat]) => floor >= habitat.depth[0] && floor <= habitat.depth[1] && habitat.water !== "basin");
    const weighted = options.map(([id, habitat]) => [id, habitat.weight / (1 + 1.5 * (counts[id] || 0))]);
    let id = ecoWeighted(weighted);
    if (!counts["fungal-garden"] && !counts["insect-cavern"]) id = "fungal-garden";
    room.habitat = id;
    counts[id] = (counts[id] || 0) + 1;
  }
  for (const room of rooms) if (room.habitat === undefined) room.habitat = null;
}

function ecoHabitat(room) {
  return room?.habitat ? ECO.habitats[room.habitat] || null : null;
}

function ecoResidents(habitat) {
  if (!habitat?.residents) return {};
  return Array.isArray(habitat.residents) ? Object.fromEntries(habitat.residents.map((id) => [id, 1])) : habitat.residents;
}

function ecoWeighted(entries) {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) return null;
  let roll = Math.random() * total;
  for (const [id, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return id;
  }
  return entries[entries.length - 1]?.[0] || null;
}

// The creature a chamber's habitat would hold, from the creatures this depth allows.
function habitatEncounter(room, allowedIds, usedIds = new Set()) {
  const residents = Object.entries(ecoResidents(ecoHabitat(room)))
    .filter(([id]) => allowedIds.includes(id) && ECO.species[id]?.role !== "colony" &&
      state.pack.enemies.some((enemy) => enemy.id === id))
    .map(([id, weight]) => [id, usedIds.has(id) ? weight * 0.5 : weight]);
  const id = ecoWeighted(residents);
  return id ? state.pack.enemies.find((enemy) => enemy.id === id) : null;
}

function ecoBand() {
  return typeof tombBand === "function" ? tombBand(state.run?.dungeonFloor || 1) : "fortress";
}

// ---------- Placing things ----------

function ecoOccupiedTiles() {
  const taken = new Set();
  const add = (x, y) => taken.add(tileIndex(x, y));
  add(state.run.player.x, state.run.player.y);
  for (const stair of state.run.floorStairs || []) add(stair.x, stair.y);
  for (const list of [state.run.enemies, state.run.lurkers || [], state.run.treasures, state.run.wells || []]) {
    for (const entry of list) if (entry.alive !== false) add(entry.x, entry.y);
  }
  for (const hazard of state.run.hazards || []) if (!hazard.triggered) add(hazard.x, hazard.y);
  for (const feature of ecoState()?.features || []) add(feature.x, feature.y);
  return taken;
}

function ecoFreeTile(room, taken, { water = false } = {}) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const spot = randomRoomFloor(room, taken);
    if (!spot) return null;
    const ground = typeof groundAt === "function" ? groundAt(spot.x, spot.y) : ".";
    if (state.run.terrain[tileIndex(spot.x, spot.y)] !== "floor" || dungeonSignAt(spot.x, spot.y) ||
      (water && ground !== "w")) {
      taken.add(tileIndex(spot.x, spot.y));
      continue;
    }
    return spot;
  }
  return water ? ecoFreeTile(room, taken) : null;
}

// A deep-water tile in a chamber, for the swimmers that wait under the surface.
function ecoDeepTile(roomIndex, taken) {
  const room = state.run.rooms[roomIndex];
  if (!room || typeof groundAt !== "function") return null;
  const options = [];
  for (let y = room.mapY + 1; y < room.mapY + room.mapH - 1; y += 1) {
    for (let x = room.mapX + 1; x < room.mapX + room.mapW - 1; x += 1) {
      if (groundAt(x, y) === "d" && !taken.has(tileIndex(x, y))) options.push({ x, y });
    }
  }
  return options.length ? options[randomInt(options.length) - 1] : null;
}

function ecoAddFeature(kind, spot, roomIndex, extra = {}) {
  const eco = ecoState();
  const resource = ECO.resources[kind] || {};
  const feature = {
    id: `eco-${eco.nextId++}`, kind, x: spot.x, y: spot.y, room: roomIndex,
    amount: resource.max ? Math.max(1, Math.ceil(resource.max * (0.5 + Math.random() * 0.5))) : 0,
    timer: 0, ...extra
  };
  eco.features.push(feature);
  return feature;
}

function ecoAddColony(id, spot, roomIndex, count = null) {
  const colony = ECO.colonies[id];
  if (!colony) return null;
  return ecoAddFeature("colony", spot, roomIndex, {
    species: id, count: count ?? Math.ceil(colony.max * (0.3 + Math.random() * 0.4)), amount: 0
  });
}

function ecoNewCreature(templateId, spot, roomIndex) {
  const template = state.pack.enemies.find((enemy) => enemy.id === templateId);
  if (!template) return null;
  const eco = ecoState();
  const creature = createEnemy(template, spot, roomIndex, 0);
  creature.id = `eco-creature-${eco.nextId++}`;
  if (state.run.mapId === GTFL_MAP_ID) scaleGreatTempleEnemy(creature);
  creature.eco = { sat: 60 + randomInt(30), home: roomIndex };
  return creature;
}

function ecoEvent(roomIndex, text, kind = "") {
  const eco = ecoState();
  if (!eco) return;
  eco.events ||= [];
  eco.events.push({ tick: eco.ticks || 0, room: roomIndex, text, kind });
  if (eco.events.length > 40) eco.events.splice(0, eco.events.length - 40);
}

// ---------- Setting up a floor ----------

// Lays out the food, water, colonies, nests, and shrines, gives every creature an appetite,
// and sets a few scenes already under way. New floors and older saves alike.
function initializeEcology() {
  const floor = state.run.dungeonFloor || 1;
  const preset = state.run.ecology && typeof state.run.ecology === "object" ? state.run.ecology : null;
  state.run.ecology = {
    version: ECO_VERSION, minute: state.run.gameMinutes || 0, nextId: 1, features: [], breed: {}, rich: {},
    ticks: 0, events: [], ground: typeof preset?.ground === "string" ? preset.ground : null
  };
  const eco = state.run.ecology;
  if (state.run.rooms.some((room) => room.habitat === undefined)) assignHabitats(state.run.rooms, floor);
  if (!eco.ground && typeof dressFloorGround === "function") {
    // An older floor: lay the ground now, but no deep water (things already stand there).
    eco.ground = dressFloorGround(state.run.rooms, state.run.terrain, { streams: [] }).replace(/d/g, "w");
  }
  const taken = ecoOccupiedTiles();
  state.run.rooms.forEach((room, index) => {
    const habitat = ecoHabitat(room);
    if (!habitat) return;
    for (const [kind, [low, high]] of Object.entries(habitat.resources || {})) {
      const count = low + randomInt(high - low + 1) - 1;
      for (let n = 0; n < count; n += 1) {
        const spot = ecoFreeTile(room, taken, { water: kind === "pool" });
        if (!spot) break;
        taken.add(tileIndex(spot.x, spot.y));
        ecoAddFeature(kind, spot, index, kind === "nest" ? { owner: ecoNestOwner(index, habitat) } : {});
      }
    }
    for (const [kind, rule] of Object.entries(habitat.features || {})) {
      if (floor < (rule.minFloor || 1) || Math.random() > rule.chance) continue;
      const spot = ecoFreeTile(room, taken);
      if (!spot) continue;
      taken.add(tileIndex(spot.x, spot.y));
      ecoAddFeature(kind, spot, index, kind === "mouth" ? { hunger: 30 + randomInt(40) } : { appeased: false });
    }
    for (const [id, [low, high]] of Object.entries(habitat.colonies || {})) {
      const count = low + randomInt(high - low + 1) - 1;
      for (let n = 0; n < count; n += 1) {
        const spot = ecoFreeTile(room, taken, { water: id === "ahuauhtli" });
        if (!spot) break;
        taken.add(tileIndex(spot.x, spot.y));
        ecoAddColony(id, spot, index);
      }
    }
  });
  // Older saves: the little grasshoppers become a swarm on the nearest food.
  const loose = state.run.enemies.filter((enemy) => enemy.templateId === "chapolin");
  if (loose.length) {
    state.run.enemies = state.run.enemies.filter((enemy) => enemy.templateId !== "chapolin");
    const food = eco.features.find((feature) => ["fungus", "plants"].includes(feature.kind));
    if (food && !eco.features.some((feature) => feature.kind === "colony" && feature.species === "chapolin" && feature.room === food.room)) {
      const spot = ecoFreeTile(state.run.rooms[food.room], taken);
      if (spot) ecoAddColony("chapolin", spot, food.room, Math.min(12, loose.length * 3));
    }
  }
  for (const creature of [...state.run.enemies, ...(state.run.lurkers || [])]) ecoCreature(creature);
  ecoSetScenes();
}

function ecoNestOwner(roomIndex, habitat) {
  const residents = Object.keys(ecoResidents(habitat));
  const present = state.run.enemies.find((enemy) => enemy.alive && residents.includes(enemy.templateId) && enemy.roomIndex === roomIndex);
  return present?.templateId || residents.find((id) => ["colotl", "axolocatl"].includes(id)) || null;
}

function ecoCreature(creature) {
  if (!creature.eco || typeof creature.eco !== "object") {
    const home = Number.isInteger(creature.roomIndex) && creature.roomIndex >= 0 ? creature.roomIndex : roomIndexAt(creature.x, creature.y);
    creature.eco = { sat: 55 + randomInt(35), home };
  }
  if (!Number.isFinite(creature.eco.sat)) creature.eco.sat = 70;
  return creature.eco;
}

// Older saves and floors made before the tomb came alive get their ecology on first visit.
function ensureEcology() {
  if (state.run?.location !== "dungeon" || !Array.isArray(state.run.rooms)) return null;
  const eco = state.run.ecology;
  if (!eco || typeof eco !== "object" || !Array.isArray(eco.features) || (eco.version !== 1 && eco.version !== ECO_VERSION)) {
    initializeEcology();
  } else if (eco.version === 1) {
    ecoUpgradeFromV1(eco);
  }
  return state.run.ecology;
}

// Build 28 floors: keep their gardens and carcasses, turn the grasshoppers into a swarm,
// and lay the ground.
function ecoUpgradeFromV1(eco) {
  eco.version = ECO_VERSION;
  eco.ticks ||= 0;
  eco.events ||= [];
  eco.rich ||= {};
  if (!eco.ground && typeof dressFloorGround === "function") {
    eco.ground = dressFloorGround(state.run.rooms, state.run.terrain, { streams: [] }).replace(/d/g, "w");
  }
  const loose = state.run.enemies.filter((enemy) => enemy.templateId === "chapolin");
  state.run.enemies = state.run.enemies.filter((enemy) => enemy.templateId !== "chapolin");
  const taken = ecoOccupiedTiles();
  const gardens = new Set(eco.features.filter((feature) => ["fungus", "plants"].includes(feature.kind)).map((feature) => feature.room));
  for (const roomIndex of gardens) {
    if (!loose.length && Math.random() < 0.5) continue;
    const spot = ecoFreeTile(state.run.rooms[roomIndex], taken);
    if (!spot) continue;
    taken.add(tileIndex(spot.x, spot.y));
    ecoAddColony("chapolin", spot, roomIndex, 6 + randomInt(6));
  }
}

// A few things already under way when you arrive: a hunter on its kill with a scavenger
// waiting, two hunters disputing a den.
function ecoSetScenes() {
  const taken = ecoOccupiedTiles();
  const hunters = state.run.enemies.filter((enemy) => enemy.alive && !enemy.guardian &&
    ecoSpecies(enemy)?.role === "predator" && ecoSpecies(enemy).size >= 2 && distanceInSquares(enemy, state.run.player) > 8);
  // A fresh kill.
  if (hunters.length && Math.random() < 0.7) {
    const hunter = hunters[randomInt(hunters.length) - 1];
    const species = ecoSpecies(hunter);
    const preyId = shuffle(Object.entries(ECO.species)).find(([id, prey]) => prey.size > 0 && prey.size < species.size &&
      prey.is.some((kind) => species.eats.includes(kind)) && prey.role !== "colony" && state.pack.enemies.some((enemy) => enemy.id === id))?.[0];
    const spot = preyId ? freeTileNear(hunter, taken, 1) : null;
    if (spot) {
      taken.add(tileIndex(spot.x, spot.y));
      const prey = ECO.species[preyId];
      ecoAddFeature("carcass", spot, roomIndexAt(spot.x, spot.y), {
        species: preyId, meat: prey.size * 2 - 1, tonalli: 2, age: 2, fresh: true,
        maxMeat: prey.size * 2 - 1,
        edible: Boolean(prey.meat && state.pack.enemies.find((enemy) => enemy.id === preyId)?.edible)
      });
      ecoCreature(hunter).sat = 75;
      hunter.eco.feeding = 6 + randomInt(6);
      // Something that eats the dead has smelled it and waits its turn.
      const wait = greatTempleEncounterIds().includes("xolo-hound") && state.run.enemies.length < ecoFloorCap() && Math.random() < 0.6
        ? randomMapFloorNear(spot, taken, 3, 4) : null;
      if (wait) {
        taken.add(tileIndex(wait.x, wait.y));
        const dog = ecoNewCreature("xolo-hound", wait, roomIndexAt(wait.x, wait.y));
        if (dog) {
          dog.eco.sat = 25;
          state.run.enemies.push(dog);
        }
      }
    }
  }
  // Two hunters disputing one den.
  const dens = state.run.rooms.map((room, index) => index).filter((index) => ecoHabitat(state.run.rooms[index])?.territory);
  if (dens.length && Math.random() < 0.35 && state.run.enemies.length < ecoFloorCap() - 1) {
    const index = dens[randomInt(dens.length) - 1];
    const owner = state.run.enemies.find((enemy) => enemy.alive && ecoSpecies(enemy)?.territorial && ecoCreature(enemy).home === index);
    const spot = owner ? freeTileNear(owner, taken, 3) : null;
    if (owner && spot) {
      const rival = ecoNewCreature(owner.templateId, spot, index);
      if (rival) {
        rival.eco.sat = 40;
        state.run.enemies.push(rival);
        owner.eco.rival = rival.id;
        rival.eco.rival = owner.id;
      }
    }
  }
}

// ---------- Hunger and temperament ----------

function ecoHungerState(creature) {
  const species = ecoSpecies(creature);
  if (!species || !creature.eco) return "";
  const sat = creature.eco.sat;
  if (sat < ECO_STARVING) return "starving";
  if (sat < (species.role === "spirit" ? ECO_SPIRIT_SATED : ECO_HUNGRY)) return "hungry";
  if (sat >= 92) return "gorged";
  return "fed";
}

// True when a creature isn't interested in you right now (it may still fight back).
function ecologyIgnoresPlayer(creature, distance = distanceInSquares(creature, state.run.player)) {
  if (creature?.friendly) return true;
  if (typeof isBeast === "function" && isBeast(creature) && typeof activeBuff === "function" && activeBuff("xochipilli-friendship")) return true;
  if (typeof crossSparesCreature === "function" && crossSparesCreature(creature)) return true;
  const species = ecoSpecies(creature);
  if (!species || !creature.eco || creature.provoked || creature.guardian) return false;
  if (ecoDefendsNest(creature)) return false;
  if (species.temperament === "wary") return true;
  // A chaneque's revenge is fright, not a fight; a robbed alux throws stones.
  if (species.temperament === "neutral") return species.offended === "stones" ? !creature.eco.offended : true;
  if (creature.asleep && creature.eco.sleeping) return true;
  const hunger = ecoHungerState(creature);
  if (species.role === "spirit") return hunger === "fed" || hunger === "gorged";
  if (species.temperament === "hungry") return hunger === "fed" || hunger === "gorged" || (hunger === "hungry" && distance > 3);
  return false;
}

// A creature is a threat if it's alive and not minding its own business.
function creatureIsThreat(creature) {
  if (!creature?.alive || creature.friendly) return false;
  if (creature.alerted) return true;
  return !ecologyIgnoresPlayer(creature);
}

function ecologyNoticeModifier(creature) {
  const hunger = ecoHungerState(creature);
  let modifier = hunger === "starving" ? 1 : hunger === "gorged" ? -2 : 0;
  if (typeof hasCondition === "function" && hasCondition("ill-omened")) modifier += 1;
  return modifier;
}

function ecologyAttackModifier(creature) {
  return ecoHungerState(creature) === "starving" ? -2 : 0;
}

function ecologyAcModifier(creature) {
  return ecoHungerState(creature) === "starving" ? -1 : 0;
}

function ecologyDamageBonus(creature) {
  return ecoDefendsNest(creature) ? 2 : 0;
}

function ecoDefendsNest(creature) {
  const eco = ecoState();
  if (!eco || !creature?.eco) return false;
  return eco.features.some((feature) => feature.kind === "nest" && feature.disturbed &&
    feature.owner === creature.templateId && distanceInSquares(feature, creature) <= 6);
}

// In a fight, animals don't fight to the death: below their limit they break off and run,
// unless they're defending a nest, cornered in their own den, or bound to guard.
function ecologyShouldFlee(creature) {
  const species = ecoSpecies(creature);
  if (!species || !species.flees || creature.guardian || creature.elite || creature.eco?.fledOnce) return false;
  if (species.role === "spirit") return false;
  if (ecoDefendsNest(creature)) return false;
  const limit = species.territorial && roomIndexAt(creature.x, creature.y) === creature.eco?.home ? species.flees / 2 : species.flees;
  return creature.hp <= Math.ceil(creature.maxHp * limit);
}

// ---------- Finding food ----------

function ecoTargetValid(creature, target) {
  if (!target) return false;
  if (target.creature) {
    const prey = state.run.enemies.find((enemy) => enemy.id === target.creature);
    return Boolean(prey && prey.alive && !prey.alerted && distanceInSquares(prey, creature) <= ECO_SEARCH_RADIUS + 2);
  }
  if (target.feature) {
    const feature = ecoState().features.find((entry) => entry.id === target.feature);
    return Boolean(feature && ecoFeatureFeeds(feature, ecoSpecies(creature)));
  }
  if (target.treasure) {
    const cache = state.run.treasures.find((entry) => entry.id === target.treasure);
    return Boolean(cache && ecoCacheFood(cache, ecoSpecies(creature)));
  }
  return false;
}

function ecoFeatureFeeds(feature, species) {
  if (!species) return false;
  const eats = species.eats;
  if (feature.kind === "carcass") {
    if (feature.meat > 0 && eats.includes("carrion")) return true;
    return feature.tonalli > 0 && eats.includes("tonalli");
  }
  if (feature.kind === "colony") {
    const colony = ECO.colonies[feature.species];
    return Boolean(colony && feature.count >= 3 && colony.is.some((kind) => eats.includes(kind)));
  }
  const resource = ECO.resources[feature.kind];
  return Boolean(resource?.food && feature.amount > 0 && eats.includes(resource.food));
}

// The food in a dropped cache a creature would eat: provisions, or meat for meat-eaters.
function ecoCacheFood(cache, species) {
  if (!cache?.dropped || !species) return null;
  const meatEater = species.eats.some((kind) => ["carrion", "small", "large", "fish"].includes(kind));
  return cache.items.find((item) => item.quantity > 0 && FOOD_ITEMS[item.id] &&
    ((species.eats.includes("provisions") && !ECO_MEAT_ITEMS.has(item.id)) ||
      ((species.eats.includes("provisions") || meatEater) && ECO_MEAT_ITEMS.has(item.id)))) || null;
}

function ecoCanHunt(hunter, prey, species) {
  if (prey === hunter || !prey.alive || prey.alerted || prey.guardian) return false;
  const preySpecies = ecoSpecies(prey);
  if (!preySpecies || preySpecies.role === "guardian" || !preySpecies.is.some((kind) => species.eats.includes(kind))) return false;
  // The ahuizotl hunts from the water: it only takes what comes to the edge.
  if (hunter.templateId === "cenote-stalker" && !ecoAtWater(prey)) return false;
  // Insect-eaters take any insect; otherwise hunters take smaller prey (or an equal, if starving).
  if (preySpecies.is.includes("insects") && species.eats.includes("insects")) return true;
  const starving = ecoHungerState(hunter) === "starving";
  return preySpecies.size < species.size || (starving && preySpecies.size <= species.size);
}

function ecoAtWater(spot) {
  if (typeof groundAt !== "function") return false;
  for (const direction of [{ x: 0, y: 0 }, ...MOVEMENT_DIRECTIONS]) {
    const ground = groundAt(spot.x + direction.x, spot.y + direction.y);
    if (ground === "d" || ground === "w") return true;
  }
  return false;
}

function ecoFindFood(creature, species, radius = ECO_SEARCH_RADIUS) {
  const eco = ecoState();
  const near = (spot) => distanceInSquares(spot, creature) <= radius;
  const options = [];
  // The smell of death carries: scavengers and the restless dead find bodies from much farther off.
  const scentRange = species.role === "scavenger" || species.role === "spirit" ? 22 : ECO_SEARCH_RADIUS;
  for (const feature of eco.features) {
    const range = feature.kind === "carcass" ? Math.max(scentRange, radius) : radius;
    if (distanceInSquares(feature, creature) <= range && ecoFeatureFeeds(feature, species)) {
      options.push({ feature: feature.id, x: feature.x, y: feature.y });
    }
  }
  for (const cache of state.run.treasures) {
    if (near(cache) && ecoCacheFood(cache, species)) options.push({ treasure: cache.id, x: cache.x, y: cache.y, bait: true });
  }
  if (species.role === "predator" || species.eats.some((kind) => ["small", "large"].includes(kind))) {
    for (const prey of state.run.enemies) {
      if (near(prey) && ecoCanHunt(creature, prey, species)) options.push({ creature: prey.id, x: prey.x, y: prey.y });
    }
  }
  if (!options.length) return null;
  // Bait first (the smell carries), then whatever's closest.
  options.sort((a, b) => (b.bait ? 1 : 0) - (a.bait ? 1 : 0) || distanceInSquares(a, creature) - distanceInSquares(b, creature));
  return options[0];
}

// ---------- Moving ----------

// A route through the rooms and corridors (doors count as passable for door-openers).
function ecoRoute(creature, target, catchUp) {
  const player = state.run.player;
  const doors = ecoCanOpenDoors(creature);
  const queue = [{ x: creature.x, y: creature.y, previous: null }];
  const visited = new Set([tileIndex(creature.x, creature.y)]);
  for (let cursor = 0; cursor < queue.length && cursor < 1800; cursor += 1) {
    const current = queue[cursor];
    if (distanceInSquares(current, target) <= 1 && current.previous) {
      const path = [];
      for (let node = current; node.previous; node = node.previous) path.unshift({ x: node.x, y: node.y });
      return path.slice(0, 24);
    }
    for (const direction of MOVEMENT_DIRECTIONS) {
      const spot = { x: current.x + direction.x, y: current.y + direction.y };
      const index = tileIndex(spot.x, spot.y);
      if (spot.x < 0 || spot.y < 0 || spot.x >= MAP_TILE_SIZE || spot.y >= MAP_TILE_SIZE || visited.has(index)) continue;
      const closedDoor = state.run.terrain[index] === "door" && !state.run.openDoors.includes(index);
      if (closedDoor ? (!doors || Math.abs(direction.x) + Math.abs(direction.y) !== 1) : !canStepBetween(current, spot, creature)) continue;
      if (spot.x === player.x && spot.y === player.y) continue;
      if (catchUp && distanceInSquares(spot, player) <= 4) continue;
      visited.add(index);
      queue.push({ ...spot, previous: current });
    }
  }
  return null;
}

function ecoTakeStep(creature, spot) {
  const index = tileIndex(spot.x, spot.y);
  if (state.run.terrain[index] === "door" && !state.run.openDoors.includes(index)) {
    // Shouldering a door open takes the turn.
    state.run.openDoors.push(index);
    return true;
  }
  return moveCreature(creature, spot);
}

function ecoStep(creature, target, { catchUp = false, away = false } = {}) {
  const player = state.run.player;
  const data = creature.eco;
  if (!away) {
    // Follow a planned route; plan a new one when there isn't one or the goal has moved.
    const goalKey = `${target.x},${target.y}`;
    if (!data.route?.length || data.routeGoal !== goalKey) {
      data.route = distanceInSquares(creature, target) <= 1 ? [] : ecoRoute(creature, target, catchUp) || [];
      data.routeGoal = goalKey;
    }
    const next = data.route?.[0];
    if (!next) return false;
    if (tileHasCreature(next.x, next.y, creature) || (next.x === player.x && next.y === player.y) ||
      (catchUp && distanceInSquares(next, player) <= 4)) {
      data.route = null;
      return false;
    }
    data.route.shift();
    return ecoTakeStep(creature, next);
  }
  let best = null;
  let bestScore = distanceInSquares(creature, target);
  for (const direction of shuffle(MOVEMENT_DIRECTIONS)) {
    const spot = { x: creature.x + direction.x, y: creature.y + direction.y };
    if (!canStepBetween(creature, spot) || tileHasCreature(spot.x, spot.y, creature) ||
      (spot.x === player.x && spot.y === player.y)) continue;
    if (catchUp && distanceInSquares(spot, player) <= 4 && distanceInSquares(creature, player) > 4) continue;
    const score = distanceInSquares(spot, target);
    if (score > bestScore) {
      best = spot;
      bestScore = score;
    }
  }
  return best ? moveCreature(creature, best) : false;
}

// Everything but the smallest things can push a tomb door open.
function ecoCanOpenDoors(creature) {
  return !["chapolin", "maquizcoatl"].includes(creature.templateId);
}

function ecoSeen(spot) {
  return state.run?.location === "dungeon" && distanceInSquares(spot, state.run.player) <= 8 && hasLineOfSight(state.run.player, spot);
}

function ecoLog(spot, text) {
  if (ecoSeen(spot)) addLog(text);
}

// ---------- Eating ----------

function ecoFeed(creature, amount, ticks = 2) {
  creature.eco.sat = Math.min(100, creature.eco.sat + amount);
  creature.eco.feeding = ticks;
  creature.eco.target = null;
  const species = ecoSpecies(creature);
  // Big snakes and caimans sleep off a big meal.
  if (species?.sleepsAfter && creature.eco.sat >= 90 && !creature.alerted) {
    creature.asleep = species.sleepsAfter;
    creature.eco.sleeping = true;
    ecoLog(creature, `${creature.name} settles down, heavy with its meal, and goes still.`);
  }
}

function ecoEatFeature(creature, species, feature) {
  const resource = ECO.resources[feature.kind] || {};
  const portion = 30 + 12 * Math.max(1, Math.min(3, species.size));
  if (feature.kind === "carcass") {
    if (feature.meat > 0 && species.eats.includes("carrion")) {
      feature.meat -= 1;
      ecoFeed(creature, portion, 3);
      ecoWitness(creature, creature.templateId, "eats:carrion");
      ecoLog(creature, `${creature.name} tears into the ${feature.species ? `${ecoName(feature.species)} ` : ""}carcass.`);
      return;
    }
    feature.tonalli = Math.max(0, (feature.tonalli || 0) - 1);
    ecoFeed(creature, 40, 2);
    ecoWitness(creature, creature.templateId, "eats:tonalli");
    ecoLog(creature, `${creature.name} bends over the dead and drinks in what's left of its life.`);
    return;
  }
  if (feature.kind === "colony") {
    const colony = ECO.colonies[feature.species];
    const taken = Math.min(feature.count, 2 + randomInt(3));
    feature.count -= taken;
    ecoFeed(creature, 15 * taken, 2);
    ecoWitness(creature, creature.templateId, `eats:${feature.species}`);
    ecoWitness(creature, feature.species, `huntedBy:${creature.templateId}`);
    ecoLog(creature, `${creature.name} snaps up ${feature.species === "chapolin" ? "grasshoppers" : colony.name.toLowerCase()} from the swarm.`);
    return;
  }
  feature.amount -= 1;
  if (feature.kind === "offering") {
    ecoFeed(creature, 50, 2);
    ecoWitness(creature, creature.templateId, "eats:tonalli");
    ecoLog(creature, `${creature.name} lingers over the offering bowl.`);
    return;
  }
  ecoFeed(creature, portion, 2);
  ecoWitness(creature, creature.templateId, `eats:${resource.food}`);
  ecoLog(creature, feature.kind === "pool" ? `${creature.name} snaps a fish out of the pool.`
    : `${creature.name} feeds at the ${resource.name.toLowerCase()}.`);
}

function ecoEatCache(creature, species, cache) {
  const item = ecoCacheFood(cache, species);
  if (!item) return;
  item.quantity -= 1;
  cache.items = cache.items.filter((entry) => entry.quantity > 0);
  if (!cache.items.length && !cache.gold) state.run.treasures = state.run.treasures.filter((entry) => entry !== cache);
  ecoFeed(creature, 55, 3);
  ecoWitness(creature, creature.templateId, "eats:provisions");
  ecoLog(creature, `${creature.name} finds the ${itemDetails(item.id).name} you left and eats it.`);
}

function ecoName(templateId) {
  return state.pack.enemies.find((enemy) => enemy.id === templateId)?.name || ECO.colonies[templateId]?.name || "creature";
}

function ecoHunt(creature, species, prey) {
  const roll = randomInt(20) + (creature.attackBonus || 0) + ecologyAttackModifier(creature);
  ecoWitness(prey, creature.templateId, `hunts:${prey.templateId}`);
  ecoWitness(prey, prey.templateId, `huntedBy:${creature.templateId}`);
  if (roll < prey.ac + ecologyAcModifier(prey)) {
    ecoLog(prey, `${creature.name} lunges at ${prey.name} and misses.`);
    ecoCreature(prey).flee = 3;
    prey.eco.fleeFrom = creature.id;
    return;
  }
  const damage = Math.max(1, rollDice(creature.damage).total);
  prey.hp = Math.max(0, prey.hp - damage);
  if (prey.hp > 0) {
    ecoLog(prey, `${creature.name} wounds ${prey.name}, which bolts.`);
    ecoCreature(prey).flee = 4;
    prey.eco.fleeFrom = creature.id;
    return;
  }
  ecoLog(prey, `${creature.name} kills ${prey.name}${species.size >= 3 ? " and starts to feed" : ""}.`);
  ecologyCreatureDied(prey, { eaten: true, killer: creature });
  const carcass = ecoState().features.find((feature) => feature.kind === "carcass" && feature.x === prey.x && feature.y === prey.y && feature.fresh);
  if (carcass && carcass.meat > 0) carcass.meat -= 1;
  ecoEvent(roomIndexAt(prey.x, prey.y), `A ${creature.name} killed a ${prey.name} here.`, "kill");
  ecoFeed(creature, 70, 3);
  creature.eco.hunting = false;
}

// A creature died (to you, to something else, to hunger, or to a trap). It leaves a body
// that feeds scavengers and, while fresh, the restless dead.
function ecologyCreatureDied(creature, { eaten = false, killer = null } = {}) {
  const eco = ecoState();
  if (!eco) return;
  creature.alive = false;
  creature.lootDropped = eaten ? true : creature.lootDropped;
  const species = ecoSpecies(creature);
  if (creature.templateId === "alux") {
    // Clay doesn't die: it crumbles and is made again at its house.
    eco.reform ||= [];
    eco.reform.push({ tick: (eco.ticks || 0) + 48, home: creature.eco?.home ?? roomIndexAt(creature.x, creature.y) });
    ecoLog(creature, "The alux crumbles to clay. It will be made again.");
    return;
  }
  if (creature.templateId === "maquizcoatl" && !killer && !eaten) {
    if (typeof applyCondition === "function") applyCondition("ill-omened", "The omen serpent");
    addLog("You killed the omen serpent, a bad sign. For a while, creatures will notice you sooner.");
  }
  if (!species || species.size <= 0) return;
  ecoAddFeature("carcass", { x: creature.x, y: creature.y }, roomIndexAt(creature.x, creature.y), {
    species: creature.templateId, meat: species.size * 2, tonalli: 3, age: 0, fresh: true,
    maxMeat: species.size * 2,
    edible: Boolean(creature.edible && species.meat), drowned: killer?.templateId === "cenote-stalker"
  });
}

// ---------- A creature's turn when it isn't after you ----------

// Returns true when the ecology handled the creature's turn.
function ecologyIdle(creature, { catchUp = false } = {}) {
  const species = ecoSpecies(creature);
  if (!species || !creature.alive) return false;
  const eco = ecoCreature(creature);
  if (creature.asleep) {
    // Even a sleeper wakes when it's starving.
    if (eco.sat < 10 && (creature.deepSleep || eco.sleeping)) {
      creature.asleep = 0;
      creature.deepSleep = false;
      eco.sleeping = false;
    } else {
      return true;
    }
  }
  if (eco.feeding > 0) {
    eco.feeding -= 1;
    return true;
  }
  // Prey runs from whatever is hunting it.
  if (eco.flee > 0) {
    eco.flee -= 1;
    const from = state.run.enemies.find((enemy) => enemy.id === eco.fleeFrom && enemy.alive) || state.run.player;
    ecoStep(creature, from, { catchUp, away: true });
    return true;
  }
  const player = state.run.player;
  const toPlayer = distanceInSquares(creature, player);
  if (!catchUp && species.temperament === "wary" && toPlayer <= 2 && !creature.provoked) {
    ecoStep(creature, player, { away: true });
    return true;
  }
  // A rival in the den: they face off until one gives way.
  if (eco.rival && ecoDispute(creature, eco, catchUp)) return true;
  // A banded swarm moves on together to a garden it hasn't stripped.
  if (creature.band) ecoBandMoves(creature);
  const hunger = ecoHungerState(creature);
  const hungry = hunger === "hungry" || hunger === "starving";
  if (hungry || (eco.target && eco.sat < 80)) {
    if (!ecoTargetValid(creature, eco.target) || (eco.retarget = (eco.retarget || 0) + 1) > 5) {
      eco.target = ecoFindFood(creature, species);
      // Starving, it leaves home and goes looking wherever the food is.
      if (!eco.target && hunger === "starving") eco.target = ecoFindFood(creature, species, MAP_TILE_SIZE);
      eco.retarget = 0;
    }
    const target = eco.target;
    if (target) {
      eco.hunting = Boolean(target.creature);
      if (target.creature) {
        const prey = state.run.enemies.find((enemy) => enemy.id === target.creature);
        if (distanceInSquares(prey, creature) <= 1) ecoHunt(creature, species, prey);
        else ecoStep(creature, prey, { catchUp });
        return true;
      }
      const spot = target.feature ? ecoState().features.find((entry) => entry.id === target.feature)
        : state.run.treasures.find((entry) => entry.id === target.treasure);
      // Scavengers wait their turn while a bigger hunter is still at the kill.
      if (spot?.kind === "carcass" && species.role === "scavenger" && ecoHunterAtKill(spot, creature)) {
        eco.waiting = true;
        if (distanceInSquares(spot, creature) < 3) ecoStep(creature, spot, { catchUp, away: true });
        else if (distanceInSquares(spot, creature) > 4) ecoStep(creature, spot, { catchUp });
        return true;
      }
      eco.waiting = false;
      if (distanceInSquares(spot, creature) <= 1) {
        if (target.feature) ecoEatFeature(creature, species, spot);
        else ecoEatCache(creature, species, spot);
      } else {
        ecoStep(creature, spot, { catchUp });
      }
      return true;
    }
  }
  eco.hunting = false;
  eco.waiting = false;
  // Wanderers keep their own errands; everyone else stays near home and potters about.
  if (typeof creatureHabit === "function" && creatureHabit(creature) === "wanderer") return false;
  const homeRoom = state.run.rooms[eco.home];
  if (homeRoom && roomIndexAt(creature.x, creature.y) !== eco.home && Math.random() < 0.5) {
    const anchor = { x: homeRoom.anchorX ?? homeRoom.mapX + Math.floor(homeRoom.mapW / 2), y: homeRoom.anchorY ?? homeRoom.mapY + Math.floor(homeRoom.mapH / 2) };
    ecoStep(creature, anchor, { catchUp });
    return true;
  }
  if (hunger !== "gorged" && Math.random() < (species.role === "grazer" ? 0.35 : 0.15)) {
    const step = creatureRandomStep(creature);
    if (step && roomIndexAt(step.x, step.y) === roomIndexAt(creature.x, creature.y) &&
      !(catchUp && distanceInSquares(step, player) <= 4)) moveCreature(creature, step);
  }
  return true;
}

function ecoHunterAtKill(carcass, scavenger) {
  const size = ecoSpecies(scavenger)?.size || 0;
  return state.run.enemies.some((enemy) => enemy.alive && enemy !== scavenger && enemy.eco?.feeding > 0 &&
    distanceInSquares(enemy, carcass) <= 1 && (ecoSpecies(enemy)?.size || 0) >= size && ecoSpecies(enemy)?.role === "predator");
}

// Two territorial creatures in one den: they close, trade blows, and the weaker gives way.
function ecoDispute(creature, eco, catchUp) {
  const rival = state.run.enemies.find((enemy) => enemy.id === eco.rival && enemy.alive);
  if (!rival || creature.alerted) {
    eco.rival = null;
    return false;
  }
  if (distanceInSquares(creature, rival) > 1) {
    ecoStep(creature, rival, { catchUp });
    if (!eco.disputeSeen && ecoSeen(creature)) {
      eco.disputeSeen = true;
      addLog(`${creature.name} and a rival of its own kind circle each other, hackles up. Neither is giving up this den.`);
      ecoObserve(creature.templateId, "territorial");
    }
    return true;
  }
  const roll = randomInt(20) + (creature.attackBonus || 0);
  if (roll >= rival.ac) {
    const damage = Math.max(1, Math.floor(rollDice(creature.damage).total / 2));
    rival.hp = Math.max(1, rival.hp - damage);
    ecoLog(creature, `${creature.name} rakes ${rival.name}.`);
  }
  if (rival.hp <= rival.maxHp * 0.6 || creature.hp <= creature.maxHp * 0.6) {
    const loser = rival.hp / rival.maxHp <= creature.hp / creature.maxHp ? rival : creature;
    const winner = loser === rival ? creature : rival;
    const newHome = ecoNearbyHome(loser, ecoCreature(loser).home);
    loser.eco.home = newHome ?? loser.eco.home;
    loser.eco.flee = 4;
    loser.eco.fleeFrom = winner.id;
    loser.eco.rival = null;
    winner.eco.rival = null;
    ecoLog(loser, `${loser.name} gives way and slinks off, beaten.`);
    ecoEvent(ecoCreature(winner).home, `A ${winner.name} drove a rival out of its den.`, "territory");
  }
  return true;
}

// Some other chamber a displaced or hungry creature could live in: its habitat if possible.
function ecoNearbyHome(creature, fromIndex) {
  const rooms = state.run.rooms;
  const hops = typeof roomHops === "function" && rooms[fromIndex] ? roomHops(rooms, fromIndex) : rooms.map(() => 1);
  const options = rooms.map((room, index) => ({ room, index }))
    .filter(({ index }) => index !== fromIndex && index !== 0 && hops[index] <= 3)
    .map(({ room, index }) => ({ index, score: (ecoResidents(ecoHabitat(room))[creature.templateId] ? 3 : 0) - hops[index] + Math.random() }))
    .sort((a, b) => b.score - a.score);
  return options[0]?.index ?? null;
}

// The hueychapolin band strips gardens one after another until it's fed, then scatters.
function ecoBandMoves(creature) {
  const eco = creature.eco;
  eco.bandTicks = (eco.bandTicks || 0) + 1;
  if (eco.sat >= 90 || eco.bandTicks > 144) {
    creature.band = null;
    return;
  }
  if (eco.target) return;
  const food = ecoState().features.filter((feature) => ["fungus", "plants"].includes(feature.kind) && feature.amount > 0)
    .sort((a, b) => distanceInSquares(a, creature) - distanceInSquares(b, creature))[0];
  if (!food) return;
  eco.target = { feature: food.id, x: food.x, y: food.y };
  eco.sat = Math.min(eco.sat, 50);
}

// ---------- The world ticking over ----------

function ecoLivingCount(templateId = null) {
  const all = ecoLivingCreatures();
  return templateId ? all.filter((creature) => creature.templateId === templateId).length : all.length;
}

function ecoLivingCreatures() {
  return [...state.run.enemies.filter((enemy) => enemy.alive), ...(state.run.lurkers || [])];
}

// Rooms beside a roost, farmed by ants, or full of black beetle earth grow faster.
function ecoGrowthRate(feature, context) {
  let rate = 1;
  if (feature.kind === "fungus" && context.fertileRooms.has(feature.room)) rate *= 1.6;
  if (feature.kind === "fungus" && context.farmedRooms.has(feature.room)) rate *= 1.5;
  if (context.rich[feature.room]) rate *= 1 + Math.min(0.8, context.rich[feature.room] * 0.15);
  return rate;
}

function ecoGrowthContext() {
  const eco = ecoState();
  const roosts = new Set(state.run.rooms.map((room, index) => ecoHabitat(room)?.fertile ? index : -1).filter((index) => index >= 0));
  const fertileRooms = new Set();
  state.run.rooms.forEach((room, index) => {
    if (room.links?.some((link) => roosts.has(link)) || roosts.has(index)) fertileRooms.add(index);
  });
  const farmedRooms = new Set(eco.features.filter((feature) => feature.kind === "colony" && ECO.colonies[feature.species]?.farms && feature.count >= 8).map((feature) => feature.room));
  eco.rich ||= {};
  return { fertileRooms, farmedRooms, rich: eco.rich };
}

function ecologyWorldTick() {
  const eco = ecoState();
  eco.ticks = (eco.ticks || 0) + 1;
  for (const creature of ecoLivingCreatures()) {
    const species = ecoSpecies(creature);
    if (!species) continue;
    const data = ecoCreature(creature);
    const asleep = creature.asleep && data.sleeping;
    data.sat = Math.max(0, data.sat - species.appetite * (asleep ? 0.3 : 1));
    data.hungerTicks = data.sat <= 0 ? (data.hungerTicks || 0) + 1 : 0;
    if (asleep && creature.asleep > 0 && creature.asleep < 900) {
      creature.asleep -= 1;
      if (creature.asleep <= 0) {
        creature.asleep = 0;
        data.sleeping = false;
      }
    }
  }
  const context = ecoGrowthContext();
  for (const feature of eco.features) {
    const resource = ECO.resources[feature.kind] || {};
    if (resource.max && feature.amount < resource.max && !feature.abandoned) {
      feature.timer += ecoGrowthRate(feature, context);
      if (feature.timer >= resource.regrowTicks) {
        feature.timer = 0;
        feature.amount += 1;
      }
    }
    if (feature.kind === "carcass") ecoAgeCarcass(feature, 1);
    if (feature.kind === "mouth") feature.hunger = Math.min(100, (feature.hunger || 0) + 0.4);
  }
  ecoMouthsFeed(eco);
  ecoTidyBones(eco, 1);
  if (eco.ticks % ECO_COLONY_EVERY === 0) ecoColoniesTick(eco, ECO_COLONY_EVERY);
  if (eco.ticks % ECO_CENSUS_EVERY === 0) ecoCensus(eco);
}

function ecoAgeCarcass(feature, ticks) {
  feature.age = (feature.age || 0) + ticks;
  const beetles = ecoState().features.some((other) => other.kind === "colony" && other.species === "pinacate" &&
    distanceInSquares(other, feature) <= 3 && other.count >= 4);
  if (feature.age > 36) {
    feature.fresh = false;
    feature.tonalli = 0;
  }
  if (feature.age > (beetles ? 72 : 144) || (!feature.meat && !feature.tonalli && feature.age > 12)) {
    const what = feature.species ? ecoName(feature.species) : "carcass";
    ecoCarcassToBones(feature);
    ecoEvent(feature.room, `Scavengers picked the ${what} carcass clean.`, "bones");
  }
}

// A carcass with nothing left on it becomes a bone pile (and beetles may find it).
function ecoCarcassToBones(feature) {
  feature.kind = "bones";
  feature.meat = 0;
  feature.age = 0;
  feature.fresh = false;
  const beetleColonies = ecoState().features.filter((other) => other.kind === "colony" && other.species === "pinacate");
  if (Math.random() < 0.35 && beetleColonies.length < 3 && !beetleColonies.some((other) => other.room === feature.room)) {
    const spot = freeTileNear(feature, ecoOccupiedTiles(), 1);
    if (spot && !ecoSeen(spot)) ecoAddColony("pinacate", spot, feature.room, 5);
  }
}

// Beetles and the earth's mouths take bones back into the ground, and the ground grows.
function ecoTidyBones(eco, ticks) {
  for (const pile of eco.features.filter((feature) => feature.kind === "bones")) {
    pile.age = (pile.age || 0) + ticks;
    const beetles = eco.features.some((other) => other.kind === "colony" && other.species === "pinacate" &&
      distanceInSquares(other, pile) <= 3 && other.count >= 4);
    if (beetles && pile.age > 96 && !ecoHabitat(state.run.rooms[pile.room])?.resources?.bones) {
      eco.features = eco.features.filter((feature) => feature !== pile);
      eco.rich[pile.room] = (eco.rich[pile.room] || 0) + 1;
      ecoEvent(pile.room, "Beetles turned the old bones here into black earth.", "bones");
    }
  }
  const left = eco.features.filter((feature) => feature.kind === "bones");
  if (left.length > 16) eco.features = eco.features.filter((feature) => feature !== left[0]);
}

function ecoMouthsFeed(eco) {
  for (const mouth of eco.features.filter((feature) => feature.kind === "mouth")) {
    if ((mouth.hunger || 0) < 20) continue;
    const meal = eco.features.find((feature) => (feature.kind === "carcass" || feature.kind === "bones") &&
      feature.room === mouth.room && distanceInSquares(feature, mouth) <= 4 && feature !== mouth);
    if (!meal) continue;
    eco.features = eco.features.filter((feature) => feature !== meal);
    mouth.hunger = Math.max(0, mouth.hunger - (meal.kind === "carcass" ? 45 : 20));
    eco.rich[mouth.room] = (eco.rich[mouth.room] || 0) + 2;
    ecoLog(mouth, "The mouth in the rock opens and takes the dead back into the earth.");
    ecoEvent(mouth.room, "The earth's mouth took back the dead.", "mouth");
  }
}

// ---------- Colonies ----------

function ecoColonyFood(colony, feature, eco) {
  let food = 0;
  for (const other of eco.features) {
    if (other.room !== feature.room || other === feature) continue;
    if (colony.food.includes("carrion") && other.kind === "carcass") food += 1 + (other.meat || 0);
    else if (colony.food.includes("bones") && other.kind === "bones") food += 1;
    else if (colony.food.includes("fish") && other.kind === "pool") food += other.amount;
    else if (["fungus", "plants"].includes(other.kind) && colony.food.includes(ECO.resources[other.kind].food)) food += other.amount;
  }
  return food;
}

function ecoColoniesTick(eco, ticks) {
  for (const feature of eco.features.filter((entry) => entry.kind === "colony")) {
    const colony = ECO.colonies[feature.species];
    if (!colony) continue;
    const food = ecoColonyFood(colony, feature, eco);
    const capacity = Math.min(colony.max, food * colony.perFood);
    feature.capacity = capacity;
    if (capacity <= 0) {
      feature.count = Math.floor(feature.count * 0.75);
      // Starved grasshoppers leave something behind: the fungus that grows out of them.
      if (feature.species === "chapolin" && Math.random() < 0.3) feature.summitCaps = Math.min(3, (feature.summitCaps || 0) + 1);
    } else {
      const growth = colony.growth * (ticks / ECO_COLONY_EVERY) * feature.count * (1 - feature.count / capacity);
      feature.count = Math.max(0, Math.round((feature.count + growth) * 10) / 10);
      if (feature.count > capacity) feature.count = Math.max(capacity, feature.count - 1);
      if (feature.species === "chapolin" && feature.count > colony.max * 0.6 && Math.random() < 0.04) {
        feature.summitCaps = Math.min(3, (feature.summitCaps || 0) + 1);
      }
    }
    // Grazers eat into their food (and the ants carry it down to their fungus).
    if (feature.count >= 4 && Math.random() < Math.min(0.6, feature.count / (capacity + 4))) {
      const meal = eco.features.find((other) => other.room === feature.room && other.amount > 0 &&
        ["fungus", "plants"].includes(other.kind) && colony.food.includes(ECO.resources[other.kind].food));
      if (meal) meal.amount -= 1;
    }
    if (feature.count < 1) {
      eco.features = eco.features.filter((entry) => entry !== feature);
      ecoEvent(feature.room, `The ${colony.name.toLowerCase()} here died out.`, "colony");
      continue;
    }
    // A full colony sends some of itself on to the next garden.
    if (feature.count >= colony.max * 0.9 && Math.random() < 0.08) ecoColonySpreads(feature, colony, eco);
  }
}

function ecoColonySpreads(feature, colony, eco) {
  const room = state.run.rooms[feature.room];
  const options = (room?.links || []).filter((link) => link !== 0 && !eco.features.some((other) => other.kind === "colony" &&
    other.species === feature.species && other.room === link) && ecoColonyFood(colony, { room: link }, eco) > 0);
  if (!options.length) return;
  const target = options[randomInt(options.length) - 1];
  const spot = ecoFreeTile(state.run.rooms[target], ecoOccupiedTiles(), { water: feature.species === "ahuauhtli" });
  if (!spot || ecoSeen(spot)) return;
  feature.count -= 4;
  ecoAddColony(feature.species, spot, target, 4);
  ecoEvent(target, `A ${colony.name.toLowerCase()} moved in.`, "colony");
}

// ---------- The hourly census ----------

function ecoCensus(eco) {
  const cap = ecoFloorCap();
  for (const creature of ecoLivingCreatures()) {
    const species = ecoSpecies(creature);
    if (!species || species.role === "spirit" || species.role === "guardian" || creature.guardian) continue;
    // Starvation: a creature that has gone without long enough dies, and feeds something else.
    if ((creature.eco?.hungerTicks || 0) >= 36) {
      ecoLog(creature, `${creature.name} staggers and collapses, starved.`);
      ecoEvent(roomIndexAt(creature.x, creature.y), `A ${creature.name} starved here.`, "starved");
      if ((state.run.lurkers || []).includes(creature)) state.run.lurkers = state.run.lurkers.filter((entry) => entry !== creature);
      ecologyCreatureDied(creature);
      continue;
    }
    // Hungry, and its chamber isn't its kind's habitat: move house, toward food.
    if ((creature.eco?.sat || 0) < 25 && !creature.alerted && !(creature.eco.movedRecently > 0) && Math.random() < 0.25) {
      const home = creature.eco.home;
      const next = ecoNearbyHome(creature, home);
      if (next !== null && !ecoResidents(ecoHabitat(state.run.rooms[home]))[creature.templateId]) {
        creature.eco.home = next;
        creature.eco.movedRecently = 12;
        ecoEvent(home, `A ${creature.name} left to look for food elsewhere.`, "moved");
      }
    }
    if (creature.eco?.movedRecently > 0) creature.eco.movedRecently -= 1;
  }
  ecoLurkersFeed();
  ecoBreed(eco, cap);
  ecoNestsTick(eco);
  ecoGardensTick(eco);
  ecoOutbreak(eco);
  ecoReform(eco);
}

// Hidden hunters (the ahuizotl under the water, the deer serpent coiled by a trail) eat
// without coming out: fish from their pool, or something that wanders too close.
function ecoLurkersFeed() {
  for (const lurker of [...(state.run.lurkers || [])]) {
    const species = ecoSpecies(lurker);
    if (!species) continue;
    const data = ecoCreature(lurker);
    if (data.sat >= ECO_HUNGRY + 15) continue;
    const prey = state.run.enemies.find((enemy) => enemy.alive && distanceInSquares(enemy, lurker) <= 2 && ecoCanHunt(lurker, enemy, species));
    if (prey && Math.random() < 0.5) {
      if (ecoSeen(prey)) addLog(lurker.templateId === "cenote-stalker"
        ? `Something comes up out of the water and drags ${prey.name} under.`
        : `Something lunges out of hiding and takes ${prey.name}.`);
      ecologyCreatureDied(prey, { eaten: true, killer: lurker });
      ecoEvent(roomIndexAt(prey.x, prey.y), `Something hidden took a ${prey.name} here.`, "kill");
      data.sat = Math.min(100, data.sat + 60);
      data.hungerTicks = 0;
      continue;
    }
    const meal = ecoState().features.find((feature) => ecoFeatureFeeds(feature, species) && distanceInSquares(feature, lurker) <= 4);
    if (meal) {
      if (meal.kind === "colony") meal.count = Math.max(0, meal.count - 2);
      else meal.amount = Math.max(0, meal.amount - 1);
      data.sat = Math.min(100, data.sat + 35);
      data.hungerTicks = 0;
    }
  }
}

function ecoFoodFor(species, eco) {
  let food = 0;
  for (const feature of eco.features) {
    if (ecoFeatureFeeds(feature, species)) food += feature.kind === "colony" ? feature.count / 4 : feature.amount || feature.meat || 1;
  }
  for (const prey of state.run.enemies) {
    const preySpecies = ecoSpecies(prey);
    if (prey.alive && preySpecies && preySpecies.is.some((kind) => species.eats.includes(kind))) food += preySpecies.size;
  }
  return food;
}

function ecoBreed(eco, cap) {
  for (const [id, species] of Object.entries(ECO.species)) {
    if (!species.breeds || species.role === "colony") continue;
    eco.breed[id] = (eco.breed[id] || 0) + ECO_CENSUS_EVERY;
    if (eco.breed[id] < species.breeds.every) continue;
    eco.breed[id] = 0;
    const count = ecoLivingCount(id);
    if (count >= species.breeds.cap || ecoLivingCount() >= cap) continue;
    const parents = state.run.enemies.filter((enemy) => enemy.alive && enemy.templateId === id && !enemy.alerted &&
      ecoCreature(enemy).sat >= 60);
    if (!parents.length) {
      // Wiped out here? A few come back in from the cracks and the floors around, to wherever
      // this floor has the habitat they live in, so the food chain doesn't break for good.
      if (count > 0 || !greatTempleEncounterIds().includes(id)) continue;
      eco.absent ||= {};
      eco.absent[id] = (eco.absent[id] || 0) + 1;
      if (eco.absent[id] < 2) continue;
      eco.absent[id] = 0;
      const homes = state.run.rooms.map((room, index) => ({ room, index }))
        .filter(({ room }) => ecoResidents(ecoHabitat(room))[id]);
      if (!homes.length) continue;
      const { room, index } = homes[randomInt(homes.length) - 1];
      const taken = ecoOccupiedTiles();
      const arrivals = species.size >= 3 ? 1 : 2;
      let arrived = 0;
      for (let n = 0; n < arrivals; n += 1) {
        const spot = (species.aquatic && ecoDeepTile(index, taken)) || ecoFreeTile(room, taken);
        if (!spot || ecoSeen(spot)) break;
        taken.add(tileIndex(spot.x, spot.y));
        const arrival = ecoNewCreature(id, spot, index);
        if (arrival) {
          state.run.enemies.push(arrival);
          arrived += 1;
        }
      }
      if (arrived) ecoEvent(index, `New ${ecoName(id)} moved in.`, "arrived");
      continue;
    }
    // Births only when there's food to spare for another mouth.
    if (ecoFoodFor(species, eco) < (count + 1) * 2) continue;
    const parent = parents[randomInt(parents.length) - 1];
    const taken = ecoOccupiedTiles();
    const spot = freeTileNear(parent, taken, 2);
    if (!spot || ecoSeen(spot)) continue;
    const young = ecoNewCreature(id, spot, ecoCreature(parent).home);
    if (!young) continue;
    young.eco.sat = 50;
    state.run.enemies.push(young);
    ecoEvent(parent.eco.home, `Young ${ecoName(id)} were born here.`, "born");
  }
}

// Nests without a mother go cold, and are taken over by whatever needs one.
function ecoNestsTick(eco) {
  for (const nest of eco.features.filter((feature) => feature.kind === "nest")) {
    const ownerAlive = nest.owner && ecoLivingCount(nest.owner) > 0;
    if (!ownerAlive && !nest.abandoned) {
      nest.coldTicks = (nest.coldTicks || 0) + ECO_CENSUS_EVERY;
      if (nest.coldTicks >= 36) {
        nest.abandoned = true;
        nest.amount = 0;
        ecoEvent(nest.room, "The nest went cold. Nothing came back to it.", "abandoned");
      }
    } else if (ownerAlive) {
      nest.coldTicks = 0;
    }
    if (nest.abandoned) {
      const claimant = ["colotl", "axolocatl"].find((id) => ecoLivingCount(id) > 0 && !eco.features.some((other) =>
        other.kind === "nest" && other.owner === id && !other.abandoned));
      if (claimant && Math.random() < 0.3) {
        nest.owner = claimant;
        nest.abandoned = false;
        nest.coldTicks = 0;
        ecoEvent(nest.room, `A ${ecoName(claimant)} took over the old nest.`, "nest");
      }
    }
  }
}

// Well-fed glowcap beds spread in damp ground; overgrazed ones die back to rot.
function ecoGardensTick(eco) {
  const resource = ECO.resources.fungus;
  for (const patch of eco.features.filter((feature) => feature.kind === "fungus")) {
    const room = state.run.rooms[patch.room];
    if (!room) continue;
    if (patch.amount >= resource.max) {
      patch.fullTicks = (patch.fullTicks || 0) + ECO_CENSUS_EVERY;
      const damp = (room.env?.moist ?? 0.6) > 0.5 || eco.rich?.[patch.room];
      const inRoom = eco.features.filter((feature) => feature.kind === "fungus" && feature.room === patch.room).length;
      if (damp && patch.fullTicks >= 24 && inRoom < 5 && Math.random() < 0.3) {
        const spot = ecoFreeTile(room, ecoOccupiedTiles());
        if (spot && !ecoSeen(spot)) {
          ecoAddFeature("fungus", spot, patch.room, { amount: 2 });
          patch.fullTicks = 0;
          ecoEvent(patch.room, "The glowcaps here have spread.", "spread");
        }
      }
    } else {
      patch.fullTicks = 0;
    }
    if (patch.amount <= 0) {
      patch.bareTicks = (patch.bareTicks || 0) + ECO_CENSUS_EVERY;
      const others = eco.features.filter((feature) => feature.kind === "fungus" && feature.room === patch.room).length;
      if (patch.bareTicks >= 72 && others > 1) {
        eco.features = eco.features.filter((feature) => feature !== patch);
        ecoEvent(patch.room, "A glowcap bed was grazed down to bare rot.", "grazed");
      }
    } else {
      patch.bareTicks = 0;
    }
  }
}

// Locusts: alone, the big grasshoppers are shy grazers. When a big chapolin swarm outgrows
// its garden, the big ones crowd together and go: a band that strips the next garden bare.
function ecoOutbreak(eco) {
  const floor = state.run.dungeonFloor || 1;
  if (floor < 2 || (eco.ticks - (eco.lastOutbreak ?? -9999)) < 432) return;
  const swarm = eco.features.find((feature) => feature.kind === "colony" && feature.species === "chapolin" &&
    feature.count >= ECO.colonies.chapolin.max * 0.8 && (feature.capacity || 0) < feature.count * 0.7);
  if (!swarm || ecoLivingCount("maztican-cave-locust") >= 4 || ecoLivingCount() >= ecoFloorCap() - 2) return;
  if (Math.random() > 0.35 || !greatTempleEncounterIds().includes("maztican-cave-locust")) return;
  eco.lastOutbreak = eco.ticks;
  const taken = ecoOccupiedTiles();
  const band = `band-${eco.nextId++}`;
  let made = 0;
  for (let n = 0; n < 3; n += 1) {
    const spot = freeTileNear(swarm, taken, 2);
    if (!spot) break;
    taken.add(tileIndex(spot.x, spot.y));
    const locust = ecoNewCreature("maztican-cave-locust", spot, swarm.room);
    if (!locust) break;
    locust.band = band;
    locust.eco.sat = 30;
    state.run.enemies.push(locust);
    made += 1;
  }
  swarm.count -= made * 3;
  if (made) {
    ecoLog(swarm, "The big grasshoppers in the swarm have turned dark and are crowding together. They're about to move.");
    ecoEvent(swarm.room, "The grasshoppers outgrew their garden, and a band of big ones set off.", "outbreak");
  }
}

function ecoReform(eco) {
  if (!eco.reform?.length) return;
  for (const entry of [...eco.reform]) {
    if (eco.ticks < entry.tick) continue;
    const house = eco.features.find((feature) => feature.kind === "alux-house" && feature.room === entry.home);
    const spot = house ? freeTileNear(house, ecoOccupiedTiles(), 1) : null;
    if (!house) {
      eco.reform = eco.reform.filter((other) => other !== entry);
      continue;
    }
    if (!spot || ecoSeen(spot)) continue;
    const alux = ecoNewCreature("alux", spot, entry.home);
    if (alux) state.run.enemies.push(alux);
    eco.reform = eco.reform.filter((other) => other !== entry);
  }
}

// Creatures act on their own between your turns when more than one tick passes at once
// (a rest, a meal, an hour of foraging). The first tick's creatures already acted.
function ecologyCreaturesAct() {
  for (const creature of [...state.run.enemies]) {
    if (!creature.alive || creature.alerted) continue;
    ecologyIdle(creature, { catchUp: true });
  }
}

// Long absences are settled an hour at a time, without anyone moving.
function ecologySettle(ticks) {
  const eco = ecoState();
  const hours = Math.min(120, Math.floor(ticks / ECO_CENSUS_EVERY));
  for (let hour = 0; hour < hours; hour += 1) {
    eco.ticks = (eco.ticks || 0) + ECO_CENSUS_EVERY;
    const context = ecoGrowthContext();
    for (const feature of [...eco.features]) {
      const resource = ECO.resources[feature.kind] || {};
      if (resource.max && !feature.abandoned) {
        feature.timer += ECO_CENSUS_EVERY * ecoGrowthRate(feature, context);
        while (feature.timer >= resource.regrowTicks && feature.amount < resource.max) {
          feature.timer -= resource.regrowTicks;
          feature.amount += 1;
        }
        if (feature.amount >= resource.max) feature.timer = 0;
      }
      if (feature.kind === "carcass") ecoAgeCarcass(feature, ECO_CENSUS_EVERY);
      if (feature.kind === "mouth") feature.hunger = Math.min(100, (feature.hunger || 0) + 2.4);
    }
    // Creatures eat from what's around, abstractly: plenty keeps them fed, scarcity doesn't.
    for (const creature of ecoLivingCreatures()) {
      const species = ecoSpecies(creature);
      if (!species) continue;
      const data = ecoCreature(creature);
      if (species.role === "spirit" || species.role === "guardian") {
        data.sat = Math.max(30, data.sat - species.appetite * ECO_CENSUS_EVERY);
        continue;
      }
      const meal = eco.features.find((feature) => ecoFeatureFeeds(feature, species) &&
        (feature.room === data.home || distanceInSquares(feature, creature) <= ECO_SEARCH_RADIUS));
      const prey = !meal && species.role === "predator" ? state.run.enemies.find((other) => other.alive && other !== creature &&
        ecoCanHunt(creature, other, species) && distanceInSquares(other, creature) <= ECO_SEARCH_RADIUS) : null;
      if (meal && Math.random() < 0.7) {
        if (meal.kind === "colony") meal.count = Math.max(0, meal.count - 2);
        else if (meal.kind === "carcass") meal.meat = Math.max(0, (meal.meat || 0) - 1);
        else meal.amount = Math.max(0, (meal.amount || 0) - 1);
        data.sat = Math.min(85, data.sat + 30);
        data.hungerTicks = 0;
      } else if (prey && Math.random() < 0.08) {
        // A hunt off-screen: sometimes it works.
        ecologyCreatureDied(prey, { eaten: true, killer: creature });
        ecoEvent(roomIndexAt(prey.x, prey.y), `A ${creature.name} killed a ${prey.name} here.`, "kill");
        data.sat = 90;
        data.hungerTicks = 0;
      } else {
        data.sat = Math.max(0, data.sat - species.appetite * ECO_CENSUS_EVERY * 0.6);
        data.hungerTicks = data.sat <= 0 ? (data.hungerTicks || 0) + ECO_CENSUS_EVERY : 0;
      }
      data.target = null;
      data.feeding = 0;
      data.flee = 0;
      data.route = null;
      // A creature that moved house while you were gone is there now.
      const homeRoom = state.run.rooms[data.home];
      if (homeRoom && roomIndexAt(creature.x, creature.y) !== data.home && distanceInSquares(creature, state.run.player) > 8 &&
        !(state.run.lurkers || []).includes(creature)) {
        const taken = ecoOccupiedTiles();
        const spot = (species.aquatic && ecoDeepTile(data.home, taken)) || ecoFreeTile(homeRoom, taken);
        if (spot && distanceInSquares(spot, state.run.player) > 8) {
          creature.x = spot.x;
          creature.y = spot.y;
        }
      }
    }
    ecoMouthsFeed(eco);
    ecoTidyBones(eco, ECO_CENSUS_EVERY);
    ecoColoniesTick(eco, ECO_CENSUS_EVERY);
    ecoCensus(eco);
  }
}

// Called after every turn in the tomb, once the world clock has moved.
function ecologyAdvance() {
  if (state.run?.location !== "dungeon" || state.run.lost) return;
  const eco = ensureEcology();
  if (!eco) return;
  const now = state.run.gameMinutes || 0;
  if (!Number.isFinite(eco.minute) || eco.minute > now) eco.minute = now;
  const ticks = Math.floor((now - eco.minute) / ECO_TICK_MINUTES);
  if (ticks > 0) {
    eco.minute += ticks * ECO_TICK_MINUTES;
    const live = Math.min(ticks, ECO_LIVE_TICK_LIMIT);
    for (let tick = 0; tick < live; tick += 1) {
      if (tick > 0) ecologyCreaturesAct();
      ecologyWorldTick();
    }
    if (ticks > live) ecologySettle(ticks - live);
  }
  if (eco.returnedAt !== undefined) ecoReportChanges(eco);
  ecologyObserveSurroundings();
}

// ---------- Coming back to a floor ----------

// Called as you leave a floor and as you come back to it.
function ecologyLeaveFloor() {
  const eco = ecoState();
  if (eco) eco.leftAt = eco.ticks || 0;
}

function ecologyReturnToFloor() {
  const eco = ecoState();
  if (eco) eco.returnedAt = eco.leftAt ?? eco.ticks ?? 0;
}

// "While you were away…": the notable things that happened in chambers you had seen.
function ecoReportChanges(eco) {
  const since = eco.returnedAt;
  delete eco.returnedAt;
  if ((eco.ticks || 0) - since < 36) return;
  const seenRooms = new Set(state.run.rooms.map((room, index) => room.visited ? index : -1).filter((index) => index >= 0));
  const order = ["outbreak", "territory", "arrived", "abandoned", "starved", "kill", "spread", "colony", "nest", "born", "mouth", "bones", "grazed", "moved"];
  const lines = [];
  const used = new Set();
  for (const kind of order) {
    for (const event of (eco.events || []).filter((entry) => entry.tick > since && entry.kind === kind && seenRooms.has(entry.room))) {
      const where = ecologyRoomLabel(state.run.rooms[event.room]);
      const line = where ? `${where} · ${event.text}` : event.text;
      if (used.has(line)) continue;
      used.add(line);
      lines.push(line);
      if (lines.length >= 4) break;
    }
    if (lines.length >= 4) break;
  }
  if (!lines.length) return;
  addLog("Things have changed since you were last here.");
  for (const line of lines) addLog(line);
  showToast(lines[0]);
}

// ---------- The naturalist's journal ----------

// What you've seen of each species: that it exists, where it lives, what it eats and what
// eats it, and what it's good for. Kept in state.run.progress.naturalist.
function naturalist() {
  const data = state.run?.progress;
  if (!data) return {};
  if (!data.naturalist || typeof data.naturalist !== "object" || Array.isArray(data.naturalist)) data.naturalist = {};
  return data.naturalist;
}

function ecoObserve(id, fact) {
  if (!id || !state.run?.progress) return;
  const book = naturalist();
  const entry = book[id] ||= { seen: 0, facts: [] };
  if (fact && !entry.facts.includes(fact)) {
    entry.facts.push(fact);
    if (entry.facts.length > 24) entry.facts.shift();
  }
}

// Only what happens in front of you goes in the journal.
function ecoWitness(spot, id, fact) {
  if (ecoSeen(spot)) ecoObserve(id, fact);
}

function naturalistKnows(id) {
  return Boolean(naturalist()[id]?.seen || naturalist()[id]?.facts?.length || (state.run?.progress?.bestiary?.[id] || 0) > 0);
}

// Each turn: note what's in sight. First sightings go in the journal.
function ecologyObserveSurroundings() {
  if (state.run?.location !== "dungeon" || !state.run.progress) return;
  const book = naturalist();
  const seeing = (spot) => distanceInSquares(spot, state.run.player) <= 6 && hasLineOfSight(state.run.player, spot);
  for (const creature of state.run.enemies) {
    if (!creature.alive || creature.friendly || !seeing(creature)) continue;
    const entry = book[creature.templateId] ||= { seen: 0, facts: [] };
    if (!entry.seen) {
      addLog(`Journal: you observe a ${creature.name} for the first time.`);
      if (ecoSpecies(creature)?.omen) addLog("A snake with a head at each end: the omen serpent. Leave it be, and it will leave you be.");
    }
    entry.seen = Math.min(9999, (entry.seen || 0) + 1);
    const habitat = state.run.rooms[roomIndexAt(creature.x, creature.y)]?.habitat;
    if (habitat && !entry.facts.includes(`habitat:${habitat}`)) entry.facts.push(`habitat:${habitat}`);
  }
  for (const feature of ecoState()?.features || []) {
    if (feature.kind !== "colony" || !seeing(feature)) continue;
    const entry = book[feature.species] ||= { seen: 0, facts: [] };
    if (!entry.seen) addLog(`Journal: you observe ${ECO.colonies[feature.species].name.toLowerCase()} for the first time.`);
    entry.seen = Math.min(9999, (entry.seen || 0) + 1);
    const habitat = state.run.rooms[feature.room]?.habitat;
    if (habitat && !entry.facts.includes(`habitat:${habitat}`)) entry.facts.push(`habitat:${habitat}`);
  }
}

// ---------- What you can do with it ----------

function ecoFeatureNear(filter) {
  const eco = ecoState();
  if (!eco) return null;
  return eco.features.find((feature) => distanceInSquares(feature, state.run.player) <= 1 && filter(feature)) || null;
}

function ecoOfferingItem(list = Object.keys(ECO.offerings)) {
  return list.find((id) => inventoryQuantity(id) > 0) || null;
}

// Everything you could do with nearby habitat features or neutral beings, most pressing
// first. `group` says which action tab carries an equivalent button.
function ecologyInteractions() {
  if (state.run?.location !== "dungeon" || !ecoState()) return [];
  const list = [];
  const add = (label, action, group) => list.push({ label, action, group });
  const chaneque = state.run.enemies.find((enemy) => enemy.alive && enemy.templateId === "chaneque" && !enemy.alerted &&
    distanceInSquares(enemy, state.run.player) <= 1 && !enemy.eco?.appeased);
  if (chaneque && ecoOfferingItem(ECO.guardianOfferings.chaneque)) add("Offer the chaneque a gift", () => appeaseGuardian(chaneque), "explore");
  const house = ecoFeatureNear((feature) => feature.kind === "alux-house" && !feature.appeased);
  if (house && ecoOfferingItem(ECO.guardianOfferings.alux)) add("Leave food at the alux house", () => appeaseAlux(house), "explore");
  const carcass = ecoFeatureNear((feature) => feature.kind === "carcass" && (feature.edible || feature.drowned) && feature.meat > 0 && feature.fresh);
  if (carcass && state.run.gourmetGuideOwned) add(`Butcher the ${ecoName(carcass.species)}`, () => butcherCarcass(carcass), "supplies");
  const mouth = ecoFeatureNear((feature) => feature.kind === "mouth" && (feature.hunger || 0) >= 20);
  if (mouth && ecoMeatItem()) add("Feed the earth's mouth", () => feedMouth(mouth), "explore");
  const nest = ecoFeatureNear((feature) => feature.kind === "nest" && feature.amount > 0);
  if (nest) add(`Take eggs · ${nest.amount}`, () => harvestFeature(nest), "supplies");
  const offering = ecoFeatureNear((feature) => feature.kind === "offering");
  if (offering && ecoOfferingItem()) add("Leave an offering", () => leaveOffering(offering), "explore");
  const summit = ecoFeatureNear((feature) => feature.kind === "colony" && feature.summitCaps > 0);
  if (summit) add(`Pick a summit cap · ${summit.summitCaps}`, () => pickSummitCap(summit), "supplies");
  const colony = ecoFeatureNear((feature) => feature.kind === "colony" && ECO.colonies[feature.species]?.harvest &&
    feature.count >= ECO.colonies[feature.species].harvestAt);
  if (colony) add(`${ECO.colonies[colony.species].harvestVerb} · ${Math.floor(colony.count)}`, () => harvestColony(colony), "supplies");
  const patch = ecoFeatureNear((feature) => ["fungus", "plants", "pool"].includes(feature.kind) && feature.amount > 0);
  if (patch) add(`${ECO.resources[patch.kind].harvestVerb} · ${patch.amount}`, () => harvestFeature(patch), "supplies");
  if (typeof duendeInteractions === "function") list.unshift(...duendeInteractions());
  return list;
}

// The most pressing of those, or null.
function ecologyInteraction() {
  return ecologyInteractions()[0] || null;
}

function ecoFeatureRoomOwners(feature) {
  return state.run.enemies.filter((enemy) => enemy.alive && enemy.templateId === feature.owner && distanceInSquares(enemy, feature) <= 8);
}

// A chaneque keeps the garden or spring in its chamber. Taking from it unasked costs you.
function ecoGuardianOffended(roomIndex, what) {
  const keeper = state.run.enemies.find((enemy) => enemy.alive && enemy.templateId === "chaneque" &&
    ecoCreature(enemy).home === roomIndex && !enemy.eco.appeased && distanceInSquares(enemy, state.run.player) <= 8);
  if (!keeper) return;
  keeper.eco.offended = true;
  ecoObserve("chaneque", "guards");
  addLog(`A small, old face watches you take the ${what}. The chaneque shrieks, and your soul jumps out of your body.`);
  if (typeof applyCondition === "function") applyCondition("susto", "The chaneque");
  keeper.eco.flee = 6;
}

function appeaseGuardian(keeper) {
  const itemId = ecoOfferingItem(ECO.guardianOfferings.chaneque);
  if (!itemId || !removeInventoryItem(itemId)) return;
  keeper.eco.appeased = true;
  keeper.eco.offended = false;
  ecoObserve("chaneque", "appeased");
  // In thanks, it shows you what's hidden nearby and its garden grows back.
  let shown = 0;
  for (const hazard of state.run.hazards) {
    if (!hazard.triggered && !hazard.revealed && distanceInSquares(hazard, keeper) <= 10) {
      hazard.revealed = true;
      shown += 1;
    }
  }
  for (const feature of ecoState().features) {
    if (feature.room === keeper.eco.home && ECO.resources[feature.kind]?.max) feature.amount = ECO.resources[feature.kind].max;
  }
  ecoRemoveCondition("susto");
  addLog(shown
    ? `You set the ${itemDetails(itemId).name} down for the chaneque. It takes it, grins, and points out ${shown} hidden ${shown === 1 ? "trap" : "traps"} you hadn't seen. Its garden is full again.`
    : `You set the ${itemDetails(itemId).name} down for the chaneque. It takes it and grins. Its garden is full again.`);
  finishPlayerTurn();
}

function appeaseAlux(house) {
  const itemId = ecoOfferingItem(ECO.guardianOfferings.alux);
  if (!itemId || !removeInventoryItem(itemId)) return;
  house.appeased = true;
  for (const alux of state.run.enemies.filter((enemy) => enemy.alive && enemy.templateId === "alux" && ecoCreature(enemy).home === house.room)) {
    alux.eco.appeased = true;
    alux.eco.offended = false;
    alux.alerted = false;
    alux.provoked = false;
  }
  ecoObserve("alux", "appeased");
  addLog(`You leave ${itemDetails(itemId).name} at the alux house. Something inside it clicks, like clay settling. What it guards is yours to take.`);
  finishPlayerTurn();
}

// Robbing an alux's storeroom without asking: it throws stones until you leave or it breaks.
function ecologyTreasureTaken(cache) {
  if (state.run?.location !== "dungeon" || !ecoState()) return;
  const roomIndex = roomIndexAt(cache.x, cache.y);
  const house = ecoState().features.find((feature) => feature.kind === "alux-house" && feature.room === roomIndex);
  if (!house || house.appeased) return;
  let angry = 0;
  for (const alux of state.run.enemies.filter((enemy) => enemy.alive && enemy.templateId === "alux" && ecoCreature(enemy).home === roomIndex)) {
    alux.eco.offended = true;
    alux.provoked = true;
    alux.alerted = true;
    angry += 1;
  }
  if (!angry) return;
  ecoObserve("alux", "guards");
  addLog("A pebble cracks off the wall beside your head, then another. You took from the alux's storeroom without leaving it food.");
}

function ecoRemoveCondition(id) {
  const list = state.run?.progress?.conditions;
  if (!list?.some((entry) => entry.id === id)) return false;
  state.run.progress.conditions = list.filter((entry) => entry.id !== id);
  return true;
}

function ecoMeatItem() {
  return [...ECO_MEAT_ITEMS].find((id) => inventoryQuantity(id) > 0) || null;
}

function feedMouth(mouth) {
  const itemId = ecoMeatItem();
  if (!itemId || !removeInventoryItem(itemId)) return;
  mouth.hunger = 0;
  const eco = ecoState();
  eco.rich[mouth.room] = (eco.rich[mouth.room] || 0) + 2;
  for (const feature of eco.features) {
    if (feature.room === mouth.room && ["fungus", "plants"].includes(feature.kind)) feature.amount = ECO.resources[feature.kind].max;
  }
  addLog(`You drop the ${itemDetails(itemId).name} into the mouth. It closes, slowly. The rock around it warms, and whatever grows in the chamber swells and opens.`);
  finishPlayerTurn();
}

// Stepping onto a hungry mouth: she takes a bite.
function ecologyStepped(x, y) {
  const eco = ecoState();
  if (!eco) return;
  const mouth = eco.features.find((feature) => feature.kind === "mouth" && feature.x === x && feature.y === y);
  if (mouth && (mouth.hunger || 0) >= 50) {
    const damage = rollDice("2d6").total;
    state.run.hp = Math.max(0, state.run.hp - damage);
    mouth.hunger = Math.max(0, mouth.hunger - 30);
    addLog(`The rock under your foot opens. Tlaltecuhtli bites: ${damage} damage.`);
    showCombatFeedback("hit", `−${damage} HP`, { actor: "player", x, y });
    if (typeof checkDefeat === "function") checkDefeat();
  }
}

function harvestFeature(feature) {
  const resource = ECO.resources[feature.kind];
  if (!resource?.harvest || feature.amount <= 0) return;
  if (feature.kind === "pool") {
    const check = randomInt(20) + bestPartySkillBonus("survival");
    const caught = check >= 16 ? 2 : check >= 10 ? 1 : 0;
    let landed = 0;
    for (let n = 0; n < Math.min(caught, feature.amount); n += 1) if (addInventoryItem(resource.harvest)) landed += 1;
    feature.amount -= landed;
    addLog(landed ? `You fish the pool for half an hour (Survival ${check}) and land ${landed} blindfish.`
      : `You fish the pool for half an hour (Survival ${check}), but nothing bites.`);
    if ((state.run.lurkers || []).some((enemy) => enemy.templateId === "cenote-stalker" && distanceInSquares(enemy, feature) <= 6)) {
      addLog("The fish jump all at once, the way they do when a predator is below them.");
      ecoObserve("cenote-stalker", "lure");
    }
    ecoGuardianOffended(feature.room, "fish");
    finishPlayerTurn(30);
    return;
  }
  if (!addInventoryItem(resource.harvest)) {
    showToast("Your pack is too full to carry it.");
    return;
  }
  feature.amount -= 1;
  const regrows = feature.kind === "nest" ? "more will be laid" : "it grows back";
  addLog(`You ${resource.harvestVerb.toLowerCase()}: ${itemDetails(resource.harvest).name}. ${feature.amount ? `${feature.amount} left; ${regrows}.` : `That's the last of it for now; ${regrows}.`}`);
  if (feature.kind === "nest") {
    feature.disturbed = true;
    for (const owner of ecoFeatureRoomOwners(feature)) {
      provokeCreature(owner);
      addLog(`${owner.name} sees you at its nest!`);
    }
  } else {
    ecoGuardianOffended(feature.room, feature.kind === "fungus" ? "glowcaps" : "roots");
  }
  finishPlayerTurn();
}

function harvestColony(feature) {
  const colony = ECO.colonies[feature.species];
  if (!colony?.harvest || feature.count < colony.harvestAt) return;
  const check = randomInt(20) + bestPartySkillBonus("survival");
  const caught = check >= 15 ? 2 : check >= 9 ? 1 : 0;
  let taken = 0;
  for (let n = 0; n < caught; n += 1) if (addInventoryItem(colony.harvest)) taken += 1;
  if (caught && !taken) {
    showToast("Your pack is too full to carry it.");
    return;
  }
  feature.count = Math.max(0, feature.count - Math.max(2, taken * 3));
  ecoObserve(feature.species, "harvested");
  ecoObserve(colony.harvest, "harvested");
  addLog(taken ? `${colony.harvestVerb} (Survival ${check}): ${taken} × ${itemDetails(colony.harvest).name}.`
    : `${colony.harvestVerb} (Survival ${check}): they're too quick for you.`);
  if (colony.bites) {
    const damage = rollDice(colony.bites).total;
    state.run.hp = Math.max(1, state.run.hp - damage);
    addLog(`The soldier ants swarm up your arms: ${damage} damage.`);
  }
  ecoGuardianOffended(feature.room, colony.name.toLowerCase());
  finishPlayerTurn(colony.bites ? 20 : 10);
}

function pickSummitCap(feature) {
  if (!feature.summitCaps) return;
  if (!addInventoryItem("summit-cap")) {
    showToast("Your pack is too full to carry it.");
    return;
  }
  const first = !naturalistKnows("summit-cap");
  feature.summitCaps -= 1;
  ecoObserve("summit-cap", "harvested");
  naturalist()["summit-cap"].seen = 1;
  addLog(first
    ? "A dead chapolin clings to the top of a glowcap stalk, a thin, pale fungus growing out of its back. The fungus made it climb up here before it died, so its spores would fall on the bed below. You take the fungus."
    : "You pick a summit cap from a dead chapolin clinging to the top of a stalk.");
  finishPlayerTurn();
}

function butcherCarcass(carcass) {
  const species = ECO.species[carcass.species];
  // Without the Dungeon Gourmet Guide you don't know how to butcher tomb creatures at all.
  if (!state.run.gourmetGuideOwned) {
    showToast("You don't know how to butcher this. The Dungeon Gourmet Guide, sold in town, teaches it.");
    return;
  }
  // The ahuizotl's drowned belong to Tlaloc.
  if (carcass.drowned) {
    carcass.meat = 0;
    carcass.edible = false;
    addLog("You put your knife to it, and only then see: no eyes, no nails, no teeth. The ahuizotl's. It belongs to Tlaloc, and your joints begin to ache.");
    if (typeof applyCondition === "function") applyCondition("tlaloc-ache", "Tlaloc");
    ecoObserve("cenote-stalker", "taboo");
    finishPlayerTurn();
    return;
  }
  if (!species?.meat || carcass.meat <= 0) return;
  const showButcherEffect = () => {
    state.playerCarcassHarvestUntil = Date.now() + 360;
    state.carcassHarvestEffects[carcass.id] = {
      until: Date.now() + 520
    };
    window.setTimeout(() => {
      if (state.carcassHarvestEffects[carcass.id]?.until <= Date.now()) {
        delete state.carcassHarvestEffects[carcass.id];
      }
      if (state.gameStarted && state.run?.location === "dungeon") renderMap();
    }, 540);
    renderMap();
  };
  const check = randomInt(20) + bestPartySkillBonus("survival");
  // The guide covers ordinary cuts; a tricky species (the colotl's sting gland) still
  // needs studying or a good Survival check.
  const known = (state.run.progress?.bestiary?.[carcass.species] || 0) >= 3 || naturalist()[carcass.species]?.facts?.includes("prepared");
  if (species.prepare && !known && check < species.prepare.dc) {
    carcass.meat = Math.max(0, carcass.meat - 1);
    if (!carcass.meat) ecoCarcassToBones(carcass);
    addLog(`You cut into the ${ecoName(carcass.species)} the wrong way (Survival ${check}). ${species.prepare.note}`);
    if (species.prepare.hazard && typeof applyCondition === "function") applyCondition(species.prepare.hazard, `The ${ecoName(carcass.species)}`);
    ecoObserve(carcass.species, "hazard");
    showButcherEffect();
    finishPlayerTurn();
    return;
  }
  if (!addInventoryItem(species.meat)) {
    showToast("Your pack is too full to carry the meat.");
    return;
  }
  carcass.meat -= 1;
  ecoObserve(carcass.species, "prepared");
  ecoObserve(species.meat, "harvested");
  if (carcass.meat <= 0) {
    ecoCarcassToBones(carcass);
    addLog(`You butcher the ${ecoName(carcass.species)}: 1 × ${itemDetails(species.meat).name}. Only the bones are left.`);
  } else {
    addLog(`You butcher the ${ecoName(carcass.species)}: 1 × ${itemDetails(species.meat).name}. What's left will feed the scavengers.`);
  }
  showButcherEffect();
  finishPlayerTurn();
}

function leaveOffering(bowl) {
  const itemId = ecoOfferingItem();
  if (!itemId || !removeInventoryItem(itemId)) return;
  const resource = ECO.resources.offering;
  bowl.amount = resource.max;
  let fed = 0;
  for (const creature of [...state.run.enemies, ...(state.run.lurkers || [])]) {
    if (!creature.alive || !ecoSpecies(creature)?.eats.includes("tonalli")) continue;
    ecoCreature(creature).sat = 100;
    if (ecoSpecies(creature).role !== "spirit") continue;
    if (creature.alerted && !creature.provoked) creature.alerted = false;
    fed += 1;
  }
  addLog(fed
    ? `You leave ${itemDetails(itemId).name} in the offering bowl. The air goes still: the restless dead on this floor are fed, and for a long while they'll let you pass.`
    : `You leave ${itemDetails(itemId).name} in the offering bowl. The air goes still.`);
  // An offering also calls back a soul frightened out of you.
  if (ecoRemoveCondition("susto")) addLog("Your frightened soul comes back to you.");
  finishPlayerTurn();
}

// ---------- Describing it ----------

function ecologyFeaturesAt(x, y) {
  return (ecoState()?.features || []).filter((feature) => feature.x === x && feature.y === y);
}

function ecologyFeatureToken(feature) {
  if (feature.kind === "colony") return ECO.colonies[feature.species]?.token || "fungus-patch";
  return ECO.resources[feature.kind]?.token || "fungus-patch";
}

function ecologyFeatureDepleted(feature) {
  if (feature.kind === "colony") return feature.count < 3;
  if (feature.kind === "nest" && feature.abandoned) return true;
  return Boolean(ECO.resources[feature.kind]?.max) && feature.amount <= 0;
}

function ecoColonySize(feature) {
  const colony = ECO.colonies[feature.species];
  const share = feature.count / (colony?.max || 1);
  return share >= 0.75 ? "teeming" : share >= 0.4 ? "thriving" : share >= 0.15 ? "small" : "dwindling";
}

function ecologyFeatureLabel(feature) {
  const resource = ECO.resources[feature.kind] || {};
  if (feature.kind === "carcass") return `${ecoName(feature.species)} carcass${feature.fresh ? "" : " (old)"}`;
  if (feature.kind === "colony") return `${ECO.colonies[feature.species]?.name || "Colony"} (${ecoColonySize(feature)})`;
  if (feature.kind === "nest" && feature.abandoned) return "Abandoned nest";
  if (feature.kind === "mouth") return (feature.hunger || 0) >= 50 ? "Mouth in the rock (hungry)" : "Mouth in the rock";
  return resource.max ? `${resource.name} (${feature.amount}/${resource.max})` : resource.name;
}

function ecologyFeatureDescription(feature) {
  if (feature.kind === "colony") {
    const colony = ECO.colonies[feature.species];
    let text = colony.description;
    if (colony.harvest) {
      text += feature.count >= colony.harvestAt ? " There are enough to take some without hurting the colony." : " Too few right now to take any.";
    }
    if (feature.summitCaps) text += " On top of some glowcap stalks, dead chapolines cling with something pale growing out of them.";
    return text;
  }
  const resource = ECO.resources[feature.kind] || {};
  if (feature.kind === "nest" && feature.abandoned) return "A cold nest. The creature that laid these eggs never came back.";
  let text = resource.description;
  if (feature.kind === "carcass") {
    text = `${resource.description} ${feature.drowned ? "It has no eyes, no nails, no teeth. Something took only those." : feature.edible && feature.fresh && feature.meat > 0 ? "It's still fresh enough to butcher." : ""}`.trim();
  }
  if (feature.kind === "pool" && (state.run.lurkers || []).some((enemy) => enemy.templateId === "cenote-stalker" && distanceInSquares(enemy, feature) <= 5)) {
    text += " The fish here jump all at once, the way they do when a predator is below them.";
  }
  if (feature.kind === "alux-house" && feature.appeased) text += " You've fed it; it keeps watch for you now.";
  if (feature.kind === "mouth") text += (feature.hunger || 0) >= 50 ? " It's hungry: don't step on it." : " It's quiet for now.";
  if (resource.max) text += feature.amount ? ` ${feature.amount} of ${resource.max} left.` : " Eaten bare for now; it will grow back.";
  if (feature.kind === "nest" && feature.owner) text += ` ${ecoName(feature.owner)} laid these.`;
  return text;
}

function ecologyRoomLabel(room) {
  const habitat = ecoHabitat(room);
  if (!habitat) return "";
  return habitat.names?.[ecoBand()] || habitat.name;
}

function ecologyRoomText(room) {
  const habitat = ecoHabitat(room);
  if (!habitat) return "";
  return habitat.texts?.[ecoBand()] || habitat.text;
}

// What the journal knows about a species, for the creature card: only what you've seen
// (or learned by killing enough of them).
function ecologyDietSummary(templateId) {
  const species = ECO.species[templateId];
  if (!species) return null;
  const book = naturalist()[templateId] || { seen: 0, facts: [] };
  const kills = state.run?.progress?.bestiary?.[templateId] || 0;
  const studied = kills >= 3;
  const facts = book.facts || [];
  const pick = (prefix) => facts.filter((fact) => fact.startsWith(prefix)).map((fact) => fact.slice(prefix.length));
  const habitats = [...new Set(pick("habitat:"))].map((id) => ECO.habitats[id]?.name).filter(Boolean);
  const eatsSeen = [...new Set([...pick("eats:"), ...pick("hunts:")])];
  const allHunters = Object.entries(ECO.species)
    .filter(([id, other]) => id !== templateId && species.is.some((kind) => other.eats.includes(kind)) && species.size < other.size)
    .map(([id]) => ecoName(id));
  return {
    known: Boolean(book.seen || kills),
    studied,
    eats: species.eats,
    eatsSeen,
    hunters: studied ? allHunters : [...new Set(pick("huntedBy:"))].map((id) => ecoName(id)),
    habitats,
    note: species.note,
    temperament: species.temperament,
    role: species.role,
    meat: species.meat || null,
    prepared: facts.includes("prepared"),
    hazard: facts.includes("hazard") || studied ? species.prepare?.note || "" : "",
    taboo: Boolean(species.taboo) && (facts.includes("taboo") || studied),
    seen: book.seen || 0
  };
}

function ecologyMoodLabel(creature) {
  const eco = creature?.eco;
  if (!eco || !ecoSpecies(creature)) return "";
  if (creature.asleep && eco.sleeping) return "sleeping off a meal";
  if (eco.rival) return "disputing territory";
  if (eco.waiting) return "waiting its turn";
  if (creature.band) return "on the move";
  if (eco.feeding > 0) return "feeding";
  if (eco.flee > 0) return "fleeing";
  if (eco.hunting) return "hunting";
  const hunger = ecoHungerState(creature);
  if (hunger === "starving") return "starving";
  if (!creature.alerted && ecologyIgnoresPlayer(creature)) return hunger === "gorged" ? "sluggish" : "minding its own business";
  return "";
}

// ---------- Registering the tomb's ingredients, dishes, boons, and troubles ----------

(() => {
  const items = window.CryptsItems;
  const progression = window.CryptsProgression;
  for (const [id, entry] of Object.entries(ECO.ingredients)) {
    const { weight, price, description, ...food } = entry;
    items.gear[id] = { name: entry.name, weight, price, category: "Ingredient", sprite: "supply", description };
  }
  Object.assign(progression.buffs, ECO.buffs);
  Object.assign(progression.conditions, ECO.conditions);
  for (const [id, recipe] of Object.entries(ECO.recipes)) {
    progression.recipes[id] = { ...recipe };
    items.food[id] = { name: recipe.name, sprite: "soup", nutrients: recipe.nutrients, food: recipe.food, buff: recipe.buff };
    items.gear[id] = { name: recipe.name, weight: 1, price: 5, category: "Food", sprite: "soup", description: recipe.description };
  }
})();
