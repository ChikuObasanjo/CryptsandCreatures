"use strict";

function randomInt(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function rollD20({ advantage = false, disadvantage = false } = {}) {
  const mode = advantage === disadvantage ? "normal" : advantage ? "advantage" : "disadvantage";
  const rolls = mode === "normal" ? [randomInt(20)] : [randomInt(20), randomInt(20)];
  const die = mode === "advantage" ? Math.max(...rolls)
    : mode === "disadvantage" ? Math.min(...rolls) : rolls[0];
  return { die, rolls, mode };
}

function rollDice(expression) {
  const match = DICE_PATTERN.exec(expression);
  if (!match) throw new Error(`Unsupported dice expression: ${expression}`);
  const count = Number(match[1]);
  const sides = Number(match[2]);
  const modifier = Number(match[3] || 0);
  const rolls = Array.from({ length: count }, () => randomInt(sides));
  return { total: rolls.reduce((sum, roll) => sum + roll, modifier), rolls, modifier };
}

function abilityModifier(score) {
  return Math.floor((score - 10) / 2);
}

function maxSpellSlots(classId, level = 1) {
  if (FULL_CASTER_CLASSES.has(classId)) return 2 + Math.floor(Math.max(0, level - 1) / 4);
  if (HALF_CASTER_CLASSES.has(classId) && level >= 2) return 1 + Math.floor((level - 2) / 5);
  return 0;
}

function hasSpellcasting(classId, level = 1) {
  return FULL_CASTER_CLASSES.has(classId) || (HALF_CASTER_CLASSES.has(classId) && level >= 2);
}

function spellcastingAbility(classId) {
  return {
    bard: "cha", cleric: "wis", druid: "wis", paladin: "cha",
    ranger: "wis", sorcerer: "cha", warlock: "cha", wizard: "int"
  }[classId] || null;
}

function spellDamageAtLevel(dice, level) {
  const match = /^(\d+)d(\d+)$/i.exec(dice);
  if (!match) return dice;
  const extraDice = level >= 17 ? 3 : level >= 11 ? 2 : level >= 5 ? 1 : 0;
  const count = Number(match[1]) + extraDice;
  return `${count}d${match[2]}`;
}

function emptyBonuses() {
  return Object.fromEntries(ABILITIES.map(([key]) => [key, 0]));
}

function getRacialBonuses(race, heritage, flexibleOne = "str", flexibleTwo = "dex") {
  const bonuses = { ...emptyBonuses(), ...(RACES[race]?.bonuses || {}) };
  if (RACES[race]?.heritages) Object.assign(bonuses, RACES[race].heritages[heritage]?.bonuses || {});
  if (race === "half-elf") {
    bonuses[flexibleOne] = (bonuses[flexibleOne] || 0) + 1;
    bonuses[flexibleTwo] = (bonuses[flexibleTwo] || 0) + 1;
  }
  return bonuses;
}

function deriveCharacter(character, level = 1) {
  const modifiers = {};
  for (const [key] of ABILITIES) modifiers[key] = abilityModifier(character.scores[key]);
  const weapon = WEAPONS[character.equipment.weapon] || WEAPONS.macuahuitl;
  const armor = ARMORS[character.equipment.armor] || ARMORS.none;
  const equipmentEnhancements = character.equipmentEnhancements || {};
  const weaponEnhancement = equipmentEnhancements.weaponIds?.includes(character.equipment.weapon) ? 1 : 0;
  const armorEnhancement = equipmentEnhancements.armorIds?.includes(character.equipment.armor) ? 1 : 0;
  const con = modifiers.con || 0;
  const hitDie = CLASSES[character.class]?.hitDie || 10;
  const hpPerLevel = Math.max(1, Math.floor(hitDie / 2) + 1 + con);
  const maxHp = Math.max(1, hitDie + con + Math.max(0, level - 1) * hpPerLevel);
  let ac;
  if (character.equipment.armor === "none" && character.class === "monk") ac = 10 + modifiers.dex + modifiers.wis;
  else if (character.equipment.armor === "none" && character.class === "barbarian") ac = 10 + modifiers.dex + con;
  else ac = armor.base + (armor.dex ? Math.min(modifiers.dex, armor.dexCap ?? modifiers.dex) : 0);
  if (character.equipment.shield) ac += 2;
  const attackAbility = weapon.finesse ? Math.max(modifiers.str, modifiers.dex) : weapon.ranged ? modifiers.dex : modifiers.str;
  const proficiencyBonus = 2 + Math.floor(Math.max(0, level - 1) / 4);
  const background = BACKGROUNDS[character.background];
  return {
    modifiers, maxHp: Math.max(1, maxHp), ac: ac + armorEnhancement,
    attackBonus: proficiencyBonus + attackAbility + (background?.attackBonus || 0) + weaponEnhancement,
    damageBonus: attackAbility, damageDice: weapon.dice, weapon
  };
}

function currentCharacterStats() {
  const character = state.run.character || makeLegacyCharacter();
  const stats = deriveCharacter(withNeedsPenalty(character, state.run.needs), state.run.level);
  stats.maxHp = state.run.maxHp;
  return stats;
}

function withNeedsPenalty(character, needs) {
  const penalty = Math.min(4,
    Number((needs?.food ?? 100) < 25) +
    Number((needs?.water ?? 100) < 25) +
    needLevel(needs, "sleep"));
  const deficiencies = nutrientDeficiencies(needs);
  const balanced = hasBalancedNutrition(needs);
  if (!penalty && !deficiencies.length && !balanced) return character;
  const scores = Object.fromEntries(ABILITIES.map(([key]) => [key, Math.max(1, character.scores[key] - penalty)]));
  for (const nutrient of deficiencies) {
    const ability = NUTRIENT_ABILITIES[nutrient];
    scores[ability] = Math.max(1, scores[ability] - 2);
  }
  if (balanced) scores.con = Math.min(20, scores.con + 2);
  return {
    ...character,
    scores
  };
}

function needLevel(needs, type) {
  if (type === "food") return (needs?.food ?? 100) < 25 ? 1 : 0;
  if (type === "water") return (needs?.water ?? 100) < 25 ? 1 : 0;
  return Math.min(3, Math.floor((needs?.hoursAwake || 0) / 12));
}

function createNeeds() {
  return {
    food: 100,
    water: 100,
    waterZeroHours: 0,
    hoursAwake: 0,
    nutrition: { protein: 50, carbohydrates: 50, greens: 50 },
    nutritionHours: 0
  };
}

function upgradeNeeds(needs) {
  if (!needs || typeof needs !== "object") return;
  if (needs.food === undefined) {
    needs.food = Math.max(0, 100 - (needs.hoursWithoutFood || 0) * FOOD_DRAIN_PER_HOUR);
  }
  if (needs.water === undefined) {
    const hoursWithoutWater = needs.hoursWithoutWater || 0;
    needs.water = Math.max(0, 100 - hoursWithoutWater * WATER_DRAIN_PER_HOUR);
    needs.waterZeroHours = Math.max(0, hoursWithoutWater - Math.ceil(100 / WATER_DRAIN_PER_HOUR) + 1);
  }
  if (needs.waterZeroHours === undefined) needs.waterZeroHours = 0;
  if (needs.nutrition === undefined) {
    needs.nutrition = { protein: 50, carbohydrates: 50, greens: 50 };
    if (FOOD_ITEMS[needs.mealBuff]) {
      for (const nutrient of Object.keys(NUTRIENT_NAMES)) {
        needs.nutrition[nutrient] = Math.min(100, needs.nutrition[nutrient] + FOOD_ITEMS[needs.mealBuff].nutrients[nutrient]);
      }
    }
  }
  if (needs.nutritionHours === undefined) needs.nutritionHours = 0;
  delete needs.hoursWithoutFood;
  delete needs.hoursWithoutWater;
  delete needs.mealBuff;
}

function applyMeal(needs, itemId) {
  const meal = FOOD_ITEMS[itemId];
  if (!meal) return;
  needs.food = Math.min(100, (needs.food ?? 100) + meal.food);
  for (const nutrient of Object.keys(NUTRIENT_NAMES)) {
    needs.nutrition[nutrient] = Math.min(100, needs.nutrition[nutrient] + meal.nutrients[nutrient]);
  }
}

function drinkWater(needs) {
  needs.water = Math.min(100, (needs.water ?? 100) + 70);
  needs.waterZeroHours = 0;
}

function nutrientDeficiencies(needs) {
  const levels = Object.fromEntries(Object.keys(NUTRIENT_NAMES).map((nutrient) =>
    [nutrient, needs?.nutrition?.[nutrient] ?? 50]));
  const average = Object.values(levels).reduce((sum, value) => sum + value, 0) / Object.keys(levels).length;
  const imbalance = Math.max(...Object.values(levels)) - Math.min(...Object.values(levels)) > 30;
  return Object.keys(NUTRIENT_NAMES).filter((nutrient) =>
    levels[nutrient] < 20 || (imbalance && levels[nutrient] < average - 15));
}

function hasBalancedNutrition(needs) {
  const levels = Object.keys(NUTRIENT_NAMES).map((nutrient) => needs?.nutrition?.[nutrient] ?? 50);
  return Math.min(...levels) >= 40 && Math.max(...levels) - Math.min(...levels) <= 20;
}

function nutritionStatus(needs) {
  const deficiencies = nutrientDeficiencies(needs);
  if (deficiencies.length) return {
    label: `Low ${deficiencies.map((nutrient) => NUTRIENT_NAMES[nutrient].toLowerCase()).join(", ")}`,
    detail: `${deficiencies.map((nutrient) => `${NUTRIENT_NAMES[nutrient]} deficiency lowers ${ABILITIES.find(([key]) => key === NUTRIENT_ABILITIES[nutrient])[1]}`).join("; ")}`
  };
  if (hasBalancedNutrition(needs)) return {
    label: "Balanced diet",
    detail: "Balanced nutrition grants +1 to skill checks and +2 Constitution."
  };
  return { label: "Nutrition stable", detail: "Vary meals to maintain balanced nutrition." };
}

function canHeal(needs = state.run.needs) {
  return (needs?.food ?? 100) >= HEALING_FOOD_THRESHOLD;
}

function partyMembers() {
  const hero = {
    id: "player",
    name: state.run.character.name,
    class: state.run.character.class,
    background: state.run.character.background,
    scores: state.run.character.scores,
    equipment: state.run.character.equipment,
    skills: [...new Set([
      ...(BACKGROUNDS[state.run.character.background]?.skillIds || []),
      ...(state.run.character.classSkills || [])
    ])],
    needs: state.run.needs,
    hp: state.run.hp,
    maxHp: state.run.maxHp,
    hero: true
  };
  return [hero, ...state.run.party];
}

function companionStats(companion) {
  const stats = deriveCharacter(withNeedsPenalty(companion, companion.needs), state.run.level);
  stats.maxHp = companion.maxHp;
  return stats;
}

function bestPartySkillBonus(skill) {
  const ability = SKILL_ABILITIES[skill];
  return Math.max(...partyMembers().map((member) => {
    const trained = member.skills.includes(skill);
    const proficiency = trained ? 2 + Math.floor(Math.max(0, state.run.level - 1) / 4) : 0;
    const adjusted = withNeedsPenalty(member, member.needs);
    const background = member.hero ? BACKGROUNDS[member.background] : null;
    const backgroundSkillBonus = background?.skillIds.includes(skill) ? background.skillBonus || 0 : 0;
    const wardenBonus = member.hero && factionMember("road-wardens") &&
      ["perception", "survival"].includes(skill)
      ? wardenFieldcraftBonus() : 0;
    return abilityModifier(adjusted.scores[ability]) + proficiency +
      Number(hasBalancedNutrition(member.needs)) +
      (member.hero ? inventorySkillBonus(skill) : 0) + wardenBonus + backgroundSkillBonus;
  }));
}

function makeLegacyCharacter() {
  return {
    legacy: true, name: "Wayfarer", gender: "other", race: "human", heritage: "", class: "fighter", background: "folk-hero",
    scoreMethod: "standard", baseScores: { str: 14, dex: 12, con: 14, int: 10, wis: 12, cha: 10 },
    scores: { str: 14, dex: 12, con: 14, int: 10, wis: 12, cha: 10 },
    appearance: { skin: "#9a603c", hair: "#211a17", hairStyle: "short", tunic: "#334d78", garment: "woven-tunic", adornment: "none", headwear: "feather-band" },
    cosmetics: { owned: [], helmet: null, clothes: null },
    equipment: { weapon: "macuahuitl", armor: "scale", shield: false, cloak: false }
  };
}

function createOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.dataset.i18n = label;
  option.textContent = window.cryptsLocale.t(label);
  return option;
}

