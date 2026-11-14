"use strict";

// Creature minds: what each creature in the tomb wants, what it makes of you, and what it
// does about you. Every creature has one: animals, the restless dead, the wardens, the
// raiders, and the great guardians.
//
// No creature here has a fixed nature. What it does arises each turn out of its conditions,
// and nothing else (the long version, and where the ideas come from, is in MINDS.md):
//
//   its body    How hungry it is, how hurt, and how wound up. Stress is built by surprise
//               and harm and settles in quiet. The dead and the wardens live on tonalli,
//               the tomb's own life, so the tomb's hunger is part of theirs
//               (systems/tomb-body.js).
//   its self    What it takes to be itself. Every creature has a body, and most have grown
//               into something more: a den it has lived in (the longer it has lived there,
//               the more the den is "it"), a nest, a post it keeps. The dead hold their
//               bodies lightly, having lost one already, but they cling to their posts. A
//               threat to any part of that self is a threat to the creature.
//   you         What it has learned you are: one number, from harm (−1) to kindness (+1),
//               and how sure it is. Every meeting moves the number a little toward what
//               happened (the Rescorla–Wagner rule, from studies of how animals learn). Kin
//               learn from watching each other, and the young are born with some of what
//               their parents learned.
//
// For everything it can sense (you, food, prey, a hunter, kin, its post, the quiet), it
// feels a pull (this would fill what it lacks: food, prey, what you carry, the hand that
// fed it), a push (this threatens what it is), or nothing. A push becomes fear when its own
// body is at stake and it can't win, and anger when it can win, when what's threatened is a
// nest or a post, or when its body was never much of a self to it (the dead). Not knowing
// what you are makes it curious. When nothing pulls or pushes hard enough, the quiet wins
// and it goes about its own business. Most of the time, most creatures are at peace.
//
// The machinery: the creature's drives (how strongly each kind of pull and push is felt
// right now) are a query; everything it senses has a key saying which drives it answers;
// attention is a softmax over query · key, scaled by how strongly each thing is sensed (the
// mechanism a transformer uses). The winner becomes its one focus (global workspace
// theory), held until something clearly stronger breaks in, and its intention follows from
// the focus.
//
// The mind only decides: fight, flee, watch, follow, go back to its post, or leave you be.
// The creature's habits carry it out (systems/behaviors.js: how it attacks, guards, steals).
// And one more thing, for the dead only: a spirit fed and loosened by your offerings, no
// longer hungry and with nothing against you, lets go of its post and goes on.

// In this order, so that when two drives pull equally the more urgent one wins.
// (longing: something you carry is the sort of thing it loves: systems/cherish.js.)
const MIND_DRIVES = ["hunger", "fear", "anger", "keep", "greed", "longing", "fondness", "curiosity", "rest"];
const MIND_TEMPERATURE = 0.35;   // softmax temperature: lower = more single-minded
const MIND_HOLD = 0.75;          // a held focus keeps going while it scores at least this share of the best
const MIND_ENGAGE = 0.12;        // below this attention on you, the creature leaves you be
const MIND_CHARGE_RADIUS = 4;    // how close to a post counts as "at what it keeps"
const MIND_SETTLE_DAYS = 1.5;    // a den becomes a creature's own over a few days of living in it
// How far one event moves what it expects of you (learning rates): being hurt by you,
// being fed by you, seeing you kill its kind, a meeting where nothing happened.
const MIND_LEARN = { harm: 0.45, fed: 0.5, saw: 0.35, calm: 0.12 };
const MIND_HUNGER = { starving: 1, hungry: 0.65, fed: 0.15, gorged: 0 };

function mindApplies(enemy) {
  if (!enemy?.alive || enemy.friendly || enemy.lurking) return false;
  return Boolean(typeof ecoSpecies === "function" && ecoSpecies(enemy) && enemy.eco);
}

// What kind of mind it is: what it holds as itself, and how it meets what threatens that.
//   body     how much its own body is its self (fear for it). The dead hold theirs lightly;
//            a great guardian holds nothing but its post.
//   post     how tightly it keeps a post or charge
//   temper   how a threat to its post becomes a fight (low: it warns you; high: it attacks)
//   craves   how much what you carry draws it (the raiders)
//   curious  how much the unknown draws it
//   eatsYou  in which hunger states you are food to it
//   kin      how much the others of its kind are part of it (for animals this comes from
//            how they live instead: a flock, a few, or alone)
const MIND_NATURES = {
  animal: { body: 1, post: 0, temper: 0, craves: 0, curious: 1 },
  spirit: { body: 0.15, post: 0.45, temper: 0.78, craves: 0, curious: 0.2, eatsYou: ["hungry", "starving"], kin: 0.5 },
  warden: { body: 0.5, post: 0.9, temper: 0.33, craves: 0, curious: 0.6, kin: 0.3 },
  raider: { body: 1, post: 0, temper: 0, craves: 1, curious: 0.8, kin: 0.6 },
  keeper: { body: 0, post: 1, temper: 0.75, craves: 0, curious: 0.1, kin: 0 }
};
const MIND_KIN_REACH = 6;        // how near its own kind have to be to stand with it

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

const mindClamp = (value) => Math.max(0, Math.min(1, value));
const mindClampSigned = (value) => Math.max(-1, Math.min(1, value));

function mindFor(enemy) {
  const mind = enemy.mind ||= { harmed: 0, witnessed: 0, fed: 0, met: 0, calm: 0, focus: null, intent: null, step: -1, seen: false, lastHp: enemy.hp, said: null };
  if (!Number.isFinite(mind.value)) {
    // Minds from before they learned (older saves) only kept counts: read what they had learned from those.
    mind.value = mindClampSigned(0.35 * (mind.fed || 0) - 0.3 * (mind.harmed || 0) - 0.22 * (mind.witnessed || 0));
    mind.known = mindClamp(1 - Math.pow(0.85, (mind.met || 0) + (mind.fed || 0) + (mind.harmed || 0)));
  }
  if (!Number.isFinite(mind.known)) mind.known = 0;
  if (!Number.isFinite(mind.stress)) mind.stress = 0;
  // The day sign it was born under (systems/laws.js). What was alive before the count was
  // kept gets one by lot.
  if (!Number.isInteger(mind.sign)) mind.sign = typeof lawBirthSign === "function" ? lawBirthSign() : 0;
  return mind;
}

