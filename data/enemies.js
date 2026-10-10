"use strict";

window.CryptsEnemies = {
  sprites: [
    "cenote-stalker", "yohualtepoztli", "camazotz", "duende",
    "jungle-jaguar", "feathered-serpent", "tomb-bat", "maztican-cave-locust",
    "mictlaneca", "quinametli", "caxtiltecatl", "axolocatl", "tzitzimitl", "cihuateotl"
  ],
  starter: [
    { id: "maztican-cave-locust", name: "Hueychapolin", description: "A giant grasshopper.", sprite: "maztican-cave-locust", edible: true, hp: 4, ac: 13, attackBonus: 3, damage: "1d4", initiativeBonus: 2, xp: 10 },
    { id: "mictlaneca", name: "Mictecatl", description: "A long-dead tomb dweller still wearing the traces of another life.", sprite: "mictlaneca", hp: 8, ac: 8, attackBonus: 3, damage: "1d6+1", initiativeBonus: 0, xp: 25 },
    { id: "tomb-bat", name: "Tomb Bat", description: "A pale bat flits through the dark halls, snapping at anything that disturbs its roost.", sprite: "tomb-bat", hp: 5, ac: 13, attackBonus: 4, damage: "1d4+2", initiativeBonus: 3, xp: 15 },
    { id: "duende", name: "Duende", description: "A small, uncanny spirit darts between the stones, luring travelers away from the safe path.", sprite: "duende", hp: 7, ac: 13, attackBonus: 4, damage: "1d6+1", initiativeBonus: 2, xp: 25 },
    { id: "jungle-jaguar", name: "Jungle Jaguar", description: "A silent spotted hunter prowls the buried halls, its paws soundless on the stone.", sprite: "jungle-jaguar", edible: true, hp: 15, ac: 14, attackBonus: 5, damage: "1d8+3", initiativeBonus: 3, xp: 75 },
    { id: "cihuateotl", name: "Cihuateotl", description: "A fierce spirit haunts the tomb, its grief sharpened into a danger to the living.", sprite: "cihuateotl", hp: 22, ac: 15, attackBonus: 6, damage: "1d8+3", initiativeBonus: 2, xp: 200 },
    { id: "quinametli", name: "Quinametli", description: "One of the giant men of the first world, arrogant and merciless, their world was destroyed by the teteotl.", sprite: "quinametli", hp: 11, ac: 14, attackBonus: 3, damage: "1d6+1", initiativeBonus: 0, xp: 25 },
    { id: "caxtiltecatl", name: "Caxtiltecatl", description: "Sea giants that live in floating houses on the ocean, only landing to raid.", gear: "Foreign iron chain mail and a steel sword", sprite: "caxtiltecatl", hp: 18, ac: 16, attackBonus: 5, damage: "1d8+3", initiativeBonus: 1, xp: 125 },
    { id: "feathered-serpent", name: "Feathered Serpent", description: "A great serpent, crowned in feathers, coils through the deepest chambers and strikes with terrible force.", sprite: "feathered-serpent", hp: 32, ac: 16, attackBonus: 7, damage: "2d8+4", initiativeBonus: 2, xp: 500 },
    { id: "tzitzimitl", name: "Tzitzimitl", description: "A star, one of the lady gods, has come descended from heaven.", gear: "Starless obsidian plates and hooked claws", sprite: "tzitzimitl", minLevel: 10, hp: 88, ac: 17, attackBonus: 9, damage: "2d10+6", initiativeBonus: 4, xp: 3000 },
    { id: "axolocatl", name: "Axolocatl", description: "A tribal salamander man. They often take shelter in damp places when it gets dry.", sprite: "axolocatl", edible: true, hp: 11, ac: 12, attackBonus: 4, damage: "1d6+2", initiativeBonus: 2, xp: 50 },
    { id: "yohualtepoztli", name: "Yohualtepoztli", description: "A night-axe spirit stalks the tomb.", sprite: "yohualtepoztli", hp: 9, ac: 12, attackBonus: 3, damage: "1d6+1", initiativeBonus: 0, xp: 25 },
    { id: "cenote-stalker", name: "Cenote Stalker", description: "A mischivous little rascal that likes drowning people to eat their teeth and fingernails.", sprite: "cenote-stalker", edible: true, hp: 12, ac: 13, attackBonus: 4, damage: "1d6+2", initiativeBonus: 2, xp: 40 },
    { id: "camazotz", name: "Camazotz", description: "A man bat.", sprite: "camazotz", hp: 20, ac: 14, attackBonus: 5, damage: "1d8+2", initiativeBonus: 1, xp: 75 }
  ]
};
