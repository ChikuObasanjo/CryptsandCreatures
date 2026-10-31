"use strict";

// The lay of the land under Chiltomatlan. Before a floor's chambers are placed, the floor
// gets a terrain: where the rock is high or low, where water seeps, where the warmth of
// the mouth below comes up, where old power lingers. Chambers are shaped by where they
// sit (low, wet ground makes round, water-worn caverns; the Lords' fortress floors are
// halls and pillared rooms), and once the passages are dug, each chamber's place in the
// tomb's life follows from its surroundings and its neighbors:
//
//   water runs downhill along the passages and pools in the lowest chambers
//   damp spreads out from water; fungus and moss need it, bats and scorpions avoid it
//   roosts sit high and sheltered, and their guano feeds the gardens next door
//   predators den in sheltered dead ends within reach of something to eat
//   scavengers gather where the dens and the earth's mouths leave bones
//   the deep floors are the living rock of the earth's own body (Tlaltecuhtli)
//
// Bands of the tomb (see data/lore.js):
//   1–2   the Empire's expedition stair, under the jungle: roots from above, bats, water
//   3–8   the Lords' fortresses, reclaimed by what grows up from below
//   9–12  the living rock of the passage: wet, shell-like, warm, the earth's mouths
//   13    the mouth itself

const BIOME = window.CryptsEcology;

// Ground under a tile, one character each, kept in the floor's ecology (compact for saves).
//   .  bare stone        w  shallow water     d  deep water (only swimmers cross)
//   m  moss              r  roots             g  guano            b  bones
//   u  rubble            a  ash and dust      c  star crystal     y  mycelium
//   f  the earth's flesh (red living rock)
const GROUND_NAMES = {
  w: "Shallow water", d: "Deep water", m: "Moss", r: "Roots", g: "Guano", b: "Bones",
  u: "Rubble", a: "Dust and ash", c: "Star crystal", y: "Mycelium", f: "Living rock"
};
const GROUND_CLASSES = { w: "water", d: "deep", m: "moss", r: "roots", g: "guano", b: "bones", u: "rubble", a: "ash", c: "crystal", y: "mycelium", f: "flesh" };

function tombBand(floor = state.run?.dungeonFloor || 1) {
  return floor >= 13 ? "mouth" : floor >= 9 ? "living-rock" : floor >= 3 ? "fortress" : "rootbound";
}

// ---------- Terrain fields ----------

// Smooth value noise over the map: random values on a coarse lattice, eased between.
function biomeNoiseField(cells) {
  const lattice = Array.from({ length: (cells + 1) * (cells + 1) }, () => Math.random());
  const ease = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = (x / (MAP_TILE_SIZE - 1)) * cells;
    const fy = (y / (MAP_TILE_SIZE - 1)) * cells;
    const x0 = Math.min(cells - 1, Math.floor(fx));
    const y0 = Math.min(cells - 1, Math.floor(fy));
    const tx = ease(fx - x0);
    const ty = ease(fy - y0);
    const at = (i, j) => lattice[j * (cells + 1) + i];
    const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
    const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
    return top * (1 - ty) + bottom * ty;
  };
}

function makeFloorTerrain(depth) {
  const broad = biomeNoiseField(3);
  const fine = biomeNoiseField(7);
  const damp = biomeNoiseField(4);
  const heat = biomeNoiseField(3);
  const power = biomeNoiseField(4);
  // The whole floor tilts one way, so water has somewhere to run.
  const angle = Math.random() * Math.PI * 2;
  const tilt = (x, y) => 0.5 + 0.5 * (((x / MAP_TILE_SIZE) - 0.5) * Math.cos(angle) + ((y / MAP_TILE_SIZE) - 0.5) * Math.sin(angle));
  return {
    depth,
    band: tombBand(depth),
    sample(x, y) {
      return {
        elev: Math.min(1, Math.max(0, 0.45 * broad(x, y) + 0.25 * fine(x, y) + 0.3 * tilt(x, y))),
        moist: damp(x, y),
        warm: heat(x, y),
        magic: power(x, y)
      };
    }
  };
}

