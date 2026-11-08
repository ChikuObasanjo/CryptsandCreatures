"use strict";

// The other delvers: people from outside who come down into the tomb for its treasure, as
// you do. Who they are, what they carry in with them, and what they say. How they live is
// in systems/delvers.js.
//
// Most are Nahua, from Chiltomatlan and the Empire's towns. A few come from farther away,
// and those keep the world's rule (LORE.md): foreign peoples are described as foreign.
//   norse    the pale men from the north
//   samurai  envoys from across the western sea
//   otomi    Otomi warriors from the hills (the Mexica named an order of warriors after them)
//   maya     Yucatec Maya from the coast
//   wixarika Wixárika (Huichol) from the sierra west of Xalisco
//
// The world is a fantasy retelling of Mexico around Xalisco in the 1530s, so the peoples
// are ones who could be there then (the Norse and the Japanese envoys are the world's own
// fantastic travelers, as in LORE.md).
//
// Words in other languages are kept to a few well-attested ones: Nahuatl "niltze" (hello)
// and "tlazohcamati" (thank you); Otomi (Hñähñu) "ki hats'i" (good morning); Old Norse "heill" (hail, be well); Japanese "gomen
// kudasai" (said on entering someone's house) and "arigatō"; Yucatec "ba'ax ka wa'alik?"
// (what do you say?) and "ma'alob" (good); Wixárika "pamparius" (thank you).