function mindTemper(mind) {
  return typeof lawTemper === "function" ? lawTemper(mind.sign) : { curious: 1, fear: 1, holds: 1, anger: 1, settles: 1 };
}

// One event moves what it expects of you a step toward what happened (−1 harm, 0 nothing,
// +1 kindness), and it knows you a little better.
function mindLearn(mind, outcome, rate) {
  mind.value = mindClampSigned(mind.value + rate * (outcome - mind.value));
  mind.known = mindClamp(mind.known + rate * 0.5 * (1 - mind.known));
}

// How strong a creature is in a fight, roughly.
function mindStrength(creature) {
  return Math.max(1, creature.hp) * (1 + (creature.attackBonus || 0) / 5);
}

// How dangerous you look to it: your party's strength against its own, and the strength of
// those of its own that stand near it, as far as it holds them (`allies`, from mindKin).
function mindDanger(enemy, allies = 0) {
  const level = state.run.level || 1;
  const party = typeof partyMembers === "function" ? partyMembers().filter((member) => member.hero ? state.run.hp > 0 : member.hp > 0).length : 1;
  const yours = (state.run.hp + level * 4) * (1 + 0.5 * (party - 1));
  return yours / (mindStrength(enemy) + allies);
}

// Are you food to it? Hunters that take large prey, anything starving, and the dead when
// they hunger (you carry tonalli).
function mindSeesPrey(species, hunger, nature = MIND_NATURES.animal) {
  if (nature.eatsYou) return nature.eatsYou.includes(hunger);
  if (species.role !== "predator") return false;
  if (hunger === "starving") return true;
  return species.eats.includes("large") && (species.size || 1) >= 3;
}

// Where it belongs: a warden's or keeper's post, a sentinel's stand, a creature's den.
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

// ---------- Its body ----------

function mindHungerState(hunger) {
  return hunger >= 0.9 ? "starving" : hunger >= 0.5 ? "hungry" : hunger >= 0.08 ? "fed" : "gorged";
}

function mindBody(enemy, species, mind) {
  const ownState = ecoHungerState(enemy);
  const own = MIND_HUNGER[ownState] ?? 0.2;
  const tombHungers = typeof tombHunger === "function" ? tombHunger() : 0;
  const tombRests = typeof tombRest === "function" ? tombRest() : 0;
  // What lives on tonalli lives on the tomb's own life: when the tomb hungers, so does it.
  // On the north's days (the quarter of the dead) the dead hunger more, and on the five days
  // the Cihuateteo come down, they do.
  const shares = species.eats.includes("tonalli") && species.role !== "predator";
  const day = typeof lawCount === "function" ? lawCount() : null;
  const count = !shares || !day ? 0 : (day.quarter === "north" && species.role === "spirit" ? 0.15 : 0) +
    (day.descent && enemy.templateId === "cihuateotl" ? 0.35 : 0);
  const hunger = shares ? mindClamp(own + tombHungers * 0.9 - tombRests * 0.3 + count) : own;
  // The three things that make a creature go, as the Nahua counted them (MINDS.md):
  //   tonalli  its heat and vigor: what a fright shakes loose and rest gives back
  //   teyolia  what its heart keeps (mindSelf)
  //   ihiyotl  what it gives off, that others smell and feel (mindAir)
  const wound = 1 - enemy.hp / Math.max(1, enemy.maxHp);
  return {
    hunger,
    hungerState: shares ? mindHungerState(hunger) : ownState,
    wound,
    stress: mind.stress,
    tonalli: mindClamp((1 - mind.stress) * (1 - 0.6 * wound) * (ecoIsSick(enemy) ? 0.6 : 1)),
    // How awake it is at this hour (systems/laws.js): grazers by day, hunters at dusk, the
    // dead by night.
    wake: typeof lawWake === "function" && !enemy.guardian ? lawWake(species) : 1,
    sick: typeof ecoIsSick === "function" && ecoIsSick(enemy),
    tombHunger: tombHungers,
    tombRest: tombRests
  };
}

// ---------- Its self ----------

// How much its den has become its own: nothing when it has just moved in (or been born),
// most of the way after a few days. A creature that was already here when you came has
// lived here a long time.
function mindSettled(enemy, mind) {
  const ticks = (typeof ecoState === "function" && ecoState()?.ticks) || 0;
  if (mind.home !== enemy.eco.home) {
    mind.since = mind.home === undefined ? (Number.isFinite(mind.since) ? mind.since : -1e6) : ticks;
    mind.home = enemy.eco.home;
  }
  const perDay = typeof ECO_TICKS_PER_DAY === "number" ? ECO_TICKS_PER_DAY : 144;
  return 1 - Math.exp(-Math.max(0, ticks - mind.since) / perDay / MIND_SETTLE_DAYS);
}

// How tightly it holds its post. The dead loosen their grip as offerings feed them.
function mindCling(mind, nature) {
  return nature === MIND_NATURES.spirit && Number.isFinite(mind.cling) ? mind.cling : nature.post;
}

