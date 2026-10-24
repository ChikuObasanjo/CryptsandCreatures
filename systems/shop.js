"use strict";

// The trading screen shared by every vendor: a catalog grid of item cards with
// rarity frames, category chips, and a detail panel with a try-on preview,
// stat comparison, and quantity stepper. Teyac's market buys and sells;
// Mahuiz sells foreign arms, armor, and regalia that unlock as you delve deeper.

const SHOP_VENDORS = {
  market: {
    title: "Teyac's market",
    keeper: "Teyac, market trader",
    portrait: "merchant.png",
    tagline: "Food, water, remedies, and trail gear, and a fair price for anything you bring back from the tomb.",
    canSell: true,
    categories: [
      ["all", "All", "kit"], ["provisions", "Provisions", "ration"], ["remedies", "Remedies", "potion"],
      ["tools", "Trail gear", "tool"], ["wardrobe", "Wardrobe", "clothing"], ["weapons", "Weapons", "weapon"], ["armor", "Armor", "armor"]
    ],
    sellCategories: [
      ["all", "All", "kit"], ["treasure", "Treasure", "treasure"], ["provisions", "Provisions", "ration"],
      ["tools", "Trail gear", "tool"], ["wardrobe", "Wardrobe", "clothing"], ["weapons", "Weapons", "weapon"], ["armor", "Armor", "armor"]
    ]
  },
  mahuiz: {
    title: "Mahuiz's strange wares",
    keeper: "Mahuiz, trader in strange wares",
    portrait: "gear-mender.png",
    tagline: "Steel from the sea giants' floating houses. Silk-laced armor from across the western sea. Don't ask how it got here.",
    canSell: false,
    categories: [
      ["all", "All wares", "kit"], ["spanish", "Spanish steel", "icon:helmet:morion-helmet"],
      ["samurai", "Samurai arms", "icon:helmet:kabuto-helmet"], ["regalia", "Regalia", "icon:helmet:jaguar-helmet"]
    ]
  }
};

const RARITY_LABELS = {
  common: "Common", fine: "Fine", masterwork: "Masterwork", relic: "Relic", exotic: "Exotic"
};

function shopState() {
  if (!state.shop) state.shop = { vendor: "market", view: "buy", category: "all", selected: null, quantity: 1 };
  return state.shop;
}

function openShop(vendor = "market", category = "all") {
  if (!state.run || !["city", "store"].includes(state.run.location)) return;
  document.querySelectorAll("dialog[open]").forEach((dialog) => {
    if (["town-dialog", "cosmetic-shop-dialog"].includes(dialog.id)) dialog.close();
  });
  state.shop = { vendor, view: "buy", category, selected: null, quantity: 1, message: "" };
  state.run.location = "store";
  render();
  elements["store-screen"].scrollTop = 0;
}

// ---------- Catalog entries ----------

function shopIconUrl(entry) {
  if (entry.kind === "cosmetic") return codexGearIconUrl(COSMETICS[entry.cosmeticId].slot, entry.cosmeticId);
  const item = entry.item;
  if (item.slot === "wear") return codexGearIconUrl(item.wearSlot, item.cosmeticId);
  if (item.slot === "weapon") return codexGearIconUrl("weapon", item.equipmentId);
  if (item.slot === "armor") return codexGearIconUrl("armor", item.equipmentId);
  const sprite = item.sprite || inventoryIconFile(item);
  const folder = RARE_TREASURE_SPRITES.includes(sprite) ? "enemies" : "items";
  return `./resources/${folder}/${sprite}.png?v=${SPRITE_RESOURCE_VERSION}`;
}

function shopCategoryFor(entry, vendor) {
  if (entry.kind === "cosmetic") return "regalia";
  const item = entry.item;
  if (vendor === "mahuiz") {
    const origin = (item.slot === "weapon" ? WEAPONS : ARMORS)[item.equipmentId]?.origin;
    return origin || "regalia";
  }
  if (item.slot === "wear") return "wardrobe";
  if (item.categoryId === "Treasure" || item.categoryId === "Keepsake") return "treasure";
  if (item.slot === "weapon") return "weapons";
  if (item.slot === "armor" || item.slot === "shield" || item.categoryId === "Clothing") return "armor";
  if (["Food", "Drink"].includes(item.categoryId) || FOOD_ITEMS[item.id]) return "provisions";
  if (item.categoryId === "Potion") return "remedies";
  return "tools";
}

