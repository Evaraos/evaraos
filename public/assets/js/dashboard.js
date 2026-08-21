// assets/js/dashboard.js
// Compatibility entry for dashboard.html.
// Owner dashboard stays the mega command center; widget intelligence mounts as an additive layer.

import "./dashboard-stats.js?v=1";
import { getSavedUserProfile, normalizeRole } from "./firebase.js";
import { autoMountDashboardWidgets } from "./dashboard-widget-ui.js";

const ROUTES = {
  companies: "/companies.html?analytics=companies&from=dashboard",
  users: "/users.html?analytics=users&from=dashboard",
  leads: "/leads.html?analytics=leads&from=dashboard",
  jobs: "/jobs.html?analytics=jobs&from=dashboard",
  billing: "/customer_dashboard.html?from=dashboard",
  messages: "/customer-messaging.html?from=dashboard",
  history: "/customer-service-history.html?from=dashboard",
  settings: "/settings.html?from=dashboard",
  finance: "/enterprise-finance-dashboard.html?from=dashboard",
  payouts: "/marketplace-payouts.html?from=dashboard",
  visibility: "/operations-visibility.html?from=dashboard"
};

const LEADERSHIP_ROLES = new Set(["owner", "super_admin", "admin", "manager", "operations_manager", "operations_coordinator"]);
const STAFF_ROLES = new Set(["technician", "cleaner", "staff", "field_staff", "crew_lead", "sales", "sales_rep", "customer_support", "quality_control"]);

let sidebarSectionObserver = null;
let dashboardBindFrame = 0;
let dashboardLocationStateReady = false;
let sidebarHashLock = "";

function roleBucket() {
  const profile = getSavedUserProfile() || {};
  const role = normalizeRole(profile.role || "customer");
  if (LEADERSHIP_ROLES.has(role)) return "leadership";
  if (STAFF_ROLES.has(role)) return "staff";
  return "customer";
}

function routeTo(url) {
  if (window.EvaraLoader?.beginNavigationLoad) {
    window.EvaraLoader.beginNavigationLoad({
      title: "Opening Evaraos",
      subtitle: "Loading the selected control page."
    });
  }
  requestAnimationFrame(() => window.location.assign(url));
}

function makeClickable(el, url, label) {
  if (!el || el.dataset.dashboardClickReady === "true") return;
  el.dataset.dashboardClickReady = "true";
  el.classList.add("dashboard-click-card");
  el.setAttribute("role", "button");
  el.setAttribute("tabindex", "0");
  el.setAttribute("aria-label", label || "Open analytics page");

  el.addEventListener("click", (event) => {
    const interactive = event.target.closest("a, button, input, select, textarea");
    if (interactive) return;
    routeTo(url);
  });

  el.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    routeTo(url);
  });
}

function setText(id, text) {
  const node = document.getElementById(id);
  if (node) node.textContent = text;
}

function hideSection(id) {
  const node = document.getElementById(id);
  if (node) node.hidden = true;
}

function showSection(id) {
  const node = document.getElementById(id);
  if (node) node.hidden = false;
}

function updateHero(bucket) {
  if (bucket === "leadership") {
    setText("dashboardOverviewTitle", "Executive Control");
    setText("heroStatusTitle", "Mega dashboard ready");
    setText("heroStatusText", "Owner command center is active. Live widget intelligence is mounted below.");
  }
}

function updateHeroActions(bucket) {
  const actions = document.querySelector(".dashboard-hero-actions");
  if (!actions) return;

  if (bucket === "staff") {
    actions.innerHTML = `
      <a href="${ROUTES.jobs}" class="btn btn-theme-primary beam-target">Open Jobs</a>
      <a href="${ROUTES.leads}" class="btn btn-theme-secondary beam-target">Open Leads</a>
      <a href="${ROUTES.messages}" class="btn btn-theme-secondary beam-target">Messages</a>
    `;
    return;
  }

  if (bucket === "customer") {
    routeTo(ROUTES.billing);
    return;
  }

  actions.innerHTML = `
    <a href="${ROUTES.companies}" class="btn btn-theme-primary beam-target">Manage Companies</a>
    <a href="${ROUTES.visibility}" class="btn btn-theme-secondary beam-target">Operations Visibility</a>
    <a href="${ROUTES.finance}" class="btn btn-theme-secondary beam-target">Finance</a>
  `;
}

function navIcon(name) {
  return `<span class="dashboard-nav-icon" data-evara-icon="${name}" aria-hidden="true"></span>`;
}

