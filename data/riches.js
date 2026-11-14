"use strict";

// Where the tomb's treasure comes from, and who moves it (systems/riches.js).
//
// The earth eats what is left in her: the dead, and what was buried with them, lost, or
// thrown away, all over the world and in every age. What comes up the road from the mouth
// with the life brings some of it back. So treasure rises out of the ground, most of all near
// the mouth (as much more as life is: systems/growth.js), and the tomb's own creatures move
// it: the mapachines take shiny things to their dens, the axolocatl keep jade and shell in
// their pools, the xolotl hounds carry things up the stairs toward the light, and the
// restless dead bring what they find to the shrines, as offerings. What nobody picks up, the
// earth takes back.
//
//   earthGiven   treasures from other places and other ages that only the earth gives back
//   kinds        what sort of thing each treasure is, for what creatures come to love
//   carriers     who moves treasure, how much at a time, and where it takes it
//   cherish      what each kind of creature with a mind can come to love (one thing each)

window.CryptsRiches = {
  earthGiven: {
    "teocuitlatl-nugget": { name: "Nugget of raw gold", sprite: "gold-ring", price: 60, weight: 0.2, minFloor: 3,
      description: "A lump of raw gold the size of a bean, still dirty from the ground it came up through. In Nahuatl, gold is teocuitlatl, the gods' excrement." },
    "fluted-point": { name: "Fluted stone point", sprite: "tool", price: 40, weight: 0.2, minFloor: 2,
      description: "A spear point of pale chert with a long channel flaked down each face. Nobody in this country knaps stone this way, and nobody remembers anyone who did." },
    "foreign-silver-coin": { name: "Silver coin from across the sea", sprite: "coin-pile", price: 25, weight: 0.05, minFloor: 1,
      description: "A thin silver coin stamped with a crowned shield and foreign letters. The sea giants carry coins like this. This one is worn smooth and stained from the ground." },
    "giant-tooth": { name: "Quinametzin tooth", sprite: "keepsake", price: 90, weight: 2, minFloor: 5,
      description: "A grinding tooth as big as a fist, turned to stone. When the old people dug up bones this size, they said they were the giants of an earlier sun." },
    "star-iron": { name: "Star iron", sprite: "treasure", price: 70, weight: 3, minFloor: 6,
      description: "A heavy lump of black iron, pitted and rusted. It fell out of the sky long ago, the old people said, and the earth swallowed it. The sea giants' smiths would want it." },
    "olmec-celt": { name: "Blue-green jade celt", sprite: "jade-bead", price: 220, weight: 1, minFloor: 7,
      description: "A polished axe blade of blue-green jade, too fine ever to have been used. The rubber people of the Gulf coast buried celts like this in rows, long before the Mexica." },
    "teotihuacan-mask": { name: "Green stone face", sprite: "treasure", price: 300, weight: 1.5, minFloor: 9,
      description: "A mask of green stone with shell set in the eyes, carved in the manner of the city where the gods were made. That city was already a ruin when the Mexica first saw it." }
  },

  kinds: {
    gold: ["teocuitlatl-nugget", "foreign-silver-coin", "gold-labret", "gold-pendant", "copper-axe-money", "copper-bells", "copper-tweezers"],
    jade: ["jade-bead", "jade-frog", "jade-pectoral", "jadeite-mask", "olmec-celt", "turquoise-mask", "teotihuacan-mask", "amber-drop"],
    mirror: ["obsidian-mirror", "pyrite-mirror", "obsidian-eccentric", "obsidian-earspools", "crystal-skull"],
    shell: ["spondylus-shell", "tecciztli", "shell-bracelets"],
    clay: ["clay-dog", "clay-ballplayer", "clay-pole", "clay-house", "terracotta-figurine", "tecali-vase", "lords-cup-sherd"],
    feather: ["quetzal-plumes", "feather-shield", "jaguar-pelt"],
    child: ["empty-cradleboard", "clay-dog", "ulama-ball", "copper-bells", "terracotta-figurine"],
    writing: ["codex-fragment", "day-sign-chip", "tally-cord", "scraped-cartouche", "seal-fragment"],
    bone: ["giant-tooth", "crystal-skull", "fluted-point"],
    stone: ["ulama-ball", "clay-house", "tecali-vase", "star-iron", "giant-tooth"],
    food: ["cacao-pouch", "dark-maize", "salt-cakes"]
  },

  // takes    which kinds it picks up ("any" for anything)
  // keeps    where it takes them: its den, its pool, a shrine, or up the stairs
  // holds    how many things its hoard holds before it carries the extra up a floor
  carriers: {
    mapachin: { takes: ["gold", "jade", "shell", "mirror"], keeps: "den", holds: 3 },
    hueymapachin: { takes: ["gold", "jade", "shell", "mirror", "clay"], keeps: "den", holds: 4 },
    "elder-mapachin": { takes: ["gold", "jade", "shell", "mirror", "clay", "feather"], keeps: "den", holds: 5 },
    tlacuatzin: { takes: ["shell", "bone"], keeps: "den", holds: 2 },
    axolocatl: { takes: ["jade", "shell"], keeps: "pool", holds: 4 },
    "xolo-hound": { takes: "any", keeps: "up", holds: 1 },
    mictlaneca: { takes: "any", keeps: "shrine", holds: 1 },
    cihuateotl: { takes: "any", keeps: "shrine", holds: 1 },
    yohualtepoztli: { takes: "any", keeps: "shrine", holds: 1 },
    itzpapalotl: { takes: "any", keeps: "shrine", holds: 1 },
    tlacanexquimilli: { takes: "any", keeps: "shrine", holds: 1 },
    duende: { takes: ["gold", "child", "food"], keeps: "den", holds: 3 }
  },

  cherish: {
    duende: ["gold", "child", "food"],
    chaneque: ["shell", "child", "food"],
    alux: ["clay", "food"],
    tlacatecolotl: ["mirror", "writing"],
    cihuateotl: ["child"],
    mictlaneca: ["feather", "gold"],
    yohualtepoztli: ["mirror", "bone"],
    itzpapalotl: ["mirror", "feather"],
    caxtiltecatl: ["gold"],
    quinametli: ["stone", "bone"],
    axolocatl: ["jade", "shell"],
    "huay-chivo": ["bone", "child"],
    tlacanexquimilli: ["bone", "writing"]
  }
};

// The earth's own finds are treasures like any other (and the loot tables can roll them).
(() => {
  const riches = window.CryptsRiches;
  const items = window.CryptsItems;
  for (const [id, entry] of Object.entries(riches.earthGiven)) {
    items.gear[id] = { name: entry.name, weight: entry.weight, price: entry.price, category: "Treasure", sprite: entry.sprite, description: entry.description };
  }
})();
