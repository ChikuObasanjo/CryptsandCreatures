"use strict";

// Cooking, as data. There are no fixed recipes: you put what you have in the pot, choose
// how to cook it, and the dish is whatever those ingredients make cooked that way. The
// rules follow real kitchens (systems/cooking.js does the sums):
//
//   heat and method   tough cuts want long, wet heat (a stew, a pit); tender meat, fish,
//                     and insects want quick, dry heat (the coals, the comal); delicate
//                     things are ruined by a hard roast. Meat, fish, eggs, and raw beans
//                     must be cooked through or they make you sick.
//   flavor balance    a dish needs a savory base and contrast: salt, an acid, heat, a
//                     little sweetness or fat, something aromatic. Too much of one thing,
//                     or bitterness with nothing to round it, spoils it.
//   the milpa         maize, beans, and squash eaten together feed you better than any of
//                     them alone, and every meal is better with protein, maize, and greens.
//   old pairings      what the cooks of the valley have always put together (chili with
//                     tomatillo, cacao and seeds with chili for mole, epazote with beans).
//   the cook          a Cooking check: a good cook gets more and better servings.
//
// Each ingredient:
//   kind      meat, fowl, fish, shellfish, insect, egg, fungus, green, fruit, chili, herb,
//             maize, legume, seed, sweet, cacao, salt, liquid, algae
//   food      what it adds to a dish's food value
//   n         [protein, carbohydrates, greens] it adds
//   taste     umami, sweet, sour, bitter, heat, salt, fat, aroma (0–3)
//   tough     0–3: how long and wet it needs cooking to be tender
//   delicate  0–2: how badly hard, dry heat treats it
//   raw       "safe" (fine raw), "poor" (edible, much better cooked), "unsafe" (makes you sick raw)
//   essence   [boon, strength]: what the ingredient brings out in a well-made dish; a boon
//             needs a dish of good quality and enough strength behind it
//   requires  the naturalist's knowledge needed to bring the essence out
//   uses      how much of the item goes in (salt and cacao go a long way: a portion of a
//             bundle of salt cakes or a pouch of beans; the rest stays in the pack)

