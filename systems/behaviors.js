"use strict";

// How the tomb's creatures behave. Each creature kind has a habit that changes how it
// notices you, moves, and fights, so a floor is something you learn to read rather than a
// row of identical fights. The default habit ("hunter") is the old behavior: notice you
// within 7 squares, walk straight at you, and attack when adjacent.
//
// Habits:
//   swarm       comes in a group, hops erratically, and is drawn to food left on the floor
//   skirmisher  bites, then flutters a step away
//   thief       snatches unsecured gold and runs; kill it to get the gold back (and more)
//   ambusher    hides until you are close, then strikes first with advantage
//   sentinel    guards a post, slow to notice you, never chases far from it
//   sleeper     sleeps on a hoard; noise or a clumsy step wakes it
//   wanderer    ignores you on its way up the stairs unless you attack or block it
//   territorial defends its own chamber, lets you go once you leave
//   caster      keeps its distance and attacks from range
//   charger     covers two squares a turn
const CREATURE_HABITS = {
  "maztican-cave-locust": {
    habit: "swarm",
    note: "Habit: alone, a shy grazer that hops away from you. When a big chapolin swarm runs out of food, the big ones band together and move on: a band hops erratically, strips gardens, and falls on food left on the floor."
  },
  "tomb-bat": {
    habit: "skirmisher",
    note: "Habit: bites, then flutters off a step into the dark."
  },
  duende: {
    habit: "thief",
    note: "Habit: snatches gold you haven't brought home yet and runs. Catch it before it slips into the walls; it drops what it stole, and more."
  },
  "cenote-stalker": {
    habit: "ambusher",
    note: "Habit: waits under deep water and takes what comes to the edge, striking first. When it's hungry you hear a baby crying from the water, and the fish jump. Stay back from the deep water's edge."
  },
  mazacoatl: {
    habit: "ambusher",
    note: "Habit: waits coiled beside the grazers' trails and strikes first. After a big meal it sleeps for hours; you can walk right past."
  },
  maquizcoatl: {
    habit: "grazer",
    note: "Habit: slips away from you. It only bites if cornered."
  },
  chaneque: {
    habit: "skirmisher",
    note: "Habit: leaves you be unless you take from what it keeps without a gift. Attacked, it nips and darts away."
  },
  alux: {
    habit: "caster",
    note: "Habit: leaves you be unless you rob what it guards without a gift. Then it throws stones from up to 5 squares away."
  },
  "jungle-jaguar": {
    habit: "ambusher",
    note: "Habit: waits unseen and strikes first. A sharp eye or a careful search finds it before it finds you."
  },
  yohualtepoztli: {
    habit: "ambusher",
    note: "Habit: you hear its axe-thud before you see it. It waits in the dark and strikes first."
  },
  mictlaneca: {
    habit: "sentinel",
    note: "Habit: guards its post facing the stair below. Slow to notice you, and it won't chase far from its post."
  },
  cihuateotl: {
    habit: "sentinel",
    note: "Habit: stands over what it guards. Slow to notice you, and it won't leave its post for long."
  },
  quinametli: {
    habit: "sleeper",
    note: "Habit: sleeps on a hoard of hauled stone and tribute. Noise or a clumsy step wakes it; a quiet one lets you slip past or strike first."
  },
  "xolo-hound": {
    habit: "wanderer",
    note: "Habit: trots up toward the light and ignores you unless you attack it or stand in its way. Follow it and it shows you the stairs up."
  },
  axolocatl: {
    habit: "territorial",
    note: "Habit: defends its own chamber, but lets you go once you leave it."
  },
  tlacatecolotl: {
    habit: "caster",
    note: "Habit: hoots from up to 5 squares away. Close the distance or break its line of sight."
  },
  "huay-chivo": {
    habit: "charger",
    note: "Habit: charges, covering two squares a turn."
  }
};

const BEAST_KINDS = new Set([
  "maztican-cave-locust", "tomb-bat", "jungle-jaguar", "cenote-stalker", "xolo-hound",
  "colotl", "axolocatl", "cipactli", "feathered-serpent", "camazotz"
]);
const DEAD_KINDS = new Set([
  "mictlaneca", "yohualtepoztli", "cihuateotl", "tzitzimitl", "itzpapalotl", "camazotz", "huay-chivo", "tlacatecolotl"
]);

