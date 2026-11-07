"use strict";

// Codex-style adventurer figure.
//
// Draws the player and companions in the manner of the painted Central Mexican codices the
// rest of the game's art comes from: a profile head with a large almond eye and ear spool,
// a frontal torso, profile legs and feet, flat mineral colors, and heavy ink
// outlines with a slight hand-drawn wobble. Every builder choice (people, skin, hair,
// garment, adornment, headwear, face paint, armor, shield, cloak, weapon, Mahuiz's regalia)
// changes the drawing. The figure is returned as SVG markup on a 200 × 200 canvas,
// facing east; west-facing poses are mirrored and north-facing poses show the back of the head.

const CODEX_INK = "#2e211a";
// Line weight relative to the original bold outlines. The tomb's art is painted with a fine
// brush, so figures use thin, slightly uneven ink lines and soft watercolor fills.
const CODEX_LINE = 0.7;
const CODEX_COLORS = {
  ink: CODEX_INK,
  paper: "#f4e7c8",
  white: "#f6eedb",
  cream: "#ecd9ad",
  // Mineral colors matched to the painted codex art: carmine, ochre, Maya blue, jade.
  red: "#b8213a",
  redDark: "#741a26",
  gold: "#e6b73a",
  goldDark: "#a8771f",
  jade: "#3f7a55",
  jadeLight: "#6cb48a",
  turquoise: "#4a9da3",
  blue: "#3b6fae",
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
  const trimAlt = ["#e1ad3b", CODEX_COLORS.gold].includes(trim.toLowerCase()) ? CODEX_COLORS.red : CODEX_COLORS.gold;
  return {
    trim,
    trimAlt,
    trimDark: codexShade(trim, -36),
    race,
    skin,
    skinDark: codexShade(skin, -34),
    skinShade: codexShade(skin, -16),
    skinLight: codexShade(skin, 30),
    hair,
    hairLight: codexShade(hair, 46),
    tunic,
    tunicDark: codexShade(tunic, -36),
    tunicLight: codexShade(tunic, 52)
  };
}


// ---------- Painted parts ----------
// The adventurer's gear and body are your paintings (art/character/<kind>/<id>.dds, built
// into resources/character-textures/; see art/character/README.md). There is no drawn
// stand-in: a part shows exactly as painted. While a painting is still loading the part is
// left out of that one picture (which isn't kept; the figure is redrawn when it arrives, and
// new screens wait for it, see systems/arrival.js). A part with no painting at all is left
// out and named in the console; `npm run check` lists any (tools/art-check.js).
let codexFigureIncomplete = false;
const codexUnpaintedWarned = new Set();
function codexPainted(kind, id, palette = {}, variant = "") {
  if (typeof id !== "string" || !id || id === "none") return "";
  const layer = characterTextureLayer(kind, id, palette, variant);
  if (layer) return layer;
  if (characterTextureEntry(kind, id)) {
    codexFigureIncomplete = true;
  } else if (!codexUnpaintedWarned.has(`${kind}/${id}`)) {
    codexUnpaintedWarned.add(`${kind}/${id}`);
    console.warn(`No painting for ${kind}/${id}: add art/character/${kind}/${id}.dds (npm run new-part -- ${kind} ${id}).`);
  }
  return "";
}

function codexBaseWeaponId(tieredId) {
  return ((typeof WEAPONS !== "undefined" && WEAPONS[tieredId]) || {}).baseId || tieredId;
}



