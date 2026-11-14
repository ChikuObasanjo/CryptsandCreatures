"use strict";

// How the tomb is built, band by band.
//
// Each band of the tomb was made by different hands, and its floors are laid out the way
// those builders built (see data/lore.js and systems/biome.js for the bands):
//
//   expedition (floors 1–2)   The Empire's survey stair: practical rooms joined by straight
//                             shafts with an occasional dogleg. Roots have broken through
//                             here and there, so a few chambers are natural hollows.
//   court      (floors 3–8)   The Lords' fortresses, planned like a ceremonial centre
//                             (Teotihuacan's avenue, Monte Albán's plaza, Mitla's tombs):
//                             chambers line up on shared axes, many have a mirror twin
//                             across the floor's centre line, doors open in the middle of a
//                             wall, and the long routes are wide processional galleries
//                             with square turns. Colonnaded courts, long vaulted galleries,
//                             and cross-shaped tombs.
//   cavern     (floors 9–13)  The living rock of the earth's body: no builders at all.
//                             Hollows of uneven shape joined by winding, widening tunnels,
//                             open mouths instead of doors.
//
// The same digging rules are used when a floor is first made and when its passages are
// remade after a death (regenerateFloorPassages), so a floor keeps its character.
// Floors made before this (layout version 3) keep the older style ("v3") when remade.

const ARCH_STYLES = {
  v3: { turn: 0, noise: 1.6, gallery: 0, axialDoors: 0, roomThrough: 7, mirror: 0, align: 0, caverns: false },
  expedition: { turn: 5, noise: 0.7, gallery: 0, axialDoors: 0.6, roomThrough: 9, mirror: 0.15, align: 0.35, caverns: false },
  court: { turn: 16, noise: 0, gallery: 0.3, axialDoors: 1.6, roomThrough: 14, mirror: 0.75, align: 0.65, avenue: true, caverns: false },
  cavern: { turn: 0, noise: 3.2, gallery: 0, axialDoors: 0, roomThrough: 6, mirror: 0, align: 0, caverns: true }
};

function archStyleName(depth) {
  const band = typeof tombBand === "function" ? tombBand(depth) : "fortress";
  if (band === "rootbound") return "expedition";
  if (band === "fortress") return "court";
  return "cavern";
}

function archStyle(name) {
  return ARCH_STYLES[name] || ARCH_STYLES.v3;
}

// ---------- Chamber shapes ----------

// Shapes per band, by weight. (Old shapes keep their v3 sizes; the new ones are below.)
const ARCH_SHAPE_WEIGHTS = {
  expedition: { hall: 2.4, cell: 1.4, ell: 1, round: 0.8, cave: 0.8, cross: 0.6, pillared: 0.5 },
  court: { hall: 1.6, gallery: 1.5, pillared: 1.4, cross: 1.3, court: 0.7, cell: 1, ell: 0.4, round: 0.2 },
  cavern: { cave: 5, round: 1.2, ell: 0.4, hall: 0.3 }
};

function archPickShape(styleName, wet = false) {
  const weights = { ...(ARCH_SHAPE_WEIGHTS[styleName] || ARCH_SHAPE_WEIGHTS.expedition) };
  if (wet && weights.round) weights.round *= 2;
  if (wet && weights.cave) weights.cave *= 1.4;
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  let roll = Math.random() * total;
  for (const [shape, weight] of Object.entries(weights)) {
    roll -= weight;
    if (roll <= 0) return shape;
  }
  return "hall";
}

function archRoomSize(shape) {
  if (formIs(shape)) return formSize(shape);
  const odd = (min, max) => min + 2 * (randomInt(Math.floor((max - min) / 2) + 1) - 1);
  // A long vaulted gallery, three tiles across inside, running either way.
  if (shape === "gallery") return randomInt(2) === 1 ? { w: odd(11, 13), h: 5 } : { w: 5, h: odd(11, 13) };
  // A colonnaded court, open in the middle.
  if (shape === "court") return { w: 11, h: 11 };
  // A cross-shaped tomb with arms three tiles wide.
  if (shape === "cross") return { w: odd(9, 11), h: odd(9, 11) };
  if (shape === "cave") return { w: odd(7, 11), h: odd(7, 11) };
  return v3RoomSize(shape);
}

