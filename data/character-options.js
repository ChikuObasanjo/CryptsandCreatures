"use strict";

const GENDERS = ["man", "woman", "other"];
const GARMENT_STYLES = ["woven-tunic", "cotton-wrap", "feather-mantle", "hide-vest", "huipil"];
const CLOTHING_ADORNMENTS = ["none", "jade-beads", "shell-beads", "feather-trim"];
const HEADWEAR_STYLES = ["none", "feather-band", "cotton-wrap", "jade-circlet"];
const FACE_PAINT_STYLES = ["none", "jade-lines", "terracotta-marks", "black-band", "gold-dots"];
const FULL_CASTER_CLASSES = new Set(["bard", "cleric", "druid", "sorcerer", "warlock", "wizard"]);
const HALF_CASTER_CLASSES = new Set(["paladin", "ranger"]);
const DEFAULT_CLASS_ARMOR = {
  barbarian: "hide", bard: "leather", cleric: "scale", druid: "hide", fighter: "scale",
  monk: "none", paladin: "scale", ranger: "scale", rogue: "leather", sorcerer: "none",
  warlock: "leather", wizard: "none"
};
const TUNIC_COLORS = ["#28685e", "#9c4935", "#334d78", "#8a7137", "#5d5b59"];

const ABILITIES = [
  ["str", "Strength"], ["dex", "Dexterity"], ["con", "Constitution"],
  ["int", "Intelligence"], ["wis", "Wisdom"], ["cha", "Charisma"]
];
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const POINT_BUY_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
const RACES = {
  human: {
    name: "Human", bonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    description: "People of the maize: farmers, traders, and wanderers who carry Chiltomatlan's market songs down every jungle road."
  },
  dwarf: {
    name: "Dwarf", bonuses: { con: 2 }, description: "Stout stone-cutters from the high quarries who can read a wall's age in its chisel marks and never trust a quiet floor.",
    heritages: { hill: { name: "Hill dwarf", bonuses: { wis: 1 } }, mountain: { name: "Mountain dwarf", bonuses: { str: 2 } } }
  },
  elf: {
    name: "Elf", bonuses: { dex: 2 }, description: "A long-lived people of the cloud forest who keep the old calendars by heart and hear a jaguar before it moves.",
    heritages: { high: { name: "High elf", bonuses: { int: 1 } }, wood: { name: "Wood elf", bonuses: { wis: 1 } }, drow: { name: "Drow", bonuses: { cha: 1 } } }
  },
  halfling: {
    name: "Halfling", bonuses: { dex: 2 }, description: "Small, quick folk from the edges of the milpa, welcome at every hearth and fearless in places too narrow for anyone else.",
    heritages: { lightfoot: { name: "Lightfoot", bonuses: { cha: 1 } }, stout: { name: "Stout", bonuses: { con: 1 } } }
  },
  dragonborn: {
    name: "Dragonborn", bonuses: { str: 2, cha: 1 }, description: "Scaled descendants of the feathered serpent. A family's colors, crest, and horns are its lineage written on the body."
  },
  gnome: {
    name: "Gnome", bonuses: { int: 2 }, description: "Bright-eyed tinkerers and day-count keepers who tally everything, from loom threads to the stars.",
    heritages: { forest: { name: "Forest gnome", bonuses: { dex: 1 } }, rock: { name: "Rock gnome", bonuses: { con: 1 } } }
  },
  "half-elf": {
    name: "Half-elf", bonuses: { cha: 2 }, description: "Children of two peoples, at home among both and fully claimed by neither; choose two different abilities for +1."
  },
  "half-orc": {
    name: "Half-orc", bonuses: { str: 2, con: 1 }, description: "Tusked and broad-shouldered, said to carry a drop of the first world's giants: strong, stubborn, and loyal."
  },
  tiefling: {
    name: "Tiefling", bonuses: { cha: 2, int: 1 }, description: "Marked by a bargain an ancestor struck with the lords of Mictlan, the underworld: horns, a tail, and ember-bright eyes."
  }
};
const SKILLS = {
  acrobatics: "Acrobatics", "animal-handling": "Animal Handling", arcana: "Arcana", athletics: "Athletics",
  cooking: "Cooking", deception: "Deception", history: "History", insight: "Insight", intimidation: "Intimidation",
  investigation: "Investigation", medicine: "Medicine", nature: "Nature", perception: "Perception",
  performance: "Performance", persuasion: "Persuasion", religion: "Religion",
  "sleight-of-hand": "Sleight of Hand", stealth: "Stealth", survival: "Survival"
};
const SKILL_ABILITIES = {
  acrobatics: "dex", "animal-handling": "wis", arcana: "int", athletics: "str",
  cooking: "wis", deception: "cha", history: "int", insight: "wis", intimidation: "cha",
  investigation: "int", medicine: "wis", nature: "int", perception: "wis",
  performance: "cha", persuasion: "cha", religion: "int",
  "sleight-of-hand": "dex", stealth: "dex", survival: "wis"
};
const CLASSES = {
  barbarian: { name: "Barbarian", hitDie: 12, attack: "str", weapon: "macuahuitl", armor: ["none", "hide", "scale"], shield: true, weapons: ["dagger", "macuahuitl", "warhammer", "mace", "quarterstaff", "spear", "atlatl", "shortbow", "longbow", "handaxe"], skillCount: 2, skills: ["animal-handling", "athletics", "intimidation", "nature", "perception", "survival"], saves: ["str", "con"], description: "A war cry and a macuahuitl, first through every door; d12 hit die and Strength-led weapons." },
  bard: { name: "Bard", hitDie: 8, attack: "dex", weapon: "macuahuitl", armor: ["none", "leather"], shield: false, weapons: ["dagger", "macuahuitl", "mace", "quarterstaff", "spear", "atlatl", "shortbow", "handaxe"], skillCount: 3, skills: Object.keys(SKILLS), saves: ["dex", "cha"], description: "A singer of flower-songs whose verses carry real power; d8 hit die, light armor, and song magic." },
  cleric: { name: "Cleric", hitDie: 8, attack: "str", weapon: "macuahuitl", armor: ["none", "leather", "hide", "scale"], shield: true, weapons: ["dagger", "macuahuitl", "mace", "quarterstaff", "spear", "atlatl", "shortbow", "handaxe"], skillCount: 2, skills: ["cooking", "history", "insight", "medicine", "persuasion", "religion"], saves: ["wis", "cha"], description: "A temple priest who carries the gods' favor into the dark; d8 hit die, protective armor, and sacred magic." },
  druid: { name: "Druid", hitDie: 8, attack: "dex", weapon: "quarterstaff", armor: ["none", "leather", "hide"], shield: true, weapons: ["dagger", "macuahuitl", "mace", "quarterstaff", "spear", "atlatl", "shortbow", "handaxe"], skillCount: 2, skills: ["arcana", "animal-handling", "cooking", "insight", "medicine", "nature", "perception", "religion", "survival"], saves: ["int", "wis"], description: "A keeper of milpa and forest who speaks for maize, rain, and beast; d8 hit die, light armor, and green magic." },
  fighter: { name: "Fighter", hitDie: 10, attack: "str", weapon: "macuahuitl", armor: ["none", "leather", "hide", "scale"], shield: true, weapons: ["dagger", "macuahuitl", "warhammer", "mace", "quarterstaff", "spear", "atlatl", "shortbow", "longbow", "handaxe"], skillCount: 2, skills: ["acrobatics", "animal-handling", "athletics", "history", "insight", "intimidation", "perception", "survival"], saves: ["str", "con"], description: "A warrior drilled in the young men's house until every weapon feels familiar; d10 hit die, broad weapon choice, and strong armor." },
  monk: { name: "Monk", hitDie: 8, attack: "dex", weapon: "quarterstaff", armor: ["none"], shield: false, weapons: ["dagger", "macuahuitl", "mace", "quarterstaff", "spear", "atlatl", "shortbow", "handaxe"], skillCount: 2, skills: ["acrobatics", "athletics", "history", "insight", "religion", "stealth"], saves: ["str", "dex"], description: "A fasting penitent who has trained body and breath into a weapon; d8 hit die, quick movement, and no armor or shield." },
  paladin: { name: "Paladin", hitDie: 10, attack: "str", weapon: "macuahuitl", armor: ["none", "leather", "hide", "scale"], shield: true, weapons: ["dagger", "macuahuitl", "warhammer", "mace", "quarterstaff", "spear", "atlatl", "shortbow", "longbow", "handaxe"], skillCount: 2, skills: ["athletics", "insight", "intimidation", "medicine", "persuasion", "religion"], saves: ["wis", "cha"], description: "An oath-bound temple guardian who fights in a god's name; d10 hit die, strong armor, and sacred magic." },
  ranger: { name: "Ranger", hitDie: 10, attack: "dex", weapon: "atlatl", armor: ["none", "leather", "hide", "scale"], shield: true, weapons: ["dagger", "macuahuitl", "mace", "quarterstaff", "spear", "atlatl", "shortbow", "longbow", "handaxe"], skillCount: 3, skills: ["animal-handling", "athletics", "cooking", "insight", "investigation", "nature", "perception", "stealth", "survival"], saves: ["str", "dex"], description: "A jungle tracker who reads broken leaves like a codex; d10 hit die, practical armor, and nature magic." },
  rogue: { name: "Rogue", hitDie: 8, attack: "dex", weapon: "dagger", armor: ["none", "leather", "hide"], shield: false, weapons: ["dagger", "macuahuitl", "mace", "quarterstaff", "spear", "atlatl", "shortbow", "handaxe"], skillCount: 4, skills: ["acrobatics", "athletics", "deception", "insight", "intimidation", "investigation", "perception", "performance", "persuasion", "sleight-of-hand", "stealth"], saves: ["dex", "int"], description: "A market-quick hand who opens what was meant to stay shut; d8 hit die, light armor, and nimble weapons." },
  sorcerer: { name: "Sorcerer", hitDie: 6, attack: "cha", weapon: "dagger", armor: ["none"], shield: false, weapons: ["dagger", "mace", "quarterstaff", "spear", "atlatl", "shortbow", "handaxe"], skillCount: 2, skills: ["arcana", "deception", "insight", "intimidation", "persuasion", "religion"], saves: ["con", "cha"], description: "Born with power that came with the day-sign of their birth; d6 hit die and spirit power drawn from within." },
  warlock: { name: "Warlock", hitDie: 8, attack: "cha", weapon: "dagger", armor: ["none", "leather"], shield: false, weapons: ["dagger", "macuahuitl", "mace", "quarterstaff", "spear", "atlatl", "shortbow", "handaxe"], skillCount: 2, skills: ["arcana", "deception", "history", "intimidation", "investigation", "nature", "religion"], saves: ["wis", "cha"], description: "Bound to a spirit of the night, wielding power borrowed at a price; d8 hit die, light armor, and dangerous spirit magic." },
  wizard: { name: "Wizard", hitDie: 6, attack: "int", weapon: "quarterstaff", armor: ["none"], shield: false, weapons: ["dagger", "quarterstaff", "atlatl"], skillCount: 2, skills: ["arcana", "history", "insight", "investigation", "medicine", "religion"], saves: ["int", "wis"], description: "A tlamatini, a wise one who reads the red and black ink of the codices; d6 hit die and magic shaped through study." }
};
const BACKGROUNDS = {
  acolyte: { name: "Acolyte", description: "Raised sweeping temple steps and tending copal fires, guided by the ritual calendar.", skills: "Insight, Religion", skillIds: ["insight", "religion"], skillBonus: 1 },
  criminal: { name: "Criminal", description: "Lived on the edges of the market, where quick hands outran the judges.", skills: "Deception, Stealth", skillIds: ["deception", "stealth"], skillBonus: 1 },
  "folk-hero": { name: "Folk Hero", description: "Earned a name in the villages by standing up to a tribute collector.", skills: "Animal Handling, Survival", skillIds: ["animal-handling", "survival"], skillBonus: 1 },
  noble: { name: "Noble", description: "Born to a noble house, raised on flower-songs, family histories, and obligations.", skills: "History, Persuasion", skillIds: ["history", "persuasion"], skillBonus: 1 },
  sage: { name: "Sage", description: "Spent years copying codices and arguing over the meaning of old glyphs.", skills: "Arcana, History", skillIds: ["arcana", "history"], skillBonus: 1, spellAttackBonus: 1 },
  soldier: { name: "Soldier", description: "Drilled in the warriors' house and tested on the field of flowery war.", skills: "Athletics, Intimidation", skillIds: ["athletics", "intimidation"], skillBonus: 1, attackBonus: 1 }
};

