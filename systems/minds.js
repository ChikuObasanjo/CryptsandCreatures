"use strict";

// Creature minds: what an animal in the tomb wants, what it notices, and what it does
// about you.
//
// Nothing here runs a language model; a phone can't, and doesn't need to. The ideas are
// borrowed from how attention models and theories of consciousness describe a mind:
//
//   drives       Wants that rise and fall with the animal's own state and the world: hunger
//                from its belly, fear from its wounds and how dangerous you look, anger
//                from being hurt or invaded, curiosity at something new, care for a nest,
//                the wish to rest after a big meal.
//   attention    Everything it can sense is a "token" (you, food, prey, a hunter, kin in a
//                fight, the quiet). Each token has a key saying which drives it speaks to;
//                the animal's drives are the query. Attention is query · key, scaled by how
//                strongly it's sensed (distance, line of sight, noise), and a softmax over
//                the tokens. This is the same mechanism a transformer uses to decide which
//                words matter to which.
//   workspace    Only one thing at a time wins the animal's attention and becomes its focus
//                (global workspace theory: what's "in mind" is what's broadcast to the rest
//                of it). Its intention follows from the focus and from which drive the focus
//                engages most. A focus is held until something clearly stronger breaks in,
//                so animals don't flicker between plans.
//   prediction   It expects you to be where it last saw you. Being surprised (you appear
//                close without warning) startles it: fear and alertness jump.
//   memory       It remembers you: hurt it (fear or a grudge, by temperament), killed its
//                kind in front of it, left it food (it warms to you), or passed by many
//                times harmlessly (it gets used to you). Memory is kept with the creature
//                and survives saves and your time away.
//
// The mind only decides: fight, flee, watch, or leave you be. The existing behaviors carry
// it out (attacks, habits, foraging in systems/ecology.js). It's for the animals the
// tomb's food feeds; spirits, guardians, raiders, and your friends keep their own rules.

const MIND_DRIVES = ["hunger", "fear", "anger", "curiosity", "care", "rest"];
const MIND_TEMPERATURE = 0.35;   // softmax temperature: lower = more single-minded
const MIND_HOLD = 0.75;          // a held focus keeps going while it scores at least this share of the best
const MIND_ENGAGE = 0.12;        // below this attention on you, the animal leaves you be

function mindApplies(enemy) {
  if (!enemy?.alive || enemy.friendly || enemy.guardian || enemy.lurking) return false;
  const species = typeof ecoSpecies === "function" ? ecoSpecies(enemy) : null;
  return Boolean(species && typeof ecoIsFed === "function" && ecoIsFed(species) && enemy.eco);
}

function mindFor(enemy) {
  enemy.mind ||= { harmed: 0, witnessed: 0, fed: 0, met: 0, calm: 0, focus: null, intent: null, step: -1, seen: false, lastHp: enemy.hp, said: null };
  return enemy.mind;
}

const mindClamp = (value) => Math.max(0, Math.min(1, value));

// How dangerous you look to this animal: your party's strength against its own.
function mindDanger(enemy) {
  const level = state.run.level || 1;
  const party = typeof partyMembers === "function" ? partyMembers().filter((member) => member.hero ? state.run.hp > 0 : member.hp > 0).length : 1;
  const yours = (state.run.hp + level * 4) * (1 + 0.5 * (party - 1));
  const its = Math.max(1, enemy.hp) * (1 + (enemy.attackBonus || 0) / 5);
  return yours / its;
}

// Could it make a meal of you? Hunters that take large prey, and anything starving.
function mindSeesPrey(species, hunger) {
  if (species.role !== "predator") return false;
  if (hunger === "starving") return true;
  return species.eats.includes("large") && (species.size || 1) >= 3;
}

// ---------- Drives ----------

