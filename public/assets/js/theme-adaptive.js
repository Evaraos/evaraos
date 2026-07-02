const SURFACE_SELECTOR = [
  ".glass-card", ".glass-shell", ".liquid-glass", ".aurora-card",
  ".dashboard-sidebar-inner", ".dashboard-panel", ".dashboard-overview", ".dashboard-hero", ".dashboard-hero-panel",
  ".dashboard-stat-card", ".dashboard-list-item", ".dashboard-feed-item", ".dashboard-role-card", ".dashboard-progress-row", ".dashboard-state-card",
  ".settings-card", ".settings-block", ".settings-hub-card", ".workspace-block", ".qa-card", ".application-card", ".customer-service-event",
  ".eva-menu-panel", ".eva-menu-glass-group", ".eva-menu-control", ".eva-app-link", ".eva-bottom-nav", ".eva-bottom-link",
  ".btn", ".settings-chip", ".role-pill", ".role-pill-option", ".messages-icon-button", ".messages-camera", ".messages-send", ".messages-compose",
  ".eva-account-action", ".eva-profile-trigger", "#evaMenuBtn", ".eva-top-alert", "button:not(.appearance-source-backdrop)", "input", "textarea", "select", "[data-glass]"
].join(",");

const SURFACE_POINTS = [[0.16, 0.16], [0.5, 0.16], [0.84, 0.16], [0.16, 0.5], [0.5, 0.5], [0.84, 0.5], [0.16, 0.84], [0.5, 0.84], [0.84, 0.84]];
const TEXT_X = [0.02, 0.18, 0.34, 0.5, 0.66, 0.82, 0.98];
const TEXT_Y = [0.28, 0.5, 0.72];
const DEFAULT_COLOR = { r: 38, g: 48, b: 68, a: 1 };

let fallbackUrl = "";
let image = null;
let canvas = null;
let pixels = null;
let appearance = null;
let frame = 0;
let installed = false;
let styleCache = new WeakMap();

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function defaultWallpaper() {
  if (fallbackUrl) return fallbackUrl;
  const target = document.createElement("canvas");
  target.width = 1080;
  target.height = 1440;
  const context = target.getContext("2d", { alpha: false });
  if (!context) return "";

  const gradient = context.createLinearGradient(0, 0, target.width, target.height);
  gradient.addColorStop(0, "#0d1428");
  gradient.addColorStop(0.32, "#345f9c");
  gradient.addColorStop(0.6, "#9bc7d3");
  gradient.addColorStop(0.8, "#d69ba7");
  gradient.addColorStop(1, "#4b1c3c");
  context.fillStyle = gradient;
  context.fillRect(0, 0, target.width, target.height);

  for (const [cx, cy, radius, color] of [
    [170, 220, 500, "rgba(190,232,255,.62)"],
    [910, 330, 560, "rgba(103,83,219,.58)"],
    [650, 1180, 640, "rgba(255,105,128,.46)"]
  ]) {
    const glow = context.createRadialGradient(cx, cy, 0, cx, cy, radius);
    glow.addColorStop(0, color);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = glow;
    context.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  }

  context.save();
  context.globalAlpha = 0.22;
  context.translate(540, 760);
  context.rotate(-0.25);
  for (let index = 0; index < 4; index += 1) {
    context.beginPath();
    context.ellipse(0, index * 150 - 230, 760 - index * 70, 150 - index * 12, 0, 0, Math.PI * 2);
    context.strokeStyle = index % 2 ? "rgba(255,255,255,.54)" : "rgba(10,20,44,.48)";
    context.lineWidth = 64 - index * 8;
    context.stroke();
  }
  context.restore();

  try { fallbackUrl = target.toDataURL("image/webp", 0.8); }
  catch { fallbackUrl = target.toDataURL("image/jpeg", 0.84); }
  return fallbackUrl;
}

export const getEffectiveWallpaper = (url) => url || defaultWallpaper();

function load(url) {
  return new Promise((resolve, reject) => {
    const picture = new Image();
    if (/^https?:/i.test(url)) picture.crossOrigin = "anonymous";
    picture.onload = () => resolve(picture);
    picture.onerror = reject;
    picture.src = url;
  });
}

