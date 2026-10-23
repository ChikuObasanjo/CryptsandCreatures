"use strict";

function getRoomsOfType(type) {
  return state.pack.rooms.filter((room) => room.type === type);
}

function chooseRoom(type, index) {
  const options = getRoomsOfType(type);
  if (!options.length) throw new Error(`The active pack has no ${type} room.`);
  return options[index % options.length];
}

function shuffle(list) {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1) - 1;
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function generateGtflDungeon() {
  const depth = state.run.dungeonFloor;
  const startCell = { x: 0, y: 2 };
  const keyOf = ({ x, y }) => `${x},${y}`;
  const neighbors = (cell) => DIRECTIONS
    .map(({ x, y }) => ({ x: cell.x + x, y: cell.y + y }))
    .filter((next) => next.x >= 0 && next.x < ROOM_GRID_SIZE && next.y >= 0 && next.y < ROOM_GRID_SIZE);
  const cells = new Map([[keyOf(startCell), startCell]]);
  const frontier = neighbors(startCell);
  const targetRoomCount = 16 + randomInt(6);
  while (cells.size < targetRoomCount && frontier.length) {
    const [next] = frontier.splice(randomInt(frontier.length) - 1, 1);
    if (cells.has(keyOf(next))) continue;
    cells.set(keyOf(next), next);
    for (const neighbor of neighbors(next)) {
      if (!cells.has(keyOf(neighbor)) && !frontier.some((entry) => keyOf(entry) === keyOf(neighbor))) frontier.push(neighbor);
    }
  }
  const cellList = [...cells.values()];
  const graphDistances = new Map([[keyOf(startCell), 0]]);
  const queue = [startCell];
  while (queue.length) {
    const current = queue.shift();
    for (const neighbor of neighbors(current)) {
      if (!cells.has(keyOf(neighbor)) || graphDistances.has(keyOf(neighbor))) continue;
      graphDistances.set(keyOf(neighbor), graphDistances.get(keyOf(current)) + 1);
      queue.push(neighbor);
    }
  }
  const farthestCells = cellList.filter((cell) => keyOf(cell) !== keyOf(startCell))
    .sort((a, b) => graphDistances.get(keyOf(b)) - graphDistances.get(keyOf(a)));
  const bossCell = farthestCells[0];
  const treasureCell = shuffle(cellList.filter((cell) =>
    keyOf(cell) !== keyOf(startCell) && keyOf(cell) !== keyOf(bossCell)
  ))[0];
  const roomTypes = ["quiet", "trap", "combat", "quiet", "treasure"];
  const orderedCells = [startCell, ...shuffle(cellList.filter((cell) => keyOf(cell) !== keyOf(startCell)))];
  const rooms = orderedCells.map((cell, index) => {
    const isStart = keyOf(cell) === keyOf(startCell);
    const isBoss = keyOf(cell) === keyOf(bossCell);
    const isTreasure = keyOf(cell) === keyOf(treasureCell);
    const type = isStart && depth === 1 ? "entrance" : isBoss ? "boss" : isTreasure ? "treasure"
      : roomTypes[randomInt(roomTypes.length) - 1];
    const template = chooseRoom(type, randomInt(99));
    const anchorX = 4 + cell.x * 9;
    const anchorY = 4 + cell.y * 9;
    const size = randomInt(2) === 1 ? 5 : 7;
    return {
      ...template,
      text: isStart && depth === 1
        ? "The old imperial seal lies broken at this threshold. The surface entrance is the one safe route back to Chiltomatlan."
        : isTreasure
          ? "A carved vault lies among the old offerings. Search its passages, then choose how much farther to descend."
          : isBoss && depth === 13
            ? "A starless presence waits in the deepest chamber. Tzitzimitl guards the final vault."
            : template.text,
      x: cell.x,
      y: cell.y,
      mapX: anchorX - Math.floor(size / 2),
      mapY: anchorY - Math.floor(size / 2),
      mapW: size,
      mapH: size,
      anchorX,
      anchorY,
      mapLayout: GTFL_MAP_ID,
      mainTreasure: isTreasure,
      optionalQuest: isBoss && depth === DUNGEON_FLOOR_COUNT,
      cleared: isStart,
      visited: isStart,
      enemy: null,
      links: []
    };
  });
  const roomIndexByCell = new Map(rooms.map((room, index) => [keyOf(room), index]));
  const edges = [];
  for (const cell of cellList) {
    for (const neighbor of neighbors(cell)) {
      if (cell.x > neighbor.x || cell.y > neighbor.y || !cells.has(keyOf(neighbor))) continue;
      const first = roomIndexByCell.get(keyOf(cell));
      const second = roomIndexByCell.get(keyOf(neighbor));
      rooms[first].links.push(second);
      rooms[second].links.push(first);
      edges.push([rooms[first], rooms[second]]);
    }
  }
  const terrain = Array(MAP_TILE_SIZE * MAP_TILE_SIZE).fill("stone");
  const setTerrain = (x, y, type) => {
    if (x >= 0 && x < MAP_TILE_SIZE && y >= 0 && y < MAP_TILE_SIZE) {
      terrain[tileIndex(x, y)] = type;
    }
  };
  for (const room of rooms) {
    for (let y = 0; y < room.mapH; y += 1) {
      for (let x = 0; x < room.mapW; x += 1) {
        const boundary = x === 0 || x === room.mapW - 1 || y === 0 || y === room.mapH - 1;
        setTerrain(room.mapX + x, room.mapY + y, boundary ? "wall" : "floor");
      }
    }
  }
  for (const [first, second] of edges) {
    const dx = Math.sign(second.anchorX - first.anchorX);
    const dy = Math.sign(second.anchorY - first.anchorY);
    const startRadius = dx ? Math.floor(first.mapW / 2) : Math.floor(first.mapH / 2);
    const endRadius = dx ? Math.floor(second.mapW / 2) : Math.floor(second.mapH / 2);
    const distance = Math.abs(second.anchorX - first.anchorX) + Math.abs(second.anchorY - first.anchorY);
    for (let step = startRadius; step <= distance - endRadius; step += 1) {
      const x = first.anchorX + dx * step;
      const y = first.anchorY + dy * step;
      setTerrain(x, y, step === startRadius || step === distance - endRadius ? "door" : "corridor");
    }
  }
  if (rooms.some((room) => terrain[tileIndex(room.anchorX, room.anchorY)] !== "floor")) {
    throw new Error("A starter tomb chamber is not centered on a walkable tile.");
  }
  const stairRooms = shuffle(rooms.filter((room) =>
    room !== rooms[0] && room !== rooms.find((entry) => entry.mainTreasure) &&
    room !== rooms.find((entry) => entry.optionalQuest)
  ));
  const floorStairs = [];
  if (depth === 1) {
    const entrance = rooms.find((room) => room.type === "entrance");
    floorStairs.push({
      id: "surface-entrance", x: entrance.anchorX, y: entrance.anchorY,
      type: "stairs-up", role: "entrance", name: "Surface entrance"
    });
  } else {
    for (let index = 1; index <= 2; index += 1) {
      const room = stairRooms.shift();
      if (!room) throw new Error("Could not place two return stairs on this dungeon floor.");
      floorStairs.push({
        id: `connection-${depth - 1}-${index}`, x: room.anchorX, y: room.anchorY,
        type: "stairs-up", targetFloor: depth - 1, name: "Stairs up"
      });
    }
  }
  if (depth < 13) {
    for (let index = 1; index <= 2; index += 1) {
      const room = stairRooms.shift();
      if (!room) throw new Error("Could not place two descending stairs on this dungeon floor.");
      floorStairs.push({
        id: `connection-${depth}-${index}`, x: room.anchorX, y: room.anchorY,
        type: "stairs-down", targetFloor: depth + 1, name: "Stairs down"
      });
    }
  } else {
    const boss = rooms.find((room) => room.optionalQuest);
    floorStairs.push({
      id: "surface-exit", x: boss.anchorX + 1, y: boss.anchorY,
      type: "exit", role: "exit", name: "Tomb exit"
    });
  }
  return { rooms, terrain, mapId: GTFL_MAP_ID, floorStairs, layoutVersion: 2 };
}

