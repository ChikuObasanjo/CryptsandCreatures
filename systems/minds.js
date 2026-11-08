"use strict";

// Creature minds: what each creature in the tomb wants, what it notices, and what it does
// about you. Every creature has one: animals, the restless dead, the wardens, the raiders,
// and the great guardians.
//
// Nothing here runs a language model; a phone can't, and doesn't need to. The ideas are
// borrowed from how attention models and theories of consciousness describe a mind:
//
//   needs        Every creature has a belly of some kind (systems/energy.js): animals eat
//                plants, prey, or carrion; the dead and the wardens feed on tonalli (life
//                heat: offerings, fresh deaths, and the living); raiders eat provisions.
//                How full it is, how hurt it is, and where it belongs are its needs.
//   drives       Wants that rise and fall with those needs and the world: hunger, fear,
//                anger, curiosity, care for a nest, rest, duty (to a post or a charge), and
//                greed (for what you carry). A creature's NATURE says how strongly each can
//                rise in it: the dead hardly fear, wardens are all duty, a duende is all
//                greed and nerves.
//   attention    Everything it can sense is a "token" (you, food, prey, a hunter, kin in a
//                fight, its post, the quiet). Each token has a key saying which drives it
//                speaks to; the creature's drives are the query. Attention is query · key,
//                scaled by how strongly it's sensed, and a softmax over the tokens: the same
//                mechanism a transformer uses to decide which words matter to which.
//   workspace    Only one thing at a time wins its attention and becomes its focus (global
//                workspace theory). Its intention follows from the focus and from which
//                drive the focus engages most. A focus is held until something clearly
//                stronger breaks in, so creatures don't flicker between plans.
//   prediction   It expects you where it last sensed you. You appearing close without
//                warning startles it.
//   memory       It remembers you: hurt it (fear or a grudge, by nature), killed its kind
//                in front of it, fed it (food left out, an offering), or passed by
//                harmlessly many times (it gets used to you). Kept with the creature.
//
// So there are no special rules for each situation: a fed spirit lets you pass because its
// hunger is low and you mean nothing else to it; a starving one comes for your tonalli; a
// warden ignores you until you near what it guards; a duende shadows a full pack.
//
// The mind only decides: fight, flee, watch, go back to its post, or leave you be. The
// creature's habits carry it out (systems/behaviors.js: how it attacks, guards, steals).

const MIND_DRIVES = ["hunger", "fear", "anger", "curiosity", "care", "rest", "duty", "greed"];
const MIND_TEMPERATURE = 0.35;   // softmax temperature: lower = more single-minded
const MIND_HOLD = 0.75;          // a held focus keeps going while it scores at least this share of the best
const MIND_ENGAGE = 0.12;        // below this attention on you, the creature leaves you be
const MIND_CHARGE_RADIUS = 4;    // how close to a warden's post counts as "at what it guards"

function mindApplies(enemy) {
  if (!enemy?.alive || enemy.friendly || enemy.lurking) return false;
  return Boolean(typeof ecoSpecies === "function" && ecoSpecies(enemy) && enemy.eco);
}

// What kind of mind it is. Animals are as they were; the rest differ in which drives can
// rise in them, and how far.
//   fear      how much fear can move it (the dead barely feel it; a great guardian never flees)
//   duty      how strongly it keeps a post or charge
//   greed     how much what you carry draws it
//   curious   how much the new draws it
//   eatsYou   whether you are food to its hunger (and in which hunger states)
//   guards    how angry you make it by coming close to its charge (wardens only warn you;
//             a keeper attacks)
const MIND_NATURES = {
  animal: { fear: 1, duty: 0, guards: 0, greed: 0, curious: 1 },
  spirit: { fear: 0.15, duty: 0.45, guards: 0.35, greed: 0, curious: 0.2, eatsYou: ["hungry", "starving"] },
  warden: { fear: 0.5, duty: 0.9, guards: 0.3, greed: 0, curious: 0.6 },
  raider: { fear: 1, duty: 0, guards: 0, greed: 1, curious: 0.8 },
  keeper: { fear: 0, duty: 1, guards: 0.75, greed: 0, curious: 0.1 }
};

function mindNatureName(enemy, species) {
  if (enemy.guardian) return "keeper";
  if (species.role === "spirit") return "spirit";
  if (species.role === "guardian") return "warden";
  if (species.role === "raider") return "raider";
  return "animal";
}

function mindNature(enemy, species) {
  return MIND_NATURES[mindNatureName(enemy, species)];
}

function mindFor(enemy) {
  enemy.mind ||= { harmed: 0, witnessed: 0, fed: 0, met: 0, calm: 0, focus: null, intent: null, step: -1, seen: false, lastHp: enemy.hp, said: null };
  return enemy.mind;
}

