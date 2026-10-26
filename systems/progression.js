"use strict";

// Progression systems: gear quality tiers, elites and guardians, creature conditions,
// camp recipes and boons, the bestiary, bounties and renown, and Chiltomatlan's
// town projects. State lives in state.run.progress (see createProgress).

const PROGRESSION = window.CryptsProgression;
const GEAR_TIERS = PROGRESSION.tiers;
const TIER_ORDER = ["fine", "masterwork", "relic"];
const LIFT_FLOORS = [5, 9];
const MAX_ACTIVE_BOUNTIES = 3;
const PROJECT_IDS = Object.keys(PROGRESSION.projects);

// ---------- State ----------

function createProgress() {
  return {
    version: 1,
    deepestFloor: 1,
    town: Object.fromEntries(PROJECT_IDS.map((id) => [id, 0])),
    bestiary: {},
    bounties: { active: [], completed: 0, nextId: 1 },
    conditions: [],
    buffs: [],
    dishesCooked: 0,
    loreHeard: []
  };
}

function normalizeProgress(raw, pack) {
  const progress = createProgress();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return progress;
  const int = (value, min, max, fallback) =>
    Number.isInteger(value) && value >= min && value <= max ? value : fallback;
  progress.deepestFloor = int(raw.deepestFloor, 1, DUNGEON_FLOOR_COUNT, 1);
  for (const id of PROJECT_IDS) {
    progress.town[id] = int(raw.town?.[id], 0, PROGRESSION.projects[id].levels.length, 0);
  }
  const templateIds = new Set((pack?.enemies || []).map((enemy) => enemy.id));
  if (raw.bestiary && typeof raw.bestiary === "object" && !Array.isArray(raw.bestiary)) {
    for (const [id, kills] of Object.entries(raw.bestiary)) {
      if (templateIds.has(id) && Number.isInteger(kills) && kills > 0) progress.bestiary[id] = Math.min(kills, 100000);
    }
  }
  const bounties = raw.bounties;
  if (bounties && Array.isArray(bounties.active)) {
    progress.bounties.completed = int(bounties.completed, 0, 100000, 0);
    progress.bounties.nextId = int(bounties.nextId, 1, 10_000_000, 1);
    progress.bounties.active = bounties.active.filter((bounty) => validBounty(bounty, templateIds))
      .slice(0, MAX_ACTIVE_BOUNTIES);
  }
  const conditions = Array.isArray(raw.conditions) ? raw.conditions : [];
  progress.conditions = conditions.filter((entry) => entry && PROGRESSION.conditions[entry.id] &&
    Number.isInteger(entry.turns) && entry.turns > 0 && entry.turns <= 20)
    .filter((entry, index, list) => list.findIndex((other) => other.id === entry.id) === index);
  const buffs = Array.isArray(raw.buffs) ? raw.buffs : [];
  progress.buffs = buffs.filter((entry) => entry && PROGRESSION.buffs[entry.id] &&
    Number.isInteger(entry.until) && entry.until >= 0 && entry.until <= 60_000_000)
    .filter((entry, index, list) => list.findIndex((other) => other.id === entry.id) === index);
  progress.dishesCooked = int(raw.dishesCooked, 0, 1_000_000, 0);
  const knownRemarks = new Set(Object.values(window.CryptsLore?.townsfolk || {}).flat().map((remark) => remark.id));
  progress.loreHeard = Array.isArray(raw.loreHeard)
    ? [...new Set(raw.loreHeard.filter((id) => knownRemarks.has(id)))] : [];
  return progress;
}

function validBounty(bounty, templateIds) {
  if (!bounty || typeof bounty !== "object" || !Number.isInteger(bounty.id) ||
    !["slay", "elite", "guardian", "depth", "deliver", "cook"].includes(bounty.kind) ||
    !Number.isInteger(bounty.count) || bounty.count < 1 || bounty.count > 20 ||
    !Number.isInteger(bounty.progress) || bounty.progress < 0 || bounty.progress > bounty.count ||
    typeof bounty.title !== "string" || bounty.title.length > 120 ||
    !bounty.reward || !Number.isInteger(bounty.reward.gold) || bounty.reward.gold < 0 || bounty.reward.gold > 5000 ||
    !Number.isInteger(bounty.reward.xp) || bounty.reward.xp < 0 || bounty.reward.xp > 20000 ||
    !Object.prototype.hasOwnProperty.call(FACTIONS, bounty.reward.faction)) return false;
  if (bounty.kind === "slay" && !templateIds.has(bounty.target)) return false;
  if (bounty.kind === "deliver" && !GEAR_ITEMS[bounty.target]) return false;
  return true;
}

function progress() {
  if (!state.run.progress) state.run.progress = createProgress();
  return state.run.progress;
}

// ---------- Gear tiers ----------

function gearBase(key) {
  return WEAPONS[key]?.baseId || ARMORS[key]?.baseId || key;
}

function gearTierOf(key) {
  return WEAPONS[key]?.tier || ARMORS[key]?.tier || null;
}

function gearTraitOf(key) {
  return WEAPONS[key]?.trait || ARMORS[key]?.trait || null;
}

