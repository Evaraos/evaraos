const ROW_SELECTOR = [
  ".eva-menu-control",
  ".eva-app-link",
  ".eva-quick-strip a",
  ".eva-account-strip a"
].join(",");

const THEME_ICON = Object.freeze({
  system: "themeSystem",
  light: "themeLight",
  dark: "themeDark",
  image: "themeImage"
});

function activate(node) {
  if (!node) return;
  node.classList.add("is-hovered");
}

function deactivate(node) {
  if (!node) return;
  node.classList.remove("is-hovered");
  node.classList.remove("is-pressed");
}

function syncThemeButton(button, mode) {
  const value = THEME_ICON[mode] ? mode : "system";
  const icon = window.EvaraIcons?.iconSvg?.(THEME_ICON[value]);
  if (icon) button.innerHTML = icon;
  button.dataset.themeMode = value;
  button.title = `Appearance: ${value}`;
  button.setAttribute("aria-label", `Appearance: ${value}. Click to change.`);
}

function bindThemeButton(panel) {
  const button = panel.querySelector("#evaMenuThemeBtn");
  if (!button || button.dataset.themeBound === "true") return;
  button.dataset.themeBound = "true";

  syncThemeButton(button, window.EvaraTheme?.getThemeMode?.() || "system");

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const modes = ["system", "light", "dark", "image"];
    const current = window.EvaraTheme?.getThemeMode?.() || "system";
    const next = modes[(modes.indexOf(current) + 1) % modes.length];
    window.EvaraTheme?.setThemeMode?.(next);
    syncThemeButton(button, next);
  });

  window.addEventListener("evara:appearance-updated", (event) => {
    syncThemeButton(button, event.detail?.mode || window.EvaraTheme?.getThemeMode?.() || "system");
  });
}

export function bindNavInteractions() {
  const panel = document.getElementById("evaMenuPanel");
  if (!panel || panel.dataset.interactionsBound === "true") return;

  panel.dataset.interactionsBound = "true";
  bindThemeButton(panel);

  panel.addEventListener("pointerover", event => {
    const target = event.target.closest(ROW_SELECTOR);
    if (!target || !panel.contains(target)) return;
    activate(target);
  }, { passive: true });

  panel.addEventListener("pointerout", event => {
    const target = event.target.closest(ROW_SELECTOR);
    deactivate(target);
  }, { passive: true });

  panel.addEventListener("pointerdown", event => {
    const target = event.target.closest(ROW_SELECTOR);
    if (!target || !panel.contains(target)) return;
    target.classList.add("is-pressed");
  }, { passive: true });

  panel.addEventListener("pointerup", event => {
    const target = event.target.closest(ROW_SELECTOR);
    if (!target) return;
    window.setTimeout(() => target.classList.remove("is-pressed"), 140);
  }, { passive: true });

  panel.addEventListener("pointercancel", event => {
    deactivate(event.target.closest(ROW_SELECTOR));
  }, { passive: true });
}
