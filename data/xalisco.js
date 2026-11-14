"use strict";

// The country the tomb is in.
//
// The game's world is a retelling of Xalisco in the 1530s, and the west has its own past.
// Long before the Mexica, the peoples of these valleys built their towns around ROUND
// courts (a round stepped altar, a ring of paving, platforms around that: the Teuchitlán
// tradition's guachimontones) and buried their dead with clay dogs, clay houses full of
// clay people, and dishes of food, in chambers at the foot of a SHAFT cut down through the
// rock (the shaft tombs of Jalisco, Nayarit, and Colima). In this world those are the
// people of this country who served the Lords of All the World, so the fortress floors
// were built by their hands and in their way, and their graves and grave goods are in it.
//
// This file adds what belongs to that country, and registers it the way data/lore.js and
// data/goods.js do. Nothing here needs behavior code:
//
//   rooms      names and descriptions for the chamber forms in systems/forms.js. A room
//              with `forms` is only used in a chamber of one of those forms.
//   treasures  grave goods of the west, found in the tomb's stores and caches
//   creatures  three that the tomb did not have: a pack hunter for the upper floors, a
//              scavenger that plays dead, and one more of the night's omens. Each has a
//              card (enemies), a place in the food web (species), and chambers it lives in.
//
// Each creature has its own painting at resources/enemies/<sprite>.png. (A sprite can borrow
// another's painting with a filter through spriteAliases, but none do now.)
//
// Sources for what is told as history are in README.md (The country the tomb is in).

