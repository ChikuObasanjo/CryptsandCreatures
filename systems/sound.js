"use strict";

// Sound and music, synthesized live with the Web Audio API (no audio files, so it works
// offline). Every voice imitates a Mexica instrument:
//   huehuetl ....... upright skin drum: hits, the beat of the songs
//   teponaztli ..... two-tongued wooden slit drum: kills, doors, rhythm
//   ayacachtli ..... gourd rattle: searching, loot, the off-beats
//   coyolli ........ copper bells: gold
//   omichicahuaztli  notched-bone rasp: misses
//   tlapitzalli .... clay flute: healing, spells, melodies
//   atecocolli ..... conch trumpet: the tomb, stairs, level-ups
//   ehecachichtli .. death whistle: traps and dying (kept quiet)
//
// Settings: sound effects on/off, music on/off, volume, plus a quick mute in the header.
// Browsers only allow audio after the player touches the page, so nothing plays before that.

const SOUND_KEY = "crypts-and-creatures.sound.v1";
const sound = {
  settings: { sfx: true, music: true, volume: 70, muted: false },
  ctx: null, master: null, sfxBus: null, musicBus: null, reverb: null, noise: null,
  mood: null, nextMood: null, step: 0, nextTime: 0, timer: 0, song: null, lastPlayed: {}
};

function loadSoundSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SOUND_KEY) || "null");
    if (saved && typeof saved === "object") {
      sound.settings.sfx = saved.sfx !== false;
      sound.settings.music = saved.music !== false;
      sound.settings.muted = saved.muted === true;
      if (Number.isFinite(saved.volume)) sound.settings.volume = Math.max(0, Math.min(100, Math.round(saved.volume)));
    }
  } catch { /* private mode: keep defaults */ }
}

function saveSoundSettings() {
  try { localStorage.setItem(SOUND_KEY, JSON.stringify(sound.settings)); } catch { /* ignore */ }
}

function soundOn() {
  return !sound.settings.muted && sound.settings.volume > 0;
}

// ---------- Audio graph ----------

function ensureAudio() {
  if (sound.ctx) return sound.ctx;
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return null;
  const ctx = new Context();
  sound.ctx = ctx;
  sound.master = ctx.createGain();
  // A gentle limiter so stacked drum hits never clip.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.knee.value = 8;
  limiter.ratio.value = 6;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.2;
  sound.master.connect(limiter);
  limiter.connect(ctx.destination);
  sound.sfxBus = ctx.createGain();
  sound.musicBus = ctx.createGain();
  sound.sfxBus.connect(sound.master);
  sound.musicBus.connect(sound.master);
  // A stone-room reverb shared by everything: decaying noise as the impulse.
  const length = Math.floor(ctx.sampleRate * 2.2);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3.2);
  }
  sound.reverb = ctx.createConvolver();
  sound.reverb.buffer = impulse;
  sound.reverbSend = ctx.createGain();
  sound.reverbSend.gain.value = 0.22;
  sound.reverbSend.connect(sound.reverb);
  sound.reverb.connect(sound.master);
  sound.sfxBus.connect(sound.reverbSend);
  sound.musicBus.connect(sound.reverbSend);
  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i += 1) samples[i] = Math.random() * 2 - 1;
  sound.noise = noise;
  applySoundLevels();
  return ctx;
}

function applySoundLevels() {
  if (!sound.ctx) return;
  const now = sound.ctx.currentTime;
  const volume = soundOn() ? Math.pow(sound.settings.volume / 100, 1.6) : 0;
  sound.master.gain.setTargetAtTime(volume, now, 0.05);
  sound.sfxBus.gain.setTargetAtTime(sound.settings.sfx ? 0.9 : 0, now, 0.05);
  sound.musicBus.gain.setTargetAtTime(sound.settings.music ? 0.42 : 0, now, 0.3);
}

function unlockAudio() {
  const ctx = ensureAudio();
  if (!ctx) return;
  if (ctx.state === "suspended" && !document.hidden) ctx.resume().catch(() => {});
  startMusicClock();
}

