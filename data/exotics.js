"use strict";

// Mahuiz's foreign wares: Spanish steel from the sea giants' floating houses, samurai
// arms carried across the western sea on the galleons, and Norse iron from the pale men
// of the north who rowed to the far shore long before the Spanish came. These are late-game
// gold sinks: strong, beautiful, expensive, and revealed as you delve deeper.
// Each item names an `analog`: every calling trained with the analog can use it.

(() => {
  const items = window.CryptsItems;

  const weapons = {
    "toledo-rapier": {
      name: "Toledo steel rapier", origin: "spanish", art: "rapier", analog: "dagger",
      description: "A swept-hilt rapier of folded Toledo steel, light enough for any trained hand.",
      dice: "1d8", finesse: true, icon: "sword", attackBonus: 2, damageBonus: 1, trait: "keen",
      weight: 3, price: 1800, unlockFloor: 3
    },
    "spanish-broadsword": {
      name: "Spanish steel broadsword", origin: "spanish", art: "broadsword", analog: "macuahuitl",
      description: "A heavy cut-and-thrust sword of the sea giants, its edge never chips like obsidian.",
      dice: "1d10", icon: "sword", attackBonus: 1, damageBonus: 2, trait: "thundering",
      weight: 4, price: 2600, unlockFloor: 5
    },
    "spanish-halberd": {
      name: "Spanish halberd", origin: "spanish", art: "halberd", analog: "macuahuitl",
      description: "An axe blade, hook, and spike on a long ash haft, carried by the sea giants' guards.",
      dice: "1d12", icon: "axe", attackBonus: 1, damageBonus: 3, trait: null,
      weight: 7, price: 3400, unlockFloor: 9
    },
    arquebus: {
      name: "Matchlock arquebus", origin: "spanish", art: "arquebus", analog: "shortbow",
      description: "A thunder-tube of iron and walnut. Mahuiz swears the powder is dry.",
      dice: "2d6", ranged: true, range: 6, icon: "bow", attackBonus: 1, damageBonus: 3, trait: null,
      weight: 10, price: 3800, unlockFloor: 9
    },
    katana: {
      name: "Katana", origin: "samurai", art: "katana", analog: "macuahuitl",
      description: "A curved, single-edged sword with a silk-wrapped grip, carried by envoys from across the western sea.",
      dice: "1d10", finesse: true, icon: "sword", attackBonus: 2, damageBonus: 2, trait: "keen",
      weight: 3, price: 3000, unlockFloor: 5
    },
    yari: {
      name: "Yari spear", origin: "samurai", art: "yari", analog: "spear",
      description: "A straight, double-edged spearhead of polished steel on a lacquered shaft.",
      dice: "1d10", icon: "spear", attackBonus: 2, damageBonus: 1, trait: null,
      weight: 4, price: 2200, unlockFloor: 3
    },
    nodachi: {
      name: "Nōdachi", origin: "samurai", art: "nodachi", analog: "macuahuitl",
      description: "A great field sword taller than its bearer. Every swing is a storm.",
      dice: "2d6", icon: "sword", attackBonus: 1, damageBonus: 3, trait: "thundering",
      weight: 6, price: 4200, unlockFloor: 9
    },
    "ulfberht-sword": {
      name: "Ulfberht sword", origin: "norse", art: "norsesword", analog: "macuahuitl",
      description: "A pattern-welded blade from the cold north, a smith's name inlaid down the fuller. Raided, traded, and carried hand to hand across two oceans.",
      dice: "1d10", icon: "sword", attackBonus: 2, damageBonus: 1, trait: "lifedrinker",
      weight: 3, price: 2400, unlockFloor: 3
    },
    yumi: {
      name: "Yumi longbow", origin: "samurai", art: "yumi", analog: "longbow",
      description: "A tall, asymmetric bow of bamboo and lacquer that sends arrows remarkably far.",
      dice: "1d10", ranged: true, range: 6, icon: "bow", attackBonus: 2, damageBonus: 2, trait: "keen",
      weight: 3, price: 3400, unlockFloor: 9
    }
  };

  const armors = {
    "spanish-cuirass": {
      name: "Spanish steel cuirass", origin: "spanish", art: "cuirass", analog: "scale",
      description: "A polished steel breastplate with riveted tassets. Heavy, bright, and very hard to cut.",
      base: 17, dex: false, strength: 13, acBonus: 0, trait: "sure-footed",
      weight: 30, price: 4000, unlockFloor: 5
    },
    "gilded-half-plate": {
      name: "Gilded Spanish half-plate", origin: "spanish", art: "gilded", analog: "scale",
      description: "Parade armor of a sea-giant captain, chased in gold. Worth a small town.",
      base: 18, dex: false, strength: 15, acBonus: 1, trait: "warded",
      weight: 40, price: 9000, unlockFloor: 9
    },
    "norse-byrnie": {
      name: "Norse mail byrnie", origin: "norse", art: "byrnie", analog: "scale",
      description: "A knee-length shirt of riveted iron rings over a padded tunic, belted at the waist. It took a smith a winter to make.",
      base: 16, dex: true, dexCap: 1, strength: 13, acBonus: 0, trait: "provisioned",
      weight: 26, price: 3600, unlockFloor: 3
    },
    "do-maru": {
      name: "Lacquered dō-maru", origin: "samurai", art: "domaru", analog: "scale",
      description: "Close-fitting lamellar armor of black-lacquered plates laced with red silk.",
      base: 15, dex: true, dexCap: 2, acBonus: 1, trait: "provisioned",
      weight: 22, price: 4500, unlockFloor: 5
    },
    "o-yoroi": {
      name: "Ō-yoroi great armor", origin: "samurai", art: "oyoroi", analog: "scale",
      description: "A general's box-like armor of red-lacquered lamellae, with broad shoulder guards.",
      base: 17, dex: true, dexCap: 1, strength: 13, acBonus: 1, trait: "warded",
      weight: 35, price: 9500, unlockFloor: 9
    }
  };

  const cosmetics = {
    "morion-helmet": { name: "Spanish morion", slot: "helmet", set: "spanish", price: 1200, unlockFloor: 3,
      description: "A crested steel helmet with an upswept brim, straight off a galleon's deck." },
    "norse-helm": { name: "Norse spectacle helm", slot: "helmet", set: "norse", price: 1300, unlockFloor: 3,
      description: "A rounded iron cap with a ridge, a knob on top, and a guard ringing the eyes, hung with mail at the neck. No horns. There were never horns." },
    "kabuto-helmet": { name: "Kabuto with golden horns", slot: "helmet", set: "samurai", price: 1400, unlockFloor: 3,
      description: "A black-lacquered samurai helmet crowned with gilded kuwagata horns." }
  };

  for (const [id, entry] of Object.entries(weapons)) {
    const { weight, price, ...weapon } = entry;
    items.weapons[id] = { ...weapon, exotic: true };
    items.weaponPrices[id] = [weight, price];
  }
  for (const [id, entry] of Object.entries(armors)) {
    const { weight, price, ...armor } = entry;
    items.armors[id] = { ...armor, exotic: true };
    items.armorPrices[id] = [weight, price];
  }
  Object.assign(items.cosmetics, cosmetics);
  for (const id of Object.keys(weapons)) items.addGearTiers("weapon", id);
  for (const id of Object.keys(armors)) items.addGearTiers("armor", id);

  // New everyday goods for Teyac's stalls.
  Object.assign(items.gear, {
    "amaranth-cake": { name: "Amaranth honey cake", weight: 0.5, price: 0.7, category: "Food", sprite: "ration",
      description: "Popped amaranth pressed with honey. Light to carry; restores food and supports carbohydrates." },
    "cacao-drink": { name: "Frothed cacao", weight: 1, price: 1.5, category: "Drink", sprite: "water",
      description: "Bitter chocolate whipped with chili and vanilla. Restores 40% water and 15% food." },
    ixpatli: { name: "Ixpatli poultice", weight: 0.3, price: 6, category: "Potion", sprite: "potion",
      description: "A healer's wound herb. Cures poison, bleeding, and weakness without using medicine." },
    copal: { name: "Copal incense", weight: 0.5, price: 12, category: "Supply", sprite: "supply",
      description: "Burn at camp to purify the air: the next rest in the tomb grants an extra 8-hour Steady boon." }
  });
  items.food["amaranth-cake"] = { name: "Amaranth honey cake", sprite: "ration", nutrients: { protein: 10, carbohydrates: 45, greens: 10 }, food: 35 };

  // Every calling trained with an item's analog can use it.
  const analogTargets = [
    ...Object.entries(weapons).map(([id, entry]) => ({ id, analog: entry.analog, list: "weapons" })),
    ...Object.entries(armors).map(([id, entry]) => ({ id, analog: entry.analog, list: "armor" }))
  ];
  for (const characterClass of Object.values(CLASSES)) {
    for (const { id, analog, list } of analogTargets) {
      if (characterClass[list].includes(analog) && !characterClass[list].includes(id)) characterClass[list].push(id);
    }
  }

  window.CryptsExotics = {
    vendorStock: [
      ...Object.keys(weapons).map((id) => `weapon:${id}`),
      ...Object.keys(armors).map((id) => `armor:${id}`),
      ...Object.keys(cosmetics).map((id) => `cosmetic:${id}`),
      "cosmetic:jaguar-helmet", "cosmetic:jaguar-clothes", "cosmetic:eagle-helmet", "cosmetic:eagle-clothes",
      "cosmetic:tzitzimitl-helmet", "cosmetic:tzitzimitl-clothes",
      "cosmetic:quetzal-headdress", "cosmetic:quetzal-fan", "cosmetic:spanish-guidon", "cosmetic:nobori"
    ],
    marketAdditions: ["amaranth-cake", "cacao-drink", "ixpatli", "copal"]
  };
})();
