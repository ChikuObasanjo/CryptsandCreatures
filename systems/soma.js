"use strict";

// The body under the mind. (MINDS.md, "The body", has the long version and the sources.)
//
// A creature's mind (systems/minds.js) used to read its body as two numbers: how hungry it is
// and how hurt. A living body is busier than that. Under every decision a few things run on
// their own clocks, and the mind feels them as surely as it feels you:
//
//   heart     how hard its heart and breath are going. A fright, a fight, a run, or a wound
//             sends it up at once; it comes down over half an hour. The harder it pounds, the
//             harder whatever the creature feels hits it: the same danger frightens a pounding
//             heart more, the same insult maddens it more, and its attention narrows onto
//             whatever set it going.
//   tension   how tightly it holds itself, set to spring. It rises with the heart and lets go
//             slowly, so a creature that was frightened stays jumpy for an hour after: it
//             startles from farther off and notices you sooner. Rest, the bodies of its own
//             kind against it, and sleep let it go.
//   fatigue   how spent it is from running and fighting. A spent creature can't run (cornered,
//             it turns at bay) and a spent hunter gives up the chase.
//   pain      what a wound sends through it. While its heart is pounding it hardly feels it
//             (the body's own medicine); afterwards it does, and it nurses the wound: it rests
//             more, wonders less, and is quicker to shy from a second fight.
//   strain    what days of fright and too little sleep leave in its blood: the slow hormones.
//             It sets how on edge the creature is to begin with, and only sleep clears it. A
//             badly strained body doesn't breed.
//   pressure  how long it has been awake: the need for sleep (systems/sleep.js).
//
// And it feels where it is: the warmth or cold of the stone, the wet, the walls at its back,
// the ground under it, and the bodies of its own kind pressed against it. What each kind finds
// comfortable follows from where its kind lives (the habitats in data/ecology.js): a jaguar
// likes a close, dry den, an axolocatl the wet, a colotl the heat of the vents. A creature at
// ease drifts toward comfort the way a bacterium swims up a sugar gradient, and that is where
// it beds down (systems/sleep.js), so each one wears its own paths into the tomb.
//
// Nothing here tells a creature what to do. The body changes what the mind feels; the mind
// decides as it always has. The dead have no body left to feel with, and the great guardians
// never had one: neither has any of this.

const SOMA_KEYS = ["heart", "tension", "fatigue", "pain", "strain", "pressure"];
// How long each takes to come halfway back to rest, in ticks (ten minutes each).
const SOMA_HALF = { heart: 2, heartAsleep: 1, tension: 6, tensionAsleep: 1.5, fatigue: 6, fatigueAsleep: 2, pain: 3, strain: 72, strainAsleep: 12 };
// Where heart and tension sit when nothing is happening.
const SOMA_REST = { heart: 0.1, tension: 0.06 };
// What mends a wound, as a share of its hit points per tick: asleep, and resting awake.
const SOMA_MEND = { asleep: 0.005, resting: 0.001 };
// A body neither calm nor roused (what the mind reads from a creature without one).
const SOMA_NONE = { heart: 1 / 3, tension: 0, fatigue: 0, pain: null, strain: 0, tired: 0, comfort: 1, touch: 0, gain: 1, body: false };

const somaClamp = (value) => Math.max(0, Math.min(1, value));

// Does this creature have a body that feels? Animals, raiders, and the wardens (who are
// small living things bound to a place). Not the dead, not the great guardians.
function somaApplies(creature, species = ecoSpecies(creature)) {
  if (!creature?.alive || creature.friendly || creature.lurking || !creature.eco || !species || species.role === "colony") return false;
  // (Not the great guardians, and not an ambusher lying hidden: it waits, and that is all.)
  if (creature.guardian || (state.run.lurkers || []).includes(creature)) return false;
  return typeof mindNature === "function" ? mindNature(creature, species).body >= 0.5 : true;
}

function somaFor(creature) {
  let soma = creature.soma;
  if (!soma || typeof soma !== "object" || Array.isArray(soma)) {
    const species = ecoSpecies(creature);
    const wound = 1 - creature.hp / Math.max(1, creature.maxHp);
    const wake = species && typeof lawWake === "function" ? lawWake(species) : 1;
    // Whatever was already alive when you came has been awake a while, longer if this is
    // its kind's time to sleep.
    soma = creature.soma = {
      heart: SOMA_REST.heart, tension: SOMA_REST.tension, fatigue: 0.05, pain: 0.55 * wound, strain: 0.05,
      pressure: Math.round((0.25 + 0.5 * (1 - wake) + 0.2 * Math.random()) * 100) / 100, hp: creature.hp
    };
  }
  for (const key of SOMA_KEYS) if (!Number.isFinite(soma[key])) soma[key] = key === "heart" ? SOMA_REST.heart : 0.05;
  if (!Number.isFinite(soma.hp)) soma.hp = creature.hp;
  return soma;
}

