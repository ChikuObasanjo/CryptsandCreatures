"use strict";

// The equipment sheet: a paper-doll of everything your adventurer wears and wields.
// Slots sit around a large portrait; tap a slot to see what in your pack fits it,
// put something on, or take it off. The Pack tab keeps everything else.

const EQUIPMENT_SLOTS = [
  { id: "head", label: "Head", side: "left", wear: "helmet" },
  { id: "neck", label: "Neck", side: "left", wear: "neck" },
  { id: "body", label: "Body", side: "left", wear: "clothes" },
  { id: "back", label: "On the back", side: "left", wear: "back" },
  { id: "armor", label: "Armor", side: "right", gear: "armor" },
  { id: "cloak", label: "Cloak", side: "right", gear: "cloak" },
  { id: "main", label: "Main hand", side: "right", gear: "weapon" },
  { id: "off", label: "Off hand", side: "right", gear: "shield" }
];

// The item id in a slot, or null.
function equippedInSlot(slot) {
  const character = state.run.character;
  if (slot.wear) {
    const id = character.cosmetics?.[slot.wear];
    return id ? `wear:${id}` : null;
  }
  const equipment = character.equipment;
  if (slot.gear === "weapon") return equipment.weapon && equipment.weapon !== "none" ? `weapon:${equipment.weapon}` : null;
  if (slot.gear === "armor") return equipment.armor && equipment.armor !== "none" ? `armor:${equipment.armor}` : null;
  if (slot.gear === "shield") return equipment.shield ? "shield" : null;
  if (slot.gear === "cloak") return equipment.cloak ? "travel-cloak" : null;
  return null;
}

// Carried items that could go in a slot.
function itemsForSlot(slot) {
  return state.run.inventory.map((entry) => entry.id).filter((id) => {
    const item = itemDetails(id);
    if (!item) return false;
    if (slot.wear) return item.slot === "wear" && item.wearSlot === slot.wear;
    return item.slot === slot.gear;
  });
}

function equipmentIconFor(itemId) {
  return itemArtUrl(itemId);
}

function equipmentSlotButton(slot) {
  const itemId = equippedInSlot(slot);
  const item = itemId ? itemDetails(itemId) : null;
  const button = document.createElement("button");
  button.type = "button";
  button.className = `equip-slot${item ? " is-filled" : ""}${state.equipmentSlot === slot.id ? " is-open" : ""}`;
  button.dataset.equipSlot = slot.id;
  const icon = document.createElement("span");
  icon.className = "equip-slot-icon";
  if (item) {
    icon.append(itemArtImage(itemId));
  }
  const copy = document.createElement("span");
  copy.className = "equip-slot-copy";
  const label = document.createElement("small");
  label.textContent = t(slot.label);
  const name = document.createElement("strong");
  name.textContent = item ? item.name : t("Empty");
  copy.append(label, name);
  button.append(icon, copy);
  button.title = item ? `${t(slot.label)}: ${item.name}` : `${t(slot.label)}: ${t("Empty")}`;
  return button;
}

