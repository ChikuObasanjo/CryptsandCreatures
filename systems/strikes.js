"use strict";

// Weak spots. Every attack lands as one of five kinds of strike: an edge (obsidian and
// steel blades), a crushing blow (clubs, staves, sling stones), a point (spears, arrows,
// darts), sun-fire (the priests' and oath-sworn's light and copal flame), or night-power
// (a patron's gifts). Most creatures have one strike they are weak to (it lands for half
// again as much) and a few armored or uncanny ones shrug part of one off.
//
// The player learns them by trying: the first time a strike finds a weak spot or glances
// off, the journal records it, and from then on the encounter card, the look panel, and
// the attack and spell buttons say so before you commit. Studying a creature (three
// defeated) reveals both without needing to stumble on them.

const STRIKE_KINDS = {
  edge: { name: "edge", plural: "edged blows" },
  crush: { name: "crushing", plural: "crushing blows" },
  point: { name: "point", plural: "piercing strikes" },
  sun: { name: "sun-fire", plural: "sun-fire" },
  night: { name: "night-power", plural: "night-power" }
};
const STRIKE_WEAK_MULTIPLIER = 1.5;
const STRIKE_RESIST_MULTIPLIER = 0.75;

const CREATURE_STRIKES = {
  "maztican-cave-locust": { weak: "edge" },
  mictlaneca: { weak: "crush", resist: "point" },
  "tomb-bat": { weak: "sun" },
  duende: { weak: "sun" },
  "jungle-jaguar": { weak: "point" },
  cihuateotl: { weak: "sun" },
  quinametli: { weak: "point", resist: "crush" },
  caxtiltecatl: { weak: "crush", resist: "edge" },
  "feathered-serpent": { weak: "night", resist: "sun" },
  tzitzimitl: { weak: "crush", resist: "sun" },
  axolocatl: { weak: "sun" },
  yohualtepoztli: { weak: "sun" },
  "cenote-stalker": { weak: "edge" },
  "xolo-hound": { weak: "edge" },
  colotl: { weak: "crush", resist: "edge" },
  tlacatecolotl: { weak: "sun", resist: "night" },
  "huay-chivo": { weak: "point" },
  itzpapalotl: { weak: "crush", resist: "edge" },
  cipactli: { weak: "point", resist: "edge" },
  camazotz: { weak: "sun", resist: "night" },
  mazacoatl: { weak: "edge", resist: "crush" },
  maquizcoatl: { weak: "edge" },
  chaneque: { weak: "sun", resist: "edge" },
  alux: { weak: "crush", resist: "point" }
};

// Why, in a line, for the journal and the creature card.
const CREATURE_STRIKE_REASONS = {
  mictlaneca: "Old bones shatter under a club; a spear slips between the ribs.",
  caxtiltecatl: "Blades skate off foreign iron, but a club still rings the man inside.",
  colotl: "The shell turns a blade and cracks under a blow.",
  itzpapalotl: "Obsidian is keen and brittle: blades glance off, clubs break it.",
  cipactli: "The hide turns blades, but the soft mouths take a spear.",
  mazacoatl: "A blade opens the long body; a club just bounces off the coils.",
  chaneque: "It slips between blades like a child through a fence; the sun finds it anyway.",
  alux: "It's clay: a club breaks it, a spear just makes a hole.",
  quinametli: "Too big to club down, but the old giants bleed from a spear.",
  tzitzimitl: "She ate the sun once and fears no light, but her bones are bones.",
  "feathered-serpent": "A creature of the day: light feeds it, night wounds it."
};

const WEAPON_STRIKE_BY_ICON = {
  sword: "edge", dagger: "edge", axe: "edge", macuahuitl: "edge",
  mace: "crush", hammer: "crush", staff: "crush", "studded-club": "crush", sling: "crush",
  spear: "point", bow: "point", blowgun: "point"
};
const WEAPON_STRIKE_OVERRIDES = { shortsword: "crush", "stingray-spine": "point" };

function weaponStrike(weaponId) {
  const weapon = (typeof WEAPONS !== "undefined" && WEAPONS[weaponId]) || null;
  if (!weapon) return "crush";
  const base = weapon.baseId || weaponId;
  if (WEAPON_STRIKE_OVERRIDES[base]) return WEAPON_STRIKE_OVERRIDES[base];
  const icon = (WEAPONS[base] || weapon).icon || "sword";
  return WEAPON_STRIKE_BY_ICON[icon] || "edge";
}

