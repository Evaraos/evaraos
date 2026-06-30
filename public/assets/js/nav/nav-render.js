import { getMount, buildHref, getVisibleLinks, isCurrentPage } from "./nav-utils.js";
import { APP_CATEGORIES, appsByCategory } from "../navigation/app-registry.js";
import { iconSvg, iconNameForApp, iconNameForCategory } from "../ui/icons.js";

const NAV_RENDER_BUILD = "nav-v21-adaptive-glass-menu";
const CATEGORY_ORDER = [APP_CATEGORIES.operations, APP_CATEGORIES.organizations, APP_CATEGORIES.finance, APP_CATEGORIES.customer, APP_CATEGORIES.intelligence, APP_CATEGORIES.system];
const CATEGORY_TITLES = { operations: "Operations", organizations: "Organizations", finance: "Finance", customer: "Customer", intelligence: "Executive", system: "System" };

function clean(value = "") {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function activeAttrs(route = "") {
  return isCurrentPage(route) ? ' aria-current="page" data-active="true"' : "";
}

function normalizeRole(role = "customer") {
  const value = String(role || "customer").toLowerCase();
  if (["owner", "super_admin"].includes(value)) return "owner";
  if (["admin", "manager", "operations_manager"].includes(value)) return "admin";
  if (["organization", "organization_owner", "office_owner", "branch_owner"].includes(value)) return "organization";
  if (["vendor", "lead_vendor", "service_vendor", "management_program"].includes(value)) return "vendor";
  if (["hr", "hr_manager"].includes(value)) return "hr";
  if (["staff", "sales", "sales_rep", "technician", "cleaner", "field_staff", "crew_lead"].includes(value)) return "staff";
  return "customer";
}

function storedUser() {
  try {
    return JSON.parse(localStorage.getItem("evaraos-user") || sessionStorage.getItem("evaraos-user") || "null") || {};
  } catch {
    return {};
  }
}

function profileData() {
  const user = storedUser();
  const name = String(user.displayName || user.name || user.username || user.email || "Evaraos User");
  const image = String(user.photoURL || user.photoUrl || user.avatarUrl || user.avatar || user.profilePhoto || user.profilePhotoUrl || "");
  return { name, image, initial: (name.trim().charAt(0) || "E").toUpperCase() };
}

function linkTile(label, page, icon, active = true) {
  const href = buildHref(page);
  return `<a class="eva-menu-control" data-glass="control" href="${href}" data-menu-link="${href}"${active ? activeAttrs(href) : ""}><span class="eva-menu-icon">${iconSvg(icon)}</span><strong>${clean(label)}</strong></a>`;
}

function accountLinks(authed) {
  if (!authed) {
    return `<section class="eva-menu-top-block" data-glass="card"><div class="eva-top-block-head"><span class="eva-top-block-icon">${iconSvg("account")}</span><div><p>ACCESS</p><h3>Enter Evaraos</h3></div></div><div class="eva-account-strip eva-access-strip">${[["Login", "login.html", "login"], ["Signup", "signup.html", "signup"], ["Apply", "staff_application.html", "applications"]].map(item => linkTile(...item, false)).join("")}</div></section>`;
  }

  return `<section class="eva-menu-top-block" data-glass="card"><div class="eva-top-block-head"><span class="eva-top-block-icon">${iconSvg("account")}</span><div><p>ACCOUNT</p><h3>Your Evaraos controls</h3></div></div><div class="eva-account-strip">${[["Account", "settings/account.html", "account"], ["Appearance", "settings/appearance.html", "appearance"], ["Alerts", "notifications_center.html", "bell"], ["Workspace", "settings/workspace.html", "workspace"]].map(item => linkTile(...item)).join("")}<a class="eva-menu-control eva-logout-control" data-glass="control" href="#logout" id="evaLogoutBtn" data-action="logout"><span class="eva-menu-icon">${iconSvg("logout")}</span><strong>Logout</strong></a></div></section>`;
}

function appSections(role) {
  const groups = appsByCategory(normalizeRole(role));
  return CATEGORY_ORDER.map(category => {
    const apps = groups[category] || [];
    if (!apps.length) return "";
    return `<section class="eva-app-section" data-glass="card"><div class="eva-app-section-head"><span>${iconSvg(iconNameForCategory(category))}</span><strong>${clean(CATEGORY_TITLES[category] || category)}</strong><small>${apps.length}</small></div><div class="eva-app-list">${apps.map(app => {
      const href = buildHref(app.route);
      return `<a class="eva-app-link" data-glass="control" href="${href}" data-menu-link="${href}"${activeAttrs(href)}><span>${iconSvg(iconNameForApp(app.id))}</span><strong>${clean(app.title)}</strong><small>${iconSvg("arrowRight")}</small></a>`;
    }).join("")}</div></section>`;
  }).join("");
}

function aiPrompt(authed) {
  const href = buildHref("ai.html");
  return `<div class="eva-menu-search-bottom" data-glass="card"><div class="eva-ai-prompt-head"><span class="eva-ai-orb">${iconSvg("ai")}</span><div><strong>Evaraos AI</strong><small>Search or open the assistant.</small></div><a class="eva-ai-launch-arrow" data-glass="control" href="${href}" data-menu-link="${href}" aria-label="Open Evaraos AI">${iconSvg("arrowRight")}</a></div><form class="eva-search-shell" data-glass="control" id="evaAiPromptForm"><span class="eva-search-icon">${iconSvg("search")}</span><input id="evaSearchInput" type="search" autocomplete="off" placeholder="${authed ? "Search apps, pages, and tools" : "Search access and onboarding"}"/><button class="eva-ai-send-btn" id="evaAiSendBtn" type="submit" aria-label="Search Evaraos">${iconSvg("arrowUp")}</button></form><div id="evaSearchResults" class="eva-search-results" aria-live="polite"></div></div>`;
}

export function renderNav() {
  const mount = getMount();
  if (!mount) return false;

  const groups = getVisibleLinks();
  const profile = profileData();
  const role = normalizeRole(groups.role);
  const avatar = profile.image ? `<img src="${clean(profile.image)}" alt="${clean(profile.name)}" />` : `<span>${clean(profile.initial)}</span>`;

  mount.innerHTML = `<div class="eva-nav-layer" data-render-build="${NAV_RENDER_BUILD}"><header class="eva-nav-shell is-visible" id="evaNavShell"><div class="eva-nav-pill" id="evaNavPill"><div class="eva-menu-zone" id="evaMenuZone"><button class="eva-profile-trigger" data-glass="control" type="button" id="evaMenuBtn" aria-expanded="false" aria-label="Open Evaraos menu">${avatar}</button></div><button class="eva-top-alert" data-glass="control" id="globalNotificationsBell" type="button" aria-expanded="false" aria-label="Open notifications">${iconSvg("bell")}<span id="globalNotificationsCount" class="eva-alert-count" hidden>0</span></button></div></header><div class="eva-backdrop" id="evaBackdrop"></div><aside class="eva-menu-panel" data-glass="card" id="evaMenuPanel" aria-label="Evaraos Liquid Glass menu"><div class="eva-drawer-profile"><div class="eva-drawer-avatar">${avatar}</div><div><strong>${clean(profile.name)}</strong><span>${clean(role)} · Adaptive Glass</span></div><button type="button" id="evaMenuCloseBtn" aria-label="Close menu">${iconSvg("close")}</button></div><nav class="eva-menu-apps" id="evaLinks" data-nav-role="${clean(role)}">${accountLinks(groups.authed)}${groups.authed ? appSections(groups.role) : ""}</nav>${aiPrompt(groups.authed)}</aside></div>`;

  requestAnimationFrame(() => window.EvaraTheme?.refreshAdaptiveGlass?.());
  return true;
}