// Small helpers for building voices.
function envGain(t, attack, peak, decay, bus) {
  const gain = sound.ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  gain.connect(bus);
  return gain;
}

function noiseSource(t, duration) {
  const source = sound.ctx.createBufferSource();
  source.buffer = sound.noise;
  source.start(t, Math.random() * 1.5, duration + 0.05);
  return source;
}

function tone(type, frequency, t, duration) {
  const osc = sound.ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, t);
  osc.start(t);
  osc.stop(t + duration + 0.05);
  return osc;
}

function filtered(source, type, frequency, q, destination) {
  const filter = sound.ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  source.connect(filter);
  filter.connect(destination);
  return filter;
}

// ---------- Instruments ----------

const INSTRUMENTS = {
  huehuetl(t, bus, { pitch = 70, gain = 0.9 } = {}) {
    const body = tone("sine", pitch * 2.3, t, 0.7);
    body.frequency.exponentialRampToValueAtTime(pitch, t + 0.07);
    body.connect(envGain(t, 0.004, gain, 0.6, bus));
    const skin = tone("sine", pitch * 1.6, t, 0.3);
    skin.connect(envGain(t, 0.004, gain * 0.18, 0.22, bus));
    filtered(noiseSource(t, 0.08), "bandpass", 900, 0.8, envGain(t, 0.002, gain * 0.3, 0.06, bus));
  },
  teponaztli(t, bus, { pitch = 330, gain = 0.55 } = {}) {
    const wood = tone("sine", pitch * 1.03, t, 0.4);
    wood.frequency.exponentialRampToValueAtTime(pitch, t + 0.03);
    wood.connect(envGain(t, 0.003, gain, 0.32, bus));
    tone("triangle", pitch * 2.01, t, 0.15).connect(envGain(t, 0.002, gain * 0.16, 0.1, bus));
    filtered(noiseSource(t, 0.03), "highpass", 2200, 0.7, envGain(t, 0.001, gain * 0.35, 0.015, bus));
  },
  ayacachtli(t, bus, { gain = 0.25, duration = 0.14, grains = 10 } = {}) {
    for (let i = 0; i < grains; i += 1) {
      const at = t + Math.random() * duration;
      filtered(noiseSource(at, 0.03), "bandpass", 3800 + Math.random() * 2200, 1.4,
        envGain(at, 0.001, gain * (0.4 + Math.random() * 0.6), 0.012 + Math.random() * 0.02, bus));
    }
  },
  coyolli(t, bus, { gain = 0.2, count = 5 } = {}) {
    for (let i = 0; i < count; i += 1) {
      const at = t + i * 0.045 + Math.random() * 0.03;
      const base = 1700 + Math.random() * 900;
      [[1, 0.5], [2.76, 0.3], [5.4, 0.14]].forEach(([ratio, decay], index) => {
        tone("sine", base * ratio, at, decay).connect(envGain(at, 0.002, gain * [1, 0.45, 0.2][index], decay, bus));
      });
    }
  },
  omichicahuaztli(t, bus, { gain = 0.2, clicks = 5, rate = 0.032 } = {}) {
    for (let i = 0; i < clicks; i += 1) {
      const at = t + i * rate;
      filtered(noiseSource(at, 0.02), "bandpass", 1700 + i * 90, 3, envGain(at, 0.001, gain, 0.012, bus));
    }
  },
  tlapitzalli(t, bus, { frequency = 587, duration = 0.3, gain = 0.2 } = {}) {
    const ctx = sound.ctx;
    const osc = tone("sine", frequency, t, duration + 0.15);
    const vibrato = tone("sine", 5.3, t, duration + 0.15);
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(frequency * 0.007, t + Math.min(0.25, duration));
    vibrato.connect(depth);
    depth.connect(osc.frequency);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.04);
    amp.gain.setValueAtTime(gain, t + Math.max(0.05, duration - 0.06));
    amp.gain.exponentialRampToValueAtTime(0.0001, t + duration + 0.12);
    amp.connect(bus);
    osc.connect(amp);
    tone("sine", frequency * 2, t, duration + 0.15).connect(envGain(t, 0.04, gain * 0.06, duration, bus));
    // The breathy "chiff" at the start of a clay-flute note.
    filtered(noiseSource(t, duration), "bandpass", frequency * 2.2, 2.5, envGain(t, 0.02, gain * 0.22, Math.min(0.12, duration), bus));
  },
  atecocolli(t, bus, { frequency = 147, duration = 1.4, gain = 0.3 } = {}) {
    const ctx = sound.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 2;
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.linearRampToValueAtTime(1500, t + duration * 0.35);
    filter.frequency.linearRampToValueAtTime(500, t + duration);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.22);
    amp.gain.setValueAtTime(gain, t + duration * 0.7);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + duration + 0.3);
    filter.connect(amp);
    amp.connect(bus);
    for (const [type, ratio, level] of [["sawtooth", 1, 1], ["sawtooth", 1.006, 0.8], ["square", 0.5, 0.35]]) {
      const osc = tone(type, frequency * ratio * 0.97, t, duration + 0.3);
      osc.frequency.linearRampToValueAtTime(frequency * ratio, t + duration * 0.3);
      const mix = ctx.createGain();
      mix.gain.value = level * 0.33;
      osc.connect(mix);
      mix.connect(filter);
    }
  },
  ehecachichtli(t, bus, { duration = 0.8, gain = 0.12 } = {}) {
    const ctx = sound.ctx;
    const amp = envGain(t, 0.07, gain, duration, bus);
    for (const [start, end] of [[2300, 1500], [3200, 2300]]) {
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.value = 14;
      filter.frequency.setValueAtTime(start, t);
      filter.frequency.exponentialRampToValueAtTime(end, t + duration);
      noiseSource(t, duration + 0.1).connect(filter);
      filter.connect(amp);
    }
    const scream = tone("sine", 1900, t, duration);
    scream.frequency.exponentialRampToValueAtTime(1300, t + duration);
    const wobble = tone("sine", 23, t, duration);
    const depth = ctx.createGain();
    depth.gain.value = 70;
    wobble.connect(depth);
    depth.connect(scream.frequency);
    scream.connect(envGain(t, 0.06, gain * 0.35, duration, bus));
  },
  plunk(t, bus, { from = 560, to = 330, gain = 0.22 } = {}) {
    const osc = tone("sine", from, t, 0.18);
    osc.frequency.exponentialRampToValueAtTime(to, t + 0.12);
    osc.connect(envGain(t, 0.004, gain, 0.14, bus));
  },
  whoosh(t, bus, { gain = 0.12, duration = 0.2 } = {}) {
    const filter = sound.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(500, t);
    filter.frequency.exponentialRampToValueAtTime(2600, t + duration);
    noiseSource(t, duration).connect(filter);
    filter.connect(envGain(t, duration * 0.4, gain, duration * 0.6, bus));
  }
};