// Face presets for every people except the Serpentkin (who wear the serpent's own head).
// Each is a profile: the skull outline (forehead, nose, lips, chin), an eye, a brow, a
// mouth, and a few lines of character. They are independent of hair, headwear, and paint.
const CODEX_FACES = {
  calm: {
    skull: "M84 48 C86 38 104 36 111 44 L115 52 L117 58 C122 61 126 65 124 69 L118 70 L119 73 L116 75 L118 78 C115 83 109 85 103 85 L98 87 C88 85 82 77 82 66 C81 58 81 52 84 48 Z",
    eye: "M102 60 Q107 55.5 112.5 60 Q107 63.5 102 60 Z", pupil: [108.6, 59.9, 1.9],
    brow: ["M102 54.5 Q108 51.5 113.5 55.5", 1.8], mouth: ["M112 76 L117.5 75.5", 1.4], lines: []
  },
  hawk: {
    skull: "M84 48 C86 38 104 35 111 42 L114 50 L116 54 C123 58 129 66 125 72 L118 71 L119 74 L116 76 L118 79 C115 84 109 86 103 85 L98 87 C88 85 82 77 82 66 C81 58 81 52 84 48 Z",
    eye: "M102 60 Q107 57 112.5 59.5 Q107 62 102 60 Z", pupil: [108.4, 59.6, 1.6],
    brow: ["M101 55.5 Q108 51.5 114 54", 2.5], mouth: ["M112 77.5 L118 77", 1.5],
    lines: [["M113 63.5 C115 66 116 68 118 69", 1.1]]
  },
  round: {
    skull: "M84 48 C86 38 104 37 110 45 L113 53 L116 59 C120 61 122 64 121 67 L117 68 L118 72 L115 74 L117 77 C115 84 108 88 101 87 L97 88 C87 86 81 78 81 66 C80 58 81 52 84 48 Z",
    eye: "M101.5 60 Q107 54.5 112.5 60 Q107 64.5 101.5 60 Z", pupil: [108.2, 59.8, 2.1],
    brow: ["M101 53.5 Q107 49.5 112.5 53", 1.7], mouth: ["M110 76 Q114 78.5 117 75", 1.4],
    lines: [["M103 70 q3 2 6 1", 1]]
  },
  weathered: {
    skull: "M84 48 C86 38 104 36 111 44 L115 52 L117 58 C122 61 125 66 123 70 L118 71 L119 74 L116 76 L117 79 C114 83 110 84 104 84 L98 87 C88 85 82 77 82 66 C81 58 81 52 84 48 Z",
    eye: "M102.5 60.5 Q107 57.5 112 60.5 Q107 63 102.5 60.5 Z", pupil: [108.2, 60.4, 1.6],
    brow: ["M101 54.5 Q108 52 114 56", 2], mouth: ["M112 77 L117 77.5", 1.4],
    lines: [["M102.5 58.6 Q107 56.4 112 58.8", 1], ["M113 62.5 l3.2 0.8 M113 65 l3 0.2", 0.9], ["M111 71 C109 74 109 77 111 80", 1], ["M96 62 C97 66 98 69 101 71", 0.9]]
  },
  scarred: {
    skull: "M84 48 C86 38 104 35 112 43 L116 52 L118 57 C124 61 127 66 124 69 L118 70 L119 72 L116 74 L119 78 L117 84 L103 86 L98 87 C88 85 82 77 82 66 C81 58 81 52 84 48 Z",
    eye: "M102 60.5 Q107 57 112.5 60.5 Q107 63 102 60.5 Z", pupil: [108.6, 60.4, 1.7],
    brow: ["M101 53 L114 57", 2.3], mouth: ["M111 77 L117.5 76.5", 1.5],
    lines: [["M98 56 L105 73", 1.5, "#8c3a2c"], ["M99.5 60 l2 -0.6 M101 64 l2 -0.6 M102.5 68 l2 -0.6", 0.9, "#8c3a2c"]]
  },
  bright: {
    skull: "M84 48 C86 37 104 36 111 45 L114 53 L116 59 C120 62 122 65 120 68 L116 69 L117 72 L115 74 L116 77 C114 82 108 85 102 85 L98 87 C88 85 82 77 82 66 C81 58 81 52 84 48 Z",
    eye: "M102.5 60 Q107.5 54.5 112.5 60 Q107.5 64.5 102.5 60 Z", pupil: [108.4, 59.8, 2.3],
    brow: ["M103 53 Q108 50.5 112.5 53.5", 1.5], mouth: ["M112 75.5 L116.5 75", 1.3], lines: []
  },
  broad: {
    skull: "M84 48 C86 38 104 36 111 44 L115 52 L117 59 C123 62 127 67 123 71 L117 71 L119 74 L116 77 L118 80 C116 86 110 89 103 88 L98 88 C88 86 82 78 82 66 C81 58 81 52 84 48 Z",
    eye: "M102 60.5 Q107 56.5 112 60.5 Q107 63.5 102 60.5 Z", pupil: [107.8, 60.3, 1.8],
    brow: ["M101 55 Q107 52.5 113 55.5", 2.6], mouth: ["M111 76.5 L118 76", 1.6],
    lines: [["M112 79.5 q3 1.6 5.6 0", 1.1], ["M117 65 C119 67 120 69 121 71", 1]]
  },
  long: {
    skull: "M84 48 C86 38 104 36 111 44 L115 52 L118 57 C123 62 127 68 125 71 L119 71 L120 74 L117 76 L118 79 C116 85 110 88 103 87 L98 88 C88 85 82 77 82 66 C81 58 81 52 84 48 Z",
    eye: "M102.5 60 Q107.5 57 112.5 60 Q107.5 62 102.5 60 Z", pupil: [108.5, 59.8, 1.6],
    brow: ["M102 55 L113.5 54.5", 1.8], mouth: ["M113 77 L118.5 76.8", 1.2],
    lines: [["M101 71 a0.9 0.9 0 1 0 0.1 0 M104 72.5 a0.9 0.9 0 1 0 0.1 0 M107 71.5 a0.9 0.9 0 1 0 0.1 0", 1.4]]
  }
};
const CODEX_FACE_IDS = Object.keys(CODEX_FACES);

