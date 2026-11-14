"use strict";

// The tomb's two grids.
//
// The tomb is PLANNED on a coarse grid (MAP_PLAN_SIZE, 45 squares a side): the tomb plan,
// where each chamber sits, its form, the walls, and the passages are all laid out there, so
// chambers keep the shapes they were designed with. Each floor is then LIVED on a grid
// MAP_SCALE times finer (MAP_TILE_SIZE, 90 a side): every planned square becomes a 2 × 2
// block of tiles, and everything that moves, sees, grows, or is placed works on those.
// A step is one fine tile, so crossing a chamber takes twice the steps it used to, and
// everything that measures "how far" counts in fine tiles (gridReach(n): n planned squares).
//
//   withPlanGrid(fn)       runs fn with tileIndex/MAP_TILE_SIZE on the plan grid
//   gridUpscaleFloor(d)    a floor fresh from the planner, made fine
//   gridPlanTerrain(t)     a fine floor's terrain read back at plan scale (for re-digging)
//   gridMigrateRun(saved)  a save from before the fine grid, made fine in place
//
// Floors made on the fine grid have layoutVersion 4.

const GRID_LAYOUT_VERSION = 4;

// n squares of the old (planned) grid, in fine tiles. Use for every range, radius, sight,
// hearing, and spacing; never for "adjacent" (that is one tile on any grid).
function gridReach(n) {
  return n * MAP_SCALE;
}

function withPlanGrid(fn) {
  const saved = MAP_TILE_SIZE;
  MAP_TILE_SIZE = MAP_PLAN_SIZE;
  try {
    return fn();
  } finally {
    MAP_TILE_SIZE = saved;
  }
}

function gridUpscaleArray(list, from = MAP_PLAN_SIZE) {
  const size = from * MAP_SCALE;
  const out = new Array(size * size);
  for (let y = 0; y < size; y += 1) {
    const row = Math.floor(y / MAP_SCALE) * from;
    for (let x = 0; x < size; x += 1) out[y * size + x] = list[row + Math.floor(x / MAP_SCALE)];
  }
  return out;
}

function gridUpscaleString(text, from = MAP_PLAN_SIZE) {
  return gridUpscaleArray([...text], from).join("");
}

// Every fine tile of a planned square.
function gridBlock(planIndex, from = MAP_PLAN_SIZE) {
  const px = planIndex % from;
  const py = Math.floor(planIndex / from);
  const size = from * MAP_SCALE;
  const tiles = [];
  for (let dy = 0; dy < MAP_SCALE; dy += 1) {
    for (let dx = 0; dx < MAP_SCALE; dx += 1) tiles.push((py * MAP_SCALE + dy) * size + px * MAP_SCALE + dx);
  }
  return tiles;
}

function gridScalePoint(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
  point.x *= MAP_SCALE;
  point.y *= MAP_SCALE;
}

// A chamber's outline and middle, on the fine grid. (Its masks stay at plan scale: they are
// only read while the plan is being made, or re-dug at plan scale.) `x`/`y` are the
// chamber's cell on the old 5 × 5 room grid and are not tile positions.
function gridScaleRoom(room) {
  for (const key of ["mapX", "mapY", "mapW", "mapH", "anchorX", "anchorY"]) {
    if (Number.isFinite(room[key])) room[key] *= MAP_SCALE;
  }
  room.grid = MAP_SCALE;
  return room;
}

// A fine chamber, as it was on the plan.
function gridPlanRoom(room) {
  if (room.grid !== MAP_SCALE) return room;
  const plan = { ...room };
  for (const key of ["mapX", "mapY", "mapW", "mapH", "anchorX", "anchorY"]) {
    if (Number.isFinite(room[key])) plan[key] = Math.floor(room[key] / MAP_SCALE);
  }
  delete plan.grid;
  return plan;
}

function gridPlanTerrain(terrain) {
  const size = MAP_PLAN_SIZE;
  const fine = size * MAP_SCALE;
  const out = new Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) out[y * size + x] = terrain[(y * MAP_SCALE) * fine + x * MAP_SCALE];
  }
  return out;
}

// A floor from the planner (systems/dungeons.js), made fine.
function gridUpscaleFloor(dungeon) {
  if (!dungeon || dungeon.terrain.length !== MAP_PLAN_SIZE * MAP_PLAN_SIZE) return dungeon;
  dungeon.terrain = gridUpscaleArray(dungeon.terrain);
  dungeon.rooms.forEach(gridScaleRoom);
  (dungeon.floorStairs || []).forEach(gridScalePoint);
  if (dungeon.layoutVersion === 3) dungeon.layoutVersion = GRID_LAYOUT_VERSION;
  return dungeon;
}

// ---------- Saves from before the fine grid ----------

// Scales every position found under `value` (any object with numeric x and y), except the
// chambers' room-grid cells, which are handled by gridScaleRoom.
function gridScalePositions(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const entry of value) gridScalePositions(entry, seen);
    return;
  }
  gridScalePoint(value);
  for (const [key, entry] of Object.entries(value)) {
    if (key === "rooms" || key === "mind" || key === "townPosition") continue;
    gridScalePositions(entry, seen);
  }
}

// One floor's worth of saved state (the live floor in `run`, or a stored floor snapshot).
function gridMigrateFloor(floor) {
  const planSquares = MAP_PLAN_SIZE * MAP_PLAN_SIZE;
  if (!Array.isArray(floor?.terrain) || floor.terrain.length !== planSquares) return false;
  floor.terrain = gridUpscaleArray(floor.terrain);
  if (Array.isArray(floor.seen) && floor.seen.length === planSquares) floor.seen = gridUpscaleArray(floor.seen);
  if (Array.isArray(floor.openDoors)) floor.openDoors = floor.openDoors.flatMap((index) => gridBlock(index));
  (floor.rooms || []).forEach(gridScaleRoom);
  for (const key of ["player", "enemies", "lurkers", "treasures", "hazards", "wells", "floorStairs"]) gridScalePositions(floor[key]);
  if (floor.ecology) {
    if (typeof floor.ecology.ground === "string" && floor.ecology.ground.length === planSquares) {
      floor.ecology.ground = gridUpscaleString(floor.ecology.ground);
    }
    gridScalePositions(floor.ecology.features);
    gridScalePositions(floor.ecology.colonies);
  }
  // Plans made on the old grid are stale now; creatures make new ones.
  for (const creature of [...(floor.enemies || []), ...(floor.lurkers || [])]) {
    if (creature.eco) { creature.eco.route = null; creature.eco.target = null; }
  }
  if (floor.dungeonLayoutVersion === 3) floor.dungeonLayoutVersion = GRID_LAYOUT_VERSION;
  return true;
}

// A whole saved run. Returns true if anything was changed.
function gridMigrateRun(saved) {
  if (!saved || typeof saved !== "object") return false;
  const live = gridMigrateFloor(saved);
  if (live) {
    gridScalePositions(saved.party);
    gridScalePositions(saved.summons);
  }
  let stored = false;
  for (const snapshot of Object.values(saved.dungeonFloors || {})) stored = gridMigrateFloor(snapshot) || stored;
  if (live || stored) {
    if (saved.camp) gridScalePoint(saved.camp);
    for (const delver of saved.delvers?.list || []) gridScalePoint(delver);
  }
  return live || stored;
}