function shopEntry(id, vendor, view) {
  if (id.startsWith("cosmetic:")) {
    const cosmeticId = id.slice("cosmetic:".length);
    const cosmetic = COSMETICS[cosmeticId];
    if (!cosmetic) return null;
    const cosmetics = state.run.character.cosmetics || { owned: [], helmet: null, clothes: null };
    const unlockFloor = cosmetic.unlockFloor || 0;
    return {
      id, kind: "cosmetic", cosmeticId, name: t(cosmetic.name), description: t(cosmetic.description),
      price: cosmetic.price, weight: 0, rarity: "exotic",
      owned: inventoryQuantity(`wear:${cosmeticId}`) > 0, equipped: cosmetics[cosmetic.slot] === cosmeticId,
      locked: progress().deepestFloor < unlockFloor, unlockFloor,
      typeLabel: cosmetic.slot === "helmet" ? "Regalia · head" : cosmetic.slot === "back" ? "Regalia · banner" : "Regalia · clothing"
    };
  }
  const item = itemDetails(id);
  if (!item) return null;
  const gear = item.slot === "weapon" ? WEAPONS[item.equipmentId] : item.slot === "armor" ? ARMORS[item.equipmentId] : null;
  const unlockFloor = gear?.unlockFloor || 0;
  const carried = inventoryQuantity(id);
  return {
    id, kind: "item", item, name: item.name, description: item.description || "",
    price: view === "sell" ? storeSellPrice(item) : vendor === "mahuiz" ? item.price : storeBuyPrice(item),
    weight: item.weight,
    rarity: item.exotic ? "exotic" : item.tier || (gear?.exotic ? "exotic" : "common"),
    carried, equipped: isEquipped(id),
    sellable: view === "sell" ? carried - (isEquipped(id) ? 1 : 0) : 0,
    locked: view === "buy" && progress().deepestFloor < unlockFloor, unlockFloor,
    typeLabel: item.slot === "weapon" ? `Weapon · ${WEAPONS[item.equipmentId]?.dice || ""}${WEAPONS[item.equipmentId]?.ranged ? " · ranged" : ""}`
      : item.slot === "armor" ? "Armor" : item.category
  };
}

function shopCatalog() {
  const shop = shopState();
  const vendor = shop.vendor;
  let ids;
  if (shop.view === "sell") {
    ids = state.run.inventory
      .filter((entry) => entry.id !== "dungeon-gourmet-guide" && entry.quantity > (isEquipped(entry.id) ? 1 : 0))
      .map((entry) => entry.id);
  } else if (vendor === "mahuiz") {
    ids = window.CryptsExotics.vendorStock;
  } else {
    ids = shopStock();
  }
  const entries = ids.map((id) => shopEntry(id, vendor, shop.view)).filter(Boolean);
  for (const entry of entries) entry.category = shopCategoryFor(entry, vendor);
  return entries;
}

function shopVisibleEntries() {
  const shop = shopState();
  const all = shopCatalog();
  const visible = shop.category === "all" ? all : all.filter((entry) => entry.category === shop.category);
  const rank = { common: 0, fine: 1, masterwork: 2, relic: 3, exotic: 4 };
  if (shop.vendor === "mahuiz") visible.sort((a, b) => Number(a.locked) - Number(b.locked) || a.price - b.price);
  else if (shop.view === "sell") visible.sort((a, b) => (rank[b.rarity] - rank[a.rarity]) || b.price - a.price);
  return { all, visible };
}

// ---------- Quantities and comparisons ----------