function creatureHabit(enemy) {
  // A big grasshopper only swarms when it's part of a band; alone it grazes.
  if (enemy?.templateId === "maztican-cave-locust" && !enemy.band) return "grazer";
  if (enemy?.provoked && CREATURE_HABITS[enemy.templateId]?.habit === "wanderer") return "hunter";
  if (enemy?.roomIndex === -1 && CREATURE_HABITS[enemy.templateId]?.habit === "territorial") return "hunter";
  return CREATURE_HABITS[enemy?.templateId]?.habit || "hunter";
}

function creatureHabitNote(enemy) {
  return CREATURE_HABITS[enemy?.templateId]?.note || "";
}

function isBeast(enemy) {
  return BEAST_KINDS.has(enemy?.templateId);
}

function isRestlessDead(enemy) {
  return DEAD_KINDS.has(enemy?.templateId);
}

// ---------- Spawning ----------

// Called for every creature as a floor is made. Returns the creatures to add (a swarm adds
// several) and may move an ambusher into the hidden list instead.
function placeCreature(enemy, { roomSpawn = false, occupied = new Set() } = {}) {
  const habit = creatureHabit(enemy);
  enemy.post = { x: enemy.x, y: enemy.y };
  if (habit === "swarm" && !enemy.guardian) {
    const floor = state.run.dungeonFloor || 1;
    const size = 2 + (floor >= 2 ? 1 : 0) + (floor >= 5 ? 1 : 0) + (floor >= 9 ? 1 : 0);
    const swarm = [enemy];
    enemy.swarm = `swarm-${enemy.id}`;
    for (let index = 1; index < size; index += 1) {
      const spot = freeTileNear(enemy, occupied, 2);
      if (!spot) break;
      occupied.add(tileIndex(spot.x, spot.y));
      swarm.push({ ...enemy, id: `${enemy.id}-s${index}`, x: spot.x, y: spot.y, post: { ...spot } });
    }
    return swarm;
  }
  if (habit === "ambusher" && roomSpawn && !enemy.guardian) {
    enemy.stealthDc = 12 + Math.floor((state.run.dungeonFloor || 1) / 3);
    state.run.lurkers ||= [];
    state.run.lurkers.push(enemy);
    return [];
  }
  if (habit === "sleeper" && !enemy.guardian) {
    enemy.asleep = 999;
    enemy.sleepHp = enemy.hp;
    enemy.deepSleep = true;
    const spot = freeTileNear(enemy, occupied, 1);
    if (spot) {
      occupied.add(tileIndex(spot.x, spot.y));
      const floor = state.run.dungeonFloor || 1;
      const find = typeof rollTombFind === "function" ? rollTombFind(floor) : null;
      state.run.treasures.push({
        id: `hoard-${enemy.id}`, x: spot.x, y: spot.y,
        gold: 10 + floor * 6, items: find ? [{ id: find, quantity: 1 }] : [], hoard: true
      });
    }
  }
  return [enemy];
}

function freeTileNear(origin, occupied, reach) {
  const options = [];
  for (let dy = -reach; dy <= reach; dy += 1) {
    for (let dx = -reach; dx <= reach; dx += 1) {
      const x = origin.x + dx;
      const y = origin.y + dy;
      if ((dx || dy) && isWalkable(x, y) && !occupied.has(tileIndex(x, y)) &&
        !(state.run.player && state.run.player.x === x && state.run.player.y === y)) options.push({ x, y });
    }
  }
  return options.length ? options[randomInt(options.length) - 1] : null;
}

// Arriving by stair onto a tile a creature (or a hidden one) is standing on: it steps aside.
function clearArrivalTile() {
  const { x, y } = state.run.player;
  const occupied = new Set(state.run.enemies.filter((enemy) => enemy.alive).map((enemy) => tileIndex(enemy.x, enemy.y)));
  for (const creature of [...state.run.enemies.filter((enemy) => enemy.alive), ...(state.run.lurkers || [])]) {
    if (creature.x !== x || creature.y !== y) continue;
    const spot = freeTileNear(creature, occupied, 2) || freeTileNear(creature, occupied, 4);
    if (!spot) continue;
    occupied.add(tileIndex(spot.x, spot.y));
    creature.x = spot.x;
    creature.y = spot.y;
  }
}

// ---------- Movement ----------

function tileHasCreature(x, y, except = null) {
  return state.run.enemies.some((other) => other.alive && other !== except && other.x === x && other.y === y) ||
    (state.run.lurkers || []).some((other) => other !== except && other.x === x && other.y === y) ||
    state.run.party.some((companion) => companion.x === x && companion.y === y) ||
    (typeof summonAt === "function" && Boolean(summonAt(x, y)));
}

