"use strict";

// Class abilities: spells for the casting callings, techniques for the rest (data/spells.js).
//
// One engine runs all of them. An ability is a target (a creature, a creature beside you,
// yourself, everything around you, or a line), a roll (spell attack, weapon attack, saving
// throw, or none), and what it leaves behind: damage, a condition on the creature, a patch of
// ground (field), a spirit ally (summon), or a timed effect on you.
//
// Everything advances on creature turns, never on a clock:
//   fields      tick at the start of the creature phase (damage, roots, glyphs, the spring)
//   conditions  rooted, slowed, asleep, discord, marked, cursed, quivering: on the creature
//   summons     act right after you, before the creatures
//   effects     on you (rage, regen, deflect, dawn, shield, surge) tick down each turn
//   cooldowns   count down each turn in the tomb; a full rest clears them
// Fields and summons belong to the floor you're on and fade when you leave it.

const ABILITY_CATALOG = window.CryptsSpells.catalog;
const ABILITY_CLASS_LISTS = window.CryptsSpells.byClass;
const ABILITY_KEYS = ["1", "2", "3", "4", "5", "6", "7"];
const CREATURE_STATUS_KEYS = ["rooted", "slowed", "slowSkip", "distracted", "discord", "mark", "curse", "quiver", "vanishGrace"];

function abilityDef(id) {
  return ABILITY_CATALOG[id] || null;
}

function classAbilityIds(classId = state.run?.character?.class) {
  return ABILITY_CLASS_LISTS[classId] || [];
}

function abilityUnlocked(id, level = state.run?.level || 1) {
  const def = abilityDef(id);
  return Boolean(def) && level >= (def.level || 1);
}

function unlockedAbilityIds(classId = state.run?.character?.class, level = state.run?.level || 1) {
  return classAbilityIds(classId).filter((id) => abilityUnlocked(id, level));
}

function nextAbilityUnlock(classId = state.run?.character?.class, level = state.run?.level || 1) {
  return classAbilityIds(classId).map((id) => ({ id, def: abilityDef(id) })).find((entry) => entry.def.level > level) || null;
}

function abilityKey(id) {
  const index = unlockedAbilityIds().indexOf(id);
  return index >= 0 ? ABILITY_KEYS[index] || "" : "";
}

// ---------- State ----------

function abilityState() {
  const run = state.run;
  if (!run.abilityState || typeof run.abilityState !== "object") run.abilityState = {};
  const s = run.abilityState;
  if (!s.cooldowns || typeof s.cooldowns !== "object") s.cooldowns = {};
  if (!s.effects || typeof s.effects !== "object") s.effects = {};
  if (!Number.isInteger(s.nextId)) s.nextId = 1;
  return s;
}

function battlefieldKey() {
  return `${state.run.mapId || "map"}:${state.run.dungeonFloor || 1}:${state.run.location}`;
}

// Fields and summons on the current floor. Leaving the floor (or the tomb) clears them.
function battlefield() {
  const s = abilityState();
  const key = battlefieldKey();
  if (!s.battlefield || s.battlefield.key !== key || state.run.location !== "dungeon") {
    s.battlefield = { key, fields: [], summons: [] };
  }
  return s.battlefield;
}

function clearBattlefield() {
  const s = abilityState();
  s.battlefield = null;
}

function abilityCooldown(id) {
  return abilityState().cooldowns[id] || 0;
}

function heroEffect(kind) {
  const effect = abilityState().effects[kind];
  return effect && (effect.turns === undefined || effect.turns > 0) ? effect : null;
}

function refreshAbilitiesOnRest() {
  const s = abilityState();
  s.cooldowns = {};
  s.effects = {};
}

// ---------- Numbers ----------

function abilityCastingStat(classId = state.run.character.class) {
  return spellcastingAbility(classId) || { barbarian: "str", fighter: "str", monk: "wis", rogue: "dex" }[classId] || "str";
}

function abilityStatModifier(classId = state.run.character.class) {
  return abilityModifier(state.run.character.scores?.[abilityCastingStat(classId)] ?? 10);
}

function proficiencyAtLevel(level = state.run.level) {
  return 2 + Math.floor(Math.max(0, level - 1) / 4);
}

function abilitySaveDc() {
  return 8 + proficiencyAtLevel() + abilityStatModifier() +
    (BACKGROUNDS[state.run.character.background]?.spellAttackBonus || 0);
}

function abilityAttackBonus(target = null) {
  return abilityStatModifier() + proficiencyAtLevel() +
    (BACKGROUNDS[state.run.character.background]?.spellAttackBonus || 0) +
    heroStatModifiers().attack + (target ? bestiaryBonus(target).attack : 0);
}

function abilityDice(dice, def = {}) {
  return def.scale === false ? dice : spellDamageAtLevel(dice, state.run.level);
}

function rollDiceText(dice) {
  return rollDice(dice).total;
}

function creatureSaveBonus(enemy) {
  return Math.floor((enemy.attackBonus || 0) / 2) + (enemy.elite ? 2 : 0) + (enemy.guardian ? 2 : 0);
}

function creatureSaves(enemy, dc) {
  const die = randomInt(20);
  return { success: die !== 1 && (die === 20 || die + creatureSaveBonus(enemy) >= dc), die, total: die + creatureSaveBonus(enemy) };
}

const SAVE_NAMES = { str: "Strength", dex: "Dexterity", con: "Constitution", wis: "Wisdom", int: "Intelligence", cha: "Charisma" };

// ---------- Geometry ----------

function tileInMap(x, y) {
  return x >= 0 && x < MAP_TILE_SIZE && y >= 0 && y < MAP_TILE_SIZE;
}

function tilesWithin(center, radius) {
  const tiles = [];
  for (let y = center.y - radius; y <= center.y + radius; y += 1) {
    for (let x = center.x - radius; x <= center.x + radius; x += 1) {
      if (!tileInMap(x, y) || !isWalkable(x, y)) continue;
      if ((x !== center.x || y !== center.y) && !hasLineOfSight(center, { x, y })) continue;
      tiles.push({ x, y });
    }
  }
  return tiles;
}

// A straight line from you toward a creature, `length` squares long, stopped by walls.
function lineTiles(target, length) {
  const origin = state.run.player;
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
  const tiles = [];
  for (let i = 1; i <= length; i += 1) {
    const x = Math.round(origin.x + (dx / steps) * i);
    const y = Math.round(origin.y + (dy / steps) * i);
    if (!tileInMap(x, y) || !isWalkable(x, y)) break;
    if (!tiles.some((tile) => tile.x === x && tile.y === y)) tiles.push({ x, y });
  }
  return tiles;
}

function livingCreatures() {
  return state.run.enemies.filter((enemy) => enemy.alive && !enemy.friendly && enemy.hp > 0);
}

function creaturesOnTiles(tiles) {
  const keys = new Set(tiles.map((tile) => tileIndex(tile.x, tile.y)));
  return livingCreatures().filter((enemy) => keys.has(tileIndex(enemy.x, enemy.y)));
}

function abilityRange(def) {
  if (def.target === "adjacent") return 1;
  if (def.target === "shot") return Math.max(1, currentCharacterStats().weapon?.ranged ? currentCharacterStats().weapon.range || 1 : 1);
  return def.range || 7;
}

function abilityTargets(def) {
  if (def.target === "adjacent") return enemiesAdjacent();
  if (def.target === "shot") return attackTargets();
  if (def.target !== "enemy" && def.target !== "line") return [];
  const range = abilityRange(def);
  let targets = state.run.enemies.filter((enemy) => enemy.alive && !enemy.friendly && distanceInSquares(enemy, state.run.player) <= range &&
    hasLineOfSight(state.run.player, enemy));
  if (def.leap) targets = targets.filter((enemy) => leapLanding(enemy));
  return targets.sort((a, b) => distanceInSquares(a, state.run.player) - distanceInSquares(b, state.run.player) ||
    a.name.localeCompare(b.name));
}

// The tiles an ability will land on, for a given target (or none for self/around).
function abilityAreaTiles(def, target = null) {
  if (def.target === "around") return tilesWithin(state.run.player, def.radius || 1);
  if (def.target === "line" && target) return lineTiles(target, def.length || 7);
  if (def.field && def.field.center === "self") return tilesWithin(state.run.player, fieldRadius(def.field, state.run.player));
  if (def.field && target) return tilesWithin(target, fieldRadius(def.field, target));
  if (def.area && target) return tilesWithin(target, def.area.radius || 1);
  if (target) return [{ x: target.x, y: target.y }];
  return [];
}

function abilityVictims(def, target = null) {
  if (def.target === "around") {
    return creaturesOnTiles(abilityAreaTiles(def)).filter((enemy) => hasLineOfSight(state.run.player, enemy));
  }
  if (def.target === "line" || def.area) return creaturesOnTiles(abilityAreaTiles(def, target));
  return target ? [target] : [];
}

