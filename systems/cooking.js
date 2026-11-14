"use strict";

// Cooking from whatever is in the pack. You choose ingredients and a method; the dish is
// worked out from what those ingredients are and how the method treats them (the rules
// are in data/cooking.js). A dish is an item of its own, kept in state.run.dishes so it
// survives a save, and identical dishes stack.

const COOK = window.CryptsCooking;
const COOK_MAX_PORTIONS = 6;
const COOK_TASTES = ["umami", "sweet", "sour", "bitter", "heat", "salt", "fat", "aroma"];
const COOK_PROTEIN_KINDS = ["meat", "fowl", "fish", "shellfish", "insect", "egg"];
// Short names for dish titles.
const COOK_LABELS = {
  "monster-meat": "Cave meat", "fowl-meat": "Cave fowl", "rabbit-meat": "Rabbit", "mapachin-meat": "Mapachin",
  "colotl-tail": "Colotl tail", "caiman-tail": "Caiman", "mazacoatl-meat": "Mazacoatl", "turkey-leg": "Turkey",
  blindfish: "Blindfish", "smoked-fish": "Smoked fish", chapulines: "Chapulín", chicatanas: "Chicatana",
  ahuauhtli: "Ahuauhtli", "cave-eggs": "Egg", "cave-mushrooms": "Glowcap", "summit-cap": "Summit cap",
  "wild-ingredients": "Root and green", nopalitos: "Nopal", quilitl: "Quelite", tecuitlatl: "Tecuitlatl",
  miltomatl: "Tomatillo", mamey: "Mamey", chilis: "Chili", epazotl: "Epazote", nixtamal: "Hominy",
  tlaxcalli: "Tortilla", ration: "Maize-and-bean", pinole: "Pinole", etl: "Bean", ayohuachtli: "Pepita",
  "amaranth-cake": "Amaranth", honeycomb: "Honey", "cacao-pouch": "Cacao", "salt-cakes": "Salt",
  "clean-water": "Water", atole: "Atole", soup: "Squash", "chia-water": "Chia", pulque: "Pulque", "cacao-drink": "Cacao"
};

function cookIngredient(id) {
  return COOK.ingredients[id] || null;
}

function cookLabel(id) {
  return t(COOK_LABELS[id] || itemDetails(id)?.name || id);
}

// What in the pack can go in a pot, with how many portions of it there are.
function cookPantry() {
  return state.run.inventory.filter((entry) => cookIngredient(entry.id) && !entry.id.startsWith("dish-"))
    .map((entry) => ({ id: entry.id, quantity: entry.quantity, portions: Math.floor(entry.quantity / (cookIngredient(entry.id).uses || 1) + 1e-9) }))
    .filter((entry) => entry.portions > 0);
}

// Kept for the action bar ("Cook at camp · N"): how many things you could cook with.
function availableRecipes() {
  return cookPantry().filter((entry) => cookIngredient(entry.id).kind !== "liquid" && cookIngredient(entry.id).kind !== "salt");
}

function cookingBlocked() {
  return state.run.location === "dungeon" && (!atCamp() || state.run.enemies.some((enemy) =>
    creatureIsThreat(enemy) && distanceInSquares(enemy, state.run.player) <= gridReach(7)));
}

// Whether a method can be used here and now, and if not, why.
function cookMethodReady(methodId) {
  const method = COOK.methods[methodId];
  if (!method) return "Unknown method.";
  const inTown = state.run.location !== "dungeon";
  if (method.needs && !inTown && !inventoryQuantity(method.needs)) return `Needs a ${t(itemDetails(method.needs)?.name || method.needs).toLowerCase()}.`;
  if (method.camp && !inTown && !atCamp()) return "Needs your camp.";
  return null;
}

function cookKinds(selection) {
  return new Set(Object.keys(selection).map((id) => cookIngredient(id)?.kind).filter(Boolean));
}

// Does the pot hold one of each group (a group lists kinds, or `id:` items)?
function cookHas(selection, groups) {
  const kinds = cookKinds(selection);
  return groups.every((group) => group.some((need) => need.startsWith("id:") ? selection[need.slice(3)] > 0 : kinds.has(need)));
}

// ---------- Working out a dish ----------