// ---------- What each kind is comfortable in ----------

const SOMA_LIKES = new Map();

// From the chambers its kind lives in, weighted by how much it lives there: [center,
// tolerance] for warmth, wet, and shelter.
function somaLikes(templateId, species) {
  if (SOMA_LIKES.has(templateId)) return SOMA_LIKES.get(templateId);
  const sums = { warm: [0, 0, 0], moist: [0, 0, 0], shelter: [0, 0, 0] };
  for (const habitat of Object.values(window.CryptsEcology?.habitats || {})) {
    const weight = habitat.residents?.[templateId];
    if (!weight) continue;
    for (const key of Object.keys(sums)) {
      let prefers = habitat.prefers?.[key];
      if (key === "moist" && !prefers) prefers = habitat.water === "basin" ? [0.9, 0.3] : habitat.water === "dry" ? [0.2, 0.3] : null;
      if (!prefers) continue;
      sums[key][0] += weight;
      sums[key][1] += weight * prefers[0];
      sums[key][2] += weight * prefers[1];
    }
  }
  const pick = (key, fallback) => (sums[key][0] > 0 ? [sums[key][1] / sums[key][0], Math.max(0.2, sums[key][2] / sums[key][0])] : fallback);
  const likes = {
    warm: pick("warm", [0.5, 0.45]),
    wet: species?.aquatic ? [0.85, 0.3] : pick("moist", [0.45, 0.45]),
    // (Most animals like a wall at their back; those that live in dens like it close.)
    shelter: pick("shelter", [0.55, 0.4])
  };
  SOMA_LIKES.set(templateId, likes);
  return likes;
}

// ---------- What it feels where it stands ----------

// Does it take comfort in the bodies of its own kind? Flocks and packs do, and most things
// that live a few together; the lone hunters don't.
function somaSocial(creature, species) {
  if (typeof mindNature !== "function") return Boolean(species.packs);
  const nature = mindNature(creature, species);
  const base = typeof MIND_NATURES !== "undefined" && nature === MIND_NATURES.animal
    ? (species.packs ? 0.8 : species.territorial ? 0.15 : 0.4) : nature.kin || 0;
  return base >= 0.4;
}

// How much of its own kind is pressed against it at (x, y): 0, or up to 1 with two or more.
function somaKinAgainst(creature, species, x = creature.x, y = creature.y) {
  if (!somaSocial(creature, species)) return 0;
  let count = 0;
  for (const other of state.run.enemies) {
    if (other === creature || !other.alive || other.templateId !== creature.templateId || other.friendly) continue;
    if (Math.abs(other.x - x) <= 1 && Math.abs(other.y - y) <= 1) count += 1;
  }
  return Math.min(1, count / 2);
}

function somaWallsAround(x, y) {
  let walls = 0;
  for (const step of MOVEMENT_DIRECTIONS) {
    const nx = x + step.x;
    const ny = y + step.y;
    if (nx < 0 || ny < 0 || nx >= MAP_TILE_SIZE || ny >= MAP_TILE_SIZE) { walls += 1; continue; }
    const terrain = state.run.terrain[tileIndex(nx, ny)];
    if (!terrain || terrain === "wall" || terrain === "stone") walls += 1;
  }
  return walls;
}