// A free square beside the creature for Leaping Kick and Shadow Step (behind it if possible).
function leapLanding(enemy, { crowded = false } = {}) {
  const options = [];
  for (const direction of MOVEMENT_DIRECTIONS) {
    const spot = { x: enemy.x + direction.x, y: enemy.y + direction.y };
    if (!isWalkable(spot.x, spot.y) || tileHasCreature(spot.x, spot.y) ||
      (spot.x === state.run.player.x && spot.y === state.run.player.y)) continue;
    if (state.run.hazards.some((hazard) => !hazard.triggered && hazard.x === spot.x && hazard.y === spot.y)) continue;
    options.push(spot);
  }
  if (distanceInSquares(enemy, state.run.player) === 1) options.push({ x: state.run.player.x, y: state.run.player.y });
  // Land where the fewest other creatures can reach you; behind the target breaks ties.
  const crowd = (spot) => livingCreatures().filter((other) => other !== enemy && other.alerted && distanceInSquares(other, spot) <= 1).length;
  const sign = crowded ? -1 : 1;
  options.sort((a, b) => sign * (crowd(a) - crowd(b)) || distanceInSquares(b, state.run.player) - distanceInSquares(a, state.run.player));
  return options[0] || null;
}

function wetGround(center) {
  const habitat = state.run.rooms[roomIndexAt(center.x, center.y)]?.habitat;
  if (habitat === "flooded-chamber") return true;
  const features = typeof ensureEcology === "function" ? ensureEcology()?.features || [] : [];
  return features.some((feature) => feature.kind === "pool" && distanceInSquares(feature, center) <= 2);
}

function fieldRadius(field, center) {
  return (field.radius ?? 1) + (field.wetBonus && center && wetGround(center) ? 1 : 0);
}

// ---------- Availability ----------

function abilityCostLabel(id) {
  const def = abilityDef(id);
  if (!def) return "";
  if (def.cost === "free") return t("at will");
  if (def.cost === "cooldown") {
    const wait = abilityCooldown(id);
    return wait > 0 ? t("ready in {0}", { 0: wait }) : t("ready");
  }
  if (state.run.spellSlots < 1 && canOverchannel(abilityLegacyView(def))) return t("costs 1d6 HP");
  return t("{0} slots", { 0: state.run.spellSlots });
}

// The shape knacks.js expects for Overchannel.
function abilityLegacyView(def) {
  return { free: def.cost !== "slot", healing: Boolean(def.heal) };
}

// Why an ability can't be used right now, or "" when it can.
function abilityBlocker(id) {
  const def = abilityDef(id);
  if (!def || state.run.lost || state.run.won) return "Not available";
  if (state.run.location !== "dungeon") return "Dungeon action";
  if (!abilityUnlocked(id)) return t("Unlocks at level {0}", { 0: def.level });
  if (def.cost === "slot" && state.run.spellSlots < 1 && !canOverchannel(abilityLegacyView(def))) return "No spell slots";
  if (def.cost === "cooldown" && abilityCooldown(id) > 0) return t("Ready in {0} turns", { 0: abilityCooldown(id) });
  if (def.heal) {
    if (!def.noFood && !canHeal()) return "Needs food at 75%";
    if (!healNeeded(def) && !(def.effect && !heroEffect(def.effect.kind))) return def.party ? "Everyone is at full HP" : "Already at full HP";
  }
  if (def.restoreSlots && state.run.spellSlots >= maxSpellSlots(state.run.character.class, state.run.level)) return "Spell slots are full";
  if (def.effect && !def.heal) {
    if (heroEffect(def.effect.kind)) return "Already active";
    if (def.effect.kind === "regen" && !canHeal()) return "Needs food at 75%";
  }
  if (def.summon && !summonSpot() && !battlefield().summons.some((summon) => summon.kind === def.summon.kind)) return "No room beside you";
  if (def.teleport && !mirrorStepSpot(def.teleport)) return "Nowhere to step";
  if (def.vanish && !state.run.enemies.some((enemy) => enemy.alive && enemy.alerted && distanceInSquares(enemy, state.run.player) > 1)) return "No creature has noticed you";
  if (["enemy", "line", "adjacent", "shot"].includes(def.target)) {
    if (!abilityTargets(def).length) return def.target === "adjacent" ? "Needs a creature beside you" : def.target === "shot" ? "No creature in reach of your weapon" : "Needs target in sight";
  }
  if (def.target === "around" && !abilityVictims(def).length) return "No creature in reach";
  if (def.field?.kind === "glyph" && battlefield().fields.some((field) => field.kind === "glyph" &&
    field.tiles.some((tile) => tile.x === state.run.player.x && tile.y === state.run.player.y))) return "Already a glyph here";
  return "";
}

// ---------- Using an ability ----------

function useAbility(id, chosenTarget = null) {
  const def = abilityDef(id);
  if (!def || !classAbilityIds().includes(id)) return;
  const blocker = abilityBlocker(id);
  if (blocker) {
    showToast(blocker);
    return;
  }
  const name = def.name;
  let target = null;
  if (["enemy", "adjacent", "line", "shot"].includes(def.target)) {
    const targets = abilityTargets(def);
    if (!chosenTarget && targets.length > 1) {
      chooseAbilityTarget(id, def, targets);
      return;
    }
    target = chosenTarget || targets[0];
    if (!targets.includes(target)) {
      showToast("That creature is no longer a valid target.");
      return;
    }
  }
  payAbilityCost(id, def);
  if (def.cost !== "free" && def.roll !== "weapon") sfx("spell");
  if (target) {
    showSpellEffect(state.run.player.x, state.run.player.y, target.x, target.y, def.strike || "", { enemyId: target.id || "" });
  } else if (def.effect?.kind !== "surge" || def.target === "self") {
    showSpellEffect(state.run.player.x, state.run.player.y, state.run.player.x, state.run.player.y, def.strike || "");
  }
  if (def.effect?.kind === "surge") {
    abilityState().effects.surge = { turns: 1 };
    addLog(`${def.name}: your next action doesn't end your turn.`);
    render();
    return;
  }
  const finished = resolveAbility(id, def, target);
  if (!finished) finishPlayerTurn();
}

function chooseAbilityTarget(id, def, targets) {
  chooseFromOptions(t("Choose a target for {0}", { 0: t(def.name) }), targets.map((enemy) => {
    const caught = def.area || def.target === "line" ? abilityVictims(def, enemy).length : 0;
    const extra = caught > 1 ? ` · ${t("hits {0}", { 0: caught })}` : "";
    return {
      label: `${enemy.name} · ${distanceInSquares(enemy, state.run.player)} squares · ${enemy.hp}/${enemy.maxHp} HP${extra}${def.strike ? strikeForecastLabel(enemy, def.strike) : ""}`,
      action: () => useAbility(id, enemy)
    };
  }));
}

function payAbilityCost(id, def) {
  if (def.cost === "slot") {
    if (state.run.spellSlots > 0) state.run.spellSlots -= 1;
    else payOverchannel();
  }
  if (def.cost === "cooldown") abilityState().cooldowns[id] = def.cooldown || 1;
}

// Returns true when it already ended the turn (weapon techniques go through attackEnemy).
function resolveAbility(id, def, target) {
  if (def.heal) {
    abilityHeal(def);
    if (def.effect) startHeroEffect(def);
    return false;
  }
  if (def.restoreSlots) {
    const max = maxSpellSlots(state.run.character.class, state.run.level);
    const before = state.run.spellSlots;
    state.run.spellSlots = Math.min(max, state.run.spellSlots + def.restoreSlots);
    const regained = state.run.spellSlots - before;
    addLog(regained === 1 ? "You read back the day you saved: 1 spell slot restored." : `You read back the day you saved: ${regained} spell slots restored.`);
    showCombatFeedback("heal", t(def.name), { actor: "player", x: state.run.player.x, y: state.run.player.y });
    return false;
  }
  if (def.effect) {
    startHeroEffect(def);
    return false;
  }
  if (def.summon) {
    callSummon(def);
    return false;
  }
  if (def.teleport) {
    mirrorStep(def);
    return false;
  }
  if (def.vanish) {
    vanish();
    return false;
  }
  if (def.roll === "weapon") return weaponTechnique(id, def, target);
  if (def.field) {
    placeField(id, def, target);
    return false;
  }
  castAreaOrBolt(id, def, target);
  return false;
}

// Companions (and your nahual) close enough to share a group heal.
function companionsInReach(radius) {
  return (state.run.party || []).filter((companion) => Number.isInteger(companion.x) && Number.isInteger(companion.y) &&
    distanceInSquares(companion, state.run.player) <= radius);
}

function healNeeded(def) {
  if (state.run.hp < state.run.maxHp) return true;
  if (def.cure && progress().conditions.length) return true;
  if (!def.party) return false;
  if (companionsInReach(def.party).some((companion) => companion.hp > 0 ? companion.hp < companion.maxHp : Boolean(def.revive))) return true;
  return battlefield().summons.some((summon) => summon.hp > 0 && summon.hp < summon.maxHp && distanceInSquares(summon, state.run.player) <= def.party);
}

