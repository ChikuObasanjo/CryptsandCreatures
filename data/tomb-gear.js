"use strict";

// Arms and armor of the peoples beyond the Mexica, found only in the tomb. The nameless
// king's grave goods came from everywhere: the P'urhépecha (Purépecha) kingdom in the west,
// whose smiths worked copper and bronze and whose archers beat back the Mexica army; the
// Maya cities of the south and their flint and stingray spine; the Huastec coast and its
// red spondylus shell; and the Mixtec goldsmiths of Oaxaca.
//
// `analog`: every calling trained with the analog can use the item. `minFloor`: the
// shallowest floor it can turn up on. None of these are sold in Chiltomatlan.

(() => {
  const items = window.CryptsItems;

  const weapons = {
    "copper-axe": { name: "P'urhépecha copper axe", origin: "purepecha", art: "copperaxe", icon: "axe", analog: "handaxe",
      dice: "1d8", attackBonus: 1, trait: "thundering", minFloor: 3, weight: 3, price: 160,
      description: "A cast-copper axe head on a hardwood haft, from the western kingdom the Mexica never conquered. Its smiths worked metal when everyone else worked stone. Thundering: hits sometimes stagger the target." },
    "purepecha-bow": { name: "P'urhépecha war bow", origin: "purepecha", art: "purebow", icon: "bow", analog: "shortbow",
      dice: "1d8", ranged: true, range: 7, attackBonus: 1, damageBonus: 1, trait: "keen", minFloor: 4, weight: 2, price: 220,
      description: "A sinew-backed bow painted in red and black bands, the kind the archers of Tzintzuntzan used to turn back the Mexica at Taximaroa. Keen: critical hits on 19 or 20." },
    "flint-lance": { name: "Maya flint lance", origin: "maya", art: "flintlance", icon: "spear", analog: "spear",
      dice: "1d10", attackBonus: 1, damageBonus: 1, minFloor: 5, weight: 4, price: 260,
      description: "A thrusting spear with a broad blade of knapped flint as long as a hand, trimmed with feathers below the head, as Maya lords carry it on their painted walls." },
    "stingray-spine": { name: "Stingray-spine dagger", origin: "maya", art: "stingray", icon: "dagger", analog: "dagger",
      dice: "1d4", finesse: true, attackBonus: 2, damageBonus: 1, trait: "lifedrinker", minFloor: 6, weight: 0.5, price: 300,
      description: "A Maya lord's bloodletter: a barbed stingray spine set in a carved bone grip, made for offering one's own blood. Lifedrinker: regain 2 HP when you defeat a creature." }
  };

  const armors = {
    "salt-cotton": { name: "Salt-packed cotton armor", origin: "maya", art: "saltcotton", analog: "scale",
      base: 15, dex: true, dexCap: 2, minFloor: 4, weight: 20, price: 300,
      description: "Quilted cotton two fingers thick, stiffened with rock salt the way they make it in Yucatán. Arrows stick in it and stay there." },
    "spondylus-plate": { name: "Spondylus-shell breastplate", origin: "huastec", art: "spondylus", analog: "leather",
      base: 12, dex: true, acBonus: 1, trait: "warded", minFloor: 5, weight: 6, price: 380,
      description: "Plaques of red thorny-oyster shell strung over cotton, from the Huastec coast. Too beautiful for war, but it turns a blade. Warded: immune to poison, bleeding, and weakness." },
    "copper-scale": { name: "P'urhépecha copper-scale coat", origin: "purepecha", art: "copperscale", analog: "scale",
      base: 16, dex: false, strength: 13, trait: "sure-footed", minFloor: 6, weight: 34, price: 520,
      description: "Overlapping copper plates sewn to a deerskin coat by the metalworkers of the west: green where it's old, bright where it's been struck. Sure-footed: +3 to saves against traps." },
    "mixtec-gold": { name: "Mixtec gold-bell vest", origin: "mixtec", art: "mixtecgold", analog: "leather",
      base: 13, dex: true, dexCap: 3, acBonus: 1, trait: "provisioned", minFloor: 8, weight: 8, price: 700,
      description: "Quilted cotton hung with Mixtec goldwork, little cast bells and plaques that ring as you move. The lords of Oaxaca wore it to be seen. Provisioned: food and water drain slower in the tomb." }
  };

  for (const [id, entry] of Object.entries(weapons)) {
    const { weight, price, analog, minFloor, ...weapon } = entry;
    items.weapons[id] = { ...weapon, tombOnly: true, minFloor };
    items.weaponPrices[id] = [weight, price];
    items.addGearTiers("weapon", id);
  }
  for (const [id, entry] of Object.entries(armors)) {
    const { weight, price, analog, ...armor } = entry;
    items.armors[id] = { ...armor, tombOnly: true };
    items.armorPrices[id] = [weight, price];
    items.addGearTiers("armor", id);
  }
  for (const characterClass of Object.values(CLASSES)) {
    for (const [id, entry] of Object.entries(weapons)) {
      if (characterClass.weapons.includes(entry.analog) && !characterClass.weapons.includes(id)) characterClass.weapons.push(id);
    }
    for (const [id, entry] of Object.entries(armors)) {
      if (characterClass.armor.includes(entry.analog) && !characterClass.armor.includes(id)) characterClass.armor.push(id);
    }
  }

  const wardrobe = window.CryptsWardrobe;
  if (wardrobe) {
    wardrobe.tombWeapons = Object.entries(weapons).map(([id, entry]) => ({ id: `weapon:${id}`, minFloor: entry.minFloor }));
    wardrobe.tombArmor.push(...Object.entries(armors).map(([id, entry]) => ({ id: `armor:${id}`, minFloor: entry.minFloor })));
  }
})();
