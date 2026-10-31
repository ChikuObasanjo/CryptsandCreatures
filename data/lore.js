"use strict";

// The story of the tomb, told the way old places tell it: in what's carved on the walls,
// what's left in the rooms, what things are for, and what people in town half-remember.
// Nothing here says it outright. For writers, the truth underneath:
//
//   The dead go down to Mictlan by the long road. New life comes back up by another: a
//   mouth in the earth beneath Chiltomatlan, where the ceiba's roots drink. Maize, rain,
//   animals, and children have always climbed out of it into the sun.
//
//   In the last age, an empire ruled the whole world: the Lords of All the World. When
//   their sun began to age, as every sun does, they would not let it end. They built
//   fortresses on top of the mouth, floor over floor, every defense facing down, and
//   caught what climbed out: they drank it, ate it, wore it, and did not die. They bound a
//   star-demon, a tzitzimitl, across the mouth itself, because the tzitzimime are what
//   end a sun, and a bound one cannot. Their age went on and on, and the world above
//   grew old and thin: fewer births, poorer maize, a tired sun.
//
//   The peoples who came after scraped the last lord's name from every wall so he could
//   never be called back up, and sealed what they couldn't destroy. The Empire of today
//   found it again a century ago, lost an expedition in it, and sealed it a second time.
//   Since the seal broke, the midwives in Chiltomatlan have been busy.
//
// Floors 1–2 are the Empire's failed expedition; 3–8 the Lords' fortresses; 9–12 the
// living rock of the passage under them; 13 the mouth.