function abilityHeal(def) {
  const dice = abilityDice(def.heal, def);
  const bonus = def.healPerLevel ? state.run.level : abilityStatModifier();
  const rollHealing = () => Math.max(1, rollDiceText(dice) + bonus);
  const restored = Math.min(rollHealing(), state.run.maxHp - state.run.hp);
  state.run.hp += restored;
  sfx("heal");
  if (def.party) addLog(`You use ${def.name}: you recover ${restored} hit points.`);
  else addLog(`You use ${def.name} and recover ${restored} hit points.`);
  if (restored > 0) showCombatFeedback("heal", `+${restored} HP`, { actor: "player", x: state.run.player.x, y: state.run.player.y });
  if (def.cure && progress().conditions.length) clearConditions("What ailed you lets go.");
  if (!def.party) return;
  for (const companion of companionsInReach(def.party)) {
    if (companion.hp <= 0 && !def.revive) continue;
    const before = Math.max(0, companion.hp);
    const healed = Math.min(rollHealing(), companion.maxHp - before);
    if (healed <= 0) continue;
    const revived = companion.hp <= 0;
    companion.hp = before + healed;
    addLog(revived ? `${companion.name} gets back up with ${companion.hp} hit points.` : `${companion.name} recovers ${healed} hit points.`);
    showCombatFeedback("heal", `+${healed} HP`, { actor: "companion", x: companion.x, y: companion.y, companionId: companion.id });
  }
  for (const summon of battlefield().summons) {
    if (summon.hp <= 0 || distanceInSquares(summon, state.run.player) > def.party) continue;
    summon.hp = Math.min(summon.maxHp, summon.hp + rollHealing());
  }
}

function startHeroEffect(def) {
  const effect = { ...def.effect };
  abilityState().effects[effect.kind] = effect;
  const lines = {
    rage: "You rage: +2 weapon damage and 3 less damage from every hit for 10 turns.",
    regen: "Ceiba's Shelter: you'll mend a little every turn for 10 turns.",
    deflect: "You settle into Deflect: +4 AC for 2 turns.",
    dawn: "Aura of Dawn: +1 AC, and the restless dead beside you burn, for 10 turns.",
    shield: "Shield of the Fifth Sun: wounds are halved for 3 turns.",
    inspired: "The Flower Song carries you: +2 to attack rolls for 6 turns.",
    indomitable: "Indomitable: for 3 turns, no blow can drop you below 1 hit point."
  };
  addLog(lines[effect.kind] || `${def.name}.`);
  if (def.cure && !def.heal && progress().conditions.length) clearConditions("What ailed you lets go.");
  showCombatFeedback("heal", t(def.name), { actor: "player", x: state.run.player.x, y: state.run.player.y });
}

// ---------- Bolts, bursts, lines ----------

function castAreaOrBolt(id, def, target) {
  const victims = def.target === "around" || def.target === "line" || def.area ? abilityVictims(def, target) : [target];
  flashArea(def, abilityAreaTiles(def, target));
  makeNoise(target || state.run.player, 4);
  if (def.backlash) {
    const backlash = Math.min(state.run.hp - 1, rollDiceText(def.backlash));
    if (backlash > 0) {
      state.run.hp -= backlash;
      addLog(`The flare bites you too: ${backlash} damage.`);
    }
  }
  if (!victims.length) {
    addLog(`Your ${def.name} finds nothing to strike.`);
    return;
  }
  const dc = abilitySaveDc();
  for (const victim of victims) {
    if (!victim.alive || state.run.lost) continue;
    abilityStrikeCreature(def, victim, { dc, area: victims.length > 1 });
  }
}

// One creature takes one ability: roll, damage, and what it does on a hit or failed save.
function abilityStrikeCreature(def, victim, { dc = abilitySaveDc(), area = false } = {}) {
  const unaware = !victim.alerted || Boolean(victim.asleep);
  provokeCreature(victim);
  let landed = true;
  let saved = false;
  let critical = false;
  let rollText = "";
  if (def.roll === "attack") {
    const bonus = abilityAttackBonus(victim);
    const roll = rollD20({ advantage: unaware, disadvantage: !area && enemiesAdjacent().length > 0 && distanceInSquares(victim, state.run.player) > 1 });
    let attackRoll = roll;
    const ac = creatureArmorClass(victim);
    if ((attackRoll.die === 1 || (attackRoll.die !== 20 && attackRoll.die + bonus < ac)) && knackRerollMiss()) {
      addLog("Lucky Verse: you hum a line and try again.");
      attackRoll = rollD20({ advantage: unaware, disadvantage: false });
    }
    critical = attackRoll.die === 20;
    landed = critical || (attackRoll.die !== 1 && attackRoll.die + bonus >= ac);
    rollText = `d20 ${attackRoll.die} + ${bonus} = ${attackRoll.die + bonus} vs. AC ${ac}`;
  } else if (def.roll === "save") {
    const forced = def.on?.markFull && victim.mark?.turns > 0;
    const save = forced ? { success: false, die: 0, total: 0 } : creatureSaves(victim, dc);
    saved = save.success;
    landed = !saved || Boolean(def.half);
    rollText = forced ? "marked: no save" : `${t(SAVE_NAMES[def.save] || "Dexterity")} save ${save.total} vs. DC ${dc}`;
  }
  if (!landed) {
    if (def.roll === "attack") addLog(`Your ${def.name} misses ${victim.name} (${rollText}).`);
    else addLog(`${victim.name} shrugs off your ${def.name} (${rollText}).`);
    return;
  }
  let damage = 0;
  if (def.damage) {
    const dice = abilityDice(def.damage, def);
    damage = rollDiceText(dice) + (critical ? rollDiceText(dice) : 0);
    if (def.on?.rootedBonus && (victim.rooted > 0 || creatureInField(victim))) damage += rollDiceText(def.on.rootedBonus);
    if (def.on?.baneDead && isRestlessDead(victim)) damage *= 2;
    damage += playerDamageRider(victim);
    if (saved && def.half) damage = Math.floor(damage / 2);
  }
  if (damage > 0) {
    dealAbilityDamage(def, victim, damage, rollText, critical);
  } else if (!saved && def.roll === "save") {
    addLog(`${victim.name} fails to resist your ${def.name} (${rollText}).`);
  }
  if (!saved && victim.alive && victim.hp > 0) applyAbilityConditions(def, victim, damage);
  if (def.on?.arc && damage > 0) arcLightning(def, victim, damage);
}

function dealAbilityDamage(def, victim, rawDamage, rollText = "", critical = false) {
  const struck = applyStrike(victim, def.strike || "", rawDamage);
  const damage = struck.damage;
  const before = victim.hp;
  victim.hp = Math.max(0, victim.hp - damage);
  addLog(`Your ${def.name} hits ${victim.name} for ${damage} damage${rollText ? ` (${rollText})` : ""}.`);
  logStrike(struck);
  showCombatFeedback(critical ? "critical" : "hit", `−${damage} HP${struck.outcome === "weak" ? ` · ${t("Weak spot!")}` : struck.outcome === "resist" ? ` · ${t("Glances off")}` : ""}`,
    { actor: "enemy", x: victim.x, y: victim.y, enemyId: victim.id });
  if (def.on?.drain) {
    const healed = Math.min(Math.floor(Math.min(damage, before) / 2), state.run.maxHp - state.run.hp);
    if (healed > 0) {
      state.run.hp += healed;
      addLog(`Your patron feeds you ${healed} hit points of it.`);
    }
  }
  if (victim.hp <= 0) creatureFallsToAbility(victim);
  return damage;
}

function creatureFallsToAbility(victim) {
  const curse = victim.curse;
  resolveEnemyDefeat(victim);
  if (curse?.turns > 0) {
    const healed = Math.min(rollDiceText(curse.heal || "1d8") + state.run.level, state.run.maxHp - state.run.hp);
    if (healed > 0) {
      state.run.hp += healed;
      addLog(`The curse comes due: your patron shares ${healed} hit points with you.`);
      showCombatFeedback("heal", `+${healed} HP`, { actor: "player", x: state.run.player.x, y: state.run.player.y });
    }
  }
}

// Extra damage you deal to a creature you've marked or cursed (weapon and spell alike).
function playerDamageRider(enemy) {
  let bonus = 0;
  if (enemy.mark?.turns > 0) bonus += rollDiceText(enemy.mark.damage || "1d6");
  if (enemy.curse?.turns > 0) bonus += rollDiceText(enemy.curse.damage || "1d6");
  return bonus;
}

