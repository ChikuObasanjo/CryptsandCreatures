"use strict";

// The picture on each action button, so the buttons can be told apart at a glance:
// arrows for stairs, your own weapon for attacks, a door for doorways, the well's water,
// and so on. An action can name its icon itself (`icon: "tokens/nest"`); otherwise it is
// worked out from what the button says.
//
// Icons are either a painting from resources/ ("items/clean-water") or one of the simple
// drawn glyphs below ("glyph:up"), drawn in the codex's thick-outline style.

const ACTION_GLYPHS = {
  up: "M12 3 L20 12 H15 V21 H9 V12 H4 Z",
  down: "M12 21 L4 12 H9 V3 H15 V12 H20 Z",
  home: "M3 11 L12 3 L21 11 V21 H14 V15 H10 V21 H3 Z",
  eye: "M2 12 C6 5 18 5 22 12 C18 19 6 19 2 12 Z M12 8.5 A3.5 3.5 0 1 0 12 15.5 A3.5 3.5 0 1 0 12 8.5 Z",
  wait: "M6 3 H18 M6 21 H18 M7 3 C7 9 17 9 17 12 C17 15 7 15 7 21 M17 3 C17 9 7 9 7 12 C7 15 17 15 17 21",
  cycle: "M4 9 H17 L14 6 M20 15 H7 L10 18",
  talk: "M3 5 H21 V16 H10 L5 20 V16 H3 Z",
  hand: "M8 21 V11 M8 11 V5 A1.5 1.5 0 0 1 11 5 V11 M11 10 V4 A1.5 1.5 0 0 1 14 4 V11 M14 10 V5.5 A1.5 1.5 0 0 1 17 5.5 V14 C17 18 15 21 11 21 H8 C6 21 4 19 4 16 V12 A1.5 1.5 0 0 1 7 12"
};

// What a button says → which picture it gets. First match wins.
const ACTION_ICON_RULES = [
  [/^(Attack|Hunt)\b/, "weapon"],
  [/^Descend/, "glyph:down"],
  [/^(Ascend|Ride the lift)/, "glyph:up"],
  [/^(Return to Chiltomatlan|Return to entrance|Leave the conquered|Approach the exit|Enter the tomb)/, "glyph:home"],
  [/doorway/i, "tokens/door-open"],
  [/trap|^Disarm/i, "tokens/hazard-found"],
  [/water|^Drink/i, "items/clean-water"],
  [/treasure|\d+ gp\b/i, "items/coin-pile"],
  [/^Butcher/, "tokens/carcass"],
  [/eggs/i, "tokens/nest"],
  [/earth's mouth/i, "tokens/earth-mouth"],
  [/alux/i, "tokens/alux-house"],
  [/chaneque|duende/i, "tokens/duende-friend"],
  [/offering|^Offer|gift/i, "tokens/offering"],
  [/summit cap|mushroom|glowcap/i, "tokens/fungus-patch"],
  [/camp/i, "tokens/campfire"],
  [/^Medicine/, "items/healing-potion"],
  [/^Eat/, "items/ration"],
  [/^Search/, "glyph:eye"],
  [/^Wait/, "glyph:wait"],
  [/^Talk/, "glyph:talk"]
];

function actionIconName(label = "", explicit = "") {
  if (explicit) return explicit;
  const text = String(label);
  for (const [pattern, icon] of ACTION_ICON_RULES) if (pattern.test(text)) return icon;
  return "glyph:hand";
}

function actionIconElement(name) {
  if (name === "weapon") {
    const weapon = state.run?.character?.equipment?.weapon;
    name = weapon ? `weapon:${weapon}` : "items/weapon";
  }
  if (name.startsWith("glyph:")) {
    const path = ACTION_GLYPHS[name.slice(6)] || ACTION_GLYPHS.hand;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", `action-svg action-svg-${name.slice(6)}`);
    const shape = document.createElementNS("http://www.w3.org/2000/svg", "path");
    shape.setAttribute("d", path);
    svg.append(shape);
    return svg;
  }
  const image = document.createElement("img");
  image.alt = "";
  image.draggable = false;
  if (name.startsWith("weapon:")) {
    image.src = itemArtUrl(name);
    // A weapon without its own painting yet falls back to the shared one.
    image.addEventListener("error", () => { image.src = `./resources/items/weapon.png?v=${SPRITE_RESOURCE_VERSION}`; }, { once: true });
  } else {
    image.src = `./resources/${name}.png?v=${SPRITE_RESOURCE_VERSION}`;
  }
  return image;
}