const SKIN_TONES = [
  { name: "Warm umber", value: "#9a603c" }, { name: "Copper", value: "#bb8054" },
  { name: "Golden brown", value: "#d2a36d" }, { name: "Olive", value: "#b59b70" },
  { name: "Deep brown", value: "#70442f" }, { name: "Brown", value: "#8e6247" }
];
const HAIR_COLORS = ["#211a17", "#59402b", "#a87a42", "#d8c58c", "#8b8d8c"];

// ----- Extended appearance -----
// Every option is cosmetic. Peoples with their own coloring (scales, ember skin, green skin)
// get their own tone lists; everyone else uses SKIN_TONES.
const HAIR_STYLES = ["short", "long", "braids", "crest", "topknot", "shaved-sides", "twin-twists", "bun"];
const BODY_TYPES = ["standard", "slight", "broad", "curvy"];
const BEARD_STYLES = ["none", "tuft", "full"];
const JEWELRY_STYLES = ["ear-spools", "nose-crescent", "labret", "none"];
const RACE_SKIN_TONES = {
  dragonborn: [
    { name: "Jade scales", value: "#3f8a77" }, { name: "Gold scales", value: "#b48a35" },
    { name: "Crimson scales", value: "#a1432f" }, { name: "Obsidian scales", value: "#45424e" },
    { name: "Azure scales", value: "#3d6e9c" }, { name: "Bone scales", value: "#cfc3a2" }
  ],
  tiefling: [
    { name: "Ember red", value: "#a2545c" }, { name: "Violet", value: "#7a4f86" },
    { name: "Ash blue", value: "#5f7488" }, { name: "Dusk rose", value: "#b06e74" },
    { name: "Soot", value: "#4f4450" }
  ],
  "half-orc": [
    { name: "Moss", value: "#71865a" }, { name: "Sage green", value: "#889478" },
    { name: "Olive drab", value: "#7c7a4c" }, { name: "Slate", value: "#66726c" },
    ...SKIN_TONES
  ]
};
// Crest colors replace hair colors for dragonborn.
const CREST_COLORS = [
  { name: "Jade", value: "#2f8f78" }, { name: "Quetzal green", value: "#1f7a4a" },
  { name: "Scarlet", value: "#b5402c" }, { name: "Gold", value: "#d9a334" },
  { name: "Turquoise", value: "#3a9fb0" }
];
const HAIR_COLOR_OPTIONS = [
  { name: "Black", value: "#211a17" }, { name: "Brown", value: "#59402b" }, { name: "Copper", value: "#a87a42" },
  { name: "Pale gold", value: "#d8c58c" }, { name: "Silver", value: "#8b8d8c" }
];
const CREST_STYLES = {
  dragonborn: ["fin", "quetzal-plumes", "swept-horns", "frilled-crown"],
  tiefling: ["curled", "straight", "ram", "nubs"]
};
const APPEARANCE_LABELS = {
  standard: "Standard", slight: "Slight", broad: "Broad", curvy: "Curvy",
  none: "None", tuft: "Chin tuft", full: "Full beard",
  "ear-spools": "Ear spools", "nose-crescent": "Gold nose crescent", labret: "Jade lip plug",
  fin: "Serpent fin", "quetzal-plumes": "Quetzal plumes", "swept-horns": "Swept horns", "frilled-crown": "Frilled crown",
  curled: "Curled horns", straight: "Straight horns", ram: "Ram horns", nubs: "Small nubs",
  short: "Short", long: "Long", braids: "Braids", crest: "Crest", topknot: "Topknot", "shaved-sides": "Shaved sides",
  "twin-twists": "Twin twists", bun: "Low bun"
};