function shopMaxQuantity(entry) {
  const shop = shopState();
  if (!entry || entry.locked) return 0;
  if (shop.view === "sell") return Math.max(0, entry.sellable);
  if (entry.kind === "cosmetic") return entry.owned ? 0 : state.run.gold >= entry.price ? 1 : 0;
  if (entry.id === "dungeon-gourmet-guide") return state.run.gourmetGuideOwned ? 0 : state.run.gold >= entry.price ? 1 : 0;
  const byGold = Math.floor(state.run.gold / entry.price + 1e-9);
  const perUnit = entry.weight;
  const room = getCarryCapacity(state.run.character) - getCarriedWeight();
  const byWeight = perUnit <= 0 ? 99 : Math.floor((room + 1e-9) / perUnit);
  const limit = entry.item.slot ? 1 : 99;
  return Math.max(0, Math.min(byGold, byWeight, limit));
}

function shopStatsWith(override) {
  const character = state.run.character;
  const candidate = { ...character, equipment: { ...character.equipment, ...override } };
  const stats = deriveCharacter(withNeedsPenalty(candidate, state.run.needs), state.run.level);
  const mods = heroStatModifiers();
  const damageBonus = stats.damageBonus + mods.damage;
  return {
    attack: stats.attackBonus + mods.attack,
    damage: `${stats.damageDice}${damageBonus ? `${damageBonus > 0 ? "+" : "−"}${Math.abs(damageBonus)}` : ""}`,
    ac: stats.ac + mods.ac
  };
}

function shopComparison(entry) {
  if (entry.kind !== "item" || !["weapon", "armor"].includes(entry.item.slot)) return [];
  const current = shopStatsWith({});
  const next = shopStatsWith({ [entry.item.slot]: entry.item.equipmentId });
  const signed = (value) => `${value >= 0 ? "+" : "−"}${Math.abs(value)}`;
  if (entry.item.slot === "weapon") {
    return [
      { label: "Attack", from: signed(current.attack), to: signed(next.attack), delta: next.attack - current.attack },
      { label: "Damage", from: current.damage, to: next.damage, delta: 0, neutral: current.damage === next.damage ? "same" : "" }
    ];
  }
  return [{ label: "Armor class", from: String(current.ac), to: String(next.ac), delta: next.ac - current.ac }];
}

// ---------- Actions ----------

function shopSetMessage(text) {
  shopState().message = text;
  if (elements["shop-message"]) elements["shop-message"].textContent = text;
}

function shopBuy(id, quantity, equip = false) {
  const shop = shopState();
  const entry = shopEntry(id, shop.vendor, "buy");
  if (!entry || entry.locked) return;
  if (entry.kind === "cosmetic") {
    shopBuyCosmetic(entry);
    return;
  }
  const amount = Math.max(1, Math.min(quantity, shopMaxQuantity(entry)));
  if (!shopMaxQuantity(entry)) {
    shopSetMessage(state.run.gold < entry.price ? `You need ${formatCurrency(entry.price)} for ${entry.name}.`
      : `There is no room in your pack for ${entry.name}.`);
    renderShopScreen();
    return;
  }
  let bought = 0;
  for (let index = 0; index < amount; index += 1) {
    if (state.run.gold < entry.price) break;
    state.run.gold = roundGold(state.run.gold - entry.price);
    if (!addInventoryItem(id)) {
      state.run.gold = roundGold(state.run.gold + entry.price);
      break;
    }
    bought += 1;
  }
  if (!bought) return;
  if (id === "dungeon-gourmet-guide") state.run.gourmetGuideOwned = true;
  const total = roundGold(entry.price * bought);
  sfx("coins");
  addLog(`You buy ${bought > 1 ? `${bought} × ` : ""}${entry.name} from ${shop.vendor === "mahuiz" ? "Mahuiz" : "Teyac"} for ${formatCurrency(total)}.`);
  let message = `Bought ${bought > 1 ? `${bought} × ` : ""}${entry.name} for ${formatCurrency(total)}.`;
  if (equip && entry.item.slot && canEquipItem(entry.item)) {
    equipInventoryItem(id);
    message += " Equipped.";
  }
  shop.quantity = 1;
  shopSetMessage(message);
  render();
}