function applyAbilityConditions(def, victim, damage) {
  const on = def.on || {};
  if (on.distract) {
    victim.distracted = true;
    addLog(`${victim.name} flinches: its next attack is at a disadvantage.`);
  }
  if (on.sleep) {
    victim.asleep = on.sleep;
    victim.sleepHp = victim.hp;
    victim.windup = null;
    addLog(`${victim.name} sinks into sleep.`);
  }
  if (on.discord) {
    victim.discord = on.discord;
    victim.windup = null;
    addLog(`${victim.name} turns on its own kind.`);
  }
  if (on.root) {
    victim.rooted = Math.max(victim.rooted || 0, on.root);
    addLog(`${victim.name} is pinned where it stands.`);
  }
  if (on.slow) {
    victim.slowed = Math.max(victim.slowed || 0, on.slow);
    victim.slowSkip = false;
    addLog(`${victim.name} slows to a crawl.`);
  }
  if (on.lose) {
    victim.alerted = false;
    victim.windup = null;
    victim.vanishGrace = 2;
    addLog(`${victim.name} loses sight of you in the smoke.`);
  }
  if (on.fleeDead && isRestlessDead(victim)) {
    victim.fleeTurns = Math.max(victim.fleeTurns || 0, on.fleeDead);
    victim.windup = null;
    addLog(`${victim.name} flees from the dawn.`);
  }
  if (on.flee) {
    victim.fleeTurns = Math.max(victim.fleeTurns || 0, on.flee);
    victim.windup = null;
    addLog(`${victim.name} flees from you.`);
  }
  if (on.mark) {
    for (const other of state.run.enemies) if (other.mark) other.mark = null;
    victim.mark = { ...on.mark };
    addLog(`You mark ${victim.name} as your quarry.`);
  }
  if (on.curse) {
    victim.curse = { ...on.curse };
    addLog(`${victim.name} is cursed.`);
  }
  if (on.push || on.pushFail) {
    const moved = pushCreature(victim, on.push || on.pushFail);
    if (on.slamDamage && moved < (on.push || on.pushFail) && victim.alive && victim.hp > 0) {
      const slam = rollDiceText(on.slamDamage);
      victim.hp = Math.max(0, victim.hp - slam);
      addLog(`${victim.name} slams into what's behind it for ${slam} damage.`);
      if (victim.hp <= 0) creatureFallsToAbility(victim);
    }
  }
}

// Jade Lightning: the hit leaps on to more creatures for half.
function arcLightning(def, first, damage) {
  const hit = new Set([first]);
  let from = first;
  for (let i = 0; i < (def.on.arc.count || 2); i += 1) {
    const next = livingCreatures().filter((enemy) => !hit.has(enemy) && distanceInSquares(enemy, from) <= (def.on.arc.reach || 3) &&
      hasLineOfSight(from, enemy)).sort((a, b) => distanceInSquares(a, from) - distanceInSquares(b, from))[0];
    if (!next) break;
    hit.add(next);
    provokeCreature(next);
    flashTiles([{ x: next.x, y: next.y }], def.strike);
    dealAbilityDamage({ ...def, name: def.name, on: {} }, next, Math.max(1, Math.floor(damage / 2)), t("arc"));
    from = next;
  }
}

// ---------- Weapon techniques ----------

function weaponTechnique(id, def, target) {
  if (def.target === "around") {
    const victims = abilityVictims(def);
    addLog(`${def.name}!`);
    victims.forEach((victim) => {
      if (victim.alive && !state.run.lost) attackEnemy(victim, { technique: def, noFinish: true });
    });
    finishPlayerTurn();
    return true;
  }
  if (def.chain) {
    const struck = new Set();
    let current = target;
    for (let i = 0; i < def.chain && current && !state.run.lost; i += 1) {
      const landing = leapLanding(current);
      if (!landing) break;
      leapTo(landing);
      struck.add(current);
      addLog(i === 0 ? `You leap at ${current.name}.` : `…and on to ${current.name}.`);
      attackEnemy(current, { technique: def, noFinish: true });
      current = livingCreatures().filter((enemy) => !struck.has(enemy) && distanceInSquares(enemy, state.run.player) <= abilityRange(def) &&
        hasLineOfSight(state.run.player, enemy) && leapLanding(enemy))
        .sort((a, b) => distanceInSquares(a, state.run.player) - distanceInSquares(b, state.run.player))[0] || null;
    }
    finishPlayerTurn();
    return true;
  }
  if (def.leap) {
    const landing = leapLanding(target, { crowded: Boolean(def.on?.quake) });
    if (!landing) {
      showToast("No room to land beside it.");
      return false;
    }
    state.run.player.x = landing.x;
    state.run.player.y = landing.y;
    state.run.currentRoom = roomIndexAt(landing.x, landing.y) >= 0 ? roomIndexAt(landing.x, landing.y) : state.run.currentRoom;
    refreshCompanionFormation();
    addLog(def.unseen ? `You step out of the shadow behind ${target.name}.` : `You leap at ${target.name}.`);
  }
  if (def.on?.quake) flashTiles(tilesWithin(state.run.player, 1), "crush");
  attackEnemy(target, { technique: def, ranged: def.target === "shot" && distanceInSquares(target, state.run.player) > 1 });
  return true;
}

function leapTo(landing) {
  state.run.player.x = landing.x;
  state.run.player.y = landing.y;
  const room = roomIndexAt(landing.x, landing.y);
  if (room >= 0) state.run.currentRoom = room;
  refreshCompanionFormation();
}

// Called by attackEnemy when a technique's weapon hit lands.
function techniqueOnHit(def, enemy, damage) {
  if (!def || !enemy.alive || enemy.hp <= 0) return;
  const on = def.on || {};
  if (on.stun) {
    enemy.staggered = true;
    enemy.windup = null;
    addLog(`${enemy.name} is knocked off balance and loses its next turn.`);
  }
  if (on.stunSave) {
    const dc = abilitySaveDc();
    const save = creatureSaves(enemy, dc);
    if (save.success) addLog(`${enemy.name} keeps its breath (Constitution save ${save.total} vs. DC ${dc}).`);
    else {
      enemy.staggered = true;
      enemy.windup = null;
      addLog(`${enemy.name} is stunned and loses its next turn (Constitution save ${save.total} vs. DC ${dc}).`);
    }
  }
  if (on.slow) applyAbilityConditions({ on: { slow: on.slow } }, enemy, damage);
  if (on.sweep || on.quake) {
    const dc = abilitySaveDc();
    const caught = enemiesAdjacent().filter((other) => other.alive && other.hp > 0 && (on.sweep || other !== enemy));
    for (const other of caught) {
      const save = creatureSaves(other, dc);
      const text = `${t(SAVE_NAMES[on.sweep || on.quake])} save ${save.total} vs. DC ${dc}`;
      if (save.success) {
        addLog(`${other.name} keeps its feet (${text}).`);
        continue;
      }
      if (on.quake) pushCreature(other, 1);
      other.staggered = true;
      other.windup = null;
      addLog(`${other.name} is knocked down and loses its next turn (${text}).`);
    }
  }
  if (on.push) pushCreature(enemy, on.push);
  if (on.quiver) {
    enemy.quiver = { turns: on.quiver.turns, damage: abilityDice(on.quiver.damage, def), dc: abilitySaveDc() };
    addLog(`${enemy.name}'s heart begins to ring.`);
  }
}

// Extra damage a technique adds to a weapon hit.
function techniqueBonusDamage(def, enemy) {
  if (!def) return 0;
  let bonus = 0;
  if (def.bonus) bonus += rollDiceText(abilityDice(def.bonus, def));
  if (def.deadBonus && isRestlessDead(enemy)) bonus += rollDiceText(abilityDice(def.deadBonus, def));
  if (def.markBonus && enemy.mark?.turns > 0) bonus += rollDiceText(abilityDice(def.markBonus, def));
  return bonus;
}

// ---------- Fields ----------

function placeField(id, def, target) {
  const field = def.field;
  const center = field.center === "self" ? { x: state.run.player.x, y: state.run.player.y } : { x: target.x, y: target.y };
  const radius = fieldRadius(field, center);
  const tiles = radius === 0 ? [center] : tilesWithin(center, radius);
  const entry = {
    id: `field-${abilityState().nextId++}`, ability: id, kind: field.kind, center, radius,
    tiles, turns: field.turns, dc: abilitySaveDc(), level: state.run.level
  };
  battlefield().fields.push(entry);
  makeNoise(center, 3);
  flashTiles(tiles, field.strike || field.kind);
  const lines = {
    roots: "Roots heave up through the floor.",
    storm: radius > 1 ? "Thunder breaks over the water and spreads wide." : "Thunder breaks overhead.",
    maw: "The floor opens onto Mictlan.",
    sacred: "You ring yourself in copal ash.",
    spring: "Clear water wells up around you.",
    caltrops: "Obsidian caltrops scatter across the floor.",
    glyph: "You paint a warding glyph on the floor.",
    swarm: "A cloud of grasshoppers boils up out of the cracks.",
    sanctuary: "The ceiba's shade falls around you."
  };
  addLog(lines[field.kind] || `${def.name}.`);
  // Damage and roots land the moment the field appears.
  if (["roots", "storm", "maw", "swarm", "sanctuary"].includes(field.kind)) {
    for (const victim of creaturesOnTiles(tiles)) {
      provokeCreature(victim);
      fieldAffects(entry, victim);
    }
  }
}