function raceSkinTones(race) {
  return RACE_SKIN_TONES[race] || SKIN_TONES;
}
function raceHairColors(race) {
  return race === "dragonborn" ? CREST_COLORS : HAIR_COLOR_OPTIONS;
}
function defaultAppearanceFor(race) {
  return {
    body: "standard",
    beard: race === "dwarf" ? "full" : "none",
    jewelry: "ear-spools",
    crest: CREST_STYLES[race]?.[0] || "none"
  };
}
// Fill in fields added after a save was made, and clamp race-specific choices.
function normalizeAppearance(appearance, race) {
  if (!appearance || typeof appearance !== "object") return appearance;
  const defaults = defaultAppearanceFor(race);
  if (!BODY_TYPES.includes(appearance.body)) appearance.body = defaults.body;
  if (!BEARD_STYLES.includes(appearance.beard)) appearance.beard = defaults.beard;
  if (!JEWELRY_STYLES.includes(appearance.jewelry)) appearance.jewelry = defaults.jewelry;
  const crests = CREST_STYLES[race] || ["none"];
  if (!crests.includes(appearance.crest)) appearance.crest = crests[0];
  if (!raceSkinTones(race).some((tone) => tone.value === appearance.skin)) appearance.skin = raceSkinTones(race)[0].value;
  if (!raceHairColors(race).some((color) => color.value === appearance.hair)) appearance.hair = raceHairColors(race)[0].value;
  if (!HAIR_STYLES.includes(appearance.hairStyle)) appearance.hairStyle = "short";
  return appearance;
}