// The feel of a spot: { warm, wet, shelter, kin, comfort }, each 0 to 1. Warmth from the
// chamber and the ground (the living rock is warm, water cool) and from its own kind against
// it; wet from the air and from standing in water; shelter from the chamber and from the
// walls at its back (animals keep to the walls: a corner is safest).
function somaPlace(creature, species, x = creature.x, y = creature.y) {
  const room = state.run.rooms[roomIndexAt(x, y)];
  const floor = state.run.dungeonFloor || 1;
  const env = room?.env || { warm: 0.25 + 0.45 * floor / DUNGEON_FLOOR_COUNT, moist: 0.4, shelter: 0.6 };
  const ground = typeof groundAt === "function" ? groundAt(x, y) : ".";
  const kin = somaKinAgainst(creature, species, x, y);
  const walls = somaWallsAround(x, y);
  const warm = somaClamp((env.warm ?? 0.5) + (ground === "f" ? 0.12 : 0) - (ground === "w" || ground === "d" ? 0.08 : 0) + 0.1 * kin);
  const wet = somaClamp(0.75 * (env.moist ?? 0.4) + (ground === "w" ? 0.35 : ground === "d" ? 0.6 : 0) +
    (ground === "m" || ground === "y" ? 0.08 : 0) - (ground === "a" ? 0.15 : 0));
  const shelter = somaClamp(0.45 * (env.shelter ?? 0.5) + 0.55 * Math.min(1, walls / 3));
  // Moss, roots, and mycelium are soft to lie on; rubble, bones, and crystal are not.
  const soft = ["m", "r", "y"].includes(ground) ? 1 : ["u", "b", "c"].includes(ground) ? -1 : 0;
  const likes = somaLikes(creature.templateId, species);
  // How far each is from what it likes (the middle: lawMiddle), weighed.
  const off = 0.45 * Math.min(2, lawMiddle(warm, likes.warm[0], likes.warm[1])) +
    0.35 * Math.min(2, lawMiddle(wet, likes.wet[0], likes.wet[1])) +
    (shelter < likes.shelter[0] ? 0.3 * Math.min(2, lawMiddle(shelter, likes.shelter[0], likes.shelter[1])) : 0);
  const comfort = somaClamp(Math.exp(-off) * (1 + 0.06 * soft) + 0.12 * kin);
  return { warm, wet, shelter, kin, comfort };
}

// A step toward comfort, for a creature at its ease: the squares around it (and staying
// put) weighed by how they feel, one picked with the odds leaning hard toward the best. It
// stays within the chamber it is in. Returns a square to step to, or null to stay.
function somaDrift(creature, species) {
  const here = roomIndexAt(creature.x, creature.y);
  const options = [{ spot: null, comfort: somaPlace(creature, species).comfort + 0.03 }];
  for (const step of MOVEMENT_DIRECTIONS) {
    const spot = { x: creature.x + step.x, y: creature.y + step.y };
    if (roomIndexAt(spot.x, spot.y) !== here || !canStepBetween(creature, spot) || tileHasCreature(spot.x, spot.y, creature) ||
      (spot.x === state.run.player.x && spot.y === state.run.player.y)) continue;
    options.push({ spot, comfort: somaPlace(creature, species, spot.x, spot.y).comfort });
  }
  const top = Math.max(...options.map((option) => option.comfort));
  const weights = options.map((option) => Math.exp((option.comfort - top) / 0.06));
  let roll = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let index = 0; index < options.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) return options[index].spot;
  }
  return null;
}

// ---------- Its clock ----------

// Called for every creature with a body once a tick (systems/ecology.js), or once an hour
// with ticks = 6 for a floor you are away from.
function somaTick(creature, species, ticks = 1) {
  if (!somaApplies(creature, species)) return;
  const soma = somaFor(creature);
  somaCheckHurt(creature, soma);
  const asleep = Boolean(creature.asleep && creature.eco?.sleeping);
  // It feels its place each turn while you're on the floor; away, it keeps the last feel.
  if (ticks <= 1 || !Number.isFinite(soma.comfort)) {
    const place = somaPlace(creature, species);
    soma.comfort = Math.round(place.comfort * 100) / 100;
    soma.touch = Math.round(place.kin * 100) / 100;
    soma.shelter = Math.round(place.shelter * 100) / 100;
  }
  const touch = soma.touch || 0;
  const comfort = Number.isFinite(soma.comfort) ? soma.comfort : 1;
  const settle = (key, target, half) => { soma[key] = target + (soma[key] - target) * Math.pow(0.5, ticks / half); };
  // The bodies of its own kind against it calm it (each other's warmth and breathing).
  const soothe = 1 + touch;
  // The heart comes down on its own, slower in a body that is strained or uncomfortable.
  settle("heart", asleep ? 0.05 : SOMA_REST.heart + 0.2 * soma.strain + 0.1 * (1 - comfort), asleep ? SOMA_HALF.heartAsleep : SOMA_HALF.heart / soothe);
  // Tension follows the heart up at once and lets go slowly.
  if (soma.heart > soma.tension) soma.tension += (soma.heart - soma.tension) * (1 - Math.pow(0.65, ticks));
  else settle("tension", asleep ? 0.02 : SOMA_REST.tension + 0.3 * soma.strain, asleep ? SOMA_HALF.tensionAsleep : SOMA_HALF.tension / soothe);
  settle("fatigue", 0, asleep ? SOMA_HALF.fatigueAsleep : SOMA_HALF.fatigue);
  // Pain eases to the ache of the wound.
  const wound = 1 - creature.hp / Math.max(1, creature.maxHp);
  settle("pain", 0.55 * wound, SOMA_HALF.pain);
  // Strain builds while the heart won't come down and while it goes without sleep, and
  // clears in sleep.
  if (!asleep) soma.strain = somaClamp(soma.strain + ticks * (0.02 * Math.max(0, soma.heart - 0.35) + 0.015 * Math.max(0, soma.pressure - 0.85)));
  settle("strain", 0, asleep ? SOMA_HALF.strainAsleep : SOMA_HALF.strain);
  if (typeof sleepPressure === "function") sleepPressure(creature, soma, asleep, ticks);
  else soma.pressure = 0;
  somaMend(creature, soma, asleep, ticks, wound, species);
  for (const key of SOMA_KEYS) soma[key] = Math.round(somaClamp(soma[key]) * 1000) / 1000;
}

