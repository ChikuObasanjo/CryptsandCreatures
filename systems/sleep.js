"use strict";

// Sleep, and what it does with the day. (MINDS.md, "Sleep and dreams", has the long version
// and the sources.)
//
// Every creature with a body of its own (the animals and the raiders) needs sleep, and needs
// it more the longer it has been awake. That need and the hours its kind keeps (lawWake)
// together decide when it sleeps: the pressure that builds while it is awake, and the clock
// that opens and closes the gate (Alexander Borbély's two processes). It sleeps where it is
// most comfortable and safest: its bed, picked by feel (warmth, the walls at its back, soft
// ground, its own kind beside it; systems/soma.js) and kept night after night, unless
// something goes wrong there. A flock beds down together; a jaguar sleeps alone in the
// closest corner of its den.
//
// Awake, it gathers memories: where it ate, what hunted it, what you did, whom it slept
// against, where one of its own died. Each is laid down as strongly as its heart was going at
// the time (a fright is remembered; a quiet meal less so). It can hold only so many between
// sleeps, and the weakest are lost first.
//
// Asleep, it goes back over them. (The Nahua said the tonalli leaves the body in sleep and
// travels, and a dream is what it sees out there; the creatures' tonalli goes over their own
// day.) What it goes over, it keeps; the rest it lets go:
//
//   consolidating     the strongest memories become what it knows: which chambers fed it
//                     (where it goes looking when it's hungry and sees nothing to eat),
//                     which were good to it and which hurt it (where it chooses to live and
//                     where it won't), and what you are, held more surely.
//   pruning           everything it holds is turned down a little each night, and what falls
//                     too low is gone, and so are the day's memories it didn't go over. Sleep
//                     is how it forgets what it has no use for.
//   threat rehearsal  what hunted or hurt it today, it runs from again in its sleep, and it
//                     wakes readier: it expects that thing, notices it sooner, isn't startled
//                     by it, and is harder for that hunter to catch.
//   social rehearsal  those it slept against it holds closer (a flock that sleeps together
//                     holds together); grief is worked through faster; a rival that beat it
//                     leaves it knowing where it isn't welcome.
//   reset             the stress of the day is let go, and the charge comes off a frightening
//                     memory while the memory stays: it still knows you hurt it, but the sight
//                     of you no longer sets its heart pounding. A den where it can't sleep in
//                     peace, it leaves.
//
// Kept awake (by you, by hunger, by a tomb that won't let it rest) a creature learns less,
// holds its frights raw, and wears thin and short-tempered (its strain builds: soma.js).
//
// The dead don't sleep, so none of this touches them: nothing they learn of you is settled or
// softened overnight; only calm meetings and offerings wear it down, as before. The wardens
// keep watch and don't sleep either.

const SLEEP_RISE = 0.0135;     // per tick awake: from rested to sleepy over about sixteen hours
const SLEEP_FALL = 0.034;      // per tick asleep: from sleepy to rested in about eight
const SLEEP_CLOCK = 0.75;      // how much the hours its kind keeps weigh against the pressure
const SLEEP_ON = 0.85;         // sleepiness at which it beds down
const SLEEP_OFF = 0.42;        // and at which it wakes
const SLEEP_HELD = 950;        // `asleep` while it sleeps on its own: the sleep system wakes it, not a countdown
const SLEEP_HUNGRY = 25;       // it wakes when its satiety falls this low
const MEMORY_DAY = 8;          // memories it can hold between sleeps
const MEMORY_PLACES = 6;       // chambers it keeps in mind, good and bad
const MEMORY_FOOD = 4;         // chambers it remembers feeding in
const MEMORY_READY = 3;        // threats it keeps rehearsed

const sleepRound = (value) => Math.round(value * 100) / 100;
const sleepClamp = (value) => Math.max(0, Math.min(1, value));
const sleepSigned = (value) => Math.max(-1, Math.min(1, value));

