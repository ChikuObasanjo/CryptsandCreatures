"use strict";

(() => {
  const catalogUrls = {
    en: "./data/locales/en.json",
    es: "./data/locales/es.json",
    nah: "./data/locales/nah.json"
  };
  const catalogs = {};
  let language = "en";

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
  }));

  function translate(key, values = {}) {
    const template = catalogs[language]?.[key];
    const value = template || catalogs.en?.[key] || key;
    return value.replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match);
  }

  // Plain text in labels and similar static elements: translate a text node when its whole
  // trimmed English text is a catalog key. The English key is remembered on the node.
  function translateStaticTextNodes() {
    const english = catalogs.en || {};
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest("script, style, [data-i18n], [data-i18n-dynamic]")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.i18nKey === undefined) {
        const text = node.nodeValue.trim();
        node.i18nKey = text && Object.prototype.hasOwnProperty.call(english, text) ? text : null;
      }
      if (node.i18nKey) {
        const lead = node.nodeValue.match(/^\s*/)[0];
        const tail = node.nodeValue.match(/\s*$/)[0];
        node.nodeValue = `${lead}${translate(node.i18nKey)}${tail}`;
      }
    }
  }

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
    translateStaticTextNodes();
  }

  window.cryptsLocale = {
    get language() { return language; },
    ready,
    t: translate,
    apply(nextLanguage) {
      language = ["es", "nah"].includes(nextLanguage) ? nextLanguage : "en";
      document.documentElement.lang = language;
      applyStaticTranslations();
    }
  };
})();