const mindClamp = (value) => Math.max(0, Math.min(1, value));

// How dangerous you look to it: your party's strength against its own.
function mindDanger(enemy) {
  const level = state.run.level || 1;
  const party = typeof partyMembers === "function" ? partyMembers().filter((member) => member.hero ? state.run.hp > 0 : member.hp > 0).length : 1;
  const yours = (state.run.hp + level * 4) * (1 + 0.5 * (party - 1));
  const its = Math.max(1, enemy.hp) * (1 + (enemy.attackBonus || 0) / 5);
  return yours / its;
}

// Are you food to it? Hunters that take large prey, anything starving, and the dead when
// they hunger (you carry tonalli).
function mindSeesPrey(species, hunger, nature = MIND_NATURES.animal) {
  if (nature.eatsYou) return nature.eatsYou.includes(hunger);
  if (species.role !== "predator") return false;
  if (hunger === "starving") return true;
  return species.eats.includes("large") && (species.size || 1) >= 3;
}

// Where it belongs: a warden's or keeper's post, a sentinel's stand, a territorial
// creature's den.
function mindPost(enemy) {
  return enemy.post || (enemy.eco?.home >= 0 && state.run.rooms[enemy.eco.home] ? { x: state.run.rooms[enemy.eco.home].anchorX, y: state.run.rooms[enemy.eco.home].anchorY } : null);
}

// How much you carry that a raider wants: gold in your pouch, food in your pack.
function mindPackAppeal() {
  const gold = Math.min(1, (state.run.gold || 0) / 60);
  const meals = (state.run.inventory || []).reduce((sum, entry) => sum + (FOOD_ITEMS[entry.id] ? entry.quantity || 0 : 0), 0);
  return Math.max(gold, Math.min(1, meals / 6));
}

// Mercies that override what it wants: Xochipilli's friendship for beasts, the cross for
// the creatures it spares.
function mindSpared(enemy) {
  if (typeof isBeast === "function" && isBeast(enemy) && typeof activeBuff === "function" && activeBuff("xochipilli-friendship")) return true;
  return typeof crossSparesCreature === "function" && crossSparesCreature(enemy);
}

// ---------- Drives ----------

