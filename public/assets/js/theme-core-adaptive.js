import { initAdaptiveGlass, refreshAdaptiveGlass, getEffectiveWallpaper } from "./theme-adaptive.js?v=adaptive-liquid-v12";

export const APPEARANCE_KEY = "evaraos-appearance";
export const VALID_MODES = Object.freeze(["light", "dark", "system", "image"]);
export const IMAGE_POSITIONS = Object.freeze(["center center", "center top", "center bottom", "left center", "right center"]);
export const IMAGE_FITS = Object.freeze(["cover", "contain"]);
export const DEFAULT_APPEARANCE = Object.freeze({
  mode: "system",
  imageUrl: "",
  imagePosition: "center center",
  imageFit: "cover",
  imageBlur: 0,
  wallpaperDim: 0.08,
  glassTint: 0.46,
  adaptiveContrast: true,
  updatedAt: null
});

const THEME_STYLESHEET = "/assets/css/theme.css?v=adaptive-liquid-v14-surface-text";
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
    imageFit: IMAGE_FITS.includes(value.imageFit) ? value.imageFit : DEFAULT_APPEARANCE.imageFit,
    imageBlur: clamp(value.imageBlur, 0, 24, DEFAULT_APPEARANCE.imageBlur),
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
  return value.mode === "light" || value.mode === "dark" ? value.mode : systemTheme();
}

export const getTheme = () => "adaptive";
export function getThemeMode() { return getAppearance().mode; }

function presetWallpaper(environment) {
  if (presetCache.has(environment)) return presetCache.get(environment);
  const value = environment === "dark"
    ? "radial-gradient(circle at 18% 12%,#10243f 0,transparent 38%),radial-gradient(circle at 83% 22%,#211b55 0,transparent 42%),radial-gradient(circle at 58% 88%,#4a1c31 0,transparent 43%),linear-gradient(145deg,#080b12,#151b28 48%,#232b3d 72%,#080b12)"
    : "radial-gradient(circle at 18% 12%,#d8f0ff 0,transparent 38%),radial-gradient(circle at 83% 22%,#d5d0ff 0,transparent 42%),radial-gradient(circle at 58% 88%,#ffd6df 0,transparent 43%),linear-gradient(145deg,#f7fbff,#dbe9f7 48%,#f6e9ec 72%,#eef5fb)";
  presetCache.set(environment, value);
  return value;
}

function ensureStylesheet() {
  const existing = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .find((link) => link.href.includes("/assets/css/theme.css"));
  if (existing) {
    if (!existing.href.includes("adaptive-liquid-v14-surface-text")) existing.href = THEME_STYLESHEET;
    return existing;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = THEME_STYLESHEET;
  document.head.appendChild(link);
  return link;
}

function setWallpaperVariables(appearance, environment) {
  const root = document.documentElement;
  const image = appearance.mode === "image" && appearance.imageUrl
    ? `url(${JSON.stringify(appearance.imageUrl)})`
    : presetWallpaper(environment);
  root.style.setProperty("--evara-wallpaper-image", image);
  root.style.setProperty("--evara-wallpaper-position", appearance.imagePosition);
  root.style.setProperty("--evara-wallpaper-fit", appearance.imageFit);
  root.style.setProperty("--evara-wallpaper-blur", `${appearance.mode === "image" ? appearance.imageBlur : 0}px`);
  root.style.setProperty("--evara-wallpaper-dim", String(appearance.mode === "image" ? appearance.wallpaperDim : 0));
  root.style.setProperty("--evara-glass-tint", String(appearance.glassTint));
  root.style.setProperty("--evara-glass-tint-pct", `${Math.round(appearance.glassTint * 100)}%`);
}

export async function applyAppearance(value = getAppearance(), options = {}) {
  const appearance = normalizeAppearance(value);
  const environment = resolvedTheme(appearance);
  const signature = JSON.stringify([appearance.mode, environment, appearance.imageUrl, appearance.imagePosition, appearance.imageFit, appearance.imageBlur, appearance.wallpaperDim, appearance.glassTint, appearance.adaptiveContrast]);
  if (!options.force && signature === appliedSignature) return appearance;

  applyQueue = applyQueue.then(async () => {
    ensureStylesheet();
    const root = document.documentElement;
    root.dataset.theme = "adaptive";
    root.dataset.environment = environment;
    root.dataset.themeMode = appearance.mode;
    root.dataset.appearance = `adaptive-${appearance.mode}`;
    root.dataset.adaptiveContrast = appearance.adaptiveContrast ? "on" : "off";
    root.toggleAttribute("data-has-wallpaper", appearance.mode === "image" && Boolean(appearance.imageUrl));
    setWallpaperVariables(appearance, environment);
    appliedSignature = signature;
    await initAdaptiveGlass?.(appearance, getEffectiveWallpaper(appearance.mode === "image" ? appearance.imageUrl : ""));
    refreshAdaptiveGlass?.();
    dispatchEvent(new CustomEvent("evara:theme-applied", { detail: { ...appearance, resolved: environment } }));
  }).catch((error) => console.warn("Appearance apply failed:", error));

  await applyQueue;
  return appearance;
}

export function setAppearance(value = {}) {
  const appearance = normalizeAppearance({ ...getAppearance(), ...value, updatedAt: new Date().toISOString() });
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
  return applyAppearance(appearance, { force: true });
}

export const setThemeMode = (mode) => setAppearance({ mode });
export const setTheme = () => applyAppearance(getAppearance(), { force: true });
export const setAppearanceImage = (imageUrl, imagePosition = "center center") => setAppearance({ mode: "image", imageUrl, imagePosition });
export const setWallpaperImage = setAppearanceImage;
export const setWallpaperPosition = (imagePosition) => setAppearance({ imagePosition });
export const setWallpaperFit = (imageFit) => setAppearance({ imageFit });
export const setWallpaperBlur = (imageBlur) => setAppearance({ imageBlur });
export const setWallpaperDim = (wallpaperDim) => setAppearance({ wallpaperDim });
export const setGlassTint = (glassTint) => setAppearance({ glassTint });
export const setAdaptiveContrast = (adaptiveContrast) => setAppearance({ adaptiveContrast });
export const getEffectiveWallpaperUrl = () => getEffectiveWallpaper?.() || getAppearance().imageUrl || "";
export const updateThemeControls = () => {};

export function initTheme() {
  if (initialized) return;
  initialized = true;
  ensureStylesheet();
  applyAppearance(getAppearance(), { force: true });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
    if (["system", "image"].includes(getAppearance().mode)) applyAppearance(getAppearance(), { force: true });
  });
}

window.EvaraTheme = {
  ...(window.EvaraTheme || {}),
  initTheme,
  applyAppearance,
  setAppearance,
  getAppearance,
  getTheme,
  getThemeMode,
  setTheme,
  setThemeMode,
  setAppearanceImage,
  setWallpaperImage,
  setWallpaperPosition,
  setWallpaperFit,
  setWallpaperBlur,
  setWallpaperDim,
  setGlassTint,
  setAdaptiveContrast,
  updateThemeControls,
  refreshAdaptiveGlass,
  getEffectiveWallpaper: getEffectiveWallpaperUrl
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initTheme, { once: true });
else initTheme();