function generateDungeon() {
  if (state.pack.id === starterPack.id && getRoomsOfType("treasure").length) return generateGtflDungeon();
  const candidates = state.pack.rooms.filter((room) => ["quiet", "trap", "treasure", "combat"].includes(room.type));
  if (!candidates.length) throw new Error("The pack needs at least one quiet, trap, treasure, or combat room.");
  const middleCount = Math.min(candidates.length, randomInt(3) + 2);
  const middle = Array.from({ length: middleCount }, () => candidates[randomInt(candidates.length) - 1]);
  const rooms = [chooseRoom("entrance", randomInt(99)), ...middle, chooseRoom("boss", randomInt(99)), chooseRoom("exit", randomInt(99))];
  const layout = [];
  const occupied = new Set();
  const center = Math.floor(ROOM_GRID_SIZE / 2);
  function place(index, x, y) {
    const key = `${x},${y}`;
    if (x < 0 || x >= ROOM_GRID_SIZE || y < 0 || y >= ROOM_GRID_SIZE || occupied.has(key)) return false;
    occupied.add(key);
    const roomWidth = rooms[index].type === "boss" ? 5 : [3, 5, 5][randomInt(3) - 1];
    const roomHeight = rooms[index].type === "boss" ? 5 : [3, 5, 5][randomInt(3) - 1];
    layout.push({
      ...rooms[index],
      x,
      y,
      mapX: PROCEDURAL_MAP_OFFSET + x * 7 + 3 - Math.floor(roomWidth / 2),
      mapY: PROCEDURAL_MAP_OFFSET + y * 7 + 3 - Math.floor(roomHeight / 2),
      mapW: roomWidth,
      mapH: roomHeight,
      cleared: index === 0,
      visited: index === 0,
      enemy: null
    });
    if (index === rooms.length - 1) return true;

    const directions = shuffle(DIRECTIONS).filter((direction) => {
      const nx = x + direction.x;
      const ny = y + direction.y;
      if (nx < 0 || nx >= ROOM_GRID_SIZE || ny < 0 || ny >= ROOM_GRID_SIZE || occupied.has(`${nx},${ny}`)) return false;
      return !layout.some((room, roomIndex) => roomIndex < index - 1 && Math.abs(room.x - nx) + Math.abs(room.y - ny) === 1);
    });
    for (const direction of directions) {
      if (place(index + 1, x + direction.x, y + direction.y)) return true;
    }
    occupied.delete(key);
    layout.pop();
    return false;
  }

  let created = false;
  for (let attempt = 0; attempt < 80 && !created; attempt += 1) {
    layout.length = 0;
    occupied.clear();
    created = place(0, center, center);
  }
  if (!created) throw new Error("Could not lay out this pack's rooms. Try a pack with fewer room templates.");

  for (let i = 0; i < layout.length; i += 1) {
    layout[i].links = [];
    if (i > 0) layout[i].links.push(i - 1);
    if (i < layout.length - 1) layout[i].links.push(i + 1);
  }

  const terrain = Array(MAP_TILE_SIZE * MAP_TILE_SIZE).fill("stone");
  const setTerrain = (x, y, type) => {
    if (x >= 0 && x < MAP_TILE_SIZE && y >= 0 && y < MAP_TILE_SIZE) terrain[y * MAP_TILE_SIZE + x] = type;
  };
  for (const room of layout) {
    for (let y = 0; y < room.mapH; y += 1) {
      for (let x = 0; x < room.mapW; x += 1) {
        const wall = x === 0 || x === room.mapW - 1 || y === 0 || y === room.mapH - 1;
        setTerrain(room.mapX + x, room.mapY + y, wall ? "wall" : "floor");
      }
    }
  }
  for (let index = 0; index < layout.length - 1; index += 1) {
    const room = layout[index];
    const target = layout[index + 1];
    const direction = DIRECTIONS.find((entry) => target.x - room.x === entry.x && target.y - room.y === entry.y);
    if (!direction) throw new Error("Generated rooms do not form a connected passage.");
    const startX = room.mapX + Math.floor(room.mapW / 2);
    const startY = room.mapY + Math.floor(room.mapH / 2);
    const roomRadius = direction.x ? Math.floor(room.mapW / 2) : Math.floor(room.mapH / 2);
    const targetRadius = direction.x ? Math.floor(target.mapW / 2) : Math.floor(target.mapH / 2);
    for (let step = 1; step < 7; step += 1) {
      const x = startX + direction.x * step;
      const y = startY + direction.y * step;
      setTerrain(x, y, step === roomRadius || step === 7 - targetRadius ? "door" : "corridor");
    }
  }
  return { rooms: layout, terrain };
}

