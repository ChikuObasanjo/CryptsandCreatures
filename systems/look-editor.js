"use strict";

// Visual pickers for the appearance choices in character creation and at the mirror.
// Each <select data-look="swatch|chips"> stays the source of truth (forms, saves, and
// the mirror read it); a row of color swatches or option chips is drawn beside it and
// kept in sync. Picking one sets the select and fires a normal "change" event.

function lookPickerFor(select) {
  const next = select.nextElementSibling;
  if (next?.classList.contains("look-picker")) return next;
  const picker = document.createElement("div");
  picker.className = "look-picker";
  picker.setAttribute("role", "radiogroup");
  select.classList.add("look-select-hidden");
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");
  select.after(picker);
  picker.addEventListener("click", (event) => {
    const button = event.target.closest("[data-value]");
    if (!button) return;
    event.preventDefault();
    chooseLookOption(select, button.dataset.value);
    button.focus({ preventScroll: true });
  });
  picker.addEventListener("keydown", (event) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const options = [...select.options];
    const index = Math.max(0, options.findIndex((option) => option.value === select.value));
    const next = options[(index + keys[event.key] + options.length) % options.length];
    chooseLookOption(select, next.value);
    picker.querySelector(`[data-value="${CSS.escape(next.value)}"]`)?.focus({ preventScroll: true });
  });
  return picker;
}

function chooseLookOption(select, value) {
  if (select.value !== value) {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }
  renderLookPicker(select);
}

function renderLookPicker(select) {
  const picker = lookPickerFor(select);
  const swatch = select.dataset.look === "swatch";
  picker.classList.toggle("look-swatches", swatch);
  picker.classList.toggle("look-chips", !swatch);
  const options = [...select.options];
  const signature = options.map((option) => option.value).join("|");
  if (picker.dataset.signature !== signature) {
    picker.dataset.signature = signature;
    picker.replaceChildren(...options.map((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = swatch ? "look-swatch" : "look-chip";
      button.dataset.value = option.value;
      button.setAttribute("role", "radio");
      if (swatch) button.style.setProperty("--swatch", option.value);
      else button.append(document.createElement("span"));
      return button;
    }));
  }
  const buttons = picker.children;
  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    const button = buttons[index];
    const label = option.textContent;
    const selected = option.value === select.value;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (swatch) {
      if (button.title !== label) { button.title = label; button.setAttribute("aria-label", label); }
    } else if (button.firstChild.textContent !== label) button.firstChild.textContent = label;
  }
  const valueLabel = select.closest("label")?.querySelector(".look-value");
  if (valueLabel) valueLabel.textContent = select.selectedOptions[0]?.textContent || "";
}

function refreshLookPickers(root = document) {
  root.querySelectorAll("select[data-look]").forEach(renderLookPicker);
}

// Pick a random value for every visible appearance choice in a container.
function randomizeLook(root) {
  const selects = [...root.querySelectorAll("select[data-look]")].filter((select) => !select.closest("label")?.hidden);
  for (const select of selects) {
    const options = [...select.options];
    if (!options.length) continue;
    // Keep "none" choices a little less likely so a surprise look has something to show.
    const pool = options.length > 2 ? options.filter((option) => option.value !== "none" || Math.random() < 0.35) : options;
    select.value = pool[Math.floor(Math.random() * pool.length)].value;
    // Beards stay the exception rather than the rule.
    if (select.name === "beard" && Math.random() < 0.6) select.value = "none";
  }
  selects[0]?.dispatchEvent(new Event("change", { bubbles: true }));
  refreshLookPickers(root);
}

function selectLookTab(root, tabId) {
  for (const tab of root.querySelectorAll("[data-look-tab]")) {
    const active = tab.dataset.lookTab === tabId;
    tab.setAttribute("aria-selected", String(active));
    tab.classList.toggle("is-active", active);
  }
  for (const panel of root.querySelectorAll("[data-look-panel]")) panel.hidden = panel.dataset.lookPanel !== tabId;
  if (root === elements["character-form"]) {
    state.lookTab = tabId;
    updateCharacterPreview();
  }
}

const LOOK_FACINGS = ["east", "west", "north-west", "north-east"];

function connectLookEditor() {
  const form = elements["character-form"];
  form.querySelector(".look-tabs").addEventListener("click", (event) => {
    const tab = event.target.closest("[data-look-tab]");
    if (tab) selectLookTab(form, tab.dataset.lookTab);
  });
  elements["look-randomize"].addEventListener("click", () => randomizeLook(form));
  elements["look-turn"].addEventListener("click", () => {
    const index = LOOK_FACINGS.indexOf(state.previewFacing || "east");
    state.previewFacing = LOOK_FACINGS[(index + 1) % LOOK_FACINGS.length];
    updateCharacterPreview();
  });
  selectLookTab(form, "body");
}
