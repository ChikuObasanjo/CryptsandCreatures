"use strict";

// What you can see and hear in the tomb, and what creatures can see and hear of you.
//
// One rule for everything that shows you a creature or tells you what one did (the map,
// the target frame and nearby row, the log, hit flashes and damage numbers, the journal):
//
//   You SEE a square if it's within SIGHT_RANGE (7, or 9 with deepsight) and nothing
//   blocks the line to it (walls, closed doors, pillars). That's "in view".
//   You only LIGHT what's close (4 squares, 6 with deepsight): those squares get added to
//   your map. Out of view, your map shows what you remember, dimmed, and no creatures.
//   You HEAR what happens out of sight but close by (HEARING_RANGE): a trap snapping, a
//   fight. You get the sound, not the details.
//
// Creatures sense you the same way: by sight in a clear line within their notice range, or
// by hearing through walls when you're very close (closer if you're quiet, farther if you
// run or wear noisy armor). If you can see a creature, it could see you: sight lines are
// the same in both directions.

const SIGHT_RANGE = 7;
const HEARING_RANGE = 9;

function sightRange() {
  return SIGHT_RANGE + (sightDeepsight() ? 2 : 0);
}

function lightReach() {
  return sightDeepsight() ? 6 : 4;
}

function sightDeepsight() {
  return typeof activeBuff === "function" && Boolean(state.run?.progress) && activeBuff("deepsight");
}

// Is this square (or creature) in view right now?
function playerSees(spot) {
  if (!spot || state.run?.location !== "dungeon") return state.run?.location === "city";
  return distanceInSquares(spot, state.run.player) <= sightRange() && hasLineOfSight(state.run.player, spot);
}

// Out of view but close enough to hear.
function playerHears(spot) {
  return state.run?.location === "dungeon" && !playerSees(spot) && distanceInSquares(spot, state.run.player) <= HEARING_RANGE;
}

// A line in the log about something happening at `spot`: the details if you can see it,
// just the sound (if there is one) if you can only hear it, nothing otherwise.
function reportAt(spot, seenText, heardText = "") {
  if (playerSees(spot)) {
    if (seenText) addLog(seenText);
    return true;
  }
  if (heardText && playerHears(spot)) addLog(heardText);
  return false;
}

// How far through stone a creature can hear you.
function creatureHearingRange() {
  let range = 2;
  if (typeof armorIsNoisy === "function" && armorIsNoisy()) range += 1;
  const stance = typeof currentStance === "function" ? currentStance() : "guard";
  if (stance === "run") range += 2;
  if (stance === "disengage") range -= 1;
  if (state.run?.character?.class === "rogue") range -= 1;
  if (typeof activeBuff === "function" && activeBuff("hushed")) range -= 1;
  return Math.max(1, range);
}

// Does this creature sense you: in sight within `range`, or close enough to hear?
function creatureSensesPlayer(enemy, range) {
  const distance = distanceInSquares(enemy, state.run.player);
  if (distance <= range && hasLineOfSight(enemy, state.run.player)) return true;
  return distance <= Math.min(range, creatureHearingRange());
}