function tileIndex(x, y) {
  return y * MAP_TILE_SIZE + x;
}

function roomIndexAt(x, y) {
  return state.run.rooms.findIndex((room) =>
    room.mapLayout === GTFL_MAP_ID && state.run.dungeonLayoutVersion === 2
      ? x >= room.mapX + 1 && x < room.mapX + room.mapW - 1 &&
        y >= room.mapY + 1 && y < room.mapY + room.mapH - 1
      : room.mapLayout === GTFL_MAP_ID
        ? Math.abs(x - room.anchorX) <= 1 && Math.abs(y - room.anchorY) <= 1
      : x >= room.mapX + 1 && x < room.mapX + room.mapW - 1 &&
        y >= room.mapY + 1 && y < room.mapY + room.mapH - 1
  );
}

function randomRoomFloor(room, occupied) {
  const options = [];
  for (let y = room.mapY + 1; y < room.mapY + room.mapH - 1; y += 1) {
    for (let x = room.mapX + 1; x < room.mapX + room.mapW - 1; x += 1) {
      if (isWalkable(x, y) && !occupied.has(tileIndex(x, y))) options.push({ x, y });
    }
  }
  return options.length ? options[randomInt(options.length) - 1] : null;
}

function createEnemies(rooms, player) {
  if (state.run.mapId === GTFL_MAP_ID) return createGreatTempleEnemies(rooms, player);
  const enemies = [];
  const occupied = new Set([tileIndex(player.x, player.y)]);
  for (let index = 1; index < rooms.length - 1; index += 1) {
    const room = rooms[index];
    const isBoss = room.type === "boss";
    const guaranteed = index === Math.min(rooms.length - 2, Math.ceil((rooms.length - 1) / 2));
    if (!isBoss && room.type !== "combat" && !guaranteed && randomInt(100) > 28) continue;
    const template = state.pack.enemies.find((enemy) => enemy.id === room.enemyId) ||
      (() => {
        const available = state.pack.enemies.filter((enemy) => !enemy.minLevel || enemy.minLevel <= state.run.level);
        if (!available.length) throw new Error("The adventure pack has no creatures available at this level.");
        return available[randomInt(available.length) - 1];
      })();
    const position = randomRoomFloor(room, occupied);
    if (!position) continue;
    occupied.add(tileIndex(position.x, position.y));
    const enemy = {
      id: `creature-${index}`,
      templateId: template.id,
      sprite: template.sprite || enemySpriteForId(template.id),
      name: template.name,
      description: `${template.description || ""}${template.gear ? ` Gear: ${template.gear}.` : ""}`,
      hp: template.hp,
      maxHp: template.hp,
      ac: template.ac,
      attackBonus: template.attackBonus,
      damage: template.damage,
      initiativeBonus: template.initiativeBonus || 0,
      xp: template.xp,
      edible: Boolean(template.edible),
      x: position.x,
      y: position.y,
      roomIndex: index,
      alerted: false,
      alive: true
    };
    if (isBoss) {
      enemy.hp = Math.max(1, Math.ceil(enemy.hp * 1.5));
      enemy.maxHp = enemy.hp;
    }

    enemies.push(enemy);
  }
  return enemies;
}

function createGreatTempleEnemies(rooms, player) {
  const occupied = new Set([
    tileIndex(player.x, player.y),
    tileIndex(rooms.find((room) => room.mainTreasure).anchorX, rooms.find((room) => room.mainTreasure).anchorY),
    ...state.run.floorStairs.map((stair) => tileIndex(stair.x, stair.y)),
    ...state.run.treasures.map((treasure) => tileIndex(treasure.x, treasure.y))
  ]);
  const enemies = [];
  const usedEncounterIds = new Set();
  for (let roomIndex = 1; roomIndex < rooms.length; roomIndex += 1) {
    const room = rooms[roomIndex];
    const isBoss = room.type === "boss";
    if (!isBoss && room.type !== "combat" && room.type !== "trap" && randomInt(100) > 44) continue;
    const template = state.pack.enemies.find((enemy) => enemy.id === room.enemyId) ||
      rollGreatTempleEncounter(usedEncounterIds);
    usedEncounterIds.add(template.id);
    const position = randomRoomFloor(rooms[roomIndex], occupied);
    if (!position) continue;
    occupied.add(tileIndex(position.x, position.y));
    const enemy = createEnemy(template, position, roomIndex, enemies.length);
    if (isBoss) {
      enemy.hp = Math.ceil(enemy.hp * 1.5);
      enemy.maxHp = enemy.hp;
    }
    scaleGreatTempleEnemy(enemy);
    decorateEnemy(enemy, { isBoss });
    enemies.push(enemy);
  }
  const roamerCount = 2 + Math.floor(state.run.dungeonFloor / 3);
  for (let index = 0; index < roamerCount; index += 1) {
    const position = randomMapFloorSpread(occupied, enemies, 5, player, 8);
    if (!position) break;
    occupied.add(tileIndex(position.x, position.y));
    const template = rollGreatTempleEncounter(usedEncounterIds);
    usedEncounterIds.add(template.id);
    const enemy = createEnemy(template, position, -1, enemies.length);
    scaleGreatTempleEnemy(enemy);
    decorateEnemy(enemy);
    enemies.push(enemy);
  }
  return enemies;
}