// The first step of a shortest walk from `enemy` to `target` (or to any tile beside it
// when `adjacent` is set). Null when there is no way.
function creatureStepToward(enemy, target, { adjacent = false, throughDoors = false } = {}) {
  const queue = [{ x: enemy.x, y: enemy.y, first: null }];
  const visited = new Set([tileIndex(enemy.x, enemy.y)]);
  for (let cursor = 0; cursor < queue.length && cursor < 2500; cursor += 1) {
    const current = queue[cursor];
    const reached = adjacent
      ? distanceInSquares(current, target) <= 1 && current.first
      : current.x === target.x && current.y === target.y;
    if (reached) return current.first;
    for (const direction of shuffle(MOVEMENT_DIRECTIONS)) {
      const x = current.x + direction.x;
      const y = current.y + direction.y;
      const key = tileIndex(x, y);
      const closedDoor = throughDoors && state.run.terrain[key] === "door" && !state.run.openDoors.includes(key) &&
        Math.abs(direction.x) + Math.abs(direction.y) === 1;
      if (visited.has(key) || (!closedDoor && !canStepBetween(current, { x, y }, enemy))) continue;
      const isPlayer = state.run.player.x === x && state.run.player.y === y;
      if (isPlayer || tileHasCreature(x, y, enemy)) continue;
      visited.add(key);
      queue.push({ x, y, first: current.first || { x, y } });
    }
  }
  return null;
}

function creatureStepAway(enemy) {
  let best = null;
  let bestDistance = distanceInSquares(enemy, state.run.player);
  for (const direction of shuffle(MOVEMENT_DIRECTIONS)) {
    const spot = { x: enemy.x + direction.x, y: enemy.y + direction.y };
    if (!canStepBetween(enemy, spot) || tileHasCreature(spot.x, spot.y, enemy) ||
      (spot.x === state.run.player.x && spot.y === state.run.player.y)) continue;
    const distance = distanceInSquares(spot, state.run.player);
    if (distance > bestDistance) {
      best = spot;
      bestDistance = distance;
    }
  }
  return best;
}

function creatureRandomStep(enemy) {
  for (const direction of shuffle(MOVEMENT_DIRECTIONS)) {
    const spot = { x: enemy.x + direction.x, y: enemy.y + direction.y };
    if (canStepBetween(enemy, spot) && !tileHasCreature(spot.x, spot.y, enemy) &&
      !(spot.x === state.run.player.x && spot.y === state.run.player.y)) return spot;
  }
  return null;
}

// Moving onto a trap springs it on the creature: lure things into the traps you've found.
function moveCreature(enemy, step, { forced = false } = {}) {
  if (!step) return false;
  // Rooted creatures hold still unless something throws them.
  if (enemy.rooted > 0 && !forced) return false;
  const dx = step.x - enemy.x;
  const dy = step.y - enemy.y;
  enemy.x = step.x;
  enemy.y = step.y;
  state.creatureMoveEffects[enemy.id] = {
    dx,
    dy,
    until: Date.now() + 220
  };
  window.setTimeout(() => {
    if (state.creatureMoveEffects[enemy.id]?.until <= Date.now()) {
      delete state.creatureMoveEffects[enemy.id];
    }
  }, 220);
  const hazard = state.run.hazards.find((item) => !item.triggered && item.x === step.x && item.y === step.y);
  if (hazard) {
    hazard.triggered = true;
    hazard.revealed = true;
    sfx("trap");
    const save = randomInt(20) + Math.floor((enemy.attackBonus || 0) / 2);
    if (save >= hazard.dc) {
      addLog(`${enemy.name} springs ${hazard.name} but twists free.`);
    } else {
      const damage = Math.max(1, rollDice(hazard.damage).total * 2);
      enemy.hp = Math.max(0, enemy.hp - damage);
      addLog(`${enemy.name} blunders into ${hazard.name} and takes ${damage} damage.`);
      showCombatFeedback("hit", `−${damage} HP`, { actor: "enemy", x: enemy.x, y: enemy.y, enemyId: enemy.id });
      if (enemy.hp <= 0) resolveEnemyDefeat(enemy);
    }
  }
  if (enemy.alive && enemy.hp > 0 && typeof abilityFieldsOnEnter === "function") abilityFieldsOnEnter(enemy);
  return true;
}

// ---------- Noticing ----------

