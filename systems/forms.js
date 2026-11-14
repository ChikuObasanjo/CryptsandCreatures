"use strict";

// What a chamber is for, and the shape that follows from it.
//
// A floor used to be made shape first: boxes were dropped at random, and afterwards each one
// was told what lived in it. Now it is made the way a place is made. The land comes first
// (systems/biome.js: where it is high and low, wet and dry, warm, and old). Then each
// PURPOSE the floor needs looks for the site on that land that suits it: water gathers at
// the low wet place, a roost sits high, a den sits dry and a short walk from what it eats.
// Only then does the chamber get its FORM, and the form is one its builders (or the rock)
// would have given a place with that purpose. So a den has one way in, a garden has many,
// a pool is a bowl, and you can tell what a chamber is from across it.
//
//   purpose    what it is                       what its shape has to do
//   basin      where the floor's water gathers  a bowl, low in the middle
//   garden     where things graze               wide, several ways in and out
//   trail      the way between                  long and narrow
//   roost      where things sleep overhead      tall: columns, ledges, room to hang
//   den        where a hunter lies up           small, dry, one way in, off the trail
//   nest       where young are kept             small and warm, one way in
//   vent       where the mouth's heat comes up  close and hot
//   shrine     where offerings were left        something to walk around
//   store      where things were put away       hard to get into, out of the way
//   crossing   where the ways meet              open, the middle of the floor
//
// The forms are the three bands' own (systems/architecture.js has the older ones: hall,
// cell, ell, cross, round, pillared, gallery, court, cave):
//
//   the Lords' fortresses (floors 3–8), built the way the west built. This country is
//   Xalisco, and its old builders raised ring-shaped courts around a round altar (the
//   Teuchitlán tradition's guachimontones) and buried their dead with their goods in
//   chambers at the foot of a shaft (the shaft tombs of Jalisco, Nayarit, and Colima).
//     ring        a round court around an altar            shrine, crossing
//     shaft       a shaft with side chambers, one way in    store
//     ballcourt   the I-shaped court of the rubber-ball game  crossing, trail
//     temazcal    a small round sweat bath with a firebox   vent
//     pens        an aisle of stalls, for what was caught   nest, den
//     chinampa    raised beds between channels              garden, basin
//   the living rock (floors 9–13), shaped like the inside of a body, because it is one
//     lobed       two or three hollows run together         garden, crossing
//     gullet      a long winding throat                     trail
//     pocket      a small blind hollow, one way in          den, nest, store
//     heart       two chambers around a knot of hot rock    vent
//   anywhere there is no builder
//     bowl        a round sink, water in the middle         basin
//     spires      a hollow full of columns (roots hanging through, or stone grown up)   roost, garden
//
// A form is { sizes, build(w, h, flip) } where build returns the chamber's own floor, its
// columns and blocks, and where its middle is. `leaf` forms have a single way in.

const FORM_PURPOSES = ["basin", "garden", "trail", "roost", "den", "nest", "vent", "shrine", "store", "crossing"];

// How well a site on the land suits each purpose. `land` is the land there (elev, moist,
// warm, magic, each 0–1), `site` is { x, y } and `sites` are the purposes already placed.
const FORM_SITE = {
  basin: (land) => 1.2 * land.moist - 2 * land.elev,
  garden: (land, site, sites) => 1.5 * land.moist - Math.abs(land.elev - 0.45) + formNear(site, sites, ["basin"], 10, 8),
  trail: () => 0,
  roost: (land, site, sites) => 2 * land.elev + 0.5 * formNear(site, sites, ["garden"], 11, 8),
  // A hunter lies up dry, a short walk from where its prey feeds and drinks.
  den: (land, site, sites) => 0.8 * (1 - land.moist) + 1.5 * formNear(site, sites, ["garden", "basin"], 12, 7),
  // Nests are kept to the west, the quarter of women and of birth (Cihuatlampa).
  nest: (land, site) => land.warm + 0.5 * (1 - land.moist) + 0.6 * (1 - site.x / (MAP_TILE_SIZE - 1)),
  vent: (land) => 2 * land.warm - land.moist,
  shrine: (land) => 2 * land.magic,
  store: (land) => land.magic + 0.5 * (1 - land.moist),
  crossing: (land, site) => -Math.hypot(site.x - MAP_TILE_SIZE / 2, site.y - MAP_TILE_SIZE / 2) / 10
};