function tieredGearName(entry) {
  if (!entry?.tier) return t(entry?.name || "");
  const base = (entry.dice ? WEAPONS : ARMORS)[entry.baseId];
  const traitCatalog = { ...PROGRESSION.weaponTraits, ...PROGRESSION.armorTraits };
  const trait = entry.trait ? traitCatalog[entry.trait] : null;
  return `${t("{tier} {item}", { tier: t(GEAR_TIERS[entry.tier].label), item: t(base?.name || entry.name) })}${trait ? ` · ${t(trait.name)}` : ""}`;
}

function tieredGearDescription(entry) {
  if (entry?.exotic) {
    const isWeapon = Boolean(entry.dice);
    const traits = isWeapon ? PROGRESSION.weaponTraits : PROGRESSION.armorTraits;
    const trait = entry.trait ? traits[entry.trait] : null;
    const bonus = isWeapon
      ? `${entry.dice} damage${entry.attackBonus ? `, +${entry.attackBonus} attack` : ""}${entry.damageBonus ? `, +${entry.damageBonus} damage` : ""}`
      : `Base AC ${entry.base}${entry.dex ? entry.dexCap !== undefined ? ` + Dex (max ${entry.dexCap})` : " + Dex" : ""}${entry.acBonus ? `, +${entry.acBonus} AC` : ""}${entry.strength ? ` · Strength ${entry.strength}` : ""}`;
    return `Exotic · ${bonus}.${trait ? ` ${t(trait.name)}: ${t(trait.description)}` : ""} ${t(entry.description || "")}`.trim();
  }
  if (!entry?.tier) return null;
  const tier = GEAR_TIERS[entry.tier];
  const isWeapon = Boolean(entry.dice);
  const traitCatalog = isWeapon ? PROGRESSION.weaponTraits : PROGRESSION.armorTraits;
  const trait = entry.trait ? traitCatalog[entry.trait] : null;
  const bonus = isWeapon
    ? `+${tier.attack} attack${tier.damage ? `, +${tier.damage} damage` : ""}`
    : `+${tier.ac} AC`;
  return `${t(tier.label)} · ${bonus}.${trait ? ` ${t(trait.name)}: ${t(trait.description)}` : ""} ${t(entry.description || "")}`.trim();
}

function equippedWeaponTrait() {
  return gearTraitOf(state.run.character.equipment.weapon);
}

function equippedArmorTrait() {
  const armor = state.run.character.equipment.armor;
  return armor && armor !== "none" ? gearTraitOf(armor) : null;
}

function rollGearTier(floor, boost = 0) {
  const roll = randomInt(100) + boost;
  if (floor >= 8) return roll >= 70 ? "relic" : "masterwork";
  if (floor >= 4) return roll >= 90 ? "relic" : roll >= 50 ? "masterwork" : "fine";
  return roll >= 95 ? "masterwork" : "fine";
}

function rollGearDrop(floor, boost = 0) {
  const tier = rollGearTier(floor, boost);
  const characterClass = CLASSES[state.run.character.class];
  const classArmor = characterClass.armor.filter((id) => id !== "none" && !ARMORS[id].exotic && !ARMORS[id].tombOnly);
  const pickWeapon = !classArmor.length || randomInt(100) <= 65;
  let base;
  if (pickWeapon) {
    const pool = (randomInt(100) <= 75
      ? characterClass.weapons
      : Object.keys(WEAPONS).filter((id) => !WEAPONS[id].baseId && WEAPON_PRICES[id]))
      .filter((id) => !WEAPONS[id].exotic && !(WEAPONS[id].tombOnly && (WEAPONS[id].minFloor || 1) > floor));
    base = pool[randomInt(pool.length) - 1];
  } else {
    const pool = randomInt(100) <= 80 ? classArmor : ["leather", "hide", "scale", "chainmail"];
    base = pool[randomInt(pool.length) - 1];
  }
  const traits = Object.keys(pickWeapon ? PROGRESSION.weaponTraits : PROGRESSION.armorTraits);
  const key = tier === "relic" ? `${base}--relic-${traits[randomInt(traits.length) - 1]}` : `${base}--${tier}`;
  const id = `${pickWeapon ? "weapon" : "armor"}:${key}`;
  return itemDetails(id) ? id : null;
}

function reforgeTarget(slot) {
  const equipment = state.run.character.equipment;
  const key = equipment[slot];
  if (!key || key === "none") return null;
  const tier = gearTierOf(key);
  const workshop = progress().town.workshop;
  const nextTier = !tier ? (workshop >= 1 ? "fine" : null) : tier === "fine" && workshop >= 2 ? "masterwork" : null;
  if (!nextTier) return { key, nextTier: null, tier };
  const base = gearBase(key);
  const prices = slot === "weapon" ? WEAPON_PRICES : ARMOR_PRICES;
  const cost = nextTier === "fine" ? Math.max(20, Math.round(prices[base][1] * 2)) : Math.max(60, Math.round(prices[base][1] * 5));
  return { key, tier, nextTier, nextKey: `${base}--${nextTier}`, cost };
}

