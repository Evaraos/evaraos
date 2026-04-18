// assets/js/route-guard.js

import { protectRoute } from "./firebase.js";

document.addEventListener("DOMContentLoaded", () => {
  const mode = document.body?.dataset?.routeGuard || "";

  if (mode === "private") {
    protectRoute({
      requireAuth: true,
      redirectGuestTo: "/evaraos/login.html",
      redirectAuthedTo: "/evaraos/dashboard.html"
    });
    return;
  }

  if (mode === "auth") {
    protectRoute({
      requireAuth: false,
      redirectGuestTo: "/evaraos/login.html",
      redirectAuthedTo: "/evaraos/dashboard.html"
    });
  }
});