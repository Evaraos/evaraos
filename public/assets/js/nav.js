import "./nav/nav-main-v6.js?v=nav-v60-shell-recovery";
import "./experience/experience-runtime.js?v=experience-runtime-v1";
import { canAccessPageName } from "./access-control.js";

const NAV_ENTRY_BUILD = "nav-v60-shell-recovery";
const NAV_ENTRY_GUARD = "__evaraosNavEntryV60";

if (!window[NAV_ENTRY_GUARD]) {
  window[NAV_ENTRY_GUARD] = true;

  const guardMode = document.body?.dataset?.routeGuard || "";
  const pathname = location.pathname.toLowerCase();
  const isPublicHome = guardMode === "public" && (pathname === "/" || pathname.endsWith("/index.html"));
  const isPublicBottomNavRoute = canAccessPageName(pathname, "guest");
  const isStudioRoute = /(?:website-builder|studio|blueprint|design-system)/.test(pathname);
  let navEnhancementsRequested = false;
  let bottomNavRequested = false;
  let privateRuntimeRequested = false;
  let studioRuntimeRequested = false;

  function safeImport(path) {
    return import(path).catch((error) => {
      console.warn("Deferred EvaraOS module failed:", path, error);
      return null;
    });
  }

  function loadBottomNav() {
    if (bottomNavRequested) return Promise.resolve(null);
    bottomNavRequested = true;
    return safeImport("./nav/nav-bottom.js?v=nav-v60-shell-recovery");
  }

  function runWhenIdle(callback, timeout = 1400) {
    if ("requestIdleCallback" in window) {
      requestIdleCallback(callback, { timeout });
    } else {
      setTimeout(callback, 180);
    }
  }

  function loadNavEnhancements() {
    if (navEnhancementsRequested) return;
    navEnhancementsRequested = true;

    const immediateEnhancements = [
      safeImport("./nav/nav-drawer-close.js?v=nav-v59-responsive-core")
    ];

    if ((guardMode !== "auth" && !isPublicHome) || isPublicBottomNavRoute) {
      immediateEnhancements.unshift(loadBottomNav());
    }

    Promise.all(immediateEnhancements).catch(() => {});

    runWhenIdle(() => {
      const idleEnhancements = [
        safeImport("./nav/pull-to-refresh.js?v=nav-v59-responsive-core"),
        safeImport("./ui/icon-hydrator.js?v=13")
      ];
      if (!isPublicBottomNavRoute) idleEnhancements.push(safeImport("./nav/avatar-sync.js?v=nav-v59-responsive-core"));
      Promise.all(idleEnhancements).catch(() => {});
    }, 1800);
  }

  function loadPrivateRuntime() {
    if (privateRuntimeRequested || guardMode !== "private") return;
    privateRuntimeRequested = true;
    Promise.all([
      safeImport("./nav/nav-role-lockdown.js?v=6"),
      safeImport("./permissions-runtime.js?v=6"),
      safeImport("./direct-access-check.js?v=5")
    ]).catch(() => {});
  }

  function loadStudioRuntime() {
    if (studioRuntimeRequested || !isStudioRoute) return;
    studioRuntimeRequested = true;
    Promise.all([
      safeImport("./design-system.js?v=3"),
      safeImport("./studio/component-registry.js?v=2"),
      safeImport("./studio/module-registry.js?v=2"),
      safeImport("./studio/studio-roadmap.js?v=2"),
      safeImport("./studio/blueprint-registry.js?v=2"),
      safeImport("./studio/blueprint-drafts.js?v=2"),
      safeImport("./studio/studio-safe-reset.js?v=2")
    ]).catch(() => {});
  }

  function onNavReady() {
    window.EvaraBrand?.apply?.();
    loadNavEnhancements();
    loadPrivateRuntime();
    loadStudioRuntime();
    if (!isPublicHome) runWhenIdle(() => safeImport("./design-system.js?v=3"));
  }

  window.addEventListener("evara:nav-ready", onNavReady, { once: true });
  if (document.documentElement.dataset.evaraosNavReady === "true") onNavReady();

  if (isPublicBottomNavRoute) loadBottomNav();

  window.addEventListener("evara:session-ready", () => {
    loadPrivateRuntime();
  });
}

window.EVARAOS_NAV_ENTRY_VERSION = NAV_ENTRY_BUILD;