function reforgeEquipped(slot) {
  if (state.run.location !== "city") return;
  const target = reforgeTarget(slot);
  if (!target?.nextTier) return;
  if (state.run.gold < target.cost) {
    showToast(`Reforging costs ${formatCurrency(target.cost)}.`);
    return;
  }
  const prefix = slot === "weapon" ? "weapon:" : "armor:";
  if (!removeInventoryItem(`${prefix}${target.key}`)) {
    showToast("Carry the equipped item in your pack to reforge it.");
    return;
  }
  if (!addInventoryItem(`${prefix}${target.nextKey}`)) {
    addInventoryItem(`${prefix}${target.key}`);
    showToast("Your pack is too heavy to finish the reforging.");
    return;
  }
  state.run.gold = roundGold(state.run.gold - target.cost);
  state.run.character.equipment[slot] = target.nextKey;
  const enhancements = state.run.character.equipmentEnhancements;
  const blessedKey = slot === "weapon" ? "weaponIds" : "armorIds";
  if (enhancements?.[blessedKey]?.includes(target.key) && !enhancements[blessedKey].includes(target.nextKey)) {
    enhancements[blessedKey].push(target.nextKey);
  }
  const name = itemDetails(`${prefix}${target.nextKey}`).name;
  addLog(`The Obsidian Workshop reforges your gear into ${name} for ${formatCurrency(target.cost)}.`);
  showToast(`Reforged: ${name}.`);
  render();
  renderProjectsDialog();
}

// ---------- Boons and conditions ----------

function activeBuff(id) {
  return state.run?.progress?.buffs?.some((buff) => buff.id === id && buff.until > state.run.gameMinutes) || false;
}

function grantBuff(id) {
  const buff = PROGRESSION.buffs[id];
  if (!buff) return;
  const list = progress().buffs.filter((entry) => entry.id !== id && entry.until > state.run.gameMinutes);
  list.push({ id, until: state.run.gameMinutes + buff.minutes });
  progress().buffs = list;
  addLog(`${t(buff.name)}: ${t(buff.description)} (8 hours).`);
}

function hasCondition(id) {
  return state.run?.progress?.conditions?.some((entry) => entry.id === id) || false;
}

function applyCondition(id, source) {
  const condition = PROGRESSION.conditions[id];
  if (!condition || state.run.hp <= 0) return false;
  if (equippedArmorTrait() === "warded") {
    addLog(`Your warded armor turns aside ${source}'s ${t(condition.name).toLowerCase()} touch.`);
    return false;
  }
  const list = progress().conditions.filter((entry) => entry.id !== id);
  list.push({ id, turns: condition.turns });
  progress().conditions = list;
  addLog(`${source} leaves you ${t(condition.name).toLowerCase()}: ${t(condition.description)} Medicine or rest cures it.`);
  showToast(`${t(condition.name)} · ${t(condition.description)}`);
  return true;
}

function clearConditions(reason = "") {
  if (!state.run?.progress?.conditions?.length) return;
  state.run.progress.conditions = [];
  if (reason) addLog(reason);
}

function tickConditions() {
  const list = progress().conditions;
  if (!list.length) return;
  for (const entry of list) {
    if ((entry.id === "poison" || entry.id === "bleed") && state.run.hp > 1) {
      state.run.hp -= 1;
      showCombatFeedback("player-hit", "−1 HP", { actor: "player", x: state.run.player.x, y: state.run.player.y });
    }
    entry.turns -= 1;
    if (entry.turns <= 0) addLog(`You are no longer ${t(PROGRESSION.conditions[entry.id].name).toLowerCase()}.`);
  }
  progress().conditions = list.filter((entry) => entry.turns > 0);
}

function maybeInflictCondition(enemy) {
  const inflicts = enemy?.inflicts;
  if (!inflicts || !PROGRESSION.conditions[inflicts.condition] || state.run.hp <= 0) return;
  if (randomInt(100) <= inflicts.chance) applyCondition(inflicts.condition, enemy.name);
}

// ---------- Combat modifiers ----------

function heroStatModifiers() {
  const mods = { attack: 0, damage: 0, ac: 0 };
  if (!state.run?.progress) return mods;
  if (activeBuff("hearty")) mods.attack += 1;
  if (activeBuff("fiery")) mods.damage += 2;
  if (activeBuff("steady")) mods.ac += 1;
  if (activeBuff("bold")) mods.attack += 1;
  if (activeBuff("festive")) {
    mods.attack += 1;
    mods.ac += 1;
  }
  if (hasCondition("weakened")) mods.attack -= 2;
  return mods;
}

function buffSkillBonus(skill) {
  let bonus = ["perception", "survival"].includes(skill) && activeBuff("keen-eyed") ? 2 : 0;
  if (skill === "perception" && activeBuff("bold")) bonus -= 2;
  return bonus;
}

function progressionSaveBonus() {
  return state.run?.progress?.town?.shrine >= 2 ? 1 : 0;
}

function criticalThreshold() {
  return equippedWeaponTrait() === "keen" ? 19 : 20;
}

function bestiaryRank(templateId) {
  const kills = state.run?.progress?.bestiary?.[templateId] || 0;
  return [...PROGRESSION.bestiaryTiers].reverse().find((tier) => kills >= tier.kills) || null;
}

function bestiaryBonus(enemy) {
  const kills = state.run?.progress?.bestiary?.[enemy?.templateId] || 0;
  return { attack: kills >= 5 ? 1 : 0, damage: kills >= 15 ? 1 : 0 };
}

function afterPlayerHit(enemy, damage) {
  if (damage > 0 && enemy.alive && enemy.hp > 0 && equippedWeaponTrait() === "thundering" && randomInt(4) === 1) {
    enemy.staggered = true;
    addLog(`Your thundering blow staggers ${enemy.name}; it loses its next turn.`);
  }
}

function enemySkipsTurn(enemy) {
  if (!enemy.staggered) return false;
  enemy.staggered = false;
  return true;
}

