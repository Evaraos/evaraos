export const APPEARANCE_KEY = "evaraos-appearance";
export const VALID_MODES = Object.freeze(["light", "dark", "system", "image"]);
export const VALID_IMAGE_THEMES = Object.freeze(["light", "dark"]);
export const IMAGE_POSITIONS = Object.freeze(["center center", "center top", "center bottom", "left center", "right center"]);
export const DEFAULT_APPEARANCE = Object.freeze({
  mode: "light",
  imageTheme: "light",
  imageUrl: "",
  imagePosition: "center center",
  imageOverlay: .28,
  glassTransparency: .62,
  updatedAt: null
});

const THEME_STYLESHEET = "/assets/css/theme.css?v=ios27-unified-v2";
const GLASS_SELECTOR = [
  ".glass-card", ".glass-shell", ".liquid-glass", ".dashboard-panel",
  ".dashboard-stat-card", ".dashboard-list-item", ".dashboard-feed-item",
  ".settings-card", ".settings-block", ".eva-menu-panel", ".eva-menu-card",
  ".eva-bottom-nav", ".btn", ".settings-chip", ".role-pill", ".role-pill-option",
  "[data-glass='card']", "[data-glass='interactive']"
].join(",");

export function systemTheme() {
  try { return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }
  catch { return "light"; }
}

export function normalizeMode(value) { return VALID_MODES.includes(value) ? value : DEFAULT_APPEARANCE.mode; }
export function normalizeImageTheme(value) { return VALID_IMAGE_THEMES.includes(value) ? value : DEFAULT_APPEARANCE.imageTheme; }

