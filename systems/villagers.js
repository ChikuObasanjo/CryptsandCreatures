"use strict";

// Villager relationships: chat once a day, give one gift a day, court, and marry.
// Content (who they are, what they say, where they spend the day) is in data/villagers.js.
//
// How a chat works, so it feels like talking to a person rather than a menu:
// - Villagers keep a daily schedule: they stand somewhere in town doing something, and
//   go home at night. You talk to them by walking up to them.
// - The first time, they introduce themselves. After that they open with a line that fits
//   the moment: you're hurt, it's the middle of the night, you're flush with tomb gold,
//   or simply how close you two are, filled with what they know about you.
// - As you grow closer, they tell you pieces of their own story (one per visit, in order).
//   How you answer those matters more than everyday small talk.
// - Everyday replies come in styles (warm, curious, playful, practical, and flirt once
//   you're friends); each villager has their own taste, and repeating the same move twice
//   in a row lands softer.
// - A spouse moves into your house; sleeping there, they feed you a full, balanced meal
//   and send you off with a meal boon.

const VILLAGE = window.CryptsVillagers;

function villageState() {
  state.run.villagers ||= { people: {}, spouse: null };
  return state.run.villagers;
}

function villagerRecord(id) {
  const village = villageState();
  village.people[id] ||= { d: 0, talkDay: -1, giftDay: -1, lastGift: null, lastStyle: null, courting: false, met: false, story: 0, asked: [] };
  const record = village.people[id];
  record.met ??= record.talkDay >= 0;
  record.story ??= 0;
  record.asked ||= [];
  return record;
}

const villageDay = () => Math.floor((state.run.gameHours || 0) / 24);
const villageHour = () => (state.run.gameHours || 0) % 24;
const pickLine = (lines) => lines[Math.floor(Math.random() * lines.length)];

function timeOfDayWord() {
  const hour = villageHour();
  return hour < 5 ? "night" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : hour < 22 ? "evening" : "night";
}

function villagerTier(id) {
  const record = villagerRecord(id);
  if (villageState().spouse === id) return { id: "partner", label: "Married" };
  const tier = [...VILLAGE.TIERS].reverse().find((entry) => record.d >= entry.min) || VILLAGE.TIERS[0];
  return record.courting ? { ...tier, label: "Courting" } : tier;
}

function villagerLines(villager, tierId) {
  const order = ["stranger", "acquaintance", "friend", "close", "dear", "partner"];
  for (let index = order.indexOf(tierId); index >= 0; index -= 1) {
    const lines = villager.lines[order[index]];
    if (lines?.length) return lines;
  }
  return ["..."];
}

function fillVillagerLine(text, id) {
  const record = villagerRecord(id);
  const gift = record.lastGift ? itemDetails(record.lastGift)?.name?.toLowerCase() || "gift" : "gift";
  return String(text)
    .replaceAll("{name}", state.run.character.name)
    .replaceAll("{floor}", String(progress().deepestFloor || 1))
    .replaceAll("{time}", timeOfDayWord())
    .replaceAll("{gift}", gift);
}

function heartsFor(points) {
  const full = Math.round(points / 10);
  return "♥".repeat(full) + "♡".repeat(10 - full);
}

function changeDisposition(id, amount) {
  const record = villagerRecord(id);
  record.d = Math.max(0, Math.min(100, record.d + amount));
}

// ---------- Where villagers are ----------

// The schedule slot for the current hour, or null when they are home for the night.
function villagerWhereabouts(id) {
  const villager = VILLAGE.villagers[id];
  const hour = villageHour();
  return villager.schedule.find((slot) => hour >= slot.from && hour < slot.to) || null;
}

// Villagers walk the town map as ordinary townsfolk: they join TOWN_NPCS, and their
// position follows the clock. Off-schedule villagers stand off the map.
function syncVillagerPositions() {
  if (typeof TOWN_NPCS === "undefined" || !state.run) return;
  for (const [id, villager] of Object.entries(VILLAGE.villagers)) {
    let npc = TOWN_NPCS.find((person) => person.id === id);
    if (!npc) {
      npc = { id, name: `${villager.name}, ${villager.role}`, x: -9, y: -9, glyph: "V", faction: null, villager: true };
      TOWN_NPCS.push(npc);
    }
    const slot = villagerWhereabouts(id);
    npc.x = slot ? slot.x : -9;
    npc.y = slot ? slot.y : -9;
  }
}