function creatureNoticeRange(enemy) {
  const habit = creatureHabit(enemy);
  let range = habit === "sentinel" ? 3 : habit === "territorial" ? 2 : 7;
  const calling = state.run.character?.class;
  if (calling === "rogue") range -= 2;
  if (calling === "druid" && isBeast(enemy)) range = Math.min(range, 2);
  const stance = typeof currentStance === "function" ? currentStance() : "guard";
  if (armorIsNoisy()) range += 1;
  if (stance === "run") range += 2;
  if (stance === "disengage") range -= 1;
  if (typeof activeBuff === "function" && activeBuff("hushed")) range -= 1;
  if (typeof ecologyNoticeModifier === "function") range += ecologyNoticeModifier(enemy);
  return Math.max(1, range);
}

function creatureNotices(enemy, distance) {
  const habit = creatureHabit(enemy);
  if (habit === "wanderer") return false;
  // A rogue who just vanished can't be spotted again right away.
  if (enemy.vanishGrace > 0) return false;
  // A fed creature, a wary one, or a spirit that's been given its offering minds its own business.
  if (typeof ecologyIgnoresPlayer === "function" && ecologyIgnoresPlayer(enemy, distance)) return false;
  if (habit === "territorial") {
    return distance <= creatureNoticeRange(enemy) ||
      (enemy.roomIndex >= 0 && roomIndexAt(state.run.player.x, state.run.player.y) === enemy.roomIndex);
  }
  if (distance <= creatureNoticeRange(enemy)) return true;
  if (habit === "sentinel") return false;
  return enemy.roomIndex >= 0 && enemy.roomIndex === state.run.currentRoom &&
    (state.run.character?.class !== "rogue" || distance <= 4);
}

// Hidden ambushers: noticed by a sharp eye, or they spring when you come close.
function stirLurkers() {
  const lurkers = state.run.lurkers || [];
  if (!lurkers.length || state.run.location !== "dungeon") return;
  const passive = 10 + skillBonus("perception") + (typeof activeBuff === "function" && activeBuff("deepsight") ? 3 : 0);
  const tracker = state.run.character?.class === "ranger";
  for (const lurker of [...lurkers]) {
    const distance = distanceInSquares(lurker, state.run.player);
    // The ahuizotl under the water: it cries like a baby when it's hungry, and only comes out
    // for something at the water's edge.
    if (lurker.templateId === "cenote-stalker" && typeof deepWaterAt === "function" && deepWaterAt(lurker.x, lurker.y)) {
      const hungry = typeof ecoHungerState === "function" && ["hungry", "starving"].includes(ecoHungerState(lurker));
      if (hungry && distance <= 8 && (state.run.steps || 0) - (lurker.criedAt ?? -99) > 30) {
        lurker.criedAt = state.run.steps || 0;
        addLog("From the water comes a sound like a baby crying.");
        if (typeof ecoObserve === "function") ecoObserve("cenote-stalker", "cries");
      }
      if (distance <= 1) {
        revealLurker(lurker, true);
        addLog(`A hand on the end of a tail closes on your ankle: an ${lurker.name} comes up out of the water!`);
      } else if (distance <= 2 && passive >= lurker.stealthDc + 2 && hasLineOfSight(state.run.player, lurker)) {
        revealLurker(lurker, false);
        addLog(`Something dark moves under the fish: an ${lurker.name} (passive Perception ${passive}).`);
      }
      continue;
    }
    if (distance > 5) continue;
    const inSight = hasLineOfSight(state.run.player, lurker);
    if ((tracker && distance <= 5) || (inSight && distance <= 4 && passive >= lurker.stealthDc)) {
      revealLurker(lurker, false);
      addLog(tracker
        ? `Fresh tracks give it away: a ${lurker.name} lies in wait ahead.`
        : `You spot a ${lurker.name} lying in wait (passive Perception ${passive}).`);
    } else if (distance <= 2) {
      revealLurker(lurker, true);
      addLog(`A ${lurker.name} bursts from hiding!`);
    } else if (lurker.templateId === "yohualtepoztli" && !lurker.heard) {
      lurker.heard = true;
      addLog("A wet thud, like an axe biting wood, comes from somewhere close.");
    }
  }
}

function revealLurker(lurker, ambush) {
  state.run.lurkers = (state.run.lurkers || []).filter((entry) => entry !== lurker);
  lurker.alerted = true;
  lurker.ambush = ambush;
  if (state.run.enemies.some((enemy) => enemy.id === lurker.id)) lurker.id = `${lurker.id}-l${state.run.enemies.length}`;
  state.run.enemies.push(lurker);
}