function mindDrives(enemy, species, mind, distance) {
  const nature = mindNature(enemy, species);
  const hungerState = ecoHungerState(enemy);
  const hunger = { starving: 1, hungry: 0.65, fed: 0.15, gorged: 0 }[hungerState] ?? 0.2;
  const hpRatio = enemy.hp / Math.max(1, enemy.maxHp);
  const danger = mindDanger(enemy);
  const timid = (species.flees || 0) * 1.4 + (species.role === "grazer" ? 0.3 : 0) + (species.temperament === "wary" ? 0.2 : 0);
  const fondness = Math.min(1, mind.fed * 0.35);
  const grudge = mind.harmed + mind.witnessed;
  // The fearless (the dead, the keepers) turn what they suffer into anger instead.
  const holdsGrudges = species.role === "predator" || nature.fear < 0.5;
  const fear = mindClamp(nature.fear * (timid * 0.6 + (1 - hpRatio) * 0.8 + Math.min(1, danger / 4) * 0.25 +
    grudge * (holdsGrudges ? 0.08 : 0.2) + (mind.startle ? 0.15 : 0)) -
    Math.min(0.6, mind.calm * 0.1) - fondness * 0.7 - (hungerState === "starving" ? 0.3 : 0));
  // Its post or den, and whether you're at it.
  const post = mindPost(enemy);
  const playerFromPost = post ? distanceInSquares(state.run.player, post) : Infinity;
  const inHome = roomIndexAt(state.run.player.x, state.run.player.y) === enemy.eco?.home;
  const atCharge = nature.duty > 0 && (playerFromPost <= MIND_CHARGE_RADIUS || (inHome && enemy.guardian));
  const intrusion = species.territorial && inHome ? (distance <= 2 ? 0.6 : 0.3) : 0;
  // A warden that's been robbed (the alux) is angry; one whose revenge is fright (the
  // chaneque) frightens instead of fighting (systems/ecology.js).
  const offended = enemy.eco?.offended && species.offended !== "susto" ? 0.8 : 0;
  // Big raiders (the sea giants) came to take by force.
  const bold = nature.greed && (species.size || 1) >= 3 && species.temperament === "hostile" ? 0.5 : 0;
  const anger = mindClamp((enemy.provoked ? 0.7 : 0) + intrusion + offended + bold +
    (atCharge ? nature.guards * (playerFromPost <= 2 ? 1 : 0.6) : 0) +
    (typeof ecoDefendsNest === "function" && ecoDefendsNest(enemy) ? 0.9 : 0) +
    (typeof ecoIsCrowded === "function" && ecoIsCrowded(enemy) && species.role === "grazer" ? 0.55 : 0) +
    (holdsGrudges ? grudge * 0.15 : 0) - fondness * 0.6);
  const curiosity = mindClamp(nature.curious * (0.55 / (1 + mind.met)) * (species.temperament === "wary" ? 0.6 : 1) + fondness * 0.4);
  const care = typeof ecoDefendsNest === "function" && ecoDefendsNest(enemy) ? 1 : 0;
  const rest = hungerState === "gorged" ? 0.7 : enemy.asleep ? 0.9 : 0.1;
  const duty = nature.duty;
  // Greed grows with need: a hungry raider wants your pack badly.
  const greed = mindClamp(nature.greed * (hunger >= 0.65 ? 1 : 0.6) - fondness * 0.5);
  return { hunger, fear, anger, curiosity, care, rest, duty, greed, hungerState, danger, distance, nature, post, atCharge, playerFromPost };
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
    const preyable = mindSeesPrey(species, drives.hungerState, drives.nature);
    tokens.push({
      id: "player", kind: "player", intensity: mindClamp(near * sight + loud),
      key: {
        hunger: preyable ? 1 : 0, fear: Math.min(1, drives.danger / 2), anger: 1, curiosity: 1, care: drives.care, rest: 0,
        duty: drives.atCharge ? 1 : 0, greed: drives.nature.greed ? mindPackAppeal() : 0
      }
    });
  }
  // Its post, when it has strayed from it: duty pulls it back.
  if (drives.duty && drives.post) {
    const away = distanceInSquares(enemy, drives.post);
    if (away > 1) tokens.push({ id: "post", kind: "post", intensity: mindClamp(away / 6), key: { duty: 1 } });
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
    if (best) tokens.push({ id: "food", kind: "food", intensity: mindClamp(1.1 - best.reach / 7), key: { hunger: 1, greed: 0.5 } });
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
      // Kin in a fight with you: a pack joins in, a herd scatters, the dead close ranks.
      const joins = species.role === "predator" || species.territorial || drives.nature.fear < 0.5;
      tokens.push({ id: `kin:${other.id}`, kind: "kin", intensity: mindClamp(1 - reach / 7), key: joins ? { anger: 0.8 } : { fear: 0.8 } });
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
  const senses = creatureSensesPlayer(enemy, range);
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
  // Far off and not in a fight, you aren't on its mind at all: skip the thinking (unless
  // it has strayed from a post it keeps; then that's on its mind).
  const post = mindNature(enemy, species).duty ? mindPost(enemy) : null;
  const strayed = post && distanceInSquares(enemy, post) > 1;
  if (distance > range + 3 && !enemy.alerted && !enemy.fleeTurns && !strayed) {
    mind.focus = null;
    mind.attention = 0;
    mind.intent = "ignore";
    return false;
  }

  // Mercies come first: a spared creature leaves you be unless you attack it.
  if (!enemy.provoked && mindSpared(enemy)) {
    mind.focus = null;
    mind.intent = "ignore";
    enemy.alerted = false;
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
    // At what it guards: it stands its ground and warns you, then fights if you press on.
    else if (drive === "duty") intent = drives.anger >= 0.45 ? "fight" : "watch";
    // After what you carry: it closes in (a thief's habit is to grab and run), unless it's
    // too frightened, when it shadows you instead.
    else if (drive === "greed") intent = drives.fear >= 0.6 ? "watch" : "fight";
    else if (drive === "curiosity") intent = "watch";
  } else if (focus.kind === "kin" && distance <= range) {
    intent = species.role === "predator" || species.territorial || drives.nature.fear < 0.5 ? "fight" : "flee";
  } else if (focus.kind === "post" && !enemy.provoked) {
    intent = "return";
  }
  // Already in a fight it chose: it doesn't drop it just because its attention wavers,
  // unless fear wins.
  if (enemy.alerted && (intent === "ignore" || intent === "return") && (enemy.provoked || mind.intent === "fight") && distance <= range) intent = drives.fear >= 0.6 ? "flee" : "fight";
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
    // Keeps you at a distance it likes, and stays where it can see you. Something keeping
    // a post holds its ground instead.
    enemy.alerted = false;
    if (drives.duty >= 0.5) return true;
    const step = distance < 2 ? creatureStepAway(enemy) : distance > 4 ? creatureStepToward(enemy, state.run.player, { adjacent: true }) : null;
    if (step) moveCreature(enemy, step);
    return true;
  }
  if (intent === "return") {
    // Back to its post.
    enemy.alerted = false;
    const step = drives.post && typeof creatureStepToward === "function" ? creatureStepToward(enemy, drives.post) : null;
    if (step) moveCreature(enemy, step);
    return Boolean(step);
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
  if (intent === mind.said || !playerSees(enemy)) {
    mind.said = mind.said === intent ? intent : mind.said;
    return;
  }
  const name = enemy.name;
  const kind = mindNatureName(enemy, ecoSpecies(enemy));
  const remembers = mind.harmed + mind.witnessed > 0;
  const lines = {
    animal: {
      watch: mind.fed > 0 ? `${name} watches you, ears forward. It remembers the food.` : `${name} stops and watches you.`,
      flee: remembers && mind.intent !== "flee" ? `${name} sees you and bolts: it remembers you.` : drives.fear > 0.6 ? `${name} shies away from you.` : null,
      fight: mind.intent === "watch" ? `${name} has made up its mind about you.` : drives.hunger >= 1 && mindSeesPrey(ecoSpecies(enemy), drives.hungerState) ? `${name} is starving, and you look like food.` : null,
      ignore: mind.intent === "watch" && mind.calm > 2 ? `${name} loses interest in you.` : null
    },
    spirit: {
      watch: drives.atCharge ? `${name} turns to face you and does not move.` : `${name} turns its head to follow your warmth.`,
      flee: `${name} draws back from you.`,
      fight: drives.hunger >= 0.65 && !enemy.provoked ? `${name} hungers, and comes for the life in you.` : remembers ? `${name} has not forgotten you.` : mind.intent === "watch" ? `${name} comes for you.` : null,
      ignore: mind.fed > 0 ? `${name} is fed, and lets you pass.` : null,
      return: `${name} drifts back to its place.`
    },
    warden: {
      watch: drives.atCharge ? `${name} plants itself in your way. You're close to what it keeps.` : `${name} watches you closely.`,
      flee: `${name} scurries out of your reach.`,
      fight: enemy.eco?.offended ? `${name} hasn't forgiven the theft.` : mind.intent === "watch" ? `${name} has had enough of you.` : null,
      ignore: mind.intent === "watch" ? `${name} goes back to its keeping.` : null,
      return: `${name} goes back to what it keeps.`
    },
    raider: {
      watch: `${name} keeps pace with you, eyeing your pack.`,
      flee: `${name} decides you aren't worth it and slips away.`,
      fight: drives.greed > 0.5 ? `${name} wants what you're carrying.` : null,
      ignore: null
    },
    keeper: {
      watch: `${name} watches you from its post.`,
      flee: null,
      fight: mind.intent === "watch" ? `${name} rises to meet you.` : null,
      ignore: null,
      return: `${name} returns to its post.`
    }
  }[kind];
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

// Something that happened fed it: a spirit's blow drank some of your tonalli, a thief got
// away with your gold. Its hunger (or greed) eases, so it presses you less.
function mindSated(creature, amount) {
  if (!creature?.eco || !mindApplies(creature) || typeof ecoFeed !== "function") return;
  ecoFeed(creature, amount, 1);
}

// Life drunk from you by a creature that feeds on tonalli, when it wounds you.
function mindDrinksFrom(enemy, damage) {
  if (ecoSpecies(enemy)?.eats.includes("tonalli") && ecoSpecies(enemy).role !== "predator") mindSated(enemy, damage * 6);
}

// It ate food you left for it, or took your offering.
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
  const kind = mindNatureName(enemy, ecoSpecies(enemy));
  const parts = [];
  if (mind.intent === "watch") parts.push(kind === "animal" ? "It's watching you, curious." : kind === "raider" ? "It's watching your pack." : "It's watching you, and holding its ground.");
  else if (mind.intent === "flee") parts.push("It's afraid of you.");
  else if (mind.intent === "return") parts.push("It's going back to its post.");
  else if (mind.intent === "fight" && !enemy.provoked) parts.push(kind === "spirit" ? "It hungers for the life in you." : kind === "raider" ? "It means to rob you." : "It means to fight you.");
  else if (mind.intent === "ignore" && kind === "spirit" && ["fed", "gorged"].includes(ecoHungerState(enemy))) parts.push("It's fed, and pays you no mind.");
  if (mind.fed >= 2) parts.push(kind === "spirit" || kind === "warden" ? "Your offerings have made it kind to you." : "It has come to trust you; you've fed it.");
  else if (mind.fed === 1) parts.push(kind === "spirit" || kind === "warden" ? "It remembers your offering." : "It remembers the food you left.");
  const holdsGrudges = ecoSpecies(enemy)?.role === "predator" || (MIND_NATURES[kind]?.fear ?? 1) < 0.5;
  if (mind.harmed + mind.witnessed >= 2) parts.push(holdsGrudges ? "It holds a grudge against you." : "It remembers what you did to its kind.");
  else if (mind.calm >= 3 && !mind.harmed) parts.push("It's used to you by now.");
  return parts.join(" ");
}
