// assets/js/route-guard.js

import { protectRoute } from "./firebase.js";

function clearAuthPending() {
  document.documentElement.classList.remove("auth-pending");
  document.body?.classList.remove("auth-pending");
}

document.addEventListener("DOMContentLoaded", () => {
  const mode = document.body?.dataset?.routeGuard || "";

  if (mode === "private") {
    protectRoute({
      requireAuth: true,
      redirectGuestTo: "/evaraos/login.html",
      redirectAuthedTo: "/evaraos/dashboard.html"
    });
    clearAuthPending();
    return;
  }

  if (mode === "auth") {
    protectRoute({
      requireAuth: false,
      redirectGuestTo: "/evaraos/login.html",
      redirectAuthedTo: "/evaraos/dashboard.html"
    });
    clearAuthPending();
    return;
  }

  clearAuthPending();
});