"use strict";

(() => {
  const catalogUrls = {
    en: "./data/locales/en.json",
    es: "./data/locales/es.json"
  };
  const catalogs = {};
  let language = "en";

  const ready = Promise.all(Object.entries(catalogUrls).map(async ([locale, url]) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load ${locale} locale catalog: ${response.status}`);
    catalogs[locale] = await response.json();
  }));

  function translate(key, values = {}) {
    const template = catalogs[language]?.[key];
    const value = template || catalogs.en?.[key] || key;
    return value.replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match);
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
  }

  window.cryptsLocale = {
    get language() { return language; },
    ready,
    t: translate,
    apply(nextLanguage) {
      language = nextLanguage === "es" ? "es" : "en";
      document.documentElement.lang = language;
      applyStaticTranslations();
    }
  };
})();