// D minor pentatonic, the mode the songs and phrases use.
const NOTE = { D4: 293.66, F4: 349.23, G4: 392, A4: 440, C5: 523.25, D5: 587.33, F5: 698.46, G5: 783.99, A5: 880, C6: 1046.5, A3: 220, D3: 146.83 };

function phrase(t, bus, notes, length = 0.14, gain = 0.18) {
  notes.forEach((note, index) => INSTRUMENTS.tlapitzalli(t + index * length, bus, { frequency: NOTE[note], duration: length * 1.1, gain }));
}

// ---------- Sound effects ----------

const SFX = {
  hit: (t, b) => { INSTRUMENTS.huehuetl(t, b, { pitch: 78, gain: 0.6 }); INSTRUMENTS.omichicahuaztli(t + 0.01, b, { gain: 0.25, clicks: 2 }); },
  critical: (t, b) => { INSTRUMENTS.huehuetl(t, b, { pitch: 92, gain: 0.55 }); INSTRUMENTS.huehuetl(t + 0.1, b, { pitch: 62, gain: 0.62 }); INSTRUMENTS.coyolli(t + 0.05, b, { gain: 0.1, count: 2 }); },
  miss: (t, b) => INSTRUMENTS.whoosh(t, b, { gain: 0.45 }),
  enemyMiss: (t, b) => INSTRUMENTS.omichicahuaztli(t, b, { gain: 0.5, clicks: 4 }),
  hurt: (t, b) => { INSTRUMENTS.huehuetl(t, b, { pitch: 52, gain: 0.7 }); INSTRUMENTS.ayacachtli(t + 0.02, b, { gain: 0.4, grains: 6 }); },
  defeat: (t, b) => { INSTRUMENTS.teponaztli(t, b, { pitch: 220, gain: 0.6 }); INSTRUMENTS.teponaztli(t + 0.14, b, { pitch: 330, gain: 0.6 }); },
  gold: (t, b) => INSTRUMENTS.coyolli(t, b, { gain: 0.16, count: 6 }),
  loot: (t, b) => { INSTRUMENTS.ayacachtli(t, b, { gain: 0.4, grains: 12, duration: 0.18 }); INSTRUMENTS.teponaztli(t + 0.12, b, { pitch: 440, gain: 0.25 }); },
  door: (t, b) => { INSTRUMENTS.teponaztli(t, b, { pitch: 165, gain: 0.55 }); INSTRUMENTS.teponaztli(t + 0.09, b, { pitch: 150, gain: 0.3 }); },
  doorClose: (t, b) => INSTRUMENTS.teponaztli(t, b, { pitch: 140, gain: 0.55 }),
  trap: (t, b) => INSTRUMENTS.ehecachichtli(t, b, { duration: 0.75, gain: 0.32 }),
  disarm: (t, b) => { INSTRUMENTS.teponaztli(t, b, { pitch: 440, gain: 0.4 }); INSTRUMENTS.teponaztli(t + 0.1, b, { pitch: 330, gain: 0.4 }); INSTRUMENTS.ayacachtli(t + 0.15, b, { gain: 0.12 }); },
  search: (t, b) => INSTRUMENTS.ayacachtli(t, b, { gain: 0.32, grains: 18, duration: 0.45 }),
  drink: (t, b) => { INSTRUMENTS.plunk(t, b); INSTRUMENTS.plunk(t + 0.1, b, { from: 660, to: 420, gain: 0.16 }); },
  eat: (t, b) => { for (let i = 0; i < 3; i += 1) INSTRUMENTS.ayacachtli(t + i * 0.12, b, { gain: 0.4, grains: 4, duration: 0.04 }); INSTRUMENTS.plunk(t + 0.36, b, { from: 300, to: 220, gain: 0.12 }); },
  heal: (t, b) => phrase(t, b, ["D5", "F5", "A5"], 0.12, 0.16),
  spell: (t, b) => { phrase(t, b, ["A5", "C6", "A5", "G5"], 0.07, 0.14); INSTRUMENTS.ayacachtli(t, b, { gain: 0.12 }); },
  levelUp: (t, b) => { INSTRUMENTS.atecocolli(t, b, { frequency: 147, duration: 1.1, gain: 0.34 }); phrase(t + 0.9, b, ["D5", "F5", "G5", "A5", "D5"], 0.13, 0.15); },
  stairs: (t, b) => INSTRUMENTS.atecocolli(t, b, { frequency: 110, duration: 1.3, gain: 0.34 }),
  enterTomb: (t, b) => { INSTRUMENTS.atecocolli(t, b, { frequency: 123.5, duration: 1.7, gain: 0.3 }); INSTRUMENTS.huehuetl(t + 1.2, b, { pitch: 55, gain: 0.5 }); },
  returnTown: (t, b) => phrase(t, b, ["D5", "F5", "G5", "A5", "G5"], 0.15, 0.15),
  death: (t, b) => { INSTRUMENTS.ehecachichtli(t, b, { duration: 1.5, gain: 0.3 }); INSTRUMENTS.huehuetl(t + 0.3, b, { pitch: 45, gain: 0.7 }); },
  rest: (t, b) => phrase(t, b, ["A4", "G4", "F4", "D4"], 0.32, 0.13),
  coins: (t, b) => INSTRUMENTS.coyolli(t, b, { gain: 0.12, count: 3 }),
  talk: (t, b) => INSTRUMENTS.teponaztli(t, b, { pitch: 392, gain: 0.22 }),
  gift: (t, b) => { INSTRUMENTS.coyolli(t, b, { gain: 0.1, count: 2 }); phrase(t + 0.05, b, ["F5", "A5"], 0.12, 0.12); },
  water: (t, b) => { INSTRUMENTS.plunk(t, b, { from: 420, to: 260 }); INSTRUMENTS.plunk(t + 0.12, b, { from: 520, to: 300, gain: 0.16 }); INSTRUMENTS.plunk(t + 0.22, b, { from: 600, to: 380, gain: 0.12 }); }
};