function fillSelect(select, entries, selected) {
  select.replaceChildren(...entries.map(([value, label]) => createOption(value, label)));
  if (entries.some(([value]) => value === selected)) select.value = selected;
}

function selectedScores() {
  const method = elements["score-method"].value;
  const scores = {};
  const values = [...elements["ability-score-fields"].querySelectorAll("select")];
  if (values.length !== ABILITIES.length) throw new Error("Choose a score for all six abilities.");
  if (method === "rolled") {
    const indexes = values.map((select) => Number(select.value));
    if (new Set(indexes).size !== ABILITIES.length || indexes.some((index) => !Number.isInteger(index) || !state.scoreRolls[index])) {
      throw new Error("Assign each rolled score once.");
    }
    ABILITIES.forEach(([key], index) => { scores[key] = state.scoreRolls[indexes[index]]; });
  } else {
    const bases = values.map((select) => Number(select.value));
    if (bases.some((value) => !Number.isInteger(value) || value < 8 || value > 15)) throw new Error("Set each ability score between 8 and 15.");
    if (method === "standard" && (bases.length !== STANDARD_ARRAY.length || [...bases].sort((a, b) => b - a).some((value, index) => value !== STANDARD_ARRAY[index]))) {
      throw new Error("Use each suggested score once. Change the method if you'd rather set scores freely.");
    }
    if (method === "point-buy" && bases.reduce((total, value) => total + POINT_BUY_COST[value], 0) !== 27) {
      throw new Error("Use all 27 points to customize your abilities.");
    }
    ABILITIES.forEach(([key], index) => { scores[key] = bases[index]; });
  }
  return scores;
}

function swapDuplicateAbilityAssignment(event) {
  const selected = event.target.closest("#ability-score-fields select");
  if (!selected || elements["score-method"].value === "point-buy") return;
  const previousValue = selected.dataset.assignedValue;
  const other = [...elements["ability-score-fields"].querySelectorAll("select")]
    .find((input) => input !== selected && input.value === selected.value);
  if (other) {
    other.value = previousValue;
    other.dataset.assignedValue = other.value;
  }
  selected.dataset.assignedValue = selected.value;
  updateCharacterPreview();
}