// What it takes to be itself beyond its body, and how close you are to each part of it.
//   held    how much it has to keep (its strongest attachment)
//   threat  how much of that you're threatening right now; `kept` says which
//   anger   how much of that threat it meets with a fight
function mindSelf(enemy, species, mind, nature, distance, body) {
  const player = state.run.player;
  const playerRoom = roomIndexAt(player.x, player.y);
  const home = enemy.eco?.home;
  const temper = mindTemper(mind);
  const grief = mindGrief(mind);
  const self = { held: 0, threat: 0, anger: 0, kept: null, den: 0, atHome: false, post: null, postCling: 0, fromPost: Infinity,
    kin: 0, allies: 0, kinHurt: false, grief };
  const hold = (kind, cling, presence, temper, closeness = 1) => {
    if (cling <= 0) return;
    self.held = Math.max(self.held, cling);
    if (cling * presence > self.threat) {
      self.threat = cling * presence;
      self.kept = kind;
    }
    self.anger = Math.max(self.anger, cling * presence * temper * closeness);
  };
  // A post or a charge. The hungrier the tomb, the closer its keepers hold to it.
  if (nature.post) {
    const post = mindPost(enemy);
    self.post = post;
    if (post) {
      self.fromPost = distanceInSquares(player, post);
      self.postCling = Math.min(1, mindCling(mind, nature) * (1 + 0.4 * body.tombHunger));
      const near = self.fromPost <= gridReach(MIND_CHARGE_RADIUS) || (enemy.guardian && playerRoom === home);
      hold("post", self.postCling, near ? 1 : 0, nature.temper, self.fromPost <= gridReach(2) ? 1 : 0.6);
    }
  }
  // Its den: the room it lives in. It grows braver there the longer it has lived there,
  // and a creature that holds ground (the territorial ones) defends it.
  const settled = nature === MIND_NATURES.animal ? mindSettled(enemy, mind) : 1;
  if (nature === MIND_NATURES.animal && Number.isInteger(home) && home >= 0) {
    // (A creature that has just lost one of its own holds its ground less.)
    self.den = Math.min(1, (species.territorial ? 1 : 0.3) * settled * temper.holds * (1 - 0.5 * grief));
    self.atHome = roomIndexAt(enemy.x, enemy.y) === home;
    if (species.territorial) hold("den", self.den, playerRoom === home ? 1 : 0, 0.6, distance <= gridReach(2) ? 1 : 0.5);
  }
  // Its young.
  if (typeof ecoDefendsNest === "function" && ecoDefendsNest(enemy)) hold("nest", 1, 1, 0.9);
  // Its own kind: the flock or pack it lives with is part of it, more the longer they have
  // lived together. Those standing near lend it their strength, and harm to one of them is
  // harm to it.
  const kin = mindKin(enemy, species, nature, settled * temper.holds);
  self.kin = kin.hold;
  self.allies = kin.strength;
  self.kinHurt = kin.hurt;
  // (Whether a threat to its kin becomes a fight or a flight is settled in mindDrives, by
  // whether it thinks they can win.)
  if (kin.hurt) hold("kin", kin.hold, 1, 0);
  // Its kill: a hunter at a carcass holds it, less the fuller it is.
  if (nature === MIND_NATURES.animal && enemy.eco?.feeding > 0 && mindAtKill(enemy)) {
    hold("kill", body.hungerState === "gorged" ? 0.35 : 0.7, distance <= gridReach(3) ? 1 : 0, 0.65, distance <= 1 ? 1 : 0.6);
  }
  return self;
}

// How much its own kind are part of it, and what those near it add to its strength.
function mindKin(enemy, species, nature, settled) {
  const base = nature === MIND_NATURES.animal ? (species.packs ? 0.8 : species.territorial ? 0.15 : 0.4) : nature.kin || 0;
  const kin = { hold: Math.min(1, base * settled), strength: 0, count: 0, hurt: false };
  if (kin.hold <= 0) return kin;
  for (const other of state.run.enemies) {
    if (other === enemy || !other.alive || other.templateId !== enemy.templateId || other.friendly) continue;
    if (distanceInSquares(other, enemy) > gridReach(MIND_KIN_REACH) || !hasLineOfSight(other, enemy)) continue;
    kin.count += 1;
    if (!other.fleeTurns) kin.strength += kin.hold * mindStrength(other);
    // One of its own that you have hurt, or that is in a fight with you.
    if (other.provoked || (other.alerted && !other.fleeTurns && other.mind?.intent === "fight")) kin.hurt = true;
  }
  return kin;
}

function mindAtKill(enemy) {
  const eco = typeof ecoState === "function" ? ecoState() : null;
  return Boolean(eco?.features.some((feature) => feature.kind === "carcass" && feature.fresh && feature.meat > 0 && distanceInSquares(feature, enemy) <= 1));
}

// Grief: what losing one of its own left in it, fading by half each day.
function mindGrief(mind) {
  if (!(mind.grief > 0)) return 0;
  const ticks = (typeof ecoState === "function" && ecoState()?.ticks) || 0;
  const perDay = typeof ECO_TICKS_PER_DAY === "number" ? ECO_TICKS_PER_DAY : 144;
  return mindClamp(mind.grief * Math.pow(0.5, Math.max(0, ticks - (mind.griefAt || 0)) / perDay));
}

// ---------- Drives ----------

function mindDrives(enemy, species, mind, distance) {
  const nature = mindNature(enemy, species);
  const temper = mindTemper(mind);
  const body = mindBody(enemy, species, mind);
  const self = mindSelf(enemy, species, mind, nature, distance, body);
  // Those of its own standing near count on its side.
  const danger = mindDanger(enemy, self.allies);
  const kind = Math.max(0, mind.value);
  const harm = Math.max(0, -mind.value);
  const wary = species.temperament === "wary";
  const timid = (species.flees || 0) * 1.4 + (species.role === "grazer" ? 0.3 : 0) + (wary ? 0.2 : 0);
  // What meets harm with anger: hunters, and what has no body worth fearing for.
  const hot = species.role === "predator" || nature.body < 0.5;
  // The fear it was born with counts for less the better it knows you to be harmless.
  const proven = mind.known * mindClamp(1 + mind.value * 2.5);
  // ...and it's braver on its own ground, and among its own, unless it's badly hurt.
  const together = self.kin * Math.min(1, self.allies / Math.max(1, mindStrength(enemy)) / 2);
  const courage = ((self.atHome ? self.den * 0.25 : 0) + together * 0.3) * (1 - body.wound);
  // Would it stand and fight for its own? Only if it thinks they can win: hunters and the
  // dead always think so; a herd does when there are enough of them.
  const stands = hot || danger < 1;
  const forKin = self.kinHurt ? self.kin : 0;
  const fear = mindClamp(temper.fear * nature.body * ((timid * 0.6 + Math.min(1, danger / 4) * 0.25) * (1 - proven) + body.wound * 0.8 +
    harm * (hot ? 0.3 : 0.7) + (mind.startle ? 0.15 : 0) + body.stress * 0.25 + (stands ? 0 : forKin * 0.5) + (body.sick ? 0.1 : 0)) -
    courage - kind * 0.7 - (body.hungerState === "starving" ? 0.3 : 0));
  // A robbed alux is angry; a chaneque's revenge is fright instead (systems/ecology.js).
  const offended = enemy.eco?.offended && species.offended !== "susto" ? 0.8 : 0;
  // Big raiders (the sea giants) came to take by force.
  const bold = nature.craves && (species.size || 1) >= 3 && species.temperament === "hostile" ? 0.5 : 0;
  const crowded = typeof ecoIsCrowded === "function" && ecoIsCrowded(enemy) && species.role === "grazer" ? 0.55 : 0;
  // A theft it saw stings for a day or two (systems/cherish.js).
  const grudge = typeof cherishGrudge === "function" ? cherishGrudge(enemy) : 0;
  const anger = mindClamp(temper.anger * ((enemy.provoked ? 0.7 : 0) + self.anger + offended + bold + crowded + (stands ? forKin * 0.7 : 0) +
    harm * (hot ? 0.75 : 0.15) + body.stress * 0.15 + grudge * 0.8) - kind * 0.6);
  const curiosity = mindClamp(temper.curious * nature.curious * 0.4 * Math.pow(1 - mind.known, 2) * (wary ? 0.6 : 1) * (0.5 + 0.5 * body.wake) *
    // (It takes heat to wonder: a shaken, hurt, or sick creature has little to spare.)
    (0.55 + 0.45 * body.tonalli));
  // Greed grows with need: a hungry raider wants your pack badly.
  const greed = mindClamp(nature.craves * (body.hunger >= 0.65 ? 1 : 0.6) - kind * 0.5);
  // Something you carry is the sort of thing it loves.
  const longing = typeof cherishLonging === "function" ? mindClamp(cherishLonging(enemy) * (1 - 0.5 * fear) - harm * 0.3) : 0;
  // Peace: nothing lacking, nothing hurting, nothing threatened. Then the quiet wins.
  // At the hours its kind sleeps, the quiet pulls harder.
  const content = (1 - body.hunger) * (1 - body.wound) * (1 - body.stress) * (1 - self.threat);
  const rest = Math.max(body.hungerState === "gorged" ? 0.7 : enemy.asleep ? 0.9 : 0, 0.1 + content * 0.3) + body.tombRest * 0.2 +
    (1 - body.wake) * 0.45;
  return {
    hunger: body.hunger, greed, longing, fondness: kind, fear, anger, keep: self.held, curiosity, rest, stands,
    hungerState: body.hungerState, danger, distance, nature, self, body, harm, kept: self.kept,
    post: self.post, postCling: self.postCling, atCharge: self.kept === "post" && self.threat > 0
  };
}

