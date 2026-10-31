"use strict";

// The tomb's ecosystem, as data. Add a species, colony, or habitat here and the systems in
// systems/biome.js and systems/ecology.js pick it up: no behavior code needs to change.
//
// resources  what grows, pools, rots, or is left out on a floor, and what eats it
// colonies   life too small and too many to follow one by one (grasshoppers, ants, beetles,
//            water bugs): a count on a tile that grows with its food and is eaten from
// habitats   what a chamber is, from its surroundings (prefers: elev, moist, warm, shelter,
//            magic, each [center, tolerance] on 0–1), what grows there, who lives there
// species    every creature: its role in the food web, what it eats, how it treats you, how
//            it breeds, where it lives, and what it's good for afterwards
//
// Diets name food kinds: fungus, plants, fish, insects, small, large (living prey, matched
// against the prey's `is` tags), carrion (dead bodies), provisions (food you drop), and
// tonalli (the warmth of life the restless dead feed on: offerings and fresh deaths).
//
// Sources for the mythological creatures are in README.md (The living tomb).

window.CryptsEcology = {
  // One ecology tick is ten minutes of world time (one dungeon turn).
  resources: {
    fungus: {
      name: "Glowcap bed", token: "fungus-patch", food: "fungus", max: 6, regrowTicks: 14, spreads: true,
      harvest: "cave-mushrooms", harvestVerb: "Gather glowcaps",
      description: "Pale, faintly glowing mushrooms on rotten wood. Grazers eat them; they grow back, and in damp, well-fed ground they spread."
    },
    plants: {
      name: "Root tangle", token: "root-tangle", food: "plants", max: 5, regrowTicks: 18,
      harvest: "wild-ingredients", harvestVerb: "Dig roots and greens",
      description: "Roots hanging through the rock, with pale shoots and moss below. Grazers chew them; they grow back."
    },
    pool: {
      name: "Still pool", token: "pool", food: "fish", max: 5, regrowTicks: 20,
      harvest: "blindfish", harvestVerb: "Fish the pool",
      description: "Black, still water full of small blind fish. Water creatures hunt here; the fish come back."
    },
    offering: {
      name: "Offering bowl", token: "offering", food: "tonalli", max: 6, regrowTicks: 30,
      description: "An old stone bowl with ash, copal, and dried flowers. The restless dead feed on what is left here. Leave copal, a marigold garland, or food to feed them yourself."
    },
    nest: {
      name: "Nest", token: "nest", food: "", max: 3, regrowTicks: 72,
      harvest: "cave-eggs", harvestVerb: "Take eggs",
      description: "A nest of leathery eggs, warm to the touch. The creature that laid them stays close and will defend them."
    },
    carcass: {
      name: "Carcass", token: "carcass", food: "carrion",
      description: "A fresh carcass. Scavengers will come for it, and while it's fresh, so will the restless dead."
    },
    bones: {
      name: "Picked bones", token: "bones", food: "",
      description: "Bones cleaned white. Scavengers have been here."
    },
    mouth: {
      name: "Mouth in the rock", token: "earth-mouth", food: "",
      description: "A wet, toothed crack in the living rock, breathing slowly. This is Tlaltecuhtli, the earth herself, whose body the world was made from, and her mouths take back the dead. What she eats, she gives back: the ground around her mouths grows thick. Step on one while she's hungry and she will take a bite of you."
    },
    "alux-house": {
      name: "Alux house", token: "alux-house", food: "",
      description: "A tiny house of fitted stones, the size of a dog's kennel, with a clay figure sealed inside. The old lords brought aluxes up from the Maya lowlands as tribute and set them to guard their storerooms. An alux serves seven years and is released. These were bound in an age that never ended. Leave it a maize dish or honey and it lets you be; take from what it guards without asking and it will make you sorry."
    }
  },

  // Life too small to follow one by one. Each colony is a count on a tile: it grows when
  // its food is near, shrinks when eaten or starved, and things that eat it feed from it.
  colonies: {
    chapolin: {
      name: "Chapolin swarm", token: "chapolin-colony", species: "chapolin", food: ["fungus", "plants"], is: ["insects"],
      max: 24, perFood: 4, growth: 0.18, harvest: "chapulines", harvestVerb: "Catch chapulines", harvestAt: 6,
      description: "Hundreds of hand-long grasshoppers chewing on the glowcaps. Their numbers rise and fall with the food. When a big swarm runs out, the big ones darken, crowd together, and go looking for a new garden."
    },
    chicatana: {
      name: "Chicatana nest", token: "ant-mound", species: "chicatana", food: ["plants"], is: [],
      max: 40, perFood: 8, growth: 0.1, farms: "fungus", harvest: "chicatanas", harvestVerb: "Take winged chicatanas", harvestAt: 28, bites: "1d4",
      description: "A mound of leafcutter ants. They cut the roots and carry the pieces down to farm their own glowcaps, so the fungus around them grows faster. When the colony is big, its winged queens fill the tunnels. People in the south toast them in salsa. The soldiers bite."
    },
    pinacate: {
      name: "Pinacate beetles", token: "beetles", species: "pinacate", food: ["carrion", "bones"], is: ["insects"],
      max: 20, perFood: 6, growth: 0.25, decomposer: true,
      description: "Black beetles that stand on their heads when bothered. They take apart what the scavengers leave until there is nothing but rich black earth, and things grow there."
    },
    ahuauhtli: {
      name: "Water-bug reeds", token: "ahuauhtli", species: "ahuauhtli", food: ["fish"], is: ["insects"],
      max: 20, perFood: 4, growth: 0.14, harvest: "ahuauhtli", harvestVerb: "Gather ahuauhtli eggs", harvestAt: 8,
      description: "Reeds at the water's edge, coated with the tiny eggs of water bugs. The people of the lakes have eaten these for as long as there have been lakes: they call it ahuauhtli, amaranth of the water."
    }
  },

  // What each chamber is, from where it sits. `names` and `texts` vary by band of the tomb
  // (rootbound, fortress, living-rock, mouth). Ground letters: see systems/biome.js.
  habitats: {
    "fungal-garden": {
      name: "Fungal garden", depth: [1, 13], weight: 2.2,
      prefers: { moist: [0.75, 0.3], shelter: [0.55, 0.45] }, likesNear: { "bat-roost": 1.5 },
      resources: { fungus: [2, 4] }, colonies: { chapolin: [1, 1] },
      residents: { "maztican-cave-locust": 2, chaneque: 0.6 }, population: [0, 1], peaceful: true, ground: "y",
      text: "The floor is soft with rot and glowcaps. Things graze here."
    },
    "insect-cavern": {
      name: "Root gallery", depth: [1, 8], weight: 2,
      names: { fortress: "Overgrown hall" },
      prefers: { moist: [0.55, 0.35], elev: [0.65, 0.4] },
      resources: { plants: [2, 3], fungus: [0, 1] }, colonies: { chapolin: [0, 1], chicatana: [0, 1] },
      residents: { "maztican-cave-locust": 1.5, colotl: 1.2, mazacoatl: 0.8 }, population: [0, 2], ground: "r",
      text: "Roots hang through the ceiling in curtains. Everything that eats them lives here, and everything that eats those.",
      texts: { fortress: "Pale roots have come up through the floor from below and split the old lords' paving. Grazers browse them; hunters follow the grazers." }
    },
    "damp-cavern": {
      name: "Damp cavern", depth: [1, 13], weight: 1.6,
      names: { fortress: "Weeping hall", "living-rock": "Shell cavern" },
      prefers: { moist: [0.6, 0.25], elev: [0.45, 0.35] },
      resources: { plants: [1, 2] }, colonies: {},
      residents: { maquizcoatl: 0.5, "tomb-bat": 0.6, chaneque: 0.4 }, population: [0, 1], peaceful: true, ground: "m",
      text: "Water drips from the ceiling into little stone cups it has been building for ten thousand years. Moss covers everything, and the room is quiet.",
      texts: { "living-rock": "The rock here is pink and ridged like the inside of a shell, and damp to the touch. Moss grows in every ridge. The room is quiet." }
    },
    "flooded-chamber": {
      name: "Flooded chamber", depth: [1, 13], weight: 3, water: "basin",
      names: { fortress: "Flooded cistern", "living-rock": "Underground pool", mouth: "The first water" },
      resources: { pool: [1, 2] }, colonies: { ahuauhtli: [0, 1] },
      residents: { axolocatl: 2, "cenote-stalker": 1.4, cipactli: 0.7 }, population: [1, 2], ground: "w",
      text: "Water has pooled here at the low point of the floor. It is black, still, and deep.",
      texts: { fortress: "The old lords' cistern has filled to the brim with water from below. It is black, still, and deep." }
    },
    "bat-roost": {
      name: "Bat roost", depth: [1, 13], weight: 1.6, fertile: true,
      prefers: { elev: [0.75, 0.35], shelter: [0.55, 0.4], moist: [0.4, 0.35] }, likesNear: { "fungal-garden": 1.5 },
      resources: {}, colonies: {},
      residents: { "tomb-bat": 3, camazotz: 0.4 }, population: [1, 2], peaceful: true, ground: "g",
      text: "The ceiling rustles. Droppings carpet the floor, and the glowcaps in the next chambers grow fat on them."
    },
    "predator-den": {
      name: "Predator den", depth: [2, 13], weight: 2.2, water: "dry",
      names: { fortress: "Barracks den" },
      prefers: { shelter: [0.85, 0.3] },
      needsNear: { habitats: ["fungal-garden", "insect-cavern", "flooded-chamber", "overgrown-ruins", "bat-roost"], reach: 2, otherwise: null },
      resources: { bones: [1, 2] }, colonies: {},
      residents: { "jungle-jaguar": 2, "huay-chivo": 0.8, mazacoatl: 1 }, population: [1, 1], territory: true, ground: "b",
      text: "It smells of musk and old meat. A large hunter sleeps here between hunts, close to where its prey feeds.",
      texts: { fortress: "The old lords' soldiers slept here. Now a hunter does, on a bed of their shields, with bones around it." }
    },
    "nesting-chamber": {
      name: "Nesting chamber", depth: [2, 13], weight: 1.8, water: "dry",
      prefers: { shelter: [0.85, 0.3], warm: [0.6, 0.35] },
      resources: { nest: [1, 1] }, colonies: {},
      residents: { colotl: 2, axolocatl: 0.8, cihuateotl: 0.5 }, population: [1, 1], ground: "",
      text: "A warm, sheltered corner with eggs in it. The creature that laid them stays close."
    },
    "bone-yard": {
      name: "Bone yard", depth: [2, 13], weight: 1.2,
      needsNear: { habitats: ["predator-den", "earth-mouth", "shrine"], reach: 2, otherwise: "damp-cavern" },
      resources: { bones: [2, 3] }, colonies: { pinacate: [1, 1] },
      residents: { "xolo-hound": 2, "huay-chivo": 0.8, mictlaneca: 0.6 }, population: [0, 1], ground: "b",
      text: "Gnawed bones lie scattered everywhere, and beetles work through them. Scavengers feed here."
    },
    "dry-chamber": {
      name: "Dry chamber", depth: [3, 13], weight: 1.6, water: "dry",
      names: { "living-rock": "Vent chamber" },
      prefers: { warm: [0.8, 0.25], moist: [0.15, 0.25] },
      resources: { plants: [0, 1] }, colonies: {},
      residents: { colotl: 2, quinametli: 1, caxtiltecatl: 0.6 }, population: [0, 1], ground: "a",
      text: "Hot, dry air comes up from somewhere deeper. Only things that like the heat stay here.",
      texts: { "living-rock": "The rock is hot to the touch and the air shimmers over a crack in the floor. The mouth below is breathing." }
    },
    shrine: {
      name: "Old shrine", depth: [1, 13], weight: 1.4,
      prefers: { magic: [0.65, 0.35] },
      resources: { offering: [1, 1] }, colonies: {},
      residents: { mictlaneca: 2, yohualtepoztli: 1.4, cihuateotl: 1, tlacatecolotl: 1, duende: 0.8, itzpapalotl: 0.6, "feathered-serpent": 0.5 },
      population: [1, 1], ground: "",
      text: "Someone kept offerings here once. The dead still come to what's left."
    },
    "overgrown-ruins": {
      name: "Overgrown ruins", depth: [3, 9], weight: 2,
      prefers: { moist: [0.5, 0.35], magic: [0.45, 0.35] },
      resources: { plants: [1, 2], fungus: [0, 1] }, colonies: { chicatana: [0, 1] },
      features: { "alux-house": { chance: 0.45, minFloor: 5 } },
      residents: { chaneque: 1.2, alux: 1, duende: 0.6, maquizcoatl: 0.4 }, population: [0, 1], peaceful: true, ground: "ru",
      text: "The old lords' storerooms, split open by roots growing up from the deep. Small guardians keep what's left. Ask before you take."
    },
    "earth-mouth": {
      name: "The earth's mouth", depth: [9, 13], weight: 2.2,
      prefers: { elev: [0.25, 0.3], magic: [0.55, 0.35] },
      resources: { bones: [1, 2] }, colonies: { pinacate: [0, 1] },
      features: { mouth: { chance: 1 } },
      residents: { "huay-chivo": 0.5, "xolo-hound": 0.8 }, population: [0, 1], ground: "f",
      text: "The rock here is red and wet and breathes. A mouth opens in the floor. This is Tlaltecuhtli's body, and the dead go back into it."
    },
    "star-hollow": {
      name: "Star hollow", depth: [8, 13], weight: 1.9,
      prefers: { magic: [0.85, 0.25] },
      resources: { fungus: [1, 2] }, colonies: {},
      residents: { itzpapalotl: 1, "feathered-serpent": 0.8, tlacatecolotl: 0.8, maquizcoatl: 0.4 }, population: [0, 1], ground: "c",
      text: "Crystal grows out of the walls in the shapes of stars, and glowcaps feed on its light. Some creatures here live nowhere else in the tomb."
    }
  },

  // role         grazer, predator, scavenger, omnivore, raider, spirit, guardian, colony
  // is           what it counts as when something else is hunting
  // eats         what it eats (food kinds, see above)
  // temperament  hostile: comes for you when it notices you
  //              hungry: only comes for you when it's hungry; fed, it minds its own business
  //              wary: keeps away from you unless you corner or attack it
  //              neutral: lets you be unless you offend it (see `offended`)
  // appetite     how fast it gets hungry (satiety lost per tick)
  // size         how much a kill or a carcass of it feeds (and how much meat it gives)
  // meat         what butchering it gives you; `prepare` is what can go wrong doing it
  // breeds       { every: ticks, cap: per floor } for creatures that multiply when well fed
  // flees        it breaks off and runs below this share of its hit points
  // territorial  drives off others of its kind (and other big hunters) from its home
  // aquatic      swims deep water
  // sleepsAfter  after a big meal it sleeps it off for this many ticks
  species: {
    chapolin: {
      role: "colony", is: ["insects"], eats: ["fungus", "plants", "provisions"], temperament: "wary",
      appetite: 1.2, size: 1, meat: "chapulines",
      note: "Grazes glowcaps and roots in swarms that grow and shrink with the food. Bats, scorpions, snakes, and owls eat it."
    },
    "maztican-cave-locust": {
      role: "grazer", is: ["insects", "small"], eats: ["fungus", "plants", "provisions"], temperament: "wary",
      appetite: 1, size: 1, meat: "chapulines", breeds: { every: 72, cap: 4 }, flees: 0.6,
      note: "A chapolin grown huge on the deep's food. Alone it's shy and grazes. When a big swarm runs out of food, the big ones band together and strip the next garden bare."
    },
    "tomb-bat": {
      role: "predator", is: ["small"], eats: ["insects"], temperament: "hungry",
      appetite: 0.6, size: 1, breeds: { every: 96, cap: 4 }, flees: 0.4,
      note: "Hunts insects on the wing and roosts in the high chambers. Its droppings feed the fungus next door."
    },
    duende: {
      role: "raider", is: ["small"], eats: ["provisions", "tonalli"], temperament: "hostile",
      appetite: 0.5, size: 1, flees: 0.5,
      note: "A house spirit from Spanish folk tales, not the old ones. It lives in walls and steals food left out, offerings, and gold."
    },
    "jungle-jaguar": {
      role: "predator", is: ["large"], eats: ["small", "insects", "large", "carrion"], temperament: "hungry",
      appetite: 0.45, size: 3, meat: "monster-meat", territorial: true, flees: 0.25, breeds: { every: 400, cap: 2 },
      note: "Hunts anything smaller than itself and keeps a den near where its prey feeds. Fed, it lets you pass. Hungry, it doesn't. It won't share its ground with another jaguar."
    },
    "cenote-stalker": {
      role: "predator", is: ["small"], eats: ["fish", "small", "large"], temperament: "hungry",
      appetite: 0.5, size: 2, aquatic: true, taboo: true, breeds: { every: 300, cap: 2 }, flees: 0.3,
      note: "The ahuizotl. It lives in deep water and takes things from the edge with the hand on its tail. When it's hungry it cries like a baby, and the fish and frogs jump to bring you closer. Its kills belong to Tlaloc, and so does it: those who touch either come to grief."
    },
    axolocatl: {
      role: "omnivore", is: ["small"], eats: ["fish", "plants", "insects"], temperament: "hostile",
      appetite: 0.6, size: 2, meat: "monster-meat", breeds: { every: 120, cap: 3 }, aquatic: true, flees: 0.3,
      note: "Fishes its pool, eats the water bugs, and guards its spawn. Cipactli and the ahuizotl hunt it."
    },
    colotl: {
      role: "predator", is: ["small"], eats: ["insects"], temperament: "hungry",
      appetite: 0.7, size: 2, meat: "colotl-tail", breeds: { every: 144, cap: 3 }, flees: 0.3,
      prepare: { hazard: "poison", dc: 13, note: "The sting gland has to come out whole." },
      note: "Hunts insects in the dry, warm chambers and guards its brood. Butchering one is safe once you know where the venom sits."
    },
    "xolo-hound": {
      role: "scavenger", is: ["large"], eats: ["carrion", "provisions"], temperament: "wary",
      appetite: 0.6, size: 2, flees: 0.4,
      note: "Eats the dead. Follows the smell of a kill, waits its turn while the hunter feeds, and leaves the living alone."
    },
    cipactli: {
      role: "predator", is: ["large"], eats: ["fish", "small", "large", "carrion"], temperament: "hostile",
      appetite: 0.35, size: 4, meat: "caiman-tail", aquatic: true, territorial: true, sleepsAfter: 48,
      note: "The top of the pool. Eats fish, axolocatl, the ahuizotl, and anything that wades in. After a big meal it lies still for hours."
    },
    quinametli: {
      role: "omnivore", is: ["large"], eats: ["fungus", "plants", "carrion"], temperament: "hungry",
      appetite: 0.3, size: 4, sleepsAfter: 36,
      note: "Eats glowcap beds whole and sleeps it off on its hoard."
    },
    "huay-chivo": {
      role: "scavenger", is: ["large"], eats: ["carrion", "small", "provisions"], temperament: "hostile",
      appetite: 0.6, size: 3, flees: 0.25,
      note: "A Maya witch in a goat's shape (a way, a person's animal double). It feeds on the dead and on small animals, and attacks people on sight."
    },
    camazotz: {
      role: "predator", is: ["large"], eats: ["small", "large", "tonalli"], temperament: "hostile",
      appetite: 0.4, size: 3,
      note: "The K'iche' Maya death bat. Hunts the warm-blooded and drinks the life from the dying."
    },
    "feathered-serpent": {
      role: "spirit", is: ["large"], eats: ["tonalli", "small"], temperament: "hostile",
      appetite: 0.2, size: 4,
      note: "Fed by offerings, like a god. A well-fed serpent can be passed."
    },
    caxtiltecatl: {
      role: "raider", is: ["large"], eats: ["provisions", "carrion"], temperament: "hostile",
      appetite: 0.5, size: 3,
      note: "Eats whatever it can take: food left out, and the tomb's own kills."
    },
    mictlaneca: {
      role: "spirit", is: [], eats: ["tonalli"], temperament: "hostile",
      appetite: 0.15, size: 0,
      note: "The dead soldier keeps its post on offerings. Feed the shrine and it forgets you."
    },
    cihuateotl: {
      role: "spirit", is: [], eats: ["tonalli"], temperament: "hostile",
      appetite: 0.2, size: 0,
      note: "Fed by offerings and by fresh deaths. She watches over the nests."
    },
    yohualtepoztli: {
      role: "spirit", is: [], eats: ["tonalli"], temperament: "hostile",
      appetite: 0.2, size: 0,
      note: "Drawn to fresh deaths and old offerings."
    },
    tlacatecolotl: {
      role: "predator", is: ["small"], eats: ["insects", "small", "tonalli"], temperament: "hostile",
      appetite: 0.5, size: 2,
      note: "An owl in a man: hunts bats and insects, and feeds on shrines."
    },
    itzpapalotl: {
      role: "spirit", is: [], eats: ["tonalli", "small"], temperament: "hostile",
      appetite: 0.2, size: 0,
      note: "Fed by offerings and the dying."
    },
    tzitzimitl: {
      role: "spirit", is: [], eats: ["tonalli"], temperament: "hostile",
      appetite: 0.1, size: 0,
      note: "Fed by what this whole tomb was built to offer."
    },
    mazacoatl: {
      role: "predator", is: ["large"], eats: ["small", "large"], temperament: "hungry",
      appetite: 0.25, size: 3, meat: "mazacoatl-meat", territorial: true, sleepsAfter: 60, flees: 0.2, breeds: { every: 500, cap: 2 },
      note: "The deer serpent: a great snake with antlers, named for what it eats. It isn't venomous; it waits, takes something with four legs, coils, and then sleeps for a long time. The Mexica kept and bred them for their meat."
    },
    maquizcoatl: {
      role: "grazer", is: ["small"], eats: ["insects"], temperament: "wary",
      appetite: 0.3, size: 1, omen: true, flees: 1,
      note: "A small snake with a head at both ends, red-bellied, ringed like a bracelet. The Mexica called it tetzauhcoatl, the omen serpent. Leave it alone."
    },
    chaneque: {
      role: "guardian", is: [], eats: ["tonalli"], temperament: "neutral", offended: "susto",
      appetite: 0.1, size: 0, flees: 0.8,
      note: "A small guardian of wild places with an old face on a child's body, from the Nahua tellings of the Gulf coast. It keeps the springs and gardens. Ask it (tobacco, sweets, a drink) before you take from what it keeps, or it will frighten your soul out of you."
    },
    alux: {
      role: "guardian", is: [], eats: ["tonalli"], temperament: "neutral", offended: "stones",
      appetite: 0.1, size: 0,
      note: "A little guardian of the Yucatec Maya, made of clay by a priest and bound to a field or a house. The old lords carried these away as tribute. Feed it corn or honey and it keeps watch for you; rob what it guards and it throws stones. Break it and it reforms."
    }
  },

  // Ingredients that only the tomb provides, and the dishes they make. `requires` names the
  // naturalist's knowledge a recipe needs (a species or colony observed).
  ingredients: {
    "cave-mushrooms": { name: "Glowcap mushrooms", food: 15, nutrients: { protein: 15, carbohydrates: 10, greens: 30 }, weight: 0.4, price: 1,
      description: "Pale mushrooms with a faint glow, gathered from the tomb's fungal gardens. Better cooked than raw." },
    blindfish: { name: "Blindfish", food: 20, nutrients: { protein: 40, carbohydrates: 0, greens: 5 }, weight: 0.5, price: 1.5,
      description: "Small white fish without eyes, caught in the tomb's still pools. Cook them before they turn." },
    "colotl-tail": { name: "Colotl tail meat", food: 25, nutrients: { protein: 50, carbohydrates: 0, greens: 0 }, weight: 1, price: 3,
      description: "The meat of a giant scorpion's tail, sting removed. A delicacy, roasted." },
    "caiman-tail": { name: "Cipactli tail", food: 35, nutrients: { protein: 60, carbohydrates: 0, greens: 0 }, weight: 2, price: 5,
      description: "A cut from the tail of the great caiman. Rich, dense, and enough for a feast." },
    "cave-eggs": { name: "Cave eggs", food: 20, nutrients: { protein: 40, carbohydrates: 5, greens: 0 }, weight: 0.5, price: 2,
      description: "Leathery eggs from a tomb creature's nest. Good scrambled with anything." },
    chicatanas: { name: "Chicatanas", food: 15, nutrients: { protein: 45, carbohydrates: 5, greens: 0 }, weight: 0.2, price: 4,
      description: "Winged leafcutter queens, big as a thumbnail, taken from a colony at its peak. Toasted on a comal they taste of nuts and butter." },
    ahuauhtli: { name: "Ahuauhtli", food: 15, nutrients: { protein: 40, carbohydrates: 10, greens: 5 }, weight: 0.3, price: 3,
      description: "Water-bug eggs scraped from the reeds of a tomb pool, the lake people's 'amaranth of the water'. Pressed into little cakes and fried." },
    "mazacoatl-meat": { name: "Mazacoatl meat", food: 35, nutrients: { protein: 60, carbohydrates: 0, greens: 0 }, weight: 2, price: 6,
      description: "White, firm meat from the deer serpent. The Mexica bred them for it. Folk say it makes you strong." },
    "summit-cap": { name: "Summit cap", food: 5, nutrients: { protein: 5, carbohydrates: 5, greens: 15 }, weight: 0.1, price: 8,
      description: "A thin, pale fungus that grows out of a dead chapolin clinging to the top of a glowcap stalk. The fungus drove it up there to spread its spores. Brewed, it sharpens the eyes in the dark." }
  },

  recipes: {
    "glowcap-tamales": {
      name: "Glowcap tamales", ingredients: { "cave-mushrooms": 1, ration: 1 }, buff: "hushed",
      food: 70, nutrients: { protein: 25, carbohydrates: 40, greens: 30 },
      description: "Masa folded around buttery glowcaps and steamed. Eat for food and Hushed: creatures notice you a square later, and +2 Stealth, for 8 hours."
    },
    "chapulines-mushrooms": {
      name: "Chapulines with glowcaps", ingredients: { chapulines: 1, "cave-mushrooms": 1 }, buff: "keen-eyed",
      food: 55, nutrients: { protein: 45, carbohydrates: 10, greens: 30 },
      description: "Toasted grasshoppers tossed with seared glowcaps and lime. Eat for food and Keen-eyed: +2 Perception and Survival for 8 hours."
    },
    "grilled-blindfish": {
      name: "Grilled blindfish in chili", ingredients: { blindfish: 1, chilis: 1 }, buff: "nimble",
      food: 60, nutrients: { protein: 45, carbohydrates: 10, greens: 15 },
      description: "Whole little fish grilled on a stick with chili paste. Eat for food and Nimble: +2 Dexterity saves (heavy blows, traps) for 8 hours."
    },
    "colotl-salsa": {
      name: "Colotl tail in green salsa", ingredients: { "colotl-tail": 1, "wild-ingredients": 1 }, buff: "unbitten",
      food: 65, nutrients: { protein: 50, carbohydrates: 10, greens: 25 },
      description: "Scorpion tail meat simmered in a sharp green salsa. Eat for food and Unbitten: poison can't take hold of you for 8 hours."
    },
    "caiman-barbacoa": {
      name: "Cipactli barbacoa", ingredients: { "caiman-tail": 1, chilis: 1 }, buff: "fiery",
      food: 90, nutrients: { protein: 60, carbohydrates: 15, greens: 10 },
      description: "Caiman tail wrapped in leaves and slow-cooked in the coals. Eat for food and Fire in the belly: +2 weapon damage for 8 hours."
    },
    "egg-pozole": {
      name: "Egg and root pozole", ingredients: { "cave-eggs": 1, "wild-ingredients": 1 }, buff: "hearty",
      food: 70, nutrients: { protein: 40, carbohydrates: 30, greens: 25 },
      description: "Hominy and roots with eggs stirred through. Eat for food and Hearty: +1 to attack rolls for 8 hours."
    },
    "chicatana-salsa": {
      name: "Chicatana salsa", ingredients: { chicatanas: 1, chilis: 1 }, buff: "ant-back", requires: "chicatana",
      food: 45, nutrients: { protein: 45, carbohydrates: 15, greens: 20 },
      description: "Toasted winged ants ground with chili and garlic in a molcajete. Eat for food and Ant's back: carry 30 lb more for 8 hours."
    },
    "ahuauhtli-cakes": {
      name: "Ahuauhtli cakes", ingredients: { ahuauhtli: 1, "cave-eggs": 1 }, buff: "water-sure", requires: "ahuauhtli",
      food: 60, nutrients: { protein: 50, carbohydrates: 15, greens: 10 },
      description: "Water-bug eggs bound with egg and fried into little cakes, as the lake people make them. Eat for food and Water-sure: you can swim deep water for 8 hours."
    },
    "mazacoatl-pipian": {
      name: "Mazacoatl in pipián", ingredients: { "mazacoatl-meat": 1, "wild-ingredients": 1 }, buff: "coiled", requires: "mazacoatl",
      food: 85, nutrients: { protein: 60, carbohydrates: 15, greens: 20 },
      description: "Deer-serpent meat stewed in a sauce of ground squash seeds. Eat for food and Coiled: +1 AC and +2 Strength saves for 8 hours."
    },
    "summit-cap-tea": {
      name: "Summit cap tea", ingredients: { "summit-cap": 1, water: 1 }, buff: "deepsight", requires: "summit-cap",
      food: 10, nutrients: { protein: 5, carbohydrates: 5, greens: 20 },
      description: "A bitter brew of the fungus that climbs dead chapolines. Drink for Deepsight: you see 2 squares farther in the dark and spot hidden creatures more easily, for 8 hours."
    }
  },

  buffs: {
    hushed: { name: "Hushed", description: "Creatures notice you a square later; +2 Stealth.", minutes: 480 },
    nimble: { name: "Nimble", description: "+2 Dexterity saving throws.", minutes: 480 },
    unbitten: { name: "Unbitten", description: "Poison can't take hold of you.", minutes: 480 },
    "ant-back": { name: "Ant's back", description: "Carry 30 lb more.", minutes: 480 },
    "water-sure": { name: "Water-sure", description: "You can swim deep water.", minutes: 480 },
    coiled: { name: "Coiled", description: "+1 AC and +2 Strength saving throws.", minutes: 480 },
    deepsight: { name: "Deepsight", description: "See 2 squares farther; +3 to spot hidden creatures.", minutes: 480 }
  },

  // Troubles the tomb's own life can give you. (Turns are your turns in the tomb.)
  conditions: {
    susto: { name: "Susto", description: "A chaneque frightened part of your soul away: −2 to attack rolls and saving throws. An offering at a shrine calls it back.", turns: 20 },
    "ill-omened": { name: "Ill-omened", description: "You harmed the omen serpent: −1 to saving throws and creatures notice you a square sooner.", turns: 20 },
    "tlaloc-ache": { name: "Tlaloc's ache", description: "You touched what belongs to Tlaloc: your joints swell; −1 AC.", turns: 20 }
  },

  // What you can leave at a shrine to feed the restless dead, and how much it feeds them.
  offerings: { copal: 6, "marigold-garland": 6, ration: 3, tlaxcalli: 2, "cacao-drink": 4, pulque: 4 },
  // What a chaneque accepts (tobacco, sweets, drink) and what an alux accepts (corn food, honey).
  guardianOfferings: {
    chaneque: ["picietl", "amaranth-cake", "honeycomb", "cacao-drink", "pulque", "mamey"],
    alux: ["tlaxcalli", "atole", "pinole", "honeycomb", "tamales", "amaranth-cake"]
  }
};