function currentDraftCharacter() {
  const race = elements["character-race"].value;
  const heritage = elements["character-heritage"].value;
  const baseScores = selectedScores();
  const bonuses = getRacialBonuses(race, heritage, elements["half-elf-bonus-one"].value, elements["half-elf-bonus-two"].value);
  const scores = Object.fromEntries(ABILITIES.map(([key]) => [key, Math.min(20, baseScores[key] + bonuses[key])]));
  return {
    name: elements["character-name"].value.trim() || "Iztli",
    gender: elements["character-gender"].value,
    race, heritage, class: elements["character-class"].value,
    background: elements["character-background"].value,
    classSkills: [...elements["class-skill-choices"].querySelectorAll("input:checked")].map((input) => input.value),
    flexibleBonuses: race === "half-elf" ? [elements["half-elf-bonus-one"].value, elements["half-elf-bonus-two"].value] : [],
    scoreMethod: elements["score-method"].value,
    baseScores,
    rolledScores: elements["score-method"].value === "rolled" ? [...state.scoreRolls] : [],
    scores,
    appearance: {
      skin: elements["character-skin"].value,
      hair: elements["character-hair"].value,
      hairStyle: elements["character-hair-style"].value,
      tunic: elements["character-tunic"].value,
      garment: elements["character-garment"].value,
      adornment: elements["character-adornment"].value,
      headwear: elements["character-headwear"].value,
      facePaint: elements["character-face-paint"].value
    },
    equipment: {
      weapon: elements["character-weapon"].value,
      armor: elements["character-armor"].value,
      shield: elements["character-shield"].value === "yes",
      cloak: elements["character-cloak"].value === "yes"
    },
    cosmetics: { owned: [], helmet: null, clothes: null },
    equipmentEnhancements: { weaponIds: [], armorIds: [] }
  };
}

const CHARACTER_FACINGS = [
  "north", "northeast", "east", "southeast",
  "south", "southwest", "west", "northwest"
];
const CHARACTER_RACES = [
  "human", "dwarf", "elf", "halfling", "dragonborn", "gnome", "half-elf", "half-orc", "tiefling"
];
const PLAYER_RACE_COLORS = {
  human: null,
  dwarf: { hair: "#5c3229", hairLight: "#99543a" },
  elf: null,
  halfling: null,
  dragonborn: { skin: "#3e8277", skinLight: "#71b49a", skinDark: "#28584f" },
  gnome: null,
  "half-elf": null,
  "half-orc": { skin: "#6e8052", skinLight: "#a5ae70", skinDark: "#46583b" },
  tiefling: { skin: "#98565c", skinLight: "#cf7a70", skinDark: "#653a51" }
};

