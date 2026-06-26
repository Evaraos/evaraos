export const APPEARANCE_KEY = "evaraos-appearance";
export const VALID_MODES = Object.freeze(["light", "dark", "system", "image"]);
export const VALID_IMAGE_THEMES = Object.freeze(["light", "dark"]);
export const IMAGE_POSITIONS = Object.freeze(["center center", "center top", "center bottom", "left center", "right center"]);

export const DEFAULT_APPEARANCE = Object.freeze({
  mode: "light",
  imageTheme: "dark",
  imageUrl: "",
  imagePosition: "center center",
  imageOverlay: 0.36,
  glassTransparency: 0.72,
  updatedAt: null
});

export function systemTheme() { try { return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; } catch { return "light"; } }
export function normalizeMode(mode) { return VALID_MODES.includes(mode) ? mode : "light"; }
export function normalizeImageTheme(theme) { return VALID_IMAGE_THEMES.includes(theme) ? theme : "dark"; }
function normalizeImageUrl(value) {
  const source = String(value || "").trim();
  if (!source) return "";
  if (/^data:image\/(?:avif|gif|jpeg|jpg|png|webp);base64,/i.test(source)) return source;
  try { const url = new URL(source, window.location.origin); return ["https:", "http:"].includes(url.protocol) ? url.href : ""; } catch { return ""; }
}
function normalizePosition(value) { return IMAGE_POSITIONS.includes(value) ? value : DEFAULT_APPEARANCE.imagePosition; }
function clamp(value, min, max, fallback) { const number = Number(value); return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback; }

export function normalizeAppearance(value = {}) {
  return {
    mode: normalizeMode(value.mode),
    imageTheme: normalizeImageTheme(value.imageTheme),
    imageUrl: normalizeImageUrl(value.imageUrl),
    imagePosition: normalizePosition(value.imagePosition),
    imageOverlay: clamp(value.imageOverlay, 0.08, 0.72, DEFAULT_APPEARANCE.imageOverlay),
    glassTransparency: clamp(value.glassTransparency, 0.28, 1, DEFAULT_APPEARANCE.glassTransparency),
    updatedAt: value.updatedAt || null
  };
}

export function resolvedTheme(mode, imageTheme = "dark") {
  const safeMode = normalizeMode(mode);
  if (safeMode === "system") return systemTheme();
  if (safeMode === "image") return normalizeImageTheme(imageTheme);
  return safeMode;
}

export function getAppearance() { try { const raw = localStorage.getItem(APPEARANCE_KEY); return raw ? normalizeAppearance(JSON.parse(raw)) : { ...DEFAULT_APPEARANCE }; } catch { return { ...DEFAULT_APPEARANCE }; } }
export function getThemeMode() { return getAppearance().mode; }
export function getTheme() { const appearance = getAppearance(); return resolvedTheme(appearance.mode, appearance.imageTheme); }
function cssUrl(value) { return value ? `url(${JSON.stringify(value)})` : "none"; }

function applyVisualVariables(appearance) {
  const root = document.documentElement;
  root.style.setProperty("--evara-wallpaper-image", cssUrl(appearance.imageUrl));
  root.style.setProperty("--evara-wallpaper-position", appearance.imagePosition);
  root.style.setProperty("--evara-wallpaper-overlay", String(appearance.imageOverlay));
  root.style.setProperty("--evara-glass-strength", `${Math.round(appearance.glassTransparency * 100)}%`);
  root.style.setProperty("--evara-glass-strength-soft", `${Math.round(Math.max(.18, appearance.glassTransparency * .72) * 100)}%`);
}

function applyWallpaper(appearance) {
  const root = document.documentElement;
  const hasImage = appearance.mode === "image" && Boolean(appearance.imageUrl);
  root.toggleAttribute("data-has-wallpaper", hasImage);
  root.setAttribute("data-image-theme", appearance.imageTheme);
  applyVisualVariables(appearance);
}

function controlLabel(mode) {
  if (mode === "dark") return { label: "Dark mode", icon: "☾" };
  if (mode === "system") return { label: "System mode", icon: "◐" };
  if (mode === "image") return { label: "Image mode", icon: "▧" };
  return { label: "Light mode", icon: "☀" };
}

