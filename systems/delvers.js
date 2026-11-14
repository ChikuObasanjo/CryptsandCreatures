"use strict";

// The other delvers, and the Lord of the Mouth.
//
// You aren't the only one the tomb draws. Every week a few people from outside come to
// Chiltomatlan and go down: most of them Nahua, a few from far away (data/delvers.js). Each
// is a real person with one life: a calling, a level that starts at 1 and grows, a pack of
// food and medicine from outside, and a goal (enough gold to go home). They go down while
// they feel strong enough, take what treasure they find, fight what attacks them, run when
// they're badly hurt, and climb out when they have enough. Some never come back.
//
// The tomb feels them as it feels you (systems/tomb-body.js): what they carry up out of it,
// and what goes back to it when they fall. What they brought in from outside is theirs, not
// the tomb's: when you find their remains, the food and medicine in their pack were never
// the tomb's to miss.
//
// Two ways a delver lives:
//   On your floor (while you're in the tomb), a delver is a figure on the map, drawn like you,
//   moving and fighting turn by turn (delverAct). They're neutral: you can't attack them,
//   walking into one trades places with them, and the interact button talks to them.
//   Everywhere else, hour by hour (delverHour): encounters, treasure, rest, meals, going
//   down, climbing out. The same rules decide both.
//
// The Lord of the Mouth: the Tzitzimitl bound across the mouth wears a living lord. Now it
// is Tenoch, a level 20 paladin with her vestments, a +3 macuahuitl, and +3 armor. When he
// dies, she comes out of him in her own form. If she survives, she calls another vessel a
// week later: a young paladin who comes to Chiltomatlan and makes his way down, and if he
// reaches her, he becomes the new lord. If she is destroyed, no more come (LORE.md has what
// that means for the world).
//
// Delvers live in state.run.delvers (saved with the run), never in the floor snapshots: a
// delver's figure exists only while you share their floor, and it's rebuilt from the record.

const DELVER_DATA = window.CryptsDelvers;
const DELVER_HOUR = 60;
const DELVER_RULES = {
  maxInTomb: 8,           // most delvers in the tomb at once
  weeklyArrivals: [[0, 30], [1, 50], [2, 20]],
  encounterPerHour: 0.25,
  treasurePerHour: 0.18,
  healPerHour: 0.08,
  climbHours: 3,          // hours to climb one floor on the way out
  mealHours: 8,
  fleeAt: 0.35,           // share of hit points at which a delver turns for home
  catchUpDays: 60         // the most time caught up at once
};
const DELVER_IN_TOMB = new Set(["delving", "withdrawing"]);
const DAY_MINUTES = 24 * 60;

// ---------- The record ----------

function delversState() {
  const run = state.run;
  if (!run) return null;
  if (!run.delvers || typeof run.delvers !== "object" || !Array.isArray(run.delvers.list)) {
    const now = run.gameMinutes || 0;
    run.delvers = { list: [], clock: now, week: now, news: [], nextId: 1,
      throne: { spirit: "bound", lordId: null, nextVessel: null, regalia: "lord" } };
    delversSeed();
  }
  return run.delvers;
}

function delverById(id) {
  return delversState()?.list.find((delver) => delver.id === id) || null;
}

function delverPick(list) {
  return list[randomInt(list.length) - 1];
}

function delverWeighted(weights) {
  const entries = Object.entries(weights);
  let roll = Math.random() * entries.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return key;
  }
  return entries[0][0];
}

// A whole person: a character the game can draw and derive stats for, a pack, and a plan.
function delverCreate({ culture = null, cls = null, gender = null, level = 1, vessel = false } = {}) {
  const book = delversState();
  culture ||= delverWeighted(DELVER_DATA.cultureWeights);
  const people = DELVER_DATA.cultures[culture];
  cls ||= delverWeighted(people.classes);
  gender ||= Math.random() < 0.5 ? "man" : "woman";
  const name = vessel ? delverPick(DELVER_DATA.avatar.names) : delverPick(people.names[gender] || people.names.man);
  const callingGear = CLASSES[cls] || CLASSES.fighter;
  const gear = { ...(people.gear || {}), ...(people.byClass?.[cls] || {}) };
  const weapon = people.ranged?.[cls] || gear.weapon || callingGear.weapon;
  // Their people's armor, unless their calling fights without any; otherwise the heaviest
  // their calling wears.
  const unarmored = callingGear.armor.length === 1 && callingGear.armor[0] === "none";
  const armor = gear.armor !== undefined && !unarmored ? gear.armor
    : ["scale", "hide", "leather"].find((id) => callingGear.armor.includes(id)) || "none";
  const scores = { str: 13, dex: 13, con: 13, int: 10, wis: 11, cha: 10 };
  const lead = callingGear.attack || "str";
  scores[lead] = 15;
  scores.con = 14;
  const character = {
    name, gender, race: "human", heritage: "", class: cls, background: "soldier",
    scores, baseScores: { ...scores },
    appearance: {
      skin: delverPick(people.skin), hair: delverPick(people.hair), hairStyle: delverPick(HAIR_STYLES),
      tunic: delverPick(CLOTHING_COLORS).value, trim: delverPick(TRIM_COLORS).value,
      garment: delverPick(GARMENT_STYLES.filter((id) => id !== "none")), adornment: delverPick(CLOTHING_ADORNMENTS),
      headwear: delverPick(HEADWEAR_STYLES), facePaint: Math.random() < 0.5 ? "none" : delverPick(FACE_PAINT_STYLES),
      face: delverPick(FACE_STYLES), body: delverPick(BODY_TYPES), beard: gender === "man" && Math.random() < 0.4 ? delverPick(BEARD_STYLES) : "none",
      jewelry: delverPick(JEWELRY_STYLES), crest: "none"
    },
    cosmetics: { owned: [], helmet: null, clothes: null },
    equipment: { weapon: WEAPONS[weapon] ? weapon : callingGear.weapon, armor: ARMORS[armor] ? armor : "none",
      shield: Boolean(gear.shield ?? callingGear.shield) && !WEAPONS[weapon]?.ranged, cloak: Math.random() < 0.3 }
  };
  const kit = DELVER_DATA.kit.map((entry) => ({ id: entry.id, quantity: entry.min + randomInt(entry.max - entry.min + 1) - 1 }))
    .filter((entry) => entry.quantity > 0 && itemDetails(entry.id));
  const delver = {
    id: `d${book.nextId++}`, name, culture, cls, gender, level, xp: XP_THRESHOLDS[level] || 0, character,
    status: "coming", floor: 0, deepest: 0, arrive: (state.run.gameMinutes || 0) + randomInt(2 * DAY_MINUTES),
    gold: 0, finds: [], kit, purse: 5 + randomInt(20),
    goal: vessel ? Infinity : 40 + randomInt(80), hoursOnFloor: 0, lastMeal: state.run.gameMinutes || 0, hungry: 0,
    value: 0, known: 0, greeted: false, delves: 0, banked: 0, vessel, said: {},
    // How much they'll risk: careful ones turn back early, reckless ones go deep and stay late.
    nerve: vessel ? "steady" : delverWeighted({ careful: 30, steady: 45, reckless: 25 })
  };
  delver.hp = delverStats(delver).maxHp;
  book.list.push(delver);
  return delver;
}