function shopBuyCosmetic(entry) {
  const character = state.run.character;
  if (!character.cosmetics) character.cosmetics = { owned: [], helmet: null, clothes: null };
  const cosmetic = COSMETICS[entry.cosmeticId];
  if (!entry.owned) {
    if (state.run.gold < cosmetic.price) {
      shopSetMessage(`You need ${formatCurrency(cosmetic.price)} for ${entry.name}.`);
      renderShopScreen();
      return;
    }
    if (!addInventoryItem(`wear:${entry.cosmeticId}`)) {
      shopSetMessage(`There is no room in your pack for ${entry.name}.`);
      renderShopScreen();
      return;
    }
    state.run.gold = roundGold(state.run.gold - cosmetic.price);
    if (!character.cosmetics.owned.includes(entry.cosmeticId)) character.cosmetics.owned.push(entry.cosmeticId);
    sfx("coins");
    addLog(`You buy ${entry.name} from Mahuiz for ${formatCurrency(cosmetic.price)}.`);
  }
  character.cosmetics[cosmetic.slot] = entry.equipped ? null : entry.cosmeticId;
  shopSetMessage(entry.equipped ? `${entry.name} put away.` : entry.owned ? `${entry.name} equipped.` : `Bought and equipped ${entry.name}.`);
  render();
}

function shopSell(id, quantity) {
  const entry = shopEntry(id, "market", "sell");
  if (!entry || entry.sellable < 1) return;
  const amount = Math.max(1, Math.min(quantity, entry.sellable));
  let sold = 0;
  let received = 0;
  for (let index = 0; index < amount; index += 1) {
    if (!removeInventoryItem(id)) break;
    received = roundGold(received + addGoldWithinCapacity(entry.price));
    sold += 1;
  }
  if (!sold) return;
  addLog(`You sell ${sold > 1 ? `${sold} × ` : ""}${entry.name} for ${formatCurrency(received)}.`);
  if (entry.item.categoryId === "Treasure") {
    changeFactionStanding("traders-circle", Math.min(10, 2 * sold), `you sell ${entry.name} through Teyac's market`);
  }
  shopState().quantity = 1;
  if (!inventoryQuantity(id) || inventoryQuantity(id) <= (isEquipped(id) ? 1 : 0)) shopState().selected = null;
  sfx("coins");
  shopSetMessage(`Sold ${sold > 1 ? `${sold} × ` : ""}${entry.name} for ${formatCurrency(received)}.`);
  render();
}

function shopSellAllTreasure() {
  const treasures = state.run.inventory.filter((entry) => itemDetails(entry.id)?.categoryId === "Treasure");
  if (!treasures.length) return;
  let total = 0;
  let count = 0;
  for (const entry of [...treasures]) {
    const item = itemDetails(entry.id);
    const price = storeSellPrice(item);
    const quantity = entry.quantity;
    for (let index = 0; index < quantity; index += 1) {
      if (!removeInventoryItem(item.id)) break;
      total = roundGold(total + addGoldWithinCapacity(price));
      count += 1;
    }
  }
  addLog(`You sell ${count} treasure${count === 1 ? "" : "s"} to Teyac for ${formatCurrency(total)}.`);
  changeFactionStanding("traders-circle", Math.min(10, 2 * count), "you sell recovered treasure through Teyac's market");
  shopState().selected = null;
  sfx("gold");
  shopSetMessage(`Sold ${count} treasure${count === 1 ? "" : "s"} for ${formatCurrency(total)}.`);
  render();
}

// ---------- Rendering ----------

function shopIconImage(entry, className) {
  const image = document.createElement("img");
  image.className = className;
  image.alt = "";
  image.draggable = false;
  return setItemArt(image, entry.kind === "cosmetic" ? `wear:${entry.cosmeticId}` : entry.id);
}

function categoryIcon(icon) {
  const image = document.createElement("img");
  image.alt = "";
  image.className = "shop-chip-icon";
  if (icon.startsWith("icon:")) {
    const [, kind, id] = icon.split(":");
    image.src = codexGearIconUrl(kind, id);
  } else {
    image.src = `./resources/items/${icon}.png?v=${SPRITE_RESOURCE_VERSION}`;
  }
  return image;
}