function villagerCharacter(id) {
  const villager = VILLAGE.villagers[id];
  return {
    race: "human",
    gender: villager.gender,
    appearance: normalizeAppearance({ ...villager.appearance }, "human"),
    equipment: { weapon: "none", armor: "none", shield: false, cloak: false },
    cosmetics: { owned: [], helmet: null, clothes: null, back: null }
  };
}

function villagerSprite(id, className) {
  return createCodexCharacterSprite(villagerCharacter(id), className, "west");
}

// ---------- The villager dialog ----------

function villagerNearby(id) {
  const npc = TOWN_NPCS.find((person) => person.id === id);
  return state.run.location === "city" && npc && npc.x >= 0 && townDistance(state.run.townPosition, npc) <= 1;
}

function openVillager(id, speech = "") {
  const villager = VILLAGE.villagers[id];
  if (!villager) return;
  state.villagerView = { id, mode: "menu", speech };
  renderVillagerDialog();
  if (!elements["villager-dialog"].open) elements["villager-dialog"].showModal();
}

function renderVillagerDialog() {
  const view = state.villagerView;
  if (!view) return;
  const id = view.id;
  const villager = VILLAGE.villagers[id];
  const record = villagerRecord(id);
  const slot = villagerWhereabouts(id);
  const near = villagerNearby(id);
  elements["villager-portrait"].replaceChildren(villagerSprite(id, "villager-portrait-sprite"));
  elements["villager-eyebrow"].textContent = `${villager.role} · ${villager.pronouns}`;
  elements["villager-name"].textContent = villager.name;
  elements["villager-doing"].textContent = slot
    ? `${near ? "Here" : "Now"}: ${slot.doing}.`
    : "Home for the night. Find them tomorrow.";
  elements["villager-hearts"].textContent = `${t(villagerTier(id).label)} ${heartsFor(record.d)}`;
  elements["villager-hearts"].title = `${record.d} / 100`;
  elements["villager-speech"].textContent = view.speech || (record.met ? villager.summary : "You haven't met yet.");
  const actions = [];
  const button = (label, action, secondary = true, disabled = false) => {
    const element = document.createElement("button");
    element.type = "button";
    element.className = `button${secondary ? " secondary" : ""}`;
    element.textContent = label;
    element.disabled = disabled;
    element.addEventListener("click", action);
    actions.push(element);
  };
  if (view.mode === "reply") {
    for (const option of view.options) button(option.label, option.action);
  } else if (view.mode === "ask") {
    const { open, locked } = villagerQuestions(id);
    if (!view.speech) elements["villager-speech"].textContent = `What do you want to ask ${villager.name}?`;
    const list = document.createElement("div");
    list.className = "villager-questions";
    for (const question of open) {
      const asked = record.asked.includes(question.id);
      const item = document.createElement("button");
      item.type = "button";
      item.className = `villager-question${asked ? " is-asked" : " is-new"}${view.question === question.id ? " is-current" : ""}`;
      item.textContent = `${asked ? "✓ " : "✦ "}${t(question.q)}`;
      item.addEventListener("click", () => askVillager(id, question.id));
      list.append(item);
    }
    if (locked) {
      const more = document.createElement("p");
      more.className = "villager-questions-locked muted";
      more.textContent = locked === 1
        ? `One more question will open up as you and ${villager.name} grow closer.`
        : `${locked} more questions will open up as you and ${villager.name} grow closer.`;
      list.append(more);
    }
    actions.push(list);
    button("Back", () => { view.mode = "menu"; view.speech = ""; view.question = null; renderVillagerDialog(); });
  } else if (view.mode === "gift") {
    const items = giftableItems();
    if (!items.length) {
      elements["villager-speech"].textContent = "You have nothing in your pack to give.";
    }
    const grid = document.createElement("div");
    grid.className = "villager-gift-grid";
    for (const itemId of items) {
      const item = itemDetails(itemId);
      const gift = document.createElement("button");
      gift.type = "button";
      gift.className = "villager-gift";
      gift.title = item.name;
      gift.append(itemArtImage(itemId, "villager-gift-icon"));
      const name = document.createElement("span");
      name.textContent = item.name;
      gift.append(name);
      gift.addEventListener("click", () => giveVillagerGift(id, itemId));
      grid.append(gift);
    }
    actions.push(grid);
    button("Back", () => { view.mode = "menu"; view.speech = ""; renderVillagerDialog(); });
  } else {
    const today = villageDay();
    const village = villageState();
    if (!near) {
      if (!view.speech) elements["villager-speech"].textContent = `${record.met ? villager.summary : "You haven't met yet."} Walk up to them in town to talk.`;
    } else {
      button(record.talkDay === today ? "Chat · again tomorrow" : record.met ? "Chat" : "Introduce yourself",
        () => chatWithVillager(id), false, record.talkDay === today);
      if (record.met && villager.questions?.length) {
        const fresh = villagerQuestions(id).open.filter((question) => !record.asked.includes(question.id)).length;
        button(fresh ? `Ask about… · ${fresh} new` : "Ask about…",
          () => { view.mode = "ask"; view.speech = ""; view.question = null; renderVillagerDialog(); });
      }
      button(record.giftDay === today ? "Give a gift · one a day" : "Give a gift",
        () => { view.mode = "gift"; view.speech = `What will you give ${villager.name}?`; renderVillagerDialog(); },
        true, record.giftDay === today);
      const free = !village.spouse && !Object.entries(village.people).some(([other, entry]) => other !== id && entry.courting);
      if (villager.romance && free && !record.courting && record.d >= VILLAGE.COURT_AT) button("Ask to court", () => askToCourt(id));
      if (record.courting && village.spouse !== id && record.d >= VILLAGE.PROPOSE_AT) button("Propose marriage", () => proposeTo(id));
    }
    button("Leave", () => elements["villager-dialog"].close());
  }
  elements["villager-actions"].replaceChildren(...actions);
}

