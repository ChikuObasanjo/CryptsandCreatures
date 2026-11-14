"use strict";

// Treasure as part of the living tomb (data/riches.js has the why and the who).
//
// Four simple rules, each run once an hour (on the floor you're on and, in larger steps,
// on the floors you aren't), make where treasure is something you can learn to read:
//
//   1. The earth gives back. Now and then the ground pushes up something it swallowed long
//      ago: in the mouths of the living rock, the hot vents, and the low wet places most of
//      all. The nearer the mouth, the more often (as much more as life is: mouthShare).
//   2. The carriers take it home. A creature whose kind picks up treasure (data/riches.js:
//      carriers) and isn't busy eating takes one thing at a time to where it keeps things:
//      a mapachin to its den, an axolocatl to its pool, the dead to the nearest shrine. A
//      xolotl hound carries what it finds up the stairs toward the light.
//   3. Everything climbs. A hoard that grows past what its keeper holds sends the extra up
//      a floor; whatever reaches the first floor goes out through the broken seal into
//      Chiltomatlan, with the life. So the deep is richest, and the upper floors are fed by
//      what climbs, in the dens and shrines.
//   4. The earth takes back. Something that lies where it came up, with nobody to carry it,
//      sinks again after a few days, and a hungry mouth takes it sooner.
//
// So: shrines collect offerings, dens and pools collect what their keepers love, and you can
// follow a carrier home. Taking a keeper's things makes it angry; taking a shrine's
// offerings angers the dead and the tomb, unless you fed the bowl first (a fair exchange).

const RICHES = window.CryptsRiches || { earthGiven: {}, kinds: {}, carriers: {}, cherish: {} };
const RICHES_RISE_PER_HOUR = 0.024;    // the ground gives something back, on floor 1 (× mouthShare)
const RICHES_EARTH_KEEPS_DAYS = 4;     // loose things lie this long before the earth takes them back
const RICHES_SHRINE_HOLDS = 8;         // things a shrine's offerings can hold
const RICHES_CLIMB_PER_HOUR = 0.04;    // chance an hour that a full hoard sends one thing up
const RICHES_ITEM_CHANCE = 0.6;        // what comes up is a thing (else only gold)

function richesBook() {
  const book = typeof lawBook === "function" ? lawBook() : null;
  if (!book) return null;
  if (!book.riches || typeof book.riches !== "object" || Array.isArray(book.riches)) book.riches = {};
  if (!Number.isFinite(book.richesSurfaced)) book.richesSurfaced = 0;
  return book;
}

// ---------- What things are ----------

const richesKindIndex = new Map();
function richesKindsOf(itemId) {
  if (!richesKindIndex.size) {
    for (const [kind, ids] of Object.entries(RICHES.kinds)) for (const id of ids) {
      if (!richesKindIndex.has(id)) richesKindIndex.set(id, []);
      richesKindIndex.get(id).push(kind);
    }
  }
  return richesKindIndex.get(itemId) || [];
}

function richesCarrier(creature) {
  if (!creature?.alive || creature.friendly || creature.guardian || creature.delver) return null;
  return RICHES.carriers[creature.templateId] || null;
}

function richesTakesItem(carrier, itemId) {
  if (!carrier) return false;
  if (carrier.takes === "any") return itemDetails(itemId)?.category === "Treasure";
  return richesKindsOf(itemId).some((kind) => carrier.takes.includes(kind));
}

function richesTakesGold(carrier) {
  return Boolean(carrier) && (carrier.takes === "any" || carrier.takes.includes("gold"));
}

// Can a carrier pick something out of this cache? Only what lies loose (what the earth gave
// up, what a creature dropped, what an owner left behind), never what was stored, offered,
// or guarded, or anything you set down yourself.
function richesLoose(cache) {
  return Boolean(cache && (cache.earth || cache.loose) && !cache.dropped && !cache.mainGoal && !cache.remains);
}

// The one thing a carrier would take from a cache, or null.
function richesPick(carrier, cache) {
  if (!richesLoose(cache)) return null;
  const item = cache.items.find((entry) => entry.quantity > 0 && richesTakesItem(carrier, entry.id));
  if (item) return { item: item.id };
  if (cache.gold > 0 && richesTakesGold(carrier)) return { gold: cache.gold };
  return null;
}

