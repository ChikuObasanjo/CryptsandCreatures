"use strict";

// Each calling has one knack: a small, always-on talent (or one action) that changes how
// encounters go. Spells stay as they are (a free attack, a stronger slot spell, and a
// third spell); knacks are what make a rogue feel different from a fighter in the tomb.
const KNACKS = {
  barbarian: { name: "Fury", text: "While you're at half your hit points or less, your weapon hits deal 3 extra damage." },
  bard: { name: "Lucky Verse", text: "Once per rest, a missed weapon attack or spell is rerolled." },
  cleric: { name: "Turn the Dead", action: true, text: "Once per rest: the restless dead within 5 squares must make a Wisdom save or flee from you for 5 turns." },
  druid: { name: "Kin of Beasts", text: "Beasts don't notice you until you're within 2 squares." },
  fighter: { name: "Cleave", text: "When your weapon drops a creature, you swing at another one beside you for free." },
  monk: { name: "Flurry", text: "When your weapon attack misses, you strike again at once." },
  paladin: { name: "Lay on Hands", action: true, text: "Heal from a pool of 5 hit points per level, refilled when you rest." },
  ranger: { name: "Tracker", text: "Creatures within 8 squares show on your map, even through walls, and nothing hidden ambushes you." },
  rogue: { name: "Sneak Attack", text: "Creatures notice you 2 squares later. Hits against a creature that hasn't noticed you, or one a companion flanks, deal 2d6 extra damage." },
  sorcerer: { name: "Overchannel", text: "With no spell slots left, you can still cast your slot spells by paying 1d6 hit points." },
  warlock: { name: "Patron's Due", text: "Once per floor, defeating a creature returns a spell slot." },
  wizard: { name: "Arcane Sight", text: "Treasure caches and relics on the floor glimmer on your map as soon as you arrive." }
};

function currentKnack() {
  return KNACKS[state.run?.character?.class] || null;
}

function knackState() {
  if (!state.run.knack || typeof state.run.knack !== "object") state.run.knack = {};
  return state.run.knack;
}

// Called whenever the party rests (camp, inn, or house).
function refreshKnackOnRest() {
  const knack = knackState();
  knack.luckyUsed = false;
  knack.turnUsed = false;
  knack.handsPool = 5 * (state.run.level || 1);
}

function layOnHandsPool() {
  const knack = knackState();
  if (!Number.isInteger(knack.handsPool)) knack.handsPool = 5 * (state.run.level || 1);
  return knack.handsPool;
}

// Extra weapon damage from knacks, added to a hit.
function knackBonusDamage(enemy, { unaware = false, flanked = false } = {}) {
  const calling = state.run.character?.class;
  let bonus = 0;
  const notes = [];
  if (calling === "barbarian" && state.run.hp <= state.run.maxHp / 2) {
    bonus += 3;
    notes.push("fury");
  }
  if (calling === "rogue" && (unaware || flanked)) {
    bonus += rollDice("2d6").total;
    notes.push("sneak attack");
  }
  return { bonus, notes };
}

function knackRerollMiss() {
  if (state.run.character?.class !== "bard") return false;
  const knack = knackState();
  if (knack.luckyUsed) return false;
  knack.luckyUsed = true;
  return true;
}

function knackAfterKill(enemy) {
  const calling = state.run.character?.class;
  if (calling === "warlock") {
    const knack = knackState();
    knack.dueFloors ||= {};
    const floorKey = String(state.run.dungeonFloor);
    if (!knack.dueFloors[floorKey] && state.run.spellSlots < maxSpellSlots("warlock", state.run.level)) {
      knack.dueFloors[floorKey] = true;
      state.run.spellSlots += 1;
      addLog("Your patron takes its due and returns a spell slot.");
    }
  }
}

// The knack's action button, when it has one.
function knackAction() {
  const calling = state.run.character?.class;
  if (state.run.location !== "dungeon") return null;
  if (calling === "cleric") {
    const used = knackState().turnUsed;
    const dead = state.run.enemies.filter((enemy) => enemy.alive && isRestlessDead(enemy) &&
      distanceInSquares(enemy, state.run.player) <= 5 && hasLineOfSight(state.run.player, enemy));
    return {
      label: used ? "Turn the Dead · used" : `Turn the Dead${dead.length ? ` · ${dead.length}` : ""}`,
      disabled: used || !dead.length,
      run: turnTheDead
    };
  }
  if (calling === "paladin") {
    const pool = layOnHandsPool();
    return {
      label: `Lay on Hands · ${pool}`,
      disabled: pool < 1 || state.run.hp >= state.run.maxHp,
      run: layOnHands
    };
  }
  return null;
}

function turnTheDead() {
  const knack = knackState();
  if (knack.turnUsed) return;
  const dead = state.run.enemies.filter((enemy) => enemy.alive && isRestlessDead(enemy) &&
    distanceInSquares(enemy, state.run.player) <= 5 && hasLineOfSight(state.run.player, enemy));
  if (!dead.length) {
    showToast("No restless dead are close enough to turn.");
    return;
  }
  knack.turnUsed = true;
  const scores = state.run.character.scores || {};
  const dc = 8 + 2 + Math.floor(Math.max(0, state.run.level - 1) / 4) + abilityModifier(scores.wis ?? 10);
  const turned = [];
  for (const enemy of dead) {
    if (enemyWisdomSave(enemy, dc)) continue;
    enemy.fleeTurns = 5;
    enemy.alerted = true;
    turned.push(enemy.name);
  }
  sfx("spell");
  addLog(turned.length
    ? `You raise the sun's sign. ${turned.join(", ")} ${turned.length === 1 ? "flees" : "flee"} from you (DC ${dc}).`
    : `You raise the sun's sign, but the dead stand their ground (DC ${dc}).`);
  finishPlayerTurn();
}

function layOnHands() {
  const knack = knackState();
  const pool = layOnHandsPool();
  const missing = state.run.maxHp - state.run.hp;
  if (pool < 1 || missing < 1) return;
  const healed = Math.min(pool, missing);
  knack.handsPool = pool - healed;
  state.run.hp += healed;
  sfx("heal");
  showCombatFeedback("heal", `+${healed} HP`, { actor: "player", x: state.run.player.x, y: state.run.player.y });
  addLog(`You lay your hands on your wounds and recover ${healed} hit points (${knack.handsPool} left in your pool).`);
  if (state.run.location === "dungeon") finishPlayerTurn();
  else render();
}

// Sorcerers can cast a slot spell with no slots by paying hit points.
function canOverchannel(spell) {
  return state.run.character?.class === "sorcerer" && !spell.free && !spell.healing &&
    state.run.spellSlots < 1 && state.run.hp > 1;
}

function payOverchannel() {
  const cost = Math.min(state.run.hp - 1, rollDice("1d6").total);
  state.run.hp -= cost;
  showCombatFeedback("player-hit", `−${cost} HP`, { actor: "player", x: state.run.player.x, y: state.run.player.y });
  addLog(`You overchannel, burning ${cost} hit point${cost === 1 ? "" : "s"} to power the spell.`);
}

// Map extras: rangers see creatures through walls, wizards see treasure.
function knackRevealsCreature(enemy) {
  return state.run.character?.class === "ranger" && distanceInSquares(enemy, state.run.player) <= 8;
}

function knackRevealsTreasure(treasure) {
  return state.run.character?.class === "wizard" && !treasure.dropped && !String(treasure.id).startsWith("treasure-");
}

// A new delve: the warlock's patron can be paid again on every floor.
function refreshKnackOnDelve() {
  knackState().dueFloors = {};
}