function codexFace(appearance) {
  return CODEX_FACES[appearance?.face] || CODEX_FACES.calm;
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
    front.push(codexShape(codexFace(appearance).skull, palette.skin));
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
      const face = codexFace(appearance);
      for (const [d, width, color] of face.lines) front.push(codexLine(d, width, color || palette.skinDark));
      front.push(codexShape(face.eye, c.white, 1.6));
      front.push(codexCircle(face.pupil[0], face.pupil[1], face.pupil[2], CODEX_INK, 0.6));
      front.push(codexLine(face.brow[0], face.brow[1]));
      front.push(codexLine(face.mouth[0], face.mouth[1]));
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

  // Headwear and Mahuiz's helmets: painted.
  const headgearId = helmet || (headwear !== "none" ? headwear : "");
  front.push(codexPainted("helmet", headgearId, palette, north ? "north" : ""));
  return { back: back.join(""), front: front.join("") };
}


function codexTorso(character, palette, hasArmor, outfit) {
  const appearance = character?.appearance || {};
  const equipment = character?.equipment || {};
  const variant = appearance.body === "curvy" ? "curvy" : "";
  // Armor over everything; a regalia suit is the whole outfit; otherwise the garment, then
  // the collar or beads at the neck.
  const armorId = hasArmor ? ((typeof ARMORS !== "undefined" && ARMORS[equipment.armor]?.baseId) || equipment.armor) : "";
  if (outfit) return codexPainted("armor", armorId, palette, variant) + codexPainted("clothes", outfit, palette, variant);
  return codexPainted("armor", armorId, palette, variant) +
    codexPainted("clothes", appearance.garment || "woven-tunic", palette, variant) +
    codexAdornment(appearance.adornment || "none", palette);
}


// Necklaces and collars, drawn over the garment and armor around the neck (centered near
// 99,90). Points on the collar are placed along a half-ellipse below the throat.
function codexAdornment(adornment, palette = {}) {
  return codexPainted("adornment", adornment, palette);
}

// Which loincloth a figure wears: the cueitl wrap skirt under a huipil, or the plain
// maxtlatl. Regalia suits wear none: their legs are part of the suit's own painting.
// Each can be repainted as art/character/loincloth/<id>.dds.
const CODEX_LOINCLOTH_SUITS = ["feathered-huipil", "ballplayer-gear", ...CODEX_KILT_SUITS];
function codexLoinclothId(character, outfit) {
  if (CODEX_LOINCLOTH_SUITS.includes(outfit)) return "";
  return character?.appearance?.garment === "huipil" ? "cueitl" : "maxtlatl";
}

