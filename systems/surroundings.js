"use strict";

// What's around you: the target frame and the row of creatures nearby.
//
// Borrowed from how RPGs show a fight: one *target frame* (portrait, name, mood, health,
// where it is) for the creature you're dealing with, and a row of small portraits for
// everything else you can see, like a party bar for the other side. Tap a portrait to make
// it your target; tap the frame (or the selected portrait again) for its full card. Tapping
// a creature on the map targets it too. Attacks go to your target when it's in reach.
//
// Everything here reads from one list, `nearbyCreatures()`, so the frame, the row, the map
// ring, the card that opens, and the attack all agree on which creature is which. (They used
// to pick separately, which is how the card could show one animal and open another.)

const NEARBY_RANGE = 7;
const NEARBY_CHIP_LIMIT = 6;

// The same rule the map uses to draw a creature: in line of sight within 7 squares, or
// revealed by a knack. Order: whatever is beside you and hostile, then beside you, then
// anything coming for you, then other threats, then the rest by distance.
function nearbyCreatures() {
  const run = state.run;
  if (!run || run.location !== "dungeon") return [];
  const player = run.player;
  const seen = run.enemies.filter((creature) => creature.alive && (
    (distanceInSquares(creature, player) <= NEARBY_RANGE && hasLineOfSight(player, creature)) ||
    (typeof knackRevealsCreature === "function" && knackRevealsCreature(creature))));
  const rank = (creature) => {
    const distance = distanceInSquares(creature, player);
    const threat = !creature.friendly && creatureIsThreat(creature);
    if (distance === 1 && threat) return 0;
    if (distance === 1) return 1;
    if (creature.alerted && threat) return 2;
    if (threat) return 3;
    return 4;
  };
  return seen
    .map((creature) => ({ creature, rank: rank(creature), distance: distanceInSquares(creature, player) }))
    .sort((a, b) => a.rank - b.rank || a.distance - b.distance || String(a.creature.id).localeCompare(String(b.creature.id)))
    .map((entry) => entry.creature);
}

// Your target. If you picked one, it stays your target while you can see it; otherwise the
// target follows the first creature in the list, so the frame always shows what matters most.
function currentTarget(list = nearbyCreatures()) {
  const picked = state.targetId != null ? list.find((creature) => creature.id === state.targetId) : null;
  if (picked) return picked;
  state.targetId = null;
  state.targetPinned = false;
  return list[0] || null;
}

function selectTarget(creature, { pinned = true } = {}) {
  if (!creature) return;
  state.targetId = creature.id;
  state.targetPinned = pinned;
}

// Your target first in a list of choices (used when an attack or ability asks you to pick).
function targetFirst(creatures) {
  const target = state.targetId != null ? creatures.find((creature) => creature.id === state.targetId) : null;
  return target ? [target, ...creatures.filter((creature) => creature !== target)] : creatures;
}

// The picked target if it's one of `options` (so attacks skip the "choose" dialog).
function pinnedTargetAmong(options) {
  if (!state.targetPinned || state.targetId == null) return null;
  return options.find((creature) => creature.id === state.targetId) || null;
}

const SURROUNDINGS_DIRECTIONS = { "0,-1": "N", "1,-1": "NE", "1,0": "E", "1,1": "SE", "0,1": "S", "-1,1": "SW", "-1,0": "W", "-1,-1": "NW" };
const SURROUNDINGS_ARROWS = { N: "↑", NE: "↗", E: "→", SE: "↘", S: "↓", SW: "↙", W: "←", NW: "↖" };

function directionToward(creature) {
  const player = state.run.player;
  const key = `${Math.sign(creature.x - player.x)},${Math.sign(creature.y - player.y)}`;
  return SURROUNDINGS_DIRECTIONS[key] || "";
}

// "hostile", "wary", or "calm": the color of a creature's ring and portrait border.
function creatureTone(creature) {
  if (creature.friendly) return "calm";
  if (!creatureIsThreat(creature)) return "calm";
  return creature.alerted ? "hostile" : "wary";
}

function creatureDisplayName(creature) {
  return creature.title ? `${creature.title} ${t(creature.name.slice(creature.title.length + 1))}` : t(creature.name);
}

function renderSurroundings() {
  const frame = elements.encounter;
  const strip = document.getElementById("nearby-strip");
  const list = nearbyCreatures();
  const target = currentTarget(list);
  frame.classList.toggle("hidden", !target);
  document.body.classList.toggle("has-target", Boolean(target));
  if (target) renderTargetFrame(frame, target);
  if (strip) renderNearbyStrip(strip, list, target);
}