window.CryptsDelvers = {
  // How likely each people is among the delvers drawn to the tomb each week.
  cultureWeights: { nahua: 78, otomi: 6, maya: 6, wixarika: 4, norse: 3, samurai: 3 },

  cultures: {
    nahua: {
      people: "Nahua",
      from: ["from Chiltomatlan", "from the lake city", "from a town on the jungle road", "from the coast road", "from the hill towns"],
      names: {
        man: ["Yaotl", "Mazatl", "Ocelotl", "Acatl", "Tecuani", "Itzcuin", "Coatl", "Cipac", "Tlacotzin", "Huitzil", "Tochtli", "Ozomatli"],
        woman: ["Ameyalli", "Miahuatl", "Quiahuitl", "Yoloxochitl", "Tonalxochitl", "Necahual", "Atototl", "Centehua", "Tlanextli", "Huitzilin"]
      },
      classes: { fighter: 20, ranger: 12, cleric: 9, rogue: 10, paladin: 7, barbarian: 7, druid: 7, bard: 6, monk: 5, sorcerer: 5, warlock: 5, wizard: 7 },
      gear: null, // each calling's own weapon and armor (data/character-options.js)
      skin: ["#9a603c", "#bb8054", "#8e6247", "#a96c45", "#9b5a3f", "#7c4a35", "#c48d58", "#70442f"],
      hair: ["#211a17", "#211a17", "#59402b"],
      lines: {
        greet: ["Niltze, delver. Mind the stairs; they're steeper going home.", "Another one from up top? Good. The dark is easier with company.",
          "Niltze! Don't worry, I'm not here for your share. Just mine.", "If you see a broken spear with a blue grip, it was my cousin's. Tell me where."],
        again: ["You again! Still breathing, then.", "Niltze. How deep did you get?", "We keep meeting. The tomb must like us."],
        talk: ["I came for enough gold to pay my family's tribute. A little more and I go home.", "My grandmother says the old lords drank whatever came up out of the earth. I just want their jade.",
          "Keep your water close. The deeper you go, the warmer the walls.", "They say if you feed the bowls, the dead let you pass. I always carry copal."],
        fight: ["Stay back, this one's mine!", "Come on, then!", "Ayya! Get away from me!"],
        flee: ["Too much! I'm going up.", "Not today. Not like this.", "I'm done. I'm going home with what I have."],
        loot: ["Ha! The old lords won't miss this.", "Jade! My mother will cry.", "Tlazohcamati, whoever buried this."],
        down: ["Deeper. That's where the real gold is.", "Down we go.", "One more floor."],
        home: ["That's enough for me. Tlazohcamati, tomb.", "I've got what I came for. I'm going up while I still can."],
        hungry: ["Do you feel the walls? The tomb is hungry. Don't take too much.", "It's warm down here today. Too warm. The tomb wants something."],
        dying: ["Tell them... I got farther than my cousin.", "Mother..."]
      }
    },
    otomi: {
      people: "Otomi",
      from: ["from the Otomi hills", "from Xilotepec"],
      names: {
        man: ["Ocotl", "Xiuhtzin", "Cuauhtzin", "Chimalli", "Tototl"],
        woman: ["Xocoyotl", "Coaxoch", "Quetzalxoch", "Tlacoehua"]
      },
      classes: { fighter: 40, barbarian: 30, ranger: 20, paladin: 10 },
      gear: { weapon: "macuahuitl", armor: "scale", shield: true },
      skin: ["#9a603c", "#8e6247", "#7c4a35", "#a96c45"],
      hair: ["#211a17"],
      lines: {
        greet: ["You're not from my hills, but you look like you can hold a club. Good.", "Ki hats'i! An Otomi greets you. Stay out of my way and we'll get along."],
        again: ["Still alive? Good for you.", "You again. The tomb hasn't eaten either of us yet."],
        talk: ["In the lake city they named a warrior order after my people. Down here, nobody's impressed.", "The Mexica pay us to fight their wars. This time I'm fighting for myself.",
          "My hills are cold and honest. This place is warm and lies."],
        fight: ["Otomi don't step back!", "Come and try it!"],
        flee: ["Even an Otomi knows when a fight is lost.", "Back! Back up the stairs!"],
        loot: ["This goes home to the hills.", "Good weight. Good."],
        down: ["Down. The deeper the fight, the better the story.", "Lower."],
        home: ["Enough. My village will eat well this year.", "I have what I came for. Back to the hills."],
        hungry: ["The stone's sweating. Something down here is hungry.", "This place wants a fight. I can feel it."],
        dying: ["Tell my village... I didn't step back.", "Not... a bad fight."]
      }
    },
    maya: {
      people: "Maya",
      from: ["from the Yucatec coast", "from Maní", "from a town in the east"],
      names: {
        man: ["Balam", "Kaan", "Chak", "Ek'", "Tuunich"],
        woman: ["Ix Nikte'", "Ix K'in", "Ix Kan", "Ix Sak"]
      },
      classes: { ranger: 25, druid: 20, cleric: 20, rogue: 15, wizard: 20 },
      gear: { weapon: "flint-lance", armor: "salt-cotton", shield: true },
      ranged: { ranger: "shortbow" },
      skin: ["#9a603c", "#bb8054", "#a96c45", "#c48d58"],
      hair: ["#211a17"],
      lines: {
        greet: ["Ba'ax ka wa'alik? You're far from the coast, and so am I.", "Ma'alob, another living face. I was starting to talk to the walls."],
        again: ["Ba'ax ka wa'alik, friend.", "You again! The underworld is smaller than they say."],
        talk: ["At home we call the place under the earth Metnal. This isn't it, but it's close.", "Our aluxob keep our fields. Down here they keep the old lords' things. I'd rather not meet one I owe.",
          "My grandmother told me never to take jade from the dead without leaving something. So I leave cacao."],
        fight: ["Get back!", "Come, then, and meet my lance!"],
        flee: ["No, no. Up. Now.", "I'm not dying this far from the sea."],
        loot: ["Jade! My grandmother would weep to see so much.", "Ma'alob. Very ma'alob."],
        down: ["Down. Let's see how deep it goes.", "One more stair."],
        home: ["I have enough. I'm going back to the coast.", "That's my share. The sea is waiting."],
        hungry: ["The walls are breathing harder. Leave it something, friend.", "It's hungry down here. Can you feel it?"],
        dying: ["The sea... I wanted to see the sea.", "Leave something... for me."]
      }
    },
    norse: {
      people: "Norse",
      foreign: true,
      from: ["one of the pale men from the north", "a pale man from across the northern sea"],
      names: {
        man: ["Thorvald", "Ketil", "Ulf", "Hallbjorn", "Eyvind"],
        woman: ["Sigrid", "Astrid", "Hallgerd", "Thora", "Gudrun"]
      },
      classes: { fighter: 55, barbarian: 45 },
      gear: { weapon: "ulfberht-sword", armor: "norse-byrnie", shield: true },
      skin: ["#f0d6c0", "#e8c4a6", "#dcae92"],
      hair: ["#d8c58c", "#a87a42", "#8a3d24", "#59402b"],
      lines: {
        greet: ["Heill! You're the first face down here that isn't trying to eat me.", "Heill, friend. Is it always this warm under your mountains?"],
        again: ["Heill again!", "Still on your feet? Good."],
        talk: ["We came across the sea for a spring that makes the old young. No spring. But gold, yes.", "At home the dead in the mounds don't stay quiet either. I know how to deal with them.",
          "My grandmother's sagas are full of mounds like this. They never end well for the one who robs them. We'll see."],
        fight: ["To me, then!", "Come and meet the iron!"],
        flee: ["Not today. I want to see the sea again.", "Back! This one's too much!"],
        loot: ["Silver is silver, whoever buried it.", "Ha! A good haul."],
        down: ["Down, then.", "Deeper. That's where the old ones keep the best of it."],
        home: ["My share's heavy enough. I'm going home to the north.", "Enough. Time to find a ship."],
        hungry: ["The rock is hungry. I've heard of mounds like this.", "Something down here wants feeding. I'd rather it wasn't me."],
        dying: ["Not here... so far from the sea.", "Tell them in the north..."]
      }
    },
    samurai: {
      people: "Japanese",
      foreign: true,
      from: ["an envoy from across the western sea", "one of the envoys who came with the galleons"],
      names: {
        man: ["Mori Kansuke", "Sato Tadamasa", "Ishikawa Genba", "Hayashi Gonzaemon", "Kuroda Hyoe"],
        woman: ["Sakai Kiku", "Ono Tsuru", "Kuroda Chiyo"]
      },
      classes: { fighter: 50, monk: 25, paladin: 25 },
      gear: { weapon: "katana", armor: "do-maru", shield: false },
      byClass: { monk: { weapon: "yari", armor: "none" } },
      skin: ["#dcae92", "#d6a77a", "#cdb08a", "#e8c4a6"],
      hair: ["#211a17"],
      lines: {
        greet: ["Gomen kudasai. Forgive me for entering your ancestors' house.", "You are a delver too? Then we walk the same road for a while."],
        again: ["We meet again. Good.", "Still here. So am I."],
        talk: ["My lord sent us with the ships. I stayed to see what lies under this town. A warrior should know the dead of the land he walks.",
          "I make an offering for everything I take. It is only polite.", "In my country, too, the dead are honored. Here they are also hungry."],
        fight: ["Come.", "Stand aside."],
        flee: ["There is no shame in a wise retreat.", "Not here. Not yet."],
        loot: ["I will leave something in its place.", "Arigatō, honored dead."],
        down: ["Deeper. I will see the bottom.", "Down."],
        home: ["I have enough to pay my passage home across the sea.", "Enough. I have seen what I came to see."],
        hungry: ["This place breathes. It is hungry. Be careful what you carry.", "The house of the dead is restless today."],
        dying: ["A good place to fall... still, so far from home.", "Ah. So this is the bottom."]
      }
    },
    wixarika: {
      people: "Wixárika (Huichol)",
      from: ["from the Wixárika sierra west of Xalisco", "from the mountains beyond Xalisco"],
      // The Nahuatl names their lowland neighbors know them by.
      names: {
        man: ["Mazatzin", "Tlecuil", "Ocoxochitl", "Cuauhmazatl"],
        woman: ["Xochitzin", "Tlecuiltzin", "Mazaxochitl", "Atlacuihque"]
      },
      classes: { ranger: 35, druid: 30, fighter: 20, cleric: 15 },
      gear: { weapon: "spear", armor: "leather", shield: true },
      ranged: { ranger: "shortbow" },
      skin: ["#9a603c", "#a96c45", "#8e6247", "#bb8054"],
      hair: ["#211a17"],
      lines: {
        greet: ["You're far from your fire, and I'm far from mine. Walk carefully.", "Someone living! The deer told me I'd meet someone down here."],
        again: ["You again. Good.", "Still walking? The deer is with you, then."],
        talk: ["Every year my people walk east to Wirikuta, where the sun was born. This is the other way. I wanted to see it.",
          "Grandfather Fire goes everywhere with us. Even down here, a little.",
          "The sea giants are burning towns on the coast below Xalisco. I came down here instead of waiting for them."],
        fight: ["Back, or meet my arrows!", "Come, then!"],
        flee: ["The deer knows when to run. So do I.", "Too many. I'm going."],
        loot: ["Pamparius. I'll leave a yarn offering in its place.", "Good. My family will eat this winter."],
        down: ["Down. The old ones are deeper.", "Lower."],
        home: ["Pamparius, old ones. I'm going back to the sierra.", "That's enough. The mountains are waiting."],
        hungry: ["The rock is hungry. Leave it something, the way we leave the gods their share.", "Something down here wants to be fed. Be careful."],
        dying: ["Grandfather Fire... I'm coming.", "Tell the sierra..."]
      }
    }
  },

  // What every delver brings in from outside: food, water, medicine, light, and sometimes copal.
  kit: [
    { id: "ration", min: 3, max: 6 },
    { id: "clean-water", min: 2, max: 4 },
    { id: "healing-potion", min: 0, max: 2 },
    { id: "torch", min: 1, max: 2 },
    { id: "copal", min: 0, max: 1 }
  ],

  // The Lord of the Mouth: the Tzitzimitl's human vessel (LORE.md).
  lord: {
    name: "Tenoch",
    title: "Lord of the Mouth",
    gender: "man",
    level: 20,
    class: "paladin",
    scores: { str: 20, dex: 10, con: 16, int: 12, wis: 14, cha: 18 },
    equipment: { weapon: "macuahuitl--lordly", armor: "jade-cuirass--lordly", shield: true, cloak: false },
    appearance: { skin: "#7c4a35", hair: "#211a17", hairStyle: "long", tunic: "#1f1d24", garment: "woven-tunic", adornment: "none", headwear: "none",
      facePaint: "black-band", face: "hawk", body: "broad", beard: "none", jewelry: "ear-spools", crest: "none", trim: "#e1ad3b" },
    cosmetics: { owned: ["tzitzimitl-helmet", "tzitzimitl-clothes"], helmet: "tzitzimitl-helmet", clothes: "tzitzimitl-clothes" },
    xp: 5000,
    description: "A paladin of the last age's oath, in the Tzitzimitl's vestments and crown, with a macuahuitl that has drunk a great deal. The star-demon bound across the mouth wears him as her lord.",
    lines: {
      greet: "“So. Another one comes down to the mouth. I was like you, once. Kneel, or be eaten.”",
      hurt: "“She will not let me fall so easily.”",
      heal: "Tenoch lays a hand on his own wounds, and something cold and starry closes them.",
      fall: "Tenoch falls. Something pulls itself out of him: the Tzitzimitl, unbound from his body, rises over the mouth."
    }
  },

  // A vessel she calls when her lord is dead: a young paladin drawn down the tomb road.
  avatar: {
    names: ["Itzcoatzin", "Tlacateotl", "Cuetlachtli", "Xochipan"],
    gender: "man",
    lines: {
      greet: ["I'm sorry, I can't stop. Something is calling me down.", "Do you hear it too? No? It's calling my name."],
      talk: ["I dream of a throne under the earth. Every night it's closer.", "She says the mouth needs a lord. I don't know who she is. I know she's right."],
      fight: ["Out of my way.", "She doesn't want me to stop."],
      down: ["Down. Always down.", "Closer."],
      crowned: "{0} kneels before the Tzitzimitl. She pours into him like smoke into a jar, and a lord stands up."
    }
  }
};

// The lord's regalia: a macuahuitl and a jade cuirass three times blessed. Only he carries
// them; they can be taken from him.
(() => {
  const items = window.CryptsItems;
  if (!items) return;
  const tiers = window.CryptsProgression?.tiers || (typeof PROGRESSION !== "undefined" ? PROGRESSION.tiers : null);
  if (tiers && !tiers.lordly) tiers.lordly = { label: "Lordly", rank: 4, priceMultiplier: 40, minimumPrice: 1500, attack: 3, damage: 3, ac: 3 };
  const regalia = [
    [items.weapons, items.weaponPrices, "macuahuitl", "Macuahuitl of the Lord of the Mouth", "keen"],
    [items.armors, items.armorPrices, "jade-cuirass", "Jade cuirass of the Lord of the Mouth", "warded"]
  ];
  for (const [catalog, prices, baseId, name, trait] of regalia) {
    if (!catalog[baseId] || !prices[baseId]) continue;
    const key = `${baseId}--lordly`;
    catalog[key] = { ...catalog[baseId], name, baseId, tier: "lordly", trait, regalia: true };
    prices[key] = [prices[baseId][0], Math.max(1500, prices[baseId][1] * 40)];
  }
})();
