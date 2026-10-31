"use strict";

// Treasure magic: a few relics can be used in the tomb as well as sold. Each rite works
// once per delve (the relic is kept), except the mirror, which cracks when you step through.
// Callings in a relic's `affinity` use it with more force (a higher save DC or a bigger effect);
// `only` limits a rite to those callings.
const RELIC_RITES = {
  "obsidian-mirror": {
    verb: "Step through", only: ["wizard", "sorcerer", "warlock"], consumed: true,
    rite: "Rite: a wizard, sorcerer, or warlock can open the mirror's road and step out in Chiltomatlan with everything carried. The mirror cracks."
  },
  incensario: {
    verb: "Burn copal", affinity: ["cleric", "druid", "paladin"],
    rite: "Rite: burn copal to lull creatures within 5 squares to sleep (Wisdom save). Sleepers wake when hurt. Once per delve."
  },
  tecciztli: {
    verb: "Sound the conch", affinity: ["bard", "barbarian"],
    rite: "Rite: one blast and creatures within 6 squares falter and lose a turn (Wisdom save). Once per delve."
  },
  "jade-pectoral": {
    verb: "Hold to the heart", affinity: ["cleric", "druid", "monk"],
    rite: "Rite: the lord catching a star heals you for 2d6 plus your Wisdom modifier. Once per delve."
  },
  "crystal-skull": {
    verb: "Gaze into", affinity: ["wizard", "sorcerer", "warlock"],
    rite: "Rite: the skull shows the whole floor and any hidden traps nearby. Once per delve."
  },
  "jade-frog": {
    verb: "Call the rain", affinity: ["druid", "ranger"],
    rite: "Rite: the rain-frog fills gourds with 2 clean water (3 for druids and rangers). Once per delve."
  },
  "codex-fragment": {
    verb: "Read aloud", only: ["wizard", "bard", "cleric", "druid", "sorcerer", "warlock", "paladin", "ranger"],
    rite: "Rite: a spellcaster who reads the procession recovers one spell slot. Once per delve."
  },
  "rising-water": {
    verb: "Drink", consumed: true,
    rite: "Rite: drinking the rising water heals every wound and quenches all thirst. The gourd is emptied."
  }
};

function relicRiteState() {
  if (!state.run.relicRites || typeof state.run.relicRites !== "object") state.run.relicRites = {};
  return state.run.relicRites;
}

function relicCallingFits(list) {
  return !list || list.includes(state.run.character?.class);
}

// The DC creatures resist a relic with: 8 + proficiency + the better of your spellcasting
// or Wisdom modifier, +2 when your calling has an affinity for the relic.
function relicSaveDc(rite) {
  const scores = state.run.character.scores || {};
  const castAbility = spellcastingAbility(state.run.character.class);
  const best = Math.max(abilityModifier(scores.wis ?? 10), castAbility ? abilityModifier(scores[castAbility] ?? 10) : -5);
  const proficiency = 2 + Math.floor(Math.max(0, state.run.level - 1) / 4);
  return 8 + proficiency + best + (relicCallingFits(rite.affinity) && rite.affinity ? 2 : 0);
}

function enemyWisdomSave(enemy, dc) {
  const bonus = Math.floor((enemy.attackBonus || 0) / 2) + (enemy.elite ? 2 : 0) + (enemy.guardian ? 2 : 0);
  return randomInt(20) + bonus >= dc;
}

function relicTargets(reach) {
  return state.run.enemies.filter((enemy) => enemy.alive && distanceInSquares(enemy, state.run.player) <= reach &&
    hasLineOfSight(state.run.player, enemy));
}

function relicRiteBlocked(entry) {
  const rite = RELIC_RITES[entry.id];
  if (!rite) return null;
  const inDungeon = state.run.location === "dungeon";
  if (rite.only && !relicCallingFits(rite.only)) {
    return entry.id === "obsidian-mirror" ? "Only a wizard, sorcerer, or warlock can open the mirror's road." : "Only a spellcaster can wake this relic.";
  }
  if (entry.id !== "rising-water" && !inDungeon) return "Its power works only inside the tomb.";
  if (!rite.consumed && relicRiteState()[entry.id]) return "Its power is spent until your next delve.";
  if (entry.id === "incensario" && !relicTargets(5).length) return "No creature is close enough to breathe the smoke.";
  if (entry.id === "tecciztli" && !relicTargets(6).length) return "No creature is near enough to hear it.";
  if (entry.id === "jade-pectoral" && state.run.hp >= state.run.maxHp) return "You're unhurt.";
  if (entry.id === "codex-fragment" && state.run.spellSlots >= maxSpellSlots(state.run.character.class, state.run.level)) return "Your spell slots are already full.";
  if (entry.id === "rising-water" && state.run.hp >= state.run.maxHp && state.run.needs.water >= 100) return "You're unhurt and not thirsty.";
  return null;
}

