"use strict";

const GENDERS = ["man", "woman", "other"];
const GARMENT_STYLES = ["woven-tunic", "cotton-wrap", "feather-mantle", "hide-vest"];
const CLOTHING_ADORNMENTS = ["none", "jade-beads", "shell-beads", "feather-trim"];
const HEADWEAR_STYLES = ["none", "feather-band", "cotton-wrap", "jade-circlet"];
const FACE_PAINT_STYLES = ["none", "jade-lines", "terracotta-marks"];
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
    description: "Adaptable and ambitious; humans are at home in Chiltomatlan's busy streets and on the jungle road."
  },
  dwarf: {
    name: "Dwarf", bonuses: { con: 2 }, description: "Sturdy and resolute, with a keen eye for craft and stone.",
    heritages: { hill: { name: "Hill dwarf", bonuses: { wis: 1 } }, mountain: { name: "Mountain dwarf", bonuses: { str: 2 } } }
  },
  elf: {
    name: "Elf", bonuses: { dex: 2 }, description: "An old people with sharp senses and a natural grace.",
    heritages: { high: { name: "High elf", bonuses: { int: 1 } }, wood: { name: "Wood elf", bonuses: { wis: 1 } }, drow: { name: "Drow", bonuses: { cha: 1 } } }
  },
  halfling: {
    name: "Halfling", bonuses: { dex: 2 }, description: "Small, nimble, and courageous in the face of danger.",
    heritages: { lightfoot: { name: "Lightfoot", bonuses: { cha: 1 } }, stout: { name: "Stout", bonuses: { con: 1 } } }
  },
  dragonborn: {
    name: "Dragonborn", bonuses: { str: 2, cha: 1 }, description: "Proud, draconic folk whose scale pattern and crest make each silhouette distinct."
  },
  gnome: {
    name: "Gnome", bonuses: { int: 2 }, description: "Curious and inventive, with a lively spark in their eyes.",
    heritages: { forest: { name: "Forest gnome", bonuses: { dex: 1 } }, rock: { name: "Rock gnome", bonuses: { con: 1 } } }
  },
  "half-elf": {
    name: "Half-elf", bonuses: { cha: 2 }, description: "A versatile blend of human and elven heritage; choose two different abilities for +1."
  },
  "half-orc": {
    name: "Half-orc", bonuses: { str: 2, con: 1 }, description: "Powerful and determined, with tusks and a strong, unmistakable profile."
  },
  tiefling: {
    name: "Tiefling", bonuses: { cha: 2, int: 1 }, description: "A person with an otherworldly legacy, often marked by horns and a tail."
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
  barbarian: { name: "Barbarian", hitDie: 12, attack: "str", weapon: "macuahuitl", armor: ["none", "hide", "scale"], shield: true, weapons: ["dagger", "macuahuitl", "warhammer", "mace", "quarterstaff", "spear", "atlatl", "shortbow", "longbow", "handaxe"], skillCount: 2, skills: ["animal-handling", "athletics", "intimidation", "nature", "perception", "survival"], saves: ["str", "con"], description: "A hardy front-line warrior; d12 hit die and Strength-led weapons." },
  bard: { name: "Bard", hitDie: 8, attack: "dex", weapon: "macuahuitl", armor: ["none", "leather"], shield: false, weapons: ["dagger", "macuahuitl", "mace", "quarterstaff", "spear", "atlatl", "shortbow", "handaxe"], skillCount: 3, skills: Object.keys(SKILLS), saves: ["dex", "cha"], description: "A versatile storyteller; d8 hit die, light armor, and spirit-song magic." },
  cleric: { name: "Cleric", hitDie: 8, attack: "str", weapon: "macuahuitl", armor: ["none", "leather", "hide", "scale"], shield: true, weapons: ["dagger", "macuahuitl", "mace", "quarterstaff", "spear", "atlatl", "shortbow", "handaxe"], skillCount: 2, skills: ["cooking", "history", "insight", "medicine", "persuasion", "religion"], saves: ["wis", "cha"], description: "A faithful champion; d8 hit die, protective armor, and sacred magic." },
  druid: { name: "Druid", hitDie: 8, attack: "dex", weapon: "quarterstaff", armor: ["none", "leather", "hide"], shield: true, weapons: ["dagger", "macuahuitl", "mace", "quarterstaff", "spear", "atlatl", "shortbow", "handaxe"], skillCount: 2, skills: ["arcana", "animal-handling", "cooking", "insight", "medicine", "nature", "perception", "religion", "survival"], saves: ["int", "wis"], description: "A guardian of the wild; d8 hit die, light armor, and green magic." },
  fighter: { name: "Fighter", hitDie: 10, attack: "str", weapon: "macuahuitl", armor: ["none", "leather", "hide", "scale"], shield: true, weapons: ["dagger", "macuahuitl", "warhammer", "mace", "quarterstaff", "spear", "atlatl", "shortbow", "longbow", "handaxe"], skillCount: 2, skills: ["acrobatics", "animal-handling", "athletics", "history", "insight", "intimidation", "perception", "survival"], saves: ["str", "con"], description: "A trained combatant; d10 hit die, broad weapon choice, and strong armor." },
  monk: { name: "Monk", hitDie: 8, attack: "dex", weapon: "quarterstaff", armor: ["none"], shield: false, weapons: ["dagger", "macuahuitl", "mace", "quarterstaff", "spear", "atlatl", "shortbow", "handaxe"], skillCount: 2, skills: ["acrobatics", "athletics", "history", "insight", "religion", "stealth"], saves: ["str", "dex"], description: "A disciplined martial artist; d8 hit die, quick movement, and no armor or shield." },
  paladin: { name: "Paladin", hitDie: 10, attack: "str", weapon: "macuahuitl", armor: ["none", "leather", "hide", "scale"], shield: true, weapons: ["dagger", "macuahuitl", "warhammer", "mace", "quarterstaff", "spear", "atlatl", "shortbow", "longbow", "handaxe"], skillCount: 2, skills: ["athletics", "insight", "intimidation", "medicine", "persuasion", "religion"], saves: ["wis", "cha"], description: "A sworn protector; d10 hit die, strong armor, and sacred magic." },
  ranger: { name: "Ranger", hitDie: 10, attack: "dex", weapon: "atlatl", armor: ["none", "leather", "hide", "scale"], shield: true, weapons: ["dagger", "macuahuitl", "mace", "quarterstaff", "spear", "atlatl", "shortbow", "longbow", "handaxe"], skillCount: 3, skills: ["animal-handling", "athletics", "cooking", "insight", "investigation", "nature", "perception", "stealth", "survival"], saves: ["str", "dex"], description: "A scout at home in the wild; d10 hit die, practical armor, and nature magic." },
  rogue: { name: "Rogue", hitDie: 8, attack: "dex", weapon: "dagger", armor: ["none", "leather", "hide"], shield: false, weapons: ["dagger", "macuahuitl", "mace", "quarterstaff", "spear", "atlatl", "shortbow", "handaxe"], skillCount: 4, skills: ["acrobatics", "athletics", "deception", "insight", "intimidation", "investigation", "perception", "performance", "persuasion", "sleight-of-hand", "stealth"], saves: ["dex", "int"], description: "A resourceful specialist; d8 hit die, light armor, and nimble weapons." },
  sorcerer: { name: "Sorcerer", hitDie: 6, attack: "cha", weapon: "dagger", armor: ["none"], shield: false, weapons: ["dagger", "mace", "quarterstaff", "spear", "atlatl", "shortbow", "handaxe"], skillCount: 2, skills: ["arcana", "deception", "insight", "intimidation", "persuasion", "religion"], saves: ["con", "cha"], description: "A wielder of innate magic; d6 hit die and spirit power drawn from within." },
  warlock: { name: "Warlock", hitDie: 8, attack: "cha", weapon: "dagger", armor: ["none", "leather"], shield: false, weapons: ["dagger", "macuahuitl", "mace", "quarterstaff", "spear", "atlatl", "shortbow", "handaxe"], skillCount: 2, skills: ["arcana", "deception", "history", "intimidation", "investigation", "nature", "religion"], saves: ["wis", "cha"], description: "A pact-bound adventurer; d8 hit die, light armor, and dangerous spirit magic." },
  wizard: { name: "Wizard", hitDie: 6, attack: "int", weapon: "quarterstaff", armor: ["none"], shield: false, weapons: ["dagger", "quarterstaff", "atlatl"], skillCount: 2, skills: ["arcana", "history", "insight", "investigation", "medicine", "religion"], saves: ["int", "wis"], description: "A learned spellcaster; d6 hit die and magic shaped through study." }
};
const BACKGROUNDS = {
  acolyte: { name: "Acolyte", description: "Raised in a temple; guided by faith and ritual.", skills: "Insight, Religion", skillIds: ["insight", "religion"], skillBonus: 1 },
  criminal: { name: "Criminal", description: "Survived by trusting quick hands and quicker instincts.", skills: "Deception, Stealth", skillIds: ["deception", "stealth"], skillBonus: 1 },
  "folk-hero": { name: "Folk Hero", description: "Earned a name by standing up for ordinary people.", skills: "Animal Handling, Survival", skillIds: ["animal-handling", "survival"], skillBonus: 1 },
  noble: { name: "Noble", description: "Born to privilege, family duty, and courtly life.", skills: "History, Persuasion", skillIds: ["history", "persuasion"], skillBonus: 1 },
  sage: { name: "Sage", description: "Spent years studying old lore and hidden truths.", skills: "Arcana, History", skillIds: ["arcana", "history"], skillBonus: 1, spellAttackBonus: 1 },
  soldier: { name: "Soldier", description: "Forged by service, discipline, and the front line.", skills: "Athletics, Intimidation", skillIds: ["athletics", "intimidation"], skillBonus: 1, attackBonus: 1 }
};

const SKIN_TONES = [
  { name: "Warm umber", value: "#9a603c" }, { name: "Copper", value: "#bb8054" },
  { name: "Golden brown", value: "#d2a36d" }, { name: "Olive", value: "#b59b70" },
  { name: "Deep brown", value: "#70442f" }, { name: "Brown", value: "#8e6247" }
];
const HAIR_COLORS = ["#211a17", "#59402b", "#a87a42", "#ebba27", "#8b8d8c"];
