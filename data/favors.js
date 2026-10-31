"use strict";

// Favors: one personal request from each townsperson, offered once you know each other a
// little. Each asks for one particular thing from the tomb, tied to their own story, and is
// paid with something of theirs that helps below. While a favor is open, the thing they asked
// for is always somewhere on the floors they named (systems/favors.js places it).
(() => {
  const favors = {
    cuauhtli: {
      id: "nineteenth-knot",
      min: 25,
      item: "tally-cord",
      floors: [2, 3],
      title: "The nineteenth knot",
      ask: "The Empire's expedition kept a tally cord down there, a knot for every day below. The wardens have the start of the count. Nobody ever brought back the end. If you find it on floor two or three, bring it to me? Someone should finish counting them home.",
      accept: "Thank you. Really. Look for their last camp: cold firepits, broken shields.",
      waiting: "Still no cord? Floors two and three. Their last camp. I'm not rushing you. I'm a little rushing you.",
      thanks: "Nineteen. They lasted nineteen days. ...I'll tie the last knot at the wardens' post tonight, so they're counted home. Here, take my own cord. It's walked every road in this valley. It'll get you back up.",
      hint: "Cuauhtli asked you to find the expedition's tally cord on floor 2 or 3 of the tomb.",
      reward: "warden-cord",
      faction: "road-wardens"
    },
    atzin: {
      id: "old-glaze",
      min: 25,
      item: "lords-cup-sherd",
      floors: [4, 6],
      title: "The old glaze",
      ask: "There's a glaze I've never managed: the red-black shine on the old lords' cups. If you find a sherd of one down there, floor four or deeper, bring it to me. Even a piece. Then I can stop asking traders who lie to me about it.",
      accept: "Don't break it worse than it's already broken. That's the only rule.",
      waiting: "No sherd yet? Floors four to six. It'll be the prettiest broken thing you've ever seen. You'll know.",
      thanks: "Oh. Look at that. Ash and iron and something I don't have a name for yet. Give me a week. Here: this jar sweats, so the water inside stays cool. My grandmother's shape. Your water will last longer down there.",
      hint: "Atzin asked you to bring her a sherd of a lord's cup from floor 4 or deeper.",
      reward: "sweating-jar"
    },
    citlali: {
      id: "missing-pages",
      min: 30,
      item: "codex-fragment",
      floors: [5, 8],
      title: "The missing pages",
      ask: "My teacher's missing codices. If any page survived, it'd be on floor five or deeper. I'll know her hand: thin red lines, very sure. Bring me a codex fragment? Any fragment. I'll check it against my memory.",
      accept: "I'll copy you a list of the signs to look for. Badly. You'll manage.",
      waiting: "Nothing yet? Floor five and below. Deerskin, folded like a screen. Bring me anything with writing on it, really.",
      thanks: "That's her hand. That's her. ...Sit with me a moment. Here: I've drawn how the old fortresses set their stairs, by the star each floor was aligned to. You'll find the way down faster. Don't tell the priests I can do that.",
      hint: "Citlali asked you to bring her a codex fragment from floor 5 or deeper.",
      reward: "star-chart"
    },
    itzcoatl: {
      id: "dark-maize",
      min: 30,
      item: "dark-maize",
      floors: [9, 11],
      title: "Maize from the dark",
      ask: "You go deep, right? Deep deep? There's a story that maize grows down there in the dark, pale as bone and still alive. If that's true, floor nine or below, bring me a kernel. One kernel. I want to see what it grows into in real sun.",
      accept: "You're the best. I'm telling the crows.",
      waiting: "Floor nine or deeper, they say. Pale as bone. One kernel! Then I'll stop asking. I'll start bragging instead.",
      thanks: "It's warm. Why is it warm? ...I'm planting it at the end of the row, where my father's maize was. Here: the first kernel I ever kept from my own field. Keep it in your pouch. Things that come up from the dark should get to come home.",
      hint: "Itzcoatl asked you for a kernel of maize that grew in the dark, from floor 9 or deeper.",
      reward: "seed-kernel"
    }
  };

  // What each favor pays: things of theirs that help in the tomb while carried.
  const rewards = {
    "warden-cord": {
      name: "Cuauhtli's trail cord", category: "Keepsake", sprite: "keepsake", weight: 0.1, price: 0,
      skillBonuses: { survival: 2, perception: 1 }, personal: true,
      description: "A warden's knotted cord that has walked every road in the valley. +2 Survival and +1 Perception while carried."
    },
    "sweating-jar": {
      name: "Atzin's sweating jar", category: "Tool", sprite: "water", weight: 1, price: 0, personal: true,
      description: "An unglazed jar in her grandmother's shape. It sweats, so the water stays cool: water drains 1% slower each hour in the tomb while carried."
    },
    "star-chart": {
      name: "Citlali's star chart", category: "Keepsake", sprite: "keepsake", weight: 0.1, price: 0, personal: true,
      description: "How the old fortresses set their stairs, by the stars. While carried, every floor's stairs show on your map as soon as you arrive."
    },
    "seed-kernel": {
      name: "Itzcoatl's seed kernel", category: "Keepsake", sprite: "keepsake", weight: 0, price: 0, personal: true,
      description: "The first kernel he ever kept from his own field. Once per delve, a blow that would drop you leaves you standing at 1 hit point."
    }
  };

  window.CryptsFavors = { favors, rewards };
  const items = window.CryptsItems;
  for (const [id, entry] of Object.entries(rewards)) items.gear[id] = { ...entry };
})();
