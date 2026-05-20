import {
  auth,
  onAuthStateChanged,
  hydrateUserProfile,
  getSavedUserProfile,
  getSavedUserRole,
  clearSavedUserRole,
  clearSavedUserProfile,
  normalizeRole as normalizeFirebaseRole
} from "./firebase.js";

import {
  normalizeRole,
  getRoleDefinition,
  getHomeRouteForRole,
  appByRoute,
  roleCanAccessApp
} from "./navigation/app-registry.js";

const ROUTES = {
  login: "/login.html",
  dashboard: "/dashboard.html",
  customerDashboard: "/customer_dashboard.html"
};

const AUTH_WAIT_TIMEOUT_MS = 4500;
let hasFinishedRouteGuard = false;

const PUBLIC_AUTH_PAGES = new Set(["login.html", "signup.html", "reset.html", "index.html"]);
const CUSTOMER_PAGES = new Set(["customer_dashboard.html", "customer-commerce.html", "customer-messaging.html", "customer-service-history.html", "settings.html"]);

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

function roleFromProfile(profile = getSavedUserProfile()) {
  const rawRole = profile?.role || getSavedUserRole() || "customer";
  return normalizeRole(normalizeFirebaseRole?.(rawRole) || rawRole);
}

function defaultDashboardForRole(role = "customer") {
  return getHomeRouteForRole(role) || ROUTES.customerDashboard;
}

function consumeIntendedRoute(role = "customer") {
  try {
    const saved = sessionStorage.getItem("evaraos-intended-route");
    sessionStorage.removeItem("evaraos-intended-route");
    if (!saved) return defaultDashboardForRole(role);
    return normalizePath(saved);
  } catch {
    return defaultDashboardForRole(role);
  }
}

function canAccessCurrentPage(role = "customer") {
  const page = pageName();
  const normalized = normalizeRole(role);

  if (PUBLIC_AUTH_PAGES.has(page)) return true;
  if (normalized === "owner" || normalized === "super_admin") return true;
  if (normalized === "customer") return CUSTOMER_PAGES.has(page);

  const app = appByRoute(`/${page}`);
  if (app) return roleCanAccessApp(normalized, app);

  const definition = getRoleDefinition(normalized);
  return definition.level >= 80;
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
    beginGuardRedirect(ROUTES.login, { title: "Secure Area", subtitle: "Please sign in to continue." });
    return;
  }

  const profile = await hydrateUserProfile(verifiedUser);
  const role = roleFromProfile(profile);

  if (!canAccessCurrentPage(role)) {
    beginGuardRedirect(defaultDashboardForRole(role), {
      title: "Opening your workspace",
      subtitle: "That page is not available for this account."
    });
    return;
  }

  safeMarkReady({ mode: "private", authenticated: true, role, roleDefinition: getRoleDefinition(role), source: "route-guard" });
}

async function handleAuthRoute() {
  const verifiedUser = await waitForVerifiedFirebaseUser();

  if (verifiedUser) {
    const profile = await hydrateUserProfile(verifiedUser);
    const role = roleFromProfile(profile);
    const target = consumeIntendedRoute(role);

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
