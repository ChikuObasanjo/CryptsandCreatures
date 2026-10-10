"use strict";

window.CryptsItems = {
  food: {
    ration: { name: "Maize-and-bean travel cake", sprite: "ration", nutrients: { protein: 30, carbohydrates: 30, greens: 30 }, food: 55 },
    "smoked-fish": { name: "Smoked river fish", sprite: "smoked-fish", nutrients: { protein: 55, carbohydrates: 5, greens: 10 }, food: 50 },
    chilis: { name: "Chilies", sprite: "chilis", nutrients: { protein: 5, carbohydrates: 55, greens: 20 }, food: 45 },
    soup: { name: "Soup", sprite: "soup", nutrients: { protein: 15, carbohydrates: 10, greens: 55 }, food: 45 },
    "monster-meat": { name: "Cave creature meat", sprite: "supply", nutrients: { protein: 65, carbohydrates: 5, greens: 5 }, food: 45 }
  },
  nutrientAbilities: { protein: "str", carbohydrates: "dex", greens: "wis" },
  nutrientNames: { protein: "Protein", carbohydrates: "Carbohydrates", greens: "Greens" },
  rareTreasureSprites: ["jade-pectoral", "incensario", "obsidian-mirror"],
  dungeonKeepsakeLoot: [
    "travel-cloak", "travel-clothes", "common-clothes", "dark-clothes", "fine-clothes",
    "prayer-token", "gold-ring", "family-scroll", "sealed-letter", "insignia", "trophy"
  ],
  weapons: {
    dagger: { name: "Obsidian belt knife", description: "A small obsidian blade, carried at the belt for close work.", dice: "1d4", finesse: true, icon: "dagger" },
    macuahuitl: { name: "Macuahuitl", description: "A hardwood club edged with razor-sharp obsidian flakes; the signature weapon of a trained warrior.", dice: "1d8", icon: "macuahuitl" },
    shortsword: { name: "Hardwood baton", description: "A compact hardwood club shaped for quick strikes.", dice: "1d6", finesse: true, icon: "sword" },
    rapier: { name: "Fine obsidian blade", description: "A slender, balanced blade of wood and sharpened stone.", dice: "1d8", finesse: true, icon: "sword" },
    longsword: { name: "Obsidian-edged hardwood blade", description: "A broad wooden sword edged with embedded obsidian blades.", dice: "1d8", icon: "sword" },
    greatsword: { name: "Great obsidian-edged blade", description: "A large two-handed hardwood sword set with stone edges.", dice: "2d6", icon: "sword" },
    greataxe: { name: "Stone-edged war axe", description: "A broad stone-edged haft weapon; its opposite side can serve as a blunt striking face.", dice: "1d12", icon: "axe" },
    warhammer: { name: "Stone-headed war club", description: "A hardwood haft capped with a heavy stone or copper sphere.", dice: "1d8", icon: "hammer" },
    mace: { name: "Hardwood club", description: "A simple hardwood club capped with stone or copper.", dice: "1d6", icon: "mace" },
    scimitar: { name: "Obsidian-edged short blade", description: "A light curved blade fitted for quick, precise strikes.", dice: "1d6", finesse: true, icon: "sword" },
    quarterstaff: { name: "Hardwood staff", description: "A sturdy hardwood baton useful on the trail as well as in a fight.", dice: "1d6", icon: "staff" },
    spear: { name: "Tepoztopilli spear", description: "A long hardwood spear fitted with an obsidian-edged head.", dice: "1d6", icon: "spear" },
    atlatl: { name: "Atlatl and darts", description: "A spear-thrower and balanced darts for striking foes at range.", dice: "1d6", ranged: true, icon: "spear" },
    shortbow: { name: "Hunting bow", description: "A compact bow of flexible wood, strung with animal sinew.", dice: "1d6", ranged: true, icon: "bow" },
    longbow: { name: "Jungle-wood war bow", description: "A flexible-wood bow strung with animal sinew.", dice: "1d8", ranged: true, icon: "bow" },
    "light-crossbow": { name: "Foreign light crossbow", description: "A compact imported weapon, unfamiliar beside local bows and dart-throwers.", dice: "1d8", ranged: true, icon: "bow" },
    handaxe: { name: "Stone-edged hand axe", description: "A small hafted tool with a sharpened stone head.", dice: "1d6", icon: "axe" }
  },
  armors: {
    none: { name: "No armor", base: 10, dex: true },
    leather: { name: "Treated hide vest", description: "Flexible hide armor made for movement through jungle and stone.", base: 11, dex: true },
    hide: { name: "Layered hide armor", description: "Overlapping treated hides offer sturdy protection without metal.", base: 12, dex: true, dexCap: 2 },
    scale: { name: "Ichcahuipilli (quilted cotton)", description: "Layered cotton armor, quilted to absorb blows and resist obsidian edges.", base: 14, dex: true, dexCap: 2 },
    chainmail: { name: "Foreign iron chain mail", description: "Heavy linked metal armor brought by overseas traders; rarely seen this far inland.", base: 16, dex: false, strength: 13 }
  },
  weaponPrices: {
    dagger: [1, 2], macuahuitl: [4, 15], atlatl: [3, 5], shortsword: [2, 10], rapier: [2, 25], longsword: [3, 15], greatsword: [6, 50],
    greataxe: [7, 30], warhammer: [2, 15], mace: [4, 5], scimitar: [3, 25], quarterstaff: [4, 0.2],
    spear: [3, 1], shortbow: [2, 25], longbow: [2, 50], "light-crossbow": [5, 25], handaxe: [2, 5]
  },
  armorPrices: {
    leather: [10, 10], hide: [12, 10], scale: [45, 50], chainmail: [55, 75]
  },
  cosmetics: {
    "jaguar-helmet": { name: "Jaguar helm", slot: "helmet", set: "jaguar", price: 1500, description: "A spotted feline helm with gilded brow plates." },
    "jaguar-clothes": { name: "Jaguar regalia", slot: "clothes", set: "jaguar", price: 2500, description: "Gold-and-obsidian battle regalia marked with jaguar rosettes." },
    "eagle-helmet": { name: "Eagle helm", slot: "helmet", set: "eagle", price: 2000, description: "A feathered eagle helm with a sweeping jade crest." },
    "eagle-clothes": { name: "Eagle regalia", slot: "clothes", set: "eagle", price: 3500, description: "Jade, ivory, and feathered regalia inspired by the eagle." },
    "tzitzimitl-helmet": { name: "Tzitzimitl crown", slot: "helmet", set: "tzitzimitl", price: 3500, description: "A bone-white star-demon crown with curling horns." },
    "tzitzimitl-clothes": { name: "Tzitzimitl vestments", slot: "clothes", set: "tzitzimitl", price: 5000, description: "Midnight vestments traced with bones and fallen stars." }
  },
  gear: {
    "travel-bundle": { name: "Travel Bundle", weight: 18, price: 12, category: "Kit", description: "A compact bedroll, cooking gear, and shared camp supplies. +1 Cooking and Survival while carried.", skillBonuses: { cooking: 1, survival: 1 } },
    "explorer-pack": { name: "Legacy travel pack", weight: 59, price: 10, category: "Kit", description: "An older expedition pack retained for existing saves." },
    "dungeoneer-pack": { name: "Tomb-delver's bundle", weight: 61, price: 12, category: "Kit", description: "A delver's bundle of cord, tools, light, and provisions. +1 Perception while carried.", skillBonuses: { perception: 1 } },
    "priest-pack": { name: "Shrine-keeper's bundle", weight: 24, price: 19, category: "Kit", description: "A shrine-keeper's light travel kit with useful provisions. +1 Cooking while carried.", skillBonuses: { cooking: 1 } },
    "burglar-pack": { name: "Quiet-traveler's bundle", weight: 47, price: 16, category: "Kit", description: "A compact bundle of tools and dark cloth for quiet work. +1 Sleight of Hand while carried.", skillBonuses: { "sleight-of-hand": 1 } },
    "entertainer-pack": { name: "Storyteller's bundle", weight: 38, price: 40, category: "Kit", description: "Performance and travel supplies for a lively camp. +1 Cooking while carried.", skillBonuses: { cooking: 1 } },
    "travel-cloak": { name: "Feathered mantle", weight: 3, price: 1, category: "Clothing", slot: "cloak", description: "A light mantle of woven cloth and feathers; changes your adventurer's sprite." },
    shield: { name: "Feathered shield", weight: 6, price: 10, category: "Armor", slot: "shield", description: "A light shield of cane, wood, or hide, decorated with bright feathers." },
    "healing-potion": { name: "Medicine", weight: 0.5, price: 50, category: "Potion", description: "A collection of herbs and bandages. Use at any food level to regain 2d4 + 2 hit points." },
    "dungeon-gourmet-guide": { name: "Dungeon Gourmet Guide", weight: 1, price: 8, category: "Keepsake", description: "A field guide to edible tomb creatures. Permanently teaches you to identify and collect meat from suitable dungeon monsters." },
    "monster-meat": { name: "Cave creature meat", weight: 1.5, price: 0.5, category: "Food", sprite: "supply", description: "Fresh, protein-rich meat from an edible cave creature. Restores food and supports protein." },
    "healer-kit": { name: "first aid bag", weight: 3, price: 5, category: "Tool", description: "10 uses. Treat a downed companion to restore 1 hit point." },
    torch: { name: "Resinwood torch", weight: 1, price: 0.1, category: "Supply", description: "Burn one to light nearby map tiles. Search separately to detect hidden hazards." },
    "hempen-rope": { name: "Maguey-fiber cord (50 ft.)", weight: 10, price: 1, category: "Supply", description: "Pull a revealed trap from up to 50 feet away without standing on it." },
    ration: { name: "Tamale", weight: 2, price: 0.5, category: "Food", description: "A simple bean and meat tamale." },
    "smoked-fish": { name: "Smoked river fish", weight: 1, price: 0.8, category: "Food", description: "Protein-rich smoked fish. Restores food and strongly supports protein." },
    chilis: { name: "Chilies", weight: 1, price: 0.5, category: "Food", description: "Fresh chilies gathered in the jungle. Restore food and strongly support carbohydrates." },
    soup: { name: "Soup", weight: 1, price: 0.6, category: "Food", description: "A warm herb and squash soup. Restores food and strongly supports greens." },
    "clean-water": { name: "Water", weight: 2, price: 0.2, category: "Drink", description: "A filled gourd of safe drinking water; drinking restores 70% hydration." },
    "wild-ingredients": { name: "foraged food", weight: 1, price: 0.3, category: "Food", description: "Cook at camp for one or more daily meals. A clay cooking pot improves the Cooking check." },
    "jade-bead": { name: "Jade bead", weight: 0.1, price: 5, category: "Treasure", sprite: "jade-bead", description: "A polished greenstone ornament valued by collectors and traders in Chiltomatlan." },
    "terracotta-figurine": { name: "Terracotta Figurine", weight: 2, price: 25, category: "Treasure", sprite: "terracotta-figurine", description: "A small painted terracotta bird, valued by collectors and traders in Chiltomatlan." },
    "jade-pectoral": { name: "Jade Pectoral", weight: 1, price: 120, category: "Treasure", sprite: "jade-pectoral", description: "A rare greenstone pectoral; collectors in Chiltomatlan will pay well for it." },
    incensario: { name: "Incensario", weight: 2, price: 90, category: "Treasure", sprite: "incensario", description: "A feathered incense burner, prized by shrine keepers." },
    "obsidian-mirror": { name: "Obsidian Mirror", weight: 1, price: 160, category: "Treasure", sprite: "obsidian-mirror", description: "A rare polished mirror of black glass." },
    "prayer-token": { name: "Woven prayer token", weight: 0.1, price: 1, category: "Keepsake", description: "A devotional focus for camp. +1 Cooking while carried; keep it or trade it.", skillBonuses: { cooking: 1 } },
    "travel-clothes": { name: "Cotton travel wrap", weight: 3, price: 0.5, category: "Clothing", description: "Light cotton clothing for travel; customize your outfit's cut and colors in character creation." },
    "fine-clothes": { name: "Dyed cotton finery", weight: 6, price: 15, category: "Clothing", description: "Fine dyed cloth for ceremonies and formal visits; customize your outfit in character creation." },
    "gold-ring": { name: "Gold Ring", weight: 0.1, price: 5, category: "Keepsake", sprite: "gold-ring", description: "A ring of gold; the market pays 10% more for your sales while you carry it." },
    "field-notes": { name: "Field notes", weight: 1, price: 1, category: "Keepsake", description: "+1 Perception while carried: recorded observations help you search the tomb.", skillBonuses: { perception: 1 } },
    "artisan-tools": { name: "Artisan's hide bag", weight: 5, price: 10, category: "Tool", description: "Craft supplies in a hide bag. +1 Cooking while carried.", skillBonuses: { cooking: 1 } },
    "gaming-set": { name: "Carved gaming set", weight: 0.5, price: 1, category: "Keepsake", description: "A game for passing the camp watch. +1 Cooking while carried; keep it or trade it.", skillBonuses: { cooking: 1 } },
    "common-clothes": { name: "Everyday cotton wrap", weight: 3, price: 0.5, category: "Clothing", description: "Everyday cotton clothing; customize your outfit's cut and colors in character creation." },
    "dark-clothes": { name: "Dusk-colored cotton wrap", weight: 3, price: 1, category: "Clothing", description: "Quiet, dark-dyed cotton clothing. +1 Sleight of Hand while carried; customize your outfit's cut and colors in character creation.", skillBonuses: { "sleight-of-hand": 1 } },
    crowbar: { name: "Iron pry bar", weight: 5, price: 2, category: "Tool", description: "An imported iron bar; grants advantage on a Strength check to pry apart an exposed trap mechanism." },
    shovel: { name: "Wooden digging blade", weight: 5, price: 2, category: "Tool", description: "+2 Survival while carried: a digging blade helps gather safe food and herbs.", skillBonuses: { survival: 2 } },
    "iron-pot": { name: "Clay cooking pot", weight: 10, price: 2, category: "Supply", description: "+2 Cooking while carried: prepare mayz, beans, and foraged food at camp.", skillBonuses: { cooking: 2 } },
    insignia: { name: "Carved company token", weight: 0, price: 1, category: "Keepsake", description: "A small keepsake from a traveling company, cut with its old mark." },
    trophy: { name: "Battle trophy", weight: 1, price: 1, category: "Keepsake", description: "A token of a hard-won fight; keep it as a keepsake or trade it." },
    "ink-bottle": { name: "Ink made from soot and dye", weight: 0.1, price: 10, category: "Tool", description: "+1 Perception while carried: useful for recording details during a careful search.", skillBonuses: { perception: 1 } },
    quill: { name: "Feather quill", weight: 0, price: 0.1, category: "Tool", description: "+1 Perception while carried: useful for recording details during a careful search.", skillBonuses: { perception: 1 } },
    "small-knife": { name: "Utility knife", weight: 1, price: 2, category: "Tool", description: "+1 Survival while carried: prepare gathered food and cut useful fibers.", skillBonuses: { survival: 1 } },
    "family-scroll": { name: "Family record", weight: 0.1, price: 1, category: "Keepsake", description: "A family record to preserve or trade; a piece of your adventurer's story." },
    "sealed-letter": { name: "Sealed letter", weight: 0.1, price: 1, category: "Keepsake", description: "A personal letter to preserve or trade; a piece of your adventurer's story." }
  },
  classPacks: {
    barbarian: "travel-bundle", bard: "travel-bundle", cleric: "travel-bundle", druid: "travel-bundle",
    fighter: "travel-bundle", monk: "travel-bundle", paladin: "travel-bundle", ranger: "travel-bundle",
    rogue: "travel-bundle", sorcerer: "travel-bundle", warlock: "travel-bundle", wizard: "travel-bundle"
  },
  legacyTravelPackIds: [
    "explorer-pack", "dungeoneer-pack", "priest-pack", "burglar-pack", "entertainer-pack"
  ]
};
