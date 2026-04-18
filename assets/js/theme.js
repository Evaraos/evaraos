const STORAGE_KEY = "evaraos-theme";
const APPEARANCE_KEY = "evaraos-appearance";

const DEFAULT_THEME = "dark";

const DEFAULT_APPEARANCE = {
  mode: "dark",
  beamMode: "contextual",
  cardColor: "#8B5CF6",
  buttonColor: "#2563EB",
  backgroundColor: "#0F172A"
};

function normalizeTheme(theme = "") {
  const value = String(theme || "").trim().toLowerCase();
  return value === "light" ? "light" : "dark";
}

function normalizeHex(value, fallback) {
  const safe = String(value || "").trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(safe) ? safe : fallback.toUpperCase();
}

function normalizeMode(value = "") {
  const safe = String(value || "").trim().toLowerCase();
  return ["dark", "light", "custom"].includes(safe) ? safe : "dark";
}

function normalizeBeamMode(value = "") {
  const safe = String(value || "").trim().toLowerCase();
  return ["off", "contextual", "rainbow"].includes(safe) ? safe : "contextual";
}

function normalizeAppearance(appearance = {}) {
  return {
    mode: normalizeMode(appearance.mode || DEFAULT_APPEARANCE.mode),
    beamMode: normalizeBeamMode(appearance.beamMode || DEFAULT_APPEARANCE.beamMode),
    cardColor: normalizeHex(appearance.cardColor, DEFAULT_APPEARANCE.cardColor),
    buttonColor: normalizeHex(appearance.buttonColor, DEFAULT_APPEARANCE.buttonColor),
    backgroundColor: normalizeHex(appearance.backgroundColor, DEFAULT_APPEARANCE.backgroundColor)
  };
}

function getStoredTheme() {
  try {
    return normalizeTheme(localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME);
  } catch {
    return DEFAULT_THEME;
  }
}

function setStoredTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, normalizeTheme(theme));
  } catch {}
}

function getStoredAppearance() {
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY);
    if (!raw) return { ...DEFAULT_APPEARANCE };
    return normalizeAppearance(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

function setStoredAppearance(appearance) {
  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(normalizeAppearance(appearance)));
  } catch {}
}