// What a chamber is shaped like, from where it sits and which band of the tomb it's in.
function biomeShapeFor(terrain, x, y) {
  const env = terrain.sample(x, y);
  const pick = (weights) => {
    const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
    let roll = Math.random() * total;
    for (const [shape, weight] of Object.entries(weights)) {
      roll -= weight;
      if (roll <= 0) return shape;
    }
    return "hall";
  };
  const wet = env.elev < 0.4 || env.moist > 0.7;
  if (terrain.band === "fortress") {
    return pick({ hall: 3, pillared: 2.4, cross: 1.6, cell: 1.4, ell: 1, round: wet ? 1.2 : 0.4 });
  }
  if (terrain.band === "living-rock" || terrain.band === "mouth") {
    return pick({ round: wet ? 4 : 2.6, ell: 2, hall: 1.2, cell: 0.8, cross: 0.4, pillared: 0.2 });
  }
  return pick({ hall: 2.4, round: wet ? 2.6 : 1.2, ell: 1.4, cell: 1, cross: 0.8, pillared: 0.6 });
}

// ---------- Each chamber's surroundings ----------

function roomHops(rooms, origin) {
  const distance = rooms.map(() => Infinity);
  distance[origin] = 0;
  const queue = [origin];
  while (queue.length) {
    const current = queue.shift();
    for (const next of rooms[current].links || []) {
      if (distance[next] !== Infinity) continue;
      distance[next] = distance[current] + 1;
      queue.push(next);
    }
  }
  return distance;
}

