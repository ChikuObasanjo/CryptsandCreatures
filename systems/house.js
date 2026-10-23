"use strict";

// The player's own house in Chiltomatlan: buy it once, sleep there like at the inn
// (with a small rested boon), change your look and name at the mirror, and spend
// big gold on new styles. Each style repaints the house in a different art tradition.
// State: state.run.house = { owned, style, styles: [owned style ids] }.

const HOUSE_PRICE = 300;
const HOUSE_STYLES = {
  calli: {
    name: "Adobe calli",
    art: "town-house-calli",
    price: 0,
    tradition: "Painted like the codices",
    description: "Sun-dried adobe, a thatched roof, and a little milpa by the door. Small, but yours.",
    boon: "steady"
  },
  tecpan: {
    name: "Noble tecpan",
    art: "town-house-tecpan",
    price: 5000,
    tradition: "Painted like the codices, in a lord's colors",
    description: "A lord's house on a stepped platform: red walls, a frieze of discs, and feather banners at the door.",
    boon: "hearty"
  },
  minka: {
    name: "Japanese minka",
    art: "town-house-minka",
    price: 7500,
    tradition: "Painted like an old Japanese scroll",
    description: "Built by carpenters who came with the galleons from across the western sea: dark tiles, shoji screens, a veranda, and a pine. Gold clouds drift across the painting.",
    boon: "keen-eyed"
  },
  casa: {
    name: "Spanish casa",
    art: "town-house-casa",
    price: 7500,
    tradition: "Illuminated like a medieval manuscript",
    description: "Whitewashed walls, a tiled roof, and a little tower, drawn as a sea giant's monk would draw it: on vellum, framed in gold leaf and ivy.",
    boon: "fiery"
  }
};

function houseState() {
  if (!state.run.house) state.run.house = createHouseState();
  return state.run.house;
}

function createHouseState() {
  return { owned: false, style: "calli", styles: [] };
}

function normalizeHouse(house) {
  if (!house || typeof house !== "object" || Array.isArray(house)) return createHouseState();
  const styles = Array.isArray(house.styles) ? [...new Set(house.styles.filter((id) => HOUSE_STYLES[id]))] : [];
  const owned = house.owned === true;
  if (owned && !styles.includes("calli")) styles.unshift("calli");
  const style = owned && styles.includes(house.style) ? house.style : "calli";
  return { owned, style, styles: owned ? styles : [] };
}

function houseArtUrl(style) {
  return `./resources/tiles/${HOUSE_STYLES[style]?.art || HOUSE_STYLES.calli.art}.png?v=${SPRITE_RESOURCE_VERSION}`;
}

function houseTiles() {
  const tiles = [];
  TOWN_MAP.forEach((row, y) => [...row].forEach((cell, x) => { if (cell === "H") tiles.push({ x, y }); }));
  return tiles;
}

function besideHouse(position = state.run.townPosition) {
  return houseTiles().some((tile) => townDistance(position, tile) === 1);
}

function moveTowardHouse() {
  const tiles = houseTiles();
  const nearest = tiles.sort((first, second) =>
    townDistance(state.run.townPosition, first) - townDistance(state.run.townPosition, second))[0];
  if (nearest) moveTowardTownNpc(nearest);
}

// ---------- Dialog ----------

function openHouse() {
  if (state.run.location !== "city") return;
  state.houseMessage = "";
  renderHouse();
  if (!elements["house-dialog"].open) elements["house-dialog"].showModal();
}

function buyHouse() {
  const house = houseState();
  if (house.owned) return;
  if (state.run.gold < HOUSE_PRICE) {
    state.houseMessage = `The house costs ${formatCurrency(HOUSE_PRICE)}. Bring back a little more treasure.`;
    renderHouse();
    return;
  }
  state.run.gold = roundGold(state.run.gold - HOUSE_PRICE);
  house.owned = true;
  house.style = "calli";
  house.styles = ["calli"];
  addLog("Tlacotl hands you the cord-knot key to a little adobe house. Chiltomatlan has a home for you now.");
  state.houseMessage = "The house is yours. Sleep here any time, and use the mirror to change your look.";
  render();
  renderHouse();
  saveRun();
}

function chooseHouseStyle(id) {
  const house = houseState();
  const style = HOUSE_STYLES[id];
  if (!house.owned || !style) return;
  if (!house.styles.includes(id)) {
    if (state.run.gold < style.price) {
      state.houseMessage = `${t(style.name)} costs ${formatCurrency(style.price)}.`;
      renderHouse();
      return;
    }
    state.run.gold = roundGold(state.run.gold - style.price);
    house.styles.push(id);
    addLog(`Builders rework your house into a ${t(style.name).toLowerCase()}.`);
  }
  house.style = id;
  state.houseMessage = `You move into your ${t(style.name).toLowerCase()}.`;
  render();
  renderHouse();
  saveRun();
}