// A natural hollow: an uneven blob, always open around its centre and all in one piece.
function archCaveMask(room) {
  const w = room.mapW;
  const h = room.mapH;
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const rx = (w - 2) / 2;
  const ry = (h - 2) / 2;
  const phases = [Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3];
  const radius = (angle) => 0.78 + 0.13 * Math.sin(2 * angle + phases[0]) + 0.1 * Math.sin(3 * angle + phases[1]) + 0.07 * Math.sin(5 * angle + phases[2]);
  const open = new Set();
  for (let ly = 1; ly < h - 1; ly += 1) {
    for (let lx = 1; lx < w - 1; lx += 1) {
      const dx = (lx - cx) / rx;
      const dy = (ly - cy) / ry;
      const reach = Math.hypot(dx, dy);
      if (reach <= radius(Math.atan2(dy, dx)) * 1.08 || (Math.abs(lx - cx) <= 1 && Math.abs(ly - cy) <= 1)) open.add(ly * w + lx);
    }
  }
  // Keep only what joins the centre.
  const start = Math.round(cy) * w + Math.round(cx);
  const joined = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const at = queue.pop();
    for (const step of [1, -1, w, -w]) {
      const next = at + step;
      if (open.has(next) && !joined.has(next) && Math.abs((next % w) - (at % w)) <= 1) {
        joined.add(next);
        queue.push(next);
      }
    }
  }
  return joined;
}

function archRoomFloor(room, x, y) {
  if (formIs(room.shape)) return formFloor(room, x, y);
  if (room.shape === "cave") {
    if (!room.mask) room.mask = archCaveMask(room);
    return room.mask.has((y - room.mapY) * room.mapW + (x - room.mapX));
  }
  return v3RoomFloor(room, x, y);
}

function archIsPillar(room, x, y) {
  if (formIs(room.shape)) return formPost(room, x, y);
  if (room.shape === "court") {
    // Columns all round, two tiles in from the walls, and an inner ring at the corners of
    // the open centre.
    const lx = x - room.mapX;
    const ly = y - room.mapY;
    const edge = (value, size) => value === 2 || value === size - 3;
    if ((edge(lx, room.mapW) && ly >= 2 && ly <= room.mapH - 3 && ly % 2 === 0) ||
      (edge(ly, room.mapH) && lx >= 2 && lx <= room.mapW - 3 && lx % 2 === 0)) {
      return !(Math.abs(lx - (room.mapW - 1) / 2) <= 0 || Math.abs(ly - (room.mapH - 1) / 2) <= 0);
    }
    return false;
  }
  return v3IsPillar(room, x, y);
}

// ---------- Placement ----------

// Where to try a chamber: snapped to a two-tile grid, and in the planned bands often lined
// up with a chamber already placed, so rooms share axes the way a planned site does.
function archProbe(style, placed, size, { westHalf = false } = {}) {
  const probe = { x: 2 + randomInt(westHalf ? Math.floor(size / 2) - 6 : size - 4) - 1, y: 2 + randomInt(size - 4) - 1 };
  if (style.align) {
    probe.x -= probe.x % 2;
    probe.y -= probe.y % 2;
    if (placed.length && Math.random() < style.align) {
      const other = placed[randomInt(placed.length) - 1];
      if (westHalf || randomInt(2) === 1) probe.y = other.anchorY;
      else probe.x = other.anchorX;
    }
  }
  return probe;
}

// The mirror twin of a chamber across the floor's north–south centre line.
function archMirror(room, size) {
  const mapX = size - room.mapX - room.mapW;
  const twin = { ...room, mapX, flipX: !room.flipX, mask: room.mask ? archMirrorMask(room.mask, room.mapW) : undefined, twin: true };
  // A form carries its columns and its middle with it.
  if (room.posts) twin.posts = archMirrorMask(room.posts, room.mapW);
  if (Number.isInteger(room.anchorX)) twin.anchorX = mapX + (room.mapW - 1 - (room.anchorX - room.mapX));
  return twin;
}

function archMirrorMask(mask, width) {
  return new Set([...mask].map((index) => {
    const x = index % width;
    return index - x + (width - 1 - x);
  }));
}

// ---------- Passages ----------