// Fills room.env = { elev, moist, warm, shelter, magic, water } (all 0–1, water is
// "basin", "stream", or "") and returns the floor's water courses.
function computeRoomEnvironments(rooms, terrain) {
  const depth = terrain.depth;
  const band = terrain.band;
  const raw = rooms.map((room) => terrain.sample(room.anchorX, room.anchorY));
  // Rank the heights so every floor has a real high and low.
  const order = raw.map((env, index) => ({ index, elev: env.elev })).sort((a, b) => a.elev - b.elev);
  const rank = new Array(rooms.length);
  order.forEach(({ index }, position) => { rank[index] = rooms.length > 1 ? position / (rooms.length - 1) : 0.5; });
  rooms.forEach((room, index) => {
    room.env = { elev: rank[index], moist: 0, warm: 0, shelter: 0, magic: 0, water: "" };
  });
  // Water pools where a chamber sits lower than everything it connects to.
  const eligible = (index) => index > 0 && rooms[index].type !== "boss" && !rooms[index].mainTreasure;
  const basins = rooms.map((room, index) => index).filter((index) => eligible(index) &&
    (rooms[index].links || []).every((link) => rank[link] > rank[index]) && rank[index] < 0.6)
    .sort((a, b) => rank[a] - rank[b]);
  const wetBand = band === "living-rock" ? 3 : band === "rootbound" ? 2 : 2;
  const chosen = basins.slice(0, wetBand);
  // Every floor keeps at least one pool, so something can drink.
  if (!chosen.length) {
    const lowest = order.map(({ index }) => index).find((index) => eligible(index));
    if (lowest !== undefined) chosen.push(lowest);
  }
  for (const index of chosen) rooms[index].env.water = "basin";
  // A stream runs down from the highest chamber to the first pool, along the passages.
  const streams = [];
  if (chosen.length) {
    let current = order[order.length - 1].index;
    const path = [current];
    for (let step = 0; step < rooms.length && !chosen.includes(current); step += 1) {
      const lower = (rooms[current].links || []).filter((link) => rank[link] < rank[current])
        .sort((a, b) => rank[a] - rank[b])[0];
      if (lower === undefined) break;
      current = lower;
      path.push(current);
    }
    if (path.length > 1 && chosen.includes(path[path.length - 1])) {
      // On the tenth floor water runs uphill, toward the surface (data/lore.js).
      streams.push(depth === 10 ? [...path].reverse() : path);
      for (const index of path) if (!rooms[index].env.water) rooms[index].env.water = "stream";
    }
  }
  // Damp spreads from water, thinning with every passage.
  const wetHops = rooms.map(() => Infinity);
  for (const index of rooms.map((room, i) => i).filter((i) => rooms[i].env.water)) {
    const hops = roomHops(rooms, index);
    hops.forEach((value, i) => { wetHops[i] = Math.min(wetHops[i], rooms[index].env.water === "basin" ? value : value + 0.6); });
  }
  const damper = band === "living-rock" ? 0.18 : band === "fortress" ? -0.05 : 0.08;
  rooms.forEach((room, index) => {
    const fromWater = wetHops[index] === Infinity ? 0 : 0.8 ** wetHops[index];
    room.env.moist = clamp01(0.3 * raw[index].moist + 0.62 * fromWater + damper);
  });
  // Warmth rises from the mouth below; deeper floors have vents.
  const vents = [];
  if (depth >= 5) {
    const candidates = rooms.map((room, index) => index).filter((index) => eligible(index) && !rooms[index].env.water);
    const ventCount = depth >= 9 ? 2 : 1;
    for (let n = 0; n < ventCount && candidates.length; n += 1) {
      const pick = candidates.splice(randomInt(candidates.length) - 1, 1)[0];
      vents.push(pick);
    }
  }
  rooms.forEach((room, index) => {
    let warm = 0.15 + (depth / DUNGEON_FLOOR_COUNT) * 0.45 + 0.25 * raw[index].warm;
    for (const vent of vents) {
      const hops = roomHops(rooms, vent)[index];
      warm += hops === 0 ? 0.45 : hops === 1 ? 0.2 : 0;
    }
    if (room.env.water === "basin") warm -= 0.15;
    room.env.warm = clamp01(warm);
    room.env.vent = vents.includes(index);
  });
  // Shelter: dead ends and small rooms are snug; great halls and crossroads are not.
  rooms.forEach((room) => {
    const degree = (room.links || []).length;
    const shapeBonus = { cell: 0.2, ell: 0.12, round: 0.05, hall: -0.05, cross: -0.12, pillared: -0.15 }[room.shape] || 0;
    room.env.shelter = clamp01(1.05 - 0.27 * degree + shapeBonus + (Math.random() - 0.5) * 0.12);
  });
  // Old power: the Lords' works, the deep rock, and the mouth.
  rooms.forEach((room, index) => {
    const bandMagic = { rootbound: 0.05, fortress: 0.2, "living-rock": 0.3, mouth: 0.6 }[band];
    room.env.magic = clamp01(bandMagic + 0.45 * raw[index].magic + (room.shape === "pillared" ? 0.12 : 0));
  });
  return { streams, vents };
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

// ---------- Habitats ----------

// How well a habitat suits a chamber: its preferred surroundings, minus how far off they are.
function habitatFit(habitat, env) {
  let score = habitat.weight || 1;
  for (const [key, [center, tolerance]] of Object.entries(habitat.prefers || {})) {
    const off = ((env[key] ?? 0.5) - center) / tolerance;
    score -= off * off;
  }
  if (habitat.water === "basin" && env.water !== "basin") return -Infinity;
  if (habitat.water === "dry" && env.water) score -= 3;
  if (habitat.water !== "basin" && env.water === "basin") score -= 4;
  return score;
}

function habitatAllowed(habitat, floor) {
  return floor >= habitat.depth[0] && floor <= habitat.depth[1];
}

// Gives every chamber its purpose from its surroundings, then checks that the food web
// holds together: a den needs prey within reach, a bone yard needs something leaving bones.
function assignHabitatsFromEnvironment(rooms, floor = state.run.dungeonFloor || 1) {
  const habitats = Object.entries(BIOME.habitats).filter(([, habitat]) => habitatAllowed(habitat, floor));
  const eligible = rooms.map((room, index) => index)
    .filter((index) => index > 0 && !rooms[index].mainTreasure && !["boss", "exit", "entrance"].includes(rooms[index].type));
  const counts = {};
  const assigned = new Map();
  // Basins first (they can only be water), then the rest in a random order.
  const ordered = shuffle([...eligible]).sort((a, b) => (rooms[b].env?.water === "basin" ? 1 : 0) - (rooms[a].env?.water === "basin" ? 1 : 0));
  // Some chambers stay bare: quiet rock to walk through, look around, and catch your breath.
  const bareShare = 0.16 + Math.random() * 0.1;
  let bare = Math.round(eligible.length * bareShare);
  for (const index of ordered) {
    const env = rooms[index].env || { elev: 0.5, moist: 0.5, warm: 0.5, shelter: 0.5, magic: 0.3, water: "" };
    if (bare > 0 && env.water !== "basin" && Math.random() < 0.5) {
      assigned.set(index, null);
      bare -= 1;
      continue;
    }
    const scored = habitats.map(([id, habitat]) => {
      let score = habitatFit(habitat, env) - 1.4 * (counts[id] || 0) + (Math.random() - 0.5) * 1.1;
      // Gardens grow fat beside a roost; roosts like gardens to forage over.
      const neighborIds = (rooms[index].links || []).map((link) => assigned.get(link)).filter(Boolean);
      for (const [other, bonus] of Object.entries(habitat.likesNear || {})) {
        if (neighborIds.includes(other)) score += bonus;
      }
      return { id, score };
    }).filter(({ score }) => Number.isFinite(score)).sort((a, b) => b.score - a.score);
    const choice = scored[0]?.id || null;
    assigned.set(index, choice);
    if (choice) counts[choice] = (counts[choice] || 0) + 1;
  }
  for (const index of eligible) rooms[index].habitat = assigned.get(index) ?? null;
  for (const room of rooms) if (room.habitat === undefined) room.habitat = null;
  // The food web has to hold together.
  const within = (index, ids, reach) => {
    const hops = roomHops(rooms, index);
    return rooms.some((room, other) => other !== index && hops[other] <= reach && ids.includes(room.habitat));
  };
  for (const index of eligible) {
    const habitat = BIOME.habitats[rooms[index].habitat];
    if (!habitat?.needsNear) continue;
    if (within(index, habitat.needsNear.habitats, habitat.needsNear.reach)) continue;
    rooms[index].habitat = habitat.needsNear.otherwise ?? null;
  }
  // Something to graze on every floor (the bottom of the food chain), and a shrine below the first.
  const has = (ids) => rooms.some((room) => ids.includes(room.habitat));
  const swap = (ids, fallbackPool) => {
    const options = eligible.filter((index) => rooms[index].env?.water !== "basin" && fallbackPool(rooms[index]));
    if (!options.length) return;
    const pick = options.sort((a, b) => (rooms[b].env?.moist || 0) - (rooms[a].env?.moist || 0))[0];
    rooms[pick].habitat = ids[0];
  };
  const grazing = ["fungal-garden", "insect-cavern", "overgrown-ruins"].filter((id) => habitatAllowed(BIOME.habitats[id], floor));
  if (!has(grazing)) swap(grazing, (room) => !room.habitat || ["damp-cavern"].includes(room.habitat));
  if (floor >= 2 && !has(["shrine"])) swap(["shrine"], (room) => !room.habitat);
  for (const room of rooms) {
    if (room.habitat && !BIOME.habitats[room.habitat]) room.habitat = null;
  }
}

// ---------- Dressing the ground ----------

function groundString(ground) {
  return ground.join("");
}

// Lays water, moss, roots, guano, bones, rubble, and crystal over the floor tiles, from the
// chambers' habitats and the water courses. Deep water is kept clear of doors and chamber
// centers, and never cuts a chamber in two.
function dressFloorGround(rooms, terrain, courses) {
  const ground = new Array(MAP_TILE_SIZE * MAP_TILE_SIZE).fill(".");
  const floorTiles = (room) => {
    const tiles = [];
    for (let y = room.mapY + 1; y < room.mapY + room.mapH - 1; y += 1) {
      for (let x = room.mapX + 1; x < room.mapX + room.mapW - 1; x += 1) {
        if (terrain[tileIndex(x, y)] === "floor") tiles.push({ x, y });
      }
    }
    return tiles;
  };
  const sprinkle = (tiles, char, share) => {
    for (const tile of tiles) if (ground[tileIndex(tile.x, tile.y)] === "." && Math.random() < share) ground[tileIndex(tile.x, tile.y)] = char;
  };
  rooms.forEach((room, index) => {
    const tiles = floorTiles(room);
    const habitat = BIOME.habitats[room.habitat];
    const dress = habitat?.ground || "";
    if (room.env?.water === "basin" || room.habitat === "flooded-chamber") {
      laySpringPool(room, tiles, terrain, ground);
    }
    for (const char of dress) {
      const share = { m: 0.35, r: 0.22, g: 0.4, b: 0.16, u: 0.12, a: 0.25, c: 0.14, y: 0.3, f: 0.5, w: 0.15 }[char] || 0.2;
      sprinkle(tiles, char, share);
    }
    if (!habitat && room.env?.moist > 0.65) sprinkle(tiles, "m", 0.18);
    if (index === 0) for (const tile of tiles) ground[tileIndex(tile.x, tile.y)] = ground[tileIndex(tile.x, tile.y)] === "d" ? "w" : ".";
  });
  // Streams: shallow water along the corridors between the chambers they join.
  for (const path of courses.streams || []) {
    for (let step = 0; step + 1 < path.length; step += 1) {
      wetCorridor(rooms[path[step]], rooms[path[step + 1]], terrain, ground);
    }
  }
  return groundString(ground);
}

// Deep water in the middle of a low chamber, ringed with shallows, as long as every door
// and the chamber's center can still reach each other on foot.
function laySpringPool(room, tiles, terrain, ground) {
  const cx = room.mapX + (room.mapW - 1) / 2;
  const cy = room.mapY + (room.mapH - 1) / 2;
  const rx = Math.max(1, (room.mapW - 4) / 2);
  const ry = Math.max(1, (room.mapH - 4) / 2);
  const offset = { x: (Math.random() - 0.5) * rx * 0.8, y: (Math.random() - 0.5) * ry * 0.8 };
  const entrances = [];
  for (const tile of tiles) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const kind = terrain[tileIndex(tile.x + dx, tile.y + dy)];
      if (kind === "door" || kind === "corridor") entrances.push(tile);
    }
  }
  const keep = new Set([...entrances, { x: room.anchorX, y: room.anchorY }].map((tile) => tileIndex(tile.x, tile.y)));
  const deep = [];
  for (const tile of tiles) {
    const d = ((tile.x - cx - offset.x) / rx) ** 2 + ((tile.y - cy - offset.y) / ry) ** 2;
    const index = tileIndex(tile.x, tile.y);
    if (keep.has(index)) continue;
    if (d <= 0.55) deep.push(tile);
    else if (d <= 1.25) ground[index] = "w";
  }
  for (const tile of deep) ground[tileIndex(tile.x, tile.y)] = "d";
  // Make sure the dry and shallow tiles still connect every way in and out.
  const walkable = (tile) => ground[tileIndex(tile.x, tile.y)] !== "d";
  const open = tiles.filter(walkable);
  if (!open.length) return;
  const start = open.find((tile) => tile.x === room.anchorX && tile.y === room.anchorY) || open[0];
  const reached = new Set([tileIndex(start.x, start.y)]);
  const queue = [start];
  const inRoom = new Set(tiles.map((tile) => tileIndex(tile.x, tile.y)));
  while (queue.length) {
    const current = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: current.x + dx, y: current.y + dy };
      const key = tileIndex(next.x, next.y);
      if (!inRoom.has(key) || reached.has(key) || ground[key] === "d") continue;
      reached.add(key);
      queue.push(next);
    }
  }
  const cut = open.some((tile) => !reached.has(tileIndex(tile.x, tile.y)));
  if (cut) for (const tile of deep) ground[tileIndex(tile.x, tile.y)] = "w";
}

