import {
  auth,
  onAuthStateChanged,
  hydrateUserProfile,
  getSavedUserProfile,
  getSavedUserRole,
  clearSavedUserRole,
  clearSavedUserProfile,
  normalizeRole
} from "./firebase.js";

const ROUTES = {
  login: "./login.html",
  dashboard: "./dashboard.html"
};

const AUTH_WAIT_TIMEOUT_MS = 4500;

const OWNER_ROLES = new Set(["owner", "super_admin", "admin"]);
const OPS_ROLES = new Set([
  "owner",
  "super_admin",
  "admin",
  "manager",
  "operations_manager",
  "operations_coordinator",
  "dispatcher",
  "field_manager",
  "sales_manager",
  "hr",
  "hr_manager"
]);
const STAFF_ROLES = new Set([
  "technician",
  "cleaner",
  "staff",
  "field_staff",
  "crew_lead",
  "sales",
  "sales_rep",
  "customer_support",
  "quality_control"
]);

const CUSTOMER_ALLOWED = new Set([
  "dashboard.html",
  "customer-commerce.html",
  "customer-messaging.html",
  "customer-service-history.html",
  "settings.html"
]);

const STAFF_ALLOWED = new Set([
  "dashboard.html",
  "leads.html",
  "jobs.html",
  "customer-messaging.html",
  "customer-service-history.html",
  "presence.html",
  "territory-map.html",
  "settings.html"
]);

const OPS_ONLY = new Set([
  "operations-visibility.html",
  "enterprise-finance-dashboard.html",
  "marketplace-payouts.html",
  "applications.html",
  "users.html",
  "companies.html",
  "governance-dashboard.html",
  "governance-analytics.html",
  "anomaly-dashboard.html",
  "audit-dashboard.html",
  "replay-dashboard.html",
  "org.html",
  "notifications.html",
  "executive-queue.html",
  "workflow-monitor-dashboard.html",
  "alerts-dashboard.html",
  "analytics-dashboard.html",
  "territories.html",
  "live-operations-command.html",
  "qa.html"
]);

let hasFinishedRouteGuard = false;

function emit(name, detail = {}) {
  window.dispatchEvent(new CustomEvent(name, { detail: { at: Date.now(), ...detail } }));
}

function pageName() {
  return (window.location.pathname.split("/").pop() || "index.html") || "index.html";
}

function normalizePath(path = "") {
  if (!path) return ROUTES.dashboard;
  try {
    const url = new URL(path, window.location.origin);
    if (url.origin !== window.location.origin) return ROUTES.dashboard;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return path;
  }
}

function setReadyState() {
  document.documentElement.classList.remove("auth-pending");
  document.body?.classList.remove("auth-pending", "app-loading");
  document.body?.classList.add("app-ready");
}

function markLoaderReady() {
  window.EvaraLoader?.markAppReady?.();
}

function safeMarkReady(detail = {}) {
  if (hasFinishedRouteGuard) return;
  hasFinishedRouteGuard = true;
  setReadyState();
  markLoaderReady();
  emit("evara:session-ready", detail);
}

function clearUserSession() {
  clearSavedUserRole?.();
  clearSavedUserProfile?.();
}

function beginGuardRedirect(url, options = {}) {
  if (hasFinishedRouteGuard) return;
  hasFinishedRouteGuard = true;

  if (window.EvaraLoader?.beginNavigationLoad) {
    window.EvaraLoader.beginNavigationLoad({
      title: options.title || "Opening Evaraos",
      subtitle: options.subtitle || "Taking you to the right page."
    });
  }

  requestAnimationFrame(() => window.location.replace(url));
}

function saveIntendedRoute() {
  try {
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (!current.includes("login.html") && !current.includes("signup.html") && !current.includes("reset.html")) {
      sessionStorage.setItem("evaraos-intended-route", current);
    }
  } catch {}
}