// An active Search also looks for hidden creatures. Returns how many were found.
function searchForLurkers() {
  let found = 0;
  for (const lurker of [...(state.run.lurkers || [])]) {
    if (distanceInSquares(lurker, state.run.player) > 4 || !hasLineOfSight(state.run.player, lurker)) continue;
    if (randomInt(20) + skillBonus("perception") >= lurker.stealthDc) {
      revealLurker(lurker, false);
      addLog(`Your search turns up a ${lurker.name} lying in wait.`);
      found += 1;
    }
  }
  return found;
}

// Loud actions can wake sleepers nearby.
function makeNoise(origin, radius = 4) {
  for (const enemy of state.run.enemies) {
    if (!enemy.alive || !enemy.deepSleep || !enemy.asleep) continue;
    if (distanceInSquares(enemy, origin) <= radius && randomInt(2) === 1) wakeSleeper(enemy, "The noise wakes");
  }
}

function wakeSleeper(enemy, reason) {
  enemy.asleep = 0;
  enemy.deepSleep = false;
  enemy.alerted = true;
  addLog(`${reason} ${enemy.name}. It opens one enormous eye.`);
}

// A sleeper beside you may hear you each turn.
function checkSleepers() {
  for (const enemy of state.run.enemies) {
    if (!enemy.alive || !enemy.deepSleep || !enemy.asleep) continue;
    if (distanceInSquares(enemy, state.run.player) > 2) continue;
    const dc = 10 + Math.floor((state.run.dungeonFloor || 1) / 2);
    const quiet = state.run.character?.class === "rogue" || (typeof currentStance === "function" && currentStance() === "disengage");
    const loud = (typeof currentStance === "function" && currentStance() === "run") || armorIsNoisy();
    const roll = rollD20({ advantage: quiet, disadvantage: loud }).die + skillBonus("stealth");
    if (roll < dc) wakeSleeper(enemy, `Your step (Stealth ${roll} vs. DC ${dc}) wakes`);
  }
}

// ---------- Acting ----------

function foodCacheNear(enemy, reach) {
  return state.run.treasures.find((treasure) => treasure.dropped &&
    distanceInSquares(treasure, enemy) <= reach &&
    treasure.items.some((item) => FOOD_ITEMS[item.id] && item.quantity > 0)) || null;
}

function swarmFeeds(enemy) {
  if (enemy.sated > 0) {
    if (enemy.hp < enemy.maxHp) {
      enemy.sated = 0;
    } else {
      enemy.sated -= 1;
      if (randomInt(3) === 1) moveCreature(enemy, creatureRandomStep(enemy));
      return true;
    }
  }
  const cache = foodCacheNear(enemy, 6);
  if (!cache || (distanceInSquares(enemy, state.run.player) <= 1 && enemy.hp < enemy.maxHp)) return false;
  if (enemy.x === cache.x && enemy.y === cache.y) {
    const meal = cache.items.find((item) => FOOD_ITEMS[item.id] && item.quantity > 0);
    meal.quantity -= 1;
    cache.items = cache.items.filter((item) => item.quantity > 0);
    if (!cache.items.length && !cache.gold) state.run.treasures = state.run.treasures.filter((entry) => entry !== cache);
    const swarm = state.run.enemies.filter((other) => other.alive && other.swarm && other.swarm === enemy.swarm);
    for (const member of swarm.length ? swarm : [enemy]) member.sated = 8;
    addLog(`The ${enemy.name} swarm falls on your ${itemDetails(meal.id).name} and forgets you for a while.`);
    return true;
  }
  const step = creatureStepToward(enemy, cache) ||
    (tileHasCreature(cache.x, cache.y, enemy) ? null : creatureStepToward(enemy, cache, { adjacent: true }));
  if (!step) return false;
  moveCreature(enemy, step);
  return true;
}

function stealFrom(enemy) {
  const loot = expeditionLoot();
  const purse = Math.min(state.run.gold, loot.gold);
  if (purse < 1 || enemy.stolen) return false;
  const dc = 11 + Math.floor((state.run.dungeonFloor || 1) / 2);
  const save = randomInt(20) + savingThrowBonus("dex");
  if (save >= dc) {
    addLog(`${enemy.name} grabs for your pouch, but you slap its hand away (Dexterity save ${save} vs. ${dc}).`);
    return true;
  }
  const amount = Math.max(1, Math.floor(Math.min(purse, 4 + (state.run.dungeonFloor || 1) * 4)));
  state.run.gold = roundGold(state.run.gold - amount);
  loot.gold = roundGold(loot.gold - amount);
  enemy.stolen = amount;
  enemy.fleeing = true;
  sfx("miss");
  addLog(`${enemy.name} snatches ${formatCurrency(amount)} from your pouch and runs, giggling!`);
  return true;
}