function addGreatTempleRoamers(player, count) {
  const occupied = new Set([
    tileIndex(player.x, player.y),
    ...state.run.floorStairs.map((stair) => tileIndex(stair.x, stair.y)),
    ...state.run.enemies.filter((enemy) => enemy.alive).map((enemy) => tileIndex(enemy.x, enemy.y)),
    ...state.run.hazards.filter((hazard) => !hazard.triggered).map((hazard) => tileIndex(hazard.x, hazard.y)),
    ...state.run.treasures.map((treasure) => tileIndex(treasure.x, treasure.y))
  ]);
  const usedEncounterIds = new Set(state.run.enemies
    .filter((enemy) => enemy.alive)
    .map((enemy) => enemy.templateId));
  for (let index = 0; index < count; index += 1) {
    const position = randomMapFloorSpread(occupied, state.run.enemies, 5, player, 8);
    if (!position) break;
    occupied.add(tileIndex(position.x, position.y));
    const template = rollGreatTempleEncounter(usedEncounterIds);
    usedEncounterIds.add(template.id);
    const enemy = createEnemy(template, position, -1, state.run.enemies.length);
    scaleGreatTempleEnemy(enemy);
    decorateEnemy(enemy);
    state.run.enemies.push(enemy);
  }
}

function rollGreatTempleEncounter(usedIds = new Set()) {
  const floor = state.run.dungeonFloor || 1;
  const earlyEncounters = [
    "maztican-cave-locust", "axolocatl", "cenote-stalker",
    "tomb-bat", "duende", "yohualtepoztli"
  ];
  const middleEncounters = [
    ...earlyEncounters, "mictlaneca", "jungle-jaguar", "quinametli", "cihuateotl"
  ];
  const deepEncounters = [
    ...middleEncounters, "caxtiltecatl", "feathered-serpent", "camazotz"
  ];
  const encounterIds = floor >= 9 ? deepEncounters : floor >= 5 ? middleEncounters : earlyEncounters;
  const available = encounterIds
    .map((id) => state.pack.enemies.find((enemy) => enemy.id === id))
    .filter(Boolean);
  const unused = available.filter((enemy) => !usedIds.has(enemy.id));
  const candidates = unused.length ? unused : available;
  if (!candidates.length) {
    throw new Error(`The starter tomb encounter table has no creatures available on floor ${floor}.`);
  }
  return candidates[randomInt(candidates.length) - 1];
}

function scaleGreatTempleEnemy(enemy) {
  const floor = Math.max(1, state.run.dungeonFloor || 1);
  const hpScale = 1 + (floor - 1) * 0.09;
  enemy.hp = Math.ceil(enemy.hp * hpScale);
  enemy.maxHp = enemy.hp;
  enemy.attackBonus += Math.floor((floor - 1) / 4);
  const damage = /^(\d+d\d+)([+-]\d+)?$/i.exec(enemy.damage);
  if (!damage) throw new Error(`Cannot scale unsupported enemy damage "${enemy.damage}".`);
  const damageBonus = Number(damage[2] || 0) + Math.floor((floor - 1) / 4);
  enemy.damage = `${damage[1]}${damageBonus > 0 ? `+${damageBonus}` : damageBonus < 0 ? damageBonus : ""}`;
}

function randomMapFloorNear(target, occupied, minDistance, maxDistance, visibleFrom = null) {
  const options = [];
  for (let y = 0; y < MAP_TILE_SIZE; y += 1) {
    for (let x = 0; x < MAP_TILE_SIZE; x += 1) {
      if (!isWalkable(x, y) || occupied.has(tileIndex(x, y))) continue;
      const distance = Math.max(Math.abs(x - target.x), Math.abs(y - target.y));
      const position = { x, y };
      if (distance >= minDistance && distance <= maxDistance &&
        (!visibleFrom || hasLineOfSight(visibleFrom, position))) options.push(position);
    }
  }
  if (!options.length) return null;
  return options[randomInt(options.length) - 1];
}

function randomMapFloorSpread(occupied, actors, minSpacing, excludedTarget = null, excludedDistance = 0) {
  let options = [];
  for (let y = 0; y < MAP_TILE_SIZE; y += 1) {
    for (let x = 0; x < MAP_TILE_SIZE; x += 1) {
      const position = { x, y };
      if (!isWalkable(x, y) || occupied.has(tileIndex(x, y)) ||
        (excludedTarget && distanceInSquares(position, excludedTarget) <= excludedDistance) ||
        actors.some((actor) => distanceInSquares(actor, position) < minSpacing)) continue;
      options.push(position);
    }
  }
  if (!options.length && minSpacing > 2) return randomMapFloorSpread(occupied, actors, minSpacing - 1, excludedTarget, excludedDistance);
  return options.length ? options[randomInt(options.length) - 1] : null;
}