async function prepare(url) {
  image = canvas = pixels = null;
  try {
    const picture = await load(url);
    const scale = Math.min(1, 720 / Math.max(picture.naturalWidth, picture.naturalHeight));
    const target = document.createElement("canvas");
    target.width = Math.max(1, Math.round(picture.naturalWidth * scale));
    target.height = Math.max(1, Math.round(picture.naturalHeight * scale));
    const context = target.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(picture, 0, 0, target.width, target.height);
    image = picture;
    canvas = target;
    pixels = context.getImageData(0, 0, target.width, target.height).data;
  } catch {
    image = canvas = pixels = null;
  }
}

function positionFactor(value) {
  const [horizontal = "center", vertical = "center"] = String(value || "center center").split(/\s+/);
  return {
    x: horizontal === "left" ? 0 : horizontal === "right" ? 1 : 0.5,
    y: vertical === "top" ? 0 : vertical === "bottom" ? 1 : 0.5
  };
}

function mapPoint(x, y) {
  if (!image || !canvas) return null;
  const viewportWidth = Math.max(1, innerWidth);
  const viewportHeight = Math.max(1, innerHeight);
  const scale = Math.max(viewportWidth / image.naturalWidth, viewportHeight / image.naturalHeight);
  const renderedWidth = image.naturalWidth * scale;
  const renderedHeight = image.naturalHeight * scale;
  const position = positionFactor(appearance?.imagePosition);
  const offsetX = (viewportWidth - renderedWidth) * position.x;
  const offsetY = (viewportHeight - renderedHeight) * position.y;
  return {
    x: clamp(((x - offsetX) / scale) * (canvas.width / image.naturalWidth), 0, canvas.width - 1),
    y: clamp(((y - offsetY) / scale) * (canvas.height / image.naturalHeight), 0, canvas.height - 1)
  };
}

function readPatch(point) {
  if (!pixels || !canvas || !point) return { ...DEFAULT_COLOR };
  const radius = 1;
  const centerX = Math.round(point.x);
  const centerY = Math.round(point.y);
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;

  for (let y = Math.max(0, centerY - radius); y <= Math.min(canvas.height - 1, centerY + radius); y += 1) {
    for (let x = Math.max(0, centerX - radius); x <= Math.min(canvas.width - 1, centerX + radius); x += 1) {
      const index = (y * canvas.width + x) * 4;
      red += pixels[index];
      green += pixels[index + 1];
      blue += pixels[index + 2];
      count += 1;
    }
  }

  if (!count) return { ...DEFAULT_COLOR };
  const dim = clamp(Number(appearance?.wallpaperDim) || 0, 0, 0.34);
  return {
    r: Math.round((red / count) * (1 - dim) + 4 * dim),
    g: Math.round((green / count) * (1 - dim) + 8 * dim),
    b: Math.round((blue / count) * (1 - dim) + 18 * dim),
    a: 1
  };
}

function parseColor(value) {
  const match = String(value || "").match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;
  const parts = match[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) return null;
  return {
    r: clamp(parts[0], 0, 255),
    g: clamp(parts[1], 0, 255),
    b: clamp(parts[2], 0, 255),
    a: clamp(Number.isFinite(parts[3]) ? parts[3] : 1, 0, 1)
  };
}

function composite(over, under) {
  const alpha = over.a + (under.a || 1) * (1 - over.a);
  if (alpha <= 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: (over.r * over.a + under.r * (under.a || 1) * (1 - over.a)) / alpha,
    g: (over.g * over.a + under.g * (under.a || 1) * (1 - over.a)) / alpha,
    b: (over.b * over.a + under.b * (under.a || 1) * (1 - over.a)) / alpha,
    a: alpha
  };
}

function styleOf(element) {
  let style = styleCache.get(element);
  if (!style) {
    style = getComputedStyle(element);
    styleCache.set(element, style);
  }
  return style;
}

function ancestors(element) {
  const list = [];
  for (let node = element?.parentElement; node; node = node.parentElement) list.push(node);
  return list.reverse();
}