function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function normalizeImageUrl(value) {
  const source = String(value || "").trim();
  if (!source) return "";

  // Locally selected wallpapers are stored as compressed data URLs. SVG is
  // intentionally excluded because it can contain active content.
  if (/^data:image\/(?:png|jpe?g|webp|gif|avif);base64,/i.test(source)) return source;

  try {
    const url = new URL(source, location.origin);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function normalizePosition(value) {
  return IMAGE_POSITIONS.includes(value) ? value : DEFAULT_APPEARANCE.imagePosition;
}

export function normalizeAppearance(value = {}) {
  return {
    mode: normalizeMode(value.mode),
    imageTheme: normalizeImageTheme(value.imageTheme),
    imageUrl: normalizeImageUrl(value.imageUrl),
    imagePosition: normalizePosition(value.imagePosition),
    imageOverlay: clamp(value.imageOverlay, .08, .72, DEFAULT_APPEARANCE.imageOverlay),
    glassTransparency: clamp(value.glassTransparency, .42, .82, DEFAULT_APPEARANCE.glassTransparency),
    updatedAt: value.updatedAt || null
  };
}

export function resolvedTheme(mode, imageTheme = DEFAULT_APPEARANCE.imageTheme) {
  const normalized = normalizeMode(mode);
  if (normalized === "system") return systemTheme();
  if (normalized === "image") return normalizeImageTheme(imageTheme);
  return normalized;
}

export function getAppearance() {
  try { return normalizeAppearance(JSON.parse(localStorage.getItem(APPEARANCE_KEY) || "{}")); }
  catch { return { ...DEFAULT_APPEARANCE }; }
}

export function getThemeMode() { return getAppearance().mode; }
export function getTheme() {
  const appearance = getAppearance();
  return resolvedTheme(appearance.mode, appearance.imageTheme);
}

function ensureSingleThemeLink() {
  const links = [...document.querySelectorAll('link[rel="stylesheet"][href*="/assets/css/theme.css"]')];
  let active = links.pop();
  links.forEach(link => link.remove());

  if (!active) {
    active = document.createElement("link");
    active.rel = "stylesheet";
    document.head.appendChild(active);
  }

  const desired = new URL(THEME_STYLESHEET, location.origin).href;
  if (active.href !== desired) active.href = desired;

  // Theme authority must stay after page CSS so one material system wins.
  if (active.parentNode === document.head && active !== document.head.lastElementChild) {
    document.head.appendChild(active);
  }
}

function cssUrl(value) { return value ? `url(${JSON.stringify(value)})` : "none"; }

function applyVars(appearance) {
  const root = document.documentElement;
  const density = Math.round(appearance.glassTransparency * 100);
  root.style.setProperty("--evara-wallpaper-image", cssUrl(appearance.imageUrl));
  root.style.setProperty("--evara-wallpaper-position", appearance.imagePosition);
  root.style.setProperty("--evara-wallpaper-overlay", String(appearance.imageOverlay));
  root.style.setProperty("--evara-wallpaper-overlay-pct", `${Math.round(appearance.imageOverlay * 100)}%`);
  root.style.setProperty("--evara-glass-density", `${density}%`);
  root.style.setProperty("--evara-glass-clarity", `${100 - density}%`);
  root.style.setProperty("--evara-glass-opacity", String(appearance.glassTransparency));
}

export function updateThemeControls() {
  const appearance = getAppearance();
  const resolved = resolvedTheme(appearance.mode, appearance.imageTheme);
  const readableMode = appearance.mode.charAt(0).toUpperCase() + appearance.mode.slice(1);

  document.querySelectorAll("#evaThemeToggle,#evaThemePillToggle,[data-theme-toggle],[data-theme-label]").forEach(node => {
    node.dataset.themeMode = appearance.mode;
    node.dataset.themeResolved = resolved;
    node.title = `${readableMode} appearance`;
    node.setAttribute("aria-label", `Switch appearance. Current: ${readableMode} mode`);
    if (node.matches("[data-theme-label]")) node.textContent = readableMode;
  });
}

export function applyAppearance(value = getAppearance()) {
  ensureSingleThemeLink();

  const appearance = normalizeAppearance(value);
  const theme = resolvedTheme(appearance.mode, appearance.imageTheme);
  const root = document.documentElement;

  root.dataset.theme = theme;
  root.dataset.themeMode = appearance.mode;
  root.dataset.imageTheme = appearance.imageTheme;
  root.toggleAttribute("data-has-wallpaper", appearance.mode === "image" && Boolean(appearance.imageUrl));
  root.style.colorScheme = theme;
  applyVars(appearance);

  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    theme === "dark" ? "#050506" : "#f4f5f7"
  );

  root.dataset.evaraThemeReady = "true";
  root.classList.remove("boot-pending");
  updateThemeControls();

  const detail = { theme, ...appearance };
  window.dispatchEvent(new CustomEvent("evara:theme-applied", { detail }));
  window.dispatchEvent(new CustomEvent("evara:appearance-updated", { detail }));
  return appearance;
}

export function applyTheme(theme = getTheme()) {
  const appearance = getAppearance();
  const next = theme === "dark" ? "dark" : "light";

  if (appearance.mode === "image") return applyAppearance({ ...appearance, imageTheme: next });
  if (appearance.mode === "system") return applyAppearance(appearance);
  return applyAppearance({ ...appearance, mode: next });
}

export function saveAppearance(value = {}) {
  const appearance = normalizeAppearance({
    ...getAppearance(),
    ...value,
    updatedAt: new Date().toISOString()
  });
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
  return applyAppearance(appearance);
}

export function setThemeMode(mode) { return saveAppearance({ mode: normalizeMode(mode) }); }
export function setImageTheme(imageTheme) { return saveAppearance({ mode: "image", imageTheme: normalizeImageTheme(imageTheme) }); }

export function resetAppearance() {
  const appearance = { ...DEFAULT_APPEARANCE, updatedAt: new Date().toISOString() };
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
  return applyAppearance(appearance);
}

function installOpticalResponse() {
  if (!("PointerEvent" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let frame = 0;
  let pending = null;

  document.addEventListener("pointermove", event => {
    if (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    const target = event.target.closest?.(GLASS_SELECTOR);
    if (!target) return;
    pending = { target, x: event.clientX, y: event.clientY };
    if (frame) return;

    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!pending?.target?.isConnected) return;
      const { target: element, x, y } = pending;
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      element.style.setProperty("--glass-x", `${Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100)).toFixed(1)}%`);
      element.style.setProperty("--glass-y", `${Math.max(0, Math.min(100, ((y - rect.top) / rect.height) * 100)).toFixed(1)}%`);
      element.classList.add("is-optically-active");
    });
  }, { passive: true });

  document.addEventListener("pointerout", event => {
    const element = event.target.closest?.(GLASS_SELECTOR);
    if (!element || element.contains(event.relatedTarget)) return;
    element.classList.remove("is-optically-active");
    element.style.removeProperty("--glass-x");
    element.style.removeProperty("--glass-y");
  }, { passive: true });
}

if (typeof window !== "undefined") {
  window.EvaraTheme = {
    ...(window.EvaraTheme || {}),
    APPEARANCE_KEY,
    VALID_MODES,
    VALID_IMAGE_THEMES,
    IMAGE_POSITIONS,
    DEFAULT_APPEARANCE,
    systemTheme,
    normalizeMode,
    normalizeImageTheme,
    normalizeAppearance,
    resolvedTheme,
    getAppearance,
    getThemeMode,
    getTheme,
    applyAppearance,
    applyTheme,
    saveAppearance,
    setThemeMode,
    setImageTheme,
    resetAppearance,
    updateThemeControls
  };

  const run = () => applyAppearance();
  const init = () => { run(); installOpticalResponse(); };
  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init, { once: true })
    : init();

  try {
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (getAppearance().mode === "system") run();
    });
    addEventListener("storage", event => { if (event.key === APPEARANCE_KEY) run(); });
    addEventListener("pageshow", run);
  } catch {}
}
