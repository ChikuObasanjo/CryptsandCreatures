"use strict";
// Loads the game's scripts into a Node vm with a stubbed browser, so systems can be run and
// measured without a page. Usage: const { ctx, run } = require("./headless").load();
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const styleStub = new Proxy({}, { get: () => () => "", set: () => true });

function stub() {
  const fn = function () { return proxy; };
  const proxy = new Proxy(fn, {
    get(_, key) {
      if (key === Symbol.toPrimitive) return () => "";
      if (key === "length") return 0;
      if (key === "then") return undefined;
      if (key === Symbol.iterator) return function* () {};
      if (key === "classList") return { add() {}, remove() {}, toggle() {}, contains() { return false; } };
      if (key === "style") return styleStub;
      if (key === "dataset") return {};
      if (key === "getContext") return () => proxy;
      return proxy;
    },
    set() { return true; },
    apply() { return proxy; },
    construct() { return proxy; }
  });
  return proxy;
}

function load(root = path.join(__dirname, ".."), tuning = null) {
  const store = {};
  const window = {};
  if (tuning) window.CryptsEcoTuning = tuning;
  const document = stub();
  const ctx = vm.createContext({
    window, document, console, Math, JSON, Date, Array, Object, Set, Map, Number, String,
    Symbol, Promise, Error, RegExp, parseInt, parseFloat, isNaN, Infinity, NaN, WeakMap,
    structuredClone,
    localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    navigator: { userAgent: "node", language: "en", languages: ["en"], serviceWorker: { ready: Promise.resolve({}), register: () => Promise.resolve({}), addEventListener() {} } },
    location: { href: "http://localhost/", search: "", hash: "" },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    addEventListener() {}, removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    Audio: function () { return stub(); }, Image: function () { return stub(); },
    AudioContext: function () { return stub(); }, fetch: () => Promise.resolve({ ok: false, json: async () => ({}) }),
    performance: { now: () => Date.now() }, CSS: { supports: () => false },
    Capacitor: undefined, Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 }, NodeFilter: {}, MutationObserver: function () { return { observe() {}, disconnect() {} }; }, IntersectionObserver: function () { return stub(); }, ResizeObserver: function () { return stub(); }
  });
  window.window = window; Object.assign(window, ctx); ctx.globalThis = ctx;
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const scripts = [...html.matchAll(/<script src="\.\/([^"?]+)/g)].map((m) => m[1]);
  const errors = [];
  for (const rel of scripts) {
    let code = fs.readFileSync(path.join(root, rel), "utf8");
    try { vm.runInContext(code, ctx, { filename: rel }); }
    catch (e) { errors.push(`${rel}: ${e.message.split("\n")[0]}`); }
  }
  return { ctx, errors, run: (code) => vm.runInContext(code, ctx) };
}

module.exports = { load };
if (require.main === module) {
  const { errors } = load();
  console.log(errors.length ? errors.join("\n") : "loaded with no errors");
}