// Does this creature sleep? Every body that is its own: not the dead, not the wardens (who
// keep watch), not the great guardians, and not the old sleepers on their hoards, whose sleep
// is older than this.
function sleepKeeps(creature, species = ecoSpecies(creature)) {
  if (typeof somaApplies !== "function" || !somaApplies(creature, species) || creature.deepSleep) return false;
  return mindNature(creature, species).body >= 0.9;
}

function sleepTicks() {
  return (typeof ecoState === "function" && ecoState()?.ticks) || 0;
}

// The pressure to sleep: up while awake (faster in a spent body), down while asleep
// (called from somaTick).
function sleepPressure(creature, soma, asleep, ticks) {
  if (!sleepKeeps(creature)) { soma.pressure = 0; return; }
  if (asleep) soma.pressure *= Math.pow(1 - SLEEP_FALL, ticks);
  else soma.pressure = 1 - (1 - soma.pressure) * Math.pow(1 - SLEEP_RISE * (1 + 0.6 * soma.fatigue), ticks);
}

// How sleepy it is now: the pressure, and the hours its kind keeps (above SLEEP_ON it beds
// down; asleep, below SLEEP_OFF it wakes).
function sleepiness(creature, species = ecoSpecies(creature)) {
  const soma = somaFor(creature);
  const wake = typeof lawWake === "function" ? lawWake(species) : 1;
  return soma.pressure + SLEEP_CLOCK * (1 - wake);
}

// Is it sleeping on its own (not knocked out by a spell, not an old sleeper on its hoard)?
function sleepsNow(creature) {
  return Boolean(creature?.asleep && creature.eco?.sleeping && creature.mind?.sleep);
}

// Can it lie down now? Not in a fight, a flight, a meal, or a dispute; not hungry (unless it
// is dropping); not while you have its attention.
function sleepMay(creature, species, eco, sleepy) {
  if (creature.alerted || creature.provoked || creature.fleeTurns > 0 || creature.band) return false;
  if (eco.flee > 0 || eco.feeding > 0 || eco.rival || eco.hunting) return false;
  const hunger = ecoHungerState(creature);
  if (hunger === "starving" || (hunger === "hungry" && sleepy < 1.1)) return false;
  const mind = creature.mind;
  if (mind && ["watch", "follow", "fight", "flee", "feign", "return"].includes(mind.intent) && mind.step >= (state.run.steps || 0) - 1) return false;
  return true;
}

// ---------- Its bed ----------

// Where it sleeps: a spot in its den picked by feel and kept. A bed it was hurt in it doesn't
// go back to. Kinds that live together lie down beside each other; the lone hunters apart.
function sleepBed(creature, species) {
  const mind = mindFor(creature);
  const home = Number.isInteger(creature.eco?.home) && state.run.rooms[creature.eco.home] ? creature.eco.home : roomIndexAt(creature.x, creature.y);
  // It won't lie down within reach of you unless it trusts you.
  const player = state.run.player;
  const wary = (mind.value || 0) < 0.3;
  const tooNear = (spot) => wary && distanceInSquares(spot, player) <= gridReach(2);
  const bed = mind.bed;
  if (bed && bed.r === home && roomIndexAt(bed.x, bed.y) === home && isWalkable(bed.x, bed.y, creature) &&
    !tileHasCreature(bed.x, bed.y, creature) && !tooNear(bed)) return bed;
  const room = state.run.rooms[home];
  if (!room) return null;
  const social = somaSocial(creature, species);
  const kinBeds = state.run.enemies.filter((other) => other !== creature && other.alive && other.templateId === creature.templateId &&
    other.mind?.bed?.r === home).map((other) => other.mind.bed);
  let best = null;
  // Spots across its den, and (for the kinds that sleep together) every spot beside a bed its
  // own kind already lies in.
  const spots = [];
  for (let attempt = 0; attempt < 48; attempt += 1) spots.push({ x: room.mapX + randomInt(room.mapW) - 1, y: room.mapY + randomInt(room.mapH) - 1 });
  if (social) for (const other of kinBeds) for (const step of MOVEMENT_DIRECTIONS) spots.push({ x: other.x + step.x, y: other.y + step.y });
  for (const { x, y } of spots) {
    if (roomIndexAt(x, y) !== home || !isWalkable(x, y, creature) || tileHasCreature(x, y, creature) ||
      (x === player.x && y === player.y) || tooNear({ x, y })) continue;
    const place = somaPlace(creature, species, x, y);
    const near = kinBeds.some((other) => distanceInSquares(other, { x, y }) <= 1) ? 1 : kinBeds.some((other) => distanceInSquares(other, { x, y }) <= 2) ? 0.5 : 0;
    const bad = mind.badBed && distanceInSquares(mind.badBed, { x, y }) <= 2 ? 1 : 0;
    // (And the farther from you, the better, for anything that doesn't know you to be kind.)
    const away = wary ? Math.min(1, distanceInSquares({ x, y }, player) / gridReach(6)) : 1;
    const score = place.comfort + 0.3 * place.shelter + (social ? 0.4 : -0.25) * near - 0.5 * bad + 0.3 * away + 0.04 * Math.random();
    if (!best || score > best.score) best = { x, y, score };
  }
  // (Nowhere in its den far enough from you: it keeps its old bed and lies down where it is
  // when it must.)
  if (best) mind.bed = { x: best.x, y: best.y, r: home };
  else if (mind.bed && tooNear(mind.bed)) return null;
  return mind.bed || null;
}

