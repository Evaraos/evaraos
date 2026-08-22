import { NAV_STATE } from "./nav-config.js";
import { isPublicHomeRoute, isReducedPublicHome, syncThemeLabel } from "./nav-utils.js";
import { applyProgress } from "./nav-scroll.js";
import { renderNav } from "./nav-render.js";

const NAV_BUILD = "nav-v59-responsive-core";
let publicHomeBottomSyncBound = false;

function removeBottomNav() {
  document.querySelector(".eva-nav-layer .eva-bottom-nav")?.remove();
}

async function loadCanonicalBinders() {
  const [events, menu, interactions] = await Promise.all([
    import(`./nav-events.js?v=${NAV_BUILD}`),
    import(`./nav-menu.js?v=${NAV_BUILD}`),
    import(`./nav-interactions.js?v=${NAV_BUILD}`)
  ]);
  return { events, menu, interactions };
}

function syncPublicHomeBottomNavAfterSession() {
  if (!isPublicHomeRoute()) return;
  if (isReducedPublicHome()) {
    removeBottomNav();
    return;
  }
  restoreBottomNavAfterRender().catch((error) => console.warn("Public Home bottom nav sync failed:", error));
}

function bindPublicHomeBottomNavSync() {
  if (publicHomeBottomSyncBound) return;
  publicHomeBottomSyncBound = true;
  window.addEventListener("evara:session-ready", syncPublicHomeBottomNavAfterSession);
  window.addEventListener("storage", (event) => {
    if (["evaraos-user", "evaraos-role"].includes(event.key)) syncPublicHomeBottomNavAfterSession();
  });
}

function restoreBottomNavAfterRender() {
  if (document.body?.dataset?.routeGuard === "auth" || isPublicHomeRoute() && isReducedPublicHome()) {
    removeBottomNav();
    return Promise.resolve();
  }
  return import("./nav-bottom.js?v=nav-v59-responsive-core")
    .then(({ mountBottomNav }) => mountBottomNav())
    .then(() => {
      if (isPublicHomeRoute()) bindPublicHomeBottomNavSync();
    })
    .catch((error) => console.warn("Bottom nav restore failed:", error));
}

async function syncPublicHomeNotificationLifecycle() {
  if (!isPublicHomeRoute()) return;
  try {
    const notifications = await import("../notifications-dropdown.js");
    if (isReducedPublicHome()) {
      notifications.stopNotificationsDropdown?.();
      document.getElementById("globalNotificationsPanel")?.remove();
      return;
    }
    notifications.startNotificationsDropdown?.();
  } catch (error) {
    console.warn("Public Home notifications sync failed:", error);
  }
}

export async function rebindNavAfterRender() {
  if (!isReducedPublicHome()) {
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
  await syncPublicHomeNotificationLifecycle();
  await restoreBottomNavAfterRender();
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

  if (isPublicHomeRoute() && !isReducedPublicHome()) {
    restoreBottomNavAfterRender().catch((error) => console.warn("Public Home bottom nav boot failed:", error));
  }

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
