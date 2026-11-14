"use strict";

// How much of the mouth's life reaches each floor, and how big it lets things grow.
//
// The mouth is below the deepest chamber of floor 13: the bound tzitzimitl lies across it,
// and that chamber is at its lip. What comes out of it has no end. Halve your distance to
// the mouth and the life around you doubles: on floor 13, half a floor from it, it is
// strongest; the thirteenth floor up from it gets a fraction. (LORE.md, The mouth.)
//
//   mouthShare(f)   the share of the bottom floor's life that floor f gets: 1 on floor 13,
//                   rising without limit toward the mouth (1 / distance)
//   floorVigor(f)   how far life grows there, as a level: about 2 at the top, 18 at the bottom
//
// Everything down here grows too fast because of what comes up. A creature takes its size
// from the floor it was born on: a mapachin born on floor 12 is far bigger than its kin on
// floor 2, and if it climbs, it keeps its size. Its level is the floor's vigor, moved up or
// down by how big its kind is (creatureLevelFor), and its numbers follow its level (growCreature).
//
// A creature's level is how strong a delver it is a fair fight for: a level 10 jaguar is a
// fair match for a level 10 delver alone, and a hard one for a level 6.

const MOUTH_DEPTH = 14.5;          // where the mouth itself is, counted in floors
const CREATURE_LEVEL_MAX = 20;     // the tomb's own creatures; the great guardians go past it
const GUARDIAN_LEVEL_MAX = 24;

function mouthShare(floor = state.run?.dungeonFloor || 1) {
  const f = Math.max(1, Math.min(DUNGEON_FLOOR_COUNT, floor));
  return (MOUTH_DEPTH - DUNGEON_FLOOR_COUNT) / (MOUTH_DEPTH - f);
}

function floorVigor(floor = state.run?.dungeonFloor || 1) {
  const top = mouthShare(1);
  const bottom = mouthShare(DUNGEON_FLOOR_COUNT);
  return 2.5 + 15.5 * Math.log(mouthShare(floor) / top) / Math.log(bottom / top);
}

// ---------- What a level is worth ----------

const LEVEL_XP = [0, 25, 50, 110, 220, 400, 600, 800, 1000, 1250, 1500, 1750, 2000, 2250, 2500,
  2800, 3100, 3450, 3800, 4200, 4600, 5100, 5600, 6200, 7000];

function levelHp(level) { return 8 + 5 * level; }
function levelAc(level) { return 12 + Math.floor((level + 1) / 3); }
function levelAttack(level) { return 3 + Math.ceil(level / 2); }
function levelDamage(level) { return 4 + level; }
function levelXp(level) { return LEVEL_XP[Math.max(1, Math.min(LEVEL_XP.length - 1, level))]; }

function averageDamage(dice) {
  const match = /^(\d+)d(\d+)([+-]\d+)?$/i.exec(String(dice || ""));
  if (!match) return 3;
  return Number(match[1]) * (Number(match[2]) + 1) / 2 + Number(match[3] || 0);
}

// Damage dice with about this average, keeping the creature's own die (a jaguar's d8).
function damageDiceFor(average, die) {
  const face = (die + 1) / 2;
  const count = Math.max(1, Math.round(average * 0.6 / face));
  const bonus = Math.round(average - count * face);
  return `${count}d${die}${bonus > 0 ? `+${bonus}` : bonus < 0 ? bonus : ""}`;
}

// The level a creature's card was written for: what its own numbers are worth.
const templateLevels = new Map();
function templateLevel(template) {
  if (!template) return 1;
  if (templateLevels.has(template.id)) return templateLevels.get(template.id);
  const byHp = (template.hp - 8) / 5;
  const byDamage = averageDamage(template.damage) - 4;
  let byXp = 1;
  for (let level = 1; level < LEVEL_XP.length; level += 1) if (LEVEL_XP[level] <= (template.xp || 0)) byXp = level;
  const level = Math.max(1, Math.round((byHp + byDamage + byXp) / 3));
  templateLevels.set(template.id, level);
  return level;
}