// What a delver can do at their level and in their gear.
function delverStats(delver) {
  const derived = deriveCharacter(delver.character, delver.level);
  const bonus = derived.damageBonus;
  return { maxHp: derived.maxHp, ac: derived.ac, attackBonus: derived.attackBonus,
    damage: `${derived.damageDice || "1d6"}${bonus > 0 ? `+${bonus}` : bonus < 0 ? `${bonus}` : ""}`,
    power: delver.level + Math.max(0, derived.attackBonus - (2 + Math.floor((delver.level - 1) / 4)) - 2) / 2 };
}

function delverPeople(delver) {
  return DELVER_DATA.cultures[delver.culture] || DELVER_DATA.cultures.nahua;
}

function delverWho(delver) {
  if (delver.lord) return `${delver.name}, ${DELVER_DATA.lord.title}`;
  const people = delverPeople(delver);
  const from = delver.from ||= delverPick(people.from);
  const calling = CLASSES[delver.cls]?.name || delver.cls;
  return people.foreign ? `${delver.name}, ${from}, a level ${delver.level} ${calling.toLowerCase()}`
    : `${delver.name}, a level ${delver.level} ${people.people} ${calling.toLowerCase()} ${from}`;
}

// A line of theirs for the moment (`kind` from the culture's lines), not repeated back to back.
function delverLine(delver, kind) {
  const pool = (delver.vessel && DELVER_DATA.avatar.lines[kind]) || delverPeople(delver).lines[kind] || [];
  if (!pool.length) return "";
  const options = pool.length > 1 ? pool.filter((line) => line !== delver.said[kind]) : pool;
  const line = delverPick(options);
  delver.said[kind] = line;
  return line;
}

function delverSay(delver, entity, kind) {
  const line = delverLine(delver, kind);
  if (line && (!entity || playerSees(entity))) addLog(`${delver.name}: “${line}”`);
}

// ---------- The beginning of the world ----------

// A new game (or a save from before the other delvers): Tenoch on his throne, a couple of
// delvers already down, one on the road.
function delversSeed() {
  const book = state.run.delvers;
  const floor13 = delverFloorData(DUNGEON_FLOOR_COUNT);
  const spiritSlain = Boolean(floor13 && (floor13.enemies || []).some((enemy) => enemy.templateId === "tzitzimitl" && !enemy.alive));
  if (spiritSlain) book.throne.spirit = "slain";
  else delverCrownTenoch();
  for (let i = 0; i < 2; i += 1) {
    const delver = delverCreate({ level: 1 + randomInt(2) - 1 });
    delver.status = "delving";
    delver.floor = delver.deepest = Math.min(3, randomInt(delver.level + 1));
    delver.delves = 1;
  }
  delverCreate();
}

function delverCrownTenoch() {
  const book = state.run.delvers;
  const lord = DELVER_DATA.lord;
  const delver = {
    id: `d${book.nextId++}`, name: lord.name, culture: "nahua", cls: lord.class, gender: lord.gender, level: lord.level,
    xp: XP_THRESHOLDS[lord.level], status: "lord", lord: true, floor: DUNGEON_FLOOR_COUNT, deepest: DUNGEON_FLOOR_COUNT,
    character: { name: lord.name, gender: lord.gender, race: "human", heritage: "", class: lord.class, background: "noble",
      scores: { ...lord.scores }, baseScores: { ...lord.scores }, appearance: { ...lord.appearance },
      cosmetics: { ...lord.cosmetics, owned: [...lord.cosmetics.owned] }, equipment: { ...lord.equipment } },
    gold: 0, finds: [], kit: [], purse: 0, goal: Infinity, hoursOnFloor: 0, lastMeal: 0, hungry: 0,
    value: -1, known: 0, greeted: false, delves: 0, banked: 0, said: {}, healed: false
  };
  delver.hp = delverStats(delver).maxHp;
  book.list.push(delver);
  book.throne.lordId = delver.id;
  book.throne.regalia = "lord";
  return delver;
}

// ---------- Floors ----------

// The floor's arrays: the live ones for the floor you're on, a snapshot's for any other.
function delverFloorData(floor) {
  if (floor === state.run.dungeonFloor) return state.run;
  return state.run.dungeonFloors?.[String(floor)] || null;
}

// Is this delver on the floor you're standing on? Then they're a figure on the map.
function delverPresent(delver) {
  return state.run.location === "dungeon" && delver.floor === state.run.dungeonFloor &&
    (DELVER_IN_TOMB.has(delver.status) || delver.status === "lord");
}

function delverEntity(delver) {
  return state.run.enemies.find((enemy) => enemy.delverId === delver.id && enemy.alive) || null;
}

function delverOf(entity) {
  return entity?.delverId ? delverById(entity.delverId) : null;
}

// Somewhere to stand on a floor: a free floor square in a room, away from you.
function delverOpenSpot(data, near = null) {
  const free = (x, y) => data.terrain[tileIndex(x, y)] === "floor" &&
    !(data.enemies || []).some((enemy) => enemy.alive && enemy.x === x && enemy.y === y) &&
    !(state.run.player && data === state.run && state.run.player.x === x && state.run.player.y === y);
  if (near) {
    for (let r = 0; r <= 3; r += 1) {
      for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r && free(near.x + dx, near.y + dy)) return { x: near.x + dx, y: near.y + dy };
      }
    }
  }
  const rooms = shuffle([...(data.rooms || [])]);
  for (const room of rooms) {
    for (let tries = 0; tries < 12; tries += 1) {
      const x = room.mapX + randomInt(room.mapW) - 1;
      const y = room.mapY + randomInt(room.mapH) - 1;
      if (free(x, y) && (data !== state.run || distanceInSquares({ x, y }, state.run.player) >= gridReach(8))) return { x, y };
    }
  }
  return null;
}

function delverMaterialize(delver, spot = null) {
  if (delverEntity(delver)) return delverEntity(delver);
  const stats = delverStats(delver);
  let place = spot || (Number.isInteger(delver.x) && delverOpenSpot(state.run, { x: delver.x, y: delver.y })) || delverOpenSpot(state.run);
  if (!place) return null;
  const lord = delver.status === "lord";
  const entity = {
    id: `delver-${delver.id}`, delverId: delver.id, delver: true, templateId: "delver", friendly: !lord, lord,
    name: delver.name, lordTitle: lord ? DELVER_DATA.lord.title : "", x: place.x, y: place.y,
    hp: Math.max(1, Math.min(delver.hp, stats.maxHp)), maxHp: stats.maxHp, ac: stats.ac, attackBonus: stats.attackBonus, damage: stats.damage,
    alive: true, xp: lord ? DELVER_DATA.lord.xp : 0, edible: false, lootDropped: false, initiativeBonus: 2,
    roomIndex: roomIndexAt(place.x, place.y), description: lord ? DELVER_DATA.lord.description : delverWho(delver)
  };
  if (lord) Object.assign(entity, { guardian: true, greatGuardian: true, alerted: false });
  state.run.enemies.push(entity);
  delver.x = place.x;
  delver.y = place.y;
  return entity;
}

