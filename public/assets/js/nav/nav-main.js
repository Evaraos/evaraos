const NAV_BUILD = "nav-v1";

let NAV_STATE;
let getNavShell;
let setTheme;
let getAppearanceTheme;
let syncThemeLabel;
let renderNav;
let applyProgress;
let bindScrollBehavior;
let animateNav;

function ensureNavMount() {
  let mount = document.getElementById("universalNavRoot") || document.getElementById("universalNav");
  if (mount) return mount;
  mount = document.createElement("div");
  mount.id = "universalNavRoot";
  if (document.body.firstChild) document.body.insertBefore(mount, document.body.firstChild);
  else document.body.appendChild(mount);
  return mount;
}

function ensureAppRoot() {
  if (document.getElementById("appRoot")) return;
  const candidates = ["main.dashboard-shell", "main.page-shell", "main.app-shell", "main.container", "main"];
  const root = candidates.map((selector) => document.querySelector(selector)).find(Boolean);
  if (root) root.id = "appRoot";
}

async function loadCoreNav() {
  const config = await import(`./nav-config.js?v=${NAV_BUILD}`);
  const utils = await import(`./nav-utils.js?v=${NAV_BUILD}`);
  const renderer = await import(`./nav-render.js?v=${NAV_BUILD}`);
  const scroll = await import(`./nav-scroll.js?v=${NAV_BUILD}`);
  NAV_STATE = config.NAV_STATE;
  getNavShell = utils.getNavShell;
  setTheme = utils.setTheme;
  getAppearanceTheme = utils.getAppearanceTheme;
  syncThemeLabel = utils.syncThemeLabel;
  renderNav = renderer.renderNav;
  applyProgress = scroll.applyProgress;
  bindScrollBehavior = scroll.bindScrollBehavior;
  animateNav = scroll.animateNav;
}

async function safeImport(path) {
  try { return await import(`${path}?v=${NAV_BUILD}`); }
  catch (error) { console.warn("Optional nav module failed:", path, error); return null; }
}

function bootReadySignal() {
  if (NAV_STATE?.hasBootAnimated) return;
  if (NAV_STATE) NAV_STATE.hasBootAnimated = true;
  requestAnimationFrame(() => {
    if (window.EvaraLoader && typeof window.EvaraLoader.markAppReady === "function") window.EvaraLoader.markAppReady();
    else {
      document.body.classList.remove("app-loading");
      document.body.classList.add("app-ready");
    }
  });
}

function syncNavThemeVisual() {
  try { syncThemeLabel?.(); } catch {}
  const button = document.getElementById("evaThemeToggle");
  if (!button || !window.EvaraTheme) return;
  const appearance = window.EvaraTheme.getAppearance();
  const theme = window.EvaraTheme.getThemeFromAppearance(appearance);
  const icon = appearance.mode === "system" ? "◐" : theme === "dark" ? "☾" : "☀";
  button.dataset.themeMode = theme;
  button.dataset.appearanceMode = appearance.mode;
  button.setAttribute("aria-label", `Theme: ${appearance.mode === "system" ? `System (${theme})` : theme}. Tap to change.`);
  const iconNode = button.querySelector(".eva-theme-nav-icon");
  if (iconNode) iconNode.textContent = icon;
}

function bindDelegatedThemeToggle() {
  if (window.__evaraDelegatedThemeToggleBound) return;
  window.__evaraDelegatedThemeToggleBound = true;
  document.addEventListener("click", (event) => {
    const button = event.target?.closest?.("#evaThemeToggle");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    if (window.EvaraTheme?.toggleTheme) {
      window.EvaraTheme.toggleTheme();
      syncNavThemeVisual();
    } else {
      console.warn("EvaraTheme controller is not available yet.");
    }
  }, true);
  window.addEventListener("evara:theme-applied", syncNavThemeVisual);
  window.addEventListener("evara:appearance-updated", syncNavThemeVisual);
}

async function bindOptionalSystems() {
  const menu = await safeImport("./nav-menu.js");
  const events = await safeImport("./nav-events.js");
  const session = await safeImport("./nav-session.js");
  const interactions = await safeImport("./nav-interactions.js");
  try { events?.bindAllNavEvents?.(); } catch (error) { console.warn("Nav events failed:", error); }
  try { menu?.bindMenu?.(); } catch (error) { console.warn("Nav menu failed:", error); }
  try { interactions?.bindNavInteractions?.(); } catch (error) { console.warn("Nav interactions failed:", error); }
  try { bindScrollBehavior?.(); } catch (error) { console.warn("Nav scroll failed:", error); }
  try { session?.bindRuntimeRefresh?.(); } catch (error) { console.warn("Nav session refresh failed:", error); }
  syncNavThemeVisual();
}

export async function initNav() {
  try {
    ensureNavMount();
    ensureAppRoot();
    bindDelegatedThemeToggle();
    await loadCoreNav();
    if (NAV_STATE.hasInitialized) return;
    NAV_STATE.hasInitialized = true;
    window.EVARAOS_NAV_BUILD = NAV_BUILD;
    document.documentElement.dataset.evaraosNavBuild = NAV_BUILD;
    setTheme(getAppearanceTheme());
    const rendered = renderNav();
    if (!rendered) {
      console.warn("Evaraos nav did not render.");
      bootReadySignal();
      return;
    }
    const shell = getNavShell();
    NAV_STATE.progress = 1;
    NAV_STATE.targetProgress = 1;
    NAV_STATE.motionMode = "stable";
    if (shell) {
      shell.style.setProperty("--nav-progress", "1.0000");
      shell.classList.add("expanded");
      shell.classList.remove("compact", "quick-pressing");
      shell.dataset.navBuild = NAV_BUILD;
    }
    document.body.classList.add("eva-nav-expanded");
    document.body.classList.remove("eva-nav-compact", "eva-pressing-nav");
    try { applyProgress(1); } catch (error) { console.warn("Nav progress failed:", error); }
    try { animateNav(); } catch (error) { console.warn("Nav animation failed:", error); }
    bootReadySignal();
    bindOptionalSystems();
  } catch (error) {
    console.error("Evaraos nav failed to boot:", error);
    bootReadySignal();
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initNav, { once: true });
else initNav();