function renderShopScreen() {
  const shop = shopState();
  const vendor = SHOP_VENDORS[shop.vendor] || SHOP_VENDORS.market;
  if (!vendor.canSell) shop.view = "buy";
  const screen = elements["store-screen"];
  screen.dataset.vendor = shop.vendor;
  screen.dataset.storeView = shop.view;

  // Header.
  elements["shop-portrait"].src = `./resources/tokens/${vendor.portrait}?v=${SPRITE_RESOURCE_VERSION}`;
  elements["shop-title"].textContent = t(vendor.title);
  elements["shop-keeper"].textContent = t(vendor.keeper);
  elements["shop-tagline"].textContent = t(vendor.tagline);
  elements["shop-purse"].textContent = formatCurrency(state.run.gold);
  const carried = getCarriedWeight();
  const capacity = getCarryCapacity(state.run.character);
  elements["shop-load-text"].textContent = `${formatWeight(Math.round(carried * 10) / 10)} / ${capacity} lb`;
  elements["shop-load-fill"].style.width = `${Math.min(100, (carried / capacity) * 100)}%`;
  elements["shop-load-fill"].parentElement.classList.toggle("is-heavy", carried / capacity > 0.85);
  const discount = shop.vendor === "market" ? traderDiscountRate() : 0;
  elements["shop-perks"].textContent = [
    discount ? `Pochteca rate ${Math.round(discount * 100)}% off` : "",
    shop.vendor === "market" && projectLevel("trade-hall") >= 1 ? "Trade hall: treasure +10%" : "",
    shop.vendor === "market" && inventoryQuantity("gold-ring") ? "Gold ring: sales +10%" : "",
    shop.vendor === "mahuiz" ? `Deepest floor reached: ${progress().deepestFloor}` : ""
  ].filter(Boolean).join(" · ");

  // Tabs.
  elements["shop-tabs"].hidden = !vendor.canSell;
  document.querySelectorAll("[data-shop-view]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.shopView === shop.view));
  });

  // Categories.
  const categories = shop.view === "sell" && vendor.sellCategories ? vendor.sellCategories : vendor.categories;
  if (!categories.some(([key]) => key === shop.category)) shop.category = "all";
  const { all, visible } = shopVisibleEntries();
  elements["shop-categories"].replaceChildren(...categories.map(([key, label, icon]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "shop-chip";
    button.dataset.shopCategory = key;
    button.setAttribute("aria-pressed", String(shop.category === key));
    const count = key === "all" ? all.length : all.filter((entry) => entry.category === key).length;
    const text = document.createElement("span");
    text.textContent = t(label);
    const badge = document.createElement("small");
    badge.textContent = String(count);
    button.append(categoryIcon(icon), text, badge);
    button.disabled = count === 0 && key !== "all";
    return button;
  }));

  // Grid.
  elements["shop-sell-all"].hidden = shop.view !== "sell" ||
    !state.run.inventory.some((entry) => itemDetails(entry.id)?.categoryId === "Treasure");
  if (shop.selected && !all.some((entry) => entry.id === shop.selected)) shop.selected = null;
  const grid = document.createDocumentFragment();
  for (const entry of visible) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `shop-card rarity-${entry.rarity}${entry.locked ? " is-locked" : ""}${shop.selected === entry.id ? " is-selected" : ""}`;
    card.dataset.shopItem = entry.id;
    card.setAttribute("aria-pressed", String(shop.selected === entry.id));
    const art = document.createElement("span");
    art.className = "shop-card-art";
    art.append(shopIconImage(entry, "shop-card-icon"));
    if (entry.locked) {
      const lock = document.createElement("span");
      lock.className = "shop-card-lock";
      lock.textContent = `Floor ${entry.unlockFloor}`;
      art.append(lock);
    }
    const name = document.createElement("strong");
    name.className = "shop-card-name";
    name.textContent = entry.locked ? "Covered by a cloth" : entry.name;
    const meta = document.createElement("span");
    meta.className = "shop-card-meta";
    meta.textContent = entry.locked ? `Reach floor ${entry.unlockFloor}` : entry.typeLabel;
    const price = document.createElement("span");
    price.className = "shop-price";
    price.textContent = shop.view === "buy" && entry.kind === "cosmetic" && entry.owned
      ? (entry.equipped ? "Worn" : "Owned") : formatCurrency(entry.price);
    const affordable = shop.view === "sell" || entry.locked || (entry.kind === "cosmetic" && entry.owned) || state.run.gold >= entry.price;
    price.classList.toggle("is-short", !affordable);
    card.append(art, name, meta, price);
    const badge = entry.equipped ? "Equipped" : entry.kind === "item" && entry.carried ? `×${shop.view === "sell" ? entry.sellable : entry.carried}` : "";
    if (badge) {
      const tag = document.createElement("span");
      tag.className = `shop-card-badge${entry.equipped ? " is-equipped" : ""}`;
      tag.textContent = badge;
      card.append(tag);
    }
    card.setAttribute("aria-label", `${entry.locked ? `Locked until floor ${entry.unlockFloor}` : entry.name}, ${RARITY_LABELS[entry.rarity]}, ${formatCurrency(entry.price)}`);
    grid.append(card);
  }
  if (!visible.length) {
    const empty = document.createElement("p");
    empty.className = "shop-empty";
    empty.textContent = shop.view === "sell" ? "Nothing in your pack to sell here." : "Nothing on these shelves right now.";
    grid.append(empty);
  }
  elements["shop-grid"].replaceChildren(grid);
  renderShopDetail(all.find((entry) => entry.id === shop.selected) || null);
  elements["shop-message"].textContent = shop.message || "";
}

