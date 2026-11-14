"use strict";

// The laws of the tomb.
//
// Everything in the tomb is bound by the same few rules, and nothing else is scripted. The
// rules came out of the Dependent Origins experiment (people, deer, and jaguars with one
// shared mind and eight laws); here they are in the tomb's own terms. Each one is a small
// function below that the other systems read. LAWS.md has the long version and the sources.
//
//   I    Teotl        There is one life. The mouth gives it; it is never made anywhere else
//                     and never lost, it only changes hands: mouth to ground, ground to
//                     plant, plant to body, body to the dead, the dead to the ground. What a
//                     floor can't hold rises to the floor above, and at the top it walks
//                     out into Chiltomatlan.                       lawLedger, lawRise
//   II   Olin         The pulse. The mouth breathes once a day, the count turns once a day,
//                     and every creature wakes and sleeps to it.  lawBreath, lawWake, lawCount
//   III  Malinalli    The twist. One thing becomes another at its own pace: glowcap into
//                     turkey, turkey into jaguar, the dead into black earth. Water twists
//                     down through the floors and warmth twists up.    lawReturn
//   IV   Nepantla     The middle. Everything has a pair (wet and dry, warm and cold, fed and
//                     hungry, taken and given) and rests somewhere between them. How far a
//                     thing is from its resting place is how hard it's pushed. Where two
//                     unlike places meet, more grows.               lawMiddle, lawEdge
//   V    The Holding  A creature feels what happens to whatever it holds as itself, as much
//                     as it holds it: its body, its den, its young, its herd, its kill, its
//                     post (teyolia, what the heart keeps).         lawHold  (systems/minds.js)
//   VI   The Mirror   Every creature expects, and learns from what it didn't expect; what it
//                     learned passes to those who watch and to its young (Tezcatlipoca, the
//                     smoking mirror).                              (systems/minds.js)
//   VII  The Bow      Every gathering breeds its own undoing: a crowded herd breeds sickness,
//                     a full bed breeds spores, a heap of carrion draws the dead, a full
//                     pack wakes the tomb.                          lawBow
//   VIII The Way      What has too much gives to what has too little: the full floor to the
//                     one above, the full bed to bare ground beside it, the fed parent to
//                     its young, the crowded floor to the empty one.   lawGive
//
// Laws I to IV are Nahua (teotl and its three motions, after James Maffie's reading). V and
// VI are the minds' own (MINDS.md). VII and VIII are the two lines of the Daodejing that
// Dependent Origins borrowed, and they sit here under names the tomb can use.

const LAW_DAY_MINUTES = 24 * 60;

// ---------- II. Olin: the count ----------
//
// The sacred count (tonalpohualli): thirteen numbers and twenty day signs turning together,
// 260 days before a name comes round again. A new game begins on One Crocodile, the first
// day of the count. The signs go round the four quarters in order (east, north, west,
// south), as the painted books lay them out.

const LAW_SIGNS = [
  { id: "cipactli", name: "Crocodile" }, { id: "ehecatl", name: "Wind" }, { id: "calli", name: "House" },
  { id: "cuetzpalin", name: "Lizard" }, { id: "coatl", name: "Serpent" }, { id: "miquiztli", name: "Death" },
  { id: "mazatl", name: "Deer" }, { id: "tochtli", name: "Rabbit" }, { id: "atl", name: "Water" },
  { id: "itzcuintli", name: "Dog" }, { id: "ozomatli", name: "Monkey" }, { id: "malinalli", name: "Grass" },
  { id: "acatl", name: "Reed" }, { id: "ocelotl", name: "Jaguar" }, { id: "cuauhtli", name: "Eagle" },
  { id: "cozcacuauhtli", name: "Vulture" }, { id: "olin", name: "Movement" }, { id: "tecpatl", name: "Flint" },
  { id: "quiahuitl", name: "Rain" }, { id: "xochitl", name: "Flower" }
];
const LAW_NUMBERS = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen"];
const LAW_NUMBERS_NAHUATL = ["Ce", "Ome", "Eyi", "Nahui", "Macuilli", "Chicuace", "Chicome", "Chicuei", "Chiconahui", "Matlactli", "Matlactli once", "Matlactli omome", "Matlactli omei"];
const LAW_SIGNS_NAHUATL = ["Cipactli", "Ehecatl", "Calli", "Cuetzpalin", "Coatl", "Miquiztli", "Mazatl", "Tochtli", "Atl", "Itzcuintli",
  "Ozomatli", "Malinalli", "Acatl", "Ocelotl", "Cuauhtli", "Cozcacuauhtli", "Olin", "Tecpatl", "Quiahuitl", "Xochitl"];