function adjustHexColor(hex, amount) {
  const value = Number.parseInt(hex.slice(1), 16);
  const channels = [value >> 16, (value >> 8) & 255, value & 255]
    .map((channel) => Math.max(0, Math.min(255, channel + amount)));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function drawCodexCharacter(context, character, facing) {
  const appearance = character?.appearance || makeLegacyCharacter().appearance;
  const equipment = character?.equipment || {};
  const race = CHARACTER_RACES.includes(character?.race) ? character.race : "human";
  const cosmetics = character?.cosmetics || {};
  const outfitId = cosmetics.clothes || "";
  const outfitColors = {
    "jaguar-clothes": { cloth: "#c59636", clothLight: "#e8c866", armor: "#403027", red: "#4c3028", gold: "#f1d17a", jade: "#54483a" },
    "eagle-clothes": { cloth: "#347d72", clothLight: "#73b7a0", armor: "#d9d0ae", red: "#a84d38", gold: "#e3c566", jade: "#8bd0ae" },
    "tzitzimitl-clothes": { cloth: "#33254f", clothLight: "#654878", armor: "#ded7c6", red: "#a64456", gold: "#d9bd76", jade: "#8f79ba" }
  };
  const colors = {
    outline: "#39251f",
    shadow: "#54372c",
    skin: appearance.skin || "#9a603c",
    skinLight: adjustHexColor(appearance.skin || "#9a603c", 38),
    skinDark: adjustHexColor(appearance.skin || "#9a603c", -36),
    hair: appearance.hair || "#211a17",
    hairLight: adjustHexColor(appearance.hair || "#211a17", 36),
    cloth: appearance.tunic || "#334d78",
    clothLight: adjustHexColor(appearance.tunic || "#334d78", 44),
    red: "#b94d37",
    cream: "#f0d39a",
    gold: "#d6a64f",
    jade: "#63a78a",
    boot: "#56382c",
    armor: equipment.armor === "scale" ? "#8e927d" : equipment.armor === "chainmail" ? "#a6aa9a" : "#76533c"
  };
  Object.assign(colors, outfitColors[outfitId] || {});
  Object.assign(colors, PLAYER_RACE_COLORS[race] || {});
  if (race === "dwarf") {
    colors.skinDark = "#754833";
    colors.skinLight = "#d19669";
  }

  const pixel = (x, y, width, height, color) => {
    context.fillStyle = color;
    context.fillRect(x, y, width, height);
  };
  const row = (y, x, width, color) => pixel(x, y, width, 1, color);
  const north = facing.startsWith("north");
  const flip = facing.endsWith("west");
  context.clearRect(0, 0, 32, 40);
  context.imageSmoothingEnabled = false;
  if (flip) {
    context.save();
    context.translate(32, 0);
    context.scale(-1, 1);
  }

  if (equipment.cloak) {
    pixel(8, 13, 16, 16, colors.red);
    pixel(9, 15, 14, 13, colors.cloth);
    row(27, 9, 14, colors.gold);
  }
  if (race === "dragonborn") {
    pixel(17, 29, 9, 2, colors.skinDark);
    pixel(23, 30, 5, 2, colors.skin);
    pixel(26, 31, 3, 2, colors.skinDark);
  } else if (race === "tiefling") {
    pixel(17, 30, 7, 2, colors.red);
    pixel(23, 31, 5, 2, colors.red);
    pixel(26, 30, 2, 2, colors.gold);
  }

  pixel(10, 27, 5, 8, colors.skinDark);
  pixel(17, 27, 5, 8, colors.skinDark);
  pixel(9, 34, 7, 3, colors.boot);
  pixel(16, 34, 7, 3, colors.boot);
  pixel(10, 28, 4, 5, colors.skin);
  pixel(17, 28, 4, 5, colors.skin);
  pixel(10, 33, 5, 1, colors.gold);
  pixel(17, 33, 5, 1, colors.gold);
  pixel(9, 36, 7, 2, colors.outline);
  pixel(16, 36, 7, 2, colors.outline);

  pixel(8, 15, 16, 13, colors.outline);
  pixel(9, 16, 14, 11, colors.cloth);
  pixel(10, 17, 12, 8, colors.clothLight);
  pixel(9, 25, 14, 2, colors.red);
  pixel(10, 26, 12, 1, colors.gold);
  pixel(9, 16, 2, 9, colors.red);
  pixel(21, 16, 2, 9, colors.red);
  pixel(11, 17, 1, 8, colors.cream);
  pixel(19, 17, 1, 8, colors.cream);
  pixel(12, 18, 2, 2, colors.red);
  pixel(16, 18, 2, 2, colors.red);
  pixel(14, 20, 2, 2, colors.red);
  pixel(12, 22, 2, 2, colors.red);
  pixel(16, 22, 2, 2, colors.red);
  pixel(12, 19, 1, 1, colors.gold);
  pixel(17, 19, 1, 1, colors.gold);
  pixel(14, 21, 2, 1, colors.gold);
  pixel(12, 23, 1, 1, colors.gold);
  pixel(17, 23, 1, 1, colors.gold);
  pixel(14, 23, 4, 1, colors.cream);

  pixel(6, 17, 4, 8, colors.skinDark);
  pixel(7, 18, 3, 6, colors.skin);
  pixel(22, 17, 4, 8, colors.skinDark);
  pixel(23, 18, 3, 6, colors.skin);
  pixel(7, 23, 4, 3, colors.gold);
  pixel(22, 23, 4, 3, colors.gold);

  pixel(11, 5, 10, 11, colors.outline);
  pixel(12, 5, 8, 10, colors.skin);
  pixel(12, 7, 8, 1, colors.skinLight);
  pixel(12, 12, 8, 2, colors.skinDark);
  if (!north) {
    pixel(12, 9, 2, 2, "#f0d39a");
    pixel(17, 9, 2, 2, "#f0d39a");
    pixel(13, 9, 1, 2, colors.outline);
    pixel(18, 9, 1, 2, colors.outline);
    pixel(15, 11, 2, 1, colors.outline);
  } else {
    pixel(12, 8, 8, 5, colors.hair);
  }

  const hairStyle = appearance.hairStyle || "short";
  if (race !== "dragonborn") {
    pixel(10, 4, 12, 4, colors.hair);
    pixel(11, 3, 9, 2, colors.hairLight);
    if (hairStyle === "long" || hairStyle === "braids") {
      pixel(10, 7, 2, 9, colors.hair);
      pixel(20, 7, 2, 9, colors.hair);
    }
    if (hairStyle === "braids") {
      pixel(9, 12, 2, 8, colors.hairLight);
      pixel(21, 12, 2, 8, colors.hairLight);
      pixel(9, 19, 2, 2, colors.gold);
      pixel(21, 19, 2, 2, colors.gold);
    } else if (hairStyle === "crest") {
      pixel(14, 1, 4, 3, colors.hairLight);
    } else if (hairStyle === "topknot") {
      pixel(14, 1, 4, 3, colors.hair);
      pixel(15, 0, 2, 2, colors.hairLight);
    } else if (hairStyle === "shaved-sides") {
      pixel(10, 7, 2, 3, colors.skinDark);
      pixel(20, 7, 2, 3, colors.skinDark);
    }
  } else {
    pixel(13, 2, 6, 5, colors.skinDark);
    pixel(14, 0, 4, 5, colors.jade);
    pixel(15, 1, 2, 3, colors.cream);
  }

  if (race === "elf") {
    pixel(9, 6, 4, 3, colors.skin);
    pixel(9, 5, 3, 2, colors.skinLight);
    pixel(19, 6, 4, 3, colors.skin);
    pixel(20, 5, 3, 2, colors.skinLight);
  } else if (race === "half-elf") {
    pixel(9, 6, 3, 2, colors.skin);
    pixel(9, 5, 2, 2, colors.skinLight);
    pixel(20, 6, 3, 2, colors.skin);
    pixel(21, 5, 2, 2, colors.skinLight);
  } else if (race === "half-orc") {
    pixel(9, 11, 2, 3, colors.skinDark);
    pixel(21, 11, 2, 3, colors.skinDark);
    pixel(13, 13, 2, 3, colors.cream);
    pixel(17, 13, 2, 3, colors.cream);
  } else if (race === "dwarf") {
    pixel(11, 11, 10, 4, colors.hair);
    pixel(12, 14, 8, 3, colors.hairLight);
    pixel(13, 15, 6, 2, colors.cream);
  } else if (race === "halfling") {
    pixel(10, 6, 2, 2, colors.hairLight);
    pixel(12, 4, 2, 2, colors.hairLight);
    pixel(18, 4, 2, 2, colors.hairLight);
    pixel(20, 6, 2, 2, colors.hairLight);
    pixel(11, 11, 2, 2, "#d78a6b");
    pixel(19, 11, 2, 2, "#d78a6b");
  } else if (race === "gnome") {
    pixel(11, 3, 2, 2, colors.jade);
    pixel(13, 1, 2, 3, colors.jade);
    pixel(15, 0, 2, 3, colors.cream);
    pixel(17, 1, 2, 3, colors.jade);
    pixel(19, 3, 2, 2, colors.jade);
    pixel(14, 10, 4, 2, colors.skinLight);
  } else if (race === "dragonborn") {
    pixel(9, 8, 4, 4, colors.skin);
    pixel(10, 7, 3, 4, colors.skinLight);
    pixel(19, 8, 4, 4, colors.skin);
    pixel(19, 7, 3, 4, colors.skinLight);
    pixel(11, 11, 2, 2, colors.skinDark);
    pixel(19, 11, 2, 2, colors.skinDark);
  } else if (race === "tiefling") {
    pixel(11, 3, 2, 4, colors.red);
    pixel(12, 1, 2, 3, colors.red);
    pixel(19, 3, 2, 4, colors.red);
    pixel(18, 1, 2, 3, colors.red);
    pixel(11, 1, 2, 1, colors.gold);
    pixel(19, 1, 2, 1, colors.gold);
  }

  if (race === "dragonborn") {
    pixel(12, 12, 2, 1, colors.cream);
    pixel(18, 12, 2, 1, colors.cream);
    pixel(13, 14, 1, 1, colors.skinLight);
    pixel(18, 14, 1, 1, colors.skinLight);
  }
  if (equipment.armor && equipment.armor !== "none") {
    pixel(9, 16, 14, 3, colors.armor);
    pixel(10, 16, 12, 1, colors.gold);
    if (equipment.armor === "scale" || equipment.armor === "chainmail") {
      for (let x = 11; x < 21; x += 3) {
        row(19, x, 2, colors.cream);
        row(22, x, 2, colors.cream);
      }
    }
    pixel(10, 25, 12, 1, colors.gold);
  }
  if (outfitId === "jaguar-clothes") {
    pixel(9, 16, 14, 10, "#403027");
    pixel(10, 17, 12, 8, "#c59636");
    pixel(10, 17, 12, 2, "#e8c866");
    for (const [x, y] of [[12, 20], [17, 19], [14, 23], [19, 24]]) {
      pixel(x, y, 2, 1, "#30231f");
      pixel(x, y + 1, 1, 1, "#f1d17a");
    }
    pixel(8, 17, 3, 4, "#403027");
    pixel(21, 17, 3, 4, "#403027");
    pixel(9, 25, 14, 2, "#30231f");
  } else if (outfitId === "eagle-clothes") {
    pixel(9, 16, 14, 10, "#d9d0ae");
    pixel(10, 17, 12, 8, "#347d72");
    pixel(10, 17, 12, 2, "#73b7a0");
    for (let x = 8; x <= 22; x += 2) pixel(x, 18 + (x % 3), 2, 4, "#f3e7c6");
    pixel(14, 19, 4, 5, "#e3c566");
    pixel(15, 20, 2, 3, "#a84d38");
    pixel(9, 25, 14, 2, "#d9d0ae");
  } else if (outfitId === "tzitzimitl-clothes") {
    pixel(9, 16, 14, 10, "#ded7c6");
    pixel(10, 17, 12, 8, "#33254f");
    pixel(10, 17, 12, 2, "#654878");
    pixel(11, 19, 2, 5, "#ded7c6");
    pixel(19, 19, 2, 5, "#ded7c6");
    pixel(14, 18, 4, 7, "#a64456");
    pixel(15, 19, 2, 5, "#d9bd76");
    pixel(9, 25, 14, 2, "#ded7c6");
    for (const [x, y] of [[11, 18], [19, 18], [13, 24], [18, 24]]) pixel(x, y, 1, 1, "#d9bd76");
  }

  if (appearance.headwear === "feather-band") {
    pixel(10, 4, 12, 2, colors.red);
    pixel(11, 4, 10, 1, colors.gold);
    pixel(19, 2, 2, 3, colors.jade);
    pixel(21, 0, 2, 4, colors.cream);
    pixel(23, 2, 1, 3, colors.red);
  } else if (appearance.headwear === "cotton-wrap") {
    pixel(10, 3, 12, 4, colors.cream);
    pixel(12, 3, 8, 1, colors.red);
    pixel(19, 5, 3, 3, colors.red);
  } else if (appearance.headwear === "jade-circlet") {
    pixel(10, 5, 12, 1, colors.gold);
    pixel(15, 4, 3, 2, colors.jade);
  }
  if (cosmetics.helmet === "jaguar-helmet") {
    pixel(9, 4, 14, 5, "#403027");
    pixel(11, 4, 10, 3, "#c59636");
    pixel(12, 5, 2, 1, "#30231f");
    pixel(18, 5, 2, 1, "#30231f");
    pixel(9, 5, 3, 3, "#b17b2e");
    pixel(20, 5, 3, 3, "#b17b2e");
    pixel(14, 7, 4, 2, "#f1d17a");
    pixel(15, 8, 2, 1, "#403027");
  } else if (cosmetics.helmet === "eagle-helmet") {
    pixel(9, 5, 14, 4, "#d9d0ae");
    pixel(11, 4, 10, 3, "#347d72");
    pixel(13, 1, 3, 5, "#f3e7c6");
    pixel(16, 0, 3, 6, "#e3c566");
    pixel(19, 2, 3, 5, "#a84d38");
    pixel(14, 6, 5, 2, "#e3c566");
  } else if (cosmetics.helmet === "tzitzimitl-helmet") {
    pixel(9, 5, 14, 5, "#ded7c6");
    pixel(11, 4, 10, 3, "#33254f");
    pixel(10, 5, 2, 3, "#ded7c6");
    pixel(20, 5, 2, 3, "#ded7c6");
    pixel(9, 4, 2, 1, "#a64456");
    pixel(8, 2, 2, 3, "#ded7c6");
    pixel(6, 0, 2, 3, "#a64456");
    pixel(21, 4, 2, 1, "#a64456");
    pixel(23, 2, 2, 3, "#ded7c6");
    pixel(25, 0, 2, 3, "#a64456");
    pixel(14, 5, 4, 2, "#d9bd76");
  }

  if (appearance.adornment === "jade-beads") {
    pixel(10, 16, 2, 7, colors.jade);
    pixel(20, 16, 2, 7, colors.jade);
  } else if (appearance.adornment === "shell-beads") {
    pixel(11, 16, 2, 7, colors.cream);
    pixel(19, 16, 2, 7, colors.cream);
  } else if (appearance.adornment === "feather-trim") {
    pixel(8, 16, 2, 7, colors.jade);
    pixel(22, 16, 2, 7, colors.red);
  }

  if (appearance.facePaint === "jade-lines") {
    pixel(11, 10, 1, 3, colors.jade);
    pixel(20, 10, 1, 3, colors.jade);
  } else if (appearance.facePaint === "terracotta-marks") {
    pixel(11, 10, 1, 3, colors.red);
    pixel(20, 10, 1, 3, colors.red);
  }

  if (equipment.shield) {
    pixel(4, 20, 5, 7, colors.outline);
    pixel(5, 21, 3, 5, colors.red);
    pixel(6, 22, 1, 3, colors.gold);
  }
  const weaponId = equipment.weapon || "macuahuitl";
  const weaponIcon = WEAPONS[weaponId]?.icon || "sword";
  if (weaponId === "macuahuitl") {
    pixel(24, 7, 6, 18, colors.outline);
    pixel(25, 8, 4, 15, "#795039");
    pixel(26, 9, 1, 12, "#a87845");
    for (let y = 9; y <= 20; y += 3) {
      const toothY = y + (y % 2);
      pixel(22, toothY, 3, 2, colors.outline);
      pixel(22, toothY, 2, 1, "#9da29a");
      pixel(29, toothY + 1, 3, 2, colors.outline);
      pixel(30, toothY + 1, 2, 1, "#9da29a");
    }
    pixel(25, 23, 4, 11, colors.outline);
    pixel(26, 24, 2, 8, "#795039");
    pixel(26, 26, 2, 1, colors.gold);
    pixel(26, 29, 2, 1, colors.gold);
    pixel(26, 32, 2, 2, "#a87845");
  } else if (weaponId === "atlatl") {
    pixel(23, 14, 4, 21, colors.shadow);
    pixel(24, 15, 2, 18, colors.gold);
    pixel(23, 13, 4, 3, colors.cream);
    pixel(26, 14, 2, 2, colors.outline);
    pixel(24, 22, 2, 3, colors.red);
    pixel(29, 4, 2, 19, colors.shadow);
    pixel(29, 5, 1, 16, colors.gold);
    pixel(28, 3, 3, 2, colors.cream);
    pixel(29, 2, 1, 2, colors.gold);
  } else if (weaponIcon === "spear" || weaponIcon === "staff") {
    pixel(25, 3, 2, 31, colors.shadow);
    pixel(25, 3, 1, 31, colors.gold);
    pixel(24, 3, 4, 3, weaponIcon === "spear" ? colors.cream : colors.jade);
    pixel(25, 1, 2, 3, colors.gold);
  } else if (weaponIcon === "bow") {
    pixel(25, 9, 2, 19, colors.shadow);
    pixel(26, 10, 1, 17, colors.gold);
    pixel(26, 12, 1, 13, colors.cream);
  } else {
    pixel(25, 13, 2, 14, colors.shadow);
    pixel(25, 14, 1, 12, colors.gold);
    if (weaponIcon === "axe" || weaponIcon === "hammer" || weaponIcon === "mace") {
      pixel(23, 12, 6, 4, colors.armor);
      pixel(24, 11, 4, 6, colors.gold);
    } else {
      pixel(24, 10, 4, 8, colors.cream);
      pixel(25, 9, 2, 2, colors.gold);
    }
  }
  if (flip) context.restore();
}

function createCodexCharacterSprite(character, className, facing = "south") {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 40;
  canvas.setAttribute("aria-hidden", "true");
  const race = CHARACTER_RACES.includes(character?.race) ? character.race : "human";
  const direction = CHARACTER_FACINGS.includes(facing) ? facing : "south";
  canvas.classList.add(className, `race-${race}`, `facing-${direction}`, "codex-character");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is unavailable for the character sprite.");
  drawCodexCharacter(context, character, direction);
  return canvas;
}

function initializeCharacterBuilder() {
  fillSelect(elements["character-race"], Object.entries(RACES).map(([id, race]) => [id, race.name]), "human");
  fillSelect(elements["character-class"], Object.entries(CLASSES).map(([id, characterClass]) => [id, characterClass.name]), "fighter");
  fillSelect(elements["character-background"], Object.entries(BACKGROUNDS).map(([id, background]) => [id, background.name]), "folk-hero");
  fillSelect(elements["character-skin"], SKIN_TONES.map((tone) => [tone.value, tone.name]), SKIN_TONES[0].value);
  fillSelect(elements["half-elf-bonus-one"], ABILITIES.filter(([key]) => key !== "cha").map(([key, name]) => [key, name]), "str");
  fillSelect(elements["half-elf-bonus-two"], ABILITIES.filter(([key]) => !["cha", "str"].includes(key)).map(([key, name]) => [key, name]), "dex");
  renderAbilityInputs();
  syncHeritageOptions();
  syncEquipmentOptions();
  syncClassSkillOptions([]);
  updateCharacterPreview();
}

function renderAbilityInputs(baseScores = null, rolledScores = null) {
  const method = elements["score-method"].value;
  const fields = document.createDocumentFragment();
  const usedRolls = new Set();
  ABILITIES.forEach(([key, label], index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "ability-score-field";
    const abilityName = document.createElement("span");
    abilityName.className = "ability-score-name";
    abilityName.textContent = label;
    const scoreDisplay = document.createElement("output");
    scoreDisplay.className = "ability-score-value";
    scoreDisplay.dataset.scoreAbility = key;
    const select = document.createElement("select");
    select.dataset.ability = key;
    select.setAttribute("aria-label", method === "rolled" ? `${label} assigned roll` : `${label} base score`);
    if (method === "rolled") {
      const rolls = rolledScores || state.scoreRolls;
      const preferredScore = baseScores?.[key];
      let selectedIndex = rolls.findIndex((score, rollIndex) => score === preferredScore && !usedRolls.has(rollIndex));
      if (selectedIndex < 0) selectedIndex = index;
      usedRolls.add(selectedIndex);
      fillSelect(select, rolls.map((score, rollIndex) => [String(rollIndex), `${score} · roll ${rollIndex + 1}`]), String(selectedIndex));
      if (!rolls.length) select.disabled = true;
    } else {
      const options = method === "standard"
        ? STANDARD_ARRAY.map((score) => [String(score), String(score)])
        : Array.from({ length: 8 }, (_, offset) => {
          const score = offset + 8;
          return [String(score), `${score} · ${POINT_BUY_COST[score]} pt`];
        });
      fillSelect(select, options, String(baseScores?.[key] ?? STANDARD_ARRAY[index]));
    }
    select.dataset.assignedValue = select.value;
    wrapper.append(abilityName, scoreDisplay, select);
    fields.append(wrapper);
  });
  elements["ability-score-fields"].replaceChildren(fields);
  elements["roll-scores"].classList.toggle("hidden", method !== "rolled");
  const primaryAbility = spellcastingAbility(elements["character-class"].value) ||
    CLASSES[elements["character-class"].value]?.attack || "str";
  const primaryAbilityName = ABILITIES.find(([key]) => key === primaryAbility)?.[1] || "Strength";
  elements["score-method-note"].textContent = method === "standard"
    ? "Use each suggested number once. Your people bonuses are added automatically."
    : method === "point-buy"
      ? "Set each ability from 8–15. Use all 27 points; higher numbers cost more."
      : `Your best result favors ${primaryAbilityName} for your role. Change any result and it will swap automatically.`;
  if (elements["character-dialog"].open) setCharacterCreationStep();
}

function rolledAbilityAssignment(rolls, classId) {
  const selectedClass = CLASSES[classId] || CLASSES.fighter;
  const primaryAbility = spellcastingAbility(classId) || selectedClass.attack;
  const priority = [...new Set([primaryAbility, "str", "con", "dex", "wis", "int", "cha"])];
  const orderedScores = [...rolls].sort((a, b) => b - a);
  return Object.fromEntries(priority.map((ability, index) => [ability, orderedScores[index]]));
}

function generateAbilityRolls() {
  return Array.from({ length: 6 }, () => {
    const dice = Array.from({ length: 4 }, () => randomInt(6)).sort((a, b) => a - b);
    return dice[1] + dice[2] + dice[3];
  });
}

function ordinalSuffix(number) {
  return number === 1 ? "st" : number === 2 ? "nd" : number === 3 ? "rd" : "th";
}

function syncHeritageOptions(selected = elements["character-heritage"].value) {
  const race = RACES[elements["character-race"].value];
  const heritages = race?.heritages
    ? Object.entries(race.heritages).map(([id, heritage]) => [id, heritage.name])
    : [["", "—"]];
  fillSelect(elements["character-heritage"], heritages, selected || heritages[0][0]);
  elements["character-heritage"].disabled = !race?.heritages;
  elements["character-heritage"].closest("label").classList.toggle("hidden", !race?.heritages);
  elements["race-description"].textContent = window.cryptsLocale.t(race?.description || "");
  elements["half-elf-bonuses"].classList.toggle("hidden", elements["character-race"].value !== "half-elf");
}

function syncEquipmentOptions(resetToDefaults = false) {
  const selectedClass = CLASSES[elements["character-class"].value] || CLASSES.fighter;
  if (resetToDefaults) {
    elements["character-shield"].value = "no";
    elements["character-cloak"].value = "no";
  }
  const currentWeapon = elements["character-weapon"].value;
  const currentArmor = elements["character-armor"].value;
  const weaponOptions = selectedClass.weapons.map((id) => [id, WEAPONS[id].name]);
  fillSelect(elements["character-weapon"], weaponOptions,
    !resetToDefaults && weaponOptions.some(([id]) => id === currentWeapon) ? currentWeapon : selectedClass.weapon);
  const armorOptions = selectedClass.armor.map((id) => [id, ARMORS[id].name]);
  fillSelect(elements["character-armor"], armorOptions,
    !resetToDefaults && armorOptions.some(([id]) => id === currentArmor) ? currentArmor : DEFAULT_CLASS_ARMOR[elements["character-class"].value]);
  const shieldOption = elements["character-shield"].querySelector('option[value="yes"]');
  shieldOption.disabled = !selectedClass.shield;
  if (!selectedClass.shield) elements["character-shield"].value = "no";
  elements["class-description"].textContent = [
    window.cryptsLocale.t(selectedClass.description).split(";")[0],
    window.cryptsLocale.t("Your role affects starting health and which weapons and armor are available.")
  ].join(". ");
}

function selectedClassSkills() {
  return [...elements["class-skill-choices"].querySelectorAll("input:checked")].map((input) => input.value);
}

function updateClassSkillChoices() {
  const skillCount = CLASSES[elements["character-class"].value]?.skillCount || 0;
  const chosen = selectedClassSkills();
  elements["class-skill-count"].textContent = `${chosen.length} / ${skillCount} chosen`;
  for (const checkbox of elements["class-skill-choices"].querySelectorAll("input")) {
    checkbox.disabled = !checkbox.checked && chosen.length >= skillCount;
  }
}

function syncClassSkillOptions(selected = selectedClassSkills()) {
  const selectedClass = CLASSES[elements["character-class"].value] || CLASSES.fighter;
  const background = BACKGROUNDS[elements["character-background"].value] || BACKGROUNDS["folk-hero"];
  elements["background-description"].textContent = window.cryptsLocale.t(background.description || "");
  const backgroundSkills = new Set(background.skillIds);
  const available = selectedClass.skills.filter((skill) => !backgroundSkills.has(skill));
  const chosen = new Set(selected.filter((skill) => available.includes(skill)).slice(0, selectedClass.skillCount));
  for (const skill of available) {
    if (chosen.size >= selectedClass.skillCount) break;
    chosen.add(skill);
  }

  elements["class-skill-choices"].replaceChildren(...available.map((skill) => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = skill;
    checkbox.checked = chosen.has(skill);
    checkbox.addEventListener("change", () => {
      if (selectedClassSkills().length > selectedClass.skillCount) checkbox.checked = false;
      updateClassSkillChoices();
      updateCharacterPreview();
    });
    const name = document.createElement("span");
    name.textContent = window.cryptsLocale.t(SKILLS[skill]);
    label.append(checkbox, name);
    return label;
  }));
  elements["class-skill-note"].textContent =
    window.cryptsLocale.t("Choose {count} skills. Your background already grants {skills}.", {
      count: selectedClass.skillCount,
      skills: background.skills.split(", ").map((skill) => window.cryptsLocale.t(skill)).join(", ")
    });
  updateClassSkillChoices();
}

