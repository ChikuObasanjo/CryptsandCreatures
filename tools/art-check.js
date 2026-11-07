// The adventurer is drawn entirely from your paintings (art/character/, built into
// resources/character-textures/). This checks that every part the game can put on the figure
// has one, and that every painting the build listed is really there.
// Usage: node tools/art-check.js   (part of npm run check)
const fs = require("fs");
const path = require("path");
const { load } = require("./headless");

const root = path.join(__dirname, "..");
const { run } = load();
const report = JSON.parse(run(`(() => {
  const manifest = window.CryptsCharacterTextures?.parts || {};
  const has = (kind, id) => Boolean(manifest[kind]?.[id]);
  const regalia = (slot) => Object.keys(COSMETICS).filter((id) => COSMETICS[id].slot === slot && !COSMETICS[id].basic);
  const wanted = {
    body: ["base"],
    loincloth: ["maxtlatl", "cueitl"],
    weapon: Object.keys(WEAPONS).filter((id) => !WEAPONS[id].baseId && id !== "none"),
    shield: ["shield"],
    back: Object.keys(COSMETICS).filter((id) => COSMETICS[id].slot === "back"),
    helmet: [...HEADWEAR_STYLES.filter((id) => id !== "none"), ...regalia("helmet")],
    clothes: [...GARMENT_STYLES.filter((id) => id !== "none"), ...regalia("clothes")],
    armor: Object.keys(ARMORS).filter((id) => !ARMORS[id].baseId && id !== "none"),
    adornment: CLOTHING_ADORNMENTS.filter((id) => id !== "none")
  };
  const missing = [];
  let count = 0;
  for (const [kind, ids] of Object.entries(wanted)) for (const id of ids) { count += 1; if (!has(kind, id)) missing.push(kind + "/" + id); }
  const files = [];
  for (const [kind, parts] of Object.entries(manifest)) for (const [id, variants] of Object.entries(parts)) {
    for (const [variant, channels] of Object.entries(variants)) {
      const stem = kind + "/" + id + (variant ? "." + variant : "");
      files.push(stem + ".png", ...channels.map((channel) => stem + "." + channel + ".png"));
    }
  }
  return JSON.stringify({ count, missing, files });
})()`));

const absent = report.files.filter((file) => !fs.existsSync(path.join(root, "resources", "character-textures", file)));
console.log(`${report.count} parts the figure can wear; ${report.count - report.missing.length} painted.`);
if (report.missing.length) {
  console.log(`Not painted yet (they won't show): ${report.missing.length}`);
  for (const part of report.missing) console.log(`  art/character/${part}.dds   (npm run new-part -- ${part.replace("/", " ")})`);
}
if (absent.length) {
  console.log(`Listed by the build but missing from resources/character-textures/ (run npm run build): ${absent.length}`);
  for (const file of absent) console.log(`  ${file}`);
}
if (report.missing.length || absent.length) process.exitCode = 1;