// Everything about cooking `selection` ({ itemId: portions }) by `methodId`, without the
// cook's roll: the parts of its quality, what the cook would say about it, and what it makes.
function cookAssess(selection, methodId) {
  const method = COOK.methods[methodId];
  const ids = Object.keys(selection).filter((id) => selection[id] > 0 && cookIngredient(id));
  const notes = [];
  const result = { method: methodId, ids, notes, parts: {}, ok: ids.length > 0, problem: null };
  if (!ids.length) { result.problem = "Put something in the pot."; return result; }
  const portions = ids.reduce((sum, id) => sum + selection[id], 0);
  const liquid = ids.some((id) => cookIngredient(id).liquid);
  if (method.wet && !liquid && !inventoryQuantity("clean-water")) {
    result.problem = "This needs water in the pot: add a liquid or carry a gourd of water.";
  }
  if (method.dry && ids.every((id) => cookIngredient(id).liquid)) result.problem = "There's nothing here to put on the fire but liquid.";

  // 1. How each ingredient takes the method.
  let fitTotal = 0;
  let weightTotal = 0;
  let sickly = false;
  const worst = [];
  const toughOnes = [];
  for (const id of ids) {
    const ing = cookIngredient(id);
    let fit = method.fit[ing.kind] ?? 0;
    // Masa set around a filling is ground and tender already.
    const tough = ing.masa && methodId === "steam" ? 0 : ing.tough || 0;
    fit += method.tough < 0 ? method.tough * Math.max(0, tough - 1) : method.tough * tough * 0.5;
    fit += (method.delicate || 0) * (ing.delicate || 0);
    if (ing.cooked && fit < 0) fit /= 2;
    const weight = (ing.food + 10) * selection[id];
    fitTotal += fit * weight;
    weightTotal += weight;
    if (fit <= -1.5) worst.push(id);
    if (fit < 0 && tough >= 2 && method.tough < 0) toughOnes.push(id);
    // Raw meat, fish, eggs, and beans have to be cooked through.
    if (ing.raw === "unsafe" && (!method.cooks || (methodId === "toast" && ["meat", "fowl", "legume", "egg"].includes(ing.kind)) ||
      (method.dry && tough >= 3))) sickly = true;
    if (ing.raw === "poor" && !method.cooks) fitTotal -= 0.5 * weight;
  }
  const fit = weightTotal ? fitTotal / weightTotal : 0;
  result.parts.fit = fit * 1.2;
  if (worst.length) notes.push(`${worst.map(cookLabel).join(" and ")} ${worst.length > 1 ? "don't" : "doesn't"} take well to ${t(method.verb)}.`);
  if (toughOnes.length) notes.push(`${toughOnes.map(cookLabel).join(", ")}: tough. Simmer it or pit-roast it to make it tender.`);
  const delicate = ids.filter((id) => (cookIngredient(id).delicate || 0) >= 2);
  if (delicate.length && method.dry) notes.push(`${delicate.map(cookLabel).join(", ")}: delicate. Steaming keeps it whole.`);
  if (sickly) notes.push("Some of this would still be raw: it could make you sick.");

  // 2. Flavor: a savory base, contrast, nothing overpowering.
  const taste = Object.fromEntries(COOK_TASTES.map((key) => [key, 0]));
  for (const id of ids) for (const [key, value] of Object.entries(cookIngredient(id).taste || {})) taste[key] += value * selection[id];
  for (const [key, value] of Object.entries(method.adds || {})) {
    if (method.browns && !ids.some((id) => [...COOK_PROTEIN_KINDS, "fungus", "maize", "chili", "seed"].includes(cookIngredient(id).kind))) continue;
    taste[key] += value;
  }
  // Water, salt, and herbs don't dilute a dish's flavor the way more food does.
  const solids = ids.reduce((sum, id) => sum + (["liquid", "salt", "herb"].includes(cookIngredient(id).kind) ? 0 : selection[id]), 0);
  const scale = Math.max(1, Math.pow(Math.max(1, solids), 0.6));
  const level = Object.fromEntries(COOK_TASTES.map((key) => [key, taste[key] / scale]));
  let flavor = 0;
  const base = level.umami >= 1.2 ? "umami" : level.sweet >= 1.5 ? "sweet" : null;
  if (base) flavor += 0.5;
  else notes.push("There's no body to it: it wants something savory (meat, mushrooms, beans, insects).");
  const contrasts = ["sour", "heat", "salt", "fat", "aroma", "sweet"].filter((key) => key !== base && level[key] >= 0.9);
  flavor += Math.min(1.6, contrasts.length * 0.4);
  if (base === "umami" && level.salt < 0.6 && level.sour < 0.6 && level.heat < 0.6) {
    flavor -= 0.5;
    notes.push("It's flat: a pinch of salt, something sour (tomatillo, pulque), or a chili would wake it up.");
  }
  if (level.heat >= 4) { flavor -= 1; notes.push("Too hot to taste anything else."); }
  if (level.salt >= 4) { flavor -= 1; notes.push("Far too salty."); }
  if (level.sour >= 4) { flavor -= 0.5; notes.push("Too sour."); }
  if (level.bitter >= 1.5 && level.sweet + level.fat < 1.5) { flavor -= 1; notes.push("Bitter, with nothing sweet or rich to round it."); }
  const lean = ids.filter((id) => cookIngredient(id).lean);
  if (lean.length && level.fat < 0.8 && method.dry) { flavor -= 0.5; notes.push(`${lean.map(cookLabel).join(", ")}: lean, and dry like this. Add fat (seeds, chicatanas, mapachin) or stew it.`); }
  if (method.browns && taste.aroma > 0 && ids.some((id) => COOK_PROTEIN_KINDS.includes(cookIngredient(id).kind) || cookIngredient(id).kind === "fungus")) {
    flavor += 0.4;
    notes.push("The heat browns it: a good crust.");
  }
  if (method.melds && ids.length >= 3) { flavor += 0.5; notes.push("A long simmer brings it all together."); }
  result.parts.flavor = flavor;

  // 3. What the old cooks put together.
  let pairing = 0;
  for (const pair of COOK.pairings) {
    if (pair.methods && !pair.methods.includes(methodId)) continue;
    if (!cookHas(selection, pair.needs)) continue;
    pairing += pair.bonus;
    notes.push(t(pair.note));
  }
  // The three sisters of the milpa: maize, beans, squash.
  const sisters = new Set();
  for (const id of ids) {
    const ing = cookIngredient(id);
    if (ing.kind === "maize") sisters.add("maize");
    if (ing.kind === "legume") sisters.add("legume");
    for (const kind of ing.milpa || []) sisters.add(kind);
    if (id === "ayohuachtli") sisters.add("squash");
  }
  if (sisters.size >= 3) { pairing += 1.5; notes.push("Maize, beans, and squash together: the milpa, the meal everything else is measured by."); }
  else if (sisters.size === 2) pairing += 0.5;
  result.parts.pairing = pairing;

  // 4. What it makes. Cooking makes food go further: more of it reaches you.
  const bulk = ids.reduce((sum, id) => sum + cookIngredient(id).food * selection[id], 0);
  const nutrients = [0, 0, 0];
  for (const id of ids) cookIngredient(id).n.forEach((value, n) => { nutrients[n] += value * selection[id]; });
  const servings = Math.max(1, Math.min(6, Math.round(bulk / 40)));
  const whole = nutrients.every((value) => value / servings >= 22);
  if (whole) notes.push("Protein, maize, and greens: a whole meal.");
  result.parts.whole = whole ? 0.5 : 0;
  if (sickly) result.parts.sickly = -2;
  result.sickly = sickly;
  result.bulk = bulk;
  result.nutrients = nutrients;
  result.servings = servings;
  result.whole = whole;
  result.water = (method.broth || 0) + ids.reduce((sum, id) => sum + (FOOD_ITEMS[id]?.water || 0) * selection[id], 0) / servings;
  result.heal = ids.reduce((sum, id) => sum + (cookIngredient(id).heals || 0) * selection[id], 0);

  // 5. Its essences: what the dish can do for you if it's made well.
  const essences = {};
  for (const id of ids) {
    const ing = cookIngredient(id);
    if (!ing.essence) continue;
    const [boon, strength] = ing.essence;
    if (ing.requires && !(typeof naturalistKnows === "function" && naturalistKnows(ing.requires))) continue;
    const take = (method.fit[ing.kind] ?? 0) < 0 ? 0.5 : 1;
    essences[boon] = (essences[boon] || 0) + strength * selection[id] * take;
  }
  result.essences = Object.entries(essences).sort((a, b) => b[1] - a[1]);
  result.base = 1 + result.parts.fit + flavor + pairing + result.parts.whole + (result.parts.sickly || 0);
  const named = cookDishName(selection, methodId, ids);
  result.name = named.name;
  result.form = named.form;
  return result;
}