// Back into the record (their hit points and where they stood), and off the map.
function delverDematerialize(entity) {
  const delver = delverOf(entity);
  if (delver) {
    delver.hp = entity.hp;
    delver.x = entity.x;
    delver.y = entity.y;
  }
  state.run.enemies = state.run.enemies.filter((enemy) => enemy !== entity);
}

function delversDematerializeAll() {
  if (!state.run?.enemies) return;
  for (const entity of state.run.enemies.filter((enemy) => enemy.delver)) delverDematerialize(entity);
}

// Keeps the map and the records agreeing: the delvers on your floor are on the map, and no
// one else is. Catches up the hours that passed, and tells you the news in town.
function delversSync() {
  const book = delversState();
  if (!book) return;
  delversCatchUp();
  for (const entity of state.run.enemies.filter((enemy) => enemy.delver)) {
    const delver = delverOf(entity);
    if (!delver || !delverPresent(delver) || !entity.alive) delverDematerialize(entity);
    else { delver.hp = entity.hp; delver.x = entity.x; delver.y = entity.y; }
  }
  if (state.run.location === "dungeon") {
    if (state.run.dungeonFloor === DUNGEON_FLOOR_COUNT) delverThroneRoom();
    for (const delver of book.list) if (delverPresent(delver) && !delverEntity(delver)) delverMaterialize(delver, delver.lord ? delverThroneSpot() : null);
  }
  if (state.run.location !== "dungeon") delversTellNews();
}

// ---------- Time ----------

function delversCatchUp() {
  const book = state.run.delvers;
  const now = state.run.gameMinutes || 0;
  if (now - book.clock > DELVER_RULES.catchUpDays * DAY_MINUTES) book.clock = now - DELVER_RULES.catchUpDays * DAY_MINUTES;
  while (book.clock + DELVER_HOUR <= now) {
    book.clock += DELVER_HOUR;
    delversHour(book.clock);
  }
}

function delversHour(minute) {
  const book = state.run.delvers;
  // Each week the tomb draws a few more.
  if (minute - book.week >= 7 * DAY_MINUTES) {
    book.week += 7 * DAY_MINUTES;
    const inTomb = book.list.filter((delver) => DELVER_IN_TOMB.has(delver.status) || delver.status === "coming").length;
    let roll = Math.random() * 100;
    const [count] = DELVER_RULES.weeklyArrivals.find(([, chance]) => (roll -= chance) < 0) || [0];
    for (let i = 0; i < count && inTomb + i < DELVER_RULES.maxInTomb; i += 1) delverCreate();
  }
  // Her next vessel, a week after her lord fell.
  const throne = book.throne;
  if (throne.spirit === "emerged" && !throne.lordId && throne.nextVessel !== null && minute >= throne.nextVessel &&
    !book.list.some((delver) => delver.vessel && (DELVER_IN_TOMB.has(delver.status) || delver.status === "coming"))) {
    throne.nextVessel = null;
    const vessel = delverCreate({ culture: "nahua", cls: "paladin", gender: "man", vessel: true });
    vessel.arrive = minute + DAY_MINUTES;
  }
  for (const delver of book.list) {
    if (delver.status === "coming" && minute >= delver.arrive) delverEnters(delver, minute);
    else if (delver.status === "resting" && minute >= delver.nextDelve) delverWakes(delver, minute);
    else if (DELVER_IN_TOMB.has(delver.status)) {
      delverNeeds(delver, minute);
      if (!delverPresent(delver)) delverLivesHour(delver, minute);
    }
  }
}

// ---------- Coming and going ----------

function delverNews(text, minute = state.run.gameMinutes || 0) {
  const book = state.run.delvers;
  book.news.push({ text, minute });
  if (book.news.length > 20) book.news.shift();
}

// News reaches you in town, a little after it happens.
function delversTellNews() {
  const book = state.run.delvers;
  const now = state.run.gameMinutes || 0;
  const due = book.news.filter((entry) => entry.minute <= now);
  if (!due.length) return;
  book.news = book.news.filter((entry) => entry.minute > now);
  for (const entry of due.slice(-4)) addLog(`News in Chiltomatlan: ${entry.text}`);
}

function delverEnters(delver, minute) {
  delver.status = "delving";
  delver.floor = 1;
  delver.deepest = Math.max(delver.deepest, 1);
  delver.hoursOnFloor = 0;
  delver.delves += 1;
  delver.greeted = false;
  delver.lastMeal = minute;
  if (delver.vessel) delverNews(`a young paladin, ${delver.name}, came through town without stopping. He didn't look at the market or the inn, only at the tomb road.`, minute);
  else if (delver.delves > 1) delverNews(`${delver.name} has gone back down into the tomb, this time for more.`, minute);
  else delverNews(`${delverWho(delver)} came through town on the way to the tomb.`, minute);
  if (delverPresent(delver)) delverArrivesOnYourFloor(delver, "surface-entrance");
}

function delverWakes(delver, minute) {
  if (Math.random() < 0.7) {
    delver.status = "coming";
    delver.arrive = minute + randomInt(DAY_MINUTES);
    delver.goal = Math.round(Math.max(delver.goal, 40) * 1.8);
    for (const entry of DELVER_DATA.kit) delverAddTo(delver.kit, entry.id, Math.max(0, entry.min + randomInt(entry.max - entry.min + 1) - 1 - delverCount(delver.kit, entry.id)));
  } else {
    delver.status = "retired";
    delverNews(`${delver.name} won't be going back down. ${delverPeople(delver).foreign ? "They're going home." : "They've bought a house by the canal."}`, minute);
  }
}

// Out of the tomb with what they carry: the tomb remembers some of it.
function delverLeaves(delver, minute) {
  const value = delverCarriedValue(delver);
  if (typeof tombRemembersValue === "function") tombRemembersValue(value);
  delver.banked += Math.round(value);
  delverNews(`${delver.name} came up out of the tomb with ${formatCurrency(Math.round(value))} worth of treasure${delver.level > 1 ? `, level ${delver.level} now` : ""}.`, minute);
  delver.gold = 0;
  delver.finds = [];
  delver.status = "resting";
  delver.floor = 0;
  delver.hp = delverStats(delver).maxHp;
  delver.nextDelve = minute + (3 + randomInt(8)) * DAY_MINUTES;
}

// ---------- A delver's hour, away from you ----------

function delverCount(list, id) {
  return list.find((entry) => entry.id === id)?.quantity || 0;
}

function delverAddTo(list, id, quantity) {
  if (quantity <= 0) return;
  const entry = list.find((item) => item.id === id);
  if (entry) entry.quantity += quantity;
  else list.push({ id, quantity });
}

function delverTake(list, id) {
  const entry = list.find((item) => item.id === id && item.quantity > 0);
  if (!entry) return false;
  entry.quantity -= 1;
  if (!entry.quantity) list.splice(list.indexOf(entry), 1);
  return true;
}