// ---------- Falling asleep ----------

// Called from ecologyIdle for a creature at its ease. Tired, it goes to its bed and lies
// down; returns true if that was its turn.
function sleepIdle(creature, species, eco, { catchUp = false } = {}) {
  if (!sleepKeeps(creature, species)) return false;
  const sleepy = sleepiness(creature, species);
  if (sleepy < SLEEP_ON - 0.12 || !sleepMay(creature, species, eco, sleepy)) return false;
  const bed = sleepBed(creature, species);
  if (bed) {
    const distance = distanceInSquares(creature, bed);
    if (distance === 1 && canStepBetween(creature, bed) && !tileHasCreature(bed.x, bed.y, creature) &&
      !(bed.x === state.run.player.x && bed.y === state.run.player.y)) {
      moveCreature(creature, bed);
      return true;
    }
    // (If something is in the way or its bed is too far, it lies down where it is.)
    if (distance > 1 && distance <= gridReach(14) && ecoStep(creature, bed, { catchUp })) return true;
  }
  // In its kind's night, once it is lying down it drops off sooner (so one woken in the
  // night goes back to sleep).
  const night = 1 - (typeof lawWake === "function" ? lawWake(species) : 1) >= 0.4;
  if (sleepy >= SLEEP_ON || night) sleepBegin(creature, species);
  // Not quite asleep yet: it settles where it is and dozes.
  return true;
}

function sleepRecord(creature, species, { meal = false } = {}) {
  const soma = somaFor(creature);
  const place = somaPlace(creature, species);
  soma.comfort = sleepRound(place.comfort);
  soma.touch = sleepRound(place.kin);
  soma.shelter = sleepRound(place.shelter);
  // How deeply it sleeps: deep where it's comfortable, sheltered, and among its own; light
  // in the open, or when it's strained or wound tight.
  const depth = sleepClamp(0.25 + 0.4 * place.comfort + 0.25 * place.shelter + 0.2 * place.kin - 0.4 * soma.strain - 0.25 * soma.tension);
  return { at: sleepTicks(), from: sleepRound(soma.pressure), depth: sleepRound(meal ? Math.max(depth, 0.9) : depth), r: roomIndexAt(creature.x, creature.y) };
}

