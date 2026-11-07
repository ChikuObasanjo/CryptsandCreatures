"use strict";

// Which layout the game uses, and the measurements the phone layout needs (phone.css).
//
// Phones (narrow screens) get the full-screen layout: the map behind everything, a slim
// status bar on top, controls docked at the bottom. This file:
//   - sets body.phone-layout when the screen is narrow (and redraws when that changes,
//     e.g. turning a tablet),
//   - measures the top bar and the bottom controls and publishes them as --hud-top and
//     --hud-bottom, so floating pieces sit just inside them,
//   - works out --map-shift: how far to move the map so you stand in the middle of the open
//     space between the bars instead of the middle of the screen (behind the controls).

const PHONE_LAYOUT_QUERY = "(max-width: 760px)";
let layoutShift = 0;
let layoutShiftX = 0;
let layoutObserver = null;

// How far the map is moved down (or up) and sideways; mapViewShape() draws extra tiles to cover it.
function layoutMapShift() {
  return Math.max(Math.abs(layoutShift), Math.abs(layoutShiftX));
}

function layoutIsPhone() {
  return document.body.classList.contains("phone-layout");
}

function layoutRedrawMap() {
  if (state.gameStarted && ["city", "dungeon"].includes(state.run?.location)) renderMap();
}

function layoutBottomBar() {
  if (document.body.classList.contains("town-game")) return document.querySelector(".town-touch-dpad");
  return document.querySelector(".dungeon-controls");
}

// Reads the bars' heights. Only runs when one of them changes size (ResizeObserver), never
// in the middle of drawing a turn.
function layoutMeasure() {
  const root = document.body;
  if (!layoutIsPhone()) {
    if (layoutShift || layoutShiftX) {
      layoutShift = 0;
      layoutShiftX = 0;
      root.style.removeProperty("--map-shift");
      root.style.removeProperty("--map-shift-x");
    }
    return;
  }
  const top = document.querySelector(".topbar")?.getBoundingClientRect().height || 0;
  // Turned sideways, the controls dock down the right edge instead of along the bottom.
  const landscape = window.innerWidth > window.innerHeight;
  root.classList.toggle("phone-landscape", landscape);
  const bar = layoutBottomBar()?.getBoundingClientRect();
  // (Fixed-position bars have no offsetParent, so a hidden bar is recognised by having no size.)
  const bottom = bar && !landscape ? bar.height : 0;
  const right = bar && landscape ? bar.width : 0;
  root.style.setProperty("--hud-top", `${Math.round(top)}px`);
  root.style.setProperty("--hud-bottom", `${Math.round(bottom)}px`);
  root.style.setProperty("--hud-right", `${Math.round(right)}px`);
  const shift = Math.round((top - bottom) / 2);
  const shiftX = Math.round(-right / 2);
  if (shift !== layoutShift || shiftX !== layoutShiftX) {
    const before = layoutMapShift();
    layoutShift = shift;
    layoutShiftX = shiftX;
    root.style.setProperty("--map-shift", `${shift}px`);
    root.style.setProperty("--map-shift-x", `${shiftX}px`);
    if (Math.abs(layoutMapShift() - before) > 8) layoutRedrawMap();
  }
}

function layoutApply() {
  const phone = window.matchMedia(PHONE_LAYOUT_QUERY).matches;
  const changed = phone !== layoutIsPhone();
  document.body.classList.toggle("phone-layout", phone);
  if (layoutObserver) {
    layoutObserver.disconnect();
    if (phone) {
      for (const element of [document.querySelector(".topbar"), document.querySelector(".dungeon-controls"), document.querySelector(".town-touch-dpad")]) {
        if (element) layoutObserver.observe(element);
      }
    }
  }
  layoutMeasure();
  if (changed) layoutRedrawMap();
}

function connectLayout() {
  layoutObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => layoutMeasure()) : null;
  window.matchMedia(PHONE_LAYOUT_QUERY).addEventListener?.("change", layoutApply);
  layoutApply();
}