// Meals from the pack they brought; medicine when they're hurt.
function delverNeeds(delver, minute) {
  if (minute - delver.lastMeal >= DELVER_RULES.mealHours * DELVER_HOUR) {
    delver.lastMeal = minute;
    const ate = ["ration", "tlaxcalli", "pinole"].some((id) => delverTake(delver.kit, id));
    delver.hungry = ate ? 0 : delver.hungry + 1;
  }
  const maxHp = delverStats(delver).maxHp;
  if (delver.hp < maxHp * 0.4 && delverCount(delver.kit, "healing-potion")) {
    delverTake(delver.kit, "healing-potion");
    delver.hp = Math.min(maxHp, delver.hp + rollDice("2d4+2").total);
    const entity = delverEntity(delver);
    if (entity) {
      entity.hp = delver.hp;
      reportAt(entity, `${delver.name} drinks a dose of medicine.`);
    }
  }
}

// The share of their hit points at which they turn for home.
function delverFleeAt(delver) {
  return { careful: 0.5, reckless: 0.2 }[delver.nerve] ?? DELVER_RULES.fleeAt;
}

// How brave a delver is about the next floor down.
function delverBoldness(delver) {
  return (delver.vessel ? 1 : 0) + (delver.nerve === "reckless" ? 2 : delver.nerve === "careful" ? -1 : 0) + (["barbarian", "paladin"].includes(delver.cls) ? 1 : 0) +
    (["norse", "otomi"].includes(delver.culture) ? 1 : 0) - (["wizard", "sorcerer"].includes(delver.cls) ? 1 : 0);
}

// Whether to go on, go down, or go home. Returns "stay", "down", or "up".
function delverDecide(delver) {
  const maxHp = delverStats(delver).maxHp;
  const share = delver.hp / maxHp;
  if (delver.status === "withdrawing") return "up";
  if (delver.vessel) {
    if (delver.floor >= DUNGEON_FLOOR_COUNT) return "stay";
    return share >= 0.6 && delver.hoursOnFloor >= 3 && delver.level + delverBoldness(delver) >= delver.floor + 1 ? "down" : "stay";
  }
  if ((share < delverFleeAt(delver) && !delverCount(delver.kit, "healing-potion")) || delver.hungry >= 3) return "home";
  if (delverCarriedValue(delver) >= delver.goal) return "home";
  // Ready for the next floor down: about as strong as its creatures, a little less if bold.
  const ready = delver.level + delverBoldness(delver) >= delver.floor && delver.floor < DUNGEON_FLOOR_COUNT - 1;
  if (delver.hoursOnFloor >= 4 + randomInt(6) && share >= 0.7 && ready) return "down";
  if (delver.hoursOnFloor >= 48) return "home";
  return "stay";
}

function delverTurnsHome(delver, entity = null) {
  if (delver.status === "withdrawing") return;
  delver.status = "withdrawing";
  delver.hoursOnFloor = 0;
  if (entity) delverSay(delver, entity, delver.hp / delverStats(delver).maxHp < delverFleeAt(delver) ? "flee" : "home");
}

function delverLivesHour(delver, minute) {
  delver.hoursOnFloor += 1;
  const floor = delver.floor;
  const hunger = typeof tombHunger === "function" ? tombHunger() : 0;
  const stats = delverStats(delver);
  // An encounter: something on this floor that wants them.
  if (Math.random() < DELVER_RULES.encounterPerHour * (1 + 0.5 * hunger)) {
    // Mostly what the floor usually holds; now and then something much worse.
    const hard = floor + randomInt(3) - 2 + (Math.random() < 0.08 ? 5 : 0) + (hunger >= 0.8 ? 1 : 0);
    const gap = hard - stats.power;
    // She keeps her vessel alive, mostly.
    const share = Math.max(0.02, Math.min(0.7, 0.06 + 0.09 * gap + Math.random() * 0.12)) * (delver.vessel ? 0.5 : 1);
    delver.hp -= Math.max(1, Math.round(stats.maxHp * share));
    if (delver.hp <= 0) {
      delverDies(delver, { minute, cause: delverFoeName(floor) });
      return;
    }
    delverGainsXp(delver, Math.round(20 * Math.pow(Math.max(1, hard), 1.6)) * (delver.vessel ? 2 : 1));
  } else {
    delver.hp = Math.min(stats.maxHp, delver.hp + Math.max(1, Math.round(stats.maxHp * DELVER_RULES.healPerHour)));
  }
  // Treasure: a real cache from the floor when there is one.
  if (delver.status === "delving" && Math.random() < DELVER_RULES.treasurePerHour) delverFindsTreasure(delver, floor);
  // A pious delver passing a shrine leaves copal.
  if (Math.random() < 0.04 && delverTake(delver.kit, "copal") && typeof tombGive === "function") tombGive("offeringPerPoint", 6);
  const choice = delverDecide(delver);
  if (choice === "home") delverTurnsHome(delver);
  else if (choice === "down") delverChangesFloor(delver, floor + 1, minute);
  else if (choice === "up" && delver.hoursOnFloor >= DELVER_RULES.climbHours) {
    if (floor <= 1) delverLeaves(delver, minute);
    else delverChangesFloor(delver, floor - 1, minute);
  }
}

// Something that lives on that floor, for the news.
function delverFoeName(floor) {
  const data = delverFloorData(floor);
  const foes = (data?.enemies || []).filter((enemy) => enemy.alive && !enemy.delver && !enemy.friendly &&
    (typeof ecoSpecies !== "function" || !ecoSpecies(enemy) || ["predator", "spirit", "guardian", "raider"].includes(ecoSpecies(enemy).role)));
  return foes.length ? delverPick(foes).name : "something in the dark";
}

function delverFindsTreasure(delver, floor) {
  const data = delverFloorData(floor);
  const caches = (data?.treasures || []).filter((cache) => !cache.dropped && !cache.mainGoal && (cache.gold > 0 || cache.items.length));
  if (caches.length && !(data === state.run && state.run.location === "dungeon")) {
    const cache = delverPick(caches);
    delver.gold += cache.gold;
    for (const item of cache.items) {
      delverAddTo(item.outside ? delver.kit : delver.finds, item.id, item.quantity);
      if (item.regalia) delversState().throne.regalia = "taken";
    }
    data.treasures.splice(data.treasures.indexOf(cache), 1);
  } else {
    delver.gold += (randomInt(8) + randomInt(8)) * Math.ceil(1 + (floor - 1) * 0.15);
    if (Math.random() < 0.3 && typeof rollTombFind === "function") {
      const find = rollTombFind(floor);
      if (find) delverAddTo(delver.finds, find, 1);
    }
  }
}

function delverGainsXp(delver, amount) {
  delver.xp += Math.round(amount);
  while (delver.level < MAX_LEVEL && delver.xp >= XP_THRESHOLDS[delver.level + 1]) {
    const before = delverStats(delver).maxHp;
    delver.level += 1;
    delver.hp += delverStats(delver).maxHp - before;
  }
}

