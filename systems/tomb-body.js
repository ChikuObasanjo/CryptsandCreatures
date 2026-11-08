"use strict";

// The tomb as one body.
//
// Everything that lives in the tomb is part of one larger life: Tlaltecuhtli, the earth the
// old lords built on. Inside her, life only changes hands. A turkey eats the fungus, a jaguar
// eats the turkey, the dead drink the jaguar's last heat, her mouths take back the bones,
// and the fungus grows thick around them. None of that changes how she feels, any more than
// you feel your blood moving.
//
// What she feels is what crosses her skin, and only you cross it. Life comes up out of her
// (LORE.md); in the Mexica story the gods made the world's plants from her body, and she
// cries at night to be fed in return. So she feels the balance between what you take up out
// of her and what you give back:
//
//   taken   what you carry: the gold, treasure, food, and gear in your expedition loot.
//           She feels it while you carry it, and remembers a little of it after you carry
//           it home. The memory fades over a day or two.
//   given   offerings left in the bowls, meat for her mouths, food left for her creatures,
//           gifts the wardens accept, the dead you help go on, and, if you fall, you: your
//           body, and everything you carried, go back to her.
//
// The balance is her mood, and it moves through the whole tomb the way a mood moves through
// a body, without any rule telling a creature what to do:
//
//   hungry    her mouths open sooner; the dead and the wardens, who live on tonalli, feel
//             her hunger as their own; every creature is a little more on edge; the plants
//             grow thinner.
//   at rest   the reverse: the dead are calm, creatures settle, the ground grows thick.
//
// So the deeper you go and the more you take, the more of the tomb wakes to you, and an
// offering is a real payment (the Nahua word is nextlahualli, a debt-payment). Nothing here
// is a punishment: she isn't against you, she is only hungry, and she is fed the way she
// has always been fed. The ideas behind it are in MINDS.md.

const TOMB_HALF_LIFE_HOURS = 24;   // what she remembers (taken or given) fades by half in this long
const TOMB_HOME_MEMORY = 0.25;     // share of what you carried home that she remembers
const TOMB_HUNGER_SCALE = 350;     // tonalli owed (in gold pieces' worth) for her hunger to reach about 0.63
const TOMB_REST_SCALE = 60;        // tonalli given, past what's owed, for her rest to reach about 0.63
// What a carried thing is worth to her: grave goods (treasure) count for half their price,
// anything else for a quarter, and no one thing for more than these.
const TOMB_ITEM_WORTH = { Treasure: { share: 0.5, cap: 60 }, other: { share: 0.25, cap: 25 } };
const TOMB_GIFTS = {
  offeringPerPoint: 10,            // per point of an offering's worth (ECO.offerings): copal is 6, so 60
  mouth: 20,                       // meat fed to one of her mouths
  food: 6,                         // food you left out, eaten by one of her creatures
  guardian: 15,                    // a gift a warden accepted
  passing: 25,                     // one of the dead you helped go on
  fallen: 80                       // you
};
const TOMB_MOODS = [
  { id: "ravenous", hunger: 0.8, label: "ravenous" },
  { id: "hungry", hunger: 0.5, label: "hungry" },
  { id: "stirring", hunger: 0.25, label: "stirring" },
  { id: "at-rest", rest: 0.3, label: "at rest" },
  { id: "still", label: "still" }
];

// Her appetite grows with how deep you've gone, as the treasure does.
function tombScale() {
  const deepest = Math.max(state.run?.progress?.deepestFloor || 1, state.run?.dungeonFloor || 1);
  return 1 + (deepest - 1) * 0.15;
}

function tombBody() {
  const run = state.run;
  if (!run) return null;
  const now = run.gameMinutes || 0;
  if (!run.tomb || typeof run.tomb !== "object") run.tomb = { owed: 0, given: 0, minute: now, mood: "still" };
  const tomb = run.tomb;
  // What she remembers fades with time, in the tomb or out of it.
  const hours = (now - (tomb.minute ?? now)) / 60;
  if (hours > 0) {
    const fade = Math.pow(0.5, hours / TOMB_HALF_LIFE_HOURS);
    tomb.owed *= fade;
    tomb.given *= fade;
  }
  tomb.minute = now;
  return tomb;
}

// What you carry that came out of her, in gold pieces' worth.
let tombCarriedCache = { key: "", value: 0 };
function tombCarried() {
  const loot = state.run?.unsecuredLoot;
  if (!loot) return 0;
  const key = `${state.run.steps || 0}:${loot.gold}:${loot.items.map((item) => `${item.id}${item.quantity}`).join(",")}`;
  if (tombCarriedCache.key === key) return tombCarriedCache.value;
  let value = Math.max(0, loot.gold || 0);
  for (const item of loot.items) {
    const details = typeof itemDetails === "function" ? itemDetails(item.id) : null;
    const worth = TOMB_ITEM_WORTH[details?.categoryId] || TOMB_ITEM_WORTH.other;
    value += Math.min(worth.cap, (details?.price || 0) * worth.share) * (item.quantity || 0);
  }
  tombCarriedCache = { key, value };
  return value;
}