function createEnemy(template, position, roomIndex, index) {
  return {
    id: `creature-${index}`,
    templateId: template.id,
    sprite: template.sprite || enemySpriteForId(template.id),
    name: template.name,
    description: `${template.description || ""}${template.gear ? ` Gear: ${template.gear}.` : ""}`,
    hp: template.hp,
    maxHp: template.hp,
    ac: template.ac,
    attackBonus: template.attackBonus,
    damage: template.damage,
    initiativeBonus: template.initiativeBonus || 0,
    xp: template.xp,
    edible: Boolean(template.edible),
    x: position.x,
    y: position.y,
    roomIndex,
    alerted: false,
    alive: true
  };
}

function createGreatTempleCaches(player, occupied) {
  for (const treasure of state.run.treasures) occupied.add(tileIndex(treasure.x, treasure.y));
  for (let index = 0; index < 8; index += 1) {
    const position = randomMapFloorSpread(occupied, state.run.treasures, 4, player, 4);
    if (!position) break;
    occupied.add(tileIndex(position.x, position.y));
    const includesItem = randomInt(100) <= 35;
    const itemId = !includesItem ? null : randomInt(100) <= 25
      ? DUNGEON_KEEPSAKE_LOOT[randomInt(DUNGEON_KEEPSAKE_LOOT.length) - 1]
      : state.run.dungeonFloor >= 9 && randomInt(100) <= 35 ? "obsidian-mirror"
        : state.run.dungeonFloor >= 5 && randomInt(100) <= 35 ? "jade-pectoral"
          : randomInt(2) === 1 ? "jade-bead" : "terracotta-figurine";
    const cacheItems = itemId ? [{ id: itemId, quantity: 1 }] : [];
    if (randomInt(100) <= cacheGearChance(state.run.dungeonFloor)) {
      const gear = rollGearDrop(state.run.dungeonFloor);
      if (gear) cacheItems.push({ id: gear, quantity: 1 });
    }
    state.run.treasures.push({
      id: `temple-cache-${index + 1}`,
      ...position,
      gold: (randomInt(8) + randomInt(8)) * Math.ceil(1 + (state.run.dungeonFloor - 1) * 0.15),
      items: cacheItems
    });
  }
}

function createGreatTempleRelics(player, occupied) {
  for (const treasure of state.run.treasures) occupied.add(tileIndex(treasure.x, treasure.y));
  for (const enemy of state.run.enemies) occupied.add(tileIndex(enemy.x, enemy.y));
  for (const hazard of state.run.hazards) occupied.add(tileIndex(hazard.x, hazard.y));
  const relicIds = state.run.dungeonFloor >= 9
    ? ["obsidian-mirror", "incensario"]
    : state.run.dungeonFloor >= 5
      ? ["jade-pectoral", "incensario"]
      : ["jade-pectoral", "incensario", "obsidian-mirror"];
  const relicRooms = shuffle(state.run.rooms.filter((room) =>
    ["quiet", "treasure"].includes(room.type) && !room.mainTreasure
  ));
  for (const [index, itemId] of relicIds.entries()) {
    const relic = { itemId, room: relicRooms[index] || null };
    if (state.run.treasures.some((treasure) => treasure.items.some((item) => item.id === relic.itemId))) continue;
    const position = relic.room
      ? randomRoomFloor(relic.room, occupied)
      : randomMapFloorSpread(occupied, state.run.enemies, 4, player, 6);
    if (!position) throw new Error(`Could not place the starter tomb relic "${relic.itemId}".`);
    occupied.add(tileIndex(position.x, position.y));
    state.run.treasures.push({
      id: `temple-relic-${relic.itemId}`,
      ...position,
      gold: 0,
      items: [{ id: relic.itemId, quantity: 1 }]
    });
  }
}

function createDungeonWells() {
  const occupied = new Set([
    tileIndex(state.run.player.x, state.run.player.y),
    ...(state.run.mapId === GTFL_MAP_ID ? [tileIndex(9, 22)] : []),
    ...state.run.party.filter((member) => Number.isInteger(member.x) && Number.isInteger(member.y))
      .map((member) => tileIndex(member.x, member.y)),
    ...state.run.enemies.filter((enemy) => enemy.alive).map((enemy) => tileIndex(enemy.x, enemy.y)),
    ...state.run.hazards.filter((hazard) => !hazard.triggered).map((hazard) => tileIndex(hazard.x, hazard.y)),
    ...state.run.treasures.map((treasure) => tileIndex(treasure.x, treasure.y))
  ]);
  const rooms = shuffle(state.run.rooms.filter((room) =>
    ["quiet", "treasure"].includes(room.type) && !room.mainTreasure &&
    room.mapW >= 3 && room.mapH >= 3
  ));
  const count = Math.min(2, Math.max(1, Math.floor(rooms.length / 3)));
  const wells = [];
  for (const room of rooms) {
    if (wells.length >= count) break;
    const position = randomRoomFloor(room, occupied);
    if (!position || wells.some((well) => distanceInSquares(well, position) < 8)) continue;
    const well = {
      id: `dungeon-well-${wells.length + 1}`,
      ...position,
      roomIndex: state.run.rooms.indexOf(room)
    };
    wells.push(well);
    occupied.add(tileIndex(position.x, position.y));
  }
  return wells;
}

function enemySpriteForId(id) {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return ENEMY_SPRITES[hash % ENEMY_SPRITES.length];
}

function enemySpriteId(enemy) {
  return ENEMY_SPRITES.includes(enemy?.sprite)
    ? enemy.sprite
    : state.pack.enemies.find((template) => template.id === enemy?.templateId)?.sprite || enemySpriteForId(enemy?.templateId || "");
}