window.CryptsCooking = {
  ingredients: {
    // ---- Meat and fish ----
    "monster-meat": { kind: "meat", food: 30, n: [40, 0, 0], taste: { umami: 2, fat: 1 }, tough: 2, raw: "unsafe", essence: ["hearty", 1] },
    "fowl-meat": { kind: "fowl", food: 30, n: [40, 0, 0], taste: { umami: 2, fat: 1 }, tough: 1, raw: "unsafe", essence: ["hearty", 1] },
    "rabbit-meat": { kind: "meat", food: 28, n: [45, 0, 0], taste: { umami: 2 }, tough: 0, lean: true, raw: "unsafe", essence: ["nimble", 1] },
    "mapachin-meat": { kind: "meat", food: 30, n: [35, 0, 0], taste: { umami: 2, fat: 3, bitter: 1 }, tough: 1, raw: "unsafe", essence: ["hushed", 1] },
    "colotl-tail": { kind: "shellfish", food: 25, n: [50, 0, 0], taste: { umami: 3, sweet: 1 }, tough: 0, delicate: 1, raw: "unsafe", essence: ["unbitten", 2] },
    "caiman-tail": { kind: "meat", food: 35, n: [60, 0, 0], taste: { umami: 2, fat: 1 }, tough: 3, raw: "unsafe", essence: ["steady", 2] },
    "mazacoatl-meat": { kind: "meat", food: 35, n: [60, 0, 0], taste: { umami: 2 }, tough: 2, lean: true, raw: "unsafe", essence: ["coiled", 2], requires: "mazacoatl" },
    "turkey-leg": { kind: "fowl", food: 45, n: [55, 0, 0], taste: { umami: 2, fat: 1, aroma: 1 }, tough: 1, raw: "safe", cooked: true, essence: ["hearty", 1] },
    blindfish: { kind: "fish", food: 20, n: [40, 0, 5], taste: { umami: 2 }, tough: 0, delicate: 2, raw: "unsafe", essence: ["nimble", 2] },
    "smoked-fish": { kind: "fish", food: 40, n: [50, 0, 5], taste: { umami: 2, salt: 2, aroma: 1 }, tough: 0, delicate: 1, raw: "safe", cooked: true, essence: ["keen-eyed", 1] },
    // ---- Insects and eggs ----
    chapulines: { kind: "insect", food: 15, n: [40, 0, 5], taste: { umami: 1, salt: 1, sour: 1, aroma: 1 }, tough: 0, raw: "safe", cooked: true, essence: ["keen-eyed", 1] },
    chicatanas: { kind: "insect", food: 15, n: [45, 5, 0], taste: { umami: 1, fat: 2, aroma: 2 }, tough: 0, raw: "poor", essence: ["ant-back", 2], requires: "chicatana" },
    ahuauhtli: { kind: "insect", food: 15, n: [40, 10, 5], taste: { umami: 2 }, tough: 0, delicate: 2, raw: "poor", essence: ["water-sure", 2], requires: "ahuauhtli" },
    "cave-eggs": { kind: "egg", food: 20, n: [40, 5, 0], taste: { umami: 1, fat: 1 }, tough: 0, delicate: 1, raw: "unsafe", binds: true, essence: ["hearty", 1] },
    // ---- What grows ----
    "cave-mushrooms": { kind: "fungus", food: 15, n: [15, 10, 30], taste: { umami: 3, aroma: 1 }, tough: 1, raw: "poor", essence: ["hushed", 2] },
    "summit-cap": { kind: "fungus", food: 5, n: [5, 5, 15], taste: { bitter: 2, aroma: 2 }, tough: 0, raw: "poor", essence: ["deepsight", 3], requires: "summit-cap" },
    "wild-ingredients": { kind: "green", food: 15, n: [5, 15, 35], taste: { bitter: 1, aroma: 1 }, tough: 1, raw: "poor", essence: ["steady", 1] },
    nopalitos: { kind: "green", food: 20, n: [5, 10, 45], taste: { sour: 1 }, tough: 0, raw: "safe", essence: ["steady", 1] },
    quilitl: { kind: "green", food: 10, n: [5, 5, 40], taste: { bitter: 1, aroma: 1 }, tough: 0, delicate: 1, raw: "safe", essence: ["steady", 1] },
    tecuitlatl: { kind: "algae", food: 20, n: [35, 10, 35], taste: { umami: 2, salt: 1 }, tough: 0, raw: "safe", essence: ["water-sure", 1] },
    miltomatl: { kind: "fruit", food: 10, n: [0, 10, 25], taste: { sour: 2, umami: 1 }, tough: 0, raw: "safe" },
    mamey: { kind: "fruit", food: 20, n: [5, 30, 20], taste: { sweet: 3 }, tough: 0, delicate: 1, raw: "safe" },
    chilis: { kind: "chili", food: 5, n: [0, 5, 15], taste: { heat: 3, aroma: 1 }, tough: 0, raw: "safe", essence: ["fiery", 2] },
    epazotl: { kind: "herb", food: 0, n: [0, 0, 10], taste: { aroma: 3, bitter: 1 }, tough: 0, raw: "safe" },
    // ---- Maize, beans, seeds ----
    nixtamal: { kind: "maize", food: 30, n: [5, 45, 0], taste: { sweet: 1 }, tough: 2, raw: "poor", masa: true },
    tlaxcalli: { kind: "maize", food: 25, n: [5, 40, 5], taste: { sweet: 1, aroma: 1 }, tough: 0, raw: "safe", cooked: true, masa: true, wrap: true },
    ration: { kind: "maize", food: 40, n: [25, 30, 15], taste: { umami: 1, sweet: 1 }, tough: 0, raw: "safe", cooked: true, masa: true, milpa: ["maize", "legume"] },
    pinole: { kind: "maize", food: 20, n: [10, 35, 10], taste: { sweet: 1, aroma: 1 }, tough: 0, raw: "safe", cooked: true },
    etl: { kind: "legume", food: 30, n: [30, 30, 5], taste: { umami: 1 }, tough: 3, raw: "unsafe" },
    ayohuachtli: { kind: "seed", food: 15, n: [20, 5, 10], taste: { fat: 2, aroma: 2, umami: 1 }, tough: 0, raw: "safe", essence: ["coiled", 1] },
    "amaranth-cake": { kind: "seed", food: 25, n: [10, 40, 10], taste: { sweet: 2 }, tough: 0, raw: "safe", cooked: true },
    // ---- Sweet, bitter, salt ----
    honeycomb: { kind: "sweet", food: 15, n: [0, 35, 5], taste: { sweet: 3, aroma: 1 }, tough: 0, raw: "safe", heals: 3 },
    "cacao-pouch": { kind: "cacao", food: 10, n: [5, 10, 5], taste: { bitter: 3, fat: 2, aroma: 2 }, tough: 0, raw: "safe", essence: ["festive", 2], uses: 0.25 },
    "salt-cakes": { kind: "salt", food: 0, n: [0, 0, 0], taste: { salt: 3 }, tough: 0, raw: "safe", uses: 0.1 },
    // ---- What goes in the pot as liquid ----
    "clean-water": { kind: "liquid", food: 0, n: [0, 0, 0], taste: {}, tough: 0, raw: "safe", liquid: true },
    atole: { kind: "liquid", food: 20, n: [5, 30, 5], taste: { sweet: 1 }, tough: 0, raw: "safe", liquid: true, cooked: true },
    soup: { kind: "liquid", food: 35, n: [15, 10, 45], taste: { sweet: 1, umami: 1 }, tough: 0, raw: "safe", liquid: true, cooked: true, milpa: ["squash"], essence: ["steady", 1] },
    "chia-water": { kind: "liquid", food: 5, n: [5, 5, 10], taste: { sour: 1 }, tough: 0, raw: "safe", liquid: true },
    pulque: { kind: "liquid", food: 10, n: [5, 15, 5], taste: { sour: 2 }, tough: 0, raw: "safe", liquid: true, essence: ["bold", 1] },
    "cacao-drink": { kind: "cacao", food: 10, n: [5, 10, 5], taste: { bitter: 2, fat: 1, aroma: 2 }, tough: 0, raw: "safe", liquid: true, essence: ["festive", 1] }
  },

  // The squash, the maize, the beans: the three sisters of the milpa.
  milpaKinds: { maize: "maize", legume: "beans", squash: "squash" },

  // How you can cook. `fire`: needs your campfire. `needs`: an item the cook must carry.
  // `wet`: needs liquid in the pot (a gourd of water is used if nothing else is wet).
  // `minutes`: how long it takes. `fit` scores what each kind of ingredient thinks of it,
  // −2 (ruined) to +2 (made for it); `tough` and `delicate` are how much each point of
  // toughness or delicacy counts for or against. `cooks`: makes unsafe things safe.
  methods: {
    roast: {
      verb: "roasting", name: "Roast over the coals", short: "Roasted", minutes: 30, fire: true, cooks: true, dry: true, difficulty: 1,
      adds: { aroma: 1 }, browns: true,
      fit: { meat: 1, fowl: 2, fish: 1, shellfish: 2, insect: 1, egg: -1, fungus: 2, green: -1, fruit: 0, chili: 2, herb: 0, maize: 1, legume: -2, seed: 1, sweet: -1, cacao: 0, salt: 0, liquid: -2, algae: 0 },
      tough: -1.2, delicate: -0.8,
      text: "Dry heat browns the outside and leaves the inside juicy: right for tender meat, birds, mushrooms, and chilies. It toughens hard cuts and dries out fish."
    },
    toast: {
      verb: "the comal", name: "Toast on the comal", short: "Toasted", minutes: 20, fire: true, cooks: true, dry: true, difficulty: 0,
      adds: { aroma: 1 }, browns: true,
      fit: { meat: -1, fowl: -1, fish: -1, shellfish: 0, insect: 2, egg: 0, fungus: 1, green: 0, fruit: 0, chili: 2, herb: 1, maize: 2, legume: -2, seed: 2, sweet: 0, cacao: 2, salt: 1, liquid: -2, algae: 1 },
      tough: -1.5, delicate: -0.5,
      text: "A hot clay griddle: insects, seeds, chilies, cacao, and maize turn nutty and fragrant in a minute. Too quick for anything thick or tough."
    },
    simmer: {
      verb: "the pot", name: "Simmer in the clay pot", short: "Stewed", minutes: 60, fire: true, cooks: true, wet: true, needs: "iron-pot", difficulty: 1,
      melds: true, broth: 12,
      fit: { meat: 1, fowl: 1, fish: 0, shellfish: 0, insect: 0, egg: 1, fungus: 1, green: 1, fruit: 1, chili: 1, herb: 1, maize: 1, legume: 2, seed: 1, sweet: 0, cacao: 1, salt: 1, liquid: 1, algae: 1 },
      tough: 0.8, delicate: -0.3,
      text: "Long, wet heat in the pot: tough meat, beans, and hominy go tender and every flavor comes together in the broth. Moles, pozoles, and caldos are made this way."
    },
    steam: {
      verb: "steaming", name: "Steam in leaves", short: "Steamed", minutes: 60, fire: true, cooks: true, wet: true, needs: "iron-pot", difficulty: 2,
      fit: { meat: 0, fowl: 1, fish: 2, shellfish: 2, insect: 1, egg: 2, fungus: 2, green: 1, fruit: 1, chili: 1, herb: 1, maize: 2, legume: 0, seed: 1, sweet: 1, cacao: 0, salt: 1, liquid: 0, algae: 1 },
      tough: -0.5, delicate: 0.8, gentle: true,
      text: "Wrapped in leaves over a little boiling water: gentle and moist. Fish, eggs, and mushrooms stay tender, and masa set around a filling makes tamales."
    },
    pit: {
      verb: "the pit", name: "Pit-roast in the embers", short: "Pit-roasted", minutes: 180, fire: true, cooks: true, camp: true, difficulty: 2,
      adds: { aroma: 1, umami: 1 }, browns: true,
      fit: { meat: 2, fowl: 2, fish: 0, shellfish: 0, insect: -1, egg: -1, fungus: 1, green: 0, fruit: 0, chili: 1, herb: 1, maize: 1, legume: 0, seed: 0, sweet: 0, cacao: 0, salt: 1, liquid: 0, algae: 0 },
      tough: 1.2, delicate: -1,
      text: "Wrapped in leaves and buried in the coals for hours: barbacoa. The toughest meat in the tomb comes out falling apart. It takes three hours by your camp."
    },
    fresh: {
      verb: "being eaten raw", name: "Grind or dress it raw", short: "Fresh", minutes: 10, fire: false, cooks: false, difficulty: 0,
      fit: { meat: -2, fowl: -2, fish: -1, shellfish: -1, insect: 1, egg: -2, fungus: -1, green: 2, fruit: 2, chili: 2, herb: 2, maize: 0, legume: -2, seed: 1, sweet: 1, cacao: 0, salt: 1, liquid: 1, algae: 1 },
      tough: -2, delicate: 0.5,
      text: "No fire: chilies, tomatillos, and herbs ground in the molcajete for a salsa, or greens and fruit dressed as they are. Whatever must be cooked is still raw."
    }
  },

  // What the cooks of the valley have always put together. `kinds`/`ids`: every listed
  // group must be in the pot (an entry is a kind, or `id:` an item). `methods`: if set, only
  // cooked those ways. The bonus adds to the dish's quality.
  pairings: [
    { name: "chili and tomatillo", needs: [["chili"], ["id:miltomatl"]], bonus: 1, note: "Chili and tomatillo: the green salsa of every kitchen in the valley." },
    { name: "mole", needs: [["chili"], ["cacao", "seed"], ["meat", "fowl"]], methods: ["simmer"], bonus: 1.5, note: "Chili, seed, and cacao ground and simmered with meat: a mole, the feast sauce." },
    { name: "beans and epazote", needs: [["legume"], ["id:epazotl"]], methods: ["simmer"], bonus: 1, note: "Epazote in the bean pot, as every grandmother does: it tames the beans." },
    { name: "insects and chili", needs: [["insect"], ["chili"]], methods: ["toast", "roast", "fresh"], bonus: 1, note: "Toasted insects with chili: the old snack of the markets." },
    { name: "maize and meat in broth", needs: [["id:nixtamal"], ["meat", "fowl"]], methods: ["simmer"], bonus: 1, note: "Hominy and meat in broth: pozole." },
    { name: "fish in leaves", needs: [["fish", "shellfish"], ["herb", "green"]], methods: ["steam"], bonus: 1, note: "Fish wrapped in leaves with herbs: it steams in its own juices." },
    { name: "honey and chili", needs: [["sweet"], ["chili"]], bonus: 0.5, note: "Sweet against hot: each makes the other better." },
    { name: "eggs and greens", needs: [["egg"], ["green", "herb"]], bonus: 0.5, note: "Eggs bound with greens and herbs." }
  ],

  // What a finished dish is called. The first form that fits names it; otherwise the dish
  // is named from its method and main ingredients. `main`: the kinds the dish is "of".
  forms: [
    { id: "mole", name: "{main} in mole", method: "simmer", needs: [["chili"], ["cacao", "seed"], ["meat", "fowl"]] },
    { id: "pipian", name: "{main} in pipián", method: "simmer", needs: [["id:ayohuachtli"], ["meat", "fowl", "fish", "shellfish"]] },
    { id: "pozole", name: "{main} pozole", method: "simmer", needs: [["id:nixtamal"], ["meat", "fowl", "egg"]] },
    { id: "frijoles", name: "Pot beans{with}", method: "simmer", needs: [["legume"]] },
    { id: "atole", name: "{main} atole", method: "simmer", needs: [["id:atole"]] },
    { id: "tea", name: "{main} tea", method: "simmer", only: ["fungus", "herb", "liquid", "sweet"], needs: [["fungus", "herb"]] },
    { id: "caldo", name: "{main} caldo", method: "simmer", needs: [["meat", "fowl", "fish", "shellfish", "egg", "fungus"]] },
    { id: "tamales", name: "{main} tamales", method: "steam", needs: [["maize"]], filled: true },
    { id: "barbacoa", name: "{main} barbacoa", method: "pit", needs: [["meat", "fowl"]] },
    { id: "salsa", name: "Salsa {color}", method: "fresh", only: ["chili", "fruit", "herb", "green", "salt", "liquid", "insect"], needs: [["chili"]] },
    { id: "tacos", name: "{main} tacos", methods: ["roast", "toast"], needs: [["id:tlaxcalli"]], filled: true },
    { id: "tlacoyos", name: "{main} tlacoyos", methods: ["toast"], needs: [["id:ration", "id:nixtamal"]], filled: true },
    { id: "ensalada", name: "{main} salad", method: "fresh", needs: [["green", "fruit", "algae"]] }
  ],

  // Words for a dish's quality, lowest first, with the score each starts at.
  qualities: [
    { id: "ruined", name: "Ruined", min: -99, food: 0.5, note: "Burnt, raw in the middle, or both." },
    { id: "plain", name: "Plain", min: 0, food: 1, note: "It's food." },
    { id: "good", name: "Good", min: 2, food: 1.1, note: "A good camp meal." },
    { id: "fine", name: "Fine", min: 4, food: 1.2, heal: 2, note: "Better than the inn's." },
    { id: "superb", name: "Superb", min: 6, food: 1.3, heal: 4, note: "A dish the old lords would have kept a cook alive for." }
  ],

  // New market ingredients: the everyday food of the valley, for cooking.
  goods: {
    miltomatl: { name: "Miltomatl (tomatillos)", sprite: "chilis", weight: 0.5, price: 0.3,
      description: "Small green husk tomatoes from the milpa: sour, bright, and the base of every green salsa." },
    epazotl: { name: "Epazote", sprite: "supply", weight: 0.1, price: 0.2,
      description: "A strong, resinous herb. Cooks put a sprig in the bean pot; it makes beans easier to eat." },
    quilitl: { name: "Quelites", sprite: "supply", weight: 0.3, price: 0.2,
      description: "Tender wild greens from the milpa's edges: amaranth leaves, purslane, lamb's-quarters. Good raw, better in a pot." },
    nixtamal: { name: "Nixtamal", sprite: "ration", weight: 1, price: 0.3,
      description: "Maize kernels soaked and cooked in limewater until their skins slip: the start of masa and of pozole. Needs a long simmer." },
    etl: { name: "Dried beans", sprite: "supply", weight: 1, price: 0.3,
      description: "Black and speckled beans from the milpa. Raw beans will make you sick; simmered for an hour they are half of every meal." },
    ayohuachtli: { name: "Squash seeds", sprite: "supply", weight: 0.3, price: 0.4,
      description: "Toasted pumpkin seeds (pepitas). Ground with chili they make pipián; on their own, a rich snack." },
    "fowl-meat": { name: "Cave fowl meat", sprite: "smoked-fish", weight: 1.5, price: 0.8,
      description: "Dark meat from one of the tomb's turkeys or turkey-raptors. Raw; it has to be cooked." },
    "rabbit-meat": { name: "Tomb rabbit meat", sprite: "supply", weight: 1.5, price: 1,
      description: "Pale, tender, and very lean meat from a tomb rabbit. Raw; it needs fat or a sauce, or it's dry." },
    "mapachin-meat": { name: "Mapachin meat", sprite: "supply", weight: 1.2, price: 0.6,
      description: "Dark, fatty, and a little gamey. Raw; cook it well." }
  },
  marketStock: ["miltomatl", "epazotl", "quilitl", "nixtamal", "etl", "ayohuachtli"],
  // The new meats come from these creatures when you butcher them.
  meats: {
    "cave-turkey": "fowl-meat", "giant-turkey": "fowl-meat", "turkey-raptor": "fowl-meat", "black-turkey-raptor": "fowl-meat",
    dungeonrabbit: "rabbit-meat", dungeonrabbit2: "rabbit-meat",
    mapachin: "mapachin-meat", hueymapachin: "mapachin-meat", "elder-mapachin": "mapachin-meat"
  },

  buffs: {
    "well-fed": { name: "Well fed", description: "A whole, good meal: +1 to saving throws.", minutes: 480 }
  }
};

// Register the market ingredients and the new meats as items, and stock the market.
(() => {
  const items = window.CryptsItems;
  const cooking = window.CryptsCooking;
  for (const [id, entry] of Object.entries(cooking.goods)) {
    items.gear[id] = { name: entry.name, weight: entry.weight, price: entry.price, category: "Ingredient", sprite: entry.sprite, description: entry.description };
  }
  if (window.CryptsGoods?.marketStock) {
    for (const id of cooking.marketStock) if (!window.CryptsGoods.marketStock.includes(id)) window.CryptsGoods.marketStock.push(id);
  }
  const species = window.CryptsEcology?.species || {};
  for (const [creature, meat] of Object.entries(cooking.meats)) if (species[creature]) species[creature].meat = meat;
  const progression = window.CryptsProgression;
  if (progression?.buffs) progression.buffs["well-fed"] = cooking.buffs["well-fed"];
})();