// Given minus owed. Below zero she hungers; above, she rests.
function tombBalance() {
  const tomb = tombBody();
  if (!tomb) return 0;
  const carried = state.run.location === "dungeon" ? tombCarried() : 0;
  return tomb.given - tomb.owed - carried;
}

function tombHunger() {
  const balance = tombBalance();
  return balance < 0 ? 1 - Math.exp(balance / (TOMB_HUNGER_SCALE * tombScale())) : 0;
}

function tombRest() {
  const balance = tombBalance();
  return balance > 0 ? 1 - Math.exp(-balance / (TOMB_REST_SCALE * tombScale())) : 0;
}

function tombMood() {
  const hunger = tombHunger();
  const rest = tombRest();
  return TOMB_MOODS.find((mood) => (mood.hunger !== undefined && hunger >= mood.hunger) ||
    (mood.rest !== undefined && rest >= mood.rest)) || TOMB_MOODS[TOMB_MOODS.length - 1];
}

// Something went down the road to her. `kind` is a key of TOMB_GIFTS; `points` scales it.
function tombGive(kind, points = 1) {
  const tomb = tombBody();
  if (!tomb) return;
  tomb.given += (TOMB_GIFTS[kind] || 0) * points * tombScale();
}

// You carried your loot home: she remembers some of it.
function tombRemembersLoot() {
  const tomb = tombBody();
  if (!tomb) return;
  tomb.owed += tombCarried() * TOMB_HOME_MEMORY;
}

// You fell. What you carried goes back to her with you (the loot is lost), and she has eaten.
function tombReceivesFallen() {
  tombGive("fallen");
}

// ---------- What she does with her mood ----------

// How strongly the mouth's energy reaches a floor's plants.
function tombBreath() {
  return Math.max(0.4, 1 - 0.35 * tombHunger() + 0.25 * tombRest());
}

// How fast her mouths grow hungry.
function tombMouthAppetite() {
  return Math.max(0.2, 1 + 1.5 * tombHunger() - 0.6 * tombRest());
}

// ---------- Telling you ----------

const TOMB_MOOD_LINES = {
  ravenous: "The tomb is ravenous. The floor shifts under your feet, and everything down here is on edge.",
  hungry: "The tomb is hungry. The walls sweat, and the dead turn toward the warmth in you.",
  stirring: "A slow breath of warm air comes up from below. The tomb has felt what you are carrying.",
  still: "The tomb grows still again.",
  "at-rest": "The tomb is at rest. The air is cool and quiet, and the dead are calm."
};

// Once a turn: if her mood has changed, say so (only in the tomb).
function tombNotice() {
  const tomb = tombBody();
  if (!tomb || state.run.location !== "dungeon") return;
  const mood = tombMood().id;
  if (mood === tomb.mood) return;
  const previous = tomb.mood;
  tomb.mood = mood;
  // Settling from stirring back to still isn't worth a line; everything else is.
  if (mood === "still" && previous === "stirring") return;
  addLog(TOMB_MOOD_LINES[mood]);
}

// The status chip on your card while you're in the tomb (null while she's still).
function tombStatusChip() {
  if (state.run?.location !== "dungeon") return null;
  const mood = tombMood();
  if (mood.id === "still") return null;
  const why = t("What you carry out of the tomb makes it hungry. Offerings, meat for its mouths, food left for its creatures, and the dead you help go on let it rest.");
  const effect = mood.id === "at-rest"
    ? t("At rest: the dead are calm, creatures settle, and the ground grows thick.")
    : t("Hungry: the dead and the wardens hunger with it, creatures are on edge, and its mouths open sooner.");
  return { className: `status-chip tomb-mood tomb-${mood.id}`, text: t(`Tomb: ${mood.label}`), title: `${effect} ${why}` };
}

// Saves from before the tomb had a body start it still.
function normalizeTombBody(saved) {
  const tomb = saved.tomb;
  if (!tomb || typeof tomb !== "object" || Array.isArray(tomb) || !Number.isFinite(tomb.owed) || !Number.isFinite(tomb.given) ||
    tomb.owed < 0 || tomb.given < 0 || tomb.owed > 1e7 || tomb.given > 1e7) {
    saved.tomb = { owed: 0, given: 0, minute: saved.gameMinutes || 0, mood: "still" };
    return;
  }
  if (!Number.isFinite(tomb.minute)) tomb.minute = saved.gameMinutes || 0;
  if (!TOMB_MOODS.some((mood) => mood.id === tomb.mood)) tomb.mood = "still";
}