function richesTake(creature, cache, pick) {
  const carried = creature.carrying = creature.carrying || { gold: 0, items: [] };
  if (pick.item) {
    const entry = cache.items.find((item) => item.id === pick.item);
    entry.quantity -= 1;
    cache.items = cache.items.filter((item) => item.quantity > 0);
    const held = carried.items.find((item) => item.id === pick.item);
    if (held) held.quantity += 1;
    else carried.items.push({ id: pick.item, quantity: 1 });
  } else {
    carried.gold = roundGold((carried.gold || 0) + cache.gold);
    cache.gold = 0;
  }
  if (!cache.items.length && !(cache.gold > 0)) state.run.treasures = state.run.treasures.filter((entry) => entry !== cache);
}

function richesCarrying(creature) {
  const carried = creature?.carrying;
  return Boolean(carried && ((carried.gold || 0) > 0 || carried.items?.length));
}

function richesPacketWorth(packet) {
  return (packet.gold || 0) + (packet.items || []).reduce((sum, item) => sum + (itemDetails(item.id)?.price || 0) * (item.quantity || 1), 0);
}

function richesPacketName(packet) {
  const item = packet.items?.[0];
  return item ? itemDetails(item.id)?.name || "something" : formatCurrency(packet.gold || 0);
}

// ---------- 1. The earth gives back ----------

// What the ground gives up on a floor: gold, and half the time a thing (deeper, older things
// only come up near the mouth).
function richesEarthPacket(floor) {
  const gold = Math.round((1 + randomInt(6)) * (1 + floorVigor(floor) / 2));
  if (Math.random() >= RICHES_ITEM_CHANCE) return { gold, items: [] };
  const lore = new Set(Object.keys(window.CryptsLore?.relics || {}));
  const pool = [
    ...Object.entries(RICHES.earthGiven).map(([id, entry]) => ({ id, minFloor: entry.minFloor, weight: 2 })),
    ...(window.CryptsWardrobe?.tombTreasure || []).filter((entry) => !lore.has(entry.id)).map((entry) => ({ ...entry, weight: 1 }))
  ].filter((entry) => entry.minFloor <= floor + 1);
  const id = ecoWeighted(pool.map((entry) => [entry.id, entry.weight]));
  return { gold: Math.round(gold / 2), items: id ? [{ id, quantity: 1 }] : [] };
}

// Where the ground opens: the mouths in the living rock, then the vents and the basins, then
// any lived-in chamber.
function richesEarthSpot(taken) {
  const eco = ecoState();
  const unseen = (spot) => spot && !ecoSeen(spot);
  const mouths = shuffle(eco.features.filter((feature) => feature.kind === "mouth" && !feature.emitsEnergy));
  for (const mouth of mouths) {
    const spot = freeTileNear(mouth, taken, 2);
    if (unseen(spot)) return { spot, room: mouth.room, where: "mouth" };
  }
  const rooms = state.run.rooms.map((room, index) => ({ room, index })).filter(({ room, index }) => index > 0 && room.habitat && !room.mainTreasure);
  const weight = ({ room }) => ({ "earth-mouth": 4, "dry-chamber": 3, "flooded-chamber": 2, "bone-yard": 2, "fungal-garden": 1.5 }[room.habitat] || 1);
  const pick = ecoWeighted(rooms.map((entry, n) => [n, weight(entry)]));
  const chosen = rooms[pick];
  if (!chosen) return null;
  const spot = ecoFreeTile(chosen.room, taken);
  return unseen(spot) ? { spot, room: chosen.index, where: chosen.room.habitat } : null;
}

function richesEarthGives(eco, floor, hours = 1) {
  const chance = RICHES_RISE_PER_HOUR * mouthShare(floor) / mouthShare(1) * hours;
  let count = Math.floor(chance) + (Math.random() < chance % 1 ? 1 : 0);
  const taken = ecoOccupiedTiles();
  while (count-- > 0) {
    const place = richesEarthSpot(taken);
    if (!place) return;
    taken.add(tileIndex(place.spot.x, place.spot.y));
    const packet = richesEarthPacket(floor);
    eco.nextRich = (eco.nextRich || 0) + 1;
    state.run.treasures.push({ id: `earth-${eco.nextRich}-${eco.ticks || 0}`, x: place.spot.x, y: place.spot.y,
      gold: packet.gold, items: packet.items, earth: true, since: eco.ticks || 0 });
    ecoEvent(place.room, `The ground pushed up ${richesPacketName(packet)} here.`, "earth");
  }
}

