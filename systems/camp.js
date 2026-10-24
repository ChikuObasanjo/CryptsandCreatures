"use strict";

// Campsites. A camp is pitched on a quiet room tile in the tomb and stays there, fire and
// all, until you pitch a new one somewhere else or the tomb's passages shift (a new delve).
// Resting for eight hours and cooking both need your campfire. Pitching one takes either
// a camp kit (sure, quick) or an hour of scavenging and a Survival check.
// From Chiltomatlan you can walk straight back down to your camp; the walk takes an hour per floor.

const CAMP_SURVIVAL_DC = 12;
const CAMP_DANGER_RADIUS = 7;

// A floor is identified by its room layout, so a camp on a floor that was regenerated
// (a new delve, the wardens' lift) is recognized as gone.
function campFloorSignature(rooms) {
  return (rooms || []).map((room) => `${room.mapX},${room.mapY},${room.mapW},${room.mapH}`).join(";");
}

// The current camp, or null. Clears a camp whose floor no longer exists.
function activeCamp() {
  const camp = state.run?.camp;
  if (!camp) return null;
  const here = camp.floor === state.run.dungeonFloor && campFloorSignature(state.run.rooms) === camp.signature;
  const saved = state.run.dungeonFloors?.[String(camp.floor)];
  const elsewhere = saved && campFloorSignature(saved.rooms) === camp.signature;
  if (here || elsewhere) return camp;
  state.run.camp = null;
  return null;
}

function campOnThisFloor() {
  const camp = activeCamp();
  return camp && camp.floor === state.run.dungeonFloor && campFloorSignature(state.run.rooms) === camp.signature ? camp : null;
}

function campAt(x, y) {
  const camp = campOnThisFloor();
  return camp && camp.x === x && camp.y === y ? camp : null;
}

// True while standing on or beside your campfire.
function atCamp() {
  if (state.run?.location !== "dungeon") return false;
  const camp = campOnThisFloor();
  return Boolean(camp && distanceInSquares(camp, state.run.player) <= 1);
}

function campDangerNearby() {
  return state.run.enemies.some((enemy) => enemy.alive && distanceInSquares(enemy, state.run.player) <= CAMP_DANGER_RADIUS);
}

// Why a camp cannot go here, or "" when the spot is fine.
function campSiteProblem() {
  const { x, y } = state.run.player;
  if (state.run.terrain[tileIndex(x, y)] !== "floor") return "Pitch camp inside a chamber, not in a corridor or doorway.";
  if (dungeonSignAt(x, y)) return "Move off the stair or marker before pitching camp.";
  if (state.run.wells?.some((well) => well.x === x && well.y === y)) return "Step off the well before pitching camp.";
  if (state.run.treasures.some((treasure) => treasure.x === x && treasure.y === y)) return "Clear the loose treasure from this spot first.";
  if (state.run.hazards.some((hazard) => hazard.x === x && hazard.y === y && !hazard.triggered)) return "This floor is not safe to sleep on.";
  return "";
}

function campDescription(camp) {
  const room = state.run.rooms[roomIndexAt(camp.x, camp.y)]?.name;
  return room ? `${room}, floor ${camp.floor}` : `floor ${camp.floor}`;
}

function openMakeCamp() {
  if (state.run.location !== "dungeon" || state.run.lost || state.run.won) return;
  if (campDangerNearby()) {
    showToast("Too close to danger to make camp. Find a quiet room first.");
    return;
  }
  const problem = campSiteProblem();
  if (problem) {
    showToast(problem);
    return;
  }
  const old = activeCamp();
  const survival = bestPartySkillBonus("survival");
  const options = [];
  if (inventoryQuantity("camp-kit") > 0) {
    options.push({ label: `Pitch camp with a camp kit · ${inventoryQuantity("camp-kit")} carried`, action: () => pitchCamp(true) });
  }
  options.push({
    label: `Improvise a camp · Survival ${survival >= 0 ? "+" : ""}${survival} vs. DC ${CAMP_SURVIVAL_DC} · 1 hour`,
    action: () => pitchCamp(false)
  });
  const title = old ? `Make camp here? Your camp in ${campDescription(old)} will be struck.` : "Make camp here?";
  options.push({ label: "Not yet", action: () => {} });
  chooseFromOptions(title, options);
}

function pitchCamp(useKit) {
  if (state.run.location !== "dungeon" || campDangerNearby() || campSiteProblem()) return;
  const old = activeCamp();
  if (useKit) {
    if (!removeInventoryItem("camp-kit")) return;
  } else {
    const check = randomInt(20) + bestPartySkillBonus("survival");
    if (check < CAMP_SURVIVAL_DC) {
      addLog(`You search an hour for dry wood and flat stones but cannot make a safe camp (Survival ${check} vs. DC ${CAMP_SURVIVAL_DC}).`);
      showToast("No camp yet. Try again, or carry a camp kit.");
      finishPlayerTurn(60);
      return;
    }
    addLog(`You gather old timbers and three flat stones and build a fire ring (Survival ${check} vs. DC ${CAMP_SURVIVAL_DC}).`);
  }
  const { x, y } = state.run.player;
  state.run.camp = {
    floor: state.run.dungeonFloor, x, y, kit: Boolean(useKit),
    signature: campFloorSignature(state.run.rooms), made: state.run.gameMinutes
  };
  if (old) addLog("You strike your old camp and carry the coals here.");
  addLog(useKit
    ? "You unroll the reed mats, set the three hearthstones, and light the fire. Your camp is ready."
    : "Your camp is ready. The fire will wait for you while you explore.");
  showToast("Camp pitched. Rest and cook here.");
  animateAction("camp");
  finishPlayerTurn(useKit ? 10 : 60);
}

function restAtCamp() {
  if (state.run.location === "dungeon" && !atCamp()) {
    showToast("Return to your camp to rest, or make a new camp here.");
    return;
  }
  campAndRest();
}

// Walk from the tomb entrance back down to your camp.
function enterAtCamp() {
  const camp = activeCamp();
  if (!camp) {
    enterDungeon({ skipLift: true });
    return;
  }
  if (camp.floor !== state.run.dungeonFloor) {
    saveDungeonFloorState();
    const snapshot = state.run.dungeonFloors[String(camp.floor)];
    const entry = dungeonSignsForSnapshot(snapshot)[0];
    restoreDungeonFloorState(snapshot, entry?.id);
    delete state.run.dungeonFloors[String(camp.floor)];
  }
  state.run.location = "dungeon";
  state.run.hasEnteredDungeon = true;
  state.run.player = { ...state.run.player, x: camp.x, y: camp.y };
  state.run.currentRoom = roomIndexAt(camp.x, camp.y);
  refreshCompanionFormation();
  revealAroundPlayer();
  const hours = Math.max(1, camp.floor);
  advanceSurvivalTime(false, hours * 60);
  addLog(`You follow your trail marks down to your camp in ${campDescription(camp)} (${hours} hour${hours === 1 ? "" : "s"}).`);
  upgradeGreatTempleContent();
  render();
}

// Shown in look mode.
function campInspectText(camp) {
  return [
    `Your camp${camp.kit ? ", with reed mats from a camp kit" : ", built from scavenged wood and stone"}.`,
    "Rest for 8 hours or cook while standing on or beside it.",
    "It stays here until you pitch a new camp, and you can walk straight back to it from Chiltomatlan."
  ].join(" ");
}