// Best when about `ideal` tiles from the nearest site of one of `kinds`; 0 when there is none.
function formNear(site, sites, kinds, ideal, spread) {
  let nearest = Infinity;
  for (const other of sites) {
    if (!kinds.includes(other.purpose)) continue;
    nearest = Math.min(nearest, Math.hypot(other.x - site.x, other.y - site.y));
  }
  return nearest === Infinity ? 0 : 1 - Math.min(2, Math.abs(nearest - ideal) / spread);
}

// The forms each band gives each purpose, by weight.
const FORM_OF_PURPOSE = {
  expedition: {
    basin: { bowl: 3, round: 1 }, garden: { spires: 2, cave: 2, hall: 1 }, trail: { ell: 2, hall: 1, gallery: 1 },
    roost: { spires: 2, cave: 1, pillared: 1 }, den: { pocket: 2, cell: 2 }, nest: { pocket: 1, cell: 2 },
    vent: { cell: 1 }, shrine: { cross: 2, hall: 1 }, store: { cell: 2, ell: 1 }, crossing: { hall: 2, pillared: 1 }
  },
  court: {
    basin: { bowl: 3, round: 1 }, garden: { chinampa: 2, court: 1, hall: 2, gallery: 2 }, trail: { gallery: 3, ballcourt: 1 },
    roost: { pillared: 3, gallery: 1 }, den: { cell: 2, pens: 1 }, nest: { pens: 3, cell: 1 },
    vent: { temazcal: 1 }, shrine: { ring: 3, cross: 2 }, store: { shaft: 3, cross: 1, cell: 1 }, crossing: { ballcourt: 2, court: 2, ring: 1, pillared: 1 }
  },
  cavern: {
    basin: { bowl: 1 }, garden: { lobed: 3, spires: 1, cave: 2 }, trail: { gullet: 3, cave: 1 },
    roost: { spires: 1 }, den: { pocket: 1 }, nest: { pocket: 1 },
    vent: { heart: 1 }, shrine: { round: 2, cave: 1 }, store: { pocket: 2, cave: 1 }, crossing: { lobed: 2, cave: 2 }
  }
};

// What a floor asks for, in the order the sites are found: water first, then what grows
// by it, then what lives on that.
function formWanted(styleName, depth, count) {
  // (The purposes whose forms are large go early, while there is still room for them.)
  const wanted = ["crossing"];
  if (depth >= 2) wanted.push("shrine");
  wanted.push("basin", "garden");
  // (The purposes with forms of their own go before the plain ones, while there is room.)
  if (depth >= 5) wanted.push("vent");
  wanted.push("store", "nest", "den", "roost", "garden", "trail");
  if (styleName === "cavern") wanted.push("basin", "garden");
  const more = styleName === "court" ? ["trail", "store", "garden", "crossing", "nest", "shrine", "den"]
    : styleName === "cavern" ? ["garden", "trail", "den", "store", "crossing", "roost"]
      : ["trail", "garden", "store", "den", "crossing"];
  for (let n = 0; wanted.length < count; n += 1) wanted.push(more[n % more.length]);
  return wanted.slice(0, Math.max(count, 0));
}

// The forms this band would give a purpose, in the order to try them: a weighted draw
// first, then the rest, then a plain small chamber that fits anywhere.
function formChoices(styleName, purpose) {
  const table = { ...((FORM_OF_PURPOSE[styleName] || FORM_OF_PURPOSE.expedition)[purpose] || { hall: 1 }) };
  const order = [];
  while (Object.keys(table).length) {
    const total = Object.values(table).reduce((sum, weight) => sum + weight, 0);
    let roll = Math.random() * total;
    let chosen = Object.keys(table)[0];
    for (const [shape, weight] of Object.entries(table)) {
      roll -= weight;
      if (roll <= 0) { chosen = shape; break; }
    }
    order.push(chosen);
    delete table[chosen];
  }
  const small = styleName === "cavern" ? "pocket" : "cell";
  if (!order.includes(small)) order.push(small);
  return order;
}

