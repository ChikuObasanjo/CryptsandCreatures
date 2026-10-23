"use strict";

// Progression content: gear quality tiers, relic traits, camp recipes, town projects,
// bounties, renown tiers, elite creatures, and creature conditions.
// Tiered weapons and armor are generated here as ordinary catalog entries
// ("macuahuitl--fine", "scale--relic-warded"), so the pack, market, save, and
// equipment code treat them like any other item.

(() => {
  const items = window.CryptsItems;

  const tiers = {
    fine: { label: "Fine", rank: 1, priceMultiplier: 3, minimumPrice: 15, attack: 1, damage: 0, ac: 1 },
    masterwork: { label: "Masterwork", rank: 2, priceMultiplier: 8, minimumPrice: 45, attack: 1, damage: 1, ac: 1 },
    relic: { label: "Relic", rank: 3, priceMultiplier: 20, minimumPrice: 120, attack: 2, damage: 2, ac: 2 }
  };

  const weaponTraits = {
    keen: { name: "Keen", description: "Critical hits on a natural 19 or 20." },
    lifedrinker: { name: "Lifedrinker", description: "Regain 2 hit points whenever you defeat a creature." },
    thundering: { name: "Thundering", description: "Hits have a 1 in 4 chance to stagger a creature, costing it its next turn." }
  };
  const armorTraits = {
    "sure-footed": { name: "Sure-footed", description: "+3 to saving throws against traps." },
    warded: { name: "Warded", description: "Immune to poison, bleeding, and weakness." },
    provisioned: { name: "Provisioned", description: "Food and water drain 1% slower each hour in the tomb." }
  };

  const baseWeapons = Object.keys(items.weapons);
  const baseArmors = Object.keys(items.armors).filter((id) => id !== "none");

  const addTieredEntry = (catalog, prices, baseId, tierId, traitId, traitCatalog) => {
    const base = catalog[baseId];
    const tier = tiers[tierId];
    const key = traitId ? `${baseId}--${tierId}-${traitId}` : `${baseId}--${tierId}`;
    const trait = traitId ? traitCatalog[traitId] : null;
    const [weight, price] = prices[baseId];
    catalog[key] = {
      ...base,
      name: `${tier.label} ${base.name}${trait ? ` · ${trait.name}` : ""}`,
      baseId,
      tier: tierId,
      trait: traitId || null
    };
    prices[key] = [weight, Math.max(tier.minimumPrice, Math.round(price * tier.priceMultiplier))];
  };

  for (const baseId of baseWeapons) {
    if (!items.weaponPrices[baseId]) continue;
    addTieredEntry(items.weapons, items.weaponPrices, baseId, "fine");
    addTieredEntry(items.weapons, items.weaponPrices, baseId, "masterwork");
    for (const traitId of Object.keys(weaponTraits)) {
      addTieredEntry(items.weapons, items.weaponPrices, baseId, "relic", traitId, weaponTraits);
    }
  }
  for (const baseId of baseArmors) {
    if (!items.armorPrices[baseId]) continue;
    addTieredEntry(items.armors, items.armorPrices, baseId, "fine");
    addTieredEntry(items.armors, items.armorPrices, baseId, "masterwork");
    for (const traitId of Object.keys(armorTraits)) {
      addTieredEntry(items.armors, items.armorPrices, baseId, "relic", traitId, armorTraits);
    }
  }

  // Camp dishes. Each restores food like a meal and grants a temporary boon.
  const buffs = {
    hearty: { name: "Hearty", description: "+1 to attack rolls.", minutes: 480 },
    fiery: { name: "Fire in the belly", description: "+2 weapon damage.", minutes: 480 },
    steady: { name: "Steady", description: "+1 AC.", minutes: 480 },
    "keen-eyed": { name: "Keen-eyed", description: "+2 Perception and Survival.", minutes: 480 }
  };
  const recipes = {
    "cave-meat-pozole": {
      name: "Cave-meat pozole", ingredients: { "monster-meat": 1, "wild-ingredients": 1 }, buff: "hearty",
      food: 70, nutrients: { protein: 40, carbohydrates: 30, greens: 20 },
      description: "Hominy stew thick with cave-creature meat. Eat for food and Hearty: +1 to attack rolls for 8 hours."
    },
    "chili-roast": {
      name: "Chili-rubbed roast", ingredients: { "monster-meat": 1, chilis: 1 }, buff: "fiery",
      food: 60, nutrients: { protein: 45, carbohydrates: 25, greens: 5 },
      description: "Seared meat crusted in ground chilies. Eat for food and Fire in the belly: +2 weapon damage for 8 hours."
    },
    "jungle-broth": {
      name: "Jungle-herb broth", ingredients: { soup: 1, "wild-ingredients": 1 }, buff: "steady",
      food: 55, nutrients: { protein: 10, carbohydrates: 15, greens: 50 },
      description: "Squash soup brightened with foraged herbs. Eat for food and Steady: +1 AC for 8 hours."
    },
    "fish-tamales": {
      name: "Smoked-fish tamales", ingredients: { "smoked-fish": 1, ration: 1 }, buff: "keen-eyed",
      food: 80, nutrients: { protein: 35, carbohydrates: 35, greens: 20 },
      description: "Flaked fish folded into fresh masa. Eat for food and Keen-eyed: +2 Perception and Survival for 8 hours."
    }
  };
  for (const [id, recipe] of Object.entries(recipes)) {
    items.food[id] = { name: recipe.name, sprite: "soup", nutrients: recipe.nutrients, food: recipe.food, buff: recipe.buff };
    items.gear[id] = { name: recipe.name, weight: 1, price: 3, category: "Food", sprite: "soup", description: recipe.description };
  }

  window.CryptsProgression = {
    tiers,
    weaponTraits,
    armorTraits,
    buffs,
    recipes,
    conditions: {
      poison: { name: "Poisoned", description: "Lose 1 hit point each turn (never below 1).", turns: 4 },
      bleed: { name: "Bleeding", description: "Lose 1 hit point each turn (never below 1).", turns: 3 },
      weakened: { name: "Weakened", description: "−2 to attack rolls.", turns: 5 }
    },
    creatureConditions: {
      "tomb-bat": { condition: "bleed", chance: 25 },
      "cenote-stalker": { condition: "poison", chance: 25 },
      "jungle-jaguar": { condition: "bleed", chance: 35 },
      "feathered-serpent": { condition: "poison", chance: 40 },
      camazotz: { condition: "bleed", chance: 30 },
      cihuateotl: { condition: "weakened", chance: 30 },
      duende: { condition: "weakened", chance: 20 },
      mictlaneca: { condition: "weakened", chance: 25 },
      tzitzimitl: { condition: "weakened", chance: 35 }
    },
    eliteTitles: ["Elder", "Jade-marked", "Night-touched", "Obsidian-scarred", "Star-bitten"],
    projects: {
      granary: {
        name: "Maize Granary", emblem: "❦",
        description: "Shared stores mean lighter packs and steadier stomachs.",
        levels: [
          { cost: 120, effect: "Food drains 1% slower each hour in the tomb." },
          { cost: 380, effect: "Water also drains 1% slower each hour." }
        ]
      },
      shrine: {
        name: "Shrine of the Ceiba", emblem: "✥",
        description: "Offerings at the great tree watch over those below.",
        levels: [
          { cost: 150, effect: "If you fall, the crew saves half of your unsecured gold." },
          { cost: 450, effect: "+1 to all saving throws." }
        ]
      },
      workshop: {
        name: "Obsidian Workshop", emblem: "◆",
        description: "Knappers and weavers who can improve your gear.",
        levels: [
          { cost: 100, effect: "Reforge your equipped weapon or armor to Fine quality." },
          { cost: 340, effect: "Reforge Fine gear to Masterwork quality." }
        ]
      },
      lift: {
        name: "Wardens' Rope Lift", emblem: "⇣",
        description: "A guarded shaft down through the tomb's old light-wells.",
        levels: [
          { cost: 250, effect: "Descend straight to floor 5 once you have reached it." },
          { cost: 700, effect: "Descend straight to floor 9 once you have reached it." }
        ]
      },
      "trade-hall": {
        name: "Pochteca Trade Hall", emblem: "◈",
        description: "Long-distance traders bring better goods to the market.",
        levels: [
          { cost: 200, effect: "Treasure sells for 10% more." },
          { cost: 500, effect: "The market stocks Fine gear suited to your calling." }
        ]
      }
    },
    renownTiers: [
      { bounties: 0, title: "Newcomer", rewardBonus: 0 },
      { bounties: 3, title: "Tomb-runner", rewardBonus: 0.1 },
      { bounties: 8, title: "Seasoned delver", rewardBonus: 0.2 },
      { bounties: 15, title: "Keeper of the Old Road", rewardBonus: 0.35 },
      { bounties: 30, title: "Legend of Chiltomatlan", rewardBonus: 0.5 }
    ],
    bestiaryTiers: [
      { kills: 1, title: "Sighted", description: "Recorded in your journal." },
      { kills: 5, title: "Studied", description: "+1 to attack rolls against this creature." },
      { kills: 15, title: "Mastered", description: "+1 attack and +1 damage against this creature." }
    ]
  };
})();