// A small binary heap for the path search (the old one rescanned an array every step).
function archHeap() {
  const items = [];
  return {
    get size() { return items.length; },
    push(priority, value) {
      items.push([priority, value]);
      let i = items.length - 1;
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (items[parent][0] <= items[i][0]) break;
        [items[parent], items[i]] = [items[i], items[parent]];
        i = parent;
      }
    },
    pop() {
      const top = items[0];
      const last = items.pop();
      if (items.length) {
        items[0] = last;
        let i = 0;
        for (;;) {
          const left = 2 * i + 1;
          const right = left + 1;
          let smallest = i;
          if (left < items.length && items[left][0] < items[smallest][0]) smallest = left;
          if (right < items.length && items[right][0] < items[smallest][0]) smallest = right;
          if (smallest === i) break;
          [items[smallest], items[i]] = [items[i], items[smallest]];
          i = smallest;
        }
      }
      return top;
    }
  };
}

const ARCH_STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Digs the passages for `edges` (pairs of room indexes). Works on `terrain` in place.
// `roomFloor` maps tile → owning room (or -1); `pillars` is a Set of pillar tiles.
// Returns false if a passage could not be dug (the caller retries or gives up).
function archDigPassages({ terrain, rooms, roomFloor, pillars = new Set(), edges, styleName }) {
  const style = archStyle(styleName);
  const size = MAP_TILE_SIZE;
  const at = (x, y) => y * size + x;
  const doors = new Set();
  const noise = new Float32Array(size * size).map(() => Math.random() * style.noise);
  const wallCrossable = (x, y) => {
    if (pillars.has(at(x, y))) return false;
    const floorSides = ARCH_STEPS.filter(([dx, dy]) => roomFloor[at(x + dx, y + dy)] >= 0);
    const openSides = ARCH_STEPS.filter(([dx, dy]) => {
      const type = terrain[at(x + dx, y + dy)];
      return type === "stone" || type === "corridor";
    });
    // A door needs room floor straight through on one side and open ground on the other.
    return floorSides.some(([dx, dy]) => openSides.some(([ox, oy]) => ox === -dx && oy === -dy));
  };
  // How far a door would sit from the middle of its wall (planned builders centre them).
  const offAxis = (x, y, dx, dy) => {
    const owner = ARCH_STEPS.map(([ax, ay]) => roomFloor[at(x + ax, y + ay)]).find((index) => index >= 0);
    const room = rooms[owner];
    if (!room) return 0;
    return dx !== 0 ? Math.abs(y - room.anchorY) : Math.abs(x - room.anchorX);
  };
  // The longest links become galleries, wide processional halls.
  const lengths = edges.map(([a, b]) => Math.abs(rooms[a].anchorX - rooms[b].anchorX) + Math.abs(rooms[a].anchorY - rooms[b].anchorY));
  const galleryCut = style.gallery ? [...lengths].sort((p, q) => q - p)[Math.max(0, Math.floor(edges.length * style.gallery) - 1)] : Infinity;

  const dig = (fromIndex, toIndex, wide) => {
    const from = rooms[fromIndex];
    const to = rooms[toIndex];
    const start = at(from.anchorX, from.anchorY);
    const goal = at(to.anchorX, to.anchorY);
    // Search over (tile, heading) so turning can cost extra: straight halls, square bends.
    const states = size * size * 5;
    const cost = new Float32Array(states).fill(Infinity);
    const previous = new Int32Array(states).fill(-1);
    const heap = archHeap();
    cost[start * 5] = 0;
    heap.push(0, start * 5);
    let reached = -1;
    while (heap.size) {
      const [priority, current] = heap.pop();
      const tile = Math.floor(current / 5);
      const heading = current % 5;
      if (priority - (Math.abs((tile % size) - to.anchorX) + Math.abs(Math.floor(tile / size) - to.anchorY)) * 1.2 > cost[current] + 1e-6) continue;
      if (tile === goal) { reached = current; break; }
      const cx = tile % size;
      const cy = Math.floor(tile / size);
      const onWall = terrain[tile] === "wall" && !doors.has(tile);
      ARCH_STEPS.forEach(([dx, dy], direction) => {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 1 || ny < 1 || nx >= size - 1 || ny >= size - 1) return;
        const next = at(nx, ny);
        const type = terrain[next];
        let step;
        if (doors.has(next)) step = 1;
        else if (type === "wall") {
          if (onWall || !wallCrossable(nx, ny)) return;
          const crowded = ARCH_STEPS.some(([ax, ay]) => doors.has(at(nx + ax, ny + ay))) ? 30 : 0;
          step = 9 + crowded + style.axialDoors * offAxis(nx, ny, dx, dy);
        } else if (type === "floor") {
          const owner = roomFloor[next];
          step = owner === fromIndex || owner === toIndex ? 1 : style.roomThrough;
        } else if (type === "corridor") step = 1.2;
        else step = 2.4 + noise[next];
        if (onWall && type === "wall") return;
        // Turning outside a chamber costs extra in the built bands.
        const turning = heading && heading - 1 !== direction && type !== "floor" && terrain[tile] !== "floor";
        if (turning) step += style.turn;
        const state = next * 5 + direction + 1;
        const total = cost[current] + step;
        if (total < cost[state]) {
          cost[state] = total;
          previous[state] = current;
          heap.push(total + (Math.abs(nx - to.anchorX) + Math.abs(ny - to.anchorY)) * 1.2, state);
        }
      });
    }
    if (reached < 0) return false;
    const path = [];
    for (let state = reached; state >= 0 && Math.floor(state / 5) !== start; state = previous[state]) path.push(state);
    for (const state of path) {
      const tile = Math.floor(state / 5);
      if (terrain[tile] === "stone") terrain[tile] = "corridor";
      else if (terrain[tile] === "wall") {
        terrain[tile] = "door";
        doors.add(tile);
      }
    }
    if (wide) archWiden(terrain, path, doors);
    return true;
  };
  // The Lords' floors are laid out along a processional avenue down the centre line (like
  // Teotihuacan's), three tiles wide; the passages below join it where it's the easy way.
  if (style.avenue) archAvenue(terrain, rooms);
  for (let i = 0; i < edges.length; i += 1) {
    const [a, b] = edges[i];
    if (!dig(a, b, lengths[i] >= galleryCut && lengths[i] >= 10)) return false;
  }
  if (style.caverns) archHollow(terrain, roomFloor);
  archFillUnreached(terrain, rooms[0]);
  return true;
}