// The quarters, in the order the signs take them. `place` is the Nahuatl name of the quarter.
const LAW_QUARTERS = [
  { id: "east", name: "east", place: "Tlapcopa", lean: "The mouth breathes deeper, and the beds grow." },
  { id: "north", name: "north", place: "Mictlampa", lean: "The dead are hungrier, and an offering goes further." },
  { id: "west", name: "west", place: "Cihuatlampa", lean: "Nests are warm. More young are born." },
  { id: "south", name: "south", place: "Huitztlampa", lean: "The air is dry. Animals are on edge, and hunters range." }
];
// The five days the Cihuateteo come down (the first days of the five western thirteens).
const LAW_DESCENT_DAYS = ["mazatl", "quiahuitl", "ozomatli", "calli", "cuauhtli"];

// The day of the count for a moment of game time.
function lawCount(minutes = state.run?.gameMinutes || 0) {
  const index = Math.max(0, Math.floor(minutes / LAW_DAY_MINUTES));
  const number = index % 13;
  const sign = index % 20;
  const quarter = LAW_QUARTERS[sign % 4];
  const signId = LAW_SIGNS[sign].id;
  return {
    index, number: number + 1, sign, signId, quarter: quarter.id,
    name: `${LAW_NUMBERS[number]} ${LAW_SIGNS[sign].name}`,
    nahuatl: `${LAW_NUMBERS_NAHUATL[number]} ${LAW_SIGNS_NAHUATL[sign]}`,
    // Four Movement: the day this sun is fated to end, the day the old lords carved on
    // every lintel to wear it out (LORE.md).
    movement: number === 3 && signId === "olin",
    descent: number === 0 && LAW_DESCENT_DAYS.includes(signId)
  };
}

// How strongly today leans toward a quarter (1 on that quarter's days, 0 on the others).
function lawLeans(quarter, minutes) {
  return lawCount(minutes).quarter === quarter ? 1 : 0;
}

function lawQuarter(id) {
  return LAW_QUARTERS.find((quarter) => quarter.id === id) || LAW_QUARTERS[0];
}

// What to say about today, for the dawn banner and the journal.
function lawCountLine(minutes) {
  const day = lawCount(minutes);
  if (day.movement) return `${day.name}, the day a sun ends. The stone hums underfoot.`;
  if (day.descent) return `${day.name}, a day the Cihuateteo come down.`;
  return `${day.name}, a day of the ${day.quarter}. ${lawQuarter(day.quarter).lean}`;
}

// The sign a creature is born under shapes its temper a little (its tonalli: the word means
// both the soul's heat and the day one was given). Only the quarter matters here:
//   east   it is drawn to what it doesn't know
//   north  it is hard to frighten
//   west   it holds harder to its den, its nest, and its own
//   south  it is quick to anger and slow to settle
function lawBirthSign(minutes) {
  // Things born before the count was kept (and everything alive when a tomb is made) get a
  // sign by lot.
  if (!Number.isFinite(minutes)) return Math.floor(Math.random() * 20);
  return lawCount(minutes).sign;
}

function lawTemper(sign) {
  // (A sign of −1 is no sign at all: the tests use it so that birth doesn't decide a scene.)
  const quarter = Number.isInteger(sign) && sign >= 0 ? LAW_QUARTERS[sign % 4].id : "";
  return {
    quarter,
    curious: quarter === "east" ? 1.3 : 1,
    fear: quarter === "north" ? 0.85 : 1,
    holds: quarter === "west" ? 1.15 : 1,
    anger: quarter === "south" ? 1.12 : 1,
    settles: quarter === "south" ? 0.75 : 1
  };
}