// ---------- Building the forms ----------

const formKey = (lx, ly, w) => ly * w + lx;

// An uneven blob inside (x0..x1, y0..y1), in one piece around its centre.
function formBlob(w, x0, y0, x1, y1, rough = 1) {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rx = (x1 - x0 + 1) / 2;
  const ry = (y1 - y0 + 1) / 2;
  const phases = [Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3];
  const radius = (angle) => 0.86 + rough * (0.1 * Math.sin(2 * angle + phases[0]) + 0.08 * Math.sin(3 * angle + phases[1]) + 0.05 * Math.sin(5 * angle + phases[2]));
  const open = new Set();
  for (let ly = y0; ly <= y1; ly += 1) {
    for (let lx = x0; lx <= x1; lx += 1) {
      const dx = (lx - cx) / rx;
      const dy = (ly - cy) / ry;
      if (Math.hypot(dx, dy) <= radius(Math.atan2(dy, dx)) * 1.06 || (Math.abs(lx - cx) <= 1 && Math.abs(ly - cy) <= 1)) open.add(formKey(lx, ly, w));
    }
  }
  return open;
}

// Keeps only the floor joined to `start` (orthogonally), so a form is always one room.
function formJoined(open, start, w) {
  if (!open.has(start)) return new Set();
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

// Columns scattered through a hollow: never two side by side, never on its middle, and
// never where one would cut the floor in two.
function formColumns(floor, w, h, anchor, share) {
  const pillars = new Set();
  const start = formKey(anchor[0], anchor[1], w);
  const candidates = [...floor].filter((key) => {
    const lx = key % w;
    const ly = Math.floor(key / w);
    return Math.max(Math.abs(lx - anchor[0]), Math.abs(ly - anchor[1])) >= 2 &&
      [1, -1, w, -w].every((step) => floor.has(key + step));
  }).sort(() => Math.random() - 0.5);
  const wanted = Math.round(floor.size * share);
  for (const key of candidates) {
    if (pillars.size >= wanted) break;
    if ([1, -1, w, -w, w + 1, w - 1, -w + 1, -w - 1].some((step) => pillars.has(key + step))) continue;
    floor.delete(key);
    if (formJoined(floor, start, w).size === floor.size) pillars.add(key);
    else floor.add(key);
  }
  void h;
  return pillars;
}

const FORMS = {
  // A round court around a round altar, as the west built them. You walk the ring.
  ring: {
    sizes: [[11, 11], [13, 13]],
    build(w, h) {
      const cx = (w - 1) / 2;
      const cy = (h - 1) / 2;
      const floor = new Set();
      const pillars = new Set();
      for (let ly = 1; ly <= h - 2; ly += 1) {
        for (let lx = 1; lx <= w - 2; lx += 1) {
          if (((lx - cx) / ((w - 2) / 2)) ** 2 + ((ly - cy) / ((h - 2) / 2)) ** 2 > 1.02) continue;
          // The altar: a block in the middle. In the larger courts, four standing stones too.
          const altar = Math.abs(lx - cx) <= 1 && Math.abs(ly - cy) <= 1;
          const stone = w >= 13 && Math.abs(lx - cx) === 3 && Math.abs(ly - cy) === 3;
          if (altar || stone) pillars.add(formKey(lx, ly, w));
          else floor.add(formKey(lx, ly, w));
        }
      }
      return { floor, pillars, anchor: [cx, cy + 2] };
    }
  },
  // A shaft tomb: the foot of the shaft in the middle, a burial chamber to either side,
  // each reached through a narrow neck.
  shaft: {
    sizes: [[13, 7], [7, 13]], leaf: true,
    build(w, h) {
      const wide = w > h;
      const floor = new Set();
      const cx = (w - 1) / 2;
      const cy = (h - 1) / 2;
      const add = (lx, ly) => floor.add(wide ? formKey(lx, ly, w) : formKey(ly, lx, w));
      const along = wide ? cx : cy;
      const across = wide ? cy : cx;
      for (let d = -1; d <= 1; d += 1) for (let e = -1; e <= 1; e += 1) {
        add(along + d, across + e);
        add(along - 4 + d, across + e);
        add(along + 4 + d, across + e);
      }
      add(along - 2, across);
      add(along + 2, across);
      return { floor, pillars: new Set(), anchor: [cx, cy] };
    }
  },
  // The court of the rubber-ball game: a long alley between two benches, a wider yard at
  // each end.
  ballcourt: {
    sizes: [[13, 7], [7, 13]],
    build(w, h) {
      const wide = w > h;
      const floor = new Set();
      const long = wide ? w : h;
      const short = wide ? h : w;
      for (let a = 1; a <= long - 2; a += 1) {
        for (let b = 1; b <= short - 2; b += 1) {
          const yard = a <= 2 || a >= long - 3;
          if (yard || (b >= 2 && b <= short - 3)) floor.add(wide ? formKey(a, b, w) : formKey(b, a, w));
        }
      }
      return { floor, pillars: new Set(), anchor: [(w - 1) / 2, (h - 1) / 2] };
    }
  },
  // A sweat bath: small and round, with the firebox built against one wall.
  temazcal: {
    sizes: [[7, 7]], leaf: true,
    build(w, h, flip) {
      const cx = (w - 1) / 2;
      const cy = (h - 1) / 2;
      const floor = new Set();
      for (let ly = 1; ly <= h - 2; ly += 1) for (let lx = 1; lx <= w - 2; lx += 1) {
        if (((lx - cx) / 2.5) ** 2 + ((ly - cy) / 2.5) ** 2 <= 1.02) floor.add(formKey(lx, ly, w));
      }
      const box = flip ? formKey(cx, h - 2, w) : formKey(cx, 1, w);
      floor.delete(box);
      return { floor, pillars: new Set([box]), anchor: [cx, cy] };
    }
  },
  // Pens: an aisle down the middle and stalls two paces wide on both sides, for what the
  // nets brought up.
  pens: {
    sizes: [[13, 7], [7, 13], [9, 7], [7, 9]],
    build(w, h) {
      const wide = w > h;
      const floor = new Set();
      const pillars = new Set();
      const long = wide ? w : h;
      const short = wide ? h : w;
      const middle = (short - 1) / 2;
      for (let a = 1; a <= long - 2; a += 1) {
        for (let b = 1; b <= short - 2; b += 1) {
          const key = wide ? formKey(a, b, w) : formKey(b, a, w);
          // A stall wall every third pace, on both sides of the aisle. The stub nearest the
          // aisle is a post; the rest is wall.
          if (a % 3 === 0 && b !== middle) {
            if (Math.abs(b - middle) === 1) pillars.add(key);
            continue;
          }
          floor.add(key);
        }
      }
      // The posts stand free (floor on three sides); the wall behind them is plain wall.
      return { floor, pillars, anchor: [(w - 1) / 2, (h - 1) / 2] };
    }
  },
  // Raised beds between channels: a hall whose floor is striped with water (the ground is
  // laid in systems/biome.js).
  chinampa: {
    sizes: [[11, 9], [9, 11], [11, 7], [7, 11]],
    build(w, h) {
      const floor = new Set();
      for (let ly = 1; ly <= h - 2; ly += 1) for (let lx = 1; lx <= w - 2; lx += 1) floor.add(formKey(lx, ly, w));
      return { floor, pillars: new Set(), anchor: [(w - 1) / 2, (h - 1) / 2] };
    }
  },
  // A round sink. The water lies in the middle (systems/biome.js lays it).
  bowl: {
    sizes: [[9, 9], [11, 9], [9, 11], [11, 11]],
    build(w, h) {
      const cx = (w - 1) / 2;
      const cy = (h - 1) / 2;
      const floor = formJoined(formBlob(w, 1, 1, w - 2, h - 2, 0.5), formKey(cx, cy, w), w);
      return { floor, pillars: new Set(), anchor: [cx, cy] };
    }
  },
  // A hollow full of columns: roots hanging through from the jungle above, or stone grown
  // up from the floor. Things roost in the tops and graze between the feet.
  spires: {
    sizes: [[9, 9], [11, 9], [9, 11], [11, 11]],
    build(w, h) {
      const cx = (w - 1) / 2;
      const cy = (h - 1) / 2;
      const floor = formJoined(formBlob(w, 1, 1, w - 2, h - 2, 0.8), formKey(cx, cy, w), w);
      const pillars = formColumns(floor, w, h, [cx, cy], 0.09);
      return { floor, pillars, anchor: [cx, cy] };
    }
  },
  // Two or three hollows run together, like the chambers of a shell.
  lobed: {
    sizes: [[11, 9], [9, 11], [11, 11], [13, 9], [9, 13]],
    build(w, h) {
      const cx = (w - 1) / 2;
      const cy = (h - 1) / 2;
      const wide = w >= h;
      const open = new Set();
      const lobes = Math.max(w, h) >= 13 ? 3 : 2;
      for (let n = 0; n < lobes; n += 1) {
        // Lobes along the long side, each a little off the line, overlapping their neighbors.
        const share = lobes === 1 ? 0.5 : n / (lobes - 1);
        const long = wide ? w : h;
        const short = wide ? h : w;
        const reach = (long - 2) / lobes * 0.72;
        const mid = 1 + reach + share * (long - 3 - 2 * reach);
        const half = (short - 2) / 2;
        const off = (Math.random() - 0.5) * Math.max(0, half - 2.6);
        const a0 = Math.max(1, Math.round(mid - reach));
        const a1 = Math.min(long - 2, Math.round(mid + reach));
        const b0 = Math.max(1, Math.round((short - 1) / 2 + off - Math.min(half, 3.2)));
        const b1 = Math.min(short - 2, Math.round((short - 1) / 2 + off + Math.min(half, 3.2)));
        const blob = wide ? formBlob(w, a0, b0, a1, b1, 0.7) : formBlob(w, b0, a0, b1, a1, 0.7);
        for (const key of blob) open.add(key);
      }
      // The middle is always open, so the lobes join there.
      for (let d = -1; d <= 1; d += 1) for (let e = -1; e <= 1; e += 1) open.add(formKey(cx + d, cy + e, w));
      const floor = formJoined(open, formKey(cx, cy, w), w);
      return { floor, pillars: new Set(), anchor: [cx, cy] };
    }
  },
  // A long throat that winds and swells.
  gullet: {
    sizes: [[13, 7], [7, 13], [11, 7], [7, 11], [9, 7], [7, 9]],
    build(w, h) {
      const wide = w > h;
      const long = wide ? w : h;
      const short = wide ? h : w;
      const middle = (short - 1) / 2;
      const phase = Math.random() * 6.3;
      const swell = Math.random() * 6.3;
      const floor = new Set();
      for (let a = 1; a <= long - 2; a += 1) {
        const centre = middle + Math.sin(a * 0.75 + phase) * (middle - 2.1);
        const width = 1.1 + 0.55 * (0.5 + 0.5 * Math.sin(a * 0.5 + swell));
        for (let b = 1; b <= short - 2; b += 1) {
          if (Math.abs(b - centre) <= width) floor.add(wide ? formKey(a, b, w) : formKey(b, a, w));
        }
      }
      // Its middle is wherever the throat runs at the halfway point.
      const half = (long - 1) / 2;
      const at = Math.max(1, Math.min(short - 2, Math.round(middle + Math.sin(half * 0.75 + phase) * (middle - 2.1))));
      const anchor = wide ? [half, at] : [at, half];
      floor.add(formKey(anchor[0], anchor[1], w));
      return { floor: formJoined(floor, formKey(anchor[0], anchor[1], w), w), pillars: new Set(), anchor };
    }
  },
  // A small blind hollow.
  pocket: {
    sizes: [[5, 5], [7, 5], [5, 7], [7, 7]], leaf: true,
    build(w, h) {
      const cx = (w - 1) / 2;
      const cy = (h - 1) / 2;
      const floor = formJoined(formBlob(w, 1, 1, w - 2, h - 2, 0.9), formKey(cx, cy, w), w);
      return { floor, pillars: new Set(), anchor: [cx, cy] };
    }
  },
  // Two chambers side by side around a knot of hot rock, like the two sides of a heart.
  heart: {
    sizes: [[11, 9], [9, 11], [9, 7], [7, 9]],
    build(w, h) {
      const cx = (w - 1) / 2;
      const cy = (h - 1) / 2;
      const wide = w > h;
      const open = new Set();
      const left = wide ? formBlob(w, 1, 1, cx, h - 2, 0.5) : formBlob(w, 1, 1, w - 2, cy, 0.5);
      const right = wide ? formBlob(w, cx, 1, w - 2, h - 2, 0.5) : formBlob(w, 1, cy, w - 2, h - 2, 0.5);
      for (const key of [...left, ...right]) open.add(key);
      // The knot: a block of rock in the middle, with a way past it on one side.
      const pillars = new Set();
      const anchor = wide ? [cx, cy + 2] : [cx + 2, cy];
      for (let d = -1; d <= 0; d += 1) {
        const key = wide ? formKey(cx, cy + d, w) : formKey(cx + d, cy, w);
        open.delete(key);
        pillars.add(key);
      }
      open.add(formKey(anchor[0], anchor[1], w));
      open.add(wide ? formKey(cx, cy + 1, w) : formKey(cx + 1, cy, w));
      const floor = formJoined(open, formKey(anchor[0], anchor[1], w), w);
      for (const key of [...pillars]) if (![1, -1, w, -w].some((step) => floor.has(key + step))) pillars.delete(key);
      return { floor, pillars, anchor };
    }
  }
};

function formIs(shape) {
  return Object.prototype.hasOwnProperty.call(FORMS, shape);
}

function formIsLeaf(shape) {
  return Boolean(FORMS[shape]?.leaf);
}

function formSize(shape) {
  const sizes = FORMS[shape].sizes;
  const [w, h] = sizes[Math.floor(Math.random() * sizes.length)];
  return { w, h };
}

// Builds a chamber's own floor once (`room.mask`, `room.posts`) and puts its middle where
// the form says.
function formBuild(room) {
  if (room.mask) return;
  const built = FORMS[room.shape].build(room.mapW, room.mapH, Boolean(room.flipY));
  room.mask = built.floor;
  room.posts = built.pillars;
  room.anchorX = room.mapX + built.anchor[0];
  room.anchorY = room.mapY + built.anchor[1];
}

function formFloor(room, x, y) {
  formBuild(room);
  const key = (y - room.mapY) * room.mapW + (x - room.mapX);
  return room.mask.has(key) || room.posts.has(key);
}

function formPost(room, x, y) {
  formBuild(room);
  return room.posts.has((y - room.mapY) * room.mapW + (x - room.mapX));
}

// How snug a chamber is, from its shape as dug: few ways in and little floor is snug; a
// wide chamber with many openings is not.
function formShelter(room, terrain) {
  let area = 0;
  let openings = 0;
  for (let y = room.mapY; y < room.mapY + room.mapH; y += 1) {
    for (let x = room.mapX; x < room.mapX + room.mapW; x += 1) {
      if (terrain[y * MAP_TILE_SIZE + x] !== "floor") continue;
      area += 1;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const type = terrain[(y + dy) * MAP_TILE_SIZE + x + dx];
        if (type === "door" || type === "corridor") openings += 1;
      }
    }
  }
  return Math.max(0, Math.min(1, 1.15 - 0.2 * openings - area / 110));
}
