import { protectRoute } from "./firebase.js";

let hasFinishedRouteGuard = false;

function clearAuthPending() {
  document.documentElement.classList.remove("auth-pending");
  document.body?.classList.remove("auth-pending");
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

function beginGuardRedirect(url, options = {}) {
  hasFinishedRouteGuard = true;

  if (window.EvaraLoader && typeof window.EvaraLoader.beginNavigationLoad === "function") {
    window.EvaraLoader.beginNavigationLoad({
      title: options.title || "Redirecting",
      subtitle: options.subtitle || "Taking you to the right page."
    });
  } else {
    document.body?.classList.add("app-loading");
    document.body?.classList.remove("app-ready");
  }

  requestAnimationFrame(() => {
    window.location.replace(url);
  });
}

function showAppReady(detail = {}) {
  if (hasFinishedRouteGuard) return;
  hasFinishedRouteGuard = true;

  clearAuthPending();
  dispatchSessionReady(detail);

  if (window.EvaraLoader && typeof window.EvaraLoader.markAppReady === "function") {
    window.EvaraLoader.markAppReady();
  } else {
    document.body?.classList.remove("app-loading");
    document.body?.classList.add("app-ready");
  }
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

async function handleProtectedRoute(mode) {
  const currentPath = window.location.pathname || "";
  const isLoginPage = currentPath.includes("/login.html");
  const isDashboardPage = currentPath.includes("/dashboard.html");

  if (mode === "private") {
    await protectRoute({
      requireAuth: true,
      redirectGuestTo: "/evaraos/login.html",
      redirectAuthedTo: "/evaraos/dashboard.html"
    });

    if (!hasLocalSession() && !isLoginPage) {
      beginGuardRedirect("/evaraos/login.html", {
        title: "Returning to login",
        subtitle: "Your session needs to be verified again."
      });
      return;
    }

    showAppReady({
      mode,
      authenticated: true
    });
    return;
  }

  if (mode === "auth") {
    await protectRoute({
      requireAuth: false,
      redirectGuestTo: "/evaraos/login.html",
      redirectAuthedTo: "/evaraos/dashboard.html"
    });

    if (hasLocalSession() && !isDashboardPage) {
      beginGuardRedirect("/evaraos/dashboard.html", {
        title: "Opening dashboard",
        subtitle: "Your session is already active."
      });
      return;
    }

    showAppReady({
      mode,
      authenticated: hasLocalSession()
    });
    return;
  }

  showAppReady({
    mode: mode || "public",
    authenticated: hasLocalSession()
  });
}

async function initRouteGuard() {
  const mode = document.body?.dataset?.routeGuard || "";

  try {
    await handleProtectedRoute(mode);
  } catch (error) {
    console.error("Route guard failed:", error);

    if (mode === "private" && !hasLocalSession()) {
      beginGuardRedirect("/evaraos/login.html", {
        title: "Returning to login",
        subtitle: "Unable to verify your session."
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