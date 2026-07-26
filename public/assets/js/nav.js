import "./nav/nav-main-v6.js?v=nav-v59-owner-builder";
import "./app-builder-runtime.js?v=1";
import "./studio/studio-published-graph-runtime-v1.js?v=1";

const NAV_ENTRY_BUILD = "nav-v59-owner-builder";
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
  runWhenIdle(() => Promise.all([
    safeImport("./owner-editor.js?v=6-owner-publish"),
    safeImport("./owner-publish-runtime.js?v=1")
  ]).catch(() => {}));
}

function loadNavEnhancements() {
  if (navEnhancementsRequested) return;
  navEnhancementsRequested = true;

  Promise.all([
    safeImport("./nav/nav-bottom.js?v=nav-v59-owner-builder"),
    safeImport("./nav/nav-drawer-close.js?v=nav-v59-owner-builder")
  ]).catch(() => {});

  runWhenIdle(() => Promise.all([
    safeImport("./nav/pull-to-refresh.js?v=nav-v59-owner-builder"),
    safeImport("./nav/avatar-sync.js?v=nav-v59-owner-builder"),
    safeImport("./ui/icon-hydrator.js?v=13")
  ]).catch(() => {}), 1800);
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
  loadNavEnhancements();
  loadPrivateRuntime();
  loadStudioRuntime();
  if (!isPublicHome) runWhenIdle(() => safeImport("./design-system.js?v=3"));
}

window.addEventListener("evara:nav-ready", onNavReady, { once: true });
if (document.documentElement.dataset.evaraosNavReady === "true") onNavReady();

window.addEventListener("evara:session-ready", (event) => {
  maybeLoadOwnerEditor(event.detail?.role || storedRole());
  loadPrivateRuntime();
});

maybeLoadOwnerEditor(storedRole());
window.EVARAOS_NAV_ENTRY_VERSION = NAV_ENTRY_BUILD;