function foodDrainPerHour() {
  const granary = state.run?.progress?.town?.granary || 0;
  return Math.max(1, FOOD_DRAIN_PER_HOUR - (granary >= 1 ? 1 : 0) - (equippedArmorTrait() === "provisioned" ? 1 : 0));
}

function waterDrainPerHour() {
  const granary = state.run?.progress?.town?.granary || 0;
  return Math.max(1, WATER_DRAIN_PER_HOUR - (granary >= 2 ? 1 : 0) - (equippedArmorTrait() === "provisioned" ? 1 : 0));
}

// ---------- Elites, guardians, and loot ----------

function decorateEnemy(enemy, { isBoss = false } = {}) {
  const floor = state.run.dungeonFloor || 1;
  const inflicts = PROGRESSION.creatureConditions[enemy.templateId];
  if (inflicts) enemy.inflicts = { ...inflicts };
  if (isBoss) {
    enemy.guardian = true;
    if (floor % 4 === 0) {
      enemy.greatGuardian = true;
      enemy.hp = Math.ceil(enemy.hp * 1.25);
      enemy.maxHp = enemy.hp;
      enemy.xp = Math.round(enemy.xp * 1.5);
    }
    return enemy;
  }
  if (floor < 2 || randomInt(100) > Math.min(25, 10 + floor * 1.5)) return enemy;
  const titles = PROGRESSION.eliteTitles;
  enemy.elite = true;
  enemy.title = titles[randomInt(titles.length) - 1];
  enemy.name = `${enemy.title} ${enemy.name}`;
  enemy.hp = Math.ceil(enemy.hp * 1.6);
  enemy.maxHp = enemy.hp;
  enemy.attackBonus += 1;
  enemy.xp = Math.round(enemy.xp * 2);
  if (enemy.inflicts) enemy.inflicts.chance = Math.min(60, enemy.inflicts.chance + 15);
  return enemy;
}

function bonusEnemyLoot(enemy) {
  const floor = state.run.dungeonFloor || 1;
  const items = [];
  let gold = 0;
  if (enemy.guardian) {
    const gear = rollGearDrop(floor, enemy.greatGuardian ? 40 : 20);
    if (gear) items.push({ id: gear, quantity: 1 });
    gold += rollDice("2d6").total * Math.ceil(floor / 3);
  } else if (enemy.elite) {
    const gear = rollGearDrop(floor, 15);
    if (gear) items.push({ id: gear, quantity: 1 });
    gold += rollDice("1d8").total * Math.ceil(floor / 3);
  } else if (randomInt(100) <= 4) {
    const gear = rollGearDrop(floor);
    if (gear) items.push({ id: gear, quantity: 1 });
  }
  return { items, gold };
}

function cacheGearChance(floor) {
  return Math.min(35, 8 + floor * 2);
}

function onCreatureDefeated(enemy) {
  const book = progress().bestiary;
  const before = book[enemy.templateId] || 0;
  book[enemy.templateId] = before + 1;
  const kills = before + 1;
  const template = state.pack.enemies.find((entry) => entry.id === enemy.templateId);
  const baseName = template?.name || enemy.name;
  if (kills === 1) addLog(`Journal: ${baseName} added to your bestiary.`);
  const reached = PROGRESSION.bestiaryTiers.find((tier) => tier.kills === kills && tier.kills > 1);
  if (reached) {
    addLog(`Bestiary: ${baseName} is now ${reached.title.toLowerCase()}. ${reached.description}`);
    showToast(`${baseName} ${reached.title.toLowerCase()} · ${reached.description}`);
  }
  if (equippedWeaponTrait() === "lifedrinker" && state.run.hp > 0 && state.run.hp < state.run.maxHp) {
    const restored = Math.min(2, state.run.maxHp - state.run.hp);
    state.run.hp += restored;
    addLog(`Your lifedrinker weapon restores ${restored} hit point${restored === 1 ? "" : "s"}.`);
  }
  advanceBounties((bounty) =>
    (bounty.kind === "slay" && bounty.target === enemy.templateId) ||
    (bounty.kind === "elite" && enemy.elite) ||
    (bounty.kind === "guardian" && enemy.guardian));
}

// ---------- Recipes ----------

function availableRecipes() {
  return Object.entries(PROGRESSION.recipes).filter(([, recipe]) =>
    Object.entries(recipe.ingredients).every(([id, quantity]) => inventoryQuantity(id) >= quantity));
}

function cookingBlocked() {
  return state.run.location === "dungeon" && (!atCamp() || state.run.enemies.some((enemy) =>
    enemy.alive && distanceInSquares(enemy, state.run.player) <= 7));
}

function openCookMenu() {
  if (state.run.lost || state.run.won) return;
  if (cookingBlocked()) {
    showToast(atCamp() || state.run.location !== "dungeon" ? "Too close to danger to cook. Find a quiet room first." : "Cooking needs your campfire. Return to your camp or make one here.");
    return;
  }
  const options = availableRecipes();
  if (!options.length) {
    const hints = Object.values(PROGRESSION.recipes).map((recipe) =>
      `${t(recipe.name)}: ${Object.keys(recipe.ingredients).map((id) => itemDetails(id).name).join(" + ")}`);
    showRpgMessage("Camp recipes", `You don't have the ingredients for a dish yet. ${hints.join(". ")}.`);
    return;
  }
  chooseFromOptions("Cook a dish · 30 minutes", options.map(([id, recipe]) => ({
    label: `${t(recipe.name)} · ${Object.keys(recipe.ingredients).map((ingredient) => itemDetails(ingredient).name).join(" + ")}`,
    action: () => cookRecipe(id)
  })));
}

