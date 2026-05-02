import {
  protectRoute,
  auth,
  onAuthStateChanged,
  clearUserSession
} from "./firebase.js";

const ROUTES = {
  login: "/login.html",
  dashboard: "/dashboard.html"
};

let hasFinishedRouteGuard = false;
let hasPaintedOptimistically = false;

function emit(name, detail = {}) {
  window.dispatchEvent(
    new CustomEvent(name, {
      detail: {
        at: Date.now(),
        ...detail
      }
    })
  );
}

function setReadyState() {
  document.documentElement.classList.remove("auth-pending");
  document.body?.classList.remove("auth-pending", "app-loading");
  document.body?.classList.add("app-ready");
}

function markLoaderReady() {
  if (window.EvaraLoader?.markAppReady) {
    window.EvaraLoader.markAppReady();
  }
}

function safeMarkReady(detail = {}) {
  setReadyState();
  markLoaderReady();
  emit("evara:session-ready", detail);
}

function paintOptimistically(detail = {}) {
  if (hasPaintedOptimistically) return;
  hasPaintedOptimistically = true;

  setReadyState();

  if (window.EvaraLoader?.hideAllLoaders) {
    window.EvaraLoader.hideAllLoaders(true);
  }

  emit("evara:optimistic-paint", detail);
}

function beginGuardRedirect(url, options = {}) {
  hasFinishedRouteGuard = true;
  setReadyState();

  if (window.EvaraLoader?.beginNavigationLoad) {
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
    const raw = localStorage.getItem("evaraos-user") || sessionStorage.getItem("evaraos-user");
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
      unsubscribe?.();
      resolve(user || null);
    });
  });
}

async function handlePrivateRoute() {
  const verifiedUser = await waitForVerifiedFirebaseUser();

  if (!verifiedUser) {
    clearUserSession?.();
    beginGuardRedirect(ROUTES.login, {
      title: "Returning to login",
      subtitle: "Please sign in to continue."
    });
    return;
  }

  await protectRoute({
    requireAuth: true,
    redirectGuestTo: ROUTES.login,
    redirectAuthedTo: ROUTES.dashboard
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
    beginGuardRedirect(ROUTES.dashboard, {
      title: "Opening dashboard",
      subtitle: "Your Firebase session is active."
    });
    return;
  }

  clearUserSession?.();

  const detail = {
    mode: "auth",
    authenticated: false,
    source: "verified-guest"
  };

  paintOptimistically(detail);
  showAppReady(detail);
}

function handlePublicRoute(mode) {
  const detail = {
    mode: mode || "public",
    authenticated: hasLocalSession(),
    source: "public-fast-paint"
  };

  paintOptimistically(detail);
  showAppReady(detail);
}

async function handleProtectedRoute(mode) {
  if (mode === "private") {
    await handlePrivateRoute();
    return;
  }

  if (mode === "auth") {
    await handleAuthRoute();
    return;
  }

  handlePublicRoute(mode);
}

async function initRouteGuard() {
  const mode = document.body?.dataset?.routeGuard || "";

  try {
    await handleProtectedRoute(mode);
  } catch (error) {
    console.error("Route guard failed:", error);

    if (mode === "private") {
      clearUserSession?.();
      beginGuardRedirect(ROUTES.login, {
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