function wetCorridor(from, to, terrain, ground) {
  // Walk the corridor tiles between the two chambers by a short search over corridors.
  const start = { x: from.anchorX, y: from.anchorY };
  const goal = tileIndex(to.anchorX, to.anchorY);
  const previous = new Map([[tileIndex(start.x, start.y), -1]]);
  const queue = [start];
  while (queue.length) {
    const current = queue.shift();
    const key = tileIndex(current.x, current.y);
    if (key === goal) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: current.x + dx, y: current.y + dy };
      const nextKey = tileIndex(next.x, next.y);
      if (previous.has(nextKey) || !["floor", "corridor", "door"].includes(terrain[nextKey])) continue;
      previous.set(nextKey, key);
      queue.push(next);
    }
  }
  if (!previous.has(goal)) return;
  for (let key = goal; key >= 0; key = previous.get(key)) {
    if (terrain[key] === "corridor" && ground[key] === ".") ground[key] = "w";
    if (previous.get(key) === undefined) break;
  }
}

// ---------- Reading the ground ----------

function groundAt(x, y) {
  const ground = state.run?.ecology?.ground;
  if (!ground || x < 0 || y < 0 || x >= MAP_TILE_SIZE || y >= MAP_TILE_SIZE) return ".";
  return ground[tileIndex(x, y)] || ".";
}

function deepWaterAt(x, y) {
  return state.run?.location === "dungeon" && groundAt(x, y) === "d";
}

// Swimmers cross deep water: the water creatures, and you after a meal of ahuauhtli.
function canSwim(mover) {
  if (!mover) return false;
  if (mover === state.run?.player) return typeof activeBuff === "function" && Boolean(activeBuff("water-sure"));
  return Boolean(BIOME.species[mover.templateId]?.aquatic);
}

function groundClass(x, y) {
  return GROUND_CLASSES[groundAt(x, y)] || "";
}

function groundName(x, y) {
  return GROUND_NAMES[groundAt(x, y)] || "";
}