function delverChangesFloor(delver, floor, minute) {
  const from = delver.floor;
  delver.floor = Math.max(1, Math.min(DUNGEON_FLOOR_COUNT, floor));
  delver.deepest = Math.max(delver.deepest, delver.floor);
  delver.hoursOnFloor = 0;
  delver.x = undefined;
  delver.y = undefined;
  // Her vessel, reaching the mouth.
  if (delver.vessel && delver.floor === DUNGEON_FLOOR_COUNT && !delverPresent(delver)) delverCrownVessel(delver);
  if (delverPresent(delver)) delverArrivesOnYourFloor(delver, floor > from ? `connection-${from}-` : `connection-${floor}-`, floor > from);
}

// Someone comes down (or up) the stairs onto your floor.
function delverArrivesOnYourFloor(delver, stairPrefix, fromAbove = true) {
  const stairs = state.run.floorStairs || [];
  const stair = stairs.find((entry) => entry.id === stairPrefix) ||
    stairs.find((entry) => entry.id.startsWith(stairPrefix) && (fromAbove ? entry.type !== "stairs-down" : entry.type === "stairs-down")) ||
    stairs[0];
  const entity = delverMaterialize(delver, stair ? delverOpenSpot(state.run, stair) : null);
  if (entity) reportAt(entity, `${delver.name} comes ${fromAbove ? "down" : "up"} the stairs.`, "Footsteps on the stairs.");
}

// ---------- A delver's turn, on your floor ----------

// Is this creature after delvers? Hunters when hungry, anything hostile, the dead when they
// hunger, guardians; and anything a delver has attacked.
function creatureHostileToDelver(creature) {
  if (!creature?.alive || creature.friendly || creature.delver) return false;
  const species = typeof ecoSpecies === "function" ? ecoSpecies(creature) : null;
  if (!species) return true;
  const hunger = typeof ecoHungerState === "function" ? ecoHungerState(creature) : "fed";
  if (species.temperament === "hostile") return species.role !== "spirit" || ["hungry", "starving"].includes(hunger);
  if (species.role === "predator") return ["hungry", "starving"].includes(hunger);
  return false;
}

function delverFoes(entity) {
  return state.run.enemies.filter((creature) => creature.alive && !creature.delver && !creature.friendly &&
    distanceInSquares(creature, entity) <= gridReach(6) && hasLineOfSight(creature, entity) &&
    (creature.delverFoe === entity.id || (creature.lord ? false : creatureHostileToDelver(creature) && distanceInSquares(creature, entity) <= gridReach(4))));
}

function delverStepAwayFrom(entity, from) {
  let best = null;
  let bestDistance = distanceInSquares(entity, from);
  for (const direction of shuffle(MOVEMENT_DIRECTIONS)) {
    const spot = { x: entity.x + direction.x, y: entity.y + direction.y };
    if (!canStepBetween(entity, spot) || tileHasCreature(spot.x, spot.y, entity) ||
      (spot.x === state.run.player.x && spot.y === state.run.player.y)) continue;
    const distance = distanceInSquares(spot, from);
    if (distance > bestDistance) { best = spot; bestDistance = distance; }
  }
  return best;
}

// A delver strikes a creature.
function delverStrikes(entity, creature) {
  const delver = delverOf(entity);
  const die = randomInt(20);
  const total = die + entity.attackBonus;
  creature.delverFoe = entity.id;
  if (die === 20 || (die !== 1 && total >= (typeof creatureArmorClass === "function" ? creatureArmorClass(creature) : creature.ac))) {
    const damage = Math.max(1, rollDice(entity.damage).total * (die === 20 ? 2 : 1));
    creature.hp = Math.max(0, creature.hp - damage);
    reportAt(creature, `${entity.name} hits ${creature.name} for ${damage} damage.`, "Somewhere close, someone is fighting.");
    if (playerSees(creature)) showCombatFeedback("hit", `−${damage} HP`, { actor: "enemy", x: creature.x, y: creature.y, enemyId: creature.id });
    if (creature.hp <= 0) {
      creature.alive = false;
      creature.lootDropped = true;
      reportAt(creature, `${entity.name} kills ${creature.name}.`);
      if (typeof ecologyCreatureDied === "function") ecologyCreatureDied(creature, { killer: entity });
      if (delver) delverGainsXp(delver, creature.xp || 10);
      if (creature.templateId === "tzitzimitl" && typeof delverSpiritSlain === "function") delverSpiritSlain();
    }
  } else {
    reportAt(creature, `${entity.name} swings at ${creature.name} and misses.`);
  }
}

// A creature strikes a delver.
function creatureStrikesDelver(creature, entity) {
  const delver = delverOf(entity);
  const die = randomInt(20);
  const total = die + (creature.attackBonus || 0);
  creature.delverFoe = entity.id;
  if (die === 20 || (die !== 1 && total >= entity.ac)) {
    const damage = Math.max(1, rollDice(creature.damage || "1d6").total);
    entity.hp = Math.max(0, entity.hp - damage);
    reportAt(entity, `${creature.name} hits ${entity.name} for ${damage} damage.`, "Somewhere close, someone cries out.");
    if (playerSees(entity)) showCombatFeedback("hit", `−${damage} HP`, { actor: "enemy", x: entity.x, y: entity.y, enemyId: entity.id });
    if (delver) delver.hp = entity.hp;
    if (entity.hp <= 0 && delver) delverDies(delver, { entity, cause: creature.name });
  } else {
    reportAt(entity, `${creature.name} misses ${entity.name}.`);
  }
}

// In the creatures' turn: something with a delver as its foe goes for them (unless it's
// busy with you). Returns true if it used its turn.
function creatureFightsDelver(creature, distanceToYou) {
  if (creature.delver || creature.friendly || !creature.alive) return false;
  if (creature.alerted && distanceToYou <= 6) return false;
  let foe = creature.delverFoe ? state.run.enemies.find((entity) => entity.id === creature.delverFoe && entity.alive) : null;
  if (!foe && creatureHostileToDelver(creature)) {
    const range = (typeof creatureNoticeRange === "function" ? creatureNoticeRange(creature) : 5);
    foe = state.run.enemies.filter((entity) => entity.delver && entity.friendly && entity.alive &&
      distanceInSquares(entity, creature) <= range && hasLineOfSight(entity, creature))
      .sort((a, b) => distanceInSquares(a, creature) - distanceInSquares(b, creature))[0] || null;
    if (foe) creature.delverFoe = foe.id;
  }
  if (!foe || distanceInSquares(foe, creature) > gridReach(8)) {
    if (creature.delverFoe && !foe) creature.delverFoe = null;
    return false;
  }
  if (distanceInSquares(foe, creature) <= 1) creatureStrikesDelver(creature, foe);
  else moveCreature(creature, creatureStepToward(creature, foe, { adjacent: true }));
  return true;
}

function delverStair(entity, direction) {
  const delver = delverOf(entity);
  const stairs = state.run.floorStairs || [];
  if (direction === "up") {
    return stairs.filter((stair) => stair.type === "stairs-up" || stair.role === "entrance")
      .sort((a, b) => distanceInSquares(a, entity) - distanceInSquares(b, entity))[0] || null;
  }
  return stairs.filter((stair) => stair.type === "stairs-down" && stair.targetFloor === delver.floor + 1)
    .sort((a, b) => distanceInSquares(a, entity) - distanceInSquares(b, entity))[0] || null;
}