function cookQuality(score) {
  return [...COOK.qualities].reverse().find((quality) => score >= quality.min) || COOK.qualities[0];
}

function cookDifficulty(selection, methodId) {
  return 8 + 2 * (COOK.methods[methodId].difficulty || 0) + Object.keys(selection).filter((id) => selection[id] > 0).length;
}

function cookMain(ids) {
  const ranked = [...ids].sort((a, b) => {
    const ia = cookIngredient(a); const ib = cookIngredient(b);
    const pa = COOK_PROTEIN_KINDS.includes(ia.kind) || ia.kind === "fungus" ? 100 : 0;
    const pb = COOK_PROTEIN_KINDS.includes(ib.kind) || ib.kind === "fungus" ? 100 : 0;
    return (pb + ib.food) - (pa + ia.food);
  });
  return ranked.filter((id) => !["liquid", "salt", "herb"].includes(cookIngredient(id).kind));
}

function cookDishName(selection, methodId, ids) {
  const kinds = cookKinds(selection);
  const main = cookMain(ids);
  const mainLabel = main[0] ? cookLabel(main[0]) : cookLabel(ids[0]);
  for (const form of COOK.forms) {
    if (form.method && form.method !== methodId) continue;
    if (form.methods && !form.methods.includes(methodId)) continue;
    if (form.only && [...kinds].some((kind) => !form.only.includes(kind))) continue;
    if (!cookHas(selection, form.needs)) continue;
    let mainId = main.find((id) => !form.filled || !cookIngredient(id).masa) || main[0];
    if (form.id === "atole" || form.id === "frijoles") mainId = main.find((id) => !["maize", "legume"].includes(cookIngredient(id).kind)) || null;
    if (form.filled && (!mainId || cookIngredient(mainId).masa)) continue;
    const label = mainId ? cookLabel(mainId) : "";
    const color = selection.miltomatl || selection.quilitl || selection.nopalitos ? "verde" : "roja";
    const name = t(form.name).replace("{main}", label || t("Plain")).replace("{color}", color)
      .replace("{with}", label ? ` ${t("with")} ${label.toLowerCase()}` : "");
    return { name: name.charAt(0).toUpperCase() + name.slice(1), form: form.id };
  }
  const second = main[1] ? ` ${t("with")} ${cookLabel(main[1]).toLowerCase()}` : "";
  return { name: `${t(COOK.methods[methodId].short)} ${mainLabel.toLowerCase()}${second}`, form: null };
}