function fieldDef(field) {
  return abilityDef(field.ability)?.field || {};
}

function fieldAt(x, y, kinds = null) {
  return battlefield().fields.find((field) => field.turns > 0 && (!kinds || kinds.includes(field.kind)) &&
    field.tiles.some((tile) => tile.x === x && tile.y === y)) || null;
}

function creatureInField(enemy) {
  return Boolean(fieldAt(enemy.x, enemy.y, ["roots", "caltrops"]));
}

// What one field does to one creature standing in it.
function fieldAffects(field, victim) {
  if (!victim.alive || victim.hp <= 0) return;
  const def = fieldDef(field);
  const ability = abilityDef(field.ability);
  const name = ability?.name || "The field";
  if (def.deadOnly && !isRestlessDead(victim)) return;
  let saved = false;
  let saveText = "";
  if (def.save) {
    const save = creatureSaves(victim, field.dc);
    saved = save.success;
    saveText = `${t(SAVE_NAMES[def.save])} save ${save.total} vs. DC ${field.dc}`;
  }
  if (def.damage && (!saved || def.half)) {
    let damage = rollDiceText(spellDamageAtLevel(def.damage, field.level || state.run.level));
    if (saved) damage = Math.floor(damage / 2);
    if (damage > 0) {
      const dealt = dealAbilityDamage({ name, strike: def.strike, on: {} }, victim, damage, saveText);
      if (def.drain && dealt > 0 && state.run.hp < state.run.maxHp) {
        state.run.hp = Math.min(state.run.maxHp, state.run.hp + def.drain);
      }
    }
  }
  if (def.stagger && !saved && victim.alive && victim.hp > 0) {
    victim.staggered = true;
    victim.windup = null;
    addLog(`${victim.name} falters under the ceiba's shade (${saveText}).`);
  }
  if (def.slow && !saved && victim.alive && victim.hp > 0) {
    victim.slowed = Math.max(victim.slowed || 0, def.slow);
  }
  if (def.root && !saved && victim.alive && victim.hp > 0) {
    victim.rooted = Math.max(victim.rooted || 0, 1);
    if (!def.damage) addLog(`${name} holds ${victim.name} fast${saveText ? ` (${saveText})` : ""}.`);
  } else if (def.root && saved && !def.damage) {
    addLog(`${victim.name} tears free of ${name} (${saveText}).`);
  }
}

// A creature walks into a field: caltrops bite, glyphs go off.
function abilityFieldsOnEnter(enemy) {
  if (state.run.location !== "dungeon" || !enemy.alive) return;
  for (const field of [...battlefield().fields]) {
    if (field.turns <= 0) continue;
    if (field.kind === "glyph") {
      if (glyphTriggered(field, enemy)) explodeGlyph(field);
      continue;
    }
    if (fieldDef(field).onEnter && field.tiles.some((tile) => tile.x === enemy.x && tile.y === enemy.y)) fieldAffects(field, enemy);
  }
}

function glyphTriggered(field, enemy) {
  const trigger = fieldDef(field).trigger || { radius: 1 };
  return field.tiles.some((tile) => distanceInSquares(tile, enemy) <= trigger.radius);
}

function explodeGlyph(field) {
  const trigger = fieldDef(field).trigger;
  field.turns = 0;
  const center = field.center;
  const tiles = tilesWithin(center, trigger.radius || 1);
  flashTiles(tiles, trigger.strike);
  addLog("The warding glyph goes off!");
  makeNoise(center, 4);
  const def = { name: abilityDef(field.ability)?.name || "Warding Glyph", strike: trigger.strike, damage: trigger.damage, roll: "save", save: trigger.save, half: trigger.half, scale: true };
  for (const victim of creaturesOnTiles(tiles)) {
    provokeCreature(victim);
    abilityStrikeCreature(def, victim, { dc: field.dc, area: true });
  }
}

// ---------- The creature phase ----------

// Runs once at the start of every creature phase in the tomb.
function abilityCreaturePhase() {
  if (state.run.location !== "dungeon") return;
  const field = battlefield();
  for (const entry of field.fields) {
    if (entry.turns <= 0) continue;
    entry.turns -= 1;
    if (entry.kind === "glyph") {
      const trigger = livingCreatures().find((enemy) => glyphTriggered(entry, enemy));
      if (trigger) explodeGlyph(entry);
      continue;
    }
    if (entry.kind === "spring") {
      springHeals(entry);
      continue;
    }
    for (const victim of creaturesOnTiles(entry.tiles)) {
      if (state.run.lost) break;
      fieldAffects(entry, victim);
    }
  }
  field.fields = field.fields.filter((entry) => entry.turns > 0);
  dawnAuraBurns();
  for (const enemy of livingCreatures()) tickCreatureStatuses(enemy);
}

function springHeals(entry) {
  const heal = rollDiceText(fieldDef(entry).heal || "1d6");
  const onSpring = (who) => entry.tiles.some((tile) => tile.x === who.x && tile.y === who.y);
  if (onSpring(state.run.player) && state.run.hp < state.run.maxHp && state.run.hp > 0) {
    const restored = Math.min(heal, state.run.maxHp - state.run.hp);
    state.run.hp += restored;
    showCombatFeedback("heal", `+${restored} HP`, { actor: "player", x: state.run.player.x, y: state.run.player.y });
  }
  for (const summon of battlefield().summons) {
    if (onSpring(summon)) summon.hp = Math.min(summon.maxHp, summon.hp + heal);
  }
}

function dawnAuraBurns() {
  const dawn = heroEffect("dawn");
  if (!dawn) return;
  for (const enemy of enemiesAdjacent().filter(isRestlessDead)) {
    const damage = rollDiceText(spellDamageAtLevel(dawn.damage || "1d8", state.run.level));
    dealAbilityDamage({ name: "Aura of Dawn", strike: "sun", on: {} }, enemy, damage);
  }
}

function tickCreatureStatuses(enemy) {
  if (enemy.mark?.turns > 0 && --enemy.mark.turns <= 0) enemy.mark = null;
  if (enemy.curse?.turns > 0 && --enemy.curse.turns <= 0) enemy.curse = null;
  if (enemy.vanishGrace > 0) enemy.vanishGrace -= 1;
  if (enemy.quiver?.turns > 0) {
    enemy.quiver.turns -= 1;
    if (enemy.quiver.turns <= 0) {
      const quiver = enemy.quiver;
      enemy.quiver = null;
      const save = creatureSaves(enemy, quiver.dc);
      let damage = rollDiceText(quiver.damage);
      if (save.success) damage = Math.floor(damage / 2);
      addLog(`${enemy.name}'s heart cracks like a bell.`);
      dealAbilityDamage({ name: "Quivering Palm", strike: "crush", on: {} }, enemy, damage, `Constitution save ${save.total} vs. DC ${quiver.dc}`);
    }
  }
}

// Called for each creature in its turn, before it acts. True when it spends its turn here.
function creatureLosesTurnToAbility(enemy, distance) {
  if (enemy.slowed > 0) {
    enemy.slowed -= 1;
    enemy.slowSkip = !enemy.slowSkip;
    if (enemy.slowSkip) {
      if (distance <= 7) addLog(`${enemy.name} is slowed.`);
      return true;
    }
  }
  if (enemy.discord > 0) {
    enemy.discord -= 1;
    discordTurn(enemy);
    return true;
  }
  return false;
}

// Called after the creature's turn: roots wear off.
function afterCreatureTurn(enemy) {
  if (enemy.rooted > 0) enemy.rooted -= 1;
}

// A creature under the Song of Discord attacks the nearest other creature.
function discordTurn(enemy) {
  const others = livingCreatures().filter((other) => other !== enemy && distanceInSquares(other, enemy) <= 6)
    .sort((a, b) => distanceInSquares(a, enemy) - distanceInSquares(b, enemy));
  const victim = others[0];
  if (!victim) {
    addLog(`${enemy.name} looks around, confused.`);
    return;
  }
  if (distanceInSquares(victim, enemy) > 1) {
    moveCreature(enemy, creatureStepToward(enemy, victim, { adjacent: true }));
    return;
  }
  creatureStrikesCreature(enemy, victim);
}

function creatureStrikesCreature(attacker, victim) {
  const die = randomInt(20);
  if (die !== 20 && (die === 1 || die + (attacker.attackBonus || 0) < creatureArmorClass(victim))) {
    addLog(`${attacker.name} lunges at ${victim.name} and misses.`);
    return;
  }
  const damage = Math.max(1, rollDiceText(attacker.damage));
  victim.hp = Math.max(0, victim.hp - damage);
  victim.alerted = true;
  addLog(`${attacker.name} turns on ${victim.name} for ${damage} damage.`);
  showCombatFeedback("hit", `−${damage} HP`, { actor: "enemy", x: victim.x, y: victim.y, enemyId: victim.id });
  if (victim.hp <= 0) resolveEnemyDefeat(victim);
}