function ensureAppearanceStyle() {
  let styleEl = document.getElementById("evaraAppearanceStyle");
  if (styleEl) return styleEl;

  styleEl = document.createElement("style");
  styleEl.id = "evaraAppearanceStyle";
  styleEl.textContent = `
    :root {
      --user-card-tint: ${DEFAULT_APPEARANCE.cardColor};
      --user-button-tint: ${DEFAULT_APPEARANCE.buttonColor};
      --user-background-tint: ${DEFAULT_APPEARANCE.backgroundColor};
      --user-bg-color: ${DEFAULT_APPEARANCE.backgroundColor};
      --user-bg-color-2: ${DEFAULT_APPEARANCE.cardColor};
      --user-beam-color: ${DEFAULT_APPEARANCE.cardColor};
      --user-nav-tint: ${DEFAULT_APPEARANCE.cardColor};
    }

    body {
      background-image:
        radial-gradient(circle at 18% 16%, color-mix(in srgb, var(--user-background-tint) 16%, transparent), transparent 26%),
        radial-gradient(circle at 82% 14%, color-mix(in srgb, var(--user-card-tint) 12%, transparent), transparent 24%),
        radial-gradient(circle at 16% 82%, color-mix(in srgb, var(--user-card-tint) 10%, transparent), transparent 24%) !important;
    }

    .glass-card,
    .glass-shell,
    .aurora-card,
    .input-shell,
    .feature-card,
    .hero,
    .inline-card,
    .dashboard-feed-item,
    .dashboard-stat-card,
    .login-panel,
    .auth-panel,
    .dashboard-panel,
    .dashboard-hero,
    .dashboard-overview,
    .dashboard-sidebar-inner,
    .settings-preview-card,
    .settings-color-tool,
    .settings-mini-card,
    .stats-card,
    .hero-home,
    .section-panel,
    .cta-panel,
    .site-footer-inner,
    .eva-nav-pill,
    #evaNavPill,
    .eva-menu-panel,
    .settings-preview-nav {
      border-color: color-mix(in srgb, var(--user-card-tint) 24%, rgba(255,255,255,0.12)) !important;
      box-shadow:
        0 18px 34px rgba(0,0,0,0.14),
        inset 0 1px 0 rgba(255,255,255,0.10),
        0 0 0 1px color-mix(in srgb, var(--user-card-tint) 10%, transparent) !important;
    }

    .btn-theme-primary,
    .settings-preview-btn,
    .premium-red-btn,
    .login-actions-row .btn:first-child,
    .hero-actions .btn:first-child,
    .dashboard-hero-actions .btn:first-child,
    .btn-apple,
    .btn.btn-apple,
    .btn.btn-theme-primary,
    .btn {
      background:
        linear-gradient(
          180deg,
          color-mix(in srgb, var(--user-button-tint) 14%, rgba(255,255,255,0.16)),
          color-mix(in srgb, var(--user-button-tint) 8%, rgba(255,255,255,0.06))
        ) !important;
      border-color: color-mix(in srgb, var(--user-button-tint) 28%, rgba(255,255,255,0.10)) !important;
      box-shadow:
        0 14px 24px rgba(0,0,0,0.12),
        inset 0 1px 0 rgba(255,255,255,0.18),
        0 0 0 1px color-mix(in srgb, var(--user-button-tint) 8%, transparent) !important;
      color: inherit !important;
      backdrop-filter: blur(16px) saturate(145%);
      -webkit-backdrop-filter: blur(16px) saturate(145%);
    }

    .page-grid-overlay {
      background-image:
        linear-gradient(color-mix(in srgb, var(--user-card-tint) 8%, transparent) 1px, transparent 1px),
        linear-gradient(90deg, color-mix(in srgb, var(--user-card-tint) 8%, transparent) 1px, transparent 1px) !important;
      opacity: 0.18 !important;
    }

    html[data-beam-mode="off"] .beam-target:hover,
    html[data-beam-mode="off"] .beam-target.is-active,
    html[data-beam-mode="off"] .dashboard-nav-link.active,
    html[data-beam-mode="off"] .eva-link.active,
    html[data-beam-mode="off"] .input-shell:focus-within,
    html[data-beam-mode="off"] .btn:focus-visible {
      box-shadow: none !important;
      filter: none !important;
    }

    html[data-beam-mode="contextual"] .beam-target:hover,
    html[data-beam-mode="contextual"] .beam-target.is-active,
    html[data-beam-mode="contextual"] .dashboard-nav-link.active,
    html[data-beam-mode="contextual"] .eva-link.active,
    html[data-beam-mode="contextual"] .input-shell:focus-within,
    html[data-beam-mode="contextual"] .btn:focus-visible,
    html:not([data-beam-mode]) .beam-target:hover,
    html:not([data-beam-mode]) .beam-target.is-active,
    html:not([data-beam-mode]) .dashboard-nav-link.active,
    html:not([data-beam-mode]) .eva-link.active,
    html:not([data-beam-mode]) .input-shell:focus-within,
    html:not([data-beam-mode]) .btn:focus-visible {
      box-shadow:
        0 0 0 1px color-mix(in srgb, var(--user-card-tint) 46%, transparent),
        0 0 18px color-mix(in srgb, var(--user-card-tint) 18%, transparent),
        0 0 28px color-mix(in srgb, var(--user-card-tint) 8%, transparent),
        inset 0 1px 0 rgba(255,255,255,0.12) !important;
    }

    html[data-beam-mode="rainbow"] .beam-target:hover,
    html[data-beam-mode="rainbow"] .beam-target.is-active,
    html[data-beam-mode="rainbow"] .dashboard-nav-link.active,
    html[data-beam-mode="rainbow"] .eva-link.active,
    html[data-beam-mode="rainbow"] .input-shell:focus-within,
    html[data-beam-mode="rainbow"] .btn:focus-visible {
      position: relative;
      isolation: isolate;
      box-shadow:
        0 0 0 1px rgba(255,255,255,0.14),
        0 0 16px rgba(255,255,255,0.10),
        inset 0 1px 0 rgba(255,255,255,0.12) !important;
    }

    html[data-beam-mode="rainbow"] .beam-target:hover::after,
    html[data-beam-mode="rainbow"] .beam-target.is-active::after,
    html[data-beam-mode="rainbow"] .dashboard-nav-link.active::after,
    html[data-beam-mode="rainbow"] .eva-link.active::after,
    html[data-beam-mode="rainbow"] .input-shell:focus-within::after,
    html[data-beam-mode="rainbow"] .btn:focus-visible::after {
      content: "";
      position: absolute;
      inset: -1px;
      border-radius: inherit;
      padding: 1px;
      background: linear-gradient(
        120deg,
        #ff3b30,
        #ff9500,
        #ffd60a,
        #34c759,
        #0a84ff,
        #5e5ce6,
        #bf5af2,
        #ff2d55,
        #ff3b30
      );
      background-size: 220% 220%;
      animation: evaraRainbowFlow 5.8s linear infinite;
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      mask-composite: exclude;
      pointer-events: none;
      z-index: 2;
      opacity: 0.86;
    }

    @keyframes evaraRainbowFlow {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
  `;
  document.head.appendChild(styleEl);
  return styleEl;
}