// ---------- 2. The carriers take it home ----------

function richesHomeRoom(creature) {
  const home = creature.eco?.home;
  return Number.isInteger(home) && state.run.rooms[home] ? home : roomIndexAt(creature.x, creature.y);
}

// Where a carrier puts things down: its den's hoard, its pool, or the nearest shrine bowl.
function richesKeepSpot(creature, carrier) {
  const eco = ecoState();
  if (carrier.keeps === "shrine") {
    const bowls = eco.features.filter((feature) => feature.kind === "offering")
      .sort((a, b) => distanceInSquares(a, creature) - distanceInSquares(b, creature));
    const bowl = bowls[0];
    if (!bowl) return null;
    const cache = state.run.treasures.find((entry) => entry.shrine === bowl.id);
    return { x: cache?.x ?? bowl.x, y: cache?.y ?? bowl.y, bowl, cache, room: bowl.room };
  }
  if (carrier.keeps === "up") return null;
  const cache = state.run.treasures.find((entry) => entry.hoard && entry.owner === creature.id);
  if (cache) return { x: cache.x, y: cache.y, cache, room: roomIndexAt(cache.x, cache.y) };
  const room = richesHomeRoom(creature);
  const roomData = state.run.rooms[room];
  if (!roomData) return null;
  const pool = carrier.keeps === "pool" ? eco.features.find((feature) => feature.kind === "pool" && feature.room === room) : null;
  return { x: pool?.x ?? roomData.anchorX ?? creature.x, y: pool?.y ?? roomData.anchorY ?? creature.y, room };
}

// Puts what a carrier holds into its keeping place, making the hoard or shrine pile if
// there isn't one yet.
function richesDeposit(creature, carrier, place, { quiet = false } = {}) {
  if (!richesCarrying(creature) || !place) return false;
  const carried = creature.carrying;
  let cache = place.cache;
  if (!cache) {
    const taken = ecoOccupiedTiles();
    const spot = place.bowl ? freeTileNear(place.bowl, taken, 1) : (isWalkable(place.x, place.y) && !taken.has(tileIndex(place.x, place.y)) ? { x: place.x, y: place.y } : freeTileNear(place, taken, 2));
    if (!spot) return false;
    cache = place.bowl
      ? { id: `shrine-${place.bowl.id}`, x: spot.x, y: spot.y, gold: 0, items: [], shrine: place.bowl.id }
      : { id: `hoard-${creature.id}`, x: spot.x, y: spot.y, gold: 0, items: [], hoard: true, owner: creature.id, keeper: creature.templateId };
    state.run.treasures.push(cache);
  }
  if ((cache.shrine && cache.items.length >= RICHES_SHRINE_HOLDS) || cache.items.length >= 16) return false;
  cache.gold = roundGold((cache.gold || 0) + (carried.gold || 0));
  for (const item of carried.items) {
    const held = cache.items.find((entry) => entry.id === item.id);
    if (held) held.quantity += item.quantity;
    else cache.items.push({ ...item });
  }
  const name = richesPacketName(carried);
  creature.carrying = null;
  if (quiet) return true;
  if (cache.shrine) {
    ecoLog(creature, `${creature.name} sets down ${name} by the offering bowl, as an offering.`);
    ecoEvent(place.room, `The dead brought ${name} to the shrine here.`, "offered");
  } else {
    ecoLog(creature, `${creature.name} tucks ${name} away with its other things.`);
  }
  return true;
}

// A thing climbs a floor: to the floor above's arrivals, or out into Chiltomatlan.
function richesSendUp(packet, floor = state.run.dungeonFloor || 1) {
  const book = richesBook();
  if (!book || !(packet.gold > 0 || packet.items?.length)) return;
  if (floor <= 1) {
    book.richesSurfaced += richesPacketWorth(packet);
    return;
  }
  const key = String(floor - 1);
  book.riches[key] ||= [];
  if (book.riches[key].length < 24) book.riches[key].push({ gold: packet.gold || 0, items: (packet.items || []).map((item) => ({ ...item })) });
}

