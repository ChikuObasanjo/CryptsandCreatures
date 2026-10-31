"use strict";

// Pascualito, the friendly duende of floor 2.
//
// He keeps his distance at first: he edges toward you and watches. Hold still for two turns
// while he watches and he comes up and asks for a gourd of pulque from the market. Bring it
// and he gives you the sea giants' cross (iron men leave you alone while you carry it).
// After that you can talk to him whenever you pass. Once he likes you (rapport 4+), bring
// him pulque unasked and you can invite him up to live in Chiltomatlan.
//
// State lives in progress().duende, so it carries across delves:
//   stage 0 not met · 1 asked for pulque · 2 gave the cross
//   rapport 0–10 · lastChatDay (in-game day of the last chat) · invited · line (chat rotation)

const DUENDE_ID = "duende-friend";
const DUENDE_NAME = "Pascualito";
const DUENDE_FLOOR = 2;
const DUENDE_TOWN_SPOT = { x: 12, y: 3 };

function defaultDuendeState() {
  return { stage: 0, rapport: 0, lastChatDay: -1, invited: false, line: 0 };
}

function normalizeDuendeState(raw) {
  const base = defaultDuendeState();
  if (!raw || typeof raw !== "object") return base;
  const int = (value, min, max, fallback) => (Number.isInteger(value) && value >= min && value <= max ? value : fallback);
  return {
    stage: int(raw.stage, 0, 2, 0),
    rapport: int(raw.rapport, 0, 10, 0),
    lastChatDay: int(raw.lastChatDay, -1, 1_000_000, -1),
    invited: raw.invited === true,
    line: int(raw.line, 0, 1000, 0)
  };
}

function duendeState() {
  const progress = state.run.progress || (state.run.progress = {});
  progress.duende = normalizeDuendeState(progress.duende);
  return progress.duende;
}

function duendeInDungeon() {
  return state.run?.enemies?.find((enemy) => enemy.alive && enemy.questNpc === DUENDE_ID) || null;
}

// Put him on floor 2 (once per floor, far from you and out of sight) until he moves to town.
function ensureDuendeFriend() {
  if (state.run?.location !== "dungeon" || state.run.dungeonFloor !== DUENDE_FLOOR) return;
  if (duendeState().invited || state.run.enemies.some((enemy) => enemy.questNpc === DUENDE_ID)) return;
  const template = state.pack.enemies.find((enemy) => enemy.id === "duende");
  if (!template) return;
  const occupied = new Set(state.run.enemies.filter((enemy) => enemy.alive).map((enemy) => tileIndex(enemy.x, enemy.y)));
  occupied.add(tileIndex(state.run.player.x, state.run.player.y));
  const rooms = state.run.rooms
    .map((room, index) => ({ room, index }))
    .filter(({ room, index }) => index > 0 && room.type !== "boss" && !["predator-den", "nesting-chamber"].includes(room.habitat))
    .sort((a, b) => distanceInSquares(b.room.center || roomCenter(b.room), state.run.player) -
      distanceInSquares(a.room.center || roomCenter(a.room), state.run.player));
  for (const { room, index } of rooms.slice(0, 4)) {
    const position = randomRoomFloor(room, occupied);
    if (!position || hasLineOfSight(state.run.player, position)) continue;
    const enemy = createEnemy(template, position, index, state.run.enemies.length);
    Object.assign(enemy, {
      id: `creature-${DUENDE_ID}`,
      questNpc: DUENDE_ID,
      sprite: DUENDE_ID,
      name: DUENDE_NAME,
      description: "A duende in a little red cap, smaller than the others and much better behaved. He keeps his distance until he's sure of you.",
      friendly: true,
      alerted: false,
      xp: 0,
      watch: 0
    });
    state.run.enemies.push(enemy);
    return;
  }
}

function roomCenter(room) {
  return { x: room.anchorX ?? room.mapX + Math.floor(room.mapW / 2), y: room.anchorY ?? room.mapY + Math.floor(room.mapH / 2) };
}