// Called whenever game time moves. At the first moment of a new day it says what day of
// the count it is; on Four Movement the stone itself moves.
function lawTurns(previousMinutes) {
  const run = state.run;
  if (!run) return;
  const before = Math.floor((previousMinutes || 0) / LAW_DAY_MINUTES);
  const today = lawCount(run.gameMinutes || 0);
  if (today.index === before) return;
  addLog(`Today is ${lawCountLine(run.gameMinutes || 0)}`);
  if (today.movement && typeof regenerateFloorPassages === "function") {
    // Every floor but the one you stand on is shaken into new passages.
    let moved = 0;
    for (const snapshot of Object.values(run.dungeonFloors || {})) {
      if (regenerateFloorPassages(snapshot)) { snapshot.shifted = true; moved += 1; }
    }
    if (moved) addLog("The ground shakes. Somewhere above and below you, passages close and others open.");
  }
}

// ---------- II. Olin: the breath and the day ----------

// The mouth breathes once a day: deepest in the hour before dawn, when the small things set
// out up the road, and shallowest before dusk. It averages 1 over a day. On Four Movement it
// heaves.
function lawBreath(minutes = state.run?.gameMinutes || 0) {
  const hour = (minutes / 60) % 24;
  const day = lawCount(minutes);
  const pulse = 1 + 0.35 * Math.cos(((hour - 5) / 24) * Math.PI * 2);
  return pulse * (day.quarter === "east" ? 1.15 : 1) * (day.movement ? 1.5 : 1);
}

// Is it day up above? (The light never comes down, but everything that lives here keeps
// the sun's hours by the mouth's breath.)
function lawIsDay(minutes = state.run?.gameMinutes || 0) {
  const hour = (minutes / 60) % 24;
  return hour >= 6 && hour < 18;
}

// When a kind of creature is awake: by day, by night, or at the two edges of the day.
// Unless its entry in data/ecology.js says (`wakes`), it follows from how it lives: grazers
// feed by day, hunters and scavengers work the dusk and the dark, bats and the dead keep
// the night.
function lawWakes(species) {
  if (!species) return "always";
  if (species.wakes) return species.wakes;
  if (species.role === "grazer" || species.role === "omnivore") return "day";
  if (species.role === "predator") return species.eats?.includes("insects") && !species.eats.includes("large") ? "night" : "dusk";
  if (species.role === "scavenger" || species.role === "spirit" || species.role === "raider") return "night";
  return "always";
}

// How awake it is right now, from 0.35 (drowsing) to 1.
function lawWake(species, minutes = state.run?.gameMinutes || 0) {
  const wakes = lawWakes(species);
  if (wakes === "always") return 1;
  const hour = (minutes / 60) % 24;
  // 1 at noon, 0 at midnight.
  const sun = 0.5 + 0.5 * Math.cos(((hour - 12) / 24) * Math.PI * 2);
  const share = wakes === "day" ? sun : wakes === "night" ? 1 - sun : 1 - Math.abs(sun - 0.5) * 2;
  return 0.35 + 0.65 * Math.min(1, share * 1.6);
}

// ---------- IV. Nepantla: the middle ----------

// How far a value is from its resting place, in tolerances, squared: 0 at rest, 1 at the
// edge of what it can bear. One sum for a chamber's fit to a habitat, a creature's comfort,
// and anything else that has a pair to sit between.
function lawMiddle(value, center, tolerance) {
  const off = (value - center) / (tolerance || 1);
  return off * off;
}

// How unlike a chamber is to the chambers it opens onto (0 to 1). Where the wet meets the
// dry and the warm meets the cold, more kinds of thing can live, and the beds grow thicker.
function lawEdge(room, rooms) {
  const env = room?.env;
  if (!env) return 0;
  const links = (room.links || []).map((index) => rooms[index]?.env).filter(Boolean);
  if (!links.length) return 0;
  let total = 0;
  for (const other of links) total += Math.abs((env.moist || 0) - (other.moist || 0)) + Math.abs((env.warm || 0) - (other.warm || 0));
  return Math.min(1, total / links.length / 0.7);
}

// ---------- VII. The Bow ----------

// How hard a gathering pulls toward its own undoing: nothing until it passes `limit`, then
// rising to 1 at twice the limit.
function lawBow(amount, limit) {
  if (!(limit > 0) || amount <= limit) return 0;
  return Math.min(1, (amount - limit) / limit);
}

