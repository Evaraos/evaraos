import { NAV_STATE } from "./nav-config.js";
import { syncThemeLabel } from "./nav-utils.js";
import { applyProgress } from "./nav-scroll.js";
import { renderNav } from "./nav-render.js";

const NAV_BUILD = "nav-v59-responsive-core";

function isPublicHomeRoute() {
  const mode = document.body?.dataset?.routeGuard || "";
  const path = window.location.pathname.toLowerCase();
  return mode === "public" && (path === "/" || path.endsWith("/index.html"));
}

async function loadCanonicalBinders() {
  const [events, menu, interactions] = await Promise.all([
    import(`./nav-events.js?v=${NAV_BUILD}`),
    import(`./nav-menu.js?v=${NAV_BUILD}`),
    import(`./nav-interactions.js?v=${NAV_BUILD}`)
  ]);
  return { events, menu, interactions };
}

function restoreBottomNavAfterRender() {
  if (document.body?.dataset?.routeGuard === "auth" || isPublicHomeRoute()) return;
  import("./nav-bottom.js?v=nav-v59-responsive-core")
    .then(({ mountBottomNav }) => mountBottomNav())
    .catch((error) => console.warn("Bottom nav restore failed:", error));
}

export async function rebindNavAfterRender() {
  if (!isPublicHomeRoute()) {
    const binders = await loadCanonicalBinders();
    binders.events.bindAllNavEvents();
    binders.menu.bindMenu();
    binders.interactions.bindNavInteractions();

    if (document.getElementById("evaLogoutBtn")) {
      const { bindLogout } = await import(`./nav-logout.js?v=${NAV_BUILD}`);
      bindLogout();
    }
  }
  syncThemeLabel();
  restoreBottomNavAfterRender();
}

export async function refreshNav() {
  try {
    const wasOpen = document.body.classList.contains("nav-menu-open");
    let menu = null;
    if (wasOpen) {
      menu = await import(`./nav-menu.js?v=${NAV_BUILD}`);
      menu.closeMenu(false);
    }

    renderNav();

    applyProgress();
    await rebindNavAfterRender();

    if (wasOpen) {
      menu ||= await import(`./nav-menu.js?v=${NAV_BUILD}`);
      menu.openMenu();
    }
  } catch (error) {
    console.warn("Nav refresh failed:", error);
  }
}

export function bindRuntimeRefresh() {
  if (NAV_STATE.sessionRefreshBound) return;
  NAV_STATE.sessionRefreshBound = true;

  window.addEventListener("evara:session-ready", refreshNav);

  window.addEventListener("storage", (event) => {
    if (["evaraos-user", "evaraos-role"].includes(event.key)) refreshNav();
    if (event.key === "evaraos-appearance") syncThemeLabel();
  });

  window.addEventListener("evara:theme-applied", syncThemeLabel);
  window.addEventListener("evara:appearance-updated", syncThemeLabel);

  window.addEventListener("pageshow", () => {
    NAV_STATE.isNavigating = false;
    window.EvaraTheme?.applyAppearance?.();
    applyProgress(1);

    if (window.EvaraLoader && typeof window.EvaraLoader.completeNavigationLoad === "function") {
      window.EvaraLoader.completeNavigationLoad();
    } else {
      document.body.classList.remove("app-loading");
      document.body.classList.add("app-ready");
    }
  });
}
