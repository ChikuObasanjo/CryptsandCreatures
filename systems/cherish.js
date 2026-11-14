"use strict";

// What a creature with a mind comes to love (data/riches.js: cherish).
//
// Each one of a kind that can love a thing loves one sort of thing of its own: one duende
// gold, another children's things; a tlacatecolotl mirrors, or writing. Many already have
// one thing of that sort they keep close (a keepsake), and the longer it has had it, the more
// it is part of what the creature is (the way a den becomes an animal's own: systems/minds.js).
//
//   longing   You carry something of the sort it loves: it wants it. Most come close and
//             trail you, hoping; the ones that take by force (the sea giants) come to take it;
//             a frightened one only watches.
//   a gift    Give it what it longs for and it is yours: it trusts you, keeps the thing, and
//             gives back what its kind gives (the dead let go of their posts, a chaneque shows
//             you what's hidden, an alux keeps watch, a carrier gives you something it kept).
//   a theft   Take its keepsake, its hoard, or a shrine's offerings in front of it, and it
//             holds it against you, the more so if it was the sort of thing it loves.

const CHERISH = window.CryptsRiches?.cherish || {};
const CHERISH_KEEPSAKE_CHANCE = 0.55;

// Its one love, settled the first time it's asked.
function cherishLoves(enemy) {
  const kinds = CHERISH[enemy?.templateId];
  if (!kinds?.length || enemy.friendly || enemy.delver) return null;
  const mind = mindFor(enemy);
  if (mind.loves === undefined) {
    mind.loves = kinds[randomInt(kinds.length) - 1];
    mind.lovedSince = (typeof ecoState === "function" && ecoState()?.ticks) || 0;
    // Most already have something of the sort they love.
    if (!enemy.keepsake && Math.random() < CHERISH_KEEPSAKE_CHANCE) {
      const floor = state.run?.dungeonFloor || 1;
      const choices = (window.CryptsRiches.kinds[mind.loves] || []).filter((id) => {
        const minFloor = window.CryptsRiches.earthGiven[id]?.minFloor ??
          (window.CryptsWardrobe?.tombTreasure || []).find((entry) => entry.id === id)?.minFloor ?? 1;
        return itemDetails(id) && minFloor <= floor + 1;
      });
      if (choices.length) enemy.keepsake = choices[randomInt(choices.length) - 1];
    }
  }
  return mind.loves;
}

function cherishIsLoved(enemy, itemId) {
  const loves = cherishLoves(enemy);
  return Boolean(loves && typeof richesKindsOf === "function" && richesKindsOf(itemId).includes(loves));
}

// How much its keepsake has become its own: a few days.
function cherishHeld(enemy) {
  if (!enemy?.keepsake) return 0;
  const mind = mindFor(enemy);
  const ticks = (typeof ecoState === "function" && ecoState()?.ticks) || 0;
  const perDay = typeof ECO_TICKS_PER_DAY === "number" ? ECO_TICKS_PER_DAY : 144;
  return 1 - Math.exp(-Math.max(0, ticks - (mind.lovedSince ?? -1e6)) / perDay / 2);
}

// The first thing you carry that it loves, or null.
function cherishWanted(enemy) {
  if (!cherishLoves(enemy)) return null;
  return (state.run.inventory || []).find((entry) => entry.quantity > 0 && cherishIsLoved(enemy, entry.id))?.id || null;
}

// The pull of what you carry (systems/minds.js: mindDrives "longing"). Less when it already
// holds a thing of its own it loves; none once you've given it one.
function cherishLonging(enemy) {
  const wanted = cherishWanted(enemy);
  if (!wanted) return 0;
  const mind = mindFor(enemy);
  if (mind.gifted) return 0.15;
  return 0.75 - 0.35 * cherishHeld(enemy);
}

// ---------- Giving ----------

// Creatures beside you that would take a gift you have.
function cherishGiftOptions() {
  if (state.run?.location !== "dungeon") return [];
  const options = [];
  for (const enemy of state.run.enemies) {
    if (!enemy.alive || enemy.friendly || distanceInSquares(enemy, state.run.player) > 1 || !playerSees(enemy)) continue;
    if (enemy.mind?.intent === "fight" && enemy.provoked) continue;
    const wanted = cherishWanted(enemy);
    if (wanted) options.push({ enemy, itemId: wanted });
  }
  return options;
}

function cherishGive(enemy, itemId) {
  if (!enemy?.alive || !removeInventoryItem(itemId)) return;
  const mind = mindFor(enemy);
  const name = itemDetails(itemId)?.name || "it";
  mindLearn(mind, 1, Math.min(0.9, MIND_LEARN.fed * 1.6));
  mind.fed = Math.min(5, (mind.fed || 0) + 2);
  mind.harmed = 0;
  mind.robbed = 0;
  mind.stress *= 0.3;
  mind.gifted = (mind.gifted || 0) + 1;
  enemy.provoked = false;
  enemy.alerted = false;
  enemy.fleeTurns = 0;
  if (enemy.eco) enemy.eco.offended = false;
  // It keeps the new thing close; what it kept before matters less now.
  enemy.keepsake = itemId;
  mind.lovedSince = (typeof ecoState === "function" && ecoState()?.ticks) || 0;
  addLog(`You hold out a gift: ${name}. ${enemy.name} takes it carefully and keeps it close.`);
  cherishGiftBack(enemy, mind, itemId);
  if (typeof ecoObserve === "function") ecoObserve(enemy.templateId, `loves:${mind.loves}`);
  if (typeof tombGive === "function") tombGive("food");
  finishPlayerTurn();
}