// ---------- Making it ----------

// Cooks `selection` by `methodId`: uses up the ingredients, rolls the cook's check, and
// puts the servings in the pack. Returns the dish id (or null).
function cookDish(selection, methodId, { quiet = false, free = false } = {}) {
  const assessment = cookAssess(selection, methodId);
  if (!assessment.ok || assessment.problem) {
    if (!quiet) showToast(t(assessment.problem || "Nothing to cook."));
    return null;
  }
  const method = COOK.methods[methodId];
  for (const id of assessment.ids) {
    const uses = cookIngredient(id).uses || 1;
    const amount = uses * selection[id];
    if (uses < 1) {
      // A pinch of salt, a handful of beans: track the part used, and use up the item when it's gone.
      state.run.cookingStores ||= {};
      state.run.cookingStores[id] = (state.run.cookingStores[id] || 0) + amount;
      while (state.run.cookingStores[id] >= 1 - 1e-9) {
        state.run.cookingStores[id] -= 1;
        removeInventoryItem(id);
      }
    } else removeInventoryItem(id, Math.round(amount));
  }
  if (method.wet && !assessment.ids.some((id) => cookIngredient(id).liquid)) removeInventoryItem("clean-water");
  const roll = randomInt(20);
  const check = roll + bestPartySkillBonus("cooking");
  const margin = check - cookDifficulty(selection, methodId);
  const skill = roll === 1 ? -2 : Math.max(-2, Math.min(2, margin / 4));
  const score = assessment.base + skill;
  const quality = cookQuality(score);
  const tier = COOK.qualities.indexOf(quality);
  const servings = assessment.servings;
  const per = (value) => Math.round(value * quality.food / servings);
  const food = Math.min(95, per(assessment.bulk));
  const nutrients = {
    protein: Math.min(70, per(assessment.nutrients[0])),
    carbohydrates: Math.min(70, per(assessment.nutrients[1])),
    greens: Math.min(70, per(assessment.nutrients[2]))
  };
  // A well-made dish carries the strongest essences in it.
  const boons = tier >= 2 ? assessment.essences.filter(([, strength]) => strength >= 2).map(([boon]) => boon)
    .filter((boon) => PROGRESSION.buffs[boon]) : [];
  // A superb dish can carry two boons, if there's a meal's worth of it.
  const buffs = boons.slice(0, tier >= 4 && assessment.bulk / servings >= 35 ? 2 : 1);
  if (assessment.whole && tier >= 2) buffs.push("well-fed");
  const minutes = [0, 0, 480, 600, 720][tier];
  const dish = {
    name: `${quality.id === "plain" ? "" : `${t(quality.name)} `}${assessment.name}`.trim(),
    quality: quality.id, method: methodId, form: assessment.form || null, food, nutrients,
    water: Math.round(assessment.water) || 0,
    heal: Math.round((quality.heal || 0) + assessment.heal / servings) || 0,
    buff: buffs[0] || null, moreBuffs: buffs.slice(1), buffMinutes: minutes,
    sickly: assessment.sickly && roll < 15,
    price: Math.round((0.3 + 0.004 * food * (1 + tier * 0.3) + buffs.length * 0.8) * 10) / 10
  };
  dish.description = cookDishDescription(dish, assessment);
  const id = registerDish(dish);
  let made = 0;
  for (let n = 0; n < servings; n += 1) if (addInventoryItem(id)) made += 1;
  progress().dishesCooked += 1;
  cookLearn(assessment);
  if (typeof advanceBounties === "function") advanceBounties((bounty) => bounty.kind === "cook");
  if (!quiet) {
    addLog(`Cooking ${check} (DC ${cookDifficulty(selection, methodId)}): ${made || servings} serving${servings === 1 ? "" : "s"} of ${dish.name}. ${t(quality.note)}`);
    if (made < servings) addLog(`Your pack is full; you eat ${servings - made === 1 ? "one" : servings - made} on the spot.`);
  }
  for (let n = made; n < servings; n += 1) {
    applyMeal(state.run.needs, id);
    if (dish.buff) grantBuff(dish.buff, dish.buffMinutes);
  }
  if (!free) {
    if (state.run.location === "dungeon") finishPlayerTurn(method.minutes);
    else {
      if (typeof townPassTime === "function") townPassTime(method.minutes);
      render();
    }
  }
  return id;
}