// One turn of a delver who shares your floor.
function delverAct(entity) {
  const delver = delverOf(entity);
  if (!delver) {
    entity.alive = false;
    return;
  }
  delver.hp = entity.hp;
  const turns = (delver.turnsHere = (delver.turnsHere || 0) + 1);
  if (turns % 6 === 0) delver.hoursOnFloor += 1;
  const share = entity.hp / entity.maxHp;
  // Seeing you.
  if (playerSees(entity) && distanceInSquares(entity, state.run.player) <= gridReach(6)) {
    if (!delver.greeted) {
      delver.greeted = true;
      delverSay(delver, entity, delver.known > 0 ? "again" : "greet");
      delver.known = Math.min(1, delver.known + 0.3);
    } else if (typeof tombHunger === "function" && tombHunger() >= 0.5 && !delver.warned) {
      delver.warned = true;
      delverSay(delver, entity, "hungry");
    }
  }
  // Her vessel goes to her.
  const spirit = delver.vessel && delver.floor === DUNGEON_FLOOR_COUNT
    ? state.run.enemies.find((enemy) => enemy.alive && enemy.templateId === "tzitzimitl") : null;
  if (spirit) {
    if (distanceInSquares(entity, spirit) <= 1) {
      delverCrownVessel(delver, entity, spirit);
      return;
    }
    moveCreature(entity, creatureStepToward(entity, spirit, { adjacent: true }));
    return;
  }
  // Danger first: fight what's on them, or run from it.
  const foes = delverFoes(entity).sort((a, b) => distanceInSquares(a, entity) - distanceInSquares(b, entity));
  if (foes.length) {
    const foe = foes[0];
    const close = distanceInSquares(foe, entity);
    if (share < delverFleeAt(delver) && !delver.vessel) {
      if (delver.status !== "withdrawing") delverTurnsHome(delver, entity);
      const away = delverStepAwayFrom(entity, foe);
      if (away) {
        moveCreature(entity, away);
        return;
      }
    }
    if (close <= 1) {
      if (!delver.fighting) {
        delver.fighting = true;
        delverSay(delver, entity, "fight");
      }
      delverStrikes(entity, foe);
      return;
    }
    if (close <= 3) {
      moveCreature(entity, creatureStepToward(entity, foe, { adjacent: true }));
      return;
    }
  }
  delver.fighting = false;
  // Treasure in sight.
  if (delver.status === "delving") {
    const here = state.run.treasures.find((cache) => cache.x === entity.x && cache.y === entity.y && !cache.dropped && !cache.mainGoal);
    if (here) {
      delverTakesCache(delver, entity, here);
      return;
    }
    const cache = state.run.treasures.filter((entry) => !entry.dropped && !entry.mainGoal && distanceInSquares(entry, entity) <= gridReach(7) &&
      hasLineOfSight(entity, entry) && !(entry.x === state.run.player.x && entry.y === state.run.player.y))
      .sort((a, b) => distanceInSquares(a, entity) - distanceInSquares(b, entity))[0];
    if (cache) {
      const step = creatureStepToward(entity, cache);
      if (step) {
        moveCreature(entity, step);
        return;
      }
    }
  }
  // Where they're going.
  if (turns % 6 === 0) {
    const choice = delverDecide(delver);
    if (choice === "home") delverTurnsHome(delver, entity);
    else if (choice === "down" && delver.plan !== "down") {
      delver.plan = "down";
      delverSay(delver, entity, "down");
    }
  }
  const direction = delver.status === "withdrawing" ? "up" : delver.plan === "down" ? "down" : null;
  const stair = direction ? delverStair(entity, direction) : null;
  if (stair) {
    if (entity.x === stair.x && entity.y === stair.y) {
      delverTakesStair(delver, entity, stair, direction);
      return;
    }
    const step = creatureStepToward(entity, stair);
    if (step) {
      moveCreature(entity, step);
      return;
    }
  }
  // Otherwise, exploring: toward a room they haven't looked at yet.
  if (!delver.wander || distanceInSquares(entity, delver.wander) <= 1 || Math.random() < 0.03) {
    const room = delverPick(state.run.rooms);
    delver.wander = room ? { x: room.anchorX ?? room.mapX + Math.floor(room.mapW / 2), y: room.anchorY ?? room.mapY + Math.floor(room.mapH / 2) } : null;
  }
  if (delver.wander && Math.random() < 0.8) moveCreature(entity, creatureStepToward(entity, delver.wander, { adjacent: true }));
}

function delverTakesCache(delver, entity, cache) {
  delver.gold += cache.gold;
  for (const item of cache.items) {
    delverAddTo(item.outside ? delver.kit : delver.finds, item.id, item.quantity);
    if (item.regalia) delversState().throne.regalia = "taken";
  }
  state.run.treasures = state.run.treasures.filter((entry) => entry !== cache);
  if (playerSees(entity)) {
    addLog(`${delver.name} takes the treasure there${cache.gold ? ` (${formatCurrency(cache.gold)})` : ""}.`);
    delverSay(delver, entity, "loot");
  }
}

function delverTakesStair(delver, entity, stair, direction) {
  const seen = playerSees(entity);
  delverDematerialize(entity);
  delver.plan = null;
  delver.turnsHere = 0;
  if (direction === "up" && (stair.role === "entrance" || delver.floor <= 1)) {
    if (seen) addLog(`${delver.name} climbs out toward the surface.`);
    delverLeaves(delver, state.run.gameMinutes || 0);
    return;
  }
  if (seen) addLog(`${delver.name} takes the stairs ${direction}.`);
  delverChangesFloor(delver, delver.floor + (direction === "up" ? -1 : 1), state.run.gameMinutes || 0);
}

// ---------- Death ----------

// A delver dies: their body and everything they carried stay on that floor, and go back to
// the tomb. What they brought from outside lies with them.
function delverDies(delver, { entity = null, minute = state.run.gameMinutes || 0, cause = "" } = {}) {
  const floor = delver.floor;
  const data = delverFloorData(floor);
  const place = entity ? { x: entity.x, y: entity.y } : data ? delverOpenSpot(data) : null;
  if (entity) {
    if (playerSees(entity)) {
      const last = delverLine(delver, "dying");
      addLog(`${delver.name} falls.${last ? ` “${last}”` : ""}`);
    } else reportAt(entity, "", "Somewhere close, someone cries out, and then is quiet.");
    entity.alive = false;
    state.run.enemies = state.run.enemies.filter((enemy) => enemy !== entity);
  }
  if (data && place) {
    const items = [...delver.finds.map((item) => ({ ...item })), ...delver.kit.map((item) => ({ ...item, outside: true }))];
    const gear = [`weapon:${delver.character.equipment.weapon}`, delver.character.equipment.armor !== "none" ? `armor:${delver.character.equipment.armor}` : null]
      .filter((id) => id && itemDetails(id));
    for (const id of gear) items.push({ id, quantity: 1, outside: !delver.lord });
    data.treasures ||= [];
    data.treasures.push({ id: `remains-${delver.id}`, x: place.x, y: place.y, gold: Math.round(delver.gold + delver.purse), items, remains: delver.name,
      remainsOf: delver.lord ? DELVER_DATA.lord.title : delverWho(delver) });
  }
  if (typeof tombGive === "function") tombGive("fallen");
  delver.status = "dead";
  delver.hp = 0;
  delver.diedOn = floor;
  delver.cause = cause;
  delver.gold = 0;
  delver.finds = [];
  if (!delver.lord) delverNews(`${delver.name} went down into the tomb and hasn't come back.`, minute + 3 * DAY_MINUTES);
  if (delver.vessel) {
    const throne = delversState().throne;
    if (throne.spirit === "emerged" && !throne.lordId) throne.nextVessel = minute + 7 * DAY_MINUTES;
  }
}

