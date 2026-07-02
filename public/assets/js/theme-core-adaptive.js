import { initAdaptiveGlass, refreshAdaptiveGlass, getEffectiveWallpaper } from "./theme-adaptive.js?v=adaptive-liquid-v8";
import { installUniversalTextInversion } from "./theme-text-inversion.js?v=adaptive-liquid-v8";

export const APPEARANCE_KEY = "evaraos-appearance";
export const VALID_MODES = Object.freeze(["light", "dark", "system", "image"]);
export const IMAGE_POSITIONS = Object.freeze(["center center", "center top", "center bottom", "left center", "right center"]);
export const DEFAULT_APPEARANCE = Object.freeze({
  mode: "system",
  imageUrl: "",
  imagePosition: "center center",
  wallpaperDim: 0.08,
  glassTint: 0.46,
  adaptiveContrast: true,
  updatedAt: null
});

const THEME_STYLESHEET = "/assets/css/theme.css?v=adaptive-liquid-v8";
const clamp = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};
const presetCache = new Map();
let applyQueue = Promise.resolve();
let appliedSignature = "";
let initialized = false;

function normalizeImageUrl(value) {
  const source = String(value || "").trim();
  if (!source) return "";
  if (source.startsWith("data:image/") && !source.startsWith("data:image/svg")) return source;
  try {
    const url = new URL(source, location.origin);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

export function normalizeAppearance(value = {}) {
  const mode = VALID_MODES.includes(value.mode) ? value.mode : DEFAULT_APPEARANCE.mode;
  const oldOverlay = Number(value.imageOverlay);
  const oldDensity = Number(value.glassTransparency);
  const migratedDim = Number.isFinite(oldOverlay)
    ? Math.min(0.34, Math.max(0, oldOverlay * 0.34))
    : DEFAULT_APPEARANCE.wallpaperDim;
  const migratedTint = Number.isFinite(oldDensity)
    ? Math.min(0.76, Math.max(0.18, oldDensity * 0.74))
    : DEFAULT_APPEARANCE.glassTint;

  return {
    mode,
    imageUrl: normalizeImageUrl(value.imageUrl),
    imagePosition: IMAGE_POSITIONS.includes(value.imagePosition) ? value.imagePosition : DEFAULT_APPEARANCE.imagePosition,
    wallpaperDim: clamp(value.wallpaperDim, 0, 0.34, migratedDim),
    glassTint: clamp(value.glassTint, 0.18, 0.76, migratedTint),
    adaptiveContrast: value.adaptiveContrast !== false,
    updatedAt: value.updatedAt || null
  };
}

export function getAppearance() {
  try {
    return normalizeAppearance(JSON.parse(localStorage.getItem(APPEARANCE_KEY) || "{}"));
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function systemTheme() {
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolvedTheme(value = getAppearance()) {
  return value.mode === "system" ? systemTheme() : value.mode;
}

export const getTheme = () => "adaptive";
export function getThemeMode() { return getAppearance().mode; }

function presetWallpaper(environment) {
  if (presetCache.has(environment)) return presetCache.get(environment);

  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1600;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return "";

  const dark = environment === "dark";
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  if (dark) {
    gradient.addColorStop(0, "#080b12");
    gradient.addColorStop(0.42, "#151b28");
    gradient.addColorStop(0.72, "#232b3d");
    gradient.addColorStop(1, "#080b12");
  } else {
    gradient.addColorStop(0, "#f7fbff");
    gradient.addColorStop(0.42, "#dbe9f7");
    gradient.addColorStop(0.72, "#f6e9ec");
    gradient.addColorStop(1, "#eef5fb");
  }
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const lights = dark
    ? [[220, 280, 620, "rgba(71,119,210,.34)"], [1000, 460, 700, "rgba(117,74,182,.28)"], [650, 1380, 760, "rgba(201,58,95,.18)"]]
    : [[180, 240, 620, "rgba(134,205,255,.48)"], [1020, 460, 720, "rgba(186,164,255,.34)"], [650, 1360, 760, "rgba(255,178,190,.32)"]];

  for (const [x, y, radius, color] of lights) {
    const glow = context.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, color);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = glow;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  let url = "";
  try { url = canvas.toDataURL("image/webp", 0.84); }
  catch { url = canvas.toDataURL("image/png"); }
  presetCache.set(environment, url);
  return url;
}

function ensureThemeLink() {
  const links = [...document.querySelectorAll('link[rel="stylesheet"][href*="/assets/css/theme.css"]')];
  let active = links.shift();
  links.forEach((link) => link.remove());

  if (!active) {
    active = document.createElement("link");
    active.rel = "stylesheet";
    document.head.appendChild(active);
  }

  const desired = new URL(THEME_STYLESHEET, location.origin).href;
  if (active.href !== desired) active.href = desired;
}

const cssUrl = (value) => value ? `url(${JSON.stringify(value)})` : "none";

export function updateThemeControls() {
  const appearance = getAppearance();
  const environment = resolvedTheme(appearance);
  document.querySelectorAll("#evaThemeToggle,#evaThemePillToggle,[data-theme-toggle]").forEach((node) => {
    node.dataset.themeMode = appearance.mode;
    node.dataset.themeResolved = environment;
    node.title = `Appearance: ${appearance.mode}`;
    node.setAttribute("aria-label", `Current appearance: ${appearance.mode}`);
  });
  document.querySelectorAll("[data-theme-label]").forEach((node) => {
    node.textContent = appearance.mode[0].toUpperCase() + appearance.mode.slice(1);
  });
}

function appearanceSignature(appearance, environment) {
  return JSON.stringify([
    appearance.mode,
    environment,
    appearance.imageUrl,
    appearance.imagePosition,
    appearance.wallpaperDim,
    appearance.glassTint,
    appearance.adaptiveContrast
  ]);
}

async function applyAppearanceNow(value) {
  ensureThemeLink();
  const appearance = normalizeAppearance(value);
  const environment = resolvedTheme(appearance);
  const root = document.documentElement;
  const signature = appearanceSignature(appearance, environment);

  if (root.dataset.evaraThemeReady === "true" && signature === appliedSignature) {
    updateThemeControls();
    refreshAdaptiveGlass();
    return appearance;
  }

  const wallpaperUrl = appearance.mode === "image"
    ? getEffectiveWallpaper(appearance.imageUrl)
    : presetWallpaper(environment);

  root.dataset.theme = "adaptive";
  root.dataset.environment = environment;
  root.dataset.themeMode = appearance.mode;
  root.dataset.appearance = `adaptive-${appearance.mode}`;
  root.dataset.adaptiveContrast = appearance.adaptiveContrast ? "on" : "off";
  root.toggleAttribute("data-has-wallpaper", appearance.mode === "image");
  root.style.colorScheme = environment === "dark" ? "dark" : environment === "light" ? "light" : "light dark";
  root.style.setProperty("--evara-wallpaper-image", cssUrl(wallpaperUrl));
  root.style.setProperty("--evara-wallpaper-position", appearance.mode === "image" ? appearance.imagePosition : "center center");
  root.style.setProperty("--evara-wallpaper-dim", String(appearance.mode === "image" ? appearance.wallpaperDim : 0));
  root.style.setProperty("--evara-glass-tint", String(appearance.glassTint));
  root.style.setProperty("--evara-glass-tint-pct", `${Math.round(appearance.glassTint * 100)}%`);

  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    environment === "dark" ? "#0b0f17" : environment === "light" ? "#eef5fb" : "#111827"
  );

  updateThemeControls();
  installUniversalTextInversion();
  await initAdaptiveGlass(appearance, wallpaperUrl);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  appliedSignature = signature;
  root.dataset.evaraThemeReady = "true";
  root.classList.remove("boot-pending", "evara-boot-lock");
  root.classList.add("evara-theme-painted");

  const detail = { ...appearance, environment, resolved: environment, theme: "adaptive", wallpaperUrl };
  dispatchEvent(new CustomEvent("evara:theme-applied", { detail }));
  dispatchEvent(new CustomEvent("evara:appearance-updated", { detail }));
  return appearance;
}

export function applyAppearance(value = getAppearance()) {
  const appearance = normalizeAppearance(value);
  applyQueue = applyQueue
    .catch((error) => console.warn("Previous appearance update failed:", error))
    .then(() => applyAppearanceNow(appearance));
  return applyQueue;
}

export const applyTheme = (mode) => applyAppearance(mode ? { ...getAppearance(), mode } : getAppearance());

export function saveAppearance(value = {}) {
  const appearance = normalizeAppearance({ ...getAppearance(), ...value, updatedAt: new Date().toISOString() });
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
  void applyAppearance(appearance);
  return appearance;
}

export const setThemeMode = (mode) => saveAppearance({ mode: VALID_MODES.includes(mode) ? mode : "system" });
export const setImageTheme = (imageUrl) => saveAppearance({ mode: "image", imageUrl: imageUrl || getAppearance().imageUrl });

export function resetAppearance() {
  localStorage.removeItem(APPEARANCE_KEY);
  const appearance = { ...DEFAULT_APPEARANCE, updatedAt: new Date().toISOString() };
  void applyAppearance(appearance);
  return appearance;
}

if (typeof window !== "undefined") {
  window.EvaraTheme = {
    ...(window.EvaraTheme || {}),
    APPEARANCE_KEY,
    VALID_MODES,
    IMAGE_POSITIONS,
    DEFAULT_APPEARANCE,
    normalizeAppearance,
    resolvedTheme,
    systemTheme,
    getAppearance,
    getThemeMode,
    getTheme,
    applyAppearance,
    applyTheme,
    saveAppearance,
    setThemeMode,
    setImageTheme,
    resetAppearance,
    updateThemeControls,
    refreshAdaptiveGlass
  };

  const init = () => {
    installUniversalTextInversion();
    if (initialized) {
      updateThemeControls();
      refreshAdaptiveGlass();
      return;
    }
    initialized = true;
    void applyAppearance();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  addEventListener("storage", (event) => {
    if (event.key === APPEARANCE_KEY) void applyAppearance();
  });

  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
    if (getAppearance().mode === "system") void applyAppearance();
  });

  addEventListener("pageshow", () => {
    if (!initialized) {
      init();
      return;
    }
    document.documentElement.classList.remove("eva-transitioning");
    document.body?.classList.remove("eva-page-leaving");
    updateThemeControls();
    requestAnimationFrame(refreshAdaptiveGlass);
  });
}