// The town directory: everyone, where they are now, and how close you are.
function openVillagers() {
  if (state.run.location !== "city") return;
  syncVillagerPositions();
  chooseFromOptions("People of Chiltomatlan", [
    ...Object.entries(VILLAGE.villagers).map(([id, villager]) => {
      const slot = villagerWhereabouts(id);
      return {
        label: `${villager.name} · ${slot ? slot.doing : "home for the night"} · ${heartsFor(villagerRecord(id).d)}`,
        action: () => openVillager(id)
      };
    }),
    { label: "Not now", action: () => {} }
  ]);
}

// ---------- Chat ----------

function villagerOpener(id) {
  const villager = VILLAGE.villagers[id];
  const record = villagerRecord(id);
  if (!record.met) return { text: villager.intro, kind: "intro" };
  const story = villager.stories?.[record.story];
  if (story && record.d >= story.min) return { text: story.text, kind: "story", story };
  const context = villager.context || {};
  const hour = villageHour();
  const situations = [];
  if (state.run.hp < state.run.maxHp * 0.5 && context.hurt) situations.push(context.hurt);
  if ((hour >= 22 || hour < 5) && context.night) situations.push(context.night);
  if (state.run.gold >= 400 && context.rich) situations.push(context.rich);
  if (situations.length && Math.random() < 0.6) return { text: pickLine(situations), kind: "context" };
  return { text: pickLine(villagerLines(villager, villagerTier(id).id)), kind: "everyday" };
}