function cookDishDescription(dish, assessment) {
  const bits = [`${t(COOK.qualities.find((q) => q.id === dish.quality).name)}, ${t(COOK.methods[dish.method].short).toLowerCase()}.`];
  bits.push(`Made with ${assessment.ids.map((id) => itemDetails(id)?.name || id).join(", ")}.`);
  bits.push(`Food +${dish.food}${dish.water ? `, water +${dish.water}` : ""}${dish.heal ? `, heals ${dish.heal}` : ""}.`);
  const boons = [dish.buff, ...(dish.moreBuffs || [])].filter(Boolean).map((id) => PROGRESSION.buffs[id]);
  if (boons.length) bits.push(`Eat for ${boons.map((buff) => `${t(buff.name)} (${t(buff.description)})`).join(" and ")} for ${Math.round(dish.buffMinutes / 60)} hours.`);
  if (dish.sickly) bits.push("Not cooked through: it may make you sick.");
  return bits.join(" ");
}

// ---------- Dishes as items ----------

function cookDishKey(dish) {
  const text = JSON.stringify([dish.name, dish.food, dish.nutrients, dish.water, dish.heal, dish.buff, dish.moreBuffs, dish.buffMinutes, dish.sickly]);
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return `dish-${hash.toString(36)}`;
}