function sleepAtHome() {
  const house = houseState();
  if (!house.owned) return;
  elements["house-dialog"].close();
  campAndRest();
  if (state.run.lost) return;
  grantBuff("steady");
  const boon = HOUSE_STYLES[house.style]?.boon;
  if (boon && boon !== "steady") grantBuff(boon);
  addLog("You wake rested in your own bed.");
  render();
  saveRun();
}

function renderHouse() {
  if (!elements["house-dialog"]) return;
  const house = houseState();
  const style = HOUSE_STYLES[house.style] || HOUSE_STYLES.calli;
  const dialog = elements["house-dialog"];
  dialog.dataset.style = house.owned ? house.style : "calli";
  elements["house-portrait"].src = houseArtUrl(house.owned ? house.style : "calli");
  elements["house-eyebrow"].textContent = t(house.owned ? "Your home in Chiltomatlan" : "For sale by Tlacotl");
  elements["house-title"].textContent = house.owned ? t(style.name) : t("An empty adobe house");
  elements["house-tagline"].textContent = house.owned ? t(style.tradition) : "A little house off the plaza, with a door that locks and a bed nobody else sleeps in.";
  renderPurses();
  const body = document.createDocumentFragment();

  if (!house.owned) {
    const card = document.createElement("article");
    card.className = "house-sale";
    const art = document.createElement("img");
    art.className = "house-sale-art";
    art.alt = "";
    art.src = houseArtUrl("calli");
    const copy = document.createElement("div");
    copy.className = "house-sale-copy";
    const list = document.createElement("ul");
    list.className = "house-perks";
    for (const text of [
      "Sleep here like at the inn: food, water, and wounds restored.",
      "Wake well rested: +1 AC for 8 hours, and fancier homes add more.",
      "A mirror where you can change your name, pronouns, and look.",
      "Rebuild it later as a noble tecpan, a Japanese minka, or a Spanish casa."
    ]) {
      const item = document.createElement("li");
      item.textContent = text;
      list.append(item);
    }
    const foot = document.createElement("div");
    foot.className = "project-foot";
    const price = document.createElement("span");
    price.className = `venue-price${state.run.gold < HOUSE_PRICE ? " is-short" : ""}`;
    price.textContent = formatCurrency(HOUSE_PRICE);
    const buy = document.createElement("button");
    buy.type = "button";
    buy.className = "button";
    buy.dataset.houseAction = "buy";
    buy.textContent = t("Buy the house");
    buy.disabled = state.run.gold < HOUSE_PRICE;
    foot.append(price, buy);
    copy.append(list, foot);
    card.append(art, copy);
    body.append(card);
  } else {
    const actions = document.createElement("div");
    actions.className = "house-actions";
    const boon = PROGRESSION.buffs[style.boon];
    const extra = style.boon !== "steady" && boon ? ` and ${t(boon.name)} (${t(boon.description).replace(/\.$/, "")})` : "";
    for (const [action, icon, title, text] of [
      ["sleep", "☾", "Sleep until rested", `Rest 8 hours. Wake with food, water, and wounds restored, Steady (+1 AC)${extra}.`],
      ["mirror", "◐", "The mirror", "Change your name, pronouns, and look."]
    ]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "house-action";
      button.dataset.houseAction = action;
      const mark = document.createElement("span");
      mark.className = "house-action-icon";
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = icon;
      const label = document.createElement("span");
      label.className = "house-action-copy";
      const strong = document.createElement("strong");
      strong.textContent = t(title);
      const small = document.createElement("small");
      small.textContent = t(text);
      label.append(strong, small);
      button.append(mark, label);
      actions.append(button);
    }
    body.append(actions);

    const heading = document.createElement("h3");
    heading.className = "house-section-title";
    heading.textContent = t("Rebuild your house");
    body.append(heading);
    const grid = document.createElement("div");
    grid.className = "house-styles";
    for (const [id, entry] of Object.entries(HOUSE_STYLES)) {
      const owned = house.styles.includes(id);
      const current = house.style === id;
      const card = document.createElement("article");
      card.className = `house-style-card${current ? " is-current" : ""}${owned ? " is-owned" : ""}`;
      card.dataset.styleCard = id;
      const art = document.createElement("img");
      art.alt = "";
      art.src = houseArtUrl(id);
      const name = document.createElement("strong");
      name.textContent = t(entry.name);
      const tradition = document.createElement("small");
      tradition.className = "house-style-tradition";
      tradition.textContent = t(entry.tradition);
      const description = document.createElement("small");
      description.textContent = t(entry.description);
      const foot = document.createElement("div");
      foot.className = "project-foot";
      const price = document.createElement("span");
      price.className = `venue-price${!owned && state.run.gold < entry.price ? " is-short" : ""}`;
      price.textContent = current ? t("Living here") : owned ? t("Owned") : formatCurrency(entry.price);
      const button = document.createElement("button");
      button.type = "button";
      button.className = owned ? "button secondary" : "button";
      button.dataset.houseStyle = id;
      button.textContent = t(current ? "Home" : owned ? "Move in" : "Rebuild");
      button.disabled = current || (!owned && state.run.gold < entry.price);
      foot.append(price, button);
      card.append(art, name, tradition, description, foot);
      grid.append(card);
    }
    body.append(grid);
  }
  const message = document.createElement("p");
  message.className = "shop-message";
  message.setAttribute("role", "status");
  message.textContent = state.houseMessage || "";
  body.append(message);
  elements["house-body"].replaceChildren(body);
}

