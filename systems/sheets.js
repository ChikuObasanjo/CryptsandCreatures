"use strict";

// Character sheet, grouped field guide, and creature cards.
// - The Character tab is one scrolling sheet: calling + XP, vitals, six attribute
//   tiles (tap for what each affects), saving throws, and every skill bonus.
// - The Abilities tab groups actions into Combat / Spells / Exploring / Items with
//   their PC shortcut keys.
// - Tapping the enemy card in the dungeon, or a creature in the journal bestiary,
//   opens a full creature card with stats, lore, and your bestiary progress.

const ATTRIBUTE_EFFECTS = {
  str: "Most melee attacks and damage; carrying capacity (Strength × 15 lb).",
  dex: "Ranged attacks and finesse weapons; armor class when your armor allows it.",
  con: "Your hit-point total as you gain levels.",
  int: "Arcana, History, Investigation, Nature, and Religion checks; Wizard spell attacks.",
  wis: "Perception, Survival, Medicine, and other Wisdom checks; Cleric, Druid, and Ranger spell attacks.",
  cha: "Persuasion, Deception, Performance, and other Charisma checks; Bard, Paladin, Sorcerer, and Warlock spell attacks."
};

const signed = (value) => `${value >= 0 ? "+" : "−"}${Math.abs(value)}`;

function sheetElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function sheetSection(title, ...children) {
  const section = sheetElement("section", "sheet-section");
  section.append(sheetElement("h4", "sheet-section-title", t(title)), ...children);
  return section;
}

// ---------- Character sheet ----------