function refreshCharacterLocalization() {
  syncHeritageOptions();
  syncEquipmentOptions();
  syncClassSkillOptions();
  updateCharacterPreview();
}

function updateCharacterPreview() {
  const race = elements["character-race"].value || "human";
  const defaultHeritage = Object.keys(RACES[race]?.heritages || {})[0] || "";
  let draft;
  try {
    draft = currentDraftCharacter();
  } catch {
    draft = {
      name: elements["character-name"].value.trim() || "Iztli",
      race,
      heritage: elements["character-heritage"].value || defaultHeritage,
      class: elements["character-class"].value || "fighter",
      background: elements["character-background"].value || "folk-hero",
      scores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
      appearance: {
        skin: elements["character-skin"].value || SKIN_TONES[0].value,
        hair: elements["character-hair"].value || "#211a17",
        hairStyle: elements["character-hair-style"].value || "short",
        tunic: elements["character-tunic"].value || "#334d78",
        garment: elements["character-garment"].value || "woven-tunic",
        adornment: elements["character-adornment"].value || "none",
        headwear: elements["character-headwear"].value || "none",
        facePaint: elements["character-face-paint"].value || "none"
      },
      equipment: {
        weapon: elements["character-weapon"].value || "longsword",
        armor: elements["character-armor"].value || "none",
        shield: elements["character-shield"].value === "yes",
        cloak: elements["character-cloak"].value === "yes"
      }
    };
  }
  const bonuses = getRacialBonuses(race, elements["character-heritage"].value, elements["half-elf-bonus-one"].value, elements["half-elf-bonus-two"].value);
  elements["ability-bonus-note"].textContent = `Your people add: ${ABILITIES.filter(([key]) => bonuses[key]).map(([key, label]) => `${label} +${bonuses[key]}`).join(", ") || "no ability bonuses"}.`;
  for (const select of elements["ability-score-fields"].querySelectorAll("select[data-ability]")) {
    const ability = select.dataset.ability;
    const baseScore = elements["score-method"].value === "rolled"
      ? state.scoreRolls[Number(select.value)]
      : Number(select.value);
    const score = Number.isFinite(baseScore) ? Math.min(20, baseScore + bonuses[ability]) : 0;
    const display = elements["ability-score-fields"].querySelector(`[data-score-ability="${ability}"]`);
    display.textContent = String(score);
    display.classList.toggle("score-low", score < 10);
    display.classList.toggle("score-high", score > 15);
    display.setAttribute("aria-label", `${ABILITIES.find(([key]) => key === ability)[1]} score ${score}`);
  }
  elements["character-preview"].replaceChildren(createCodexCharacterSprite(draft, "preview-sprite"));
  const className = window.cryptsLocale.t(CLASSES[draft.class]?.name || "Adventurer");
  const raceName = window.cryptsLocale.t(RACES[race]?.name || "Traveler");
  const heritageName = RACES[race]?.heritages?.[draft.heritage]?.name;
  const name = draft.name || "Iztli";
  const stats = deriveCharacter(draft);
  const scoresLine = ABILITIES.map(([key]) => `${key.toUpperCase()} ${draft.scores[key]} (${stats.modifiers[key] >= 0 ? "+" : ""}${stats.modifiers[key]})`).join(" · ");
  const background = BACKGROUNDS[draft.background];
  const proficiencies = [...new Set([...(background?.skillIds || []), ...(draft.classSkills || [])])].map((skill) => SKILLS[skill]).join(", ");
  const backgroundBonuses = [
    background?.skillBonus ? `+${background.skillBonus} background skill checks` : "",
    background?.attackBonus ? `+${background.attackBonus} weapon attacks` : "",
    background?.spellAttackBonus ? `+${background.spellAttackBonus} spell attacks` : ""
  ].filter(Boolean).join(", ");
  const savingThrows = (CLASSES[draft.class]?.saves || []).map((key) => key.toUpperCase()).join(", ");
  const gear = `${WEAPONS[draft.equipment.weapon]?.name || "Weapon"} · ${ARMORS[draft.equipment.armor]?.name || "No armor"}${draft.equipment.shield ? ` · ${GEAR_ITEMS.shield.name}` : ""}${draft.equipment.cloak ? ` · ${GEAR_ITEMS["travel-cloak"].name}` : ""}`;
  elements["character-summary"].innerHTML = "";
  const title = document.createElement("strong");
  title.textContent = `${name} · ${window.cryptsLocale.t(heritageName || raceName)} ${className}`;
  const scores = document.createElement("span");
  scores.textContent = scoresLine;
  const detail = document.createElement("span");
  detail.textContent = `${background?.name || "Background"}${backgroundBonuses ? ` (${backgroundBonuses})` : ""} · Skills: ${proficiencies} · Saves: ${savingThrows} · ${stats.maxHp} HP · AC ${stats.ac} · Attack ${stats.attackBonus >= 0 ? "+" : ""}${stats.attackBonus}`;
  const equipment = document.createElement("span");
  equipment.textContent = gear;
  elements["character-summary"].append(title, scores, detail, equipment);
  const selectedClass = CLASSES[draft.class];
  const kitId = CLASS_PACKS[draft.class] || "travel-bundle";
  const kit = GEAR_ITEMS[kitId];
  elements["starter-kit-summary"].textContent =
    `${className} starter set: ${WEAPONS[draft.equipment.weapon]?.name || "Weapon"} · ${ARMORS[draft.equipment.armor]?.name || "No armor"} · ${kit.name}${draft.equipment.shield ? ` · ${GEAR_ITEMS.shield.name}` : ""}${draft.equipment.cloak ? ` · ${GEAR_ITEMS["travel-cloak"].name}` : ""}`;
  const starterWeight = getCarriedWeight(buildStartingInventory(draft), 10);
  const capacity = getCarryCapacity(draft);
  elements["equipment-note"].textContent =
    `${selectedClass?.name || "Your class"} Travel Bundle (${kit.weight} lb) and background skill bonuses are included. Starting load ${formatWeight(starterWeight)} / ${capacity} lb; Strength × 15 lb capacity.`;
  const method = elements["score-method"].value;
  if (method === "point-buy") {
    const scores = [...elements["ability-score-fields"].querySelectorAll("select")].map((select) => Number(select.value));
    const remaining = 27 - scores.reduce((sum, score) => sum + (POINT_BUY_COST[score] || 0), 0);
    elements["point-buy-remaining"].textContent = `${remaining} points remaining`;
    elements["point-buy-remaining"].classList.toggle("score-warning", remaining < 0);
  } else {
    elements["point-buy-remaining"].textContent = "";
  }
}

