"use strict";

window.CryptsContent = {
  factions: {
    "ceiba-house": {
      name: "House of the Ceiba",
      emblem: "⌂",
      patron: "Nali, keeper of the travelers' house",
      description: "A hearth-circle of hosts, guides, and jungle-road travelers.",
      ranks: [[0, "House initiate"], [15, "Known face"], [35, "Trusted hand"], [65, "House elder"]],
      perk: "Members may claim one meal and one gourd of water with a town rest each day."
    },
    "traders-circle": {
      name: "Pochteca",
      emblem: "◈",
      patron: "Teyac, market trader",
      description: "Market families who keep the cacao road and its exchanges moving.",
      ranks: [[0, "Circle associate"], [15, "Reliable buyer"], [35, "Favored trader"], [65, "Circle factor"]],
      perk: "Standing brings lower market prices and better offers for recovered valuables."
    },
    "road-wardens": {
      name: "Wardens of the Old Road",
      emblem: "✥",
      patron: "Xochi, keeper of the sealed road",
      description: "Local guides who watch the forbidden tomb road and preserve what is known of the Empire's failed expedition.",
      ranks: [[0, "Road initiate"], [15, "Trail hand"], [35, "Pathfinder"], [65, "Road keeper"]],
      perk: "Trusted wardens share fieldcraft and perception while exploring."
    }
  },
  factionMilestones: ["temple-treasure-returned", "greenstone-echo-silenced"],
  townIntroductions: [
    "The innkeeper sets a cup of cacao by the fire and asks what name to write beside your place.",
    "An old bone die rolls across the table. Your first strengths are ready; trade any two if the road calls for it.",
    "The keeper lays out a weapon and a Travel Bundle. The deeper halls will test both.",
    "In the lamplight, choose the colors and details that make this adventurer yours."
  ],
  tombHistory: "Nearly a century ago, a tomb was uncovered outside Chiltomatlan. Its walls name no king, kingdom, or homeland. The Empire sent eagle warriors and temple priests to investigate, but they could not pass the inner halls. They sealed the entrance and declared the tomb forbidden. Since then, talk of its treasure has drawn adventurers to Chiltomatlan. The old seal has cracked enough to let you into the outer chambers. The oldest songs in Chiltomatlan say the town was built here on purpose, beside a place where new life comes up from below.",
  starterPack: {
    schemaVersion: 1,
    id: "tomb-beneath-the-ceiba",
    title: "The Tomb Beneath Chiltomatlan",
    description: "A century ago, the Empire sealed this nameless king's tomb and declared it forbidden. Explore its reopened halls, manage your supplies, claim what you can, and return to Chiltomatlan. A steady pulse sounds from beyond the inner seal.",
    enemies: window.CryptsEnemies.starter,
    rooms: [
      { id: "entry", type: "entrance", name: "The Rootbound Stair", text: "The Empire's weathered seal lies broken at the threshold. No record names the king buried here. You descend into the outer halls that the imperial expedition could not pass a century ago.", dc: 10 },
      { id: "painted-gallery", type: "quiet", name: "The Unclaimed Gallery", text: "Painted processions show a ruler whose face has been carefully erased. The colors and symbols match no history kept in Chiltomatlan." },
      { id: "sunken-snare", type: "trap", name: "Hall of Hollow Drums", text: "Stone drums line the passage, and one gives a low note when you step near it. The floor-stones here are uneven; watch your footing.", dc: 12, damage: "1d6" },
      { id: "jade-offering", type: "treasure", name: "The Terracotta Figurine Niche", text: "A small terracotta bird sits among old offerings of cacao beans and river shells, its beak pointed toward the inner seal.", reward: { gold: 9, potions: 1, xp: 10, items: [{ id: "jade-bead", quantity: 2 }, { id: "terracotta-figurine", quantity: 1 }] } },
      { id: "mask-sentinel", type: "combat", name: "The Night-Axe Gate", text: "Two moss-covered masks flank an inner gate. A Yohualtepoztli guards it.", enemyId: "yohualtepoztli" },
      { id: "cenote-hunter", type: "combat", name: "The Drowned Archive", text: "Water covers the floor of a flooded archive. Bark-paper pages float on the surface, and fish dart beneath them.", enemyId: "cenote-stalker" },
      { id: "obsidian-sanctum", type: "boss", name: "The Deep Pulse", text: "A low, steady pulse comes from beyond the inner seal. Camazotz stands between you and its source. Defeating it is optional; the treasure and the way back matter more to your expedition.", enemyId: "camazotz" },
      { id: "jungle-daylight", type: "exit", name: "The Broken Seal", text: "The stair climbs toward Chiltomatlan and the jungle beyond. Carry what you have found back to safety." }
    ]
  }
};