// ---------- VIII. The Way ----------

// How much the fuller of two gives the emptier: a share of what it has above `keep`, and
// never more than the other has room for.
function lawGive(has, keep, room, share = 0.5) {
  return Math.max(0, Math.min(room, (has - keep) * share));
}

// ---------- I. Teotl: what rises ----------

// The tomb keeps one small record across all its floors: what each floor has been letting
// rise (life it was given and could not hold), and how much has walked out at the top.
function lawBook() {
  const run = state.run;
  if (!run) return null;
  if (!run.laws || typeof run.laws !== "object" || Array.isArray(run.laws)) run.laws = { rise: {}, surfaced: 0 };
  if (!run.laws.rise || typeof run.laws.rise !== "object") run.laws.rise = {};
  if (!Number.isFinite(run.laws.surfaced)) run.laws.surfaced = 0;
  return run.laws;
}

const LAW_RISE_KEEPS = 0.85;   // what reaches the floor above, of what a floor lets rise (the rest warms the rock)
const LAW_RISE_MEMORY = 0.04;  // how fast a floor's record follows what it is doing now, per hour

// Life coming up to this floor from the one below, per tick.
function lawRiseInto(floor = state.run?.dungeonFloor || 1) {
  const book = lawBook();
  return book ? (book.rise[String(floor + 1)] || 0) * LAW_RISE_KEEPS : 0;
}

// A floor reports what it couldn't hold over `ticks` (its pool was full).
function lawRises(floor, spilled, ticks) {
  const book = lawBook();
  if (!book || !(ticks > 0)) return;
  const key = String(floor);
  const rate = Math.max(0, spilled) / ticks;
  const weight = Math.min(1, LAW_RISE_MEMORY * (ticks / 6));
  book.rise[key] = (book.rise[key] || 0) * (1 - weight) + rate * weight;
  // From the first floor it goes out through the broken seal, into the clay, the well, and
  // the maize of Chiltomatlan.
  if (floor === 1) book.surfaced += Math.max(0, spilled) * LAW_RISE_KEEPS;
}

// ---------- I. Teotl: the ledger ----------

// Where this floor's life is right now, all in upkeep points (one unit of plant growth).
// It is an instrument, for the tools and the tests: nothing in the game reads it to decide.
function lawLedger() {
  const eco = typeof ecoState === "function" ? ecoState() : null;
  if (!eco) return null;
  const plantEnergy = typeof ECO_PLANT_ENERGY === "number" ? ECO_PLANT_ENERGY : 0.35;
  const ledger = { ground: (eco.energy || 0) / plantEnergy, plants: 0, swarms: 0, bodies: 0, dead: 0 };
  for (const feature of eco.features || []) {
    if (["fungus", "plants", "pool"].includes(feature.kind)) ledger.plants += feature.amount || 0;
    else if (feature.kind === "colony") ledger.swarms += (feature.count || 0) / 4;
    else if (feature.kind === "carcass") ledger.dead += feature.meat || 0;
    else if (feature.kind === "bones") ledger.dead += 0.5;
  }
  for (const creature of typeof ecoLivingCreatures === "function" ? ecoLivingCreatures() : []) {
    const species = ecoSpecies(creature);
    if (species && ecoIsFed(species) && !creature.guardian) ledger.bodies += (species.size || 1) * 2;
  }
  ledger.total = ledger.ground + ledger.plants + ledger.swarms + ledger.bodies + ledger.dead;
  return ledger;
}

// ---------- Saves ----------

function normalizeLaws(saved) {
  const laws = saved.laws;
  if (!laws || typeof laws !== "object" || Array.isArray(laws) || !laws.rise || typeof laws.rise !== "object" || Array.isArray(laws.rise)) {
    saved.laws = { rise: {}, surfaced: 0 };
    return;
  }
  const rise = {};
  for (let floor = 1; floor <= DUNGEON_FLOOR_COUNT; floor += 1) {
    const value = laws.rise[String(floor)];
    if (Number.isFinite(value) && value >= 0 && value < 1000) rise[String(floor)] = value;
  }
  saved.laws = { rise, surfaced: Number.isFinite(laws.surfaced) && laws.surfaced >= 0 && laws.surfaced < 1e9 ? laws.surfaced : 0 };
}