function sleepBegin(creature, species, { quiet = false } = {}) {
  const mind = mindFor(creature);
  creature.asleep = SLEEP_HELD;
  creature.sleepHp = creature.hp;
  creature.eco.sleeping = true;
  creature.eco.target = null;
  creature.eco.route = null;
  mind.sleep = sleepRecord(creature, species);
  mind.intent = "ignore";
  mind.focus = null;
  mind.seen = false;
  if (quiet) return;
  // (One line an hour at most: a flock bedding down is one thing to see.)
  const eco = ecoState();
  if (eco && sleepTicks() - (eco.sleepSaid ?? -99) >= 6 && ecoSeen(creature)) {
    eco.sleepSaid = sleepTicks();
    addLog(`${creature.name} beds down to sleep.`);
  }
}

// ---------- Asleep ----------

// Each tick (and each hour off screen), for every creature with a mind: keeps a sleeper
// asleep until it has slept enough, or its hunger, a blow, or you wake it; and off screen
// puts a tired creature to sleep where it is.
function sleepTick(creature, species, ticks = 1) {
  const mind = creature.mind;
  const eco = creature.eco;
  if (!mind || !eco) return;
  const asleep = Boolean(creature.asleep && eco.sleeping);
  // Something else ended its sleep (a blow, a meal's sleep run out, a fright).
  if (mind.sleep && !asleep) {
    sleepWake(creature, species, creature.hp < (creature.sleepHp ?? creature.hp) ? "hurt" : "rested");
    return;
  }
  if (!sleepKeeps(creature, species)) return;
  if (asleep) {
    // (A sleep that began some other way: a big meal.)
    if (!mind.sleep) mind.sleep = sleepRecord(creature, species, { meal: creature.asleep < 900 });
    const held = creature.asleep >= 900;
    if (held) creature.asleep = SLEEP_HELD;
    if (creature.hp < (creature.sleepHp ?? creature.hp)) {
      sleepWake(creature, species, "hurt");
      return;
    }
    if (ticks <= 1 && (creature.soma?.touch || 0) >= 0.5 && !mind.sleep.huddled) {
      mind.sleep.huddled = 1;
      memoryNote(creature, "kin", { valence: 0.5, weight: 1 });
    }
    if (held && (sleepiness(creature, species) < SLEEP_OFF || eco.sat < SLEEP_HUNGRY)) sleepWake(creature, species, eco.sat < SLEEP_HUNGRY ? "hungry" : "rested");
    return;
  }
  // Off screen, an hour at a time: it sleeps where it is (at home) when its time comes.
  if (ticks > 1) {
    const sleepy = sleepiness(creature, species);
    if (sleepy >= SLEEP_ON && sleepMay(creature, species, eco, sleepy)) sleepBegin(creature, species, { quiet: true });
  }
}

// It wakes: rested, hungry, hurt, or startled. Whatever sleep it got, it dreams on. Returns
// how good the sleep was (0 to 1).
function sleepWake(creature, species = ecoSpecies(creature), how = "rested") {
  const mind = mindFor(creature);
  const record = mind.sleep || null;
  delete mind.sleep;
  creature.asleep = 0;
  if (creature.eco) creature.eco.sleeping = false;
  const soma = typeof somaApplies === "function" && somaApplies(creature, species) ? somaFor(creature) : null;
  const from = record?.from ?? soma?.pressure ?? 0;
  const slept = soma ? Math.max(0, from - soma.pressure) : 0;
  const quality = sleepClamp(slept / Math.max(0.2, from - 0.1)) * (0.45 + 0.55 * (record?.depth ?? 0.5));
  sleepDream(creature, species, quality);
  const room = Number.isInteger(record?.r) ? record.r : roomIndexAt(creature.x, creature.y);
  if (how === "hurt" || how === "startled") {
    somaStartle(creature, how === "hurt" ? 0.6 : 0.45);
    memoryNote(creature, "harm", { valence: how === "hurt" ? -0.9 : -0.4, about: how === "startled" || creature.provoked ? "you" : null, room, weight: 1 });
    // It won't lie down there again.
    if (how === "hurt" && mind.bed) {
      mind.badBed = { x: mind.bed.x, y: mind.bed.y };
      mind.bed = null;
    }
  } else if (how === "rested" && quality >= 0.45) {
    memoryNote(creature, "bed", { valence: sleepRound(0.35 * quality), room, weight: 0.6 });
  }
  return quality;
}