// You found what's left of someone.
function delverRemainsFound(cache) {
  if (!cache?.remains || cache.remainsNoted) return;
  cache.remainsNoted = true;
  addLog(`These are the things of ${cache.remainsOf || cache.remains}, who died here.`);
}

// What a delver carries that came out of the tomb (the tomb feels it).
function delverCarriedValue(delver) {
  let value = delver.gold || 0;
  for (const item of delver.finds || []) value += Math.min(60, (itemDetails(item.id)?.price || 0) * 0.5) * item.quantity;
  return value;
}

function delversCarried() {
  const book = state.run?.delvers;
  if (!book) return 0;
  return book.list.filter((delver) => DELVER_IN_TOMB.has(delver.status)).reduce((sum, delver) => sum + delverCarriedValue(delver), 0) * 0.5;
}

// ---------- The Lord of the Mouth ----------

function delverLord() {
  const book = delversState();
  return book?.throne.lordId ? delverById(book.throne.lordId) : null;
}

// Where the lord stands: where the Tzitzimitl was bound, in the chamber of the mouth.
function delverThroneSpot() {
  const book = delversState();
  if (book.throne.spot) return book.throne.spot;
  const room = state.run.rooms.find((entry) => entry.type === "boss") || state.run.rooms[state.run.rooms.length - 1];
  return room ? { x: room.anchorX ?? room.mapX + Math.floor(room.mapW / 2), y: room.anchorY ?? room.mapY + Math.floor(room.mapH / 2) } : null;
}

// On floor 13, while a lord lives, she is in him: the Tzitzimitl isn't on the map.
function delverThroneRoom() {
  const book = delversState();
  const bound = state.run.enemies.filter((enemy) => enemy.templateId === "tzitzimitl" && enemy.alive && !enemy.emerged);
  if (!bound.length) return;
  book.throne.spot ||= { x: bound[0].x, y: bound[0].y };
  if (book.throne.lordId) state.run.enemies = state.run.enemies.filter((enemy) => !bound.includes(enemy));
}

// The lord's turn, before his habits: once, when badly hurt, he heals himself; and his blows
// carry her cold (smites). Returns true if it used the turn.
function delverLordTurn(entity, distance) {
  const delver = delverOf(entity);
  if (!delver) return false;
  delver.hp = entity.hp;
  if (!delver.greeted && distance <= 6 && playerSees(entity)) {
    delver.greeted = true;
    addLog(`${entity.name}: ${DELVER_DATA.lord.lines.greet}`);
  }
  if (!delver.healed && entity.hp < entity.maxHp * 0.4) {
    delver.healed = true;
    const healed = Math.min(entity.maxHp - entity.hp, 60);
    entity.hp += healed;
    delver.hp = entity.hp;
    reportAt(entity, `${DELVER_DATA.lord.lines.heal} (+${healed} HP)`);
    if (playerSees(entity)) showCombatFeedback("heal", `+${healed} HP`, { actor: "enemy", x: entity.x, y: entity.y, enemyId: entity.id });
    return true;
  }
  if (distance === 1 && entity.alerted && randomInt(3) === 1) {
    const plain = entity.damage;
    const dice = DICE_PATTERN.exec(plain);
    entity.damage = dice ? `${Number(dice[1]) + 2}d${dice[2]}${dice[3] || ""}` : plain;
    addLog(`${entity.name}'s macuahuitl burns with starless cold.`);
    enemyAttack(entity);
    entity.damage = plain;
    return true;
  }
  return false;
}

// The lord is defeated: she comes out of him.
function delverLordFalls(entity, delver) {
  const book = delversState();
  const lines = DELVER_DATA.lord.lines;
  addLog(delver.name === DELVER_DATA.lord.name ? lines.fall : `${delver.name} falls. The Tzitzimitl pulls herself out of him and rises over the mouth.`);
  book.throne.lordId = null;
  book.throne.spirit = "emerged";
  book.throne.nextVessel = (state.run.gameMinutes || 0) + 7 * DAY_MINUTES;
  book.throne.regalia = "floor";
  const template = state.pack.enemies.find((enemy) => enemy.id === "tzitzimitl");
  if (template && state.run.dungeonFloor === delver.floor) {
    const spot = delverOpenSpot(state.run, { x: entity.x, y: entity.y }) || { x: entity.x, y: entity.y };
    const spirit = {
      id: `tzitzimitl-${Date.now().toString(36)}`, templateId: "tzitzimitl", sprite: template.sprite, name: template.name,
      description: `${template.description || ""}${template.gear ? ` Gear: ${template.gear}.` : ""}`,
      x: spot.x, y: spot.y, hp: template.hp, maxHp: template.hp, ac: template.ac, attackBonus: template.attackBonus, damage: template.damage,
      initiativeBonus: template.initiativeBonus || 0, xp: template.xp, edible: false, lootDropped: false, alive: true,
      alerted: true, guardian: true, greatGuardian: true, emerged: true, roomIndex: roomIndexAt(spot.x, spot.y),
      inflicts: PROGRESSION.creatureConditions.tzitzimitl ? { ...PROGRESSION.creatureConditions.tzitzimitl } : undefined
    };
    if (typeof growCreature === "function") growCreature(spirit, DUNGEON_FLOOR_COUNT);
    if (typeof ecoCreature === "function") ecoCreature(spirit);
    state.run.enemies.push(spirit);
    if (state.run.rooms[spirit.roomIndex]) state.run.rooms[spirit.roomIndex].optionalQuest = true;
    showCombatFeedback("defeat", `${delver.name} falls`, { actor: "enemy", x: entity.x, y: entity.y, enemyId: entity.id });
  }
}

// A delver's figure is defeated (only the lord can be fought).
function delverDefeated(entity) {
  const delver = delverOf(entity);
  entity.alive = false;
  if (!delver) return;
  if (delver.status === "lord") {
    addExperience(entity.xp || 0);
    delverDies(delver, { entity, cause: "you" });
    delverLordFalls(entity, delver);
    return;
  }
  delverDies(delver, { entity, cause: "you" });
}

// The Tzitzimitl herself is destroyed. Nothing more comes down to be her lord.
function delverSpiritSlain() {
  const book = delversState();
  if (!book) return;
  book.throne.spirit = "slain";
  book.throne.nextVessel = null;
  for (const delver of book.list) if (delver.vessel) delver.vessel = false;
}