function createHazards(rooms, occupied) {
  const genericHazards = [
    { kind: "dart", name: "Hidden dart slit", dc: 12, damage: "1d6", ability: "Dexterity" },
    { kind: "pit", name: "Loose flagstone", dc: 12, damage: "1d8", ability: "Dexterity" },
    { kind: "mist", name: "Poison vapor vent", dc: 12, damage: "1d6", ability: "Constitution" }
  ];
  if (state.run.mapId === GTFL_MAP_ID) {
    const hazards = [];
    for (const stair of state.run.floorStairs) occupied.add(tileIndex(stair.x, stair.y));
    for (let index = 0; index < 5; index += 1) {
      const position = randomMapFloorSpread(occupied, hazards, 5, state.run.player, 5);
      if (!position) break;
      const hazard = genericHazards[randomInt(genericHazards.length) - 1];
      occupied.add(tileIndex(position.x, position.y));
      hazards.push({ ...hazard, ...position, roomIndex: -1, revealed: false, triggered: false });
    }
    return hazards;
  }
  const hazards = [];
  const trapRooms = state.pack.rooms.filter((room) => room.type === "trap");
  for (let index = 0; index < rooms.length - 1; index += 1) {
    const room = rooms[index];
    const guaranteed = room.type === "trap";
    if (!guaranteed && randomInt(100) > 38) continue;
    const position = randomRoomFloor(room, occupied);
    if (!position) continue;
    const customTrap = guaranteed ? trapRooms[randomInt(trapRooms.length) - 1] : null;
    const hazard = customTrap
      ? { kind: "dart", name: customTrap.name, dc: customTrap.dc, damage: customTrap.damage, ability: "Dexterity", text: customTrap.text }
      : genericHazards[randomInt(genericHazards.length) - 1];
    occupied.add(tileIndex(position.x, position.y));
    hazards.push({ ...hazard, ...position, roomIndex: index, revealed: false, triggered: false });
  }
  if (!hazards.length && rooms.length > 2) {
    const fallbackRooms = shuffle(rooms.slice(1, -1));
    for (const room of fallbackRooms) {
      const position = randomRoomFloor(room, occupied);
      if (!position) continue;
      occupied.add(tileIndex(position.x, position.y));
      hazards.push({ ...genericHazards[randomInt(genericHazards.length) - 1], ...position, roomIndex: rooms.indexOf(room), revealed: false, triggered: false });
      break;
    }
  }
  return hazards;
}

function revealAroundPlayer() {
  const { x, y } = state.run.player;
  const currentRoomIndex = roomIndexAt(x, y);
  if (currentRoomIndex >= 0) state.run.rooms[currentRoomIndex].visited = true;
  for (let dy = -4; dy <= 4; dy += 1) {
    for (let dx = -4; dx <= 4; dx += 1) {
      if (dx * dx + dy * dy > 16) continue;
      const tx = x + dx;
      const ty = y + dy;
      if (tx >= 0 && tx < MAP_TILE_SIZE && ty >= 0 && ty < MAP_TILE_SIZE) state.run.seen[tileIndex(tx, ty)] = true;
    }
  }
  const passivePerception = 10 + skillBonus("perception");
  const noticedHazards = state.run.hazards.filter((hazard) =>
    !hazard.triggered && !hazard.revealed && hazard.dc <= passivePerception &&
    distanceInSquares(hazard, state.run.player) <= 2 && hasLineOfSight(state.run.player, hazard)
  );
  for (const hazard of noticedHazards) hazard.revealed = true;
  if (noticedHazards.length) {
    addLog(`You notice ${noticedHazards.length === 1 ? noticedHazards[0].name : `${noticedHazards.length} hidden hazards`} before stepping into danger (passive Perception ${passivePerception}).`);
  }
}