function thiefEscapes(enemy) {
  const options = [];
  for (let y = 0; y < MAP_TILE_SIZE; y += 1) {
    for (let x = 0; x < MAP_TILE_SIZE; x += 1) {
      if (isWalkable(x, y) && !tileHasCreature(x, y, enemy) && distanceInSquares({ x, y }, state.run.player) >= 14) options.push({ x, y });
    }
  }
  if (!options.length) return;
  const spot = options[randomInt(options.length) - 1];
  enemy.x = spot.x;
  enemy.y = spot.y;
  enemy.fleeing = false;
  enemy.alerted = false;
  addLog(`${enemy.name} squeezes into a crack in the wall and is gone, with your gold. It's still somewhere on this floor.`);
}

function wandererGoal(enemy) {
  const stairs = (state.run.floorStairs || []).filter((stair) => stair.type === "stairs-up");
  stairs.sort((a, b) => distanceInSquares(a, enemy) - distanceInSquares(b, enemy));
  return stairs[0] || null;
}

// Big creatures telegraph their heaviest blow: they wind up one turn (the tiles they'll hit
// glow red on the map), then strike everything still there. Step out of reach and the
// blow lands on nothing, leaving them off balance for a turn: your opening.
const HEAVY_BLOWS = {
  quinametli: { shape: "sweep", text: "raises its hauling stone overhead" },
  caxtiltecatl: { shape: "sweep", text: "draws its steel sword back for a great cut" },
  cipactli: { shape: "sweep", text: "coils its tail to lash" },
  "feathered-serpent": { shape: "burst", text: "rears up, feathers flaring" },
  tzitzimitl: { shape: "burst", text: "spreads its starless arms" },
  itzpapalotl: { shape: "burst", text: "opens its obsidian-edged wings" },
  cihuateotl: { shape: "burst", text: "draws breath for a wail" },
  camazotz: { shape: "sweep", text: "spreads its wings wide" }
};

function heavyBlowFor(enemy) {
  return HEAVY_BLOWS[enemy.templateId] || (enemy.guardian ? { shape: "sweep", text: "gathers itself for a crushing blow" } : null);
}

function heavyBlowTiles(enemy, shape) {
  const reach = shape === "burst" ? 2 : 1;
  const tiles = [];
  for (let dy = -reach; dy <= reach; dy += 1) {
    for (let dx = -reach; dx <= reach; dx += 1) {
      const spot = { x: enemy.x + dx, y: enemy.y + dy };
      if ((!dx && !dy) || !isWalkable(spot.x, spot.y)) continue;
      if (reach > 1 && !hasLineOfSight(enemy, spot)) continue;
      tiles.push(spot);
    }
  }
  return tiles;
}

function threatenedTiles() {
  const tiles = new Set();
  for (const enemy of state.run.enemies) {
    if (!enemy.alive || !enemy.windup) continue;
    for (const spot of enemy.windup.tiles) tiles.add(tileIndex(spot.x, spot.y));
  }
  return tiles;
}

function resolveHeavyBlow(enemy) {
  const blow = enemy.windup;
  enemy.windup = null;
  const onTile = (actor) => blow.tiles.some((spot) => spot.x === actor.x && spot.y === actor.y);
  const victims = partyMembers().filter((member) => (member.hero ? state.run.hp > 0 && onTile(state.run.player) : member.hp > 0 && onTile(member)));
  if (!victims.length) {
    enemy.staggered = true;
    addLog(`${enemy.name}'s blow crashes down on empty stone. It's off balance!`);
    sfx("miss");
    return;
  }
  const dc = 10 + Math.floor((state.run.dungeonFloor || 1) / 2);
  for (const victim of victims) {
    let damage = Math.ceil(rollDice(enemy.damage).total * 1.5);
    const save = victim.hero ? randomInt(20) + savingThrowBonus("dex") : randomInt(20) + 2;
    const halved = save >= dc;
    if (halved) damage = Math.ceil(damage / 2);
    if (victim.hero) {
      damage = heroDamageAfterAbilities(damage);
      state.run.hp = Math.max(0, state.run.hp - damage);
      showCombatFeedback("player-hit", `−${damage} HP`, { actor: "player", x: state.run.player.x, y: state.run.player.y });
      addLog(halved
        ? `${enemy.name}'s heavy blow clips you for ${damage} damage (Dexterity save ${save} vs. ${dc}).`
        : `${enemy.name}'s heavy blow lands full on you for ${damage} damage (Dexterity save ${save} vs. ${dc}).`);
      checkDefeat();
    } else {
      victim.hp = Math.max(0, victim.hp - damage);
      addLog(`${enemy.name}'s heavy blow hits ${victim.name} for ${damage} damage.`);
    }
  }
  sfx("hit");
}

