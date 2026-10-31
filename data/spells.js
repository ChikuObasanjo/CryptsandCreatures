"use strict";

// Every calling's spells and techniques, in the order they unlock. Each class has a short list
// of abilities with distinct jobs instead of a ladder of bigger bolts:
//
//   cost       "free" (at will), "slot" (one spell slot), or "cooldown" (ready again after
//              `cooldown` turns in the tomb; resting resets it)
//   target     "enemy" (a creature in sight within `range`), "adjacent" (a creature beside
//              you), "self", "around" (centered on you), "line" (a straight line toward a
//              creature in sight, `length` squares long)
//   roll       "attack" (spell attack vs. AC), "weapon" (your weapon attack), "save" (each
//              creature rolls against your spell DC; `half` = half damage on a success),
//              "auto" (always lands)
//   area       { radius }: the spell lands on every creature within `radius` of the target
//   on         what a landed hit (or failed save) does to the creature
//   field      a patch of ground that lasts `turns` creature turns
//   summon     a spirit that fights beside you
//   effect     a timed effect on you
//
// Damage dice grow at levels 5, 11, and 17 unless `scale` is false. The rules text players see
// is written from these numbers in systems/abilities.js, so they can't drift apart.
window.CryptsSpells = {
  byClass: {
    barbarian: ["rage", "reckless-swing", "war-cry", "whirlwind", "earthshaker"],
    bard: ["mocking-note", "soothing-verse", "thunder-drum", "lullaby", "discord", "flower-song"],
    cleric: ["sacred-flame", "breath-of-the-ceiba", "sacred-ground", "day-sign-burst", "ceiba-shelter", "ceiba-sanctuary"],
    druid: ["thorn-call", "entangling-roots", "call-the-nahual", "tlaloc-storm", "healing-spring", "chapulin-swarm"],
    fighter: ["second-wind", "shield-bash", "action-surge", "indomitable", "leg-sweep"],
    monk: ["deflect", "stunning-strike", "leaping-kick", "quivering-palm", "hundred-steps"],
    paladin: ["sun-smite", "aura-of-dawn", "fifth-sun-shield", "judgment-of-dawn"],
    ranger: ["hunters-mark", "pinning-shot", "rain-of-thorns", "piercing-arrow", "called-shot"],
    rogue: ["vanish", "caltrops", "hamstring", "shadow-step", "obsidian-smoke"],
    sorcerer: ["jade-spark", "shatterglass", "jade-lightning", "fire-serpent", "sun-eater-flare", "heart-of-fire"],
    warlock: ["eldritch-bolt", "patrons-curse", "pact-rend", "maw-of-mictlan", "hungering-curse"],
    wizard: ["arcane-dart", "warding-glyph", "force-lance", "stilled-hour", "mirror-step", "tonalamatl-recall"]
  },
  // Abilities removed in Build 29, mapped to what replaced them (for older notes and logs).
  retired: {
    "bardic-note": "mocking-note", "discordant-chord": "thunder-drum", "radiant-seal": "day-sign-burst",
    "storm-seed": "tlaloc-storm", "holy-brand": "sun-smite", "radiant-smite": "sun-smite",
    "hunter-arrow": "hunters-mark", "thorn-volley": "rain-of-thorns", "wind-shot": "pinning-shot",
    "obsidian-shard": "shatterglass", "arcane-surge": "jade-lightning", "void-lance": "patrons-curse"
  },
  catalog: {
    // ---------- Bard: songs that bend a fight rather than end it ----------
    "mocking-note": {
      name: "Mocking Note", level: 1, cost: "free", target: "enemy", range: 7, roll: "attack", damage: "1d6", strike: "crush",
      on: { distract: true },
      description: "One shrill note from a clay flute, aimed at a foe's pride."
    },
    "soothing-verse": {
      name: "Soothing Verse", level: 1, cost: "slot", target: "self", heal: "1d8", cure: true,
      description: "A flower-song for the wounded: your breath steadies, your cuts close, and what ails you lets go."
    },
    "thunder-drum": {
      name: "Thunder Drum", level: 3, cost: "slot", target: "around", radius: 2, roll: "save", save: "con", half: true,
      damage: "2d6", strike: "crush", on: { pushFail: 2 },
      description: "You strike the teponaztli so hard the air itself shoves everything near you away."
    },
    lullaby: {
      name: "Lullaby of Yohualli", level: 5, cost: "slot", target: "enemy", range: 7, area: { radius: 1 }, roll: "save", save: "wis",
      on: { sleep: 4 },
      description: "A cradle song. Creatures that hear it fall asleep where they stand."
    },
    discord: {
      name: "Song of Discord", level: 7, cost: "slot", target: "enemy", range: 7, roll: "save", save: "wis",
      on: { discord: 4 },
      description: "You sing a creature a lie about its neighbor, and it believes you."
    },
    "flower-song": {
      name: "Flower Song", level: 9, cost: "slot", target: "self", heal: "2d6", party: 5, effect: { kind: "inspired", turns: 6, attack: 2 },
      description: "The song of the flowery war. Everyone fighting beside you hears it, takes heart, and closes their wounds."
    },

    // ---------- Cleric: light that burns the dead and shelters you ----------
    "sacred-flame": {
      name: "Copal Flame", level: 1, cost: "free", target: "enemy", range: 7, roll: "save", save: "dex", damage: "1d8", strike: "sun",
      description: "A column of the sun's fire falls on a foe you can see. Armor doesn't help against it; only quick feet do."
    },
    "breath-of-the-ceiba": {
      name: "Breath of the Ceiba", level: 1, cost: "slot", target: "self", heal: "2d8", cure: true,
      description: "The ceiba's sheltering spirit breathes through you, closing wounds and burning out sickness."
    },
    "sacred-ground": {
      name: "Sacred Ground", level: 3, cost: "slot", target: "self",
      field: { kind: "sacred", center: "self", radius: 1, turns: 6, damage: "2d6", strike: "sun", deadOnly: true, ac: 2 },
      description: "You sprinkle copal ash around your feet. The dead can't bear to stand in it, and you stand firmer."
    },
    "day-sign-burst": {
      name: "Day-Sign Burst", level: 5, cost: "slot", target: "enemy", range: 7, area: { radius: 1 }, roll: "save", save: "dex", half: true,
      damage: "3d6", strike: "sun", on: { baneDead: true },
      description: "A day-sign glyph burns in the air over a foe and bursts."
    },
    "ceiba-shelter": {
      name: "Ceiba's Shelter", level: 7, cost: "slot", target: "self", effect: { kind: "regen", turns: 10, dice: "1d6" },
      description: "Roots of light wrap you. For a while every breath mends you a little."
    },
    "ceiba-sanctuary": {
      name: "Ceiba's Sanctuary", level: 9, cost: "slot", target: "self",
      field: { kind: "sanctuary", center: "self", radius: 2, turns: 3, save: "wis", stagger: true },
      description: "The world tree's shade falls around you, and creatures under it may lose their turn."
    },

    // ---------- Druid: thorns, storms, and the jaguar spirit ----------
    "thorn-call": {
      name: "Thorn Call", level: 1, cost: "free", target: "enemy", range: 7, roll: "attack", damage: "1d6", strike: "point",
      on: { rootedBonus: "1d6" },
      description: "A maguey thorn called up out of the ground flies at a creature. Things held fast are easy targets."
    },
    "entangling-roots": {
      name: "Entangling Roots", level: 1, cost: "slot", target: "enemy", range: 6,
      field: { kind: "roots", center: "target", radius: 1, turns: 4, save: "str", root: true },
      description: "Ceiba roots heave up through the floor and grab at every leg nearby."
    },
    "call-the-nahual": {
      name: "Call the Nahual", level: 3, cost: "slot", target: "self", summon: { kind: "nahual", turns: 15 },
      description: "Your animal spirit steps out of you: a jaguar of smoke and spots that fights at your side and draws blows meant for you."
    },
    "tlaloc-storm": {
      name: "Tlaloc's Storm", level: 5, cost: "slot", target: "enemy", range: 7,
      field: { kind: "storm", center: "target", radius: 1, turns: 3, damage: "2d6", strike: "crush", save: "dex", half: true, wetBonus: true },
      description: "A seed of the rain god's storm cracks open over a group. Thunder keeps falling where it broke; over water it spreads."
    },
    "healing-spring": {
      name: "Healing Spring", level: 7, cost: "slot", target: "self",
      field: { kind: "spring", center: "self", radius: 1, turns: 6, heal: "1d6" },
      description: "Water wells up around you. You and your nahual mend while you stand in it."
    },
    "chapulin-swarm": {
      name: "Chapulin Swarm", level: 9, cost: "slot", target: "enemy", range: 7,
      field: { kind: "swarm", center: "target", radius: 2, turns: 4, damage: "1d6", strike: "point", save: "con", half: true, slow: 2 },
      description: "You call the tomb's grasshoppers. A biting, buzzing cloud settles over a whole group and won't let them move freely."
    },

    // ---------- Fighter: tempo and control, one foe at a time ----------
    "second-wind": {
      name: "Second Wind", level: 1, cost: "cooldown", cooldown: 40, target: "self", heal: "1d10", healPerLevel: true, noFood: true,
      description: "You set your feet, breathe, and find you have more fight in you than you thought."
    },
    "shield-bash": {
      name: "Shield Bash", level: 3, cost: "cooldown", cooldown: 5, target: "adjacent", roll: "weapon",
      on: { push: 1, stun: true },
      description: "Shield, pommel, or shoulder: you knock a foe off its feet and out of its next move."
    },
    "action-surge": {
      name: "Action Surge", level: 5, cost: "cooldown", cooldown: 30, target: "self", effect: { kind: "surge" },
      description: "For a heartbeat you move faster than anything in the tomb. Your next action doesn't end your turn."
    },
    indomitable: {
      name: "Indomitable", level: 7, cost: "cooldown", cooldown: 30, target: "self", effect: { kind: "indomitable", turns: 3 }, cure: true,
      description: "You decide you are not going to fall here. For a few breaths, nothing in the tomb can make you."
    },
    "leg-sweep": {
      name: "Leg Sweep", level: 9, cost: "cooldown", cooldown: 6, target: "adjacent", roll: "weapon", on: { sweep: "str" },
      description: "A low, wide swing that can knock down everything beside you."
    },

    // ---------- Barbarian: hit everything, take everything ----------
    rage: {
      name: "Rage", level: 1, cost: "cooldown", cooldown: 25, target: "self", effect: { kind: "rage", turns: 10 },
      description: "The war-paint goes on in your head. You hit harder and shrug off pain."
    },
    "reckless-swing": {
      name: "Reckless Swing", level: 3, cost: "free", target: "adjacent", roll: "weapon", advantage: true, reckless: true,
      description: "You throw your whole body into it and leave yourself wide open."
    },
    "war-cry": {
      name: "War Cry", level: 5, cost: "cooldown", cooldown: 12, target: "around", radius: 3, roll: "save", save: "wis",
      on: { flee: 3 },
      description: "The cry of the flowery war. Creatures that hear it may break and run."
    },
    whirlwind: {
      name: "Whirlwind", level: 7, cost: "cooldown", cooldown: 6, target: "around", radius: 1, roll: "weapon",
      description: "You spin with your weapon out and strike everything beside you."
    },
    earthshaker: {
      name: "Earthshaker", level: 9, cost: "cooldown", cooldown: 8, target: "enemy", range: 4, roll: "weapon", leap: true, on: { quake: "str" },
      description: "You come down out of the air on one foe with everything you have, and the floor bucks under everything around it."
    },

    // ---------- Monk: footwork and the precise blow ----------
    deflect: {
      name: "Deflect", level: 1, cost: "cooldown", cooldown: 6, target: "self", effect: { kind: "deflect", turns: 2, ac: 4 },
      description: "Hands open, weight low: for a moment nothing lands clean."
    },
    "stunning-strike": {
      name: "Stunning Strike", level: 3, cost: "cooldown", cooldown: 5, target: "adjacent", roll: "weapon",
      on: { stunSave: "con" },
      description: "A blow to the one spot that stops breath."
    },
    "leaping-kick": {
      name: "Leaping Kick", level: 5, cost: "cooldown", cooldown: 4, target: "enemy", range: 4, roll: "weapon", leap: true,
      description: "You cross the floor in one bound and land with your heel."
    },
    "quivering-palm": {
      name: "Quivering Palm", level: 7, cost: "cooldown", cooldown: 30, target: "adjacent", roll: "weapon",
      on: { quiver: { turns: 3, damage: "6d6", save: "con" } },
      description: "A touch that sets the creature's heart ringing like a struck bell. Three breaths later it cracks."
    },
    "hundred-steps": {
      name: "Hundred Steps", level: 9, cost: "cooldown", cooldown: 8, target: "enemy", range: 3, roll: "weapon", leap: true, chain: 3,
      description: "You go from one foe to the next to the next, never touching the floor long enough to be hit."
    },

    // ---------- Paladin: the smiting oath ----------
    "sun-smite": {
      name: "Sun Smite", level: 2, cost: "slot", target: "adjacent", roll: "weapon", bonus: "2d8", strike: "sun", deadBonus: "1d8",
      description: "Your oath runs down your arm and out through your weapon as sun-fire."
    },
    "aura-of-dawn": {
      name: "Aura of Dawn", level: 5, cost: "slot", target: "self", effect: { kind: "dawn", turns: 10, ac: 1, damage: "1d8" },
      description: "You shine like the hour before sunrise. The dead beside you burn and you stand a little harder to hit."
    },
    "fifth-sun-shield": {
      name: "Shield of the Fifth Sun", level: 7, cost: "cooldown", cooldown: 30, target: "self", effect: { kind: "shield", turns: 3 },
      description: "You call on your oath to hold the sky up a little longer. For three turns, every wound is half as deep."
    },
    "judgment-of-dawn": {
      name: "Judgment of Dawn", level: 9, cost: "slot", target: "around", radius: 2, roll: "save", save: "wis", half: true,
      damage: "3d8", strike: "sun", on: { baneDead: true, fleeDead: 3 },
      description: "You raise your weapon and the sun comes up out of it. The dead it touches burn, and the ones still standing run."
    },

    // ---------- Ranger: the hunt, one quarry at a time ----------
    "hunters-mark": {
      name: "Hunter's Mark", level: 2, cost: "cooldown", cooldown: 8, target: "enemy", range: 9, roll: "auto",
      on: { mark: { turns: 30, damage: "1d6" } },
      description: "Mixcoatl's sign, drawn in the air with two fingers. You don't lose that one now."
    },
    "pinning-shot": {
      name: "Pinning Shot", level: 2, cost: "slot", target: "enemy", range: 9, roll: "attack", damage: "2d8", strike: "point",
      on: { root: 3 },
      description: "An arrow through the foot, into the floor."
    },
    "rain-of-thorns": {
      name: "Rain of Thorns", level: 5, cost: "slot", target: "enemy", range: 9, area: { radius: 1 }, roll: "save", save: "dex", half: true,
      damage: "3d6", strike: "edge", on: { markFull: true },
      description: "A volley into the air comes down as a rain of sharpened leaves. Your marked quarry can't dodge it."
    },
    "piercing-arrow": {
      name: "Piercing Arrow", level: 7, cost: "slot", target: "line", length: 9, range: 9, roll: "save", save: "dex", half: true,
      damage: "3d8", strike: "point", on: { markFull: true },
      description: "One heavy arrow, drawn to the ear. It goes through the first thing it hits and keeps going."
    },
    "called-shot": {
      name: "Called Shot", level: 9, cost: "cooldown", cooldown: 8, target: "shot", roll: "weapon", bonus: "2d8", markBonus: "3d8",
      description: "You wait, breathe out, and put the shot exactly where you meant it to go. Your quarry feels it most."
    },

    // ---------- Rogue: never where they expect ----------
    vanish: {
      name: "Vanish", level: 1, cost: "cooldown", cooldown: 10, target: "self", vanish: true,
      description: "A step, a shadow, a held breath. Anything not right beside you loses you."
    },
    caltrops: {
      name: "Caltrops", level: 3, cost: "cooldown", cooldown: 15, target: "enemy", range: 4,
      field: { kind: "caltrops", center: "target", radius: 1, turns: 8, damage: "1d4", strike: "point", save: "dex", root: true, onEnter: true },
      description: "A handful of obsidian caltrops, thrown wide. Anything that walks through them stops to pull them out."
    },
    hamstring: {
      name: "Hamstring", level: 5, cost: "cooldown", cooldown: 4, target: "adjacent", roll: "weapon", on: { slow: 3 },
      description: "A cut behind the knee. It can still fight; it just can't keep up."
    },
    "shadow-step": {
      name: "Shadow Step", level: 7, cost: "cooldown", cooldown: 12, target: "enemy", range: 6, roll: "weapon", leap: true, unseen: true,
      description: "You step into one shadow and out of the one behind your mark."
    },
    "obsidian-smoke": {
      name: "Obsidian Smoke", level: 9, cost: "cooldown", cooldown: 20, target: "around", radius: 3, roll: "save", save: "wis",
      on: { lose: true, distract: true },
      description: "You crush a ball of black smoke underfoot, and creatures near you lose sight of you."
    },

    // ---------- Sorcerer: raw power, the more targets the better ----------
    "jade-spark": {
      name: "Jade Spark", level: 1, cost: "free", target: "enemy", range: 7, roll: "attack", damage: "1d8", strike: "sun",
      description: "A bright shard of green spirit-light strikes a visible foe."
    },
    shatterglass: {
      name: "Shatterglass", level: 1, cost: "slot", target: "enemy", range: 6, area: { radius: 1 }, roll: "save", save: "dex", half: true,
      damage: "2d8", strike: "edge",
      description: "A shard of obsidian bursts in the air into a cloud of razors."
    },
    "jade-lightning": {
      name: "Jade Lightning", level: 3, cost: "slot", target: "enemy", range: 7, roll: "attack", damage: "3d6", strike: "sun",
      on: { arc: { count: 2, reach: 3 } },
      description: "Green fire leaps from your hand to a foe, and from it to the next, and the next."
    },
    "fire-serpent": {
      name: "Xiuhcoatl", level: 5, cost: "slot", target: "line", length: 7, range: 7, roll: "save", save: "dex", half: true,
      damage: "4d6", strike: "sun",
      description: "The fire serpent of the sun god uncoils from your hand in a straight line, through everything in its way."
    },
    "sun-eater-flare": {
      name: "Sun-Eater Flare", level: 7, cost: "slot", target: "around", radius: 2, roll: "save", save: "dex", half: true,
      damage: "5d6", strike: "night", backlash: "1d6",
      description: "You let go of everything you've been holding back. The dark flares out of you, and some of it bites you on the way."
    },
    "heart-of-fire": {
      name: "Heart of Fire", level: 9, cost: "cooldown", cooldown: 25, target: "self", effect: { kind: "surge" },
      description: "Xiuhtecuhtli's fire burns hot in your chest. You get the next spell off before anything can answer the last."
    },

    // ---------- Warlock: curses and the patron's hunger ----------
    "eldritch-bolt": {
      name: "Night Bolt", level: 1, cost: "free", target: "enemy", range: 8, roll: "attack", damage: "1d10", strike: "night",
      description: "A bolt of your patron's night-power hunts a creature you can see."
    },
    "patrons-curse": {
      name: "Patron's Curse", level: 1, cost: "slot", target: "enemy", range: 8, roll: "auto",
      on: { curse: { turns: 30, damage: "1d6", heal: "1d8" } },
      description: "You name a creature to your patron. It hurts more from everything you do, and when it dies, your patron shares."
    },
    "pact-rend": {
      name: "Pact Rend", level: 3, cost: "slot", target: "enemy", range: 7, roll: "attack", damage: "3d6", strike: "night",
      on: { drain: true },
      description: "Your patron reaches through you and tears at a foe from the far side of the night."
    },
    "maw-of-mictlan": {
      name: "Maw of Mictlan", level: 5, cost: "slot", target: "enemy", range: 7,
      field: { kind: "maw", center: "target", radius: 1, turns: 4, damage: "2d6", strike: "night", save: "con", half: true, drain: 1 },
      description: "The floor opens onto the land of the dead. It chews whatever stands over it, and feeds you a little of each bite."
    },
    "hungering-curse": {
      name: "Hungering Curse", level: 9, cost: "slot", target: "enemy", range: 8, area: { radius: 2 }, roll: "save", save: "wis",
      on: { curse: { turns: 20, damage: "1d6", heal: "1d8" } },
      description: "You name a whole pack to your patron at once. Every one that dies, your patron shares."
    },

    // ---------- Wizard: precision, glyphs, and the shape of the room ----------
    "arcane-dart": {
      name: "Arcane Dart", level: 1, cost: "free", target: "enemy", range: 7, roll: "auto", damage: "1d6", strike: "sun",
      description: "A glyph read aloud becomes a dart of light. It never misses."
    },
    "warding-glyph": {
      name: "Warding Glyph", level: 1, cost: "slot", target: "self",
      field: { kind: "glyph", center: "self", radius: 0, turns: 60, trigger: { radius: 1, damage: "3d6", strike: "crush", save: "dex", half: true } },
      description: "You paint a day-sign on the floor where you stand. The first creature to come near it sets it off."
    },
    "force-lance": {
      name: "Force Lance", level: 3, cost: "slot", target: "enemy", range: 7, roll: "attack", damage: "3d6", strike: "crush",
      on: { push: 2, slamDamage: "1d6" },
      description: "A spear of written power, black and red ink made solid, hurls a creature back into whatever is behind it."
    },
    "stilled-hour": {
      name: "Stilled Hour", level: 5, cost: "slot", target: "enemy", range: 7, area: { radius: 2 }, roll: "save", save: "wis",
      on: { slow: 4 },
      description: "You read the wrong day out of the tonalamatl, and time thickens around a group of foes."
    },
    "mirror-step": {
      name: "Mirror Step", level: 7, cost: "slot", target: "self", teleport: 6,
      description: "You step into a smoking mirror and out of another one, somewhere across the room."
    },
    "tonalamatl-recall": {
      name: "Tonalamatl Recall", level: 9, cost: "cooldown", cooldown: 999, target: "self", restoreSlots: 2,
      description: "You find the page in your book of days where you left yourself a little power, and take it back."
    }
  }
};
