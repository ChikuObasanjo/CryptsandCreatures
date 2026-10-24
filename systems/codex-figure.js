"use strict";

// Codex-style adventurer figure.
//
// Draws the player and companions in the manner of the painted Central Mexican codices the
// rest of the game's art comes from: a profile head with a large almond eye and ear spool,
// a frontal torso, profile legs and sandaled feet, flat mineral colors, and heavy ink
// outlines with a slight hand-drawn wobble. Every builder choice (people, skin, hair,
// garment, adornment, headwear, face paint, armor, shield, cloak, weapon, Mahuiz's regalia)
// changes the drawing. The figure is returned as SVG markup on a 200 × 200 canvas,
// facing east; west-facing poses are mirrored and north-facing poses show the back of the head.

const CODEX_INK = "#2e211a";
// Line weight relative to the original bold outlines. The tomb's art is painted with a fine
// brush, so figures use thin, slightly uneven ink lines and soft watercolor fills.
const CODEX_LINE = 0.6;
const CODEX_COLORS = {
  ink: CODEX_INK,
  paper: "#f4e7c8",
  white: "#f6eedb",
  cream: "#ecd9ad",
  red: "#b5402c",
  redDark: "#7f2a1f",
  gold: "#e1ad3b",
  goldDark: "#a8771f",
  jade: "#2f8f78",
  jadeLight: "#6cc0a2",
  turquoise: "#3aa3a6",
  blue: "#3f7ea8",
  obsidian: "#231b18",
  wood: "#8a5733",
  woodLight: "#b47c47",
  stone: "#9a978c",
  hide: "#8c5b37",
  hideLight: "#b9824f",
  quilt: "#efe5cb",
  iron: "#8f9592",
  feather: "#2e8f5e",
  featherLight: "#68b77f",
  steel: "#c9cfcc",
  steelDark: "#8d9592",
  lacquer: "#2b2523",
  lacquerRed: "#a8322a",
  silk: "#3f6fb0",
  copper: "#c47a3d",
  copperDark: "#8e4f24",
  verdigris: "#5aa58a",
  flint: "#b8a98a",
  bone: "#e8dcc0",
  shell: "#cf5a3a"
};

const CODEX_RACE_SHAPES = {
  human: { sx: 1, sy: 1, head: 1 },
  elf: { sx: 0.93, sy: 1.04, head: 1 },
  "half-elf": { sx: 0.97, sy: 1.02, head: 1 },
  dwarf: { sx: 1.1, sy: 0.84, head: 1.08 },
  halfling: { sx: 0.95, sy: 0.76, head: 1.14 },
  gnome: { sx: 0.93, sy: 0.74, head: 1.16 },
  "half-orc": { sx: 1.1, sy: 1.03, head: 1 },
  dragonborn: { sx: 1.08, sy: 1.05, head: 1 },
  tiefling: { sx: 1, sy: 1, head: 1 }
};

const CODEX_RACE_SKIN = {
  dragonborn: "#3f8a77",
  "half-orc": "#71865a",
  tiefling: "#a2545c"
};

const codexFigureCache = new Map();

// Head pieces that leave the hair showing (bands, crowns, plumes); everything else is a helm.
const CODEX_OPEN_HEADGEAR = new Set(["amacalli", "heron-crest", "deer-crown", "skull-band", "xiuhuitzolli", "quetzal-headdress"]);

// Full-body suits color the limbs; other clothes leave arms and legs bare.
const CODEX_SUITS = {
  "jaguar-clothes": "#e2a536",
  "eagle-clothes": "#f6eedb",
  "tzitzimitl-clothes": "#33254f",
  "coyote-suit": "#9b8a72"
};
const CODEX_KILT_SUITS = ["jaguar-clothes", "eagle-clothes", "tzitzimitl-clothes", "coyote-suit"];