// A xolotl hound that leaves up the stairs takes what it carries with it.
function richesCarriedUp(creature) {
  if (!richesCarrying(creature)) return;
  richesSendUp(creature.carrying);
  creature.carrying = null;
}

// The carrier's turn, when you're near (systems/ecology.js: ecologyIdle). Returns true when
// it spent the turn on treasure.
function richesIdle(creature, species, data, { catchUp = false } = {}) {
  const carrier = richesCarrier(creature);
  if (!carrier || creature.alerted || data.sat < ECO_HUNGRY) return false;
  if (richesCarrying(creature)) {
    if (carrier.keeps === "up") return false; // (the hound's own errand takes it to the stairs)
    const place = richesKeepSpot(creature, carrier);
    if (!place) return false;
    if (distanceInSquares(creature, place) <= 1) {
      if (!richesDeposit(creature, carrier, place)) creature.carrying = creature.carrying || null;
      return true;
    }
    ecoStep(creature, place, { catchUp });
    return true;
  }
  // Something to pick up close by.
  const target = data.richesTarget && state.run.treasures.find((cache) => cache.id === data.richesTarget);
  const cache = target && richesPick(carrier, target) ? target
    : state.run.treasures.find((entry) => distanceInSquares(entry, creature) <= gridReach(6) && richesPick(carrier, entry));
  if (!cache) {
    data.richesTarget = null;
    return false;
  }
  data.richesTarget = cache.id;
  if (distanceInSquares(creature, cache) <= 1) {
    const pick = richesPick(carrier, cache);
    richesTake(creature, cache, pick);
    data.richesTarget = null;
    ecoLog(creature, `${creature.name} picks up ${pick.item ? itemDetails(pick.item).name : formatCurrency(pick.gold)} and makes off with it.`);
    if (typeof ecoObserve === "function") ecoObserve(creature.templateId, "carries");
    return true;
  }
  ecoStep(creature, cache, { catchUp });
  return true;
}

// ---------- The hour, on and off screen ----------

function richesCensus(eco, hours = 1) {
  // (Also on floors being lived through while you're elsewhere, or in town.)
  if (!eco || !state.run?.rooms) return;
  const floor = state.run.dungeonFloor || 1;
  richesArrive(eco, floor);
  richesEarthGives(eco, floor, hours);
  // 2. Carriers you can't see do in an hour what they'd do in your sight.
  for (const creature of state.run.enemies) {
    const carrier = richesCarrier(creature);
    if (!carrier || creature.alerted || ecoSeen(creature) || (creature.eco?.sat ?? 60) < ECO_HUNGRY - 10) continue;
    if (richesCarrying(creature)) {
      if (carrier.keeps === "up") {
        if (Math.random() < 0.15 * hours) {
          ecoEvent(richesHomeRoom(creature), `A ${creature.name} went up the stairs carrying ${richesPacketName(creature.carrying)}.`, "climbed");
          richesCarriedUp(creature);
        }
        continue;
      }
      const place = richesKeepSpot(creature, carrier);
      if (place && !ecoSeen(place)) richesDeposit(creature, carrier, place);
      continue;
    }
    if (Math.random() > 0.35 * hours) continue;
    const home = richesHomeRoom(creature);
    const cache = shuffle(state.run.treasures.filter((entry) => !ecoSeen(entry) &&
      (roomIndexAt(entry.x, entry.y) === home || distanceInSquares(entry, creature) <= gridReach(ECO_SEARCH_RADIUS)) &&
      richesPick(carrier, entry)))[0];
    if (cache) richesTake(creature, cache, richesPick(carrier, cache));
  }
  // 3. Full hoards send the extra up a floor.
  for (const cache of state.run.treasures.filter((entry) => entry.hoard && entry.owner && !ecoSeen(entry))) {
    const owner = state.run.enemies.find((enemy) => enemy.id === cache.owner && enemy.alive);
    const carrier = owner ? richesCarrier(owner) : null;
    if (!carrier) continue;
    const count = cache.items.reduce((sum, item) => sum + item.quantity, 0);
    if (count <= carrier.holds || Math.random() > RICHES_CLIMB_PER_HOUR * hours) continue;
    const item = cache.items[randomInt(cache.items.length) - 1];
    item.quantity -= 1;
    cache.items = cache.items.filter((entry) => entry.quantity > 0);
    richesSendUp({ gold: 0, items: [{ id: item.id, quantity: 1 }] }, floor);
    ecoEvent(richesHomeRoom(owner), `A ${owner.name} went up the stairs with ${itemDetails(item.id)?.name || "something"} from its hoard.`, "climbed");
  }
  // A hoard whose keeper is gone lies loose for anyone, and the earth.
  for (const cache of state.run.treasures) {
    if (!cache.hoard || !cache.owner || cache.loose) continue;
    if (state.run.enemies.some((enemy) => enemy.id === cache.owner && enemy.alive)) continue;
    cache.loose = true;
    cache.since = eco.ticks || 0;
  }
  // 4. The earth takes back what lies about too long.
  const ticks = eco.ticks || 0;
  const keep = RICHES_EARTH_KEEPS_DAYS * ECO_TICKS_PER_DAY;
  const hungryMouths = eco.features.filter((feature) => feature.kind === "mouth" && (feature.hunger || 0) >= 60);
  state.run.treasures = state.run.treasures.filter((cache) => {
    if (!richesLoose(cache) || ecoSeen(cache)) return true;
    const age = ticks - (cache.since ?? ticks);
    const mouth = hungryMouths.some((feature) => distanceInSquares(feature, cache) <= gridReach(3));
    return age < (mouth ? keep / 3 : keep);
  });
}

