"use strict";

// What some creatures can do beyond biting: their powers, and the tricks they play.
//
//   Sounds        Animals you can't see make their sounds now and then: a turkey gobbling
//                 to the east, a jaguar's cough to the north. They tell you what's out
//                 there, and from where.
//   Tlacatecolotl The owl-man is a sorcerer, and it likes mischief. From the dark it makes
//                 the sounds of other animals (or of someone calling for help) where
//                 nothing is, to draw you off, or onto a trap. Follow the sound and you find
//                 nothing, and it laughs: your fright feeds it. Once you know the trick, its
//                 sounds don't quite ring true. Its hoot is an ill omen.
//   Chaneque      A little spirit of wild places, older and stronger than it looks. It
//                 frightens the soul out of you (susto), turns you around so you lose your
//                 way, and slips out of sight when it's hurt.
//   Alux          A clay guardian. It rains stones on you from a distance, and when it's
//                 broken it is made again at its house.
//   Both          Ordinary weapons only half harm them; a relic weapon or the priests'
//                 sun-fire and a patron's night-power harm them fully (systems/strikes.js).

const WILES_SOUNDS = {
  turkey: "a turkey gobbling",
  jaguar: "a jaguar's cough",
  mapachin: "chittering, and something washing in water",
  dog: "a coyote yipping",
  rabbit: "the thump of a big rabbit's foot",
  baby: "a baby crying",
  wail: "a woman wailing",
  axe: "an axe biting into wood",
  giggle: "giggling",
  splash: "splashing",
  help: "someone calling for help"
};
const WILES_SOUND_OF = {
  "cave-turkey": "turkey", "giant-turkey": "turkey", "turkey-raptor": "turkey", "black-turkey-raptor": "turkey",
  "jungle-jaguar": "jaguar", "black-jaguar": "jaguar", tlacoocelotl: "jaguar",
  mapachin: "mapachin", hueymapachin: "mapachin", "elder-mapachin": "mapachin",
  coyotl: "dog", "xolo-hound": "dog", dungeonrabbit: "rabbit", dungeonrabbit2: "rabbit",
  "cenote-stalker": "baby", cihuateotl: "wail", yohualtepoztli: "axe", duende: "giggle", axolocatl: "splash"
};
const WILES_DIRECTIONS = {
  N: "to the north", NE: "to the northeast", E: "to the east", SE: "to the southeast",
  S: "to the south", SW: "to the southwest", W: "to the west", NW: "to the northwest"
};
const WILES_SOUND_REACH = 9;       // planned squares a call carries
const WILES_SOUND_CHANCE = 0.035;  // each creature out of sight, each turn
const WILES_SPELL_COOLDOWN = 4;

function wilesState() {
  if (!state.run) return null;
  state.run.wiles ||= { quietUntil: 0, decoy: null };
  return state.run.wiles;
}

function wilesDirection(spot) {
  const player = state.run.player;
  const key = `${Math.sign(spot.x - player.x)},${Math.sign(spot.y - player.y)}`;
  return WILES_DIRECTIONS[SURROUNDINGS_DIRECTIONS[key]] || "close by";
}

// "You hear a turkey gobbling, to the east." An owl's copy, once you know the trick, is a
// little off.
function wilesHear(soundKey, spot, { fake = false } = {}) {
  const sound = WILES_SOUNDS[soundKey];
  if (!sound) return;
  const tell = fake && typeof naturalist === "function" && naturalist().tlacatecolotl?.facts?.includes("mimics");
  addLog(tell ? `You hear ${sound}, ${wilesDirection(spot)}. It doesn't sound quite right.` : `You hear ${sound}, ${wilesDirection(spot)}.`);
}

// ---------- Each turn ----------

function wilesTurn() {
  if (state.run?.location !== "dungeon" || state.run.lost) return;
  const wiles = wilesState();
  const steps = state.run.steps || 0;
  wilesDecoyCheck(wiles, steps);
  for (const owl of state.run.enemies) {
    if (owl.alive && owl.templateId === "tlacatecolotl") wilesOwl(owl, wiles, steps);
  }
  if (steps < (wiles.quietUntil || 0)) return;
  for (const creature of shuffle(state.run.enemies.filter((enemy) => enemy.alive && WILES_SOUND_OF[enemy.templateId]))) {
    if (playerSees(creature) || creature.asleep || distanceInSquares(creature, state.run.player) > gridReach(WILES_SOUND_REACH)) continue;
    // (One you've just heard keeps quiet a while, so the log isn't one animal over and over.)
    if ((creature.heardAt ?? -999) > steps - 40 || Math.random() >= WILES_SOUND_CHANCE) continue;
    wilesHear(WILES_SOUND_OF[creature.templateId], creature);
    creature.heardAt = steps;
    wiles.quietUntil = steps + 8;
    return;
  }
}

// ---------- The owl-man's mischief ----------