function renderCharacterSheet(character, stats, trainingText, gearText) {
  const root = document.getElementById("character-sheet");
  if (!root) return;
  const classInfo = CLASSES[character.class];
  const background = BACKGROUNDS[character.background];
  const level = state.run.level;
  const mods = typeof heroStatModifiers === "function" ? heroStatModifiers() : { attack: 0, damage: 0, ac: 0 };

  // Calling + XP
  const calling = sheetElement("section", "sheet-calling");
  const title = sheetElement("div", "sheet-calling-title");
  title.append(
    sheetElement("strong", "", t("Level {level} {calling}", { level, calling: t(classInfo.name) })),
    sheetElement("span", "sheet-tag", t(background?.name || "Adventurer"))
  );
  const xpNow = state.run.xp;
  const floor = XP_THRESHOLDS[level] || 0;
  const next = level < MAX_LEVEL ? XP_THRESHOLDS[level + 1] : null;
  const xpBar = sheetElement("div", "sheet-xp");
  const track = sheetElement("div", "sheet-xp-track");
  const fill = sheetElement("span");
  fill.style.width = `${next === null ? 100 : Math.max(0, Math.min(100, ((xpNow - floor) / Math.max(1, next - floor)) * 100))}%`;
  track.append(fill);
  xpBar.append(track, sheetElement("small", "", next === null
    ? t("{xp} XP · maximum level", { xp: xpNow })
    : t("{xp} / {next} XP · {left} to level {level}", { xp: xpNow, next, left: next - xpNow, level: level + 1 })));
  calling.append(title, sheetElement("p", "sheet-calling-copy", t(classInfo.description)), xpBar);

  // Vitals
  const vitals = sheetElement("div", "sheet-vitals");
  const vital = (label, value, note) => {
    const cell = sheetElement("div", "sheet-vital");
    cell.append(sheetElement("small", "", t(label)), sheetElement("strong", "", String(value)));
    if (note) cell.append(sheetElement("span", "", note));
    vitals.append(cell);
  };
  vital("Hit points", `${state.run.hp}/${state.run.maxHp}`);
  vital("Armor", stats.ac + mods.ac, "AC");
  vital("Attack", signed(stats.attackBonus + mods.attack), t(stats.weapon?.name || ""));
  const damageBonus = stats.damageBonus + mods.damage;
  vital("Damage", `${stats.damageDice}${damageBonus ? signed(damageBonus) : ""}`,
    typeof equippedStrike === "function" ? t(capitalizeFirst(STRIKE_KINDS[equippedStrike()].name)) : "");
  vital("Pack limit", `${getCarryCapacity(character)} lb`);
  if (hasSpellcasting(character.class, level)) {
    vital("Spell slots", `${Math.min(state.run.spellSlots, maxSpellSlots(character.class, level))}/${maxSpellSlots(character.class, level)}`);
  }

  // Attributes
  const attributes = sheetElement("div", "sheet-attributes");
  const detail = sheetElement("p", "sheet-attribute-detail");
  const selected = state.sheetAttribute || null;
  for (const [key, name] of ABILITIES) {
    const tile = sheetElement("button", `sheet-attribute${selected === key ? " is-selected" : ""}`);
    tile.type = "button";
    tile.dataset.sheetAttribute = key;
    const save = savingThrowBonus(key);
    const proficient = classInfo.saves.includes(key);
    tile.append(
      sheetElement("small", "", t(name)),
      sheetElement("strong", "", signed(stats.modifiers[key])),
      sheetElement("span", "sheet-attribute-score", String(character.scores[key])),
      sheetElement("span", `sheet-save${proficient ? " is-proficient" : ""}`, `${proficient ? "◆" : "◇"} ${t("Save {bonus}", { bonus: signed(save) })}`)
    );
    tile.setAttribute("aria-pressed", String(selected === key));
    attributes.append(tile);
  }
  if (selected) {
    const name = ABILITIES.find(([key]) => key === selected)?.[1] || selected;
    detail.textContent = `${t(name)}: ${t(ATTRIBUTE_EFFECTS[selected])}`;
  } else {
    detail.textContent = t("Tap an attribute to see what it affects. ◆ marks a trained saving throw.");
    detail.classList.add("muted");
  }

  // Skills
  const backgroundSkills = background?.skillIds || [];
  const trained = new Set([...backgroundSkills, ...(character.classSkills || [])]);
  const skills = sheetElement("div", "sheet-skills");
  const skillIds = Object.keys(SKILLS).sort((a, b) => Number(trained.has(b)) - Number(trained.has(a)) || t(SKILLS[a]).localeCompare(t(SKILLS[b])));
  for (const id of skillIds) {
    const row = sheetElement("div", `sheet-skill${trained.has(id) ? " is-trained" : ""}`);
    const abbr = (ABILITIES.find(([key]) => key === SKILL_ABILITIES[id])?.[0] || "").toUpperCase();
    row.append(
      sheetElement("span", "sheet-skill-dot", trained.has(id) ? "●" : "○"),
      sheetElement("span", "sheet-skill-name", t(SKILLS[id])),
      sheetElement("small", "sheet-skill-ability", t(abbr)),
      sheetElement("strong", "sheet-skill-bonus", signed(skillBonus(id)))
    );
    skills.append(row);
  }

  const gear = sheetElement("p", "sheet-gear", gearText);
  const notes = sheetElement("details", "sheet-notes");
  notes.append(sheetElement("summary", "", t("Training and rules notes")), sheetElement("p", "", trainingText));

  root.replaceChildren(
    calling,
    vitals,
    sheetSection("Attributes", attributes, detail),
    sheetSection("Skills", skills),
    sheetSection("Weapon and armor", gear),
    notes
  );
}

function connectCharacterSheet() {
  const root = document.getElementById("character-sheet");
  root?.addEventListener("click", (event) => {
    const tile = event.target.closest("[data-sheet-attribute]");
    if (!tile) return;
    state.sheetAttribute = state.sheetAttribute === tile.dataset.sheetAttribute ? null : tile.dataset.sheetAttribute;
    renderCharacterGuide(state.run.character, currentCharacterStats());
  });
}

// ---------- Field guide ----------

const ABILITY_GROUPS = [
  ["combat", "Combat"],
  ["spells", "Spells and techniques"],
  ["explore", "Exploring"],
  ["items", "Items and tools"]
];
const ABILITY_META = {
  Attack: ["combat", "R", "weapon"],
  "Weak spots": ["combat", "", "weapon"],
  Dodge: ["combat", "V", "armor"],
  Guard: ["combat", "", "armor"],
  Run: ["combat", "T", "tool"],
  Disengage: ["combat", "Y", "armor"],
  Interact: ["explore", "Space / E", "tool"],
  Search: ["explore", "F", "tool"],
  "The living tomb": ["explore", "Space / E", "chilis"],
  "Disarm trap": ["explore", "Shift+F", "tool"],
  Forage: ["explore", "G", "chilis"],
  Camp: ["explore", "B", "kit"],
  "Healing potion": ["items", "H", "potion"],
  "Drink carried water": ["items", "U", "water"],
  "Eat carried food": ["items", "M", "ration"],
  "Light a torch": ["items", "", "supply"],
  "Use the pry bar": ["items", "", "tool"],
  "Use the maguey cord": ["items", "", "supply"],
  "Use a healer's bundle": ["items", "", "kit"],
  "Class spellcasting": ["spells", "", "keepsake"]
};