// What came up the stairs from below while you weren't looking: into a keeper's hoard, onto
// a shrine, or left near the stairs it came up.
function richesArrive(eco, floor) {
  const book = richesBook();
  const queue = book?.riches?.[String(floor)];
  if (!queue?.length) return;
  for (let n = 0; n < 2 && queue.length; n += 1) {
    const packet = queue.shift();
    const keepers = state.run.enemies.filter((enemy) => richesCarrier(enemy) && ["den", "pool"].includes(richesCarrier(enemy).keeps) && !ecoSeen(enemy));
    const bowls = eco.features.filter((feature) => feature.kind === "offering" && !ecoSeen(feature));
    const roll = Math.random();
    if (keepers.length && roll < 0.5) {
      const keeper = keepers[randomInt(keepers.length) - 1];
      keeper.carrying = packet;
      const place = richesKeepSpot(keeper, richesCarrier(keeper));
      if (place && !ecoSeen(place) && richesDeposit(keeper, richesCarrier(keeper), place, { quiet: true })) continue;
      keeper.carrying = null;
    }
    if (bowls.length && roll < 0.8) {
      const bowl = bowls[randomInt(bowls.length) - 1];
      const visitor = { id: "riches-visitor", name: "Someone", x: bowl.x, y: bowl.y, carrying: packet };
      if (richesDeposit(visitor, { keeps: "shrine" }, richesKeepSpot(visitor, { keeps: "shrine" }), { quiet: true })) continue;
    }
    const stair = (state.run.floorStairs || []).find((entry) => entry.type === "stairs-down") || state.run.floorStairs?.[0];
    const spot = stair ? freeTileNear(stair, ecoOccupiedTiles(), 3) : null;
    if (!spot || ecoSeen(spot)) {
      queue.unshift(packet);
      return;
    }
    eco.nextRich = (eco.nextRich || 0) + 1;
    state.run.treasures.push({ id: `risen-${eco.nextRich}-${eco.ticks || 0}`, x: spot.x, y: spot.y, gold: packet.gold || 0,
      items: packet.items || [], loose: true, since: eco.ticks || 0 });
  }
}

// ---------- When a carrier dies ----------

// What a creature carried falls where it fell (a kill by you drops it with the rest of its
// loot: dropEnemyTreasure).
function richesDropCarried(creature) {
  // (And its keepsake, if it kept one: systems/cherish.js.)
  const keepsake = typeof cherishDropKeepsake === "function" ? cherishDropKeepsake(creature) : null;
  if (!richesCarrying(creature) && !keepsake) return null;
  const packet = richesCarrying(creature) ? creature.carrying : { gold: 0, items: [] };
  creature.carrying = null;
  if (keepsake && itemDetails(keepsake)) packet.items = [...(packet.items || []), { id: keepsake, quantity: 1 }];
  return packet;
}