function initializeDungeon() {
  if (!Number.isInteger(state.run.dungeonFloor)) state.run.dungeonFloor = 1;
  const dungeon = generateDungeon();
  const startRoom = dungeon.rooms[0];
  const player = {
    x: startRoom.anchorX ?? startRoom.mapX + Math.floor(startRoom.mapW / 2),
    y: startRoom.anchorY ?? startRoom.mapY + Math.floor(startRoom.mapH / 2),
    facing: "south"
  };
  state.run.mapId = dungeon.mapId || null;
  state.run.dungeonLayoutVersion = dungeon.layoutVersion || 1;
  state.run.floorStairs = dungeon.floorStairs || [];
  state.run.rooms = dungeon.rooms;
  state.run.terrain = dungeon.terrain;
  state.run.openDoors = [];
  state.run.player = player;
  state.run.currentRoom = 0;
  state.run.enemies = [];
  state.run.hazards = [];
  state.run.treasures = [];
  state.run.wells = [];
  state.run.seen = Array(MAP_TILE_SIZE * MAP_TILE_SIZE).fill(false);
  state.run.steps = 0;
  state.run.won = false;
  state.run.lost = false;
  const occupied = new Set([tileIndex(player.x, player.y)]);
  for (const stair of state.run.floorStairs) occupied.add(tileIndex(stair.x, stair.y));
  const mainTreasureRoom = state.run.rooms.find((room) => room.mainTreasure);
  if (mainTreasureRoom) occupied.add(tileIndex(mainTreasureRoom.anchorX, mainTreasureRoom.anchorY));
  state.run.enemies = createEnemies(state.run.rooms, player);
  const bossRoomIndex = state.run.rooms.findIndex((room) => room.type === "boss");
  if (state.run.mapId === GTFL_MAP_ID && state.run.dungeonFloor === DUNGEON_FLOOR_COUNT) {
    const finalBoss = state.pack.enemies.find((enemy) => enemy.id === "tzitzimitl");
    const boss = state.run.enemies.find((enemy) => enemy.roomIndex === bossRoomIndex);
    if (!finalBoss || !boss) throw new Error("The final tomb floor requires a Tzitzimitl boss and boss chamber.");
    Object.assign(boss, {
      templateId: finalBoss.id,
      sprite: finalBoss.sprite,
      name: finalBoss.name,
      description: `${finalBoss.description || ""}${finalBoss.gear ? ` Gear: ${finalBoss.gear}.` : ""}`,
      hp: finalBoss.hp,
      maxHp: finalBoss.hp,
      ac: finalBoss.ac,
      attackBonus: finalBoss.attackBonus,
      damage: finalBoss.damage,
      initiativeBonus: finalBoss.initiativeBonus || 0,
      xp: finalBoss.xp,
      edible: Boolean(finalBoss.edible),
      inflicts: PROGRESSION.creatureConditions.tzitzimitl ? { ...PROGRESSION.creatureConditions.tzitzimitl } : undefined,
      guardian: true,
      greatGuardian: true
    });
    state.run.rooms[bossRoomIndex].optionalQuest = true;
  }
  for (const enemy of state.run.enemies) occupied.add(tileIndex(enemy.x, enemy.y));
  state.run.hazards = createHazards(state.run.rooms, occupied);
  state.run.mainTreasureClaimed = false;
  state.run.questComplete = false;
  if (mainTreasureRoom) {
    state.run.treasures.push({
      id: "great-temple-treasure",
      x: mainTreasureRoom.anchorX,
      y: mainTreasureRoom.anchorY,
      gold: 12,
      items: [{ id: "terracotta-figurine", quantity: 1 }],
      mainGoal: true
    });
  }
  if (state.run.mapId === GTFL_MAP_ID) {
    createGreatTempleCaches(player, new Set(occupied));
    createGreatTempleRelics(player, new Set(occupied));
    state.run.fixedMapContentVersion = 2;
  }
  state.run.wells = createDungeonWells();
  state.run.wellsInitialized = true;
  refreshCompanionFormation();
  revealAroundPlayer();
  return startRoom;
}

function copyDungeonValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function saveDungeonFloorState() {
  const floor = state.run.dungeonFloor;
  state.run.dungeonFloors ||= {};
  state.run.dungeonFloors[String(floor)] = {
    floor,
    dungeonLayoutVersion: state.run.dungeonLayoutVersion || 1,
    mapId: state.run.mapId,
    rooms: copyDungeonValue(state.run.rooms),
    terrain: [...state.run.terrain],
    openDoors: [...state.run.openDoors],
    player: { ...state.run.player },
    currentRoom: state.run.currentRoom,
    enemies: copyDungeonValue(state.run.enemies),
    hazards: copyDungeonValue(state.run.hazards),
    treasures: copyDungeonValue(state.run.treasures),
    wells: copyDungeonValue(state.run.wells),
    wellsInitialized: state.run.wellsInitialized,
    seen: [...state.run.seen],
    steps: state.run.steps,
    mainTreasureClaimed: state.run.mainTreasureClaimed,
    questComplete: state.run.questComplete,
    fixedMapContentVersion: state.run.fixedMapContentVersion || 0,
    floorStairs: copyDungeonValue(state.run.floorStairs || [])
  };
}

function restoreDungeonFloorState(snapshot, entryId) {
  const snapshotSigns = dungeonSignsForSnapshot(snapshot);
  const destinationStair = snapshot.floorStairs?.find((stair) => stair.id === entryId) ||
    snapshotSigns.find((stair) => stair.id === entryId) ||
    (snapshot.dungeonLayoutVersion !== 2
      ? snapshotSigns.find((stair) =>
        stair.type === "stairs-down" && stair.id === `connection-${snapshot.floor}-1`
      )
      : null);
  if (!destinationStair) throw new Error(`Dungeon floor ${snapshot.floor} is missing stair connection "${entryId}".`);
  state.run.dungeonFloor = snapshot.floor;
  for (const key of [
    "dungeonLayoutVersion", "mapId", "rooms", "terrain", "openDoors", "currentRoom",
    "enemies", "hazards", "treasures", "wells", "wellsInitialized", "seen", "steps",
    "mainTreasureClaimed", "questComplete", "fixedMapContentVersion", "floorStairs"
  ]) state.run[key] = copyDungeonValue(snapshot[key]);
  state.run.player = { ...snapshot.player, x: destinationStair.x, y: destinationStair.y };
  state.run.location = "dungeon";
  state.run.won = false;
  state.run.lost = false;
  state.run.currentRoom = roomIndexAt(state.run.player.x, state.run.player.y);
  refreshCompanionFormation();
  revealAroundPlayer();
}