// One step for him: toward a target square, or away from you.
function duendeStep(enemy, away = false) {
  const player = state.run.player;
  const occupied = new Set(state.run.enemies.filter((other) => other.alive && other !== enemy).map((other) => tileIndex(other.x, other.y)));
  let best = null;
  let bestScore = away ? distanceInSquares(enemy, player) : Infinity;
  for (const direction of MOVEMENT_DIRECTIONS) {
    const x = enemy.x + direction.x;
    const y = enemy.y + direction.y;
    if ((x === player.x && y === player.y) || occupied.has(tileIndex(x, y)) || !canStepBetween(enemy, { x, y }, enemy)) continue;
    const distance = distanceInSquares({ x, y }, player);
    if (away ? distance > bestScore : distance < bestScore) {
      best = { x, y };
      bestScore = distance;
    }
  }
  if (best) {
    enemy.x = best.x;
    enemy.y = best.y;
  }
}

// His turn, in place of a creature's.
function duendeFriendAct(enemy) {
  const player = state.run.player;
  const distance = distanceInSquares(enemy, player);
  const sees = distance <= 7 && hasLineOfSight(enemy, player);
  const moved = enemy.lastPlayer && (enemy.lastPlayer.x !== player.x || enemy.lastPlayer.y !== player.y);
  enemy.lastPlayer = { x: player.x, y: player.y };
  const quest = duendeState();
  if (quest.stage > 0 || !sees) {
    enemy.watch = 0;
    return;
  }
  if (!enemy.spotted) {
    enemy.spotted = true;
    addLog("A small duende peeks at you from behind a pillar. If you hold still, he might come closer.");
  }
  if (distance > 3) {
    duendeStep(enemy);
    enemy.watch = 0;
    return;
  }
  if (moved) {
    if (enemy.watch > 0) addLog("The duende ducks back. He wants you to hold still.");
    enemy.watch = 0;
    duendeStep(enemy, true);
    return;
  }
  enemy.watch = (enemy.watch || 0) + 1;
  if (enemy.watch === 1) {
    addLog("The duende watches you, head tilted.");
    return;
  }
  // Two turns of you holding still: he comes up and speaks.
  while (distanceInSquares(enemy, player) > 1) {
    const before = { x: enemy.x, y: enemy.y };
    duendeStep(enemy);
    if (before.x === enemy.x && before.y === enemy.y) break;
  }
  quest.stage = 1;
  showRpgMessage(DUENDE_NAME, "“You're not one of the iron men, and you're not one of the dead. Good. I'm Pascualito. I came down with the sea giants' things a long time ago, and I can't go back up: the sun's too loud. But I miss pulque. Real pulque, from the market up top. Bring me a gourd and I'll give you something the iron men respect.”");
}

// The Explore-tab option and the big button when he's beside you.
function duendeInteractions() {
  const quest = duendeState();
  if (state.run.location !== "dungeon" || quest.stage === 0) return [];
  const enemy = duendeInDungeon();
  if (!enemy || distanceInSquares(enemy, state.run.player) > 1) return [];
  return [{ label: `Talk to ${DUENDE_NAME}`, action: talkToDuende, group: "explore" }];
}

function duendeHasPulque() {
  return inventoryQuantity("pulque") > 0;
}

function talkToDuende() {
  const quest = duendeState();
  const inTown = state.run.location === "city";
  const leave = { label: "Leave", action: () => {} };
  if (quest.stage === 1) {
    if (!duendeHasPulque()) {
      showRpgMessage(DUENDE_NAME, "“No pulque? The market up top sells it. A gourd, amigo. Just one.”");
      return;
    }
    chooseFromOptions(DUENDE_NAME, [
      { label: "Give him the pulque", action: () => {
        removeInventoryItem("pulque");
        quest.stage = 2;
        quest.rapport = Math.min(10, quest.rapport + 2);
        if (!addInventoryItem("spanish-cross")) dropItemHere("spanish-cross");
        showRpgMessage(DUENDE_NAME, "“Ay, that's the real thing.” He drinks half of it in one go, then presses a small iron cross into your hand. “The sea giants' sign. The iron men down here won't touch anyone who carries it. Don't ask me why. Come and talk sometime.”");
        addLog("You receive the sea giants' cross.");
        render();
        saveRun();
      } },
      { label: "Not yet", action: () => {} }
    ]);
    return;
  }
  // A chat: one rapport a day.
  const day = Math.floor((state.run.gameHours || 0) / 24);
  if (day !== quest.lastChatDay) {
    quest.lastChatDay = day;
    quest.rapport = Math.min(10, quest.rapport + 1);
  }
  const lines = inTown ? [
    "“The sun is quieter than I remembered. The pulque is better.”",
    "“Teyac lets me sleep under his stall. I keep the mice out of his maize.”",
    "“Tell the iron men I said hello. Or don't. They never answer.”"
  ] : [
    "“The iron men pray to that cross every night. They still think they'll find their spring.”",
    "“I lived in a ship's wall once. Then a church wall. Now a tomb wall. Walls are walls.”",
    "“The big grasshoppers are good company. They don't talk back.”",
    "“Some nights I hear something breathing far below. I don't go down there.”"
  ];
  const line = lines[quest.line % lines.length];
  quest.line += 1;
  const options = [];
  if (!inTown && !quest.invited && duendeHasPulque()) {
    options.push({ label: "Give him a gourd of pulque", action: giftDuendePulque });
  }
  if (!options.length) {
    showRpgMessage(DUENDE_NAME, line);
    saveRun();
    return;
  }
  options.push(leave);
  showRpgMessage(DUENDE_NAME, line);
  // Let the line be read first; the choice opens as the message closes.
  state.afterMessage = () => chooseFromOptions(DUENDE_NAME, options);
  saveRun();
}

