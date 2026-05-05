import {
  db,
  doc,
  getDoc,
  onSnapshot
} from "./firebase.js";

const statCompanies = document.getElementById("statCompanies");
const statUsers = document.getElementById("statUsers");
const statLeads = document.getElementById("statLeads");
const statJobs = document.getElementById("statJobs");
const statCompaniesMeta = document.getElementById("statCompaniesMeta");
const statUsersMeta = document.getElementById("statUsersMeta");
const statLeadsMeta = document.getElementById("statLeadsMeta");
const statJobsMeta = document.getElementById("statJobsMeta");
const heroStatusTitle = document.getElementById("heroStatusTitle");
const heroStatusText = document.getElementById("heroStatusText");
const companiesList = document.getElementById("companiesList");
const usersRoleGrid = document.getElementById("usersRoleGrid");
const leadFlowStack = document.getElementById("leadFlowStack");
const jobsList = document.getElementById("jobsList");
const activityFeed = document.getElementById("activityFeed");

const CACHE_KEY = "evaraos-dashboard-stats-cache-v1";

function numberValue(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function writeText(el, value) {
  if (el) el.textContent = String(value);
}

function saveCache(stats) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ stats, cachedAt: Date.now() }));
  } catch {}
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw).stats || null : null;
  } catch {
    return null;
  }
}

function statusCard(title, message, pill = "Stats") {
  return `
    <article class="dashboard-list-item glass-card">
      <div>
        <strong>${title}</strong>
        <span>${message}</span>
      </div>
      <span class="dashboard-status-pill working">${pill}</span>
    </article>
  `;
}

function percent(count, total) {
  if (!total) return 6;
  return Math.max(6, Math.round((count / total) * 100));
}

function renderLeadFlow(stats = {}) {
  if (!leadFlowStack) return;
  const leads = stats.leads || {};
  const statuses = leads.statuses || {};
  const total = numberValue(leads.total);
  const rows = [
    ["New", statuses.new || 0],
    ["Open", statuses.open || 0],
    ["Contacted", statuses.contacted || 0],
    ["Qualified", statuses.qualified || 0],
    ["Proposal", statuses.proposal || 0],
    ["Scheduled", statuses.scheduled || 0],
    ["Won", statuses.won || 0],
    ["Lost", statuses.lost || 0]
  ];

  leadFlowStack.innerHTML = rows.map(([label, count]) => `
    <div class="dashboard-progress-row glass-card">
      <div class="dashboard-progress-copy">
        <strong>${label}</strong>
        <span>${numberValue(count)} lead${numberValue(count) === 1 ? "" : "s"}</span>
      </div>
      <div class="dashboard-progress-bar"><span style="width: ${percent(numberValue(count), total)}%;"></span></div>
    </div>
  `).join("");
}

function renderUserRoles(stats = {}) {
  if (!usersRoleGrid) return;
  const roles = stats.users?.roles || {};
  const cards = [
    ["Owners", roles.owner || 0],
    ["Admins", roles.admin || 0],
    ["Managers", Number(roles.manager || 0) + Number(roles.operations_coordinator || 0)],
    ["Sales Reps", Number(roles.sales || 0) + Number(roles.sales_rep || 0)],
    ["Technicians", roles.technician || 0],
    ["Customers", roles.customer || 0]
  ];

  usersRoleGrid.innerHTML = cards.map(([label, count]) => `
    <article class="dashboard-role-card glass-card">
      <div><strong>${label}</strong><span>${numberValue(count)} user${numberValue(count) === 1 ? "" : "s"}</span></div>
      <span class="dashboard-status-pill ${numberValue(count) ? "success" : "empty"}">${numberValue(count)}</span>
    </article>
  `).join("");
}

function renderSummaryPanels(stats = {}) {
  if (companiesList) {
    companiesList.innerHTML = statusCard("Company stats live", `${numberValue(stats.companies?.active)} active companies from dashboard_stats/global.`, "Companies");
  }
  if (jobsList) {
    jobsList.innerHTML = statusCard("Job stats live", `${numberValue(stats.jobs?.inMotion)} jobs currently in motion.`, "Jobs");
  }
  if (activityFeed) {
    const updatedAt = stats.updatedAt?.toDate ? stats.updatedAt.toDate().toLocaleString() : "live";
    activityFeed.innerHTML = statusCard("Stats document connected", `Dashboard now reads dashboard_stats/global instead of scanning every collection. Last update: ${updatedAt}.`, "Fast");
  }
}

function renderStats(stats = {}) {
  writeText(statCompanies, numberValue(stats.companies?.total));
  writeText(statUsers, numberValue(stats.users?.total));
  writeText(statLeads, numberValue(stats.leads?.total));
  writeText(statJobs, numberValue(stats.jobs?.total));

  writeText(statCompaniesMeta, `${numberValue(stats.companies?.active)} active`);
  writeText(statUsersMeta, `${numberValue(stats.users?.active)} active accounts`);
  writeText(statLeadsMeta, `${numberValue(stats.leads?.open)} currently open`);
  writeText(statJobsMeta, `${numberValue(stats.jobs?.inMotion)} in motion`);

  writeText(heroStatusTitle, "Stats system connected");
  writeText(heroStatusText, "Dashboard is reading dashboard_stats/global for faster load performance.");

  renderLeadFlow(stats);
  renderUserRoles(stats);
  renderSummaryPanels(stats);
  saveCache(stats);
}

function renderMissingStats() {
  writeText(heroStatusTitle, "Stats document not found yet");
  writeText(heroStatusText, "Create dashboard_stats/global or deploy the stats function triggers to begin live dashboard stats.");
  renderSummaryPanels({});
}

async function loadStatsOnce() {
  const cached = readCache();
  if (cached) renderStats(cached);

  try {
    const snap = await getDoc(doc(db, "dashboard_stats", "global"));
    if (!snap.exists()) {
      if (!cached) renderMissingStats();
      return;
    }
    renderStats(snap.data() || {});
  } catch (error) {
    console.warn("Dashboard stats read failed:", error);
    if (!cached) renderMissingStats();
  }
}

function subscribeStats() {
  try {
    return onSnapshot(doc(db, "dashboard_stats", "global"), (snap) => {
      if (!snap.exists()) {
        renderMissingStats();
        return;
      }
      renderStats(snap.data() || {});
    }, (error) => {
      console.warn("Dashboard stats listener failed:", error);
    });
  } catch (error) {
    console.warn("Dashboard stats listener skipped:", error);
    return null;
  }
}

function init() {
  loadStatsOnce();
  subscribeStats();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