(() => {
  // What you see on arriving at each floor: the first room's description.
  const floors = {
    2: "Eagle-warrior spears lie where the Empire's expedition dropped them a century ago, every point aimed back up the stair. Whatever they met here, they were running from it.",
    3: "The masonry changes here. These walls are older than any empire you have heard of, fitted without mortar, and every arrow slit in them faces down.",
    4: "A frieze runs the length of the hall: lords in tall crowns stand around a great open mouth, catching the small figures that climb out of it in their nets.",
    5: "The air is warm, and so is the stone. Pale roots grow up through the floor toward the stair.",
    6: "Here the fortress lords slept and feasted. Their benches face a carved basin worn smooth by mouths. Whatever they drank from it came up from below.",
    7: "Every lintel on this floor is carved with the same day-sign, repeated over and over.",
    8: "Cradleboards, hundreds of them, stacked to the ceiling in the dark. Every one is empty. The dust on them is very old.",
    9: "The fortress walls end here. Beyond them is living rock, damp and veined like the inside of a shell. The lords did not build this; they built on top of it.",
    10: "Water runs uphill along a groove in the floor, toward the stairs and the surface far above.",
    11: "Names have been scraped from every wall, carefully, by many hands over many years. In one corner a single glyph survived. It means Lord of All the World.",
    12: "The last fortress is a single room around a single sleeper's stone. The lid has been pushed aside from within. The tracks in the dust lead down, not up.",
    13: "You stand above the mouth itself. Light comes up from below, the color of dawn, though no sun has ever shone down here. A dark shape lies across the opening like a stone across a well."
  };

  // The broken seal at the entrance.
  const entrance = "The old imperial seal lies broken at this threshold. Its glyphs do not say keep out; read the right way up, they say stay below. The surface entrance is the one safe route back to Chiltomatlan.";

  // More rooms, each kept to the depths where it belongs.
  const rooms = [
    { id: "expedition-camp", type: "quiet", minFloor: 1, maxFloor: 3, name: "The Expedition's Last Camp",
      text: "Cold firepits and a heap of broken eagle-warrior shields. Someone scratched a tally of days into the wall and stopped at nineteen. The shields were all dropped facing the stairs down." },
    { id: "net-frieze", type: "quiet", minFloor: 3, maxFloor: 6, name: "The Hall of Nets",
      text: "Painted lords lower nets into a pit of light. In the nets are tiny figures: deer, ears of maize, a jaguar kit, a swaddled child. The lords are smiling." },
    { id: "downward-ramparts", type: "quiet", minFloor: 3, maxFloor: 7, name: "The Downward Ramparts",
      text: "A defended stair, every parapet and murder-hole facing down the steps. Whoever built this feared nothing from the surface." },
    { id: "feast-hall", type: "quiet", minFloor: 5, maxFloor: 8, name: "The Hall of Long Feasts",
      text: "Long benches, cups of carved jade, and a basin at the center worn smooth by lips. The basin is dry now. It still smells faintly of rain." },
    { id: "unending-count", type: "quiet", minFloor: 6, maxFloor: 9, name: "The Unending Count",
      text: "Four Movement, Four Movement, Four Movement: the day on which a sun is fated to end, carved around every doorway. The builders seem to have hoped that writing it often enough would wear it away." },
    { id: "borrowed-light", type: "quiet", minFloor: 8, maxFloor: 12, name: "The Hall of Borrowed Light",
      text: "Polished obsidian mirrors line the walls, angled up the shaft to catch what little sun once reached this deep. Every one of them is cracked from behind." },
    { id: "breathing-gallery", type: "quiet", minFloor: 9, maxFloor: 12, name: "The Breathing Gallery",
      text: "These walls are living rock, warm to the touch. Very slowly, they rise and fall." },
    { id: "rising-channel", type: "quiet", minFloor: 9, maxFloor: 12, name: "The Rising Channel",
      text: "A carved channel carries water uphill past your feet. Frogs no bigger than a fingernail ride it toward the surface." },
    { id: "scraped-names", type: "quiet", minFloor: 10, maxFloor: 12, name: "The Hall of Scraped Names",
      text: "Cartouches line the walls, each one scraped smooth and then polished flat by people who wanted these names never spoken again." },
    { id: "catching-pit", type: "trap", minFloor: 3, maxFloor: 8, name: "The Catching Pit",
      text: "The floor is a stone lattice over a long drop, built to catch things climbing up from below." },
    { id: "seed-vault", type: "trap", minFloor: 6, maxFloor: 12, name: "The Seed Vault",
      text: "Clay jars of seed fill the walls, every one sprouted, pale roots splitting the clay. Watch your footing; the floor is no longer level." },
    { id: "downward-watch", type: "combat", minFloor: 2, maxFloor: 8, name: "The Downward Watch",
      text: "Old sentries still stand at their posts, spears leveled at the stair below. Some of them turn, slowly, to look up at you." },
    { id: "warm-den", type: "combat", minFloor: 7, maxFloor: 12, name: "The Warm Den",
      text: "A nest of soft roots and old feathers. The young in it are newly born; the creatures guarding them are very old." },
    { id: "tribute-store", type: "treasure", minFloor: 4, maxFloor: 10, name: "The Tribute of Every Land",
      text: "Tribute from every corner of the world, heaped and forgotten: shells from both seas, feathers, gold, and stone from places no map in Chiltomatlan names." },
    { id: "lords-antechamber", type: "boss", minFloor: 8, maxFloor: 12, name: "The Lord's Antechamber",
      text: "A great guardian stands before a sealed door carved with a man whose face has been chiseled away. You can hear slow breathing on the other side." }
  ];

  // Things found in the tomb that are worth more as stories than as gold.
  const relics = {
    "seal-fragment": { name: "Fragment of the imperial seal", price: 12, weight: 0.5, minFloor: 1,
      description: "A broken piece of the Empire's seal. You always read it as a warning to the living. Turned the right way up, it says: stay below." },
    "tally-cord": { name: "Expedition tally cord", price: 20, weight: 0.1, minFloor: 2,
      description: "A knotted cord from the Empire's expedition, counting days. The knots stop after nineteen. The last few were tied in a hurry." },
    "net-sinker": { name: "Stone net-sinker", price: 30, weight: 1, minFloor: 3,
      description: "A carved stone weight from a great net. The fishermen on the lake use small ones. This net was cast downward, into the dark, and hauled up full." },
    "lords-cup-sherd": { name: "Sherd of a lord's cup", price: 55, weight: 0.3, minFloor: 4,
      description: "A piece of a fine painted cup: a lord drinking from a basin, and around him the glyph for sun, written over and over, smaller each time." },
    "day-sign-chip": { name: "Chip of the unending count", price: 70, weight: 0.5, minFloor: 6,
      description: "A chip of lintel carved with the same day-sign again and again: Four Movement, the day a sun is fated to end, carved until it would never come." },
    "empty-cradleboard": { name: "Empty cradleboard", price: 45, weight: 2, minFloor: 7,
      description: "A small woven cradleboard, very old, never used. There were hundreds like it on the floors above. Nobody in town will say what they were for." },
    "dark-maize": { name: "Maize that grew in the dark", price: 90, weight: 0.1, minFloor: 9,
      description: "A kernel from the deepest jars, sprouted, pale as bone, and still alive. Itzcoatl would give anything to plant it." },
    "scraped-cartouche": { name: "Stone with a scraped name", price: 150, weight: 2, minFloor: 11,
      description: "A cartouche where a name used to be, scraped so patiently that the stone is polished. Whoever did this wanted the name forgotten, so it could never be called back up." },
    "rising-water": { name: "Gourd of rising water", price: 200, weight: 1, minFloor: 12,
      description: "Water from the channel that runs uphill. It is warm and tastes of rain. Nali says not to drink it, the way people say that about something they've tried." }
  };

  // What the townsfolk let slip, a little more the deeper you've been. One remark a visit.
  const townsfolk = {
    innkeeper: [
      { id: "nali-well", minFloor: 1, text: "The well's warmer than water has any right to be. My grandmother said the ceiba drinks from somewhere deeper than the lake." },
      { id: "nali-midwives", minFloor: 3, text: "Since the seal broke, the midwives haven't slept. Three sets of twins this rain. Make of that what you like." },
      { id: "nali-water", minFloor: 8, text: "If you find water down there running the wrong way, don't drink it. I'm only telling you what I was told." }
    ],
    merchant: [
      { id: "teyac-fortresses", minFloor: 1, text: "The old traders say there were fortresses like that over every spring and cave mouth in the world, once. All fallen. All but ours." },
      { id: "teyac-tribute", minFloor: 4, text: "Tribute from both seas, rotting in a hole in the jungle. Somebody owned the whole world once. Nobody owns it now. Good for business." }
    ],
    "gear-mender": [
      { id: "mahuiz-spring", minFloor: 1, text: "The sea giants? They came asking after a spring that makes old men young. I pointed them at your tomb. I'm not proud of it." },
      { id: "mahuiz-north", minFloor: 5, text: "The pale men from the north asked the same question, long before the sea giants. Everyone asks. The road down always answers." }
    ],
    "temple-keeper": [
      { id: "xochi-seal", minFloor: 1, text: "The Empire didn't seal that road to keep treasure in. They sealed it because of what the old lords were keeping down." },
      { id: "xochi-oath", minFloor: 4, text: "The wardens' first oath isn't 'guard the road.' It's 'let it breathe.' Nobody remembers why. I'm starting to." },
      { id: "xochi-lords", minFloor: 9, text: "The old lords didn't die. That was the point of all of it: a whole age kept alive in the dark, eating tomorrow to have more of today." }
    ],
    "patolli-player": [
      { id: "ixchel-board", minFloor: 1, text: "The board is a road with a mouth at each end. The old ones said one end is where you go, and the other is where you come back from. Roll." },
      { id: "ixchel-bundle", minFloor: 6, text: "Fifty-two years in a bundle, then the count starts over. Unless someone keeps it from starting. Your move." }
    ],
    "master-builder": [
      { id: "tlacotl-lid", minFloor: 1, text: "Look at the stairwell masonry: everything's laid to bear weight from below. Like a lid on a pot that wants to boil." },
      { id: "tlacotl-layers", minFloor: 5, text: "The floors are built in layers, each one younger than the one beneath, every one pressing down. Whoever built them kept adding weight." }
    ]
  };

  // Lore-touching questions for the villagers, opened as they warm to you.
  const villagerQuestions = {
    itzcoatl: [
      { id: "tomb-story", min: 35, q: "Do you know any stories about the tomb?",
        a: "Ballcourt stories, sure. Two brothers played ball against the lords of the dark, lost on purpose, died, and came back up as the sun and the moon. Every ballplayer knows it: you go down so you can come back up. My father used to say the tomb is the court where that game's still being played." }
    ],
    citlali: [
      { id: "lords-wanted", min: 35, q: "What do you think the old lords wanted?",
        a: "Time. The count says every sun ends; four already have. I think the lords of the last one refused. They built on the place new things come from and held it shut, so nothing new could come, and their age could never be replaced." },
      { id: "mouth-opens", min: 55, q: "What happens if the tomb is opened all the way?",
        a: "Then the count moves again. A new sun, maybe. Or only more children, more maize, more rain. My teacher used to say those are the same thing, said differently." }
    ],
    atzin: [
      { id: "clay", min: 35, q: "Where does your clay come from?",
        a: "The bank right by the gate. It's warm, even at night. Pots from it never crack in the kiln, and seeds sprout in the shards. I don't tell people that part. They'd dig up the whole road." }
    ],
    cuauhtli: [
      { id: "what-comes-out", min: 35, q: "Does anything come out of the tomb?",
        a: "Every dawn. Not monsters. Little things: frogs, fawns, birds I've never seen, all walking up the road into the light like they've somewhere to be. I clear the road for them too. Don't tell Xochi I said 'too.'" }
    ]
  };

  window.CryptsLore = { floors, entrance, rooms, relics, townsfolk, villagerQuestions };

  // ---------- Register ----------
  const pack = window.CryptsContent?.starterPack;
  if (pack) pack.rooms.push(...rooms);
  const items = window.CryptsItems;
  for (const [id, entry] of Object.entries(relics)) {
    items.gear[id] = { name: entry.name, weight: entry.weight, price: entry.price, category: "Treasure", sprite: "treasure", description: entry.description };
  }
  window.CryptsWardrobe?.tombTreasure.push(...Object.entries(relics).map(([id, entry]) => ({ id, minFloor: entry.minFloor })));
  const village = window.CryptsVillagers;
  if (village) {
    for (const [id, list] of Object.entries(villagerQuestions)) {
      const villager = village.villagers[id];
      if (!villager) continue;
      villager.questions ||= [];
      // Keep the questions ordered by how close you need to be.
      villager.questions.push(...list);
      villager.questions.sort((a, b) => a.min - b.min);
    }
  }
})();