function wilesOwl(owl, wiles, steps) {
  if (owl.provoked || owl.alerted || (owl.wileAt || 0) > steps || playerSees(owl)) return;
  if (distanceInSquares(owl, state.run.player) > gridReach(12)) return;
  // It plays its tricks on those it has no liking for.
  if ((owl.mind?.value || 0) >= 0.45 || owl.mind?.gifted) return;
  if (Math.random() >= 0.12) return;
  owl.wileAt = steps + 14;
  const omened = progress().conditions.some((entry) => entry.id === "ill-omened");
  if (!wiles.decoy && Math.random() < 0.7) {
    wilesMimic(owl, wiles, steps);
    return;
  }
  if (omened) return;
  addLog("From the dark comes an owl's hoot, three times.");
  const dc = 10 + Math.floor((state.run.dungeonFloor || 1) / 2);
  const save = randomInt(20) + savingThrowBonus("wis");
  if (save >= dc) {
    addLog(`You shake off the omen (Wisdom save ${save} vs. ${dc}).`);
    return;
  }
  applyCondition("ill-omened", "The tlacatecolotl's hoot");
  if (typeof mindSated === "function") mindSated(owl, 25);
}

// It throws a sound where nothing is: some animal of this floor, a crying baby, a call for
// help. Half the time it puts the sound beside a trap you haven't found.
function wilesMimic(owl, wiles, steps) {
  const player = state.run.player;
  const kinds = [...new Set(state.run.enemies.filter((enemy) => enemy.alive && WILES_SOUND_OF[enemy.templateId] && enemy.templateId !== "tlacatecolotl")
    .map((enemy) => WILES_SOUND_OF[enemy.templateId])), "help", "baby"];
  const sound = kinds[randomInt(kinds.length) - 1];
  const traps = state.run.hazards.filter((hazard) => !hazard.triggered && !hazard.revealed &&
    distanceInSquares(hazard, player) >= gridReach(3) && distanceInSquares(hazard, player) <= gridReach(9));
  let spot = traps.length && Math.random() < 0.5 ? traps[randomInt(traps.length) - 1] : null;
  if (!spot) {
    const options = [];
    for (let tries = 0; tries < 60 && options.length < 8; tries += 1) {
      const angle = Math.random() * Math.PI * 2;
      const reach = gridReach(4) + randomInt(gridReach(5));
      const x = Math.round(player.x + Math.cos(angle) * reach);
      const y = Math.round(player.y + Math.sin(angle) * reach);
      if (isWalkable(x, y) && !playerSees({ x, y })) options.push({ x, y });
    }
    spot = options[0] || null;
  }
  if (!spot) return;
  wiles.decoy = { x: spot.x, y: spot.y, owl: owl.id, sound, step: steps };
  wilesHear(sound, spot, { fake: true });
}

// You went to look. There's nothing there, and it laughs.
function wilesDecoyCheck(wiles, steps) {
  const decoy = wiles.decoy;
  if (!decoy) return;
  if (steps - decoy.step > 40) {
    wiles.decoy = null;
    return;
  }
  const close = distanceInSquares(decoy, state.run.player);
  if (close > 1 && !(close <= gridReach(2) && playerSees(decoy))) return;
  wiles.decoy = null;
  addLog("There's nothing here. Somewhere above you, something laughs, low, and an owl hoots.");
  const owl = state.run.enemies.find((enemy) => enemy.id === decoy.owl && enemy.alive);
  if (owl && typeof mindSated === "function") mindSated(owl, 40);
  if (typeof ecoObserve === "function") ecoObserve("tlacatecolotl", "mimics");
}

// ---------- The chaneque's and the alux's powers ----------

// Called at the start of a creature's fighting turn (systems/behaviors.js: creatureAct).
// Returns true when it used its turn on a power.
function wilesAct(enemy, distance) {
  if (enemy.templateId === "chaneque") return wilesChaneque(enemy, distance);
  if (enemy.templateId === "alux") return wilesAlux(enemy, distance);
  return false;
}

function wilesSave(ability, enemy) {
  const dc = 10 + Math.floor((enemy.level || state.run.dungeonFloor || 1) / 2);
  return { dc, roll: randomInt(20) + savingThrowBonus(ability) };
}