function registerDish(dish, id = cookDishKey(dish)) {
  state.run.dishes ||= {};
  state.run.dishes[id] = dish;
  cookInstallDish(id, dish);
  return id;
}

// The art a dish is drawn with: the old recipe paintings, by what kind of dish it is.
const COOK_FORM_ART = {
  mole: "turkey-mole", pipian: "mazacoatl-pipian", pozole: "cave-meat-pozole", frijoles: "egg-pozole", atole: "lake-atole",
  tea: "summit-cap-tea", caldo: "jungle-broth", tamales: "glowcap-tamales", barbacoa: "caiman-barbacoa", salsa: "chicatana-salsa",
  tacos: "chapulin-tlacoyos", tlacoyos: "chapulin-tlacoyos", ensalada: "nopalitos"
};
const COOK_METHOD_ART = { roast: "chili-roast", toast: "chapulines-mushrooms", simmer: "jungle-broth", steam: "fish-tamales", pit: "caiman-barbacoa", fresh: "nopalitos" };

function dishArtFile(id) {
  const dish = state.run?.dishes?.[id];
  if (!dish) return null;
  return dish.art || COOK_FORM_ART[dish.form] || COOK_METHOD_ART[dish.method] || "soup";
}

function cookInstallDish(id, dish) {
  FOOD_ITEMS[id] = {
    name: dish.name, sprite: "soup", food: dish.food, nutrients: { ...dish.nutrients },
    water: dish.water || 0, heal: dish.heal || 0, buff: dish.buff || undefined, moreBuffs: dish.moreBuffs || [],
    buffMinutes: dish.buffMinutes || undefined, sickly: Boolean(dish.sickly), cooked: true
  };
  GEAR_ITEMS[id] = {
    name: dish.name, weight: 0.8, price: dish.price || 1, category: "Food",
    sprite: dish.art || COOK_FORM_ART[dish.form] || COOK_METHOD_ART[dish.method] || "soup",
    description: dish.description || ""
  };
}

// Called as a save loads (and for every stored floor), before anything checks the pack.
function registerSavedDishes(saved) {
  const dishes = saved?.dishes;
  if (!dishes || typeof dishes !== "object" || Array.isArray(dishes)) {
    if (saved && saved.dishes !== undefined) saved.dishes = {};
    return;
  }
  for (const [id, dish] of Object.entries(dishes)) {
    if (!/^dish-[0-9a-z]+$/.test(id) || !dish || typeof dish.name !== "string" || !Number.isFinite(dish.food) ||
      !dish.nutrients || typeof dish.nutrients !== "object") { delete dishes[id]; continue; }
    cookInstallDish(id, dish);
  }
}

// Forgets dishes nothing holds any more (eaten, sold, left behind).
function pruneDishes() {
  const dishes = state.run?.dishes;
  if (!dishes) return;
  const { dishes: _omit, ...rest } = state.run;
  const held = new Set(JSON.stringify(rest).match(/dish-[0-9a-z]+/g) || []);
  for (const id of Object.keys(dishes)) if (!held.has(id)) delete dishes[id];
}

// What you have learned to make (by name of form), for the cook's notebook.
function cookLearn(assessment) {
  const known = progress().dishesKnown ||= [];
  if (!assessment.form || known.includes(assessment.form)) return;
  known.push(assessment.form);
  addLog(`Cook's notebook: a new dish, ${assessment.name}.`);
}

// ---------- At rest: the camp cooks with what there is ----------

