"use strict";

window.CryptsSpells = {
  byClass: {
    bard: ["bardic-note", "discordant-chord", "soothing-verse"],
    cleric: ["sacred-flame", "radiant-seal", "breath-of-the-ceiba"],
    druid: ["thorn-call", "storm-seed", "breath-of-the-ceiba"],
    paladin: ["holy-brand", "radiant-smite", "breath-of-the-ceiba"],
    ranger: ["hunter-arrow", "thorn-volley", "wind-shot"],
    sorcerer: ["jade-spark", "obsidian-shard", "arcane-surge"],
    warlock: ["eldritch-bolt", "void-lance", "pact-rend"],
    wizard: ["arcane-dart", "obsidian-shard", "force-lance"]
  },
  catalog: {
    "bardic-note": {
      name: "Bardic Note", description: "One note from a clay flute, sharp enough to make a foe flinch.",
      damage: "1d6", range: 7, free: true
    },
    "discordant-chord": {
      name: "Discordant Chord", description: "A teponaztli drum's wrong note, struck so hard the air itself hits back.",
      damage: "2d6", range: 7
    },
    "soothing-verse": {
      name: "Soothing Verse", description: "A flower-song for the wounded; your breath steadies and your cuts close.",
      healing: "1d8"
    },
    "sacred-flame": {
      name: "Copal Flame", description: "A column of the sun's fire falls on a foe you can see.",
      damage: "1d6", range: 7, free: true
    },
    "radiant-seal": {
      name: "Radiant Seal", description: "A day-sign glyph burns in the air and bursts against a distant enemy.",
      damage: "2d8", range: 7
    },
    "breath-of-the-ceiba": {
      name: "Breath of the Ceiba", description: "Call on the ceiba's sheltering spirit to restore your health.",
      healing: "1d8"
    },
    "thorn-call": {
      name: "Thorn Call", description: "A maguey thorn, called up out of the ground, flies at a creature.",
      damage: "1d6", range: 7, free: true
    },
    "storm-seed": {
      name: "Storm Seed", description: "A seed of Tlaloc's rain cracks open in thunder over a distant target.",
      damage: "2d6", range: 7
    },
    "holy-brand": {
      name: "Holy Brand", description: "Your oath flares as white sun-fire across a visible foe.",
      damage: "1d6", range: 7, free: true
    },
    "radiant-smite": {
      name: "Radiant Smite", description: "A god's judgment, thrown like a spear of light at a distant enemy.",
      damage: "2d8", range: 7
    },
    "hunter-arrow": {
      name: "Hunter's Arrow", description: "An arrow blessed by Mixcoatl, the cloud-serpent hunter, finds a quarry you can see.",
      damage: "1d6", range: 7, free: true
    },
    "thorn-volley": {
      name: "Thorn Volley", description: "A tight volley of sharpened leaves cuts into a foe.",
      damage: "2d6", range: 7
    },
    "wind-shot": {
      name: "Wind Shot", description: "A breath of Ehecatl, the wind, hurls itself at a distant target.",
      damage: "2d8", range: 7
    },
    "jade-spark": {
      name: "Jade Spark", description: "A bright shard of green spirit-light strikes a visible foe.",
      damage: "1d8", range: 7, free: true
    },
    "obsidian-shard": {
      name: "Obsidian Shard", description: "A keen fragment of shadowed glass flies toward a distant enemy.",
      damage: "2d6", range: 7
    },
    "arcane-surge": {
      name: "Arcane Surge", description: "The power you were born with breaks loose in a green-white flare.",
      damage: "3d6", range: 7
    },
    "eldritch-bolt": {
      name: "Night Bolt", description: "A bolt of your patron's night-power hunts a creature you can see.",
      damage: "1d8", range: 7, free: true
    },
    "void-lance": {
      name: "Void Lance", description: "A lance of starless power pierces a distant target.",
      damage: "2d8", range: 7
    },
    "pact-rend": {
      name: "Pact Rend", description: "Your patron reaches through you and tears at a foe from the far side of the night.",
      damage: "3d6", range: 7
    },
    "arcane-dart": {
      name: "Arcane Dart", description: "A glyph read aloud becomes a dart of light that strikes a visible enemy.",
      damage: "1d8", range: 7, free: true
    },
    "force-lance": {
      name: "Force Lance", description: "A spear of written power, black and red ink made solid, batters a distant creature.",
      damage: "3d6", range: 7
    }
  }
};