function mindDrives(enemy, species, mind, distance) {
  const hungerState = ecoHungerState(enemy);
  const hunger = { starving: 1, hungry: 0.65, fed: 0.15, gorged: 0 }[hungerState] ?? 0.2;
  const hpRatio = enemy.hp / Math.max(1, enemy.maxHp);
  const danger = mindDanger(enemy);
  const timid = (species.flees || 0) * 1.4 + (species.role === "grazer" ? 0.3 : 0) + (species.temperament === "wary" ? 0.2 : 0);
  const fondness = Math.min(1, mind.fed * 0.35);
  const fear = mindClamp(timid * 0.6 + (1 - hpRatio) * 0.8 + Math.min(1, danger / 4) * 0.25 +
    (mind.harmed + mind.witnessed) * (species.role === "predator" ? 0.08 : 0.2) + (mind.startle ? 0.15 : 0) -
    Math.min(0.6, mind.calm * 0.1) - fondness * 0.7 - (hungerState === "starving" ? 0.3 : 0));
  // A territorial animal minds you in its own chamber, and won't stand you coming close there.
  const inHome = roomIndexAt(state.run.player.x, state.run.player.y) === enemy.eco?.home;
  const intrusion = species.territorial && inHome ? (distance <= 2 ? 0.6 : 0.3) : 0;
  const anger = mindClamp((enemy.provoked ? 0.7 : 0) + intrusion +
    (typeof ecoDefendsNest === "function" && ecoDefendsNest(enemy) ? 0.9 : 0) +
    (typeof ecoIsCrowded === "function" && ecoIsCrowded(enemy) && species.role !== "predator" ? 0.55 : 0) +
    (species.role === "predator" ? (mind.harmed + mind.witnessed) * 0.15 : 0) - fondness * 0.6);
  const curiosity = mindClamp((0.55 / (1 + mind.met)) * (species.temperament === "wary" ? 0.6 : 1) + fondness * 0.4);
  const care = typeof ecoDefendsNest === "function" && ecoDefendsNest(enemy) ? 1 : 0;
  const rest = hungerState === "gorged" ? 0.7 : enemy.asleep ? 0.9 : 0.1;
  return { hunger, fear, anger, curiosity, care, rest, hungerState, danger, distance };
}

// ---------- What it can sense ----------

function mindSenses(enemy, species, drives) {
  const tokens = [];
  const range = (typeof creatureNoticeRange === "function" ? creatureNoticeRange(enemy) : 5) + 1;
  const distance = drives.distance;
  if (distance <= range + 2) {
    const sight = hasLineOfSight(enemy, state.run.player) ? 1 : 0.35;
    const near = mindClamp(1.15 - distance / (range + 2));
    const loud = (typeof armorIsNoisy === "function" && armorIsNoisy() ? 0.15 : 0) +
      (typeof currentStance === "function" && currentStance() === "run" ? 0.15 : 0);
    const preyable = mindSeesPrey(species, drives.hungerState);
    tokens.push({
      id: "player", kind: "player", intensity: mindClamp(near * sight + loud),
      key: { hunger: preyable ? 1 : 0, fear: Math.min(1, drives.danger / 2), anger: 1, curiosity: 1, care: drives.care, rest: 0 }
    });
  }
  // Food it could be eating instead.
  const eco = typeof ecoState === "function" ? ecoState() : null;
  if (eco && drives.hunger > 0.1) {
    let best = null;
    for (const feature of eco.features) {
      const reach = distanceInSquares(feature, enemy);
      if (reach > 6 || !ecoFeatureFeeds(feature, species)) continue;
      if (!best || reach < best.reach) best = { feature, reach };
    }
    if (best) tokens.push({ id: "food", kind: "food", intensity: mindClamp(1.1 - best.reach / 7), key: { hunger: 1 } });
  }
  // Other creatures: prey for a hunter, a hunter for prey, kin already fighting you.
  for (const other of state.run.enemies) {
    if (other === enemy || !other.alive) continue;
    const reach = distanceInSquares(other, enemy);
    if (reach > 6) continue;
    const otherSpecies = ecoSpecies(other);
    if (!otherSpecies) continue;
    if (species.role === "predator" && typeof ecoCanHunt === "function" && ecoCanHunt(enemy, other, species)) {
      tokens.push({ id: `prey:${other.id}`, kind: "prey", intensity: mindClamp(1 - reach / 7), key: { hunger: 1 } });
    } else if (otherSpecies.role === "predator" && otherSpecies.is && typeof ecoCanHunt === "function" && ecoCanHunt(other, enemy, otherSpecies)) {
      tokens.push({ id: `hunter:${other.id}`, kind: "hunter", intensity: mindClamp(1 - reach / 7), key: { fear: 1 } });
    } else if (other.templateId === enemy.templateId && other.alerted && !other.fleeTurns) {
      // Kin in a fight with you: a pack joins in, a herd scatters.
      tokens.push({ id: `kin:${other.id}`, kind: "kin", intensity: mindClamp(1 - reach / 7),
        key: species.role === "predator" || species.territorial ? { anger: 0.8 } : { fear: 0.8 } });
    }
  }
  tokens.push({ id: "quiet", kind: "quiet", intensity: 0.35, key: { rest: 1, hunger: 0.1 } });
  return tokens;
}