function renderShopDetail(entry) {
  const shop = shopState();
  const panel = elements["shop-detail"];
  panel.classList.toggle("is-open", Boolean(entry));
  panel.classList.remove("rarity-common", "rarity-fine", "rarity-masterwork", "rarity-relic", "rarity-exotic");
  elements["store-screen"].classList.toggle("has-selection", Boolean(entry));
  const body = elements["shop-detail-body"];
  if (!entry) {
    const placeholder = document.createElement("div");
    placeholder.className = "shop-detail-empty";
    const portrait = document.createElement("img");
    portrait.alt = "";
    portrait.src = elements["shop-portrait"].src;
    const copy = document.createElement("p");
    copy.textContent = shop.view === "sell" ? "Choose something from your pack to see what it's worth."
      : shop.vendor === "mahuiz" ? "“Look, but don't touch until you've paid.” Choose a ware to inspect it."
        : "Choose an item to see what it does, compare it with your gear, and buy.";
    placeholder.append(portrait, copy);
    body.replaceChildren(placeholder);
    return;
  }
  panel.classList.add(`rarity-${entry.rarity}`);
  const fragment = document.createDocumentFragment();
  const heading = document.createElement("div");
  heading.className = "shop-detail-heading";
  const rarity = document.createElement("span");
  rarity.className = "shop-rarity";
  rarity.textContent = `${RARITY_LABELS[entry.rarity]} · ${entry.typeLabel}`;
  const title = document.createElement("h3");
  title.textContent = entry.locked ? "Covered by a cloth" : entry.name;
  heading.append(rarity, title);
  fragment.append(heading);

  // Preview: try gear and regalia on your adventurer; otherwise a large icon.
  const preview = document.createElement("div");
  preview.className = "shop-preview";
  const isGear = entry.kind === "cosmetic" || ["weapon", "armor", "wear"].includes(entry.item?.slot);
  if (isGear && !entry.locked) {
    const character = JSON.parse(JSON.stringify(state.run.character));
    if (entry.kind === "cosmetic") {
      const cosmetic = COSMETICS[entry.cosmeticId];
      character.cosmetics = { ...(character.cosmetics || {}), [cosmetic.slot]: entry.cosmeticId };
    } else if (entry.item.slot === "wear") {
      character.cosmetics = { ...(character.cosmetics || {}), [entry.item.wearSlot]: entry.item.cosmeticId };
    } else {
      character.equipment[entry.item.slot] = entry.item.equipmentId;
      if (entry.item.slot === "armor") character.cosmetics = { ...(character.cosmetics || {}), clothes: null };
    }
    const figure = document.createElement("img");
    figure.className = "shop-preview-figure";
    figure.alt = `${state.run.character.name} wearing ${entry.name}`;
    figure.src = codexFigureUrl(character, "east");
    const label = document.createElement("span");
    label.className = "shop-preview-label";
    label.textContent = "Try-on preview";
    preview.append(figure, label);
  } else {
    const icon = shopIconImage(entry, "shop-preview-icon");
    if (entry.locked) icon.classList.add("is-locked");
    preview.append(icon);
    preview.classList.add("is-icon");
  }
  fragment.append(preview);

  if (entry.locked) {
    const note = document.createElement("p");
    note.className = "shop-detail-note";
    note.textContent = `Mahuiz keeps this under a cloth. “Come back when you've seen floor ${entry.unlockFloor} of the tomb.”`;
    fragment.append(note);
    body.replaceChildren(fragment);
    return;
  }

  const comparison = shopComparison(entry);
  if (comparison.length) {
    const table = document.createElement("dl");
    table.className = "shop-compare";
    for (const row of comparison) {
      const term = document.createElement("dt");
      term.textContent = row.label;
      const value = document.createElement("dd");
      const from = document.createElement("span");
      from.textContent = row.from;
      const arrow = document.createElement("span");
      arrow.className = "shop-compare-arrow";
      arrow.textContent = "→";
      const to = document.createElement("strong");
      to.textContent = row.to;
      to.className = row.delta > 0 ? "is-up" : row.delta < 0 ? "is-down" : "";
      value.append(from, arrow, to);
      if (row.delta) {
        const delta = document.createElement("small");
        delta.className = row.delta > 0 ? "is-up" : "is-down";
        delta.textContent = `${row.delta > 0 ? "▲" : "▼"}${Math.abs(row.delta)}`;
        value.append(delta);
      }
      table.append(term, value);
    }
    fragment.append(table);
  }
  const description = document.createElement("p");
  description.className = "shop-detail-description";
  description.textContent = entry.description;
  fragment.append(description);
  const facts = document.createElement("ul");
  facts.className = "shop-facts";
  const fact = (text, className = "") => {
    const item = document.createElement("li");
    item.textContent = text;
    if (className) item.className = className;
    facts.append(item);
  };
  if (entry.kind === "item") {
    fact(`${formatWeight(entry.weight)} lb`);
    if (entry.carried) fact(`In pack: ${entry.carried}${entry.equipped ? " (equipped)" : ""}`);
    const food = FOOD_ITEMS[entry.id];
    if (food) fact(`Food +${food.food}${food.buff ? ` · ${t(PROGRESSION.buffs[food.buff].name)} boon` : ""}`);
    if (entry.item.slot && !canEquipItem(entry.item)) {
      const strength = entry.item.strength && state.run.character.scores.str < entry.item.strength;
      fact(strength ? `Needs Strength ${entry.item.strength}` : "Your calling isn't trained with this", "is-warning");
    }
  } else {
    fact("Cosmetic · changes only how you look");
    if (entry.owned) fact(entry.equipped ? "Currently worn" : "Owned");
  }
  fragment.append(facts);

  // Quantity and purchase controls.
  const max = shopMaxQuantity(entry);
  const stackable = shop.view === "sell" ? max > 1 : entry.kind === "item" && !entry.item.slot && entry.id !== "dungeon-gourmet-guide";
  shop.quantity = Math.max(1, Math.min(shop.quantity || 1, Math.max(1, max)));
  const controls = document.createElement("div");
  controls.className = "shop-buy-controls";
  if (stackable && max > 0) {
    const stepper = document.createElement("div");
    stepper.className = "shop-stepper";
    stepper.setAttribute("role", "group");
    stepper.setAttribute("aria-label", "Quantity");
    const minus = document.createElement("button");
    minus.type = "button";
    minus.dataset.shopQuantity = "-1";
    minus.textContent = "−";
    minus.disabled = shop.quantity <= 1;
    const amount = document.createElement("output");
    amount.textContent = String(shop.quantity);
    const plus = document.createElement("button");
    plus.type = "button";
    plus.dataset.shopQuantity = "1";
    plus.textContent = "+";
    plus.disabled = shop.quantity >= max;
    const maxButton = document.createElement("button");
    maxButton.type = "button";
    maxButton.dataset.shopQuantity = "max";
    maxButton.textContent = `Max ${max}`;
    maxButton.disabled = shop.quantity >= max;
    stepper.append(minus, amount, plus, maxButton);
    controls.append(stepper);
  }
  const primary = document.createElement("button");
  primary.type = "button";
  primary.className = "button shop-primary";
  const total = roundGold(entry.price * shop.quantity);
  if (shop.view === "sell") {
    primary.dataset.shopAction = "sell";
    primary.textContent = `Sell${shop.quantity > 1 ? ` ${shop.quantity}` : ""} · ${formatCurrency(total)}`;
    primary.disabled = max < 1;
  } else if (entry.kind === "cosmetic" && entry.owned) {
    primary.dataset.shopAction = "buy";
    primary.textContent = entry.equipped ? "Take off" : "Wear";
  } else {
    primary.dataset.shopAction = "buy";
    primary.textContent = `Buy${shop.quantity > 1 ? ` ${shop.quantity}` : ""} · ${formatCurrency(total)}`;
    primary.disabled = max < 1;
    if (max < 1) {
      primary.textContent = entry.id === "dungeon-gourmet-guide" && state.run.gourmetGuideOwned ? "Already learned"
        : state.run.gold < entry.price ? `Need ${formatCurrency(entry.price - state.run.gold)} more` : "Pack too heavy";
    }
  }
  controls.append(primary);
  if (shop.view === "buy" && entry.kind === "item" && entry.item.slot && max > 0 && canEquipItem(entry.item)) {
    const equip = document.createElement("button");
    equip.type = "button";
    equip.className = "button secondary shop-secondary";
    equip.dataset.shopAction = "buy-equip";
    equip.textContent = "Buy & equip";
    controls.append(equip);
  }
  fragment.append(controls);
  body.replaceChildren(fragment);
}