(() => {
  // ---------- Rooms, by the form of the chamber ----------
  const rooms = [
    // The Lords' fortresses, built the way the west built.
    { id: "ring-court", type: "quiet", forms: ["ring"], minFloor: 3, maxFloor: 8, name: "The Ring Court",
      text: "A round court with a round altar in the middle, stepped like a small hill. The old peoples of this country built their towns around courts like this one. The paving is worn in a ring where people walked around it." },
    { id: "pole-court", type: "quiet", forms: ["ring"], minFloor: 3, maxFloor: 8, name: "The Pole Court",
      text: "A round court around a round altar. In the top of the altar is a socket as wide as a man's body, where a tall pole once stood. The rope marks are still on the rim." },
    { id: "shaft-tomb", type: "treasure", forms: ["shaft"], minFloor: 3, maxFloor: 8, name: "The Shaft Tomb",
      text: "The foot of a narrow shaft cut straight down through the rock, with a chamber opening to either side. The people of this country who served the lords were buried in their own way: laid out here with red clay dogs, dishes of food, and shell bracelets." },
    { id: "sealed-shaft", type: "trap", forms: ["shaft"], minFloor: 3, maxFloor: 8, name: "The Sealed Shaft", dc: 13, damage: "1d8",
      text: "A shaft tomb with a stone slab wedged in the neck of each chamber. One slab has been levered half out and left that way. The lintel over it is cracked through." },
    { id: "ballcourt", type: "quiet", forms: ["ballcourt"], minFloor: 3, maxFloor: 8, name: "The Ballcourt",
      text: "A long alley between two sloping benches, with a wider yard at each end. A line is cut across the middle of the alley. The plaster on the benches is scuffed where the ball struck it." },
    { id: "sweat-bath", type: "quiet", forms: ["temazcal"], minFloor: 3, maxFloor: 8, name: "The Sweat Bath",
      text: "A low round room with a firebox built into the wall. The fire went out an age ago. The stones in the box are still hot, and the walls are wet." },
    { id: "pens", type: "quiet", forms: ["pens"], minFloor: 3, maxFloor: 8, name: "The Pens",
      text: "Stalls on both sides of an aisle, each with a stone trough and a ring set in the wall. What the nets brought up was kept here until it was wanted. The troughs are small." },
    { id: "pens-taken", type: "combat", forms: ["pens"], minFloor: 3, maxFloor: 8, name: "The Taken Pens",
      text: "The stalls were built to hold what the nets brought up. Something has moved into them on its own account, and it has young." },
    { id: "sunless-beds", type: "quiet", forms: ["chinampa"], minFloor: 3, maxFloor: 8, name: "The Sunless Beds",
      text: "Raised beds of black earth between channels of still water, laid out the way the lake people lay out their gardens. The lords planted them and nothing grew. Now everything does." },
    // Anywhere there was no builder.
    { id: "the-sink", type: "quiet", forms: ["bowl"], minFloor: 1, maxFloor: 13, name: "The Sink",
      text: "The floor slopes down from every side to standing water. Whatever drips on this floor ends up here, and whatever drinks comes here to do it. The mud at the edge is full of tracks." },
    { id: "root-columns", type: "quiet", forms: ["spires"], minFloor: 1, maxFloor: 2, name: "The Root Columns",
      text: "Roots as thick as house posts come down through the roof and go on into the floor. Hummingbirds hang from the thin ones by their beaks, cold and still. The Mexica say the hummingbird dies like this in the dry season and wakes when the rain comes." },
    { id: "stone-forest", type: "quiet", forms: ["spires"], minFloor: 9, maxFloor: 13, name: "The Stone Forest",
      text: "Columns of wet stone stand from floor to roof, some no thicker than a wrist. They are warm. In the thick ones you can feel a slow beat." },
    // The living rock.
    { id: "shell-chambers", type: "quiet", forms: ["lobed"], minFloor: 9, maxFloor: 13, name: "The Shell Chambers",
      text: "Hollows that open into one another through round gaps, each a little larger than the last. The walls are ribbed and pink, like the inside of a conch." },
    { id: "the-throat", type: "quiet", forms: ["gullet"], minFloor: 9, maxFloor: 13, name: "The Throat",
      text: "A passage that narrows, widens, and narrows again. The walls are slick, and the ridges in them all lean one way: up." },
    { id: "the-swallow", type: "trap", forms: ["gullet"], minFloor: 9, maxFloor: 13, name: "The Swallow", dc: 14, damage: "1d8",
      text: "The passage tightens here until the walls nearly meet. They give a little under your hand, and then they push back." },
    { id: "the-knot", type: "quiet", forms: ["heart"], minFloor: 9, maxFloor: 13, name: "The Knot",
      text: "Two hollows side by side around a knot of dark rock too hot to touch. Air moves in and out of the room on its own, a little faster than you breathe." },
    { id: "blind-hollow", type: "quiet", forms: ["pocket"], minFloor: 1, maxFloor: 13, name: "A Blind Hollow",
      text: "A small hollow with one way in. It is dry and out of the draft, and it smells of whatever slept here last." },
    { id: "lair", type: "combat", forms: ["pocket"], minFloor: 2, maxFloor: 13, name: "A Lair",
      text: "A small hollow with one way in. The floor is trampled flat, and there is fur caught on the rock at the entrance." },
    { id: "rock-cache", type: "treasure", forms: ["pocket"], minFloor: 1, maxFloor: 13, name: "A Cache in the Rock",
      text: "A blind hollow. Someone wedged a bundle into the back of it and did not come back." }
  ];

  // ---------- Grave goods of the west ----------
  // `sprite` names a picture that already exists in resources/items until each has its own.
  const treasures = {
    "shell-bracelets": { name: "Shell bracelets", sprite: "spondylus-shell", price: 30, weight: 0.4, minFloor: 2,
      description: "A stack of bracelets, each cut in one piece from a sea shell. The people of this country wore them from wrist to elbow, and were buried in them." },
    "copper-tweezers": { name: "Copper tweezers", sprite: "copper-axe-money", price: 50, weight: 0.1, minFloor: 2,
      description: "Tweezers of beaten copper with spiral ends, made to hang on the chest. In the P'urhépecha country the priests wear them." },
    "clay-dog": { name: "Red clay dog", sprite: "terracotta-figurine", price: 45, weight: 2, minFloor: 3,
      description: "A fat dog of polished red clay, hollow, with a spout in its tail. The old peoples of this country put dogs like this in the grave with their dead." },
    "clay-ballplayer": { name: "Clay ballplayer", sprite: "terracotta-figurine", price: 55, weight: 1.5, minFloor: 3,
      description: "A clay figure of a man in a thick hip guard, one knee down, a ball in his hand. His mouth is open; he is shouting at someone." },
    "obsidian-earspools": { name: "Obsidian ear spools", sprite: "obsidian-eccentric", price: 65, weight: 0.2, minFloor: 4,
      description: "A pair of ear spools ground from black obsidian, so thin that a flame shows through them green." },
    "clay-pole": { name: "Clay pole with a flier", sprite: "terracotta-figurine", price: 85, weight: 1.5, minFloor: 5,
      description: "A clay model of a tall pole with a small man balanced on top on his belly, arms out. Around the foot, clay people look up." },
    "clay-house": { name: "Clay house with people in it", sprite: "terracotta-figurine", price: 100, weight: 3, minFloor: 5,
      description: "A painted clay house two hands wide. Upstairs a family is eating. Downstairs, under the floor, another family sits in the dark." },
    "pyrite-mirror": { name: "Pyrite mirror", sprite: "obsidian-mirror", price: 130, weight: 1, minFloor: 6,
      description: "A disk of slate faced with fitted pieces of fool's gold, polished until it showed a face. It has gone dull and brown. The back is carved with a lord looking down." },
    // What the ash bundle pays for its release.
    "maguey-thorns": { name: "Maguey thorns", sprite: "obsidian-razors", price: 60, weight: 0.1, minFloor: 99,
      description: "Long black thorns from the tip of a maguey leaf, tied with a red thread. The Mexica told that one of the night's apparitions, seized and held, would buy its release with these: one for every captive the holder would take." }
  };

  // ---------- Creatures ----------
  const sprites = ["coyotl", "tlacuatzin", "ash-bundle"];
  const spriteAliases = {};

  const enemies = [
    { id: "coyotl", name: "Coyote", sprite: "coyotl", edible: true, hp: 8, ac: 13, attackBonus: 4, damage: "1d6+1", initiativeBonus: 3, xp: 30,
      description: "A coyote that came in through the roots from the jungle and stayed. It hunts in a pack of three or four and eats anything, the dead included. The Mexica say the coyote remembers a kindness and pays it back." },
    { id: "tlacuatzin", name: "Tlacuatzin", sprite: "tlacuatzin", edible: true, hp: 5, ac: 12, attackBonus: 2, damage: "1d4", initiativeBonus: 2, xp: 10,
      description: "An opossum: gray, long-nosed, bare-tailed, with her young riding on her back. She eats what the others leave. Caught in the open, she falls over and lies with her mouth open until you go away." },
    { id: "tlacanexquimilli", name: "Tlacanexquimilli", sprite: "ash-bundle", hp: 14, ac: 11, attackBonus: 4, damage: "1d6+2", initiativeBonus: 0, xp: 60,
      description: "A shrouded bundle of ash the size of a crouching man, with no head and no feet. By day it lies where it is. At night it rolls along the floor and groans. The Mexica counted it among the omens of the night, and said a brave person who took hold of one and would not let go could make it pay." }
  ];

  // Their places in the food web (the fields are explained in data/ecology.js). New here:
  //   feigns     caught close by something it fears, it drops and plays dead (systems/minds.js)
  //   gives      what it leaves when you put it down: { id, quantity: [least, most] }
  //   fromFloor  the first floor it is found on, for kinds the floor's food doesn't feed
  const species = {
    coyotl: {
      role: "predator", rank: 1, upkeep: 1.1, is: ["small"], eats: ["small", "insects", "carrion", "provisions"], temperament: "hungry",
      appetite: 0.5, size: 2, meat: "monster-meat", breeds: { every: 600 }, flees: 0.45, packs: true,
      note: "Hunts grasshoppers, opossums, and young turkeys on the upper floors, in a pack. One coyote alone runs from you. Four together may not. Leave food for a pack and it remembers you."
    },
    tlacuatzin: {
      role: "scavenger", upkeep: 0.7, is: ["small"], eats: ["carrion", "provisions", "insects", "fungus"], temperament: "wary",
      appetite: 0.5, size: 1, meat: "monster-meat", breeds: { every: 500, cap: 3 }, flees: 0.7, feigns: true,
      note: "Eats carrion, insects, and whatever is dropped. Frightened at close range, it plays dead, and gets up when you have gone. The Mexica gave its tail as medicine to women in labor."
    },
    tlacanexquimilli: {
      role: "spirit", is: [], eats: ["tonalli"], temperament: "hostile", appetite: 0.15, size: 0, fromFloor: 3,
      gives: { id: "maguey-thorns", quantity: [1, 4] },
      note: "Lies still by day. At night it comes for the warmth in you. Put it down and it pays in maguey thorns."
    }
  };

  // The chambers they live in, by weight (added to each habitat's residents).
  const residents = {
    "insect-cavern": { coyotl: 1.2, tlacuatzin: 0.8 },
    "fungal-garden": { tlacuatzin: 0.5 },
    "predator-den": { coyotl: 1.4 },
    "bone-yard": { coyotl: 0.8, tlacuatzin: 1, tlacanexquimilli: 0.7 },
    "damp-cavern": { tlacuatzin: 0.6 },
    "overgrown-ruins": { tlacuatzin: 0.5 },
    shrine: { tlacanexquimilli: 0.9 }
  };

  window.CryptsXalisco = { rooms, treasures, enemies, species, residents };

  // ---------- Register ----------
  const pack = window.CryptsContent?.starterPack;
  if (pack) pack.rooms.push(...rooms);
  const items = window.CryptsItems;
  for (const [id, entry] of Object.entries(treasures)) {
    items.gear[id] = { name: entry.name, weight: entry.weight, price: entry.price, category: "Treasure", sprite: entry.sprite, description: entry.description };
  }
  window.CryptsWardrobe?.tombTreasure.push(...Object.entries(treasures)
    .filter(([, entry]) => entry.minFloor <= 13).map(([id, entry]) => ({ id, minFloor: entry.minFloor })));
  const bestiary = window.CryptsEnemies;
  if (bestiary) {
    bestiary.sprites.push(...sprites.filter((id) => !bestiary.sprites.includes(id)));
    Object.assign(bestiary.spriteAliases ||= {}, spriteAliases);
    bestiary.starter.push(...enemies);
  }
  const ecology = window.CryptsEcology;
  if (ecology) {
    Object.assign(ecology.species, species);
    for (const [habitat, list] of Object.entries(residents)) {
      if (ecology.habitats[habitat]) Object.assign(ecology.habitats[habitat].residents, list);
    }
  }
})();