// ---------- What it can sense ----------

function mindSenses(enemy, species, drives) {
  const tokens = [];
  const range = (typeof creatureNoticeRange === "function" ? creatureNoticeRange(enemy) : 5) + 1;
  const distance = drives.distance;
  const self = drives.self;
  if (distance <= range + gridReach(2)) {
    const sight = hasLineOfSight(enemy, state.run.player) ? 1 : 0.35;
    const near = mindClamp(1.15 - distance / (range + gridReach(2)));
    const loud = (typeof armorIsNoisy === "function" && armorIsNoisy() ? 0.15 : 0) +
      (typeof currentStance === "function" && currentStance() === "run" ? 0.15 : 0);
    const preyable = mindSeesPrey(species, drives.hungerState, drives.nature);
    tokens.push({
      id: "player", kind: "player", intensity: mindClamp((near * sight + loud) * (0.55 + 0.45 * drives.body.wake)),
      key: {
        hunger: preyable ? 1 : 0, greed: drives.nature.craves ? mindPackAppeal() : 0, longing: 1, fondness: 1,
        fear: Math.min(1, drives.danger / 2 + drives.harm * 0.5), anger: 1,
        keep: self.held ? self.threat / self.held : 0, curiosity: 1, rest: 0
      }
    });
  }
  // Its post, when it has strayed from it: what it keeps pulls it back.
  if (self.postCling && self.post) {
    const away = distanceInSquares(enemy, self.post);
    if (away > 1) tokens.push({ id: "post", kind: "post", intensity: mindClamp(away / gridReach(6)), key: { keep: 1 } });
  }
  // Food it could be eating instead.
  const eco = typeof ecoState === "function" ? ecoState() : null;
  if (eco && drives.hunger > 0.1) {
    let best = null;
    for (const feature of eco.features) {
      const reach = distanceInSquares(feature, enemy);
      if (reach > gridReach(6) || !ecoFeatureFeeds(feature, species)) continue;
      if (!best || reach < best.reach) best = { feature, reach };
    }
    if (best) tokens.push({ id: "food", kind: "food", intensity: mindClamp(1.1 - best.reach / gridReach(7)), key: { hunger: 1, greed: 0.5 } });
  }
  // Other creatures: prey for a hunter, a hunter for prey, kin already fighting you.
  for (const other of state.run.enemies) {
    if (other === enemy || !other.alive) continue;
    const reach = distanceInSquares(other, enemy);
    if (reach > gridReach(6)) continue;
    const otherSpecies = ecoSpecies(other);
    if (!otherSpecies) continue;
    if (species.role === "predator" && typeof ecoCanHunt === "function" && ecoCanHunt(enemy, other, species)) {
      tokens.push({ id: `prey:${other.id}`, kind: "prey", intensity: mindClamp(1 - reach / gridReach(7)), key: { hunger: 1 } });
    } else if (otherSpecies.role === "predator" && otherSpecies.is && typeof ecoCanHunt === "function" && ecoCanHunt(other, enemy, otherSpecies)) {
      tokens.push({ id: `hunter:${other.id}`, kind: "hunter", intensity: mindClamp(1 - reach / gridReach(7)), key: { fear: 1 } });
    } else if (other.templateId === enemy.templateId && other.alerted && !other.fleeTurns) {
      // Kin in a fight with you. It joins if it thinks its side can win (a pack, a big
      // flock, the dead closing ranks) and scatters if not.
      tokens.push({ id: `kin:${other.id}`, kind: "kin", intensity: mindClamp(1 - reach / gridReach(7)), key: drives.stands ? { anger: 0.8 } : { fear: 0.8 } });
    } else if (other.templateId === enemy.templateId && other.fleeTurns > 0 && other.mind?.intent === "flee" &&
      !drives.stands && hasLineOfSight(other, enemy)) {
      // Kin running from you: when one of a flock bolts, the rest look up.
      tokens.push({ id: `alarm:${other.id}`, kind: "alarm", intensity: mindClamp(1.4 - reach / gridReach(7)), key: { fear: 1 } });
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

// Which drive a token engages most, for this creature right now.
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
// sets what it means to do. Returns true if it used the turn (watching you, following you,
// going back to its post, or going on).
function mindThink(enemy, distance) {
  if (!mindApplies(enemy)) return false;
  const species = ecoSpecies(enemy);
  const nature = mindNature(enemy, species);
  const mind = mindFor(enemy);
  mind.step = state.run.steps || 0;
  // What happened since its last thought: were you the one who hurt it?
  if (enemy.hp < (mind.lastHp ?? enemy.hp) && enemy.provoked) mindHurt(mind);
  mind.lastHp = enemy.hp;
  // Stress settles, a little each turn, toward what the tomb's mood, the day, the air of
  // the place, and its own grief set.
  const day = typeof lawCount === "function" ? lawCount() : null;
  const baseline = 0.3 * (typeof tombHunger === "function" ? tombHunger() : 0) +
    (day?.quarter === "south" ? 0.1 : 0) + (day?.movement ? 0.25 : 0) +
    mindAirFelt(enemy, species) + 0.3 * mindGrief(mind);
  mind.stress = mindClamp(mind.stress + (Math.min(0.8, baseline) - mind.stress) * 0.15 * mindTemper(mind).settles);
  const range = (typeof creatureNoticeRange === "function" ? creatureNoticeRange(enemy) : 5) + 1;
  const senses = creatureSensesPlayer(enemy, range);
  // Prediction: it expects you where it last sensed you. You appearing close, out of
  // nowhere, startles it.
  mind.startle = senses && !mind.seen && distance <= gridReach(3);
  if (mind.startle) mind.stress = mindClamp(mind.stress + 0.2);
  if (senses && !mind.seen) {
    mind.met = Math.min(20, mind.met + 1);
    mind.encounterHp = enemy.hp;
    mind.known = mindClamp(mind.known + 0.15 * (1 - mind.known));
  }
  if (!senses && mind.seen && enemy.hp >= (mind.encounterHp ?? enemy.hp) && !enemy.provoked) {
    // You left without hurting it: one more meeting where nothing happened. (On edge, it
    // learns that more slowly.)
    mind.calm = Math.min(12, mind.calm + 1);
    mindLearn(mind, 0, MIND_LEARN.calm * (1 - mind.stress));
  }
  mind.seen = senses;
  // Far off and not in a fight, you aren't on its mind at all: skip the thinking (unless
  // it has strayed from a post it keeps; then that's on its mind).
  const post = nature.post ? mindPost(enemy) : null;
  const strayed = post && distanceInSquares(enemy, post) > 1;
  if (distance > range + gridReach(3) && !enemy.alerted && !enemy.fleeTurns && !strayed) {
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
  // One of the dead, fed and loosened by your offerings, at peace with you: it goes on.
  if (mindReadyToGoOn(enemy, species, nature, mind, drives, distance)) {
    mindGoOn(enemy, species);
    return true;
  }
  const tokens = mindAttend(drives, mindSenses(enemy, species, drives));
  // The global workspace: one focus at a time, held unless something clearly beats it.
  const best = tokens.reduce((a, b) => (b.score > a.score ? b : a));
  const held = mind.focus && tokens.find((token) => token.id === mind.focus);
  const focus = held && held.score >= best.score * MIND_HOLD ? held : best;
  mind.focus = focus.id;
  const you = tokens.find((token) => token.kind === "player");
  mind.attention = you ? Math.round(you.attention * 100) / 100 : 0;

  let intent = "ignore";
  let cause = null;
  if (focus.kind === "player" && you.attention >= MIND_ENGAGE) {
    cause = mindDominantDrive(drives, focus);
    if (cause === "fear" && drives.fear >= 0.45) intent = "flee";
    else if (cause === "anger") intent = drives.anger >= 0.45 ? (drives.fear > 0.75 ? "flee" : "fight") : "watch";
    else if (cause === "hunger" && drives.hunger >= 0.6) intent = "fight";
    // Near what it keeps: its young it defends outright; a post or a den, it stands its
    // ground and warns you, and fights if you press on.
    // Its own kind in trouble: it stands with them or runs, as it judges the odds.
    else if (cause === "keep" && drives.kept === "kin") intent = drives.stands ? (drives.anger >= 0.45 ? "fight" : "watch") : drives.fear >= 0.3 ? "flee" : "watch";
    else if (cause === "keep") intent = drives.kept === "nest" ? (distance <= gridReach(3) ? "fight" : "watch") : drives.anger >= 0.45 ? "fight" : "watch";
    // After what you carry: it closes in (a thief's habit is to grab and run), unless it's
    // too frightened, when it shadows you instead.
    else if (cause === "greed") intent = drives.fear >= 0.6 ? "watch" : "fight";
    // After the thing it loves: the ones that take by force come to take it; the rest come
    // close and trail you, hoping, or watch from where they feel safe.
    else if (cause === "longing") intent = drives.fear >= 0.5 ? "watch" : nature.craves && species.temperament === "hostile" && (species.size || 1) >= 3 ? "fight" : "follow";
    // It has learned you're good to it. The living come close; the dead only watch.
    else if (cause === "fondness") intent = nature.body >= 0.9 ? "follow" : "watch";
    else if (cause === "curiosity") intent = "watch";
  } else if (focus.kind === "kin" && distance <= range) {
    cause = "kin";
    intent = drives.stands ? "fight" : "flee";
  } else if (focus.kind === "alarm" && distance <= range + gridReach(2)) {
    cause = "kin";
    intent = drives.fear >= 0.25 ? "flee" : "watch";
  } else if (focus.kind === "post" && !enemy.provoked) {
    intent = "return";
  }
  // Already in a fight it chose: it doesn't drop it just because its attention wavers,
  // unless fear wins.
  if (enemy.alerted && ["ignore", "return", "follow"].includes(intent) && (enemy.provoked || mind.intent === "fight") && distance <= range) intent = drives.fear >= 0.6 ? "flee" : "fight";
  // Some bodies have one more way out (`feigns` in data/ecology.js): caught close by
  // something it can't outrun, the fear itself shuts the body down. It drops, goes stiff,
  // and is taken for dead. It gets up when you have gone.
  if (intent === "flee" && species.feigns && distance <= gridReach(2)) intent = "feign";
  // Cornered, anything else fights.
  if (intent === "flee" && distance <= 1 && typeof creatureStepAway === "function" && !creatureStepAway(enemy)) intent = "fight";
  if (intent !== mind.intent && senses) mindSpread(enemy, mind, intent, cause);
  // What it feels, it gives off: fear hangs in the air where it broke and ran.
  if (intent === "flee" && mind.intent !== "flee") mindAirLeave(enemy, "fear", 0.5);
  drives.cause = cause;
  mindSay(enemy, mind, intent, drives);
  mind.intent = intent;
  mind.cause = cause;

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
  if (intent === "feign") {
    enemy.alerted = false;
    enemy.fleeTurns = 0;
    return true;
  }
  if (intent === "watch") {
    // Keeps you at a distance it likes, and stays where it can see you. Something keeping
    // a post holds its ground instead.
    enemy.alerted = false;
    if (drives.postCling >= 0.5) return true;
    const step = distance < gridReach(2) ? creatureStepAway(enemy) : distance > gridReach(4) ? creatureStepToward(enemy, state.run.player, { adjacent: true }) : null;
    if (step) moveCreature(enemy, step);
    return true;
  }
  if (intent === "follow") {
    // Comes close and stays close, the way a fed animal does, hoping for more.
    enemy.alerted = false;
    const step = distance > gridReach(2) ? creatureStepToward(enemy, state.run.player, { adjacent: true }) : null;
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

// ---------- Going on ----------

// The restless dead are restless because they hold on: to a post, to the hunger. Offerings
// feed them and loosen that hold. One that has let go of its post, isn't hungry (the tomb's
// hunger is its hunger too), and has nothing against you goes on when it sees you.
function mindReadyToGoOn(enemy, species, nature, mind, drives, distance) {
  if (nature !== MIND_NATURES.spirit || !species.passesOn || enemy.guardian || enemy.provoked) return false;
  if (mindCling(mind, nature) > 0.1 || !["fed", "gorged"].includes(drives.hungerState) || mind.value < 0.4) return false;
  return distance <= gridReach(6) && playerSees(enemy);
}

const MIND_ROADS = {
  mictlan: (name) => `${name} lowers its spear and turns away from its post. It sets out on the long road to Mictlan.`,
  cihuatlampa: (name) => `${name} turns to the west, toward Cihuatlampa, the place of women, and is gone.`
};

function mindGoOn(enemy, species) {
  enemy.alive = false;
  enemy.wentOn = true;
  enemy.alerted = false;
  const line = (MIND_ROADS[species.passesOn] || ((name) => `${name} lets go of this place and is gone.`))(enemy.name);
  addLog(`${line} You gain ${enemy.xp} experience.`);
  if (typeof showCombatFeedback === "function") showCombatFeedback("heal", `${enemy.name} goes on`, { actor: "enemy", x: enemy.x, y: enemy.y, enemyId: enemy.id });
  addExperience(enemy.xp);
  // What held it here goes back to the earth.
  if (typeof tombGive === "function") tombGive("passing");
}

// ---------- Memory ----------

// You hurt it.
function mindHurt(mind) {
  mind.harmed = Math.min(6, mind.harmed + 1);
  mind.stress = mindClamp(mind.stress + 0.4);
  mindLearn(mind, -1, MIND_LEARN.harm);
}

// What one creature does about you, the others of its kind that see it learn from: alarm
// spreads through a herd (it trusts the one that knows you better), and so does trust.
function mindSpread(enemy, mind, intent, cause) {
  const alarm = (intent === "flee" || intent === "fight") && ["fear", "anger", "keep", "kin"].includes(cause);
  const trust = intent === "follow";
  if (!alarm && !trust) return;
  const herd = ecoSpecies(enemy)?.packs ? 1 : 0.5;
  for (const other of state.run.enemies) {
    if (other === enemy || !other.alive || other.templateId !== enemy.templateId || !mindApplies(other)) continue;
    if (distanceInSquares(other, enemy) > gridReach(6) || !hasLineOfSight(other, enemy)) continue;
    const kin = mindFor(other);
    if (alarm) {
      kin.stress = mindClamp(kin.stress + 0.35 * herd);
      if (mind.value < kin.value) kin.value = mindClampSigned(kin.value + 0.2 * herd * (mind.value - kin.value));
    } else if (mind.value > kin.value) {
      kin.value = mindClampSigned(kin.value + 0.15 * herd * (mind.value - kin.value));
    }
  }
}

// When you kill a creature, others of its kind that saw it learn what you are.
function mindWitnessDeath(victim) {
  if (!victim) return;
  for (const other of state.run.enemies) {
    if (!other.alive || other === victim || other.templateId !== victim.templateId || !mindApplies(other)) continue;
    if (distanceInSquares(other, victim) > gridReach(7) || !hasLineOfSight(other, victim)) continue;
    const mind = mindFor(other);
    mind.witnessed = Math.min(6, mind.witnessed + 1);
    mind.stress = mindClamp(mind.stress + 0.35);
    mindLearn(mind, -1, MIND_LEARN.saw);
  }
}

// One of its own died (of anything: a hunter, hunger, sickness, you). Those that held it
// feel it, as much as they held it: they are shaken, and for a day or two they hold their
// ground less.
function mindKinDied(victim, killer) {
  if (!victim || !state.run?.enemies) return;
  const victimSpecies = ecoSpecies(victim);
  if (!victimSpecies) return;
  // A death leaves its mark on the air of the place.
  mindAirLeave(victim, "blood", killer ? 0.8 : 0.4);
  for (const other of state.run.enemies) {
    if (!other.alive || other === victim || other.templateId !== victim.templateId || !mindApplies(other)) continue;
    const near = distanceInSquares(other, victim) <= gridReach(7) || other.eco?.home === victim.eco?.home;
    if (!near) continue;
    const species = ecoSpecies(other);
    const nature = mindNature(other, species);
    const mind = mindFor(other);
    const hold = mindKin(other, species, nature, nature === MIND_NATURES.animal ? mindSettled(other, mind) : 1).hold;
    if (hold < 0.1) continue;
    mind.grief = mindClamp(mindGrief(mind) + hold * 0.6);
    mind.griefAt = (typeof ecoState === "function" && ecoState()?.ticks) || 0;
    mind.stress = mindClamp(mind.stress + hold * 0.3);
  }
}

// ---------- Ihiyotl: the air a creature leaves ----------
// What a creature feels, it gives off, and it hangs in the chamber for hours: the sour
// smell of fear where something broke and ran, blood where something died. (A hunter's
// musk in its den, the cold where the dead keep watch, and the sweet rot of sickness are
// read straight from who is there: mindAir.) Other creatures feel it, and so can you.

const MIND_AIR_HALF_LIFE = 36;   // ticks (six hours)

function mindAirLeave(spot, kind, amount) {
  const eco = typeof ecoState === "function" ? ecoState() : null;
  const room = spot && Number.isFinite(spot.x) ? roomIndexAt(spot.x, spot.y) : -1;
  if (!eco || room < 0) return;
  eco.air ||= {};
  const air = eco.air[room] ||= {};
  const now = eco.ticks || 0;
  const faded = (air[kind] || 0) * Math.pow(0.5, Math.max(0, now - (air.at || now)) / MIND_AIR_HALF_LIFE);
  for (const other of ["fear", "blood"]) if (other !== kind && air[other]) air[other] *= Math.pow(0.5, Math.max(0, now - (air.at || now)) / MIND_AIR_HALF_LIFE);
  air[kind] = Math.min(1, faded + amount);
  air.at = now;
}

// The air of a chamber right now: { fear, blood, musk, cold, sick } each 0 to 1, and for
// musk, whose it is.
function mindAir(roomIndex) {
  const eco = typeof ecoState === "function" ? ecoState() : null;
  const air = { fear: 0, blood: 0, musk: 0, cold: 0, sick: 0, hunter: null };
  if (!eco || roomIndex < 0) return air;
  const left = eco.air?.[roomIndex];
  if (left) {
    const fade = Math.pow(0.5, Math.max(0, (eco.ticks || 0) - (left.at || 0)) / MIND_AIR_HALF_LIFE);
    air.fear = (left.fear || 0) * fade;
    air.blood = (left.blood || 0) * fade;
  }
  for (const creature of state.run.enemies) {
    if (!creature.alive || creature.eco?.home !== roomIndex) continue;
    const species = ecoSpecies(creature);
    if (!species) continue;
    if (species.role === "predator" && (species.size || 1) >= 2 && !creature.guardian) {
      const musk = Math.min(1, (species.size || 1) / 4) * (creature.mind ? mindSettled(creature, creature.mind) : 1);
      if (musk > air.musk) { air.musk = musk; air.hunter = creature.templateId; }
    }
    if (species.role === "spirit") air.cold = Math.max(air.cold, 0.7);
    if (ecoIsSick(creature)) air.sick = Math.min(1, air.sick + 0.5);
  }
  return air;
}

// How much the air of where it stands puts a creature on edge. Fear is catching; a
// hunter's musk worries what it hunts; the cold of the dead worries the living.
function mindAirFelt(enemy, species) {
  const room = roomIndexAt(enemy.x, enemy.y);
  if (room < 0) return 0;
  const air = mindAir(room);
  const hunted = species.role !== "predator" && species.role !== "spirit" && air.hunter !== enemy.templateId;
  const living = species.role !== "spirit" && species.role !== "guardian";
  return 0.25 * air.fear + (hunted ? 0.2 * air.musk : 0) + (living ? 0.1 * air.cold : 0);
}

// What you notice of a chamber's air, in a line, or "". You know a hunter's musk by name
// once you have seen its kind.
function mindAirLine(roomIndex) {
  const air = mindAir(roomIndex);
  const parts = [];
  if (air.musk >= 0.4) {
    const known = air.hunter && typeof naturalistKnows === "function" && naturalistKnows(air.hunter);
    parts.push(known ? `The air smells of ${ecoName(air.hunter).toLowerCase()}. One dens here.` : "A hunter's musk hangs in the air here.");
  }
  if (air.blood >= 0.35) parts.push("There is fresh blood in the air.");
  else if (air.fear >= 0.35) parts.push("Something ran through here not long ago. The air still has the sour smell of it.");
  if (air.sick >= 0.5) parts.push("The air is sweet and bad. Something here is sick.");
  if (air.cold >= 0.5) parts.push("The air is cold and still, the way it is where the dead keep watch.");
  return parts.join(" ");
}

// Called when you walk into a chamber: tells you about its air if it has changed since you
// last smelled it.
function mindAirNotice(roomIndex) {
  const eco = typeof ecoState === "function" ? ecoState() : null;
  if (!eco || roomIndex < 0) return;
  const line = mindAirLine(roomIndex);
  eco.airSaid ||= {};
  if (eco.airSaid[roomIndex] === line) return;
  eco.airSaid[roomIndex] = line;
  if (line) addLog(line);
}

// The young are born knowing some of what their parents learned about you, so a herd you
// have fed for generations comes to you, and one you have hunted runs from the start.
function mindInherit(young, parent) {
  if (!young?.eco) return;
  const mind = mindFor(young);
  // It is born under today's sign.
  if (typeof lawBirthSign === "function") mind.sign = lawBirthSign(state.run.gameMinutes || 0);
  mind.home = young.eco.home;
  mind.since = (typeof ecoState === "function" && ecoState()?.ticks) || 0;
  const elder = parent?.mind;
  if (!elder || !Number.isFinite(elder.value)) return;
  mind.value = elder.value * 0.6;
  mind.known = (elder.known || 0) * 0.3;
  mind.inherited = Math.abs(mind.value) >= 0.15;
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

// It ate food you left for it, or took your offering (`offering` is the offering's worth,
// ECO.offerings). For the dead, an offering also loosens their hold on their post.
function mindFedBy(creature, { offering = 0 } = {}) {
  if (!creature || !mindApplies(creature)) return;
  const mind = mindFor(creature);
  mind.fed = Math.min(5, mind.fed + 1);
  mind.harmed = Math.max(0, mind.harmed - 1);
  mind.stress *= 0.5;
  mindLearn(mind, 1, MIND_LEARN.fed);
  const nature = mindNature(creature, ecoSpecies(creature));
  if (offering && nature === MIND_NATURES.spirit) mind.cling = Math.max(0, mindCling(mind, nature) - 0.04 * offering);
}

// ---------- Telling you ----------

// A short line in the log when a creature's mind about you changes and you can see it.
function mindSay(enemy, mind, intent, drives) {
  if (intent === mind.said || !playerSees(enemy)) {
    mind.said = mind.said === intent ? intent : mind.said;
    return;
  }
  const name = enemy.name;
  const kind = mindNatureName(enemy, ecoSpecies(enemy));
  const remembers = mind.value <= -0.3;
  // It wants what you carry (systems/cherish.js).
  const wanted = drives.cause === "longing" && typeof cherishWanted === "function" ? cherishWanted(enemy) : null;
  if (wanted && ["follow", "watch", "fight"].includes(intent)) {
    addLog(intent === "fight" ? `${name} wants something you carry, and means to have it.`
      : intent === "follow" ? `${name} can't take its eyes off something you carry. It comes closer.`
      : `${name} watches what you carry from a safe distance.`);
    mind.said = intent;
    return;
  }
  const lines = {
    animal: {
      watch: drives.kept === "den" && drives.self.den >= 0.6 ? `${name} stands its ground. This is its den.`
        : drives.kept === "kill" ? `${name} lowers its head over its kill and watches you.`
        : drives.kept === "kin" ? `${name} moves to stand with the others of its kind.`
        : mind.fed > 0 ? `${name} watches you, ears forward. It remembers the food.` : `${name} stops and watches you.`,
      follow: mind.inherited && mind.fed === 0 ? `${name} comes to you without fear, as its parents did.` : `${name} comes closer, hoping you have food.`,
      flee: mind.intent === "feign" ? `${name} rolls onto its feet and runs.` : remembers && mind.intent !== "flee" ? `${name} sees you and bolts: it remembers you.` : drives.fear > 0.6 ? `${name} shies away from you.` : null,
      feign: `${name} falls on its side with its mouth open and lies still.`,
      fight: drives.self.kinHurt && drives.stands && !enemy.provoked ? `${name} comes at you with the rest of its kind.`
        : drives.kept === "kill" ? `${name} will not give up its kill.`
        : mind.intent === "watch" ? `${name} has made up its mind about you.` : drives.hunger >= 1 && mindSeesPrey(ecoSpecies(enemy), drives.hungerState) ? `${name} is starving, and you look like food.` : null,
      ignore: mind.intent === "watch" && mind.known >= 0.4 ? `${name} loses interest in you.` : null
    },
    spirit: {
      watch: drives.atCharge ? `${name} turns to face you and does not move.` : `${name} turns its head to follow your warmth.`,
      flee: `${name} draws back from you.`,
      fight: drives.hunger >= 0.65 && !enemy.provoked ? (drives.body.tombHunger >= 0.5 ? `The tomb's hunger moves in ${name}. It comes for the life in you.` : `${name} hungers, and comes for the life in you.`)
        : remembers ? `${name} has not forgotten you.` : mind.intent === "watch" ? `${name} comes for you.` : null,
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
      follow: `${name} trails after you, hopeful.`,
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

// What you can read in its manner (for the inspect panel and the bestiary).
function mindDescription(enemy) {
  const mind = enemy?.mind;
  if (!mind || !mindApplies(enemy)) return "";
  const species = ecoSpecies(enemy);
  const kind = mindNatureName(enemy, species);
  const nature = MIND_NATURES[kind];
  const parts = [];
  if (mind.intent === "watch") {
    parts.push(kind === "raider" ? "It's watching your pack."
      : kind !== "animal" ? "It's watching you, and holding its ground."
      : mind.cause === "keep" && mindAtKill(enemy) ? "It's watching you over its kill."
      : mind.cause === "keep" ? "It's watching you, and standing its ground."
      : mind.cause === "anger" ? "It's watching you warily."
      : mind.cause === "fondness" ? "It's watching you, hoping for food."
      : "It's watching you, curious.");
  }
  else if (mind.intent === "follow") parts.push("It follows you, hoping for food.");
  else if (mind.intent === "feign") parts.push("It lies stiff with its mouth open. It is breathing.");
  else if (mind.intent === "flee") parts.push("It's afraid of you.");
  else if (mind.intent === "return") parts.push("It's going back to its post.");
  else if (mind.intent === "fight" && !enemy.provoked) parts.push(kind === "spirit" ? "It hungers for the life in you." : kind === "raider" ? "It means to rob you." : "It means to fight you.");
  else if (mind.intent === "ignore" && kind === "spirit" && ["fed", "gorged"].includes(ecoHungerState(enemy))) parts.push("It's fed, and pays you no mind.");
  // What it has learned you are.
  const value = Number.isFinite(mind.value) ? mind.value : 0;
  const tonalli = kind === "spirit" || kind === "warden";
  if (value >= 0.6) parts.push(tonalli ? "Your offerings have made it kind to you." : "It has come to trust you.");
  else if (value >= 0.25) parts.push(mind.fed ? (tonalli ? "It remembers your offering." : "It remembers the food you left.")
    : mind.inherited ? "It has never met you, but its parents trusted you." : "It isn't afraid of you.");
  else if (value <= -0.45) parts.push(species.role === "predator" || nature.body < 0.5 ? "It holds a grudge against you."
    : mind.harmed || mind.witnessed ? "It remembers what you did to its kind."
    : mind.inherited && !mind.met ? "Its parents feared you, and so does it." : "Its kind have taught it to fear you.");
  else if ((mind.known || 0) >= 0.5 && Math.abs(value) < 0.2) parts.push("It's used to you by now.");
  // What it has lost, and what ails it.
  if (mindGrief(mind) >= 0.25) parts.push("It has lost one of its own.");
  if (ecoIsSick(enemy)) parts.push("It is sick.");
  // How it holds on.
  if (kind === "spirit" && species.passesOn && mindCling(mind, nature) <= 0.25) parts.push("Its hold on this place is loosening.");
  else if (kind === "spirit" && typeof tombHunger === "function" && tombHunger() >= 0.5) parts.push("The tomb's hunger is in it.");
  else if (kind === "animal" && species.territorial && (mind.home === enemy.eco?.home) && mindSettled(enemy, mind) >= 0.6 &&
    roomIndexAt(state.run.player.x, state.run.player.y) === enemy.eco.home) parts.push("You're in its den.");
  if ((mind.stress || 0) >= 0.5 && mind.intent !== "flee") parts.push("It's on edge.");
  if (typeof cherishGrudge === "function" && cherishGrudge(enemy) >= 0.3) parts.push("It hasn't forgiven you for what you took.");
  if (typeof cherishNote === "function") {
    const note = cherishNote(enemy);
    if (note) parts.push(note);
  }
  return parts.join(" ");
}