function updateSidebar(bucket) {
  const nav = document.querySelector(".dashboard-sidebar-nav");
  const footLink = document.querySelector(".dashboard-sidebar-foot .btn");
  if (!nav) return;

  if (bucket === "staff") {
    const dynamicLinks = [...nav.querySelectorAll(".dashboard-nav-link[data-dashboard-dynamic-nav='true']")];
    nav.innerHTML = `
      <a href="#overviewSection" class="dashboard-nav-link eva-subnav__link active aurora-card beam-target" aria-current="location">${navIcon("dashboard")}<span>Overview</span></a>
      <a href="#kpiSection" class="dashboard-nav-link eva-subnav__link aurora-card beam-target">${navIcon("schedule")}<span>Today</span></a>
      <a href="#pipelineSection" class="dashboard-nav-link eva-subnav__link aurora-card beam-target">${navIcon("leads")}<span>Leads</span></a>
      <a href="#operationsSection" class="dashboard-nav-link eva-subnav__link aurora-card beam-target">${navIcon("jobs")}<span>Jobs</span></a>
      <a href="#activitySection" class="dashboard-nav-link eva-subnav__link aurora-card beam-target">${navIcon("history")}<span>Activity</span></a>
    `;
    const activityLink = nav.querySelector("a[href='#activitySection']");
    dynamicLinks.forEach((link) => {
      link.classList.add("eva-subnav__link");
      if (activityLink) nav.insertBefore(link, activityLink);
      else nav.appendChild(link);
    });
    if (footLink) {
      footLink.href = ROUTES.jobs;
      footLink.textContent = "Open Jobs";
    }
  }
}

function relabelSections(bucket) {
  if (bucket === "staff") {
    hideSection("companiesSection");
    hideSection("usersSection");
    showSection("pipelineSection");
    showSection("operationsSection");
    document.querySelector("#kpiSection h2") && (document.querySelector("#kpiSection h2").textContent = "Field Operations Board");
    document.querySelector("#pipelineSection h2") && (document.querySelector("#pipelineSection h2").textContent = "Lead Assignments");
    document.querySelector("#operationsSection h2") && (document.querySelector("#operationsSection h2").textContent = "Assigned Jobs");
    return;
  }

  showSection("companiesSection");
  showSection("usersSection");
}

function keepActiveLinkVisible(nav, link) {
  if (!nav || !link || nav.scrollWidth <= nav.clientWidth) return;
  const left = link.offsetLeft - Math.max(8, (nav.clientWidth - link.offsetWidth) / 2);
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  nav.scrollTo({ left: Math.max(0, left), behavior: reducedMotion ? "auto" : "smooth" });
}

function getSidebarDestinationLinks(nav) {
  if (!nav) return [];
  return [...nav.querySelectorAll(".dashboard-nav-link.eva-subnav__link[href^='#']")];
}

function getHashDestinationLink(links) {
  const hash = window.location.hash;
  return hash ? links.find((link) => link.getAttribute("href") === hash) || null : null;
}

function lockSidebarHashDestination(link) {
  sidebarHashLock = link?.getAttribute("href") || "";
}

function setActiveSidebarLink(link) {
  const nav = document.querySelector(".dashboard-sidebar-nav");
  const links = getSidebarDestinationLinks(nav);
  if (!nav || !links.includes(link)) return;

  links.forEach((item) => {
    const active = item === link;
    item.classList.toggle("active", active);
    if (active) item.setAttribute("aria-current", "location");
    else item.removeAttribute("aria-current");
  });

  keepActiveLinkVisible(nav, link);
}

function syncSidebarLocationState() {
  const nav = document.querySelector(".dashboard-sidebar-nav");
  const link = getHashDestinationLink(getSidebarDestinationLinks(nav));
  if (link) {
    lockSidebarHashDestination(link);
    setActiveSidebarLink(link);
  }
}

function bindSidebarLocationState() {
  if (dashboardLocationStateReady) return;
  dashboardLocationStateReady = true;
  window.addEventListener("hashchange", syncSidebarLocationState);
  window.addEventListener("popstate", syncSidebarLocationState);
  window.addEventListener("scrollend", () => {
    sidebarHashLock = "";
  }, { passive: true });
}

function bindSidebarNavigation() {
  const nav = document.querySelector(".dashboard-sidebar-nav");
  if (!nav) return;

  bindSidebarLocationState();

  if (nav.dataset.dashboardNavReady !== "true") {
    nav.dataset.dashboardNavReady = "true";
    nav.addEventListener("click", (event) => {
      const link = event.target.closest(".dashboard-nav-link[href^='#']");
      if (link) {
        lockSidebarHashDestination(link);
        setActiveSidebarLink(link);
      }
    });
  }

  const links = getSidebarDestinationLinks(nav);
  const pairs = links
    .map((link) => ({ link, section: document.querySelector(link.getAttribute("href")) }))
    .filter(({ section }) => section && !section.hidden);

  const hashDestination = getHashDestinationLink(links);
  const selected = hashDestination || links.find((link) => link.getAttribute("aria-current") === "location") || links[0];
  if (hashDestination) lockSidebarHashDestination(hashDestination);
  if (selected) setActiveSidebarLink(selected);

  sidebarSectionObserver?.disconnect();
  if (!("IntersectionObserver" in window) || !pairs.length) return;

  sidebarSectionObserver = new IntersectionObserver((entries) => {
    const lockedLink = sidebarHashLock && links.find((link) => link.getAttribute("href") === sidebarHashLock);
    if (lockedLink) {
      const lockedSection = pairs.find(({ link }) => link === lockedLink)?.section;
      if (!entries.some((entry) => entry.target === lockedSection && entry.isIntersecting)) return;
      setActiveSidebarLink(lockedLink);
      return;
    }

    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;

    const pair = pairs.find(({ section }) => section === visible.target);
    if (pair) setActiveSidebarLink(pair.link);
  }, {
    rootMargin: "-18% 0px -66% 0px",
    threshold: [0.05, 0.2, 0.45]
  });

  pairs.forEach(({ section }) => sidebarSectionObserver.observe(section));
}

