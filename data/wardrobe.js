"use strict";

// The wardrobe: clothes, head ornaments, and back banners you carry and wear.
// Every wearable is an inventory item "wear:<id>" (weighs a little, can be sold or dropped)
// and is equipped into one of three look slots: helmet (head), clothes, or back.
// Wearables only change how your adventurer looks. Armor and treasure for the tomb live here too.

(() => {
  const items = window.CryptsItems;

  // Existing regalia keep their ids; they gain a rarity and a carry weight.
  const regalia = {
    "jaguar-helmet": ["exotic", 1], "jaguar-clothes": ["exotic", 2], "eagle-helmet": ["exotic", 1],
    "eagle-clothes": ["exotic", 2], "tzitzimitl-helmet": ["exotic", 1], "tzitzimitl-clothes": ["exotic", 2],
    "morion-helmet": ["exotic", 2], "kabuto-helmet": ["exotic", 2]
  };
  for (const [id, [rarity, weight]] of Object.entries(regalia)) {
    if (items.cosmetics[id]) Object.assign(items.cosmetics[id], { rarity, weight, source: "mahuiz" });
  }

  const wearables = {
    // ----- Head ornaments -----
    amacalli: { name: "Amacalli paper crown", slot: "helmet", rarity: "common", weight: 0.5, price: 20, source: "market",
      description: "A tall crown of folded bark paper, painted in red and white bands for festival days." },
    "heron-crest": { name: "Heron-feather crest", slot: "helmet", rarity: "fine", weight: 0.5, price: 70, source: "market",
      description: "A white aztatzontli of heron plumes, tied to a red headband." },
    "deer-crown": { name: "Deer-antler crown", slot: "helmet", rarity: "fine", weight: 1, price: 60, source: "tomb", minFloor: 2,
      description: "A hunter's headband set with a pair of small antlers, sacred to Mixcoatl." },
    "skull-band": { name: "Bone-bead headband", slot: "helmet", rarity: "fine", weight: 1, price: 75, source: "tomb", minFloor: 3,
      description: "A band of carved bone beads with a little grinning skull at the brow." },
    "coyote-helm": { name: "Coyote warrior helm", slot: "helmet", rarity: "masterwork", weight: 2, price: 220, source: "tomb", minFloor: 4,
      description: "The open-jawed coyote head of a seasoned warrior, its fur still thick and grey." },
    xiuhuitzolli: { name: "Xiuhuitzolli turquoise diadem", slot: "helmet", rarity: "relic", weight: 1, price: 600, source: "tomb", minFloor: 7,
      description: "The pointed turquoise crown of a ruler, glittering with mosaic." },
    "quetzal-headdress": { name: "Quetzal-plume headdress", slot: "helmet", rarity: "exotic", weight: 2, price: 6000, source: "mahuiz", minFloor: 10,
      description: "A great fan of long green quetzal plumes on a gold band. Worth more than most houses." },

    // ----- Clothes -----
    "maguey-tilma": { name: "Maguey-fiber tilmatli", slot: "clothes", rarity: "common", weight: 2, price: 8, source: "market",
      description: "A plain cloak of maguey fiber knotted at the shoulder over a loincloth, as most townsfolk wear." },
    "painted-xicolli": { name: "Painted xicolli", slot: "clothes", rarity: "fine", weight: 2, price: 60, source: "market",
      description: "A fringed, sleeveless jacket painted with step-frets, the kind priests wear to ceremonies." },
    "ballplayer-gear": { name: "Ullamaliztli ballplayer gear", slot: "clothes", rarity: "fine", weight: 3, price: 120, source: "tomb", minFloor: 2,
      description: "A padded hip yoke and knee guard for the rubber-ball game. Very good for showing off." },
    "coyote-suit": { name: "Coyote warrior suit", slot: "clothes", rarity: "masterwork", weight: 4, price: 260, source: "tomb", minFloor: 4,
      description: "A full-body tlahuiztli of grey coyote fur, earned by taking captives." },
    "feathered-huipil": { name: "Feathered huipil", slot: "clothes", rarity: "masterwork", weight: 2, price: 300, source: "tomb", minFloor: 5,
      description: "A noblewoman's huipil with a yoke of feather mosaic and a wrap skirt with a woven border." },
    "turquoise-mantle": { name: "Turquoise-mosaic mantle", slot: "clothes", rarity: "relic", weight: 2, price: 700, source: "tomb", minFloor: 8,
      description: "A blue-green net mantle sewn with turquoise and jade, the xiuhtilmatli of a lord." },
    "bone-xicolli": { name: "Mictlan bone xicolli", slot: "clothes", rarity: "relic", weight: 2, price: 650, source: "tomb", minFloor: 9,
      description: "A black jacket painted with a white skeleton, worn by the priests of the lord of the dead." },

    // ----- Back banners and devices -----
    pamitl: { name: "Pamitl paper banners", slot: "back", rarity: "common", weight: 1, price: 15, source: "market",
      description: "A pair of striped paper flags worn on the back, so friends can find you in a crowd." },
    "jaguar-pennant": { name: "Jaguar pennant", slot: "back", rarity: "fine", weight: 2, price: 90, source: "tomb", minFloor: 3,
      description: "A tall pole flying a spotted jaguar-pelt banner." },
    "butterfly-device": { name: "Obsidian butterfly device", slot: "back", rarity: "masterwork", weight: 3, price: 280, source: "tomb", minFloor: 5,
      description: "A papalotl back device: wide butterfly wings of feathers and black glass." },
    "sun-standard": { name: "Gold sun-disc standard", slot: "back", rarity: "relic", weight: 3, price: 650, source: "tomb", minFloor: 6,
      description: "A gold disc with rays, raised on a frame above the shoulders like the rising sun." },
    "quetzal-fan": { name: "Quetzal-feather back fan", slot: "back", rarity: "exotic", weight: 3, price: 4500, source: "mahuiz", minFloor: 9,
      description: "A quetzalpatzactli: a towering fan of green plumes that sways as you walk." },
    "spanish-guidon": { name: "Spanish guidon", slot: "back", set: "spanish", rarity: "exotic", weight: 2, price: 2500, source: "mahuiz", minFloor: 3,
      description: "A swallow-tailed red banner with a gold cross, taken from a sea giant's ship." },
    nobori: { name: "Samurai nobori banner", slot: "back", set: "samurai", rarity: "exotic", weight: 2, price: 2500, source: "mahuiz", minFloor: 3,
      description: "A tall, narrow white banner with a red crest, carried by retainers across the western sea." }
  };
  for (const [id, entry] of Object.entries(wearables)) items.cosmetics[id] = { set: entry.set || id, ...entry };

  // Everyday clothes, headwear, and necklaces. Adventurers start in a loincloth; the outfit
  // chosen in character creation is a set of these items, worn from the start and taken off
  // or swapped like any other gear. Basic clothes are dyed in your clothing and trim colors.
  const basics = {
    garment: {
      slot: "clothes", field: "garment",
      prices: { "woven-tunic": 3, "cotton-wrap": 1, "feather-mantle": 20, "hide-vest": 4, huipil: 6, quechquemitl: 6, tilmatli: 3, xicolli: 5 },
      weight: 1.5, labels: GARMENT_LABELS,
      describe: (label) => `${label}, dyed in your clothing and trim colors.`
    },
    headwear: {
      slot: "helmet", field: "headwear",
      prices: { "feather-band": 4, "cotton-wrap": 1, "jade-circlet": 15 },
      weight: 0.3, labels: HEADWEAR_LABELS,
      describe: (label) => `${label}, worn for the road.`
    },
    adornment: {
      slot: "neck", field: "adornment",
      prices: { "jade-beads": 12, "shell-beads": 4, "feather-trim": 6 },
      weight: 0.2, labels: ADORNMENT_LABELS,
      describe: (label) => `${label} worn at the neck and shoulders.`
    }
  };
  for (const [kind, spec] of Object.entries(basics)) {
    for (const [style, price] of Object.entries(spec.prices)) {
      const id = `${kind}-${style}`;
      items.cosmetics[id] = {
        name: spec.labels[style], slot: spec.slot, basic: true, [spec.field]: style, set: id,
        rarity: "common", weight: spec.weight, price, source: "market", description: spec.describe(spec.labels[style])
      };
    }
  }
  // Dyed pieces with their own colors instead of yours.
  Object.assign(items.cosmetics, {
    "dusk-wrap": { name: "Dusk-dyed cotton wrap", slot: "clothes", basic: true, garment: "cotton-wrap", set: "dusk-wrap",
      dye: { tunic: "#2b2d3a", trim: "#5b4a6b" }, rarity: "common", weight: 1.5, price: 2, source: "market",
      skillBonuses: { "sleight-of-hand": 1 },
      description: "Cotton dyed the blue-black of the hour after sunset. Easy to miss in a dark hall: +1 Sleight of Hand while worn." },
    "cotton-finery": { name: "Dyed cotton finery", slot: "clothes", basic: true, garment: "xicolli", set: "cotton-finery",
      dye: { tunic: "#b5402c", trim: "#e1ad3b" }, rarity: "common", weight: 2, price: 15, source: "market",
      description: "A red xicolli with a gold-dyed fringe, for feast days and formal visits." }
  });
  items.basicWearFor = (kind, style) => (style && style !== "none" && items.cosmetics[`${kind}-${style}`] ? `${kind}-${style}` : null);

  // ----- Mesoamerican armor found in the tomb -----
  const armors = {
    ehuatl: { name: "Feathered ehuatl", art: "ehuatl", analog: "leather", tombOnly: true, minFloor: 3,
      description: "A short tunic of glued feathers worn over light cotton. Light and very bright.",
      base: 13, dex: true, dexCap: 3, weight: 10, price: 140 },
    tlahuiztli: { name: "Tlahuiztli war suit", art: "tlahuiztli", analog: "scale", tombOnly: true, minFloor: 5,
      description: "A quilted cotton suit covered in red feathers from collar to ankle, worn by veterans.",
      base: 15, dex: true, dexCap: 2, strength: 13, weight: 32, price: 360 },
    "jade-cuirass": { name: "Jade-plated cuirass", art: "jadecuirass", analog: "scale", tombOnly: true, minFloor: 8,
      description: "Plates of polished jade laced over thick cotton. Heavy, cold, and almost impossible to cut.",
      base: 16, dex: false, strength: 14, acBonus: 1, trait: "warded", weight: 42, price: 900 }
  };
  for (const [id, entry] of Object.entries(armors)) {
    const { weight, price, ...armor } = entry;
    items.armors[id] = armor;
    items.armorPrices[id] = [weight, price];
    items.addGearTiers("armor", id);
  }
  for (const characterClass of Object.values(CLASSES)) {
    for (const [id, entry] of Object.entries(armors)) {
      if (characterClass.armor.includes(entry.analog) && !characterClass.armor.includes(id)) characterClass.armor.push(id);
    }
  }

  // ----- More treasure -----
  const treasures = {
    "cacao-pouch": { name: "Pouch of cacao beans", price: 15, weight: 0.5, minFloor: 1,
      description: "Cacao beans are money in the market. This pouch would buy a turkey." },
    "spondylus-shell": { name: "Spondylus shell", price: 35, weight: 0.5, minFloor: 1,
      description: "A spiny red oyster shell from the far coast, prized for offerings." },
    "ulama-ball": { name: "Rubber ballgame ball", price: 30, weight: 3, minFloor: 1,
      description: "A heavy, bouncing ball of solid rubber from an abandoned ballcourt." },
    "copper-axe-money": { name: "Copper axe-money", price: 40, weight: 1, minFloor: 2,
      description: "Thin copper blades in the shape of axes, traded in bundles of twenty." },
    "gold-labret": { name: "Gold lip plug", price: 70, weight: 0.2, minFloor: 2,
      description: "A tiny cast-gold labret in the shape of an eagle's head." },
    "obsidian-eccentric": { name: "Obsidian eccentric", price: 80, weight: 0.5, minFloor: 3,
      description: "A flaked obsidian figure of a lord in profile, too delicate to be a tool." },
    "jade-frog": { name: "Carved jade frog", price: 95, weight: 0.5, minFloor: 4,
      description: "A fat little frog of green jade, its back carved with rain glyphs." },
    "quetzal-plumes": { name: "Bundle of quetzal plumes", price: 140, weight: 0.5, minFloor: 5,
      description: "Long, shimmering green tail feathers, more precious than gold." },
    "codex-fragment": { name: "Codex fragment", price: 120, weight: 0.3, minFloor: 5,
      description: "A folded strip of deerskin painted with day-signs and a procession of gods climbing up out of a cave." },
    "gold-pendant": { name: "Cast gold pendant", price: 200, weight: 0.5, minFloor: 7,
      description: "A lost-wax gold pendant of Xolotl, the dog-headed god who carried bones up out of Mictlan so people could be made again. Bells hang from his chin." },
    "turquoise-mask": { name: "Turquoise mosaic mask", price: 320, weight: 1.5, minFloor: 9,
      description: "A face of tiny turquoise tiles with shell eyes, set to look downward." }
  };
  for (const [id, entry] of Object.entries(treasures)) {
    items.gear[id] = { name: entry.name, weight: entry.weight, price: entry.price, category: "Treasure", sprite: id, description: entry.description };
  }

  const wearIds = Object.keys(items.cosmetics);
  window.CryptsWardrobe = {
    marketWear: wearIds.filter((id) => items.cosmetics[id].source === "market").map((id) => `wear:${id}`),
    mahuizWear: wearIds.filter((id) => items.cosmetics[id].source === "mahuiz").map((id) => `cosmetic:${id}`),
    tombWear: wearIds.filter((id) => items.cosmetics[id].source === "tomb").map((id) => ({ id: `wear:${id}`, minFloor: items.cosmetics[id].minFloor || 1 })),
    tombArmor: Object.entries(armors).map(([id, entry]) => ({ id: `armor:${id}`, minFloor: entry.minFloor })),
    tombTreasure: Object.entries(treasures).map(([id, entry]) => ({ id, minFloor: entry.minFloor }))
  };
})();