function renderGroupedAbilities(abilities, spellRange) {
  const list = elements["ability-guide-list"];
  const groups = new Map(ABILITY_GROUPS.map(([id]) => [id, []]));
  let spellIndex = 0;
  abilities.forEach((ability, index) => {
    const isSpell = index >= spellRange[0] && index < spellRange[1];
    const meta = ability.group ? [ability.group, ability.key || "", ability.icon || "keepsake"]
      : ABILITY_META[ability.name] || (ability.knack ? ["combat", KNACKS[state.run.character.class]?.action ? "Q" : "", "keepsake"] : null) || (isSpell ? ["spells", String(++spellIndex), ability.healing ? "potion" : "keepsake"] : ["items", "", "supply"]);
    groups.get(meta[0]).push({ ...ability, key: meta[1], icon: meta[2] });
  });
  const character = state.run.character;
  const sections = [];
  for (const [id, label] of ABILITY_GROUPS) {
    const entries = groups.get(id);
    if (!entries.length) continue;
    const section = sheetElement("section", "guide-group");
    const heading = sheetElement("div", "guide-group-heading");
    heading.append(sheetElement("h4", "sheet-section-title", t(label)));
    if (id === "spells" && maxSpellSlots(character.class, state.run.level) > 0) {
      const max = maxSpellSlots(character.class, state.run.level);
      const left = Math.min(state.run.spellSlots, max);
      const pips = sheetElement("span", "guide-slot-pips");
      pips.title = t("{left} / {max} spell slots", { left, max });
      for (let i = 0; i < max; i += 1) pips.append(sheetElement("i", i < left ? "is-full" : ""));
      heading.append(pips);
    }
    const grid = sheetElement("div", "guide-grid");
    for (const ability of entries) {
      const card = sheetElement("article", `ability-guide-card guide-card guide-state-${ability.state}`);
      const top = sheetElement("div", "guide-card-top");
      const icon = sheetElement("span", "guide-card-icon");
      const image = document.createElement("img");
      image.src = `./resources/items/${ability.icon}.png?v=${SPRITE_RESOURCE_VERSION}`;
      image.alt = "";
      image.draggable = false;
      icon.append(image);
      const copy = sheetElement("div", "guide-card-copy");
      const nameLine = sheetElement("div", "guide-card-name");
      nameLine.append(sheetElement("h4", "", ability.name));
      if (ability.key) nameLine.append(sheetElement("kbd", "guide-key", ability.key));
      copy.append(nameLine, sheetElement("span", `ability-guide-status ability-state-${ability.state}`, ability.status));
      top.append(icon, copy);
      card.append(top, sheetElement("p", "", ability.description));
      grid.append(card);
    }
    section.append(heading, grid);
    sections.push(section);
  }
  list.replaceChildren(...sections);
  const pager = document.querySelector('[data-list-pager="abilities"]');
  if (pager) pager.hidden = true;
}

// ---------- Creature cards ----------

function creatureTemplate(id) {
  return state.pack?.enemies?.find((enemy) => enemy.id === id) || null;
}

function ensureCreatureDialog() {
  let dialog = document.getElementById("creature-dialog");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "creature-dialog";
  dialog.className = "story-dialog creature-dialog";
  dialog.setAttribute("aria-labelledby", "creature-name");
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog || event.target.closest("[data-creature-close]")) dialog.close();
  });
  document.body.append(dialog);
  return dialog;
}