// ---------- Effects on you ----------

function heroAbilityModifiers() {
  const mods = { ac: 0, damage: 0, attack: 0 };
  if (state.run?.location !== "dungeon" || !state.run.abilityState) return mods;
  const inspired = heroEffect("inspired");
  if (inspired) mods.attack += inspired.attack || 2;
  const deflect = heroEffect("deflect");
  if (deflect) mods.ac += deflect.ac || 4;
  const dawn = heroEffect("dawn");
  if (dawn) mods.ac += dawn.ac || 1;
  if (heroEffect("rage")) mods.damage += 2;
  const sacred = fieldAt(state.run.player.x, state.run.player.y, ["sacred"]);
  if (sacred) mods.ac += fieldDef(sacred).ac || 2;
  return mods;
}

// Damage you take after rage and the Fifth Sun shield.
function heroDamageAfterAbilities(damage) {
  if (state.run?.location !== "dungeon" || !state.run.abilityState) return damage;
  let result = damage;
  if (heroEffect("rage")) result = Math.max(1, result - 3);
  if (heroEffect("shield")) result = Math.max(1, Math.floor(result / 2));
  if (heroEffect("indomitable") && state.run.hp > 1 && result >= state.run.hp) {
    result = state.run.hp - 1;
    addLog("Indomitable: you stay on your feet.");
  }
  return result;
}

function heroExposed() {
  return Boolean(heroEffect("exposed"));
}

// The surge: the next action after Action Surge doesn't hand the turn to the creatures.
function consumeActionSurge() {
  const s = abilityState();
  if (!s.effects.surge) return false;
  delete s.effects.surge;
  return true;
}

// Once per turn in the tomb, after your action.
function abilityTurnTick() {
  if (state.run.location !== "dungeon") return;
  const s = abilityState();
  for (const id of Object.keys(s.cooldowns)) {
    s.cooldowns[id] -= 1;
    if (s.cooldowns[id] <= 0) delete s.cooldowns[id];
  }
  const regen = heroEffect("regen");
  if (regen && state.run.hp > 0 && state.run.hp < state.run.maxHp) {
    const healed = Math.min(rollDiceText(regen.dice || "1d6"), state.run.maxHp - state.run.hp);
    state.run.hp += healed;
  }
  for (const [kind, effect] of Object.entries(s.effects)) {
    if (kind === "surge") continue;
    if (effect.turns !== undefined) {
      effect.turns -= 1;
      if (effect.turns <= 0) {
        delete s.effects[kind];
        const ended = { rage: "Your rage burns out.", regen: "Ceiba's Shelter fades.", dawn: "Your Aura of Dawn fades.", shield: "The Fifth Sun's shield fades.", inspired: "The Flower Song fades.", indomitable: "", deflect: "" }[kind];
        if (ended) addLog(ended);
      }
    }
  }
}

// ---------- Summons ----------

function summonSpot() {
  return MOVEMENT_DIRECTIONS.map((direction) => ({ x: state.run.player.x + direction.x, y: state.run.player.y + direction.y }))
    .find((spot) => isWalkable(spot.x, spot.y) && !tileHasCreature(spot.x, spot.y) &&
      !state.run.hazards.some((hazard) => !hazard.triggered && hazard.x === spot.x && hazard.y === spot.y)) || null;
}

function summonAt(x, y) {
  if (state.run?.location !== "dungeon" || !state.run.abilityState) return null;
  return battlefield().summons.find((summon) => summon.hp > 0 && summon.x === x && summon.y === y) || null;
}

function nahualStats() {
  const level = state.run.level;
  return {
    maxHp: 5 + level * 3,
    ac: 12 + Math.floor(level / 4),
    attackBonus: abilityAttackBonus(),
    damage: spellDamageAtLevel("1d8", level),
    damageBonus: Math.max(0, abilityStatModifier())
  };
}

function callSummon(def) {
  const field = battlefield();
  const existing = field.summons.find((summon) => summon.kind === def.summon.kind);
  const stats = nahualStats();
  if (existing) {
    Object.assign(existing, stats, { hp: stats.maxHp, turns: def.summon.turns });
    addLog("Your nahual shakes itself whole again.");
    return;
  }
  const spot = summonSpot();
  field.summons.push({
    id: `summon-${abilityState().nextId++}`, kind: def.summon.kind, name: "Nahual", x: spot.x, y: spot.y,
    hp: stats.maxHp, turns: def.summon.turns, ...stats
  });
  flashTiles([spot], "night");
  addLog("A jaguar of smoke and spots steps out of you: your nahual.");
}

// Summons act after you and before the creatures.
function summonsTakeTurn() {
  if (state.run.location !== "dungeon") return;
  const field = battlefield();
  for (const summon of field.summons) {
    if (summon.hp <= 0) continue;
    summon.turns -= 1;
    if (summon.turns <= 0) {
      summon.hp = 0;
      addLog("Your nahual fades back into you.");
      continue;
    }
    const foes = livingCreatures().filter((enemy) => enemy.alerted && !enemy.asleep && distanceInSquares(enemy, summon) <= 8 &&
      hasLineOfSight(summon, enemy));
    const adjacent = foes.filter((enemy) => distanceInSquares(enemy, summon) === 1)
      .sort((a, b) => a.hp - b.hp)[0];
    if (adjacent) {
      summonAttacks(summon, adjacent);
      continue;
    }
    const nearest = foes.sort((a, b) => distanceInSquares(a, summon) - distanceInSquares(b, summon))[0];
    const goal = nearest || (distanceInSquares(summon, state.run.player) > 2 ? state.run.player : null);
    if (!goal) continue;
    const step = creatureStepToward(summon, goal, { adjacent: true });
    if (step && !(step.x === state.run.player.x && step.y === state.run.player.y)) {
      summon.x = step.x;
      summon.y = step.y;
    }
  }
  field.summons = field.summons.filter((summon) => summon.hp > 0);
}

function summonAttacks(summon, enemy) {
  showStrikeEffect("companion", summon.x, summon.y, enemy.x, enemy.y, { enemyId: enemy.id, companionId: summon.id });
  const die = randomInt(20);
  const ac = creatureArmorClass(enemy);
  if (die !== 20 && (die === 1 || die + summon.attackBonus < ac)) {
    addLog(`Your nahual swipes at ${enemy.name} and misses.`);
    return;
  }
  const dice = summon.damage || "1d8";
  const raw = rollDiceText(dice) + (die === 20 ? rollDiceText(dice) : 0) + (summon.damageBonus || 0);
  const struck = applyStrike(enemy, "edge", Math.max(1, raw));
  enemy.hp = Math.max(0, enemy.hp - struck.damage);
  provokeCreature(enemy);
  addLog(`Your nahual mauls ${enemy.name} for ${struck.damage} damage.`);
  logStrike(struck);
  showCombatFeedback("hit", `−${struck.damage} HP`, { actor: "enemy", x: enemy.x, y: enemy.y, enemyId: enemy.id });
  if (enemy.hp <= 0) creatureFallsToAbility(enemy);
}

// A creature beside your nahual may go for it instead of you. True when it did.
function creatureAttacksSummon(enemy, distanceToPlayer) {
  if (state.run.location !== "dungeon" || !state.run.abilityState) return false;
  const summon = battlefield().summons.find((entry) => entry.hp > 0 && distanceInSquares(entry, enemy) === 1);
  if (!summon) return false;
  if (distanceToPlayer === 1 && Math.random() < 0.5) return false;
  const die = randomInt(20);
  if (die !== 20 && (die === 1 || die + (enemy.attackBonus || 0) < summon.ac)) {
    addLog(`${enemy.name} snaps at your nahual and misses.`);
    return true;
  }
  const damage = Math.max(1, rollDiceText(enemy.damage));
  summon.hp = Math.max(0, summon.hp - damage);
  showStrikeEffect("enemy", enemy.x, enemy.y, summon.x, summon.y, { enemyId: enemy.id, companionId: summon.id });
  if (summon.hp <= 0) addLog(`${enemy.name} tears your nahual apart; it scatters into smoke.`);
  else addLog(`${enemy.name} hits your nahual for ${damage} damage.`);
  return true;
}

// ---------- Movement abilities ----------

function vanish() {
  let lost = 0;
  for (const enemy of state.run.enemies) {
    if (!enemy.alive || !enemy.alerted || distanceInSquares(enemy, state.run.player) <= 1) continue;
    enemy.alerted = false;
    enemy.windup = null;
    enemy.vanishGrace = 2;
    lost += 1;
  }
  addLog(lost === 1 ? "You vanish. One creature loses track of you." : `You vanish. ${lost} creatures lose track of you.`);
}

