const NAV_BUILD = "image2-nav-20260517d";

const { NAV_STATE } = await import(`./nav-config.js?v=${NAV_BUILD}`);

const {
  getNavShell,
  setTheme,
  getAppearanceTheme,
  syncThemeLabel
} = await import(`./nav-utils.js?v=${NAV_BUILD}`);

const { renderNav } = await import(`./nav-render.js?v=${NAV_BUILD}`);

const {
  applyProgress,
  atTopOfPage,
  bindScrollBehavior,
  animateNav
} = await import(`./nav-scroll.js?v=${NAV_BUILD}`);

const { bindMenu } = await import(`./nav-menu.js?v=${NAV_BUILD}`);
const { bindAllNavEvents } = await import(`./nav-events.js?v=${NAV_BUILD}`);
const { bindRuntimeRefresh } = await import(`./nav-session.js?v=${NAV_BUILD}`);
const { bindNavInteractions } = await import(`./nav-interactions.js?v=${NAV_BUILD}`);

const {
  startNotificationsDropdown,
  stopNotificationsDropdown
} = await import(`../notifications-dropdown.js?v=${NAV_BUILD}`);

function bootReadySignal() {
  if (NAV_STATE.hasBootAnimated) return;
  NAV_STATE.hasBootAnimated = true;

  requestAnimationFrame(() => {
    if (window.EvaraLoader && typeof window.EvaraLoader.markAppReady === "function") {
      window.EvaraLoader.markAppReady();
    } else {
      document.body.classList.remove("app-loading");
      document.body.classList.add("app-ready");
    }
  });
}

function shouldStartGlobalNotifications() {
  return document.body?.dataset?.routeGuard === "private";
}

function bindGlobalNotifications() {
  if (!shouldStartGlobalNotifications()) return;

  try {
    startNotificationsDropdown();
    window.EvaraPageLifecycle?.registerCleanup?.(stopNotificationsDropdown);
    window.addEventListener("pagehide", stopNotificationsDropdown);
  } catch (error) {
    console.warn("Global notifications dropdown failed to start:", error);
  }
}

export function initNav() {
  if (NAV_STATE.hasInitialized) return;
  NAV_STATE.hasInitialized = true;

  window.EVARAOS_NAV_BUILD = NAV_BUILD;
  document.documentElement.dataset.evaraosNavBuild = NAV_BUILD;

  setTheme(getAppearanceTheme());

  const rendered = renderNav();
  if (!rendered) return;

  const shell = getNavShell();
  const immediate = atTopOfPage() ? 1 : 0;

  NAV_STATE.progress = immediate;
  NAV_STATE.targetProgress = immediate;

  if (shell) {
    shell.style.setProperty("--nav-progress", immediate.toFixed(4));
    shell.classList.toggle("expanded", immediate === 1);
    shell.classList.toggle("compact", immediate !== 1);
    shell.dataset.navBuild = NAV_BUILD;
  }

  applyProgress(immediate);

  bindAllNavEvents();
  bindMenu();
  bindNavInteractions();
  bindScrollBehavior();
  bindRuntimeRefresh();
  syncThemeLabel();
  bindGlobalNotifications();

  animateNav();
  bootReadySignal();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNav, { once: true });
} else {
  initNav();
}