// You come near a sleeper (called before the creatures' turn, systems/behaviors.js). Whether
// it wakes depends on how deeply it sleeps, how close you are, how much noise you make, and
// whether it knows your step. Moving is what wakes things: stand still and a sleeper beside
// you sleeps on. Those pressed against a creature that wakes with a start may wake with it.
let sleepStirFrom = null;

function sleepStir() {
  if (state.run?.location !== "dungeon") return;
  const player = state.run.player;
  const moved = !sleepStirFrom || sleepStirFrom.x !== player.x || sleepStirFrom.y !== player.y || sleepStirFrom.floor !== state.run.dungeonFloor;
  sleepStirFrom = { x: player.x, y: player.y, floor: state.run.dungeonFloor };
  const reach = gridReach(4);
  const noise = sleepNoise() * (moved ? 1 : 0.05);
  for (const creature of [...state.run.enemies]) {
    if (!sleepsNow(creature) || creature.deepSleep) continue;
    const distance = distanceInSquares(creature, player);
    if (distance > reach) continue;
    const depth = creature.mind.sleep.depth ?? 0.5;
    const close = 1 - distance / (reach + 1);
    let chance = (1 - depth) * close * 0.55 + (distance <= 1 ? 0.2 * (1 - depth) + 0.04 : 0);
    chance *= noise * (1 + memoryReady(creature, "you")) * (hasLineOfSight(creature, player) ? 1 : 0.4);
    if (Math.random() >= chance) continue;
    sleepStartled(creature);
    // (Only through touch: the sleepers pressed against it.)
    for (const other of state.run.enemies) {
      if (other === creature || other.templateId !== creature.templateId || !sleepsNow(other) || distanceInSquares(other, creature) > 1) continue;
      if (Math.random() < 0.6) sleepStartled(other, { quiet: true });
    }
  }
}

function sleepStartled(creature, { quiet = false } = {}) {
  sleepWake(creature, ecoSpecies(creature), "startled");
  creature.mind.seen = false;
  if (!quiet && typeof reportAt === "function") reportAt(creature, `${creature.name} wakes and lifts its head.`);
}

// How much noise you make for a sleeper: heavy armor and running carry; a light step, a rogue,
// or a hush doesn't.
function sleepNoise() {
  const stance = typeof currentStance === "function" ? currentStance() : "guard";
  let noise = 1;
  if (typeof armorIsNoisy === "function" && armorIsNoisy()) noise *= 1.6;
  if (stance === "run") noise *= 1.8;
  if (stance === "disengage") noise *= 0.5;
  if (state.run.character?.class === "rogue") noise *= 0.6;
  if (typeof activeBuff === "function" && activeBuff("hushed")) noise *= 0.5;
  return noise;
}

// ---------- Memory ----------

// Something happened that it may keep. `kind` is what (harm, loss, fed, met, food, hunted,
// rival, kin, bed), `valence` how good or bad (−1 to 1), `about` who did it ("you", or a kind
// of creature), `room` where (where it stands, unless said), `weight` how much it matters. It
// is laid down as strongly as its heart is going, weaker in a body that badly needs sleep.
function memoryNote(creature, kind, { valence = 0, about = null, room = null, weight = 1 } = {}) {
  if (!creature?.alive || !sleepKeeps(creature)) return;
  const mind = mindFor(creature);
  const soma = somaFor(creature);
  const r = Number.isInteger(room) ? room : roomIndexAt(creature.x, creature.y);
  const strength = sleepClamp(weight * (0.3 + 0.7 * soma.heart) * (soma.pressure >= 0.85 ? 0.6 : 1));
  const day = Array.isArray(mind.day) ? mind.day : (mind.day = []);
  const same = day.find((memory) => memory.k === kind && memory.r === r && (memory.a ?? null) === (about ?? null));
  if (same) {
    same.s = sleepRound(Math.min(1, Math.max(same.s, strength) + 0.1));
    same.v = sleepRound((same.v + valence) / 2);
    return;
  }
  day.push({ k: kind, r, v: sleepRound(valence), s: sleepRound(strength), ...(about ? { a: about } : {}) });
  // Too much in one day: the weakest goes.
  if (day.length > MEMORY_DAY) {
    let weakest = 0;
    for (let index = 1; index < day.length; index += 1) if (day[index].s < day[weakest].s) weakest = index;
    day.splice(weakest, 1);
  }
}