function archAvenue(terrain, rooms) {
  const size = MAP_TILE_SIZE;
  const middle = Math.floor(size / 2);
  // It runs between the northernmost and southernmost chambers that sit near the line.
  const near = rooms.filter((room) => Math.abs(room.anchorX - middle) <= 6);
  if (near.length < 2) return;
  const top = Math.min(...near.map((room) => room.anchorY));
  const bottom = Math.max(...near.map((room) => room.anchorY));
  if (bottom - top < 12) return;
  for (let y = top; y <= bottom; y += 1) {
    for (let x = middle - 1; x <= middle + 1; x += 1) {
      const index = y * size + x;
      if (terrain[index] === "stone") terrain[index] = "corridor";
    }
  }
}

// Passage that leads nowhere (an avenue stub behind a chamber, say) is filled back in.
function archFillUnreached(terrain, origin) {
  const size = MAP_TILE_SIZE;
  const open = (type) => type === "floor" || type === "corridor" || type === "door";
  const reached = new Uint8Array(size * size);
  const start = origin.anchorY * size + origin.anchorX;
  reached[start] = 1;
  const queue = [start];
  while (queue.length) {
    const at = queue.pop();
    const x = at % size;
    for (const [dx, dy] of ARCH_STEPS) {
      const nx = x + dx;
      const next = at + dy * size + dx;
      if (nx < 0 || nx >= size || next < 0 || next >= size * size || reached[next] || !open(terrain[next])) continue;
      reached[next] = 1;
      queue.push(next);
    }
  }
  for (let i = 0; i < terrain.length; i += 1) if (terrain[i] === "corridor" && !reached[i]) terrain[i] = "stone";
}

// Makes a passage three tiles wide: a gallery. Only bare stone is cut, never a wall, and
// never right beside a door (a door stays a single opening in its wall).
function archWiden(terrain, path, doors) {
  const size = MAP_TILE_SIZE;
  for (const state of path) {
    const tile = Math.floor(state / 5);
    const heading = state % 5;
    if (!heading || terrain[tile] !== "corridor") continue;
    const [dx, dy] = ARCH_STEPS[heading - 1];
    const x = tile % size;
    const y = Math.floor(tile / size);
    for (const side of [-1, 1]) {
      const sx = x + dy * side;
      const sy = y + dx * side;
      if (sx < 2 || sy < 2 || sx >= size - 2 || sy >= size - 2) continue;
      const index = sy * size + sx;
      if (terrain[index] !== "stone") continue;
      if (ARCH_STEPS.some(([ax, ay]) => doors.has((sy + ay) * size + sx + ax))) continue;
      // Don't merge into a passage running alongside (two galleries become one wide blob).
      const beyond = (sy + dx * side) * size + sx + dy * side;
      if (terrain[beyond] === "corridor") continue;
      terrain[index] = "corridor";
    }
  }
}