function rollAbilityScores() {
  state.scoreRolls = generateAbilityRolls();
  const baseScores = rolledAbilityAssignment(state.scoreRolls, elements["character-class"].value);
  renderAbilityInputs(baseScores, state.scoreRolls);
  updateCharacterPreview();
}

function readCharacterFromForm() {
  const name = elements["character-name"].value.trim();
  if (!name || name.length > 24) throw new Error("Enter a character name (1–24 characters).");
  const race = elements["character-race"].value;
  const heritage = elements["character-heritage"].value;
  const selectedClass = CLASSES[elements["character-class"].value];
  const background = elements["character-background"].value;
  if (!RACES[race] || !selectedClass || !BACKGROUNDS[background]) throw new Error("Choose a race, class, and background.");
  if (RACES[race].heritages && !RACES[race].heritages[heritage]) throw new Error("Choose a heritage for your race.");
  if (race === "half-elf" && elements["half-elf-bonus-one"].value === elements["half-elf-bonus-two"].value) throw new Error("Choose two different abilities for your half-elf bonuses.");
  const character = currentDraftCharacter();
  const weapon = WEAPONS[character.equipment.weapon];
  if (!weapon || !selectedClass.weapons.includes(character.equipment.weapon)) throw new Error("Choose a starting weapon trained by this class.");
  if (!ARMORS[character.equipment.armor] || !selectedClass.armor.includes(character.equipment.armor)) throw new Error("Choose armor this class can wear.");
  const armor = ARMORS[character.equipment.armor];
  if (armor.strength && character.scores.str < armor.strength) {
    throw new Error(`Chain mail requires Strength ${armor.strength} or higher.`);
  }
  if (character.equipment.shield && !selectedClass.shield) throw new Error("This class does not start with shield training.");
  const backgroundSkills = new Set(BACKGROUNDS[background].skillIds);
  if (character.classSkills.length !== selectedClass.skillCount ||
    new Set(character.classSkills).size !== character.classSkills.length ||
    character.classSkills.some((skill) => !selectedClass.skills.includes(skill) || backgroundSkills.has(skill))) {
    throw new Error(`Choose ${selectedClass.skillCount} distinct class skills that are not already granted by your background.`);
  }
  character.legacy = false;
  const startingInventory = buildStartingInventory(character);
  const startingLoad = getCarriedWeight(startingInventory, 10);
  const capacity = getCarryCapacity(character);
  if (startingLoad > capacity) {
    throw new Error(`This starting kit weighs ${formatWeight(startingLoad)} lb, above your ${capacity} lb carrying capacity. Raise Strength or choose lighter armor or a different kit.`);
  }
  return character;
}

