// assets/js/route-guard.js

import { protectRoute } from "./firebase.js";

function clearAuthPending() {
  document.documentElement.classList.remove("auth-pending");
  document.body?.classList.remove("auth-pending");
}

function showAppReady() {
  document.body?.classList.remove("app-loading");
  document.body?.classList.add("app-ready");
}

async function handleProtectedRoute(mode) {
  if (mode === "private") {
    await protectRoute({
      requireAuth: true,
      redirectGuestTo: "/evaraos/login.html",
      redirectAuthedTo: "/evaraos/dashboard.html"
    });

    clearAuthPending();
    showAppReady();
    return;
  }

  if (mode === "auth") {
    await protectRoute({
      requireAuth: false,
      redirectGuestTo: "/evaraos/login.html",
      redirectAuthedTo: "/evaraos/dashboard.html"
    });

    clearAuthPending();
    showAppReady();
    return;
  }

  clearAuthPending();
  showAppReady();
}

async function initRouteGuard() {
  const mode = document.body?.dataset?.routeGuard || "";

  try {
    await handleProtectedRoute(mode);
  } catch (error) {
    console.error("Route guard failed:", error);
    clearAuthPending();
    showAppReady();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initRouteGuard);
} else {
  initRouteGuard();
}