// Play a named effect. Repeats of the same effect within 40 ms are merged.
function sfx(name) {
  if (!SFX[name] || !soundOn() || !sound.settings.sfx) return;
  const ctx = ensureAudio();
  if (!ctx || ctx.state !== "running") return;
  const now = ctx.currentTime;
  if (now - (sound.lastPlayed[name] || -1) < 0.04) return;
  sound.lastPlayed[name] = now;
  try { SFX[name](now + 0.005, sound.sfxBus); } catch { /* never let audio break the game */ }
}

// Combat feedback is the one place every attack, hit, miss, kill, and heal passes through.
function sfxForCombatFeedback(kind, target = {}) {
  const name = { hit: "hit", critical: "critical", defeat: "defeat", "player-hit": "hurt", "player-death": "death", heal: "heal" }[kind]
    || (kind === "miss" ? (target.actor === "player" || target.actor === "companion" ? "enemyMiss" : "miss") : null);
  if (name) sfx(name);
}

// ---------- Songs ----------

// Each mood is a little song: a tempo, a drum pattern per 8th note across a 4/4 bar, and a
// flute melody built from a few motifs repeated A A B A, the way a dance song repeats.
const MOODS = {
  title: { bpm: 76, drums: "soft", flute: 0.13, octave: "high", rest: 0.35 },
  town: { bpm: 92, drums: "dance", flute: 0.14, octave: "high", rest: 0.25 },
  dungeon: { bpm: 62, drums: "heartbeat", flute: 0.1, octave: "low", rest: 0.55 },
  combat: { bpm: 116, drums: "war", flute: 0, octave: "low", rest: 1 }
};
const SCALES = {
  high: ["D5", "F5", "G5", "A5", "C6", "A5", "G5", "F5"],
  low: ["D4", "F4", "G4", "A4", "C5", "A4", "G4", "F4"]
};

