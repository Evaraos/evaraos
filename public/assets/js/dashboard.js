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

function updateSidebar(bucket) {
  const nav = document.querySelector(".dashboard-sidebar-nav");
  const footLink = document.querySelector(".dashboard-sidebar-foot .btn");
  if (!nav) return;

  if (bucket === "staff") {
    nav.innerHTML = `
      <a href="#overviewSection" class="dashboard-nav-link active aurora-card beam-target"><span class="dashboard-nav-icon">◉</span><span>Overview</span></a>
      <a href="#kpiSection" class="dashboard-nav-link aurora-card beam-target"><span class="dashboard-nav-icon">◎</span><span>Today</span></a>
      <a href="#pipelineSection" class="dashboard-nav-link aurora-card beam-target"><span class="dashboard-nav-icon">◒</span><span>Leads</span></a>
      <a href="#operationsSection" class="dashboard-nav-link aurora-card beam-target"><span class="dashboard-nav-icon">◈</span><span>Jobs</span></a>
      <a href="#activitySection" class="dashboard-nav-link aurora-card beam-target"><span class="dashboard-nav-icon">◐</span><span>Activity</span></a>
    `;
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
    makeClickable(document.getElementById("pipelineSection"), ROUTES.leads, "Open lead queue");
    makeClickable(document.getElementById("operationsSection"), ROUTES.jobs, "Open jobs");
    return;
  }

  makeClickable(document.getElementById("statCompanies")?.closest(".dashboard-stat-card"), ROUTES.companies, "Open company analytics");
  makeClickable(document.getElementById("statUsers")?.closest(".dashboard-stat-card"), ROUTES.users, "Open user analytics");
  makeClickable(document.getElementById("statLeads")?.closest(".dashboard-stat-card"), ROUTES.leads, "Open lead analytics");
  makeClickable(document.getElementById("statJobs")?.closest(".dashboard-stat-card"), ROUTES.jobs, "Open job analytics");

  makeClickable(document.getElementById("companiesSection"), ROUTES.companies, "Open company health analytics");
  makeClickable(document.getElementById("usersSection"), ROUTES.users, "Open user role analytics");
  makeClickable(document.getElementById("pipelineSection"), ROUTES.leads, "Open lead pipeline analytics");
  makeClickable(document.getElementById("operationsSection"), ROUTES.jobs, "Open operations analytics");
}

function injectDashboardClickStyles() {
  if (document.getElementById("dashboardClickStyles")) return;
  const style = document.createElement("style");
  style.id = "dashboardClickStyles";
  style.textContent = `
    .dashboard-click-card { cursor: pointer; position: relative; transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease, filter 180ms ease; }
    .dashboard-click-card::after { content: "Open →"; position: absolute; right: 14px; top: 14px; opacity: 0; transform: translateY(-4px); transition: opacity 180ms ease, transform 180ms ease; border-radius: 999px; padding: 6px 9px; font-size: 0.68rem; font-weight: 900; letter-spacing: -0.01em; color: rgba(20,25,23,0.76); background: rgba(255,255,255,0.72); border: 1px solid rgba(255,255,255,0.84); pointer-events: none; }
    html[data-theme="dark"] .dashboard-click-card::after { color: rgba(245,245,247,0.82); background: rgba(44,44,46,0.72); border-color: rgba(255,255,255,0.13); }
    .dashboard-click-card:hover, .dashboard-click-card:focus-visible { transform: translateY(-2px); filter: saturate(1.05); outline: none; }
    .dashboard-click-card:hover::after, .dashboard-click-card:focus-visible::after { opacity: 1; transform: translateY(0); }
    .dashboard-stat-card.dashboard-click-card { overflow: hidden; }
    [hidden] { display: none !important; }
    .dashboard-widget-mount { scroll-margin-top: 90px; }
    @media (max-width: 760px) { .dashboard-click-card::after { opacity: 1; transform: none; top: 10px; right: 10px; } }
  `;
  document.head.appendChild(style);
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
}

function initDashboardInteractions() {
  injectDashboardClickStyles();
  applyRoleDashboard();
  bindDashboardCards();

  window.addEventListener("evara:session-ready", () => {
    applyRoleDashboard();
    bindDashboardCards();
  });

  const observer = new MutationObserver(bindDashboardCards);
  observer.observe(document.body, { childList: true, subtree: true });
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
  applyRoleDashboard,
  mountExecutiveWidgets
};
