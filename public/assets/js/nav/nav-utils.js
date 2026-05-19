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
  const normalized = String(page || "index.html").replace(/^\//, "");
  return `/${normalized}`;
}

export function normalizePage(path) {
  return String(path || "").split("/").pop() || "index.html";
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
  const privatePage = mode === "private" || [
    "/dashboard.html",
    "/customer_dashboard.html",
    "/companies.html",
    "/users.html",
    "/leads.html",
    "/jobs.html",
    "/qa.html",
    "/settings.html",
    "/applications.html",
    "/org.html"
  ].some((page) => path.includes(page)) || path.includes("/settings/");

  const authResolving = document.documentElement.classList.contains("auth-pending") ||
    document.body?.classList.contains("auth-pending") ||
    document.body?.classList.contains("app-loading");

  return privatePage && authResolving;
}

export function isAuthenticated() {
  const user = getStoredUser();
  if (user && (user.uid || user.email)) return true;
  return isPrivateRoutePending();
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
  return docTheme === "dark" ? "dark" : "light";
}

export function setTheme(theme) {
  const safe = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", safe);
  document.documentElement.style.colorScheme = safe;
  syncThemeLabel();
}

export function syncThemeLabel() {
  const mode = getAppearanceTheme();
  const text = mode === "light" ? "Light mode" : "Dark mode";
  const icon = mode === "light" ? "☀" : "☾";

  document.querySelectorAll("[data-theme-label]").forEach((node) => {
    const labelNode = node.querySelector?.("[data-theme-text]");
    const iconNode = node.querySelector?.(".eva-theme-nav-icon");

    if (labelNode) labelNode.textContent = text;
    else if (!node.children.length) node.textContent = text;

    if (iconNode) iconNode.textContent = icon;

    node.setAttribute("aria-label", `Switch theme. Current: ${text}`);
    node.dataset.themeMode = mode;
  });
}

export function forcePageVisible() {
  document.documentElement.classList.remove("auth-pending", "boot-pending");
  document.body?.classList.remove("auth-pending", "app-loading");
  document.body?.classList.add("app-ready");
}

export function getVisibleLinks() {
  return {
    authed: isAuthenticated(),
    role: getRole(),
    displayName: getDisplayName()
  };
}

export function navHaptic(ms = 8) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(ms);
  } catch {}
}

export function getMenuZone() { return document.getElementById("evaMenuZone"); }
export function getMenuBtn() { return document.getElementById("evaMenuBtn"); }
export function getMenuPanel() { return document.getElementById("evaMenuPanel"); }
export function getNavShell() { return document.getElementById("evaNavShell"); }
export function getBrandBlock() { return document.getElementById("evaBrandBlock"); }
export function getNavPill() { return document.getElementById("evaNavPill"); }
export function getQuickBubbles() { return null; }
