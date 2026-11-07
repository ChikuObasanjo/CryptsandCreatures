"use strict";

// Safety nets. Loaded first, before any other script, so it can catch problems anywhere.
//
// 1. Unexpected errors. Without a handler, an error in one turn just vanishes into the
//    browser's console (which nobody sees on a phone) and the game may quietly stop
//    responding. Here every error is written to a small log kept on the device, and the
//    player sees a short message once instead of a frozen screen with no explanation.
//    Settings → "Copy problem report" puts that log on the clipboard to send to the author.
// 2. Keeping the save. Browsers may clear a site's storage when the device is short of space
//    unless the site asks to keep it; this asks once (the browser decides, usually yes for
//    an installed app).

const SAFETY_LOG_KEY = "cnc-problem-log";
const SAFETY_LOG_LIMIT = 20;
const SAFETY_NOTICE_GAP_MS = 30000;
let safetyLastNotice = 0;

function safetyReadLog() {
  try {
    const log = JSON.parse(localStorage.getItem(SAFETY_LOG_KEY) || "[]");
    return Array.isArray(log) ? log : [];
  } catch {
    return [];
  }
}

function safetyWhere() {
  try {
    if (typeof state === "undefined" || !state?.run) return "menu";
    return state.run.location === "dungeon" ? `floor ${state.run.floor}` : state.run.location || "town";
  } catch {
    return "unknown";
  }
}

function safetyRecord(kind, error, file, line) {
  const entry = {
    at: new Date().toISOString(),
    kind,
    message: String(error?.message || error || "Unknown error").slice(0, 300),
    where: safetyWhere(),
    source: file ? `${String(file).replace(location.origin, "")}:${line || "?"}` : undefined,
    stack: typeof error?.stack === "string" ? error.stack.split("\n").slice(0, 6).join("\n") : undefined
  };
  try {
    const log = safetyReadLog();
    log.push(entry);
    localStorage.setItem(SAFETY_LOG_KEY, JSON.stringify(log.slice(-SAFETY_LOG_LIMIT)));
  } catch { /* storage full or blocked: the notice still shows */ }
  safetyNotify();
}

function safetyNotify() {
  const now = Date.now();
  if (now - safetyLastNotice < SAFETY_NOTICE_GAP_MS) return;
  safetyLastNotice = now;
  const text = typeof t === "function"
    ? t("Something went wrong. Your game is saved; if it keeps happening, Settings has a problem report you can send.")
    : "Something went wrong. Your game is saved; if it keeps happening, Settings has a problem report you can send.";
  try {
    if (typeof showToast === "function") return showToast(text, 6000);
  } catch { /* fall through to a plain notice */ }
  try {
    const box = document.createElement("div");
    box.className = "safety-notice";
    box.setAttribute("role", "alert");
    box.textContent = text;
    document.body?.append(box);
    setTimeout(() => box.remove(), 6000);
  } catch { /* nothing more we can do */ }
}

// Errors from browser extensions or other sites are not the game's and are ignored.
function safetyIsOurs(file) {
  return !file || String(file).startsWith(location.origin);
}

window.addEventListener("error", (event) => {
  if (!event.error && !event.message) return; // a failed image or script load, not a crash
  if (!safetyIsOurs(event.filename)) return;
  safetyRecord("error", event.error || event.message, event.filename, event.lineno);
});

window.addEventListener("unhandledrejection", (event) => {
  safetyRecord("promise", event.reason);
});

function safetyProblemReport() {
  const log = safetyReadLog();
  const lines = [
    "Crypts & Creatures problem report",
    `Build: ${typeof SPRITE_RESOURCE_VERSION !== "undefined" ? SPRITE_RESOURCE_VERSION : "?"}`,
    `Device: ${navigator.userAgent}`,
    `Screen: ${window.innerWidth}×${window.innerHeight}`,
    ""
  ];
  if (!log.length) lines.push("No problems recorded.");
  for (const entry of log) {
    lines.push(`${entry.at}  [${entry.kind}] (${entry.where}) ${entry.message}${entry.source ? `  at ${entry.source}` : ""}`);
    if (entry.stack) lines.push(entry.stack.split("\n").map((l) => `    ${l.trim()}`).join("\n"));
  }
  return lines.join("\n");
}

async function safetyCopyReport() {
  const report = safetyProblemReport();
  try {
    await navigator.clipboard.writeText(report);
    return true;
  } catch {
    // Older browsers: copy through a hidden text box.
    const box = document.createElement("textarea");
    box.value = report;
    box.setAttribute("readonly", "");
    box.style.position = "fixed";
    box.style.opacity = "0";
    document.body.append(box);
    box.select();
    let copied = false;
    try { copied = document.execCommand("copy"); } catch { copied = false; }
    box.remove();
    return copied;
  }
}

function safetyKeepStorage() {
  try {
    if (navigator.storage?.persist) navigator.storage.persisted().then((kept) => kept || navigator.storage.persist()).catch(() => {});
  } catch { /* not supported */ }
}