// Returns true when the habit handled the creature's whole turn.
function creatureAct(enemy, distance) {
  const habit = creatureHabit(enemy);
  const heavy = heavyBlowFor(enemy);
  if (heavy && enemy.windup) {
    resolveHeavyBlow(enemy);
    return true;
  }
  if (heavy && distance <= (heavy.shape === "burst" ? 2 : 1) && !enemy.fleeTurns) {
    enemy.heavyCooldown = (enemy.heavyCooldown ?? 1) - 1;
    if (enemy.heavyCooldown <= 0) {
      enemy.heavyCooldown = 3;
      enemy.windup = { shape: heavy.shape, tiles: heavyBlowTiles(enemy, heavy.shape) };
      addLog(`${enemy.name} ${heavy.text}. Get out of reach!`);
      sfx("door");
      return true;
    }
  }
  // Animals don't fight to the death: badly hurt, they break off and run.
  if (!enemy.fleeTurns && typeof ecologyShouldFlee === "function" && ecologyShouldFlee(enemy)) {
    enemy.fleeTurns = 5;
    enemy.windup = null;
    ecoCreature(enemy).fledOnce = true;
    addLog(`${enemy.name} breaks off and runs, badly hurt.`);
  }
  if (enemy.fleeTurns > 0) {
    enemy.fleeTurns -= 1;
    const away = creatureStepAway(enemy);
    if (away) moveCreature(enemy, away);
    else if (distance === 1) enemyAttack(enemy);
    // Far enough away and out of sight, a frightened animal gives up the fight.
    if (enemy.fleeTurns <= 0 && enemy.eco?.fledOnce && distanceInSquares(enemy, state.run.player) >= 5 &&
      !hasLineOfSight(state.run.player, enemy)) {
      enemy.alerted = false;
      enemy.provoked = false;
    }
    return true;
  }
  if (habit === "grazer") {
    // A grazer wants away from you; it only fights when it's cornered.
    const away = creatureStepAway(enemy);
    if (away && distance <= 4) moveCreature(enemy, away);
    else if (distance === 1) enemyAttack(enemy);
    if (distance >= 5 && !hasLineOfSight(state.run.player, enemy)) enemy.alerted = false;
    return true;
  }
  if (habit === "swarm") {
    if (swarmFeeds(enemy)) return true;
    if (distance > 1 && randomInt(100) <= 35) {
      moveCreature(enemy, creatureRandomStep(enemy));
      return true;
    }
    return false;
  }
  if (habit === "skirmisher") {
    if (distance !== 1) return false;
    enemyAttack(enemy);
    if (!state.run.lost) moveCreature(enemy, creatureStepAway(enemy));
    return true;
  }
  if (habit === "thief") {
    if (enemy.fleeing) {
      const away = creatureStepAway(enemy);
      if (away) moveCreature(enemy, away);
      else if (distance === 1) enemyAttack(enemy);
      const now = distanceInSquares(enemy, state.run.player);
      if (enemy.alive && now >= 8 && !hasLineOfSight(state.run.player, enemy)) thiefEscapes(enemy);
      return true;
    }
    if (distance === 1 && randomInt(100) <= 70) return stealFrom(enemy);
    return false;
  }
  if (habit === "sentinel") {
    const fromPost = distanceInSquares(state.run.player, enemy.post || enemy);
    if (fromPost > 4 && distance > 1) {
      const home = enemy.post || enemy;
      if (enemy.x === home.x && enemy.y === home.y) enemy.alerted = false;
      else moveCreature(enemy, creatureStepToward(enemy, home));
      return true;
    }
    return false;
  }
  if (habit === "territorial") {
    const inRoom = roomIndexAt(state.run.player.x, state.run.player.y) === enemy.roomIndex;
    if (!inRoom && distance > 2) {
      const home = enemy.post || enemy;
      if (enemy.x === home.x && enemy.y === home.y) {
        if (enemy.alerted) addLog(`${enemy.name} watches you go and settles back into its chamber.`);
        enemy.alerted = false;
      } else {
        moveCreature(enemy, creatureStepToward(enemy, home));
      }
      return true;
    }
    return false;
  }
  if (habit === "caster") {
    if (distance >= 2 && distance <= 5 && hasLineOfSight(enemy, state.run.player)) {
      enemyAttack(enemy, false, state.run.dodging, { ranged: true });
      return true;
    }
    return false;
  }
  if (habit === "charger") {
    if (distance <= 1) return false;
    for (let stride = 0; stride < 2; stride += 1) {
      if (distanceInSquares(enemy, state.run.player) <= 1) break;
      if (!moveCreature(enemy, creatureStepToward(enemy, state.run.player, { adjacent: true }))) break;
      if (!enemy.alive) break;
    }
    return true;
  }
  return false;
}