// When the party sits down to rest without enough food, whoever cooks makes a pot of what
// raw ingredients there are. Returns how many servings went in the pack.
function campAutoCook(needed) {
  if (needed <= 0) return 0;
  const pantry = cookPantry().filter((entry) => !FOOD_ITEMS[entry.id] && cookIngredient(entry.id).kind !== "salt");
  if (!pantry.length) return 0;
  const pot = state.run.location !== "dungeon" || inventoryQuantity("iron-pot") > 0;
  const methodId = pot && (inventoryQuantity("clean-water") || pantry.some((entry) => cookIngredient(entry.id).liquid)) ? "simmer" : "roast";
  const selection = {};
  let portions = 0;
  for (const entry of pantry.sort((a, b) => cookIngredient(b.id).food - cookIngredient(a.id).food)) {
    if (portions >= Math.min(COOK_MAX_PORTIONS, needed + 2)) break;
    if (methodId === "roast" && cookIngredient(entry.id).liquid) continue;
    const take = Math.min(entry.portions, 2);
    selection[entry.id] = take;
    portions += take;
  }
  if (!portions) return 0;
  if (inventoryQuantity("salt-cakes")) selection["salt-cakes"] = 1;
  const before = state.run.inventory.reduce((sum, entry) => sum + (entry.id.startsWith("dish-") ? entry.quantity : 0), 0);
  const id = cookDish(selection, methodId, { quiet: true, free: true });
  if (!id) return 0;
  const after = state.run.inventory.reduce((sum, entry) => sum + (entry.id.startsWith("dish-") ? entry.quantity : 0), 0);
  addLog(`The camp cooks what there is: ${FOOD_ITEMS[id].name} (${after - before} serving${after - before === 1 ? "" : "s"}).`);
  return after - before;
}

// ---------- The cook's dialog ----------

const cookUi = { selection: {}, method: "roast", dialog: null };

function openCookMenu() {
  if (state.run.lost || state.run.won) return;
  if (cookingBlocked()) {
    showToast(atCamp() || state.run.location !== "dungeon" ? "Too close to danger to cook. Find a quiet room first." : "Cooking needs your campfire. Return to your camp or make one here.");
    return;
  }
  if (!cookPantry().length) {
    showRpgMessage("Cooking", "You have nothing to cook. Buy maize, beans, chilies, and greens at the market, forage in the tomb, or butcher a fresh kill.");
    return;
  }
  cookUi.selection = {};
  if (!cookUi.dialog) cookBuildDialog();
  const firstReady = Object.keys(COOK.methods).find((id) => !cookMethodReady(id));
  cookUi.method = firstReady || "roast";
  cookRender();
  cookUi.dialog.showModal();
}

function cookBuildDialog() {
  const dialog = document.createElement("dialog");
  dialog.className = "story-dialog cook-dialog";
  dialog.setAttribute("aria-labelledby", "cook-heading");
  dialog.innerHTML = `
    <section class="story-panel cook-panel">
      <p class="eyebrow">${t("The cook's fire")}</p>
      <h2 id="cook-heading">${t("Cook")}</h2>
      <div class="cook-section"><h3>${t("In the pot")}</h3><div class="cook-pot" data-cook="pot"></div></div>
      <div class="cook-section"><h3>${t("Your pack")}</h3><div class="cook-pantry" data-cook="pantry"></div></div>
      <div class="cook-section"><h3>${t("How")}</h3><div class="cook-methods" data-cook="methods"></div><p class="cook-method-text" data-cook="method-text"></p></div>
      <div class="cook-preview" data-cook="preview" aria-live="polite"></div>
      <div class="cook-actions">
        <button class="button" type="button" data-cook="go">${t("Cook")}</button>
        <button class="button secondary" type="button" data-cook="close">${t("Cancel")}</button>
      </div>
    </section>`;
  document.body.append(dialog);
  dialog.querySelector('[data-cook="close"]').addEventListener("click", () => dialog.close());
  dialog.querySelector('[data-cook="go"]').addEventListener("click", () => {
    const selection = { ...cookUi.selection };
    const method = cookUi.method;
    if (cookMethodReady(method) || cookAssess(selection, method).problem) return;
    dialog.close();
    cookDish(selection, method);
  });
  cookUi.dialog = dialog;
}

function cookPortions() {
  return Object.values(cookUi.selection).reduce((sum, value) => sum + value, 0);
}