function codexLoincloth(character, palette, outfit) {
  const id = codexLoinclothId(character, outfit);
  if (!id) return "";
  const curvy = character?.appearance?.body === "curvy";
  return codexPainted("loincloth", id, palette, curvy ? "curvy" : "");
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

// Painted-paper treatment, after the Florentine Codex pages the rest of the game's art comes
// from: every figure is painted twice. First the watercolor wash: the fills alone, lifted
// toward the paper, with soft bleeding edges, pigment pooling at the rims, and grain, set a
// hair off the drawing the way a painter's wash never quite meets the line. Then the
// drawing: the ink lines alone in a warm sepia with a slight hand wobble, multiplied over
// the wash so the paper and color show through. Front shapes are white in the drawing pass,
// which hides the lines behind them without covering the wash.
const CODEX_SEPIA = "#3d2a1f";
const CODEX_PAINT_DEFS =
  `<filter id="codex-wash" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">` +
  `<feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="11" result="bleed"/>` +
  `<feDisplacementMap in="SourceGraphic" in2="bleed" scale="2.6" xChannelSelector="R" yChannelSelector="G" result="spread"/>` +
  `<feColorMatrix in="spread" type="saturate" values="0.96" result="soft"/>` +
  `<feComponentTransfer in="soft" result="lifted"><feFuncR type="linear" slope="0.9" intercept="0.085"/><feFuncG type="linear" slope="0.9" intercept="0.078"/><feFuncB type="linear" slope="0.9" intercept="0.065"/></feComponentTransfer>` +
  `<feMorphology in="spread" operator="erode" radius="1.6" result="inner"/>` +
  `<feComposite in="spread" in2="inner" operator="out" result="rim"/>` +
  `<feColorMatrix in="rim" type="matrix" values="0 0 0 0 0.55  0 0 0 0 0.45  0 0 0 0 0.36  0 0 0 0.38 0" result="rimTone"/>` +
  `<feTurbulence type="fractalNoise" baseFrequency="0.026" numOctaves="3" seed="23" result="wash"/>` +
  `<feColorMatrix in="wash" type="matrix" values="0.3 0 0 0 0.77  0.3 0 0 0 0.76  0.3 0 0 0 0.74  0 0 0 0 1" result="washTone"/>` +
  `<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="41" result="grain"/>` +
  `<feColorMatrix in="grain" type="matrix" values="0.18 0 0 0 0.88  0.18 0 0 0 0.87  0.18 0 0 0 0.85  0 0 0 0 1" result="grainTone"/>` +
  `<feBlend in="washTone" in2="grainTone" mode="multiply" result="paperTone"/>` +
  `<feBlend in="lifted" in2="paperTone" mode="multiply" result="painted"/>` +
  `<feComposite in="painted" in2="spread" operator="in" result="body"/>` +
  `<feMerge><feMergeNode in="body"/><feMergeNode in="rimTone"/></feMerge>` +
  `</filter>` +
  // Textures in the ink pass: thin dark lines stay dark as ink; everything else (including
  // big dark areas like obsidian, which the wash shows) turns white to cover what's behind.
  `<filter id="codex-tex-ink" color-interpolation-filters="sRGB">` +
  `<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -3 -5.9 -1.1 0 3.2" result="darkness"/>` +
  `<feComposite in="darkness" in2="SourceAlpha" operator="in" result="dark"/>` +
  `<feMorphology in="dark" operator="erode" radius="1.3" result="thinned"/>` +
  `<feMorphology in="thinned" operator="dilate" radius="1.5" result="masses"/>` +
  `<feComposite in="dark" in2="masses" operator="out" result="lines"/>` +
  `<feFlood flood-color="#fff" result="paper"/>` +
  `<feComposite in="paper" in2="SourceAlpha" operator="in" result="cover"/>` +
  `<feMerge><feMergeNode in="cover"/><feMergeNode in="lines"/></feMerge>` +
  `</filter>` +
  `<filter id="codex-ink" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">` +
  `<feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="2" seed="7" result="noise"/>` +
  `<feDisplacementMap in="SourceGraphic" in2="noise" scale="1.4" xChannelSelector="R" yChannelSelector="G" result="drawn"/>` +
  // Lay the drawing on white, then turn darkness into sepia ink: white (front shapes and
  // empty paper) becomes clear, so only the lines remain.
  `<feFlood flood-color="#fff" result="sheet"/>` +
  `<feComposite in="drawn" in2="sheet" operator="over" result="onSheet"/>` +
  `<feColorMatrix in="onSheet" type="matrix" values="0 0 0 0 0.17  0 0 0 0 0.13  0 0 0 0 0.11  -0.33 -0.33 -0.33 0 0.985" result="ink"/>` +
  `<feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="5" result="dry"/>` +
  `<feColorMatrix in="dry" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -1.4 1.85" result="dryMask"/>` +
  `<feComposite in="ink" in2="dryMask" operator="in"/>` +
  `</filter>` +
  `<style>` +
  `.codex-wash [stroke="#2e211a"]{stroke:none}` +
  `.codex-drawing [fill]:not([fill="none"]):not([fill="#2e211a"]){fill:#fff}` +
  `.codex-drawing [stroke]:not([stroke="#2e211a"]):not([stroke="none"]){stroke:#fff}` +
      `</style>`;
// Kept for anything that still asks for the older single-pass filter by name.
const CODEX_WATERCOLOR_FILTER = CODEX_PAINT_DEFS;

function codexPaint(markup) {
  // Painted textures (systems/character-textures.js) show their colors in the wash pass; in
  // the ink pass only their dark outlines are kept, and the rest knocks out the lines behind.
  const inked = markup.includes(" data-tex=\"\"") ? markup.replaceAll(" data-tex=\"\"", " filter=\"url(#codex-tex-ink)\"") : markup;
  return `<g class="codex-wash" filter="url(#codex-wash)"><g transform="translate(0.9 0.7)">${markup}</g></g>` +
    `<g class="codex-drawing" filter="url(#codex-ink)">${inked}</g>`;
}

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

// Held weapons lean forward from the fist, so the blade clears the face the way codex
// warriors carry theirs; long shafts lean less, and bows and guns stay upright.
function codexWeaponTilt(id) {
  const weapon = (typeof WEAPONS !== "undefined" && WEAPONS[id]) || {};
  const base = (typeof WEAPONS !== "undefined" && WEAPONS[weapon.baseId || id]) || weapon;
  const art = base.art || "";
  const icon = base.icon || "sword";
  if (["yumi", "purebow", "arquebus"].includes(art) || icon === "bow" || id === "light-crossbow") return 0;
  if (["halberd", "yari", "flintlance"].includes(art) || icon === "staff" || icon === "spear") return 8;
  return 20;
}

// ---------- The base body ----------
//
// The figure is built like a painted codex figure: one complete body first (both legs, the
// torso, the far arm, and the neck, in the right depth order and sharing one outer ink
// line), then everything worn on it, then what's held in front. Clothes and armor never have
// to redraw skin, and no limb is drawn over the torso it belongs behind.

// One outer ink line around the whole body, so it reads as a single figure.
function codexBody(character, palette) {
  const curvy = character?.appearance?.body === "curvy";
  return codexPainted("body", "base", palette, curvy ? "curvy" : "");
}


// What's worn on the legs is now painted: bare legs come from the base body texture, and a
// suit paints its own legs. Only a suit's sleeve on the far arm is still drawn here
// (the near arm wears its own in front).
function codexLegwear(palette, outfit) {
  const suit = CODEX_SUITS[outfit];
  if (!suit || outfit === "tzitzimitl-clothes") return "";
  return codexTaper([[108.5, 95.5, 5], [112.5, 104.5, 4.5], [116.5, 113.5, 4]], codexShade(suit, -18));
}

// The head is drawn about 12% smaller than it used to be,
// to sit right on the painted base body. It shrinks toward the chin, so the neck still meets it.
const CODEX_HEAD_TRIM = 0.88;

function buildCodexFigureSvg(character, facing = "east") {
  characterTexturesBegin();
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
    codexPainted("back", cosmetics.back || "", palette),
    equipment.cloak ? codexCloak(palette) : "",
    codexTail(palette, race),
    `<g transform="translate(100 88) scale(${CODEX_HEAD_TRIM}) translate(-100 -88)">${head.back}</g>`,
    // 1. The whole body, one piece.
    codexBody(character, palette),
    // 2. What's worn on it: the loincloth or skirt, the garment, armor, collar.
    codexLegwear(palette, outfit),
    codexLoincloth(character, palette, outfit),
    codexTorso(character, palette, hasArmor, outfit),
    // 3. The head, then what's held: the shield in the back hand (its arm, then the shield
    //    over that hand), and in front of both the weapon and the arm that swings it.
    `<g transform="translate(100 88) scale(${(shape.head * CODEX_HEAD_TRIM).toFixed(4)}) translate(-100 -88)">${head.front}</g>`,
    equipment.shield && !character?.iconMode ? codexArm(palette, outfit, false, false) : "",
    equipment.shield && !character?.iconMode ? codexPainted("shield", "shield", palette) : "",
    character?.iconMode || weaponId === "none" ? "" : `<g transform="rotate(${codexWeaponTilt(weaponId)} 135 97) translate(12 0)">${codexPainted("weapon", codexBaseWeaponId(weaponId), palette)}</g>`,
    character?.iconMode ? "" : codexArm(palette, outfit, true, weaponId !== "none")
  ].join("");
  const build = { slight: 0.93, broad: 1.09 }[character?.appearance?.body] || 1;
  const body = `<g transform="translate(100 194) scale(${shape.sx * build} ${shape.sy}) translate(-100 -194)">${layers}</g>`;
  const oriented = west ? `<g transform="translate(200 0) scale(-1 1)">${body}</g>` : body;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">` +
    `<defs>${CODEX_WATERCOLOR_FILTER}${characterTextureDefsMarkup()}` +
    `</defs>` +
    `<ellipse cx="100" cy="193.5" rx="30" ry="3.6" fill="${CODEX_SEPIA}" opacity="0.16"/>` +
    `${codexPaint(oriented)}</svg>`;
}