function makeMotif(scale, restChance) {
  const notes = [];
  let index = Math.floor(Math.random() * 4);
  for (let step = 0; step < 16; step += 1) {
    if (Math.random() < restChance && step % 4 !== 0) { notes.push(null); continue; }
    index = Math.max(0, Math.min(scale.length - 1, index + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
    const hold = Math.random() < 0.3 ? 2 : 1;
    notes.push({ note: scale[index], hold });
    if (hold === 2) { notes.push(null); step += 1; }
  }
  notes[15] = { note: scale[0], hold: 1 };
  return notes.slice(0, 16);
}

function makeSong(mood) {
  const config = MOODS[mood];
  const scale = SCALES[config.octave];
  const a = makeMotif(scale, config.rest);
  const b = makeMotif(scale, config.rest);
  return { mood, sections: [a, a, b, a] };
}

function playDrums(style, step, t, bus) {
  const beat = step % 8;
  if (style === "dance") {
    if (beat === 0) INSTRUMENTS.huehuetl(t, bus, { pitch: 62, gain: 0.55 });
    if (beat === 4) INSTRUMENTS.huehuetl(t, bus, { pitch: 82, gain: 0.35 });
    const teponaztli = [220, null, 330, 220, null, 330, 220, 330][beat];
    if (teponaztli) INSTRUMENTS.teponaztli(t, bus, { pitch: teponaztli, gain: 0.2 });
    if (beat % 2 === 1) INSTRUMENTS.ayacachtli(t, bus, { gain: 0.16, grains: 5, duration: 0.05 });
  } else if (style === "soft") {
    if (beat === 0) INSTRUMENTS.huehuetl(t, bus, { pitch: 60, gain: 0.35 });
    if (beat === 4) INSTRUMENTS.teponaztli(t, bus, { pitch: 220, gain: 0.14 });
  } else if (style === "heartbeat") {
    if (beat === 0) INSTRUMENTS.huehuetl(t, bus, { pitch: 50, gain: 0.5 });
    if (beat === 1) INSTRUMENTS.huehuetl(t, bus, { pitch: 46, gain: 0.25 });
    if (beat === 6 && step % 32 === 6) INSTRUMENTS.teponaztli(t, bus, { pitch: 165, gain: 0.14 });
    if (beat === 3 && Math.random() < 0.18) INSTRUMENTS.ayacachtli(t, bus, { gain: 0.12, grains: 8, duration: 0.3 });
  } else if (style === "war") {
    if (beat % 2 === 0) INSTRUMENTS.huehuetl(t, bus, { pitch: beat === 0 ? 58 : 70, gain: beat === 0 ? 0.6 : 0.38 });
    const teponaztli = [220, 330, 220, 330, 220, 330, 294, 330][beat];
    INSTRUMENTS.teponaztli(t, bus, { pitch: teponaztli, gain: 0.16 });
    INSTRUMENTS.ayacachtli(t, bus, { gain: 0.13, grains: 4, duration: 0.04 });
  }
}

function currentMood() {
  if (typeof state === "undefined" || !state.gameStarted || !state.run) return "title";
  if (state.run.location === "dungeon") {
    const fighting = state.run.enemies?.some((enemy) => enemy.alive && enemy.alerted &&
      Math.max(Math.abs(enemy.x - state.run.player.x), Math.abs(enemy.y - state.run.player.y)) <= 6);
    return fighting ? "combat" : "dungeon";
  }
  return "town";
}

// Arrivals are announced by watching where the player is, so every way of travelling
// (stairs, lift, camp, the gate, a new delve) gets the same sound.
function watchTravel() {
  if (typeof state === "undefined" || !state.run) { sound.lastPlace = null; return; }
  const place = `${state.run.location}:${state.run.location === "dungeon" ? state.run.dungeonFloor : ""}`;
  const previous = sound.lastPlace;
  sound.lastPlace = place;
  if (!previous || previous === place) return;
  const [was] = previous.split(":");
  if (state.run.location === "dungeon" && was !== "dungeon") sfx("enterTomb");
  else if (state.run.location === "dungeon") sfx("stairs");
  else if (state.run.location === "city" && was === "dungeon") sfx(state.run.lost ? "death" : "returnTown");
}

function startMusicClock() {
  if (sound.timer || !sound.ctx) return;
  sound.nextTime = sound.ctx.currentTime + 0.1;
  sound.timer = window.setInterval(() => { watchTravel(); scheduleMusic(); }, 60);
}

function scheduleMusic() {
  const ctx = sound.ctx;
  if (!ctx || ctx.state !== "running") return;
  if (!soundOn() || !sound.settings.music) { sound.nextTime = ctx.currentTime + 0.1; return; }
  const wanted = currentMood();
  // Change songs at the start of a bar so the music doesn't stumble.
  if (!sound.song) sound.song = makeSong(wanted);
  else if (wanted !== sound.song.mood && sound.step % 8 === 0) { sound.song = makeSong(wanted); sound.step = 0; }
  if (sound.nextTime < ctx.currentTime - 0.5) sound.nextTime = ctx.currentTime + 0.05;
  while (sound.nextTime < ctx.currentTime + 0.25) {
    const config = MOODS[sound.song.mood];
    const eighth = 30 / config.bpm;
    const step = sound.step;
    try {
      playDrums(config.drums, step, sound.nextTime, sound.musicBus);
      const section = sound.song.sections[Math.floor(step / 16) % 4];
      const entry = config.flute ? section[step % 16] : null;
      // In the tomb the flute only plays every other verse, and never on the first.
      const fluteVerse = sound.song.mood !== "dungeon" || Math.floor(step / 64) % 2 === 1;
      if (entry && fluteVerse) {
        INSTRUMENTS.tlapitzalli(sound.nextTime, sound.musicBus, { frequency: NOTE[entry.note], duration: eighth * entry.hold * 0.95, gain: config.flute });
      }
      // A distant conch now and then in the tomb.
      if (sound.song.mood === "dungeon" && step % 128 === 96) {
        INSTRUMENTS.atecocolli(sound.nextTime, sound.musicBus, { frequency: 98, duration: 2.4, gain: 0.12 });
      }
    } catch { /* keep the clock running */ }
    sound.step += 1;
    // A new verse every 4 sections keeps the song from looping forever.
    if (sound.step % 64 === 0) sound.song = { ...makeSong(sound.song.mood) };
    sound.nextTime += eighth;
  }
}

// ---------- Settings UI ----------

function renderSoundSettings() {
  const sfxToggle = document.getElementById("sound-effects-toggle");
  const musicToggle = document.getElementById("music-toggle");
  const volume = document.getElementById("sound-volume");
  const mute = document.getElementById("sound-mute-toggle");
  if (sfxToggle) sfxToggle.checked = sound.settings.sfx;
  if (musicToggle) musicToggle.checked = sound.settings.music;
  if (volume) volume.value = String(sound.settings.volume);
  if (mute) {
    const muted = sound.settings.muted || (!sound.settings.sfx && !sound.settings.music);
    mute.textContent = muted ? "♪̸" : "♪";
    mute.classList.toggle("is-muted", muted);
    const label = muted ? t("Turn sound on") : t("Mute sound");
    mute.setAttribute("aria-label", label);
    mute.title = label;
    mute.setAttribute("aria-pressed", String(muted));
  }
}

function connectSoundSettings() {
  loadSoundSettings();
  const update = () => { saveSoundSettings(); applySoundLevels(); renderSoundSettings(); };
  document.getElementById("sound-effects-toggle")?.addEventListener("change", (event) => {
    sound.settings.sfx = event.target.checked;
    if (sound.settings.sfx) sound.settings.muted = false;
    update();
    unlockAudio();
    sfx("talk");
  });
  document.getElementById("music-toggle")?.addEventListener("change", (event) => {
    sound.settings.music = event.target.checked;
    if (sound.settings.music) sound.settings.muted = false;
    update();
    unlockAudio();
  });
  document.getElementById("sound-volume")?.addEventListener("input", (event) => {
    sound.settings.volume = Number(event.target.value);
    update();
  });
  document.getElementById("sound-volume")?.addEventListener("change", () => sfx("coins"));
  document.getElementById("sound-mute-toggle")?.addEventListener("click", () => {
    const muted = sound.settings.muted || (!sound.settings.sfx && !sound.settings.music);
    if (muted) {
      sound.settings.muted = false;
      if (!sound.settings.sfx && !sound.settings.music) { sound.settings.sfx = true; sound.settings.music = true; }
    } else {
      sound.settings.muted = true;
    }
    update();
    unlockAudio();
  });
  // Audio may only start after the player touches the page.
  for (const type of ["pointerdown", "keydown", "touchend"]) {
    window.addEventListener(type, unlockAudio, { capture: true, passive: true });
  }
  // Stay quiet in the background (and save battery on phones).
  document.addEventListener("visibilitychange", () => {
    if (!sound.ctx) return;
    if (document.hidden) sound.ctx.suspend().catch(() => {});
    else sound.ctx.resume().catch(() => {});
  });
  renderSoundSettings();
}