function cookRecipe(id) {
  const recipe = PROGRESSION.recipes[id];
  if (!recipe || cookingBlocked()) return;
  if (!Object.entries(recipe.ingredients).every(([ingredient, quantity]) => inventoryQuantity(ingredient) >= quantity)) return;
  for (const [ingredient, quantity] of Object.entries(recipe.ingredients)) removeInventoryItem(ingredient, quantity);
  const check = randomInt(20) + bestPartySkillBonus("cooking");
  const servings = check >= 12 ? 2 : 1;
  let made = 0;
  for (let serving = 0; serving < servings; serving += 1) if (addInventoryItem(id)) made += 1;
  progress().dishesCooked += 1;
  addLog(`You cook ${made || 1} serving${made === 1 ? "" : "s"} of ${t(recipe.name)} (Cooking ${check}).`);
  if (!made) addLog("Your pack is too full, so you eat the dish on the spot.");
  if (!made) {
    applyMeal(state.run.needs, id);
    grantBuff(recipe.buff);
  }
  advanceBounties((bounty) => bounty.kind === "cook");
  if (state.run.location === "dungeon") finishPlayerTurn(30);
  else render();
}

// ---------- Bounties and renown ----------

function renownTier(completed = progress().bounties.completed) {
  return [...PROGRESSION.renownTiers].reverse().find((tier) => completed >= tier.bounties) || PROGRESSION.renownTiers[0];
}

function nextRenownTier() {
  const completed = progress().bounties.completed;
  return PROGRESSION.renownTiers.find((tier) => tier.bounties > completed) || null;
}

function bountyEncounterPool(floor) {
  const early = ["maztican-cave-locust", "axolocatl", "cenote-stalker", "tomb-bat", "duende", "yohualtepoztli"];
  const middle = [...early, "mictlaneca", "jungle-jaguar", "quinametli", "cihuateotl"];
  const deep = [...middle, "caxtiltecatl", "feathered-serpent", "camazotz"];
  const pool = floor >= 9 ? deep : floor >= 5 ? middle : early;
  return pool.filter((id) => state.pack.enemies.some((enemy) => enemy.id === id));
}

function createBounty() {
  const data = progress();
  const depth = data.deepestFloor;
  const band = Math.max(1, Math.ceil(depth / 3));
  const taken = new Set(data.bounties.active.map((bounty) => `${bounty.kind}:${bounty.target || ""}`));
  const kinds = ["slay", "slay", "deliver", "cook", "depth"];
  if (depth >= 2) kinds.push("elite");
  if (depth >= 2) kinds.push("guardian");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const kind = kinds[randomInt(kinds.length) - 1];
    let bounty = null;
    if (kind === "slay") {
      const pool = bountyEncounterPool(Math.min(DUNGEON_FLOOR_COUNT, depth + 1));
      if (!pool.length) continue;
      const target = pool[randomInt(pool.length) - 1];
      const count = 2 + randomInt(3);
      const name = state.pack.enemies.find((enemy) => enemy.id === target).name;
      bounty = { kind, target, count, title: `Thin the ${name} (${count})`, faction: "road-wardens", gold: 8 * count + 6 * band, xp: 20 * count * band };
    } else if (kind === "elite") {
      bounty = { kind, target: null, count: 1, title: "Defeat an elite creature", faction: "road-wardens", gold: 30 + 12 * band, xp: 120 * band };
    } else if (kind === "guardian") {
      bounty = { kind, target: null, count: 1, title: "Defeat a floor guardian", faction: "road-wardens", gold: 40 + 15 * band, xp: 160 * band };
    } else if (kind === "depth") {
      const floor = Math.min(DUNGEON_FLOOR_COUNT, depth + 1 + randomInt(2));
      if (floor <= depth) continue;
      bounty = { kind, target: String(floor), count: 1, title: `Reach floor ${floor} and return`, faction: "road-wardens", gold: 25 + 10 * floor, xp: 100 * floor };
    } else if (kind === "deliver") {
      const options = depth >= 5 ? ["jade-pectoral", "incensario", "obsidian-mirror", "terracotta-figurine"] : ["terracotta-figurine", "jade-bead", "incensario"];
      const target = options[randomInt(options.length) - 1];
      const count = target === "jade-bead" ? 3 : 1;
      const value = GEAR_ITEMS[target].price * count;
      bounty = { kind, target, count, title: `Deliver ${count > 1 ? `${count} ` : ""}${GEAR_ITEMS[target].name}${count > 1 ? "s" : ""} to Teyac`, faction: "traders-circle", gold: Math.round(value * 0.9 + 10 * band), xp: 40 * band };
    } else if (kind === "cook") {
      const count = 2;
      bounty = { kind, target: null, count, title: "Cook 2 camp dishes", faction: "ceiba-house", gold: 15 + 5 * band, xp: 40 * band };
    }
    if (!bounty || taken.has(`${bounty.kind}:${bounty.target || ""}`)) continue;
    const bonus = 1 + renownTier().rewardBonus;
    return {
      id: data.bounties.nextId++,
      kind: bounty.kind,
      target: bounty.target,
      count: bounty.count,
      progress: 0,
      title: bounty.title,
      reward: { gold: Math.round(bounty.gold * bonus), xp: Math.round(bounty.xp * bonus), faction: bounty.faction }
    };
  }
  return null;
}

