import { NAV_PAGES } from "./nav-config.js";

export function getMount() {
  return document.getElementById("universalNavRoot") || document.getElementById("universalNav");
}

export function getBasePath() {
  const path = window.location.pathname || "/";
  const segments = path.split("/").filter(Boolean);
  const last = segments[segments.length - 1] || "";
  const isFile = /\.[a-z0-9]+$/i.test(last);

  if (!segments.length || isFile) return "";
  return `/${segments.join("/")}`;
}

export function buildHref(page) {
  const base = getBasePath();
  return `${base}/${page}`;
}

export function normalizePage(path) {
  return path.split("/").pop() || "index.html";
}

export function isCurrentPage(path) {
  const current = normalizePage(window.location.pathname.replace(/\/+$/, ""));
  const target = normalizePage(path);
  return current === target || (current === "" && target === "index.html");
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem("evaraos-user") || sessionStorage.getItem("evaraos-user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isPrivateRoutePending() {
  const mode = document.body?.dataset?.routeGuard || "";
  const path = window.location.pathname || "";
  const privatePage = mode === "private" || path.includes("/dashboard.html") || path.includes("/companies.html") || path.includes("/users.html") || path.includes("/leads.html") || path.includes("/jobs.html") || path.includes("/qa.html") || path.includes("/settings.html") || path.includes("/settings/");
  const authResolving = document.documentElement.classList.contains("auth-pending") || document.body?.classList.contains("auth-pending") || document.body?.classList.contains("app-loading");
  return privatePage && authResolving;
}

export function isAuthenticated() {
  const user = getStoredUser();
  if (user && (user.uid || user.email)) return true;
  if (isPrivateRoutePending()) return true;
  return false;
}

export function getRole() {
  const user = getStoredUser();
  if (user) return String(user.role || "guest").toLowerCase();
  if (isPrivateRoutePending()) return "owner";
  return "guest";
}

export function getDisplayName() {
  const user = getStoredUser();
  if (!user) return "Profile";
  return user.displayName || user.fullName || user.username || user.email || "Profile";
}

export function getAppearanceTheme() {
  try {
    const raw = localStorage.getItem("evaraos-appearance");
    if (raw) {
      const appearance = JSON.parse(raw);
      if (appearance.mode === "light") return "light";
      if (appearance.mode === "dark") return "dark";
      if (appearance.mode === "custom") return appearance.baseFamily === "light" ? "light" : "dark";
    }
  } catch {}

  const docTheme = document.documentElement.getAttribute("data-theme");
  return docTheme === "light" ? "light" : "dark";
}

export function setTheme(theme) {
  const safe = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", safe);
  syncThemeLabel();
}

export function syncThemeLabel() {
  const label = document.querySelector("[data-theme-label]");
  if (!label) return;
  label.textContent = getAppearanceTheme() === "light" ? "Light mode" : "Dark mode";
}

export function forcePageVisible() {
  document.documentElement.classList.remove("auth-pending", "boot-pending");
  document.body?.classList.remove("auth-pending", "app-loading");
  document.body?.classList.add("app-ready");
}

export function getVisibleLinks() {
  const role = getRole();
  const authed = isAuthenticated();

  const main = authed ? [...NAV_PAGES.common, ...NAV_PAGES.authedMain, ...(role === "owner" ? NAV_PAGES.ownerOnly : [])] : [...NAV_PAGES.common, ...NAV_PAGES.guestMain];
  const quick = authed ? [
    { page: "dashboard.html", label: "Dashboard", icon: "dashboard", bubble: "dashboard" },
    { page: "settings.html", label: "Settings", icon: "settings", bubble: "settings" },
    { page: "index.html", label: "Home", icon: "home", bubble: "home" }
  ] : [
    { page: "login.html", label: "Login", icon: "login", bubble: "login" },
    { page: "signup.html", label: "Sign Up", icon: "signup", bubble: "signup" },
    { page: "index.html", label: "Home", icon: "home", bubble: "home" }
  ];

  return { main, quick, authed, role, displayName: getDisplayName() };
}

export function navHaptic(ms = 8) {
  try { if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(ms); } catch {}
}

export function getMenuZone() { return document.getElementById("evaMenuZone"); }
export function getMenuBtn() { return document.getElementById("evaMenuBtn"); }
export function getMenuPanel() { return document.getElementById("evaMenuPanel"); }
export function getNavShell() { return document.getElementById("evaNavShell"); }
export function getBrandBlock() { return document.getElementById("evaBrandBlock"); }
export function getNavPill() { return document.getElementById("evaNavPill"); }
export function getQuickBubbles() { return document.getElementById("evaQuickBubbles"); }