// enemy: a live dungeon enemy (optional). templateId: bestiary id.
function openCreatureCard(templateId, enemy = null) {
  const template = creatureTemplate(templateId) || enemy;
  if (!template) return;
  const source = enemy || template;
  const kills = state.run?.progress?.bestiary?.[templateId] || 0;
  const dialog = ensureCreatureDialog();
  const panel = sheetElement("article", "story-panel creature-card");
  if (enemy?.elite) panel.classList.add("is-elite");
  if (enemy?.guardian) panel.classList.add("is-guardian");

  const close = sheetElement("button", "quiet-button creature-close", "×");
  close.type = "button";
  close.dataset.creatureClose = "1";
  close.setAttribute("aria-label", t("Close"));

  const art = sheetElement("div", "creature-art");
  art.append(createSprite(enemy ? enemySpriteId(enemy) : (template.sprite || enemySpriteForId(templateId)), "creature-sprite"));

  const head = sheetElement("header", "creature-head");
  const displayName = enemy?.title ? `${enemy.title} ${t(enemy.name.slice(enemy.title.length + 1))}` : t(source.name);
  const name = sheetElement("h2", "", displayName);
  name.id = "creature-name";
  const tags = sheetElement("div", "creature-tags");
  const rank = enemy?.greatGuardian ? "Great guardian" : enemy?.guardian ? "Guardian" : enemy?.elite ? "Elite" : enemy ? "Hostile" : "Bestiary";
  tags.append(sheetElement("span", `creature-tag${enemy ? " is-hostile" : ""}`, t(rank)));
  if (template.edible) tags.append(sheetElement("span", "creature-tag is-edible", t("Edible")));
  const studied = bestiaryRank(templateId);
  if (studied) tags.append(sheetElement("span", "creature-tag is-known", t(studied.title)));
  head.append(sheetElement("p", "eyebrow", t("Creature")), name, tags);

  const body = sheetElement("div", "creature-body");
  if (enemy) {
    const health = sheetElement("div", "creature-health");
    const track = sheetElement("div", "health-track");
    const fill = sheetElement("span");
    fill.style.width = `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%`;
    track.append(fill);
    const distance = distanceInSquares(enemy, state.run.player);
    health.append(
      sheetElement("div", "creature-health-label", `${enemy.hp} / ${enemy.maxHp} HP · ${distance === 1 ? t("1 square away") : t("{count} squares away", { count: distance })}`),
      track
    );
    body.append(health);
  }
  const statBlock = sheetElement("div", "creature-stats");
  const stat = (label, value) => {
    const cell = sheetElement("div");
    cell.append(sheetElement("small", "", t(label)), sheetElement("strong", "", String(value)));
    statBlock.append(cell);
  };
  stat("Hit points", source.maxHp ?? source.hp);
  stat("Armor", source.ac);
  stat("Attack", signed(source.attackBonus ?? 0));
  stat("Damage", source.damage);
  stat("Initiative", signed(source.initiativeBonus ?? 0));
  stat("XP", source.xp ?? template.xp ?? "—");
  body.append(statBlock);

  body.append(sheetElement("p", "creature-description", t(source.description || template.description || "Keep your guard up.")));
  if (template.gear) body.append(sheetElement("p", "creature-note", t("Gear: {gear}", { gear: t(template.gear) })));
  const inflicts = source.inflicts || PROGRESSION.creatureConditions?.[templateId];
  if (inflicts) {
    const condition = PROGRESSION.conditions[inflicts.condition];
    if (condition) {
      body.append(sheetElement("p", "creature-note is-danger",
        t("Can inflict {condition} ({chance}%): {effect}", { condition: t(condition.name), chance: inflicts.chance, effect: t(condition.description) })));
    }
  }

  // Weak spots: what's known, and how the weapon in hand will land.
  if (typeof creatureStrikes === "function") {
    const subject = { templateId, title: enemy?.title, name: source.name };
    const knowledge = strikeKnowledgeText(subject);
    if (knowledge) {
      const note = sheetElement("p", "creature-note creature-strikes", knowledge);
      const weaponId = state.run?.character?.equipment?.weapon;
      if (weaponId && WEAPONS[weaponId]) {
        const kind = weaponStrike(weaponId);
        const forecast = strikeForecast(subject, kind);
        const verdict = forecast === "weak" ? t("finds its weak spot") : forecast === "resist" ? t("glances off") : "";
        if (verdict) note.append(" ", sheetElement("strong", `strike-${forecast}`, `${tieredGearName(WEAPONS[weaponId])}: ${verdict}.`));
      }
      body.append(note);
    }
  }

  // The naturalist's notes: what you've seen of its life, not just of fighting it.
  const diet = typeof ecologyDietSummary === "function" ? ecologyDietSummary(templateId) : null;
  if (diet) {
    const lines = [];
    const eatsNames = { fungus: "glowcaps", plants: "roots and greens", fish: "fish", insects: "insects", small: "small creatures",
      large: "large creatures", carrion: "the dead", provisions: "food left out", tonalli: "offerings and fresh deaths",
      chapolin: "chapolines", chicatana: "chicatana ants", pinacate: "pinacate beetles", ahuauhtli: "water bugs" };
    const nameOf = (id) => t(eatsNames[id] || (window.CryptsEcology.species[id] ? creatureTemplate(id)?.name || id : id));
    if (diet.known) {
      lines.push(sheetElement("p", "creature-note", t(diet.note)));
      if (diet.habitats.length) lines.push(sheetElement("p", "creature-note", t("Seen in: {0}.").replace("{0}", diet.habitats.map((name) => t(name).toLowerCase()).join(", "))));
      const eats = diet.studied ? diet.eats : diet.eatsSeen;
      if (eats.length) lines.push(sheetElement("p", "creature-note", t(diet.studied ? "Eats: {0}." : "Seen eating: {0}.").replace("{0}", [...new Set(eats.map(nameOf))].join(", "))));
      if (diet.hunters.length) lines.push(sheetElement("p", "creature-note", t("Hunted by: {0}.").replace("{0}", diet.hunters.map((name) => t(name)).join(", "))));
      if (diet.meat) {
        lines.push(sheetElement("p", "creature-note", t("Yields: {0}.").replace("{0}", t(itemDetails(diet.meat)?.name || diet.meat)) +
          (diet.hazard ? ` ${t(diet.hazard)}` : "") + (diet.prepared ? ` ${t("You know how to butcher it.")}` : "")));
      }
      if (diet.taboo) lines.push(sheetElement("p", "creature-note is-danger", t("Its kills belong to Tlaloc. Don't touch them.")));
      if (!diet.studied) lines.push(sheetElement("p", "muted", t("Watch it longer, or study it (3 defeated), to learn more.")));
    } else {
      lines.push(sheetElement("p", "muted", t("Watch one, or defeat one, to learn what it eats and what hunts it.")));
    }
    if (enemy?.eco) {
      const hunger = ecoHungerState(enemy);
      const words = { starving: "Starving: desperate, −2 to attack and −1 AC.", hungry: "Hungry.", fed: "Well fed.", gorged: "Gorged and sluggish." };
      if (words[hunger]) lines.push(sheetElement("p", `creature-note${hunger === "starving" ? " is-danger" : ""}`, t(words[hunger])));
    }
    body.append(sheetSection("Naturalist's notes", ...lines));
  }

  // Bestiary ladder
  const ladder = sheetElement("ol", "creature-ladder");
  for (const tier of PROGRESSION.bestiaryTiers) {
    const step = sheetElement("li", kills >= tier.kills ? "is-reached" : "");
    step.append(
      sheetElement("strong", "", `${t(tier.title)} · ${tier.kills}`),
      sheetElement("span", "", t(tier.description))
    );
    ladder.append(step);
  }
  const nextTier = PROGRESSION.bestiaryTiers.find((tier) => tier.kills > kills);
  const lore = sheetSection("Bestiary",
    sheetElement("p", "muted", kills
      ? `${t("{count} defeated", { count: kills })}${nextTier ? ` · ${t("{count} more to {tier}", { count: nextTier.kills - kills, tier: t(nextTier.title).toLowerCase() })}` : ""}`
      : t("Not yet recorded. Defeat one to add it to your journal.")),
    ladder);
  body.append(lore);

  const layout = sheetElement("div", "creature-layout");
  layout.append(art, body);
  panel.append(close, head, layout);
  dialog.replaceChildren(panel);
  if (!dialog.open) dialog.showModal();
}

function connectCreatureCards() {
  const encounter = elements.encounter;
  if (encounter) {
    encounter.tabIndex = 0;
    encounter.setAttribute("role", "button");
    encounter.title = t("Show the full creature card");
    const open = () => {
      const enemy = nearestEnemy();
      if (enemy) openCreatureCard(enemy.templateId, enemy);
    };
    encounter.addEventListener("click", open);
    encounter.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); open(); }
    });
  }
  elements["bestiary-list"]?.addEventListener("click", (event) => {
    const entry = event.target.closest("[data-creature-id]");
    if (entry) openCreatureCard(entry.dataset.creatureId);
  });
}