function connectShopEvents() {
  elements["store-screen"].addEventListener("click", (event) => {
    const shop = shopState();
    const view = event.target.closest("[data-shop-view]");
    if (view) {
      shop.view = view.dataset.shopView;
      shop.selected = null;
      shop.category = "all";
      shop.message = "";
      renderShopScreen();
      return;
    }
    const category = event.target.closest("[data-shop-category]");
    if (category) {
      shop.category = category.dataset.shopCategory;
      renderShopScreen();
      return;
    }
    const card = event.target.closest("[data-shop-item]");
    if (card) {
      shop.selected = shop.selected === card.dataset.shopItem ? null : card.dataset.shopItem;
      shop.quantity = 1;
      renderShopScreen();
      return;
    }
    const quantity = event.target.closest("[data-shop-quantity]");
    if (quantity) {
      const entry = shopCatalog().find((item) => item.id === shop.selected);
      const max = shopMaxQuantity(entry);
      shop.quantity = quantity.dataset.shopQuantity === "max" ? max
        : Math.max(1, Math.min(max, shop.quantity + Number(quantity.dataset.shopQuantity)));
      renderShopScreen();
      return;
    }
    const action = event.target.closest("[data-shop-action]");
    if (action && shop.selected) {
      if (action.dataset.shopAction === "sell") shopSell(shop.selected, shop.quantity);
      else shopBuy(shop.selected, shop.quantity, action.dataset.shopAction === "buy-equip");
      return;
    }
    if (event.target.closest("#shop-detail-close")) {
      shop.selected = null;
      renderShopScreen();
      return;
    }
    if (event.target.closest("#shop-sell-all")) shopSellAllTreasure();
  });
}

// Every venue header (conversations, projects, Patolli) shows the strongbox purse.
function renderPurses() {
  if (!state.run) return;
  const text = formatCurrency(state.run.gold);
  document.querySelectorAll("[data-purse]").forEach((purse) => {
    if (purse.textContent !== text) purse.textContent = text;
  });
}
