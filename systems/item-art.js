"use strict";

// Every unique item has its own art file in resources/items/, so each can be repainted
// on its own. Replace the PNG and bump SPRITE_RESOURCE_VERSION in app.js.
//
//   gear, food, treasure, tools ..... resources/items/<item id>.png      e.g. torch.png
//   weapons ......................... resources/items/weapon-<id>.png    e.g. weapon-katana.png
//   armor ........................... resources/items/armor-<id>.png     e.g. armor-o-yoroi.png
//   clothes, helmets, neck, banners . resources/items/wear-<id>.png      e.g. wear-jaguar-helmet.png
//
// Fine, masterwork, and relic versions of a weapon or armor share the base item's file.
// If a file is missing, the old shared icon is drawn instead, so nothing breaks.

function itemArtFile(itemId) {
  const separator = itemId.indexOf(":");
  const kind = separator >= 0 ? itemId.slice(0, separator) : null;
  const base = (separator >= 0 ? itemId.slice(separator + 1) : itemId).split("--")[0];
  return kind === "weapon" || kind === "armor" || kind === "wear" ? `${kind}-${base}` : base;
}

function itemArtUrl(itemId) {
  return `./resources/items/${itemArtFile(itemId)}.png?v=${SPRITE_RESOURCE_VERSION}`;
}

// The pre-v20 icon for an item: generated codex drawings for gear, shared PNGs for the rest.
function fallbackItemIconUrl(itemId) {
  const item = typeof itemDetails === "function" ? itemDetails(itemId) : null;
  if (!item) return `./resources/items/supply.png?v=${SPRITE_RESOURCE_VERSION}`;
  if (typeof codexGearIconUrl === "function") {
    if (item.slot === "wear") return codexGearIconUrl(item.wearSlot, item.cosmeticId);
    if (item.slot === "weapon" && item.equipmentId && item.equipmentId !== "none") return codexGearIconUrl("weapon", item.equipmentId);
    if (item.slot === "armor" && item.equipmentId && item.equipmentId !== "none") return codexGearIconUrl("armor", item.equipmentId);
  }
  const sprite = item.sprite || inventoryIconFile({ ...item, id: itemId });
  const folder = typeof RARE_TREASURE_SPRITES !== "undefined" && RARE_TREASURE_SPRITES.includes(sprite) ? "enemies" : "items";
  return `./resources/${folder}/${sprite}.png?v=${SPRITE_RESOURCE_VERSION}`;
}

// Point an <img> at an item's art, falling back to the old icon if the file is missing.
function setItemArt(image, itemId) {
  image.onerror = () => {
    image.onerror = () => {
      image.onerror = null;
      image.src = `./resources/items/supply.png?v=${SPRITE_RESOURCE_VERSION}`;
    };
    image.src = fallbackItemIconUrl(itemId);
  };
  image.src = itemArtUrl(itemId);
  return image;
}

function itemArtImage(itemId, className = "") {
  const image = document.createElement("img");
  image.alt = "";
  image.draggable = false;
  if (className) image.className = className;
  return setItemArt(image, itemId);
}
