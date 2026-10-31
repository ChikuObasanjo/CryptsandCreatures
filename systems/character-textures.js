"use strict";

// Painted textures for the adventurer figure.
//
// The editable sources are DDS files in art/character/<kind>/ (see art/character/README.md).
// `npm run build` converts them into PNGs under resources/character-textures/ and lists them
// in data/character-textures.js; this file loads those PNGs and lays them into the figure in
// place of the built-in drawing for that part.
//
// Every texture covers the figure's whole square canvas, so a part painted in the right spot
// lines up by itself. Optional masks color parts to the adventurer's own choices:
//   <id>.dye  the clothing color    <id>.trim  the trim color
//   <id>.skin the skin tone         <id>.hair  the hair color
// Each mask multiplies its color into the texture wherever the mask is white. Optional
// variants: <id>.north (seen from behind, for headwear) and <id>.curvy (the curvy build).

const CHARACTER_TEXTURE_BASE = `${(typeof window !== "undefined" && window.CHARACTER_TEXTURE_ROOT) || "./"}resources/character-textures/`;
const CHARACTER_TEXTURE_CHANNELS = { dye: "tunic", trim: "trim", skin: "skin", hair: "hair" };
const characterTextures = { images: new Map(), composed: new Map(), defs: new Map(), ready: false };

function characterTextureEntry(kind, id) {
  const manifest = (typeof window !== "undefined" && window.CryptsCharacterTextures?.parts) || null;
  return id && manifest?.[kind]?.[id] || null;
}

function characterTextureFile(kind, id, variant, channel) {
  return `${kind}/${id}${variant ? `.${variant}` : ""}${channel ? `.${channel}` : ""}.png`;
}

// Start collecting the texture images one SVG document needs.
function characterTexturesBegin() {
  characterTextures.defs.clear();
}

// The <image> definitions for the textures used since characterTexturesBegin().
function characterTextureDefsMarkup() {
  let markup = "";
  for (const [id, url] of characterTextures.defs) {
    markup += `<image id="${id}" href="${url}" x="0" y="0" width="200" height="200" preserveAspectRatio="none"/>`;
  }
  return markup;
}

function characterTextureComposite(kind, id, variant, channels, palette) {
  const colors = channels.map((channel) => palette?.[CHARACTER_TEXTURE_CHANNELS[channel]] || "#ffffff");
  const key = `${characterTextureFile(kind, id, variant, "")}|${colors.join(",")}`;
  const cached = characterTextures.composed.get(key);
  if (cached) return cached;
  const base = characterTextures.images.get(characterTextureFile(kind, id, variant, ""));
  if (!base?.complete || !base.naturalWidth) return null;
  let url;
  if (!channels.length) {
    url = base.dataset.url;
  } else {
    const size = base.naturalWidth;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = base.naturalHeight;
    const context = canvas.getContext("2d");
    context.drawImage(base, 0, 0);
    const layer = document.createElement("canvas");
    layer.width = canvas.width;
    layer.height = canvas.height;
    const layerContext = layer.getContext("2d");
    channels.forEach((channel, index) => {
      const mask = characterTextures.images.get(characterTextureFile(kind, id, variant, channel));
      if (!mask?.complete || !mask.naturalWidth) return;
      // The color, cut to the mask, multiplied into the painting.
      layerContext.globalCompositeOperation = "source-over";
      layerContext.clearRect(0, 0, layer.width, layer.height);
      layerContext.drawImage(mask, 0, 0, layer.width, layer.height);
      layerContext.globalCompositeOperation = "source-in";
      layerContext.fillStyle = colors[index];
      layerContext.fillRect(0, 0, layer.width, layer.height);
      context.globalCompositeOperation = "multiply";
      context.drawImage(layer, 0, 0);
    });
    // Multiply can't add paint where the texture was clear: keep the texture's own outline.
    context.globalCompositeOperation = "destination-in";
    context.drawImage(base, 0, 0);
    try {
      url = canvas.toDataURL("image/png");
    } catch (error) {
      console.warn(`Texture ${kind}/${id} could not be colored.`, error);
      url = base.dataset.url;
    }
  }
  if (characterTextures.composed.size > 160) characterTextures.composed.clear();
  characterTextures.composed.set(key, url);
  return url;
}

// The markup for a painted part, or null to fall back to the built-in drawing.
function characterTextureLayer(kind, id, palette = {}, variant = "") {
  if (!characterTextures.ready) return null;
  const entry = characterTextureEntry(kind, id);
  if (!entry) return null;
  const chosen = variant && entry[variant] ? variant : "";
  const channels = entry[chosen];
  if (!channels) return null;
  const url = characterTextureComposite(kind, id, chosen, channels, palette);
  if (!url) return null;
  let defId = null;
  for (const [existing, existingUrl] of characterTextures.defs) if (existingUrl === url) defId = existing;
  if (!defId) {
    defId = `ctex-${characterTextures.defs.size}`;
    characterTextures.defs.set(defId, url);
  }
  return `<use href="#${defId}" data-tex=""/>`;
}

function loadCharacterTextureImage(file, stamp) {
  return fetch(`${CHARACTER_TEXTURE_BASE}${file}?v=${encodeURIComponent(stamp)}`)
    .then((response) => (response.ok ? response.blob() : Promise.reject(new Error(`${response.status}`))))
    .then((blob) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    }))
    .then((url) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("unreadable image"));
      image.dataset.url = url;
      image.src = url;
    }))
    .then((image) => { characterTextures.images.set(file, image); })
    .catch((error) => console.warn(`Character texture ${file} could not be loaded (${error.message}); the built-in drawing is used.`));
}

async function loadCharacterTextures() {
  const manifest = window.CryptsCharacterTextures;
  const parts = manifest?.parts || {};
  const jobs = [];
  for (const [kind, ids] of Object.entries(parts)) {
    for (const [id, variants] of Object.entries(ids)) {
      for (const [variant, channels] of Object.entries(variants)) {
        jobs.push(loadCharacterTextureImage(characterTextureFile(kind, id, variant, ""), manifest.stamp || ""));
        for (const channel of channels) jobs.push(loadCharacterTextureImage(characterTextureFile(kind, id, variant, channel), manifest.stamp || ""));
      }
    }
  }
  if (!jobs.length) return;
  await Promise.all(jobs);
  characterTextures.ready = true;
  if (typeof codexFigureCache !== "undefined") codexFigureCache.clear();
  if (typeof codexIconCache !== "undefined") codexIconCache.clear();
  if (typeof codexPortraitCache !== "undefined") codexPortraitCache.clear();
  if (typeof render === "function" && typeof state !== "undefined" && state.gameStarted) render();
  if (typeof updateCharacterPreview === "function" && typeof elements !== "undefined" && elements["character-dialog"]?.open) updateCharacterPreview();
}

if (typeof window !== "undefined" && typeof fetch === "function") {
  window.addEventListener("DOMContentLoaded", () => { loadCharacterTextures(); });
}