function mirrorStepSpot(reach) {
  const threats = livingCreatures().filter((enemy) => enemy.alerted);
  let best = null;
  let bestScore = -Infinity;
  for (let y = state.run.player.y - reach; y <= state.run.player.y + reach; y += 1) {
    for (let x = state.run.player.x - reach; x <= state.run.player.x + reach; x += 1) {
      if (!tileInMap(x, y) || !isWalkable(x, y) || tileHasCreature(x, y) || summonAt(x, y)) continue;
      if (x === state.run.player.x && y === state.run.player.y) continue;
      if (!state.run.seen[tileIndex(x, y)] || !hasLineOfSight(state.run.player, { x, y })) continue;
      if (state.run.hazards.some((hazard) => !hazard.triggered && hazard.x === x && hazard.y === y)) continue;
      const nearest = threats.length ? Math.min(...threats.map((enemy) => distanceInSquares(enemy, { x, y }))) : distanceInSquares({ x, y }, state.run.player);
      if (nearest > bestScore) {
        bestScore = nearest;
        best = { x, y };
      }
    }
  }
  return best;
}

function mirrorStep(def) {
  const spot = mirrorStepSpot(def.teleport);
  if (!spot) return;
  flashTiles([{ x: state.run.player.x, y: state.run.player.y }, spot], "night");
  state.run.player.x = spot.x;
  state.run.player.y = spot.y;
  const room = roomIndexAt(spot.x, spot.y);
  if (room >= 0 && room !== state.run.currentRoom) {
    state.run.currentRoom = room;
    resolveRoomEntry(room);
  }
  refreshCompanionFormation();
  addLog("You step through the smoking mirror and out across the room.");
}

// ---------- Visuals ----------

function flashTiles(tiles, element = "") {
  const until = Date.now() + 650;
  for (const tile of tiles) {
    state.combatEffects.push({ kind: "area", element: element || "", actor: "area", x: tile.x, y: tile.y, until });
  }
  window.setTimeout(() => {
    state.combatEffects = state.combatEffects.filter((effect) => effect.kind !== "area" || effect.until > Date.now());
    if (state.gameStarted && state.run?.location === "dungeon") renderMap();
  }, 680);
}

function flashArea(def, tiles) {
  if (tiles.length > 1 || def.target === "around") flashTiles(tiles, def.strike || "");
}

// ---------- Rules text ----------

function abilityDamageText(dice, def) {
  return abilityDice(dice, def);
}

// The rules for one ability as the ability guide shows them, built from its numbers.
function abilityRulesText(id) {
  const def = abilityDef(id);
  if (!def) return "";
  const parts = [];
  const strike = def.strike ? t(STRIKE_KINDS[def.strike]?.name || def.strike) : "";
  const dmg = def.damage ? abilityDamageText(def.damage, def) : "";
  const save = def.save ? t(SAVE_NAMES[def.save]) : "";
  if (def.target === "enemy" && def.area) parts.push(t("Lands on a creature within {0} squares and everything within {1} of it.", { 0: abilityRange(def), 1: def.area.radius }));
  else if (def.target === "enemy" && !def.leap && !def.field) parts.push(t("Targets a creature within {0} squares that you can see.", { 0: abilityRange(def) }));
  else if (def.target === "around") parts.push(t("Hits every creature within {0} squares of you.", { 0: def.radius || 1 }));
  else if (def.target === "line") parts.push(t("A line {0} squares long toward a creature you can see.", { 0: def.length || 7 }));
  else if (def.target === "adjacent" && def.roll === "weapon") parts.push(t("A weapon attack against a creature beside you."));
  if (def.leap) parts.push(def.unseen
    ? t("Appear beside a creature within {0} squares and attack it as if it hadn't seen you (Sneak Attack applies).", { 0: abilityRange(def) })
    : t("Leap beside a creature within {0} squares and make a weapon attack.", { 0: abilityRange(def) }));
  if (def.target === "around" && def.roll === "weapon") parts.push(t("Make a weapon attack against each of them."));
  if (def.roll === "attack" && dmg) parts.push(t("Spell attack: {0} {1} damage on a hit.", { 0: dmg, 1: strike }));
  if (def.roll === "save" && dmg) parts.push(def.half
    ? t("{0} save: {1} {2} damage, half on a success.", { 0: save, 1: dmg, 2: strike })
    : t("{0} save or take {1} {2} damage.", { 0: save, 1: dmg, 2: strike }));
  if (def.roll === "save" && !dmg) parts.push(t("{0} save to resist.", { 0: save }));
  if (def.roll === "auto" && dmg) parts.push(t("Never misses: {0} {1} damage.", { 0: dmg, 1: strike }));
  if (def.advantage) parts.push(t("Roll with advantage, but attacks against you have advantage until your next turn."));
  if (def.target === "shot") parts.push(t("A weapon attack against a creature your weapon can reach (beside you, or in range of a bow or sling)."));
  if (def.chain) parts.push(t("Then leap on to another creature within {0} squares and strike again, up to {1} creatures in all.", { 0: abilityRange(def), 1: def.chain }));
  if (def.bonus && def.deadBonus) parts.push(t("On a hit, +{0} {1} damage (+{2} more against the restless dead).", { 0: abilityDice(def.bonus, def), 1: strike, 2: abilityDice(def.deadBonus, def) }));
  else if (def.bonus) parts.push(t("On a hit, +{0} damage.", { 0: abilityDice(def.bonus, def) }));
  if (def.markBonus) parts.push(t("Against your marked quarry, +{0} more.", { 0: abilityDice(def.markBonus, def) }));
  const on = def.on || {};
  if (on.distract) parts.push(t("On a hit, its next attack has disadvantage."));
  if (on.pushFail) parts.push(t("Creatures that fail are hurled {0} squares away from you.", { 0: on.pushFail }));
  if (on.sleep) parts.push(t("Those that fail fall asleep for {0} turns, or until hurt.", { 0: on.sleep }));
  if (on.discord) parts.push(t("If it fails, for {0} turns it attacks the nearest other creature instead of you.", { 0: on.discord }));
  if (on.baneDead) parts.push(t("The restless dead take double damage."));
  if (on.rootedBonus) parts.push(t("+{0} against a creature that is rooted or standing in roots or caltrops.", { 0: on.rootedBonus }));
  if (on.stun) parts.push(t("On a hit, it's knocked back 1 square and loses its next turn."));
  if (on.stunSave) parts.push(t("On a hit, it makes a Constitution save (DC {0}) or loses its next turn.", { 0: abilitySaveDc() }));
  if (on.slow) parts.push(t("Slowed for {0} turns: it acts only every other turn.", { 0: on.slow }));
  if (on.flee) parts.push(t("Those that fail flee from you for {0} turns.", { 0: on.flee }));
  if (on.root) parts.push(t("On a hit, it's rooted for {0} turns: it can't move, but can still fight.", { 0: on.root }));
  if (on.mark) parts.push(t("Marks it for {0} turns: your weapon and spell hits on it deal +{1}. One mark at a time.", { 0: on.mark.turns, 1: on.mark.damage }));
  if (on.markFull) parts.push(t("Your marked quarry gets no save."));
  if (on.curse) parts.push(t("Curses it for {0} turns: everything you do to it deals +{1}, and if it dies cursed you regain {2} + your level in HP.", { 0: on.curse.turns, 1: on.curse.damage, 2: on.curse.heal }));
  if (on.drain) parts.push(t("Heals you for half the damage it deals."));
  if (on.arc) parts.push(t("Then it leaps to up to {0} more creatures within {1} squares of each other for half damage.", { 0: on.arc.count, 1: on.arc.reach }));
  if (on.push && !on.stun) parts.push(on.slamDamage
    ? t("Hurls it back {0} squares; if something stops it, it takes {1} more.", { 0: on.push, 1: on.slamDamage })
    : t("On a hit, it's knocked back {0} square.", { 0: on.push }));
  if (on.sweep) parts.push(t("On a hit, it and every other creature beside you make a {0} save (DC {1}) or are knocked down and lose their next turn.", { 0: t(SAVE_NAMES[on.sweep]), 1: abilitySaveDc() }));
  if (on.quake) parts.push(t("Where you land, every other creature beside you makes a {0} save (DC {1}) or is thrown back 1 square and loses its next turn.", { 0: t(SAVE_NAMES[on.quake]), 1: abilitySaveDc() }));
  if (on.lose) parts.push(t("Those that fail lose track of you, and your next attack on one counts as unseen."));
  if (on.fleeDead) parts.push(t("The restless dead that fail flee from you for {0} turns.", { 0: on.fleeDead }));
  if (on.quiver) parts.push(t("On a hit, {0} turns later it takes {1} crushing damage (Constitution save for half).", { 0: on.quiver.turns, 1: abilityDice(on.quiver.damage, def) }));
  if (def.field) {
    const f = def.field;
    const where = f.center === "self" ? t("around you") : t("around a creature within {0} squares", { 0: abilityRange(def) });
    if (f.kind === "roots") parts.push(t("Roots fill {0} for {1} turns. Creatures in them make a {2} save each turn or are rooted.", { 0: where, 1: f.turns, 2: t(SAVE_NAMES[f.save]) }));
    if (f.kind === "storm") parts.push(t("A storm hangs {0} for {1} turns: {2} {3} damage to everything under it each turn ({4} save for half). Over water it spreads one square wider.", { 0: where, 1: f.turns, 2: abilityDice(f.damage, def), 3: t(STRIKE_KINDS[f.strike].name), 4: t(SAVE_NAMES[f.save]) }));
    if (f.kind === "maw") parts.push(t("The ground {0} bites for {1} turns: {2} {3} damage each turn ({4} save for half), and you regain 1 HP for each creature it hurts.", { 0: where, 1: f.turns, 2: abilityDice(f.damage, def), 3: t(STRIKE_KINDS[f.strike].name), 4: t(SAVE_NAMES[f.save]) }));
    if (f.kind === "sacred") parts.push(t("For {0} turns, the restless dead standing within 1 square of where you cast it take {1} sun-fire damage each turn, and you have +{2} AC while you stand in it.", { 0: f.turns, 1: abilityDice(f.damage, def), 2: f.ac }));
    if (f.kind === "spring") parts.push(t("For {0} turns, you and your nahual regain {1} HP each turn while standing within 1 square of where you cast it.", { 0: f.turns, 1: f.heal }));
    if (f.kind === "caltrops") parts.push(t("Caltrops cover {0} for {1} turns: anything walking through takes {2} damage and is rooted for a turn ({3} save avoids it).", { 0: where, 1: f.turns, 2: f.damage, 3: t(SAVE_NAMES[f.save]) }));
    if (f.kind === "sanctuary") parts.push(t("For {0} turns, every creature within {1} squares of where you cast it makes a {2} save each turn or loses its turn.", { 0: f.turns, 1: f.radius, 2: t(SAVE_NAMES[f.save]) }));
    if (f.kind === "swarm") parts.push(t("A swarm covers {0} for {1} turns: {2} {3} damage to everything in it each turn ({4} save for half), and those that fail are slowed.", { 0: t("everything within {0} squares of a creature within {1} squares", { 0: f.radius, 1: abilityRange(def) }), 1: f.turns, 2: abilityDice(f.damage, def), 3: t(STRIKE_KINDS[f.strike].name), 4: t(SAVE_NAMES[f.save]) }));
    if (f.kind === "glyph") parts.push(t("Lasts {0} turns. When a creature comes within 1 square of it, it bursts: {1} crushing damage to everything within 1 square ({2} save for half).", { 0: f.turns, 1: abilityDice(f.trigger.damage, def), 2: t(SAVE_NAMES[f.trigger.save]) }));
  }
  if (def.summon) {
    const stats = nahualStats();
    parts.push(t("Your nahual fights beside you for {0} turns ({1} HP, AC {2}, {3}+{4} damage). Creatures beside it often attack it instead of you. Casting again restores it.", { 0: def.summon.turns, 1: stats.maxHp, 2: stats.ac, 3: stats.damage, 4: stats.damageBonus }));
  }
  if (def.heal) {
    parts.push(def.healPerLevel
      ? t("Regain {0} + your level in HP. Works on an empty stomach.", { 0: abilityDice(def.heal, def) })
      : t("Regain {0} + your {1} modifier in HP. Needs food at 75%.", { 0: abilityDice(def.heal, def), 1: t(ABILITIES.find(([key]) => key === abilityCastingStat())?.[1] || "") }));
    if (def.cure) parts.push(t("Also ends poison, bleeding, and other ailments."));
    if (def.party) parts.push(t("Your nahual and any companions within {0} squares are healed the same way.", { 0: def.party }));
  }
  if (def.restoreSlots) parts.push(t("Regain {0} spell slots.", { 0: def.restoreSlots }));
  if (def.effect) {
    const e = def.effect;
    if (e.kind === "rage") parts.push(t("For {0} turns: +2 weapon damage, and every hit you take deals 3 less.", { 0: e.turns }));
    if (e.kind === "regen") parts.push(t("For {0} turns, regain {1} HP at the end of each of your turns. Needs food at 75%.", { 0: e.turns, 1: e.dice }));
    if (e.kind === "deflect") parts.push(t("+{0} AC for {1} turns.", { 0: e.ac, 1: e.turns }));
    if (e.kind === "dawn") parts.push(t("For {0} turns: +{1} AC, and the restless dead beside you take {2} sun-fire damage each turn.", { 0: e.turns, 1: e.ac, 2: spellDamageAtLevel(e.damage, state.run?.level || 1) }));
    if (e.kind === "indomitable") parts.push(t("For {0} turns, no hit can take you below 1 HP. Also ends poison, bleeding, and other ailments.", { 0: e.turns }));
    if (e.kind === "inspired") parts.push(t("You also gain +{0} to attack rolls for {1} turns.", { 0: e.attack, 1: e.turns }));
    if (e.kind === "shield") parts.push(t("For {0} turns, damage you take is halved.", { 0: e.turns }));
    if (e.kind === "surge") parts.push(t("Doesn't use your turn. Your next action doesn't end your turn either: two actions before anything else moves."));
  }
  if (def.vanish) parts.push(t("Creatures that aren't right beside you lose track of you and can't spot you again for a turn. Your next attack on one counts as unseen."));
  if (def.teleport) parts.push(t("Teleport up to {0} squares to the seen square farthest from the creatures hunting you. Nothing gets a parting swing.", { 0: def.teleport }));
  if (def.backlash) parts.push(t("It costs you {0} HP.", { 0: def.backlash }));
  parts.push(def.cost === "free" ? t("At will: no slot, no wait.")
    : def.cost === "slot" ? t("Spend 1 spell slot.")
      : def.cooldown >= 999 ? t("Takes your turn. Once between rests.")
      : def.effect?.kind === "surge" ? t("Ready again {0} turns after use (a rest resets it).", { 0: def.cooldown })
        : t("Takes your turn. Ready again {0} turns after use (a rest resets it).", { 0: def.cooldown }));
  return parts.join(" ");
}