function openCharacterBuilder() {
  const profile = {
    name: "Iztli", gender: "other", race: "human", heritage: "", class: "fighter", background: "folk-hero",
    scoreMethod: "rolled", baseScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    appearance: { skin: SKIN_TONES[0].value, hair: "#211a17", hairStyle: "short", tunic: "#334d78", garment: "woven-tunic", adornment: "none", headwear: "feather-band" },
    equipment: { weapon: "macuahuitl", armor: "scale", shield: false, cloak: false },
    equipmentEnhancements: { weaponIds: [], armorIds: [] }
  };
  elements["character-error"].textContent = "";
  elements["character-dialog-heading"].textContent = window.cryptsLocale.t("Create your character");
  elements["character-submit"].textContent = window.cryptsLocale.t("Begin adventure");
  elements["new-game-warning"].classList.toggle("hidden", !state.run);
  elements["new-game-warning"].textContent = state.run
    ? window.cryptsLocale.t("Starting a new game will replace {name}'s saved run when you begin.", { name: state.run.character.name })
    : "";
  elements["character-name"].value = profile.name || "Iztli";
  elements["character-gender"].value = GENDERS.includes(profile.gender) ? profile.gender : "other";
  elements["character-race"].value = profile.race || "human";
  syncHeritageOptions(profile.heritage);
  elements["character-class"].value = CLASSES[profile.class] ? profile.class : "fighter";
  elements["character-background"].value = BACKGROUNDS[profile.background] ? profile.background : "folk-hero";
  elements["half-elf-bonus-one"].value = profile.flexibleBonuses?.[0] || "str";
  elements["half-elf-bonus-two"].value = profile.flexibleBonuses?.[1] || "dex";
  elements["score-method"].value = profile.legacy ? "standard" : ["standard", "point-buy", "rolled"].includes(profile.scoreMethod) ? profile.scoreMethod : "rolled";
  state.scoreRolls = Array.isArray(profile.rolledScores) ? [...profile.rolledScores] : [];
  if (elements["score-method"].value === "rolled" && state.scoreRolls.length !== 6) {
    state.scoreRolls = generateAbilityRolls();
  }
  const baseScores = elements["score-method"].value === "rolled"
    ? rolledAbilityAssignment(state.scoreRolls, profile.class)
    : profile.legacy
    ? { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }
    : profile.baseScores;
  renderAbilityInputs(baseScores, state.scoreRolls);
  elements["character-skin"].value = profile.appearance?.skin || SKIN_TONES[0].value;
  elements["character-hair"].value = profile.appearance?.hair || "#211a17";
  elements["character-hair-style"].value = profile.appearance?.hairStyle || "short";
  elements["character-tunic"].value = profile.appearance?.tunic || "#334d78";
  elements["character-garment"].value = GARMENT_STYLES.includes(profile.appearance?.garment) ? profile.appearance.garment : "woven-tunic";
  elements["character-adornment"].value = CLOTHING_ADORNMENTS.includes(profile.appearance?.adornment) ? profile.appearance.adornment : "none";
  elements["character-headwear"].value = HEADWEAR_STYLES.includes(profile.appearance?.headwear) ? profile.appearance.headwear : "none";
  elements["character-face-paint"].value = FACE_PAINT_STYLES.includes(profile.appearance?.facePaint) ? profile.appearance.facePaint : "none";
  elements["character-shield"].value = profile.equipment?.shield ? "yes" : "no";
  elements["character-cloak"].value = profile.equipment?.cloak ? "yes" : "no";
  syncEquipmentOptions();
  syncClassSkillOptions(profile.classSkills || []);
  if (profile.equipment?.weapon && [...elements["character-weapon"].options].some((option) => option.value === profile.equipment.weapon)) elements["character-weapon"].value = profile.equipment.weapon;
  if (profile.equipment?.armor && [...elements["character-armor"].options].some((option) => option.value === profile.equipment.armor)) elements["character-armor"].value = profile.equipment.armor;
  elements["character-dialog"].showModal();
  state.characterCreationStep = 0;
  setCharacterCreationStep();
  updateCharacterPreview();
}