function consumeIntendedRoute() {
  try {
    const saved = sessionStorage.getItem("evaraos-intended-route");
    sessionStorage.removeItem("evaraos-intended-route");
    return normalizePath(saved || ROUTES.dashboard);
  } catch {
    return ROUTES.dashboard;
  }
}

function getEffectiveRole(profile = getSavedUserProfile()) {
  return normalizeRole(profile?.role || getSavedUserRole() || "customer");
}

function canAccessCurrentPage(role = "customer") {
  const page = pageName();
  const normalized = normalizeRole(role);

  if (!OPS_ONLY.has(page)) {
    if (normalized === "customer") return CUSTOMER_ALLOWED.has(page) || page === "dashboard.html";
    if (STAFF_ROLES.has(normalized)) return STAFF_ALLOWED.has(page) || !OPS_ONLY.has(page);
    return true;
  }

  return OWNER_ROLES.has(normalized) || OPS_ROLES.has(normalized);
}

function defaultDashboardForRole(role = "customer") {
  const normalized = normalizeRole(role);
  if (normalized === "customer") return "./dashboard.html";
  if (STAFF_ROLES.has(normalized)) return "./dashboard.html";
  return "./dashboard.html";
}

function waitForVerifiedFirebaseUser() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);

  return new Promise((resolve) => {
    let settled = false;
    let unsubscribe = null;

    const finish = (user = null) => {
      if (settled) return;
      settled = true;
      try { unsubscribe?.(); } catch {}
      resolve(user || null);
    };

    const timer = setTimeout(() => {
      console.warn("Firebase auth wait timed out. Continuing safely.");
      finish(auth.currentUser || null);
    }, AUTH_WAIT_TIMEOUT_MS);

    unsubscribe = onAuthStateChanged(auth, (user) => {
      clearTimeout(timer);
      finish(user || null);
    });
  });
}

async function handlePrivateRoute() {
  const verifiedUser = await waitForVerifiedFirebaseUser();

  if (!verifiedUser) {
    saveIntendedRoute();
    clearUserSession();
    beginGuardRedirect(ROUTES.login, {
      title: "Secure Area",
      subtitle: "Please sign in to continue."
    });
    return;
  }

  const profile = await hydrateUserProfile(verifiedUser);
  const role = getEffectiveRole(profile);

  if (!canAccessCurrentPage(role)) {
    beginGuardRedirect(defaultDashboardForRole(role), {
      title: "Opening your dashboard",
      subtitle: "That page is not available for this account."
    });
    return;
  }

  safeMarkReady({ mode: "private", authenticated: true, role, source: "route-guard" });
}

async function handleAuthRoute() {
  const verifiedUser = await waitForVerifiedFirebaseUser();

  if (verifiedUser) {
    const profile = await hydrateUserProfile(verifiedUser);
    const role = getEffectiveRole(profile);
    const target = consumeIntendedRoute();

    beginGuardRedirect(target || defaultDashboardForRole(role), {
      title: "Opening Evaraos",
      subtitle: "Your session is already active."
    });
    return;
  }

  clearUserSession();
  safeMarkReady({ mode: "auth", authenticated: false, source: "verified-guest" });
}

function handlePublicRoute(mode) {
  safeMarkReady({
    mode: mode || "public",
    authenticated: Boolean(auth.currentUser || getSavedUserProfile()),
    source: "public-route"
  });
}

async function initRouteGuard() {
  const mode = document.body?.dataset?.routeGuard || "";

  try {
    if (mode === "private") {
      await handlePrivateRoute();
      return;
    }

    if (mode === "auth") {
      await handleAuthRoute();
      return;
    }

    handlePublicRoute(mode);
  } catch (error) {
    console.error("Route guard failed:", error);

    if (mode === "private") {
      saveIntendedRoute();
      clearUserSession();
      beginGuardRedirect(ROUTES.login, {
        title: "Returning to login",
        subtitle: "Unable to verify your secure session."
      });
      return;
    }

    safeMarkReady({ mode, error: true });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initRouteGuard, { once: true });
} else {
  initRouteGuard();
}
