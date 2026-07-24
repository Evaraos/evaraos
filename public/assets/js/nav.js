import "./nav/nav-main-v6.js?v=nav-v57-loader-gate";
import "./nav/nav-bottom.js?v=nav-v57-loader-gate";
import "./nav/nav-drawer-close.js?v=nav-v57-loader-gate";
import "./nav/pull-to-refresh.js?v=nav-v57-loader-gate";
import "./nav/avatar-sync.js?v=nav-v57-loader-gate";
import "./ui/icon-hydrator.js?v=13";

const NAV_ENTRY_BUILD = "nav-v57-loader-gate";
const guardMode = document.body?.dataset?.routeGuard || "";
const pathname = location.pathname.toLowerCase();
const isPublicHome = guardMode === "public" && (pathname === "/" || pathname.endsWith("/index.html"));
const isStudioRoute = /(?:website-builder|studio|blueprint|design-system)/.test(pathname);
const ownerRoles = new Set(["owner", "super_admin", "admin"]);
let ownerEditorRequested = false;

function safeImport(path) {
  return import(path).catch((error) => {
    console.warn("Deferred EvaraOS module failed:", path, error);
    return null;
  });
}

function runWhenIdle(callback) {
  if ("requestIdleCallback" in window) {
    requestIdleCallback(callback, { timeout: 1400 });
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

if (!isPublicHome) {
  runWhenIdle(() => safeImport("./design-system.js?v=3"));
}

if (guardMode === "private") {
  Promise.all([
    safeImport("./nav/nav-role-lockdown.js?v=6"),
    safeImport("./permissions-runtime.js?v=6"),
    safeImport("./direct-access-check.js?v=5")
  ]).catch(() => {});
}

if (isStudioRoute) {
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

window.addEventListener("evara:session-ready", (event) => {
  maybeLoadOwnerEditor(event.detail?.role || storedRole());
});

maybeLoadOwnerEditor(storedRole());

window.EVARAOS_NAV_ENTRY_VERSION = NAV_ENTRY_BUILD;