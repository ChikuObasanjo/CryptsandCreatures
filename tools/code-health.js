// Looks over the game's scripts (in the order index.html loads them) for the problems that
// creep into a codebase of shared global functions:
//   - a function declared in two files (the later one silently wins),
//   - a name that is called but never declared anywhere (a typo or a removed function),
//   - functions nothing calls any more (dead code).
// Usage: node tools/code-health.js   (needs acorn: npm install --no-save acorn acorn-walk)
const fs = require("fs");
const path = require("path");
const acorn = require("acorn");
const walk = require("acorn-walk");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const files = [...html.matchAll(/src="\.\/([^"?]+\.js)/g)].map((m) => m[1]).filter((f) => fs.existsSync(path.join(root, f)));
files.push("sw.js");

const declared = new Map(); // name -> [file]
const topLevel = new Set();
const used = new Map(); // name -> count
const calls = new Map(); // name -> first file:line
for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  let ast;
  try { ast = acorn.parse(source, { ecmaVersion: "latest", sourceType: "script", locations: true }); } catch (error) { console.log(`PARSE ${file}: ${error.message}`); continue; }
  for (const node of ast.body) {
    if (node.type === "FunctionDeclaration") {
      if (!declared.has(node.id.name)) declared.set(node.id.name, []);
      declared.get(node.id.name).push(`${file}:${node.loc.start.line}`);
    }
    if (node.type === "VariableDeclaration") for (const d of node.declarations) if (d.id.type === "Identifier") topLevel.add(d.id.name);
    if (node.type === "ClassDeclaration") topLevel.add(node.id.name);
  }
  // Every identifier that is referenced (not just declared), and every bare call.
  const locals = new Set();
  walk.full(ast, (node) => {
    if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") {
      for (const p of node.params) walk.full(p, (n) => { if (n.type === "Identifier") locals.add(n.name); });
      if (node.id) locals.add(node.id.name);
    }
    if (node.type === "VariableDeclarator") walk.full(node.id, (n) => { if (n.type === "Identifier") locals.add(n.name); });
    if (node.type === "CatchClause" && node.param) walk.full(node.param, (n) => { if (n.type === "Identifier") locals.add(n.name); });
    if (node.type === "ClassDeclaration" && node.id) locals.add(node.id.name);
  });
  walk.ancestor(ast, {
    Identifier(node, ancestors) {
      const parent = ancestors[ancestors.length - 2];
      if (parent?.type === "MemberExpression" && parent.property === node && !parent.computed) return;
      if (parent?.type === "Property" && parent.key === node && !parent.computed && parent.value !== node) return;
      if (parent?.type === "FunctionDeclaration" && parent.id === node) return;
      used.set(node.name, (used.get(node.name) || 0) + 1);
      if (parent?.type === "CallExpression" && parent.callee === node && !calls.has(node.name)) calls.set(node.name, { at: `${file}:${node.loc.start.line}`, local: locals.has(node.name) });
    }
  });
}

const browser = new Set(Object.getOwnPropertyNames(globalThis).concat([
  "window", "document", "navigator", "localStorage", "sessionStorage", "fetch", "caches", "self", "location", "performance",
  "requestAnimationFrame", "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback", "setTimeout", "clearTimeout", "setInterval", "clearInterval",
  "Image", "FileReader", "Blob", "Response", "Request", "Headers", "URL", "getComputedStyle", "matchMedia", "alert", "confirm",
  "HTMLElement", "Node", "Event", "CustomEvent", "MutationObserver", "ResizeObserver", "IntersectionObserver", "AbortController",
  "TextEncoder", "TextDecoder", "crypto", "indexedDB", "speechSynthesis", "SpeechSynthesisUtterance", "AudioContext", "OffscreenCanvas",
  "DOMParser", "XMLSerializer", "atob", "btoa", "structuredClone", "queueMicrotask", "clients", "importScripts", "scrollTo", "innerWidth", "innerHeight", "devicePixelRatio", "screen", "history", "open", "print", "close", "addEventListener", "removeEventListener", "dispatchEvent", "visualViewport", "CSS"
]));

const duplicates = [...declared].filter(([, where]) => where.length > 1);
console.log(`${files.length} scripts, ${declared.size} global functions.\n`);
console.log(`Declared in more than one place (the later one wins): ${duplicates.length}`);
for (const [name, where] of duplicates) console.log(`  ${name}: ${where.join(", ")}`);
const missing = [...calls].filter(([name, info]) => !declared.has(name) && !topLevel.has(name) && !browser.has(name) && !info.local);
console.log(`\nCalled but never declared: ${missing.length}`);
for (const [name, info] of missing) console.log(`  ${name}()  first at ${info.at}`);
// Helpers kept for the tools/ scripts count as used.
const toolText = fs.readdirSync(path.join(root, "tools")).filter((f) => f.endsWith(".js")).map((f) => fs.readFileSync(path.join(root, "tools", f), "utf8")).join("\n");
const dead = [...declared].filter(([name]) => (used.get(name) || 0) === 0 && !new RegExp(`\\b${name}\\b`).test(toolText));
console.log(`\nDeclared but never used: ${dead.length}`);
for (const [name, where] of dead) console.log(`  ${name}  ${where[0]}`);

// Duplicates and missing names are real bugs, so they fail `npm run check`; dead code is only reported.
if (duplicates.length || missing.length) process.exitCode = 1;
