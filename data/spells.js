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
      name: "Bardic Note", description: "A sharp, focused note that unsettles a foe.",
      damage: "1d6", range: 7, free: true
    },
    "discordant-chord": {
      name: "Discordant Chord", description: "A dissonant chord strikes a creature through the air.",
      damage: "2d6", range: 7
    },
    "soothing-verse": {
      name: "Soothing Verse", description: "A steadying melody restores your own strength.",
      healing: "1d8"
    },
    "sacred-flame": {
      name: "Sacred Flame", description: "A column of sacred light scorches a visible foe.",
      damage: "1d6", range: 7, free: true
    },
    "radiant-seal": {
      name: "Radiant Seal", description: "A burning sigil bursts against a distant enemy.",
      damage: "2d8", range: 7
    },
    "breath-of-the-ceiba": {
      name: "Breath of the Ceiba", description: "Call on the ceiba's sheltering spirit to restore your health.",
      healing: "1d8"
    },
    "thorn-call": {
      name: "Thorn Call", description: "A dart of living thorn flies toward a creature.",
      damage: "1d6", range: 7, free: true
    },
    "storm-seed": {
      name: "Storm Seed", description: "A seed of thunder bursts against a distant target.",
      damage: "2d6", range: 7
    },
    "holy-brand": {
      name: "Holy Brand", description: "A flash of consecrated light strikes a visible foe.",
      damage: "1d6", range: 7, free: true
    },
    "radiant-smite": {
      name: "Radiant Smite", description: "A focused lance of sacred force punishes a distant enemy.",
      damage: "2d8", range: 7
    },
    "hunter-arrow": {
      name: "Hunter's Arrow", description: "A guided force-arrow seeks out a visible quarry.",
      damage: "1d6", range: 7, free: true
    },
    "thorn-volley": {
      name: "Thorn Volley", description: "A tight volley of sharpened leaves cuts into a foe.",
      damage: "2d6", range: 7
    },
    "wind-shot": {
      name: "Wind Shot", description: "A compressed gust hurls itself at a distant target.",
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
      name: "Arcane Surge", description: "A concentrated burst of raw magic crashes into a foe.",
      damage: "3d6", range: 7
    },
    "eldritch-bolt": {
      name: "Eldritch Bolt", description: "A bolt of pact-bound force hunts a visible creature.",
      damage: "1d8", range: 7, free: true
    },
    "void-lance": {
      name: "Void Lance", description: "A lance of starless power pierces a distant target.",
      damage: "2d8", range: 7
    },
    "pact-rend": {
      name: "Pact Rend", description: "A violent tear of otherworldly force rips through a foe.",
      damage: "3d6", range: 7
    },
    "arcane-dart": {
      name: "Arcane Dart", description: "A precise dart of shaped magic strikes a visible enemy.",
      damage: "1d8", range: 7, free: true
    },
    "force-lance": {
      name: "Force Lance", description: "A disciplined lance of force batters a distant creature.",
      damage: "3d6", range: 7
    }
  }
};