// Living rock: tunnels swell and narrow, nooks fill in, and openings into hollows are
// open mouths, not doors.
function archHollow(terrain, roomFloor) {
  const size = MAP_TILE_SIZE;
  const inside = (x, y) => x >= 2 && y >= 2 && x < size - 2 && y < size - 2;
  const tunnels = [];
  for (let i = 0; i < terrain.length; i += 1) if (terrain[i] === "corridor") tunnels.push(i);
  for (const tile of tunnels) {
    if (Math.random() > 0.42) continue;
    const x = tile % size;
    const y = Math.floor(tile / size);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const index = (y + dy) * size + x + dx;
        if (inside(x + dx, y + dy) && terrain[index] === "stone") terrain[index] = "corridor";
      }
    }
  }
  // Two passes of smoothing: stone nearly surrounded by tunnel becomes tunnel.
  for (let pass = 0; pass < 2; pass += 1) {
    const fill = [];
    for (let y = 2; y < size - 2; y += 1) {
      for (let x = 2; x < size - 2; x += 1) {
        const index = y * size + x;
        if (terrain[index] !== "stone") continue;
        let open = 0;
        for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
          const type = terrain[(y + dy) * size + x + dx];
          if (type === "corridor") open += 1;
        }
        if (open >= 5) fill.push(index);
      }
    }
    for (const index of fill) terrain[index] = "corridor";
  }
  for (let i = 0; i < terrain.length; i += 1) if (terrain[i] === "door") terrain[i] = "corridor";
  void roomFloor;
}

// The links to dig between chambers: a spanning tree (jittered when remaking, so the
// routes change) plus a few loops so there's more than one way round.
//
// Chambers with a single way in (dens, nests, shaft tombs, sweat baths: `leaf`, or a form
// that is one) hang off the rest: the tree and the loops are laid through the other
// chambers, and each leaf is then joined to the nearest of those. So you never have to go
// through a den to get anywhere, and there is always a way round.
function archPlanEdges(rooms, { jitter = false, loops = 0.38 } = {}) {
  const distance = (a, b) => Math.hypot(rooms[a].anchorX - rooms[b].anchorX, rooms[a].anchorY - rooms[b].anchorY);
  const noise = rooms.map(() => rooms.map(() => (jitter ? 0.75 + Math.random() * 0.75 : 1)));
  const isLeaf = (index) => index !== 0 && (rooms[index].leaf || formIsLeaf(rooms[index].shape)) && !rooms[index].planned;
  const through = rooms.map((room, index) => index).filter((index) => !isLeaf(index));
  const edges = [];
  const inTree = new Set([through[0]]);
  while (inTree.size < through.length) {
    let best = null;
    for (const a of inTree) {
      for (const b of through) {
        if (inTree.has(b)) continue;
        const d = distance(a, b) * noise[a][b];
        if (!best || d < best.d) best = { a, b, d };
      }
    }
    inTree.add(best.b);
    edges.push([best.a, best.b]);
  }
  const linked = (a, b) => edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  for (const a of through) {
    if (Math.random() > loops) continue;
    const candidates = through.map((b) => ({ b, d: distance(a, b) }))
      .filter(({ b, d }) => b !== a && !linked(a, b) && d < 20)
      .sort((first, second) => first.d - second.d);
    if (candidates[0]) edges.push([a, candidates[0].b]);
  }
  for (let leaf = 0; leaf < rooms.length; leaf += 1) {
    if (!isLeaf(leaf)) continue;
    // A den opens toward where its prey feeds and drinks, when that's not much farther.
    const draws = (b) => rooms[leaf].purpose === "den" && ["garden", "basin"].includes(rooms[b].purpose) ? 0.6 : 1;
    const nearest = through.map((b) => ({ b, d: distance(leaf, b) * noise[leaf][b] * draws(b) })).sort((first, second) => first.d - second.d)[0];
    if (nearest) edges.push([nearest.b, leaf]);
  }
  return edges;
}