// ---------- Mirror ----------

const MIRROR_FIELDS = [
  ["character-skin", "skin", "character-skin-label"], ["character-body", "body", "Build"],
  ["character-hair-style", "hairStyle", "Hair style"], ["character-crest", "crest", "character-crest-label"],
  ["character-hair", "hair", "character-hair-label"], ["character-tunic", "tunic", "Clothing color"],
  ["character-garment", "garment", "Garment"], ["character-adornment", "adornment", "Adornment"],
  ["character-headwear", "headwear", "Headwear"], ["character-face-paint", "facePaint", "Face paint"],
  ["character-beard", "beard", "Facial hair"], ["character-jewelry", "jewelry", "Jewelry"]
];

function openMirror() {
  const character = state.run.character;
  const race = character.race;
  // Reuse the builder's race-aware option lists so the mirror offers exactly the same choices.
  syncAppearanceOptions(race, character.appearance);
  const fields = document.createDocumentFragment();
  const nameLabel = document.createElement("label");
  nameLabel.textContent = t("Your name");
  const name = document.createElement("input");
  name.type = "text";
  name.maxLength = 24;
  name.value = character.name;
  name.dataset.mirrorField = "name";
  nameLabel.append(name);
  const pronounLabel = document.createElement("label");
  pronounLabel.textContent = t("Pronouns");
  const pronouns = elements["character-gender"].cloneNode(true);
  pronouns.removeAttribute("id");
  pronouns.value = character.gender;
  pronouns.dataset.mirrorField = "gender";
  pronounLabel.append(pronouns);
  fields.append(nameLabel, pronounLabel);
  for (const [id, key, labelSource] of MIRROR_FIELDS) {
    if (key === "crest" && !CREST_STYLES[race]) continue;
    if ((key === "hairStyle" || key === "beard") && race === "dragonborn") continue;
    const label = document.createElement("label");
    label.textContent = elements[labelSource]?.textContent || t(labelSource);
    const select = elements[id].cloneNode(true);
    select.removeAttribute("id");
    select.value = character.appearance[key] ?? elements[id].value;
    select.dataset.mirrorField = key;
    label.append(select);
    fields.append(label);
  }
  elements["mirror-fields"].replaceChildren(fields);
  elements["mirror-message"].textContent = "";
  updateMirrorPreview();
  elements["house-dialog"].close();
  elements["mirror-dialog"].showModal();
}

function mirrorDraft() {
  const character = state.run.character;
  const appearance = { ...character.appearance };
  let name = character.name;
  let gender = character.gender;
  for (const input of elements["mirror-fields"].querySelectorAll("[data-mirror-field]")) {
    const key = input.dataset.mirrorField;
    if (key === "name") name = input.value.trim();
    else if (key === "gender") gender = input.value;
    else appearance[key] = input.value;
  }
  return { ...character, name, gender, appearance: normalizeAppearance(appearance, character.race) };
}

function updateMirrorPreview() {
  const draft = mirrorDraft();
  elements["mirror-preview"].replaceChildren(createCodexCharacterSprite(draft, "mirror-sprite", "east"));
}

function saveMirror() {
  const draft = mirrorDraft();
  if (!draft.name || draft.name.length > 24) {
    elements["mirror-message"].textContent = "Choose a name of 1 to 24 characters.";
    return;
  }
  if (!GENDERS.includes(draft.gender)) return;
  const character = state.run.character;
  character.name = draft.name;
  character.gender = draft.gender;
  character.appearance = draft.appearance;
  addLog("You study yourself in the mirror and like what you see.");
  elements["mirror-dialog"].close();
  render();
  saveRun();
  showToast("Your new look is saved.");
}

function connectHouseEvents() {
  elements["house-dialog"].addEventListener("click", (event) => {
    if (event.target === elements["house-dialog"]) {
      elements["house-dialog"].close();
      return;
    }
    const action = event.target.closest("[data-house-action]")?.dataset.houseAction;
    if (action === "buy") buyHouse();
    else if (action === "sleep") sleepAtHome();
    else if (action === "mirror") openMirror();
    const style = event.target.closest("[data-house-style]")?.dataset.houseStyle;
    if (style) chooseHouseStyle(style);
  });
  elements["house-close"].addEventListener("click", () => elements["house-dialog"].close());
  elements["mirror-fields"].addEventListener("input", updateMirrorPreview);
  elements["mirror-fields"].addEventListener("change", updateMirrorPreview);
  elements["mirror-save"].addEventListener("click", saveMirror);
  elements["mirror-cancel"].addEventListener("click", () => {
    elements["mirror-dialog"].close();
    openHouse();
  });
}