// A head-and-shoulders portrait: used by the face picker and anywhere a small likeness
// is wanted. Same head as the full figure, without the body, framed on the face.
const codexPortraitCache = new Map();
function codexPortraitUrl(character, faceId) {
  const dressed = codexDressed(character);
  const look = { ...(dressed?.appearance || {}), face: faceId || dressed?.appearance?.face };
  const subject = { ...dressed, appearance: look };
  const key = codexFigureKey(subject, "east") + "|portrait";
  let url = codexPortraitCache.get(key);
  if (url) return url;
  characterTexturesBegin();
  const palette = codexPalette(subject);
  const head = codexHead(subject, palette, false);
  const markup = head.back + codexLimb("M99 80 L100 96", 11, palette.skin) + head.front;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="80 38 48 48" width="128" height="128">` +
    `<defs>${CODEX_WATERCOLOR_FILTER}${characterTextureDefsMarkup()}</defs>${codexPaint(markup)}</svg>`;
  url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  if (codexPortraitCache.size > 200) codexPortraitCache.clear();
  codexPortraitCache.set(key, url);
  return url;
}

function codexFigureKey(character, facing) {
  character = codexDressed(character);
  const appearance = character?.appearance || {};
  const equipment = character?.equipment || {};
  const cosmetics = character?.cosmetics || {};
  return [
    character?.race, appearance.face, appearance.skin, appearance.hair, appearance.hairStyle, appearance.tunic, appearance.trim, appearance.garment,
    appearance.adornment, appearance.headwear, appearance.facePaint, appearance.body, appearance.beard,
    appearance.jewelry, appearance.crest, equipment.weapon, equipment.armor,
    equipment.shield, equipment.cloak, cosmetics.helmet, cosmetics.clothes, cosmetics.back,
    String(facing).endsWith("west") ? "w" : "e", String(facing).startsWith("north") ? "n" : "s"
  ].join("|");
}

// A figure is shown whole or not at all. While one of its paintings is still loading (or
// being colored), the adventurer keeps their last whole picture (say, in the gear they just
// took off, for a moment); someone not yet drawn at all stays empty until every part is in.
// The figures are redrawn as soon as the paintings arrive (characterTexturesLoaded).
const CODEX_EMPTY_FIGURE = "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20200%20200%22%2F%3E";
const codexLastWhole = new Map();

function codexFigureUrl(character, facing = "east") {
  const key = codexFigureKey(character, facing);
  let url = codexFigureCache.get(key);
  if (url) return url;
  codexFigureIncomplete = false;
  url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildCodexFigureSvg(character, facing))}`;
  const who = `${character?.name || ""}|${character?.race || ""}|${facing}`;
  if (codexFigureIncomplete) return codexLastWhole.get(who) || CODEX_EMPTY_FIGURE;
  if (codexFigureCache.size > 400) codexFigureCache.clear();
  codexFigureCache.set(key, url);
  if (codexLastWhole.size > 200) codexLastWhole.clear();
  codexLastWhole.set(who, url);
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
  characterTexturesBegin();
  const filter = () => `<defs>${CODEX_WATERCOLOR_FILTER}${characterTextureDefsMarkup()}</defs>`;
  if (kind === "weapon") {
    const [top, bottom] = codexWeaponExtent(id);
    const centerY = (top + bottom) / 2;
    const size = Math.max(60, (bottom - top) * 0.74 + 34);
    const art = codexPaint(`<g transform="rotate(42 124 ${centerY})">${codexPainted("weapon", codexBaseWeaponId(id), {})}</g>`);
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${124 - size / 2} ${centerY - size / 2} ${size} ${size}" width="160" height="160">${filter()}${art}</svg>`;
  } else if (kind === "back") {
    // Banners are shown on their own, without the wearer.
    const art = codexPaint(codexPainted("back", id, {}));
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="28 0 76 120" width="160" height="160">${filter()}${art}</svg>`;
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