// ---------- Attention ----------

function mindAttend(drives, tokens) {
  const scores = tokens.map((token) => MIND_DRIVES.reduce((sum, drive) => sum + drives[drive] * (token.key[drive] || 0), 0) * token.intensity);
  const top = Math.max(...scores);
  const weights = scores.map((score) => Math.exp((score - top) / MIND_TEMPERATURE));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return tokens.map((token, index) => ({ ...token, score: scores[index], attention: weights[index] / total }));
}

// Which drive a token engages most, for this animal right now.
function mindDominantDrive(drives, token) {
  let best = "rest";
  let value = -1;
  for (const drive of MIND_DRIVES) {
    const engaged = drives[drive] * (token.key[drive] || 0);
    if (engaged > value) { value = engaged; best = drive; }
  }
  return best;
}

// ---------- Thinking ----------

// Called for each creature at the start of its turn (enemiesTakeTurn). Updates its mind and
// sets what it means to do. Returns true if it used the turn (watching you from a distance).
function mindThink(enemy, distance) {
  if (!mindApplies(enemy)) return false;
  const species = ecoSpecies(enemy);
  const mind = mindFor(enemy);
  mind.step = state.run.steps || 0;
  // What happened since its last thought: were you the one who hurt it?
  if (enemy.hp < (mind.lastHp ?? enemy.hp) && enemy.provoked) mind.harmed = Math.min(6, mind.harmed + 1);
  mind.lastHp = enemy.hp;
  const range = (typeof creatureNoticeRange === "function" ? creatureNoticeRange(enemy) : 5) + 1;
  const senses = distance <= range && hasLineOfSight(enemy, state.run.player);
  // Prediction: you appearing close, out of nowhere, startles it.
  mind.startle = senses && !mind.seen && distance <= 3;
  if (senses && !mind.seen) {
    mind.met = Math.min(20, mind.met + 1);
    mind.encounterHp = enemy.hp;
  }
  if (!senses && mind.seen) {
    // You left without hurting it: one more harmless meeting.
    if (enemy.hp >= (mind.encounterHp ?? enemy.hp) && !enemy.provoked) mind.calm = Math.min(12, mind.calm + 1);
  }
  mind.seen = senses;
  // Far off and not in a fight, you aren't on its mind at all: skip the thinking.
  if (distance > range + 3 && !enemy.alerted && !enemy.fleeTurns) {
    mind.focus = null;
    mind.attention = 0;
    mind.intent = "ignore";
    return false;
  }

  const drives = mindDrives(enemy, species, mind, distance);
  const tokens = mindAttend(drives, mindSenses(enemy, species, drives));
  // The global workspace: one focus at a time, held unless something clearly beats it.
  const best = tokens.reduce((a, b) => (b.score > a.score ? b : a));
  const held = mind.focus && tokens.find((token) => token.id === mind.focus);
  const focus = held && held.score >= best.score * MIND_HOLD ? held : best;
  mind.focus = focus.id;
  const you = tokens.find((token) => token.kind === "player");
  mind.attention = you ? Math.round(you.attention * 100) / 100 : 0;

  let intent = "ignore";
  if (focus.kind === "player" && you.attention >= MIND_ENGAGE) {
    const drive = mindDominantDrive(drives, focus);
    if (drive === "fear" && drives.fear >= 0.45) intent = "flee";
    else if (drive === "anger" && drives.anger >= 0.45) intent = drives.fear > 0.75 ? "flee" : "fight";
    else if (drive === "anger") intent = "watch";
    else if (drive === "hunger" && drives.hunger >= 0.6) intent = "fight";
    else if (drive === "care") intent = distance <= 3 ? "fight" : "watch";
    else if (drive === "curiosity") intent = "watch";
  } else if (focus.kind === "kin" && distance <= range) {
    intent = species.role === "predator" || species.territorial ? "fight" : "flee";
  }
  // Already in a fight it chose: it doesn't drop it just because its attention wavers,
  // unless fear wins.
  if (enemy.alerted && intent === "ignore" && (enemy.provoked || mind.intent === "fight") && distance <= range) intent = drives.fear >= 0.6 ? "flee" : "fight";
  // Cornered, anything fights.
  if (intent === "flee" && distance <= 1 && typeof creatureStepAway === "function" && !creatureStepAway(enemy)) intent = "fight";
  mindSay(enemy, mind, intent, drives);
  mind.intent = intent;

  if (intent === "fight") {
    enemy.alerted = true;
    return false;
  }
  if (intent === "flee") {
    enemy.alerted = true;
    enemy.fleeTurns = Math.max(enemy.fleeTurns || 0, 2);
    if (enemy.eco) enemy.eco.fledOnce = true;
    return false;
  }
  if (intent === "watch") {
    // Keeps you at a distance it likes, and stays where it can see you.
    enemy.alerted = false;
    const step = distance < 2 ? creatureStepAway(enemy) : distance > 4 ? creatureStepToward(enemy, state.run.player, { adjacent: true }) : null;
    if (step) moveCreature(enemy, step);
    return true;
  }
  // Leaving you be: back to its own business (the ecology moves it), unless it was attacked.
  if (!enemy.provoked && !enemy.fleeTurns) enemy.alerted = false;
  return false;
}

