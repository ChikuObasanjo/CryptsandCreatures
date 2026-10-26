"use strict";

const {
  food: FOOD_ITEMS,
  nutrientAbilities: NUTRIENT_ABILITIES,
  nutrientNames: NUTRIENT_NAMES,
  rareTreasureSprites: RARE_TREASURE_SPRITES,
  dungeonKeepsakeLoot: DUNGEON_KEEPSAKE_LOOT,
  weapons: WEAPONS,
  armors: ARMORS,
  weaponPrices: WEAPON_PRICES,
  armorPrices: ARMOR_PRICES,
  cosmetics: COSMETICS,
  gear: GEAR_ITEMS,
  classPacks: CLASS_PACKS,
  legacyTravelPackIds
} = window.CryptsItems;
const ENEMY_SPRITES = window.CryptsEnemies.sprites;
const {
  factions: FACTIONS,
  factionMilestones: FACTION_MILESTONES,
  townIntroductions: TOWN_INTRODUCTIONS,
  tombHistory: TOMB_HISTORY,
  starterPack
} = window.CryptsContent;
const LEGACY_TRAVEL_PACK_IDS = new Set(legacyTravelPackIds);
const CLASS_SPELLS = window.CryptsSpells.byClass;
const SPELLS = window.CryptsSpells.catalog;
const STORE_KEYS = {
  pack: "crypts-and-creatures.pack.v1",
  run: "crypts-and-creatures.run.v1",
  saveIndex: "crypts-and-creatures.saves.v1",
  saveSlotPrefix: "crypts-and-creatures.save.v1.",
  language: "crypts-and-creatures.language.v1",
  darkMode: "crypts-and-creatures.dark-mode.v1",
  font: "crypts-and-creatures.font.v1",
  padSize: "crypts-and-creatures.pad-size.v1",
  mapZoom: "crypts-and-creatures.map-zoom.v1"
};
// Map zoom: 0 shows 7 tiles across the short side on phones and 9 on wider screens;
// each step in (+) shows two fewer, each step out (−) two more.
const MAP_ZOOM_MIN = -3;
const MAP_ZOOM_MAX = 2;
const PAD_SIZES = ["normal", "large", "xl"];
let mapZoom = 0;
function applyPadSize(size) {
  const choice = PAD_SIZES.includes(size) ? size : "large";
  document.body.classList.toggle("pad-size-normal", choice === "normal");
  document.body.classList.toggle("pad-size-xl", choice === "xl");
  return choice;
}
function setMapZoom(next, { announce = false } = {}) {
  const value = Math.max(MAP_ZOOM_MIN, Math.min(MAP_ZOOM_MAX, Math.round(Number(next) || 0)));
  const changed = value !== mapZoom;
  mapZoom = value;
  const slider = document.getElementById("map-zoom");
  if (slider) slider.value = String(value);
  const zoomOut = document.getElementById("map-zoom-out");
  const zoomIn = document.getElementById("map-zoom-in");
  if (zoomOut) zoomOut.disabled = value <= MAP_ZOOM_MIN;
  if (zoomIn) zoomIn.disabled = value >= MAP_ZOOM_MAX;
  try { localStorage.setItem(STORE_KEYS.mapZoom, String(value)); } catch { /* private mode */ }
  if (changed && state.gameStarted && ["city", "dungeon"].includes(state.run?.location)) {
    renderMap();
    if (announce) showToast(t("Map zoom {0}", { 0: value > 0 ? `+${value}` : String(value) }));
  }
  return value;
}
function dungeonViewShape() {
  const across = Math.max(3, (window.matchMedia("(max-width: 540px)").matches ? MOBILE_MAP_VIEW_SIZE : DESKTOP_MAP_VIEW_SIZE) - 2 * mapZoom);
  const viewport = elements["dungeon-map-viewport"];
  const width = viewport?.clientWidth || 0;
  const height = viewport?.clientHeight || 0;
  if (width < 60 || height < 60) return { cols: across, rows: across, tile: 0 };
  const tile = Math.floor(Math.min(width, height) / across);
  const odd = (count) => {
    const whole = Math.max(3, Math.min(19, Math.floor(count)));
    return whole % 2 ? whole : whole - 1;
  };
  return { cols: odd(width / tile), rows: odd(height / tile), tile };
}
const FONT_CHOICES = ["unifont", "codex"];
function applyFontChoice(font) {
  const choice = FONT_CHOICES.includes(font) ? font : "unifont";
  document.body.classList.toggle("font-unifont", choice === "unifont");
  return choice;
}
const t = (key, values) => window.cryptsLocale.t(key, values);
const DIRECTIONS = [
  { x: 0, y: -1, label: "↑", name: "north", key: "ArrowUp" },
  { x: 1, y: 0, label: "→", name: "east", key: "ArrowRight" },
  { x: 0, y: 1, label: "↓", name: "south", key: "ArrowDown" },
  { x: -1, y: 0, label: "←", name: "west", key: "ArrowLeft" }
];
const TOWN_WELL = { x: 8, y: 7, name: "Ceiba Well" };
const TOWN_SPAWN = { x: 8, y: 12 };
const TOWN_PLAZA = { x: 8, y: 8 };
// PC controls: the arrow keys or the numpad move; Numpad 7 9 1 3 (or Home, PgUp, End, PgDn)
// move diagonally. Space, Enter, or E interacts. Number keys cast spells.
const ORTHOGONAL_KEYS = { north: ["Numpad8"], east: ["Numpad6"], south: ["Numpad2"], west: ["Numpad4"] };
const MOVEMENT_DIRECTIONS = [
  ...DIRECTIONS.map((direction) => ({ ...direction, keys: [direction.key, ...ORTHOGONAL_KEYS[direction.name]] })),
  { x: -1, y: -1, label: "↖", name: "northwest", keys: ["Numpad7", "Home"] },
  { x: 1, y: -1, label: "↗", name: "northeast", keys: ["Numpad9", "PageUp"] },
  { x: -1, y: 1, label: "↙", name: "southwest", keys: ["Numpad1", "End"] },
  { x: 1, y: 1, label: "↘", name: "southeast", keys: ["Numpad3", "PageDown"] }
];
// Menus, from anywhere in the game.
const MENU_KEYS = { i: "gear", o: "equipment", k: "abilities", p: "info" };
const ROOM_GRID_SIZE = 5;
const MAP_TILE_SIZE = 45;
const DUNGEON_FLOOR_COUNT = 13;
const LEGACY_MAP_TILE_SIZE = ROOM_GRID_SIZE * 7;
const PROCEDURAL_MAP_OFFSET = Math.floor((MAP_TILE_SIZE - LEGACY_MAP_TILE_SIZE) / 2);
const GTFL_MAP_ID = "gtfl-level-1";
const TOWN_MAP_VERSION = 5;
const TOWN_LAYOUT = {
  columns: 17,
  rows: 15,
  districts: [
    { id: "ceremonial", name: "Ceremonial core", bounds: { x: 5, y: 1, width: 7, height: 9 } },
    { id: "west-quarter", name: "Western homes and gardens", bounds: { x: 1, y: 1, width: 3, height: 12 } },
    { id: "east-quarter", name: "Market and crafts quarter", bounds: { x: 13, y: 1, width: 3, height: 12 } },
    { id: "south-quarter", name: "Southern homes and gathering court", bounds: { x: 5, y: 10, width: 7, height: 3 } }
  ],
  processionalRoute: { x: 8, fromY: 5, toY: 13 },
  marketRoute: { y: 7, fromX: 1, toX: 15 },
  plaza: { x: 5, y: 5, width: 7, height: 5 },
  canals: [
    { x: 4, fromY: 4, toY: 13, bridgeRows: [4, 5, 6, 7, 11, 13] },
    { x: 12, fromY: 4, toY: 13, bridgeRows: [4, 5, 6, 7, 11, 13] }
  ],
  irrigation: {
    y: 9, fromX: 4, toX: 12, bridgeX: 8,
    feeder: { x: 8, fromY: 8, toY: 9, bridgeY: 8 }
  },
  buildings: [
    { id: "inn", district: "west-quarter", code: "I", name: "Ceiba House inn", x: 1, y: 1, width: 2, height: 2 },
    { id: "market", district: "east-quarter", code: "M", name: "Chiltomatlan market stalls", x: 14, y: 1, width: 2, height: 2 },
    { id: "temple", district: "ceremonial", code: "T", name: "Great stepped temple", tilePrefix: "town-temple", x: 7, y: 3, width: 3, height: 2 },
    { id: "home", district: "west-quarter", code: "H", name: "An empty house for sale", x: 1, y: 11, width: 2, height: 2 },
    { id: "garden", district: "west-quarter", code: "G", name: "Canal Garden", tilePrefix: "town-garden", projectId: "granary", projectLevel: 1, x: 2, y: 5, width: 2, height: 2 },
    { id: "orchard", district: "west-quarter", code: "O", name: "Community Orchard", tilePrefix: "town-orchard", projectId: "granary", projectLevel: 2, x: 2, y: 9, width: 2, height: 2 },
    { id: "workshop", district: "east-quarter", code: "K", name: "Calpulli Crafts Hall", tilePrefix: "town-crafts-hall", projectId: "workshop", projectLevel: 2, x: 13, y: 8, width: 2, height: 2 },
    { id: "pavilion", district: "south-quarter", code: "A", name: "Plaza Pavilion", tilePrefix: "town-pavilion", projectId: "shrine", projectLevel: 2, x: 10, y: 11, width: 2, height: 2 }
  ],
  gate: { x: 8, y: 14 }
};
const TOWN_BUILDINGS = TOWN_LAYOUT.buildings;
function buildTownMap(projectLevels = {}) {
  const map = Array.from({ length: TOWN_LAYOUT.rows }, (_, y) =>
    Array.from({ length: TOWN_LAYOUT.columns }, (_, x) =>
      y === 0 || y === TOWN_LAYOUT.rows - 1 || x === 0 || x === TOWN_LAYOUT.columns - 1 ? "#" : "."));
  for (let x = TOWN_LAYOUT.marketRoute.fromX; x <= TOWN_LAYOUT.marketRoute.toX; x += 1) {
    map[TOWN_LAYOUT.marketRoute.y][x] = "r";
  }
  for (let y = TOWN_LAYOUT.processionalRoute.fromY; y <= TOWN_LAYOUT.processionalRoute.toY; y += 1) {
    map[y][TOWN_LAYOUT.processionalRoute.x] = "r";
  }
  for (let y = TOWN_LAYOUT.plaza.y; y < TOWN_LAYOUT.plaza.y + TOWN_LAYOUT.plaza.height; y += 1) {
    for (let x = TOWN_LAYOUT.plaza.x; x < TOWN_LAYOUT.plaza.x + TOWN_LAYOUT.plaza.width; x += 1) {
      if (map[y][x] !== "r") map[y][x] = "p";
    }
  }
  for (const canal of TOWN_LAYOUT.canals) {
    for (let y = canal.fromY; y <= canal.toY; y += 1) {
      map[y][canal.x] = "~";
    }
  }
  for (let x = TOWN_LAYOUT.irrigation.fromX; x <= TOWN_LAYOUT.irrigation.toX; x += 1) {
    map[TOWN_LAYOUT.irrigation.y][x] = "~";
  }
  for (let y = TOWN_LAYOUT.irrigation.feeder.fromY; y <= TOWN_LAYOUT.irrigation.feeder.toY; y += 1) {
    map[y][TOWN_LAYOUT.irrigation.feeder.x] = "~";
  }
  for (const canal of TOWN_LAYOUT.canals) {
    for (const y of canal.bridgeRows) map[y][canal.x] = "B";
  }
  map[TOWN_LAYOUT.irrigation.feeder.bridgeY][TOWN_LAYOUT.irrigation.feeder.x] = "B";
  map[TOWN_LAYOUT.irrigation.y][TOWN_LAYOUT.irrigation.bridgeX] = "V";
  for (const building of TOWN_BUILDINGS) {
    if (building.projectId && (projectLevels[building.projectId] || 0) < building.projectLevel) continue;
    const district = TOWN_LAYOUT.districts.find((entry) => entry.id === building.district);
    if (!district || building.x < district.bounds.x || building.y < district.bounds.y ||
      building.x + building.width > district.bounds.x + district.bounds.width ||
      building.y + building.height > district.bounds.y + district.bounds.height) {
      throw new Error(`Town building ${building.id} is outside its configured district.`);
    }
    for (let y = building.y; y < building.y + building.height; y += 1) {
      for (let x = building.x; x < building.x + building.width; x += 1) {
        if (!map[y] || ![".", "r", "p"].includes(map[y][x])) {
          throw new Error(`Town building ${building.id} overlaps a route, canal, bridge, or another building.`);
        }
        map[y][x] = building.code;
      }
    }
  }
  map[TOWN_WELL.y][TOWN_WELL.x] = "W";
  map[TOWN_LAYOUT.gate.y][TOWN_LAYOUT.gate.x] = "D";
  return map;
}
const TOWN_MAP = buildTownMap();
let cachedTownMapKey = "";
let cachedTownMap = null;
function townMapAtLevel(projectLevels = {}) {
  const key = TOWN_BUILDINGS.filter((building) => building.projectId)
    .map((building) => projectLevels[building.projectId] || 0).join(",");
  if (cachedTownMap && cachedTownMapKey === key) return cachedTownMap;
  const map = buildTownMap(projectLevels);
  cachedTownMapKey = key;
  cachedTownMap = map;
  return map;
}
function townMapAtCurrentLevel() {
  return townMapAtLevel(state.run?.progress?.town || {});
}
const TOWN_NPCS = [
  { id: "gear-mender", name: "Mahuiz, trader in strange wares", x: 6, y: 5, glyph: "G", faction: null },
  { id: "innkeeper", name: "Nali, keeper of the travelers' house", x: 3, y: 2, glyph: "N", faction: "ceiba-house" },
  { id: "merchant", name: "Teyac, market trader", x: 13, y: 2, glyph: "T", faction: "traders-circle" },
  { id: "temple-keeper", name: "Xochi, keeper of the sealed road", x: 10, y: 5, glyph: "X", faction: "road-wardens" },
  { id: "patolli-player", name: "Ixchel, keeper of the Patolli board", x: 2, y: 7, glyph: "P", faction: null },
  { id: "master-builder", name: "Tlacotl, master builder", x: 14, y: 7, glyph: "B", faction: null }
];
const MOBILE_MAP_VIEW_SIZE = 7;
const DESKTOP_MAP_VIEW_SIZE = 9;
const DICE_PATTERN = /^([1-4])d(4|6|8|10|12|20)([+-]\d{1,2})?$/i;
const XP_THRESHOLDS = [0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
const MAX_LEVEL = 20;
const HEALER_KIT_USES = 10;
const GEAR_REWARD_COOLDOWN_MS = 60 * 60 * 1000;
const GEAR_REWARD_COOLDOWN_KEY = "crypts-and-creatures.gear-reward.last-claim.v1";
const FOOD_DRAIN_PER_HOUR = 4;
const WATER_DRAIN_PER_HOUR = 6;
const NUTRIENT_DECAY_HOURS = 12;
const HEALING_FOOD_THRESHOLD = 75;
const ASI_LEVELS = new Set([4, 8, 12, 16, 19]);
const MAX_GOLD = 1_000_000;
const SPRITE_RESOURCE_VERSION = 82;

const GTFL_MAP_ROWS = [
  "#####........##..#............#.........#....",
  "###.....#...#.#...##......##..#.....#...#.#..",
  ".#..##.######..#####......###...#######.#.#..",
  ".#..#..###..#....##.#####.##....#..###..#.###",
  ".##....###....#..##....#..##..#.#..#.#..#....",
  ".###.....#..###.....###...##..####..#........",
  "...##.......###..##.....##.#..###..#.........",
  "...########.###.###.......#######.########...",
  ".#.##...##...#...##.#####.##...#...##..#####.",
  "....#...##...#....#.......##........#..##....",
  ".......#...##....#..............##...#.......",
  "#...#..#....#.....##..#....###..##...#.......",
  ".####..#....#..#####.#########..##...#..####.",
  ".####..#######...##..#######...###.###..###..",
  "....#..###...#...##..#...###...#........#.#..",
  ".##......#...#.......#.#.##....#..........#..",
  ".##.##.#.#...#######.#.#.#####.#...#.####.#..",
  "#.#########.##.####.#########..#############.",
  "..##...####.##..###...#...#.#.######.#...#...",
  "...#...##.........#...#...##........##...##..",
  "###....##........#.........#........#.....#..",
  "###....##......###.........###......##....#..",
  "###....####....###############....#####...##.",
  "###....##.......##.........###......###...#.#",
  "###....##........#..................#.....#..",
  "..##...##..###...##...#...##.....#..#....##..",
  "..##...###.###.####...#...####.##.####...##..",
  "..#######.####...####.###.#######.######.###.",
  "..#.#..#.#...#..##...#.#..######...#.#..#.##.",
  "..#.#..#.....#..#....#.#................#.##.",
  "..#.#..#.........#...#.#......#....###..####.",
  "..###..##.#####..#######.###...#######...###.",
  ".####..#....#..##########.##.#..#....#..####.",
  "....#..#........#.....#...###........#..#....",
  "....####...##....#....#..###....#....##.#....",
  "....###.##...#...##........#.......##.#.#...#",
  ".#####..##...#...###########...#...##...#####",
  "...#######.########.......####.#######..##...",
  ".......##........##........#...#####....##...",
  "#......##.....#..##....#.......######...#....",
  "#.#.#..#.#..#.#.......#...##..#.#..###....##.",
  "#.#.#..##...#....###.####.##....#..###..#.#..",
  "..#.##.####.#..###.......####...##.####.#.#.#",
  "..#.#...#...#....##......###..#....##...#...#",
  ".........................###..#.............#"
];
const GTFL_MAP_SIGNS = [
  { x: 5, y: 5, type: "stairs-up", name: "Tomb entrance" },
  { x: 8, y: 5, type: "door", name: "Door" },
  { x: 15, y: 5, type: "door", name: "Door" },
  { x: 23, y: 5, type: "door", name: "Door" },
  { x: 30, y: 5, type: "door", name: "Door" },
  { x: 34, y: 8, type: "trapped", name: "Door" },
  { x: 34, y: 16, type: "locked", name: "Door" },
  { x: 30, y: 20, type: "door", name: "Door" },
  { x: 24, y: 20, type: "door", name: "Door" },
  { x: 16, y: 20, type: "secret", glyph: "?", name: "Hidden passage" },
  { x: 9, y: 22, type: "stairs-down", glyph: "↓", name: "Deep tomb stair" }
];
const GTFL_LEGACY_MAP_SIGNS = [
  { x: 9, y: 0, type: "door", name: "Door" },
  { x: 19, y: 2, type: "door", name: "Door" },
  { x: 25, y: 4, type: "door", name: "Door" },
  { x: 1, y: 8, type: "door", name: "Door" },
  { x: 9, y: 9, type: "trapped", name: "Door" },
  { x: 1, y: 10, type: "secret", name: "Hidden passage" },
  { x: 26, y: 11, type: "locked", name: "Door" },
  { x: 6, y: 12, type: "door", name: "Door" },
  { x: 28, y: 12, type: "door", name: "Door" },
  { x: 9, y: 15, type: "stairs-up", name: "Stairs up" },
  { x: 39, y: 11, type: "stairs-down", name: "Stairs down" }
];

const state = {
  pack: starterPack,
  run: null,
  activeSaveId: null,
  gameStarted: false,
  dashReady: false,
  disengageReady: false,
  scoreRolls: [],
  combatEffects: [],
  toastTimer: 0,
  messageBox: null,
  messageReturnFocus: null,
  autoActionGroup: null,
  characterTab: "equipment",
  characterInfoPage: 0,
  storeCategory: "supplies",
  inventoryFilter: "all",
  listPages: { equipment: 0, inventory: 0, storeBuy: 0, storeSell: 0 },
  dialogCopies: {},
  utilityDrawer: null,
  lookMode: false,
  patolliTutorialOnly: false,
  patolliRulesOpen: false,
  patolliRulesPage: 0,
  patolliAutoplay: false,
  patolliAutoplayTimer: 0,
  patolliAnimation: null,
  patolliAnimationTimer: 0,
  patolliTossAnimation: false,
  patolliTossAnimationTimer: 0,
  lookTarget: null,
  previewFacing: "east",
  characterCreationStep: 0
};

let deferredInstallPrompt = null;
let pwaInstallAccepted = false;

function isInstalledPwa() {
  return pwaInstallAccepted || window.matchMedia("(display-mode: standalone)").matches ||
    navigator.standalone === true;
}

function isNativeApp() {
  return Boolean(window.Capacitor?.isNativePlatform?.()) ||
    navigator.userAgent.includes("Electron");
}

function updatePwaInstallOption() {
  const section = document.getElementById("settings-pwa-install");
  if (!section) return;
  section.classList.toggle("hidden", isNativeApp() || isInstalledPwa() || location.protocol === "file:");
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  updatePwaInstallOption();
});
window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  pwaInstallAccepted = true;
  updatePwaInstallOption();
});

const HOLD_MOVE_INITIAL_DELAY_MS = 220;
const HOLD_MOVE_INTERVAL_MS = 320;
let heldMove = null;
let heldMoveTimer = 0;
let restTransitionTimer = 0;
const touchMoveButtons = new WeakSet();
const touchPointerButtons = new Map();

const elements = Object.fromEntries([
  "character-button", "header-character-portrait",
  "header-resources", "header-gold", "header-at-risk", "header-health", "header-health-fill", "header-health-meter", "header-rations", "header-food", "header-food-fill", "header-food-meter",
  "header-water", "header-water-fill", "header-water-meter", "header-spell-slots",
  "header-spell-slot-count", "header-spell-slot-pips",
  "header-water-stock", "header-clock", "delve-objectives", "inventory-filters",
  "start-screen", "continue-game", "continue-hint", "new-game", "load-game", "save-manager-dialog", "save-manager-list", "save-manager-empty", "close-save-manager", "settings-pwa-install", "install-pwa", "open-settings", "settings-dialog", "close-settings", "language-select", "font-select", "dark-mode-toggle", "villager-dialog", "villager-portrait", "villager-eyebrow", "villager-name", "villager-doing", "villager-hearts", "villager-speech", "villager-actions", "villager-close", "game-layout", "new-game-warning", "pause-dialog",
  "resume-game", "return-to-title",
  "character-dialog", "character-dialog-heading", "character-form", "character-submit", "character-next", "character-back",
  "character-intro", "creation-step-label", "creation-step-track", "creation-progress-bar", "creation-progress-fill", "close-character", "cancel-character",
  "character-name", "character-race", "character-heritage", "character-gender", "character-class", "character-background",
  "race-description", "class-description", "background-description", "class-skill-count", "class-skill-choices", "class-skill-note",
  "half-elf-bonuses", "half-elf-bonus-one", "half-elf-bonus-two",
  "score-method", "score-method-note", "ability-score-fields", "roll-scores", "point-buy-remaining", "ability-bonus-note",
  "character-weapon", "character-armor", "character-shield", "character-cloak", "equipment-note", "starter-kit-summary",
  "character-preview", "character-summary", "character-skin", "character-hair-style", "character-hair", "character-tunic", "character-garment", "character-adornment", "character-headwear", "character-face-paint", "character-error", "character-body", "character-beard", "character-jewelry", "character-crest", "character-trim", "look-turn", "look-randomize", "character-skin-label", "character-hair-label", "character-crest-label", "character-crest-field", "character-hair-style-field", "character-beard-field",
  "character-heading", "character-subtitle", "character-portrait", "character-equipment", "equipment-list", "inventory-list", "inventory-load", "inventory-security",
  "panel-equipment", "panel-gear", "panel-info", "panel-abilities",
  "class-guide-heading", "class-guide-copy", "class-training-copy", "character-level-progress",
  "player-hp-stat", "character-carry-capacity", "character-stat-details", "character-equipment-bonus",
  "ability-guide-note", "ability-guide-list", "open-ability-guide",
  "character-card-dialog", "close-character-card", "close-character-card-top", "city-screen", "store-screen", "dungeon-screen",
  "town-story", "return-to-city", "shop-message", "store-buy-heading", "store-buy-list", "store-sell-list", "store-carry-load",
  "town-map", "town-location-copy", "town-interact-button", "town-interact-label", "town-dialog", "town-dialog-heading", "town-dialog-copy", "town-dialog-action", "town-dialog-shop", "town-dialog-close", "town-dialog-portrait", "town-dialog-role", "town-dialog-x",
  "target-choice-dialog", "target-choice-heading", "target-choice-list", "target-choice-close",
  "cosmetic-shop-dialog", "cosmetic-shop-items", "cosmetic-shop-gold", "cosmetic-shop-message", "cosmetic-shop-close",
  "town-dialog-learn", "patolli-dialog", "patolli-rules", "patolli-rules-toggle", "patolli-rules-page-number", "patolli-rules-previous", "patolli-rules-next", "patolli-last-result", "patolli-setup", "patolli-difficulty", "patolli-wager", "patolli-wager-note", "patolli-start",
  "patolli-game", "patolli-board", "patolli-status", "patolli-score", "patolli-match-stats", "patolli-stakes", "patolli-beans", "patolli-piece-choices", "patolli-autoplay", "patolli-roll", "patolli-forfeit", "patolli-close", "patolli-tutorial-start", "time-transition",
  "quest-title", "town-party-panel", "party-count", "town-party-list", "dungeon-party-panel", "dungeon-party-list", "party-message",
  "faction-list", "town-dialog-join",
  "side-drawer", "side-drawer-title", "close-side-drawer", "party-toggle", "journal-toggle", "journal-panel", "log-toggle",
  "log-drawer-panel", "dungeon-context-rail",
  "prologue-dialog", "prologue-heading", "prologue-copy", "begin-story",
  "game-over-dialog", "game-over-heading", "game-over-copy", "game-over-portrait", "recover-in-chiltomatlan", "game-over-title",
  "action-panel", "action-buttons", "action-primary", "action-combat", "action-explore", "action-supplies", "wait-dpad-button",
  "turn-status", "return-after-delving", "action-mode", "combat-feedback",
  "header-food-fill", "header-food", "header-food-meter", "header-water-fill", "header-water", "header-water-meter", "header-water-stock",
  "inventory-filters",
  "level-up-dialog", "level-up-heading", "level-up-copy", "level-up-mode", "level-up-one", "level-up-two", "level-up-two-label", "apply-level-up",
  "level-up-mode-select",
  "dungeon-map-viewport", "dungeon-map", "map-heading", "look-toggle", "look-inspector", "look-title", "look-description",
  "compact-log", "room-type", "room-name", "room-status", "room-description",
  "encounter", "enemy-portrait", "enemy-name", "enemy-description", "enemy-health", "enemy-health-fill", "enemy-distance",
  "combat-player-hp", "combat-player-health-fill", "combat-player-portrait", "player-combatant", "combat-character-name",
  "combat-player-ac", "combat-player-attack", "combat-level", "combat-potions",
  "player-hp", "player-health-fill", "player-ac", "player-attack",
  "xp-line", "level-badge", "event-log", "header-expedition-kit",
  "toast", "message-box", "message-box-title", "message-box-text", "message-box-page",
  "message-box-advance", "message-box-close", "save-state",
  "enemy-rank", "player-conditions", "map-status-chips", "renown-line", "bounty-list", "bestiary-list", "bestiary-count", "projects-summary",
  "shop-portrait", "shop-title", "shop-keeper", "shop-tagline", "shop-purse", "shop-load-text", "shop-load-fill", "shop-perks",
  "shop-tabs", "shop-categories", "shop-sell-all", "shop-grid", "shop-detail", "shop-detail-body",
  "projects-dialog", "projects-list", "projects-gold", "projects-message", "projects-close", "projects-x", "house-dialog", "house-portrait", "house-eyebrow", "house-title", "house-tagline", "house-body", "house-close", "mirror-dialog", "mirror-fields", "mirror-preview", "mirror-message", "mirror-save", "mirror-cancel", "workshop-panel", "workshop-list"
].map((id) => [id, document.getElementById(id)]));

function escapeMessage(error) {
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}

function showToast(message, duration = 3400) {
  message = t(message);
  if (message.length > 180) {
    showRpgMessage("Expedition message", message);
    return;
  }
  if (state.messageBox) return;
  elements.toast.textContent = message;
  elements.toast.classList.remove("toast-combat", "toast-loot", "toast-status");
  const category = classifyLogMessage(message);
  if (["log-combat", "log-loot", "log-status"].includes(category)) {
    elements.toast.classList.add(category.replace("log-", "toast-"));
  }
  elements.toast.classList.add("visible");
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => elements.toast.classList.remove("visible"), duration);
}

function messagePages(text, limit = innerWidth <= 700 ? 110 : 190) {
  const words = text.trim().split(/\s+/);
  const pages = [];
  let page = "";
  for (const word of words) {
    if (page && `${page} ${word}`.length > limit) {
      pages.push(page);
      page = word;
    } else {
      page = page ? `${page} ${word}` : word;
    }
  }
  if (page) pages.push(page);
  return pages;
}

function renderRpgMessage() {
  const message = state.messageBox;
  if (!message) {
    elements["message-box"].hidden = true;
    return;
  }
  elements["message-box-title"].textContent = t(message.title);
  elements["message-box-text"].textContent = t(message.pages[message.page]);
  elements["message-box-page"].textContent = message.pages.length > 1
    ? `${message.page + 1} / ${message.pages.length}` : "";
  elements["message-box-advance"].textContent = t(message.page + 1 < message.pages.length ? "Continue" : "Close");
  elements["message-box"].hidden = false;
}

function showRpgMessage(title, text) {
  stopHeldMovement();
  window.clearTimeout(state.toastTimer);
  elements.toast.classList.remove("visible");
  state.messageReturnFocus = document.activeElement;
  state.messageBox = { title, pages: messagePages(text), page: 0 };
  renderRpgMessage();
  elements["message-box-advance"].focus({ preventScroll: true });
}

function advanceRpgMessage() {
  if (!state.messageBox) return;
  if (state.messageBox.page + 1 < state.messageBox.pages.length) {
    state.messageBox.page += 1;
    renderRpgMessage();
  } else {
    dismissRpgMessage();
  }
}

function dismissRpgMessage() {
  if (!state.messageBox) return;
  state.messageBox = null;
  renderRpgMessage();
  const returnFocus = state.messageReturnFocus;
  state.messageReturnFocus = null;
  if (returnFocus instanceof HTMLElement && returnFocus.isConnected &&
    !returnFocus.closest("[hidden]")) {
    returnFocus.focus({ preventScroll: true });
  } else if (state.lookMode) {
    elements["look-toggle"].focus({ preventScroll: true });
  }
}

function addLog(message) {
  state.run.log.unshift(message);
  state.run.log = state.run.log.slice(0, 30);
  renderLog();
  saveRun();
}

function createFactionState() {
  return {
    standing: Object.fromEntries(Object.keys(FACTIONS).map((id) => [id, 0])),
    members: [],
    milestones: [],
    lastHouseProvisionDay: -1
  };
}

function factionRank(id) {
  const faction = FACTIONS[id];
  const standing = state.run?.factions?.standing?.[id] ?? 0;
  return [...faction.ranks].reverse().find(([threshold]) => standing >= threshold)?.[1] || faction.ranks[0][1];
}

function factionMember(id) {
  return state.run?.factions?.members?.includes(id) || false;
}

function factionStanding(id) {
  return state.run?.factions?.standing?.[id] ?? 0;
}

function factionStandingLabel(standing) {
  if (standing <= -50) return "Hostile";
  if (standing <= -20) return "Distrusted";
  if (standing < 15) return "Recognized";
  if (standing < 35) return "Respected";
  if (standing < 65) return "Honored";
  return "Esteemed";
}

function factionJoinRequirement(id) {
  if (id === "road-wardens" && !state.run.factions.milestones.includes("temple-treasure-returned") &&
    !state.run.factions.milestones.includes("greenstone-echo-silenced")) {
    return "Return from the forbidden tomb with recovered treasure before asking to join.";
  }
  return null;
}

function changeFactionStanding(id, amount, reason) {
  if (!FACTIONS[id] || !Number.isInteger(amount) || !reason) {
    throw new Error("A valid faction and reason are required to change standing.");
  }
  const previous = factionStanding(id);
  const next = Math.max(-100, Math.min(100, previous + amount));
  if (next === previous) return false;
  state.run.factions.standing[id] = next;
  const change = next - previous;
  const faction = FACTIONS[id];
  addLog(`${faction.name} standing ${change > 0 ? "+" : ""}${change}: ${reason}`);
  renderFactions();
  return true;
}

function joinFaction(id) {
  const faction = FACTIONS[id];
  if (!faction || factionMember(id)) return false;
  const requirement = factionJoinRequirement(id);
  if (requirement) {
    showToast(requirement);
    return false;
  }
  state.run.factions.members.push(id);
  addLog(`You join ${faction.name} as a ${factionRank(id).toLowerCase()}.`);
  changeFactionStanding(id, 5, `your oath is welcomed by ${faction.patron.split(",")[0]}`);
  renderFactions();
  return true;
}

function renderFactions() {
  const list = elements["faction-list"];
  if (!list || !state.run?.factions) return;
  list.replaceChildren();
  for (const [id, faction] of Object.entries(FACTIONS)) {
    const standing = factionStanding(id);
    const card = document.createElement("article");
    card.className = "faction-card";
    const heading = document.createElement("div");
    heading.className = "faction-card-heading";
    const emblem = document.createElement("span");
    emblem.className = "faction-emblem";
    emblem.setAttribute("aria-hidden", "true");
    emblem.textContent = faction.emblem;
    const name = document.createElement("strong");
    name.textContent = t(faction.name);
    const rank = document.createElement("span");
    rank.className = "faction-rank";
    rank.textContent = factionMember(id) ? factionRank(id) : "Not joined";
    heading.append(emblem, name, rank);
    const description = document.createElement("p");
    description.className = "faction-description";
    description.textContent = t(faction.description);
    const standingLine = document.createElement("div");
    standingLine.className = "faction-standing-line";
    const standingLabel = document.createElement("span");
    standingLabel.textContent = factionMember(id) ? "Standing" : factionStandingLabel(standing);
    const standingValue = document.createElement("strong");
    standingValue.textContent = `${standing > 0 ? "+" : ""}${standing}`;
    standingLine.append(standingLabel, standingValue);
    const meter = document.createElement("div");
    meter.className = "faction-meter";
    meter.setAttribute("role", "meter");
    meter.setAttribute("aria-valuemin", "-100");
    meter.setAttribute("aria-valuemax", "100");
    meter.setAttribute("aria-valuenow", String(standing));
    meter.setAttribute("aria-label", `${faction.name} standing ${standing}`);
    const fill = document.createElement("span");
    fill.className = standing < 0 ? "negative" : "positive";
    fill.style.width = `${Math.abs(standing) / 2}%`;
    fill.style.left = standing < 0 ? `${50 - Math.abs(standing) / 2}%` : "50%";
    meter.append(fill);
    const perk = document.createElement("p");
    perk.className = "faction-perk";
    perk.textContent = t(faction.perk);
    card.append(heading, description, standingLine, meter, perk);
    list.append(card);
  }
}

function storageAvailable() {
  try {
    const key = "__crypts_storage_test__";
    localStorage.setItem(key, "1");
    localStorage.removeItem(key);
    return true;
  } catch {
    elements["save-state"].textContent = "Local saving unavailable in this browser";
    return false;
  }
}

function saveRun() {
  try {
    const saveId = state.activeSaveId || createSaveId();
    const updatedAt = new Date().toISOString();
    const slot = {
      schemaVersion: 1,
      pack: state.pack,
      run: state.run
    };
    const index = readSaveIndex();
    const existing = index.slots.find((save) => save.id === saveId);
    const metadata = {
      id: saveId,
      name: state.run.character.name,
      level: state.run.level,
      location: state.run.location,
      updatedAt
    };
    localStorage.setItem(`${STORE_KEYS.saveSlotPrefix}${saveId}`, JSON.stringify(slot));
    index.slots = existing
      ? index.slots.map((save) => save.id === saveId ? metadata : save)
      : [...index.slots, metadata];
    index.lastPlayedId = saveId;
    localStorage.setItem(STORE_KEYS.saveIndex, JSON.stringify(index));
    state.activeSaveId = saveId;
    elements["save-state"].textContent = "Run autosaves on this device";
    return true;
  } catch (error) {
    elements["save-state"].textContent = "Could not save this run";
    showToast(`Progress could not be saved: ${escapeMessage(error)}`);
    return false;
  }
}

function isValidReward(reward) {
  if (!reward || typeof reward !== "object" || Array.isArray(reward)) return false;
  for (const key of ["gold", "potions", "xp"]) {
    if (reward[key] !== undefined && (!Number.isInteger(reward[key]) || reward[key] < 0 || reward[key] > 500)) return false;
  }
  return reward.items === undefined || (Array.isArray(reward.items) && reward.items.length <= 20 &&
    reward.items.every((item) => item && typeof item.id === "string" && itemDetails(item.id) &&
      Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 20));
}

function validatePack(raw) {
  const fail = (message) => { throw new Error(`Invalid pack: ${message}`); };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail("the root must be a JSON object.");
  if (raw.schemaVersion !== 1) fail("schemaVersion must be 1.");
  const validId = (value) => typeof value === "string" && /^[a-z0-9][a-z0-9-]{1,39}$/.test(value);
  const validText = (value, max = 240) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
  if (!validId(raw.id)) fail("id must contain 2–40 lowercase letters, numbers, or hyphens.");
  if (!validText(raw.title, 60)) fail("title must be 1–60 characters.");
  if (!validText(raw.description, 240)) fail("description must be 1–240 characters.");
  if (!Array.isArray(raw.enemies) || raw.enemies.length < 1 || raw.enemies.length > 40) fail("enemies must contain 1–40 entries.");
  if (!Array.isArray(raw.rooms) || raw.rooms.length < 3 || raw.rooms.length > 24) fail("rooms must contain 3–24 entries.");

  const ids = new Set();
  const enemies = new Map();
  for (const enemy of raw.enemies) {
    if (!enemy || !validId(enemy.id) || ids.has(enemy.id)) fail("every enemy needs a unique valid id.");
    ids.add(enemy.id);
    if (!validText(enemy.name, 50)) fail(`enemy ${enemy.id} needs a name of up to 50 characters.`);
    if (enemy.sprite !== undefined && !ENEMY_SPRITES.includes(enemy.sprite)) fail(`${enemy.id}.sprite must be a supported sprite id.`);
    if (enemy.description !== undefined && !validText(enemy.description, 120)) fail(`${enemy.id}.description must be 1–120 characters.`);
    if (enemy.edible !== undefined && typeof enemy.edible !== "boolean") fail(`${enemy.id}.edible must be true or false.`);
    if (!Number.isInteger(enemy.hp) || enemy.hp < 1 || enemy.hp > 100) fail(`${enemy.id}.hp must be 1–100.`);
    if (!Number.isInteger(enemy.ac) || enemy.ac < 5 || enemy.ac > 30) fail(`${enemy.id}.ac must be 5–30.`);
    if (!Number.isInteger(enemy.attackBonus) || enemy.attackBonus < -2 || enemy.attackBonus > 12) fail(`${enemy.id}.attackBonus must be -2–12.`);
    if (typeof enemy.damage !== "string" || !DICE_PATTERN.test(enemy.damage)) fail(`${enemy.id}.damage must be a dice expression such as 1d6+2.`);
    if (!Number.isInteger(enemy.initiativeBonus || 0) || (enemy.initiativeBonus || 0) < -2 || (enemy.initiativeBonus || 0) > 8) fail(`${enemy.id}.initiativeBonus must be -2–8.`);
    if (!Number.isInteger(enemy.xp) || enemy.xp < 0 || enemy.xp > 5000) fail(`${enemy.id}.xp must be 0–5000.`);
    if (enemy.minLevel !== undefined && (!Number.isInteger(enemy.minLevel) || enemy.minLevel < 1 || enemy.minLevel > MAX_LEVEL)) fail(`${enemy.id}.minLevel must be 1–${MAX_LEVEL}.`);
    if (enemy.gear !== undefined && !validText(enemy.gear, 120)) fail(`${enemy.id}.gear must be 1–120 characters.`);
    enemies.set(enemy.id, enemy);
  }

  const roomIds = new Set();
  const types = new Set(["entrance", "quiet", "trap", "treasure", "combat", "boss", "exit"]);
  const roomTypes = new Set();
  for (const room of raw.rooms) {
    if (!room || !validId(room.id) || roomIds.has(room.id)) fail("every room needs a unique valid id.");
    roomIds.add(room.id);
    if (!types.has(room.type)) fail(`${room.id}.type must be one of: ${Array.from(types).join(", ")}.`);
    roomTypes.add(room.type);
    if (!validText(room.name, 60) || !validText(room.text, 500)) fail(`${room.id} needs a name and room text (up to 500 characters).`);
    if ((room.type === "combat" || room.type === "boss") && !enemies.has(room.enemyId)) fail(`${room.id} references an unknown enemy.`);
    if (room.type === "trap") {
      if (!Number.isInteger(room.dc) || room.dc < 5 || room.dc > 25) fail(`${room.id}.dc must be 5–25.`);
      if (typeof room.damage !== "string" || !DICE_PATTERN.test(room.damage)) fail(`${room.id}.damage must be a dice expression.`);
    }
    if (room.reward !== undefined) {
      if (!isValidReward(room.reward)) fail(`${room.id}.reward must contain valid gold, potion, experience, and known-item rewards.`);
    }
  }
  for (const required of ["entrance", "boss", "exit"]) {
    if (!roomTypes.has(required)) fail(`include at least one ${required} room.`);
  }
  if (!["quiet", "trap", "treasure", "combat"].some((type) => roomTypes.has(type))) {
    fail("include at least one middle room: quiet, trap, treasure, or combat.");
  }
  return raw;
}

function enterDungeon(options = {}) {
  if (state.run.hp <= 0) {
    showToast("You are still too weak to travel. Rest at the Ceiba House before returning to the tomb.");
    if (state.run.location === "city" && townMapAtCurrentLevel()[state.run.townPosition.y]?.[state.run.townPosition.x] === "D") {
      state.run.townPosition = { ...TOWN_SPAWN };
      render();
    }
    return;
  }
  if (state.run.won || state.run.lost) {
    beginNewDelve();
    return;
  }
  if (!options.skipLift && state.run.location === "city" && chooseDungeonEntry(() => enterDungeon({ skipLift: true }))) return;
  if (!state.run.hasEnteredDungeon) {
    state.run.hasEnteredDungeon = true;
    state.run.log.unshift(`You leave Chiltomatlan and enter ${getRoom().name}.`);
    state.run.log = state.run.log.slice(0, 30);
  } else {
    state.run.log.unshift(`You leave Chiltomatlan and return to ${getRoom().name}.`);
    state.run.log = state.run.log.slice(0, 30);
  }
  upgradeGreatTempleContent();
  if (state.run.location !== "dungeon") state.run.relicRites = {};
  state.run.location = "dungeon";
  render();
}

function leaveStore() {
  if (state.run.location !== "store") return;
  if (state.shop) state.shop.selected = null;
  state.run.location = "city";
  render();
}

function isAtDungeonEntrance() {
  if (state.run.mapId !== GTFL_MAP_ID) return false;
  if (dungeonSignAt(state.run.player.x, state.run.player.y)?.role === "entrance") return true;
  if (state.run.dungeonFloor !== 1) return false;
  const entrance = state.run.rooms.find((room) => room.type === "entrance");
  return Boolean(entrance && state.run.player.x === entrance.anchorX && state.run.player.y === entrance.anchorY);
}

function traverseDungeonStair(stair) {
  if (stair.role === "entrance") {
    returnToChiltomatlan();
    return;
  }
  if (stair.role === "exit") {
    if (!state.run.questComplete) {
      showToast("The final way out remains sealed until Tzitzimitl is defeated.");
      return;
    }
    state.run.won = true;
    state.run.log.unshift("You emerge from the tomb after defeating Tzitzimitl and conquering all thirteen floors.");
    returnToChiltomatlan();
    return;
  }
  const targetFloor = stair.targetFloor;
  if (!Number.isInteger(targetFloor) || targetFloor < 1 || targetFloor > DUNGEON_FLOOR_COUNT ||
    Math.abs(targetFloor - state.run.dungeonFloor) !== 1) {
    throw new Error(`The ${stair.name} has an invalid dungeon-floor connection.`);
  }
  saveDungeonFloorState();
  const currentFloor = state.run.dungeonFloor;
  const savedFloor = state.run.dungeonFloors[String(targetFloor)];
  if (savedFloor) {
    restoreDungeonFloorState(savedFloor, stair.id);
    delete state.run.dungeonFloors[String(targetFloor)];
  } else {
    state.run.dungeonFloor = targetFloor;
    initializeDungeon();
    const arrivalStair = state.run.floorStairs.find((entry) => entry.id === stair.id);
    if (!arrivalStair) throw new Error(`Floor ${targetFloor} has no matching stair connection "${stair.id}".`);
    state.run.player = { ...state.run.player, x: arrivalStair.x, y: arrivalStair.y };
    state.run.currentRoom = roomIndexAt(arrivalStair.x, arrivalStair.y);
    refreshCompanionFormation();
    revealAroundPlayer();
  }
  recordFloorReached(targetFloor);
  state.run.log.unshift(`You ${targetFloor > currentFloor ? "descend" : "ascend"} to floor ${targetFloor} of ${DUNGEON_FLOOR_COUNT}.`);
  state.run.log = state.run.log.slice(0, 30);
  render();
}

function returnToChiltomatlan() {
  if (isAtDungeonEntrance() && !state.run.lost) {
    state.dashReady = false;
    state.disengageReady = false;
    state.run.dodging = false;
    state.run.location = "city";
    state.run.townPosition = { ...TOWN_SPAWN };
    state.run.log.unshift("You return to Chiltomatlan from the tomb entrance.");
    state.run.log = state.run.log.slice(0, 30);
    secureExpeditionLoot();
    turnInTempleTreasure();
    clearConditions();
    claimReadyBounties();
    render();
    return;
  }
  if (!state.run.won) {
    const message = state.run.lost
      ? "Choose Return to Chiltomatlan on the game-over screen."
      : state.run.mapId === GTFL_MAP_ID
        ? "Return to the tomb's entrance to travel back to Chiltomatlan."
        : "Reach the tomb exit before returning to Chiltomatlan.";
    showToast(message);
    return;
  }
  state.dashReady = false;
  state.disengageReady = false;
  state.run.dodging = false;
  state.run.location = "city";
  state.run.townPosition = { ...TOWN_SPAWN };
  state.run.log.unshift("You return to Chiltomatlan. Find food and rest before the next expedition.");
  state.run.log = state.run.log.slice(0, 30);
  secureExpeditionLoot();
  turnInTempleTreasure();
  clearConditions();
  claimReadyBounties();
  render();
}

function turnInTempleTreasure() {
  const factions = state.run.factions;
  if (!state.run.mainTreasureClaimed || factions.milestones.includes("temple-treasure-returned")) return;
  factions.milestones.push("temple-treasure-returned");
  addLog("You bring recovered tomb treasure safely back to Chiltomatlan. The town hears of your deed.");
  changeFactionStanding("road-wardens", 20, "you return the tomb's recovered treasure");
  changeFactionStanding("ceiba-house", 10, "you return safely with news from the old road");
  changeFactionStanding("traders-circle", 5, "you bring valuable trade goods home");
  renderFactions();
}

function recoverInChiltomatlan() {
  elements["game-over-dialog"].close();
  if (projectLevel("shrine") >= 1 && expeditionLoot().gold > 0) {
    const saved = Math.floor(expeditionLoot().gold / 2 * 10) / 10;
    expeditionLoot().gold = roundGold(expeditionLoot().gold - saved);
    if (saved) state.run.log.unshift(`The Shrine of the Ceiba's keepers carry ${formatCurrency(saved)} of your gold home.`);
  }
  clearConditions();
  const lostLoot = discardUnsecuredLoot();
  state.run.hp = canHeal() ? state.run.maxHp : 0;
  state.run.lost = false;
  state.run.won = false;
  state.run.location = "city";
  state.run.townPosition = { ...TOWN_SPAWN };
  state.run.hasEnteredDungeon = false;
  state.run.dungeonFloor = 1;
  state.run.dungeonFloors = {};
  state.run.dodging = false;
  state.dashReady = false;
  state.disengageReady = false;
  state.combatEffects = [];
  initializeDungeon();
  const recoveryText = canHeal()
    ? "You wake in Chiltomatlan with your wounds tended. The tomb's passages have shifted."
    : "The Chiltomatlan crew brings you back, but you remain unconscious. Eat until your food meter is at least 75% to recover hit points.";
  state.run.log.unshift(lostLoot
    ? `${recoveryText} Unsecured expedition loot was lost; your earlier belongings and experience remain.`
    : `${recoveryText} No unsecured loot was lost; your earlier belongings and experience remain.`);
  state.run.log = state.run.log.slice(0, 30);
  render();
}

function expeditionLoot() {
  if (!state.run.unsecuredLoot) state.run.unsecuredLoot = { gold: 0, items: [] };
  return state.run.unsecuredLoot;
}

function recordExpeditionLoot(gold = 0, items = []) {
  if (state.run.location !== "dungeon") return;
  const loot = expeditionLoot();
  loot.gold = roundGold(loot.gold + gold);
  for (const { id, quantity } of items) {
    if (!quantity) continue;
    const existing = loot.items.find((entry) => entry.id === id);
    if (existing) existing.quantity += quantity;
    else loot.items.push({ id, quantity });
  }
}

function secureExpeditionLoot() {
  const loot = expeditionLoot();
  const itemCount = loot.items.reduce((total, item) => total + item.quantity, 0);
  if (loot.gold || itemCount) {
    addLog(`You secure ${formatCurrency(loot.gold)} and ${itemCount} expedition item${itemCount === 1 ? "" : "s"} in Chiltomatlan.`);
  }
  state.run.unsecuredLoot = { gold: 0, items: [] };
}

function debitExpeditionItemLoot(itemId, quantity) {
  if (state.run.location !== "dungeon") return;
  const loot = expeditionLoot();
  const entry = loot.items.find((item) => item.id === itemId);
  if (!entry) return;
  entry.quantity -= Math.min(quantity, entry.quantity);
  if (entry.quantity <= 0) loot.items = loot.items.filter((item) => item !== entry);
}

function discardUnsecuredLoot() {
  const loot = expeditionLoot();
  const lostGold = Math.min(state.run.gold, loot.gold);
  const lostItems = loot.items.reduce((total, item) => total + item.quantity, 0);
  state.run.gold = roundGold(state.run.gold - lostGold);
  for (const item of loot.items) {
    const quantity = Math.min(inventoryQuantity(item.id), item.quantity);
    if (quantity) removeInventoryItem(item.id, quantity, false);
  }
  const equipment = state.run.character.equipment;
  const characterClass = CLASSES[state.run.character.class];
  if (!inventoryQuantity(`weapon:${equipment.weapon}`)) {
    const carriedWeapon = state.run.inventory.find((item) =>
      item.id.startsWith("weapon:") && characterClass.weapons.includes(gearBase(item.id.slice("weapon:".length))));
    equipment.weapon = carriedWeapon?.id.slice("weapon:".length) || characterClass.weapon;
  }
  if (equipment.armor !== "none" && !inventoryQuantity(`armor:${equipment.armor}`)) {
    const carriedArmor = state.run.inventory.find((item) =>
      item.id.startsWith("armor:") && characterClass.armor.includes(gearBase(item.id.slice("armor:".length))));
    equipment.armor = carriedArmor?.id.slice("armor:".length) ||
      (characterClass.armor.includes("none") ? "none" : DEFAULT_CLASS_ARMOR[state.run.character.class]);
  }
  if (equipment.shield && !inventoryQuantity("shield")) equipment.shield = false;
  if (equipment.cloak && !inventoryQuantity("travel-cloak")) equipment.cloak = false;
  state.run.unsecuredLoot = { gold: 0, items: [] };
  return Boolean(lostGold || lostItems);
}

function pauseGame() {
  if (state.run?.location === "dungeon" && !elements["pause-dialog"].open) elements["pause-dialog"].showModal();
}

function visitStore() {
  if (state.run.location !== "city") return;
  openShop("market");
}

function campAndRest() {
  if (restTransitionTimer) return;
  if (state.run.location === "dungeon" && !atCamp()) {
    showToast("Return to your camp to rest, or make a new camp here.");
    return;
  }
  if (state.run.location === "dungeon" && state.run.enemies.some((enemy) =>
    enemy.alive && distanceInSquares(enemy, state.run.player) <= 7
  )) {
    elements["party-message"].textContent = "Too close to danger to make camp. Find a quiet room first.";
    showToast("Too close to danger to make camp. Find a quiet room first.");
    return;
  }
  const previousHours = state.run.gameHours;
  const members = partyMembers();
  advanceSurvivalTime(true, 8 * 60);
  if (state.run.lost) {
    render();
    showRestTransition(previousHours, state.run.gameHours);
    return;
  }
  state.run.spellSlots = maxSpellSlots(state.run.character.class, state.run.level);
  clearConditions(progress().conditions.length ? "Rest eases your ailments." : "");
  if (state.run.location === "city" && factionMember("ceiba-house")) {
    const day = Math.floor(state.run.gameHours / 24);
    if (day > state.run.factions.lastHouseProvisionDay) {
      const mealReceived = addInventoryItem("ration");
      const waterReceived = addInventoryItem("clean-water");
      state.run.factions.lastHouseProvisionDay = day;
      addLog(mealReceived || waterReceived
        ? `House of the Ceiba provides ${mealReceived ? "a travel meal" : ""}${mealReceived && waterReceived ? " and " : ""}${waterReceived ? "a gourd of water" : ""} for the road.`
        : "House of the Ceiba sets aside a meal and water, but your pack is too full to carry them.");
    }
  }
  for (const member of members) member.needs.hoursAwake = 0;
  if (state.run.location === "city") {
    for (const member of members) {
      member.needs.food = 100;
      member.needs.water = 100;
      member.needs.waterZeroHours = 0;
      if (!canHeal(member.needs)) continue;
      if (member.hero) state.run.hp = state.run.maxHp;
      else if (member.hp > 0) member.hp = member.maxHp;
      else member.hp = 1;
    }
    const message = "The party rests safely at the Ceiba House. The inn provides a meal and clean water for everyone, restores food and hydration, and tends wounds. Your carried supplies are untouched.";
    addLog(message);
    if (maxSpellSlots(state.run.character.class, state.run.level)) {
      addLog("Your spell power returns.");
    }
    render();
    elements["party-message"].textContent = message;
    showToast("Ceiba House restores food, water, hit points, and spell slots without using pack supplies.");
    animateAction("camp");
    showRestTransition(previousHours, state.run.gameHours);
    return;
  }
  const cookedMeals = [];
  const availableMeals = () => Object.keys(FOOD_ITEMS)
    .reduce((total, id) => total + inventoryQuantity(id), cookedMeals.length);
  const ingredientCount = inventoryQuantity("wild-ingredients");
  if (availableMeals() < members.length && ingredientCount > 0) {
    const cookingBonus = bestPartySkillBonus("cooking");
    let ingredientsUsed = 0;
    while (availableMeals() < members.length && ingredientsUsed < ingredientCount) {
      const check = randomInt(20) + cookingBonus;
      const servings = Math.max(1, Math.min(4, 1 + Math.floor(Math.max(0, check - 10) / 5)));
      if (!removeInventoryItem("wild-ingredients")) break;
      ingredientsUsed += 1;
      for (let serving = 0; serving < servings; serving += 1) cookedMeals.push("ration");
      addLog(`Camp Cooking check ${check}: the party prepares ${servings} ${GEAR_ITEMS.ration.name}${servings === 1 ? "" : "s"}.`);
    }
  }
  let fed = 0;
  let hydrated = 0;
  for (const member of members) {
    const mealId = Object.keys(FOOD_ITEMS).find((id) => inventoryQuantity(id) > 0) || cookedMeals.shift();
    if (mealId) {
      if (inventoryQuantity(mealId)) removeInventoryItem(mealId);
      applyMeal(member.needs, mealId);
      fed += 1;
    }
    if (inventoryQuantity("clean-water") > 0) {
      removeInventoryItem("clean-water");
      drinkWater(member.needs);
      hydrated += 1;
    }
    if (canHeal(member.needs)) {
      if (member.hero) state.run.hp = state.run.maxHp;
      else if (member.hp > 0) member.hp = member.maxHp;
      else member.hp = 1;
    }
  }
  if (inventoryQuantity("marigold-garland") && removeInventoryItem("marigold-garland")) {
    addLog("You burn the cempasúchil garland. Its bright, bitter smell fills the camp, and everyone wakes sharp-eyed.");
    grantBuff("keen-eyed");
  }
  if (inventoryQuantity("copal") && removeInventoryItem("copal")) {
    addLog("You burn copal as the camp settles. The fragrant smoke steadies everyone.");
    grantBuff("steady");
  }
  let leftoverMeals = 0;
  for (const mealId of cookedMeals) {
    if (addInventoryItem(mealId)) continue;
    leftoverMeals += 1;
  }
  const hungry = members.length - fed;
  const thirsty = members.length - hydrated;
  const place = state.run.location === "city" ? "Chiltomatlan" : "your camp";
  const unableToHeal = members.filter((member) => !canHeal(member.needs)).length;
  const message = `The party rests in ${place}. ${fed} eat; ${hydrated} drink.`
    + (hungry ? ` ${hungry} go hungry.` : "")
    + (thirsty ? ` ${thirsty} remain thirsty.` : "")
    + (unableToHeal ? ` ${unableToHeal} cannot recover hit points until their food meter reaches 75%.` : "")
    + (leftoverMeals ? ` ${leftoverMeals} cooked meal${leftoverMeals === 1 ? " could" : "s could"} not be packed.` : "")
    + (maxSpellSlots(state.run.character.class, state.run.level) ? " Your spell power returns." : "");
  elements["party-message"].textContent = message;
  addLog(message);
  if (fed) addLog(`${fed} meal${fed === 1 ? "" : "s"} restore food and add nutrients.`);
  render();
  animateAction("camp");
  showRestTransition(previousHours, state.run.gameHours);
}

function showRestTransition(previousHours, currentHours) {
  sfx("rest");
  const transition = elements["time-transition"];
  if (!transition) return;
  const crossedHour = (target) => {
    for (let hour = previousHours + 1; hour <= currentHours; hour += 1) {
      if (hour % 24 === target) return hour;
    }
    return null;
  };
  const dawn = crossedHour(6);
  const dusk = crossedHour(18);
  const eventHour = dawn || dusk;
  const hour = eventHour ?? currentHours;
  const day = Math.floor(hour / 24) + 1;
  const clock = String(hour % 24).padStart(2, "0");
  transition.textContent = dawn
    ? `Dawn breaks · Day ${day} · ${clock}:00`
    : dusk
      ? `Night falls · Day ${day} · ${clock}:00`
      : `Eight hours pass · Day ${day} · ${clock}:00`;
  transition.hidden = false;
  transition.classList.remove("time-transition-active");
  void transition.offsetWidth;
  transition.classList.add("time-transition-active");
  restTransitionTimer = window.setTimeout(() => {
    transition.classList.remove("time-transition-active");
    transition.hidden = true;
    restTransitionTimer = 0;
  }, 900);
}

function forageIngredients() {
  if (state.run.location !== "dungeon" || state.run.lost || state.run.won) return;
  const check = randomInt(20) + bestPartySkillBonus("survival");
  const found = check >= 18 ? 3 : check >= 12 ? 2 : check >= 6 ? 1 : 0;
  let waterGathered = 0;
  let foodGathered = 0;
  const specialFinds = [];
  for (let index = 0; index < found; index += 1) {
    const balance = state.run.gatheringWaterRemainder + 2;
    const waterPreferred = balance >= 3;
    const preferredItem = waterPreferred ? "clean-water" : "wild-ingredients";
    const alternateItem = waterPreferred ? "wild-ingredients" : "clean-water";
    let itemId = preferredItem;
    // A good forager sometimes turns up something better than roots: fruit, comb, cactus, insects.
    const finds = window.CryptsGoods?.forageFinds || [];
    if (itemId === "wild-ingredients" && check >= 15 && finds.length && randomInt(100) <= 40) {
      itemId = finds[randomInt(finds.length) - 1];
      if (!addInventoryItem(itemId)) itemId = preferredItem;
      else {
        specialFinds.push(GEAR_ITEMS[itemId].name.toLowerCase());
        state.run.gatheringWaterRemainder = balance;
        foodGathered += 1;
        continue;
      }
    }
    if (!addInventoryItem(itemId)) {
      itemId = alternateItem;
      if (!addInventoryItem(itemId)) break;
    }
    state.run.gatheringWaterRemainder = waterPreferred ? balance - 3 : balance;
    if (itemId === "clean-water") waterGathered += 1;
    else foodGathered += 1;
  }
  const gathered = waterGathered + foodGathered;
  addLog(gathered
    ? `After an hour of foraging (Survival ${check}), you gather ${waterGathered} gourd${waterGathered === 1 ? "" : "s"} of water and ${foodGathered} food ingredient${foodGathered === 1 ? "" : "s"}.`
    : `After an hour of foraging, you find no safe supplies${found ? "; your pack is too full" : ` (Survival ${check})`}.`);
  if (specialFinds.length) addLog(`Among the roots you also find ${specialFinds.join(" and ")}.`);
  finishPlayerTurn(60);
}

function advanceSurvivalTime(resting = false, elapsedMinutes = 10) {
  const previousHour = Math.floor(state.run.gameMinutes / 60);
  state.run.gameMinutes += elapsedMinutes;
  state.run.gameHours = Math.floor(state.run.gameMinutes / 60);
  if (state.run.location !== "dungeon") return;
  const elapsedHours = state.run.gameHours - previousHour;
  for (let hour = 0; hour < elapsedHours; hour += 1) {
    for (const member of partyMembers()) {
      const previousFoodLevel = needLevel(member.needs, "food");
      const previousWaterLevel = needLevel(member.needs, "water");
      const previousSleepLevel = needLevel(member.needs, "sleep");
      const previousNutrition = nutritionStatus(member.needs).label;
      member.needs.food = Math.max(0, member.needs.food - (member.hero ? foodDrainPerHour() : FOOD_DRAIN_PER_HOUR));
      member.needs.water = Math.max(0, member.needs.water - (member.hero ? waterDrainPerHour() : WATER_DRAIN_PER_HOUR));
      if (member.needs.water === 0) member.needs.waterZeroHours = Math.min(100000, member.needs.waterZeroHours + 1);
      else member.needs.waterZeroHours = 0;
      if (!resting) member.needs.hoursAwake = Math.min(100000, member.needs.hoursAwake + 1);
      member.needs.nutritionHours += 1;
      if (member.needs.nutritionHours >= NUTRIENT_DECAY_HOURS) {
        for (const nutrient of Object.keys(NUTRIENT_NAMES)) {
          member.needs.nutrition[nutrient] = Math.max(0, member.needs.nutrition[nutrient] - 1);
        }
        member.needs.nutritionHours = 0;
      }
      if (needLevel(member.needs, "food") > previousFoodLevel) {
        addLog(`${member.name}'s food meter is low. Hunger now weakens their ability scores.`);
      }
      if (needLevel(member.needs, "water") > previousWaterLevel) {
        addLog(`${member.name}'s water meter is low. Dehydration now weakens their ability scores.`);
      }
      if (!resting && needLevel(member.needs, "sleep") > previousSleepLevel) {
        addLog(`${member.name} is exhausted from the long watch. Sleep penalties now affect their ability scores.`);
      }
      const currentNutrition = nutritionStatus(member.needs).label;
      if (currentNutrition !== previousNutrition && currentNutrition !== "Nutrition stable") {
        addLog(`${member.name}'s nutrition is now ${currentNutrition.toLowerCase()}. ${nutritionStatus(member.needs).detail}`);
      }
      const waterDamage = member.needs.water === 0 && member.needs.waterZeroHours > 0 &&
        member.needs.waterZeroHours % 4 === 0;
      const sleepDamage = member.needs.hoursAwake >= 48 && member.needs.hoursAwake % 8 === 0;
      const damage = Number(waterDamage) + Number(sleepDamage);
      if (damage) {
        if (member.hero) {
          state.run.hp = Math.max(0, state.run.hp - damage);
          addLog(`You suffer ${damage} damage from ${waterDamage ? "dehydration" : "exhaustion"}.`);
          checkDefeat();
        } else {
          member.hp = Math.max(0, member.hp - damage);
          addLog(`${member.name} suffers ${damage} damage from severe deprivation.`);
        }
      }
    }
  }
}

function buyStoreItem(itemId) {
  const item = itemDetails(itemId);
  if (!item) throw new Error("That item is not available.");
  if (itemId === "dungeon-gourmet-guide" && state.run.gourmetGuideOwned) {
    elements["shop-message"].textContent = "You already know the Dungeon Gourmet Guide.";
    return;
  }
  const price = storeBuyPrice(item);
  if (state.run.gold < price) {
    elements["shop-message"].textContent = `You need ${formatCurrency(price)} for ${item.name}.`;
    return;
  }
  const projectedWeight = getCarriedWeight() + item.weight;
  if (projectedWeight > getCarryCapacity(state.run.character)) {
    elements["shop-message"].textContent = `There is no room for ${item.name}; your pack would exceed its carrying capacity.`;
    return;
  }
  state.run.gold = roundGold(state.run.gold - price);
  if (!addInventoryItem(itemId)) {
    state.run.gold = roundGold(state.run.gold + price);
    elements["shop-message"].textContent = `There is no room for ${item.name}.`;
    return;
  }
  if (itemId === "dungeon-gourmet-guide") state.run.gourmetGuideOwned = true;
  elements["shop-message"].textContent = `Bought ${item.name} for ${formatCurrency(price)}.`;
  addLog(`You buy ${item.name} for ${formatCurrency(price)}.`);
  render();
}

function sellStoreItem(itemId) {
  const item = itemDetails(itemId);
  const quantity = inventoryQuantity(itemId);
  if (!item || quantity <= (isEquipped(itemId) ? 1 : 0)) return;
  const value = storeSellPrice(item);
  removeInventoryItem(itemId);
  const received = addGoldWithinCapacity(value);
  elements["shop-message"].textContent = received === value
    ? `Sold ${item.name} for ${formatCurrency(value)}.`
    : `Sold ${item.name}; ${formatCurrency(received)} fits in your pack.`;
  addLog(`You sell ${item.name} for ${formatCurrency(received)}.`);
  if (item.categoryId === "Treasure") {
    changeFactionStanding("traders-circle", 2, `you sell ${item.name} through Teyac's market`);
  }
  render();
}

function getRoom() {
  return state.run.rooms[state.run.currentRoom];
}

function enemiesAdjacent() {
  return state.run.enemies.filter((enemy) => enemy.alive && distanceInSquares(enemy, state.run.player) === 1);
}

function chooseFromOptions(title, options) {
  if (options.length === 1) {
    options[0].action();
    return;
  }
  if (!options.length) return;
  elements["target-choice-heading"].textContent = title;
  elements["target-choice-list"].replaceChildren();
  for (const option of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button secondary";
    button.textContent = option.label;
    button.addEventListener("click", () => {
      elements["target-choice-dialog"].close();
      option.action();
    });
    elements["target-choice-list"].append(button);
  }
  elements["target-choice-dialog"].showModal();
  elements["target-choice-list"].querySelector("button")?.focus();
}

function chooseEnemyTarget(title, enemies, action) {
  chooseFromOptions(title, enemies.map((enemy) => ({
    label: `${enemy.name} · ${distanceInSquares(enemy, state.run.player)} squares · ${enemy.hp}/${enemy.maxHp} HP`,
    action: () => action(enemy)
  })));
}

function nearestEnemy() {
  const enemies = state.run.enemies.filter((enemy) => enemy.alive);
  enemies.sort((a, b) => distanceInSquares(a, state.run.player) - distanceInSquares(b, state.run.player));
  return enemies[0] || null;
}

function resolveRoomEntry(index) {
  const room = state.run.rooms[index];
  if (!room.visited) {
    room.visited = true;
    addLog(`You enter ${room.name}.`);
  }
  if (room.type === "treasure" && !room.mainTreasure && !room.cleared) {
    room.cleared = true;
    const pending = grantReward(room.reward || {});
    if (pending) room.unclaimedReward = pending;
  } else if (room.type === "treasure" && !room.mainTreasure && room.unclaimedReward) {
    const pending = grantReward(room.unclaimedReward, false);
    if (pending) room.unclaimedReward = pending;
    else delete room.unclaimedReward;
  }
}

function reachExitAt(x, y) {
  const room = state.run.rooms.find((entry) => entry.type === "exit");
  const exitX = room?.anchorX ?? room?.mapX + Math.floor(room?.mapW / 2);
  const exitY = room?.anchorY ?? room?.mapY + Math.floor(room?.mapH / 2);
  if (!room || x !== exitX || y !== exitY || state.run.won) return;
  state.run.won = true;
  room.cleared = true;
  addLog(state.run.questComplete
    ? "You escape with the treasure. The pulse beyond the inner seal has stopped."
    : "You escape with the treasure. A pulse still sounds from beyond the inner seal.");
}

function itemDetails(id) {
  if (id.startsWith("weapon:")) {
    const key = id.slice("weapon:".length);
    const weapon = WEAPONS[key];
    const market = WEAPON_PRICES[key];
    return weapon && market
      ? { id, name: tieredGearName(weapon), description: tieredGearDescription(weapon) || t(weapon.description), weight: market[0], price: market[1], category: t("Weapon"), categoryId: "Weapon", slot: "weapon", equipmentId: key, tier: weapon.tier || null, trait: weapon.trait || null }
      : null;
  }
  if (id.startsWith("armor:")) {
    const key = id.slice("armor:".length);
    const armor = ARMORS[key];
    const market = ARMOR_PRICES[key];
    return armor && market
      ? { id, name: tieredGearName(armor), description: tieredGearDescription(armor) || t(armor.description), weight: market[0], price: market[1], category: t("Armor"), categoryId: "Armor", slot: "armor", equipmentId: key, strength: armor.strength, tier: armor.tier || null, trait: armor.trait || null }
      : null;
  }
  if (id.startsWith("wear:")) {
    const cosmeticId = id.slice("wear:".length);
    const wear = COSMETICS[cosmeticId];
    if (!wear) return null;
    const category = wear.slot === "helmet" ? "Head ornament" : wear.slot === "back" ? "Back banner" : wear.slot === "neck" ? "Neck ornament" : "Clothing";
    return {
      id, name: t(wear.name), description: t(wear.description || ""), weight: wear.weight ?? 1, price: wear.price || 1,
      category: t(category), categoryId: "Clothing", slot: "wear", wearSlot: wear.slot, cosmeticId,
      tier: ["fine", "masterwork", "relic"].includes(wear.rarity) ? wear.rarity : null, exotic: wear.rarity === "exotic"
    };
  }
  if (!GEAR_ITEMS[id]) return null;
  const item = GEAR_ITEMS[id];
  return { id, ...item, name: t(item.name), description: t(item.description || ""), category: t(item.category), categoryId: item.category };
}

function migrateLegacyTravelBundles(entries) {
  let quantity = 0;
  const retained = entries.filter((entry) => {
    if (entry && LEGACY_TRAVEL_PACK_IDS.has(entry.id) &&
      Number.isInteger(entry.quantity) && entry.quantity > 0) {
      quantity += entry.quantity;
      return false;
    }
    return true;
  });
  if (quantity) {
    const bundle = retained.find((entry) => entry?.id === "travel-bundle");
    if (bundle) bundle.quantity += quantity;
    else retained.push({ id: "travel-bundle", quantity });
  }
  return retained;
}

function buildStartingInventory(character) {
  const inventory = [];
  const add = (id, quantity = 1) => {
    const entry = inventory.find((item) => item.id === id);
    if (entry) entry.quantity += quantity;
    else inventory.push({ id, quantity });
  };
  add(`weapon:${character.equipment.weapon}`);
  if (character.equipment.armor !== "none") add(`armor:${character.equipment.armor}`);
  if (character.equipment.shield) add("shield");
  if (character.equipment.cloak) add("travel-cloak");
  add(CLASS_PACKS[character.class] || "travel-bundle");
  add("ration");
  add("clean-water");
  add("healing-potion", 2);
  add("camp-kit");
  for (const id of Object.values(startingOutfit(character))) if (id) add(`wear:${id}`);
  return inventory;
}

function getCarryCapacity(character = state.run?.character, inventory = state.run?.inventory || []) {
  const strength = character?.scores?.str || 14;
  // Porters' gear (tumplines, net bags) adds capacity; each kind counts once.
  const bonus = [...new Set(inventory.map((entry) => entry.id))]
    .reduce((total, id) => total + (GEAR_ITEMS[id]?.capacityBonus || 0), 0);
  return strength * 15 + bonus;
}

// Secured gold stays in your strongbox at the Ceiba House; only gold found on the
// current delve (not yet secured) is carried and weighs you down.
function carriedGold() {
  if (!state.run || state.run.location !== "dungeon") return 0;
  return Math.max(0, Math.min(state.run.gold, state.run.unsecuredLoot?.gold || 0));
}

function getCarriedWeight(inventory = state.run?.inventory || [], gold = carriedGold()) {
  const gearWeight = inventory.reduce((weight, entry) => {
    const item = itemDetails(entry.id);
    return weight + (item ? item.weight * entry.quantity : 0);
  }, 0);
  return gearWeight + gold / 50;
}

function formatWeight(weight) {
  return Number.isInteger(weight) ? String(weight) : weight.toFixed(1).replace(/\.0$/, "");
}

function roundGold(gold) {
  return Math.max(0, Math.round(gold * 10) / 10);
}

function formatCurrency(gold) {
  const totalTenths = Math.round(gold * 10);
  const goldPieces = Math.floor(totalTenths / 10);
  const silverPieces = totalTenths % 10;
  if (silverPieces === 0) return `${goldPieces} gp`;
  if (goldPieces === 0) return `${silverPieces} sp`;
  return `${goldPieces} gp ${silverPieces} sp`;
}

function traderDiscountRate() {
  if (!factionMember("traders-circle")) return 0;
  const standing = factionStanding("traders-circle");
  return standing >= 65 ? 0.15 : standing >= 35 ? 0.1 : standing >= 15 ? 0.05 : 0;
}

function traderSellBonusRate() {
  return traderDiscountRate();
}

function wardenFieldcraftBonus() {
  const standing = factionStanding("road-wardens");
  return standing >= 65 ? 3 : standing >= 35 ? 2 : standing >= 15 ? 1 : 0;
}

function storeBuyPrice(item) {
  return Math.max(0.1, Math.round(item.price * (1 - traderDiscountRate()) * 10) / 10);
}

function inventoryQuantity(itemId) {
  return state.run.inventory.find((entry) => entry.id === itemId)?.quantity || 0;
}

function storeSellPrice(item) {
  const base = Math.max(0.1, Math.floor(item.price * 5) / 10);
  const personalBonus = inventoryQuantity("gold-ring") > 0 ? 1.1 : 1;
  const hallBonus = item.categoryId === "Treasure" && projectLevel("trade-hall") >= 1 ? 1.1 : 1;
  return Math.max(0.1, Math.round(base * personalBonus * hallBonus * (1 + traderSellBonusRate()) * 10) / 10);
}

function inventorySkillBonus(skill, inventory = state.run?.inventory || []) {
  const bonuses = new Map();
  for (const entry of inventory) {
    const worn = entry.id.startsWith("wear:") && isEquipped(entry.id) ? COSMETICS[entry.id.slice(5)] : null;
    const bonus = (GEAR_ITEMS[entry.id] || worn)?.skillBonuses?.[skill];
    if (bonus) bonuses.set(entry.id, bonus);
  }
  return Math.min(2, [...bonuses.values()].reduce((total, bonus) => total + bonus, 0));
}

function addInventoryItem(itemId, quantity = 1) {
  const item = itemDetails(itemId);
  if (!item || !Number.isInteger(quantity) || quantity < 1) throw new Error("That item cannot be added to the pack.");
  let entry = state.run.inventory.find((candidate) => candidate.id === itemId);
  if (entry) {
    if (itemId === "healer-kit") entry.uses = (entry.uses ?? entry.quantity * HEALER_KIT_USES) + quantity * HEALER_KIT_USES;
    entry.quantity += quantity;
  }
  else {
    entry = { id: itemId, quantity };
    if (itemId === "healer-kit") entry.uses = quantity * HEALER_KIT_USES;
    state.run.inventory.push(entry);
  }
  if (getCarriedWeight() > getCarryCapacity(state.run.character)) {
    entry.quantity -= quantity;
    if (itemId === "healer-kit") entry.uses -= quantity * HEALER_KIT_USES;
    if (!entry.quantity) state.run.inventory.splice(state.run.inventory.indexOf(entry), 1);
    return false;
  }
  recordExpeditionLoot(0, [{ id: itemId, quantity }]);
  return true;
}

function removeInventoryItem(itemId, quantity = 1) {
  const entry = state.run.inventory.find((candidate) => candidate.id === itemId);
  if (!entry || quantity < 1 || entry.quantity < quantity) return false;
  debitExpeditionItemLoot(itemId, quantity);
  entry.quantity -= quantity;
  if (itemId === "healer-kit") {
    entry.uses = Math.max(0, (entry.uses ?? (entry.quantity + quantity) * HEALER_KIT_USES) - quantity * HEALER_KIT_USES);
    entry.quantity = Math.min(entry.quantity, Math.ceil(entry.uses / HEALER_KIT_USES));
  }
  if (!entry.quantity) {
    state.run.inventory.splice(state.run.inventory.indexOf(entry), 1);
    clearMissingWornItems();
  }
  return true;
}

const WEAR_SLOTS = ["helmet", "neck", "clothes", "back"];

// The outfit picked in character creation, as wearable items.
function startingOutfit(character) {
  const look = character.appearance || {};
  const basic = window.CryptsItems.basicWearFor;
  return {
    clothes: basic("garment", look.garment === undefined ? "woven-tunic" : look.garment),
    helmet: basic("headwear", look.headwear),
    neck: basic("adornment", look.adornment)
  };
}

// Dress a character in their starting outfit (new characters and saves from before
// clothes were items): the pieces go into the pack and are worn.
function dressInStartingOutfit(character, inventory) {
  character.cosmetics ||= { owned: [], helmet: null, clothes: null, back: null };
  const outfit = startingOutfit(character);
  for (const [slot, id] of Object.entries(outfit)) {
    if (!id) continue;
    if (!inventory.some((entry) => entry.id === `wear:${id}`)) inventory.push({ id: `wear:${id}`, quantity: 1 });
    if (!character.cosmetics[slot]) character.cosmetics[slot] = id;
  }
  character.cosmetics.neck ??= null;
  character.dressByItems = true;
}

// Worn clothes must be in the pack; if the last copy is gone, take it off.
function clearMissingWornItems(character = state.run.character, inventory = state.run.inventory) {
  const cosmetics = character?.cosmetics;
  if (!cosmetics) return;
  for (const slot of WEAR_SLOTS) {
    const id = cosmetics[slot];
    if (id && !inventory.some((entry) => entry.id === `wear:${id}` && entry.quantity > 0)) cosmetics[slot] = null;
  }
}

// ---------- Dropping items ----------

function droppableQuantity(itemId) {
  const entry = state.run.inventory.find((candidate) => candidate.id === itemId);
  if (!entry) return 0;
  return Math.max(0, entry.quantity - (isEquipped(itemId) ? 1 : 0));
}

function promptDropItem(itemId) {
  const available = droppableQuantity(itemId);
  const item = itemDetails(itemId);
  if (!available || !item) {
    showToast(isEquipped(itemId) ? "Unequip that first." : "Nothing to drop.");
    return;
  }
  const inTomb = state.run.location === "dungeon";
  const verb = inTomb ? "Drop" : "Throw away";
  const amounts = [...new Set([1, available > 3 ? Math.ceil(available / 2) : 0, available].filter((amount) => amount > 0))];
  const options = amounts.map((amount) => ({
    label: amount === available && amount > 1 ? `${verb} all ${amount}` : `${verb} ${amount}`,
    action: () => dropInventoryItem(itemId, amount)
  }));
  chooseFromOptions(inTomb
    ? `Drop ${item.name} here?`
    : `Throw away ${item.name} for good?`, options.length === 1 ? [...options, { label: "Keep it", action: () => {} }] : options);
}

function dropInventoryItem(itemId, quantity) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > droppableQuantity(itemId)) return false;
  const item = itemDetails(itemId);
  const inTomb = state.run.location === "dungeon";
  if (!inTomb && state.run.location !== "city") return false;
  if (!removeInventoryItem(itemId, quantity)) return false;
  if (inTomb) {
    const { x, y } = state.run.player;
    let cache = state.run.treasures.find((entry) => entry.dropped && entry.x === x && entry.y === y && entry.items.length < 20);
    if (!cache) {
      if (state.run.treasures.length >= 160) {
        addInventoryItem(itemId, quantity);
        showToast("The floor here is too cluttered to leave anything else.");
        return false;
      }
      state.dropCounter = (state.dropCounter || 0) + 1;
      cache = { id: `dropped-${Date.now().toString(36)}-${state.dropCounter}`, x, y, gold: 0, items: [], dropped: true };
      state.run.treasures.push(cache);
    }
    const stack = cache.items.find((entry) => entry.id === itemId);
    if (stack) stack.quantity += quantity;
    else cache.items.push({ id: itemId, quantity });
    addLog(`You set down ${quantity > 1 ? `${quantity} × ` : ""}${item.name}. Step back here and collect it to pick it up.`);
  } else {
    addLog(`You throw away ${quantity > 1 ? `${quantity} × ` : ""}${item.name}.`);
  }
  showToast(`${inTomb ? "Dropped" : "Threw away"} ${item.name}${quantity > 1 ? ` ×${quantity}` : ""}.`);
  render();
  saveRun();
  return true;
}

function spendHealerKitUse() {
  const entry = state.run.inventory.find((item) => item.id === "healer-kit");
  if (!entry) return false;
  const uses = entry.uses ?? entry.quantity * HEALER_KIT_USES;
  if (uses < 1) return false;
  const previousQuantity = entry.quantity;
  entry.uses = uses - 1;
  entry.quantity = Math.ceil(entry.uses / HEALER_KIT_USES);
  debitExpeditionItemLoot("healer-kit", previousQuantity - entry.quantity);
  if (!entry.quantity) state.run.inventory.splice(state.run.inventory.indexOf(entry), 1);
  return true;
}

function isEquipped(itemId) {
  const character = state.run.character;
  if (itemId.startsWith("weapon:")) return character.equipment.weapon === itemId.slice(7);
  if (itemId.startsWith("armor:")) return character.equipment.armor === itemId.slice(6);
  if (itemId === "shield") return character.equipment.shield;
  if (itemId === "travel-cloak") return character.equipment.cloak;
  if (itemId.startsWith("wear:")) {
    const wear = COSMETICS[itemId.slice(5)];
    return Boolean(wear && character.cosmetics?.[wear.slot] === itemId.slice(5));
  }
  return false;
}

const SHOP_STOCK = [
  "ration", "clean-water", "smoked-fish", "chilis", "soup",
  "healer-kit", "travel-bundle",
  "camp-kit", "torch", "hempen-rope", "crowbar", "shovel", "iron-pot", "wild-ingredients",
  "healing-potion",
  "dungeon-gourmet-guide",
  "shield", "field-notes",
  ...["dagger", "macuahuitl", "mace", "quarterstaff", "spear", "atlatl", "shortbow", "longbow", "handaxe"]
    .map((key) => `weapon:${key}`),
  ...["leather", "hide", "scale"].map((key) => `armor:${key}`)
];

function shopStock() {
  const stock = [...SHOP_STOCK, ...window.CryptsExotics.marketAdditions, ...window.CryptsGoods.marketStock, ...window.CryptsWardrobe.marketWear];
  if (state.run && projectLevel("trade-hall") >= 2) {
    const characterClass = CLASSES[state.run.character.class];
    for (const weapon of characterClass.weapons.filter((id) => !WEAPONS[id]?.exotic && !WEAPONS[id]?.tombOnly).slice(0, 4)) stock.push(`weapon:${weapon}--fine`);
    for (const armor of characterClass.armor.filter((id) => id !== "none" && id !== "chainmail" && !ARMORS[id]?.exotic && !ARMORS[id]?.tombOnly)) stock.push(`armor:${armor}--fine`);
  }
  return stock.filter((id) => itemDetails(id));
}

function addInventoryItemsAsPossible(itemId, quantity) {
  let added = 0;
  for (let count = 0; count < quantity; count += 1) {
    if (!addInventoryItem(itemId)) break;
    added += 1;
  }
  return added;
}

function grantReward(reward, awardExperience = true) {
  const goldFound = addGoldWithinCapacity(reward.gold || 0);
  const potionsAdded = reward.potions ? addInventoryItemsAsPossible("healing-potion", reward.potions) : 0;
  let itemsAdded = 0;
  const remainingItems = [];
  for (const rewardItem of reward.items || []) {
    const found = addInventoryItemsAsPossible(rewardItem.id, rewardItem.quantity);
    itemsAdded += found;
    if (found < rewardItem.quantity) remainingItems.push({ id: rewardItem.id, quantity: rewardItem.quantity - found });
  }
  recordExpeditionLoot(goldFound);
  const xp = awardExperience ? reward.xp || 0 : 0;
  addExperience(xp);
  if (goldFound || potionsAdded || xp || itemsAdded) {
    addLog(`You find ${goldFound} gold, ${potionsAdded} potion(s), ${itemsAdded} item(s), and ${xp} experience.`);
  }
  const remaining = {};
  if (goldFound < (reward.gold || 0)) remaining.gold = (reward.gold || 0) - goldFound;
  if (potionsAdded < (reward.potions || 0)) remaining.potions = (reward.potions || 0) - potionsAdded;
  if (remainingItems.length) remaining.items = remainingItems;
  if (Object.keys(remaining).length) addLog("Some treasure is too heavy to carry. It remains here if you return after making room.");
  return Object.keys(remaining).length ? remaining : null;
}

function completeOptionalQuest(enemy) {
  const room = state.run.rooms[enemy.roomIndex];
  if (!room?.optionalQuest || state.run.questComplete) return;
  state.run.questComplete = true;
  if (enemy.templateId === "tzitzimitl") {
    addLog("The Tzitzimitl is defeated. The thirteenth floor is conquered.");
    return;
  }
  if (!state.run.factions.milestones.includes("greenstone-echo-silenced")) {
    state.run.factions.milestones.push("greenstone-echo-silenced");
    changeFactionStanding("road-wardens", 30, "you silence the pulse beyond the inner seal");
  }
  addLog("The pulse beyond the inner seal falls silent. You complete the optional deep-tomb objective.");
}

function dropEnemyTreasure(enemy) {
  if (!enemy || enemy.lootDropped) return;
  enemy.lootDropped = true;
  const gold = enemy.roomIndex >= 0 && state.run.rooms[enemy.roomIndex]?.type === "boss"
    ? rollDice("2d6").total
    : rollDice("1d4").total;
  const items = [];
  if (enemy.roomIndex >= 0 && state.run.rooms[enemy.roomIndex]?.type === "boss") {
    items.push({ id: "terracotta-figurine", quantity: 1 });
    if (state.run.mapId === GTFL_MAP_ID && randomInt(2) === 1) {
      const find = rollTombFind(Math.min(DUNGEON_FLOOR_COUNT, state.run.dungeonFloor + 2));
      if (find) items.push({ id: find, quantity: 1 });
    }
    if (enemy.templateId === "tzitzimitl") items.push({ id: "obsidian-mirror", quantity: 1 });
  } else if (randomInt(100) <= 35) {
    items.push({ id: "jade-bead", quantity: randomInt(3) });
  }
  if (state.run.gourmetGuideOwned && enemy.edible === true) {
    items.push({ id: "monster-meat", quantity: 1 });
  }
  const bonus = state.run.mapId === GTFL_MAP_ID ? bonusEnemyLoot(enemy) : { items: [], gold: 0 };
  items.push(...bonus.items);
  state.run.treasures.push({
    id: `treasure-${enemy.id}`,
    x: enemy.x,
    y: enemy.y,
    gold: gold + bonus.gold,
    items
  });
  const itemText = items.map((item) => {
    const name = itemDetails(item.id).name;
    return `${item.quantity > 1 ? `${item.quantity} ` : ""}${name}${item.quantity > 1 ? "s" : ""}`;
  });
  const contents = [formatCurrency(gold + bonus.gold), ...itemText].join(", ");
  addLog(`${enemy.name} drops ${contents}. Walk over it to collect what you can carry.`);
}

function collectTreasureAt(x, y, auto = false) {
  // Walking over things you dropped yourself leaves them be; pick them up on purpose.
  const treasures = state.run.treasures.filter((entry) => entry.x === x && entry.y === y && !(auto && entry.dropped));
  if (!treasures.length) return;
  const collectedNames = [];
  const leftBehind = [];
  for (const treasure of treasures) {
    const goldCollected = addGoldWithinCapacity(treasure.gold);
    treasure.gold = roundGold(treasure.gold - goldCollected);
    const remainingItems = [];
    let itemsCollected = 0;
    for (const entry of treasure.items) {
      const collected = addInventoryItemsAsPossible(entry.id, entry.quantity);
      itemsCollected += collected;
      if (collected) collectedNames.push(`${itemDetails(entry.id).name}${collected > 1 ? ` ×${collected}` : ""}`);
      if (collected < entry.quantity) {
        remainingItems.push({ id: entry.id, quantity: entry.quantity - collected });
        leftBehind.push(itemDetails(entry.id).name);
      }
    }
    recordExpeditionLoot(goldCollected);
    treasure.items = remainingItems;
    if (goldCollected) collectedNames.push(formatCurrency(goldCollected));
    if (treasure.gold > 0) leftBehind.push(formatCurrency(treasure.gold));
    if (treasure.mainGoal && (goldCollected > 0 || itemsCollected > 0)) {
      state.run.mainTreasureClaimed = true;
    }
  }
  state.run.treasures = state.run.treasures.filter((entry) => entry.gold > 0 || entry.items.length);
  if (collectedNames.length) sfx(collectedNames.some((name) => /gp$|gold/i.test(name)) ? "gold" : "loot");
  if (collectedNames.length) {
    const message = `Collected ${collectedNames.join(", ")}.`;
    addLog(message);
    showToast(message);
  }
  if (leftBehind.length) {
    const message = `Your pack cannot carry ${[...new Set(leftBehind)].join(", ")}; it remains here.`;
    addLog(message);
    if (!collectedNames.length) showToast(message);
  }
}

function addExperience(amount) {
  if (!Number.isInteger(amount) || amount <= 0) return;
  state.run.xp = Math.min(1_000_000, state.run.xp + amount);
  checkLevelUp();
}

function addGoldWithinCapacity(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const capacity = getCarryCapacity(state.run.character);
  const gearWeight = getCarriedWeight(state.run.inventory, 0);
  const securedGold = state.run.gold - carriedGold();
  const maximumGold = state.run.location !== "dungeon" ? MAX_GOLD
    : Math.max(state.run.gold, securedGold + Math.floor(Math.max(0, capacity - gearWeight) * 50));
  const added = Math.max(0, Math.floor(Math.min(amount, maximumGold - state.run.gold, MAX_GOLD - state.run.gold) * 10) / 10);
  state.run.gold = roundGold(state.run.gold + added);
  return added;
}

function isWalkable(x, y) {
  if (x < 0 || x >= MAP_TILE_SIZE || y < 0 || y >= MAP_TILE_SIZE) return false;
  const index = tileIndex(x, y);
  const terrain = state.run.terrain[index];
  return terrain === "door" ? state.run.openDoors.includes(index) : ["floor", "corridor"].includes(terrain);
}

function dungeonSigns() {
  const signs = dungeonSignsForSnapshot({
    floor: state.run.dungeonFloor,
    dungeonLayoutVersion: state.run.dungeonLayoutVersion,
    rooms: state.run.rooms,
    floorStairs: state.run.floorStairs
  });
  return signs.filter((sign) => sign.role !== "exit" || state.run.questComplete);
}

function dungeonSignAt(x, y) {
  return dungeonSigns().find((sign) => sign.x === x && sign.y === y);
}

// Diagonal steps follow the same rules as straight ones, so a closed door beside the
// path never blocks a diagonal step; only the destination tile matters.
function closedDoorOnDiagonal() {
  return false;
}
function canStepBetween(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1 || (!dx && !dy) || !isWalkable(to.x, to.y)) return false;
  return !closedDoorOnDiagonal(from, to);
}

function refreshCompanionFormation(dx = 0, dy = 0) {
  const party = state.run.party.filter((companion) => companion.hp > 0);
  if (!party.length) return;
  const blocked = new Set([
    ...state.run.enemies.filter((enemy) => enemy.alive).map((enemy) => tileIndex(enemy.x, enemy.y)),
    ...state.run.hazards.filter((hazard) => !hazard.triggered).map((hazard) => tileIndex(hazard.x, hazard.y)),
    ...state.run.treasures.map((treasure) => tileIndex(treasure.x, treasure.y)),
    ...state.run.party.filter((companion) => companion.hp <= 0 && Number.isInteger(companion.x) && Number.isInteger(companion.y))
      .map((companion) => tileIndex(companion.x, companion.y))
  ]);
  const preferred = dx || dy
    ? MOVEMENT_DIRECTIONS.slice().sort((a, b) =>
      (b.x * -dx + b.y * -dy) - (a.x * -dx + a.y * -dy)
    )
    : MOVEMENT_DIRECTIONS;
  const queue = [state.run.player];
  const visited = new Set([tileIndex(state.run.player.x, state.run.player.y)]);
  const positions = [];
  for (let cursor = 0; cursor < queue.length && positions.length < party.length; cursor += 1) {
    const current = queue[cursor];
    for (const direction of preferred) {
      const next = { x: current.x + direction.x, y: current.y + direction.y };
      const index = tileIndex(next.x, next.y);
      if (visited.has(index) || blocked.has(index) || !canStepBetween(current, next)) continue;
      visited.add(index);
      positions.push(next);
      queue.push(next);
      if (positions.length === party.length) break;
    }
  }
  party.forEach((member, index) => {
    if (positions[index]) Object.assign(member, positions[index]);
    member.facing = state.run.player.facing || "south";
  });
}

function finishPlayerTurn(elapsedMinutes = 10, movementMode = null) {
  state.run.steps += 1;
  if (state.run.location === "dungeon" && !state.run.lost && !state.run.won) {
    tickConditions();
    advanceSurvivalTime(false, elapsedMinutes);
    if (!state.run.lost) alliesTakeTurn();
    state.run.dodging = movementMode !== "dash" && movementMode !== "disengage";
    if (!state.run.lost) enemiesTakeTurn();
  }
  state.run.dodging = false;
  state.dashReady = false;
  state.disengageReady = false;
  revealAroundPlayer();
  render();
  animateAction("turn");
}

function facingForDelta(dx, dy) {
  const horizontal = dx < 0 ? "west" : dx > 0 ? "east" : "";
  const vertical = dy < 0 ? "north" : dy > 0 ? "south" : "";
  return vertical && horizontal ? `${vertical}${horizontal}` : vertical || horizontal || "south";
}

function animateAction(type) {
  const map = elements["dungeon-map"];
  map.classList.remove("action-advance", "action-camp");
  void map.offsetWidth;
  map.classList.add(type === "camp" ? "action-camp" : "action-advance");
  window.setTimeout(() => map.classList.remove("action-advance", "action-camp"), 420);
}

function alliesTakeTurn() {
  const targets = enemiesAdjacent();
  if (!targets.length) return;
  for (const companion of state.run.party) {
    if (companion.hp <= 0) continue;
    const target = targets.find((enemy) => enemy.alive);
    if (!target) break;
    const stats = companionStats(companion);
    showStrikeEffect("companion", companion.x, companion.y, target.x, target.y, {
      enemyId: target.id, companionId: companion.id
    });
    const die = randomInt(20);
    const total = die + stats.attackBonus;
    if (die === 20 || (die !== 1 && total >= target.ac)) {
      const dice = die === 20
        ? `${Number(/^(\d+)d(\d+)$/i.exec(stats.damageDice)[1]) * 2}d${/^(\d+)d(\d+)$/i.exec(stats.damageDice)[2]}`
        : stats.damageDice;
      const damage = Math.max(1, rollDice(dice).total + stats.damageBonus);
      target.hp = Math.max(0, target.hp - damage);
      addLog(`${companion.name} hits ${target.name} for ${damage} damage.`);
      if (target.hp === 0) {
        target.alive = false;
        completeOptionalQuest(target);
        dropEnemyTreasure(target);
        addExperience(target.xp);
        addLog(`${target.name} falls. The party gains ${target.xp} experience.`);
        showCombatFeedback("defeat", `${target.name} defeated`, { actor: "enemy", x: target.x, y: target.y, enemyId: target.id });
      } else {
        showCombatFeedback(die === 20 ? "critical" : "hit", `−${damage} HP`, { actor: "enemy", x: target.x, y: target.y, enemyId: target.id });
      }
    } else {
      addLog(`${companion.name} misses ${target.name}.`);
    }
  }
}

function movePlayer(dx, dy) {
  if (state.messageBox || state.utilityDrawer || state.run.lost || state.run.won || state.run.location !== "dungeon") return false;
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1 || (!dx && !dy)) return false;
  const previousFacing = state.run.player.facing || "south";
  state.run.player.facing = facingForDelta(dx, dy);
  const movementMode = state.disengageReady ? "disengage" : state.dashReady ? "dash" : "walk";
  const stride = state.dashReady ? 2 : 1;
  let moved = false;
  let enteredRoom = false;
  let encounteredHazard = false;
  let stoppedAtClosedDoor = false;
  for (let step = 0; step < stride; step += 1) {
    const { x, y } = state.run.player;
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || nx >= MAP_TILE_SIZE || ny < 0 || ny >= MAP_TILE_SIZE) break;
    const destinationIndex = tileIndex(nx, ny);
    if (state.run.terrain[destinationIndex] === "door" && !state.run.openDoors.includes(destinationIndex) &&
      !closedDoorOnDiagonal({ x, y }, { x: nx, y: ny })) {
      if (!openDungeonDoor({ x: nx, y: ny, index: destinationIndex })) {
        finishPlayerTurn();
        return false;
      }
    }
    if (!canStepBetween({ x, y }, { x: nx, y: ny })) {
      if (state.run.terrain[tileIndex(nx, ny)] === "door" || closedDoorOnDiagonal({ x, y }, { x: nx, y: ny })) {
        stoppedAtClosedDoor = true;
        showToast("A closed doorway blocks the way.");
      }
      break;
    }
    const knownTrap = state.run.hazards.find((hazard) => !hazard.triggered && hazard.revealed && hazard.x === nx && hazard.y === ny);
    if (knownTrap && state.trapStepConfirm !== destinationIndex) {
      if (!moved) {
        state.trapStepConfirm = destinationIndex;
        showToast(t("{0} is there. Disarm it (Space or Shift+F), or move that way again to step onto it.", { 0: knownTrap.name }));
      }
      break;
    }
    const blocker = state.run.enemies.find((enemy) => enemy.alive && enemy.x === nx && enemy.y === ny);
    if (blocker) {
      if (moved) break;
      if (distanceInSquares(blocker, { x, y }) === 1) attackEnemy(blocker);
      return false;
    }
    const downedCompanion = state.run.party.find((companion) =>
      companion.hp <= 0 && companion.x === nx && companion.y === ny
    );
    if (downedCompanion) break;
    const leavingThreats = enemiesAdjacent().filter((enemy) =>
      distanceInSquares(enemy, { x: nx, y: ny }) !== 1
    );
    if (!state.disengageReady) {
      for (const enemy of leavingThreats) {
        enemyAttack(enemy, true, movementMode === "walk");
        if (state.run.lost) {
          state.dashReady = false;
          state.disengageReady = false;
          render();
          return false;
        }
      }
    }
    state.run.player.x = nx;
    state.run.player.y = ny;
    refreshCompanionFormation(dx, dy);
    moved = true;
    const newRoomIndex = roomIndexAt(nx, ny);
    if (newRoomIndex >= 0 && newRoomIndex !== state.run.currentRoom) {
      enteredRoom = true;
      state.run.currentRoom = newRoomIndex;
      resolveRoomEntry(newRoomIndex);
    }
    reachExitAt(nx, ny);
    if (state.run.hazards.some((hazard) => !hazard.triggered && hazard.x === nx && hazard.y === ny)) {
      encounteredHazard = true;
    }
    triggerHazard(nx, ny);
    if (state.run.lost) break;
    collectTreasureAt(nx, ny, true);
    if (state.run.lost || state.run.won) break;
  }
  if (moved) {
    state.lookTarget = null;
    state.trapStepConfirm = null;
    finishPlayerTurn(10, movementMode);
  }
  else {
    state.dashReady = false;
    state.disengageReady = false;
    if (state.run.player.facing !== previousFacing) renderMap();
    renderActions();
  }
  return moved && !stoppedAtClosedDoor && !enteredRoom && !encounteredHazard && !state.run.lost && !state.run.won &&
    !document.querySelector("dialog[open]");
}

function showStrikeEffect(actor, x, y, targetX, targetY, ids = {}) {
  const effect = {
    kind: "strike",
    actor,
    x,
    y,
    targetX,
    targetY,
    enemyId: ids.enemyId || "",
    companionId: ids.companionId || "",
    until: Date.now() + 360
  };
  state.combatEffects.push(effect);
  window.setTimeout(() => {
    state.combatEffects = state.combatEffects.filter((item) => item !== effect);
    if (state.gameStarted && state.run?.location === "dungeon") renderMap();
  }, 380);
}

function stopHeldMovement() {
  window.clearTimeout(heldMoveTimer);
  heldMoveTimer = 0;
  const activeMove = heldMove;
  heldMove = null;
  if (activeMove?.button.hasPointerCapture(activeMove.pointerId)) {
    activeMove.button.releasePointerCapture(activeMove.pointerId);
  }
}

function clearTouchMovementInput() {
  stopHeldMovement();
  for (const button of touchPointerButtons.values()) touchMoveButtons.delete(button);
  touchPointerButtons.clear();
}

function heldMovementCanContinue() {
  return Boolean(heldMove && state.gameStarted && state.run?.location === "dungeon" &&
    !state.run.lost && !state.run.won && !document.hidden &&
    !document.querySelector("dialog[open]") && !state.utilityDrawer && !state.messageBox);
}

function continueHeldMovement() {
  if (!heldMovementCanContinue()) {
    stopHeldMovement();
    return;
  }
  const [dx, dy] = heldMove.button.dataset.move.split(",").map(Number);
  if (!movePlayer(dx, dy) || state.run.enemies.some((enemy) =>
    enemy.alive && (enemy.alerted || distanceInSquares(enemy, state.run.player) <= 7)
  )) {
    stopHeldMovement();
    return;
  }
  heldMoveTimer = window.setTimeout(continueHeldMovement, HOLD_MOVE_INTERVAL_MS);
}

function beginHeldMovement(button, event) {
  if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
  if (button.disabled || state.run?.location !== "dungeon" || state.messageBox || state.utilityDrawer) return;
  stopHeldMovement();
  event.preventDefault();
  heldMove = { button, pointerId: event.pointerId };
  button.setPointerCapture(event.pointerId);
  const [dx, dy] = button.dataset.move.split(",").map(Number);
  if (!movePlayer(dx, dy) || state.run.enemies.some((enemy) =>
    enemy.alive && (enemy.alerted || distanceInSquares(enemy, state.run.player) <= 7)
  )) {
    stopHeldMovement();
    return;
  }
  heldMoveTimer = window.setTimeout(continueHeldMovement, HOLD_MOVE_INITIAL_DELAY_MS);
}

function triggerHazard(x, y) {
  const hazard = state.run.hazards.find((item) => !item.triggered && item.x === x && item.y === y);
  if (!hazard) return;
  hazard.triggered = true;
  hazard.revealed = true;
  sfx("trap");
  const ability = hazard.ability === "Constitution" ? "con" : "dex";
  const modifier = savingThrowBonus(ability) + (equippedArmorTrait() === "sure-footed" ? 3 : 0);
  const check = randomInt(20) + modifier;
  if (check >= hazard.dc) {
    addLog(`You avoid ${hazard.name} with a ${hazard.ability} save (${check} vs. ${hazard.dc}).`);
    return;
  }
  const damage = rollDice(hazard.damage).total;
  state.run.hp = Math.max(0, state.run.hp - damage);
  showCombatFeedback("player-hit", `−${damage} HP`, { actor: "player", x, y });
  addLog(`${hazard.name} catches you for ${damage} damage (${hazard.ability} save ${check} vs. ${hazard.dc}).`);
  checkDefeat();
}

function flankingCompanion(enemy) {
  if (!enemy || !state.run.player) return null;
  const playerX = Math.sign(state.run.player.x - enemy.x);
  const playerY = Math.sign(state.run.player.y - enemy.y);
  if (!playerX && !playerY) return null;
  return state.run.party.find((companion) =>
    companion.hp > 0 &&
    companion.x === enemy.x - playerX &&
    companion.y === enemy.y - playerY
  ) || null;
}

function attackEnemy(enemy, { ranged = false, disadvantage = false } = {}) {
  if (!enemy || !enemy.alive || state.run.lost || state.run.won) return;
  state.run.player.facing = facingForDelta(enemy.x - state.run.player.x, enemy.y - state.run.player.y);
  showStrikeEffect("player", state.run.player.x, state.run.player.y, enemy.x, enemy.y, { enemyId: enemy.id });
  const stats = currentCharacterStats();
  const flanker = ranged ? null : flankingCompanion(enemy);
  const attackRoll = rollD20({ advantage: Boolean(flanker), disadvantage });
  const { die, rolls } = attackRoll;
  const studied = bestiaryBonus(enemy);
  stats.attackBonus += studied.attack;
  stats.damageBonus += studied.damage;
  const total = die + stats.attackBonus;
  const attackKind = ranged ? "ranged attack" : "attack";
  const bonusSign = stats.attackBonus < 0 ? "−" : "+";
  const rollNote = attackRoll.mode === "normal"
    ? `(d20 ${die} ${bonusSign} ${Math.abs(stats.attackBonus)} = ${total})`
    : `(${attackRoll.mode} d20 ${rolls.join("/")} → ${die} ${bonusSign} ${Math.abs(stats.attackBonus)} = ${total}${flanker ? `; ${flanker.name} flanks` : ""})`;
  let damageDealt = 0;
  if (die >= criticalThreshold()) {
    const dice = /^(\d+)d(\d+)$/i.exec(stats.damageDice);
    const damage = Math.max(0, rollDice(`${Number(dice[1]) * 2}d${dice[2]}`).total + stats.damageBonus);
    enemy.hp = Math.max(0, enemy.hp - damage);
    damageDealt = Math.min(enemy.hp + damage, damage);
    addLog(`Critical hit! Your ${attackKind} strikes ${enemy.name} for ${damage} damage${rollNote}.`);
  } else if (die === 1 || total < enemy.ac) {
    addLog(`Your ${attackKind} misses ${enemy.name} ${rollNote} vs. AC ${enemy.ac}.`);
    showCombatFeedback("miss", "Miss", { actor: "enemy", x: enemy.x, y: enemy.y, enemyId: enemy.id });
  } else {
    const damage = Math.max(0, rollDice(stats.damageDice).total + stats.damageBonus);
    enemy.hp = Math.max(0, enemy.hp - damage);
    damageDealt = Math.min(enemy.hp + damage, damage);
    addLog(`Your ${attackKind} hits ${enemy.name} for ${damage} damage ${rollNote}.`);
  }
  afterPlayerHit(enemy, damageDealt);
  if (enemy.hp <= 0) {
    resolveEnemyDefeat(enemy);
  } else if (damageDealt > 0) {
    showCombatFeedback(die >= criticalThreshold() ? "critical" : "hit", `−${damageDealt} HP`, { actor: "enemy", x: enemy.x, y: enemy.y, enemyId: enemy.id });
  }
  finishPlayerTurn();
}

function resolveEnemyDefeat(enemy) {
  if (!enemy?.alive || enemy.hp > 0) return;
  enemy.alive = false;
  completeOptionalQuest(enemy);
  onCreatureDefeated(enemy);
  dropEnemyTreasure(enemy);
  showCombatFeedback("defeat", `${enemy.name} defeated`, { actor: "enemy", x: enemy.x, y: enemy.y, enemyId: enemy.id });
  addExperience(enemy.xp);
  addLog(`${enemy.name} falls. You gain ${enemy.xp} experience.`);
}

function attack() {
  const targets = attackTargets();
  if (!targets.length) {
    showToast("No creature is within your weapon's reach.");
    return;
  }
  chooseEnemyTarget("Choose a creature to attack", targets, (target) => {
    const ranged = distanceInSquares(target, state.run.player) > 1;
    attackEnemy(target, { ranged, disadvantage: ranged && enemiesAdjacent().length > 0 });
  });
}

function spellTargets(range = 7) {
  return state.run.enemies
    .filter((enemy) => enemy.alive && distanceInSquares(enemy, state.run.player) <= range &&
      hasLineOfSight(state.run.player, enemy))
    .sort((a, b) => distanceInSquares(a, state.run.player) - distanceInSquares(b, state.run.player) ||
      a.name.localeCompare(b.name));
}

function spellTarget(range = 7) {
  return spellTargets(range)[0] || null;
}

function castSpell(spellId, chosenTarget = null) {
  const spell = SPELLS[spellId];
  const classId = state.run.character.class;
  if (!spell || !hasSpellcasting(classId, state.run.level) || state.run.lost || state.run.won ||
    !CLASS_SPELLS[classId]?.includes(spellId)) return;
  if (!spell.free && state.run.spellSlots < 1) {
    showToast("You have no spell power left. Rest at camp to recover it.");
    return;
  }
  sfx("spell");
  if (spell.healing) {
    if (!canHeal()) {
      showToast("Eat until your food meter reaches 75% before healing.");
      return;
    }
    if (state.run.hp >= state.run.maxHp) return;
    state.run.spellSlots -= 1;
    const ability = spellcastingAbility(classId);
    const healingDice = spellDamageAtLevel(spell.healing, state.run.level);
    const healing = Math.max(1, rollDice(healingDice).total + abilityModifier(state.run.character.scores[ability]));
    const restored = Math.min(healing, state.run.maxHp - state.run.hp);
    state.run.hp += restored;
    addLog(`You cast ${spell.name} and recover ${restored} hit points.`);
    showCombatFeedback("heal", `+${restored} HP`, { actor: "player", x: state.run.player.x, y: state.run.player.y });
    finishPlayerTurn();
    return;
  }
  const targets = spellTargets(spell.range);
  if (!targets.length) {
    showToast("No creature is in sight and within spell range.");
    return;
  }
  if (!chosenTarget && targets.length > 1) {
    chooseEnemyTarget(`Choose a target for ${spell.name}`, targets, (target) => castSpell(spellId, target));
    return;
  }
  const target = chosenTarget || targets[0];
  if (!targets.includes(target)) {
    showToast("That creature is no longer a valid target.");
    return;
  }
  if (!spell.free) state.run.spellSlots -= 1;
  const ability = spellcastingAbility(classId);
  const attackBonus = abilityModifier(state.run.character.scores[ability]) +
    2 + Math.floor(Math.max(0, state.run.level - 1) / 4) +
    (BACKGROUNDS[state.run.character.background]?.spellAttackBonus || 0) +
    heroStatModifiers().attack + bestiaryBonus(target).attack;
  const attackRoll = rollD20({ disadvantage: enemiesAdjacent().length > 0 });
  const die = attackRoll.die;
  const total = die + attackBonus;
  let damage = 0;
  if (die === 20) {
    const damageDice = spellDamageAtLevel(spell.damage, state.run.level);
    damage = rollDice(damageDice).total + rollDice(damageDice).total;
  } else if (die !== 1 && total >= target.ac) {
    damage = rollDice(spellDamageAtLevel(spell.damage, state.run.level)).total;
  }
  if (damage) {
    target.hp = Math.max(0, target.hp - damage);
    const rollText = attackRoll.mode === "normal" ? `d20 ${die}` : `${attackRoll.mode} d20 ${attackRoll.rolls.join("/")} → ${die}`;
    addLog(`Your ${spell.name} hits ${target.name} for ${damage} damage (${rollText} + ${attackBonus} = ${total} vs. AC ${target.ac}).`);
    showCombatFeedback(die === 20 ? "critical" : "hit", `−${damage} HP`, {
      actor: "enemy", x: target.x, y: target.y, enemyId: target.id
    });
    if (target.hp <= 0) resolveEnemyDefeat(target);
  } else {
    const rollText = attackRoll.mode === "normal" ? `d20 ${die}` : `${attackRoll.mode} d20 ${attackRoll.rolls.join("/")} → ${die}`;
    addLog(`Your ${spell.name} misses ${target.name} (${rollText} + ${attackBonus} = ${total} vs. AC ${target.ac}).`);
  }
  finishPlayerTurn();
}

function distanceInSquares(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function hasLineOfSight(from, to) {
  let x = from.x;
  let y = from.y;
  const deltaX = to.x - x;
  const deltaY = to.y - y;
  const distanceX = Math.abs(deltaX);
  const distanceY = Math.abs(deltaY);
  const stepX = Math.sign(deltaX);
  const stepY = Math.sign(deltaY);
  const blocksSight = (tileX, tileY) => {
    if (tileX < 0 || tileX >= MAP_TILE_SIZE || tileY < 0 || tileY >= MAP_TILE_SIZE) return true;
    const index = tileIndex(tileX, tileY);
    const terrain = state.run.terrain[index];
    return terrain === "door" ? !state.run.openDoors.includes(index) : !["floor", "corridor"].includes(terrain);
  };
  let crossedX = 0;
  let crossedY = 0;
  while (crossedX < distanceX || crossedY < distanceY) {
    const nextX = (1 + 2 * crossedX) * distanceY;
    const nextY = (1 + 2 * crossedY) * distanceX;
    if (nextX === nextY) {
      if (blocksSight(x + stepX, y) || blocksSight(x, y + stepY)) return false;
      x += stepX;
      y += stepY;
      crossedX += 1;
      crossedY += 1;
    } else if (nextX < nextY) {
      x += stepX;
      crossedX += 1;
    } else {
      y += stepY;
      crossedY += 1;
    }
    if ((x !== to.x || y !== to.y) && blocksSight(x, y)) return false;
  }
  return true;
}

function rangedTargets() {
  const weapon = currentCharacterStats().weapon;
  if (!weapon.ranged) return [];
  const player = state.run.player;
  return state.run.enemies
    .filter((enemy) => enemy.alive &&
      distanceInSquares(player, enemy) <= weapon.range && hasLineOfSight(player, enemy))
    .sort((a, b) => distanceInSquares(player, a) - distanceInSquares(player, b) ||
      a.name.localeCompare(b.name));
}

function attackTargets() {
  const adjacent = enemiesAdjacent();
  const ranged = rangedTargets().filter((enemy) => distanceInSquares(enemy, state.run.player) > 1);
  return [...adjacent, ...ranged];
}

function dash() {
  if (state.run.lost || state.run.won) return;
  state.dashReady = !state.dashReady;
  state.disengageReady = false;
  renderActions();
}

function disengage() {
  if (state.run.lost || state.run.won) return;
  state.disengageReady = !state.disengageReady;
  state.dashReady = false;
  renderActions();
}

function skillBonus(skill) {
  const stats = currentCharacterStats();
  const ability = SKILL_ABILITIES[skill];
  const character = state.run.character || makeLegacyCharacter();
  const backgroundSkills = BACKGROUNDS[character.background]?.skillIds || [];
  const proficient = backgroundSkills.includes(skill) || (character.classSkills || []).includes(skill);
  const proficiency = proficient ? 2 + Math.floor(Math.max(0, state.run.level - 1) / 4) : 0;
  const backgroundBonus = backgroundSkills.includes(skill) ? BACKGROUNDS[character.background]?.skillBonus || 0 : 0;
  return stats.modifiers[ability] + proficiency + backgroundBonus +
    Number(hasBalancedNutrition(state.run.needs)) + inventorySkillBonus(skill) + buffSkillBonus(skill);
}

function savingThrowBonus(ability) {
  const stats = currentCharacterStats();
  const characterClass = CLASSES[state.run.character?.class];
  const proficient = characterClass?.saves.includes(ability);
  const proficiency = proficient ? 2 + Math.floor(Math.max(0, state.run.level - 1) / 4) : 0;
  return stats.modifiers[ability] + proficiency + progressionSaveBonus();
}

function searchArea() {
  if (state.run.lost || state.run.won) return;
  let found = 0;
  for (const hazard of state.run.hazards) {
    if (hazard.triggered || hazard.revealed || distanceInSquares(state.run.player, hazard) > 4 ||
      !hasLineOfSight(state.run.player, hazard)) continue;
    const roll = randomInt(20) + skillBonus("perception");
    if (roll >= hazard.dc) {
      hazard.revealed = true;
      found += 1;
    }
  }
  sfx("search");
  addLog(found ? `You search carefully and reveal ${found} hidden hazard${found === 1 ? "" : "s"}.` : "You search the nearby stonework but find no hidden hazards.");
  finishPlayerTurn();
}

function disarmNearbyHazard(selectedHazard = null) {
  if (state.run.lost || state.run.won) return;
  const hazard = selectedHazard || state.run.hazards.find((item) => !item.triggered && item.revealed &&
    distanceInSquares(item, state.run.player) <= 1);
  if (!hazard) {
    showToast("No revealed trap is close enough to disarm. Search nearby first.");
    return;
  }
  if (hazard.triggered || !hazard.revealed || distanceInSquares(hazard, state.run.player) > 1) {
    showToast("That trap is no longer close enough to disarm.");
    return;
  }
  const roll = randomInt(20) + skillBonus("sleight-of-hand");
  if (roll >= hazard.dc) {
    hazard.triggered = true;
    addLog(`You disarm ${hazard.name} (Sleight of Hand ${roll} vs. DC ${hazard.dc}).`);
    sfx("disarm");
  } else {
    addLog(`You fail to disarm ${hazard.name} (Sleight of Hand ${roll} vs. DC ${hazard.dc}).`);
    triggerHazard(hazard.x, hazard.y);
  }
  finishPlayerTurn();
}

function findEnemyStep(enemy) {
  const { x: playerX, y: playerY } = state.run.player;
  const queue = [{ x: enemy.x, y: enemy.y, first: null }];
  const visited = new Set([tileIndex(enemy.x, enemy.y)]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    if (current.x === playerX && current.y === playerY) return current.first;
    for (const direction of shuffle(MOVEMENT_DIRECTIONS)) {
      const x = current.x + direction.x;
      const y = current.y + direction.y;
      const key = tileIndex(x, y);
      if (visited.has(key) || !canStepBetween(current, { x, y })) continue;
      if (state.run.enemies.some((other) => other.alive && other.id !== enemy.id && other.x === x && other.y === y)) continue;
      if (state.run.party.some((companion) => companion.x === x && companion.y === y)) continue;
      visited.add(key);
      queue.push({ x, y, first: current.first || { x, y } });
    }
  }
  return null;
}

function enemiesTakeTurn() {
  for (const enemy of state.run.enemies) {
    if (!enemy.alive || state.run.lost || state.run.won) continue;
    const distance = distanceInSquares(enemy, state.run.player);
    if (distance <= 7 || enemy.roomIndex === state.run.currentRoom) enemy.alerted = true;
    if (!enemy.alerted) continue;
    if (enemySleeps(enemy)) continue;
    if (enemySkipsTurn(enemy)) {
      addLog(`${enemy.name} reels and loses its turn.`);
      continue;
    }
    if (distance === 1) {
      enemyAttack(enemy);
      continue;
    }
    const next = findEnemyStep(enemy);
    if (next) {
      enemy.x = next.x;
      enemy.y = next.y;
    }
  }
}

function showCombatFeedback(kind, message, target = {}) {
  sfxForCombatFeedback(kind, target);
  const feedback = elements["combat-feedback"];
  feedback.className = `combat-feedback ${kind}`;
  feedback.textContent = message;
  void feedback.offsetWidth;
  feedback.classList.add("playing");
  window.setTimeout(() => feedback.classList.remove("playing"), 760);
  if (kind === "miss") return;
  const effect = {
    kind: kind === "defeat" ? "death" : kind === "player-death" ? "player-death" : kind === "heal" ? "heal" : "hit",
    actor: target.actor || (kind === "player-hit" || kind === "player-death" ? "player" : "enemy"),
    x: Number.isInteger(target.x) ? target.x : state.run.player.x,
    y: Number.isInteger(target.y) ? target.y : state.run.player.y,
    enemyId: target.enemyId || "",
    companionId: target.companionId || "",
    message,
    until: Date.now() + 700
  };
  state.combatEffects.push(effect);
  window.setTimeout(() => {
    state.combatEffects = state.combatEffects.filter((item) => item !== effect);
    if (state.gameStarted && state.run?.location === "dungeon") renderMap();
  }, 720);
  if (effect.kind === "hit" || effect.kind === "heal") {
    const actor = effect.actor === "player" ? elements["player-combatant"]
      : effect.actor === "companion" ? null : elements.encounter;
    if (!actor) return;
    const feedbackClass = effect.kind === "heal" ? "heal-flash" : "hit-flash";
    actor.classList.remove("hit-flash", "heal-flash");
    void actor.offsetWidth;
    actor.classList.add(feedbackClass);
    window.setTimeout(() => actor.classList.remove(feedbackClass), 520);
  }
}

function enemyAttack(enemy, opportunity = false, automaticDodge = state.run.dodging) {
  const targets = partyMembers().filter((member) => member.hero ? state.run.hp > 0 : member.hp > 0);
  const target = targets[randomInt(targets.length) - 1];
  if (!target) return;
  if (target.hero) Object.assign(target, { x: state.run.player.x, y: state.run.player.y });
  showStrikeEffect("enemy", enemy.x, enemy.y, target.x, target.y, {
    enemyId: enemy.id,
    companionId: target.hero ? "" : target.id
  });
  const dodging = target.hero && automaticDodge;
  const rolls = dodging ? [randomInt(20), randomInt(20)] : [randomInt(20)];
  const die = Math.min(...rolls);
  const total = die + enemy.attackBonus;
  const armorClass = target.hero ? currentCharacterStats().ac : companionStats(target).ac;
  if (die === 20 || (die !== 1 && total >= armorClass)) {
    const roll = rollDice(enemy.damage);
    const damage = die === 20 ? roll.total + roll.rolls.reduce((sum, value) => sum + value, 0) : roll.total;
    if (target.hero) {
      state.run.hp = Math.max(0, state.run.hp - damage);
      showCombatFeedback("player-hit", `−${damage} HP`, { actor: "player", x: state.run.player.x, y: state.run.player.y });
      checkDefeat();
      maybeInflictCondition(enemy);
    } else {
      target.hp = Math.max(0, target.hp - damage);
      if (target.hp === 0) addLog(`${target.name} is knocked out! They need rest to recover.`);
      showCombatFeedback("player-hit", `−${damage} HP`, {
        actor: "companion", companionId: target.id, x: target.x, y: target.y
      });
    }
    addLog(`${enemy.name} hits ${target.hero ? "you" : target.name} for ${damage} damage${die === 20 ? " (critical)" : ""}${opportunity ? " with an opportunity attack" : dodging ? " despite your guard" : ""}.`);
  } else {
    addLog(`${enemy.name} misses ${target.hero ? "you" : target.name}${opportunity ? " with an opportunity attack" : ""} (d20 ${rolls.join("/")}, total ${total} vs. AC ${armorClass}).`);
    showCombatFeedback("miss", "Missed", { actor: target.hero ? "player" : "companion", x: target.x, y: target.y, companionId: target.id });
  }
}

function usePotion() {
  const ailing = progress().conditions.length > 0;
  if (inventoryQuantity("healing-potion") < 1 || (state.run.hp >= state.run.maxHp && !ailing) || state.run.lost || state.run.won) return;
  const healing = rollDice("2d4+2").total;
  const restored = Math.min(healing, state.run.maxHp - state.run.hp);
  state.run.hp += restored;
  removeInventoryItem("healing-potion");
  addLog(`You use your medicine and recover ${restored} hit point${restored === 1 ? "" : "s"}${ailing ? ", and your ailments ease" : ""}.`);
  clearConditions();
  showCombatFeedback("heal", `+${restored} HP`, { actor: "player", x: state.run.player.x, y: state.run.player.y });
  finishPlayerTurn();
}

// Why a carried item can't be used right now (a short reason), or null if it can.
// Mirrors the checks in useInventoryItem so the pack button and the action agree.
function itemUseBlocked(entry) {
  const id = entry.id;
  const inDungeon = state.run.location === "dungeon";
  if (state.run.lost || state.run.won) return "The expedition is over.";
  if (RELIC_RITES[id]) return relicRiteBlocked(entry);
  const trapWithin = (reach, needSight) => state.run.hazards.some((hazard) => !hazard.triggered && hazard.revealed &&
    distanceInSquares(hazard, state.run.player) <= reach && (!needSight || hasLineOfSight(state.run.player, hazard)));
  if (id === "healing-potion") return state.run.hp >= state.run.maxHp && !progress().conditions.length ? "You're unhurt and have no ailments." : null;
  if (id === "torch" || id === "ocote") return inDungeon ? null : "Light it inside the tomb.";
  if (id === "chili-smoke") return inDungeon && enemiesAdjacent().length ? null : "Crack it when a creature is right beside you.";
  if (FOOD_ITEMS[id]) {
    return state.run.needs.food >= 100 && Object.keys(NUTRIENT_NAMES).every((nutrient) =>
      state.run.needs.nutrition[nutrient] + FOOD_ITEMS[id].nutrients[nutrient] >= 100) ? "You're already full." : null;
  }
  if (id === "clean-water" || id === "cacao-drink") return state.run.needs.water >= 100 ? "You're not thirsty." : null;
  if (id === "ixpatli") return progress().conditions.length ? null : "No poison, bleeding, or weakness to treat.";
  if (id === "maguey-salve") {
    return state.run.hp >= state.run.maxHp && !progress().conditions.some((condition) => condition.id === "bleed") ? "No wounds that need the salve." : null;
  }
  if (id === "picietl") return null;
  if (id === "healer-kit") {
    if ((entry.uses ?? entry.quantity * HEALER_KIT_USES) < 1) return "The kit is used up.";
    return state.run.party.some((companion) => companion.hp <= 0) ? null : "No companion needs field treatment.";
  }
  if (id === "crowbar") return inDungeon && trapWithin(1, false) ? null : "Stand next to a revealed trap.";
  if (id === "hempen-rope") return inDungeon && trapWithin(10, true) ? null : "No revealed trap in the rope's reach and sight.";
  return null;
}

// The carried food that does you the most good right now: it fills the most of what your
// food meter and nutrients are missing; on a tie, the one you have the most of. Null if
// nothing carried would help (you're already full).
function bestMealToEat() {
  const needs = state.run.needs;
  let best = null;
  let bestScore = 0;
  for (const id of Object.keys(FOOD_ITEMS)) {
    const quantity = inventoryQuantity(id);
    if (!quantity || itemUseBlocked({ id, quantity })) continue;
    const food = FOOD_ITEMS[id];
    const score = Math.min(food.food || 0, 100 - needs.food) +
      Object.keys(NUTRIENT_NAMES).reduce((sum, nutrient) =>
        sum + Math.min(food.nutrients?.[nutrient] || 0, Math.max(0, 100 - (needs.nutrition?.[nutrient] ?? 0))), 0) +
      quantity / 1000;
    if (score > bestScore) { best = id; bestScore = score; }
  }
  return best;
}

function eatBestMeal() {
  const meal = bestMealToEat();
  if (!meal) {
    showToast(Object.keys(FOOD_ITEMS).some((id) => inventoryQuantity(id)) ? "You're already full." : "You have no food in your pack.");
    return;
  }
  useInventoryItem(meal);
}

function useInventoryItem(itemId) {
  if (state.run.lost || state.run.won || !inventoryQuantity(itemId)) return;
  if (RELIC_RITES[itemId]) {
    const used = useRelicRite(itemId);
    if (used === true) {
      if (state.run.location === "dungeon") finishPlayerTurn();
      else render();
    }
    return;
  }
  if (itemId === "healing-potion") {
    usePotion();
    return;
  }
  if (FOOD_ITEMS[itemId]) {
    if (!removeInventoryItem(itemId)) return;
    sfx(GEAR_ITEMS[itemId]?.category === "Drink" ? "drink" : "eat");
    applyMeal(state.run.needs, itemId);
    if (FOOD_ITEMS[itemId].buff) grantBuff(FOOD_ITEMS[itemId].buff);
    if (FOOD_ITEMS[itemId].water) {
      state.run.needs.water = Math.min(100, state.run.needs.water + FOOD_ITEMS[itemId].water);
      state.run.needs.waterZeroHours = 0;
    }
    if (FOOD_ITEMS[itemId].heal && state.run.hp < state.run.maxHp) {
      const restored = Math.min(FOOD_ITEMS[itemId].heal, state.run.maxHp - state.run.hp);
      state.run.hp += restored;
      showCombatFeedback("heal", `+${restored} HP`, { actor: "player", x: state.run.player.x, y: state.run.player.y });
    }
    addLog(`You eat ${FOOD_ITEMS[itemId].name}. Food rises by ${FOOD_ITEMS[itemId].food}; its nutrition supports ${Object.entries(FOOD_ITEMS[itemId].nutrients)
      .filter(([, amount]) => amount >= 30).map(([nutrient]) => NUTRIENT_NAMES[nutrient].toLowerCase()).join(" and ") || "your diet"}.`);
  } else if (itemId === "clean-water") {
    if (!removeInventoryItem(itemId)) return;
    drinkWater(state.run.needs);
    sfx("drink");
    addLog("You drink clean water. Hydration rises by 70.");
  } else if (itemId === "cacao-drink") {
    if (!removeInventoryItem(itemId)) return;
    state.run.needs.water = Math.min(100, state.run.needs.water + 40);
    state.run.needs.waterZeroHours = 0;
    state.run.needs.food = Math.min(100, state.run.needs.food + 15);
    sfx("drink");
    addLog("You drink frothed cacao. Water rises by 40 and food by 15.");
  } else if (itemId === "ixpatli") {
    if (!progress().conditions.length) {
      showToast("You have no poison, bleeding, or weakness to treat.");
      return;
    }
    if (!removeInventoryItem(itemId)) return;
    clearConditions("You press an ixpatli poultice to the wound. Your ailments ease.");
  } else if (itemId === "torch" || itemId === "ocote") {
    if (state.run.location !== "dungeon") {
      showToast("Light a torch after entering the tomb.");
      return;
    }
    removeInventoryItem(itemId);
    sfx("miss");
    const radius = itemId === "ocote" ? 12 : 8;
    const { x, y } = state.run.player;
    for (let ty = Math.max(0, y - radius); ty <= Math.min(MAP_TILE_SIZE - 1, y + radius); ty += 1) {
      for (let tx = Math.max(0, x - radius); tx <= Math.min(MAP_TILE_SIZE - 1, x + radius); tx += 1) {
        const target = { x: tx, y: ty };
        if (distanceInSquares(target, state.run.player) <= radius && hasLineOfSight(state.run.player, target)) {
          state.run.seen[tileIndex(tx, ty)] = true;
        }
      }
    }
    addLog(itemId === "ocote"
      ? "The ocote splints flare up, throwing resin-bright light far down the passages."
      : "You light a torch, illuminating the surrounding tomb. Search explicitly to detect hidden hazards.");
  } else if (itemId === "maguey-salve") {
    const bleeding = progress().conditions.some((entry) => entry.id === "bleed");
    if (state.run.hp >= state.run.maxHp && !bleeding) {
      showToast("You have no wounds that need the salve.");
      return;
    }
    if (!removeInventoryItem(itemId)) return;
    const restored = Math.min(rollDice("1d4+1").total, state.run.maxHp - state.run.hp);
    state.run.hp += restored;
    progress().conditions = progress().conditions.filter((entry) => entry.id !== "bleed");
    showCombatFeedback("heal", `+${restored} HP`, { actor: "player", x: state.run.player.x, y: state.run.player.y });
    addLog(`You smear maguey salve on the wound and recover ${restored} hit point${restored === 1 ? "" : "s"}${bleeding ? "; the bleeding stops" : ""}.`);
  } else if (itemId === "picietl") {
    if (!removeInventoryItem(itemId)) return;
    for (const member of partyMembers()) member.needs.hoursAwake = 0;
    addLog("You chew a pinch of picietl. The sharp, bitter tobacco chases the sleep from everyone's eyes.");
  } else if (itemId === "chili-smoke") {
    const adjacent = state.run.location === "dungeon"
      ? state.run.enemies.filter((enemy) => enemy.alive && distanceInSquares(enemy, state.run.player) <= 1) : [];
    if (!adjacent.length) {
      showToast("Crack the chili smoke when a creature is right beside you.");
      return;
    }
    if (!removeInventoryItem(itemId)) return;
    for (const enemy of adjacent) enemy.staggered = true;
    sfx("miss");
    addLog(`You crack the gourd and burning chili smoke rolls out. ${adjacent.map((enemy) => enemy.name).join(", ")} ${adjacent.length === 1 ? "chokes and loses" : "choke and lose"} the next turn.`);
  } else if (itemId === "healer-kit") {
    const patient = state.run.party.find((companion) => companion.hp <= 0);
    if (!patient) {
      showToast("No companion needs field treatment.");
      return;
    }
    if (!spendHealerKitUse()) return;
    if (canHeal(patient.needs)) {
      patient.hp = 1;
      addLog(`You use the healer's bundle to treat ${patient.name}, restoring 1 hit point.`);
    } else {
      addLog(`${patient.name} is treated with the healer's bundle but remains unconscious; they need food at 75% to recover hit points.`);
    }
  } else if (itemId === "crowbar") {
    const hazard = state.run.hazards.find((item) => !item.triggered && item.revealed &&
      distanceInSquares(item, state.run.player) <= 1);
    if (state.run.location !== "dungeon" || !hazard) {
      showToast("Move next to a revealed trap before prying at it.");
      return;
    }
    const rolls = [randomInt(20), randomInt(20)];
    const check = Math.max(...rolls) + currentCharacterStats().modifiers.str;
    if (check >= hazard.dc) {
      hazard.triggered = true;
      addLog(`You pry apart ${hazard.name} with the pry bar (Strength ${rolls.join("/")}, ${check} vs. DC ${hazard.dc}).`);
    } else {
      addLog(`The pry bar slips while you work on ${hazard.name} (Strength ${rolls.join("/")}, ${check} vs. DC ${hazard.dc}).`);
      triggerHazard(hazard.x, hazard.y);
    }
  } else if (itemId === "hempen-rope") {
    const hazard = state.run.hazards.find((item) => !item.triggered && item.revealed &&
      distanceInSquares(item, state.run.player) <= 10 && hasLineOfSight(state.run.player, item));
    if (state.run.location !== "dungeon" || !hazard) {
      showToast("No revealed trap is within the rope's reach and sight.");
      return;
    }
    hazard.triggered = true;
    addLog(`From a safe distance, you pull ${hazard.name}'s trigger with the maguey cord.`);
  } else {
    return;
  }
  if (state.run.location === "dungeon") finishPlayerTurn();
  else render();
}

function waitTurn() {
  if (state.messageBox || state.utilityDrawer || state.run.lost || state.run.won) return;
  state.dashReady = false;
  state.disengageReady = false;
  addLog("You wait and listen to the tomb.");
  finishPlayerTurn();
}

function checkDefeat() {
  if (state.run.hp > 0) return;
  if (state.run.lost) return;
  state.run.lost = true;
  showCombatFeedback("player-death", "Your light goes out", { actor: "player", x: state.run.player.x, y: state.run.player.y });
  addLog("You fall in the dark. Your expedition ends here.");
}

function checkLevelUp() {
  while (state.run.level < MAX_LEVEL && state.run.xp >= XP_THRESHOLDS[state.run.level + 1]) {
    const previousPlayerMaxHp = state.run.maxHp;
    const previousMaxSpellSlots = maxSpellSlots(state.run.character.class, state.run.level);
    const previousCompanionMaxHp = new Map(state.run.party.map((companion) => [companion.id, companion.maxHp]));
    state.run.level += 1;
    sfx("levelUp");
    const nextMaxSpellSlots = maxSpellSlots(state.run.character.class, state.run.level);
    state.run.spellSlots = Math.min(nextMaxSpellSlots, state.run.spellSlots + nextMaxSpellSlots - previousMaxSpellSlots);
    state.run.maxHp = state.run.character?.legacy
      ? previousPlayerMaxHp + 4
      : deriveCharacter(state.run.character, state.run.level).maxHp;
    const playerIncrease = state.run.maxHp - previousPlayerMaxHp;
    if (state.run.hp > 0 && canHeal()) state.run.hp = Math.min(state.run.maxHp, state.run.hp + playerIncrease);
    for (const companion of state.run.party) {
      const previousMaxHp = previousCompanionMaxHp.get(companion.id) || companion.maxHp;
      companion.maxHp = deriveCharacter(companion, state.run.level).maxHp;
      if (companion.hp > 0) companion.hp = Math.min(companion.maxHp, companion.hp + companion.maxHp - previousMaxHp);
    }
    addLog(`The party reaches level ${state.run.level}. Your maximum hit points increase by ${playerIncrease}; companions gain hit points too.`);
    if (characterAsiLevels().has(state.run.level) && !state.run.asiLevelsChosen.includes(state.run.level)) {
      openLevelUpChoice();
      return;
    }
  }
}

function characterAsiLevels() {
  const levels = new Set(ASI_LEVELS);
  const characterClass = state.run.character.class;
  if (characterClass === "fighter") {
    levels.add(6);
    levels.add(14);
  } else if (characterClass === "rogue") {
    levels.add(10);
  }
  return levels;
}

function openLevelUpChoice() {
  elements["level-up-heading"].textContent = `Level ${state.run.level} training`;
  elements["level-up-copy"].textContent = `${CLASSES[state.run.character.class].name} grows stronger at this level. Raise one ability by 2, or two different abilities by 1 each (up to 20).`;
  for (const [id, selected] of [["level-up-one", true], ["level-up-two", false]]) {
    const select = elements[id];
    const previous = select.value;
    select.replaceChildren(...ABILITIES.map(([key, name]) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = `${name} (${state.run.character.scores[key]})`;
      return option;
    }));
    if (ABILITIES.some(([key]) => key === previous)) select.value = previous;
    else if (selected) select.value = "str";
  }
  if (elements["level-up-mode-select"].value === "two" &&
    elements["level-up-two"].value === elements["level-up-one"].value) {
    elements["level-up-two"].value = "dex";
  }
  if (!elements["level-up-dialog"].open) elements["level-up-dialog"].showModal();
}

function applyLevelUpChoice() {
  const mode = elements["level-up-mode-select"].value;
  const first = elements["level-up-one"].value;
  const second = elements["level-up-two"].value;
  if (!["one", "two"].includes(mode) || !ABILITIES.some(([key]) => key === first) ||
    (mode === "two" && (first === second || !ABILITIES.some(([key]) => key === second)))) {
    showToast("Choose one ability, or two different abilities.");
    return;
  }
  const increases = mode === "one" ? [[first, 2]] : [[first, 1], [second, 1]];
  for (const [ability, amount] of increases) {
    state.run.character.scores[ability] = Math.min(20, state.run.character.scores[ability] + amount);
  }
  state.run.asiLevelsChosen.push(state.run.level);
  addLog(`Your level ${state.run.level} training is complete.`);
  elements["level-up-dialog"].close();
  checkLevelUp();
  render();
}

function describeRoomType(type) {
  return type === "boss" ? "FINAL ENCOUNTER" : type.toUpperCase();
}

function createSprite(name, className) {
  return createResourceSprite("enemies", `${name}.png`, className);
}

function createResourceSprite(folder, filename, className) {
  const image = document.createElement("img");
  image.className = className;
  image.alt = "";
  image.draggable = false;
  image.src = `./resources/${folder}/${filename}?v=${SPRITE_RESOURCE_VERSION}`;
  return image;
}

function townNpcAt(x, y) {
  return TOWN_NPCS.find((npc) => npc.x === x && npc.y === y);
}

function isTownWellAt(x, y) {
  return TOWN_WELL.x === x && TOWN_WELL.y === y;
}

function townCanOccupy(x, y, projectLevels = state.run?.progress?.town || {}) {
  const map = townMapAtLevel(projectLevels);
  return y >= 0 && y < map.length && x >= 0 && x < map[y].length &&
    [".", "D", "W", "r", "p", "B", "V"].includes(map[y][x]) && !townNpcAt(x, y);
}

function townDistance(first, second) {
  return Math.max(Math.abs(first.x - second.x), Math.abs(first.y - second.y));
}

function gearRewardTargets(character = state.run.character) {
  const upgrades = character.equipmentEnhancements || { weaponIds: [], armorIds: [] };
  const weaponId = character.equipment.weapon;
  const armorId = character.equipment.armor;
  return [
    ...(upgrades.weaponIds.includes(weaponId) ? [] : [{ slot: "weapon", id: weaponId }]),
    ...(armorId !== "none" && !upgrades.armorIds.includes(armorId) ? [{ slot: "armor", id: armorId }] : [])
  ];
}

function gearRewardCooldownRemaining() {
  const stored = localStorage.getItem(GEAR_REWARD_COOLDOWN_KEY);
  if (stored === null) return 0;
  const claimedAt = Number(stored);
  if (!Number.isSafeInteger(claimedAt) || claimedAt < 0) {
    throw new Error("The gear-reward cooldown stored on this device is invalid.");
  }
  return Math.max(0, claimedAt + GEAR_REWARD_COOLDOWN_MS - Date.now());
}

function gearRewardStatus() {
  const targets = gearRewardTargets();
  let cooldownRemaining = 0;
  let storageError = false;
  try {
    cooldownRemaining = gearRewardCooldownRemaining();
  } catch (error) {
    console.error("Could not read the gear-reward cooldown.", error);
    storageError = true;
  }
  return {
    targets,
    cooldownRemaining,
    storageError,
    adAvailable: Boolean(window.CryptsRewardedAds?.isAvailable())
  };
}

function townInteractionLabel() {
  return contextualInteraction()?.label || "Nothing nearby";
}

function drawWaterAtTownWell() {
  if (state.run.location !== "city" || townDistance(state.run.townPosition, TOWN_WELL) !== 0) {
    showToast("Stand on the Ceiba Well to draw water.");
    return;
  }
  const thirstyMembers = partyMembers().filter((member) => member.needs.water < 100);
  if (!thirstyMembers.length) {
    showToast("The party's water needs are already full.");
    return;
  }
  sfx("water");
  for (const member of thirstyMembers) {
    member.needs.water = 100;
    member.needs.waterZeroHours = 0;
  }
  addLog(`At the Ceiba Well, you draw clean water and restore hydration for ${thirstyMembers.length} traveler${thirstyMembers.length === 1 ? "" : "s"}.`);
  render();
  showToast("Clean water drawn. The party's hydration is full.");
}

function drawWaterAtDungeonWell(well) {
  if (!well || distanceInSquares(well, state.run.player) !== 0) {
    showToast("Stand on the tomb well to draw water.");
    return;
  }
  const thirstyMembers = partyMembers().filter((member) => member.needs.water < 100);
  if (!thirstyMembers.length) {
    showToast("The party's water needs are already full.");
    return;
  }
  for (const member of thirstyMembers) {
    member.needs.water = 100;
    member.needs.waterZeroHours = 0;
  }
  sfx("water");
  addLog(`At the tomb well, you draw clean water and restore hydration for ${thirstyMembers.length} traveler${thirstyMembers.length === 1 ? "" : "s"}.`);
  finishPlayerTurn();
  showToast("Clean water drawn. Hydration replenished.");
}

// One step along the shortest street path toward a target: beside it (reach 1, for people
// and the house) or onto it (reach 0, for the well or a street tile). Steps follow the same
// rules as the movement keys, diagonals included.
function townStepToward(target, reach = 1) {
  const start = state.run.townPosition;
  if (townDistance(start, target) <= reach) return null;
  const key = (x, y) => `${x},${y}`;
  const seen = new Set([key(start.x, start.y)]);
  const queue = [{ x: start.x, y: start.y, first: null }];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    for (const direction of MOVEMENT_DIRECTIONS) {
      const x = current.x + direction.x;
      const y = current.y + direction.y;
      if (seen.has(key(x, y)) || !townCanOccupy(x, y)) continue;
      // Don't route over the tomb gate unless that's where you're going.
      if (townMapAtCurrentLevel()[y]?.[x] === "D" && !(target.x === x && target.y === y)) continue;
      seen.add(key(x, y));
      const first = current.first || direction;
      if (townDistance({ x, y }, target) <= reach) return first;
      queue.push({ x, y, first });
    }
  }
  return null;
}

function moveTowardTownNpc(npc, reach = 1) {
  const step = townStepToward(npc, reach);
  if (step) moveTownPlayer(step.x, step.y);
  else if (townDistance(state.run.townPosition, npc) > reach) showToast("The buildings block the way. Move through the open streets to reach them.");
}

function moveTownPlayer(dx, dy) {
  if (state.run.location !== "city") return;
  const position = state.run.townPosition;
  const x = position.x + dx;
  const y = position.y + dy;
  const npc = townNpcAt(x, y);
  if (npc && townDistance(position, npc) === 1) {
    talkToTownNpc(npc.id);
    return;
  }
  if (townMapAtCurrentLevel()[y]?.[x] === "H") {
    openHouse();
    return;
  }
  if (!townCanOccupy(x, y)) {
    showToast("The buildings and town wall block that way.");
    return;
  }
  // Diagonal steps follow the same rules as straight ones: only the destination matters.
  state.run.townPosition = { x, y };
  if (townMapAtCurrentLevel()[y][x] === "D") {
    enterDungeon();
    return;
  }
  render();
}

// One thing a townsperson lets slip about the tomb on each visit: the newest remark you
// haven't heard yet, among those your deepest delve has earned; once heard, they rotate.
function townsfolkRemark(id) {
  const remarks = window.CryptsLore?.townsfolk?.[id];
  if (!remarks?.length || !state.run?.progress) return null;
  const record = progress();
  record.loreHeard ||= [];
  const open = remarks.filter((remark) => remark.minFloor <= (record.deepestFloor || 1));
  if (!open.length) return null;
  const fresh = open.filter((remark) => !record.loreHeard.includes(remark.id));
  const remark = fresh.length ? fresh[fresh.length - 1] : open[Math.floor(Math.random() * open.length)];
  if (!record.loreHeard.includes(remark.id)) record.loreHeard.push(remark.id);
  return t(remark.text);
}

function talkToTownNpc(id) {
  if (state.run.location !== "city") return;
  syncVillagerPositions();
  const npc = TOWN_NPCS.find((person) => person.id === id);
  if (!npc || townDistance(state.run.townPosition, npc) > 1) {
    showToast("Walk beside someone before starting a conversation.");
    return;
  }
  sfx("talk");
  if (npc.villager) {
    openVillager(id);
    return;
  }
  const conversations = {
    "gear-mender": {
      copy: "Mahuiz deals in things that shouldn't be here: Spanish steel from the sea giants' floating houses, samurai arms carried across the western sea, and extravagant regalia. He shows his finest pieces only to delvers who have gone deep. He also offers a once-hourly rewarded blessing for your equipped weapon and armor.",
      action: "Ad upgrade · Bless equipped gear",
      callback: claimTownGearReward
    },
    innkeeper: {
      copy: "Nali welcomes travelers to the Ceiba House. Rest here safely: the inn provides a hot meal and clean water, restores the party's food and water, and tends wounds when your needs allow.",
      action: "Rest at the inn",
      callback: () => {
        elements["town-dialog"].close();
        campAndRest();
      }
    },
    merchant: {
      copy: "Teyac tends a row of bright market stalls. There is food, clean water, trail gear, and a fair price for any treasure you bring back.",
      action: "Browse the market",
      callback: () => {
        elements["town-dialog"].close();
        visitStore();
      }
    },
    "temple-keeper": {
      copy: `${TOMB_HISTORY} Xochi watches the jungle path. “When you are ready, follow the road south. The broken seal is the way into the tomb. The Empire's ban remains, but the choice to descend is yours.” She keeps the bounty board: finished bounties are paid when you return, and new work is posted as old work is done.`,
      action: "Check the bounty board",
      callback: () => {
        elements["town-dialog"].close();
        claimReadyBounties();
        render();
        if (state.utilityDrawer !== "journal") toggleUtilityDrawer("journal");
      }
    },
    "master-builder": {
      copy: `Tlacotl unrolls a bark-paper plan of Chiltomatlan. “Tomb gold built nothing here yet. Fund a project and the whole town grows, and so does every delve you make.” Built so far: ${PROJECT_IDS.filter((projectId) => projectLevel(projectId)).map((projectId) => t(PROGRESSION.projects[projectId].name)).join(", ") || "nothing yet"}.`,
      action: "Plan town projects",
      callback: openProjectsDialog
    },
    "patolli-player": {
      copy: "Ixchel keeps a well-used Patolli board in the plaza. Six carved pieces wait for each player, and every piece carries its own agreed wager. No gold changes hands until a match is settled.",
      action: state.run.patolliGame?.status === "active" ? "Resume Patolli" : "Play Patolli",
      callback: () => {
        elements["town-dialog"].close();
        openPatolli();
      }
    }
  };
  const conversation = conversations[id];
  if (!conversation) throw new Error(`No conversation is defined for townsperson ${id}.`);
  const remark = townsfolkRemark(id);
  if (remark) {
    const quotes = { ja: ["「", "」"], fr: ["«\u00a0", "\u00a0»"], de: ["„", "“"] }[window.cryptsLocale?.language] || ["“", "”"];
    conversation.copy = `${quotes[0]}${remark}${quotes[1]} ${t(conversation.copy)}`;
  }
  const factionId = npc.faction;
  const faction = factionId ? FACTIONS[factionId] : null;
  const standing = factionId ? factionStanding(factionId) : 0;
  if (factionId && factionMember(factionId)) {
    const rankText = factionRank(factionId);
    conversation.copy += ` You are a ${rankText.toLowerCase()} of ${faction.name}. ${faction.perk}`;
    if (id === "merchant" && standing >= 15) {
      conversation.copy += ` Your current Circle rate is ${Math.round(traderDiscountRate() * 100)}% off purchases.`;
    }
    if (id === "temple-keeper" && standing >= 15) {
      conversation.copy += ` The wardens' fieldcraft adds +${wardenFieldcraftBonus()} to your Perception and Survival checks.`;
    }
  } else if (id === "temple-keeper" && !state.run.factions.milestones.includes("temple-treasure-returned") &&
    !state.run.factions.milestones.includes("greenstone-echo-silenced")) {
    conversation.copy += " Xochi will consider you for the Wardens after you return with proof that you reached the tomb.";
  }
  const [npcName, ...npcRole] = t(npc.name).split(", ");
  elements["town-dialog-heading"].textContent = npcName;
  elements["town-dialog-role"].textContent = npcRole.join(", ") || "Chiltomatlan · a conversation";
  elements["town-dialog-portrait"].src = `./resources/tokens/${id === "patolli-player" ? "patolli-board" : id}.png?v=${SPRITE_RESOURCE_VERSION}`;
  elements["town-dialog"].dataset.npc = id;
  renderPurses();
  let conversationCopy = conversation.copy;
  const rewardStatus = id === "gear-mender" ? gearRewardStatus() : null;
  if (rewardStatus) {
    const targets = rewardStatus.targets.map(({ slot, id: gearId }) => {
      const item = slot === "weapon" ? WEAPONS[gearId] : ARMORS[gearId];
      return `${item.name} (+1 ${slot === "weapon" ? "attack" : "AC"})`;
    });
    conversationCopy += targets.length
      ? ` Eligible now: ${targets.join(" and ")}.`
      : " Your currently equipped gear has already received its blessing.";
    if (rewardStatus.cooldownRemaining > 0) {
      const minutes = Math.ceil(rewardStatus.cooldownRemaining / 60000);
      conversationCopy += ` The next reward is available in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
    }
    if (!rewardStatus.adAvailable) {
      conversationCopy += " Rewarded ads are available only in the Android app.";
    }
    if (rewardStatus.storageError) {
      conversationCopy += " This device cannot verify the ad cooldown, so no reward can be claimed.";
    }
  }
  setDialogCopy("town-dialog-copy", conversationCopy);
  elements["town-dialog-action"].textContent = conversation.action;
  elements["town-dialog-action"].onclick = conversation.callback;
  const cosmeticShopButton = elements["town-dialog-shop"];
  cosmeticShopButton.classList.toggle("hidden", id !== "gear-mender");
  cosmeticShopButton.textContent = "Browse Mahuiz's wares";
  cosmeticShopButton.onclick = id === "gear-mender" ? () => openShop("mahuiz") : null;
  elements["town-dialog-action"].disabled = Boolean(rewardStatus &&
    (!rewardStatus.targets.length || rewardStatus.cooldownRemaining > 0 || !rewardStatus.adAvailable || rewardStatus.storageError));
  if (rewardStatus && !rewardStatus.adAvailable) {
    elements["town-dialog-action"].textContent = "Available in Android app";
  } else if (rewardStatus?.cooldownRemaining > 0) {
    const minutes = Math.ceil(rewardStatus.cooldownRemaining / 60000);
    elements["town-dialog-action"].textContent = `Ready in ${minutes} min`;
  } else if (rewardStatus && !rewardStatus.targets.length) {
    elements["town-dialog-action"].textContent = "Current gear already blessed";
  }
  const learnButton = elements["town-dialog-learn"];
  learnButton.classList.toggle("hidden", id !== "patolli-player");
  learnButton.textContent = "Learn the rules";
  learnButton.onclick = () => {
    elements["town-dialog"].close();
    openPatolli(true);
  };
  const joinButton = elements["town-dialog-join"];
  const alreadyMember = factionId && factionMember(factionId);
  const requirement = factionId ? factionJoinRequirement(factionId) : null;
  joinButton.classList.toggle("hidden", !factionId || alreadyMember);
  joinButton.disabled = Boolean(requirement);
  joinButton.textContent = requirement ? `Earn ${faction.name}'s trust` : faction ? `Join ${faction.name}` : "";
  joinButton.title = requirement || (faction ? `Join as a ${faction.ranks[0][1].toLowerCase()}.` : "");
  joinButton.onclick = () => {
    if (joinFaction(factionId)) elements["town-dialog"].close();
  };
  elements["town-dialog"].showModal();
}

function openCosmeticShop() {
  const trader = TOWN_NPCS.find((npc) => npc.id === "gear-mender");
  if (state.run.location !== "city" || townDistance(state.run.townPosition, trader) > 1) {
    showToast("Walk beside Mahuiz in Chiltomatlan to browse his curiosities.");
    return;
  }
  openShop("mahuiz", "regalia");
  return;
  elements["town-dialog"].close();
  elements["cosmetic-shop-message"].textContent = "";
  renderCosmeticShop();
  elements["cosmetic-shop-dialog"].showModal();
}

function renderCosmeticShop() {
  const character = state.run.character;
  if (!character.cosmetics) character.cosmetics = { owned: [], helmet: null, clothes: null };
  const cosmetics = character.cosmetics;
  elements["cosmetic-shop-gold"].textContent = `Available gold: ${formatCurrency(state.run.gold)}`;
  const entries = Object.entries(COSMETICS);
  const fragment = document.createDocumentFragment();
  for (const [id, item] of entries) {
    const owned = cosmetics.owned.includes(id);
    const equipped = cosmetics[item.slot] === id;
    const card = document.createElement("article");
    card.className = `cosmetic-shop-item cosmetic-set-${item.set}`;
    const copy = document.createElement("div");
    copy.className = "cosmetic-shop-item-copy";
    const heading = document.createElement("strong");
    heading.textContent = item.name;
    const description = document.createElement("small");
    description.textContent = `${item.slot === "helmet" ? "Helmet" : "Clothing"} · ${item.description}`;
    copy.append(heading, description);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `button${owned && !equipped ? " secondary" : ""}`;
    button.dataset.cosmeticId = id;
    button.textContent = equipped ? "Equipped" : owned ? "Equip" : `Buy · ${formatCurrency(item.price)}`;
    button.disabled = equipped || (!owned && state.run.gold < item.price);
    card.append(copy, button);
    fragment.append(card);
  }
  elements["cosmetic-shop-items"].replaceChildren(fragment);
}

function updateCosmeticSlot(slot, cosmeticId) {
  const character = state.run.character;
  const previousCosmetics = { ...character.cosmetics, owned: [...character.cosmetics.owned] };
  character.cosmetics[slot] = cosmeticId;
  if (!saveRun()) {
    character.cosmetics = previousCosmetics;
    return false;
  }
  render();
  renderCosmeticShop();
  return true;
}

function purchaseOrEquipCosmetic(cosmeticId) {
  const trader = TOWN_NPCS.find((npc) => npc.id === "gear-mender");
  if (state.run.location !== "city" || townDistance(state.run.townPosition, trader) > 1) {
    showToast("Walk beside Mahuiz in Chiltomatlan to trade.");
    elements["cosmetic-shop-dialog"].close();
    return;
  }
  const item = COSMETICS[cosmeticId];
  if (!item) throw new Error(`Unknown cosmetic ${cosmeticId}.`);
  const character = state.run.character;
  if (!character.cosmetics) character.cosmetics = { owned: [], helmet: null, clothes: null };
  const owned = character.cosmetics.owned.includes(cosmeticId);
  if (!owned && state.run.gold < item.price) {
    elements["cosmetic-shop-message"].textContent = `You need ${formatCurrency(item.price)} for ${item.name}.`;
    return;
  }
  const previousGold = state.run.gold;
  const previousCosmetics = { ...character.cosmetics, owned: [...character.cosmetics.owned] };
  if (!owned) {
    state.run.gold -= item.price;
    character.cosmetics.owned.push(cosmeticId);
  }
  character.cosmetics[item.slot] = cosmeticId;
  if (!saveRun()) {
    state.run.gold = previousGold;
    character.cosmetics = previousCosmetics;
    return;
  }
  elements["cosmetic-shop-message"].textContent = owned
    ? `${item.name} equipped.`
    : `Bought and equipped ${item.name}.`;
  if (!owned) addLog(`You buy ${item.name} from Mahuiz for ${formatCurrency(item.price)}.`);
  render();
  renderCosmeticShop();
}

async function claimTownGearReward() {
  if (state.run.location !== "city" || townDistance(state.run.townPosition, TOWN_NPCS.find((npc) => npc.id === "gear-mender")) > 1) {
    showToast("Walk beside Mahuiz in Chiltomatlan before claiming a gear blessing.");
    return;
  }
  const status = gearRewardStatus();
  if (status.storageError) {
    showToast("The ad cooldown could not be checked. No gear blessing was applied.");
    return;
  }
  if (!status.adAvailable) {
    showToast("Rewarded ads are available in the Android app, not in this browser version.");
    return;
  }
  if (status.cooldownRemaining > 0) {
    showToast(`The next gear blessing is available in ${Math.ceil(status.cooldownRemaining / 60000)} minutes.`);
    return;
  }
  if (!status.targets.length) {
    showToast("Your currently equipped weapon and armor have already been blessed.");
    return;
  }
  const equipped = { weapon: state.run.character.equipment.weapon, armor: state.run.character.equipment.armor };
  const button = elements["town-dialog-action"];
  button.disabled = true;
  button.textContent = "Loading rewarded ad…";
  let rewardEarned = false;
  try {
    rewardEarned = await window.CryptsRewardedAds.showRewardedAd();
  } catch (error) {
    console.error("The rewarded gear ad could not be shown.", error);
    showToast(`The rewarded ad could not be shown: ${escapeMessage(error)}`);
  }
  if (!rewardEarned) {
    showToast("The ad was closed before its reward was earned; no gear upgrade was applied.");
    if (elements["town-dialog"].open) {
      button.disabled = false;
      button.textContent = "Watch ad · Bless equipped gear";
    }
    return;
  }
  if (state.run.location !== "city" ||
    state.run.character.equipment.weapon !== equipped.weapon ||
    state.run.character.equipment.armor !== equipped.armor) {
    showToast("Your equipped gear changed before the ad finished; no blessing was applied.");
    return;
  }
  let lastClaim;
  try {
    lastClaim = localStorage.getItem(GEAR_REWARD_COOLDOWN_KEY);
    const latestStatus = gearRewardStatus();
    if (latestStatus.storageError || latestStatus.cooldownRemaining > 0) {
      throw new Error("The gear-reward cooldown changed while the ad was playing.");
    }
    localStorage.setItem(GEAR_REWARD_COOLDOWN_KEY, String(Date.now()));
  } catch (error) {
    console.error("Could not persist the rewarded-ad cooldown.", error);
    showToast(`The gear blessing could not be saved: ${escapeMessage(error)}`);
    return;
  }
  const character = state.run.character;
  const previousEnhancements = {
    weaponIds: [...character.equipmentEnhancements.weaponIds],
    armorIds: [...character.equipmentEnhancements.armorIds]
  };
  for (const target of status.targets) {
    const key = target.slot === "weapon" ? "weaponIds" : "armorIds";
    if (!character.equipmentEnhancements[key].includes(target.id)) {
      character.equipmentEnhancements[key].push(target.id);
    }
  }
  if (!saveRun()) {
    character.equipmentEnhancements = previousEnhancements;
    try {
      if (lastClaim === null) localStorage.removeItem(GEAR_REWARD_COOLDOWN_KEY);
      else localStorage.setItem(GEAR_REWARD_COOLDOWN_KEY, lastClaim);
    } catch (error) {
      console.error("Could not roll back the gear-reward cooldown after a save failure.", error);
    }
    return;
  }
  const blessed = status.targets.map(({ slot, id }) =>
    `${slot === "weapon" ? WEAPONS[id].name : ARMORS[id].name} (+1 ${slot === "weapon" ? "attack" : "AC"})`);
  elements["town-dialog"].close();
  render();
  showToast(`Mahuiz blesses ${blessed.join(" and ")}. The upgrade is permanent.`);
}

function nearbyDungeonDoors() {
  return state.run.terrain
    .map((type, index) => type === "door"
      ? { x: index % MAP_TILE_SIZE, y: Math.floor(index / MAP_TILE_SIZE), index }
      : null)
    .filter((door) => door && distanceInSquares(door, state.run.player) === 1);
}

function interactWithDoor(door) {
  const isOpen = state.run.openDoors.includes(door.index);
  if (isOpen) {
    const occupied = state.run.player.x === door.x && state.run.player.y === door.y ||
      state.run.enemies.some((enemy) => enemy.alive && enemy.x === door.x && enemy.y === door.y) ||
      state.run.party.some((companion) => companion.x === door.x && companion.y === door.y) ||
      state.run.treasures.some((treasure) => treasure.x === door.x && treasure.y === door.y) ||
      state.run.hazards.some((hazard) => !hazard.triggered && hazard.x === door.x && hazard.y === door.y);
    if (occupied) {
      showToast("Someone or something is in the doorway. It cannot be closed yet.");
      return;
    }
    state.run.openDoors = state.run.openDoors.filter((index) => index !== door.index);
    addLog("You close the doorway.");
    sfx("doorClose");
    finishPlayerTurn();
    return;
  }
  openDungeonDoor(door);
  finishPlayerTurn();
}

function openDungeonDoor(door) {
  const sign = dungeonSignAt(door.x, door.y);
  if (sign?.type === "locked") {
    const crowbarBonus = inventoryQuantity("crowbar") > 0 ? 2 : 0;
    const check = rollD20();
    const total = check.die + abilityModifier(state.run.character.scores.str) + crowbarBonus;
    if (check.die === 1 || (check.die !== 20 && total < 15)) {
      addLog(`You fail to force the locked doorway (${total} vs. DC 15).`);
      return false;
    }
    addLog(`You force open the locked doorway (${total} vs. DC 15).${crowbarBonus ? " Your crowbar helps." : ""}`);
  } else {
    addLog("You open the doorway.");
  }
  state.run.openDoors.push(door.index);
  sfx("door");
  return true;
}

function contextualInteraction() {
  if (!state.run || state.messageBox || state.utilityDrawer || state.run.lost || state.run.won) return null;
  if (state.run.location === "city") {
    const position = state.run.townPosition;
    if (isTownWellAt(position.x, position.y)) {
      return { label: "Draw water · Ceiba Well", action: drawWaterAtTownWell };
    }
    syncVillagerPositions();
    const npcs = TOWN_NPCS.filter((person) => townDistance(position, person) <= 1);
    if (npcs.length) {
      const label = npcs.length > 1
        ? `Talk · choose (${npcs.length})`
        : `Talk · ${npcs[0].name.split(",")[0]}`;
      return {
        label,
        action: () => chooseFromOptions("Choose someone to speak with", npcs.map((npc) => ({
          label: npc.name,
          action: () => talkToTownNpc(npc.id)
        })))
      };
    }
    if (townMapAtCurrentLevel()[position.y]?.[position.x] === "D") {
      return { label: "Enter the tomb", action: enterDungeon };
    }
    if (besideHouse(position)) {
      return { label: houseState().owned ? "Go home" : "House for sale", action: openHouse };
    }
    return { label: "Townsfolk · who's where", action: openVillagers };
  }
  if (state.run.location !== "dungeon") return null;
  const enemies = attackTargets();
  if (enemies.length) {
    const label = enemies.length > 1
      ? `Attack · choose target (${enemies.length})`
      : `Attack · ${enemies[0].name}${distanceInSquares(enemies[0], state.run.player) === 1 &&
        flankingCompanion(enemies[0]) ? " · Advantage" : ""}`;
    return {
      label,
      action: attack
    };
  }
  const stair = dungeonSignAt(state.run.player.x, state.run.player.y);
  if (stair && ["stairs-up", "stairs-down", "exit", "lift"].includes(stair.type)) {
    const label = stair.type === "lift" ? "Ride the lift to Chiltomatlan" : stair.role === "entrance" ? "Return to Chiltomatlan"
      : stair.type === "stairs-down" ? `Descend · floor ${stair.targetFloor}`
        : stair.type === "stairs-up" ? `Ascend · floor ${stair.targetFloor}` : "Leave the conquered tomb";
    return { label, action: () => traverseDungeonStair(stair) };
  }
  if (isAtDungeonEntrance()) {
    return { label: "Return to Chiltomatlan", action: returnToChiltomatlan };
  }
  const hazards = state.run.hazards.filter((entry) => !entry.triggered && entry.revealed &&
    distanceInSquares(entry, state.run.player) <= 1);
  if (hazards.length) {
    return {
      label: "Disarm revealed trap",
      action: () => chooseFromOptions("Choose a trap to disarm", hazards.map((hazard) => ({
        label: hazard.name,
        action: () => disarmNearbyHazard(hazard)
      })))
    };
  }
  const well = state.run.wells?.find((entry) => distanceInSquares(entry, state.run.player) === 0);
  if (well) {
    return { label: "Draw water · tomb well", action: () => drawWaterAtDungeonWell(well) };
  }
  const treasures = state.run.treasures.filter((item) => distanceInSquares(item, state.run.player) <= 1);
  const treasureTiles = [...new Map(treasures.map((treasure) => [tileIndex(treasure.x, treasure.y), treasure])).values()];
  if (treasureTiles.length) {
    return {
      label: "Collect nearby treasure",
      action: () => chooseFromOptions("Choose treasure to collect", treasureTiles.map((treasure) => ({
        label: `${treasure.items.map((item) => itemDetails(item.id).name).join(", ") || "Supplies"}${treasure.gold ? ` · ${formatCurrency(treasure.gold)}` : ""}`,
        action: () => {
          collectTreasureAt(treasure.x, treasure.y);
          finishPlayerTurn();
        }
      })))
    };
  }
  const entrance = state.run.rooms.find((room) => room.type === "entrance");
  const doorways = nearbyDungeonDoors();
  const exit = state.run.rooms.find((room) => room.type === "exit");
  const targetRoom = exit || entrance;
  const targetPosition = targetRoom && {
    x: targetRoom.anchorX ?? targetRoom.mapX + Math.floor(targetRoom.mapW / 2),
    y: targetRoom.anchorY ?? targetRoom.mapY + Math.floor(targetRoom.mapH / 2)
  };
  if (doorways.length) {
    return {
      label: doorways.length > 1 ? `Doorway · choose (${doorways.length})`
        : state.run.openDoors.includes(doorways[0].index) ? "Close nearby doorway"
          : dungeonSignAt(doorways[0].x, doorways[0].y)?.type === "locked"
            ? "Force open locked doorway" : "Open nearby doorway",
      action: () => chooseFromOptions("Choose a doorway", doorways.map((door) => ({
        label: `${state.run.openDoors.includes(door.index) ? "Close" : "Open"} doorway · ${door.x + 1}, ${door.y + 1}`,
        action: () => interactWithDoor(door)
      })))
    };
  }
  if (targetPosition && distanceInSquares(targetPosition, state.run.player) === 1) {
    return {
      label: targetRoom.type === "exit" ? "Approach the exit" : "Return to entrance",
      action: () => showToast("Move onto the stair or exit tile to use it.")
    };
  }
  return null;
}

function interact() {
  const interaction = contextualInteraction();
  if (interaction) {
    interaction.action();
    return;
  }
  showToast(state.run?.location === "city"
    ? "Nothing nearby to interact with. Stand on the well to draw water."
    : "Nothing nearby to interact with. Move to a creature, treasure, revealed trap, or doorway.");
}

function townBuildingBounds(code) {
  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  townMapAtCurrentLevel().forEach((row, y) => row.forEach((cell, x) => {
    if (cell !== code) return;
    box.minX = Math.min(box.minX, x);
    box.minY = Math.min(box.minY, y);
    box.maxX = Math.max(box.maxX, x);
    box.maxY = Math.max(box.maxY, y);
  }));
  return box;
}

function townViewShape() {
  const viewport = document.getElementById("town-map-viewport");
  const across = Math.max(3, (window.matchMedia("(max-width: 540px)").matches ? MOBILE_MAP_VIEW_SIZE : DESKTOP_MAP_VIEW_SIZE) - 2 * mapZoom);
  const width = viewport?.clientWidth || 0;
  const height = viewport?.clientHeight || 0;
  if (width < 60 || height < 60) return { cols: across, rows: across, tile: 0 };
  const tile = Math.floor((Math.min(width, height) - 4) / across);
  const odd = (count) => {
    const whole = Math.max(3, Math.min(19, Math.floor(count)));
    return whole % 2 ? whole : whole - 1;
  };
  return { cols: odd(width / tile), rows: odd(height / tile), tile };
}

function resizeTownMap() {
  const map = elements["town-map"];
  if (!map) return { cols: 0, rows: 0, tile: 0 };
  const shape = townViewShape();
  map.style.setProperty("--town-columns", shape.cols);
  map.style.setProperty("--town-rows", shape.rows);
  if (shape.tile) {
    map.style.width = `${shape.cols * shape.tile}px`;
    map.style.height = `${shape.rows * shape.tile}px`;
  } else {
    map.style.removeProperty("width");
    map.style.removeProperty("height");
  }
  return shape;
}

function renderTownMap() {
  syncVillagerPositions();
  const fragment = document.createDocumentFragment();
  const townMap = townMapAtCurrentLevel();
  const player = state.run.townPosition;
  const { cols, rows } = resizeTownMap();
  const centeredOrigin = (position, viewSize, mapSize) => mapSize > viewSize
    ? Math.max(0, Math.min(position - Math.floor(viewSize / 2), mapSize - viewSize))
    : Math.floor((mapSize - viewSize) / 2);
  const originX = centeredOrigin(player.x, cols, TOWN_LAYOUT.columns);
  const originY = centeredOrigin(player.y, rows, TOWN_LAYOUT.rows);
  const nearNpc = TOWN_NPCS.find((npc) => townDistance(player, npc) <= 1);
  const onWell = townDistance(player, TOWN_WELL) === 0;
  const onTrail = townMap[player.y]?.[player.x] === "D";
  const interactionLabel = townInteractionLabel();
  elements["town-interact-label"].textContent = interactionLabel;
  elements["town-interact-button"].disabled = interactionLabel === "Nothing nearby";
  elements["town-location-copy"].textContent = nearNpc && onWell
    ? `${nearNpc.name} is nearby. Tap their marker to speak, or use the Ceiba Well beneath you.`
    : nearNpc
      ? `${nearNpc.name} is nearby. Tap their marker or use the action button to speak.`
    : onWell
      ? "You are standing on the Ceiba Well. Use the action button to draw clean water for the party."
      : townDistance(player, TOWN_WELL) === 1
        ? "The Ceiba Well is nearby. Step onto its tile to draw clean water."
    : onTrail
      ? "The broken imperial seal opens onto the tomb's outer halls. Step through to begin your expedition."
      : "You stand in Chiltomatlan's ceremonial plaza. The stepped temple is north, the market quarter east, homes and gardens west, and the processional road leads south to the tomb gate.";
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < cols; column += 1) {
      const x = originX + column;
      const y = originY + row;
      const code = townMap[y]?.[x] || ".";
      const npc = townNpcAt(x, y);
      const tile = document.createElement("button");
      const building = TOWN_BUILDINGS.find((entry) => entry.code === code);
      tile.type = "button";
      tile.className = `town-tile ${code === "#" ? "town-wall" : code === "I" ? "town-inn" : code === "M" ? "town-market" : code === "H" ? "town-house" : code === "D" ? "town-gate" : code === "W" ? "town-well" : code === "~" ? "town-canal" : code === "B" ? "town-bridge" : code === "V" ? "town-bridge-vertical" : code === "r" ? "town-route" : code === "p" ? "town-plaza" : building ? `town-building town-${building.id}` : "town-street"}`;
      tile.dataset.x = String(x);
      tile.dataset.y = String(y);
      if (code === "H") {
        const house = houseState();
        tile.style.backgroundImage = `url("${houseArtUrl(house.owned ? house.style : "calli")}"), url("./resources/tiles/town-street.png?v=90")`;
        tile.classList.toggle("is-for-sale", !house.owned);
        const box = townBuildingBounds("H");
        if (!house.owned && x === box.maxX && y === box.minY) {
          const sign = document.createElement("span");
          sign.className = "town-house-sign";
          sign.textContent = formatCurrency(HOUSE_PRICE);
          tile.append(sign);
        }
      }
      if (building?.tilePrefix) {
        const tileX = x - building.x;
        const tileY = y - building.y;
        tile.style.backgroundImage = `url("./resources/tiles/${building.tilePrefix}-${tileX}-${tileY}.png"), url("./resources/tiles/town-street.png?v=90")`;
      }
      if (!building?.tilePrefix && (code === "I" || code === "M" || code === "H")) {
        const box = townBuildingBounds(code);
        const width = box.maxX - box.minX + 1;
        const height = box.maxY - box.minY + 1;
        const imagePosition = `${width > 1 ? ((x - box.minX) / (width - 1)) * 100 : 50}% ${height > 1 ? ((y - box.minY) / (height - 1)) * 100 : 50}%`;
        if (code === "M") {
          tile.style.backgroundSize = `${width * 100}% ${height * 100}%`;
          tile.style.backgroundPosition = imagePosition;
        } else {
          tile.style.backgroundSize = `${width * 100}% ${height * 100}%, 100% 100%`;
          tile.style.backgroundPosition = `${imagePosition}, center`;
        }
      }
      const isPlayer = player.x === x && player.y === y;
      const label = npc ? `${npc.name}, speak with them` : code === "W" ? "Ceiba Well, draw clean water for the party" : code === "D" ? "Broken imperial seal, enter the tomb" :
        code === "H" ? (houseState().owned ? "Your house" : "An empty house for sale") : building ? building.name : code === "~" ? "Irrigation canal" :
        code === "B" || code === "V" ? "Canal footbridge" : code === "r" ? "Processional and market causeway" : code === "p" ? "Ceremonial plaza" :
        code === "#" ? "Town boundary" : "Town street";
      tile.setAttribute("aria-label", isPlayer ? `${state.run.character.name}, you are here` : label);
      tile.title = label;
      if (isPlayer) {
        tile.classList.add("town-player");
        tile.append(createCodexCharacterSprite(state.run.character, "town-player-sprite"));
      } else if (npc) {
        tile.classList.add("town-person");
        if (npc.villager) {
          tile.classList.add("town-villager");
          tile.append(villagerSprite(npc.id, "town-person-marker town-villager-sprite"));
        } else if (npc.id === "patolli-player") {
          tile.classList.add("town-patolli-board-tile");
          tile.append(createResourceSprite("tokens", "patolli-board.png", "town-person-marker town-patolli-board"));
        } else {
          tile.append(createResourceSprite("tokens", `${npc.id}.png`, "town-person-marker"));
        }
      } else if (code === "W") {
        tile.append(createResourceSprite("tokens", "dungeon-well.png", "town-well-marker"));
      }
      fragment.append(tile);
    }
  }
  elements["town-map"].replaceChildren(fragment);
}

function renderMap() {
  if (state.run.location === "city") {
    renderTownMap();
    return;
  }
  if (state.run.location !== "dungeon") return;
  if (!Array.isArray(state.run.wells)) state.run.wells = [];
  if (!state.run.wellsInitialized) {
    state.run.wells = createDungeonWells();
    state.run.wellsInitialized = true;
  }
  refreshCompanionFormation();
  const { cols: viewCols, rows: viewRows, tile: tilePixels } = dungeonViewShape();
  const { x: playerX, y: playerY } = state.run.player;
  const originX = playerX - Math.floor(viewCols / 2);
  const originY = playerY - Math.floor(viewRows / 2);
  const mapStyle = elements["dungeon-map"].style;
  mapStyle.setProperty("--view-cols", viewCols);
  mapStyle.setProperty("--view-rows", viewRows);
  if (tilePixels) {
    mapStyle.setProperty("--map-width", `${viewCols * tilePixels}px`);
    mapStyle.setProperty("--map-height", `${viewRows * tilePixels}px`);
  } else {
    mapStyle.removeProperty("--map-width");
    mapStyle.removeProperty("--map-height");
  }
  elements["dungeon-map"].dataset.zoom = String(mapZoom);
  const fragment = document.createDocumentFragment();
  const enemiesAt = new Map(state.run.enemies.filter((enemy) => enemy.alive).map((enemy) => [tileIndex(enemy.x, enemy.y), enemy]));
  const companionsAt = new Map(state.run.party.map((companion) => [tileIndex(companion.x, companion.y), companion]));
  const treasuresAt = new Map();
  for (const treasure of state.run.treasures) {
    const index = tileIndex(treasure.x, treasure.y);
    if (!treasuresAt.has(index)) treasuresAt.set(index, []);
    treasuresAt.get(index).push(treasure);
  }
  const wellsAt = new Map(state.run.wells.map((well) => [tileIndex(well.x, well.y), well]));
  const enemiesInSight = new Set(state.run.enemies.filter((enemy) =>
    enemy.alive &&
    distanceInSquares(enemy, state.run.player) <= 7 &&
    hasLineOfSight(state.run.player, enemy)
  ).map((enemy) => tileIndex(enemy.x, enemy.y)));
  const hazardsAt = new Map(state.run.hazards.filter((hazard) => !hazard.triggered && hazard.revealed)
    .map((hazard) => [tileIndex(hazard.x, hazard.y), hazard]));
  for (let y = originY; y < originY + viewRows; y += 1) {
    for (let x = originX; x < originX + viewCols; x += 1) {
      const tile = document.createElement("div");
      const inBounds = x >= 0 && x < MAP_TILE_SIZE && y >= 0 && y < MAP_TILE_SIZE;
      const index = inBounds ? tileIndex(x, y) : -1;
      const type = inBounds ? state.run.terrain[index] : "unseen";
      const effect = state.combatEffects.find((entry) =>
        entry.kind !== "strike" && entry.x === x && entry.y === y && entry.until > Date.now());
      const strike = state.combatEffects.find((entry) =>
        entry.kind === "strike" && entry.x === x && entry.y === y && entry.until > Date.now());
      const seen = inBounds && (state.run.seen[index] || Boolean(effect) || enemiesInSight.has(index));
      const visibleWall = state.run.mapId === GTFL_MAP_ID && type === "wall";
      const terrainVisible = seen || visibleWall;
      let tileLabel = !terrainVisible ? "Unexplored" : ({
        stone: "Stone wall",
        wall: "Stone wall",
        floor: "Stone floor",
        corridor: "Stone corridor",
        door: "Doorway"
      }[type] || "Stone ground");
      tile.className = `map-tile ${terrainVisible ? type : "unseen"}${!inBounds ? " map-edge" : ""}`;
      if (terrainVisible && type === "door") {
        tile.classList.add(state.run.openDoors.includes(index) ? "door-open" : "door-closed");
      }
      if (state.lookTarget?.x === x && state.lookTarget?.y === y) tile.classList.add("look-selected");
      if (terrainVisible && type === "wall") {
        tile.classList.add(`wall-variant-${Math.abs((x * 31 + y * 17) % 4)}`);
        if (DIRECTIONS.some((direction) => {
          const nx = x + direction.x;
          const ny = y + direction.y;
          return nx >= 0 && nx < MAP_TILE_SIZE && ny >= 0 && ny < MAP_TILE_SIZE &&
            ["floor", "corridor", "door"].includes(state.run.terrain[tileIndex(nx, ny)]);
        })) tile.classList.add("wall-edge");
      }
      const layers = [];
      const addLayer = (name, sprite, effectClass = "", id = "", stackIndex = 0) => {
        if (effectClass) tile.classList.add(`occupied-${effectClass}`);
        layers.push({ name, sprite, effectClass, id, stackIndex });
      };
      if (seen) {
        if (playerX === x && playerY === y) {
          const sprite = createCodexCharacterSprite(state.run.character, "tile-sprite", state.run.player.facing || "south");
          if (effect?.actor === "player") sprite.classList.add(effect.kind === "player-death" ? "death-flash"
            : effect.kind === "heal" ? "heal-flash" : "hurt-flash");
          addLayer(`${state.run.character.name}, your adventurer`, sprite, "player");
        }
        if (companionsAt.has(index)) {
          const companion = companionsAt.get(index);
          const sprite = createCodexCharacterSprite(companion, "tile-sprite", companion.facing || state.run.player.facing || "south");
          if (companion.hp <= 0) sprite.classList.add("companion-down");
          if (effect?.companionId === companion.id) sprite.classList.add(effect.kind === "heal" ? "heal-flash" : "hurt-flash");
          addLayer(`${companion.name}, your companion${companion.hp <= 0 ? " (unconscious)" : ""}`, sprite, "companion", companion.id);
        }
        if (campAt(x, y)) {
          tile.classList.add("has-camp");
          addLayer("Your camp", createResourceSprite("tokens", "campfire.png", "tile-sprite"), "camp");
        }
        if (wellsAt.has(index)) {
          tileLabel += " · Dungeon well";
          tile.classList.add("has-well");
          addLayer("Water source", createResourceSprite("tokens", "dungeon-well.png", "tile-sprite"), "well");
        }
        if (treasuresAt.has(index)) {
          const treasures = treasuresAt.get(index);
          treasures.forEach((treasure, treasureIndex) => {
          const itemNames = treasure.items.map((item) => `${itemDetails(item.id).name} ×${item.quantity}`).join(", ");
          const lootSprites = [];
          if (treasure.gold) lootSprites.push(createResourceSprite("items", "coin-pile.png", "tile-sprite"));
          for (const loot of treasure.items) lootSprites.push(itemArtImage(loot.id, "tile-sprite"));
          if (!lootSprites.length) lootSprites.push(createResourceSprite("items", "treasure.png", "tile-sprite"));
          let lootSprite = lootSprites[0];
          if (lootSprites.length > 1) {
            lootSprite = document.createElement("span");
            lootSprite.className = "loot-sprite-stack";
            lootSprite.append(...lootSprites);
          }
          addLayer(`Treasure: ${formatCurrency(treasure.gold)}${itemNames ? ` · ${itemNames}` : ""}`, lootSprite, "treasure", treasure.id, treasureIndex);
          });
        }
        if (enemiesAt.has(index)) {
          const enemy = enemiesAt.get(index);
          const enemySprite = createSprite(enemySpriteId(enemy), "tile-sprite");
          if (effect?.enemyId === enemy.id) enemySprite.classList.add(effect.kind === "heal" ? "heal-flash" : "hurt-flash");
          if (enemy.elite || enemy.guardian) {
            tile.classList.add(enemy.guardian ? "has-guardian" : "has-elite");
          }
          addLayer(`${enemy.guardian ? "Guardian" : enemy.elite ? "Elite creature" : "Creature"}: ${enemy.name}`, enemySprite, "creature", enemy.id);
        }
        if (effect?.kind === "death" && effect.actor === "enemy" && !enemiesAt.has(index)) {
          const enemy = state.run.enemies.find((candidate) => candidate.id === effect.enemyId);
          const fallenSprite = createSprite(enemySpriteId(enemy), "tile-sprite");
          fallenSprite.classList.add("death-flash");
          addLayer(`${enemy?.name || "Creature"} defeated`, fallenSprite, "defeated", enemy?.id || "");
        }
        if (hazardsAt.has(index)) {
          const hazard = hazardsAt.get(index);
          tileLabel += ` · ${hazard.revealed ? `Trap: ${hazard.name}` : "Unsearched hazard"}`;
          tile.classList.add("has-hazard", hazard.revealed ? "hazard-revealed" : "hazard-unsearched");
          const mark = document.createElement("span");
          mark.className = `hazard-glyph${hazard.revealed ? " revealed" : ""}`;
          mark.append(createResourceSprite("tokens", hazard.revealed ? "hazard-found.png" : "hazard-mark.png", "map-marker-sprite"));
          tile.append(mark);
        }
        if (type === "door") {
          const open = state.run.openDoors.includes(index);
          tileLabel += ` · ${open ? "Open" : "Closed"} door`;
        }
        const entrance = state.run.rooms.find((room) => room.type === "entrance" &&
          (room.anchorX ?? room.mapX + Math.floor(room.mapW / 2)) === x &&
          (room.anchorY ?? room.mapY + Math.floor(room.mapH / 2)) === y);
        if (entrance) {
          tileLabel += " · Tomb entrance: return to Chiltomatlan from here";
          tile.classList.add("map-entrance");
          const mark = document.createElement("span");
          mark.className = "entrance-glyph";
          mark.append(createResourceSprite("tokens", "dungeon-entrance.png", "map-marker-sprite"));
          tile.append(mark);
        }
      }
      if (layers.length) {
        const contents = document.createElement("span");
        contents.className = `tile-contents${layers.length > 1 ? " crowded" : ""}`;
        for (const layer of layers) {
          const item = document.createElement("span");
          item.className = `tile-entity tile-entity-${layer.effectClass}`;
          item.style.setProperty("--stack-index", String(layer.stackIndex));
          const isStriking = strike && (
            (strike.actor === "player" && layer.effectClass === "player") ||
            (strike.actor === "companion" && layer.effectClass === "companion" && strike.companionId === layer.id) ||
            (strike.actor === "enemy" && layer.effectClass === "creature" && strike.enemyId === layer.id)
          );
          if (isStriking) {
            item.classList.add("strike-lunge", `strike-${strike.actor}`);
            item.style.setProperty("--strike-x", `${Math.sign(strike.targetX - strike.x) * 36}%`);
            item.style.setProperty("--strike-y", `${Math.sign(strike.targetY - strike.y) * 36}%`);
          }
          item.append(layer.sprite);
          const hitLayer = ["hit", "heal"].includes(effect?.kind) && (
            (effect.actor === "player" && layer.effectClass === "player") ||
            (effect.actor === "companion" && layer.effectClass === "companion" && effect.companionId === layer.id) ||
            (effect.actor === "enemy" && layer.effectClass === "creature" && effect.enemyId === layer.id)
          );
          if (hitLayer && effect.message) {
            const impact = document.createElement("span");
            impact.className = `impact-number ${effect.kind === "heal" ? "impact-heal" : effect.actor === "player" ? "impact-player" : "impact-enemy"}`;
            impact.textContent = effect.message.replace(/\s*HP\b/i, "");
            item.append(impact);
          }
          contents.append(item);
        }
        tile.append(contents);
        tile.classList.add("occupied");
        tileLabel += ` · ${layers.map((layer) => layer.name).join(" · ")}`;
      }
      const sign = seen && dungeonSignAt(x, y);
      if (sign && !["door", "archway", "portcullis", "locked", "trapped"].includes(sign.type)) {
        tile.classList.add("map-sign-tile", `sign-${sign.type}`);
        tileLabel += ` · ${sign.name}`;
        const mark = document.createElement("span");
        mark.className = "map-sign-glyph";
        const markerFile = sign.type === "exit" || sign.type === "lift" || sign.type.startsWith("stairs") ? "stairs-mark.png"
          : sign.type === "portcullis" ? "portcullis-mark.png"
          : sign.type === "secret" ? "secret-mark.png"
            : sign.type === "trapped" || sign.type === "locked" ? "hazard-mark.png"
              : sign.type === "door" ? "door-mark.png" : "archway-mark.png";
        mark.append(createResourceSprite("tokens", markerFile, "map-marker-sprite"));
        tile.append(mark);
      }
      tile.title = tileLabel;
      tile.setAttribute("role", "img");
      tile.setAttribute("aria-label", tileLabel);
      tile.dataset.x = String(x);
      tile.dataset.y = String(y);
      fragment.append(tile);
    }
  }
  elements["dungeon-map"].replaceChildren(fragment);
  renderLookInspector();
}

function inspectMapTile(tile) {
  const x = Number(tile.dataset.x);
  const y = Number(tile.dataset.y);
  state.lookTarget = { x, y };
  let title = "Unexplored ground";
  let description = "This part of the tomb has not been revealed yet.";
  const distance = distanceInSquares({ x, y }, state.run.player);
  if (!tile.classList.contains("unseen") && !tile.classList.contains("map-edge")) {
    const enemy = state.run.enemies.find((entry) => entry.alive && entry.x === x && entry.y === y);
    const companion = state.run.party.find((entry) => entry.x === x && entry.y === y);
    const treasures = state.run.treasures.filter((entry) => entry.x === x && entry.y === y);
    const treasure = treasures[0];
    const well = state.run.wells?.find((entry) => entry.x === x && entry.y === y);
    const hazard = state.run.hazards.find((entry) => entry.x === x && entry.y === y && entry.revealed && !entry.triggered);
    const room = state.run.rooms.find((entry) =>
      x >= entry.mapX && x < entry.mapX + entry.mapW && y >= entry.mapY && y < entry.mapY + entry.mapH);
    const sign = dungeonSignAt(x, y);
    if (well) {
      const thirstyMembers = partyMembers().filter((member) => member.needs.water < 100);
      title = "Stone-lined dungeon well";
      description = [
          `An inexhaustible source of clear, cool water in ${state.run.rooms[well.roomIndex]?.name || "a quiet chamber"}.`,
        thirstyMembers.length
          ? `Available: draw water to restore hydration for ${thirstyMembers.length} traveler${thirstyMembers.length === 1 ? "" : "s"}.`
          : "Current state: the party is fully hydrated.",
        distance === 0 ? "Stand on the well to draw water; using it advances the dungeon turn." : "Move onto the well tile to draw water."
      ].join(" ");
      if (enemy) description += ` ${enemy.name} also occupies this tile.`;
      if (treasure) description += ` Loose treasure also lies here and is collected automatically when you step onto it: ${
        treasures.map((entry) => [
          entry.gold ? formatCurrency(entry.gold) : "",
          ...entry.items.map((item) => `${itemDetails(item.id).name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`)
        ].filter(Boolean).join(", ")).join("; ")}.`;
    } else if (enemy && tile.classList.contains("creature")) {
      title = enemy.name;
      const condition = enemy.hp / enemy.maxHp > 0.7 ? "It appears steady and uninjured."
        : enemy.hp / enemy.maxHp > 0.3 ? "It is visibly wounded."
          : "It is badly hurt and close to collapse.";
      description = `${enemy.description} ${condition} Hostile; attack from an adjacent tile.`;
      if (treasure) description += ` Treasure is also on this tile and will be collected when you can enter it: ${
        treasures.map((entry) => [
          entry.gold ? formatCurrency(entry.gold) : "",
          ...entry.items.map((item) => `${itemDetails(item.id).name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`)
        ].filter(Boolean).join(", ")).join("; ")}.`;
    } else if (treasure) {
      title = treasure.items.length ? itemDetails(treasure.items[0].id).name : "Gold cache";
      const lootDescriptions = treasures.flatMap((cache) => cache.items.map((entry) => {
        const item = itemDetails(entry.id);
        return `${entry.quantity > 1 ? `${entry.quantity} ` : ""}${item.name}: ${item.description || item.category}.`;
      }));
      description = [
        ...treasures.map((cache) => cache.gold ? `${formatCurrency(cache.gold)} in loose gold.` : ""),
        ...lootDescriptions,
        distance <= 1 ? "Collectible: interact from beside the cache or step onto it to collect what you can carry." : "Collectible: move onto the cache to collect what you can carry."
      ].filter(Boolean).join(" ");
    } else if (hazard) {
      title = hazard.name;
      description = `${hazard.description || "A revealed mechanism in the floor."} It is dangerous; search or use the appropriate tool to deal with it.`;
    } else if (companion && companion.hp <= 0) {
      title = companion.name;
      description = "Your companion is unconscious and needs food, treatment, or a safe rest to recover.";
    } else if (companion) {
      title = companion.name;
      description = `${companion.description || "A member of your traveling party."} They travel with you and can help in combat.`;
    } else if (campAt(x, y)) {
      title = "Your camp";
      description = campInspectText(campAt(x, y));
    } else if (x === state.run.player.x && y === state.run.player.y && !tile.classList.contains("door")) {
      title = state.run.character.name;
      description = "Your current position. Use the nearby action to interact with a creature, cache, door, or the tomb entrance.";
    } else if (tile.classList.contains("door")) {
      const open = state.run.openDoors.includes(tileIndex(x, y));
      title = "Door";
      description = sign?.type === "locked"
        ? `The doorway is ${open ? "open" : "locked"}. ${open
          ? "It can be closed while its tile is empty."
          : "Interact nearby to attempt a DC 15 Strength check; carrying a crowbar grants +2."}`
        : `The doorway is ${open ? "open" : "closed"}. Walk into a closed doorway to open and pass through; interact beside an open doorway to close it.`;
    } else if (tile.classList.contains("map-entrance")) {
      title = "Tomb entrance";
      description = "The route back to Chiltomatlan. Return here to safely secure expedition loot.";
    } else if (sign) {
      title = sign.name;
      description = sign.description || `An old tomb marking: ${sign.name}.`;
    } else if (tile.classList.contains("wall")) {
      title = "Stone wall";
      description = "Ancient fitted stone blocks. It cannot be crossed.";
    } else if (tile.classList.contains("floor") || tile.classList.contains("corridor")) {
      title = tile.classList.contains("corridor") ? "Stone corridor" : "Stone floor";
      description = room
        ? `A walkable stretch of ${room.name}.`
        : "A walkable stretch of the tomb.";
    } else if (room) {
      title = room.name;
      description = room.text || room.description || "A chamber in the tomb.";
    }
  }
  elements["look-title"].textContent = t(title);
  elements["look-description"].textContent = t(description);
  renderMap();
  if (description.length > 120) showRpgMessage(title, description);
}

function renderLookInspector() {
  const active = state.lookMode && state.run?.location === "dungeon";
  elements["look-toggle"].setAttribute("aria-pressed", String(active));
  elements["look-toggle"].classList.toggle("is-active", active);
  elements["look-toggle"].setAttribute("aria-label", active ? "Exit inspect mode" : "Inspect a tile");
  elements["look-toggle"].title = active ? "Exit inspect mode · Esc" : "Inspect a tile · Esc to cancel";
  elements["look-toggle"].querySelector(".action-label").textContent = active ? "Done" : "Inspect";
  elements["look-inspector"].hidden = !active;
  if (!active) return;
  if (!state.lookTarget) {
    elements["look-title"].textContent = "Look mode";
    elements["look-description"].textContent = "Tap a visible tile or object to inspect it. Looking does not move or advance a turn.";
  }
}

function toggleLookMode() {
  stopHeldMovement();
  state.lookMode = !state.lookMode;
  state.lookTarget = null;
  renderLookInspector();
  renderMap();
  elements["turn-status"].textContent = state.lookMode
    ? "Look mode · select a visible tile · no turn passes"
    : "Tap to move · one square per turn";
}

function dungeonInteractionLabel() {
  return contextualInteraction()?.label || "Nothing nearby";
}

function renderActions() {
  const icons = {
    "wait-button": "kit",
    "attack-button": "weapon",
    "dash-button": "tool",
    "disengage-button": "armor",
    "search-button": "tool",
    "disarm-button": "tool",
    "drink-potion-button": "potion",
    "drink-water-button": "water",
    "eat-meal-button": "ration",
    "camp-button": "kit",
    "forage-button": "chilis",
    "cook-button": "soup",
    "interact-button": "tool",
    "spell-spark-button": "keepsake",
    "spell-shard-button": "keepsake",
    "spell-heal-button": "potion",
    "spell-button": "keepsake"
  };
  const addButton = (label, action, shortcut, secondary = false, disabled = false, target = elements["action-buttons"], id = "") => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `button${secondary ? " secondary" : ""}`;
    const shortcutLabel = shortcut.split(/\s+/).map((key) => ({ " ": "Space", space: "Space", enter: "Enter", ".": "." })[key] || key.toUpperCase())
      .filter((key) => key !== "Enter").join("/");
    const tooltip = `${label} · ${shortcutLabel}`;
    button.setAttribute("aria-label", tooltip);
    button.title = tooltip;
    button.dataset.tooltip = tooltip;
    button.dataset.shortcut = shortcut === " " ? "space" : shortcut;
    if (id === "dash-button" || id === "disengage-button") {
      const pressed = id === "dash-button" ? state.dashReady : state.disengageReady;
      button.setAttribute("aria-pressed", String(pressed));
      button.classList.toggle("is-selected", pressed);
    }
    const glyph = document.createElement("span");
    glyph.className = "action-glyph";
    glyph.setAttribute("aria-hidden", "true");
    const sprite = icons[id] || (id.startsWith("spell-") ? icons["spell-button"] : null);
    if (sprite) {
      const icon = document.createElement("img");
      icon.src = `./resources/items/${sprite}.png?v=77`;
      icon.alt = "";
      icon.draggable = false;
      glyph.append(icon);
    }
    const actionLabel = document.createElement("span");
    actionLabel.className = "action-label";
    actionLabel.textContent = label;
    const keyHint = document.createElement("kbd");
    keyHint.className = "action-key";
    keyHint.textContent = shortcutLabel;
    button.append(glyph, actionLabel, keyHint);
    button.disabled = disabled;
    if (id) button.id = id;
    // Never hand the click event to the action: some take an optional target.
    button.addEventListener("click", () => action());
    target.append(button);
  };
  const primaryActions = elements["action-primary"];
  const groupedActions = [
    elements["action-combat"], elements["action-explore"], elements["action-supplies"]
  ];
  const ended = state.run.lost || state.run.won;
  const inDungeon = state.run.location === "dungeon";
  elements["action-panel"].classList.toggle("hidden", !inDungeon);
  if (!inDungeon) return;
  const validAttackTargets = attackTargets();
  const nearbyHazard = state.run.hazards.some((hazard) => !hazard.triggered && hazard.revealed &&
    distanceInSquares(hazard, state.run.player) <= 1);
  primaryActions.replaceChildren();
  for (const group of groupedActions) group.replaceChildren();
  elements["return-after-delving"].classList.add("hidden");
  elements["return-after-delving"].removeAttribute("data-shortcut");
  const combatActive = state.run.enemies.some((enemy) => enemy.alive &&
    (enemy.alerted || distanceInSquares(enemy, state.run.player) <= 7));
  const passivePerception = 10 + skillBonus("perception");
  elements["turn-status"].textContent = ended ? "Expedition ended"
    : combatActive ? (enemiesAdjacent().some((enemy) => flankingCompanion(enemy))
      ? "Flanked · Advantage on melee attacks" : "Engaged · flank with an ally for Advantage")
      : `Explore · tap to move · Passive Perception ${passivePerception}`;
  elements["action-mode"].textContent = state.dashReady ? "Dash armed"
    : state.disengageReady ? "Disengage armed" : "Auto-guard active";
  const interactionLabel = dungeonInteractionLabel();
  const atEntrance = isAtDungeonEntrance();
  addButton(interactionLabel, interact, "space enter e", false,
    ended || interactionLabel === "Nothing nearby", primaryActions, "interact-button");
  addButton("Wait", waitTurn, "x .", true, ended, elements["action-explore"], "wait-button");
  if (validAttackTargets.length) {
    const attackLabel = validAttackTargets.length > 1
      ? `Attack · choose target (${validAttackTargets.length})`
      : `Attack · ${validAttackTargets[0].name}`;
    addButton(attackLabel, attack, "r", true, ended, elements["action-combat"], "attack-button");
  }
  if (hasSpellcasting(state.run.character.class, state.run.level)) {
    (CLASS_SPELLS[state.run.character.class] || []).forEach((spellId, index) => {
      const spell = SPELLS[spellId];
      const spellTargetsInSight = spell.healing ? [] : spellTargets(spell.range);
      const target = spellTargetsInSight[0] || null;
      const disabled = ended || (spell.healing
        ? state.run.spellSlots < 1 || !canHeal() || state.run.hp >= state.run.maxHp
        : !target || (!spell.free && state.run.spellSlots < 1));
      const spellName = t(spell.name);
      const label = spell.healing
        ? `${spellName} · ${state.run.spellSlots}`
        : `${spellName}${spellTargetsInSight.length > 1 ? ` · choose (${spellTargetsInSight.length})`
          : target ? ` · ${t(target.name)}` : ""}${spell.free ? "" : ` · ${state.run.spellSlots}`}`;
      addButton(label, () => castSpell(spellId), ["1", "2", "3"][index], true, disabled,
        elements["action-combat"], `spell-${spellId}-button`);
    });
  }
  addButton("Dash · next move", dash, "t", true,
    ended, elements["action-combat"], "dash-button");
  addButton("Disengage · next move", disengage, "y", true,
    ended, elements["action-combat"], "disengage-button");
  addButton("Search", searchArea, "f", true, ended, elements["action-explore"], "search-button");
  addButton(nearbyHazard ? "Disarm trap" : "Disarm · search first", disarmNearbyHazard, "shift+f", true,
    ended || !nearbyHazard, elements["action-explore"], "disarm-button");
  addButton(`Medicine · ${inventoryQuantity("healing-potion")}`, usePotion, "h", true,
    ended || inventoryQuantity("healing-potion") < 1 || (state.run.hp >= state.run.maxHp && !progress().conditions.length),
    elements["action-supplies"], "drink-potion-button");
  addButton(`Drink water · ${inventoryQuantity("clean-water")}`, () => useInventoryItem("clean-water"), "u", true,
    ended || inventoryQuantity("clean-water") < 1 || state.run.needs.water >= 100,
    elements["action-supplies"], "drink-water-button");
  const meal = bestMealToEat();
  const mealCount = Object.keys(FOOD_ITEMS).reduce((sum, id) => sum + inventoryQuantity(id), 0);
  addButton(meal ? `Eat · ${itemDetails(meal)?.name || "meal"}` : `Eat meal · ${mealCount}`, eatBestMeal, "m", true,
    ended || !meal, elements["action-supplies"], "eat-meal-button");
  const nearbyThreat = state.run.enemies.some((enemy) => enemy.alive &&
    distanceInSquares(enemy, state.run.player) <= 7);
  const byCamp = atCamp();
  if (byCamp) {
    addButton("Rest at camp · 8 hours", restAtCamp, "b", true, ended || nearbyThreat,
      elements["action-supplies"], "camp-button");
  } else {
    addButton(activeCamp() ? "Make a new camp here" : "Make camp here", openMakeCamp, "b", true, ended || nearbyThreat,
      elements["action-supplies"], "camp-button");
  }
  const dishes = availableRecipes().length;
  addButton(`Cook at camp${dishes ? ` · ${dishes}` : ""}`, openCookMenu, "n", true,
    ended || nearbyThreat || !byCamp, elements["action-supplies"], "cook-button");
  addButton("Forage · 1 hour", forageIngredients, "g", true,
    ended || getCarriedWeight() + GEAR_ITEMS["wild-ingredients"].weight > getCarryCapacity(state.run.character),
    elements["action-explore"], "forage-button");
  elements["return-after-delving"].classList.add("hidden");
  elements["return-after-delving"].removeAttribute("data-shortcut");
  if (state.run.won && !atEntrance) {
    elements["return-after-delving"].classList.remove("hidden");
    elements["return-after-delving"].disabled = false;
    elements["return-after-delving"].dataset.shortcut = "enter";
    elements["return-after-delving"].textContent = "Return to Chiltomatlan · Enter";
  }
  if (!elements["return-after-delving"].classList.contains("hidden")) {
    primaryActions.append(elements["return-after-delving"]);
  }
  for (const [index, group] of groupedActions.entries()) {
    group.parentElement.hidden = group.childElementCount === 0;
  }
  const needsSupplies = (progress().conditions.length > 0 && inventoryQuantity("healing-potion") > 0) ||
    (state.run.hp <= state.run.maxHp / 2 && inventoryQuantity("healing-potion") > 0) ||
    state.run.needs.food < 25 || state.run.needs.water < 25;
  const contextualGroup = nearbyHazard ? "action-group-explore"
      : needsSupplies ? "action-group-supplies" : null;
  if (state.autoActionGroup !== contextualGroup) {
    if (state.autoActionGroup) document.getElementById(state.autoActionGroup).open = false;
    if (contextualGroup && !document.getElementById(contextualGroup).hidden) {
      document.getElementById(contextualGroup).open = true;
      state.autoActionGroup = contextualGroup;
    } else {
      state.autoActionGroup = null;
    }
  }
}

function renderRoom() {
  const room = getRoom();
  elements["room-type"].textContent = describeRoomType(room.type);
  elements["room-name"].textContent = t(room.name);
  elements["room-description"].textContent = t(state.run.lost
    ? "Your adventure has ended here. A new delve will generate a different floor plan."
    : state.run.won
      ? "You have found the way out. Start another delve whenever you like."
      : room.text);

  const status = elements["room-status"];
  status.className = "status-pill";
  if (enemiesAdjacent().length) {
    status.textContent = "Threat nearby";
    status.classList.add("danger");
  } else if (state.run.won) {
    status.textContent = "Complete";
    status.classList.add("good");
  } else if (state.run.lost) {
    status.textContent = "Fallen";
    status.classList.add("danger");
  } else if (room.visited) {
    status.textContent = `${state.run.steps} ${state.run.steps === 1 ? "step" : "steps"}`;
    status.classList.add("good");
  } else {
    status.textContent = "Exploring";
  }

  const enemy = nearestEnemy();
  const distance = enemy ? distanceInSquares(enemy, state.run.player) : Infinity;
  const visibleEnemy = enemy && (enemy.alerted || distance <= 7);
  elements.encounter.classList.toggle("hidden", !visibleEnemy);
  if (visibleEnemy) {
    elements["enemy-name"].textContent = enemy.title ? `${enemy.title} ${t(enemy.name.slice(enemy.title.length + 1))}` : t(enemy.name);
    elements["enemy-rank"].textContent = enemy.greatGuardian ? "GREAT GUARDIAN" : enemy.guardian ? "GUARDIAN" : enemy.elite ? "ELITE" : t("HOSTILE");
    elements.encounter.classList.toggle("is-elite", Boolean(enemy.elite));
    elements.encounter.classList.toggle("is-guardian", Boolean(enemy.guardian));
    const studied = bestiaryRank(enemy.templateId);
    const inflicts = enemy.inflicts ? ` Can leave you ${t(PROGRESSION.conditions[enemy.inflicts.condition].name).toLowerCase()}.` : "";
    elements["enemy-description"].textContent = `${t(enemy.description || "Keep your guard up.")}${inflicts}${studied && studied.kills >= 5 ? ` ${studied.title}: ${studied.description}` : ""}`;
    elements["enemy-health"].textContent = `${enemy.hp} / ${enemy.maxHp} HP`;
    elements["enemy-health-fill"].style.width = `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%`;
    const flanker = flankingCompanion(enemy);
    elements["enemy-distance"].textContent = `${distance} ${distance === 1 ? "square" : "squares"} away${flanker ? ` · ${flanker.name} flanks` : ""}`;
    elements["enemy-portrait"].replaceChildren(createSprite(enemySpriteId(enemy), "combatant-sprite"));
  }
  renderActions();
  document.querySelectorAll("[data-move]").forEach((button) => {
    button.disabled = state.run.location !== "dungeon" || state.run.lost || state.run.won;
  });
  elements["wait-dpad-button"].disabled = state.run.location !== "dungeon" || state.run.lost || state.run.won;
}

function renderCharacter() {
  const character = state.run.character || makeLegacyCharacter();
  const stats = currentCharacterStats();
  const maximumSlots = maxSpellSlots(character.class, state.run.level);
  const availableSlots = Math.min(state.run.spellSlots, maximumSlots);
  const spellcastingReady = hasSpellcasting(character.class, state.run.level);
  elements["header-spell-slots"].classList.toggle("hidden", !spellcastingReady);
  elements["header-resources"].classList.toggle("has-spell-slots", spellcastingReady);
  elements["header-spell-slot-count"].textContent = `${availableSlots} / ${maximumSlots}`;
  elements["header-spell-slots"].setAttribute(
    "aria-label",
    `Spell slots: ${availableSlots} available, ${maximumSlots - availableSlots} expended. Open ability guide.`
  );
  elements["header-spell-slot-pips"].replaceChildren(...Array.from({ length: maximumSlots }, (_, index) => {
    const pip = document.createElement("span");
    pip.className = `spell-slot-pip${index >= availableSlots ? " is-expended" : ""}`;
    return pip;
  }));
  elements["player-hp"].textContent = `${state.run.hp} / ${state.run.maxHp}`;
  elements["player-health-fill"].style.width = `${Math.max(0, (state.run.hp / state.run.maxHp) * 100)}%`;
  elements["header-health"].textContent = `${state.run.hp} / ${state.run.maxHp}`;
  elements["header-health-fill"].style.width = `${Math.max(0, (state.run.hp / state.run.maxHp) * 100)}%`;
  elements["header-health-meter"].setAttribute("aria-valuenow",
    String(Math.round((state.run.hp / state.run.maxHp) * 100)));
  elements["header-health-meter"].setAttribute("aria-label",
    `Hit points: ${state.run.hp} of ${state.run.maxHp}`);
  elements["header-health-meter"].classList.toggle("meter-warning", state.run.hp / state.run.maxHp < 0.3);
  elements["combat-player-hp"].textContent = `${state.run.hp} / ${state.run.maxHp}`;
  elements["combat-player-health-fill"].style.width = `${Math.max(0, (state.run.hp / state.run.maxHp) * 100)}%`;
  elements["combat-level"].textContent = state.run.level;
  elements["combat-player-ac"].textContent = stats.ac;
  elements["combat-player-attack"].textContent = `${stats.attackBonus >= 0 ? "+" : ""}${stats.attackBonus}`;
  elements["combat-potions"].textContent = inventoryQuantity("healing-potion");
  renderStatusChips();
  const facing = state.run.player.facing || "south";
  elements["combat-player-portrait"].replaceChildren(createCodexCharacterSprite(character, "combatant-sprite", facing));
  elements["combat-character-name"].textContent = character.name;
  elements["character-heading"].textContent = character.name;
  const heritageName = RACES[character.race]?.heritages?.[character.heritage]?.name;
  const genderLabel = { man: "he/him", woman: "she/her", other: "they/them" }[character.gender] || "they/them";
  elements["character-subtitle"].textContent =
    `${t(heritageName || RACES[character.race]?.name || "Traveler")} ${t(CLASSES[character.class]?.name || "Adventurer")} · ${t(genderLabel)}`;
  elements["character-portrait"].replaceChildren(createCodexCharacterSprite(character, "sidebar-sprite", facing));
  elements["header-character-portrait"].replaceChildren(createCodexCharacterSprite(character, "header-sprite", facing));
  elements["player-ac"].textContent = stats.ac;
  elements["player-attack"].textContent = `${stats.attackBonus >= 0 ? "+" : ""}${stats.attackBonus}`;
  elements["header-gold"].textContent = `${formatCurrency(state.run.gold)}`;
  const loot = expeditionLoot();
  const atRiskItems = loot.items.reduce((total, item) => total + item.quantity, 0);
  const protectedGold = Math.max(0, state.run.gold - loot.gold);
  const riskSummary = loot.gold || atRiskItems
    ? `At risk: ${formatCurrency(loot.gold)} · ${atRiskItems} item${atRiskItems === 1 ? "" : "s"}`
    : `Secured: ${formatCurrency(protectedGold)}`;
  elements["header-at-risk"].textContent = riskSummary;
  elements["header-at-risk"].parentElement.setAttribute("aria-label",
    `Gold ${formatCurrency(state.run.gold)}. Secured ${formatCurrency(protectedGold)}. ${riskSummary}.`);
  elements["header-rations"].textContent = String(Object.keys(FOOD_ITEMS).reduce((sum, id) => sum + inventoryQuantity(id), 0));
  elements["header-food"].textContent = `${Math.round(state.run.needs.food)}%`;
  elements["header-food-fill"].style.width = `${state.run.needs.food}%`;
  elements["header-food-meter"].setAttribute("aria-valuenow", String(Math.round(state.run.needs.food)));
  elements["header-water"].textContent = `${Math.round(state.run.needs.water)}%`;
  elements["header-water-fill"].style.width = `${state.run.needs.water}%`;
  elements["header-water-meter"].setAttribute("aria-valuenow", String(Math.round(state.run.needs.water)));
  elements["header-water-stock"].textContent = String(inventoryQuantity("clean-water"));
  elements["header-food-fill"].parentElement.setAttribute("aria-label",
    `Food ${Math.round(state.run.needs.food)}%; ${elements["header-rations"].textContent} meals carried`);
  elements["header-water-fill"].parentElement.setAttribute("aria-label",
    `Water ${Math.round(state.run.needs.water)}%; ${elements["header-water-stock"].textContent} gourds carried`);
  elements["header-food-meter"].classList.toggle("meter-warning", state.run.needs.food < 25);
  elements["header-water-meter"].classList.toggle("meter-warning", state.run.needs.water < 25);
  renderExpeditionKit();
  const elapsedMinutes = Number.isInteger(state.run.gameMinutes) ? state.run.gameMinutes
    : (Number.isInteger(state.run.gameHours) ? state.run.gameHours : 8) * 60;
  const clockHour = Math.floor(elapsedMinutes / 60) % 24;
  const clockMinute = elapsedMinutes % 60;
  const day = Math.floor(elapsedMinutes / (24 * 60)) + 1;
  const clockText = `Day ${day} · ${String(clockHour).padStart(2, "0")}:${String(clockMinute).padStart(2, "0")}`;
  elements["header-clock"].textContent = clockText;
  elements["header-clock"].parentElement.setAttribute("aria-label", `Expedition time: ${clockText}`);
  elements["xp-line"].textContent = state.run.level >= MAX_LEVEL
    ? `${state.run.xp} experience · Maximum level`
    : `${state.run.xp} experience · ${Math.max(0, XP_THRESHOLDS[state.run.level + 1] - state.run.xp)} to level ${state.run.level + 1}`;
  elements["level-badge"].textContent = `LV ${state.run.level}`;
  renderCharacterGuide(character, stats);
  const equipment = character.equipment || {};
  elements["character-equipment"].textContent =
    `${itemDetails(`weapon:${equipment.weapon}`)?.name || "Weapon"} · ${equipment.armor === "none" ? "No armor" : itemDetails(`armor:${equipment.armor}`)?.name || "No armor"}${equipment.shield ? ` · ${GEAR_ITEMS.shield.name}` : ""}${equipment.cloak ? ` · ${GEAR_ITEMS["travel-cloak"].name}` : ""}`;
  renderInventory();
  selectCharacterTab(state.characterTab);
}

function renderCharacterGuide(character, stats) {
  const classInfo = CLASSES[character.class];
  const backgroundSkills = BACKGROUNDS[character.background]?.skillIds || [];
  const trainedSkills = [...new Set([...backgroundSkills, ...(character.classSkills || [])])];
  const trainedSaves = classInfo.saves.map((ability) => ABILITIES.find(([key]) => key === ability)?.[1] || ability);
  const spellAbility = spellcastingAbility(character.class);
  const spellReady = hasSpellcasting(character.class, state.run.level);
  elements["class-guide-heading"].textContent = `Level ${state.run.level} ${classInfo.name}`;
  elements["class-guide-copy"].textContent = classInfo.description;
  const background = BACKGROUNDS[character.background];
  const training = [
    `${BACKGROUNDS[character.background]?.name || "Adventurer"} · trained skills: ${trainedSkills.map((skill) => SKILLS[skill]).join(", ") || "none listed"}.`,
    `Background bonuses: +${background.skillBonus || 0} to its trained skill checks${background.attackBonus ? ` and +${background.attackBonus} to weapon attacks` : ""}${background.spellAttackBonus ? ` and +${background.spellAttackBonus} to spell attacks` : ""}.`,
    `Proficient saving throws: ${trainedSaves.join(" and ")}.`
  ];
  if (spellReady && spellAbility) {
    const abilityName = ABILITIES.find(([key]) => key === spellAbility)?.[1] || spellAbility;
    training.push(`${abilityName} shapes spell attack accuracy and healing for your magic.`);
  } else if (HALF_CASTER_CLASSES.has(character.class)) {
    training.push("This calling's spells awaken at level 2.");
  }
  training.push("Attribute modifiers shown here reflect your current food, water, sleep, and nutrition effects; spell attacks use your class's listed ability score.");
  elements["class-training-copy"].textContent = training.join(" ");

  const nextLevelXp = state.run.level < MAX_LEVEL ? XP_THRESHOLDS[state.run.level + 1] : null;
  elements["character-level-progress"].textContent = nextLevelXp === null
    ? `Level ${state.run.level} · maximum`
    : `Level ${state.run.level} · next milestone ${nextLevelXp} XP`;
  elements["player-hp-stat"].textContent = `${state.run.hp} / ${state.run.maxHp}`;
  elements["character-carry-capacity"].textContent = `${getCarryCapacity(character)} lb`;

  const attributeEffects = {
    str: "Most melee attacks and damage; carrying capacity (Strength × 15 lb).",
    dex: "Ranged attacks and finesse weapons; armor class when your armor allows it.",
    con: "Your hit-point total as you gain levels.",
    int: "Arcana, History, Investigation, Nature, and Religion checks; Wizard spell attacks.",
    wis: "Perception, Survival, Medicine, and other Wisdom checks; Cleric, Druid, and Ranger spell attacks.",
    cha: "Persuasion, Deception, Performance, and other Charisma checks; Bard, Paladin, Sorcerer, and Warlock spell attacks."
  };
  elements["character-stat-details"].replaceChildren(...ABILITIES.map(([key, name]) => {
    const row = document.createElement("div");
    row.className = "character-stat-row";
    const heading = document.createElement("strong");
    const modifier = stats.modifiers[key];
    heading.textContent = `${name} ${character.scores[key]} (${modifier >= 0 ? "+" : ""}${modifier})`;
    const description = document.createElement("span");
    description.textContent = attributeEffects[key];
    row.append(heading, description);
    return row;
  }));
  const equipment = character.equipment || {};
  const armor = ARMORS[equipment.armor] || ARMORS.none;
  const weapon = WEAPONS[equipment.weapon] || WEAPONS.macuahuitl;
  const dexArmorBonus = armor.dex ? Math.min(stats.modifiers.dex, armor.dexCap ?? stats.modifiers.dex) : 0;
  const gearText =
    `${weapon.name} deals ${stats.damageDice}${stats.damageBonus >= 0 ? "+" : ""}${stats.damageBonus} on a hit; attack bonus ${stats.attackBonus >= 0 ? "+" : ""}${stats.attackBonus}. ${armor.name} contributes to AC ${armor.base}${dexArmorBonus ? ` + ${dexArmorBonus} Dexterity` : ""}${equipment.shield ? " + 2 from your shield" : ""}, for AC ${stats.ac}.`
    + (equipment.cloak ? ` ${GEAR_ITEMS["travel-cloak"].name} is equipped; it has no separate bonus in this ruleset.` : "");
  elements["character-equipment-bonus"].textContent = gearText;
  renderCharacterSheet(character, stats, training.join(" "), gearText);

  renderCharacterInfoPage();
  renderAbilityGuide(character, stats, spellAbility, spellReady);
}

function renderCharacterInfoPage() {
  const pageCount = 4;
  state.characterInfoPage = Math.max(0, Math.min(state.characterInfoPage, pageCount - 1));
  const page = state.characterInfoPage;
  const profile = elements["panel-info"].querySelector(".character-class-guide");
  const progress = elements["panel-info"].querySelector(".character-progress-line");
  const stats = elements["panel-info"].querySelector(".character-stat-grid");
  const detailList = elements["character-stat-details"];
  const bonus = elements["character-equipment-bonus"];
  profile.hidden = page !== 0;
  progress.hidden = page === 0 || page === pageCount - 1;
  stats.hidden = page === 0;
  detailList.hidden = page === 0;
  bonus.hidden = page !== pageCount - 1;
  [...detailList.children].forEach((row, index) => {
    row.hidden = page === 0 || Math.floor(index / 2) + 1 !== page;
  });
  const pager = document.querySelector('[data-list-pager="characterInfo"]');
  pager.querySelector("[data-page-indicator]").textContent = `${page + 1} / ${pageCount}`;
  pager.querySelector('[data-page-direction="-1"]').disabled = page === 0;
  pager.querySelector('[data-page-direction="1"]').disabled = page === pageCount - 1;
}

function renderAbilityGuide(character, stats, spellAbility, spellReady) {
  const inDungeon = state.run.location === "dungeon";
  const attackableEnemies = inDungeon ? attackTargets() : [];
  const nearbyHazard = inDungeon && state.run.hazards.some((hazard) =>
    !hazard.triggered && hazard.revealed && distanceInSquares(hazard, state.run.player) <= 1);
  const nearbyThreat = inDungeon && state.run.enemies.some((enemy) =>
    enemy.alive && distanceInSquares(enemy, state.run.player) <= 7);
  const noHpNeeded = state.run.hp >= state.run.maxHp;
  const ailing = progress().conditions.length > 0;
  const canUsePotion = inventoryQuantity("healing-potion") > 0 && (!noHpNeeded || ailing);
  const abilities = [
    {
      name: "Attack",
      status: !inDungeon ? "Dungeon action" : attackableEnemies.length
        ? `${attackableEnemies.length} target${attackableEnemies.length === 1 ? "" : "s"} in reach`
        : "Needs a target in reach",
      state: inDungeon && attackableEnemies.length ? "available" : "context",
      description: `Attack with your equipped ${stats.weapon.name}. ${stats.weapon.ranged
        ? `Adjacent foes are struck in melee; visible foes up to ${stats.weapon.range} squares away can be shot.`
        : "You can strike adjacent foes in melee."} Roll a d20 + ${stats.attackBonus >= 0 ? "+" : ""}${stats.attackBonus}; a hit deals ${stats.damageDice}${stats.damageBonus >= 0 ? "+" : ""}${stats.damageBonus}. A natural 20 doubles the damage dice. Uses your turn.`
    },
    {
      name: "Automatic guard",
      status: inDungeon ? "Active by default" : "Dungeon defense",
      state: inDungeon ? "available" : "context",
      description: "Attacks against you have disadvantage by default. Moving with Dash or Disengage opts out of this guard for that turn."
    },
    {
      name: "Dash",
      status: inDungeon ? (state.dashReady ? "Armed" : "Available") : "Dungeon action",
      state: inDungeon ? "available" : "context",
      description: "Arm or cancel Dash without spending a turn. Your next move can cover up to 2 squares; movement still follows walkable paths."
    },
    {
      name: "Disengage",
      status: inDungeon ? (state.disengageReady ? "Armed" : "Available") : "Dungeon action",
      state: inDungeon ? "available" : "context",
      description: "Arm or cancel Disengage without spending a turn. Your next move avoids opportunity attacks from creatures you leave behind."
    },
    {
      name: "Interact",
      status: inDungeon ? "Available" : "Available in town",
      state: "available",
      description: "Use the nearby target: return through the entrance, attack an adjacent enemy, disarm a revealed nearby trap, or move toward an adjacent door, treasure, or exit. Town interactions include speaking with locals and drawing water at the Ceiba Well."
    },
    {
      name: "Search",
      status: inDungeon ? "Available" : "Dungeon action",
      state: inDungeon ? "available" : "context",
      description: `Search for hidden hazards within 4 squares and line of sight. Each hazard is revealed by a Perception check against its difficulty. Uses your turn.${nearbyHazard ? " A revealed hazard is close enough to disarm." : ""}`
    },
    {
      name: "Disarm trap",
      status: nearbyHazard ? "Trap in reach" : "Needs revealed nearby trap",
      state: nearbyHazard ? "available" : "context",
      description: "Attempt a Sleight of Hand check against a revealed trap's difficulty while adjacent. Failure triggers the trap. Uses your turn."
    },
    {
      name: "Forage",
      status: inDungeon ? "Available" : "Dungeon action",
      state: inDungeon ? "available" : "context",
      description: "Spend an hour making a Survival check to gather wild ingredients. Better results find more, if your pack has room."
    },
    {
      name: "Camp",
      status: nearbyThreat ? "Too close to danger" : !inDungeon ? "Rest at the inn" : atCamp() ? "At your camp" : activeCamp() ? `Camp on floor ${activeCamp().floor}` : "No camp yet",
      state: nearbyThreat ? "locked" : "context",
      description: inDungeon
        ? `Pitch a camp on a quiet chamber floor with a camp kit, or by spending an hour on a Survival check (DC ${CAMP_SURVIVAL_DC}). The camp stays until you pitch a new one. At your camp you can rest for 8 hours when no enemy is within 7 squares: the party eats carried meals and water, may cook ingredients, recovers spell slots, and heals when food needs are high enough. Cooking also needs your campfire. From Chiltomatlan you can walk straight back to your camp.`
        : "At the Ceiba House, an 8-hour safe rest restores everyone's food and water, resets exhaustion, restores spell slots, and tends wounds without consuming carried meals or water."
    },
    {
      name: "Healing potion",
      status: !inventoryQuantity("healing-potion") ? "None carried" : noHpNeeded && !ailing ? "Already at full HP" : noHpNeeded ? "Ready · cures ailments" : "Ready",
      state: canUsePotion ? "available" : "context",
      description: `Use one carried dose of medicine to restore 2d4 + 2 hit points (up to your maximum), even when hungry. Uses your turn. ${inventoryQuantity("healing-potion")} carried.`
    }
  ];

  if (inventoryQuantity("clean-water")) {
    abilities.push({
      name: "Drink carried water",
      status: state.run.needs.water >= 100 ? "Already hydrated" : "Ready",
      state: state.run.needs.water >= 100 ? "context" : "available",
      description: "Use one gourd from your pack to restore up to 70 hydration. In the dungeon this uses your turn."
    });
  }
  const foodId = Object.keys(FOOD_ITEMS).find((id) => inventoryQuantity(id));
  if (foodId) {
    abilities.push({
      name: "Eat carried food",
      status: state.run.needs.food >= 100 ? "Already full" : "Ready",
      state: state.run.needs.food >= 100 ? "context" : "available",
      description: `${t(FOOD_ITEMS[foodId].name)} restores ${FOOD_ITEMS[foodId].food} food and adds nutrients listed for that meal. In the dungeon, eating uses your turn.`
    });
  }

  const spellStart = abilities.length;
  if (spellReady) {
    const abilityName = ABILITIES.find(([key]) => key === spellAbility)?.[1] || "Spellcasting ability";
    const slotStatus = state.run.spellSlots > 0 ? `${state.run.spellSlots} spell slot${state.run.spellSlots === 1 ? "" : "s"} left` : "No spell slots";
    for (const spellId of CLASS_SPELLS[character.class] || []) {
      const spell = SPELLS[spellId];
      if (spell.healing) {
        const canCastHeal = state.run.spellSlots > 0 && canHeal() && !noHpNeeded;
        abilities.push({
          name: t(spell.name),
          status: !inDungeon ? "Dungeon action" : state.run.spellSlots < 1 ? "No spell slots"
            : !canHeal() ? "Needs food at 75%" : noHpNeeded ? "Already at full HP" : `${slotStatus} · self`,
          state: canCastHeal ? "available" : "context",
          description: `${t(spell.description)} Spend 1 spell slot and your turn to restore ${spellDamageAtLevel(spell.healing, state.run.level)} + your ${abilityName} modifier in hit points. Affects you only, requires food at 75% or higher, and cannot exceed your maximum HP.`
        });
        continue;
      }
      const target = inDungeon ? spellTarget(spell.range) : null;
      const available = spell.free || state.run.spellSlots > 0;
      abilities.push({
        name: t(spell.name),
        status: !inDungeon ? "Dungeon action" : !available ? "No spell slots"
          : !target ? "Needs target in sight" : spell.free ? "At will · no slot" : slotStatus,
        state: available && inDungeon && target ? "available" : "context",
        description: `${t(spell.description)} Make a ${abilityName}-based spell attack against a creature within ${spell.range} squares and line of sight, dealing ${spellDamageAtLevel(spell.damage, state.run.level)} damage on a hit. ${spell.free ? "This spell uses no slot" : "Spend 1 spell slot"} and your turn.`
      });
    }
  } else if (HALF_CASTER_CLASSES.has(character.class)) {
    abilities.push({
      name: "Class spellcasting",
      status: "Locked until level 2",
      state: "locked",
      description: "Paladins and Rangers learn their first spells at level 2."
    });
  }

  const spellEnd = abilities.length;
  const toolGuides = [
    ["torch", "Light a torch", "Spend one torch to reveal walkable areas within 8 squares and line of sight. It consumes a dungeon turn; searching for hazards remains a separate action."],
    ["crowbar", "Use the pry bar", "When adjacent to a revealed trap, roll Strength with advantage against its difficulty. Failure triggers it. Uses a dungeon turn."],
    ["hempen-rope", "Use the maguey cord", "From up to 10 squares away with line of sight, pull the trigger of a revealed trap without approaching it. Uses a dungeon turn."],
    ["healer-kit", "Use a healer's bundle", `Spend one bundle use to treat a downed companion. They recover 1 HP only if their food is at least 75%; otherwise they remain unconscious. ${inventoryQuantity("healer-kit")} kit${inventoryQuantity("healer-kit") === 1 ? "" : "s"} carried.`]
  ];
  for (const [itemId, name, description] of toolGuides) {
    if (inventoryQuantity(itemId)) {
      abilities.push({
        name,
        status: inDungeon ? "In your pack" : "Dungeon use",
        state: "available",
        description
      });
    }
  }

  elements["ability-guide-note"].textContent = spellReady
    ? `${CLASSES[character.class].name} · ${state.run.spellSlots} / ${maxSpellSlots(character.class, state.run.level)} spell slots. Conditions and target availability update as you play.`
    : `${CLASSES[character.class].name} · no spell slots available at this level. Ordinary actions and carried tools are listed here.`;
  renderGroupedAbilities(abilities, [spellStart, spellEnd]);
}

function renderPartyStatus() {
  const members = partyMembers();
  elements["party-count"].textContent = String(members.length);
  for (const list of [elements["town-party-list"], elements["dungeon-party-list"]]) {
    list.replaceChildren();
    for (const member of members) {
      const row = document.createElement("div");
      const foodLevel = needLevel(member.needs, "food");
      const waterLevel = needLevel(member.needs, "water");
      const sleepLevel = needLevel(member.needs, "sleep");
      row.className = `party-member${member.hp <= 0 ? " unconscious" : ""}`;
      const portrait = document.createElement("span");
      portrait.className = "party-portrait";
      const character = member.hero ? state.run.character : member;
      portrait.append(createCodexCharacterSprite(character, "party-sprite"));
      const copy = document.createElement("div");
      copy.className = "party-member-copy";
      const name = document.createElement("strong");
      name.textContent = `${member.name}${member.hero ? " · You" : ` · ${CLASSES[member.class].name}`} · Lv ${state.run.level}`;
      const health = document.createElement("span");
      health.className = "party-health";
      health.textContent = member.hp > 0 ? `HP ${member.hp}/${member.maxHp}` : "Down";
      const needs = document.createElement("div");
      needs.className = "party-needs";
      const foodBadge = document.createElement("span");
      foodBadge.className = `need-badge${foodLevel ? " need-warning" : ""}`;
      foodBadge.setAttribute("aria-label", `Food ${Math.round(member.needs.food)}%`);
      foodBadge.title = `Food ${Math.round(member.needs.food)}%`;
      foodBadge.textContent = `Food ${Math.round(member.needs.food)}%`;
      const waterBadge = document.createElement("span");
      waterBadge.className = `need-badge${waterLevel ? " need-warning" : ""}`;
      waterBadge.setAttribute("aria-label", `Water ${Math.round(member.needs.water)}%`);
      waterBadge.title = `Water ${Math.round(member.needs.water)}%`;
      waterBadge.textContent = `Water ${Math.round(member.needs.water)}%`;
      const sleepBadge = document.createElement("span");
      sleepBadge.className = `need-badge${sleepLevel ? " need-warning" : ""}`;
      sleepBadge.setAttribute("aria-label", sleepLevel ? `Tired, level ${sleepLevel}` : "Rested");
      sleepBadge.title = sleepLevel ? `Tiredness level ${sleepLevel}` : "Rested";
      const sleepIcon = document.createElement("span");
      sleepIcon.setAttribute("aria-hidden", "true");
      sleepIcon.textContent = sleepLevel ? "Z" : "·";
      sleepBadge.append(sleepIcon, document.createTextNode(sleepLevel ? ` Tired ${sleepLevel}` : " Rested"));
      needs.append(foodBadge, waterBadge, sleepBadge);
      const nutrition = nutritionStatus(member.needs);
      const nutritionBadge = document.createElement("span");
      nutritionBadge.className = `need-badge${hasBalancedNutrition(member.needs) ? " need-benefit" : nutrientDeficiencies(member.needs).length ? " need-warning" : ""}`;
      nutritionBadge.textContent = nutrition.label;
      nutritionBadge.title = nutrition.detail;
      needs.append(nutritionBadge);
      copy.append(name, health, needs);
      row.append(portrait, copy);
      list.append(row);
    }
  }
  elements["party-message"].textContent =
    state.run.party.length
      ? `Crew of ${members.length}. Food drains 4% and water 6% each dungeon hour; dehydration at 0% causes damage.`
      : `Food drains 4% and water 6% each dungeon hour. You travel alone; food and water supplies are in your pack.`;
}

function canEquipItem(item) {
  const characterClass = CLASSES[state.run.character.class];
  if (item.slot === "weapon") return characterClass.weapons.includes(gearBase(item.equipmentId));
  if (item.slot === "armor") {
    return characterClass.armor.includes(gearBase(item.equipmentId)) &&
      (!item.strength || state.run.character.scores.str >= item.strength);
  }
  if (item.slot === "shield") return characterClass.shield;
  if (item.slot === "wear") return true;
  return item.slot === "cloak";
}

function equipInventoryItem(itemId) {
  const item = itemDetails(itemId);
  if (!item?.slot || !inventoryQuantity(itemId) || !canEquipItem(item)) return;
  if (item.slot === "weapon") state.run.character.equipment.weapon = item.equipmentId;
  else if (item.slot === "armor") state.run.character.equipment.armor = item.equipmentId;
  else if (item.slot === "shield") state.run.character.equipment.shield = true;
  else if (item.slot === "cloak") state.run.character.equipment.cloak = true;
  else if (item.slot === "wear") {
    state.run.character.cosmetics ||= { owned: [], helmet: null, clothes: null, back: null };
    state.run.character.cosmetics[item.wearSlot] = item.cosmeticId;
    addLog(`You put on ${item.name}.`);
    render();
    saveRun();
    return;
  }
  addLog(`You equip ${item.name}.`);
  render();
}

function unequipInventoryItem(itemId) {
  const item = itemDetails(itemId);
  if (!item || !isEquipped(itemId) || item.slot === "weapon") return;
  if (item.slot === "armor") state.run.character.equipment.armor = "none";
  else if (item.slot === "shield") state.run.character.equipment.shield = false;
  else if (item.slot === "cloak") state.run.character.equipment.cloak = false;
  else if (item.slot === "wear") state.run.character.cosmetics[item.wearSlot] = null;
  addLog(`You put away ${item.name}.`);
  render();
}

function listPageSize(kind) {
  const height = window.innerHeight || 800;
  if (kind === "store") return height <= 700 ? 4 : height <= 900 ? 5 : 7;
  if (kind === "abilities") return height <= 650 ? 2 : height <= 860 ? 3 : 4;
  return height <= 700 ? 3 : height <= 900 ? 4 : 6;
}

function renderInventoryList(listElement, inventory) {
  listElement.replaceChildren();
  const pageKey = listElement.id === "equipment-list" ? "equipment" : "inventory";
  const pageSize = listPageSize("inventory");
  const pageCount = Math.max(1, Math.ceil(inventory.length / pageSize));
  state.listPages[pageKey] = Math.max(0, Math.min(state.listPages[pageKey], pageCount - 1));
  updateListPager(pageKey, inventory.length, pageSize);
  if (!inventory.length) {
    const empty = document.createElement("li");
    empty.className = "inventory-empty";
    empty.textContent = "Nothing here yet.";
    listElement.append(empty);
    return;
  }
  for (const entry of inventory.slice(state.listPages[pageKey] * pageSize,
    (state.listPages[pageKey] + 1) * pageSize)) {
    const item = itemDetails(entry.id);
    const row = document.createElement("li");
    row.className = "inventory-row";
    const icon = document.createElement("img");
    icon.className = "inventory-item-icon";
    icon.alt = "";
    icon.draggable = false;
    const gearKind = entry.id.startsWith("weapon:") ? "weapon" : entry.id.startsWith("armor:") ? "armor" : null;
    const gearKey = gearKind ? entry.id.slice(gearKind.length + 1) : null;
    row.classList.add(`rarity-${item.exotic || (gearKey && (WEAPONS[gearKey]?.exotic || ARMORS[gearKey]?.exotic)) ? "exotic" : item.tier || "common"}`);
    if (item.slot === "wear" || (gearKind && gearKey !== "none")) icon.classList.add("is-codex-gear");
    setItemArt(icon, entry.id);
    const copy = document.createElement("span");
    copy.className = "inventory-item-copy";
    const label = document.createElement("strong");
    const itemCount = entry.quantity > 1 ? ` ×${entry.quantity}` : "";
    label.className = `inventory-item-name${item.tier ? ` tier-${item.tier}` : ""}`;
    label.textContent = `${item.name}${itemCount}`;
    if (item.tier) row.classList.add(`tier-row-${item.tier}`);
    const itemMeta = document.createElement("span");
    itemMeta.className = "inventory-item-meta";
    const itemDetailsText = [item.category, `${formatWeight(item.weight * entry.quantity)} lb`];
    const equipmentEnhancements = state.run.character.equipmentEnhancements || { weaponIds: [], armorIds: [] };
    if (item.slot === "weapon" && equipmentEnhancements.weaponIds.includes(item.equipmentId)) {
      itemDetailsText.push("Blessed · +1 attack");
    } else if (item.slot === "armor" && equipmentEnhancements.armorIds.includes(item.equipmentId)) {
      itemDetailsText.push("Blessed · +1 AC");
    }
    if (item.id === "healer-kit") {
      itemDetailsText.push(`${entry.uses ?? entry.quantity * HEALER_KIT_USES} uses left`);
    }
    itemMeta.textContent = itemDetailsText.join(" · ");
    const description = document.createElement("small");
    description.textContent = item.description || (item.slot
      ? "Changes your combat stats and how your adventurer looks."
      : item.categoryId === "Treasure" || item.categoryId === "Keepsake"
        ? "Keep as a story keepsake or sell it at the Chiltomatlan market."
        : "Trade at the Chiltomatlan market.");
    copy.append(label, itemMeta, description);
    if (RELIC_RITES[entry.id]) {
      const rite = document.createElement("small");
      rite.className = "relic-rite";
      rite.textContent = RELIC_RITES[entry.id].rite;
      copy.append(rite);
    }
    const actions = document.createElement("span");
    actions.className = "inventory-item-actions";
    if (["healing-potion", "torch", "ocote", "maguey-salve", "picietl", "chili-smoke", "healer-kit", "crowbar", "hempen-rope", "cacao-drink", "ixpatli"].includes(entry.id) ||
      FOOD_ITEMS[entry.id] || entry.id === "clean-water" || RELIC_RITES[entry.id]) {
      const use = document.createElement("button");
      use.type = "button";
      use.className = "inventory-equip";
      use.dataset.useItem = entry.id;
      use.textContent = RELIC_RITES[entry.id] ? RELIC_RITES[entry.id].verb : FOOD_ITEMS[entry.id] ? (GEAR_ITEMS[entry.id]?.category === "Drink" ? "Drink" : "Eat")
        : entry.id === "maguey-salve" ? "Apply"
        : entry.id === "picietl" ? "Chew"
        : entry.id === "chili-smoke" ? "Crack open"
        : entry.id === "ocote" ? "Light"
        : entry.id === "clean-water" || entry.id === "cacao-drink" ? "Drink"
        : entry.id === "ixpatli" ? "Apply"
        : entry.id === "healing-potion" ? "Use medicine"
        : entry.id === "crowbar" ? "Pry open"
          : entry.id === "hempen-rope" ? "Set rope" : item.slot ? "Use" : "Use item";
      const blocked = itemUseBlocked(entry);
      use.disabled = Boolean(blocked);
      if (blocked) use.title = blocked;
      actions.append(use);
    }
    if (item.slot) {
      const equip = document.createElement("button");
      equip.type = "button";
      equip.className = "inventory-equip";
      if (isEquipped(item.id) && item.slot !== "weapon") {
        equip.dataset.unequipItem = item.id;
        equip.textContent = item.slot === "wear" ? "Take off" : "Unequip";
      } else {
        equip.dataset.equipItem = item.id;
        equip.textContent = isEquipped(item.id) ? "In use" : item.slot === "wear" ? "Wear" : "Equip";
        equip.disabled = isEquipped(item.id) || !canEquipItem(item);
      }
      actions.append(equip);
    }
    const drop = document.createElement("button");
    drop.type = "button";
    drop.className = "inventory-equip inventory-drop";
    drop.dataset.dropItem = entry.id;
    drop.textContent = "Drop";
    const equippedCopy = isEquipped(entry.id) && entry.quantity <= 1;
    drop.disabled = equippedCopy || state.run.lost || state.run.won || !["dungeon", "city"].includes(state.run.location);
    drop.title = equippedCopy ? "Unequip it first" : state.run.location === "dungeon" ? "Leave it on the floor here" : "Throw it away";
    actions.append(drop);
    row.append(icon, copy);
    if (actions.childElementCount) row.append(actions);
    listElement.append(row);
  }
}

function updateListPager(key, total, pageSize) {
  const pager = document.querySelector(`[data-list-pager="${key}"]`);
  if (!pager) return;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  state.listPages[key] = Math.max(0, Math.min(state.listPages[key], pages - 1));
  pager.hidden = pages <= 1;
  pager.querySelector("[data-page-indicator]").textContent = `${state.listPages[key] + 1} / ${pages}`;
  pager.querySelector('[data-page-direction="-1"]').disabled = state.listPages[key] === 0;
  pager.querySelector('[data-page-direction="1"]').disabled = state.listPages[key] === pages - 1;
}

function setDialogCopy(id, text) {
  const sentences = text.match(/[^.!?。！？]+[.!?。！？]+(?:\u00a0»)?["“”’»」』)]*|[^.!?。！？]+$/g) || [text];
  const pages = [];
  let page = "";
  for (const sentence of sentences) {
    if (page && page.length + sentence.length > 260) {
      pages.push(page.trim());
      page = "";
    }
    page += sentence;
  }
  if (page) pages.push(page.trim());
  state.dialogCopies[id] = pages.length ? pages : [""];
  showDialogCopyPage(id, 0);
}

function showDialogCopyPage(id, pageIndex) {
  const pages = state.dialogCopies[id];
  if (!pages) return;
  const page = Math.max(0, Math.min(pageIndex, pages.length - 1));
  document.getElementById(id).textContent = pages[page];
  const pager = document.querySelector(`[data-copy-pager="${id}"]`);
  if (!pager) return;
  pager.hidden = pages.length < 2;
  pager.querySelector("[data-copy-page-number]").textContent = `${page + 1} / ${pages.length}`;
  pager.querySelector('[data-copy-page="-1"]').disabled = page === 0;
  pager.querySelector('[data-copy-page="1"]').disabled = page === pages.length - 1;
  pager.dataset.page = String(page);
}

function renderPagedStoreList(listElement, key, pageSize) {
  const rows = [...listElement.children];
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  state.listPages[key] = Math.max(0, Math.min(state.listPages[key], pages - 1));
  updateListPager(key, rows.length, pageSize);
  listElement.replaceChildren(...rows.slice(state.listPages[key] * pageSize, (state.listPages[key] + 1) * pageSize));
}

function renderInventory() {
  const inventory = [...state.run.inventory].sort((a, b) => itemDetails(a.id).name.localeCompare(itemDetails(b.id).name));
  const carried = getCarriedWeight();
  const capacity = getCarryCapacity(state.run.character);
  elements["inventory-load"].textContent = `Pack weight · ${formatWeight(carried)} / ${capacity} lb`;
  elements["inventory-load"].setAttribute("aria-label", `Pack weight ${formatWeight(carried)} of ${capacity} pounds`);
  const loot = expeditionLoot();
  const protectedGold = Math.max(0, state.run.gold - loot.gold);
  const unsecuredItems = loot.items
    .map((entry) => `${entry.quantity} ${itemDetails(entry.id).name}`)
    .join(", ");
  const securityCopy = loot.gold || unsecuredItems
    ? `Protected: ${formatCurrency(protectedGold)} · At risk: ${formatCurrency(loot.gold)}${unsecuredItems ? ` · ${unsecuredItems}` : ""}`
    : `Secured in Chiltomatlan: ${formatCurrency(protectedGold)} · No expedition loot at risk`;
  elements["inventory-security"].textContent = securityCopy;
  elements["inventory-security"].setAttribute("aria-label", securityCopy);
  renderInventoryList(elements["equipment-list"], inventory.filter((entry) => itemDetails(entry.id).slot));
  // The pack lists everything you carry that isn't being worn or wielded right now.
  const pack = inventory.filter((entry) => !isEquipped(entry.id) || entry.quantity > 1);
  const filtered = pack.filter((entry) => {
    const item = itemDetails(entry.id);
    if (state.inventoryFilter === "supplies") return ["Food", "Drink", "Potion", "Supply"].includes(item.categoryId);
    if (state.inventoryFilter === "gear") return ["Kit", "Tool", "Clothing", "Weapon", "Armor"].includes(item.categoryId);
    if (state.inventoryFilter === "valuables") return ["Treasure", "Keepsake"].includes(item.categoryId);
    return true;
  });
  for (const button of elements["inventory-filters"].querySelectorAll("[data-inventory-filter]")) {
    button.setAttribute("aria-pressed", String(button.dataset.inventoryFilter === state.inventoryFilter));
  }
  renderInventoryList(elements["inventory-list"], filtered);
  renderEquipmentSheet();
}

function inventoryIconFile(item) {
  if (item.sprite) return item.sprite;
  if (FOOD_ITEMS[item.id]) return FOOD_ITEMS[item.id].sprite;
  if (item.id === "clean-water") return "water";
  if (item.slot === "weapon") return "weapon";
  if (item.slot === "armor" || item.slot === "shield") return "armor";
  return ({
    Potion: "potion",
    Tool: "tool",
    Kit: "kit",
    Supply: "supply",
    Clothing: "clothing",
    Treasure: "treasure",
    Keepsake: "keepsake",
    Drink: "water"
  })[item.categoryId] || "supply";
}

function selectCharacterTab(tab) {
  const selected = ["equipment", "gear", "info", "abilities"].includes(tab) ? tab : "equipment";
  state.characterTab = selected;
  for (const name of ["equipment", "gear", "info", "abilities"]) {
    const button = document.querySelector(`[data-character-tab="${name}"]`);
    button.setAttribute("aria-selected", String(name === selected));
    button.tabIndex = name === selected ? 0 : -1;
    elements[`panel-${name}`].hidden = name !== selected;
  }
}

const SHOP_CATEGORY_NAMES = {
  supplies: "Supplies · food, water & trail gear",
  consumables: "Consumables · healing & usable items",
  equipment: "Equipment · weapons, armor & clothing",
  miscellaneous: "Miscellaneous · tools & keepsakes"
};

function storeCategoryForItem(item) {
  if (FOOD_ITEMS[item.id] || ["Food", "Drink"].includes(item.categoryId) || item.id === "clean-water" ||
    ["Supply", "Kit", "Tool"].includes(item.categoryId)) return "supplies";
  if (item.categoryId === "Potion") return "consumables";
  if (item.slot || ["Weapon", "Armor", "Clothing"].includes(item.categoryId)) return "equipment";
  return "miscellaneous";
}

function renderShop() {
  renderShopScreen();
}

function renderLegacyShop() {
  const carried = getCarriedWeight();
  const capacity = getCarryCapacity(state.run.character);
  const discount = traderDiscountRate();
  elements["store-carry-load"].textContent = `Purse: ${formatCurrency(state.run.gold)} · Pack: ${formatWeight(carried)} / ${capacity} lb · Coins weigh 1 lb per 50 gp.${discount ? ` Traders' Circle rate: ${Math.round(discount * 100)}% off.` : ""}`;
  const buying = elements["store-screen"].dataset.storeView !== "sell";
  document.querySelector(".store-categories").hidden = !buying;
  document.querySelectorAll("[data-store-category]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.storeCategory === state.storeCategory));
  });
  elements["store-buy-heading"].textContent = SHOP_CATEGORY_NAMES[state.storeCategory] || SHOP_CATEGORY_NAMES.supplies;
  elements["store-buy-list"].replaceChildren();
  elements["store-sell-list"].replaceChildren();
  for (const itemId of shopStock()) {
    const item = itemDetails(itemId);
    if (storeCategoryForItem(item) !== state.storeCategory) continue;
    const row = document.createElement("div");
    row.className = "store-row";
    const details = document.createElement("div");
    details.className = "store-item-copy";
    const name = document.createElement("strong");
    name.textContent = item.name;
    const note = document.createElement("span");
    const carriedQuantity = inventoryQuantity(itemId);
    const guideOwned = itemId === "dungeon-gourmet-guide" && state.run.gourmetGuideOwned;
    note.textContent = `${formatWeight(item.weight)} lb${carriedQuantity ? ` · In pack: ${carriedQuantity}` : ""}${guideOwned ? " · Learned for this expedition" : ""} · ${item.description || item.category}`;
    details.append(name, note);
    const buy = document.createElement("button");
    buy.type = "button";
    buy.className = "button secondary";
    buy.dataset.buyItem = item.id;
    const price = storeBuyPrice(item);
    buy.textContent = `Buy · ${formatCurrency(price)}`;
    buy.disabled = guideOwned || state.run.gold < price || carried - price / 50 + item.weight > capacity;
    buy.addEventListener("click", () => buyStoreItem(item.id));
    row.append(details, buy);
    elements["store-buy-list"].append(row);
  }
  const sellable = state.run.inventory.filter((entry) => entry.id !== "dungeon-gourmet-guide" &&
    entry.quantity > (isEquipped(entry.id) ? 1 : 0));
  if (!sellable.length) {
    const empty = document.createElement("p");
    empty.className = "inventory-empty";
    empty.textContent = "No unequipped items to sell.";
    elements["store-sell-list"].append(empty);
  }
  for (const entry of sellable) {
    const item = itemDetails(entry.id);
    const row = document.createElement("div");
    row.className = "store-row";
    const details = document.createElement("div");
    details.className = "store-item-copy";
    const name = document.createElement("strong");
    name.textContent = `${item.name}${entry.quantity > 1 ? ` ×${entry.quantity}` : ""}`;
    const note = document.createElement("span");
    note.textContent = `${formatWeight(item.weight)} lb each · sells for ${formatCurrency(storeSellPrice(item))}`;
    const sell = document.createElement("button");
    sell.type = "button";
    sell.className = "button secondary";
    sell.dataset.sellItem = item.id;
    sell.textContent = "Sell one";
    sell.addEventListener("click", () => sellStoreItem(item.id));
    details.append(name, note);
    row.append(details, sell);
    elements["store-sell-list"].append(row);
  }
  renderPagedStoreList(elements["store-buy-list"], "storeBuy", listPageSize("store"));
  renderPagedStoreList(elements["store-sell-list"], "storeSell", listPageSize("store"));
}

function renderLog() {
  elements["event-log"].replaceChildren();
  elements["compact-log"].replaceChildren();
  const recentActivity = state.run.log.slice(0, 2);
  for (const message of recentActivity) {
    const localized = t(message);
    const item = document.createElement("li");
    item.textContent = localized.length > 180 ? `${localized.slice(0, 177).trimEnd()}...` : localized;
    item.title = localized;
    item.className = classifyLogMessage(message);
    elements["compact-log"].append(item);
  }
  for (const message of [...state.run.log].reverse()) {
    const item = document.createElement("li");
    item.textContent = t(message);
    item.className = classifyLogMessage(message);
    elements["event-log"].append(item);
  }
}

function classifyLogMessage(message) {
  if (/\b(hit|strike|attack|miss|damage|defeat|falls|knocked out|critical)\b/i.test(message)) return "log-combat";
  if (/\b(gold|treasure|cache|loot|collect|claim|secure|sell|buy|purchase)\b/i.test(message)) return "log-loot";
  if (/\b(food|water|thirst|hunger|heal|hit points|recover|potion|spell|condition)\b/i.test(message)) return "log-status";
  return "log-exploration";
}

function renderExpeditionKit() {
  const resources = [
    { id: "food-rations", icon: "ration", label: "Tamales", count: Object.keys(FOOD_ITEMS).reduce((sum, id) => sum + inventoryQuantity(id), 0), always: true },
    { id: "clean-water", icon: "water", label: "Water", count: inventoryQuantity("clean-water"), always: true },
    { id: "healing-potion", icon: "potion", label: "Medicine", count: inventoryQuantity("healing-potion"), always: true },
    { id: "wild-ingredients", icon: "chilis", label: "Foraged food", count: inventoryQuantity("wild-ingredients"), always: true },
    { id: "crowbar", icon: "tool", label: "Pry bar", count: inventoryQuantity("crowbar") },
    { id: "hempen-rope", icon: "supply", label: "Maguey cord", count: inventoryQuantity("hempen-rope") }
  ];
  const strip = elements["header-expedition-kit"];
  const available = resources.filter((resource) => resource.count > 0 || resource.always);
  strip.replaceChildren();
  for (const resource of available) {
    const badge = document.createElement("span");
    badge.className = "kit-resource";
    badge.title = `${resource.label}: ${resource.count} carried`;
    badge.setAttribute("aria-label", `${resource.label}: ${resource.count} carried`);
    const icon = createResourceSprite("items", `${resource.icon}.png`, "kit-resource-icon");
    const count = document.createElement("strong");
    count.textContent = String(resource.count);
    badge.append(icon, count);
    strip.append(badge);
  }
  strip.classList.toggle("hidden", available.length === 0);
  strip.setAttribute("aria-label", available.length
    ? `Carried field resources: ${available.map((resource) => `${resource.label}, ${resource.count}`).join("; ")}`
    : "No carried field resources");
}

function renderStartScreen() {
  const hasSave = Boolean(state.run);
  document.body.classList.toggle("dungeon-game", Boolean(state.gameStarted && state.run?.location === "dungeon"));
  elements["continue-game"].disabled = !hasSave;
  elements["continue-hint"].textContent = hasSave
    ? t("Saved game · {name} · Level {level} · {location}", {
      name: state.run.character.name,
      level: state.run.level,
      location: t(state.run.location === "city" ? "Chiltomatlan" : state.run.location === "store" ? "Chiltomatlan market" : "Expedition")
    })
    : t("No saved game on this device.");
  elements["start-screen"].classList.toggle("hidden", state.gameStarted);
  elements["game-layout"].classList.toggle("hidden", !state.gameStarted);
  elements["character-button"].classList.toggle("hidden", !state.gameStarted);
  elements["header-resources"].classList.toggle("hidden", !state.gameStarted);
  elements["party-toggle"].classList.toggle("hidden", !state.gameStarted || state.run?.location === "store");
  elements["journal-toggle"].classList.toggle("hidden", !state.gameStarted || state.run?.location === "store");
  elements["log-toggle"].classList.toggle("hidden", !state.gameStarted || state.run?.location === "store");
  document.body.classList.toggle("immersive-game", Boolean(state.gameStarted));
  if (!state.gameStarted) state.utilityDrawer = null;
  renderUtilityDrawer();
}

function render() {
  if (!state.run) return;
  renderPurses();
  document.body.classList.toggle("immersive-game", Boolean(state.gameStarted));
  document.body.classList.toggle("dungeon-game", state.gameStarted && state.run.location === "dungeon");
  const clockHour = Math.floor((state.run.gameMinutes ?? state.run.gameHours * 60) / 60) % 24;
  document.body.classList.toggle("nighttime", state.gameStarted &&
    ["city", "store"].includes(state.run.location) && (clockHour < 6 || clockHour >= 18));
  renderStartScreen();
  if (state.gameStarted && characterAsiLevels().has(state.run.level) &&
    !state.run.asiLevelsChosen.includes(state.run.level)) openLevelUpChoice();
  const inCity = state.run.location === "city";
  const inStore = state.run.location === "store";
  elements["game-layout"].classList.toggle("dungeon-active", state.gameStarted && state.run.location === "dungeon");
  elements["party-toggle"].classList.toggle("hidden", inStore || !state.gameStarted);
  elements["journal-toggle"].classList.toggle("hidden", inStore || !state.gameStarted);
  elements["log-toggle"].classList.toggle("hidden", inStore || !state.gameStarted);
  if (state.run.location !== "dungeon") {
    state.lookMode = false;
    state.lookTarget = null;
  }
  if (inStore) state.utilityDrawer = null;
  renderUtilityDrawer();
  elements["city-screen"].classList.toggle("hidden", !inCity);
  elements["store-screen"].classList.toggle("hidden", !inStore);
  elements["dungeon-screen"].classList.toggle("hidden", inCity || inStore);
  elements["map-heading"].textContent = t(inCity ? "Chiltomatlan" : getRoom().name);
  const templeDelve = state.run.mapId === GTFL_MAP_ID;
  elements["town-story"].textContent = "Chiltomatlan is your home base. Rest, trade, explore the tomb, and decide for yourself how far to go.";
  elements["quest-title"].textContent = templeDelve ? "Open Expedition" : "Your Expedition";
  elements["delve-objectives"].textContent = templeDelve
    ? `Floor ${state.run.dungeonFloor} of ${DUNGEON_FLOOR_COUNT} · ${
      state.run.dungeonFloor === DUNGEON_FLOOR_COUNT
        ? (state.run.questComplete ? "Tzitzimitl defeated" : "Defeat Tzitzimitl")
        : `Treasure ${state.run.mainTreasureClaimed ? "recovered" : "to find"}`
    } · Return to Chiltomatlan whenever you choose`
    : "Explore the tomb, collect treasure, and find your way back.";
  if (inStore) renderShop();
  renderMap();
  renderRoom();
  renderCharacter();
  renderPartyStatus();
  renderFactions();
  renderProgressJournal();
  renderLog();
  saveRun();
  if (state.run.lost && state.gameStarted) {
    elements["game-over-heading"].textContent = `${state.run.character.name}'s light goes out`;
    const loot = expeditionLoot();
    const itemLoss = loot.items.map((item) => `${item.quantity} ${itemDetails(item.id).name}`).join(", ");
    const lostValue = [loot.gold ? formatCurrency(loot.gold) : "", itemLoss].filter(Boolean).join(" and ");
    setDialogCopy("game-over-copy", `Your expedition ends in ${getRoom().name}. The crew of Chiltomatlan can bring you back to safety. ${lostValue
      ? `You will lose ${lostValue} found on this delve; your earlier belongings, secured gold, character, and experience remain.`
      : "No unsecured treasure will be lost; your earlier belongings, character, and experience remain."}`);
    elements["game-over-portrait"].replaceChildren(createCodexCharacterSprite(state.run.character, "game-over-sprite"));
    if (!elements["game-over-dialog"].open) elements["game-over-dialog"].showModal();
  } else if (elements["game-over-dialog"].open) {
    elements["game-over-dialog"].close();
  }

}

function renderUtilityDrawer() {
  const mode = state.utilityDrawer;
  const isOpen = mode === "party" || mode === "journal" || mode === "log";
  const inCity = state.run?.location === "city";
  elements["side-drawer"].classList.toggle("drawer-open", isOpen);
  elements["side-drawer"].classList.remove("is-persistent");
  elements["side-drawer"].setAttribute("aria-hidden", String(!isOpen));
  elements["side-drawer"].inert = !isOpen;
  elements["party-toggle"].setAttribute("aria-expanded", String(mode === "party"));
  elements["journal-toggle"].setAttribute("aria-expanded", String(mode === "journal"));
  elements["log-toggle"].setAttribute("aria-expanded", String(mode === "log"));
  elements["town-party-panel"].hidden = !isOpen || mode !== "party" || !inCity;
  elements["dungeon-party-panel"].hidden = !isOpen || mode !== "party" || inCity;
  elements["dungeon-context-rail"].hidden = state.run?.location !== "dungeon";
  elements["journal-panel"].hidden = !isOpen || mode !== "journal";
  elements["log-drawer-panel"].hidden = !isOpen || mode !== "log";
  elements["side-drawer-title"].textContent = mode === "journal" ? "Journal" : mode === "log" ? "Log" : "Party";
}

function openCharacterCard() {
  if (!elements["character-card-dialog"].open) elements["character-card-dialog"].showModal();
  elements["character-button"].setAttribute("aria-expanded", "true");
}

function closeCharacterCard() {
  if (elements["character-card-dialog"].open) elements["character-card-dialog"].close();
  elements["character-button"].setAttribute("aria-expanded", "false");
}

function toggleUtilityDrawer(mode) {
  stopHeldMovement();
  state.lookMode = false;
  state.lookTarget = null;
  renderLookInspector();
  state.utilityDrawer = state.utilityDrawer === mode ? null : mode;
  renderMap();
  renderUtilityDrawer();
  if (state.utilityDrawer) elements["close-side-drawer"].focus();
}

function closeUtilityDrawer(restoreFocus = false) {
  const previousMode = state.utilityDrawer;
  state.utilityDrawer = null;
  renderUtilityDrawer();
  if (restoreFocus) {
    elements[previousMode === "log" ? "log-toggle" : "journal-toggle"].focus();
  }
}

function validateSavedCharacter(character) {
  if (!character || typeof character.name !== "string" || character.name.trim().length < 1 || character.name.length > 24 ||
    !GENDERS.includes(character.gender) ||
    !RACES[character.race] || !CLASSES[character.class] || !BACKGROUNDS[character.background] ||
    !["standard", "point-buy", "rolled"].includes(character.scoreMethod) ||
    !character.baseScores || !character.scores || !character.appearance || !character.equipment) return false;
  if (RACES[character.race].heritages && !RACES[character.race].heritages[character.heritage]) return false;
  const minimumBase = character.scoreMethod === "rolled" ? 3 : 8;
  const maximumBase = character.scoreMethod === "rolled" ? 18 : 15;
  if (!ABILITIES.every(([key]) => Number.isInteger(character.baseScores[key]) && character.baseScores[key] >= minimumBase && character.baseScores[key] <= maximumBase &&
    Number.isInteger(character.scores[key]) && character.scores[key] >= 3 && character.scores[key] <= 20)) return false;
  const baseValues = ABILITIES.map(([key]) => character.baseScores[key]);
  if (!character.legacy && character.scoreMethod === "point-buy" &&
    baseValues.reduce((total, score) => total + POINT_BUY_COST[score], 0) !== 27) return false;
  const look = character.appearance;
  if (!raceSkinTones(character.race).some((tone) => tone.value === look.skin) ||
    !raceHairColors(character.race).some((color) => color.value === look.hair) || !TUNIC_COLORS.includes(look.tunic) ||
    !HAIR_STYLES.includes(look.hairStyle) || !TRIM_COLORS.some((color) => color.value === look.trim) ||
    !BODY_TYPES.includes(look.body) || !BEARD_STYLES.includes(look.beard) || !JEWELRY_STYLES.includes(look.jewelry) ||
    !(CREST_STYLES[character.race] || ["none"]).includes(look.crest) ||
    !GARMENT_STYLES.includes(character.appearance.garment) ||
    !CLOTHING_ADORNMENTS.includes(character.appearance.adornment) ||
    !HEADWEAR_STYLES.includes(character.appearance.headwear) ||
    !FACE_PAINT_STYLES.includes(character.appearance.facePaint)) return false;
  const equipment = character.equipment;
  if (!WEAPONS[equipment.weapon] || !ARMORS[equipment.armor] ||
    !CLASSES[character.class].weapons.includes(gearBase(equipment.weapon)) ||
    !CLASSES[character.class].armor.includes(gearBase(equipment.armor)) ||
    typeof equipment.shield !== "boolean" || (equipment.shield && !CLASSES[character.class].shield) ||
    typeof equipment.cloak !== "boolean") return false;
  if (ARMORS[equipment.armor].strength && character.scores.str < ARMORS[equipment.armor].strength) return false;
  if (character.scoreMethod === "rolled" && (!Array.isArray(character.rolledScores) ||
    character.rolledScores.length !== 6 || character.rolledScores.some((score) => !Number.isInteger(score) || score < 3 || score > 18))) return false;
  const enhancements = character.equipmentEnhancements;
  if (!enhancements || !Array.isArray(enhancements.weaponIds) || !Array.isArray(enhancements.armorIds) ||
    new Set(enhancements.weaponIds).size !== enhancements.weaponIds.length ||
    enhancements.weaponIds.some((id) => !WEAPONS[id]) ||
    new Set(enhancements.armorIds).size !== enhancements.armorIds.length ||
    enhancements.armorIds.some((id) => !ARMORS[id] || id === "none")) return false;
  const cosmetics = character.cosmetics;
  if (!cosmetics || !Array.isArray(cosmetics.owned) ||
    new Set(cosmetics.owned).size !== cosmetics.owned.length ||
    cosmetics.owned.some((id) => !COSMETICS[id]) ||
    WEAR_SLOTS.some((slot) => (cosmetics[slot] ?? null) !== null &&
      (!COSMETICS[cosmetics[slot]] || COSMETICS[cosmetics[slot]].slot !== slot))) return false;
  if (!character.legacy) {
    const selectedClass = CLASSES[character.class];
    const backgroundSkills = new Set(BACKGROUNDS[character.background].skillIds);
    if (!Array.isArray(character.classSkills) || character.classSkills.length !== selectedClass.skillCount ||
      new Set(character.classSkills).size !== character.classSkills.length ||
      character.classSkills.some((skill) => !selectedClass.skills.includes(skill) || backgroundSkills.has(skill))) return false;
  }
  if (character.race === "half-elf" && (!Array.isArray(character.flexibleBonuses) ||
    character.flexibleBonuses.length !== 2 || character.flexibleBonuses[0] === character.flexibleBonuses[1] ||
    character.flexibleBonuses.some((key) => !ABILITIES.some(([ability]) => ability === key) || key === "cha"))) return false;
  return true;
}

function validPatolliGame(game) {
  if (!game || game.trackVersion !== PATOLLI_TRACK_VERSION || !Number.isInteger(game.stakePerPiece) ||
    game.stakePerPiece < 1 || game.stakePerPiece > MAX_GOLD ||
    !game.pieces || !["player", "opponent"].every((side) => Array.isArray(game.pieces[side]) &&
      game.pieces[side].length === 6 && game.pieces[side].every((piece, id) =>
        piece?.id === id && Number.isInteger(piece.progress) && piece.progress >= -1 &&
        piece.progress <= PATOLLI_TRACK.length &&
        ["ready", "active", "finished", "captured", "settled"].includes(piece.status) &&
        (piece.status !== "ready" || piece.progress === -1) &&
        (piece.status !== "active" || (piece.progress >= 0 && piece.progress < PATOLLI_TRACK.length)) &&
        (piece.status !== "finished" || piece.progress === PATOLLI_TRACK.length))) ||
    !Array.isArray(game.stakes) || game.stakes.length !== 6 ||
    game.stakes.some((stake) => !stake ||
      !["active", "resolved"].includes(stake.status) ||
      ![null, "player", "opponent"].includes(stake.winner) ||
      (stake.status === "active" && stake.winner !== null) ||
      (stake.status === "resolved" && !["player", "opponent"].includes(stake.winner)) ||
      !Number.isInteger(stake.playerStake) || stake.playerStake < 0 || stake.playerStake > game.stakePerPiece ||
      !Number.isInteger(stake.opponentStake) || stake.opponentStake < 0 || stake.opponentStake > game.stakePerPiece) ||
    !game.score || !Number.isInteger(game.score.player) || game.score.player < 0 || game.score.player > 6 ||
    !Number.isInteger(game.score.opponent) || game.score.opponent < 0 || game.score.opponent > 6 ||
    !game.captures || !Number.isInteger(game.captures.player) || game.captures.player < 0 || game.captures.player > 6 ||
    !Number.isInteger(game.captures.opponent) || game.captures.opponent < 0 || game.captures.opponent > 6 ||
    game.score.player !== game.stakes.filter((stake) => stake.status === "resolved" && stake.winner === "player").length ||
    game.score.opponent !== game.stakes.filter((stake) => stake.status === "resolved" && stake.winner === "opponent").length ||
    !["player", "opponent"].includes(game.turn) || !["roll", "move", "finished"].includes(game.phase) ||
    !["active", "won", "lost", "draw", "forfeit"].includes(game.status) ||
    typeof game.settled !== "boolean" || game.settled !== (game.status !== "active") ||
    (game.status === "active" && (game.turn !== "player" || game.phase === "finished")) ||
    (game.status !== "active" && game.phase !== "finished") ||
    !Array.isArray(game.legalMoves) || game.legalMoves.length > 30 ||
    ![null, 0, 1, 2, 3, 4, 5].includes(game.selectedPiece) ||
    !Number.isInteger(game.pot) || game.pot < 0 || game.pot > game.stakePerPiece * 12 ||
    !Number.isInteger(game.playerPotContribution) || game.playerPotContribution < 0 ||
    game.playerPotContribution > game.pot ||
    !Number.isInteger(game.payout) || game.payout < 0 || game.payout > game.stakePerPiece * 12 ||
    typeof game.message !== "string" || game.message.length > 500 ||
    (game.difficulty !== undefined && !["sharp", "gentle"].includes(game.difficulty))) return false;
  const stakesTotal = game.stakes.reduce((sum, stake) => sum + stake.playerStake + stake.opponentStake, 0);
  if (stakesTotal + game.pot !== game.stakePerPiece * 12) return false;
  if (game.lastToss !== null && (!game.lastToss || !["player", "opponent"].includes(game.lastToss.side) ||
    !Array.isArray(game.lastToss.beans) || game.lastToss.beans.length !== 5 ||
    game.lastToss.beans.some((bean) => typeof bean !== "boolean") ||
    game.lastToss.count !== game.lastToss.beans.filter(Boolean).length)) return false;
  if (game.phase === "move") {
    if (game.turn !== "player" || game.lastToss?.side !== "player" || !game.legalMoves.length ||
      game.legalMoves.some((move) => !Number.isInteger(move.pieceId) || move.pieceId < 0 || move.pieceId > 5 ||
        !Number.isInteger(move.progress) || move.progress < 0 || move.progress > PATOLLI_TRACK.length ||
        !Number.isInteger(move.trackIndex) || move.trackIndex < -1 || move.trackIndex >= PATOLLI_TRACK.length ||
        typeof move.finish !== "boolean" || ![null, 0, 1, 2, 3, 4, 5].includes(move.captureId))) return false;
    const expected = getPatolliLegalMoves(game, "player", game.lastToss.count);
    if (JSON.stringify(expected) !== JSON.stringify(game.legalMoves)) return false;
    if (game.selectedPiece !== null && !game.legalMoves.some((move) => move.pieceId === game.selectedPiece)) return false;
  } else if (game.legalMoves.length || game.selectedPiece !== null) {
    return false;
  }
  return true;
}

const RENAMED_ITEM_IDS = {
  "signet-ring": "gold-ring",
  "carved-idol": "terracotta-figurine",
  "jungle-fruit": "chilis",
  "herbal-broth": "soup",
  "jade-sun-disc": "jade-pectoral",
  "feathered-censer": "incensario",
  Incensor: "incensario",
  // Clothing from before outfits were worn items: now real wearables.
  "common-clothes": "wear:garment-cotton-wrap",
  "travel-clothes": "wear:garment-cotton-wrap",
  "fine-clothes": "wear:cotton-finery",
  "dark-clothes": "wear:dusk-wrap"
};
const RENAMED_ENEMY_IDS = {
  "maztican-orc": "caxtiltecatl",
  caxtilteca: "caxtiltecatl",
  yallagog: "quinametli",
  werepiranha: "axolocatl",
  "obsidian-warden": "camazotz",
  camazots: "camazotz",
  "jade-mask-sentinel": "yohualtepoztli"
};
const RENAMED_ENEMY_SPRITES = {
  "maztican-orc": "caxtiltecatl",
  "jungle-creature": "duende",
  yallagog: "quinametli",
  werepiranha: "axolocatl",
  "obsidian-warden": "camazotz",
  camazots: "camazotz",
  "jade-mask-sentinel": "yohualtepoztli"
};

function migrateSavedItemIds(entries) {
  if (!Array.isArray(entries)) return;
  for (const entry of entries) {
    if (entry && Object.prototype.hasOwnProperty.call(RENAMED_ITEM_IDS, entry.id)) {
      entry.id = RENAMED_ITEM_IDS[entry.id];
    }
  }
  const mergedEntries = new Map();
  const migratedEntries = [];
  for (const entry of entries) {
    if (!entry || typeof entry.id !== "string" ||
      !Number.isInteger(entry.quantity) || entry.quantity < 1 || entry.quantity > 1000) {
      migratedEntries.push(entry);
      continue;
    }
    if (!mergedEntries.has(entry.id)) {
      mergedEntries.set(entry.id, entry);
      migratedEntries.push(entry);
      continue;
    }
    const existing = mergedEntries.get(entry.id);
    existing.quantity += entry.quantity;
    if (existing.uses !== undefined || entry.uses !== undefined) {
      existing.uses = (existing.uses || 0) + (entry.uses || 0);
    }
  }
  entries.splice(0, entries.length, ...migratedEntries);
}

function migrateSavedCatalogIds(saved, pack) {
  migrateSavedItemIds(saved.inventory);
  migrateSavedItemIds(saved.house?.storage);
  migrateSavedItemIds(saved.unsecuredLoot?.items);
  if (Array.isArray(saved.treasures)) {
    for (const treasure of saved.treasures) migrateSavedItemIds(treasure?.items);
  }
  if (Array.isArray(saved.rooms)) for (const room of saved.rooms) {
    migrateSavedItemIds(room?.unclaimedReward?.items);
    migrateSavedItemIds(room?.reward?.items);
  }
  if (Array.isArray(saved.enemies)) for (const enemy of saved.enemies) {
    if (!enemy) continue;
    const renamedTemplateId = Object.prototype.hasOwnProperty.call(RENAMED_ENEMY_IDS, enemy.templateId)
      ? RENAMED_ENEMY_IDS[enemy.templateId]
      : null;
    if (renamedTemplateId) {
      const templateId = renamedTemplateId;
      enemy.templateId = templateId;
      const template = pack.enemies.find((candidate) => candidate.id === templateId);
      if (template) {
        enemy.name = template.name;
        enemy.sprite = template.sprite;
      }
    } else if (Object.prototype.hasOwnProperty.call(RENAMED_ENEMY_SPRITES, enemy.sprite)) {
      enemy.sprite = RENAMED_ENEMY_SPRITES[enemy.sprite];
    }
  }
}

function parseSavedRun(saved, pack) {
  if (!saved || typeof saved !== "object") return null;
  migrateSavedCatalogIds(saved, pack);
  if (saved && Array.isArray(saved.terrain) &&
    saved.terrain.length === LEGACY_MAP_TILE_SIZE * LEGACY_MAP_TILE_SIZE &&
    Array.isArray(saved.seen) && saved.seen.length === saved.terrain.length) {
    const migratedTerrain = Array(MAP_TILE_SIZE * MAP_TILE_SIZE).fill("stone");
    const migratedSeen = Array(MAP_TILE_SIZE * MAP_TILE_SIZE).fill(false);
    for (let y = 0; y < LEGACY_MAP_TILE_SIZE; y += 1) {
      for (let x = 0; x < LEGACY_MAP_TILE_SIZE; x += 1) {
        const oldIndex = y * LEGACY_MAP_TILE_SIZE + x;
        const newIndex = tileIndex(x + PROCEDURAL_MAP_OFFSET, y + PROCEDURAL_MAP_OFFSET);
        migratedTerrain[newIndex] = saved.terrain[oldIndex];
        migratedSeen[newIndex] = saved.seen[oldIndex];
      }
    }
    saved.terrain = migratedTerrain;
    saved.seen = migratedSeen;
    for (const room of saved.rooms || []) {
      if (Number.isInteger(room.mapX)) room.mapX += PROCEDURAL_MAP_OFFSET;
      if (Number.isInteger(room.mapY)) room.mapY += PROCEDURAL_MAP_OFFSET;
    }
    for (const actor of [
      saved.player,
      ...(saved.party || []),
      ...(saved.enemies || []),
      ...(saved.treasures || []),
      ...(saved.wells || []),
      ...(saved.hazards || [])
    ]) {
      if (Number.isInteger(actor?.x)) actor.x += PROCEDURAL_MAP_OFFSET;
      if (Number.isInteger(actor?.y)) actor.y += PROCEDURAL_MAP_OFFSET;
    }
  }
  if (saved && saved.location === undefined) {
    saved.location = "city";
    saved.hasEnteredDungeon = true;
  }
  if (!saved || !["city", "store", "dungeon"].includes(saved.location)) return null;
  const migrateDoorState = saved.openDoors === undefined;
  if (migrateDoorState) saved.openDoors = [];
  if (!Array.isArray(saved.openDoors) || saved.openDoors.length > MAP_TILE_SIZE * MAP_TILE_SIZE ||
    saved.openDoors.some((index) => !Number.isInteger(index))) return null;
  if (saved.townPosition === undefined) saved.townPosition = { ...TOWN_PLAZA };
  if (Number.isInteger(saved.townPosition?.x) && Number.isInteger(saved.townPosition?.y) &&
    townNpcAt(saved.townPosition.x, saved.townPosition.y)) saved.townPosition = { ...TOWN_PLAZA };
  saved.progress = normalizeProgress(saved.progress, pack);
  saved.house = normalizeHouse(saved.house);
  if (!Number.isInteger(saved.townPosition?.x) || !Number.isInteger(saved.townPosition?.y) ||
    !townCanOccupy(saved.townPosition.x, saved.townPosition.y, saved.progress.town)) saved.townPosition = { ...TOWN_PLAZA };
  saved.townMapVersion = TOWN_MAP_VERSION;
  if (saved.hasEnteredDungeon === undefined) saved.hasEnteredDungeon = true;
  if (typeof saved.hasEnteredDungeon !== "boolean") return null;
  if (saved.unsecuredLoot === undefined) saved.unsecuredLoot = { gold: 0, items: [] };
  if (!saved.unsecuredLoot || typeof saved.unsecuredLoot !== "object" || Array.isArray(saved.unsecuredLoot) ||
    !Number.isFinite(saved.unsecuredLoot.gold) || saved.unsecuredLoot.gold < 0 ||
    !Array.isArray(saved.unsecuredLoot.items) || saved.unsecuredLoot.items.length > 100 ||
    saved.unsecuredLoot.items.some((item) => !item || typeof item.id !== "string" || !itemDetails(item.id) ||
      !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000) ||
    new Set(saved.unsecuredLoot.items.map((item) => item.id)).size !== saved.unsecuredLoot.items.length) return null;
  if (saved.dodging === undefined) saved.dodging = false;
  if (typeof saved.dodging !== "boolean") return null;
  if (saved.needs === undefined) saved.needs = createNeeds();
  if (!saved.needs || typeof saved.needs !== "object") return null;
  if (saved.party === undefined) saved.party = [];
  if (saved.treasures === undefined) saved.treasures = [];
  if (saved.wells === undefined) saved.wells = [];
  if (saved.wellsInitialized === undefined) saved.wellsInitialized = saved.wells.length > 0;
  if (saved.mainTreasureClaimed === undefined) saved.mainTreasureClaimed = false;
  if (saved.questComplete === undefined) saved.questComplete = false;
  if (saved.mapId === undefined) saved.mapId = null;
  if (saved.dungeonFloor === undefined) saved.dungeonFloor = 1;
  if (!Number.isInteger(saved.dungeonFloor) || saved.dungeonFloor < 1 ||
    saved.dungeonFloor > DUNGEON_FLOOR_COUNT ||
    (saved.dungeonFloor > 1 && saved.mapId !== GTFL_MAP_ID)) return null;
  if (saved.dungeonLayoutVersion === undefined) saved.dungeonLayoutVersion = 1;
  if (![1, 2, 3].includes(saved.dungeonLayoutVersion) ||
    (saved.dungeonLayoutVersion >= 2 && saved.mapId !== GTFL_MAP_ID)) return null;
  if (saved.dungeonFloors === undefined) saved.dungeonFloors = {};
  normalizeVillageSave(saved);
  // A camp is optional; anything malformed is simply dropped.
  if (saved.camp !== undefined && saved.camp !== null) {
    const camp = saved.camp;
    if (typeof camp !== "object" || !Number.isInteger(camp.floor) || camp.floor < 1 || camp.floor > DUNGEON_FLOOR_COUNT ||
      !Number.isInteger(camp.x) || !Number.isInteger(camp.y) || camp.x < 0 || camp.y < 0 ||
      camp.x >= MAP_TILE_SIZE || camp.y >= MAP_TILE_SIZE || typeof camp.signature !== "string") saved.camp = null;
    else saved.camp = { floor: camp.floor, x: camp.x, y: camp.y, kit: Boolean(camp.kit), signature: camp.signature, made: Number(camp.made) || 0 };
  } else saved.camp = null;
  if (!saved.dungeonFloors || typeof saved.dungeonFloors !== "object" ||
    Array.isArray(saved.dungeonFloors) || Object.keys(saved.dungeonFloors).length > DUNGEON_FLOOR_COUNT - 1) return null;
  if (saved.floorStairs === undefined) saved.floorStairs = [];
  if (!Array.isArray(saved.floorStairs) || saved.floorStairs.length > 7) return null;
  if (saved.gameHours === undefined) saved.gameHours = 8;
  if (!Number.isInteger(saved.gameHours) || saved.gameHours < 0 || saved.gameHours > 1_000_000) return null;
  if (saved.gameMinutes === undefined) saved.gameMinutes = saved.gameHours * 60;
  if (!Number.isInteger(saved.gameMinutes) || saved.gameMinutes < 0 || saved.gameMinutes > 60_000_000) return null;
  saved.gameHours = Math.floor(saved.gameMinutes / 60);
  if (saved.gatheringWaterRemainder === undefined) saved.gatheringWaterRemainder = 0;
  if (!Number.isInteger(saved.gatheringWaterRemainder) || saved.gatheringWaterRemainder < 0 ||
    saved.gatheringWaterRemainder > 2) return null;
  if (saved.gourmetGuideOwned === undefined) saved.gourmetGuideOwned = false;
  if (typeof saved.gourmetGuideOwned !== "boolean") return null;
  if (saved.patolliGame === undefined) saved.patolliGame = null;
  if (saved.patolliGame !== null && (!saved.patolliGame || typeof saved.patolliGame !== "object" ||
    Array.isArray(saved.patolliGame))) return null;
  if (saved.patolliGame && saved.patolliGame.trackVersion !== PATOLLI_TRACK_VERSION) {
    const previousGame = saved.patolliGame;
    if (previousGame.status === "active" && Number.isInteger(previousGame.stakePerPiece) &&
      previousGame.stakePerPiece > 0 && Array.isArray(previousGame.stakes) &&
      Number.isFinite(saved.gold)) {
      const refundable = previousGame.stakes.reduce((total, stake) => {
        if (!stake || !Number.isInteger(stake.playerStake) || !Number.isInteger(stake.opponentStake)) return total;
        if (stake.status === "active") return total + stake.playerStake;
        return total + (stake.winner === "player" ? stake.playerStake + stake.opponentStake : 0);
      }, 0) + (Number.isInteger(previousGame.playerPotContribution) ? previousGame.playerPotContribution : 0);
      saved.gold = Math.min(MAX_GOLD, saved.gold + refundable);
    } else if (previousGame.status === "active" && Number.isInteger(previousGame.wager) &&
      previousGame.wager > 0 && Number.isFinite(saved.gold)) {
      saved.gold = Math.min(MAX_GOLD, saved.gold + previousGame.wager);
    }
    saved.patolliGame = null;
  }
  const patolli = saved.patolliGame;
  if (patolli && !patolli.captures) patolli.captures = { player: 0, opponent: 0 };
  if (patolli !== null && (!validPatolliGame(patolli) ||
    (patolli.status === "active" && saved.gold + patolli.stakePerPiece * 12 > MAX_GOLD))) return null;
  if (saved.factions === undefined) saved.factions = createFactionState();
  const factionState = saved.factions;
  const factionIds = Object.keys(FACTIONS);
  if (!factionState || typeof factionState !== "object" || Array.isArray(factionState) ||
    !factionState.standing || typeof factionState.standing !== "object" || Array.isArray(factionState.standing) ||
    Object.keys(factionState.standing).length !== factionIds.length ||
    factionIds.some((id) => !Number.isInteger(factionState.standing[id]) ||
      factionState.standing[id] < -100 || factionState.standing[id] > 100) ||
    !Array.isArray(factionState.members) || factionState.members.length > factionIds.length ||
    new Set(factionState.members).size !== factionState.members.length ||
    factionState.members.some((id) => !factionIds.includes(id)) ||
    !Array.isArray(factionState.milestones) || factionState.milestones.length > FACTION_MILESTONES.length ||
    new Set(factionState.milestones).size !== factionState.milestones.length ||
    factionState.milestones.some((milestone) => !FACTION_MILESTONES.includes(milestone)) ||
    !Number.isInteger(factionState.lastHouseProvisionDay) ||
    factionState.lastHouseProvisionDay < -1 || factionState.lastHouseProvisionDay > 1_000_000) return null;
  if (typeof saved.mainTreasureClaimed !== "boolean" || typeof saved.questComplete !== "boolean" ||
    typeof saved.wellsInitialized !== "boolean" || ![null, GTFL_MAP_ID].includes(saved.mapId)) return null;
  upgradeNeeds(saved.needs);
  if (saved.asiLevelsChosen === undefined) saved.asiLevelsChosen = [];
  const validNeeds = (needs) => needs &&
    Number.isInteger(needs.food) && needs.food >= 0 && needs.food <= 100 &&
    Number.isInteger(needs.water) && needs.water >= 0 && needs.water <= 100 &&
    Number.isInteger(needs.waterZeroHours) && needs.waterZeroHours >= 0 && needs.waterZeroHours <= 100000 &&
    Number.isInteger(needs.nutritionHours) && needs.nutritionHours >= 0 && needs.nutritionHours < NUTRIENT_DECAY_HOURS &&
    needs.nutrition && Object.keys(NUTRIENT_NAMES).every((nutrient) =>
      Number.isInteger(needs.nutrition[nutrient]) && needs.nutrition[nutrient] >= 0 && needs.nutrition[nutrient] <= 100) &&
    Number.isInteger(needs.hoursAwake) && needs.hoursAwake >= 0 && needs.hoursAwake <= 100000;
  if (!validNeeds(saved.needs) || !Array.isArray(saved.party) || saved.party.length > 3 ||
    !Array.isArray(saved.asiLevelsChosen) || new Set(saved.asiLevelsChosen).size !== saved.asiLevelsChosen.length ||
    saved.asiLevelsChosen.some((level) => !Number.isInteger(level) || level < 1 || level > saved.level)) return null;
  const fixedMap = saved.mapId === GTFL_MAP_ID;
  if (saved.fixedMapContentVersion === undefined) saved.fixedMapContentVersion = 0;
  if (!Number.isInteger(saved.fixedMapContentVersion) ||
    saved.fixedMapContentVersion < 0 || saved.fixedMapContentVersion > 2) return null;
  if (fixedMap && Array.isArray(saved.rooms) && saved.rooms.length === 4 &&
    saved.rooms.some((room) => room.type === "exit")) {
    saved.rooms = saved.rooms.filter((room) => room.type !== "exit");
    saved.rooms.forEach((room, index) => {
      room.links = index === 0 ? [1] : index === saved.rooms.length - 1 ? [index - 1] : [index - 1, index + 1];
    });
    const entrance = saved.rooms.find((room) => room.type === "entrance");
    if (!entrance) return null;
    entrance.anchorX = 5;
    entrance.anchorY = 0;
    entrance.mapX = 3;
    entrance.mapY = -2;
    saved.player = { x: 5, y: 0 };
    saved.currentRoom = 0;
    saved.won = false;
  }
  if (!saved || !Array.isArray(saved.rooms) ||
    (fixedMap
      ? (saved.dungeonLayoutVersion === 3
        ? saved.rooms.length < 11 || saved.rooms.length > 24
        : saved.dungeonLayoutVersion === 2
        ? saved.rooms.length < 17 || saved.rooms.length > 22
        : ![3, 6].includes(saved.rooms.length))
      : saved.rooms.length < 5 || saved.rooms.length > 8)) return null;
  const roomIds = new Set(pack.rooms.map((room) => room.id));
  const rooms = saved.rooms;
  if (rooms.some((room) => {
    if (!room || !roomIds.has(room.id) || !Number.isInteger(room.x) || !Number.isInteger(room.y) ||
      room.x < 0 || room.x >= ROOM_GRID_SIZE || room.y < 0 || room.y >= ROOM_GRID_SIZE || !Array.isArray(room.links)) return true;
      if (fixedMap && saved.dungeonLayoutVersion === 3) {
        if (room.mapLayout !== GTFL_MAP_ID || !Number.isInteger(room.anchorX) || !Number.isInteger(room.anchorY) ||
          !Number.isInteger(room.mapX) || !Number.isInteger(room.mapY) ||
          ![5, 7, 9, 11, 13].includes(room.mapW) || ![5, 7, 9, 11, 13].includes(room.mapH) ||
          room.mapX < 1 || room.mapY < 1 || room.mapX + room.mapW > MAP_TILE_SIZE - 1 || room.mapY + room.mapH > MAP_TILE_SIZE - 1 ||
          room.anchorX <= room.mapX || room.anchorX >= room.mapX + room.mapW - 1 ||
          room.anchorY <= room.mapY || room.anchorY >= room.mapY + room.mapH - 1 ||
          !["hall", "pillared", "cross", "round", "ell", "cell"].includes(room.shape) ||
          room.links.some((link) => !Number.isInteger(link) || link < 0 || link >= rooms.length)) return true;
      } else if (![3, 5, 7, 9].includes(room.mapW) || ![3, 5, 7, 9].includes(room.mapH)) {
        return true;
      } else if (fixedMap && saved.dungeonLayoutVersion === 2) {
        if (room.mapLayout !== GTFL_MAP_ID || !Number.isInteger(room.anchorX) || !Number.isInteger(room.anchorY) ||
          ![5, 7].includes(room.mapW) || ![5, 7].includes(room.mapH) ||
          room.anchorX !== 4 + room.x * 9 || room.anchorY !== 4 + room.y * 9 ||
          room.mapX !== room.anchorX - Math.floor(room.mapW / 2) ||
          room.mapY !== room.anchorY - Math.floor(room.mapH / 2)) return true;
      } else if (fixedMap) {
      const legacyFixedRoom = rooms.length === 3;
      const validSize = legacyFixedRoom
        ? room.mapW === 5 && room.mapH === 5
        : [7, 9].includes(room.mapW) && [7, 9].includes(room.mapH);
      if (room.mapLayout !== GTFL_MAP_ID || !Number.isInteger(room.anchorX) || !Number.isInteger(room.anchorY) ||
        !validSize || room.mapX !== room.anchorX - Math.floor(room.mapW / 2) ||
        room.mapY !== room.anchorY - Math.floor(room.mapH / 2)) return true;
    } else if (room.mapLayout !== undefined || room.anchorX !== undefined || room.anchorY !== undefined ||
      room.mapX !== PROCEDURAL_MAP_OFFSET + room.x * 7 + 3 - Math.floor(room.mapW / 2) ||
      room.mapY !== PROCEDURAL_MAP_OFFSET + room.y * 7 + 3 - Math.floor(room.mapH / 2)) return true;
    if (room.unclaimedReward !== undefined && !isValidReward(room.unclaimedReward)) return true;
    return false;
  })) return null;
  const entranceY = rooms?.length === 3 ? 0 : 5;
  if (fixedMap && saved.dungeonLayoutVersion >= 2 &&
    (rooms.filter((room) => room.type === "treasure" && room.mainTreasure).length !== 1 ||
      rooms.filter((room) => room.optionalQuest).length !==
        (saved.dungeonFloor === DUNGEON_FLOOR_COUNT ? 1 : 0) ||
      rooms.filter((room) => room.type === "entrance").length !== (saved.dungeonFloor === 1 ? 1 : 0) ||
      rooms.some((room) => room.type === "exit"))) return null;
  if (fixedMap && saved.dungeonLayoutVersion < 2 &&
    (!rooms.some((room) => room.type === "treasure" && room.mainTreasure) ||
      rooms.filter((room) => room.optionalQuest).length !== 1 ||
      !rooms.some((room) => room.type === "entrance" && room.anchorX === 5 && room.anchorY === entranceY) ||
      rooms.some((room) => room.type === "exit"))) return null;
  if (!Number.isInteger(saved.currentRoom) || saved.currentRoom < 0 || saved.currentRoom >= rooms.length ||
    !saved.player || !Number.isInteger(saved.player.x) || !Number.isInteger(saved.player.y) ||
    !Array.isArray(saved.terrain) || saved.terrain.length !== MAP_TILE_SIZE * MAP_TILE_SIZE ||
    !saved.terrain.every((tile) => ["stone", "wall", "floor", "corridor", "door"].includes(tile)) ||
    !Array.isArray(saved.seen) || saved.seen.length !== MAP_TILE_SIZE * MAP_TILE_SIZE ||
    !saved.seen.every((value) => typeof value === "boolean") ||
    !Array.isArray(saved.enemies) || saved.enemies.length > 120 ||
    !Array.isArray(saved.treasures) || saved.treasures.length > 160 ||
    !Array.isArray(saved.wells) || saved.wells.length > 2 ||
    !Array.isArray(saved.hazards) || saved.hazards.length > 120 ||
    !Number.isInteger(saved.steps) || saved.steps < 0) return null;
  if (saved.player.x < 0 || saved.player.x >= MAP_TILE_SIZE || saved.player.y < 0 || saved.player.y >= MAP_TILE_SIZE ||
    !["floor", "corridor", "door"].includes(saved.terrain[tileIndex(saved.player.x, saved.player.y)])) return null;
  if (saved.player.facing === undefined) saved.player.facing = "south";
  if (!CHARACTER_FACINGS.includes(saved.player.facing)) return null;
  if (!Number.isInteger(saved.hp) || saved.hp < 0 || saved.hp > 10000 ||
    !Number.isInteger(saved.maxHp) || saved.maxHp < 1 || saved.maxHp > 10000 ||
    !Number.isInteger(saved.xp) || saved.xp < 0 || saved.xp > 1_000_000 ||
    !Number.isInteger(saved.level) || saved.level < 1 || saved.level > MAX_LEVEL) return null;
  if (!Number.isFinite(saved.gold) || saved.gold < 0 || saved.gold > MAX_GOLD) return null;
  saved.gold = roundGold(saved.gold);
  saved.unsecuredLoot.gold = Math.min(roundGold(saved.unsecuredLoot.gold), saved.gold);
  if (saved.maxHp < 1 || saved.hp > saved.maxHp || rooms.some((room) => room.links.some((link) => !Number.isInteger(link) || link < 0 || link >= rooms.length))) return null;
  if (!saved.character) saved.character = makeLegacyCharacter();
  if (!saved.character.equipmentEnhancements) {
    saved.character.equipmentEnhancements = { weaponIds: [], armorIds: [] };
  }
  if (!saved.character.cosmetics) saved.character.cosmetics = { owned: [], helmet: null, clothes: null };
  if (!Array.isArray(saved.character.cosmetics.owned)) saved.character.cosmetics.owned = [];
  if (saved.character.cosmetics.helmet === undefined) saved.character.cosmetics.helmet = null;
  if (saved.character.cosmetics.clothes === undefined) saved.character.cosmetics.clothes = null;
  if (saved.character.cosmetics.back === undefined) saved.character.cosmetics.back = null;
  if (saved.character.cosmetics.neck === undefined) saved.character.cosmetics.neck = null;
  if (Array.isArray(saved.inventory)) {
    // Regalia bought before the wardrobe existed move into the pack as wearable items.
    for (const id of saved.character.cosmetics.owned) {
      if (COSMETICS[id] && !saved.inventory.some((entry) => entry?.id === `wear:${id}`)) saved.inventory.push({ id: `wear:${id}`, quantity: 1 });
    }
    clearMissingWornItems(saved.character, saved.inventory);
    // Before clothes were items, the outfit was part of the character: hand it over as gear.
    if (!saved.character.dressByItems && saved.character.appearance) dressInStartingOutfit(saved.character, saved.inventory);
  }
  if (saved.character.gender === undefined) saved.character.gender = "other";
  if (saved.character.appearance) {
    if (saved.character.appearance.garment === undefined) saved.character.appearance.garment = "woven-tunic";
    if (saved.character.appearance.adornment === undefined) saved.character.appearance.adornment = "none";
    if (saved.character.appearance.headwear === undefined) saved.character.appearance.headwear = "none";
    if (saved.character.appearance.facePaint === undefined) saved.character.appearance.facePaint = "none";
    normalizeAppearance(saved.character.appearance, saved.character.race);
  }
  const savedClass = CLASSES[saved.character.class];
  if (savedClass && saved.character.equipment && !savedClass.weapons.includes(gearBase(saved.character.equipment.weapon))) {
    saved.character.equipment.weapon = savedClass.weapon;
  }
  if (savedClass && saved.character.equipment && !savedClass.armor.includes(gearBase(saved.character.equipment.armor))) {
    saved.character.equipment.armor = DEFAULT_CLASS_ARMOR[saved.character.class] || "none";
  }
  if (saved.spellSlots === undefined) saved.spellSlots = maxSpellSlots(saved.character.class, saved.level);
  if (!Number.isInteger(saved.spellSlots) || saved.spellSlots < 0 ||
    saved.spellSlots > maxSpellSlots(saved.character.class, saved.level)) return null;
  delete saved.character.storyPrompt;
  if (!Array.isArray(saved.character.classSkills) && CLASSES[saved.character.class] && BACKGROUNDS[saved.character.background]) {
    const selectedClass = CLASSES[saved.character.class];
    const backgroundSkills = new Set(BACKGROUNDS[saved.character.background].skillIds);
    saved.character.classSkills = selectedClass.skills
      .filter((skill) => !backgroundSkills.has(skill))
      .slice(0, selectedClass.skillCount);
  }
  const armorRequirement = ARMORS[saved.character.equipment?.armor]?.strength;
  if (armorRequirement && saved.character.scores?.str < armorRequirement) {
    const fallbackArmor = [...(CLASSES[saved.character.class]?.armor || ["none"])]
      .reverse()
      .find((armorId) => !ARMORS[armorId].strength);
    saved.character.equipment.armor = fallbackArmor || "none";
  }
  if (!validateSavedCharacter(saved.character)) return null;
  if (saved.inventory === undefined) {
    const oldPotionCount = saved.potions === undefined ? 2 : saved.potions;
    if (!Number.isInteger(oldPotionCount) || oldPotionCount < 0 || oldPotionCount > 1000) return null;
    saved.inventory = buildStartingInventory(saved.character).filter((entry) => entry.id !== "healing-potion");
    if (oldPotionCount) saved.inventory.push({ id: "healing-potion", quantity: oldPotionCount });
    delete saved.potions;
  }
  if (!Array.isArray(saved.inventory)) return null;
  saved.inventory = migrateLegacyTravelBundles(saved.inventory);
  if (Array.isArray(saved.unsecuredLoot.items)) {
    saved.unsecuredLoot.items = migrateLegacyTravelBundles(saved.unsecuredLoot.items);
  }
  if (!Array.isArray(saved.inventory) || saved.inventory.length > 100 || saved.inventory.some((entry) =>
    !entry || !itemDetails(entry.id) || !Number.isInteger(entry.quantity) || entry.quantity < 1 || entry.quantity > 1000 ||
    (entry.uses !== undefined && (entry.id !== "healer-kit" || !Number.isInteger(entry.uses) || entry.uses < 1 || entry.uses > entry.quantity * HEALER_KIT_USES))
  )) return null;
  if (saved.unsecuredLoot.items.some((item) =>
    item.quantity > (saved.inventory.find((entry) => entry.id === item.id)?.quantity || 0))) return null;
  for (const entry of saved.inventory) {
    if (entry.id === "healer-kit" && entry.uses === undefined) entry.uses = entry.quantity * HEALER_KIT_USES;
  }
  const companionIds = new Set();
  for (const companion of saved.party) {
    if (companion && companion.needs === undefined) companion.needs = createNeeds();
    if (companion?.needs) upgradeNeeds(companion.needs);
    if (companion && !companion.race) companion.race = "human";
    if (companion && companion.gender === undefined) companion.gender = "other";
    if (companion && !companion.appearance) {
      companion.appearance = {
        skin: "#9a603c", hair: "#211a17", hairStyle: "short", tunic: "#28685e",
        garment: "woven-tunic", adornment: "none"
      };
    }
    if (companion?.appearance?.garment === undefined && companion?.appearance) companion.appearance.garment = "woven-tunic";
    if (companion?.appearance?.adornment === undefined && companion?.appearance) companion.appearance.adornment = "none";
    const characterClass = CLASSES[companion?.class];
    if (!companion || typeof companion.id !== "string" || companionIds.has(companion.id) ||
      typeof companion.name !== "string" || companion.name.length < 1 || companion.name.length > 24 ||
      !characterClass || !RACES[companion.race] || !GENDERS.includes(companion.gender) || !companion.appearance ||
      !SKIN_TONES.some((tone) => tone.value === companion.appearance.skin) ||
      !HAIR_COLORS.includes(companion.appearance.hair) ||
      !["short", "long", "braids", "crest"].includes(companion.appearance.hairStyle) ||
      !TUNIC_COLORS.includes(companion.appearance.tunic) ||
      !GARMENT_STYLES.includes(companion.appearance.garment) ||
      !CLOTHING_ADORNMENTS.includes(companion.appearance.adornment) ||
      !companion.scores || !ABILITIES.every(([key]) =>
        Number.isInteger(companion.scores[key]) && companion.scores[key] >= 1 && companion.scores[key] <= 20
      ) || !companion.equipment || !characterClass.weapons.includes(companion.equipment.weapon) ||
      !["none", ...characterClass.armor].includes(companion.equipment.armor) ||
      typeof companion.equipment.shield !== "boolean" || typeof companion.equipment.cloak !== "boolean" ||
      !Array.isArray(companion.skills) || companion.skills.length > 6 ||
      companion.skills.some((skill) => !Object.prototype.hasOwnProperty.call(SKILLS, skill)) || !validNeeds(companion.needs) ||
      !Number.isInteger(companion.maxHp) || companion.maxHp < 1 || companion.maxHp > 100 ||
      !Number.isInteger(companion.hp) || companion.hp < 0 || companion.hp > companion.maxHp ||
      ((companion.x !== undefined || companion.y !== undefined) &&
        (!Number.isInteger(companion.x) || !Number.isInteger(companion.y) ||
          companion.x < 0 || companion.x >= MAP_TILE_SIZE || companion.y < 0 || companion.y >= MAP_TILE_SIZE))) return null;
    companionIds.add(companion.id);
  }
  for (const companion of saved.party) {
    const previousMaxHp = companion.maxHp;
    const missingHp = previousMaxHp - companion.hp;
    companion.maxHp = deriveCharacter(companion, saved.level).maxHp;
    companion.hp = Math.max(0, companion.maxHp - missingHp);
  }
  if (saved.location !== "dungeon" && canHeal(saved.needs)) saved.hp = saved.maxHp;
  const enemyIds = new Set();
  for (const enemy of saved.enemies) {
    if (enemy && enemy.edible === undefined) {
      enemy.edible = pack.enemies.find((template) => template.id === enemy.templateId)?.edible === true;
    }
    if (enemy && enemy.lootDropped === undefined) enemy.lootDropped = false;
    if (!enemy || typeof enemy.id !== "string" || enemyIds.has(enemy.id) ||
      !pack.enemies.some((template) => template.id === enemy.templateId) ||
      !Number.isInteger(enemy.x) || !Number.isInteger(enemy.y) ||
      enemy.x < 0 || enemy.x >= MAP_TILE_SIZE || enemy.y < 0 || enemy.y >= MAP_TILE_SIZE ||
      !Number.isInteger(enemy.hp) || !Number.isInteger(enemy.maxHp) || enemy.maxHp < 1 ||
      enemy.hp < 0 || enemy.hp > enemy.maxHp || typeof enemy.alive !== "boolean" ||
      typeof enemy.edible !== "boolean" || typeof enemy.lootDropped !== "boolean" ||
      (enemy.sprite !== undefined && !ENEMY_SPRITES.includes(enemy.sprite))) return null;
    if (enemy.sprite === undefined) enemy.sprite = enemySpriteId(enemy);
    enemyIds.add(enemy.id);
  }
  const treasureIds = new Set();
  for (const treasure of saved.treasures) {
    if (!treasure || typeof treasure.id !== "string" || treasureIds.has(treasure.id) ||
      !Number.isInteger(treasure.x) || !Number.isInteger(treasure.y) ||
      treasure.x < 0 || treasure.x >= MAP_TILE_SIZE || treasure.y < 0 || treasure.y >= MAP_TILE_SIZE ||
      !Number.isFinite(treasure.gold) || treasure.gold < 0 || treasure.gold > MAX_GOLD ||
      (treasure.mainGoal !== undefined && typeof treasure.mainGoal !== "boolean") ||
      (treasure.dropped !== undefined && typeof treasure.dropped !== "boolean") ||
      !Array.isArray(treasure.items) || treasure.items.length > 20 ||
      treasure.items.some((item) => !item || typeof item.id !== "string" || !itemDetails(item.id) ||
        !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000)) return null;
    treasureIds.add(treasure.id);
  }
  for (const hazard of saved.hazards) {
    if (!hazard || !Number.isInteger(hazard.x) || !Number.isInteger(hazard.y) ||
      hazard.x < 0 || hazard.x >= MAP_TILE_SIZE || hazard.y < 0 || hazard.y >= MAP_TILE_SIZE ||
      !Number.isInteger(hazard.dc) || typeof hazard.damage !== "string" || !DICE_PATTERN.test(hazard.damage) ||
      typeof hazard.revealed !== "boolean" || typeof hazard.triggered !== "boolean") return null;
  }
  const wellIds = new Set();
  for (const well of saved.wells) {
    if (!well || typeof well.id !== "string" || wellIds.has(well.id) ||
      !Number.isInteger(well.x) || !Number.isInteger(well.y) ||
      well.x < 0 || well.x >= MAP_TILE_SIZE || well.y < 0 || well.y >= MAP_TILE_SIZE ||
      saved.terrain[tileIndex(well.x, well.y)] !== "floor" ||
      !Number.isInteger(well.roomIndex) || well.roomIndex < 0 || well.roomIndex >= saved.rooms.length ||
      !["quiet", "treasure"].includes(saved.rooms[well.roomIndex].type) ||
      saved.rooms[well.roomIndex].mainTreasure) return null;
    wellIds.add(well.id);
  }
  if (fixedMap && pack === starterPack) {
    // Refresh room names and descriptions from the current content, matched by template.
    // The first room of a floor, the treasure vault, and the final chamber keep their own text.
    saved.rooms.forEach((room, index) => {
      const currentRoom = starterPack.rooms.find((template) => template.id === room.id);
      if (!currentRoom) return;
      room.name = currentRoom.name;
      if (index !== 0 && !room.mainTreasure && !room.optionalQuest) room.text = currentRoom.text;
    });
    for (const enemy of saved.enemies) {
      const currentEnemy = starterPack.enemies.find((template) => template.id === enemy.templateId);
      if (!currentEnemy) continue;
      enemy.name = typeof enemy.title === "string" && enemy.title.length <= 30
        ? `${enemy.title} ${currentEnemy.name}` : currentEnemy.name;
      enemy.description = currentEnemy.description;
    }
  }
  if (fixedMap && saved.dungeonLayoutVersion < 2) {
    const signs = rooms.length === 3 ? GTFL_LEGACY_MAP_SIGNS : GTFL_MAP_SIGNS;
    for (const sign of signs) {
      if (["door", "locked", "trapped", "portcullis"].includes(sign.type) &&
        ["floor", "wall"].includes(saved.terrain[tileIndex(sign.x, sign.y)])) {
        saved.terrain[tileIndex(sign.x, sign.y)] = "door";
      }
    }
  }
  if (fixedMap && saved.dungeonLayoutVersion >= 2) {
    const stairIds = new Set();
    const stairTiles = new Set();
    for (const stair of saved.floorStairs) {
      const tile = stair && Number.isInteger(stair.x) && Number.isInteger(stair.y)
        ? tileIndex(stair.x, stair.y)
        : -1;
      if (!stair || typeof stair.id !== "string" || stair.id.length > 40 ||
        stairIds.has(stair.id) || stairTiles.has(tile) ||
        !["stairs-up", "stairs-down", "exit", "lift"].includes(stair.type) ||
        typeof stair.name !== "string" || stair.name.length < 1 || stair.name.length > 50 ||
        tile < 0 || stair.x >= MAP_TILE_SIZE || stair.y >= MAP_TILE_SIZE ||
        saved.terrain[tile] !== "floor") return null;
      if (stair.type === "lift") {
        if (!LIFT_FLOORS.includes(saved.dungeonFloor) || stair.role !== "entrance" || stair.id !== "warden-lift" ||
          stair.targetFloor !== undefined) return null;
      } else if (stair.type === "exit") {
        if (saved.dungeonFloor !== DUNGEON_FLOOR_COUNT || stair.role !== "exit" || stair.targetFloor !== undefined) return null;
      } else if (stair.role === "entrance") {
        if (saved.dungeonFloor !== 1 || stair.type !== "stairs-up" || stair.targetFloor !== undefined) return null;
      } else if (!Number.isInteger(stair.targetFloor) ||
        stair.targetFloor !== saved.dungeonFloor + (stair.type === "stairs-down" ? 1 : -1) ||
        stair.targetFloor < 1 || stair.targetFloor > DUNGEON_FLOOR_COUNT) return null;
      stairIds.add(stair.id);
      stairTiles.add(tile);
    }
    const upStairs = saved.floorStairs.filter((stair) => stair.type === "stairs-up");
    const downStairs = saved.floorStairs.filter((stair) => stair.type === "stairs-down");
    const exits = saved.floorStairs.filter((stair) => stair.type === "exit");
    if (upStairs.length !== (saved.dungeonFloor === 1 ? 1 : 2) ||
      downStairs.length !== (saved.dungeonFloor === DUNGEON_FLOOR_COUNT ? 0 : 2) ||
      exits.length !== (saved.dungeonFloor === DUNGEON_FLOOR_COUNT ? 1 : 0) ||
      (saved.dungeonFloor === 1 && upStairs[0]?.role !== "entrance") ||
      (saved.dungeonFloor > 1 && upStairs.some((stair) => stair.role !== undefined)) ||
      (saved.dungeonFloor < DUNGEON_FLOOR_COUNT && downStairs.some((stair) => stair.role !== undefined))) return null;
  } else if (saved.floorStairs.length) return null;
  if (new Set(saved.openDoors).size !== saved.openDoors.length ||
    saved.openDoors.some((index) => index < 0 || index >= saved.terrain.length || saved.terrain[index] !== "door")) return null;
  if (migrateDoorState) {
    const occupants = [saved.player, ...(saved.party || []), ...(saved.enemies || []).filter((enemy) => enemy.alive)];
    for (const occupant of occupants) {
      if (occupant && saved.terrain[tileIndex(occupant.x, occupant.y)] === "door") {
        const index = tileIndex(occupant.x, occupant.y);
        if (!saved.openDoors.includes(index)) saved.openDoors.push(index);
      }
    }
  }
  for (const [floorKey, snapshot] of Object.entries(saved.dungeonFloors)) {
    const floor = Number(floorKey);
    if (!Number.isInteger(floor) || floor < 1 || floor > DUNGEON_FLOOR_COUNT || floor === saved.dungeonFloor ||
      !snapshot || typeof snapshot !== "object" || Array.isArray(snapshot) || snapshot.floor !== floor) return null;
    const candidate = JSON.parse(JSON.stringify({
      ...saved,
      ...snapshot,
      dungeonFloor: floor,
      location: "dungeon",
      dungeonFloors: {}
    }));
    if (!parseSavedRun(candidate, pack)) return null;
  }
  saved.progress.deepestFloor = Math.max(saved.progress.deepestFloor, saved.dungeonFloor,
    ...Object.keys(saved.dungeonFloors).map(Number).filter(Number.isInteger));
  return saved;
}

function loadState() {
  try {
    const rawIndex = localStorage.getItem(STORE_KEYS.saveIndex);
    if (rawIndex) {
      const index = parseSaveIndex(rawIndex);
      const lastPlayed = index.slots.find((save) => save.id === index.lastPlayedId)
        || [...index.slots].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      if (lastPlayed) activateSaveSlot(lastPlayed.id, { markPlayed: false });
      return;
    }

    const savedPack = localStorage.getItem(STORE_KEYS.pack);
    const savedRun = localStorage.getItem(STORE_KEYS.run);
    if (!savedRun) return;
    const pack = normalizeSavedPack(savedPack ? JSON.parse(savedPack) : starterPack);
    const run = parseSavedRun(JSON.parse(savedRun), pack);
    if (!run) throw new Error("saved run did not match its adventure.");
    state.pack = pack;
    state.run = run;
    upgradeGreatTempleContent();
    const saveId = createSaveId();
    state.activeSaveId = saveId;
    saveRun();
  } catch (error) {
    showToast(`Saved game could not be loaded: ${escapeMessage(error)}`);
  }
}

function createSaveId() {
  return typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function parseSaveIndex(serialized) {
  const index = JSON.parse(serialized);
  if (!index || index.schemaVersion !== 1 || !Array.isArray(index.slots)) {
    throw new Error("save list has an unsupported format.");
  }
  const slots = index.slots;
  if (slots.some((save) => !save || typeof save.id !== "string" ||
    !/^[a-z0-9-]{8,64}$/i.test(save.id) || typeof save.name !== "string" ||
    !Number.isInteger(save.level) || typeof save.location !== "string" ||
    typeof save.updatedAt !== "string") || new Set(slots.map((save) => save.id)).size !== slots.length) {
    throw new Error("save list contains invalid character entries.");
  }
  return {
    schemaVersion: 1,
    lastPlayedId: typeof index.lastPlayedId === "string" ? index.lastPlayedId : null,
    slots
  };
}

function readSaveIndex() {
  const serialized = localStorage.getItem(STORE_KEYS.saveIndex);
  return serialized
    ? parseSaveIndex(serialized)
    : { schemaVersion: 1, lastPlayedId: null, slots: [] };
}

function normalizeSavedPack(raw) {
  if (raw?.id === starterPack.id && [
    "The Great Temple of the Fallen Lord",
    "The Greenstone Echo",
    "The Tomb Beneath Chiltomatlan"
  ].includes(raw.title)) return starterPack;
  const pack = validatePack(raw);
  return pack.id === "quiet-vault" ? starterPack : pack;
}

function activateSaveSlot(saveId, { markPlayed = true } = {}) {
  const serialized = localStorage.getItem(`${STORE_KEYS.saveSlotPrefix}${saveId}`);
  if (!serialized) throw new Error("saved character data could not be found.");
  const slot = JSON.parse(serialized);
  if (!slot || slot.schemaVersion !== 1 || !slot.pack || !slot.run) {
    throw new Error("saved character data has an unsupported format.");
  }
  const pack = normalizeSavedPack(slot.pack);
  const run = parseSavedRun(slot.run, pack);
  if (!run) throw new Error("saved run did not match its adventure.");
  if (markPlayed) {
    const index = readSaveIndex();
    index.lastPlayedId = saveId;
    localStorage.setItem(STORE_KEYS.saveIndex, JSON.stringify(index));
  }
  state.pack = pack;
  state.run = run;
  state.activeSaveId = saveId;
  upgradeGreatTempleContent();
  return true;
}

function renderSaveManager() {
  const index = readSaveIndex();
  const saves = [...index.slots].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  elements["save-manager-list"].replaceChildren();
  elements["save-manager-empty"].classList.toggle("hidden", saves.length > 0);
  for (const save of saves) {
    const row = document.createElement("li");
    row.className = "save-manager-row";
    const details = document.createElement("div");
    details.className = "save-manager-details";
    const name = document.createElement("strong");
    name.textContent = save.name;
    const metadata = document.createElement("span");
    const date = new Date(save.updatedAt);
    const dateLabel = Number.isNaN(date.getTime())
      ? t("Unknown date")
      : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
    const location = save.location === "city" ? "Chiltomatlan"
      : save.location === "store" ? "Chiltomatlan market" : "Expedition";
    metadata.textContent = t("Level {level} · {location} · {date}", {
      level: save.level || 1,
      location: t(location),
      date: dateLabel
    });
    details.append(name, metadata);
    const actions = document.createElement("div");
    actions.className = "save-manager-actions";
    const loadButton = document.createElement("button");
    loadButton.className = "button";
    loadButton.type = "button";
    loadButton.textContent = t("Load");
    loadButton.addEventListener("click", () => {
      try {
        activateSaveSlot(save.id);
        state.gameStarted = true;
        elements["save-manager-dialog"].close();
        render();
      } catch (error) {
        showToast(t("Could not load {name}'s save: {error}", { name: save.name, error: escapeMessage(error) }));
      }
    });
    const deleteButton = document.createElement("button");
    deleteButton.className = "button secondary";
    deleteButton.type = "button";
    deleteButton.textContent = t("Delete");
    deleteButton.addEventListener("click", () => deleteSaveSlot(save));
    actions.append(loadButton, deleteButton);
    row.append(details, actions);
    elements["save-manager-list"].append(row);
  }
}

function deleteSaveSlot(save) {
  if (!window.confirm(t("Delete {name}'s saved game? This cannot be undone.", { name: save.name }))) return;
  try {
    const index = readSaveIndex();
    index.slots = index.slots.filter((entry) => entry.id !== save.id);
    if (index.lastPlayedId === save.id) {
      const next = [...index.slots].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      index.lastPlayedId = next?.id || null;
    }
    localStorage.setItem(STORE_KEYS.saveIndex, JSON.stringify(index));
    localStorage.removeItem(`${STORE_KEYS.saveSlotPrefix}${save.id}`);
    if (state.activeSaveId === save.id) {
      state.activeSaveId = index.lastPlayedId;
      state.run = null;
      if (state.activeSaveId) {
        try {
          activateSaveSlot(state.activeSaveId, { markPlayed: false });
        } catch (error) {
          state.activeSaveId = null;
          state.run = null;
          showToast(t("Could not load the most recently played save: {error}", { error: escapeMessage(error) }));
        }
      }
    }
    renderSaveManager();
    renderStartScreen();
  } catch (error) {
    showToast(t("Could not delete {name}'s save: {error}", { name: save.name, error: escapeMessage(error) }));
  }
}

function openSaveManager() {
  try {
    renderSaveManager();
    elements["save-manager-dialog"].showModal();
  } catch (error) {
    showToast(t("Could not open saved games: {error}", { error: escapeMessage(error) }));
  }
}

function connectEvents() {
  connectProgressionEvents();
  connectShopEvents();
  connectHouseEvents();
  elements["message-box"].addEventListener("click", (event) => {
    event.stopPropagation();
    advanceRpgMessage();
  });
  elements["message-box-close"].addEventListener("click", (event) => {
    event.stopPropagation();
    dismissRpgMessage();
  });
  document.addEventListener("click", (event) => {
    if (state.messageBox && !elements["message-box"].contains(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (state.utilityDrawer && !elements["side-drawer"].contains(event.target)) {
      const drawerToggle = event.target instanceof Element &&
        event.target.closest("#party-toggle, #journal-toggle, #log-toggle");
      const characterToggle = event.target instanceof Element &&
        event.target.closest("#character-button, #header-spell-slots");
      if (drawerToggle) return;
      closeUtilityDrawer(false);
      if (characterToggle) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  const actionGroups = [...document.querySelectorAll("#action-panel .action-group")];
  const updateExpandedActions = () => {
    elements["action-panel"].classList.toggle("has-expanded-actions", actionGroups.some((group) => group.open));
  };
  actionGroups.forEach((group) => group.addEventListener("toggle", () => {
    if (group.open) {
      actionGroups.forEach((otherGroup) => {
        if (otherGroup !== group) otherGroup.open = false;
      });
    }
    updateExpandedActions();
  }));
  window.addEventListener("resize", () => {
    renderUtilityDrawer();
    if (state.gameStarted && state.run?.location === "dungeon") {
      renderMap();
      renderActions();
    }
  });
  initializeCharacterBuilder();
  const abilityOptions = ABILITIES.map(([key, name]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = name;
    return option;
  });
  elements["level-up-one"].replaceChildren(...abilityOptions.map((option) => option.cloneNode(true)));
  elements["level-up-two"].replaceChildren(...abilityOptions.map((option) => option.cloneNode(true)));
  elements["level-up-mode-select"].addEventListener("change", () => {
    elements["level-up-two-label"].classList.toggle("hidden", elements["level-up-mode-select"].value === "one");
  });
  elements["apply-level-up"].addEventListener("click", applyLevelUpChoice);
  elements["character-button"].addEventListener("click", () => {
    if (elements["character-card-dialog"].open) closeCharacterCard();
    else openCharacterCard();
  });
  elements["header-spell-slots"].addEventListener("click", () => {
    selectCharacterTab("abilities");
    openCharacterCard();
    document.querySelector('[data-character-tab="abilities"]').focus();
  });
  elements["wait-dpad-button"].addEventListener("click", waitTurn);
  elements["party-toggle"].addEventListener("click", () => toggleUtilityDrawer("party"));
  elements["journal-toggle"].addEventListener("click", () => toggleUtilityDrawer("journal"));
  elements["log-toggle"].addEventListener("click", () => toggleUtilityDrawer("log"));
  elements["look-toggle"].addEventListener("click", toggleLookMode);
  elements["close-side-drawer"].addEventListener("click", () => closeUtilityDrawer(true));
  elements["close-character-card"].addEventListener("click", closeCharacterCard);
  elements["close-character-card-top"].addEventListener("click", closeCharacterCard);
  elements["character-card-dialog"].addEventListener("close", () => {
    elements["character-button"].setAttribute("aria-expanded", "false");
  });
  document.querySelectorAll("[data-character-tab]").forEach((button) => {
    button.addEventListener("click", () => selectCharacterTab(button.dataset.characterTab));
    button.addEventListener("keydown", (event) => {
      const tabs = [...document.querySelectorAll("[data-character-tab]")];
      const index = tabs.indexOf(button);
      const nextIndex = event.key === "ArrowRight" ? (index + 1) % tabs.length
        : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length
          : event.key === "Home" ? 0
            : event.key === "End" ? tabs.length - 1 : -1;
      if (nextIndex < 0) return;
      event.preventDefault();
      selectCharacterTab(tabs[nextIndex].dataset.characterTab);
      tabs[nextIndex].focus();
    });
  });
  elements["continue-game"].addEventListener("click", () => {
    if (!state.activeSaveId) return;
    try {
      activateSaveSlot(state.activeSaveId);
      state.gameStarted = true;
      render();
    } catch (error) {
      showToast(t("Could not continue the saved game: {error}", { error: escapeMessage(error) }));
    }
  });
  elements["new-game"].addEventListener("click", () => openCharacterBuilder());
  elements["load-game"].addEventListener("click", openSaveManager);
  elements["close-save-manager"].addEventListener("click", () => elements["save-manager-dialog"].close());
  elements["save-manager-dialog"].addEventListener("click", (event) => {
    if (event.target === elements["save-manager-dialog"]) elements["save-manager-dialog"].close();
  });
  const openSettings = () => {
    stopHeldMovement();
    document.getElementById("settings-run-actions")?.classList.toggle("hidden", !(state.gameStarted && state.run));
    if (!elements["settings-dialog"].open) elements["settings-dialog"].showModal();
  };
  elements["open-settings"].addEventListener("click", openSettings);
  document.getElementById("pause-settings")?.addEventListener("click", openSettings);
  document.getElementById("game-settings-toggle")?.addEventListener("click", openSettings);
  document.getElementById("pad-size-select")?.addEventListener("change", (event) => {
    const size = applyPadSize(event.target.value);
    try { localStorage.setItem(STORE_KEYS.padSize, size); } catch { /* private mode */ }
    if (state.gameStarted && state.run?.location === "dungeon") renderMap();
  });
  document.getElementById("map-zoom")?.addEventListener("input", (event) => setMapZoom(event.target.value));
  document.getElementById("map-zoom-in")?.addEventListener("click", () => setMapZoom(mapZoom + 1));
  document.getElementById("map-zoom-out")?.addEventListener("click", () => setMapZoom(mapZoom - 1));
  // Pinch the tomb map to zoom; ctrl/⌘ + wheel does the same with a mouse or trackpad.
  const pinch = { pointers: new Map(), start: 0 };
  const pinchDistance = () => {
    const [a, b] = [...pinch.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const mapViewport = elements["dungeon-map-viewport"];
  // Re-fit the tile grid whenever the map area changes size (first layout, rotation, drawers).
  if ("ResizeObserver" in window) {
    let lastSize = "";
    new ResizeObserver(() => {
      const size = `${mapViewport.clientWidth}x${mapViewport.clientHeight}`;
      if (size === lastSize) return;
      lastSize = size;
      if (state.gameStarted && state.run?.location === "dungeon") renderMap();
    }).observe(mapViewport);
    const townViewport = document.getElementById("town-map-viewport");
    let lastTownSize = "";
    new ResizeObserver(() => {
      const size = `${townViewport.clientWidth}x${townViewport.clientHeight}`;
      if (size === lastTownSize) return;
      lastTownSize = size;
      if (state.gameStarted && state.run?.location === "city") renderTownMap();
    }).observe(townViewport);
  }
  window.addEventListener("resize", () => {
    if (state.gameStarted && state.run?.location === "city") renderTownMap();
  });
  mapViewport.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") return;
    pinch.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch.pointers.size === 2) pinch.start = pinchDistance();
  });
  mapViewport.addEventListener("pointermove", (event) => {
    if (!pinch.pointers.has(event.pointerId)) return;
    pinch.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch.pointers.size !== 2 || !pinch.start) return;
    const ratio = pinchDistance() / pinch.start;
    if (ratio > 1.3 || ratio < 0.77) {
      setMapZoom(mapZoom + (ratio > 1 ? 1 : -1));
      pinch.start = pinchDistance();
      state.suppressMapTapUntil = Date.now() + 450;
    }
  });
  const endPinch = (event) => {
    pinch.pointers.delete(event.pointerId);
    if (pinch.pointers.size < 2) pinch.start = 0;
  };
  mapViewport.addEventListener("pointerup", endPinch);
  mapViewport.addEventListener("pointercancel", endPinch);
  mapViewport.addEventListener("wheel", (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setMapZoom(mapZoom + (event.deltaY < 0 ? 1 : -1));
  }, { passive: false });
  connectSoundSettings();
  elements["close-settings"].addEventListener("click", () => elements["settings-dialog"].close());
  elements["settings-dialog"].addEventListener("click", (event) => {
    if (event.target === elements["settings-dialog"]) elements["settings-dialog"].close();
  });
  elements["install-pwa"].addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      showToast(t("Open your browser menu and choose Install app or Add to Home Screen."));
      return;
    }
    const installPrompt = deferredInstallPrompt;
    deferredInstallPrompt = null;
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        pwaInstallAccepted = true;
        updatePwaInstallOption();
      }
    } catch (error) {
      showToast(t("Could not start app installation: {error}", { error: escapeMessage(error) }));
    }
  });
  elements["language-select"].addEventListener("change", () => {
    const language = ["es", "nah", "nah-abugida", "fr", "de", "pt", "ja", "ko", "zh"].includes(elements["language-select"].value) ? elements["language-select"].value : "en";
    try {
      localStorage.setItem(STORE_KEYS.language, language);
    } catch (error) {
      showToast(`Could not save language preference: ${escapeMessage(error)}`);
      elements["language-select"].value = window.cryptsLocale.language;
      return;
    }
    window.cryptsLocale.apply(language);
    if (elements["character-dialog"].open) refreshCharacterLocalization();
    if (state.gameStarted) render();
    else renderStartScreen();
  });
  elements["font-select"].addEventListener("change", () => {
    const font = applyFontChoice(elements["font-select"].value);
    try {
      localStorage.setItem(STORE_KEYS.font, font);
    } catch (error) {
      showToast(`Could not save typeface preference: ${escapeMessage(error)}`);
    }
  });
  elements["dark-mode-toggle"].addEventListener("change", () => {
    const enabled = elements["dark-mode-toggle"].checked;
    try {
      localStorage.setItem(STORE_KEYS.darkMode, String(enabled));
    } catch (error) {
      showToast(`Could not save dark mode preference: ${escapeMessage(error)}`);
      elements["dark-mode-toggle"].checked = !enabled;
      return;
    }
    document.body.classList.toggle("dark-mode", enabled);
  });
  elements["close-character"].addEventListener("click", () => {
    elements["character-dialog"].close();
  });
  elements["cancel-character"].addEventListener("click", () => {
    elements["character-dialog"].close();
  });
  elements["character-form"].addEventListener("submit", commitCharacter);
  elements["character-next"].addEventListener("click", () => advanceCharacterCreation(1));
  elements["character-back"].addEventListener("click", () => advanceCharacterCreation(-1));
  elements["character-race"].addEventListener("change", () => {
    const race = elements["character-race"].value;
    const previous = elements["character-race"].dataset.lastRace;
    syncHeritageOptions();
    syncAppearanceOptions(race, race === "dwarf" && previous !== "dwarf" ? { beard: "full" } :
      previous === "dwarf" && race !== "dwarf" ? { beard: "none" } : {});
    updateCharacterPreview();
  });
  elements["character-class"].addEventListener("change", () => {
    syncEquipmentOptions(true);
    syncClassSkillOptions();
    if (elements["score-method"].value === "rolled" && state.scoreRolls.length === ABILITIES.length) {
      renderAbilityInputs(rolledAbilityAssignment(state.scoreRolls, elements["character-class"].value), state.scoreRolls);
    }
    updateCharacterPreview();
  });
  elements["character-background"].addEventListener("change", () => {
    syncClassSkillOptions();
    updateCharacterPreview();
  });
  elements["character-heritage"].addEventListener("change", updateCharacterPreview);
  elements["score-method"].addEventListener("change", () => {
    const scores = elements["score-method"].value === "rolled"
      ? rolledAbilityAssignment(state.scoreRolls, elements["character-class"].value)
      : null;
    renderAbilityInputs(scores, state.scoreRolls);
    updateCharacterPreview();
  });
  elements["roll-scores"].addEventListener("click", rollAbilityScores);
  elements["half-elf-bonus-one"].addEventListener("change", () => {
    if (elements["half-elf-bonus-one"].value === elements["half-elf-bonus-two"].value) {
      elements["half-elf-bonus-two"].value = ABILITIES.find(([key]) => key !== "cha" && key !== elements["half-elf-bonus-one"].value)[0];
    }
    updateCharacterPreview();
  });
  elements["half-elf-bonus-two"].addEventListener("change", () => {
    if (elements["half-elf-bonus-one"].value === elements["half-elf-bonus-two"].value) {
      elements["half-elf-bonus-one"].value = ABILITIES.find(([key]) => key !== "cha" && key !== elements["half-elf-bonus-two"].value)[0];
    }
    updateCharacterPreview();
  });
  elements["character-form"].addEventListener("input", updateCharacterPreview);
  elements["character-form"].addEventListener("change", updateCharacterPreview);
  connectLookEditor();
  connectVillagerEvents();
  connectEquipmentSheet();
  connectCharacterSheet();
  connectCreatureCards();
  elements["ability-score-fields"].addEventListener("change", swapDuplicateAbilityAssignment);
  elements["return-to-city"].addEventListener("click", leaveStore);
  document.querySelectorAll("[data-store-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      elements["store-screen"].dataset.storeView = button.dataset.storeTab;
      document.querySelectorAll("[data-store-tab]").forEach((tab) => {
        tab.setAttribute("aria-pressed", String(tab === button));
      });
      renderShop();
    });
  });
  document.querySelectorAll("[data-store-category]").forEach((button) => {
    button.addEventListener("click", () => {
      state.storeCategory = button.dataset.storeCategory;
      state.listPages.storeBuy = 0;
      renderShop();
    });
  });
  elements["open-ability-guide"].addEventListener("click", () => {
    selectCharacterTab("abilities");
    openCharacterCard();
    document.querySelector('[data-character-tab="abilities"]').focus();
  });
  elements["begin-story"].addEventListener("click", () => elements["prologue-dialog"].close());
  elements["recover-in-chiltomatlan"].addEventListener("click", recoverInChiltomatlan);
  elements["game-over-title"].addEventListener("click", () => {
    elements["game-over-dialog"].close();
    state.gameStarted = false;
    renderStartScreen();
  });
  elements["game-over-dialog"].addEventListener("cancel", (event) => event.preventDefault());
  elements["town-map"].addEventListener("click", (event) => {
    const tile = event.target.closest(".town-tile");
    if (!tile || state.run?.location !== "city") return;
    const x = Number(tile.dataset.x);
    const y = Number(tile.dataset.y);
    const npc = townNpcAt(x, y);
    if (isTownWellAt(x, y)) {
      if (townDistance(state.run.townPosition, TOWN_WELL) === 0) drawWaterAtTownWell();
      else moveTowardTownNpc(TOWN_WELL, 0);
      return;
    }
    if (npc) {
      if (townDistance(state.run.townPosition, npc) <= 1) talkToTownNpc(npc.id);
      else moveTowardTownNpc(npc);
      return;
    }
    if (townMapAtCurrentLevel()[y]?.[x] === "H") {
      if (besideHouse()) openHouse();
      else moveTowardHouse();
      return;
    }
    if (TOWN_BUILDINGS.some((building) => building.x <= x && x < building.x + building.width &&
      building.y <= y && y < building.y + building.height &&
      (!building.projectId || (state.run.progress.town[building.projectId] || 0) >= building.projectLevel))) {
      moveTowardTownNpc({ x, y }, 1);
      return;
    }
    const dx = x - state.run.townPosition.x;
    const dy = y - state.run.townPosition.y;
    const distance = Math.max(Math.abs(dx), Math.abs(dy));
    // Your own tile does whatever Space would; a far street tile walks you one step toward it.
    if (distance === 0) interact();
    else if (distance === 1) moveTownPlayer(dx, dy);
    else if (townCanOccupy(x, y)) moveTowardTownNpc({ x, y }, 0);
    else showToast("Tap a street tile, a person, or a building door to walk there.");
  });
  elements["city-screen"].addEventListener("click", (event) => {
    const button = event.target.closest("[data-town-move]");
    if (!button || state.run?.location !== "city") return;
    const [dx, dy] = button.dataset.townMove.split(",").map(Number);
    moveTownPlayer(dx, dy);
  });
  elements["town-dialog-close"].addEventListener("click", () => elements["town-dialog"].close());
  elements["town-dialog-x"].addEventListener("click", () => elements["town-dialog"].close());
  elements["target-choice-close"].addEventListener("click", () => elements["target-choice-dialog"].close());
  elements["target-choice-dialog"].addEventListener("click", (event) => {
    if (event.target === elements["target-choice-dialog"]) elements["target-choice-dialog"].close();
  });
  elements["cosmetic-shop-close"].addEventListener("click", () => elements["cosmetic-shop-dialog"].close());
  elements["cosmetic-shop-items"].addEventListener("click", (event) => {
    const button = event.target.closest("[data-cosmetic-id]");
    if (button) purchaseOrEquipCosmetic(button.dataset.cosmeticId);
  });
  elements["cosmetic-shop-dialog"].addEventListener("click", (event) => {
    if (event.target === elements["cosmetic-shop-dialog"]) elements["cosmetic-shop-dialog"].close();
    const button = event.target.closest("[data-cosmetic-clear]");
    if (button) {
      const slot = button.dataset.cosmeticClear;
      if (slot !== "helmet" && slot !== "clothes") throw new Error(`Unknown cosmetic slot ${slot}.`);
      const updated = updateCosmeticSlot(slot, null);
      if (updated) {
        elements["cosmetic-shop-message"].textContent = `${slot === "helmet" ? "Helmet" : "Clothing"} unequipped.`;
      }
    }
  });
  connectPatolliEvents();
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-copy-page]");
    if (!button) return;
    const pager = button.closest("[data-copy-pager]");
    if (!pager) return;
    showDialogCopyPage(pager.dataset.copyPager, Number(pager.dataset.page) + Number(button.dataset.copyPage));
  });
  for (const list of [elements["equipment-list"], elements["inventory-list"]]) {
    list.addEventListener("click", (event) => {
      const use = event.target.closest("[data-use-item]");
      if (use) useInventoryItem(use.dataset.useItem);
      const button = event.target.closest("[data-equip-item]");
      if (button) equipInventoryItem(button.dataset.equipItem);
      const unequip = event.target.closest("[data-unequip-item]");
      if (unequip) unequipInventoryItem(unequip.dataset.unequipItem);
      const drop = event.target.closest("[data-drop-item]");
      if (drop) promptDropItem(drop.dataset.dropItem);
    });
  }
  elements["inventory-filters"].addEventListener("click", (event) => {
    const button = event.target.closest("[data-inventory-filter]");
    if (!button) return;
    state.inventoryFilter = button.dataset.inventoryFilter;
    state.listPages.inventory = 0;
    renderInventory();
  });
  elements["character-card-dialog"].addEventListener("click", (event) => {
    if (event.target === elements["character-card-dialog"]) {
      closeCharacterCard();
      return;
    }
    const button = event.target.closest("[data-page-list]");
    if (!button) return;
    const key = button.dataset.pageList;
    if (key === "characterInfo") {
      state.characterInfoPage = Math.max(0, Math.min(3,
        state.characterInfoPage + Number(button.dataset.pageDirection)));
      renderCharacterInfoPage();
    } else if (key === "abilities") {
      state.listPages.abilities = Math.max(0,
        (state.listPages.abilities || 0) + Number(button.dataset.pageDirection));
      renderCharacter();
    } else {
      state.listPages[key] += Number(button.dataset.pageDirection);
      renderInventory();
    }
  });
  elements["store-screen"].addEventListener("click", (event) => {
    const button = event.target.closest("[data-page-list]");
    if (!button) return;
    state.listPages[button.dataset.pageList] += Number(button.dataset.pageDirection);
    renderShop();
  });
  elements["resume-game"].addEventListener("click", () => elements["pause-dialog"].close());
  const quitToMainMenu = () => {
    stopHeldMovement();
    for (const dialog of document.querySelectorAll("dialog[open]")) dialog.close();
    if (state.utilityDrawer) closeUtilityDrawer(false);
    if (state.run) saveRun();
    state.gameStarted = false;
    renderStartScreen();
  };
  elements["return-to-title"].addEventListener("click", quitToMainMenu);
  document.getElementById("settings-quit")?.addEventListener("click", quitToMainMenu);
  elements["return-after-delving"].addEventListener("click", returnToChiltomatlan);
  elements["town-interact-button"].addEventListener("click", interact);
  elements["dungeon-map"].addEventListener("pointerover", (event) => {
    if (event.pointerType !== "mouse") return;
    const tile = event.target.closest(".map-tile");
    if (!tile || state.run?.location !== "dungeon") return;
    const distance = distanceInSquares({ x: Number(tile.dataset.x), y: Number(tile.dataset.y) }, state.run.player);
    elements["turn-status"].textContent = distance === 1
      ? "Tap to move · Space or E interacts with nearby targets"
      : "Tap a neighboring tile to move";
  });
  elements["dungeon-map"].addEventListener("pointerleave", (event) => {
    if (event.pointerType !== "mouse" || !state.run || state.run.location !== "dungeon") return;
    const nearbyCombat = state.run.enemies.some((enemy) => enemy.alive &&
      (enemy.alerted || distanceInSquares(enemy, state.run.player) <= 7));
    elements["turn-status"].textContent = nearbyCombat
      ? "Combat · enemies respond after your action"
      : "Tap to move · one square per turn";
  });
  document.querySelectorAll("[data-move]").forEach((button) => {
    button.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
      touchMoveButtons.add(button);
      touchPointerButtons.set(event.pointerId, button);
      beginHeldMovement(button, event);
    });
    button.addEventListener("click", (event) => {
      if (touchMoveButtons.has(button)) {
        touchMoveButtons.delete(button);
        event.preventDefault();
        return;
      }
      const [dx, dy] = button.dataset.move.split(",").map(Number);
      movePlayer(dx, dy);
      event.currentTarget.blur();
    });
  });
  document.addEventListener("pointerup", (event) => {
    const button = touchPointerButtons.get(event.pointerId) || event.target.closest?.("[data-move]");
    if (!button || !touchMoveButtons.has(button)) return;
    touchPointerButtons.delete(event.pointerId);
    if (heldMove?.pointerId === event.pointerId) stopHeldMovement();
    window.setTimeout(() => touchMoveButtons.delete(button), 1000);
  });
  document.addEventListener("pointercancel", (event) => {
    const button = touchPointerButtons.get(event.pointerId) || event.target.closest?.("[data-move]");
    touchPointerButtons.delete(event.pointerId);
    if (heldMove?.pointerId === event.pointerId) stopHeldMovement();
    if (button) window.setTimeout(() => touchMoveButtons.delete(button), 1000);
  });
  document.addEventListener("lostpointercapture", (event) => {
    if (heldMove?.pointerId === event.pointerId) stopHeldMovement();
  }, true);
  document.addEventListener("pointerdown", (event) => {
    if (heldMove && event.target !== heldMove.button && !heldMove.button.contains(event.target)) {
      stopHeldMovement();
    }
  }, true);
  window.addEventListener("blur", clearTouchMovementInput);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearTouchMovementInput();
  });
  elements["dungeon-map"].addEventListener("click", (event) => {
    if (Date.now() < (state.suppressMapTapUntil || 0)) return;
    const tile = event.target.closest(".map-tile");
    if (!tile || state.run?.location !== "dungeon") return;
    const x = Number(tile.dataset.x);
    const y = Number(tile.dataset.y);
    if (state.lookMode) {
      inspectMapTile(tile);
      return;
    }
    const destination = { x, y };
    const distance = distanceInSquares(destination, state.run.player);
    if (distance === 0) {
      interact();
      return;
    }
    const revealedTrap = distance === 1 && state.run.hazards.find((hazard) =>
      !hazard.triggered && hazard.revealed && hazard.x === x && hazard.y === y);
    if (revealedTrap) {
      disarmNearbyHazard(revealedTrap);
      return;
    }
    if (distance === 1 && state.run.treasures.some((treasure) => treasure.x === x && treasure.y === y)) {
      collectTreasureAt(x, y);
      finishPlayerTurn();
      return;
    }
    const closedDoorDestination = state.run.terrain[tileIndex(x, y)] === "door" &&
      !state.run.openDoors.includes(tileIndex(x, y));
    if (distance === 1 && (canStepBetween(state.run.player, destination) || closedDoorDestination) &&
    ["floor", "corridor", "door", "creature", "hazard"].some((name) => tile.classList.contains(name))) {
    movePlayer(x - state.run.player.x, y - state.run.player.y);
    } else if (tile.title) {
    showToast(distance === 0 ? "You are standing here." : "Tap a clear neighboring tile to move one square.");
    }
  });
  let actionTooltipTimer = 0;
  document.addEventListener("pointerdown", (event) => {
    const button = event.target.closest(".action-buttons .button");
    if (!button) return;
    window.clearTimeout(actionTooltipTimer);
    actionTooltipTimer = window.setTimeout(() => button.classList.add("show-tip"), 450);
  });
  const releaseActionTooltip = () => {
    window.clearTimeout(actionTooltipTimer);
    window.setTimeout(() => document.querySelectorAll(".action-buttons .show-tip").forEach((button) => button.classList.remove("show-tip")), 900);
  };
  document.addEventListener("pointerup", releaseActionTooltip);
  document.addEventListener("pointercancel", releaseActionTooltip);
  document.addEventListener("click", (event) => {
    const dialog = event.target;
    if (!(dialog instanceof HTMLDialogElement) || !dialog.open || dialog.id === "game-over-dialog" ||
      (dialog.id === "patolli-dialog" && state.run?.patolliGame?.status === "active")) return;
    dialog.close();
  });
  document.addEventListener("keydown", (event) => {
    stopHeldMovement();
    if (state.messageBox) {
      if (event.repeat) return;
      if (event.key === "Escape") {
        event.preventDefault();
        dismissRpgMessage();
      } else if (event.key === "Enter" || event.code === "Space") {
        event.preventDefault();
        advanceRpgMessage();
      }
      return;
    }
    if (event.repeat) return;
    if (event.key === "Escape") {
      const dialog = document.querySelector("dialog[open]");
      if (dialog) {
        event.preventDefault();
        if (dialog.id === "game-over-dialog" ||
          (dialog.id === "patolli-dialog" && state.run?.patolliGame?.status === "active")) return;
        if (dialog === elements["character-card-dialog"]) closeCharacterCard();
        else dialog.close();
        return;
      }
    }
    if (event.key === "Escape" && state.utilityDrawer) {
      event.preventDefault();
      closeUtilityDrawer(true);
      return;
    }
    if (event.key === "Escape" && state.lookMode) {
      event.preventDefault();
      toggleLookMode();
      return;
    }
    if (event.key === "Escape" && elements["pause-dialog"].open) {
      event.preventDefault();
      elements["pause-dialog"].close();
      return;
    }
    if ((event.key === "+" || event.key === "=" || event.key === "-" || event.key === "_") && !event.ctrlKey && !event.metaKey &&
      state.gameStarted && ["city", "dungeon"].includes(state.run?.location) && !document.querySelector("dialog[open]") &&
      !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement)) {
      event.preventDefault();
      setMapZoom(mapZoom + (event.key === "+" || event.key === "=" ? 1 : -1), { announce: true });
      return;
    }
    if (event.key === "Escape" && !document.querySelector("dialog[open]") && state.run?.location === "dungeon") {
      event.preventDefault();
      pauseGame();
      return;
    }
    // Menu keys work while the adventurer card is open, to flip between its tabs.
    const menuKey = MENU_KEYS[event.key.toLowerCase()];
    if (menuKey && state.gameStarted && state.run && !event.ctrlKey && !event.metaKey && !event.altKey &&
      !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement)) {
      const openDialog = document.querySelector("dialog[open]");
      if (!openDialog || openDialog === elements["character-card-dialog"]) {
        event.preventDefault();
        if (openDialog && state.characterTab === menuKey) closeCharacterCard();
        else {
          openCharacterCard();
          selectCharacterTab(menuKey);
          render();
        }
        return;
      }
    }
    if (!state.run || document.querySelector("dialog[open]") ||
      !["dungeon", "city"].includes(state.run.location) || event.altKey || event.ctrlKey || event.metaKey ||
      event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement) return;
    if (event.key.toLowerCase() === "j") {
      event.preventDefault();
      toggleUtilityDrawer("journal");
      return;
    }
    if (state.utilityDrawer) return;
    if ((event.code === "Space" || event.key === "Enter") && event.target instanceof HTMLButtonElement) return;
    const interactKey = event.code === "Space" || event.key === "Enter" || (event.key.toLowerCase() === "e" && !event.shiftKey);
    if (state.run.location === "city") {
      if (interactKey) {
        event.preventDefault();
        interact();
        return;
      }
      const direction = MOVEMENT_DIRECTIONS.find((entry) =>
        entry.keys.includes(event.code) || entry.keys.includes(event.key) || entry.keys.includes(event.key.toLowerCase())
      );
      if (direction) {
        event.preventDefault();
        moveTownPlayer(direction.x, direction.y);
      }
      return;
    }
    if (event.key.toLowerCase() === "l") {
      event.preventDefault();
      toggleLookMode();
      return;
    }
    if (interactKey) {
      event.preventDefault();
      const returnButton = elements["return-after-delving"];
      if (returnButton.dataset.shortcut && !returnButton.disabled && !returnButton.classList.contains("hidden")) returnButton.click();
      else interact();
      return;
    }
    if (event.code === "Numpad5" || event.key === "Clear") {
      event.preventDefault();
      waitTurn();
      return;
    }
    const direction = !event.shiftKey && MOVEMENT_DIRECTIONS.find((entry) =>
      entry.keys.includes(event.code) || entry.keys.includes(event.key) || entry.keys.includes(event.key.toLowerCase())
    );
    if (direction) {
      event.preventDefault();
      movePlayer(direction.x, direction.y);
    } else {
      const shortcut = `${event.shiftKey && event.key.length === 1 && /[a-z]/i.test(event.key) ? "shift+" : ""}${event.key.toLowerCase()}`;
      const actionButton = [...document.querySelectorAll("#action-buttons [data-shortcut]")]
        .find((button) => button.dataset.shortcut.split(" ").includes(shortcut) && !button.disabled);
      if (actionButton) {
        event.preventDefault();
        actionButton.click();
      }
    }
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  navigator.serviceWorker.register("./sw.js").catch((error) => {
    showToast(`Offline support could not be enabled: ${escapeMessage(error)}`);
  });
}

function start() {
  updatePwaInstallOption();
  window.matchMedia("(display-mode: standalone)").addEventListener?.("change", updatePwaInstallOption);
  storageAvailable();
  let language = "en";
  let darkMode = false;
  let font = "unifont";
  try {
    language = localStorage.getItem(STORE_KEYS.language) || "en";
    darkMode = localStorage.getItem(STORE_KEYS.darkMode) === "true";
    font = localStorage.getItem(STORE_KEYS.font) || "unifont";
  } catch (error) {
    console.warn(`Could not read display preferences: ${escapeMessage(error)}`);
  }
  window.cryptsLocale.apply(language);
  elements["language-select"].value = window.cryptsLocale.language;
  elements["font-select"].value = applyFontChoice(font);
  document.body.classList.toggle("dark-mode", darkMode);
  elements["dark-mode-toggle"].checked = darkMode;
  let padSize = "large";
  let savedZoom = 0;
  try {
    padSize = localStorage.getItem(STORE_KEYS.padSize) || "large";
    savedZoom = Number(localStorage.getItem(STORE_KEYS.mapZoom) || 0);
  } catch { /* private mode */ }
  const padSelect = document.getElementById("pad-size-select");
  if (padSelect) padSelect.value = applyPadSize(padSize);
  setMapZoom(savedZoom);
  loadState();
  connectEvents();
  renderStartScreen();
  registerServiceWorker();
}

window.cryptsLocale.ready.then(start).catch((error) => {
  console.error(error);
  const notice = document.createElement("p");
  notice.setAttribute("role", "alert");
  notice.textContent = `The language catalogs could not be loaded: ${escapeMessage(error)}`;
  document.body.append(notice);
});
