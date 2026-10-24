"use strict";

// Translation for Crypts & Creatures.
// English text doubles as the catalog key. Catalog entries may contain positional
// placeholders ({0}, {1}, …) that stand for the parts the game fills in at run time,
// such as names and numbers: "Talk · {0}" matches "Talk · Nali".
// Besides the explicit t() calls and data-i18n attributes, a watcher translates any
// on-screen text the game writes, so dynamic messages, buttons, and lists follow the
// selected language too. Long texts built from several sentences are translated
// sentence by sentence, and lists joined with " · " part by part.

(() => {
  const catalogUrls = {
    en: "./data/locales/en.json",
    es: "./data/locales/es.json",
    nah: "./data/locales/nah.json"
  };
  // Languages that reuse another catalog with their own presentation.
  const LANGUAGE_CATALOG = { en: "en", es: "es", nah: "nah", "nah-abugida": "nah" };
  // Older saves may name the retired "nah-unifont" option; Unifont is now everyone's typeface.
  const LANGUAGE_ALIASES = { "nah-unifont": "nah" };
  const catalogs = {};
  const matchers = {};
  let language = "en";

  // ---------- Nahuatl abugida ----------
  // Edward H. Trager's Nahuatl abugida (unifont.org/nahuatl), written with the
  // Private Use Area code points of his NahuatlOne font. Each consonant carries an
  // inherent /a/; other vowels are signs written above it, and a syllable-final
  // consonant is written below, after the subjoiner sign. Input is the modern
  // (k, s, w, j) spelling used by the Nahuatl catalog.
  const NAB_VOWEL = { a: "\uED90", e: "\uED91", i: "\uED92", o: "\uED93", u: "\uED94" };
  const NAB_SIGN = { e: "\uEDA1", i: "\uEDA2", o: "\uEDA3", u: "\uEDA4" };
  const NAB_COMPOUND = { ia: "\uEDA5", ai: "\uEDA6", oa: "\uEDA7", eo: "\uEDA8", ei: "\uEDA9", io: "\uEDAA", ao: "\uEDAC" };
  const NAB_SUBJOINER = "\uEDAB";
  // Single-letter stand-ins for digraph sounds: K = kw, T = ts, L = tl, C = ch, R = rr.
  const NAB_CONSONANT = {
    m: "\uEDB0", n: "\uEDB1", p: "\uEDB2", t: "\uEDB3", k: "\uEDB4", K: "\uEDB5", T: "\uEDB6", L: "\uEDB7",
    C: "\uEDB8", s: "\uEDB9", x: "\uEDBA", h: "\uEDBB", l: "\uEDBC", y: "\uEDBD", w: "\uEDBE",
    "ñ": "\uEDC0", b: "\uEDC1", d: "\uEDC2", g: "\uEDC3", f: "\uEDC4", r: "\uEDC5", R: "\uEDC6"
  };
  const NAB_SKIP_WORDS = new Set(["gp", "sp", "cp", "lb", "lbs", "min", "xp", "hp", "ac", "dc", "vs", "esc", "ok"]);
  const isNabVowel = (c) => c.length === 1 && "aeiou".includes(c);

  function nahuatlSounds(word) {
    let w = word.normalize("NFD").replace(/[\u0300-\u0302\u0304-\u036f]/g, "").normalize("NFC").toLowerCase();
    w = w.replace(/tl/g, "L").replace(/t[sz]/g, "T").replace(/ch/g, "C").replace(/sh/g, "x").replace(/rr/g, "R")
      .replace(/kw/g, "K").replace(/[kc]u(?=[aeio])/g, "K").replace(/qu(?=[ei])/g, "k").replace(/hu(?=[aeio])/g, "w")
      .replace(/c(?=[ei])/g, "s").replace(/[cq]/g, "k").replace(/z/g, "s").replace(/j/g, "h").replace(/v/g, "b");
    // u beside another vowel is the glide w (tlauilli, kuoujtla).
    w = w.replace(/(?<=[aeio])u|u(?=[aeio])/g, "w").replace(/(?<=[aeio])h(?=[aeio])/g, "h");
    return [...w];
  }

  function nahuatlWordToAbugida(word) {
    const sounds = nahuatlSounds(word);
    let out = "";
    let index = 0;
    const closeSyllable = () => {
      const next = sounds[index];
      if (next && NAB_CONSONANT[next] && !isNabVowel(sounds[index + 1] || "")) {
        out += NAB_SUBJOINER + NAB_CONSONANT[next];
        index += 1;
      }
    };
    while (index < sounds.length) {
      const sound = sounds[index];
      if (NAB_CONSONANT[sound]) {
        out += NAB_CONSONANT[sound];
        index += 1;
        const vowel = sounds[index];
        if (vowel && isNabVowel(vowel)) {
          const pair = NAB_COMPOUND[vowel + (sounds[index + 1] || "")];
          if (pair) {
            out += pair;
            index += 2;
          } else {
            if (vowel !== "a") out += NAB_SIGN[vowel];
            index += 1;
          }
          closeSyllable();
        }
      } else if (isNabVowel(sound)) {
        out += NAB_VOWEL[sound];
        index += 1;
        closeSyllable();
      } else {
        out += sound;
        index += 1;
      }
    }
    return out;
  }

  // Convert the words of a translated text, leaving numbers, abbreviations, and symbols alone.
  function toAbugida(text) {
    if (typeof text !== "string") return text;
    return text.replace(/[A-Za-zÀ-ÿñÑ]+/g, (word, offset) => {
      const lower = word.toLowerCase();
      const touchesDigit = /\d/.test(text[offset - 1] || "") || /\d/.test(text[offset + word.length] || "");
      if (touchesDigit || NAB_SKIP_WORDS.has(lower) || (word.length <= 3 && word === word.toUpperCase())) return word;
      return nahuatlWordToAbugida(word);
    });
  }
  const abugidaActive = () => language === "nah-abugida";

  const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Compile the {0}-style entries of a catalog into anchored patterns, grouped by their
  // leading literal text so each lookup only tries a handful.
  function compileMatchers(catalog) {
    const byPrefix = new Map();
    const loose = [];
    for (const key of Object.keys(catalog)) {
      if (!/\{\w+\}/.test(key)) continue;
      const parts = key.split(/(\{\w+\})/);
      const order = [];
      let source = "^";
      for (const part of parts) {
        const slot = /^\{(\w+)\}$/.exec(part);
        if (slot) {
          order.push(slot[1]);
          source += "([\\s\\S]*?)";
        } else source += escapeRegex(part);
      }
      source += "$";
      const literal = parts.filter((part) => part && !/^\{\w+\}$/.test(part)).join("");
      // Patterns that are almost all placeholders would match nearly anything.
      if (literal.replace(/[\s·:;,.()+\-–—/%]/g, "").length < 3) continue;
      const entry = { key, regex: new RegExp(source), order, literalLength: literal.length,
        allowsList: key.includes(" · "), allowsSentences: /[.!?]\s/.test(key) };
      const prefix = parts[0] ? parts[0].slice(0, 4) : "";
      if (prefix.length >= 2) {
        if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
        byPrefix.get(prefix).push(entry);
      } else loose.push(entry);
    }
    // Prefer the most specific (longest literal) patterns.
    for (const list of byPrefix.values()) list.sort((a, b) => b.key.length - a.key.length);
    loose.sort((a, b) => b.literalLength - a.literalLength);
    return { byPrefix, loose };
  }

  // A long entry whose translation has the same number of sentences also teaches each
  // sentence on its own, so the text still translates when the game adds or drops a sentence.
  function addSentencePairs(catalog) {
    for (const [key, value] of Object.entries(catalog)) {
      if (typeof value !== "string" || key === value) continue;
      const sources = splitSentences(key);
      if (sources.length < 2) continue;
      const targets = splitSentences(value);
      if (targets.length !== sources.length) continue;
      sources.forEach((source, index) => {
        if (!Object.prototype.hasOwnProperty.call(catalog, source)) catalog[source] = targets[index];
      });
    }
  }

  const ready = Promise.all(Object.entries(catalogUrls).map(async ([locale, url]) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      catalogs[locale] = await response.json();
    } catch (error) {
      // English keys double as the English text, so the game stays playable without catalogs.
      console.warn(`Could not load the ${locale} language catalog: ${error.message}`);
      catalogs[locale] = {};
    }
    addSentencePairs(catalogs[locale], catalogs.en || {});
    matchers[locale] = compileMatchers(catalogs[locale]);
  }));

  const activeCatalog = () => LANGUAGE_CATALOG[language] || "en";

  function translate(key, values = {}) {
    const template = catalogs[activeCatalog()]?.[key];
    const value = template || catalogs.en?.[key] || key;
    const filled = value.replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match);
    return template && abugidaActive() ? toAbugida(filled) : filled;
  }

  // Sentence boundaries: end punctuation followed by a space and a capital (so "72.2 lb" and "vs. 12" stay whole).
  const splitSentences = (text) => text.split(/(?<=[.!?…]["”’»)]?)\s+(?=["“«¿¡(]?[A-ZÁÉÍÓÚÑ])/);

  // Results are remembered per language: the same labels are rendered over and over.
  const memo = new Map();
  function translateText(text, depth = 0) {
    if (depth > 0) return translateUncached(text, depth);
    const cacheKey = `${language}\u0000${text}`;
    if (memo.has(cacheKey)) return memo.get(cacheKey);
    let result = translateUncached(text, 0);
    if (result !== null && abugidaActive()) result = toAbugida(result);
    if (memo.size > 20000) memo.clear();
    memo.set(cacheKey, result);
    return result;
  }

  // Translate an arbitrary piece of game text, or return null when nothing applies.
  function translateUncached(text, depth = 0) {
    const locale = activeCatalog();
    if (locale === "en" || !text || depth > 3) return null;
    const catalog = catalogs[locale] || {};
    if (Object.prototype.hasOwnProperty.call(catalog, text)) return catalog[text];
    const compiled = matchers[locale];
    if (compiled) {
      const candidates = [...(compiled.byPrefix.get(text.slice(0, 4)) || []), ...compiled.loose];
      for (const entry of candidates) {
        const match = entry.regex.exec(text);
        if (!match) continue;
        // A placeholder stands for a name or a number, not for a whole list or another sentence.
        const captures = match.slice(1);
        if (!entry.allowsList && captures.some((value) => value.includes(" · "))) continue;
        if (!entry.allowsSentences && captures.some((value) => /[.!?]\s+\S/.test(value))) continue;
        const values = captures.map((value) => translateText(value, depth + 1));
        // Short patterns such as "{0} and {1}" only apply to names, numbers, and known terms.
        if (entry.literalLength < 8 && captures.some((value, index) => values[index] === null
          && (value.split(/\s+/).length > 4 || /(^|\s)[a-z]/.test(value)))) continue;
        for (let index = 0; index < values.length; index += 1) values[index] ??= captures[index];
        const template = catalog[entry.key];
        return template.replace(/\{(\w+)\}/g, (whole, name) => {
          const position = entry.order.indexOf(name);
          return position >= 0 ? values[position] : whole;
        });
      }
    }
    // Texts built from several sentences translate sentence by sentence.
    const sentences = splitSentences(text);
    if (sentences.length > 1) {
      const translated = sentences.map((sentence) => translateText(sentence, depth + 1));
      if (translated.some((piece) => piece !== null)) return translated.map((piece, index) => piece ?? sentences[index]).join(" ");
      return null;
    }
    // Lists joined with " · ", " — " or "; " translate piece by piece.
    for (const separator of [" · ", " — ", "; "]) {
      if (text.includes(separator)) {
        const pieces = text.split(separator);
        const translated = pieces.map((piece) => translateText(piece, depth + 1));
        if (translated.some((piece) => piece !== null)) return translated.map((piece, index) => piece ?? pieces[index]).join(separator);
      }
    }
    // Comma lists (skill names and the like) translate only when every item is known.
    if (text.includes(", ")) {
      const pieces = text.split(", ");
      const translated = pieces.map((piece) => (Object.prototype.hasOwnProperty.call(catalog, piece) ? catalog[piece] : null));
      if (translated.every((piece) => piece !== null)) return translated.join(", ");
    }
    return null;
  }

  // ---------- Live translation of on-screen text ----------
  const original = new WeakMap();
  const SKIP = "script, style, textarea, input, [data-i18n-dynamic], [data-no-translate]";

  function translateNode(node) {
    const parent = node.parentElement;
    if (!parent || parent.closest(SKIP)) return;
    const record = original.get(node);
    const current = node.nodeValue;
    let source = current;
    if (record && current === record.rendered) source = record.source;
    if (activeCatalog() === "en") {
      if (record && current === record.rendered && record.source !== current) node.nodeValue = record.source;
      original.delete(node);
      return;
    }
    const trimmed = source.trim();
    if (!trimmed || !/[A-Za-z]/.test(trimmed)) return;
    const translated = translateText(trimmed);
    if (translated === null) {
      if (record && current === record.rendered && current !== source) node.nodeValue = source;
      original.delete(node);
      return;
    }
    const rendered = source.replace(trimmed, translated);
    original.set(node, { source, rendered });
    if (current !== rendered) node.nodeValue = rendered;
  }

  function translateTree(root) {
    if (root.nodeType === Node.TEXT_NODE) {
      translateNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) translateNode(node);
  }

  let pending = new Set();
  let scheduled = false;
  function flush() {
    scheduled = false;
    const roots = [...pending];
    pending = new Set();
    for (const root of roots) if (root.isConnected) translateTree(root);
  }
  const observer = new MutationObserver((mutations) => {
    if (activeCatalog() === "en") return;
    for (const mutation of mutations) {
      if (mutation.type === "characterData") pending.add(mutation.target);
      else for (const node of mutation.addedNodes) pending.add(node);
    }
    if (!scheduled && pending.size) {
      scheduled = true;
      queueMicrotask(flush);
    }
  });

  function applyStaticTranslations() {
    for (const element of document.querySelectorAll("[data-i18n]")) {
      const key = element.dataset.i18n;
      element.textContent = translate(key);
    }
    for (const element of document.querySelectorAll("[data-i18n-attr]")) {
      for (const spec of element.dataset.i18nAttr.split(";")) {
        const [attribute, ...keyParts] = spec.trim().split(":");
        if (attribute && keyParts.length) element.setAttribute(attribute, translate(keyParts.join(":")));
      }
    }
    translateTree(document.body);
  }

  window.cryptsLocale = {
    get language() { return language; },
    ready,
    t: translate,
    translateText,
    toAbugida,
    apply(nextLanguage) {
      const requested = LANGUAGE_ALIASES[nextLanguage] || nextLanguage;
      language = Object.prototype.hasOwnProperty.call(LANGUAGE_CATALOG, requested) ? requested : "en";
      document.documentElement.lang = activeCatalog() === "en" ? "en" : activeCatalog();
      document.body.classList.toggle("nahuatl-abugida", language === "nah-abugida");
      applyStaticTranslations();
      observer.disconnect();
      if (activeCatalog() !== "en") {
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      }
    }
  };
})();
