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
    2: "The eagle warriors' spears lie where the Empire's expedition left them a hundred years ago. Every point looks back up the stair, the way they came. Whatever they met here, they were running from it.",
    3: "The stonework changes here. These walls are older than any empire you know of. The stones were fitted without mortar, and every arrow slit looks down.",
    4: "A painted frieze runs the length of the hall. Lords in tall crowns stand in a ring around a great open mouth, catching the small figures that climb out of it in their nets.",
    5: "The air is warm and the stone is warm. Pale roots break up through the floor and climb toward the stair.",
    6: "The fortress lords slept and feasted here. Their benches face a carved basin rubbed smooth by mouths. What they drank from it came up from below.",
    7: "Every lintel on this floor is carved with one day-sign, again and again.",
    8: "Cradleboards by the hundred, stacked to the ceiling in the dark. All of them are empty. The dust on them is very old.",
    9: "The fortress walls stop here. Past them is living rock, wet and veined like the inside of a conch shell. The lords didn't build this. They built on top of it.",
    10: "Water runs uphill in a channel cut into the floor, toward the stairs and the world far above.",
    11: "The names have been scraped off every wall, slowly and carefully, by many hands over many years. One glyph was missed, in a corner. It reads Lord of All the World.",
    12: "The last fortress is one room around one sleeper's stone. The lid was pushed aside from inside. The footprints in the dust go down, not up.",
    13: "You stand over the mouth. Light like dawn rises from below, though no sun has ever shone here. A dark shape lies across the opening like a stone laid over a spring."
  };

  // The broken seal at the entrance.
  const entrance = "The old Empire's seal lies broken across this doorway. Its writing doesn't say \"do not enter.\" Read the right way up, it says \"stay below.\" This is the only safe road back to Chiltomatlan.";

  // More rooms, each kept to the depths where it belongs.
  const rooms = [
    { id: "expedition-camp", type: "quiet", minFloor: 1, maxFloor: 3, name: "The Expedition's Last Camp",
      text: "Dead firepits, and broken eagle-warrior shields thrown in a heap. Someone scratched a count of days into the wall and stopped at nineteen. Every shield was dropped facing the stair down." },
    { id: "net-frieze", type: "quiet", minFloor: 3, maxFloor: 6, name: "The Hall of Nets",
      text: "Painted lords let their nets down into a pit of light. Small things are caught in them: a deer, ears of maize, a jaguar cub, a child in its wrappings. The lords are smiling." },
    { id: "downward-ramparts", type: "quiet", minFloor: 3, maxFloor: 7, name: "The Downward Ramparts",
      text: "A stair built to be held. Every parapet and every loophole faces down the steps. Whoever built it was not afraid of anything coming from above." },
    { id: "feast-hall", type: "quiet", minFloor: 5, maxFloor: 8, name: "The Hall of Long Feasts",
      text: "Long benches, carved jade cups, and in the middle a basin rubbed smooth by lips. It is dry now. It still smells a little of rain." },
    { id: "unending-count", type: "quiet", minFloor: 6, maxFloor: 9, name: "The Unending Count",
      text: "Four Movement, Four Movement, Four Movement, around every doorway. It is the day a sun is fated to end. The builders seem to have hoped that if they wrote it enough times, it would wear out." },
    { id: "borrowed-light", type: "quiet", minFloor: 8, maxFloor: 12, name: "The Hall of Borrowed Light",
      text: "Polished obsidian mirrors cover the walls, tilted up the shaft to catch what little sun once came this far down. Each one is cracked from behind." },
    { id: "breathing-gallery", type: "quiet", minFloor: 9, maxFloor: 12, name: "The Breathing Gallery",
      text: "The walls are living rock, warm under your hand. Slowly, slowly, they rise and fall." },
    { id: "rising-channel", type: "quiet", minFloor: 9, maxFloor: 12, name: "The Rising Channel",
      text: "A carved channel carries water uphill past your feet. Frogs the size of a fingernail ride it up toward the world above." },
    { id: "scraped-names", type: "quiet", minFloor: 10, maxFloor: 12, name: "The Hall of Scraped Names",
      text: "The walls are lined with name-cartouches. Each was scraped off, then polished flat, by people who never wanted these names said again." },
    { id: "catching-pit", type: "trap", minFloor: 3, maxFloor: 8, name: "The Catching Pit",
      text: "The floor is a stone grate over a long drop, made to catch whatever climbs up from below." },
    { id: "seed-vault", type: "trap", minFloor: 6, maxFloor: 12, name: "The Seed Vault",
      text: "Clay jars of seed fill the walls. Every seed has sprouted, and pale roots have split the jars. The floor has buckled; watch your footing." },
    { id: "downward-watch", type: "combat", minFloor: 2, maxFloor: 8, name: "The Downward Watch",
      text: "Old sentries still keep their posts, spears pointed at the stair below. A few of them turn, slowly, and look up at you." },
    { id: "warm-den", type: "combat", minFloor: 7, maxFloor: 12, name: "The Warm Den",
      text: "A nest of soft roots and old feathers. The young in it were just born. The ones guarding them are very old." },
    { id: "tribute-store", type: "treasure", minFloor: 4, maxFloor: 10, name: "The Tribute of Every Land",
      text: "Tribute from the four quarters of the world lies in heaps, forgotten: shells from both seas, feathers, gold, and stone from places no map in Chiltomatlan names." },
    { id: "lords-antechamber", type: "boss", minFloor: 8, maxFloor: 12, name: "The Lord's Antechamber",
      text: "A great guardian stands before a sealed door. A man is carved on the door, and his face has been chiseled off. On the other side, something breathes, slowly." }
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