function setCharacterCreationStep() {
  const steps = [...elements["character-form"].querySelectorAll("[data-creation-step]")];
  const step = Math.max(0, Math.min(state.characterCreationStep, steps.length - 1));
  state.characterCreationStep = step;
  elements["character-form"].querySelector(".character-builder").classList.add("wizard-step");
  steps.forEach((section, index) => {
    section.classList.toggle("hidden", index !== step);
    if (index !== step) return;
    section.querySelectorAll("[data-creation-subpage]").forEach((content) => {
      content.hidden = false;
    });
  });
  const labels = ["Your arrival", "Your strengths", "Your kit", "Your look"];
  elements["creation-step-label"].textContent = window.cryptsLocale.t(labels[step]);
  elements["creation-step-track"].textContent = `${step + 1} / ${steps.length}`;
  elements["creation-progress-bar"].setAttribute("aria-valuenow", String(step + 1));
  elements["creation-progress-fill"].style.width = `${((step + 1) / steps.length) * 100}%`;
  elements["character-intro"].textContent = window.cryptsLocale.t(TOWN_INTRODUCTIONS[step]);
  elements["character-back"].classList.toggle("hidden", step === 0);
  elements["character-next"].classList.toggle("hidden", step === steps.length - 1);
  elements["character-submit"].classList.toggle("hidden", step !== steps.length - 1);
}

function validateCharacterCreationStep(step) {
  if (step === 0) {
    const name = elements["character-name"].value.trim();
    if (!name || name.length > 24) throw new Error("Add a character name (up to 24 characters) to continue.");
  } else if (step === 1) {
    selectedScores();
    const selectedClass = CLASSES[elements["character-class"].value];
    const backgroundSkills = new Set(BACKGROUNDS[elements["character-background"].value]?.skillIds || []);
    const skills = selectedClassSkills();
    if (!selectedClass || skills.length !== selectedClass.skillCount ||
      new Set(skills).size !== skills.length || skills.some((skill) => !selectedClass.skills.includes(skill) || backgroundSkills.has(skill))) {
      throw new Error(`Choose ${selectedClass?.skillCount || "your"} available skills to continue.`);
    }
  } else if (step === 2) {
    readCharacterFromForm();
  }
}

function advanceCharacterCreation(direction) {
  elements["character-error"].textContent = "";
  if (direction > 0) {
    try {
      validateCharacterCreationStep(state.characterCreationStep);
    } catch (error) {
      elements["character-error"].textContent = escapeMessage(error);
      if (state.characterCreationStep === 0 && !elements["character-name"].value.trim()) {
        elements["character-name"].focus({ preventScroll: true });
      }
      return;
    }
  }
  state.characterCreationStep += direction;
  setCharacterCreationStep();
  const currentSection = elements["character-form"].querySelector(`[data-creation-step="${state.characterCreationStep}"]`);
  currentSection?.scrollIntoView({ block: "start", behavior: "smooth" });
  const firstField = currentSection?.querySelector("input, select, button");
  firstField?.focus({ preventScroll: true });
}

function commitCharacter(event) {
  event.preventDefault();
  const lastStep = elements["character-form"].querySelectorAll("[data-creation-step]").length - 1;
  if (state.characterCreationStep < lastStep) {
    advanceCharacterCreation(1);
    return;
  }
  try {
    const character = readCharacterFromForm();
    newRun(character);
    elements["character-dialog"].close();
    elements["prologue-heading"].textContent = "A Door Beneath Chiltomatlan";
    setDialogCopy("prologue-copy", `${TOMB_HISTORY} Your purpose is your own: explore, gather what you need, and return to Chiltomatlan whenever you choose.`);
    elements["prologue-dialog"].showModal();
  } catch (error) {
    elements["character-error"].textContent = escapeMessage(error);
  }
}