function dungeonSignsForSnapshot(snapshot) {
  if (snapshot.dungeonLayoutVersion === 2) return snapshot.floorStairs || [];
  if (snapshot.rooms.length === 3) {
    const entrance = snapshot.rooms.find((room) => room.type === "entrance");
    const downPosition = [
      { x: entrance?.anchorX + 1, y: entrance?.anchorY },
      { x: entrance?.anchorX - 1, y: entrance?.anchorY },
      { x: entrance?.anchorX, y: entrance?.anchorY + 1 }
    ].find(({ x, y }) =>
      Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < MAP_TILE_SIZE &&
      y >= 0 && y < MAP_TILE_SIZE && snapshot.terrain[tileIndex(x, y)] === "floor"
    );
    if (!entrance || !downPosition) {
      throw new Error(`Legacy dungeon floor ${snapshot.floor} has no valid stair landing.`);
    }
    const signs = GTFL_LEGACY_MAP_SIGNS.filter((sign) => !sign.type.startsWith("stairs"));
    const stairs = snapshot.floor === 1
      ? [{ x: entrance.anchorX, y: entrance.anchorY, id: "surface-entrance", type: "stairs-up", role: "entrance", name: "Surface entrance" }]
      : [{ x: entrance.anchorX, y: entrance.anchorY, id: `connection-${snapshot.floor - 1}-1`, type: "stairs-up", targetFloor: snapshot.floor - 1, name: "Stairs up" }];
    stairs.push(snapshot.floor === DUNGEON_FLOOR_COUNT
      ? { ...downPosition, id: "surface-exit", type: "exit", role: "exit", name: "Tomb exit" }
      : { ...downPosition, id: `connection-${snapshot.floor}-1`, type: "stairs-down", targetFloor: snapshot.floor + 1, name: "Stairs down" });
    return [...signs, ...stairs];
  }
  const signs = GTFL_MAP_SIGNS;
  return signs.flatMap((sign) => {
    if (sign.type === "stairs-down") {
      return snapshot.floor === DUNGEON_FLOOR_COUNT
        ? [{ ...sign, id: "surface-exit", type: "exit", role: "exit" }]
        : [{ ...sign, id: `connection-${snapshot.floor}-1`, targetFloor: snapshot.floor + 1 }];
    }
    if (sign.type !== "stairs-up") return [sign];
    if (sign.x === 5 && sign.y === 5 && snapshot.floor === 1) {
      return [{ ...sign, id: "surface-entrance", role: "entrance" }];
    }
    if (sign.x === 5 && sign.y === 5 && snapshot.floor > 1) {
      return [{
        ...sign, id: `connection-${snapshot.floor - 1}-1`,
        targetFloor: snapshot.floor - 1, name: "Stairs up"
      }];
    }
    return [];
  });
}

function newRun(character) {
  if (!character.equipmentEnhancements) {
    character.equipmentEnhancements = { weaponIds: [], armorIds: [] };
  }
  const stats = character.legacy ? { maxHp: 18 } : deriveCharacter(character);
  const inventory = buildStartingInventory(character);
  if (getCarriedWeight(inventory, 10) > getCarryCapacity(character)) {
    throw new Error("This character's starting kit exceeds their carrying capacity.");
  }
  state.gameStarted = true;
  state.dashReady = false;
  state.disengageReady = false;
  state.combatEffects = [];
  state.run = {
    location: "city",
    dungeonFloor: 1,
    dungeonFloors: {},
    hasEnteredDungeon: false,
    character,
    factions: createFactionState(),
    progress: createProgress(),
    needs: createNeeds(),
    party: [],
    townPosition: { x: 5, y: 4 },
    rooms: [],
    terrain: [],
    openDoors: [],
    player: { x: 0, y: 0 },
    currentRoom: 0,
    mapId: null,
    gameHours: 8,
    gameMinutes: 8 * 60,
    enemies: [],
    hazards: [],
    treasures: [],
    wells: [],
    wellsInitialized: false,
    seen: [],
    steps: 0,
    inventory,
    unsecuredLoot: { gold: 0, items: [] },
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    gold: 10,
    xp: 0,
    level: 1,
    spellSlots: maxSpellSlots(character.class),
    gatheringWaterRemainder: 0,
    gourmetGuideOwned: false,
    patolliGame: null,
    asiLevelsChosen: [],
    won: false,
    lost: false,
    mainTreasureClaimed: false,
    questComplete: false,
    dodging: false,
    log: [
      TOMB_HISTORY,
      "You arrive in Chiltomatlan, where you can rest, recover, trade, and choose what to pursue before each descent."
    ]
  };
  initializeDungeon();
  render();
}

function beginNewDelve() {
  state.dashReady = false;
  state.disengageReady = false;
  state.run.unsecuredLoot = { gold: 0, items: [] };
  state.run.dungeonFloor = 1;
  state.run.dungeonFloors = {};
  const room = initializeDungeon();
  state.run.location = "dungeon";
  state.run.hasEnteredDungeon = true;
  state.run.log.unshift(`You leave Chiltomatlan and enter ${room.name}.`);
  state.run.log = state.run.log.slice(0, 30);
  render();
}

function upgradeGreatTempleContent() {
  if (state.run.mapId !== GTFL_MAP_ID || state.run.fixedMapContentVersion >= 2) return;
  if (!state.run.won && !state.run.lost) {
    if (state.run.fixedMapContentVersion < 1) {
      const roamingEnemies = state.run.enemies.filter((enemy) => enemy.roomIndex < 0).length;
      addGreatTempleRoamers(state.run.player, Math.max(0, 8 - roamingEnemies));
      if (!state.run.treasures.some((treasure) => treasure.id.startsWith("temple-cache-"))) {
        const occupied = new Set([
          tileIndex(state.run.player.x, state.run.player.y),
          ...state.run.enemies.filter((enemy) => enemy.alive).map((enemy) => tileIndex(enemy.x, enemy.y)),
          ...state.run.hazards.filter((hazard) => !hazard.triggered).map((hazard) => tileIndex(hazard.x, hazard.y))
        ]);
        createGreatTempleCaches(state.run.player, occupied);
      }
    }
    createGreatTempleRelics(state.run.player, new Set([
      tileIndex(state.run.player.x, state.run.player.y),
      ...state.run.party.map((member) => tileIndex(member.x, member.y)),
      ...state.run.enemies.filter((enemy) => enemy.alive).map((enemy) => tileIndex(enemy.x, enemy.y)),
      ...state.run.hazards.filter((hazard) => !hazard.triggered).map((hazard) => tileIndex(hazard.x, hazard.y))
    ]));
  }
  state.run.fixedMapContentVersion = 2;
}