function renderEquipmentSheet() {
  const root = document.getElementById("equipment-sheet");
  if (!root || !state.run?.character) return;
  const character = state.run.character;
  const left = document.createElement("div");
  left.className = "equip-column";
  const right = document.createElement("div");
  right.className = "equip-column";
  for (const slot of EQUIPMENT_SLOTS) (slot.side === "left" ? left : right).append(equipmentSlotButton(slot));
  const doll = document.createElement("div");
  doll.className = "equip-doll";
  doll.append(createCodexCharacterSprite(character, "equip-doll-sprite", "east"));
  const stats = currentCharacterStats();
  const mods = typeof heroStatModifiers === "function" ? heroStatModifiers() : { attack: 0, damage: 0, ac: 0 };
  const damageBonus = stats.damageBonus + mods.damage;
  const strip = document.createElement("div");
  strip.className = "equip-stats";
  for (const [label, value] of [
    ["AC", stats.ac + mods.ac],
    ["Attack", `${stats.attackBonus + mods.attack >= 0 ? "+" : ""}${stats.attackBonus + mods.attack}`],
    ["Damage", `${stats.damageDice}${damageBonus ? `${damageBonus > 0 ? "+" : "−"}${Math.abs(damageBonus)}` : ""}${typeof equippedStrike === "function" ? ` · ${t(STRIKE_KINDS[equippedStrike()].name)}` : ""}`],
    ["Load", `${formatWeight(getCarriedWeight())} / ${getCarryCapacity()} lb`]
  ]) {
    const cell = document.createElement("span");
    const name = document.createElement("small");
    name.textContent = t(label);
    const number = document.createElement("strong");
    number.textContent = String(value);
    cell.append(name, number);
    strip.append(cell);
  }
  const grid = document.createElement("div");
  grid.className = "equip-grid";
  grid.append(left, doll, right);
  const parts = [grid, strip];
  const open = EQUIPMENT_SLOTS.find((slot) => slot.id === state.equipmentSlot);
  if (open) parts.push(equipmentPicker(open));
  root.replaceChildren(...parts);
}

function equipmentPicker(slot) {
  const panel = document.createElement("div");
  panel.className = "equip-picker";
  const heading = document.createElement("div");
  heading.className = "equip-picker-heading";
  const title = document.createElement("strong");
  title.textContent = t(slot.label);
  const close = document.createElement("button");
  close.type = "button";
  close.className = "quiet-button";
  close.dataset.equipClose = "1";
  close.textContent = "×";
  close.setAttribute("aria-label", t("Close"));
  heading.append(title, close);
  panel.append(heading);
  const current = equippedInSlot(slot);
  const options = itemsForSlot(slot);
  const list = document.createElement("div");
  list.className = "equip-picker-list";
  for (const itemId of options) {
    const item = itemDetails(itemId);
    const row = document.createElement("button");
    row.type = "button";
    row.className = `equip-option${itemId === current ? " is-current" : ""}`;
    const usable = canEquipItem(item);
    row.disabled = itemId === current || !usable;
    row.dataset.equipItem = itemId;
    const image = itemArtImage(itemId);
    const copy = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = item.name;
    const note = document.createElement("small");
    note.textContent = itemId === current ? t("Worn now")
      : !usable ? (item.strength && state.run.character.scores.str < item.strength ? `Needs Strength ${item.strength}` : t("Your calling isn't trained with this"))
        : slot.gear === "weapon" ? `${item.category}${item.description ? ` · ${item.description}` : ""}` : item.description || item.category;
    copy.append(name, note);
    row.append(image, copy);
    list.append(row);
  }
  if (!options.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = t("Nothing in your pack fits here.");
    list.append(empty);
  }
  panel.append(list);
  if (current && slot.gear !== "weapon") {
    const off = document.createElement("button");
    off.type = "button";
    off.className = "button secondary";
    off.dataset.unequipItem = current;
    off.textContent = t("Take off");
    panel.append(off);
  }
  return panel;
}

function connectEquipmentSheet() {
  const root = document.getElementById("equipment-sheet");
  if (!root) return;
  root.addEventListener("click", (event) => {
    const slot = event.target.closest("[data-equip-slot]");
    if (slot) {
      state.equipmentSlot = state.equipmentSlot === slot.dataset.equipSlot ? null : slot.dataset.equipSlot;
      renderEquipmentSheet();
      return;
    }
    if (event.target.closest("[data-equip-close]")) {
      state.equipmentSlot = null;
      renderEquipmentSheet();
      return;
    }
    const equip = event.target.closest("[data-equip-item]");
    if (equip) {
      equipInventoryItem(equip.dataset.equipItem);
      state.equipmentSlot = null;
      saveRun();
      render();
      return;
    }
    const unequip = event.target.closest("[data-unequip-item]");
    if (unequip) {
      unequipInventoryItem(unequip.dataset.unequipItem);
      state.equipmentSlot = null;
      saveRun();
      render();
    }
  });
}
