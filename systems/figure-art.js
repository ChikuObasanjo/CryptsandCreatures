"use strict";

// Your own art for the adventurer figure.
//
// Put an SVG in resources/figure-art/<kind>/<id>.svg and list it in data/figure-art.js (the
// build does that for you), and the figure draws your file instead of the built-in drawing:
//
//   weapon/<weapon id>.svg    the held weapon, drawn upright (the grip near x 124, y 86–108)
//   back/<back id>.svg        banners and back devices
//   shield/shield.svg         the round shield
//   helmet/<id>.svg           a helmet or headwear cut, in head position
//   clothes/<id>.svg          a garment or regalia suit, torso only
//
// Files use the figure's 200 × 200 canvas, facing east (tools/figure-art.html downloads a
// template of any part, with a faint reference figure to draw against). They get the same
// watercolor-and-ink paint as everything else: outlines in the ink color #2e211a are drawn
// as ink lines; every other color becomes a watercolor wash. Four colors are swapped for the
// adventurer's own: #ff00ff clothing dye, #00ffff trim, #ffff00 skin, #00ff00 hair.
// Anything in a group with id="reference" is ignored, and Illustrator's <style> classes are
// turned into plain attributes so several files can't fight over the same class names.
const FIGURE_ART_KINDS = ["weapon", "back", "shield", "helmet", "clothes"];
const FIGURE_ART_PLACEHOLDERS = { "#ff00ff": "tunic", "#00ffff": "trim", "#ffff00": "skin", "#00ff00": "hair" };
const figureArt = { loaded: {}, pending: 0 };

function figureArtOverride(kind, id, palette = {}) {
  if (!id) return null;
  const markup = figureArt.loaded[kind]?.[id];
  if (markup === undefined) return null;
  return markup.replace(/#(ff00ff|00ffff|ffff00|00ff00)\b/gi, (hex) => {
    const key = FIGURE_ART_PLACEHOLDERS[hex.toLowerCase()];
    return palette[key] || hex;
  });
}

// Inline Illustrator-style class rules so files can share one SVG document safely.
function inlineSvgClasses(root) {
  const rules = new Map();
  for (const style of [...root.querySelectorAll("style")]) {
    for (const match of style.textContent.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const declarations = match[2].split(";").map((part) => part.split(":").map((bit) => bit.trim())).filter(([name, value]) => name && value);
      for (const selector of match[1].split(",")) {
        const name = selector.trim().replace(/^\./, "");
        if (!/^[\w-]+$/.test(name)) continue;
        rules.set(name, [...(rules.get(name) || []), ...declarations]);
      }
    }
    style.remove();
  }
  for (const element of [...root.querySelectorAll("[class]")]) {
    for (const name of element.getAttribute("class").split(/\s+/)) {
      for (const [property, value] of rules.get(name) || []) {
        if (!element.hasAttribute(property)) element.setAttribute(property, value);
      }
    }
    element.removeAttribute("class");
  }
}

function prepareFigureArt(text) {
  const documentNode = new DOMParser().parseFromString(text, "image/svg+xml");
  const svg = documentNode.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== "svg" || documentNode.querySelector("parsererror")) return null;
  for (const reference of [...svg.querySelectorAll("#reference, [id^='reference']")]) reference.remove();
  for (const script of [...svg.querySelectorAll("script, foreignObject")]) script.remove();
  inlineSvgClasses(svg);
  // Linked pictures (Illustrator's "Link" option) can't be reached from inside the figure;
  // only embedded ones work. Drop the rest so one missing file can't blank the figure.
  for (const image of [...svg.querySelectorAll("image")]) {
    const href = image.getAttribute("href") || image.getAttributeNS("http://www.w3.org/1999/xlink", "href") || "";
    if (!href.startsWith("data:")) {
      console.warn(`Figure art: a linked picture (${href}) isn't embedded, so it's skipped. In Illustrator, embed it before saving.`);
      image.remove();
    }
  }
  if (!svg.querySelector("path, rect, circle, ellipse, polygon, polyline, line, image, text, use")) return null;
  const viewBox = svg.getAttribute("viewBox") || "0 0 200 200";
  const inner = [...svg.childNodes].map((node) => new XMLSerializer().serializeToString(node)).join("")
    .replace(/\sxmlns(:\w+)?="[^"]*"/g, "")
    // The figure document doesn't declare the xlink prefix: use plain href.
    .replace(/\sxlink:href=/g, " href=");
  return `<svg x="0" y="0" width="200" height="200" viewBox="${viewBox}" overflow="visible">${inner}</svg>`;
}

async function loadFigureArt() {
  const manifest = window.CryptsFigureArt || {};
  const jobs = [];
  for (const kind of FIGURE_ART_KINDS) {
    for (const id of manifest[kind] || []) {
      jobs.push(fetch(`${window.FIGURE_ART_BASE || "./resources/figure-art/"}${kind}/${encodeURIComponent(id)}.svg`)
        .then((response) => (response.ok ? response.text() : null))
        .then((text) => {
          const markup = text && prepareFigureArt(text);
          if (!markup) return;
          figureArt.loaded[kind] ||= {};
          figureArt.loaded[kind][id] = markup;
        })
        .catch((error) => console.warn(`Figure art ${kind}/${id} could not be loaded.`, error)));
    }
  }
  if (!jobs.length) return;
  await Promise.all(jobs);
  if (typeof codexFigureCache !== "undefined") codexFigureCache.clear();
  if (typeof codexIconCache !== "undefined") codexIconCache.clear();
  if (typeof render === "function" && typeof state !== "undefined" && state.gameStarted) render();
}

if (typeof window !== "undefined" && typeof fetch === "function") {
  window.addEventListener("DOMContentLoaded", () => { loadFigureArt(); });
}