// Was the decision this turn the mind's? (creatureNotices defers to it.)
function mindDecided(enemy) {
  return Boolean(enemy?.mind && enemy.mind.step === (state.run.steps || 0) && mindApplies(enemy));
}

// A short line in the log when an animal's mind about you changes and you can see it.
function mindSay(enemy, mind, intent, drives) {
  if (intent === mind.said || !hasLineOfSight(state.run.player, enemy) || distanceInSquares(enemy, state.run.player) > 7) {
    mind.said = mind.said === intent ? intent : mind.said;
    return;
  }
  const name = enemy.name;
  const lines = {
    watch: mind.fed > 0 ? `${name} watches you, ears forward. It remembers the food.` : `${name} stops and watches you.`,
    flee: mind.harmed + mind.witnessed > 0 && mind.intent !== "flee" ? `${name} sees you and bolts: it remembers you.` : drives.fear > 0.6 ? `${name} shies away from you.` : null,
    fight: mind.intent === "watch" ? `${name} has made up its mind about you.` : drives.hunger >= 1 && mindSeesPrey(ecoSpecies(enemy), drives.hungerState) ? `${name} is starving, and you look like food.` : null,
    ignore: mind.intent === "watch" && mind.calm > 2 ? `${name} loses interest in you.` : null
  };
  const line = lines[intent];
  if (line) addLog(line);
  mind.said = intent;
}

// ---------- Memory ----------

// When you kill a creature, others of its kind that saw it remember.
function mindWitnessDeath(victim) {
  if (!victim) return;
  for (const other of state.run.enemies) {
    if (!other.alive || other === victim || other.templateId !== victim.templateId || !mindApplies(other)) continue;
    if (distanceInSquares(other, victim) > 7 || !hasLineOfSight(other, victim)) continue;
    const mind = mindFor(other);
    mind.witnessed = Math.min(6, mind.witnessed + 1);
  }
}

// It ate food you left for it.
function mindFedBy(creature) {
  if (!creature || !mindApplies(creature)) return;
  const mind = mindFor(creature);
  mind.fed = Math.min(5, mind.fed + 1);
  mind.harmed = Math.max(0, mind.harmed - 1);
}

// What you can read in its manner (for the inspect panel and the bestiary).
function mindDescription(enemy) {
  const mind = enemy?.mind;
  if (!mind || !mindApplies(enemy)) return "";
  const parts = [];
  if (mind.intent === "watch") parts.push("It's watching you, curious.");
  else if (mind.intent === "flee") parts.push("It's afraid of you.");
  else if (mind.intent === "fight" && !enemy.provoked) parts.push("It means to fight you.");
  if (mind.fed >= 2) parts.push("It has come to trust you; you've fed it.");
  else if (mind.fed === 1) parts.push("It remembers the food you left.");
  if (mind.harmed + mind.witnessed >= 2) parts.push(ecoSpecies(enemy)?.role === "predator" ? "It holds a grudge against you." : "It remembers what you did to its kind.");
  else if (mind.calm >= 3 && !mind.harmed) parts.push("It's used to you by now.");
  return parts.join(" ");
}
