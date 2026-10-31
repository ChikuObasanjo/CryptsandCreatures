"use strict";

// Villagers of Chiltomatlan: people you can befriend, give gifts to, court, and marry.
// This file is the content; systems/villagers.js is the logic. Everything a villager says
// lives here so new lines, gifts, and whole new villagers can be added without code.
//
// Disposition runs 0–100. Gifts and chats move it; each villager answers your replies
// according to their own temperament (what they `value`), and remembers the last gift and
// the last thing you talked about. Lines can use {name} (the player), {gift} (last gift),
// {floor} (deepest floor reached), and {time} (morning, afternoon, evening, night).
//
// Lines are grouped by closeness tier: stranger, acquaintance, friend, close, dear, partner.
// A tier with no lines falls back to the nearest lower one.

(() => {
  // Reply styles the player can choose in a chat. Each villager values some more than others.
  const REPLY_STYLES = {
    warm: "Warm",
    curious: "Curious",
    playful: "Playful",
    practical: "Practical",
    flirt: "Flirt"
  };

  const villagers = {
    itzcoatl: {
      name: "Itzcoatl",
      role: "maize farmer and retired ballplayer",
      pronouns: "he/him",
      gender: "man",
      appearance: { skin: "#a96c45", hair: "#211a17", hairStyle: "topknot", tunic: "#2f7d46", trim: "#e1ad3b", garment: "cotton-wrap", adornment: "none", headwear: "none", facePaint: "none", body: "broad", beard: "tuft", jewelry: "ear-spools", crest: "none" },
      summary: "Loud, competitive, quick to laugh at himself. Played the rubber-ball game for the city until his knee gave out; now he grows the best maize in Chiltomatlan and tells everyone so.",
      values: { playful: 3, warm: 2, practical: 1, curious: 0, flirt: 2 },
      romance: true,
      gifts: {
        loves: ["ulama-ball", "smoked-fish", "frothed-cacao", "chilis"],
        likes: ["ration", "soup", "monster-meat", "copper-axe-money"],
        dislikes: ["wild-ingredients", "codex-fragment", "torch"]
      },
      schedule: [
        { from: 6, to: 12, x: 13, y: 3, doing: "selling maize at the market" },
        { from: 12, to: 18, x: 7, y: 6, doing: "teaching the plaza kids the hip-strike" },
        { from: 18, to: 22, x: 3, y: 4, doing: "telling ballcourt stories outside the Ceiba House" }
      ],
      intro: "Itzcoatl. Farmer, former ballplayer, current best maize in the valley. You can say it back to me, I like hearing it.",
      context: {
        hurt: "You're limping worse than I do. Sit. Sit! The maize can wait.",
        rich: "You walk like someone with gold in their pack. Careful, the market can smell it.",
        night: "Can't sleep either? The crows get loud before rain."
      },
      stories: [
        { min: 20, text: "Want to know how I really hurt the knee? Not a heroic save. I slipped on a mango peel celebrating a point. Four thousand people saw it.",
          replies: [
            { style: "playful", label: "Did you at least win the point?", reply: "We won the match! I watched the end from a stretcher, cheering. Best day of my life, honestly.", d: 4 },
            { style: "warm", label: "That must have been hard to walk away from.", reply: "...Yeah. It was. Thanks for not laughing. Well. You can laugh a little.", d: 5 },
            { style: "practical", label: "You should've stretched first.", reply: "That's what my coach said! You two would get along. I hate you both.", d: 1 }
          ] },
        { min: 45, text: "My father wanted me to stay a farmer. I went to the ballcourt anyway. Now I'm a farmer. He never once said he told me so. That was worse.",
          replies: [
            { style: "warm", label: "Maybe he was just glad you came home.", reply: "...Huh. I never thought of it like that. Maybe he was.", d: 6 },
            { style: "curious", label: "Do you miss playing more than you'd admit?", reply: "Every single day. Don't tell the maize.", d: 4 },
            { style: "playful", label: "So he won by saying nothing. Smart man.", reply: "Ha! He was. The smartest stubborn man I ever met.", d: 3 }
          ] },
        { min: 70, text: "I carved a little ballcourt marker for you. It's lopsided. It means 'my favorite player.' Don't make that face. Take it.",
          replies: [
            { style: "warm", label: "I'll keep it forever.", reply: "Good. Forever's a good length.", d: 6 },
            { style: "flirt", label: "Your favorite, huh?", reply: "I said what I said. ...Yes. Favorite.", d: 6 },
            { style: "playful", label: "It really is lopsided.", reply: "It's called character! Give it back. No, keep it. Keep it.", d: 3 }
          ] }
      ],
      lines: {
        stranger: [
          "You're the one going down into that hole? Huh. You don't look crazy. Well. A little.",
          "Mind the rows, friend. Those are my good plants."
        ],
        acquaintance: [
          "I used to play in front of four thousand people. Now the crows are my crowd. Tough crowd, the crows.",
          "Bring me back a story from floor {floor}. A good one. Lie if you have to."
        ],
        friend: [
          "You know what I miss about the ballcourt? Not the winning. The noise right before the ball drops.",
          "Come by in the {time} sometime. I'll teach you the hip-strike. You'll be terrible at it."
        ],
        close: [
          "My knee aches before rain. And before you go down there, apparently. Funny how that works.",
          "I still have the {gift} you gave me. Don't tell anyone I keep it by the bed."
        ],
        dear: [
          "I've been thinking about a house with two hammocks. Purely hypothetical. Very hypothetical."
        ],
        partner: [
          "There's pozole on the fire. Eat before you argue with me about anything.",
          "Come home in one piece, {name}. That's the whole list."
        ]
      },
      reactions: {
        good: ["Ha! Now you're talking.", "I like you. Don't let it go to your head.", "That's the spirit."],
        neutral: ["Mm. Fair.", "Sure, sure.", "If you say so."],
        bad: ["Eh. Bit of a cold one, aren't you.", "You sound like my old coach. That's not a compliment."]
      },
      giftReplies: {
        loves: "For me? You're going to make me cry in front of the crows.",
        likes: "Oh, that's good. Thank you, really.",
        neutral: "Huh. Thanks. I'll find a use for it.",
        dislikes: "...I'm going to pretend you meant well."
      },
      courtYes: "Courting? Me? I— yes. Obviously yes. Give me a moment to stop grinning.",
      courtNo: "You're good company, {name}. Let's keep it at that for now.",
      proposeYes: "A house with two hammocks. Not hypothetical anymore. Yes.",
      proposeNo: "Not yet. Ask me again when I've stopped being scared of how much I'd say yes."
    },

    citlali: {
      name: "Citlali",
      role: "sky-watcher and codex painter",
      pronouns: "she/her",
      gender: "woman",
      appearance: { skin: "#d6a77a", hair: "#3b2a20", hairStyle: "braids", tunic: "#334d78", trim: "#f6eedb", garment: "huipil", adornment: "jade-beads", headwear: "cotton-wrap", facePaint: "none", body: "slight", beard: "none", jewelry: "nose-crescent", crest: "none" },
      summary: "Keeps the day count for the town and paints it on deerskin. Dry, precise, privately delighted by almost everything. Asks better questions than she answers.",
      values: { curious: 3, practical: 2, warm: 1, playful: 1, flirt: 1 },
      romance: true,
      gifts: {
        loves: ["codex-fragment", "jade-frog", "quetzal-plumes", "obsidian-eccentric"],
        likes: ["frothed-cacao", "field-notes", "spondylus-shell", "jade-bead"],
        dislikes: ["monster-meat", "chilis", "ration"]
      },
      schedule: [
        { from: 6, to: 12, x: 3, y: 4, doing: "painting the day's page by the inn wall" },
        { from: 12, to: 18, x: 7, y: 8, doing: "measuring the well's shadow in the plaza" },
        { from: 18, to: 24, x: 8, y: 1, doing: "watching the sky from the north lane" },
        { from: 0, to: 5, x: 8, y: 1, doing: "counting stars on the north lane" }
      ],
      intro: "Citlali. I keep the count. No, I won't tell you what your day-sign means. Fine. Later. Maybe.",
      context: {
        hurt: "You're bleeding on my shadow-stick. Go see Nali. Then come back and tell me what did that.",
        rich: "Gold doesn't impress me. That said, what did you find, exactly, and where, and was there writing on it?",
        night: "Look up. No, further. There. That's the one the count is named for tonight."
      },
      stories: [
        { min: 20, text: "Do you know why the walls below name no king? I have a theory. You'll think it's mad.",
          replies: [
            { style: "curious", label: "Tell me. I want to hear it.", reply: "I think the name was there and someone scraped it off. Carefully. On purpose. Someone wanted him forgotten.", d: 5 },
            { style: "playful", label: "Mad theories are my favorite kind.", reply: "Then you'll love this one. Come back when I've finished the drawings.", d: 3 },
            { style: "practical", label: "Does it matter for getting out alive?", reply: "Everything matters. That's the whole problem with everything.", d: 1 }
          ] },
        { min: 45, text: "My teacher burned her codices when the Empire's priests came asking about the tomb. I rewrote the ones I'd memorized. I'm still missing three.",
          replies: [
            { style: "warm", label: "That's a lot to carry alone.", reply: "It is. It's... nice to have someone notice that.", d: 6 },
            { style: "curious", label: "What was in the missing three?", reply: "Calendars. And a list of names. I've started to think the tomb's king was on it.", d: 5 },
            { style: "practical", label: "I'll keep an eye out below.", reply: "You would do that? ...Then I'll tell you what to look for.", d: 4 }
          ] },
        { min: 70, text: "I painted your day-sign. Your real one. I've been putting off showing you because it's a good one and I didn't want you to get smug.",
          replies: [
            { style: "playful", label: "Too late. Extremely smug.", reply: "I knew it. I knew this would happen. ...It suits you.", d: 4 },
            { style: "warm", label: "Thank you for thinking about me.", reply: "I think about you more than the count requires. Don't make it a thing.", d: 6 },
            { style: "flirt", label: "Does the count say we're compatible?", reply: "The count says nothing about that. I, on the other hand, have opinions.", d: 6 }
          ] }
      ],
      lines: {
        stranger: [
          "Today is a good day for beginnings, according to the count. Whether it's a good day for you is your problem.",
          "You're standing in my light."
        ],
        acquaintance: [
          "The walls down there name no king. Doesn't that bother you? It bothers me every night.",
          "If you find writing below floor {floor}, copy it. Badly is fine. Badly is better than nothing."
        ],
        friend: [
          "I painted you into the margin of today's page. Very small. Don't make it a whole thing.",
          "The {time} sky is clear. I'll show you where the fire-drill stars rise, if you like."
        ],
        close: [
          "I keep the {gift} on my worktable. It watches me work. I've decided it approves.",
          "Most people ask what the count says about them. You ask how I count. I noticed."
        ],
        dear: [
          "I've started marking the days you come back. In red. I don't use red for anything else."
        ],
        partner: [
          "Eat. Then tell me everything, in order, with the boring parts.",
          "The count says nothing about you coming home safe. I say plenty. Listen to me instead."
        ]
      },
      reactions: {
        good: ["Oh. That's a good question.", "Hm. You surprised me. Do that more.", "Yes, exactly."],
        neutral: ["Noted.", "Perhaps.", "I'll think about it."],
        bad: ["That's not how that works.", "You can do better than that."]
      },
      giftReplies: {
        loves: "This is— where did you even find this? Sit down. Tell me everything.",
        likes: "Thoughtful. Thank you.",
        neutral: "Thank you. I'll... put it somewhere.",
        dislikes: "Please don't bring me things that smell like that."
      },
      courtYes: "I had a whole page of reasons this was a bad idea. I've misplaced it. Yes.",
      courtNo: "I value you, {name}. I'm just not looking for that.",
      proposeYes: "I'll mark today in gold, then. I've never used gold. Yes.",
      proposeNo: "Not yet. Ask me on a better day. I'll tell you which one."
    },

    atzin: {
      name: "Atzin",
      role: "potter at the kiln by the gate",
      pronouns: "she/her",
      gender: "woman",
      // Loose, shapeless layers and a shoulder-length fringe: an indigo tilmatli thrown over
      // plain cotton, nothing that would make anyone look twice. She dresses for the kiln. Mostly.
      appearance: { skin: "#9b5a3f", hair: "#3b2a20", hairStyle: "long", tunic: "#334d78", trim: "#262022", garment: "tilmatli", adornment: "none", headwear: "none", facePaint: "none", body: "slight", beard: "none", jewelry: "ear-spools", crest: "none" },
      // Her personality: deadpan, wry, up too late, hears every rumor that comes through the
      // market and has a ranking for all of it. Doom-and-recovery about every firing. Shares a
      // lot all at once and then retreats behind the kiln. Lowkey about who she is; it's hers.
      summary: "Quiet, wry, always a little clay on her hands. Makes the water jars everyone drinks from, hears every rumor that comes through the market, and has an opinion about all of them. Deadpan until she isn't, and then funny in a way that sneaks up on you.",
      values: { warm: 3, practical: 2, curious: 1, playful: 1, flirt: 1 },
      romance: true,
      gifts: {
        loves: ["spondylus-shell", "jade-bead", "frothed-cacao", "turquoise-mask"],
        likes: ["clean-water", "smoked-fish", "gold-ring", "cacao-pouch"],
        dislikes: ["ulama-ball", "copper-axe-money", "monster-meat"]
      },
      schedule: [
        { from: 6, to: 17, x: 11, y: 7, doing: "tending the kiln by the gate" },
        { from: 17, to: 22, x: 13, y: 3, doing: "trading jars at the market's edge" }
      ],
      intro: "Atzin. I make the jars. You've probably drunk out of one of mine without knowing. That's sort of the point of a jar.",
      context: {
        hurt: "Here. Water. Drink, don't talk. ...Okay, you can talk a little.",
        rich: "Delver luck. Spend some of it on a jar that isn't cracked. Yours is cracked. I can hear it.",
        night: "Couldn't sleep, so I came to check the coals. You too?"
      },
      stories: [
        { min: 20, text: "I picked my name myself. Atzin. 'Little water.' Everyone thought it was a joke about the jars. It wasn't, but I let them think so.",
          replies: [
            { style: "warm", label: "It suits you. It really does.", reply: "...Thanks. That's— yeah. Thank you.", d: 6 },
            { style: "curious", label: "What made you choose water?", reply: "Water takes whatever shape it needs and stays itself. I liked that.", d: 5 },
            { style: "playful", label: "I'd have guessed it was about the jars too.", reply: "Ha. Everyone does. It's okay. Now you know better.", d: 3 }
          ] },
        { min: 45, text: "My aunt finally used my name at the market yesterday. In front of everyone. She didn't even stumble. I had to go stand behind the kiln for a while.",
          replies: [
            { style: "warm", label: "That sounds like it meant a lot.", reply: "It did. It does. I didn't think it'd hit that hard. Sorry, it's the smoke.", d: 7 },
            { style: "practical", label: "Want me to buy her a jar as thanks?", reply: "She'd love that. She'd also insist on paying. You'd lose that fight.", d: 4 },
            { style: "playful", label: "Took her long enough.", reply: "It did! Ha. It really did. Okay, I needed to hear someone say that.", d: 4 }
          ] },
        { min: 70, text: "I made you something. It's a cup. It holds exactly one mouthful of water, because I'm bad at measuring when I'm thinking about someone.",
          replies: [
            { style: "flirt", label: "Thinking about someone, huh?", reply: "Don't. I'm already red. ...Yes. You. Obviously you.", d: 7 },
            { style: "warm", label: "It's perfect.", reply: "It's really not. But I'm glad you think so.", d: 5 },
            { style: "playful", label: "I'll drink very small sips.", reply: "Ha! Okay. That's the right answer.", d: 4 }
          ] }
      ],
      lines: {
        stranger: [
          "Jars are two copper. Unless you're here to stare at the kiln. That's free.",
          "The traders say it'll rain on the lake city by the next market day. The traders say a lot of things.",
          "...Hi. Sorry. I don't do the talking part well before noon.",
          "Jars are two copper. Please don't haggle. It makes me sad and then I give in."
        ],
        acquaintance: [
          "You picked a name for yourself down there yet? Delvers always end up with one. Pick it before someone picks it for you.",
          "My jar's been in your pack the whole way to floor {floor}. That's the farthest one of mine has gone.",
          "There are three rumors about you in the market. Two are about your gold. One is that you talk to the dead. I've decided not to ask.",
          "Stayed up all night by the kiln going over a conversation from three days ago. I won it, eventually. The other person wasn't there. Anyway."
        ],
        friend: [
          "My aunt still calls me by my childhood name. I let it slide. Mostly. You'd be surprised what you can let slide.",
          "Come watch a firing this {time}. It's boring for six hours and beautiful for one minute.",
          "Glazed a whole row this morning and one cracked in the kiln. Everything is ash. The gods have turned their faces from me. ...I'll make another. Everything is beautiful again.",
          "My hair's finally past my shoulders. I keep it under the cloak at the kiln. For practical reasons. Don't look at me like that."
        ],
        close: [
          "I glazed a cup in the color of that {gift}. It came out crooked. I'm keeping it anyway.",
          "Most people talk to me like I'm a jar: useful, quiet, there. You don't. I noticed that.",
          "Everyone thinks I'm a quiet potter. That's the disguise. On the inside I am a very loud potter.",
          "A singer came up with the salt traders and I learned every song he had. Want to hear the bad ones? The bad ones are better."
        ],
        dear: [
          "I wore the huipil today. The good one. You didn't say anything, and that was exactly right. Thank you."
        ],
        partner: [
          "Sit. I made the tamales the way my grandmother did. She'd have liked you. She liked stubborn people.",
          "There's a jar of water by the door. Drink all of it. Don't argue."
        ]
      },
      reactions: {
        good: ["...Yeah. That's nice of you.", "Ha. Okay, that one got me.", "You're easier to talk to than I expected.", "Okay, that was actually kind of sweet. I need to go stare at the kiln for a while."],
        neutral: ["Mm.", "Maybe.", "Sure.", "True. Truly."],
        bad: ["Okay. I'm going back to the kiln.", "That's a lot, all at once.", "Hm. With all the kindness in my heart: no."]
      },
      giftReplies: {
        loves: "Oh. Oh, that's— I'm not crying, it's kiln smoke. Thank you.",
        likes: "That's really kind. Thanks.",
        neutral: "Thanks. That's nice.",
        dislikes: "Ah. I'll... find someone who likes these."
      },
      courtYes: "I— okay. Yes. I've been hoping you'd ask and also that you wouldn't, which I realize is not useful. Yes.",
      courtNo: "You matter to me. Just not like that. Is that okay?",
      proposeYes: "Yes. I'll make us the jars. All of them. Every jar in our house is going to be crooked and perfect.",
      proposeNo: "I'm not there yet. I'm getting there. Don't stop asking, maybe."
    },

    cuauhtli: {
      name: "Cuauhtli",
      role: "jungle scout for the road wardens",
      pronouns: "he/him",
      gender: "man",
      appearance: { skin: "#7c4a35", hair: "#211a17", hairStyle: "shaved-sides", tunic: "#66733f", trim: "#b5402c", garment: "hide-vest", adornment: "feather-trim", headwear: "feather-band", facePaint: "black-band", body: "broad", beard: "none", jewelry: "labret", crest: "none" },
      summary: "Scouts the jungle road for Xochi's wardens. Big laugh, bigger appetite, terrible at sitting still. Brave in a way that has clearly been earned.",
      values: { practical: 3, playful: 2, warm: 2, curious: 1, flirt: 1 },
      romance: true,
      gifts: {
        loves: ["monster-meat", "chili-roast", "smoked-fish", "quetzal-plumes"],
        likes: ["ration", "atlatl", "jaguar-pennant", "chilis"],
        dislikes: ["codex-fragment", "gold-labret", "soup"]
      },
      schedule: [
        { from: 5, to: 10, x: 9, y: 7, doing: "back from the dawn patrol, eating" },
        { from: 16, to: 22, x: 6, y: 12, doing: "telling road stories by the gate road" }
      ],
      intro: "Cuauhtli, road warden. Most days I'm out on the jungle road keeping it clear for people like you. You're welcome in advance.",
      context: {
        hurt: "Whoa, who did that to you? Point me at them. Kidding. Mostly. Sit down.",
        rich: "Look at you! Buy me a tamale. Buy me nine tamales.",
        night: "Night watch. Want to sit for a bit? The jungle's loud, but it's a friendly loud."
      },
      stories: [
        { min: 20, text: "First patrol I ever did, a jaguar followed me for a whole day. Never attacked. Just watched. I think it was deciding if I was worth the trouble.",
          replies: [
            { style: "playful", label: "Clearly it decided you weren't.", reply: "Ha! Rude. Accurate, but rude.", d: 4 },
            { style: "curious", label: "Were you scared?", reply: "Out of my mind. Kept walking anyway. That's most of the job, honestly.", d: 5 },
            { style: "practical", label: "What do you do when one follows you?", reply: "Make yourself big, never run, keep your eyes on it. Works on jaguars and on Xochi.", d: 5 }
          ] },
        { min: 45, text: "When I asked to train with the wardens, Xochi made me carry a full pack up the old road three times. Then she said 'fine, nephew.' First time anyone outside my family said it.",
          replies: [
            { style: "warm", label: "She saw you for who you are.", reply: "She did. I'd walk that road a hundred times for her now.", d: 6 },
            { style: "playful", label: "Three times? She went easy on you.", reply: "Easy! I couldn't feel my legs for a week. ...Okay, she did go easy.", d: 4 },
            { style: "practical", label: "Sounds like a fair test.", reply: "It was. That's why it meant something.", d: 4 }
          ] },
        { min: 70, text: "I carved your name into the warden post by the road. With mine. Next to each other. It's a warden thing. It means I'd go into the dark for you.",
          replies: [
            { style: "warm", label: "I'd do the same for you.", reply: "I know. That's why I carved it.", d: 6 },
            { style: "flirt", label: "Just the dark? Not anywhere else?", reply: "Anywhere. Ha. Look at me, flustered. Anywhere, {name}.", d: 7 },
            { style: "practical", label: "Let's both try not to need that.", reply: "Deal. But the offer stands.", d: 3 }
          ] }
      ],
      lines: {
        stranger: [
          "Road's clear today. You're welcome. Don't make me drag you out of that tomb.",
          "Eagle-warrior? No. Just Cuauhtli. Though I'll take the compliment."
        ],
        acquaintance: [
          "Floor {floor}, they tell me. Not bad. What'd you eat down there? I'm serious, what'd you eat.",
          "Took me years to get my aunt to call me her nephew. Now she won't stop bragging about me. Can't win."
        ],
        friend: [
          "Come out to the road this {time}. I'll show you how to read jaguar sign. Bring snacks. Lots of snacks.",
          "You fight like you've got somewhere to be after. Good. Keep having somewhere to be."
        ],
        close: [
          "I wore the {gift} on patrol. The other wardens were jealous. I let them be jealous.",
          "Most folk think brave means not scared. It doesn't. You know that, though. I can tell."
        ],
        dear: [
          "I keep finding reasons to walk past your door. The road isn't even that way. Just so you know."
        ],
        partner: [
          "Roast's on. You get the big piece. Don't tell the dog.",
          "If you're not back by the third night, I'm coming down after you. That's not a threat. It's a plan."
        ]
      },
      reactions: {
        good: ["Ha! Good answer.", "I like how you think.", "That's what I'm talking about."],
        neutral: ["Huh. Okay.", "Could be.", "Fair enough."],
        bad: ["Nah, that's not it.", "You've been underground too long, friend."]
      },
      giftReplies: {
        loves: "Are you serious? You're the best. I'm eating this right now. Or wearing it. Both.",
        likes: "Oh, nice. Thank you!",
        neutral: "Thanks, friend.",
        dislikes: "Uh. Thank you? I'll pass it to Citlali, she likes weird things."
      },
      courtYes: "Courting! Ha! Yes. I'm going to be insufferable about this, I'm warning you now.",
      courtNo: "You're one of my favorite people, {name}. I just don't feel that way.",
      proposeYes: "Yes. Absolutely yes. I'm telling my aunt. She's going to brag about you now too.",
      proposeNo: "Ask me again after the rains. I want to be sure, and I want you sure."
    }
  };


  // Things you can ask, beyond the daily chat. Each opens once the villager likes you enough
  // (min = disposition). Asking a new one is a small kindness (+1); asked ones can be reread.
  // Answers are longer than chat lines: this is where their backstory lives.
  const QUESTIONS = {
    itzcoatl: [
      { id: "maize", min: 0, q: "What's the secret to good maize?",
        a: "Three secrets. One: plant it with beans and squash, they hold each other up, like a team. Two: talk to it. Three: be better than everyone else at farming. That one's hard to teach." },
      { id: "ballgame", min: 0, q: "What's the ballgame actually like?",
        a: "Heavy rubber ball, you can only hit it with your hips. The crowd's so loud you feel it in your teeth. You hit the stone ring maybe once in a lifetime. I did it twice. I'll tell you about both. Right now, if you like." },
      { id: "family", min: 15, q: "Do you have family in town?",
        a: "My mother, my two sisters, and about nine hundred cousins. My father passed three rains ago. The farm was his. Some days I still turn around to ask him if the soil's ready." },
      { id: "restday", min: 15, q: "What do you do when you're not working?",
        a: "Eat. Nap. Watch the kids in the plaza get the hip-strike wrong and correct them, loudly, from the shade. Xochi says I'm a menace. Xochi has never once been right about anything. That's a lie, she's always right." },
      { id: "bestmatch", min: 35, q: "What was your best match?",
        a: "Against the city of Cholollan. We were losing all day. Last point, the ball came off their captain's hip wrong, and I just... knew where it would go. I didn't think. That's the only time in my life I didn't think. Everyone says I don't think. They're wrong. That was the one time." },
      { id: "knee", min: 35, q: "Is your knee really okay?",
        a: "It's... mostly okay. It hurts in the mornings. Nali gives me a salve that smells like a wet dog. Don't tell anyone, but some days I walk the long way around the plaza so the kids don't see me limping." },
      { id: "scared", min: 55, q: "What scares you?",
        a: "Being forgettable. I used to have four thousand people shouting my name. Now it's crows. If I'm loud, people remember me. That's... I didn't mean to say that much. Huh. You're easy to talk to." },
      { id: "playagain", min: 55, q: "Would you ever play again?",
        a: "Not for the city. But I've been thinking about a little court out past my rows. Kids' size. Somewhere they can learn without anyone shouting at them. I'd be the one shouting, obviously. But kindly." },
      { id: "partner", min: 75, q: "What are you looking for, in someone?",
        a: "Someone who laughs at me and then helps me up. In that order. And who doesn't mind that I'll tell the story of how we met at every single feast for the rest of our lives. Badly. With improvements." }
    ],
    citlali: [
      { id: "count", min: 0, q: "What is the count, exactly?",
        a: "Two calendars, turning together like two circles of dancers at different speeds. Twenty day-signs and thirteen numbers make the sacred count; three hundred sixty-five days make the sun count. They line up once every fifty-two years. Everyone gets very nervous about it. I find it relaxing." },
      { id: "daysign", min: 0, q: "What's your own day-sign?",
        a: "One Reed. A sign for priests and wanderers and people who won't sit down. My mother said it explained a lot. She meant it as a complaint. I took it as a job description." },
      { id: "skywatcher", min: 15, q: "How did you become a sky-watcher?",
        a: "I was a child who asked why. Over and over. Most adults hit their limit at the fourth why. My teacher hit hers at about the four hundredth. So I stayed with her." },
      { id: "tombtheory", min: 15, q: "What do you think the tomb really is?",
        a: "Not a tomb, or not only. The galleries are aligned to the sunrise on the day the count began. Someone built a calendar under the earth. A calendar you walk into. Why would anyone need a calendar for the dead?" },
      { id: "teacher", min: 35, q: "Tell me about your teacher.",
        a: "Papalotl. She taught with a stick and a joke. She could find any star with her eyes closed. When the priests came, she burned her own books so they'd have nothing to take, and then she sat and made them tea. I have never been so proud of anyone." },
      { id: "rest", min: 35, q: "Do you ever stop working?",
        a: "Rarely. Itzcoatl dragged me to a feast once. I ate, I danced badly, I went home and wrote down everything the stars did while I was away. That counts as rest. Don't argue." },
      { id: "priests", min: 55, q: "Are you afraid of the Empire's priests?",
        a: "Yes. They want the old count kept one way, their way. If they knew how much I've rewritten from memory, they'd take it, or me. So I paint in the margins. Little signs nobody reads. You'd be surprised what hides in a margin." },
      { id: "stars", min: 55, q: "What do the stars mean to you?",
        a: "That things come back. Every star I lose behind the sun returns. It's always on time. People aren't like that. I've been learning to live with it. Slowly. You keep coming back up from the tomb, though. I've noticed." },
      { id: "writeme", min: 75, q: "If you wrote about me, what would it say?",
        a: "'On this day, a wanderer came up from the dark and asked how I counted.' And then a great many pages I'm not going to let you read. Not yet. They're not finished. Neither are we." }
    ],
    atzin: [
      { id: "jars", min: 0, q: "How long have you been making jars?",
        a: "Since I was small enough to fall in the clay pit. My grandmother pulled me out by the ankle and handed me a lump to shape so I'd stop crying. I haven't stopped since. Shaping, I mean. The crying I've mostly got handled." },
      { id: "gossip", min: 0, q: "What's the news in the market?",
        a: "Teyac is watering his pulque again. Mahuiz says his blue cloth came from across the sea; it came from two towns over. Someone saw Cuauhtli buy flowers. Not for me. I asked. I ask about everything. It's a sickness." },
      { id: "family", min: 15, q: "Where's your family?",
        a: "My aunt sells beans three stalls down. My mother lives in the lake city; we send words back and forth with the traders. Hers are long. Mine are short. We're working on the middle." },
      { id: "nights", min: 15, q: "Why are you always up so late?",
        a: "The kiln has to be watched. Also everyone else is asleep, so my head goes quiet enough to hear itself. I have long arguments with people who aren't there. I win most of them. The ones I lose, I rerun the next night." },
      { id: "songs", min: 15, q: "Where do you hear all these songs and rumors?",
        a: "Traders. Singers. Anyone who walks through the gate. I sit by the road with jars and people just... tell a potter things. You're invisible behind a wheel. I know the gossip of six cities. None of it is useful. I treasure all of it." },
      { id: "growingup", min: 35, q: "What was it like growing up here?",
        a: "I was the quiet kid in the young men's house who was much better at weaving than at spear drills. The instructors thought I was lazy. I wasn't lazy. I was in the wrong house. Took me a long while to say that out loud." },
      { id: "grandmother", min: 35, q: "Tell me about your grandmother.",
        a: "Best potter in the valley. Hands like old roots. She never called me by the name I was given. She just called me 'clay-hands.' I think she knew before I did. She died the winter before I chose Atzin. I tell her about it at the kiln sometimes." },
      { id: "name", min: 55, q: "When did you know you were Atzin?",
        a: "There wasn't one moment. It's more like turning a jar on the wheel, and one day you look down and think, oh. That's what it was going to be. Then a lot of moments of being scared. Fewer now. The fringe helps. Don't laugh. The fringe really helps." },
      { id: "someday", min: 55, q: "What do you want, someday?",
        a: "A house with a kiln in the yard. Someone to argue with about glaze colors. To walk through the market and have nobody look twice. ...Honestly, that last one's nearly here. That's a strange thing to notice." },
      { id: "fire", min: 75, q: "What do you think about when you watch the fire?",
        a: "You, lately. Which is very bad for my concentration. Three jars cracked this week. I'm blaming you for all three. ...Don't look so pleased." }
    ],
    cuauhtli: [
      { id: "warden", min: 0, q: "What does a road warden actually do?",
        a: "Walk the jungle road every day so it stays a road. Clear the vines, scare off the jaguars, find the travelers who wandered off and walk them home. Mostly it's walking. A lot of walking. My legs are famous." },
      { id: "jungle", min: 0, q: "What's the jungle like, out there?",
        a: "Loud. Everyone thinks it's quiet. It's never quiet. Monkeys arguing, frogs shouting, rain on a thousand leaves. When it goes quiet, that's when you stop walking and listen. Quiet means something's hunting." },
      { id: "xochi", min: 15, q: "How did you end up with Xochi's wardens?",
        a: "I followed them. Literally. Every patrol, a few steps behind, for a whole dry season. Eventually Xochi turned around and said, 'If you're going to follow us, carry something.' That was it. That was the job interview." },
      { id: "food", min: 15, q: "What's the best thing you've ever eaten?",
        a: "Turkey tamales my mother made the night before my first patrol. I was too nervous to eat, so she wrapped them in a leaf and I ate them cold on the road at dawn, crying a little. Still the best thing. Don't tell Nali. She thinks it's her pozole." },
      { id: "why", min: 35, q: "Why did you want to be a warden?",
        a: "When I was small I got lost on the road. A warden found me, carried me home on his shoulders, and never told anyone I'd been crying. I wanted to be that for somebody. The one who finds you and doesn't make it a story." },
      { id: "family", min: 35, q: "Tell me about your family.",
        a: "Mother, aunt, a grandfather who claims he once wrestled a crocodile. Good people. It took them a while to understand me. My aunt took the longest and now she's the loudest about me. That's how it goes, sometimes." },
      { id: "seen", min: 55, q: "Was it hard, getting people to see you?",
        a: "Yeah. For a while I thought if I was brave enough, strong enough, loud enough, nobody would argue. Turns out the people who love you come round, and the rest don't matter much. The brave part was asking. Everything after was just walking." },
      { id: "fear", min: 55, q: "What do you do when you're scared?",
        a: "Eat something. Honestly. Then I think about who's waiting at the end of the road and I keep walking. Lately that's a shorter list. Lately one of the names is yours." },
      { id: "future", min: 75, q: "What would you want our life to look like?",
        a: "A house near the road, so I can be home fast. A big fire. A dog that's scared of everything. You coming up out of that tomb and me already there with food. I've thought about it more than I'm going to admit right now." }
    ]
  };
  for (const [id, list] of Object.entries(QUESTIONS)) villagers[id].questions = list;

  // Things the player can say, by style. Picked to fit the villager's current tier.
  const PLAYER_LINES = {
    warm: ["It's good to see you.", "How are you holding up, really?", "I thought about you down there."],
    curious: ["What were you working on today?", "What's something you've never told anyone here?", "How did you end up doing what you do?"],
    playful: ["Bet I could beat you at your own job.", "You look like you're plotting something.", "I brought you nothing. Surprise."],
    practical: ["Need a hand with anything?", "Anything I should watch out for on the road?", "Got any advice for the next delve?"],
    flirt: ["You're the best part of coming back to town.", "Save me a seat by your fire tonight?", "Has anyone told you that you're distracting?"]
  };

  // First meetings get their own replies.
  const PLAYER_INTRO = {
    warm: "Good to meet you. I'm new in town.",
    curious: "What brought you to Chiltomatlan?",
    playful: "Big claim. I'll be the judge of that.",
    practical: "Who should I know around here?"
  };

  const TIERS = [
    { id: "stranger", min: 0, label: "Stranger" },
    { id: "acquaintance", min: 15, label: "Acquaintance" },
    { id: "friend", min: 35, label: "Friend" },
    { id: "close", min: 55, label: "Close friend" },
    { id: "dear", min: 75, label: "Dear to them" }
  ];

  window.CryptsVillagers = {
    villagers, REPLY_STYLES, PLAYER_LINES, PLAYER_INTRO, TIERS, QUESTIONS,
    COURT_AT: 60, PROPOSE_AT: 90,
    // Gift values on the disposition scale.
    GIFT_POINTS: { loves: 8, likes: 4, neutral: 1, dislikes: -5 },
    CHAT_POINTS: { good: 3, neutral: 1, bad: -2 }
  };
})();