// Wounds close, a little at a time: most in sleep, a little at rest, not at all in a fight.
function somaMend(creature, soma, asleep, ticks, wound, species) {
  if (!(wound > 0) || creature.hp <= 0) { delete soma.mend; return; }
  const resting = !creature.alerted && !creature.fleeTurns && soma.heart < 0.35;
  let rate = asleep ? SOMA_MEND.asleep : resting ? SOMA_MEND.resting : 0;
  if (typeof ecoIsSick === "function" && ecoIsSick(creature)) rate *= 0.5;
  if (ecoHungerState(creature) === "starving") rate = 0;
  soma.mend = (soma.mend || 0) + rate * creature.maxHp * ticks;
  const whole = Math.floor(soma.mend);
  if (whole <= 0) return;
  soma.mend -= whole;
  creature.hp = Math.min(creature.maxHp, creature.hp + whole);
  soma.hp = creature.hp;
  if (asleep) creature.sleepHp = creature.hp;
  if (creature.mind) creature.mind.lastHp = creature.hp;
}

// ---------- What happens to it ----------

// It lost hit points since it last looked: the pain of it, and the heart jumping.
function somaCheckHurt(creature, soma = somaFor(creature)) {
  if (creature.hp < soma.hp) {
    const lost = (soma.hp - creature.hp) / Math.max(1, creature.maxHp);
    soma.pain = somaClamp(soma.pain + 2.2 * lost);
    soma.heart = somaClamp(soma.heart + (0.35 + lost) * (1 - soma.heart));
  }
  soma.hp = creature.hp;
}

// A fright, a blow out of nowhere, something bursting in: the heart jumps (further in a body
// already wound tight), and tension with it.
function somaStartle(creature, amount) {
  if (!somaApplies(creature)) return;
  const soma = somaFor(creature);
  soma.heart = somaClamp(soma.heart + amount * (0.75 + 0.5 * soma.tension) * (1 - soma.heart));
  soma.tension = somaClamp(soma.tension + 0.3 * amount);
}

// Running, fighting, struggling: it spends itself, and its heart goes up with the work.
function somaExert(creature, amount) {
  if (!(amount > 0) || !somaApplies(creature)) return;
  const soma = somaFor(creature);
  soma.fatigue = somaClamp(soma.fatigue + amount * (1 - soma.fatigue));
  soma.heart = somaClamp(soma.heart + 0.4 * amount * (1 - soma.heart));
}

// Something soothes it: food from your hand, an offering it takes.
function somaSoothe(creature, amount) {
  if (!somaApplies(creature)) return;
  const soma = somaFor(creature);
  soma.heart *= 1 - amount;
  soma.tension *= 1 - amount;
}

// The body answers what the mind made of things (called from mindThink once it has decided):
// the heart goes up with fear or anger, and to the sight of you if you once hurt it (the
// charge a frightening memory carries until sleep takes it off); running and fighting
// spend it.
const SOMA_EFFORT = { flee: 0.12, fight: 0.07, feign: 0.02, return: 0.03, follow: 0.015, watch: 0.01 };

