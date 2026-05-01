import {
  protectRoute,
  auth,
  onAuthStateChanged,
  clearUserSession
} from "./firebase.js";

let hasFinishedRouteGuard = false;
let hasPaintedOptimistically = false;

function clearAuthPending() {
  document.documentElement.classList.remove("auth-pending");
  document.body?.classList.remove("auth-pending");
}

function markBodyReady() {
  document.body?.classList.remove("app-loading");
  document.body?.classList.add("app-ready");
}

function dispatchSessionReady(detail = {}) {
  window.dispatchEvent(
    new CustomEvent("evara:session-ready", {
      detail: {
        at: Date.now(),
        ...detail
      }
    })
  );
}

function safeMarkReady(detail = {}) {
  clearAuthPending();
  markBodyReady();
  dispatchSessionReady(detail);

  if (window.EvaraLoader && typeof window.EvaraLoader.markAppReady === "function") {
    window.EvaraLoader.markAppReady();
  }
}

function paintOptimistically(detail = {}) {
  if (hasPaintedOptimistically) return;
  hasPaintedOptimistically = true;

  clearAuthPending();
  markBodyReady();

  if (window.EvaraLoader && typeof window.EvaraLoader.hideAllLoaders === "function") {
    window.EvaraLoader.hideAllLoaders(true);
  }

  window.dispatchEvent(
    new CustomEvent("evara:optimistic-paint", {
      detail: {
        at: Date.now(),
        ...detail
      }
    })
  );
}

function beginGuardRedirect(url, options = {}) {
  hasFinishedRouteGuard = true;

  clearAuthPending();

  if (window.EvaraLoader && typeof window.EvaraLoader.beginNavigationLoad === "function") {
    window.EvaraLoader.beginNavigationLoad({
      title: options.title || "Redirecting",
      subtitle: options.subtitle || "Taking you to the right page."
    });
  }

  requestAnimationFrame(() => {
    window.location.replace(url);
  });
}

function showAppReady(detail = {}) {
  if (hasFinishedRouteGuard) return;
  hasFinishedRouteGuard = true;

  safeMarkReady(detail);
}

function getStoredUser() {
  try {
    const raw =
      localStorage.getItem("evaraos-user") ||
      sessionStorage.getItem("evaraos-user");

    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function hasLocalSession() {
  const user = getStoredUser();
  return Boolean(user && (user.uid || user.email));
}

function waitForVerifiedFirebaseUser() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);

  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (unsubscribe) unsubscribe();
      resolve(user || null);
    });
  });
}

function isPrivateMode(mode) {
  return mode === "private";
}

function isAuthMode(mode) {
  return mode === "auth";
}

async function handlePrivateRoute() {
  const verifiedUser = await waitForVerifiedFirebaseUser();

  if (!verifiedUser) {
    clearUserSession?.();
    beginGuardRedirect("/login.html", {
      title: "Returning to login",
      subtitle: "Please sign in to continue."
    });
    return;
  }

  await protectRoute({
    requireAuth: true,
    redirectGuestTo: "/login.html",
    redirectAuthedTo: "/dashboard.html"
  });

  showAppReady({
    mode: "private",
    authenticated: true,
    source: "firebase-verified"
  });
}

async function handleAuthRoute() {
  const verifiedUser = await waitForVerifiedFirebaseUser();

  if (verifiedUser) {
    beginGuardRedirect("/dashboard.html", {
      title: "Opening dashboard",
      subtitle: "Your Firebase session is active."
    });
    return;
  }

  clearUserSession?.();

  paintOptimistically({
    mode: "auth",
    authenticated: false,
    source: "verified-guest"
  });

  showAppReady({
    mode: "auth",
    authenticated: false,
    source: "verified-guest"
  });
}

async function handlePublicRoute(mode) {
  paintOptimistically({
    mode: mode || "public",
    authenticated: hasLocalSession(),
    source: "public-fast-paint"
  });

  showAppReady({
    mode: mode || "public",
    authenticated: hasLocalSession()
  });
}

async function handleProtectedRoute(mode) {
  if (isPrivateMode(mode)) {
    await handlePrivateRoute();
    return;
  }

  if (isAuthMode(mode)) {
    await handleAuthRoute();
    return;
  }

  await handlePublicRoute(mode);
}

async function initRouteGuard() {
  const mode = document.body?.dataset?.routeGuard || "";

  try {
    await handleProtectedRoute(mode);
  } catch (error) {
    console.error("Route guard failed:", error);

    if (mode === "private") {
      clearUserSession?.();
      beginGuardRedirect("/login.html", {
        title: "Returning to login",
        subtitle: "Unable to verify your Firebase session."
      });
      return;
    }

    showAppReady({
      mode,
      error: true
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initRouteGuard, { once: true });
} else {
  initRouteGuard();
}