function memoryMap(mind, key) {
  if (!mind[key] || typeof mind[key] !== "object" || Array.isArray(mind[key])) mind[key] = {};
  return mind[key];
}

// Turn everything in a map down by `keep`, drop what falls below `floor`, and keep only the
// `most` strongest.
function memoryPrune(map, keep, floor, most) {
  const entries = Object.entries(map).map(([key, value]) => [key, sleepRound(value * keep)])
    .filter(([, value]) => Math.abs(value) >= floor).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, most);
  for (const key of Object.keys(map)) delete map[key];
  for (const [key, value] of entries) map[key] = value;
}

// How it feels about a chamber (−1 to 1), from what it has slept on.
function memoryPlace(creature, roomIndex) {
  return creature?.mind?.places?.[roomIndex] || 0;
}

// How ready it is for something it has rehearsed in its sleep ("you", or a kind of hunter).
function memoryReady(creature, about) {
  return creature?.mind?.ready?.[about] || 0;
}

// Hungry, with nothing to eat in reach: the chamber it remembers feeding in, as somewhere to
// step to, or null. Where it stands and finds nothing, it learns that (it expected food here).
function memoryForage(creature) {
  const food = creature?.mind?.food;
  if (!food || typeof food !== "object") return null;
  const here = roomIndexAt(creature.x, creature.y);
  if (food[here] > 0) {
    food[here] = sleepRound(food[here] * 0.4);
    if (food[here] < 0.08) delete food[here];
  }
  let best = null;
  for (const [key, value] of Object.entries(food)) {
    const index = Number(key);
    const room = state.run.rooms[index];
    if (index === here || !room || value < 0.15) continue;
    const spot = { x: room.anchorX ?? room.mapX + Math.floor(room.mapW / 2), y: room.anchorY ?? room.mapY + Math.floor(room.mapH / 2) };
    const score = value - distanceInSquares(spot, creature) / gridReach(40);
    if (!best || score > best.score) best = { ...spot, score };
  }
  return best ? { x: best.x, y: best.y } : null;
}

// The young start out knowing some of their parent's ground, and close to their family.
function memoryInherit(young, parent) {
  const mind = young?.mind;
  const elder = parent?.mind;
  if (!mind || !elder) return;
  for (const key of ["places", "food"]) {
    if (!elder[key] || typeof elder[key] !== "object") continue;
    mind[key] = Object.fromEntries(Object.entries(elder[key]).map(([room, value]) => [room, sleepRound(value * 0.5)]).filter(([, value]) => Math.abs(value) >= 0.05));
  }
  mind.bond = 0.5;
}

// ---------- Dreaming ----------

