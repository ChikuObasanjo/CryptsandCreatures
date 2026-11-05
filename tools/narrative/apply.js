"use strict";
// Applies a batch of rewritten narrative text (tools/narrative/batch-*.json).
//
// Each entry was drafted first in Classical Nahuatl (`nah`, in the old Spanish-based
// spelling) and then written out in each language from that draft. This script:
//   - replaces the old English in the game's source files with the new English,
//   - re-keys every language catalog (data/locales/*.json) on the new English, dropping
//     the old key, and
//   - puts the draft, respelled in the modern k/w/s spelling the Nahuatl catalog and the
//     abugida use, in nah.json.
// The batch files stay as the record of the drafts.
//
// Usage: node tools/narrative/apply.js tools/narrative/batch-01-tomb.json [--dry]

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const batchFile = process.argv[2];
const dry = process.argv.includes("--dry");
const batch = JSON.parse(fs.readFileSync(batchFile, "utf8"));
const LANGS = ["en", "es", "fr", "de", "pt", "ja", "ko", "zh", "nah"];

// Classical spelling (qu, cu/uc, hu/uh, c, z, tz, h for the glottal stop) to the modern
// spelling (k, kw, w, s, ts, j).
function respell(text) {
  const word = (w) => {
    const upper = w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase();
    let s = w.toLowerCase()
      .replace(/qu(?=[ei])/g, "k")
      .replace(/cu(?=[aeio])/g, "kw")
      .replace(/uc/g, "kw")
      .replace(/hu(?=[aeio])/g, "w")
      .replace(/uh/g, "w")
      .replace(/tz/g, "ts")
      .replace(/ch/g, "\u0001")
      .replace(/c(?=[ei])/g, "s")
      .replace(/c/g, "k")
      .replace(/z/g, "s")
      .replace(/h/g, "j")
      .replace(/\u0001/g, "ch");
    return upper ? s[0].toUpperCase() + s.slice(1) : s;
  };
  return text.replace(/[A-Za-zÀ-ÿ]+/g, word);
}

const sourceFiles = ["app.js", ...["data", "systems"].flatMap((dir) =>
  fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith(".js")).map((f) => `${dir}/${f}`))];
const sources = Object.fromEntries(sourceFiles.map((f) => [f, fs.readFileSync(path.join(root, f), "utf8")]));
const catalogs = Object.fromEntries(LANGS.map((id) => [id, JSON.parse(fs.readFileSync(path.join(root, "data/locales", `${id}.json`), "utf8"))]));

let replaced = 0;
const missing = [];
for (const entry of batch) {
  for (const id of LANGS) if (!entry[id]) throw new Error(`Missing ${id} for: ${entry.old.slice(0, 60)}`);
  const from = JSON.stringify(entry.old);
  const to = JSON.stringify(entry.en);
  let found = 0;
  for (const file of sourceFiles) {
    const parts = sources[file].split(from);
    if (parts.length > 1) { found += parts.length - 1; sources[file] = parts.join(to); }
  }
  if (!found) missing.push(entry.old.slice(0, 70));
  replaced += found;
  for (const id of LANGS) {
    delete catalogs[id][entry.old];
    catalogs[id][entry.en] = id === "nah" ? respell(entry.nah) : entry[id];
  }
}
console.log(`${batch.length} entries, ${replaced} replacements in source.`);
if (missing.length) console.log("Not found in source (catalogs still updated):\n  " + missing.join("\n  "));
if (!dry) {
  for (const file of sourceFiles) fs.writeFileSync(path.join(root, file), sources[file]);
  for (const id of LANGS) fs.writeFileSync(path.join(root, "data/locales", `${id}.json`), JSON.stringify(catalogs[id], null, 1) + "\n");
  console.log("Written.");
}