// Turns for creatures that haven't noticed you.
function creatureIdle(enemy) {
  const habit = creatureHabit(enemy);
  if (habit === "swarm") {
    swarmFeeds(enemy) || (randomInt(4) === 1 && moveCreature(enemy, creatureRandomStep(enemy)));
    return;
  }
  if (habit === "wanderer") {
    const goal = wandererGoal(enemy);
    if (!goal) return;
    if (enemy.x === goal.x && enemy.y === goal.y) {
      enemy.alive = false;
      enemy.gone = true;
      enemy.lootDropped = true;
      if (distanceInSquares(enemy, state.run.player) <= 7) addLog(`${enemy.name} trots up the stairs toward the light and is gone.`);
      return;
    }
    const step = creatureStepToward(enemy, goal, { throughDoors: true });
    if (step && state.run.terrain[tileIndex(step.x, step.y)] === "door" && !state.run.openDoors.includes(tileIndex(step.x, step.y))) {
      state.run.openDoors.push(tileIndex(step.x, step.y));
      return;
    }
    if (!step) {
      // You're in the way. It snaps at you to get past.
      if (distanceInSquares(enemy, state.run.player) === 1 && randomInt(2) === 1) {
        addLog(`${enemy.name} growls: you're in its way.`);
        enemyAttack(enemy);
      }
      return;
    }
    moveCreature(enemy, step);
  }
}

// Called by enemiesTakeTurn before creatures act.
function beginCreaturePhase() {
  stirLurkers();
  checkSleepers();
}

// ---------- Display ----------

function creatureStateLabel(enemy) {
  if (enemy.windup) return "winding up";
  if (enemy.asleep) return "asleep";
  if (enemy.discord > 0) return "spellbound";
  if (enemy.staggered) return "stunned";
  if (enemy.rooted > 0) return "rooted";
  if (enemy.slowed > 0) return "slowed";
  if (enemy.sated > 0) return "feeding";
  const living = typeof ecologyMoodLabel === "function" ? ecologyMoodLabel(enemy) : "";
  if (living && (!enemy.alerted || living === "starving")) return living;
  if (enemy.fleeing || enemy.fleeTurns > 0) return "fleeing";
  if (creatureHabit(enemy) === "wanderer" && !enemy.alerted) return "ignoring you";
  if (!enemy.alerted) return "unaware";
  return "";
}

function knowsCreatureHabit(enemy) {
  return (state.run?.progress?.bestiary?.[enemy?.templateId] || 0) >= 1;
}

// Attacking a creature makes it hostile, whatever its habit: a wanderer turns on you, a
// sleeper wakes, a sentinel gives chase.
function provokeCreature(enemy) {
  if (!enemy) return;
  enemy.alerted = true;
  enemy.provoked = true;
  enemy.sated = 0;
  if (enemy.deepSleep && enemy.asleep) {
    enemy.asleep = 0;
    enemy.deepSleep = false;
  }
}

// Heavy metal armor clanks: creatures notice you a square farther away and you sneak past
// sleepers with disadvantage. Light armor and cotton are quiet.
function armorIsNoisy(character = state.run?.character) {
  const id = character?.equipment?.armor;
  if (!id || id === "none" || typeof ARMORS === "undefined") return false;
  const armor = ARMORS[id];
  const base = ARMORS[armor?.baseId] || armor;
  if (!base) return false;
  return base.dex === false || (Number.isFinite(base.dexCap) && base.dexCap <= 1);
}
