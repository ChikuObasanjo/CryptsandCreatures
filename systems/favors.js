"use strict";

// Townsfolk favors (content in data/favors.js). A favor is offered in conversation once
// you're close enough, accepted or put off, then kept open in the journal until you bring
// the thing back. While it's open, the thing is placed on each new floor in its range.
const FAVORS = window.CryptsFavors?.favors || {};
const FAVOR_REWARDS = window.CryptsFavors?.rewards || {};

function favorFor(id) {
  return FAVORS[id] || null;
}

function favorStatus(id) {
  return villagerRecord(id).favor || null;
}

function favorOffered(id) {
  const favor = favorFor(id);
  const record = villagerRecord(id);
  return Boolean(favor && record.met && !record.favor && record.d >= favor.min);
}

function openFavors() {
  return Object.keys(FAVORS).filter((id) => favorStatus(id) === "open");
}

function carryingFavorItem(id) {
  const favor = favorFor(id);
  return Boolean(favor && inventoryQuantity(favor.item) > 0);
}

function offerFavor(id) {
  const favor = favorFor(id);
  const villager = VILLAGE.villagers[id];
  state.villagerView.mode = "reply";
  state.villagerView.speech = sayVillager(fillVillagerLine(favor.ask, id));
  state.villagerView.options = [
    { label: "I'll look for it.", action: () => acceptFavor(id) },
    { label: "Not now.", action: () => {
      state.villagerView.mode = "menu";
      state.villagerView.speech = sayVillager(t("Another time, then."));
      renderVillagerDialog();
    } }
  ];
  villagerRecord(id).met = true;
  renderVillagerDialog();
  addLog(`${villager.name} has a favor to ask.`);
}

function acceptFavor(id) {
  const favor = favorFor(id);
  const record = villagerRecord(id);
  record.favor = "open";
  changeDisposition(id, 2);
  addLog(`Journal: ${favor.hint}`);
  state.villagerView.mode = "menu";
  state.villagerView.speech = sayVillager(fillVillagerLine(favor.accept, id));
  sfx("talk");
  renderVillagerDialog();
  render();
  saveRun();
}

function completeFavor(id) {
  const favor = favorFor(id);
  const villager = VILLAGE.villagers[id];
  const record = villagerRecord(id);
  if (record.favor !== "open" || !removeInventoryItem(favor.item)) return;
  record.favor = "done";
  record.met = true;
  changeDisposition(id, 15);
  addInventoryItem(favor.reward);
  if (favor.faction && typeof changeFactionStanding === "function") {
    changeFactionStanding(favor.faction, 10, `you finish ${villager.name}'s favor`);
  }
  addLog(`You bring ${villager.name} the ${itemDetails(favor.item).name}. ${villager.name} gives you ${itemDetails(favor.reward).name}.`);
  sfx("gift");
  state.villagerView.mode = "menu";
  state.villagerView.speech = sayVillager(fillVillagerLine(favor.thanks, id));
  renderVillagerDialog();
  render();
  saveRun();
}

// Buttons for the villager menu.
function favorButtons(id, button) {
  const favor = favorFor(id);
  if (!favor) return;
  if (favorOffered(id)) {
    button("✦ They have a favor to ask", () => offerFavor(id), false);
  } else if (favorStatus(id) === "open") {
    if (carryingFavorItem(id)) {
      button(t("Give {0}", { 0: t(itemDetails(favor.item).name) }), () => completeFavor(id), false);
    } else {
      button("About that favor…", () => {
        state.villagerView.speech = sayVillager(fillVillagerLine(favor.waiting, id));
        renderVillagerDialog();
      });
    }
  }
}

// While a favor is open, put what it asks for on each new floor in its range.
function placeFavorItems(occupied = new Set()) {
  if (state.run.mapId !== GTFL_MAP_ID) return;
  const floor = state.run.dungeonFloor || 1;
  for (const id of openFavors()) {
    const favor = favorFor(id);
    if (floor < favor.floors[0] || floor > favor.floors[1] || inventoryQuantity(favor.item) > 0) continue;
    const rooms = state.run.rooms
      .map((room, index) => ({ room, index }))
      .filter(({ room, index }) => index > 0 && ["quiet", "treasure", "trap"].includes(room.type));
    const pick = rooms.length ? rooms[randomInt(rooms.length) - 1] : null;
    const spot = pick ? randomRoomFloor(pick.room, occupied) : null;
    if (!spot) continue;
    occupied.add(tileIndex(spot.x, spot.y));
    state.run.treasures.push({ id: `favor-${favor.id}-${floor}`, x: spot.x, y: spot.y, gold: 0, items: [{ id: favor.item, quantity: 1 }], favor: id });
  }
}

// Reward effects.
function carriesReward(id) {
  return inventoryQuantity(id) > 0;
}

function seedKernelSaves() {
  if (!carriesReward("seed-kernel") || state.run.location !== "dungeon") return false;
  state.run.relicRites ||= {};
  if (state.run.relicRites["seed-kernel"]) return false;
  state.run.relicRites["seed-kernel"] = true;
  state.run.hp = 1;
  addLog("Itzcoatl's seed kernel cracks in your pouch and green shoots spill out. You stay on your feet at 1 hit point.");
  showCombatFeedback("heal", "1 HP", { actor: "player", x: state.run.player.x, y: state.run.player.y });
  return true;
}

function starChartShows(x, y) {
  return carriesReward("star-chart") && state.run.location === "dungeon" &&
    (state.run.floorStairs || []).some((stair) => stair.x === x && stair.y === y);
}

function normalizeFavorRecord(entry) {
  return entry.favor === "open" || entry.favor === "done" ? entry.favor : null;
}

// Journal lines for open favors.
function favorJournalLines() {
  return openFavors().map((id) => `${t(favorFor(id).title)}: ${t(favorFor(id).hint)}`);
}