function refillBounties() {
  const data = progress();
  while (data.bounties.active.length < MAX_ACTIVE_BOUNTIES) {
    const bounty = createBounty();
    if (!bounty) break;
    data.bounties.active.push(bounty);
  }
}

function advanceBounties(matches, amount = 1) {
  for (const bounty of progress().bounties.active) {
    if (bounty.progress >= bounty.count || !matches(bounty)) continue;
    bounty.progress = Math.min(bounty.count, bounty.progress + amount);
    if (bounty.progress >= bounty.count) {
      addLog(`Bounty ready: ${bounty.title}. Return to Chiltomatlan to claim the reward.`);
      showToast(`Bounty ready · ${bounty.title}`);
    }
  }
}

function recordFloorReached(floor) {
  const data = progress();
  if (floor > data.deepestFloor) {
    data.deepestFloor = floor;
    if (LIFT_FLOORS.includes(floor) && data.town.lift >= LIFT_FLOORS.indexOf(floor) + 1) {
      addLog(`The wardens mark floor ${floor} on their lift ropes. You can now descend here directly.`);
    }
  }
  for (const bounty of data.bounties.active) {
    if (bounty.kind === "depth" && floor >= Number(bounty.target) && bounty.progress < bounty.count) {
      bounty.progress = bounty.count;
      addLog(`Bounty ready: ${bounty.title}. Return to Chiltomatlan to claim the reward.`);
    }
  }
}

function bountyComplete(bounty) {
  if (bounty.kind === "deliver") return inventoryQuantity(bounty.target) >= bounty.count;
  return bounty.progress >= bounty.count;
}

function claimReadyBounties() {
  if (!state.run || state.run.location !== "city") return 0;
  const data = progress();
  let claimed = 0;
  for (const bounty of [...data.bounties.active]) {
    if (!bountyComplete(bounty)) continue;
    if (bounty.kind === "deliver" && !removeInventoryItem(bounty.target, bounty.count)) continue;
    const gold = addGoldWithinCapacity(bounty.reward.gold);
    addExperience(bounty.reward.xp);
    changeFactionStanding(bounty.reward.faction, bounty.kind === "deliver" ? 4 : 3, `you complete the bounty “${bounty.title}”`);
    data.bounties.active = data.bounties.active.filter((entry) => entry !== bounty);
    const previousTier = renownTier().title;
    data.bounties.completed += 1;
    claimed += 1;
    addLog(`Bounty complete: ${bounty.title}. You receive ${formatCurrency(gold)} and ${bounty.reward.xp} experience.`);
    const tier = renownTier();
    if (tier.title !== previousTier) {
      addLog(`Your renown grows: Chiltomatlan now calls you ${tier.title}. Bounty rewards +${Math.round(tier.rewardBonus * 100)}%.`);
      showToast(`Renown · ${tier.title}`);
    }
  }
  refillBounties();
  if (claimed) showToast(`${claimed} bount${claimed === 1 ? "y" : "ies"} claimed. New work is posted.`);
  return claimed;
}

// ---------- Town projects ----------

function projectLevel(id) {
  return progress().town[id] || 0;
}

function buildProject(id) {
  const project = PROGRESSION.projects[id];
  const level = projectLevel(id);
  const next = project?.levels[level];
  if (!next || state.run.location !== "city") return;
  if (state.run.gold < next.cost) {
    elements["projects-message"].textContent = `${t(project.name)} needs ${formatCurrency(next.cost)}.`;
    return;
  }
  state.run.gold = roundGold(state.run.gold - next.cost);
  progress().town[id] = level + 1;
  if (state.run.location === "city" &&
    !townCanOccupy(state.run.townPosition.x, state.run.townPosition.y, progress().town)) {
    state.run.townPosition = { ...TOWN_PLAZA };
  }
  addLog(`Chiltomatlan builds ${t(project.name)}${project.levels.length > 1 ? ` (stage ${level + 1})` : ""}: ${next.effect}`);
  elements["projects-message"].textContent = `${t(project.name)} complete: ${next.effect}`;
  showToast(`${t(project.name)} · ${next.effect}`);
  render();
  renderProjectsDialog();
}

function openProjectsDialog() {
  elements["town-dialog"].close();
  elements["projects-message"].textContent = "";
  renderProjectsDialog();
  elements["projects-dialog"].showModal();
}