function chatWithVillager(id) {
  if (!villagerNearby(id)) return;
  const villager = VILLAGE.villagers[id];
  const record = villagerRecord(id);
  const opener = villagerOpener(id);
  const view = state.villagerView;
  view.speech = `“${fillVillagerLine(opener.text, id)}”`;
  view.mode = "reply";
  if (opener.kind === "story") {
    view.options = opener.story.replies.map((reply) => ({
      label: `${t(VILLAGE.REPLY_STYLES[reply.style])} · “${reply.label}”`,
      action: () => {
        record.story += 1;
        changeDisposition(id, reply.d);
        finishVillagerChat(id, reply.style, `“${fillVillagerLine(reply.reply, id)}”`);
      }
    }));
  } else {
    if (opener.kind === "intro") record.met = true;
    const close = record.courting || villageState().spouse === id || record.d >= VILLAGE.TIERS[2].min;
    const styles = Object.keys(VILLAGE.REPLY_STYLES).filter((style) => style !== "flirt" || close);
    const intro = opener.kind === "intro";
    view.options = styles.filter((style) => !intro || VILLAGE.PLAYER_INTRO[style]).map((style) => ({
      label: `${t(VILLAGE.REPLY_STYLES[style])} · “${intro ? VILLAGE.PLAYER_INTRO[style] : pickLine(VILLAGE.PLAYER_LINES[style])}”`,
      action: () => answerVillager(id, style)
    }));
  }
  renderVillagerDialog();
}

function answerVillager(id, style) {
  const villager = VILLAGE.villagers[id];
  const record = villagerRecord(id);
  let value = villager.values[style] ?? 1;
  if (record.lastStyle === style) value -= 1;
  // Flirting before they're interested is awkward rather than hurtful.
  if (style === "flirt" && !record.courting && villageState().spouse !== id && record.d < VILLAGE.COURT_AT) value = Math.min(value, 1);
  const outcome = value >= 2 ? "good" : value >= 1 ? "neutral" : "bad";
  changeDisposition(id, VILLAGE.CHAT_POINTS[outcome]);
  finishVillagerChat(id, style, `“${fillVillagerLine(pickLine(villager.reactions[outcome]), id)}”`);
}

function finishVillagerChat(id, style, speech) {
  const record = villagerRecord(id);
  record.met = true;
  record.talkDay = villageDay();
  record.lastStyle = style;
  state.villagerView.mode = "menu";
  state.villagerView.speech = speech;
  renderVillagerDialog();
  saveRun();
}

// ---------- Questions ----------

// Questions open as disposition grows; a spouse can ask anything.
function villagerQuestions(id) {
  const villager = VILLAGE.villagers[id];
  const record = villagerRecord(id);
  const all = villager.questions || [];
  const partner = villageState().spouse === id;
  const open = all.filter((question) => partner || record.d >= question.min);
  return { open, locked: all.length - open.length };
}

function askVillager(id, questionId) {
  if (!villagerNearby(id)) return;
  const record = villagerRecord(id);
  const question = villagerQuestions(id).open.find((entry) => entry.id === questionId);
  if (!question) return;
  if (!record.asked.includes(question.id)) {
    record.asked.push(question.id);
    changeDisposition(id, 1);
  }
  const view = state.villagerView;
  view.mode = "ask";
  view.question = question.id;
  view.speech = `“${fillVillagerLine(t(question.a), id)}”`;
  renderVillagerDialog();
  saveRun();
}

// ---------- Gifts ----------

function giftableItems() {
  const ids = [...new Set(state.run.inventory.map((entry) => entry.id))];
  return ids.filter((itemId) => droppableQuantity(itemId) > 0 && itemDetails(itemId));
}

function giftReaction(villager, itemId) {
  const base = itemId.replace(/^(weapon|armor|wear|cosmetic):/, "");
  for (const kind of ["loves", "likes", "dislikes"]) {
    if (villager.gifts[kind].includes(itemId) || villager.gifts[kind].includes(base)) return kind;
  }
  return "neutral";
}

function giveVillagerGift(id, itemId) {
  const villager = VILLAGE.villagers[id];
  const record = villagerRecord(id);
  if (!villagerNearby(id) || record.giftDay === villageDay() || droppableQuantity(itemId) < 1 || !removeInventoryItem(itemId)) return;
  const reaction = giftReaction(villager, itemId);
  changeDisposition(id, VILLAGE.GIFT_POINTS[reaction]);
  record.giftDay = villageDay();
  record.met = true;
  if (reaction !== "dislikes") record.lastGift = itemId;
  addLog(`You give ${itemDetails(itemId).name} to ${villager.name}.`);
  sfx(reaction === "dislikes" ? "enemyMiss" : "gift");
  state.villagerView.mode = "menu";
  state.villagerView.speech = `“${fillVillagerLine(villager.giftReplies[reaction], id)}”`;
  renderVillagerDialog();
  render();
  saveRun();
}

