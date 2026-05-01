// assets/js/dashboard.js
// Compatibility entry for dashboard.html.
// The dashboard now reads dashboard_stats/global through dashboard-stats.js instead of scanning collections.

import "./dashboard-stats.js?v=1";

const ROUTES = {
  companies: "/companies.html?analytics=companies&from=dashboard",
  users: "/users.html?analytics=users&from=dashboard",
  leads: "/leads.html?analytics=leads&from=dashboard",
  jobs: "/jobs.html?analytics=jobs&from=dashboard",
  settings: "/settings.html?from=dashboard"
};

function routeTo(url) {
  if (window.EvaraLoader?.beginNavigationLoad) {
    window.EvaraLoader.beginNavigationLoad({
      title: "Opening analytics",
      subtitle: "Loading the selected Evaraos control page."
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

function bindDashboardCards() {
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
    .dashboard-click-card {
      cursor: pointer;
      position: relative;
      transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease, filter 180ms ease;
    }

    .dashboard-click-card::after {
      content: "Open →";
      position: absolute;
      right: 14px;
      top: 14px;
      opacity: 0;
      transform: translateY(-4px);
      transition: opacity 180ms ease, transform 180ms ease;
      border-radius: 999px;
      padding: 6px 9px;
      font-size: 0.68rem;
      font-weight: 900;
      letter-spacing: -0.01em;
      color: rgba(20, 25, 23, 0.76);
      background: rgba(255,255,255,0.72);
      border: 1px solid rgba(255,255,255,0.84);
      pointer-events: none;
    }

    html[data-theme="dark"] .dashboard-click-card::after,
    html[data-theme="galaxy"] .dashboard-click-card::after,
    html[data-theme$="-dark"] .dashboard-click-card::after {
      color: rgba(245,245,247,0.82);
      background: rgba(44,44,46,0.72);
      border-color: rgba(255,255,255,0.13);
    }

    .dashboard-click-card:hover,
    .dashboard-click-card:focus-visible {
      transform: translateY(-2px);
      filter: saturate(1.05);
      outline: none;
    }

    .dashboard-click-card:hover::after,
    .dashboard-click-card:focus-visible::after {
      opacity: 1;
      transform: translateY(0);
    }

    .dashboard-stat-card.dashboard-click-card {
      overflow: hidden;
    }

    @media (max-width: 760px) {
      .dashboard-click-card::after {
        opacity: 1;
        transform: none;
        top: 10px;
        right: 10px;
      }
    }
  `;
  document.head.appendChild(style);
}

function initDashboardInteractions() {
  injectDashboardClickStyles();
  bindDashboardCards();

  const observer = new MutationObserver(bindDashboardCards);
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDashboardInteractions, { once: true });
} else {
  initDashboardInteractions();
}

window.EvaraDashboard = {
  mode: "stats-document",
  source: "dashboard_stats/global",
  routes: ROUTES,
  bindDashboardCards
};