function syncThemeUi() {
  const currentTheme = getStoredTheme();
  const appearance = getStoredAppearance();

  document.querySelectorAll("[data-theme-mode-text]").forEach((el) => {
    if (appearance.mode === "custom") {
      el.textContent = "Custom";
    } else {
      el.textContent = currentTheme === "light" ? "Light" : "Dark";
    }
  });

  document.querySelectorAll("[data-beam-mode-text]").forEach((el) => {
    const label =
      appearance.beamMode === "contextual"
        ? "Contextual"
        : appearance.beamMode.charAt(0).toUpperCase() + appearance.beamMode.slice(1);
    el.textContent = label;
  });

  const previewMap = [
    ["[data-card-color-preview]", appearance.cardColor],
    ["[data-button-color-preview]", appearance.buttonColor],
    ["[data-background-color-preview]", appearance.backgroundColor]
  ];

  previewMap.forEach(([selector, value]) => {
    document.querySelectorAll(selector).forEach((el) => {
      el.style.background = value;
    });
  });

  const valueMap = [
    ["[data-card-color-value]", appearance.cardColor],
    ["[data-button-color-value]", appearance.buttonColor],
    ["[data-background-color-value]", appearance.backgroundColor]
  ];

  valueMap.forEach(([selector, value]) => {
    document.querySelectorAll(selector).forEach((el) => {
      el.textContent = value;
    });
  });

  document.querySelectorAll("[data-set-mode]").forEach((btn) => {
    const mode = btn.getAttribute("data-set-mode");
    btn.classList.toggle("is-active", mode === appearance.mode);
  });

  document.querySelectorAll("[data-set-beam]").forEach((btn) => {
    const mode = btn.getAttribute("data-set-beam");
    btn.classList.toggle("is-active", mode === appearance.beamMode);
  });
}

function applyTheme(theme) {
  const safe = normalizeTheme(theme);
  document.documentElement.setAttribute("data-theme", safe);
  setStoredTheme(safe);
  syncThemeUi();
}

function applyAppearanceConfig(appearance = {}) {
  ensureAppearanceStyle();

  const safe = normalizeAppearance(appearance);

  const themeToApply = safe.mode === "light" ? "light" : "dark";
  applyTheme(themeToApply);
  setStoredAppearance(safe);

  const root = document.documentElement;
  root.style.setProperty("--user-card-tint", safe.cardColor);
  root.style.setProperty("--user-button-tint", safe.buttonColor);
  root.style.setProperty("--user-background-tint", safe.backgroundColor);
  root.style.setProperty("--user-bg-color", safe.backgroundColor);
  root.style.setProperty("--user-bg-color-2", safe.cardColor);
  root.style.setProperty("--user-beam-color", safe.cardColor);
  root.style.setProperty("--user-nav-tint", safe.cardColor);
  root.setAttribute("data-beam-mode", safe.beamMode);

  syncThemeUi();
}