function wilesChaneque(enemy, distance) {
  const steps = state.run.steps || 0;
  // Hurt, it slips out of sight, once a fight.
  if (enemy.hp <= enemy.maxHp / 2 && !enemy.vanished) {
    const room = state.run.rooms[enemy.eco?.home ?? enemy.roomIndex];
    const taken = typeof ecoOccupiedTiles === "function" ? ecoOccupiedTiles() : new Set();
    let spot = null;
    for (let tries = 0; tries < 30 && !spot; tries += 1) {
      const candidate = room ? ecoFreeTile(room, taken) : null;
      if (candidate && !playerSees(candidate)) spot = candidate;
    }
    if (spot) {
      enemy.vanished = steps;
      reportAt(enemy, `${enemy.name} steps behind a root and isn't there anymore.`);
      enemy.x = spot.x;
      enemy.y = spot.y;
      enemy.alerted = false;
      enemy.fleeTurns = 0;
      return true;
    }
  }
  if ((enemy.spellAt || 0) > steps || distance > gridReach(4) || !hasLineOfSight(enemy, state.run.player)) return false;
  enemy.spellAt = steps + WILES_SPELL_COOLDOWN;
  const frightened = progress().conditions.some((entry) => entry.id === "susto");
  const { dc, roll } = wilesSave("wis", enemy);
  if (!frightened) {
    addLog(`${enemy.name} looks at you with its old man's face and shrieks.`);
    if (roll >= dc) addLog(`You hold on to yourself (Wisdom save ${roll} vs. ${dc}).`);
    else applyCondition("susto", "The chaneque");
    return true;
  }
  addLog(`${enemy.name} turns three times on the spot, and the chamber turns with it.`);
  if (roll >= dc) {
    addLog(`You keep your bearings (Wisdom save ${roll} vs. ${dc}).`);
    return true;
  }
  wilesTurnAround();
  return true;
}

// You're turned around: you come to yourself somewhere else close by, out of its sight.
function wilesTurnAround() {
  const player = state.run.player;
  const options = [];
  for (let tries = 0; tries < 80 && options.length < 6; tries += 1) {
    const x = player.x + randomInt(gridReach(6) * 2 + 1) - gridReach(6) - 1;
    const y = player.y + randomInt(gridReach(6) * 2 + 1) - gridReach(6) - 1;
    const reach = distanceInSquares({ x, y }, player);
    if (reach < gridReach(3) || !isWalkable(x, y) || tileHasCreature(x, y)) continue;
    if (state.run.hazards.some((hazard) => !hazard.triggered && hazard.x === x && hazard.y === y)) continue;
    if ((state.run.treasures || []).some((cache) => cache.x === x && cache.y === y)) continue;
    options.push({ x, y });
  }
  const spot = options[0];
  if (!spot) return;
  if (typeof stopWalking === "function") stopWalking();
  state.run.player = { ...player, x: spot.x, y: spot.y };
  if (typeof revealAroundPlayer === "function") revealAroundPlayer();
  addLog("You come to yourself somewhere else, and you don't remember walking here.");
}

function wilesAlux(enemy, distance) {
  const steps = state.run.steps || 0;
  if ((enemy.spellAt || 0) > steps || distance > gridReach(5) || distance < 2 || !hasLineOfSight(enemy, state.run.player)) return false;
  enemy.spellAt = steps + WILES_SPELL_COOLDOWN - 1;
  addLog(`${enemy.name} whistles, and stones come down out of the dark.`);
  const center = { x: state.run.player.x, y: state.run.player.y };
  const victims = partyMembers().filter((member) => (member.hero ? state.run.hp > 0 && distanceInSquares(state.run.player, center) <= 1
    : member.hp > 0 && distanceInSquares(member, center) <= 1));
  for (const victim of victims) {
    let damage = Math.ceil(rollDice(enemy.damage).total * 1.25);
    const save = victim.hero ? randomInt(20) + savingThrowBonus("dex") : randomInt(20) + 2;
    const dc = 10 + Math.floor((enemy.level || 1) / 2);
    if (save >= dc) damage = Math.ceil(damage / 2);
    if (victim.hero) {
      damage = heroDamageAfterAbilities(damage);
      state.run.hp = Math.max(0, state.run.hp - damage);
      showCombatFeedback("player-hit", `−${damage} HP`, { actor: "player", x: state.run.player.x, y: state.run.player.y });
      addLog(`Stones hit you for ${damage} damage (Dexterity save ${save} vs. ${dc}).`);
      checkDefeat();
    } else {
      victim.hp = Math.max(0, victim.hp - damage);
      addLog(`Stones hit ${victim.name} for ${damage} damage.`);
    }
  }
  sfx("hit");
  return true;
}

// Ordinary weapons only half harm what wards itself (data/ecology.js: wards). A relic
// weapon bites fully; so do sun-fire and night-power.
function wilesWarded(enemy, kind) {
  if (!ecoSpecies(enemy)?.wards || !["edge", "crush", "point"].includes(kind)) return false;
  const weapon = state.run?.character?.equipment?.weapon;
  return !(typeof gearTierOf === "function" && gearTierOf(weapon) === "relic");
}

// A gift to a chaneque: it shows you what's hidden around its keeping.
function wilesShowHidden(enemy) {
  let shown = 0;
  for (const hazard of state.run.hazards) {
    if (hazard.triggered || hazard.revealed || distanceInSquares(hazard, enemy) > gridReach(8)) continue;
    hazard.revealed = true;
    shown += 1;
  }
  for (const lurker of [...(state.run.lurkers || [])]) {
    if (distanceInSquares(lurker, enemy) > gridReach(8)) continue;
    revealLurker(lurker, false);
    lurker.alerted = false;
    shown += 1;
  }
  return shown;
}