// ---------- Buttons ----------

// The label for an ability's action button: name, who it would hit, and what it costs.
function abilityButtonLabel(id) {
  const def = abilityDef(id);
  const name = t(def.name);
  let aim = "";
  if (["enemy", "adjacent", "line", "shot"].includes(def.target)) {
    const targets = state.run.location === "dungeon" ? abilityTargets(def) : [];
    if (targets.length > 1) aim = ` · ${t("choose ({0})", { 0: targets.length })}`;
    else if (targets.length === 1) aim = ` · ${t(targets[0].name)}`;
  } else if (def.target === "around") {
    const caught = state.run.location === "dungeon" ? abilityVictims(def).length : 0;
    if (caught) aim = ` · ${t("hits {0}", { 0: caught })}`;
  }
  return `${name}${aim} · ${abilityCostLabel(id)}`;
}

// Abilities worth a quick-action button right now, best first.
function quickAbilityPicks({ hurt = false } = {}) {
  const picks = [];
  for (const id of unlockedAbilityIds()) {
    const def = abilityDef(id);
    if (abilityBlocker(id)) continue;
    if (def.heal || def.effect?.kind === "regen" || def.field?.kind === "spring") {
      if (hurt) picks.push({ id, weight: 3 });
      continue;
    }
    if (def.restoreSlots) {
      if (state.run.spellSlots < 1) picks.push({ id, weight: 2.5 });
      continue;
    }
    if (def.effect || def.summon || def.vanish || def.teleport || def.field?.kind === "glyph" || def.field?.kind === "sacred") {
      picks.push({ id, weight: 1 });
      continue;
    }
    const caught = def.target === "around" ? abilityVictims(def).length : 1;
    picks.push({ id, weight: 2 + (caught > 1 ? 1 : 0) + (def.cost === "free" ? -0.5 : 0) });
  }
  return picks.sort((a, b) => b.weight - a.weight).map((pick) => pick.id);
}

// The item art an ability's guide card borrows.
function abilityIcon(def) {
  if (def.heal || def.effect?.kind === "regen" || def.field?.kind === "spring") return "potion";
  if (def.roll === "weapon") return "weapon";
  if (def.summon) return "jaguar-pelt";
  if (def.field?.kind === "glyph" || def.teleport) return "tonalamatl";
  if (def.field) return def.field.kind === "caltrops" ? "obsidian-razors" : def.field.kind === "sacred" ? "copal" : "wild-ingredients";
  if (def.effect) return "armor";
  if (def.vanish) return "clothing";
  return def.strike === "night" ? "obsidian-mirror" : def.strike === "sun" ? "jade-bead" : "keepsake";
}