// What it goes over in its sleep, and what that leaves. `quality` (0 to 1) is how much sleep
// it got and how deep: a full night in a good bed is 1.
function sleepDream(creature, species, quality) {
  const mind = mindFor(creature);
  const day = Array.isArray(mind.day) ? mind.day : [];
  mind.day = [];
  const places = memoryMap(mind, "places");
  const food = memoryMap(mind, "food");
  const ready = memoryMap(mind, "ready");
  // It goes over the strongest of the day: a few on a poor night, more on a good one.
  const replayed = [...day].sort((a, b) => b.s - a.s).slice(0, Math.round(2 + 4 * quality));
  const rehearsed = new Set();
  let slept = false;
  for (const memory of replayed) {
    const weight = memory.s * quality;
    if (Number.isInteger(memory.r) && memory.r >= 0) {
      places[memory.r] = sleepRound(sleepSigned((places[memory.r] || 0) + 0.6 * memory.v * weight));
      if (memory.k === "food") food[memory.r] = sleepRound(sleepClamp((food[memory.r] || 0) + 0.5 * weight));
    }
    // Threat rehearsal: it runs from it again, and wakes readier. (Not against its own kind:
    // a rival that beat it teaches it where it isn't welcome, which is the place memory.)
    if (memory.v < 0 && memory.a && memory.a !== creature.templateId) {
      ready[memory.a] = sleepRound(sleepClamp((ready[memory.a] || 0) + 0.55 * weight));
      rehearsed.add(memory.a);
    }
    // What you are, held more surely.
    if (memory.a === "you") mind.known = sleepRound(sleepClamp((mind.known || 0) + 0.3 * weight * (1 - (mind.known || 0))));
    // Social rehearsal: those it slept against, it holds closer.
    if (memory.k === "kin") {
      mind.bond = sleepRound(sleepClamp((mind.bond || 0) + 0.2 * weight));
      slept = true;
    }
  }
  // Pruning: everything held turns down a little; what falls too low is gone.
  memoryPrune(places, 0.85, 0.06, MEMORY_PLACES);
  memoryPrune(food, 0.85, 0.08, MEMORY_FOOD);
  for (const about of Object.keys(ready)) if (!rehearsed.has(about)) ready[about] *= 0.8;
  memoryPrune(ready, 1, 0.05, MEMORY_READY);
  if (!slept && mind.bond) mind.bond = sleepRound(mind.bond * 0.96);
  // (Nothing kept, nothing stored: the save carries every creature on every floor.)
  for (const key of ["places", "food", "ready"]) if (!Object.keys(mind[key]).length) delete mind[key];
  // The reset: the day's stress let go, the charge taken off what frightened it, grief eased.
  mind.stress = sleepRound((mind.stress || 0) * (1 - 0.7 * quality));
  mind.dread = sleepRound((mind.dread || 0) * (1 - 0.55 * quality));
  const grief = typeof mindGrief === "function" ? mindGrief(mind) : 0;
  if (grief > 0) {
    mind.grief = sleepRound(grief * (1 - 0.4 * quality));
    mind.griefAt = sleepTicks();
  }
  if (!mind.dread) delete mind.dread;
  // A den where it can't sleep in peace (it was hunted there, hurt there, woken there), it
  // leaves.
  const home = creature.eco?.home;
  if (Number.isInteger(home) && (places[home] || 0) <= (species?.territorial ? -0.6 : -0.45) && typeof ecoNearbyHome === "function") {
    const moved = ecoNearbyHome(creature, home);
    if (Number.isInteger(moved)) {
      creature.eco.home = moved;
      mind.bed = null;
    }
  }
  return replayed.length;
}

// ---------- What you can see ----------

// Lines for the inspect panel while it sleeps (mindDescription), or [].
function sleepManner(creature) {
  if (!creature?.asleep || !creature.eco?.sleeping || !creature.mind) return [];
  const mind = creature.mind;
  const parts = [];
  const den = Number.isInteger(creature.eco.home) && roomIndexAt(creature.x, creature.y) === creature.eco.home &&
    ecoSpecies(creature)?.territorial;
  if (creature.asleep < 900) parts.push("It's asleep, heavy with its meal.");
  else if ((creature.soma?.touch || 0) >= 0.5) parts.push("It's asleep, pressed against the others of its kind.");
  else if (den) parts.push("It's asleep in its den.");
  else parts.push("It's asleep.");
  // What it is going over.
  const top = (Array.isArray(mind.day) ? [...mind.day] : []).sort((a, b) => b.s - a.s)[0];
  if (top && top.s >= 0.3) {
    if (["harm", "hunted", "loss", "rival"].includes(top.k)) parts.push("Its legs twitch as it dreams.");
    else if (["food", "fed"].includes(top.k)) parts.push("Its jaws work as it dreams.");
    else parts.push("It makes small sounds in its sleep.");
  }
  return parts;
}