function renderProjectsDialog() {
  if (!elements["projects-dialog"]) return;
  renderPurses();
  const fragment = document.createDocumentFragment();
  for (const [id, project] of Object.entries(PROGRESSION.projects)) {
    const level = projectLevel(id);
    const complete = level >= project.levels.length;
    const card = document.createElement("article");
    card.className = `project-card${complete ? " is-complete" : level ? " is-started" : ""}${project.levels.length > 5 ? " has-many-stages" : ""}`;
    const art = document.createElement("div");
    art.className = "project-art";
    const emblem = document.createElement("span");
    emblem.className = "project-emblem";
    emblem.setAttribute("aria-hidden", "true");
    emblem.textContent = project.emblem;
    const pips = document.createElement("span");
    pips.className = "project-pips";
    pips.setAttribute("aria-label", `Stage ${level} of ${project.levels.length}`);
    project.levels.forEach((_, index) => {
      const pip = document.createElement("i");
      if (index < level) pip.className = "is-built";
      pips.append(pip);
    });
    art.append(emblem, pips);
    const copy = document.createElement("div");
    copy.className = "project-copy";
    const heading = document.createElement("strong");
    heading.textContent = t(project.name);
    const description = document.createElement("small");
    description.textContent = t(project.description);
    const stages = document.createElement("ol");
    stages.className = "project-stages";
    project.levels.forEach((entry, index) => {
      const item = document.createElement("li");
      item.className = index < level ? "built" : index === level ? "next" : "";
      item.textContent = entry.effect;
      stages.append(item);
    });
    copy.append(heading, description, stages);
    const next = project.levels[level];
    const foot = document.createElement("div");
    foot.className = "project-foot";
    const price = document.createElement("span");
    price.className = `venue-price${next && state.run.gold < next.cost ? " is-short" : ""}`;
    price.textContent = next ? formatCurrency(next.cost) : "Built";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button";
    button.dataset.buildProject = id;
    button.textContent = next ? (level ? "Expand" : "Fund") : "Complete";
    button.disabled = !next || state.run.gold < next.cost;
    foot.append(price, button);
    card.append(art, copy, foot);
    fragment.append(card);
  }
  elements["projects-list"].replaceChildren(fragment);
  const workshop = elements["workshop-panel"];
  workshop.hidden = projectLevel("workshop") < 1;
  const rows = document.createDocumentFragment();
  for (const slot of ["weapon", "armor"]) {
    const target = reforgeTarget(slot);
    if (!target) continue;
    const prefix = slot === "weapon" ? "weapon:" : "armor:";
    const row = document.createElement("div");
    row.className = "workshop-row";
    const label = document.createElement("span");
    const current = itemDetails(`${prefix}${target.key}`)?.name || target.key;
    label.textContent = target.nextTier
      ? `${current} → ${t(GEAR_TIERS[target.nextTier].label)}`
      : `${current} · ${target.tier === "relic" ? "relics cannot be reforged" : target.tier === "masterwork" ? "already masterwork" : "build the next workshop stage to improve it"}`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button secondary";
    button.dataset.reforgeSlot = slot;
    button.textContent = target.nextTier ? `Reforge · ${formatCurrency(target.cost)}` : "—";
    button.disabled = !target.nextTier || state.run.gold < target.cost;
    row.append(label, button);
    rows.append(row);
  }
  elements["workshop-list"].replaceChildren(rows);
}

// ---------- Lift ----------

function liftDestinations() {
  const data = progress();
  return LIFT_FLOORS.filter((floor, index) => data.town.lift >= index + 1 && data.deepestFloor >= floor);
}

function chooseDungeonEntry(continueEntry) {
  const destinations = liftDestinations();
  const camp = activeCamp();
  if (!destinations.length && !camp) return false;
  const options = [{
    label: state.run.dungeonFloor === 1 ? "Tomb entrance · floor 1" : `Continue · floor ${state.run.dungeonFloor}`,
    action: continueEntry
  }];
  if (camp) {
    const hours = Math.max(1, camp.floor);
    options.push({ label: `Walk down to your camp · floor ${camp.floor} · ${hours} hour${hours === 1 ? "" : "s"}`, action: enterAtCamp });
  }
  if (state.run.dungeonFloor !== 1) options.push({ label: "Tomb entrance · floor 1", action: () => beginNewDelve() });
  for (const floor of destinations) {
    if (floor === state.run.dungeonFloor) continue;
    options.push({ label: `Wardens' lift · floor ${floor}`, action: () => descendByLift(floor) });
  }
  if (options.length < 2) return false;
  chooseFromOptions("Where will you enter the tomb?", options);
  return true;
}

function descendByLift(floor) {
  if (!LIFT_FLOORS.includes(floor) || !liftDestinations().includes(floor)) return;
  state.dashReady = false;
  state.disengageReady = false;
  state.run.unsecuredLoot = { gold: 0, items: [] };
  state.run.dungeonFloor = floor;
  state.run.dungeonFloors = {};
  initializeDungeon();
  state.run.floorStairs.push({
    id: "warden-lift", x: state.run.player.x, y: state.run.player.y,
    type: "lift", role: "entrance", name: "Wardens' lift"
  });
  state.run.location = "dungeon";
  state.run.hasEnteredDungeon = true;
  state.run.log.unshift(`The wardens lower you by rope to floor ${floor}. The lift waits here to carry you home.`);
  state.run.log = state.run.log.slice(0, 30);
  render();
}

// ---------- Journal rendering ----------