// What each kind gives back.
function cherishGiftBack(enemy, mind, itemId) {
  const species = ecoSpecies(enemy);
  const nature = mindNature(enemy, species);
  // The dead let go of what held them here.
  if (nature === MIND_NATURES.spirit) {
    mind.cling = Math.max(0, mindCling(mind, nature) - 0.5);
    if (typeof mindSated === "function") mindSated(enemy, 60);
    addLog(species.passesOn ? `${enemy.name}'s hold on this place loosens.` : `${enemy.name} turns the gift over and over, and lets you be.`);
    return;
  }
  if (enemy.templateId === "chaneque") {
    if (typeof ecoRemoveCondition === "function" && ecoRemoveCondition("susto")) addLog("The fright it put in you lets go.");
    const shown = typeof wilesShowHidden === "function" ? wilesShowHidden(enemy) : 0;
    addLog(shown ? "The chaneque points out what's hidden in its keeping, one thing at a time." : "The chaneque nods at you, the way one does at a neighbor.");
    return;
  }
  if (enemy.templateId === "alux") {
    enemy.eco.appeased = true;
    const house = ecoState()?.features.find((feature) => feature.kind === "alux-house" && feature.room === enemy.eco.home);
    if (house) house.appeased = true;
    addLog("The alux settles by its house to keep watch. What it guards is yours to take.");
    return;
  }
  if (enemy.templateId === "duende" && enemy.stolen) {
    const back = Math.ceil(enemy.stolen * 1.5);
    addGoldWithinCapacity(back);
    enemy.stolen = 0;
    addLog(`${enemy.name} gives back what it took from you, and more besides: ${formatCurrency(back)}.`);
    return;
  }
  // A keeper of things gives you one it doesn't love as much.
  const hoard = state.run.treasures.find((cache) => cache.hoard && cache.owner === enemy.id && cache.items.length);
  const spare = hoard?.items.find((item) => !cherishIsLoved(enemy, item.id));
  if (spare && addInventoryItem(spare.id)) {
    spare.quantity -= 1;
    hoard.items = hoard.items.filter((item) => item.quantity > 0);
    addLog(`${enemy.name} brings you ${itemDetails(spare.id).name} from its hoard.`);
    return;
  }
  if (typeof mindSated === "function") mindSated(enemy, 40);
}

// ---------- Theft ----------

// You took its things where it could see: its hoard, its shrine's offerings. It remembers.
function mindRobbed(enemy, cache) {
  if (!enemy?.alive || !mindApplies(enemy)) return;
  const mind = mindFor(enemy);
  const loved = (cache?.items || []).some((item) => cherishIsLoved(enemy, item.id));
  mindLearn(mind, -1, MIND_LEARN.harm * (loved ? 1.4 : 1));
  mind.robbed = Math.min(1, (mind.robbed || 0) + (loved ? 0.8 : 0.45));
  mind.robbedAt = (typeof ecoState === "function" && ecoState()?.ticks) || 0;
  mind.stress = mindClamp(mind.stress + 0.3);
  mind.gifted = 0;
  if (loved || mindNature(enemy, ecoSpecies(enemy)) !== MIND_NATURES.animal) provokeCreature(enemy);
}

// How much the theft still stings: half as much each day.
function cherishGrudge(enemy) {
  const mind = enemy?.mind;
  if (!(mind?.robbed > 0)) return 0;
  const ticks = (typeof ecoState === "function" && ecoState()?.ticks) || 0;
  const perDay = typeof ECO_TICKS_PER_DAY === "number" ? ECO_TICKS_PER_DAY : 144;
  return mind.robbed * Math.pow(0.5, Math.max(0, ticks - (mind.robbedAt || 0)) / perDay);
}

// What it drops when it dies: its keepsake.
function cherishDropKeepsake(enemy) {
  if (!enemy?.keepsake) return null;
  const id = enemy.keepsake;
  enemy.keepsake = null;
  return id;
}

// For the creature card and the inspect panel.
function cherishNote(enemy) {
  const loves = enemy?.mind?.loves;
  if (!loves) return "";
  const parts = [];
  if (enemy.keepsake && itemDetails(enemy.keepsake)) parts.push(t("It keeps something close: {0}.", { 0: t(itemDetails(enemy.keepsake).name) }));
  const wanted = cherishWanted(enemy);
  if (wanted && !enemy.mind.gifted) parts.push(t("It can't take its eyes off something you carry: {0}.", { 0: t(itemDetails(wanted).name) }));
  return parts.join(" ");
}