export function updateThemeControls() {
  const appearance = getAppearance();
  const resolved = resolvedTheme(appearance.mode, appearance.imageTheme);
  const { label, icon } = controlLabel(appearance.mode);
  document.querySelectorAll("#evaThemeToggle, #evaThemePillToggle, [data-theme-toggle], [data-theme-label]").forEach((node) => {
    node.setAttribute("data-theme-mode", appearance.mode);
    node.setAttribute("data-theme-resolved", resolved);
    const iconNode = node.querySelector(".eva-theme-nav-icon");
    const textNode = node.querySelector("[data-theme-text]");
    if (iconNode) iconNode.textContent = icon;
    if (textNode) textNode.textContent = label;
    node.setAttribute("aria-label", `Switch appearance. Current: ${label}`);
    node.setAttribute("title", label);
  });
}

function completeThemeHydration() { const root = document.documentElement; root.setAttribute("data-evara-theme-ready", "true"); root.classList.remove("boot-pending"); }
export function applyAppearance(value = getAppearance()) {
  const appearance = normalizeAppearance(value);
  const theme = resolvedTheme(appearance.mode, appearance.imageTheme);
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.setAttribute("data-theme-mode", appearance.mode);
  root.style.colorScheme = theme;
  applyWallpaper(appearance);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#080808" : "#f4f7f6");
  updateThemeControls();
  completeThemeHydration();
  window.dispatchEvent(new CustomEvent("evara:theme-applied", { detail: { theme, ...appearance } }));
  return appearance;
}

export function applyTheme(theme = getTheme()) {
  const appearance = getAppearance();
  const safeTheme = theme === "dark" ? "dark" : "light";
  return applyAppearance({ ...appearance, imageTheme: appearance.mode === "image" ? safeTheme : appearance.imageTheme, mode: appearance.mode === "system" ? "system" : appearance.mode === "image" ? "image" : safeTheme });
}
export function saveAppearance(nextAppearance = {}) {
  const appearance = normalizeAppearance({ ...getAppearance(), ...nextAppearance, updatedAt: new Date().toISOString() });
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
  applyAppearance(appearance);
  window.dispatchEvent(new CustomEvent("evara:appearance-updated", { detail: { theme: resolvedTheme(appearance.mode, appearance.imageTheme), ...appearance } }));
  return appearance;
}
export function resetAppearance() { const appearance = { ...DEFAULT_APPEARANCE, updatedAt: new Date().toISOString() }; localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance)); applyAppearance(appearance); window.dispatchEvent(new CustomEvent("evara:appearance-updated", { detail: { theme: "light", ...appearance } })); return appearance; }
export function setThemeMode(mode = "light") { return saveAppearance({ mode: normalizeMode(mode) }); }
export function setThemeImage(imageUrl, options = {}) { return saveAppearance({ mode: "image", imageTheme: options.imageTheme, imageUrl, imagePosition: options.imagePosition, imageOverlay: options.imageOverlay }); }
export function toggleTheme() { const currentIndex = VALID_MODES.indexOf(getThemeMode()); return setThemeMode(VALID_MODES[(currentIndex + 1) % VALID_MODES.length]); }

function bindThemeControls() {
  if (window.__EVARA_THEME_BOUND__) return;
  window.__EVARA_THEME_BOUND__ = true;
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("#evaThemeToggle, #evaThemePillToggle, [data-theme-toggle]");
    if (!trigger) return;
    event.preventDefault();
    event.stopPropagation();
    toggleTheme();
  }, true);
  window.addEventListener("storage", (event) => { if (event.key === APPEARANCE_KEY) applyAppearance(); });
}
try { window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (getThemeMode() === "system") applyAppearance(); }); } catch {}

window.EvaraTheme = { APPEARANCE_KEY, VALID_MODES, VALID_IMAGE_THEMES, DEFAULT_APPEARANCE, getAppearance, getThemeMode, getTheme, normalizeAppearance, applyAppearance, applyTheme, saveAppearance, resetAppearance, setThemeMode, setThemeImage, toggleTheme, updateThemeControls };
bindThemeControls();
applyAppearance();