function somaRespond(creature, drives, intent, senses) {
  if (!somaApplies(creature)) return;
  const soma = somaFor(creature);
  const felt = Math.max(drives.fear, drives.anger * 0.85, (drives.self?.threat || 0) * 0.5);
  if (felt > soma.heart) soma.heart = somaClamp(soma.heart + (felt - soma.heart) * 0.5);
  const dread = creature.mind?.dread || 0;
  if (senses && dread > 0) soma.heart = somaClamp(soma.heart + 0.3 * dread * (1 - soma.heart));
  somaExert(creature, SOMA_EFFORT[intent] || 0);
}

// ---------- What the mind reads ----------

// The body as the mind feels it. `pain` is what gets through (a pounding heart masks it),
// `tired` how badly it needs sleep (0 to 1), `gain` how hard feeling hits (1 for a heart
// neither calm nor roused).
function somaRead(creature) {
  if (!somaApplies(creature)) return SOMA_NONE;
  const soma = somaFor(creature);
  return {
    heart: soma.heart, tension: soma.tension, fatigue: soma.fatigue, strain: soma.strain,
    pain: soma.pain * (1 - 0.65 * soma.heart),
    tired: somaClamp((soma.pressure - 0.6) / 0.35),
    comfort: Number.isFinite(soma.comfort) ? soma.comfort : 1,
    touch: soma.touch || 0,
    gain: 0.85 + 0.45 * soma.heart,
    body: true
  };
}

// How unsettled its body leaves it, for where its stress settles (mindThink).
function somaUnease(creature) {
  const body = somaRead(creature);
  if (!body.body) return 0;
  return 0.3 * body.strain + 0.12 * (1 - body.comfort) + 0.15 * body.pain + 0.1 * body.tired;
}

// ---------- In a fight, and on watch ----------

// To its attack rolls: a spent or hurting body strikes worse.
function somaAttackModifier(creature) {
  const body = somaRead(creature);
  if (!body.body) return 0;
  return (body.fatigue >= 0.7 ? -1 : 0) + (body.pain >= 0.5 ? -1 : 0);
}

// To its armor: asleep in the open it is easy to hit (in a close bed with walls around it,
// less so); a tense body is quick to twist away; a spent one isn't.
function somaAcModifier(creature) {
  const body = somaRead(creature);
  if (!body.body) return 0;
  if (creature.asleep && creature.eco?.sleeping) return -2 + Math.round(2 * (creature.soma?.shelter || 0));
  return (body.tension >= 0.55 ? 1 : 0) - (body.fatigue >= 0.75 ? 1 : 0);
}

// To how far off it notices you: a tense body is on watch, and one that has gone over you in
// its sleep (systems/sleep.js) knows your step.
function somaNoticeModifier(creature) {
  const body = somaRead(creature);
  const ready = typeof memoryReady === "function" ? memoryReady(creature, "you") : 0;
  return Math.min(3, Math.round(2 * (body.body ? body.tension : 0)) + Math.round(2 * ready));
}

// A floor you leave is put away (saveDungeonFloorState): its creatures keep only the slow
// part of their bodies, the need for sleep and the strain. Heart, tension, fatigue, and pain
// settle within hours, so they start again at rest when you come back.
function somaPack(creature) {
  const soma = creature?.soma;
  if (!soma || typeof soma !== "object") return;
  creature.soma = { pressure: soma.pressure, strain: soma.strain };
}

// A body this strained doesn't breed (systems/energy.js).
function somaStrained(creature) {
  return Boolean(creature?.soma && creature.soma.strain >= 0.6);
}

// ---------- What you can see of it ----------

// Lines for the inspect panel about how its body is, or [] (mindDescription).
function somaManner(creature) {
  const body = somaRead(creature);
  if (!body.body || (creature.asleep && creature.eco?.sleeping)) return [];
  const parts = [];
  if (body.heart >= 0.6) parts.push("Its sides are heaving.");
  else if (body.tension >= 0.5) parts.push("It's jumpy.");
  if (body.fatigue >= 0.6) parts.push("It's worn out.");
  if (body.pain >= 0.35) parts.push("It's favoring a wound.");
  if (creature.soma.pressure >= 0.92) parts.push("It looks like it hasn't slept.");
  else if (body.tired >= 0.6) parts.push("It's drowsy.");
  if (body.touch >= 0.5 && body.heart < 0.4) parts.push("It's pressed close against the others of its kind.");
  return parts;
}
