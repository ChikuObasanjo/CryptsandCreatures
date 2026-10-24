"use strict";

window.CryptsEnemies = {
  sprites: [
    "cenote-stalker", "yohualtepoztli", "camazotz", "duende",
    "jungle-jaguar", "feathered-serpent", "tomb-bat", "maztican-cave-locust",
    "mictlaneca", "quinametli", "caxtiltecatl", "axolocatl", "tzitzimitl", "cihuateotl",
    "xolo-hound", "colotl", "tlacatecolotl", "huay-chivo", "itzpapalotl", "cipactli"
  ],
  starter: [
    { id: "maztican-cave-locust", name: "Hueychapolin", description: "A grasshopper the size of a dog, fat on the tomb's mushrooms. Roasted, it tastes like chapulines with ambition.", sprite: "maztican-cave-locust", edible: true, hp: 4, ac: 13, attackBonus: 3, damage: "1d4", initiativeBonus: 2, xp: 10 },
    { id: "mictlaneca", name: "Mictecatl", description: "A long-dead tomb dweller still wearing the traces of another life.", sprite: "mictlaneca", hp: 8, ac: 8, attackBonus: 3, damage: "1d6+1", initiativeBonus: 0, xp: 25 },
    { id: "tomb-bat", name: "Tomb Bat", description: "A pale bat flits through the dark halls, snapping at anything that disturbs its roost.", sprite: "tomb-bat", hp: 5, ac: 13, attackBonus: 4, damage: "1d4+2", initiativeBonus: 3, xp: 15 },
    { id: "duende", name: "Duende", description: "A small, uncanny spirit darts between the stones, luring travelers away from the safe path.", sprite: "duende", hp: 7, ac: 13, attackBonus: 4, damage: "1d6+1", initiativeBonus: 2, xp: 25 },
    { id: "jungle-jaguar", name: "Jungle Jaguar", description: "A silent spotted hunter prowls the buried halls, its paws soundless on the stone.", sprite: "jungle-jaguar", edible: true, hp: 15, ac: 14, attackBonus: 5, damage: "1d8+3", initiativeBonus: 3, xp: 75 },
    { id: "cihuateotl", name: "Cihuateotl", description: "The spirit of a woman who died in childbirth, honored as a fallen warrior. She walks the crossroads at dusk and has no patience for the living.", sprite: "cihuateotl", hp: 22, ac: 15, attackBonus: 6, damage: "1d8+3", initiativeBonus: 2, xp: 200 },
    { id: "quinametli", name: "Quinametli", description: "A giant left over from the first sun, a world the gods unmade. Arrogant, ancient, and very hard to kill.", sprite: "quinametli", hp: 11, ac: 14, attackBonus: 3, damage: "1d6+1", initiativeBonus: 0, xp: 25 },
    { id: "caxtiltecatl", name: "Caxtiltecatl", description: "A sea giant from the floating houses, sealed in iron and come ashore to raid. Its sword never chips.", gear: "Foreign iron chain mail and a steel sword", sprite: "caxtiltecatl", hp: 18, ac: 16, attackBonus: 5, damage: "1d8+3", initiativeBonus: 1, xp: 125 },
    { id: "feathered-serpent", name: "Feathered Serpent", description: "A great serpent, crowned in feathers, coils through the deepest chambers and strikes with terrible force.", sprite: "feathered-serpent", hp: 32, ac: 16, attackBonus: 7, damage: "2d8+4", initiativeBonus: 2, xp: 500 },
    { id: "tzitzimitl", name: "Tzitzimitl", description: "A star-demon fallen from the night sky, one of the skeletal goddesses waiting to devour the sun when the world ends.", gear: "Starless obsidian plates and hooked claws", sprite: "tzitzimitl", minLevel: 10, hp: 88, ac: 17, attackBonus: 9, damage: "2d10+6", initiativeBonus: 4, xp: 3000 },
    { id: "axolocatl", name: "Axolocatl", description: "A gilled salamander-person of the cenotes who retreats to damp places in the dry season. Territorial, but not cruel.", sprite: "axolocatl", edible: true, hp: 11, ac: 12, attackBonus: 4, damage: "1d6+2", initiativeBonus: 2, xp: 50 },
    { id: "yohualtepoztli", name: "Yohualtepoztli", description: "The Night Axe: a headless spirit whose open chest thuds like an axe biting wood. If you hear it, it is already close.", sprite: "yohualtepoztli", hp: 9, ac: 12, attackBonus: 3, damage: "1d6+1", initiativeBonus: 0, xp: 25 },
    { id: "cenote-stalker", name: "Cenote Stalker", description: "An ahuizotl: a small, dog-like water beast with a hand at the end of its tail. It drowns the careless and takes only their eyes, teeth, and nails.", sprite: "cenote-stalker", edible: true, hp: 12, ac: 13, attackBonus: 4, damage: "1d6+2", initiativeBonus: 2, xp: 40 },
    { id: "xolo-hound", name: "Xolotl Hound", description: "A hairless black dog of the underworld with bones painted on its ribs. It is supposed to guide the dead across the river, and it does not like the living.", sprite: "xolo-hound", hp: 9, ac: 12, attackBonus: 4, damage: "1d6+1", initiativeBonus: 3, xp: 30 },
    { id: "colotl", name: "Colotl", description: "A scorpion as long as a canoe that hunts in the dry, hot chambers. Its sting burns for days. Its tail meat, roasted, is a delicacy.", sprite: "colotl", edible: true, hp: 10, ac: 14, attackBonus: 4, damage: "1d6+1", initiativeBonus: 1, xp: 40 },
    { id: "tlacatecolotl", name: "Tlacatecolotl", description: "An owl-man: a sorcerer who sold himself to the night. His hoot drains the strength from your arms.", sprite: "tlacatecolotl", hp: 16, ac: 13, attackBonus: 5, damage: "1d8+2", initiativeBonus: 2, xp: 90 },
    { id: "huay-chivo", name: "Huay Chivo", description: "A witch who walks at night as a goat-headed beast, with burning red eyes and a sour smell.", sprite: "huay-chivo", hp: 18, ac: 13, attackBonus: 5, damage: "1d8+3", initiativeBonus: 2, xp: 110 },
    { id: "itzpapalotl", name: "Itzpapalotl", description: "The Obsidian Butterfly, a skeletal goddess whose wings are edged with blades of black glass.", sprite: "itzpapalotl", hp: 30, ac: 16, attackBonus: 7, damage: "2d6+4", initiativeBonus: 3, xp: 450 },
    { id: "cipactli", name: "Cipactli", description: "The great caiman of the first waters, with a mouth at every joint. The gods made the earth from one of its kind.", sprite: "cipactli", edible: true, hp: 40, ac: 15, attackBonus: 7, damage: "2d8+3", initiativeBonus: 0, xp: 500 },
    { id: "camazotz", name: "Camazotz", description: "The death bat of the underworld, as tall as a man and utterly silent. It takes heads in the dark.", sprite: "camazotz", hp: 20, ac: 14, attackBonus: 5, damage: "1d8+2", initiativeBonus: 1, xp: 75 }
  ]
};