function giftDuendePulque() {
  const quest = duendeState();
  if (!removeInventoryItem("pulque")) return;
  if (quest.rapport < 4) {
    quest.rapport = Math.min(10, quest.rapport + 1);
    showRpgMessage(DUENDE_NAME, "“For me? Unasked?” He takes the gourd with both hands. “You're a good one.”");
    render();
    saveRun();
    return;
  }
  showRpgMessage(DUENDE_NAME, "“For me? Unasked?” He holds the gourd for a long moment. “Up top they have a whole market of this. Do you think the sun is quieter than I remember?”");
  state.afterMessage = () => chooseFromOptions(DUENDE_NAME, [
    { label: "Invite him to Chiltomatlan", action: inviteDuende },
    { label: "Maybe another time", action: () => {} }
  ]);
  render();
  saveRun();
}

function inviteDuende() {
  const quest = duendeState();
  quest.invited = true;
  const enemy = duendeInDungeon();
  if (enemy) enemy.alive = false;
  showRpgMessage(DUENDE_NAME, "“All right. All right! I'll follow your trail marks up. Save me a corner somewhere warm.”");
  addLog("Pascualito will be waiting in Chiltomatlan.");
  syncDuendeInTown();
  render();
  saveRun();
}

// Once invited, he lives by the market.
function syncDuendeInTown() {
  if (typeof TOWN_NPCS === "undefined" || !state.run) return;
  const invited = duendeState().invited;
  let npc = TOWN_NPCS.find((person) => person.id === DUENDE_ID);
  if (!npc && invited) {
    npc = { id: DUENDE_ID, name: `${DUENDE_NAME}, a duende from the tomb`, x: DUENDE_TOWN_SPOT.x, y: DUENDE_TOWN_SPOT.y, glyph: "D", faction: null };
    TOWN_NPCS.push(npc);
  }
  if (!npc) return;
  if (!invited) {
    npc.x = -9;
    npc.y = -9;
    return;
  }
  // A free square by Teyac's market.
  npc.x = -9;
  npc.y = -9;
  const merchant = TOWN_NPCS.find((person) => person.id === "merchant") || DUENDE_TOWN_SPOT;
  for (let reach = 1; reach <= 4; reach += 1) {
    for (let dy = -reach; dy <= reach; dy += 1) {
      for (let dx = -reach; dx <= reach; dx += 1) {
        const x = merchant.x + dx;
        const y = merchant.y + dy;
        if (typeof townCanOccupy === "function" && townCanOccupy(x, y) && !isTownWellAt(x, y)) {
          npc.x = x;
          npc.y = y;
          return;
        }
      }
    }
  }
}

function dropItemHere(itemId) {
  state.run.treasures.push({ id: `dropped-${itemId}-${Date.now()}`, x: state.run.player.x, y: state.run.player.y, gold: 0, items: [{ id: itemId, quantity: 1 }] });
}

// The sea giants' cross: caxtiltecame leave you alone unless you attack them.
function crossSparesCreature(creature) {
  return creature?.templateId === "caxtiltecatl" && !creature.provoked &&
    typeof inventoryQuantity === "function" && inventoryQuantity("spanish-cross") > 0;
}