function resetAppearanceConfig() {
  applyAppearanceConfig({ ...DEFAULT_APPEARANCE });
}

function openColorInput(input) {
  if (!input) return;
  input.focus({ preventScroll: true });
  input.click();
}

function bindColorWheelOpeners() {
  const openers = [
    ["[data-appearance-card]", ".settings-color-open[data-open-target='card']"],
    ["[data-appearance-button]", ".settings-color-open[data-open-target='button']"],
    ["[data-appearance-background]", ".settings-color-open[data-open-target='background']"]
  ];

  openers.forEach(([inputSelector, openerSelector]) => {
    const inputs = Array.from(document.querySelectorAll(inputSelector));
    const openButtons = Array.from(document.querySelectorAll(openerSelector));

    openButtons.forEach((btn, index) => {
      const targetInput = inputs[index] || inputs[0];
      if (!targetInput) return;

      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openColorInput(targetInput);
      });
    });
  });
}

function bindThemeControls() {
  document.querySelectorAll("[data-set-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-set-mode") || "dark";
      const current = getStoredAppearance();

      applyAppearanceConfig({
        ...current,
        mode
      });

      if (mode === "custom") {
        const customSection = document.querySelector("[data-color-wheel-section]");
        if (customSection) {
          customSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    });
  });

  document.querySelectorAll("[data-set-beam]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const beamMode = btn.getAttribute("data-set-beam") || "contextual";
      const current = getStoredAppearance();

      applyAppearanceConfig({
        ...current,
        beamMode
      });
    });
  });

  const bindColorInputs = (selector, updater) => {
    document.querySelectorAll(selector).forEach((input) => {
      input.addEventListener("input", () => {
        const current = getStoredAppearance();
        applyAppearanceConfig(updater(current, input.value));
      });

      input.addEventListener("change", () => {
        const current = getStoredAppearance();
        applyAppearanceConfig(updater(current, input.value));
      });
    });
  };

  bindColorInputs("[data-appearance-card]", (current, value) => ({
    ...current,
    mode: "custom",
    cardColor: value
  }));

  bindColorInputs("[data-appearance-button]", (current, value) => ({
    ...current,
    mode: "custom",
    buttonColor: value
  }));

  bindColorInputs("[data-appearance-background]", (current, value) => ({
    ...current,
    mode: "custom",
    backgroundColor: value
  }));

  document.querySelectorAll("[data-appearance-reset]").forEach((resetBtn) => {
    resetBtn.addEventListener("click", () => {
      resetAppearanceConfig();
      hydrateThemeInputs();
    });
  });
}

function hydrateThemeInputs() {
  const appearance = getStoredAppearance();

  document.querySelectorAll("[data-appearance-card]").forEach((input) => {
    input.value = appearance.cardColor;
  });

  document.querySelectorAll("[data-appearance-button]").forEach((input) => {
    input.value = appearance.buttonColor;
  });

  document.querySelectorAll("[data-appearance-background]").forEach((input) => {
    input.value = appearance.backgroundColor;
  });

  syncThemeUi();
}

function markBeamTargets() {
  document.querySelectorAll(`
    .glass-card,
    .glass-shell,
    .aurora-card,
    .settings-chip,
    .settings-preview-btn,
    .settings-preview-nav,
    .settings-color-tool,
    .dashboard-nav-link,
    .eva-link,
    .btn
  `).forEach((el) => {
    el.classList.add("beam-target");
  });
}

function initTheme() {
  ensureAppearanceStyle();
  applyAppearanceConfig(getStoredAppearance());
  bindThemeControls();
  bindColorWheelOpeners();
  hydrateThemeInputs();
  markBeamTargets();
}

window.EvaraTheme = {
  initTheme,
  applyTheme,
  applyAppearanceConfig,
  resetAppearanceConfig,
  getStoredAppearance,
  setStoredAppearance,
  normalizeAppearance,
  hydrateThemeInputs
};

document.addEventListener("DOMContentLoaded", initTheme);