// Her vessel reaches her and becomes the lord.
function delverCrownVessel(delver, entity = null, spirit = null) {
  const book = delversState();
  if (book.throne.spirit !== "emerged" || book.throne.lordId) {
    delver.vessel = false;
    return;
  }
  const data = delverFloorData(DUNGEON_FLOOR_COUNT);
  const bound = spirit || (data?.enemies || []).find((enemy) => enemy.templateId === "tzitzimitl" && enemy.alive);
  if (bound) {
    book.throne.spot = { x: bound.x, y: bound.y };
    if (data) data.enemies = data.enemies.filter((enemy) => enemy !== bound);
  }
  if (book.throne.regalia === "floor" && data) {
    const regalia = (data.treasures || []).filter((cache) => cache.items.some((item) => String(item.id).includes("--lordly")));
    if (regalia.length) {
      delver.character.equipment.weapon = "macuahuitl--lordly";
      delver.character.equipment.armor = "jade-cuirass--lordly";
      for (const cache of regalia) cache.items = cache.items.filter((item) => !String(item.id).includes("--lordly"));
      data.treasures = data.treasures.filter((cache) => cache.gold > 0 || cache.items.length);
      book.throne.regalia = "lord";
    }
  }
  delver.character.cosmetics = { owned: ["tzitzimitl-helmet", "tzitzimitl-clothes"], helmet: "tzitzimitl-helmet", clothes: "tzitzimitl-clothes" };
  delver.character.equipment.shield = true;
  delver.status = "lord";
  delver.lord = true;
  delver.vessel = false;
  delver.healed = false;
  delver.greeted = false;
  delver.hp = delverStats(delver).maxHp;
  book.throne.lordId = delver.id;
  book.throne.spirit = "bound";
  const text = DELVER_DATA.avatar.lines.crowned.replace("{0}", delver.name);
  if (entity) {
    reportAt(entity, text);
    delverDematerialize(entity);
    delverMaterialize(delver, book.throne.spot);
  }
}

// ---------- You and them ----------

// The talk action (on the interact button; walking into a delver trades places instead).
function talkToDelver(entity) {
  const delver = delverOf(entity);
  if (!delver) return;
  delver.known = Math.min(1, delver.known + 0.2);
  const line = delverLine(delver, "talk");
  const where = delver.status === "withdrawing" ? "I'm on my way up." : delver.deepest > delver.floor ? `I've been as deep as floor ${delver.deepest}.` : "";
  const hurt = entity.hp < entity.maxHp * 0.5 ? " I'm hurt, though." : "";
  showRpgMessage(delverWho(delver), `“${line}${where ? ` ${where}` : ""}${hurt}”`);
  finishPlayerTurn();
}

function delverInteractions() {
  if (state.run?.location !== "dungeon") return [];
  return state.run.enemies.filter((enemy) => enemy.delver && enemy.friendly && enemy.alive && distanceInSquares(enemy, state.run.player) === 1)
    .map((entity) => ({ label: `Talk to ${entity.name}`, action: () => talkToDelver(entity), group: "explore" }));
}

// The figure: a delver is drawn the way you are.
function delverCharacterOf(entity) {
  return delverOf(entity)?.character || null;
}

function creatureSprite(enemy, className) {
  const character = enemy?.delver ? delverCharacterOf(enemy) : null;
  if (character) {
    const facing = state.run.player && state.run.player.x < enemy.x ? "southwest" : "southeast";
    return createCodexCharacterSprite(character, className, facing);
  }
  return createSprite(enemySpriteId(enemy), className);
}

// Changes when the figure does, including when its paintings finish loading.
function creatureSpriteKey(enemy) {
  if (!enemy?.delver) return enemySpriteId(enemy);
  const facing = state.run.player && state.run.player.x < enemy.x ? "southwest" : "southeast";
  return `delver:${enemy.delverId}:${codexFigureUrl(delverCharacterOf(enemy) || {}, facing).length}`;
}

// What the target frame and inspect panel say about a delver.
function delverMood(entity) {
  const delver = delverOf(entity);
  if (!delver) return "";
  if (delver.status === "lord") return "lord of the mouth";
  if (delver.vessel) return "called below";
  if (delver.fighting) return "fighting";
  if (delver.status === "withdrawing") return "heading home";
  return delver.plan === "down" ? "going deeper" : "delving";
}

function delverDescription(entity) {
  const delver = delverOf(entity);
  if (!delver) return "";
  if (delver.status === "lord") return DELVER_DATA.lord.description;
  const parts = [`${delverWho(delver)}.`];
  if (delver.vessel) parts.push("He walks like someone being called.");
  parts.push(delver.status === "withdrawing" ? "On the way out." : `Down here for gold${Number.isFinite(delver.goal) ? `; says they'll go home with about ${formatCurrency(delver.goal)}` : ""}.`);
  if (delver.deepest > 1) parts.push(`Has been as deep as floor ${delver.deepest}.`);
  const nerve = { careful: "Careful; turns back early.", reckless: "Takes chances." }[delver.nerve];
  if (nerve) parts.push(nerve);
  parts.push("Walk into them to talk.");
  return parts.join(" ");
}

// ---------- Saving ----------

// Delvers' figures are rebuilt from their records, so saves never keep them on the map.
function normalizeDelvers(saved) {
  if (Array.isArray(saved.enemies)) saved.enemies = saved.enemies.filter((enemy) => !enemy?.delver);
  const book = saved.delvers;
  if (book === undefined) return;
  if (!book || typeof book !== "object" || !Array.isArray(book.list) || book.list.length > 400 || !book.throne) {
    delete saved.delvers;
    return;
  }
  book.list = book.list.filter((delver) => delver && typeof delver.id === "string" && delver.character && CLASSES[delver.cls] &&
    Number.isInteger(delver.level) && delver.level >= 1 && delver.level <= 20);
  for (const delver of book.list) {
    if (delver.goal === null) delver.goal = Infinity;
    delver.kit = Array.isArray(delver.kit) ? delver.kit.filter((item) => item && itemDetails(item.id)) : [];
    delver.finds = Array.isArray(delver.finds) ? delver.finds.filter((item) => item && itemDetails(item.id)) : [];
    delver.said ||= {};
  }
  if (!Number.isFinite(book.clock)) book.clock = saved.gameMinutes || 0;
  if (!Number.isFinite(book.week)) book.week = saved.gameMinutes || 0;
  if (!Array.isArray(book.news)) book.news = [];
  const loot = saved.unsecuredLoot;
  if (loot && (typeof loot.foreign !== "object" || Array.isArray(loot.foreign) || loot.foreign === null)) delete loot.foreign;
}

// You picked up something a delver brought from outside: the tomb never had it.
function delverMarkOutside(id, quantity) {
  const loot = state.run.unsecuredLoot;
  if (!loot || quantity <= 0) return;
  loot.foreign ||= {};
  loot.foreign[id] = (loot.foreign[id] || 0) + quantity;
}