function richesFall(creature) {
  const packet = richesDropCarried(creature);
  if (!packet) return;
  const eco = ecoState();
  eco.nextRich = (eco.nextRich || 0) + 1;
  state.run.treasures.push({ id: `fallen-${eco.nextRich}-${eco.ticks || 0}`, x: creature.x, y: creature.y,
    gold: packet.gold || 0, items: packet.items || [], loose: true, since: eco.ticks || 0 });
}

// ---------- You take it ----------

// What taking a cache means to whoever kept it.
function richesTaken(cache) {
  if (!cache || state.run?.location !== "dungeon") return;
  if (cache.hoard && cache.owner) {
    const owner = state.run.enemies.find((enemy) => enemy.id === cache.owner && enemy.alive);
    if (owner && distanceInSquares(owner, state.run.player) <= gridReach(8)) {
      if (typeof mindRobbed === "function") mindRobbed(owner, cache);
      else provokeCreature(owner);
      reportAt(owner, `${owner.name} sees you take its things.`);
    }
    return;
  }
  if (cache.shrine) {
    const bowl = ecoState()?.features.find((feature) => feature.id === cache.shrine);
    // A full bowl is a fair exchange: you fed the dead, and they let you take.
    if (bowl && (bowl.amount || 0) >= 3) {
      bowl.amount -= 3;
      addLog("You take the offerings and leave the bowl full. The dead let it pass.");
      return;
    }
    const worth = richesPacketWorth(cache);
    if (typeof tombRemembersValue === "function") tombRemembersValue(worth * 2);
    let roused = 0;
    for (const spirit of state.run.enemies) {
      if (!spirit.alive || !isRestlessDead(spirit) || distanceInSquares(spirit, state.run.player) > gridReach(10)) continue;
      if (typeof mindRobbed === "function") mindRobbed(spirit, cache);
      else provokeCreature(spirit);
      roused += 1;
    }
    addLog(roused
      ? "You take what was offered at the shrine. The air goes cold, and the dead turn toward you."
      : "You take what was offered at the shrine. The tomb remembers it.");
  }
}

// How the treasure button names a pile, so you know whose it is before you take it.
function richesCacheLabel(cache) {
  if (cache?.shrine) return t("Offerings at the shrine");
  if (cache?.hoard && cache.keeper && !cache.loose) return t("{0}'s hoard", { 0: t(ecoName(cache.keeper)) });
  return "";
}

// A line for the creature card: what it's carrying.
function richesCarriedNote(creature) {
  if (!richesCarrying(creature)) return "";
  return t("It is carrying {0}.", { 0: t(richesPacketName(creature.carrying)) });
}

// ---------- A new floor ----------

// A floor made new has been living for a long while: the shrines hold old offerings, the
// dens and pools old hoards, and some things lie where the ground gave them up.
function richesSeedFloor() {
  const eco = ecoState();
  if (!eco || eco.richesSeeded) return;
  eco.richesSeeded = true;
  const floor = state.run.dungeonFloor || 1;
  const share = mouthShare(floor) / mouthShare(1);
  for (const bowl of eco.features.filter((feature) => feature.kind === "offering")) {
    const visitor = { id: "riches-seed", name: "", x: bowl.x, y: bowl.y };
    for (let n = Math.round(1 + Math.random() * (1 + share * 0.6)); n > 0; n -= 1) {
      visitor.carrying = richesEarthPacket(floor);
      richesDeposit(visitor, { keeps: "shrine" }, richesKeepSpot(visitor, { keeps: "shrine" }), { quiet: true });
    }
  }
  for (const keeper of state.run.enemies.filter((enemy) => richesCarrier(enemy) && ["den", "pool"].includes(richesCarrier(enemy).keeps))) {
    if (Math.random() > 0.55) continue;
    const carrier = richesCarrier(keeper);
    for (let n = 1 + randomInt(Math.min(3, carrier.holds)) - 1; n > 0; n -= 1) {
      const packet = richesEarthPacket(floor);
      if (!packet.items.length) continue;
      const kept = packet.items.filter((item) => richesTakesItem(carrier, item.id));
      if (!kept.length) continue;
      keeper.carrying = { gold: packet.gold, items: kept };
      richesDeposit(keeper, carrier, richesKeepSpot(keeper, carrier), { quiet: true });
      keeper.carrying = null;
    }
  }
  richesEarthGives(eco, floor, 24);
}