function renderTargetFrame(frame, enemy) {
  const distance = distanceInSquares(enemy, state.run.player);
  const tone = creatureTone(enemy);
  frame.dataset.creatureId = String(enemy.id);
  frame.dataset.tone = tone;
  elements["enemy-name"].textContent = creatureDisplayName(enemy);
  const mood = creatureStateLabel(enemy);
  elements["enemy-rank"].textContent = enemy.greatGuardian ? t("GREAT GUARDIAN") : enemy.guardian ? t("GUARDIAN")
    : mood ? t(mood).toUpperCase() : enemy.elite ? t("ELITE") : t("HOSTILE");
  frame.classList.toggle("is-elite", Boolean(enemy.elite));
  frame.classList.toggle("is-guardian", Boolean(enemy.guardian));
  const studied = bestiaryRank(enemy.templateId);
  const inflicts = enemy.inflicts ? ` ${t("Can leave you {0}.", { 0: t(PROGRESSION.conditions[enemy.inflicts.condition].name).toLowerCase() })}` : "";
  const habitNote = creatureHabitNote(enemy);
  const habitText = !habitNote ? "" : knowsCreatureHabit(enemy) ? ` ${t(habitNote)}` : ` ${t("Its habits are still a mystery to you. Defeat one to learn them.")}`;
  elements["enemy-description"].textContent = `${t(enemy.description || "Keep your guard up.")}${inflicts}${habitText}${studied && studied.kills >= 5 ? ` ${studied.title}: ${studied.description}` : ""}`;
  renderStrikeChips(elements["enemy-strikes"], enemy);
  elements["enemy-health"].textContent = `${enemy.hp} / ${enemy.maxHp} HP`;
  elements["enemy-health-fill"].style.width = `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%`;
  const flanker = flankingCompanion(enemy);
  const direction = directionToward(enemy);
  const where = distance === 1 ? t("beside you") : t("{0} squares", { 0: distance });
  elements["enemy-distance"].textContent = `${SURROUNDINGS_ARROWS[direction] || ""} ${where}${flanker ? ` · ${t("{0} flanks", { 0: flanker.name })}` : ""}`.trim();
  const art = elements["enemy-portrait"];
  if (art.dataset.sprite !== enemySpriteId(enemy)) {
    art.dataset.sprite = enemySpriteId(enemy);
    art.replaceChildren(createSprite(enemySpriteId(enemy), "combatant-sprite"));
  }
  frame.setAttribute("aria-label", `${creatureDisplayName(enemy)}, ${elements["enemy-rank"].textContent.toLowerCase()}, ${enemy.hp} of ${enemy.maxHp} HP, ${where}. ${t("Show the full creature card")}`);
}

function renderNearbyStrip(strip, list, target) {
  // A lone creature is already in the frame; the row only appears when there's a choice.
  if (list.length < 2) {
    strip.hidden = true;
    strip.replaceChildren();
    return;
  }
  strip.hidden = false;
  const shown = list.slice(0, NEARBY_CHIP_LIMIT);
  const chips = shown.map((creature) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "nearby-chip";
    chip.dataset.creatureId = String(creature.id);
    chip.dataset.tone = creatureTone(creature);
    const selected = creature === target;
    chip.setAttribute("aria-pressed", String(selected));
    const distance = distanceInSquares(creature, state.run.player);
    chip.title = `${creatureDisplayName(creature)} · ${creature.hp}/${creature.maxHp} HP · ${distance === 1 ? t("beside you") : t("{0} squares", { 0: distance })}`;
    chip.setAttribute("aria-label", chip.title);
    const art = document.createElement("span");
    art.className = "nearby-chip-art";
    art.append(createSprite(enemySpriteId(creature), "nearby-chip-sprite"));
    const bar = document.createElement("span");
    bar.className = "nearby-chip-health";
    const fill = document.createElement("span");
    fill.style.width = `${Math.max(0, (creature.hp / creature.maxHp) * 100)}%`;
    bar.append(fill);
    const badge = document.createElement("span");
    badge.className = "nearby-chip-distance";
    badge.textContent = distance === 1 ? SURROUNDINGS_ARROWS[directionToward(creature)] || "1" : String(distance);
    chip.append(art, bar, badge);
    return chip;
  });
  if (list.length > shown.length) {
    const more = document.createElement("span");
    more.className = "nearby-more";
    more.textContent = `+${list.length - shown.length}`;
    chips.push(more);
  }
  strip.replaceChildren(...chips);
}

function openTargetCard() {
  const target = currentTarget();
  if (target) openCreatureCard(target.templateId, target);
}

function connectSurroundings() {
  const strip = document.getElementById("nearby-strip");
  strip?.addEventListener("click", (event) => {
    const chip = event.target.closest(".nearby-chip");
    if (!chip) return;
    const creature = state.run?.enemies.find((entry) => String(entry.id) === chip.dataset.creatureId && entry.alive);
    if (!creature) return;
    if (state.targetId === creature.id && state.targetPinned) {
      openCreatureCard(creature.templateId, creature);
      return;
    }
    selectTarget(creature);
    render();
  });
  const frame = elements.encounter;
  if (frame) {
    frame.tabIndex = 0;
    frame.setAttribute("role", "button");
    frame.title = t("Show the full creature card");
    frame.addEventListener("click", openTargetCard);
    frame.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); openTargetCard(); }
    });
  }
}

// The words on every Attack button: your target's name when the attack will go to it.
function attackButtonLabel(targets, { forecast = false } = {}) {
  const single = pinnedTargetAmong(targets) || (targets.length === 1 ? targets[0] : null);
  if (!single) return `Attack · ${targets.length} in reach`;
  const advantage = distanceInSquares(single, state.run.player) === 1 && flankingCompanion(single) ? " · Advantage" : "";
  return `Attack · ${single.name}${advantage}${forecast ? strikeForecastLabel(single, equippedStrike()) : ""}`;
}