function ensureWidgetMount() {
  let mount = document.getElementById("dashboardWidgetMount");
  if (mount) return mount;

  const main = document.querySelector(".dashboard-main");
  if (!main) return null;

  mount = document.createElement("section");
  mount.id = "dashboardWidgetMount";
  mount.className = "dashboard-widget-mount";
  mount.setAttribute("aria-label", "Executive live intelligence widgets");

  const hero = document.getElementById("overviewSection");
  if (hero?.nextSibling) main.insertBefore(mount, hero.nextSibling);
  else main.appendChild(mount);

  return mount;
}

function mountExecutiveWidgets() {
  const bucket = roleBucket();
  if (bucket !== "leadership") return;

  const mount = ensureWidgetMount();
  if (!mount) return;

  autoMountDashboardWidgets({
    selector: "#dashboardWidgetMount",
    role: "owner",
    input: {
      alerts: { critical: 0, payroll: 0, promotion: 0 },
      health: { state: "stable" },
      dataByType: {
        ecosystem_health: { value: "Stable", subtitle: "Ecosystem intelligence is online." },
        live_revenue: { value: "$0", subtitle: "Live revenue stream ready for Firestore connection." },
        live_activity: { subtitle: "Live events will appear here as the activity feed connects." },
        ai_recommendations: { subtitle: "AI recommendations engine is ready." },
        organization_tree: { subtitle: "Organization, office, and vendor tree ready for live data." },
        operations_map: { subtitle: "Global operations map ready for GIS integration." }
      }
    }
  });
}

function bindDashboardCards() {
  const bucket = roleBucket();

  if (bucket === "staff") {
    makeClickable(document.getElementById("statLeads")?.closest(".dashboard-stat-card"), ROUTES.leads, "Open assigned leads");
    makeClickable(document.getElementById("statJobs")?.closest(".dashboard-stat-card"), ROUTES.jobs, "Open assigned jobs");
    return;
  }

  makeClickable(document.getElementById("statCompanies")?.closest(".dashboard-stat-card"), ROUTES.companies, "Open company analytics");
  makeClickable(document.getElementById("statUsers")?.closest(".dashboard-stat-card"), ROUTES.users, "Open user analytics");
  makeClickable(document.getElementById("statLeads")?.closest(".dashboard-stat-card"), ROUTES.leads, "Open lead analytics");
  makeClickable(document.getElementById("statJobs")?.closest(".dashboard-stat-card"), ROUTES.jobs, "Open job analytics");
}

function scheduleDashboardCardBinding() {
  if (dashboardBindFrame) return;
  dashboardBindFrame = requestAnimationFrame(() => {
    dashboardBindFrame = 0;
    bindDashboardCards();
  });
}

function applyRoleDashboard() {
  const bucket = roleBucket();
  document.body.classList.remove("dashboard-role-customer", "dashboard-role-staff", "dashboard-role-leadership");
  document.body.classList.add(`dashboard-role-${bucket}`);
  updateHero(bucket);
  updateHeroActions(bucket);
  updateSidebar(bucket);
  relabelSections(bucket);
  mountExecutiveWidgets();
  bindSidebarNavigation();
}

function initDashboardInteractions() {
  applyRoleDashboard();
  bindDashboardCards();

  window.addEventListener("evara:session-ready", () => {
    applyRoleDashboard();
    scheduleDashboardCardBinding();
  });

  const dashboardMain = document.querySelector(".dashboard-main");
  if (dashboardMain) {
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.addedNodes.length || mutation.removedNodes.length)) {
        scheduleDashboardCardBinding();
      }
    });
    observer.observe(dashboardMain, { childList: true, subtree: true });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDashboardInteractions, { once: true });
} else {
  initDashboardInteractions();
}

window.EvaraDashboard = {
  mode: "owner-mega-dashboard",
  source: "dashboard_stats/global",
  routes: ROUTES,
  bindDashboardCards,
  refreshSidebarNavigation: bindSidebarNavigation,
  applyRoleDashboard,
  mountExecutiveWidgets
};
