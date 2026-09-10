import "./nav/nav-main-v6.js?v=home-reconcile-1";
import { canAccessPageName } from "./access-control.js";
import "./experience/experience-runtime.js?v=experience-runtime-v1";

const NAV_ENTRY_BUILD = "nav-v59-responsive-core";
const NAV_ENTRY_GUARD = "__evaraosNavEntryV59";

if (!window[NAV_ENTRY_GUARD]) {
  window[NAV_ENTRY_GUARD] = true;

  const guardMode = document.body?.dataset?.routeGuard || "";
  const pathname = location.pathname.toLowerCase();
  const isPublicHome = guardMode === "public" && (pathname === "/" || pathname.endsWith("/index.html"));
  const isStudioRoute = /(?:website-builder|studio|blueprint|design-system)/.test(pathname);
  const ownerRoles = new Set(["owner", "super_admin", "admin"]);
  let ownerEditorRequested = false;
  let navEnhancementsRequested = false;
  let privateRuntimeRequested = false;
  let studioRuntimeRequested = false;

  function safeImport(path) {
    return import(path).catch((error) => {
      console.warn("Deferred EvaraOS module failed:", path, error);
      return null;
    });
  }

  function runWhenIdle(callback, timeout = 1400) {
    if ("requestIdleCallback" in window) {
      requestIdleCallback(callback, { timeout });
    } else {
      setTimeout(callback, 180);
    }
  }

  function storedRole() {
    try {
      const profile = JSON.parse(localStorage.getItem("evaraos-user") || sessionStorage.getItem("evaraos-user") || "null") || {};
      return String(profile.role || localStorage.getItem("evaraos-role") || sessionStorage.getItem("evaraos-role") || "").trim().toLowerCase();
    } catch {
      return String(localStorage.getItem("evaraos-role") || sessionStorage.getItem("evaraos-role") || "").trim().toLowerCase();
    }
  }

  function maybeLoadOwnerEditor(role = "") {
    if (ownerEditorRequested || !ownerRoles.has(String(role || "").trim().toLowerCase())) return;
    ownerEditorRequested = true;
    runWhenIdle(() => safeImport("./owner-editor.js?v=5"));
  }

  function loadNavEnhancements() {
    if (navEnhancementsRequested) return;
    navEnhancementsRequested = true;

    const immediateEnhancements = [
      safeImport("./nav/nav-drawer-close.js?v=nav-v59-responsive-core")
    ];

    if ((guardMode !== "auth" && !isPublicHome) || canAccessPageName(pathname, "guest")) {
      immediateEnhancements.unshift(safeImport("./nav/nav-bottom.js"));
    }

    Promise.all(immediateEnhancements).catch(() => {});

    runWhenIdle(() => {
      const idleEnhancements = [
        safeImport("./nav/pull-to-refresh.js?v=nav-v59-responsive-core"),
        safeImport("./ui/icon-hydrator.js?v=13")
      ];
      if (!canAccessPageName(pathname, "guest")) idleEnhancements.push(safeImport("./nav/avatar-sync.js?v=nav-v59-responsive-core"));
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

  window.addEventListener("evara:session-ready", (event) => {
    if (!isPublicHome) maybeLoadOwnerEditor(event.detail?.role || storedRole());
    loadPrivateRuntime();
  });

  if (!isPublicHome) maybeLoadOwnerEditor(storedRole());
}

window.EVARAOS_NAV_ENTRY_VERSION = NAV_ENTRY_BUILD;