function renderProgressJournal() {
  if (!elements["bounty-list"] || !state.run) return;
  const data = progress();
  if (state.run.location === "city" && data.bounties.active.length < MAX_ACTIVE_BOUNTIES) refillBounties();
  const tier = renownTier();
  const next = nextRenownTier();
  elements["renown-line"].textContent = `${tier.title} · ${data.bounties.completed} bounties completed${next ? ` · ${next.bounties - data.bounties.completed} more for ${next.title}` : ""}${tier.rewardBonus ? ` · rewards +${Math.round(tier.rewardBonus * 100)}%` : ""}`;
  const bounties = document.createDocumentFragment();
  for (const bounty of data.bounties.active) {
    const card = document.createElement("article");
    const done = bountyComplete(bounty);
    card.className = `bounty-card${done ? " is-ready" : ""}`;
    const title = document.createElement("strong");
    title.textContent = bounty.title;
    const status = document.createElement("span");
    status.className = "bounty-status";
    const shown = bounty.kind === "deliver" ? Math.min(bounty.count, inventoryQuantity(bounty.target)) : bounty.progress;
    status.textContent = done ? "Ready to claim in town" : `${shown} / ${bounty.count}`;
    const reward = document.createElement("small");
    reward.textContent = `${formatCurrency(bounty.reward.gold)} · ${bounty.reward.xp} XP · ${t(FACTIONS[bounty.reward.faction].name)}`;
    const meter = document.createElement("span");
    meter.className = "bounty-meter";
    const fill = document.createElement("span");
    fill.style.width = `${Math.round((shown / bounty.count) * 100)}%`;
    meter.append(fill);
    card.append(title, status, meter, reward);
    bounties.append(card);
  }
  if (!data.bounties.active.length) {
    const empty = document.createElement("p");
    empty.className = "muted small";
    empty.textContent = "New bounties are posted when you return to Chiltomatlan.";
    bounties.append(empty);
  }
  elements["bounty-list"].replaceChildren(bounties);

  const bestiary = document.createDocumentFragment();
  const known = state.pack.enemies.filter((enemy) => data.bestiary[enemy.id]);
  elements["bestiary-count"].textContent = `${known.length} / ${state.pack.enemies.length}`;
  for (const enemy of state.pack.enemies) {
    const kills = data.bestiary[enemy.id] || 0;
    const row = document.createElement(kills ? "button" : "div");
    row.className = `bestiary-entry${kills ? " is-known" : " is-unknown"}`;
    if (kills) {
      row.type = "button";
      row.dataset.creatureId = enemy.id;
      row.title = t("Show the full creature card");
    }
    const art = kills ? createSprite(enemy.sprite || enemySpriteForId(enemy.id), "bestiary-sprite") : document.createElement("span");
    if (!kills) {
      art.className = "bestiary-sprite bestiary-unknown";
      art.textContent = "?";
    }
    const copy = document.createElement("span");
    copy.className = "bestiary-copy";
    const name = document.createElement("strong");
    name.textContent = kills ? t(enemy.name) : "Unknown";
    const rank = bestiaryRank(enemy.id);
    const nextTier = PROGRESSION.bestiaryTiers.find((entry) => entry.kills > kills);
    const detail = document.createElement("small");
    detail.textContent = kills
      ? `${rank.title} · ${kills} defeated${nextTier ? ` · ${nextTier.kills - kills} to ${nextTier.title.toLowerCase()}` : ""}`
      : "Defeat one to record it.";
    copy.append(name, detail);
    row.append(art, copy);
    bestiary.append(row);
  }
  elements["bestiary-list"].replaceChildren(bestiary);

  const built = PROJECT_IDS.filter((id) => data.town[id] > 0)
    .map((id) => `${t(PROGRESSION.projects[id].name)} ${data.town[id]}/${PROGRESSION.projects[id].levels.length}`);
  elements["projects-summary"].textContent = built.length
    ? `Built: ${built.join(" · ")}. Deepest floor reached: ${data.deepestFloor}.`
    : `No town projects yet. Speak with Tlacotl in the plaza. Deepest floor reached: ${data.deepestFloor}.`;
}

function renderStatusChips() {
  const container = elements["player-conditions"];
  if (!container || !state.run) return;
  pruneBuffsSilently();
  const chips = [];
  for (const entry of progress().conditions) {
    const condition = PROGRESSION.conditions[entry.id];
    chips.push({ className: `status-chip condition-${entry.id}`, text: `${t(condition.name)} · ${entry.turns}`, title: t(condition.description) });
  }
  for (const entry of progress().buffs) {
    const buff = PROGRESSION.buffs[entry.id];
    const hours = Math.max(1, Math.ceil((entry.until - state.run.gameMinutes) / 60));
    chips.push({ className: "status-chip boon", text: `${t(buff.name)} · ${hours}h`, title: t(buff.description) });
  }
  const build = () => chips.map((chip) => {
    const element = document.createElement("span");
    element.className = chip.className;
    element.textContent = chip.text;
    element.title = chip.title;
    return element;
  });
  container.replaceChildren(...build());
  container.hidden = chips.length === 0;
  const mapChips = elements["map-status-chips"];
  if (mapChips) {
    mapChips.replaceChildren(...build());
    mapChips.hidden = chips.length === 0 || state.run.location !== "dungeon";
  }
}

function pruneBuffsSilently() {
  if (!state.run?.progress) return;
  state.run.progress.buffs = state.run.progress.buffs.filter((entry) => entry.until > state.run.gameMinutes);
}

function connectProgressionEvents() {
  elements["projects-list"].addEventListener("click", (event) => {
    const button = event.target.closest("[data-build-project]");
    if (button) buildProject(button.dataset.buildProject);
  });
  elements["workshop-list"].addEventListener("click", (event) => {
    const button = event.target.closest("[data-reforge-slot]");
    if (button) reforgeEquipped(button.dataset.reforgeSlot);
  });
  elements["projects-close"].addEventListener("click", () => elements["projects-dialog"].close());
  elements["projects-x"].addEventListener("click", () => elements["projects-dialog"].close());
}