// ---------- Courting and marriage ----------

function askToCourt(id) {
  const villager = VILLAGE.villagers[id];
  const record = villagerRecord(id);
  const yes = villager.romance && record.d >= VILLAGE.COURT_AT;
  if (yes) {
    record.courting = true;
    addLog(`You and ${villager.name} are courting.`);
  }
  state.villagerView.speech = `“${fillVillagerLine(yes ? villager.courtYes : villager.courtNo, id)}”`;
  renderVillagerDialog();
  saveRun();
}

function proposeTo(id) {
  const villager = VILLAGE.villagers[id];
  const record = villagerRecord(id);
  const village = villageState();
  if (!houseState().owned) {
    state.villagerView.speech = "You'd want a home to share first. Tlacotl has a house for sale off the plaza.";
    renderVillagerDialog();
    return;
  }
  const yes = record.courting && record.d >= VILLAGE.PROPOSE_AT && !village.spouse;
  if (yes) {
    village.spouse = id;
    addLog(`You marry ${villager.name}. They move into your house.`);
  }
  state.villagerView.speech = `“${fillVillagerLine(yes ? villager.proposeYes : villager.proposeNo, id)}”`;
  renderVillagerDialog();
  saveRun();
}

function spouse() {
  const id = state.run?.villagers?.spouse;
  return id && VILLAGE.villagers[id] ? { id, ...VILLAGE.villagers[id] } : null;
}

// Called after sleeping at home: your spouse cooks for you.
function spouseMorningMeal() {
  const partner = spouse();
  if (!partner) return;
  const needs = state.run.needs;
  needs.food = 100;
  needs.water = 100;
  for (const nutrient of Object.keys(needs.nutrition || {})) needs.nutrition[nutrient] = Math.max(needs.nutrition[nutrient], 80);
  grantBuff(pickLine(["hearty", "fiery", "steady", "keen-eyed"]));
  changeDisposition(partner.id, 1);
  addLog(`${partner.name} cooks for you before you go: food, water, and a balanced meal. “${fillVillagerLine(pickLine(partner.lines.partner), partner.id)}”`);
}

function connectVillagerEvents() {
  elements["villager-close"].addEventListener("click", () => elements["villager-dialog"].close());
  elements["villager-dialog"].addEventListener("close", () => {
    state.villagerView = null;
    if (state.run?.location === "city") render();
  });
}

// Drop anything malformed from a saved game.
function normalizeVillageSave(saved) {
  const village = saved.villagers;
  if (!village || typeof village !== "object" || typeof village.people !== "object" || !village.people) {
    saved.villagers = { people: {}, spouse: null };
    return;
  }
  const people = {};
  for (const [id, entry] of Object.entries(village.people)) {
    if (!VILLAGE.villagers[id] || !entry || typeof entry !== "object") continue;
    people[id] = {
      d: Math.max(0, Math.min(100, Number(entry.d) || 0)),
      talkDay: Number.isInteger(entry.talkDay) ? entry.talkDay : -1,
      giftDay: Number.isInteger(entry.giftDay) ? entry.giftDay : -1,
      lastGift: typeof entry.lastGift === "string" ? entry.lastGift : null,
      lastStyle: typeof entry.lastStyle === "string" ? entry.lastStyle : null,
      courting: Boolean(entry.courting),
      met: Boolean(entry.met ?? (Number.isInteger(entry.talkDay) && entry.talkDay >= 0)),
      story: Number.isInteger(entry.story) && entry.story >= 0 ? entry.story : 0,
      asked: Array.isArray(entry.asked)
        ? [...new Set(entry.asked.filter((question) => VILLAGE.villagers[id].questions?.some((known) => known.id === question)))]
        : []
    };
  }
  saved.villagers = { people, spouse: VILLAGE.villagers[village.spouse] ? village.spouse : null };
}