function codexShade(hex, amount) {
  const value = Number.parseInt(String(hex).replace("#", ""), 16);
  if (!Number.isFinite(value)) return hex;
  const channels = [value >> 16, (value >> 8) & 255, value & 255]
    .map((channel) => Math.max(0, Math.min(255, Math.round(channel + amount))));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

// A filled shape with the house ink outline.
function codexShape(d, fill, width = 2.6, extra = "") {
  return `<path d="${d}" fill="${fill}" stroke="${CODEX_INK}" stroke-width="${(width * CODEX_LINE).toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"${extra}/>`;
}

// An unfilled ink line.
function codexLine(d, width = 2, color = CODEX_INK, extra = "") {
  // Ink lines thin with the house weight; colored strokes (paint, cord, trim) thin less.
  const scale = color === CODEX_INK ? CODEX_LINE : 0.8;
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${(width * scale).toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"${extra}/>`;
}

// A limb: an ink stroke with a narrower color stroke on top gives an even outline.
function codexLimb(d, width, fill) {
  const stroke = (strokeWidth, color) =>
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${strokeWidth.toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"/>`;
  return stroke(width + 5.2 * CODEX_LINE, CODEX_INK) + stroke(width, fill);
}

// A tapered limb segment through [x, y, radius] points: a filled, inked outline that swells
// and narrows like a painted arm or leg (shoulder to wrist, thigh to ankle), with round ends.
function codexTaper(points, fill, width = 2.4) {
  const normals = points.map((point, index) => {
    const before = points[Math.max(0, index - 1)];
    const after = points[Math.min(points.length - 1, index + 1)];
    const dx = after[0] - before[0];
    const dy = after[1] - before[1];
    const length = Math.hypot(dx, dy) || 1;
    return [-dy / length, dx / length];
  });
  const left = points.map(([x, y, r], index) => [x + normals[index][0] * r, y + normals[index][1] * r]);
  const right = points.map(([x, y, r], index) => [x - normals[index][0] * r, y - normals[index][1] * r]).reverse();
  const smooth = (side) => {
    let d = "";
    for (let index = 1; index < side.length; index += 1) {
      const previous = side[index - 1];
      const current = side[index];
      const before = side[Math.max(0, index - 2)];
      const after = side[Math.min(side.length - 1, index + 1)];
      const c1 = [previous[0] + (current[0] - before[0]) / 6, previous[1] + (current[1] - before[1]) / 6];
      const c2 = [current[0] - (after[0] - previous[0]) / 6, current[1] - (after[1] - previous[1]) / 6];
      d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${current[0].toFixed(1)} ${current[1].toFixed(1)}`;
    }
    return d;
  };
  const end = points[points.length - 1];
  const start = points[0];
  const f = (point) => `${point[0].toFixed(1)} ${point[1].toFixed(1)}`;
  const d = `M${f(left[0])}${smooth(left)} A${end[2]} ${end[2]} 0 0 0 ${f(right[0])}${smooth(right)} A${start[2]} ${start[2]} 0 0 0 ${f(left[0])} Z`;
  return codexShape(d, fill, width);
}

function codexCircle(cx, cy, r, fill, width = 2.2) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${CODEX_INK}" stroke-width="${(width * CODEX_LINE).toFixed(2)}"/>`;
}

function codexFeather(x, y, angle, length, fill, tip = CODEX_COLORS.white) {
  const half = length / 2;
  return `<g transform="translate(${x} ${y}) rotate(${angle})">` +
    codexShape(`M0 0 C${-length * 0.22} ${-half * 0.5} ${-length * 0.2} ${-length * 0.85} 0 ${-length} C${length * 0.2} ${-length * 0.85} ${length * 0.22} ${-half * 0.5} 0 0 Z`, fill, 1.8) +
    codexShape(`M0 ${-length * 0.72} C${-length * 0.12} ${-length * 0.8} ${-length * 0.1} ${-length * 0.96} 0 ${-length} C${length * 0.1} ${-length * 0.96} ${length * 0.12} ${-length * 0.8} 0 ${-length * 0.72} Z`, tip, 1.4) +
    codexLine(`M0 -2 L0 ${-length * 0.7}`, 1.1) +
    "</g>";
}

function codexPalette(character) {
  const appearance = character?.appearance || {};
  const race = CODEX_RACE_SHAPES[character?.race] ? character.race : "human";
  // Peoples with their own coloring fall back to their first tone when a save predates the choice.
  const tones = typeof raceSkinTones === "function" ? raceSkinTones(race) : null;
  const skin = tones && !tones.some((tone) => tone.value === appearance.skin)
    ? (CODEX_RACE_SKIN[race] || tones[0].value)
    : appearance.skin || CODEX_RACE_SKIN[race] || "#9a603c";
  const crestColors = race === "dragonborn" && typeof CREST_COLORS !== "undefined" ? CREST_COLORS : null;
  const hair = crestColors
    ? (crestColors.some((color) => color.value === appearance.hair) ? appearance.hair : crestColors[0].value)
    : race === "dwarf" && !appearance.hair ? "#5c3229" : appearance.hair || "#211a17";
  const tunic = appearance.tunic || "#334d78";
  const trim = appearance.trim || CODEX_COLORS.red;
  // The second color in woven borders: gold, unless the trim itself is gold-like.
  const trimAlt = trim.toLowerCase() === CODEX_COLORS.gold ? CODEX_COLORS.red : CODEX_COLORS.gold;
  return {
    trim,
    trimAlt,
    trimDark: codexShade(trim, -36),
    race,
    skin,
    skinDark: codexShade(skin, -34),
    skinLight: codexShade(skin, 30),
    hair,
    hairLight: codexShade(hair, 46),
    tunic,
    tunicDark: codexShade(tunic, -36),
    tunicLight: codexShade(tunic, 52)
  };
}

// Step-fret (xicalcoliuhqui) border band, drawn along a horizontal strip.
function codexFretBand(x, y, width, height, ground, ink) {
  const steps = Math.max(2, Math.floor(width / (height * 1.6)));
  const unit = width / steps;
  let d = "";
  for (let index = 0; index < steps; index += 1) {
    const left = x + index * unit;
    d += `M${left + unit * 0.12} ${y + height * 0.82} L${left + unit * 0.12} ${y + height * 0.2} L${left + unit * 0.62} ${y + height * 0.2} L${left + unit * 0.62} ${y + height * 0.55} L${left + unit * 0.4} ${y + height * 0.55} `;
  }
  return codexShape(`M${x} ${y} L${x + width} ${y} L${x + width} ${y + height} L${x} ${y + height} Z`, ground, 1.8) +
    codexLine(d, 1.5, ink);
}

function codexWeapon(tieredId) {
  const tiered = (typeof WEAPONS !== "undefined" && WEAPONS[tieredId]) || {};
  const id = tiered.baseId || tieredId;
  const weapon = (typeof WEAPONS !== "undefined" && WEAPONS[id]) || {};
  const icon = weapon.icon || "sword";
  const c = CODEX_COLORS;
  const parts = [];
  const blades = (x1, x2, top, bottom, step = 8, sides = "both") => {
    let d = "";
    for (let y = top + 4; y <= bottom - 6; y += step) {
      if (sides !== "right") d += `M${x1} ${y} L${x1 - 6} ${y + 3} L${x1} ${y + 6} Z `;
      if (sides !== "left") d += `M${x2} ${y} L${x2 + 6} ${y + 3} L${x2} ${y + 6} Z `;
    }
    return codexShape(d, c.obsidian, 1.6);
  };
  const art = weapon.art || "";
  if (art === "rapier") {
    parts.push(codexShape("M122.5 8 L125.5 8 L126 88 L122 88 Z", c.steel, 1.6));
    parts.push(codexLine("M124 12 L124 84", 0.9, c.steelDark));
    parts.push(codexLine("M112 92 C114 84 134 84 136 92", 2.4, c.gold));
    parts.push(codexShape("M116 88 C118 96 130 96 132 88 Z", c.gold, 1.8));
    parts.push(codexShape("M121 92 L127 92 L127 106 L121 106 Z", c.wood, 1.8));
    parts.push(codexCircle(124, 108, 3.6, c.gold, 1.6));
  } else if (art === "broadsword") {
    parts.push(codexShape("M119 20 L124 6 L129 20 L128.5 86 L119.5 86 Z", c.steel, 2));
    parts.push(codexLine("M124 14 L124 82", 1.4, c.steelDark));
    parts.push(codexShape("M110 86 L138 86 L138 92 L110 92 Z", c.gold, 1.8));
    parts.push(codexShape("M121 92 L127 92 L127 108 L121 108 Z", c.redDark, 1.8));
    parts.push(codexCircle(124, 111, 4, c.gold, 1.6));
  } else if (art === "halberd") {
    parts.push(codexLimb("M124 186 L124 22", 3.8, c.woodLight));
    parts.push(codexShape("M124 4 L127 22 L121 22 Z", c.steel, 1.6));
    parts.push(codexShape("M126 26 C142 22 150 32 148 48 C140 44 132 44 126 46 Z", c.steel, 2));
    parts.push(codexShape("M122 30 L110 36 L114 30 L106 26 L122 26 Z", c.steel, 1.6));
    parts.push(codexShape("M120 48 L128 48 L128 56 L120 56 Z", c.red, 1.6));
    parts.push(codexLine("M120 60 L118 74 M128 60 L130 72", 1.6, c.red));
  } else if (art === "arquebus") {
    parts.push(codexShape("M118 120 L114 96 L122 92 L128 116 Z", c.wood, 2.2));
    parts.push(codexShape("M120 94 L126 92 L130 20 L126 18 Z", c.steelDark, 2));
    parts.push(codexLine("M124 26 L128 26", 2.6, c.ink));
    parts.push(codexShape("M117 96 C112 92 112 86 118 84", c.gold, 1.6));
    parts.push(codexLine("M110 84 C108 80 112 78 114 80", 1.4, c.red));
    parts.push(codexShape("M118 60 L128 58 L128 64 L118 66 Z", c.gold, 1.4));
  } else if (art === "katana" || art === "nodachi") {
    const top = art === "nodachi" ? 0 : 20;
    parts.push(codexShape(`M122 ${top + 6} C126 ${top + 30} 128 60 127 86 L121 86 C122 60 121 ${top + 30} 120 ${top + 10} Z`, c.steel, 1.8));
    parts.push(codexLine(`M121.5 ${top + 14} C123.5 ${top + 36} 124.5 60 123.5 82`, 1, c.white));
    parts.push(`<ellipse cx="124" cy="88" rx="8" ry="3" fill="${c.gold}" stroke="${CODEX_INK}" stroke-width="1.6"/>`);
    parts.push(codexShape("M121 90 L127 90 L127.5 114 L121.5 114 Z", c.lacquer, 1.8));
    parts.push(codexLine("M121.5 94 L127 98 M127 94 L121.5 98 M121.5 102 L127 106 M127 102 L121.5 106 M121.5 110 L127 114", 1.1, c.silk));
  } else if (art === "yari") {
    parts.push(codexLimb("M124 184 L124 30", 3.6, c.lacquerRed));
    parts.push(codexShape("M124 2 C128 10 128 24 126.5 32 L121.5 32 C120 24 120 10 124 2 Z", c.steel, 1.6));
    parts.push(codexLine("M124 6 L124 30", 0.9, c.steelDark));
    parts.push(codexShape("M120 32 L128 32 L127 38 L121 38 Z", c.gold, 1.6));
    parts.push(codexShape("M121 40 C116 50 118 58 124 60 C130 58 132 50 127 40 Z", c.red, 1.6));
  } else if (art === "yumi") {
    parts.push(codexLine("M126 4 C142 40 144 104 128 160", 5.6));
    parts.push(codexLine("M126 4 C142 40 144 104 128 160", 3, c.lacquer));
    parts.push(codexLine("M126 4 L128 160", 1.1));
    parts.push(codexShape("M131 104 L137 104 L137 116 L131 116 Z", c.red, 1.4));
    parts.push(codexLine("M133 40 L139 44 M136 60 L141 62", 1.4, c.gold));
  } else if (art === "norsesword") {
    // A pattern-welded Norse blade: straight, double-edged, a lobed pommel and a short iron guard.
    parts.push(codexShape("M120.5 20 L124 8 L127.5 20 L127.5 86 L120.5 86 Z", c.steel, 2));
    parts.push(codexLine("M124 16 L124 82", 1.8, c.steelDark));
    parts.push(codexLine("M122 24 q2 4 0 8 q-2 4 0 8 q2 4 0 8 q-2 4 0 8 q2 4 0 8 q-2 4 0 8", 0.8, c.white, ' opacity="0.7"'));
    parts.push(codexShape("M113 86 L135 86 L133.5 91.5 L114.5 91.5 Z", c.iron, 1.8));
    parts.push(codexLine("M117 88.6 L131 88.6", 0.9, c.gold));
    parts.push(codexShape("M121.5 91.5 L126.5 91.5 L126.5 106 L121.5 106 Z", c.hide, 1.6));
    parts.push(codexLine("M121.5 95 L126.5 97 M121.5 99 L126.5 101 M121.5 103 L126.5 105", 0.9, c.hideLight));
    parts.push(codexShape("M116 106 L132 106 C132 111 129 114 124 114 C119 114 116 111 116 106 Z", c.iron, 1.8));
    parts.push(codexLine("M120 106.5 L120 112 M124 106.5 L124 113.5 M128 106.5 L128 112", 0.9, c.steelDark));
  } else if (art === "copperaxe") {
    // A cast-copper crescent axe of the P'urhépecha smiths, bound to a hardwood haft.
    parts.push(codexLimb("M124 114 L124 36", 4.2, c.wood));
    parts.push(codexShape("M126 41 C134 39 140 35 145 31 C149 41 149 52 145 62 C140 58 134 55 126 53 Z", c.copper, 2));
    parts.push(codexLine("M143.5 34 C146.5 42 146.5 51 143.5 59", 1.4, "#f0b57a"));
    parts.push(codexLine("M129 44 L139 40 M129 50 L139 53", 0.9, c.copperDark));
    parts.push(`<circle cx="136" cy="47" r="1.5" fill="${c.verdigris}"/><circle cx="140" cy="43" r="1" fill="${c.verdigris}"/>`);
    parts.push(codexShape("M120.5 40 L127.5 40 L127.5 54 L120.5 54 Z", c.redDark, 1.6));
    parts.push(codexLine("M120.5 44 L127.5 46 M120.5 48 L127.5 50", 1, c.cream));
  } else if (art === "purebow") {
    // A sinew-backed war bow painted in red and black bands.
    parts.push(codexLine("M126 30 C148 54 148 120 126 146", 6.4));
    parts.push(codexLine("M126 30 C148 54 148 120 126 146", 3.6, c.woodLight));
    // Painted bands along the limbs: red and black dashes laid on the same curve.
    parts.push(codexLine("M126 30 C148 54 148 120 126 146", 3.6, c.red, ' stroke-dasharray="5 23" stroke-dashoffset="-8"'));
    parts.push(codexLine("M126 30 C148 54 148 120 126 146", 3.6, c.lacquer, ' stroke-dasharray="3 25" stroke-dashoffset="-15"'));
    parts.push(codexLine("M126 30 L126 146", 1.1));
    parts.push(codexShape("M123.5 82 L130.5 82 L130.5 96 L123.5 96 Z", c.red, 1.4));
    parts.push(codexLine("M123.5 86 L130.5 86 M123.5 92 L130.5 92", 0.9, c.ink));
  } else if (art === "flintlance") {
    // A Maya thrusting spear: a broad leaf of knapped flint and a feather collar below it.
    parts.push(codexLimb("M124 178 L124 34", 3.8, c.woodLight));
    parts.push(codexShape("M124 0 C133 10 134 26 129 38 L119 38 C114 26 115 10 124 0 Z", c.flint, 2));
    parts.push(codexLine("M124 4 L121 12 M124 4 L127 12 M121 14 L124 22 L127 14 M121 24 L124 32 L127 24", 0.9, "#857a62"));
    parts.push(codexShape("M119 38 L129 38 L128 44 L120 44 Z", c.red, 1.6));
    for (const [angle, fill] of [[150, c.feather], [170, c.featherLight], [190, c.feather], [210, c.featherLight]]) {
      parts.push(codexFeather(124, 46, angle, 13, fill, c.gold));
    }
  } else if (art === "stingray") {
    // A barbed stingray spine set in a carved bone grip.
    parts.push(codexShape("M123 30 L125 30 L126.2 86 L121.8 86 Z", "#8d8a80", 1.4));
    let barbs = "";
    for (let y = 36; y <= 82; y += 5) barbs += `M${121.6 + (y - 30) * 0.004} ${y} l-2.2 2 M${126.4 - (y - 30) * 0.004} ${y} l2.2 2 `;
    parts.push(codexLine(barbs, 1, CODEX_INK));
    parts.push(codexShape("M120 86 L128 86 L127.4 104 L120.6 104 Z", c.bone, 1.8));
    parts.push(codexLine("M121 91 L127 91 M121 96 C123 94 125 98 127 96 M121 100 L127 100", 1, c.goldDark));
    parts.push(codexCircle(124, 106, 2.4, c.jade, 1.2));
  } else if (id === "macuahuitl" || id === "longsword" || id === "greatsword") {
    const top = id === "greatsword" ? 18 : 28;
    const halfWidth = id === "greatsword" ? 7 : 6;
    parts.push(blades(124 - halfWidth, 124 + halfWidth, top, 86));
    parts.push(codexShape(`M${124 - halfWidth} 88 L${124 - halfWidth} ${top + 6} Q124 ${top - 4} ${124 + halfWidth} ${top + 6} L${124 + halfWidth} 88 Z`, c.woodLight));
    parts.push(codexLine(`M124 ${top + 8} L124 84`, 1.4, c.wood));
    parts.push(codexShape("M120.5 86 L127.5 86 L127 108 L121 108 Z", c.wood));
    parts.push(codexLine("M121 100 L127 100 M121 104 L127 104", 1.4, c.red));
  } else if (icon === "dagger") {
    parts.push(codexShape("M124 52 C130 60 130 74 127 84 L121 84 C118 74 118 60 124 52 Z", c.white));
    parts.push(codexLine("M124 58 L124 82", 1.2, c.stone));
    parts.push(codexShape("M120 84 L128 84 L127.5 100 L120.5 100 Z", c.red));
  } else if (icon === "sword") {
    // Light obsidian-edged batons and blades: slimmer paddle, blades on one edge.
    parts.push(blades(119, 129, 44, 86, 9, "right"));
    parts.push(codexShape("M119 88 L119 50 Q124 40 129 50 L129 88 Z", c.woodLight));
    parts.push(codexShape("M120.5 86 L127.5 86 L127 106 L121 106 Z", c.wood));
    parts.push(codexLine("M121 98 L127 98", 1.4, c.gold));
  } else if (icon === "axe") {
    parts.push(codexLimb("M124 112 L124 38", 4.2, c.wood));
    parts.push(codexShape("M126 40 C140 36 146 46 144 56 C138 54 132 54 126 56 Z", c.stone));
    parts.push(codexLine("M131 44 C136 43 140 46 141 51", 1.3, c.ink));
    parts.push(codexShape("M121 42 L127 42 L127 58 L121 58 Z", c.red, 1.8));
  } else if (icon === "hammer") {
    parts.push(codexLimb("M124 112 L124 48", 4.4, c.wood));
    parts.push(codexCircle(124, 42, 10, c.stone));
    parts.push(codexLine("M118 38 C121 35 126 35 129 37", 1.4, c.white));
    parts.push(codexShape("M119 52 L129 52 L129 57 L119 57 Z", c.gold, 1.8));
  } else if (icon === "mace") {
    parts.push(codexShape("M121 112 L119 52 C119 40 129 40 129 52 L127 112 Z", c.woodLight));
    for (const [x, y] of [[117, 50], [131, 50], [118, 60], [130, 60], [124, 42]]) parts.push(codexCircle(x, y, 3, c.wood, 1.6));
  } else if (icon === "staff") {
    parts.push(codexLimb("M124 186 L124 30", 4, c.woodLight));
    parts.push(codexShape("M117 34 L131 34 L129 42 L119 42 Z", c.gold, 1.8));
    parts.push(codexShape("M118 48 L130 48 L128 54 L120 54 Z", c.red, 1.8));
    parts.push(codexFeather(124, 32, -14, 18, c.feather));
    parts.push(codexFeather(124, 32, 14, 18, c.jade));
  } else if (icon === "spear" && id !== "atlatl") {
    parts.push(codexLimb("M124 176 L124 30", 3.8, c.woodLight));
    parts.push(blades(119.5, 128.5, 8, 34, 7));
    parts.push(codexShape("M124 4 C131 14 131 28 128.5 34 L119.5 34 C117 28 117 14 124 4 Z", c.cream));
    parts.push(codexShape("M119 34 L129 34 L128 40 L120 40 Z", c.red, 1.8));
    parts.push(codexFeather(124, 42, 160, 12, c.featherLight));
  } else if (id === "atlatl") {
    parts.push(codexShape("M120 104 L118 60 L124 56 L128 60 L127 104 Z", c.woodLight));
    parts.push(codexShape("M117 62 L131 62 L131 68 L117 68 Z", c.red, 1.6));
    parts.push(codexLimb("M114 118 L138 24", 2.6, c.cream));
    parts.push(codexShape("M138 24 L135 14 L143 21 Z", c.obsidian, 1.6));
    parts.push(codexFeather(116, 112, 194, 12, c.feather));
    parts.push(codexLimb("M106 120 L132 26", 2.2, c.cream));
    parts.push(codexShape("M132 26 L130 17 L137 23 Z", c.obsidian, 1.6));
  } else if (id === "light-crossbow") {
    parts.push(codexShape("M108 90 L146 86 L146 92 L108 96 Z", c.wood));
    parts.push(codexLine("M140 70 C150 80 150 98 140 108", 4.6));
    parts.push(codexLine("M140 70 C150 80 150 98 140 108", 2.4, c.woodLight));
    parts.push(codexLine("M140 70 L140 108", 1.1));
  } else if (icon === "bow") {
    parts.push(codexLine("M126 40 C146 60 146 116 126 136", 6.2));
    parts.push(codexLine("M126 40 C146 60 146 116 126 136", 3.4, c.woodLight));
    parts.push(codexLine("M126 40 L126 136", 1.1));
    parts.push(codexShape("M124 82 L130 82 L130 94 L124 94 Z", c.red, 1.4));
  } else if (icon === "sling") {
    // A braided cord hanging from the fist to a stone-filled pouch.
    parts.push(codexLine("M123 98 C118 112 116 124 121 134 M126 98 C130 112 132 124 128 134", 1.6, c.cream));
    parts.push(codexShape("M117 132 C118 140 131 140 132 132 C129 129 120 129 117 132 Z", c.hide, 1.6));
    parts.push(codexCircle(124.5, 134.5, 2.6, c.stone, 1.2));
    parts.push(codexShape("M122 92 L127 92 L127 99 L122 99 Z", c.red, 1.4));
  } else if (icon === "blowgun") {
    // A long cane tube with wrapped bands and a mouthpiece.
    parts.push(codexLimb("M124 150 L124 6", 3.6, c.woodLight));
    for (const y of [20, 46, 72, 118, 136]) parts.push(codexShape(`M120.6 ${y} L127.4 ${y} L127.4 ${y + 4} L120.6 ${y + 4} Z`, c.redDark, 1.2));
    parts.push(codexShape("M120 4 L128 4 L127 10 L121 10 Z", c.gold, 1.4));
  } else if (icon === "studded-club") {
    // A broad paddle studded with obsidian points along both edges.
    parts.push(blades(116, 132, 22, 88, 7));
    parts.push(codexShape("M116 90 L116 28 Q124 14 132 28 L132 90 Z", c.woodLight));
    for (let y = 32; y <= 82; y += 10) parts.push(codexCircle(124, y, 1.8, c.obsidian, 0.8));
    parts.push(codexShape("M120.5 88 L127.5 88 L127 110 L121 110 Z", c.wood));
    parts.push(codexLine("M121 102 L127 102 M121 106 L127 106", 1.4, c.gold));
  } else {
    parts.push(codexShape("M120 88 L120 40 Q124 32 128 40 L128 88 Z", c.woodLight));
  }
  // Quality marks: masterwork gear gets a gold binding, relics a jade-and-gold tassel.
  if (tiered.tier === "masterwork" || tiered.tier === "relic") {
    parts.push(codexShape("M119.5 108 L128.5 108 L128.5 113 L119.5 113 Z", c.gold, 1.6));
  }
  if (tiered.tier === "relic") {
    parts.push(codexLine("M124 113 C122 120 120 124 118 130", 1.6, c.ink));
    parts.push(codexCircle(118, 132, 3.6, c.jadeLight, 1.6));
    parts.push(codexFeather(117, 136, 200, 11, c.feather));
  }
  return parts.join("");
}

function codexShield(palette) {
  const c = CODEX_COLORS;
  const cx = 126;
  const cy = 130;
  return [
    ...[-2, -1, 0, 1, 2].map((offset) => codexFeather(cx + offset * 7, cy + 13, 180 + offset * 9, 17,
      offset % 2 === 0 ? c.feather : c.red, c.white)),
    codexCircle(cx, cy, 19, c.gold, 2.8),
    codexShape(`M${cx - 18} ${cy - 5} L${cx + 18} ${cy - 5} L${cx + 18} ${cy + 5} L${cx - 18} ${cy + 5} Z`, palette.tunic, 1.6,
      ' clip-path="url(#codex-shield)"'),
    codexCircle(cx - 9, cy - 11, 3.2, c.white, 1.5),
    codexCircle(cx, cy - 13, 3.2, c.white, 1.5),
    codexCircle(cx + 9, cy - 11, 3.2, c.white, 1.5),
    codexLine(`M${cx - 11} ${cy + 11} L${cx - 4} ${cy + 15} L${cx + 4} ${cy + 15} L${cx + 11} ${cy + 11}`, 1.8),
    codexCircle(cx, cy, 19, "none", 2.8)
  ].join("");
}

function codexHead(character, palette, north) {
  const appearance = character?.appearance || {};
  const cosmetics = character?.cosmetics || {};
  const race = palette.race;
  const c = CODEX_COLORS;
  const back = [];
  const front = [];
  const hairStyle = appearance.hairStyle || "short";
  const helmet = cosmetics.helmet || null;
  const headwear = helmet ? "none" : appearance.headwear || "none";
  // Crowns, bands, and plume fans sit on top of the hair; only full helms hide it.
  const hairHidden = Boolean(helmet) && !CODEX_OPEN_HEADGEAR.has(helmet) && !window.CryptsItems?.cosmetics?.[helmet]?.basic;

  // Hair that hangs behind the shoulders is drawn behind the head and body.
  if (race !== "dragonborn" && !hairHidden) {
    if (hairStyle === "long") {
      back.push(codexShape("M80 52 C70 70 70 104 76 128 C84 130 92 126 96 120 C92 104 92 84 94 70 Z", palette.hair));
      back.push(codexLine("M80 74 C78 92 80 108 84 122 M87 76 C86 92 87 106 90 118", 1.3, palette.hairLight));
    } else if (hairStyle === "braids") {
      for (const x of [80, 88]) {
        back.push(codexLimb(`M${x} 66 C${x - 4} 86 ${x - 2} 104 ${x - 6} 122`, 6, palette.hair));
        back.push(codexLine(`M${x - 4} 80 l5 2 M${x - 3} 92 l5 2 M${x - 4} 104 l5 2`, 1.2, palette.hairLight));
        back.push(codexShape(`M${x - 11} 120 L${x - 1} 120 L${x - 2} 128 L${x - 10} 128 Z`, c.red, 1.6));
      }
    } else if (hairStyle === "bun") {
      back.push(codexCircle(80, 70, 9, palette.hair, 2.4));
      back.push(codexLine("M74 66 C78 62 84 64 86 70", 1.3, palette.hairLight));
      back.push(codexShape("M78 76 L86 76 L85 80 L79 80 Z", c.red, 1.4));
    } else if (hairStyle === "shaved-sides") {
      back.push(codexLimb("M84 56 C76 66 74 80 76 94", 5.5, palette.hair));
      back.push(codexShape("M70 92 L82 92 L80 100 L72 100 Z", c.red, 1.6));
    }
  }

  // The skull. Dragonborn wear a serpent's snouted head instead of a human profile.
  if (race === "dragonborn") {
    const crest = appearance.crest || "fin";
    if (crest === "quetzal-plumes") {
      back.push(codexFeather(86, 50, -70, 44, palette.hair, c.featherLight));
      back.push(codexFeather(88, 46, -52, 40, palette.hair, c.gold));
      back.push(codexFeather(92, 44, -34, 30, palette.hairLight, c.white));
    } else if (crest === "swept-horns") {
      back.push(codexShape("M90 48 C84 36 74 30 62 32 C72 36 80 42 84 52 Z", palette.hair));
      back.push(codexShape("M98 44 C94 30 86 22 74 20 C84 26 90 34 92 46 Z", palette.hair));
    } else if (crest === "frilled-crown") {
      back.push(codexShape("M84 72 C70 66 64 50 70 36 C76 44 80 40 82 32 C88 40 92 36 96 30 C98 40 102 40 106 36 L100 56 Z", palette.hair));
      back.push(codexLine("M84 66 L72 46 M88 58 L82 38 M94 52 L96 36", 1.3, palette.hairLight));
    } else {
      back.push(codexShape("M88 50 C92 34 102 30 110 36 C114 40 112 46 108 46 C106 40 98 40 96 50 Z", palette.hair));
    }
    front.push(codexShape("M80 64 C80 48 92 40 104 42 C112 44 116 50 118 56 L134 60 C140 62 140 70 134 72 L116 74 C114 80 108 86 98 86 C88 86 80 78 80 64 Z", palette.skin));
    front.push(codexLine("M118 66 L134 66", 1.6));
    front.push(codexShape("M120 66 L123 71 L126 66 Z M127 66 L130 71 L133 66 Z", c.white, 1.2));
    front.push(codexLine("M86 70 q4 -3 8 0 M90 78 q4 -3 8 0 M100 76 q4 -3 8 0", 1.3, palette.skinDark));
    front.push(codexShape("M80 60 L72 54 L78 66 L70 66 L80 72 Z", palette.hair === c.jade ? c.cream : codexShade(palette.hair, 40), 1.8));
  } else {
    front.push(codexShape("M84 48 C86 38 104 36 111 44 L115 52 L117 58 C122 61 126 65 124 69 L118 70 L119 73 L116 75 L118 78 C115 83 109 85 103 85 L98 87 C88 85 82 77 82 66 C81 58 81 52 84 48 Z", palette.skin));
    if (race === "gnome" || race === "halfling") {
      front.push(codexShape("M115 58 C124 58 128 64 125 70 C121 72 117 70 115 68 Z", palette.skin));
    }
    if (race === "half-orc") {
      front.push(codexShape("M112 74 L116 64 L118 75 Z", c.white, 1.4));
      front.push(codexLine("M103 52 C108 49 113 50 117 54", 3, palette.skinDark));
    }
  }

  // Ears and ear spools.
  if (race === "elf" || race === "half-elf") {
    const tip = race === "elf" ? "M88 66 C84 56 80 46 78 40 C88 46 96 56 96 66 Z" : "M89 66 C86 58 84 52 83 48 C90 52 96 58 96 66 Z";
    front.push(codexShape(tip, palette.skin));
  } else if (race !== "dragonborn") {
    front.push(codexShape("M85 60 C83 66 85 72 90 73 C94 72 94 62 90 60 Z", palette.skin));
  }
  const jewelry = appearance.jewelry || "ear-spools";
  if (race !== "dragonborn" && !north && jewelry === "ear-spools") {
    front.push(codexCircle(89.5, 67.5, 3.8, c.gold, 1.7));
    front.push(codexCircle(89.5, 67.5, 1.5, c.jade, 1));
  }

  // Face: almond eye, brow, mouth, paint, beard, tusks.
  if (!north) {
    if (race === "dragonborn") {
      front.push(codexShape("M104 54 Q110 50 115 55 Q110 58 104 54 Z", c.gold, 1.6));
      front.push(codexCircle(110, 54.5, 1.6, CODEX_INK, 0.6));
    } else {
      if (appearance.facePaint === "jade-lines") {
        front.push(codexShape("M98 56 L118 55 L119 62 L98 64 Z", c.jade, 1.3, ' opacity="0.95"'));
      } else if (appearance.facePaint === "terracotta-marks") {
        front.push(codexShape("M100 66 L104 66 L104 78 L100 78 Z M106 66 L110 66 L109 76 L106 76 Z", c.red, 1.2));
      } else if (appearance.facePaint === "black-band") {
        front.push(codexShape("M90 55 L119 54 L120 64 L90 66 Z", CODEX_INK, 1.2));
        front.push(codexLine("M92 60 L118 59", 1.4, c.gold));
      } else if (appearance.facePaint === "gold-dots") {
        for (const [x, y] of [[100, 68], [104, 70], [108, 69], [98, 64], [112, 66]]) front.push(codexCircle(x, y, 1.5, c.gold, 0.8));
      } else if (appearance.facePaint === "maya-blue") {
        front.push(codexShape("M99 64 C103 62 108 63 110 65 L109 72 C105 73 101 72 99 71 Z", "#4f97b8", 1.2));
      } else if (appearance.facePaint === "white-stripes") {
        front.push(codexLine("M97 65 L111 64 M98 69 L111 68 M99 73 L110 72", 1.7, c.white));
      } else if (appearance.facePaint === "red-jaw") {
        front.push(codexShape("M100 71 L116 70 C117 74 116 78 114 81 L103 82 C101 79 100 75 100 71 Z", c.red, 1.2, ' opacity="0.92"'));
      }
      front.push(codexShape("M102 60 Q107 55.5 112.5 60 Q107 63.5 102 60 Z", c.white, 1.6));
      front.push(codexCircle(108.6, 59.9, 1.9, CODEX_INK, 0.6));
      front.push(codexLine("M102 54.5 Q108 51.5 113.5 55.5", 1.8));
      front.push(codexLine("M112 76 L117.5 75.5", 1.4));
      if (race === "half-orc") front.push(codexShape("M112 76 L114 68 L116 76 Z", c.white, 1.3));
      if (race === "halfling" || race === "gnome") front.push(`<circle cx="106" cy="70" r="3.6" fill="${c.red}" opacity="0.45"/>`);
      if (jewelry === "nose-crescent") front.push(codexShape("M116 70 C121 70 124 73 123 76 C121 74 118 73 115 73 Z", c.gold, 1.2));
      if (jewelry === "labret") front.push(codexCircle(115, 79.5, 2.2, c.jade, 1.1));
    }
  }
  const beard = appearance.beard || (race === "dwarf" ? "full" : "none");
  if (race !== "dragonborn" && !north && beard === "tuft") {
    front.push(codexShape("M108 80 C112 80 116 80 117 79 C117 86 114 90 110 92 C108 88 107 84 108 80 Z", palette.hair, 1.6));
  }
  if (race !== "dragonborn" && !north && beard === "full") {
    front.push(codexShape("M96 70 C104 72 112 72 117 76 C118 86 114 98 104 104 C100 98 96 96 92 98 C92 88 92 78 96 70 Z", palette.hair));
    front.push(codexLine("M100 78 C100 86 102 94 104 100 M107 78 C108 86 108 92 107 98 M95 82 C95 88 96 92 97 96", 1.3, palette.hairLight));
  }

  // Hair caps and styles over the skull.
  if (race !== "dragonborn" && !hairHidden) {
    if (north) {
      front.push(codexShape("M82 66 C80 50 86 38 98 36 C110 36 118 44 118 56 C118 70 112 80 104 84 C94 86 84 80 82 66 Z", palette.hair));
      front.push(codexLine("M90 44 C96 52 98 64 96 78 M102 42 C108 52 110 64 106 78", 1.3, palette.hairLight));
    } else if (hairStyle === "shaved-sides") {
      front.push(codexShape("M84 50 C88 40 102 36 110 43 L106 47 C100 44 92 46 86 54 Z", palette.hair));
      front.push(`<path d="M84 52 C84 58 86 62 88 62 C92 56 98 50 106 47" fill="${palette.skinDark}" opacity="0.35"/>`);
    } else if (hairStyle === "crest") {
      front.push(codexShape("M84 52 C86 42 98 36 110 43 L108 47 C98 44 90 48 86 56 Z", palette.hair));
      front.push(codexShape("M86 44 C84 30 94 22 104 24 C102 28 104 32 108 34 C100 34 94 38 92 44 Z", palette.hair));
      front.push(codexLine("M90 36 C93 30 98 27 102 27", 1.2, palette.hairLight));
    } else if (hairStyle === "twin-twists") {
      // The two upturned twists worn by Nahua women, tied over the brow.
      front.push(codexShape("M80 72 C78 54 82 41 96 37 C106 35 113 40 115 48 L110 51 C107 47 103 46 101 50 L99 56 C96 57 94 55 92 57 L88 60 C86 66 85 70 84 76 Z", palette.hair));
      front.push(codexShape("M96 40 C94 30 98 24 104 22 C104 28 104 34 102 40 Z", palette.hair, 2.2));
      front.push(codexShape("M104 42 C106 32 112 28 118 28 C116 34 112 40 108 44 Z", palette.hair, 2.2));
      front.push(codexLine("M97 34 L103 31 M98 38 L103 36 M107 38 L113 33 M106 42 L111 38", 1.1, palette.hairLight));
    } else if (hairStyle === "bun") {
      front.push(codexShape("M80 72 C78 54 82 41 96 37 C106 35 113 40 115 48 L110 51 C107 47 103 46 101 50 L99 56 C96 57 94 55 92 57 L88 60 C86 66 85 70 84 76 Z", palette.hair));
      front.push(codexLine("M90 42 C88 52 86 60 84 70", 1.2, palette.hairLight));
    } else if (hairStyle === "topknot") {
      front.push(codexShape("M82 64 C80 50 86 39 98 37 C106 36 112 40 114 48 L109 50 C104 46 98 48 96 54 L94 58 C90 58 88 60 86 64 Z", palette.hair));
      front.push(codexShape("M88 40 L92 22 L102 22 L100 40 Z", palette.hair));
      front.push(codexShape("M89 33 L101 33 L100 38 L89 38 Z", c.red, 1.6));
      front.push(codexShape("M91 22 C90 14 96 10 103 14 C100 16 100 20 102 22 Z", palette.hair));
    } else {
      // Short fringe cut (the default), long, and braids share the cap and fringe.
      front.push(codexShape("M80 72 C78 54 82 41 96 37 C106 35 113 40 115 48 L110 51 C107 47 103 46 101 50 L99 56 C96 57 94 55 92 57 L88 60 C86 66 85 70 84 76 Z", palette.hair));
      front.push(codexLine("M92 42 C96 46 98 50 99 55 M86 50 C88 52 89 56 89 59", 1.2, palette.hairLight));
      if (race === "halfling") {
        for (const [x, y] of [[84, 44], [92, 38], [101, 37], [86, 56]]) front.push(codexCircle(x, y, 3.6, palette.hair, 1.4));
      }
    }
  }

  // Race crowns: horns, gnome cap of jade feathers.
  if (race === "tiefling" && !hairHidden) {
    const horns = appearance.crest || "curled";
    if (horns === "straight") {
      front.push(codexShape("M90 44 L80 18 L94 40 Z", c.redDark, 2));
      front.push(codexShape("M102 40 L100 12 L108 38 Z", c.redDark, 2));
    } else if (horns === "ram") {
      front.push(codexShape("M90 44 C82 30 66 32 66 46 C66 58 80 62 84 52 C80 54 74 52 74 46 C74 38 84 38 86 48 Z", c.redDark, 2));
    } else if (horns === "nubs") {
      front.push(codexShape("M92 42 L90 34 L97 40 Z M104 39 L104 31 L109 38 Z", c.redDark, 1.6));
    } else {
      front.push(codexShape("M92 42 C88 30 80 26 72 30 C80 32 84 38 86 46 Z", c.redDark));
      front.push(codexShape("M104 38 C104 26 98 18 90 18 C96 22 98 30 98 40 Z", c.redDark));
    }
  }
  if (race === "gnome" && headwear === "none" && !helmet) {
    front.push(codexFeather(96, 38, -18, 16, c.jade));
    front.push(codexFeather(100, 37, 6, 18, c.featherLight));
  }

  // Headwear and Mahuiz's helmets.
  if (headwear === "feather-band") {
    front.push(codexFeather(86, 44, -42, 30, c.feather));
    front.push(codexFeather(88, 42, -24, 34, c.featherLight));
    front.push(codexFeather(91, 41, -6, 30, c.feather));
    front.push(codexShape("M82 50 C92 44 104 42 114 47 L114 53 C104 49 92 51 83 57 Z", c.red, 2));
    front.push(codexLine("M86 52 L88 50 M93 49 L95 47 M100 48 L102 46 M107 48 L109 47", 1.4, c.gold));
  } else if (headwear === "cotton-wrap") {
    front.push(codexShape("M80 56 C80 40 94 32 106 36 C114 38 116 44 115 52 C104 46 92 48 82 60 Z", c.white));
    front.push(codexLine("M84 46 C94 40 104 40 112 44 M82 52 C92 46 104 44 114 48", 1.3));
    front.push(codexShape("M80 54 C72 58 70 66 72 74 C76 70 80 66 84 62 Z", c.white, 1.8));
    front.push(codexLine("M90 37 L94 47", 2.4, c.red));
  } else if (headwear === "jade-circlet") {
    front.push(codexShape("M82 51 C92 46 104 44 114 48 L114 52 C104 48 92 50 83 55 Z", c.gold, 1.8));
    front.push(codexCircle(108, 47, 4.6, c.jade, 1.8));
    front.push(codexCircle(108, 47, 1.6, c.jadeLight, 1));
  }
  if (helmet === "amacalli") {
    front.push(codexShape("M84 52 L88 16 L112 16 L114 52 Z", c.white, 2.4));
    for (const y of [24, 34, 44]) front.push(codexShape(`M${86 + (52 - y) * 0.1} ${y} L${113 - (52 - y) * 0.04} ${y} L${113.4 - (52 - y) * 0.04} ${y + 4} L${85.6 + (52 - y) * 0.1} ${y + 4} Z`, c.red, 1.2));
    front.push(codexShape("M86 16 C92 6 108 6 114 16 Z", c.gold, 2));
    front.push(codexShape("M82 50 C92 46 104 45 116 48 L116 54 C104 51 92 52 83 56 Z", c.red, 1.8));
  } else if (helmet === "heron-crest") {
    for (const [x, angle, length] of [[86, -62, 34], [88, -48, 38], [91, -34, 36], [94, -20, 30]]) front.push(codexFeather(x, 46, angle, length, c.white, c.cream));
    front.push(codexShape("M82 50 C92 45 104 44 115 48 L115 54 C104 50 92 52 83 57 Z", c.red, 2));
  } else if (helmet === "deer-crown") {
    front.push(codexShape("M82 50 C92 46 104 45 115 48 L115 53 C104 50 92 52 83 56 Z", c.hide, 2));
    front.push(codexLine("M92 46 L86 22 M88 32 L80 26 M87 27 L90 18 M104 45 L106 20 M105 30 L114 24 M106 24 L102 16", 3.2, c.cream));
    front.push(codexLine("M92 46 L86 22 M88 32 L80 26 M87 27 L90 18 M104 45 L106 20 M105 30 L114 24 M106 24 L102 16", 1, c.hideLight));
  } else if (helmet === "skull-band") {
    for (let x = 84; x <= 114; x += 5) front.push(codexCircle(x, 50 - (x - 84) * 0.06, 2.6, c.cream, 1.1));
    front.push(codexShape("M104 38 C104 30 116 30 116 38 L115 44 L105 44 Z", c.white, 1.8));
    front.push(codexCircle(108, 38, 1.5, CODEX_INK, 0.4) + codexCircle(113, 38, 1.5, CODEX_INK, 0.4));
    front.push(codexLine("M106 44 L106 47 M109 44 L109 47 M112 44 L112 47", 1));
  } else if (helmet === "coyote-helm") {
    front.push(codexShape("M74 66 C70 40 84 24 102 24 C116 24 126 32 128 44 L130 52 C120 48 112 46 104 46 C96 48 90 54 88 66 Z", "#9b8a72"));
    front.push(codexShape("M84 30 L80 12 L96 24 Z", "#9b8a72", 1.8));
    front.push(codexShape("M86 26 L83 16 L92 23 Z", "#d9c7a6", 1));
    front.push(codexShape("M104 46 L132 50 L130 55 L106 51 Z", c.white, 1.6));
    front.push(codexShape("M110 51 L113 57 L116 52 Z M120 53 L123 58 L126 54 Z", c.white, 1.2));
    front.push(codexShape("M112 36 Q117 33 121 37 Q117 39 112 36 Z", c.gold, 1.4));
    front.push(codexCircle(117, 36.4, 1.2, CODEX_INK, 0.5));
    front.push(codexLine("M86 40 l4 3 M82 50 l4 2 M92 32 l4 3", 1.3, "#6f6252"));
    front.push(codexShape("M76 66 C74 78 78 90 86 96 L90 84 C86 80 84 72 84 66 Z", "#9b8a72", 1.8));
  } else if (helmet === "xiuhuitzolli") {
    front.push(codexShape("M84 52 C86 38 96 20 104 12 C108 24 114 40 116 52 Z", "#2fa3a6", 2.4));
    for (const [x, y] of [[100, 26], [104, 22], [98, 34], [104, 32], [110, 38], [94, 44], [102, 42], [109, 46]]) front.push(`<rect x="${x - 2}" y="${y - 2}" width="4" height="4" fill="${(x + y) % 3 ? c.jadeLight : c.jade}" stroke="${CODEX_INK}" stroke-width="0.6"/>`);
    front.push(codexShape("M82 50 C92 46 104 45 116 48 L116 55 C104 51 92 53 83 57 Z", c.gold, 2));
    front.push(codexShape("M86 56 C80 62 78 70 80 78 L84 74 C84 68 86 62 90 58 Z", c.red, 1.4));
  } else if (helmet === "quetzal-headdress") {
    const plumes = [-96, -82, -68, -54, -40, -26, -12, 2, 16];
    plumes.forEach((angle, index) => front.push(codexFeather(98, 44, angle, 52 + (index % 2) * 10, index % 3 === 1 ? c.jade : c.feather, index % 2 ? c.gold : c.featherLight)));
    front.push(codexShape("M80 52 C92 44 106 43 118 47 L118 55 C106 51 92 52 81 59 Z", c.gold, 2.2));
    for (const x of [88, 98, 108]) front.push(codexCircle(x, 50 - (x - 88) * 0.12, 3, c.red, 1.2));
  } else if (helmet === "morion-helmet") {
    front.push(codexShape("M84 52 C84 36 94 28 104 28 C116 28 122 36 120 50 Z", c.steel, 2.4));
    front.push(codexShape("M90 32 C92 16 112 14 116 32 C108 30 98 30 90 32 Z", c.steel, 2));
    front.push(codexLine("M94 30 C98 22 106 20 110 28", 1.2, c.steelDark));
    front.push(codexShape("M68 50 C78 46 92 50 104 49 C116 48 126 44 136 36 C134 48 122 56 104 56 C90 56 78 56 68 50 Z", c.steel, 2.2));
    front.push(codexLine("M74 51 C88 53 106 53 128 44", 1.1, c.white, ' opacity="0.8"'));
    for (const x of [92, 102, 112]) front.push(codexCircle(x, 44, 1.4, c.gold, 0.8));
    front.push(codexFeather(110, 18, 30, 22, c.red, c.white));
  } else if (helmet === "norse-helm") {
    // A rounded iron cap with a ridge and knob, a guard ringing the eye, and mail at the neck.
    let mail = "";
    for (let y = 58; y <= 80; y += 4) for (let x = 78 + ((y / 4) % 2) * 2; x <= 92; x += 4) mail += `M${x - 1.4} ${y} a1.4 1.4 0 1 0 2.8 0 a1.4 1.4 0 1 0 -2.8 0 `;
    front.push(codexShape("M76 54 C74 64 75 76 80 84 L94 82 C90 74 90 64 92 56 Z", c.iron, 2));
    front.push(codexLine(mail, 0.7, "#5b605e"));
    front.push(codexShape("M83 55 C82 37 93 26 104 26 C116 26 122 36 121 52 Z", c.iron, 2.4));
    front.push(codexLine("M104 26 C107 34 107 44 105 53", 1.8, c.steelDark));
    front.push(codexLine("M88 36 C94 31 98 29 104 28", 1.1, c.white, ' opacity="0.7"'));
    front.push(codexShape("M82 51 C94 47 108 47 122 50 L122 55.5 C108 53 94 53 83 57 Z", c.steel, 1.8));
    front.push(codexCircle(104, 25, 2.6, c.steelDark, 1.2));
    // The "spectacles": an iron ring hugging the eye, running down into a short nose guard.
    front.push(codexLine("M103 55 C102.5 60 105 63 109.5 63 C113.5 63 116 60.5 116.5 55.5", 3.8, CODEX_INK));
    front.push(codexLine("M103 55 C102.5 60 105 63 109.5 63 C113.5 63 116 60.5 116.5 55.5", 2.2, c.steel));
    front.push(codexLine("M116.5 55 L118.5 65", 3.4, CODEX_INK));
    front.push(codexLine("M116.5 55 L118.5 65", 1.8, c.steel));
  } else if (helmet === "kabuto-helmet") {
    front.push(codexShape("M78 52 C74 62 74 74 80 82 L92 80 C88 72 88 62 90 54 Z", c.lacquer, 2.2));
    front.push(codexLine("M77 60 L90 58 M76 68 L89 66 M77 76 L90 74", 1.2, c.red));
    front.push(codexShape("M82 54 C82 36 94 28 104 28 C116 28 122 38 120 52 Z", c.lacquer, 2.4));
    front.push(codexLine("M90 36 L90 52 M98 31 L98 52 M106 30 L106 52 M113 33 L113 52", 1.2, c.gold));
    front.push(codexShape("M80 52 C92 48 108 47 122 51 L123 56 C108 53 92 54 81 58 Z", c.lacquerRed, 1.8));
    front.push(codexShape("M108 46 C110 30 104 18 96 10 C108 14 116 30 113 46 Z", c.gold, 1.8));
    front.push(codexShape("M113 46 C120 32 126 22 126 10 C132 24 126 38 118 47 Z", c.gold, 1.8));
    front.push(codexCircle(112, 47, 3, c.gold, 1.4));
  } else if (helmet === "jaguar-helmet") {
    front.push(codexShape("M74 66 C70 40 84 24 102 24 C116 24 126 32 128 44 L130 52 C120 48 112 46 104 46 C96 48 90 54 88 66 Z", "#e2a536"));
    front.push(codexShape("M88 30 C88 22 94 18 100 22 C98 26 96 28 96 32 Z", "#e2a536", 1.8));
    for (const [x, y] of [[84, 44], [96, 34], [110, 32], [80, 56], [118, 40]]) {
      front.push(`<circle cx="${x}" cy="${y}" r="3.4" fill="none" stroke="${CODEX_INK}" stroke-width="1.6"/><circle cx="${x}" cy="${y}" r="1" fill="${CODEX_INK}"/>`);
    }
    front.push(codexShape("M104 46 L130 52 L128 56 L106 50 Z", c.white, 1.6));
    front.push(codexShape("M110 51 L113 57 L116 52 Z M118 53 L121 58 L124 54 Z", c.white, 1.2));
    front.push(codexShape("M112 36 Q117 33 121 37 Q117 39 112 36 Z", c.white, 1.4));
    front.push(codexCircle(117, 36.4, 1.3, CODEX_INK, 0.5));
    front.push(codexShape("M76 66 C74 78 78 90 86 96 L90 84 C86 80 84 72 84 66 Z", "#e2a536", 1.8));
  } else if (helmet === "eagle-helmet") {
    front.push(codexShape("M76 66 C72 42 86 26 104 26 C118 26 128 34 130 46 C126 46 120 46 114 48 C102 46 92 54 88 66 Z", c.white));
    front.push(codexShape("M114 34 C126 32 140 38 142 50 C140 56 134 58 128 54 C132 50 128 46 116 48 Z", c.gold));
    front.push(codexLine("M120 44 C126 44 130 46 132 50", 1.2));
    front.push(codexShape("M104 34 Q110 30 116 35 Q110 38 104 34 Z", c.white, 1.4));
    front.push(codexCircle(110, 34.4, 1.4, CODEX_INK, 0.5));
    for (const [x, y, angle] of [[80, 40, -40], [84, 34, -24], [90, 30, -8]]) front.push(codexFeather(x, y, angle, 28, c.featherLight));
    front.push(codexLine("M82 50 q4 -3 8 0 M80 58 q4 -3 8 0 M90 42 q4 -3 8 0", 1.2, c.goldDark));
  } else if (helmet === "tzitzimitl-helmet") {
    front.push(codexShape("M72 30 C66 20 70 10 80 12 C76 16 76 22 80 28 Z", c.white, 1.8));
    front.push(codexShape("M116 26 C122 14 132 14 136 22 C130 20 124 24 122 32 Z", c.white, 1.8));
    front.push(codexShape("M78 64 C74 40 86 26 102 26 C116 26 124 36 122 50 L110 50 C100 48 92 54 90 66 Z", c.white));
    front.push(codexShape("M100 32 Q108 28 114 34 Q110 42 102 40 Q98 36 100 32 Z", "#33254f", 1.6));
    front.push(`<path d="M107 31 l1.4 3 3.2 .3 -2.4 2.1 .8 3.1 -3-1.7 -3 1.7 .8-3.1 -2.4-2.1 3.2-.3z" fill="${c.gold}" stroke="${CODEX_INK}" stroke-width="0.8"/>`);
    front.push(codexLine("M86 40 L94 44 M84 50 L92 52", 1.6));
    front.push(codexShape("M82 30 C86 22 98 18 106 22 L104 27 C96 25 90 28 86 34 Z", c.red, 1.6));
  }
  return { back: back.join(""), front: front.join("") };
}

function codexTorso(character, palette, hasArmor, outfit) {
  const appearance = character?.appearance || {};
  const equipment = character?.equipment || {};
  const c = CODEX_COLORS;
  const parts = [];
  const curvy = appearance.body === "curvy";
  const torsoPath = curvy
    ? "M82 92 C88 87 108 86 114 91 L119 100 C121 106 119 111 114 113 L112 118 C116 122 118 126 117 130 L82 132 C80 126 82 121 85 118 L80 101 Z"
    : "M82 92 C88 87 108 86 114 91 L117 99 L113 128 L84 130 L80 101 Z";
  const garment = appearance.garment || "woven-tunic";
  // Cloth base or bare chest depending on the garment cut.
  if (outfit === "jaguar-clothes") {
    parts.push(codexShape(torsoPath, "#e2a536"));
    for (const [x, y] of [[90, 100], [104, 98], [96, 112], [110, 112], [88, 120], [102, 122]]) {
      parts.push(`<circle cx="${x}" cy="${y}" r="3.6" fill="none" stroke="${CODEX_INK}" stroke-width="1.6"/><circle cx="${x}" cy="${y}" r="1.1" fill="${CODEX_INK}"/>`);
    }
    return parts.join("");
  }
  if (outfit === "eagle-clothes") {
    parts.push(codexShape(torsoPath, c.white));
    for (let y = 96; y <= 124; y += 7) {
      for (let x = 84 + ((y / 7) % 2) * 4; x <= 110; x += 8) {
        parts.push(codexShape(`M${x} ${y} q4 6 8 0`, "#c9893e", 1.2));
      }
    }
    parts.push(codexShape("M96 98 L104 98 L106 112 L100 118 L94 112 Z", c.gold, 1.6));
    return parts.join("");
  }
  const feathers = (rows, colors) => {
    for (let y = 96; y <= 126; y += 6) {
      for (let x = 84 + ((y / 6) % 2) * 3; x <= 112; x += 6) {
        parts.push(codexShape(`M${x} ${y} q3 6 6 0`, colors[(x + y) % colors.length], 1));
      }
    }
  };
  if (outfit === "coyote-suit") {
    // A full tlahuiztli of grey coyote fur: layered tufts, a darker saddle, a pale throat.
    parts.push(codexShape(torsoPath, "#a39278"));
    parts.push(codexShape("M80 92 C86 88 92 88 96 90 L92 130 L82 132 L78 102 Z", "#7d6f5c", 1.4));
    for (let y = 95; y <= 128; y += 6) {
      let tufts = "";
      for (let x = 81 + ((y / 6) % 2) * 3; x <= 114; x += 6) tufts += `M${x} ${y} l2 4 l2 -3 l2 4 `;
      parts.push(codexLine(tufts, 1, y % 12 ? "#6f6252" : "#c9bba0"));
    }
    parts.push(codexShape("M92 90 C96 99 104 99 109 90 L107 104 C103 110 97 110 93 104 Z", "#efe4cc", 1.4));
    parts.push(codexLine("M95 100 l2 3 l2 -2 l2 3 l2 -2", 0.9, "#b9ab86"));
    parts.push(codexLine("M80 132 l3 5 l3 -4 l3 5 l3 -4 l3 5 l3 -4 l3 5 l3 -4 l3 5 l3 -4 l3 5 l3 -4", 1.4, "#6f6252"));
    return parts.join("");
  }
  if (outfit === "maguey-tilma") {
    parts.push(codexShape(torsoPath, palette.skin));
    parts.push(codexShape("M102 86 L118 94 L112 132 L84 134 L82 104 C92 102 98 96 102 86 Z", "#c9b48a"));
    parts.push(codexLine("M108 94 L100 130 M114 102 L108 130 M90 108 L110 106 M88 118 L110 116", 1.1, "#a8956a"));
    parts.push(codexShape("M104 84 C110 82 114 86 112 92 C108 94 104 90 104 84 Z", "#a8956a", 1.8));
    return parts.join("");
  }
  if (outfit === "painted-xicolli") {
    parts.push(codexShape(torsoPath, palette.skin));
    parts.push(codexShape("M82 92 C88 87 98 87 100 88 L99 124 L84 126 L80 101 Z", c.white));
    parts.push(codexShape("M104 88 C108 88 112 89 114 91 L117 99 L114 123 L104 124 Z", c.white));
    parts.push(codexFretBand(81, 114, 36, 8, c.red, c.white));
    parts.push(codexLine("M84 126 l-1 6 M88 126 l-1 6 M92 126 l-1 6 M96 126 l-1 6 M106 124 l1 6 M110 124 l1 6 M114 124 l1 6", 1.4, c.red));
    return parts.join("");
  }
  if (outfit === "ballplayer-gear") {
    // Bare chest, a quilted cotton wrap at the waist, and a carved palma rising from the yoke.
    parts.push(codexShape(torsoPath, palette.skin));
    parts.push(codexLine("M90 104 C96 106 104 106 110 103", 1.3, palette.skinDark));
    parts.push(codexShape("M81 112 L117 110 L117 122 L81 124 Z", c.quilt, 2));
    parts.push(codexLine("M84 116 L114 114 M84 120 L114 118 M90 111 L90 123 M98 111 L98 123 M106 110 L106 122", 0.9, "#b9ab86"));
    parts.push(codexShape("M105 120 C103 112 104 104 109 100 C114 104 115 112 113 120 Z", c.stone, 1.8));
    parts.push(codexLine("M106 112 C108 110 110 110 112 112 M107 106 C108.5 104.5 110 104.5 111 106", 1, c.ink));
    parts.push(codexCircle(109, 116, 1.6, c.red, 0.8));
    return parts.join("");
  }
  if (outfit === "feathered-huipil") {
    parts.push(codexShape(torsoPath, "#e9dcc0"));
    parts.push(codexShape("M88 90 L112 90 L112 108 L88 108 Z", c.jade, 1.8));
    for (const [x, y, color] of [[91, 94, c.red], [97, 94, c.gold], [103, 94, c.red], [109, 94, c.gold], [94, 101, c.featherLight], [100, 101, c.feather], [106, 101, c.featherLight]]) {
      parts.push(codexShape(`M${x} ${y} q2 5 4 0`, color, 1));
    }
    parts.push(codexShape("M95 90 L105 90 L104 96 L96 96 Z", palette.skin, 1.3));
    return parts.join("");
  }
  if (outfit === "turquoise-mantle") {
    parts.push(codexShape(torsoPath, palette.tunic));
    parts.push(codexShape("M100 86 L120 94 L116 136 L80 138 L78 104 C90 102 96 96 100 86 Z", "#2fa3a6"));
    let net = "";
    for (let k = -40; k <= 40; k += 7) net += `M${84 + k} 100 L${120 + k} 136 M${120 - k} 100 L${84 - k} 136 `;
    parts.push(`<g clip-path="url(#codex-mantle)">${codexLine(net, 1, "#1f6a6c")}</g>`);
    for (const [x, y] of [[92, 112], [106, 112], [99, 124], [112, 124], [86, 124]]) parts.push(codexCircle(x, y, 2.2, c.jade, 1));
    parts.push(codexShape("M100 84 C106 82 110 86 108 92 C104 94 100 90 100 84 Z", c.gold, 1.8));
    return parts.join("");
  }
  if (outfit === "bone-xicolli") {
    parts.push(codexShape(torsoPath, "#211a1f"));
    parts.push(codexLine("M99 92 L99 128", 2.6, c.white));
    for (let y = 98; y <= 120; y += 6) parts.push(codexLine(`M88 ${y} C92 ${y - 3} 96 ${y - 2} 98 ${y} M100 ${y} C104 ${y - 2} 108 ${y - 3} 112 ${y}`, 2, c.white));
    parts.push(codexLine("M84 128 l-1 6 M90 128 l-1 6 M96 128 l0 6 M102 128 l0 6 M108 128 l1 6 M114 128 l1 6", 1.4, c.white));
    return parts.join("");
  }
  if (outfit === "tzitzimitl-clothes") {
    parts.push(codexShape(torsoPath, "#33254f"));
    parts.push(codexShape("M90 96 L96 96 L96 126 L90 126 Z M100 96 L106 96 L106 126 L100 126 Z", c.white, 1.4));
    parts.push(codexLine("M90 104 L96 104 M90 112 L96 112 M90 120 L96 120 M100 104 L106 104 M100 112 L106 112 M100 120 L106 120", 1.2));
    parts.push(`<path d="M110 102 l1.2 2.6 2.8 .3 -2.1 1.8 .7 2.7 -2.6-1.5 -2.6 1.5 .7-2.7 -2.1-1.8 2.8-.3z" fill="${c.gold}" stroke="${CODEX_INK}" stroke-width="0.8"/>`);
    return parts.join("");
  }
  if (garment === "none") {
    // Bare chest above the maxtlatl loincloth.
    parts.push(codexShape(torsoPath, palette.skin));
    parts.push(codexLine("M90 104 C96 106 104 106 110 103", 1.3, palette.skinDark));
    parts.push(codexLine("M99 92 L99 100", 1, palette.skinDark));
  } else if (garment === "cotton-wrap") {
    parts.push(codexShape(torsoPath, palette.skin));
    parts.push(codexLine("M90 104 C96 106 104 106 110 103", 1.3, palette.skinDark));
    parts.push(codexShape("M104 88 L116 94 L94 130 L82 128 Z", palette.tunic));
    parts.push(codexLine("M108 92 L88 128", 1.3, palette.tunicLight));
    parts.push(codexShape("M108 86 C114 84 118 88 116 94 C112 96 108 94 108 86 Z", palette.tunicLight, 1.8));
  } else if (garment === "hide-vest") {
    parts.push(codexShape(torsoPath, palette.tunicLight));
    parts.push(codexShape("M82 92 C88 87 98 87 100 88 L98 130 L84 130 L80 101 Z", palette.tunic));
    parts.push(codexShape("M104 88 C108 88 112 89 114 91 L117 99 L113 128 L104 129 Z", palette.tunic));
    parts.push(codexLine("M86 130 l-1 6 M90 130 l-1 6 M94 130 l-1 6 M106 129 l1 6 M110 129 l1 6", 1.4, palette.trimDark));
  } else if (garment === "quechquemitl") {
    // A quechquemitl: a woven shoulder cape that falls to a point at the chest, over a cotton blouse.
    parts.push(codexShape(torsoPath, CODEX_COLORS.white));
    parts.push(codexLine("M86 122 L114 120 M85 126 L114 124", 1, CODEX_COLORS.cream));
    parts.push(codexShape("M79 92 C88 86 108 85 117 90 L116 106 L100 128 L82 108 Z", palette.tunic));
    parts.push(codexLine("M82 108 L100 128 L116 106", 3, palette.trim));
    parts.push(codexLine("M85 113 l-1 4 M89 118 l-1 4 M94 123 l-1 4 M106 123 l1 4 M110 118 l1 4 M114 112 l1 4", 1.2, palette.trim));
    parts.push(codexShape("M95 88 L105 88 L103 94 L97 94 Z", palette.skin, 1.3));
    parts.push(codexLine("M90 98 l4 4 l4 -4 l4 4 l4 -4", 1.1, palette.tunicDark));
  } else if (garment === "tilmatli") {
    // A tilmatli: a cotton cloak knotted at one shoulder, worn over a bare chest and loincloth.
    parts.push(codexShape(torsoPath, palette.skin));
    parts.push(codexLine("M90 104 C96 106 104 106 110 103", 1.3, palette.skinDark));
    parts.push(codexShape("M100 86 L120 94 L116 138 L80 140 L78 104 C90 102 96 96 100 86 Z", palette.tunic));
    parts.push(codexLine("M104 96 L96 136 M112 100 L108 136", 1.1, palette.tunicDark));
    parts.push(codexShape("M79 132 L117 130 L116 138 L80 140 Z", palette.trim, 1.6));
    parts.push(codexLine("M84 132 l0 7 M90 132 l0 7 M96 131 l0 7 M102 131 l0 7 M108 131 l0 7", 1.1, palette.trimAlt));
    parts.push(codexShape("M100 84 C106 82 110 86 108 92 C104 94 100 90 100 84 Z", palette.trim, 1.8));
  } else if (garment === "xicolli") {
    // A xicolli: a sleeveless jacket, open at the front, with a woven border and fringe.
    parts.push(codexShape(torsoPath, palette.skin));
    parts.push(codexShape("M82 92 C88 87 98 87 100 88 L99 124 L84 126 L80 101 Z", palette.tunic));
    parts.push(codexShape("M104 88 C108 88 112 89 114 91 L117 99 L114 123 L104 124 Z", palette.tunic));
    parts.push(codexFretBand(81, 114, 36, 8, palette.trim, palette.trimAlt));
    parts.push(codexLine("M84 126 l-1 6 M88 126 l-1 6 M92 126 l-1 6 M96 126 l-1 6 M106 124 l1 6 M110 124 l1 6 M114 124 l1 6", 1.4, palette.trim));
  } else if (garment === "huipil") {
    // A huipil: a loose woven blouse with an embroidered square yoke.
    parts.push(codexShape(torsoPath, palette.tunicLight));
    parts.push(codexShape("M92 90 L108 90 L108 104 L92 104 Z", palette.tunic, 1.8));
    parts.push(codexShape("M95 90 L105 90 L104 98 L96 98 Z", palette.skin, 1.4));
    parts.push(codexLine("M92 108 L116 106 M83 112 L117 110", 1.4, palette.trim));
    parts.push(codexLine("M86 118 l4 -4 l4 4 l4 -4 l4 4 l4 -4 l4 4", 1.2, palette.tunicDark));
  } else {
    parts.push(codexShape(torsoPath, palette.tunic));
    parts.push(codexLine("M92 94 C96 98 102 98 106 94", 1.4, palette.tunicDark));
  }
  if (curvy && !hasArmor && garment !== "cotton-wrap" && garment !== "none") parts.push(codexLine("M104 104 C110 108 114 110 117 108", 1.3, garment === "huipil" ? palette.tunic : palette.tunicDark));
  if (garment === "woven-tunic" && !hasArmor) {
    parts.push(codexFretBand(81, 118, 34, 8, palette.trim, palette.trimAlt));
    parts.push(codexLine("M84 127 l0 5 M88 127 l0 5 M92 127 l0 5 M96 127 l0 5 M100 127 l0 5 M104 127 l0 5 M108 127 l0 5 M112 127 l0 5", 1.3));
  }
  if (garment === "feather-mantle") {
    for (let index = 0; index < 7; index += 1) {
      parts.push(codexFeather(80 + index * 6, 90, 180 + (index - 3) * 7, 16, index % 2 ? c.featherLight : c.feather));
    }
    parts.push(codexShape("M80 88 C90 84 108 84 116 90 L116 94 C108 90 90 90 80 94 Z", c.gold, 1.8));
  }
  // Body armor goes over the garment.
  if (hasArmor) {
    const armor = (typeof ARMORS !== "undefined" && ARMORS[equipment.armor]?.baseId) || equipment.armor;
    const art = (typeof ARMORS !== "undefined" && ARMORS[equipment.armor]?.art) || "";
    if (art === "ehuatl") {
      parts.push(codexShape("M81 90 C88 85 108 84 116 89 L118 100 L115 132 L83 134 L79 102 Z", c.gold, 2.6));
      for (let y = 96; y <= 128; y += 6) {
        for (let x = 84 + ((y / 6) % 2) * 3; x <= 112; x += 6) parts.push(codexShape(`M${x} ${y} q3 6 6 0`, (x / 6 + y / 6) % 2 ? c.red : c.featherLight, 1));
      }
      parts.push(codexShape("M80 90 C90 86 108 86 117 90 L116 95 C108 92 90 92 81 96 Z", c.jade, 1.6));
    } else if (art === "tlahuiztli") {
      parts.push(codexShape("M79 90 C88 84 108 84 118 89 L120 100 L117 136 L81 138 L77 102 Z", c.red, 2.8));
      for (let y = 95; y <= 132; y += 5) {
        for (let x = 82 + ((y / 5) % 2) * 3; x <= 114; x += 6) parts.push(codexShape(`M${x} ${y} q3 5 6 0`, (x + y) % 3 ? c.red : c.redDark, 0.9));
      }
      parts.push(codexShape("M80 132 L118 130 L118 138 L81 140 Z", c.gold, 1.8));
      parts.push(codexShape("M92 90 L106 90 L104 98 L94 98 Z", c.white, 1.4));
    } else if (art === "jaguarshirt") {
      // Spotted jaguar pelt over quilted cotton, with a red collar.
      parts.push(codexShape("M80 90 C88 85 108 84 116 89 L119 100 L116 132 L82 134 L78 102 Z", "#e2a536", 2.6));
      for (const [x, y] of [[88, 98], [102, 96], [111, 104], [94, 108], [106, 114], [86, 118], [98, 122], [110, 124]]) {
        parts.push(`<circle cx="${x}" cy="${y}" r="3.2" fill="none" stroke="${CODEX_INK}" stroke-width="1.2"/><circle cx="${x}" cy="${y}" r="0.9" fill="${CODEX_INK}"/>`);
      }
      parts.push(codexShape("M86 88 C94 92 104 92 112 88 L111 93 C104 97 94 97 87 93 Z", c.red, 1.4));
      parts.push(codexShape("M80 128 L117 126 L116 134 L82 136 Z", c.quilt, 1.6));
    } else if (art === "jadecuirass") {
      parts.push(codexShape("M80 90 C88 85 108 84 116 89 L119 100 L116 132 L82 134 L78 102 Z", c.quilt, 2.8));
      for (let y = 94; y <= 124; y += 8) {
        for (let x = 84; x <= 110; x += 7) parts.push(`<rect x="${x}" y="${y}" width="6" height="7" rx="1.6" fill="${(x + y) % 2 ? c.jade : c.jadeLight}" stroke="${CODEX_INK}" stroke-width="1"/>`);
      }
      parts.push(codexLine("M86 94 L86 130 M100 92 L100 132 M112 94 L112 130", 1, c.gold));
      parts.push(codexShape("M80 128 L117 126 L116 134 L82 136 Z", c.gold, 1.8));
    } else if (art === "cuirass" || art === "gilded") {
      const plate = art === "gilded" ? c.gold : c.steel;
      const trim = art === "gilded" ? c.steel : c.gold;
      parts.push(codexShape("M80 90 C88 84 108 84 117 89 L119 100 L114 122 L84 124 L79 101 Z", plate, 2.8));
      parts.push(codexLine("M99 88 C101 100 101 112 99 122", 1.6, art === "gilded" ? c.goldDark : c.steelDark));
      parts.push(codexLine("M86 94 C92 100 96 104 98 112", 2.4, c.white, ' opacity="0.7"'));
      for (const [x, y] of [[84, 98], [114, 98], [86, 118], [112, 118]]) parts.push(codexCircle(x, y, 1.6, trim, 1));
      for (let index = 0; index < 3; index += 1) {
        parts.push(codexShape(`M${83 + index} ${123 + index * 5} L${115 - index} ${121 + index * 5} L${115 - index} ${127 + index * 5} L${83 + index} ${129 + index * 5} Z`, plate, 1.8));
      }
      if (art === "gilded") parts.push(codexLine("M88 100 q4 -4 8 0 q4 4 8 0 M90 110 q4 -4 8 0 q4 4 8 0", 1.3, c.goldDark));
      parts.push(codexShape("M102 86 C110 84 118 88 118 96 L110 98 C108 92 104 90 102 86 Z", plate, 1.8));
    } else if (art === "byrnie") {
      // A Norse mail shirt to mid-thigh over a padded tunic, belted with a bronze buckle.
      parts.push(codexShape("M78 91 C88 85 108 84 118 90 L121 104 L119 142 L79 144 L75 104 Z", c.iron, 2.8));
      let rings = "";
      for (let y = 95; y <= 140; y += 4.5) {
        for (let x = 80 + ((Math.round(y / 4.5)) % 2) * 2.2; x <= 116; x += 4.4) rings += `M${x - 1.5} ${y} a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0 `;
      }
      parts.push(codexLine(rings, 0.8, "#5b605e"));
      parts.push(codexShape("M86 88 C94 92 104 92 112 88 L111 93 C104 97 94 97 87 93 Z", "#8a7357", 1.4));
      parts.push(codexShape("M77 118 L121 116 L121 122 L77 124 Z", c.hide, 1.8));
      parts.push(codexShape("M95 116.5 L103 116.2 L103 123.4 L95 123.6 Z", c.gold, 1.4));
      parts.push(codexLine("M99 117 L99 123", 1, c.goldDark));
    } else if (art === "saltcotton") {
      // Maya quilted armor packed with salt: thick, puffy diamonds with a dyed border.
      parts.push(codexShape("M77 90 C88 83 108 82 119 89 L122 102 L119 136 L79 138 L74 103 Z", c.quilt, 3.2));
      let lattice = "";
      for (let k = -40; k <= 50; k += 9) lattice += `M${78 + k} 90 L${78 + k + 44} 136 M${122 - k} 90 L${122 - k - 44} 136 `;
      parts.push(`<g clip-path="url(#codex-torso-clip)">${codexLine(lattice, 1, "#b9ab86")}</g>`);
      parts.push(codexShape("M78 130 L120 128 L120 138 L79 140 Z", c.blue, 1.8));
      parts.push(codexLine("M82 134 l4 -3 l4 3 l4 -3 l4 3 l4 -3 l4 3 l4 -3 l4 3 l4 -3 l4 3", 1.2, c.white));
      parts.push(codexShape("M88 88 C94 92 104 92 110 88 L109 94 C104 97 94 97 89 94 Z", c.blue, 1.4));
    } else if (art === "spondylus") {
      // Red spondylus-shell plaques strung in rows over white cotton.
      parts.push(codexShape("M82 90 C90 86 106 86 114 90 L116 100 L113 128 L85 130 L81 102 Z", c.quilt, 2.4));
      for (let y = 96; y <= 122; y += 7.5) {
        for (let x = 86 + ((Math.round(y / 7.5)) % 2) * 3.5; x <= 110; x += 7) {
          parts.push(codexShape(`M${x - 3} ${y} C${x - 3} ${y + 5} ${x + 3} ${y + 5} ${x + 3} ${y} C${x + 1} ${y - 1.4} ${x - 1} ${y - 1.4} ${x - 3} ${y} Z`, (x + y) % 3 ? c.shell : "#e07a4f", 1.1));
          parts.push(codexLine(`M${x} ${y - 0.6} L${x} ${y + 3.2}`, 0.6, "#8f3122"));
        }
      }
      parts.push(codexShape("M84 126 L114 124 L114 130 L85 132 Z", c.jade, 1.4));
    } else if (art === "copperscale") {
      // Overlapping copper scales on a deerskin coat, greening at the edges.
      parts.push(codexShape("M78 90 C88 84 108 84 118 89 L120 101 L117 136 L81 138 L76 103 Z", c.copperDark, 2.8));
      for (let y = 94; y <= 132; y += 5) {
        for (let x = 80 + ((Math.round(y / 5)) % 2) * 3; x <= 116; x += 6) {
          const fill = (x * 7 + y * 3) % 11 === 0 ? c.verdigris : (x + y) % 4 ? c.copper : "#d99257";
          parts.push(codexShape(`M${x - 3} ${y} L${x + 3} ${y} L${x + 3} ${y + 3} C${x + 3} ${y + 6} ${x - 3} ${y + 6} ${x - 3} ${y + 3} Z`, fill, 0.9));
        }
      }
      parts.push(codexShape("M86 88 C94 92 104 92 112 88 L111 93 C104 97 94 97 87 93 Z", c.hide, 1.4));
      parts.push(codexShape("M80 134 L117 132 L117 139 L81 141 Z", c.hide, 1.6));
    } else if (art === "mixtecgold") {
      // Red quilted cotton hung with cast-gold plaques, and little gold bells along the hem.
      parts.push(codexShape("M80 90 C88 85 108 84 116 89 L119 100 L116 130 L82 132 L78 102 Z", c.redDark, 2.6));
      parts.push(codexLine("M84 100 L114 99 M83 110 L115 109 M83 120 L115 119", 1, "#5a1d15"));
      for (const [x, y] of [[90, 96], [104, 95], [97, 105], [111, 104], [88, 115], [102, 114]]) {
        parts.push(codexShape(`M${x - 3.4} ${y - 3} L${x + 3.4} ${y - 3} L${x + 3.4} ${y + 3} L${x - 3.4} ${y + 3} Z`, c.gold, 1.1));
        parts.push(codexCircle(x, y, 1.2, c.goldDark, 0.6));
      }
      for (let x = 84; x <= 114; x += 5) {
        parts.push(codexShape(`M${x - 2} 131 C${x - 2.4} 136 ${x + 2.4} 136 ${x + 2} 131 Z`, c.gold, 0.9));
        parts.push(codexLine(`M${x} 133.4 L${x} 135.4`, 0.6, c.goldDark));
      }
      parts.push(codexShape("M87 88 C94 92 104 92 111 88 L110 93 C104 96 94 96 88 93 Z", c.gold, 1.3));
    } else if (art === "domaru" || art === "oyoroi") {
      const lame = art === "oyoroi" ? c.lacquerRed : c.lacquer;
      const lace = art === "oyoroi" ? c.silk : c.red;
      parts.push(codexShape("M79 90 C88 84 108 84 118 89 L120 100 L117 134 L82 136 L78 102 Z", lame, 2.8));
      for (let y = 97; y <= 131; y += 6) parts.push(codexLine(`M81 ${y} L118 ${y - 1}`, 1.4, c.ink));
      let laces = "";
      for (let x = 85; x <= 113; x += 6) laces += `M${x} 90 L${x} 134 `;
      parts.push(codexLine(laces, 1.3, lace));
      if (art === "oyoroi") {
        parts.push(codexShape("M104 88 L122 90 L124 116 L106 114 Z", lame, 2.4));
        parts.push(codexLine("M105 95 L123 97 M105.5 102 L123.5 104 M106 109 L124 111", 1.2, c.ink));
        parts.push(codexLine("M110 89 L111 115 M116 90 L117 115", 1.2, lace));
        parts.push(codexShape("M90 102 L108 102 L108 112 L90 112 Z", c.gold, 1.6));
      }
    } else if (armor === "scale") {
      parts.push(codexShape("M80 90 C88 85 108 84 116 89 L119 100 L116 132 L82 134 L78 102 Z", c.quilt, 2.8));
      parts.push(codexLine("M84 98 L114 98 M83 106 L115 106 M82 114 L116 114 M82 122 L116 122 M90 92 L88 132 M98 90 L98 133 M106 90 L108 133", 1.1, "#b9ab86"));
      parts.push(codexShape("M80 128 L117 126 L116 134 L82 136 Z", c.red, 1.8));
    } else if (armor === "chainmail") {
      parts.push(codexShape("M78 92 C88 85 108 84 118 90 L120 102 L116 134 L82 136 L76 104 Z", c.iron, 2.8));
      let rings = "";
      for (let y = 96; y <= 130; y += 5) {
        for (let x = 82 + ((y / 5) % 2) * 2.5; x <= 114; x += 5) rings += `M${x - 1.6} ${y} a1.6 1.6 0 1 0 3.2 0 a1.6 1.6 0 1 0 -3.2 0 `;
      }
      parts.push(codexLine(rings, 0.9, "#5b605e"));
    } else if (armor === "hide") {
      parts.push(codexShape("M80 91 C88 86 108 85 116 90 L118 100 L115 130 L83 132 L79 102 Z", c.hide, 2.6));
      parts.push(codexShape("M80 104 L118 102 L117 110 L80 112 Z M81 118 L116 116 L115 124 L82 126 Z", c.hideLight, 1.6));
      parts.push(`<g fill="${CODEX_INK}" opacity="0.55"><circle cx="90" cy="96" r="1.6"/><circle cx="104" cy="95" r="1.6"/><circle cx="96" cy="114" r="1.4"/><circle cx="108" cy="113" r="1.4"/></g>`);
    } else if (armor === "maguey-jerkin") {
      // Knotted maguey cord sewn in rows: pale fiber with a darker weave.
      parts.push(codexShape("M84 90 C92 87 106 87 112 90 L114 100 L111 128 L86 129 L83 102 Z", "#cdb98b", 2.4));
      let rows = "";
      for (let y = 96; y <= 124; y += 5) rows += `M85 ${y} q3 -2 6 0 q3 2 6 0 q3 -2 6 0 q3 2 6 0 q3 -2 6 0 `;
      parts.push(codexLine(rows, 0.9, "#9c8556"));
    } else if (armor === "leather") {
      parts.push(codexShape("M84 90 C92 87 106 87 112 90 L114 100 L111 128 L86 129 L83 102 Z", c.hide, 2.4));
      parts.push(codexLine("M98 90 L98 128", 1.4, c.hideLight));
      parts.push(`<g fill="${c.cream}"><circle cx="94" cy="98" r="1.2"/><circle cx="94" cy="106" r="1.2"/><circle cx="94" cy="114" r="1.2"/><circle cx="102" cy="98" r="1.2"/><circle cx="102" cy="106" r="1.2"/><circle cx="102" cy="114" r="1.2"/></g>`);
    }
  }
  // Adornment: collars worn at the neck and over the shoulders.
  const adornment = appearance.adornment || "none";
  parts.push(codexAdornment(adornment));
  return parts.join("");
}

// Necklaces and collars, drawn over the garment and armor around the neck (centered near
// 99,90). Points on the collar are placed along a half-ellipse below the throat.
function codexAdornment(adornment) {
  const c = CODEX_COLORS;
  const parts = [];
  const along = (t, rx, ry) => {
    const angle = Math.PI * (0.1 + t * 0.8);
    return [99 + Math.cos(angle) * rx, 89 + Math.sin(angle) * ry, angle];
  };
  const cord = (rx, ry, width, color) => {
    let d = "";
    for (let step = 0; step <= 16; step += 1) {
      const [x, y] = along(step / 16, rx, ry);
      d += `${step ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)} `;
    }
    return codexLine(d, width, color);
  };
  if (adornment === "jade-beads") {
    // A chalchihuitl collar: two strands of graduated jade and a pierced jade disc.
    parts.push(cord(15.5, 13, 1.2, c.ink));
    for (let index = 0; index <= 10; index += 1) {
      const t = index / 10;
      const [x, y] = along(t, 15.5, 13);
      const size = 1.9 + Math.sin(Math.PI * t) * 1.2;
      parts.push(codexCircle(x.toFixed(1), y.toFixed(1), size.toFixed(2), index % 2 ? c.jadeLight : c.jade, 1.2));
    }
    parts.push(cord(10.5, 8.5, 1, c.ink));
    for (let index = 0; index <= 7; index += 1) {
      const [x, y] = along(index / 7, 10.5, 8.5);
      parts.push(codexCircle(x.toFixed(1), y.toFixed(1), 1.5, index % 2 ? c.jade : c.jadeLight, 1));
    }
    const [px, py] = along(0.5, 15.5, 13);
    parts.push(codexLine(`M${px} ${py + 3} L${px} ${py + 6}`, 1.2));
    parts.push(codexCircle(px, py + 10.5, 4.8, c.gold, 1.4));
    parts.push(codexCircle(px, py + 10.5, 3.6, c.jade, 1.2));
    parts.push(codexCircle(px, py + 10.5, 1.2, c.paper, 0.9));
    parts.push(codexLine(`M${px - 2.4} ${py + 15} l-1 4 M${px + 2.4} ${py + 15} l1 4`, 1.2, c.redDark));
  } else if (adornment === "shell-beads") {
    // Olivella shells hung from a red cord, with a cut spondylus shell at the center.
    parts.push(cord(13, 10.5, 1.8, c.red));
    for (let index = 0; index <= 12; index += 1) {
      const [x, y, angle] = along(index / 12, 13, 10.5);
      const degrees = (angle * 180) / Math.PI - 90;
      parts.push(`<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${degrees.toFixed(1)})">` +
        `<path d="M-1.6 0.4 C-1.9 3 -1 5.4 0 5.8 C1 5.4 1.9 3 1.6 0.4 Z" fill="${c.white}" stroke="${CODEX_INK}" stroke-width="0.7"/>` +
        `<path d="M0 1.2 L0 4.6" stroke="${c.stone}" stroke-width="0.6"/></g>`);
    }
    const [px, py] = along(0.5, 13, 10.5);
    parts.push(codexShape(`M${px - 5.5} ${py + 4} C${px - 5} ${py + 12} ${px + 5} ${py + 12} ${px + 5.5} ${py + 4} C${px + 2} ${py + 2} ${px - 2} ${py + 2} ${px - 5.5} ${py + 4} Z`, "#cf5a3a", 1.3));
    parts.push(codexLine(`M${px} ${py + 3.4} L${px} ${py + 10.6} M${px - 2.8} ${py + 3.8} L${px - 2} ${py + 10} M${px + 2.8} ${py + 3.8} L${px + 2} ${py + 10}`, 0.8, "#8f3122"));
    parts.push(codexShape(`M${px - 6.4} ${py + 4.6} l-1.4 -1.8 l2.4 0.4 Z M${px + 6.4} ${py + 4.6} l1.4 -1.8 l-2.4 0.4 Z`, "#cf5a3a", 0.8));
  } else if (adornment === "feather-trim") {
    // A feather collar: a beaded gold band with two rows of short plumes falling over the shoulders.
    const plume = (t, rx, ry, length, fill, tip) => {
      const [x, y, angle] = along(t, rx, ry);
      return codexFeather(x.toFixed(1), y.toFixed(1), ((angle * 180) / Math.PI + 90).toFixed(1), length, fill, tip);
    };
    for (let index = 0; index <= 9; index += 1) parts.push(plume(index / 9, 11.5, 9.5, 11, index % 2 ? c.featherLight : c.feather, c.white));
    for (let index = 0; index <= 8; index += 1) parts.push(plume((index + 0.5) / 9.5, 9.5, 7.5, 8, index % 2 ? c.red : c.gold, index % 2 ? c.gold : c.red));
    parts.push(cord(9, 7, 3.4, c.ink));
    parts.push(cord(9, 7, 2.2, c.gold));
    for (let index = 0; index <= 6; index += 1) {
      const [x, y] = along(index / 6, 9, 7);
      parts.push(codexCircle(x.toFixed(1), y.toFixed(1), 1.1, c.red, 0.7));
    }
  }
  return parts.join("");
}

function codexLoincloth(character, palette, outfit) {
  const c = CODEX_COLORS;
  if (outfit === "feathered-huipil") {
    return codexShape("M81 126 L117 124 L124 166 L76 168 Z", "#e9dcc0") +
      codexFretBand(77, 158, 46, 8, c.red, c.jade) +
      codexLine("M100 128 L102 158 M90 128 L87 158", 1.2, "#b9ab86") +
      codexShape("M81 124 L117 122 L117 129 L81 131 Z", c.jade, 1.8);
  }
  if (outfit === "ballplayer-gear") {
    // The heavy U-shaped yoke of padded hide, carved and painted, with a deerskin hip guard.
    return codexShape("M82 128 L115 126 L116 133 L83 135 Z", c.white, 2.2) +
      codexShape("M79 120 C90 117 110 116 120 118 L122 132 C110 136 90 137 78 135 Z", c.hide, 2.6) +
      codexLine("M81 126 C92 123 108 122 120 124 M80 131 C92 129 108 128 121 129", 1.2, c.hideLight) +
      codexFretBand(88, 124, 22, 6, c.gold, c.redDark) +
      codexShape("M104 133 L117 132 L119 148 L111 152 L103 147 Z", c.red, 2) +
      codexLine("M107 137 L115 136 M106.5 142 L116 141", 1, c.white);
  }
  if (CODEX_KILT_SUITS.includes(outfit)) {
    const fill = CODEX_SUITS[outfit];
    const trim = outfit === "tzitzimitl-clothes" ? c.white : outfit === "eagle-clothes" ? c.gold : outfit === "coyote-suit" ? c.white : c.red;
    return codexShape("M82 128 L116 126 L120 150 L80 152 Z", fill) +
      codexShape("M80 146 L120 144 L120 152 L80 154 Z", trim, 1.8) +
      (outfit === "tzitzimitl-clothes" ? codexLine("M92 134 L100 142 M100 134 L92 142 M106 133 L112 140 M112 133 L106 140", 1.8) : "");
  }
  if (character?.appearance?.garment === "huipil") {
    // A cueitl wrap skirt to the knee, with a woven border.
    return codexShape("M81 126 L117 124 L124 166 L76 168 Z", palette.tunic) +
      codexFretBand(77, 158, 46, 8, palette.trim, palette.trimAlt) +
      codexLine("M100 128 L102 158 M90 128 L87 158", 1.2, palette.tunicDark) +
      codexShape("M81 124 L117 122 L117 129 L81 131 Z", palette.trim, 1.8);
  }
  return codexShape("M82 128 L115 126 L116 133 L83 135 Z", c.white, 2.2) +
    codexShape("M106 132 L115 131 L118 152 L111 157 L104 150 Z", c.white, 2.2) +
    codexShape("M104.5 147 L118 146 L118 152 L111 157 L104 150 Z", palette.tunic, 1.6) +
    codexShape("M82 133 L89 133 L86 150 L79 146 Z", c.white, 2) +
    codexLine("M84 130 L114 129", 1.4, palette.trim);
}

function codexLegs(palette, outfit, race, near) {
  const c = CODEX_COLORS;
  const parts = [];
  const legFill = CODEX_SUITS[outfit] || palette.skin;
  const barefoot = race === "halfling";
  // Thigh over calf, so the knee reads as a joint; the calf swells and narrows to the ankle.
  const calf = near
    ? [[107, 156, 5.2], [109.5, 166, 5.6], [110.5, 176, 4.1], [110.6, 183, 3.6]]
    : [[87, 156, 5.2], [85.4, 166, 5.6], [84.2, 176, 4.1], [83.8, 183, 3.6]];
  const thigh = near
    ? [[99.5, 131, 7.2], [104, 146, 6.4], [107.5, 159, 5.1]]
    : [[91, 131, 7.2], [88.6, 146, 6.4], [86.8, 159, 5.1]];
  parts.push(codexTaper(calf, CODEX_SUITS[outfit] ? legFill : palette.skin));
  parts.push(codexTaper(thigh, legFill));
  parts.push(codexLine(near ? "M106.5 156.5 C108 158 109.5 158.2 110.5 157.4" : "M85.4 156.6 C86.6 158 88 158.2 89 157.6", 1.1, palette.skinDark));
  if (outfit === "ballplayer-gear" && near) parts.push(codexShape("M103 154 L114 152 L115 164 L104 166 Z", c.hide, 1.8));
  const foot = near
    ? "M104 182 L118 182 C125 183 128 187 126 191 L104 191 Z"
    : "M77 182 L91 182 C98 183 100 187 98 191 L77 191 Z";
  parts.push(codexShape(foot, palette.skin, 2.4));
  if (!barefoot) {
    const sole = near ? "M102 191 L128 191 L128 194 L102 194 Z" : "M75 191 L100 191 L100 194 L75 194 Z";
    parts.push(codexShape(sole, c.hide, 1.8));
    // The sandal's tall heel guard, rounded at the top like the painted cactli.
    parts.push(codexShape(near ? "M101.6 191 L101.6 181.4 C101.6 178.4 104.6 177.4 107 178.6 L108.6 179.6 L108.2 191 Z"
      : "M74.6 191 L74.6 181.4 C74.6 178.4 77.6 177.4 80 178.6 L81.6 179.6 L81.2 191 Z", c.white, 1.8));
    parts.push(codexLine(near ? "M108 184 L116 182 M108 188 L120 186" : "M81 184 L89 182 M81 188 L93 186", 1.6, c.red));
  } else {
    parts.push(codexLine(near ? "M118 184 C121 185 122 187 121 189" : "M91 184 C94 185 95 187 94 189", 1.2, palette.skinDark));
  }
  return parts.join("");
}

function codexArm(palette, outfit, near, holding) {
  const c = CODEX_COLORS;
  const sleeve = CODEX_SUITS[outfit] || null;
  const parts = [];
  if (near) {
    // Weapon arm: the upper arm hangs from the shoulder, the forearm comes forward to the grip.
    const forearmFill = sleeve && outfit !== "tzitzimitl-clothes" ? sleeve : palette.skin;
    parts.push(codexTaper([[109.5, 114.5, 4.4], [119, 108.5, 4.1], [128.5, 101.5, 3.4]], forearmFill));
    parts.push(codexTaper([[97, 94, 5.6], [103.5, 104.5, 5], [110, 114.5, 4.4]], sleeve || palette.skin));
    if (holding) {
      // A closed fist around the shaft, thumb over the knuckles.
      parts.push(codexShape("M127.5 96.5 C128 91.6 133 89.8 137.2 90.6 C140.6 91.4 141.8 94.4 141.4 97.6 C141 101.6 137.6 104 133.4 103.8 C129.8 103.6 127.2 100.6 127.5 96.5 Z", palette.skin, 2.2));
      parts.push(codexLine("M132.2 95.6 C134.6 94.4 137.6 94.4 139.6 95.6", 1.2, palette.skinDark));
      parts.push(codexLine("M130 99.6 L139.8 99.2 M131.4 102.4 L138.6 102", 0.9, palette.skinDark));
    } else {
      parts.push(codexShape("M127.8 97.4 C129.4 92.6 136 91.8 139.4 94.4 C141.4 96.4 140.6 99.8 137.6 100.8 C134 102 129.4 101.6 127.8 97.4 Z", palette.skin, 2.2));
      parts.push(codexLine("M131 96 L138.6 95.6", 1, palette.skinDark));
    }
    // A gold wristband where forearm meets hand.
    parts.push(codexShape("M124.8 99.8 L129.2 96.6 L131.6 100.2 L127.2 103.4 Z", c.gold, 1.6));
  } else {
    parts.push(codexTaper([[116.5, 113.5, 4], [120.5, 117, 3.6], [124.5, 120, 3.1]], palette.skinDark));
    parts.push(codexTaper([[108.5, 95.5, 5], [112.5, 104.5, 4.5], [116.5, 113.5, 4]], sleeve || palette.skinDark));
    parts.push(codexShape("M121.2 117.4 C124.4 114.6 129.6 115.6 130.4 119.4 C131 122.8 127.6 125.2 124.2 124.4 C121.6 123.8 120.2 120 121.2 117.4 Z", palette.skinDark, 2.2));
  }
  return parts.join("");
}

function codexCloak(palette) {
  const c = CODEX_COLORS;
  return codexShape("M110 88 C98 84 82 88 74 102 L62 166 C76 174 92 174 100 168 L98 112 Z", palette.tunicLight) +
    codexShape("M64 156 C76 162 90 162 100 158 L100 168 C92 174 76 174 62 166 Z", palette.trim, 2) +
    codexLine("M68 162 L70 158 M76 165 L78 160 M84 166 L86 161 M92 165 L94 160", 1.3, c.gold) +
    codexLine("M80 104 C76 124 72 142 70 156 M90 104 C88 124 86 142 86 160", 1.2, palette.tunic) +
    codexShape("M106 86 C112 84 116 88 114 94 C110 96 106 92 106 86 Z", palette.trim, 1.8);
}

function codexBackDevice(id) {
  const c = CODEX_COLORS;
  if (!id) return "";
  if (id === "pamitl") {
    return codexLine("M80 112 L74 18 M88 112 L86 14", 2.4, c.wood) +
      codexShape("M74 18 L56 20 L58 44 L75 42 Z", c.white, 1.6) + codexLine("M57 26 L74 25 M57 34 L75 33", 3, c.red) +
      codexShape("M86 14 L104 14 L104 38 L87 38 Z", c.white, 1.6) + codexLine("M87 22 L104 22 M87 30 L104 30", 3, c.red);
  }
  if (id === "jaguar-pennant") {
    let spots = "";
    for (const [x, y] of [[62, 26], [72, 34], [62, 44], [74, 50], [64, 58]]) spots += `<circle cx="${x}" cy="${y}" r="3" fill="none" stroke="${CODEX_INK}" stroke-width="1.3"/><circle cx="${x}" cy="${y}" r="1" fill="${CODEX_INK}"/>`;
    return codexLine("M84 116 L82 10", 2.6, c.wood) + codexShape("M82 16 L54 20 L56 66 L70 60 L82 64 Z", "#e2a536", 1.8) + spots +
      codexFeather(82, 10, 0, 14, c.jade);
  }
  if (id === "butterfly-device") {
    return codexLine("M84 112 L84 50", 2.4, c.wood) +
      codexShape("M84 60 C64 30 40 26 36 44 C34 58 54 70 84 70 Z", "#d96d2a", 2) +
      codexShape("M84 72 C60 72 46 86 52 100 C58 110 76 96 84 80 Z", "#d96d2a", 2) +
      codexShape("M84 60 C78 40 70 34 64 42 C62 50 72 58 84 62 Z", "#231b18", 1.4) +
      codexCircle(50, 46, 5, "#231b18", 1.4) + codexCircle(50, 46, 2, c.white, 0.6) +
      codexCircle(62, 92, 4, "#231b18", 1.2);
  }
  if (id === "sun-standard") {
    let rays = "";
    for (let index = 0; index < 12; index += 1) {
      const angle = (index / 12) * Math.PI * 2;
      const x = 72 + Math.cos(angle) * 30;
      const y = 40 + Math.sin(angle) * 30;
      const x1 = 72 + Math.cos(angle - 0.18) * 20;
      const y1 = 40 + Math.sin(angle - 0.18) * 20;
      const x2 = 72 + Math.cos(angle + 0.18) * 20;
      const y2 = 40 + Math.sin(angle + 0.18) * 20;
      rays += codexShape(`M${x1} ${y1} L${x} ${y} L${x2} ${y2} Z`, c.gold, 1.2);
    }
    return codexLine("M84 116 L78 60", 3, c.wood) + rays + codexCircle(72, 40, 20, c.gold, 2.2) + codexCircle(72, 40, 12, c.red, 1.6) +
      codexCircle(72, 40, 5, c.gold, 1.2);
  }
  if (id === "quetzal-fan") {
    let fan = "";
    [-80, -66, -52, -38, -24, -10].forEach((angle, index) => { fan += codexFeather(84, 96, angle - 20, 70 + (index % 2) * 10, index % 2 ? c.jade : c.feather, index % 2 ? c.gold : c.featherLight); });
    return fan + codexCircle(84, 96, 6, c.gold, 1.6);
  }
  if (id === "spanish-guidon") {
    return codexLine("M84 116 L82 6", 2.4, c.wood) + codexCircle(82, 6, 2.6, c.gold, 1) +
      codexShape("M82 12 L48 14 L58 26 L46 38 L82 40 Z", "#a8322a", 1.8) +
      codexShape("M66 18 h4 v6 h6 v4 h-6 v8 h-4 v-8 h-6 v-4 h6 Z", c.gold, 1);
  }
  if (id === "nobori") {
    return codexLine("M84 116 L84 4 M84 8 L58 8", 2.4, c.wood) +
      codexShape("M58 8 L82 8 L82 84 L58 84 Z", c.white, 1.8) +
      codexCircle(70, 26, 7, c.red, 1.4) + codexLine("M62 44 L78 44 M62 52 L78 52 M70 60 L70 78", 2, CODEX_INK);
  }
  return "";
}

function codexTail(palette, race) {
  const c = CODEX_COLORS;
  if (race === "tiefling") {
    return codexLimb("M84 134 C70 146 62 160 70 172 C74 178 66 182 60 178", 4, palette.skin) +
      codexShape("M58 174 L54 186 L64 180 Z", c.redDark, 1.6);
  }
  if (race === "dragonborn") {
    return codexShape("M86 130 C74 140 66 156 62 172 C61 178 66 180 69 175 C72 160 80 148 90 140 Z", palette.skin) +
      codexLine("M68 160 q3 -2 5 1 M74 150 q3 -2 5 1", 1.2, palette.skinDark) +
      codexShape("M66 162 L60 156 L70 158 Z M72 150 L68 143 L77 147 Z", palette.hair, 1.3);
  }
  return "";
}

// Painted-paper treatment for figures: a slight hand wobble on every line, uneven watercolor
// wash inside the fills, and a fine pigment grain, matching the scanned codex art.
const CODEX_WATERCOLOR_FILTER =
  `<filter id="codex-ink" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">` +
  `<feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="7" result="noise"/>` +
  `<feDisplacementMap in="SourceGraphic" in2="noise" scale="1.7" xChannelSelector="R" yChannelSelector="G" result="drawn"/>` +
  `<feColorMatrix in="drawn" type="saturate" values="0.86" result="muted"/>` +
  `<feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="3" seed="23" result="wash"/>` +
  `<feColorMatrix in="wash" type="matrix" values="0.34 0 0 0 0.74  0.34 0 0 0 0.73  0.34 0 0 0 0.71  0 0 0 0 1" result="washTone"/>` +
  `<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="41" result="grain"/>` +
  `<feColorMatrix in="grain" type="matrix" values="0.16 0 0 0 0.9  0.16 0 0 0 0.89  0.16 0 0 0 0.87  0 0 0 0 1" result="grainTone"/>` +
  `<feBlend in="washTone" in2="grainTone" mode="multiply" result="paperTone"/>` +
  `<feBlend in="muted" in2="paperTone" mode="multiply" result="painted"/>` +
  `<feComposite in="painted" in2="drawn" operator="in"/>` +
  `</filter>`;

// What the figure is wearing. Adventurers dress with items (character.dressByItems):
// basic garments, headwear, and necklaces are drawn in their dye colors, everything else
// as regalia. Villagers, previews, and older figures still dress from their appearance.
function codexDressed(character) {
  if (!character?.dressByItems) return character;
  const cosmetics = character.cosmetics || {};
  const catalog = (typeof COSMETICS !== "undefined" && COSMETICS) || window.CryptsItems?.cosmetics || {};
  const clothes = catalog[cosmetics.clothes];
  const helmet = catalog[cosmetics.helmet];
  const neck = catalog[cosmetics.neck];
  return {
    ...character,
    appearance: {
      ...(character.appearance || {}),
      ...(clothes?.basic && clothes.dye ? clothes.dye : {}),
      garment: clothes?.basic ? clothes.garment : "none",
      headwear: helmet?.basic ? helmet.headwear : "none",
      adornment: neck?.basic ? neck.adornment : "none"
    },
    cosmetics: {
      ...cosmetics,
      clothes: clothes && !clothes.basic ? cosmetics.clothes : null,
      helmet: helmet && !helmet.basic ? cosmetics.helmet : null
    }
  };
}

function buildCodexFigureSvg(character, facing = "east") {
  character = codexDressed(character);
  const equipment = character?.equipment || {};
  const cosmetics = character?.cosmetics || {};
  const outfit = cosmetics.clothes || "";
  const palette = codexPalette(character);
  const race = palette.race;
  const shape = CODEX_RACE_SHAPES[race];
  const west = String(facing).endsWith("west");
  const north = String(facing).startsWith("north");
  const hasArmor = Boolean(equipment.armor && equipment.armor !== "none" && !outfit);
  const head = codexHead(character, palette, north);
  const weaponId = equipment.weapon || "macuahuitl";
  const layers = [
    codexBackDevice(cosmetics.back),
    equipment.cloak ? codexCloak(palette) : "",
    codexTail(palette, race),
    head.back,
    equipment.shield || character?.iconMode ? "" : codexArm(palette, outfit, false, false),
    codexLegs(palette, outfit, race, false),
    codexTorso(character, palette, hasArmor, outfit),
    codexLegs(palette, outfit, race, true),
    codexLoincloth(character, palette, outfit),
    codexLimb("M99 80 L100 92", 11, palette.skin),
    `<g transform="translate(100 88) scale(${shape.head}) translate(-100 -88)">${head.front}</g>`,
    equipment.shield && !character?.iconMode ? codexArm(palette, outfit, false, false) : "",
    character?.iconMode || weaponId === "none" ? "" : `<g transform="translate(12 0)">${codexWeapon(weaponId)}</g>`,
    equipment.shield && !character?.iconMode ? codexShield(palette) : "",
    character?.iconMode ? "" : codexArm(palette, outfit, true, weaponId !== "none")
  ].join("");
  const build = { slight: 0.93, broad: 1.09 }[character?.appearance?.body] || 1;
  const body = `<g transform="translate(100 194) scale(${shape.sx * build} ${shape.sy}) translate(-100 -194)">${layers}</g>`;
  const oriented = west ? `<g transform="translate(200 0) scale(-1 1)">${body}</g>` : body;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">` +
    `<defs>${CODEX_WATERCOLOR_FILTER}` +
    `<clipPath id="codex-shield"><circle cx="126" cy="130" r="17.5"/></clipPath>` +
    `<clipPath id="codex-mantle"><path d="M100 86 L120 94 L116 136 L80 138 L78 104 C90 102 96 96 100 86 Z"/></clipPath>` +
    `<clipPath id="codex-torso-clip"><path d="M77 90 C88 83 108 82 119 89 L122 102 L119 136 L79 138 L74 103 Z"/></clipPath></defs>` +
    `<g filter="url(#codex-ink)">${oriented}</g></svg>`;
}

function codexFigureKey(character, facing) {
  character = codexDressed(character);
  const appearance = character?.appearance || {};
  const equipment = character?.equipment || {};
  const cosmetics = character?.cosmetics || {};
  return [
    character?.race, appearance.skin, appearance.hair, appearance.hairStyle, appearance.tunic, appearance.trim, appearance.garment,
    appearance.adornment, appearance.headwear, appearance.facePaint, appearance.body, appearance.beard,
    appearance.jewelry, appearance.crest, equipment.weapon, equipment.armor,
    equipment.shield, equipment.cloak, cosmetics.helmet, cosmetics.clothes, cosmetics.back,
    String(facing).endsWith("west") ? "w" : "e", String(facing).startsWith("north") ? "n" : "s"
  ].join("|");
}

function codexFigureUrl(character, facing = "east") {
  const key = codexFigureKey(character, facing);
  let url = codexFigureCache.get(key);
  if (!url) {
    url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildCodexFigureSvg(character, facing))}`;
    if (codexFigureCache.size > 400) codexFigureCache.clear();
    codexFigureCache.set(key, url);
  }
  return url;
}


// Card icons for the shop: a weapon laid diagonally, an armor torso, or a helmet,
// all cropped from the same codex renderer as the characters.
const codexIconCache = new Map();
const CODEX_ICON_MANNEQUIN = {
  race: "human",
  appearance: { skin: "#9a603c", hair: "#211a17", hairStyle: "short", tunic: "#6f6252", garment: "woven-tunic", adornment: "none", headwear: "none", facePaint: "none" },
  equipment: { weapon: "macuahuitl", armor: "none", shield: false, cloak: false },
  cosmetics: { owned: [], helmet: null, clothes: null }
};

function codexWeaponExtent(id) {
  const weapon = (typeof WEAPONS !== "undefined" && WEAPONS[id]) || {};
  const base = weapon.baseId || id;
  const art = (typeof WEAPONS !== "undefined" && WEAPONS[base]?.art) || "";
  const icon = (typeof WEAPONS !== "undefined" && WEAPONS[base]?.icon) || "sword";
  const byArt = { rapier: [6, 112], broadsword: [4, 115], halberd: [2, 186], arquebus: [16, 122], katana: [24, 116], nodachi: [4, 116], yari: [0, 184], yumi: [2, 162],
    norsesword: [6, 115], copperaxe: [30, 116], purebow: [28, 148], flintlance: [0, 178], stingray: [28, 110] };
  const byId = { macuahuitl: [20, 110], longsword: [20, 110], greatsword: [10, 110], atlatl: [12, 122], "light-crossbow": [66, 112] };
  const byIcon = { dagger: [50, 102], sword: [38, 108], axe: [34, 114], hammer: [30, 114], mace: [38, 114], staff: [10, 186], spear: [2, 178], bow: [38, 138] };
  return byArt[art] || byId[base] || byIcon[icon] || [20, 110];
}

function codexGearIconUrl(kind, id) {
  const key = `${kind}:${id}`;
  if (codexIconCache.has(key)) return codexIconCache.get(key);
  let svg;
  const filter = `<defs>${CODEX_WATERCOLOR_FILTER}</defs>`;
  if (kind === "weapon") {
    const [top, bottom] = codexWeaponExtent(id);
    const centerY = (top + bottom) / 2;
    const size = Math.max(60, (bottom - top) * 0.74 + 34);
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${124 - size / 2} ${centerY - size / 2} ${size} ${size}" width="160" height="160">${filter}` +
      `<g filter="url(#codex-ink)" transform="rotate(42 124 ${centerY})">${codexWeapon(id)}</g></svg>`;
  } else if (kind === "back") {
    // Banners are shown on their own, without the wearer.
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="28 0 76 120" width="160" height="160">${filter}` +
      `<g filter="url(#codex-ink)">${codexBackDevice(id)}</g></svg>`;
  } else {
    const figure = JSON.parse(JSON.stringify(CODEX_ICON_MANNEQUIN));
    figure.iconMode = true;
    figure.dressByItems = true;
    figure.cosmetics.neck = null;
    if (kind === "neck") figure.cosmetics.neck = id;
    if (kind === "armor") figure.equipment.armor = id;
    if (kind === "helmet") figure.cosmetics.helmet = id;
    if (kind === "clothes") figure.cosmetics.clothes = id;
    if (kind === "back") figure.cosmetics.back = id;
    const box = kind === "helmet" ? (["quetzal-headdress", "amacalli", "deer-crown"].includes(id) ? "54 -6 96 96" : "64 4 80 80")
      : kind === "neck" ? "66 70 68 68" : "62 78 76 76";
    svg = buildCodexFigureSvg(figure, "east").replace('viewBox="0 0 200 200" width="200" height="200"', `viewBox="${box}" width="160" height="160"`);
  }
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  codexIconCache.set(key, url);
  return url;
}
