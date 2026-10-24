"use strict";

// More goods for Chiltomatlan and the tomb: the food of the market and the milpa, drinks,
// remedies and field consumables with their own uses, porters' gear, native weapons and
// armor, and more treasure to carry home. Everything here is ordinary catalog data; the
// few items with special uses are handled in app.js (useInventoryItem) and camp rest.
//
// Art: new items borrow the closest existing icon (`sprite`) until they get their own.

(() => {
  const items = window.CryptsItems;
  const progression = window.CryptsProgression;

  // ---------- Food (eaten from the pack or at camp) ----------
  // food: how much the food meter rises; nutrients feed the three nutrition meters;
  // water: hydration added too; heal: hit points restored when eaten; buff: a meal boon.
  const foods = {
    tlaxcalli: { name: "Stack of tlaxcalli", sprite: "ration", food: 30, nutrients: { protein: 5, carbohydrates: 45, greens: 5 },
      weight: 0.5, price: 0.2, description: "Warm maize flatbreads wrapped in a cloth. Cheap, light, and good with everything." },
    pinole: { name: "Pinole pouch", sprite: "supply", food: 25, nutrients: { protein: 10, carbohydrates: 40, greens: 10 },
      weight: 0.3, price: 0.4, description: "Toasted maize ground with chia and a little cacao. Runners carried it for days; mix it with water and keep moving." },
    chapulines: { name: "Toasted chapulines", sprite: "chilis", food: 25, nutrients: { protein: 50, carbohydrates: 5, greens: 10 },
      weight: 0.3, price: 0.5, description: "Grasshoppers toasted with lime, salt, and chili. Crunchy, sour, and full of strength." },
    nopalitos: { name: "Nopal salad", sprite: "soup", food: 35, nutrients: { protein: 5, carbohydrates: 10, greens: 55 },
      weight: 1, price: 0.5, description: "Tender cactus paddles, cleaned of spines and dressed with onion and herbs." },
    tecuitlatl: { name: "Tecuitlatl cakes", sprite: "ration", food: 30, nutrients: { protein: 35, carbohydrates: 10, greens: 40 },
      weight: 0.5, price: 1, description: "Dried cakes of blue-green lake algae skimmed from the great lake. Tastes like the shore; keeps for a year." },
    mamey: { name: "Mamey sapote", sprite: "chilis", food: 30, water: 10, nutrients: { protein: 5, carbohydrates: 35, greens: 25 },
      weight: 1, price: 0.6, description: "A rough brown fruit with sweet salmon-colored flesh. Juicy enough to wet a dry throat." },
    "turkey-leg": { name: "Roast turkey leg", sprite: "smoked-fish", food: 60, nutrients: { protein: 60, carbohydrates: 5, greens: 5 }, buff: "hearty",
      weight: 1.5, price: 2.5, description: "A whole huexolotl leg roasted over coals. A feast-day food; eat it and feel Hearty: +1 to attack rolls for 8 hours." },
    honeycomb: { name: "Melipona honeycomb", sprite: "ration", food: 20, heal: 3, nutrients: { protein: 0, carbohydrates: 40, greens: 5 },
      weight: 0.5, price: 3, description: "Comb from the stingless forest bees, dark and floral. Healers use the honey on wounds; eating it restores 3 hit points." },
    // Drinks are foods too, so camp meals can use them.
    atole: { name: "Gourd of atole", sprite: "water", food: 25, water: 30, nutrients: { protein: 5, carbohydrates: 35, greens: 5 },
      weight: 1.5, price: 0.4, description: "Thick, warm maize drink sweetened with honey. Breakfast for half the town; restores food and 30% water." },
    "chia-water": { name: "Chia and lime water", sprite: "water", food: 5, water: 60, nutrients: { protein: 5, carbohydrates: 5, greens: 10 },
      weight: 2, price: 0.3, description: "Water thickened with chia seed and sharpened with lime. Restores 60% water and stays with you longer than plain water." },
    pulque: { name: "Gourd of pulque", sprite: "water", food: 10, water: 35, nutrients: { protein: 5, carbohydrates: 15, greens: 5 }, buff: "bold",
      weight: 2, price: 1, description: "Milky fermented maguey sap. It makes you Bold for 8 hours: +1 to attack rolls, but −2 Perception. The old women say it's medicine." }
  };

  // ---------- Remedies, consumables, and field supplies ----------
  const supplies = {
    "maguey-salve": { name: "Maguey-sap salve", category: "Potion", sprite: "potion", weight: 0.3, price: 6,
      description: "Sticky maguey sap cooked with herbs. Restores 1d4 + 1 hit points even when you're hungry, and stops bleeding." },
    picietl: { name: "Picietl tobacco pouch", category: "Supply", sprite: "supply", weight: 0.2, price: 3,
      description: "Wild tobacco ground with lime, chewed by porters on long marches. Shakes off the need for sleep for another full day." },
    "chili-smoke": { name: "Chili-smoke gourd", category: "Supply", sprite: "chilis", weight: 1, price: 8,
      description: "A sealed gourd of dried chilies over a slow coal. Crack it open and the choking smoke makes every creature beside you lose its next turn." },
    ocote: { name: "Ocote fatwood bundle", category: "Supply", sprite: "tool", weight: 1.5, price: 0.5,
      description: "Resin-rich pine splints that burn bright and long. Lights the tomb twice as far as a torch: 12 squares." },
    "marigold-garland": { name: "Cempasúchil garland", category: "Supply", sprite: "supply", weight: 0.3, price: 6,
      description: "Orange marigolds strung for the dead, whose bright smell is said to guide them. Burned at camp, the next rest leaves everyone Keen-eyed." }
  };

  // ---------- Carried gear with lasting effects ----------
  const tools = {
    mecapal: { name: "Mecapal tumpline", category: "Tool", sprite: "kit", weight: 1, price: 4, capacityBonus: 30,
      description: "The forehead strap of the tlameme porters, who carried the empire's trade on their backs. +30 lb carrying capacity." },
    ayate: { name: "Ayate net bag", category: "Tool", sprite: "kit", weight: 0.5, price: 1.5, capacityBonus: 15,
      description: "A loose-woven maguey-fiber carrying cloth that ties into a sack. +15 lb carrying capacity." },
    "fire-drill": { name: "Fire drill and hearth board", category: "Tool", sprite: "tool", weight: 1, price: 1.5, skillBonuses: { survival: 2 },
      description: "A spindle and a notched board for coaxing fire out of wood. +2 Survival while carried, which helps when you improvise a camp." },
    "owl-amulet": { name: "Owl-feather amulet", category: "Keepsake", sprite: "keepsake", weight: 0.1, price: 12, skillBonuses: { perception: 1 },
      description: "A tuft of owl down bound in red thread. The owl sees what moves in the dark. +1 Perception while carried." },
    tonalamatl: { name: "Pocket tonalamatl", category: "Keepsake", sprite: "keepsake", weight: 0.5, price: 60,
      skillBonuses: { perception: 1, survival: 1, cooking: 1, "sleight-of-hand": 1 },
      description: "A folding book of the 260-day count, small enough for a pouch. Knowing the good days helps with everything: +1 Perception, Survival, Cooking, and Sleight of Hand." },
    "obsidian-razors": { name: "Prismatic obsidian blades", category: "Tool", sprite: "tool", weight: 0.2, price: 3, skillBonuses: { cooking: 1, survival: 1 },
      description: "Glassy blades struck from a single core, sharper than any metal. +1 Cooking and Survival while carried." }
  };

  // ---------- Native weapons ----------
  // `analog`: every calling trained with the analog weapon can use this one too.
  const weapons = {
    tematlatl: { name: "Tematlatl sling", analog: "atlatl", icon: "sling", dice: "1d4", ranged: true, range: 6, weight: 0.5, price: 0.5,
      description: "A braided maguey sling and a pouch of river stones. Cheap, quiet, and deadly in practiced hands." },
    tlacalhuaztli: { name: "Tlacalhuaztli blowgun", analog: "atlatl", icon: "blowgun", dice: "1d4", ranged: true, range: 5, finesse: true, trait: "keen", weight: 1, price: 6,
      description: "A long cane blowgun and clay pellets, used for birds and for silencing sentries. Keen: critical hits on 19 or 20." },
    cuauhololli: { name: "Cuauhololli war club", analog: "mace", icon: "mace", dice: "1d8", weight: 3, price: 12, trait: "thundering",
      description: "A hardwood club with a heavy carved ball at the end. Thundering: hits sometimes stagger the target." },
    huitzauhqui: { name: "Huitzauhqui studded club", analog: "macuahuitl", icon: "studded-club", dice: "1d10", weight: 5, price: 40,
      description: "A broad hardwood paddle studded with obsidian points along both edges. Heavier and meaner than a macuahuitl." }
  };

  // ---------- Native armor ----------
  const armors = {
    "maguey-jerkin": { name: "Maguey-fiber jerkin", analog: "leather", base: 11, dex: true, weight: 6, price: 6,
      description: "Thick knotted maguey cord sewn into a sleeveless coat. Cheap, light, and better than nothing." },
    "jaguar-shirt": { name: "Jaguar-pelt war shirt", analog: "leather", art: "jaguarshirt", tombOnly: true, minFloor: 4,
      base: 13, dex: true, dexCap: 3, trait: "sure-footed", weight: 9, price: 220,
      description: "A shirt of spotted jaguar pelt over quilted cotton, once worn by an eagle-and-jaguar knight. Sure-footed: +3 to saves against traps." }
  };

  // ---------- Treasure from the tomb ----------
  const treasures = {
    "salt-cakes": { name: "Bundle of salt cakes", sprite: "ration", price: 18, weight: 1, minFloor: 1,
      description: "Hard white cakes of lake salt wrapped in leaves. Salt buys anything in the hill towns." },
    "copper-bells": { name: "Copper coyolli bells", sprite: "gold-ring", price: 22, weight: 0.3, minFloor: 1,
      description: "A string of little cast-copper bells, worn at the ankles by dancers." },
    quachtli: { name: "Bolt of quachtli cotton", sprite: "clothing", price: 28, weight: 2, minFloor: 2,
      description: "A standard length of fine white cotton cloth. Tribute was counted in these; so were debts." },
    tecciztli: { name: "Conch-shell trumpet", sprite: "spondylus-shell", price: 60, weight: 1.5, minFloor: 3,
      description: "A great sea conch with the tip cut away. Its blast once opened temple ceremonies at dawn. Blown down a stairwell, it echoes back a moment too late, as if something below were answering." },
    "amber-drop": { name: "Amber with a trapped insect", sprite: "jade-bead", price: 75, weight: 0.2, minFloor: 4,
      description: "A drop of golden amber from the southern highlands, a tiny ancient bee caught inside." },
    "jaguar-pelt": { name: "Jaguar pelt", sprite: "treasure", price: 90, weight: 5, minFloor: 4,
      description: "A whole spotted pelt, the right of lords and warriors to sit on. Heavy, warm, and very valuable." },
    "tecali-vase": { name: "Tecali alabaster vase", sprite: "terracotta-figurine", price: 110, weight: 3, minFloor: 6,
      description: "A vase of banded onyx-alabaster carved so thin that light glows through it." },
    "feather-shield": { name: "Feather-mosaic shield", sprite: "treasure", price: 260, weight: 3, minFloor: 8,
      description: "A ceremonial chimalli faced with a coyote of blue and red feathers and fringed with gold. Never meant for battle." },
    "crystal-skull": { name: "Rock-crystal skull", sprite: "obsidian-eccentric", price: 350, weight: 2, minFloor: 10,
      description: "A skull ground from a single block of clear quartz over generations. It is very cold to the touch, except at the jaw, which is warm, as if it had been talking." },
    "jadeite-mask": { name: "Jadeite funerary mask", sprite: "turquoise-mask", price: 480, weight: 2, minFloor: 11,
      description: "A death mask of fitted jadeite with shell-and-obsidian eyes, made for a lord whose name was scraped away. The mask was made for a living face. It was never worn in death." }
  };

  // ---------- Camp recipes using the new food ----------
  const recipes = {
    "chapulin-tlacoyos": {
      name: "Chapulín tlacoyos", ingredients: { chapulines: 1, tlaxcalli: 1 }, buff: "keen-eyed",
      food: 60, nutrients: { protein: 45, carbohydrates: 35, greens: 10 },
      description: "Stuffed masa cakes with toasted grasshoppers and salsa. Eat for food and Keen-eyed: +2 Perception and Survival for 8 hours."
    },
    "turkey-mole": {
      name: "Turkey in mole", ingredients: { "turkey-leg": 1, chilis: 1, "cacao-drink": 1 }, buff: "festive",
      food: 85, nutrients: { protein: 50, carbohydrates: 30, greens: 15 },
      description: "Turkey simmered in a dark sauce of chilies, cacao, and seeds: the feast dish. Eat for food and Festive: +1 to attack rolls and +1 AC for 8 hours."
    },
    "lake-atole": {
      name: "Tecuitlatl atole", ingredients: { tecuitlatl: 1, atole: 1 }, buff: "steady",
      food: 55, nutrients: { protein: 30, carbohydrates: 30, greens: 35 },
      description: "Warm maize drink thickened with crumbled lake algae. Eat for food and Steady: +1 AC for 8 hours."
    }
  };

  const newBuffs = {
    bold: { name: "Bold", description: "+1 to attack rolls, −2 Perception.", minutes: 480 },
    festive: { name: "Festive", description: "+1 to attack rolls and +1 AC.", minutes: 480 }
  };

  // ---------- Register everything ----------
  for (const [id, entry] of Object.entries(foods)) {
    const { weight, price, description, ...food } = entry;
    items.food[id] = { name: entry.name, ...food };
    items.gear[id] = { name: entry.name, weight, price, category: entry.water >= entry.food ? "Drink" : "Food", sprite: entry.sprite, description };
  }
  for (const [id, entry] of Object.entries({ ...supplies, ...tools })) items.gear[id] = { ...entry };
  for (const [id, entry] of Object.entries(weapons)) {
    const { weight, price, analog, ...weapon } = entry;
    items.weapons[id] = weapon;
    items.weaponPrices[id] = [weight, price];
    items.addGearTiers("weapon", id);
  }
  for (const [id, entry] of Object.entries(armors)) {
    const { weight, price, analog, ...armor } = entry;
    items.armors[id] = armor;
    items.armorPrices[id] = [weight, price];
    items.addGearTiers("armor", id);
  }
  for (const [id, entry] of Object.entries(treasures)) {
    items.gear[id] = { name: entry.name, weight: entry.weight, price: entry.price, category: "Treasure", sprite: entry.sprite, description: entry.description };
  }
  Object.assign(progression.buffs, newBuffs);
  for (const [id, recipe] of Object.entries(recipes)) {
    progression.recipes[id] = { name: recipe.name, ingredients: recipe.ingredients, buff: recipe.buff, food: recipe.food, nutrients: recipe.nutrients, description: recipe.description };
    items.food[id] = { name: recipe.name, sprite: "soup", nutrients: recipe.nutrients, food: recipe.food, buff: recipe.buff };
    items.gear[id] = { name: recipe.name, weight: 1, price: 4, category: "Food", sprite: "soup", description: recipe.description };
  }
  for (const characterClass of Object.values(CLASSES)) {
    for (const [id, entry] of Object.entries(weapons)) {
      if (characterClass.weapons.includes(entry.analog) && !characterClass.weapons.includes(id)) characterClass.weapons.push(id);
    }
    for (const [id, entry] of Object.entries(armors)) {
      if (characterClass.armor.includes(entry.analog) && !characterClass.armor.includes(id)) characterClass.armor.push(id);
    }
  }

  // Tomb finds join the wardrobe's loot tables.
  const wardrobe = window.CryptsWardrobe;
  if (wardrobe) {
    wardrobe.tombTreasure.push(...Object.entries(treasures).map(([id, entry]) => ({ id, minFloor: entry.minFloor })));
    wardrobe.tombArmor.push(...Object.entries(armors).filter(([, entry]) => entry.tombOnly)
      .map(([id, entry]) => ({ id: `armor:${id}`, minFloor: entry.minFloor })));
  }

  window.CryptsGoods = {
    marketStock: [
      "tlaxcalli", "pinole", "chapulines", "nopalitos", "tecuitlatl", "mamey", "turkey-leg", "honeycomb",
      "atole", "chia-water", "pulque",
      "maguey-salve", "picietl", "chili-smoke", "ocote", "marigold-garland",
      "mecapal", "ayate", "fire-drill", "owl-amulet", "tonalamatl", "obsidian-razors",
      "weapon:tematlatl", "weapon:tlacalhuaztli", "weapon:cuauhololli", "weapon:huitzauhqui", "armor:maguey-jerkin"
    ],
    // Things you can stumble on while foraging in the tomb's overgrown chambers.
    forageFinds: ["nopalitos", "mamey", "honeycomb", "chapulines"]
  };
})();