// Returns true when the rite ran (the caller then ends the turn).
function useRelicRite(itemId) {
  const rite = RELIC_RITES[itemId];
  const blocked = relicRiteBlocked({ id: itemId });
  if (blocked) {
    showToast(blocked);
    return false;
  }
  if (itemId === "obsidian-mirror") {
    if (!removeInventoryItem(itemId)) return false;
    sfx("spell");
    addLog("You breathe on the black glass and it clears into a road of light. You step through and out beside the Ceiba Well; behind you the mirror cracks from edge to edge.");
    state.dashReady = false;
    state.disengageReady = false;
    state.run.dodging = false;
    state.run.location = "city";
    state.run.townPosition = { ...TOWN_SPAWN };
    secureExpeditionLoot();
    turnInTempleTreasure();
    clearConditions();
    claimReadyBounties();
    render();
    return "done";
  }
  if (rite.consumed) {
    if (!removeInventoryItem(itemId)) return false;
  } else {
    relicRiteState()[itemId] = true;
  }
  if (itemId === "incensario" || itemId === "tecciztli") {
    const sleep = itemId === "incensario";
    const dc = relicSaveDc(rite);
    const targets = relicTargets(sleep ? 5 : 6);
    const affected = [];
    for (const enemy of targets) {
      if (enemyWisdomSave(enemy, dc)) continue;
      affected.push(enemy.name);
      if (sleep) {
        enemy.asleep = 3;
        enemy.sleepHp = enemy.hp;
      } else {
        enemy.staggered = true;
      }
    }
    sfx(sleep ? "rest" : "spell");
    const opening = sleep
      ? "Copal smoke pours sweet and white from the incensario."
      : "The conch's blast rolls down the halls and comes back a moment too late.";
    addLog(affected.length
      ? `${opening} ${affected.join(", ")} ${sleep ? (affected.length === 1 ? "sinks into sleep" : "sink into sleep") : (affected.length === 1 ? "falters and loses a turn" : "falter and lose a turn")} (DC ${dc}).`
      : `${opening} Nothing gives way (DC ${dc}).`);
  } else if (itemId === "jade-pectoral") {
    const scores = state.run.character.scores || {};
    const roll = rollDice("2d6").total + abilityModifier(scores.wis ?? 10) + (relicCallingFits(rite.affinity) ? 2 : 0);
    const restored = Math.max(1, Math.min(roll, state.run.maxHp - state.run.hp));
    state.run.hp += restored;
    sfx("heal");
    showCombatFeedback("heal", `+${restored} HP`, { actor: "player", x: state.run.player.x, y: state.run.player.y });
    addLog(`You press the jade pectoral to your chest. The carved lord's falling star warms against your heart and you recover ${restored} hit point${restored === 1 ? "" : "s"}.`);
  } else if (itemId === "crystal-skull") {
    for (let index = 0; index < state.run.seen.length; index += 1) state.run.seen[index] = true;
    const traps = state.run.hazards.filter((hazard) => !hazard.triggered && !hazard.revealed && distanceInSquares(hazard, state.run.player) <= 8);
    for (const hazard of traps) hazard.revealed = true;
    sfx("search");
    addLog(`You look into the cold quartz and see the whole floor laid out inside it${traps.length ? `, and ${traps.length} hidden trap${traps.length === 1 ? "" : "s"} close by` : ""}.`);
  } else if (itemId === "jade-frog") {
    const gourds = relicCallingFits(rite.affinity) ? 3 : 2;
    const added = addInventoryItemsAsPossible("clean-water", gourds);
    sfx("water");
    addLog(added
      ? `You wet the frog's back and sing the rain song. Cool rain falls in a small circle, enough to fill ${added} gourd${added === 1 ? "" : "s"}.`
      : "Rain falls in a small circle around you, but you have no room to carry any.");
  } else if (itemId === "codex-fragment") {
    state.run.spellSlots = Math.min(maxSpellSlots(state.run.character.class, state.run.level), state.run.spellSlots + 1);
    sfx("spell");
    addLog("You read the procession of gods aloud. The painted figures seem to walk a step, and power you had spent comes back to you: one spell slot recovered.");
  } else if (itemId === "rising-water") {
    state.run.hp = state.run.maxHp;
    state.run.needs.water = 100;
    state.run.needs.waterZeroHours = 0;
    clearConditions();
    sfx("drink");
    showCombatFeedback("heal", "Full HP", { actor: "player", x: state.run.player.x, y: state.run.player.y });
    addLog("You drink the water that runs uphill. It tastes of rain and new leaves. Every wound closes, and for a moment you feel very young.");
  }
  return true;
}

// Sleeping creatures skip their turns; any damage wakes them.
function enemySleeps(enemy) {
  if (!enemy.asleep) return false;
  if (enemy.hp < (enemy.sleepHp ?? enemy.hp)) {
    enemy.asleep = 0;
    addLog(`${enemy.name} wakes with a snarl.`);
    return false;
  }
  enemy.asleep -= 1;
  return true;
}