function linearChannel(value) {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance({ r, g, b }) {
  return 0.2126 * linearChannel(r) + 0.7152 * linearChannel(g) + 0.0722 * linearChannel(b);
}

function mix(a, b, amount) { return Math.round(a * (1 - amount) + b * amount); }

function average(colors) {
  if (!colors.length) return { ...DEFAULT_COLOR };
  const sum = colors.reduce((result, color) => ({
    r: result.r + color.r,
    g: result.g + color.g,
    b: result.b + color.b
  }), { r: 0, g: 0, b: 0 });
  return { r: sum.r / colors.length, g: sum.g / colors.length, b: sum.b / colors.length, a: 1 };
}

function surfaceTint(surface) {
  if (!surface) return 0;
  if (surface.matches(".eva-menu-control,.eva-app-link") && !surface.matches(".is-hovered,.is-pressed")) return 0;
  if (surface.matches(".eva-bottom-link") && !surface.matches(".is-active,[aria-current='page'],.is-pressed")) return 0;
  if (surface.matches("#evaMenuBtn,.eva-profile-trigger")) return surface.getAttribute("aria-expanded") === "true" ? 0.48 : 0.28;
  if (surface.matches(".eva-top-alert") && surface.getAttribute("aria-expanded") !== "true") return 0;
  if (surface.matches(".eva-menu-panel")) return 0.32;
  return clamp(Number(appearance?.glassTint) || 0.46, 0.18, 0.76);
}

function applyGlass(base, surface) {
  const tint = surfaceTint(surface);
  if (!tint) return base;
  const target = luminance(base) > 0.34 ? 244 : 20;
  const material = 0.34 + tint * 0.42;
  const glass = {
    r: mix(base.r, target, material),
    g: mix(base.g, target, material),
    b: mix(base.b, target, material),
    a: 1
  };
  return {
    r: mix(base.r, glass.r, tint),
    g: mix(base.g, glass.g, tint),
    b: mix(base.b, glass.b, tint),
    a: 1,
    glass
  };
}

function backgroundAt(element, x, y, includeSurface = true) {
  let color = readPatch(mapPoint(x, y));
  const surface = element?.closest?.(SURFACE_SELECTOR) || null;
  for (const node of ancestors(element)) {
    if (node === surface) {
      if (includeSurface) color = applyGlass(color, surface);
      continue;
    }
    const background = parseColor(styleOf(node).backgroundColor);
    if (background && background.a > 0.015) color = composite(background, color);
  }
  return color;
}

function chooseInk(color, prior = "") {
  const lightness = luminance(color);
  const black = (lightness + 0.05) / 0.05;
  const white = 1.05 / (lightness + 0.05);
  if (prior) {
    const current = prior === "d" ? black : white;
    const alternate = prior === "d" ? white : black;
    if (alternate - current < 1.2) {
      return { tone: prior, color: prior === "d" ? "rgb(18 20 24)" : "rgb(255 255 255)", contrast: current };
    }
  }
  const dark = black >= white;
  return {
    tone: dark ? "d" : "l",
    color: dark ? "rgb(18 20 24)" : "rgb(255 255 255)",
    contrast: Math.max(black, white)
  };
}

function applySurfaceTone(element) {
  const rect = element.getBoundingClientRect();
  const samples = [];
  if (!rect.width || !rect.height) return;
  for (const [x, y] of SURFACE_POINTS) {
    samples.push(backgroundAt(element, rect.left + rect.width * x, rect.top + rect.height * y, false));
  }
  const base = average(samples);
  const effective = applyGlass(base, element);
  const prior = element.dataset.evaraTone === "dark-ink" ? "d" : element.dataset.evaraTone === "light-ink" ? "l" : "";
  const ink = chooseInk(effective, prior);
  const glass = effective.glass || base;
  element.dataset.evaraTone = ink.tone === "d" ? "dark-ink" : "light-ink";
  element.style.setProperty("--adaptive-ink-rgb", ink.tone === "d" ? "18,20,24" : "255,255,255");
  element.style.setProperty("--adaptive-shadow-rgb", ink.tone === "d" ? "255,255,255" : "0,0,0");
  element.style.setProperty("--adaptive-glass-rgb", `${Math.round(glass.r)},${Math.round(glass.g)},${Math.round(glass.b)}`);
  element.style.setProperty("--adaptive-ambient-rgb", `${Math.round(base.r)},${Math.round(base.g)},${Math.round(base.b)}`);
  element.style.setProperty("--adaptive-luma", luminance(effective).toFixed(3));
  element.style.setProperty("--adaptive-contrast", ink.contrast.toFixed(2));
}

function applyTextGradient(wrapper) {
  if (!(wrapper instanceof HTMLElement) || wrapper.hidden) return;
  const rect = wrapper.getBoundingClientRect();
  if (!rect.width || !rect.height || rect.bottom < -120 || rect.top > innerHeight + 120 || rect.right < -120 || rect.left > innerWidth + 120) return;
  const prior = (wrapper.dataset.evaraTextTones || "").padEnd(TEXT_X.length, "-").slice(0, TEXT_X.length);
  const tones = [];
  const colors = [];
  TEXT_X.forEach((factor, index) => {
    const samples = TEXT_Y.map((y) => backgroundAt(wrapper, rect.left + rect.width * factor, rect.top + rect.height * y, true));
    const ink = chooseInk(average(samples), prior[index]);
    tones.push(ink.tone);
    colors.push(ink.color);
  });
  const key = tones.join("");
  if (wrapper.dataset.evaraTextTones === key) return;
  wrapper.dataset.evaraTextTones = key;
  colors.forEach((color, index) => wrapper.style.setProperty(`--adaptive-text-c${index}`, color));
}

function adapt() {
  frame = 0;
  if (document.hidden || document.body?.classList.contains("eva-page-leaving")) return;
  styleCache = new WeakMap();
  for (const element of document.querySelectorAll(SURFACE_SELECTOR)) {
    if (!(element instanceof HTMLElement) || element.hidden) continue;
    const rect = element.getBoundingClientRect();
    if (rect.bottom < -140 || rect.top > innerHeight + 140 || rect.right < -140 || rect.left > innerWidth + 140) continue;
    applySurfaceTone(element);
  }
  document.querySelectorAll(".evara-adaptive-text-node").forEach(applyTextGradient);
}

export function refreshAdaptiveGlass() {
  if (document.hidden || frame) return;
  frame = requestAnimationFrame(adapt);
}

function install() {
  if (installed) return;
  installed = true;

  new MutationObserver(refreshAdaptiveGlass).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["class", "hidden", "aria-current", "aria-expanded", "data-active"]
  });

  addEventListener("scroll", refreshAdaptiveGlass, { passive: true });
  addEventListener("resize", refreshAdaptiveGlass, { passive: true });
  addEventListener("orientationchange", refreshAdaptiveGlass, { passive: true });
  addEventListener("pageshow", refreshAdaptiveGlass, { passive: true });
  addEventListener("pagehide", () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }, { passive: true });

  if ("PointerEvent" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    let pointerFrame = 0;
    let pending = null;
    document.addEventListener("pointermove", (event) => {
      if (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      const target = event.target.closest?.(SURFACE_SELECTOR);
      if (!target) return;
      pending = { target, x: event.clientX, y: event.clientY };
      if (pointerFrame) return;
      pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0;
        if (!pending?.target?.isConnected) return;
        const rect = pending.target.getBoundingClientRect();
        pending.target.style.setProperty("--glass-x", `${clamp(((pending.x - rect.left) / Math.max(1, rect.width)) * 100, 0, 100).toFixed(1)}%`);
        pending.target.style.setProperty("--glass-y", `${clamp(((pending.y - rect.top) / Math.max(1, rect.height)) * 100, 0, 100).toFixed(1)}%`);
      });
    }, { passive: true });
  }
}

export async function initAdaptiveGlass(nextAppearance, url) {
  appearance = nextAppearance;
  if (url !== image?.src) await prepare(url);
  install();
  refreshAdaptiveGlass();
}