function equippedStrike() {
  return weaponStrike(state.run?.character?.equipment?.weapon);
}

function spellStrikeKind(spellId) {
  return window.CryptsSpells.catalog[spellId]?.strike || "";
}

function creatureStrikes(enemy) {
  return CREATURE_STRIKES[enemy?.templateId] || {};
}

function strikeLoreBook() {
  const book = progress();
  book.strikeLore ||= {};
  return book.strikeLore;
}

// What the player knows: { weak: bool, resist: bool }.
function knownStrikes(enemy) {
  const templateId = enemy?.templateId || enemy?.id;
  const lore = state.run?.progress?.strikeLore?.[templateId] || {};
  const studied = (state.run?.progress?.bestiary?.[templateId] || 0) >= 3;
  const strikes = CREATURE_STRIKES[templateId] || {};
  return { weak: Boolean(strikes.weak && (lore.weak || studied)), resist: Boolean(strikes.resist && (lore.resist || studied)) };
}

// How a kind of strike will land, as far as the player knows: "weak", "resist", or "".
function strikeForecast(enemy, kind) {
  if (!kind || !enemy) return "";
  const strikes = creatureStrikes(enemy);
  const known = knownStrikes(enemy);
  if (known.weak && strikes.weak === kind) return "weak";
  if (known.resist && strikes.resist === kind) return "resist";
  return "";
}

// A short phrase for buttons: " · weak spot" or " · glances off".
function strikeForecastLabel(enemy, kind) {
  const forecast = strikeForecast(enemy, kind);
  return forecast === "weak" ? ` · ${t("weak spot")}` : forecast === "resist" ? ` · ${t("glances off")}` : "";
}

// A sentence for the creature card and the look panel.
function strikeKnowledgeText(enemy) {
  const strikes = creatureStrikes(enemy);
  if (!strikes.weak && !strikes.resist) return "";
  const known = knownStrikes(enemy);
  const parts = [];
  if (known.weak) parts.push(t("Weak to {0}.").replace("{0}", t(STRIKE_KINDS[strikes.weak].plural)));
  if (known.resist) parts.push(t("{0} glance off it.").replace("{0}", capitalizeFirst(t(STRIKE_KINDS[strikes.resist].plural))));
  if (!known.weak) parts.push(t("Its weak spot is still unknown: try another kind of strike."));
  const reason = (known.weak || known.resist) ? CREATURE_STRIKE_REASONS[enemy.templateId] : "";
  return [...parts, reason ? t(reason) : ""].filter(Boolean).join(" ");
}

function capitalizeFirst(text) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

// Applies a creature's weak spot or toughness to a hit and returns the new damage. Call
// logStrike() with the result after logging the hit itself.
function applyStrike(enemy, kind, damage) {
  const strikes = creatureStrikes(enemy);
  if (!kind || damage <= 0) return { damage, outcome: "" };
  const name = enemy.title ? enemy.name.slice(enemy.title.length + 1) : enemy.name;
  for (const outcome of ["weak", "resist"]) {
    if (strikes[outcome] !== kind) continue;
    const lore = strikeLoreBook();
    const first = !lore[enemy.templateId]?.[outcome];
    lore[enemy.templateId] = { ...(lore[enemy.templateId] || {}), [outcome]: true };
    const multiplier = outcome === "weak" ? STRIKE_WEAK_MULTIPLIER : STRIKE_RESIST_MULTIPLIER;
    const changed = outcome === "weak" ? Math.ceil(damage * multiplier) : Math.max(1, Math.floor(damage * multiplier));
    return { damage: changed, outcome, kind, first, name };
  }
  return { damage, outcome: "" };
}

function logStrike(struck) {
  if (!struck?.outcome) return;
  const plural = STRIKE_KINDS[struck.kind].plural;
  if (struck.outcome === "weak") {
    addLog(`A weak spot! ${capitalizeFirst(plural)} land half again as hard.`);
    if (struck.first) addLog(`Journal: ${struck.name} is weak to ${plural}.`);
  } else {
    addLog(`${capitalizeFirst(plural)} glance off: only three quarters of the damage lands.`);
    if (struck.first) addLog(`Journal: ${plural} glance off ${struck.name}.`);
  }
}