// How big its kind is beside the others on its floor: the small ones a level under the
// floor's vigor, the great hunters and the old guardians a few over.
function kindOffset(template, guardian = false) {
  const offset = Math.round((templateLevel(template) - 3) / 2);
  // Some are stronger than they look (data/ecology.js: levelBonus): the little guardians.
  const bonus = window.CryptsEcology?.species?.[template.id]?.levelBonus || 0;
  return Math.max(-1, Math.min(guardian ? 5 : 3, offset)) + bonus;
}

function creatureLevelFor(template, floor, { guardian = false } = {}) {
  const level = Math.round(floorVigor(floor) + kindOffset(template, guardian));
  return Math.max(1, Math.min(guardian ? GUARDIAN_LEVEL_MAX : CREATURE_LEVEL_MAX, level));
}

// A creature's numbers at a level, shaped like its kind's own (a tough one stays tough, a
// fast biter stays a fast biter).
function levelStats(template, level) {
  const base = templateLevel(template);
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const hpShape = clamp(template.hp / levelHp(base), 0.4, 2.2);
  const damageShape = clamp(averageDamage(template.damage) / levelDamage(base), 0.4, 2.2);
  const acShape = clamp(template.ac - levelAc(base), -4, 4);
  const attackShape = clamp(template.attackBonus - levelAttack(base), -3, 3);
  const die = Number(/d(\d+)/i.exec(template.damage || "")?.[1] || 6);
  return {
    hp: Math.max(1, Math.round(levelHp(level) * hpShape)),
    ac: Math.max(8, levelAc(level) + acShape),
    attackBonus: levelAttack(level) + attackShape,
    damage: damageDiceFor(Math.max(1, levelDamage(level) * damageShape), die),
    xp: Math.max(1, Math.round(levelXp(level) * clamp((template.xp || 1) / levelXp(base), 0.5, 1.5)))
  };
}

// Grows a creature to the floor it was born on. Elites, guardians, and great guardians keep
// their extra weight on top (systems/progression.js: decorateEnemy marks them).
function growCreature(enemy, floor = state.run?.dungeonFloor || 1, { keepHealth = false, pack = state.pack } = {}) {
  if (!enemy || enemy.delver || enemy.questNpc) return enemy;
  const template = pack?.enemies?.find((entry) => entry.id === enemy.templateId);
  if (!template) return enemy;
  const level = creatureLevelFor(template, floor, { guardian: Boolean(enemy.guardian) });
  const stats = levelStats(template, level);
  const share = keepHealth && enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1;
  let hp = stats.hp;
  let xp = stats.xp;
  let attack = stats.attackBonus;
  if (enemy.bossRoom) hp = Math.ceil(hp * 1.5);
  if (enemy.greatGuardian) { hp = Math.ceil(hp * 1.25); xp = Math.round(xp * 1.5); }
  if (enemy.elite) { hp = Math.ceil(hp * 1.6); attack += 1; xp *= 2; }
  Object.assign(enemy, { level, maxHp: hp, hp: Math.max(enemy.alive === false ? 0 : 1, Math.round(hp * share)),
    ac: stats.ac, attackBonus: attack, damage: stats.damage, xp });
  enemy.bornOn = floor;
  return enemy;
}

// Saves from before creatures grew: every creature on every floor is grown to the floor it
// is on, keeping how hurt it is.
function growMigrateRun(saved, pack = state.pack) {
  if (!saved || typeof saved !== "object") return false;
  let changed = false;
  const grow = (list, floor) => {
    for (const enemy of list || []) {
      if (!enemy || enemy.delver || enemy.questNpc || Number.isInteger(enemy.level)) continue;
      growCreature(enemy, floor, { keepHealth: true, pack });
      changed = true;
    }
  };
  if (Number.isInteger(saved.dungeonFloor)) {
    grow(saved.enemies, saved.dungeonFloor);
    grow(saved.lurkers, saved.dungeonFloor);
  }
  for (const [key, snapshot] of Object.entries(saved.dungeonFloors || {})) {
    const floor = Number(key);
    if (!Number.isInteger(floor) || !snapshot) continue;
    grow(snapshot.enemies, floor);
    grow(snapshot.lurkers, floor);
  }
  return changed;
}

function creatureLevelLabel(enemy) {
  return Number.isInteger(enemy?.level) ? t("Level {0}", { 0: enemy.level }) : "";
}
