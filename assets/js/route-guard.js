// assets/js/route-guard.js

import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const AUTH_PAGES = ["/login.html", "/signup.html", "/reset.html"];
const PRIVATE_DEFAULT_REDIRECT = "/evaraos/dashboard.html";
const GUEST_REDIRECT = "/evaraos/login.html";

function normalizePath(pathname = "") {
  const safe = String(pathname || "").trim();
  return safe.endsWith("/") ? `${safe}index.html` : safe;
}

function isAuthPage(pathname = window.location.pathname) {
  const path = normalizePath(pathname);
  return AUTH_PAGES.some((page) => path.endsWith(page));
}

function disablePrivatePageCache() {
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      window.location.reload();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      // forces auth refresh path on re-entry
      auth.currentUser;
    }
  });
}

function secureRedirect(path) {
  window.location.replace(path);
}

function protectPrivatePage() {
  disablePrivatePageCache();

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      secureRedirect(GUEST_REDIRECT);
    }
  });
}

function protectAuthPage() {
  disablePrivatePageCache();

  onAuthStateChanged(auth, (user) => {
    if (user) {
      secureRedirect(PRIVATE_DEFAULT_REDIRECT);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const mode = document.body?.dataset?.routeGuard || "";

  if (mode === "private") {
    protectPrivatePage();
    return;
  }

  if (mode === "auth") {
    protectAuthPage();
  }
});