function cookRender() {
  const dialog = cookUi.dialog;
  const pot = dialog.querySelector('[data-cook="pot"]');
  const pantryBox = dialog.querySelector('[data-cook="pantry"]');
  const methodsBox = dialog.querySelector('[data-cook="methods"]');
  const preview = dialog.querySelector('[data-cook="preview"]');
  const pantry = cookPantry();
  pot.replaceChildren();
  const inPot = Object.entries(cookUi.selection).filter(([, count]) => count > 0);
  if (!inPot.length) {
    const empty = document.createElement("p");
    empty.className = "cook-empty";
    empty.textContent = t("Nothing yet. Tap what you want to add.");
    pot.append(empty);
  }
  for (const [id, count] of inPot) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "cook-chip in-pot";
    chip.textContent = `${itemDetails(id)?.name || id}${count > 1 ? ` ×${count}` : ""} −`;
    chip.setAttribute("aria-label", `${t("Take out")} ${itemDetails(id)?.name || id}`);
    chip.addEventListener("click", () => { cookUi.selection[id] -= 1; if (cookUi.selection[id] <= 0) delete cookUi.selection[id]; cookRender(); });
    pot.append(chip);
  }
  pantryBox.replaceChildren();
  for (const entry of pantry) {
    const left = entry.portions - (cookUi.selection[entry.id] || 0);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "cook-chip";
    const ing = cookIngredient(entry.id);
    chip.textContent = `${itemDetails(entry.id)?.name || entry.id} · ${left}`;
    chip.title = t(ing.kind);
    chip.disabled = left <= 0 || cookPortions() >= COOK_MAX_PORTIONS;
    chip.addEventListener("click", () => { cookUi.selection[entry.id] = (cookUi.selection[entry.id] || 0) + 1; cookRender(); });
    pantryBox.append(chip);
  }
  methodsBox.replaceChildren();
  for (const [id, method] of Object.entries(COOK.methods)) {
    const reason = cookMethodReady(id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `cook-method${cookUi.method === id ? " selected" : ""}`;
    button.setAttribute("aria-pressed", String(cookUi.method === id));
    button.disabled = Boolean(reason);
    button.textContent = `${t(method.name)} · ${method.minutes < 60 ? `${method.minutes} min` : `${method.minutes / 60} h`}`;
    if (reason) button.title = t(reason);
    button.addEventListener("click", () => { cookUi.method = id; cookRender(); });
    methodsBox.append(button);
  }
  const method = COOK.methods[cookUi.method];
  const reason = cookMethodReady(cookUi.method);
  dialog.querySelector('[data-cook="method-text"]').textContent = reason ? t(reason) : t(method.text);
  preview.replaceChildren();
  const go = dialog.querySelector('[data-cook="go"]');
  if (!inPot.length) { go.disabled = true; return; }
  const assessment = cookAssess(cookUi.selection, cookUi.method);
  const bonus = bestPartySkillBonus("cooking");
  const dc = cookDifficulty(cookUi.selection, cookUi.method);
  const expected = assessment.base + Math.max(-2, Math.min(2, (10.5 + bonus - dc) / 4));
  const low = cookQuality(expected - 1.5);
  const high = cookQuality(expected + 1.5);
  const title = document.createElement("h3");
  title.textContent = assessment.name;
  const line = document.createElement("p");
  line.className = "cook-forecast";
  const boons = assessment.essences.filter(([, strength]) => strength >= 2).map(([boon]) => PROGRESSION.buffs[boon]?.name).filter(Boolean);
  line.textContent = assessment.problem ? t(assessment.problem)
    : `${t("Likely")} ${low === high ? t(low.name) : `${t(low.name)}–${t(high.name)}`} · ${assessment.servings} ${t(assessment.servings === 1 ? "serving" : "servings")} · ${t("Cooking")} DC ${dc} (+${bonus})` +
      (boons.length ? ` · ${t("could carry")} ${boons.map((name) => t(name)).join(", ")}` : "");
  const list = document.createElement("ul");
  list.className = "cook-notes";
  for (const note of assessment.notes.slice(0, 5)) {
    const item = document.createElement("li");
    item.textContent = t(note);
    list.append(item);
  }
  preview.append(title, line, list);
  go.disabled = Boolean(reason || assessment.problem);
  go.textContent = `${t("Cook")} · ${method.minutes < 60 ? `${method.minutes} min` : `${method.minutes / 60} h`}`;
}
