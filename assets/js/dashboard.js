// assets/js/dashboard.js

import { auth, db, getSavedUserProfile } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

const dashboardSearch = document.getElementById("dashboardSearch");

const COLLECTIONS = {
  companies: "companies",
  users: "users",
  leads: "leads",
  jobs: "jobs"
};

const CACHE_KEY = "evaraos-dashboard-cache-v1";
const CACHE_TTL = 1000 * 60 * 3;

let dashboardCache = {
  companies: [],
  users: [],
  leads: [],
  jobs: [],
  cachedAt: 0
};

let isLoadingDashboard = false;
let hasLoadedOnce = false;
let searchDebounce = null;

function scheduleIdle(callback, timeout = 240) {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(callback, { timeout: 1200 });
    return;
  }

  setTimeout(callback, timeout);
}

function getLocalProfile() {
  try {
    return getSavedUserProfile?.() || null;
  } catch {
    return null;
  }
}

function safeArray(snapshot) {
  return snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data()
  }));
}

function normalizedStatus(value = "") {
  return String(value || "").trim().toLowerCase();
}

function titleFromRecord(record, fallback = "Untitled") {
  return (
    record.name ||
    record.title ||
    record.companyName ||
    record.fullName ||
    record.displayName ||
    record.customerName ||
    record.email ||
    fallback
  );
}

function textFromRecord(record, fields = []) {
  for (const field of fields) {
    const value = record?.[field];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function statusPillClass(status = "") {
  const value = normalizedStatus(status);

  if (["active", "healthy", "approved", "complete", "completed", "won", "closed"].includes(value)) {
    return "success";
  }

  if (["review", "pending", "new", "quoted", "contacted", "scheduled"].includes(value)) {
    return "warning";
  }

  if (["error", "failed", "blocked", "cancelled", "canceled"].includes(value)) {
    return "error";
  }

  if (["inactive", "archived", "paused", "lost", "cold"].includes(value)) {
    return "empty";
  }

  return "working";
}

function niceStatus(status = "") {
  const value = String(status || "").trim();
  if (!value) return "Active";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function saveDashboardCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      ...data,
      cachedAt: Date.now()
    }));
  } catch {}
}

function readDashboardCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const expired = Date.now() - Number(parsed.cachedAt || 0) > CACHE_TTL;

    if (expired) return null;

    return {
      companies: Array.isArray(parsed.companies) ? parsed.companies : [],
      users: Array.isArray(parsed.users) ? parsed.users : [],
      leads: Array.isArray(parsed.leads) ? parsed.leads : [],
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
      cachedAt: parsed.cachedAt || 0
    };
  } catch {
    return null;
  }
}

async function loadCollectionDocs(name, options = {}) {
  const ref = collection(db, name);

  try {
    if (options.orderField) {
      const q = query(ref, orderBy(options.orderField, "desc"), limit(options.limitCount || 8));
      const snap = await getDocs(q);
      return safeArray(snap);
    }

    const snap = await getDocs(ref);
    return safeArray(snap);
  } catch (error) {
    console.warn(`Dashboard collection "${name}" query failed. Retrying basic read.`, error);

    try {
      const snap = await getDocs(ref);
      return safeArray(snap);
    } catch (fallbackError) {
      console.warn(`Dashboard collection "${name}" failed. Returning empty array.`, fallbackError);
      return [];
    }
  }
}

function createStateCard(type, title, message) {
  return `
    <article class="dashboard-state-card ${type}">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(message)}</span>
    </article>
  `;
}

function createInstantCard(title, message, pill = "Syncing") {
  return `
    <article class="dashboard-list-item glass-card aurora-card active-glow beam-target">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(message)}</span>
      </div>
      <span class="dashboard-status-pill working">${escapeHtml(pill)}</span>
    </article>
  `;
}

function renderInstantShell() {
  if (heroStatusTitle) heroStatusTitle.textContent = "Workspace ready";
  if (heroStatusText) heroStatusText.textContent = "Dashboard is open. Live records are syncing in the background.";

  if (statCompanies) statCompanies.textContent = "—";
  if (statUsers) statUsers.textContent = "—";
  if (statLeads) statLeads.textContent = "—";
  if (statJobs) statJobs.textContent = "—";

  if (statCompaniesMeta) statCompaniesMeta.textContent = "Syncing in background";
  if (statUsersMeta) statUsersMeta.textContent = "Syncing in background";
  if (statLeadsMeta) statLeadsMeta.textContent = "Syncing in background";
  if (statJobsMeta) statJobsMeta.textContent = "Syncing in background";

  if (companiesList) {
    companiesList.innerHTML = createInstantCard(
      "Company health is syncing",
      "Your dashboard is visible first. Firestore records load after first paint."
    );
  }

  if (usersRoleGrid) {
    usersRoleGrid.innerHTML = createInstantCard(
      "Role board is syncing",
      "User role totals load in the background."
    );
  }

  if (leadFlowStack) {
    leadFlowStack.innerHTML = createInstantCard(
      "Lead flow is syncing",
      "Pipeline counts will appear automatically."
    );
  }

  if (jobsList) {
    jobsList.innerHTML = createInstantCard(
      "Jobs are syncing",
      "Operations data will appear automatically."
    );
  }

  if (activityFeed) {
    activityFeed.innerHTML = createInstantCard(
      "Activity is syncing",
      "Recent platform activity loads without blocking the dashboard."
    );
  }
}

function renderCompanies(companies) {
  if (!companiesList) return;

  if (!companies.length) {
    companiesList.innerHTML = createStateCard(
      "empty",
      "No companies found",
      "Create company records in Firestore to populate this section."
    );
    return;
  }

  companiesList.innerHTML = companies.slice(0, 4).map((company) => {
    const status = niceStatus(company.status || company.health || "active");
    const pill = statusPillClass(company.status || company.health || "active");
    const subtitle =
      textFromRecord(company, ["description", "location", "category", "industry"]) ||
      "Company record from Firestore";

    return `
      <article class="dashboard-list-item glass-card aurora-card active-glow beam-target">
        <div>
          <strong>${escapeHtml(titleFromRecord(company, "Company"))}</strong>
          <span>${escapeHtml(subtitle)}</span>
        </div>
        <span class="dashboard-status-pill ${pill}">${escapeHtml(status)}</span>
      </article>
    `;
  }).join("");
}

function renderUsers(users) {
  if (!usersRoleGrid) return;

  if (!users.length) {
    usersRoleGrid.innerHTML = createStateCard(
      "empty",
      "No users found",
      "Once user documents are added to Firestore, role counts will appear here."
    );
    return;
  }

  const roleCounts = {
    owner: 0,
    admin: 0,
    manager: 0,
    sales: 0,
    technician: 0,
    customer: 0
  };

  users.forEach((user) => {
    const role = normalizedStatus(user.role || "customer");
    if (roleCounts[role] !== undefined) roleCounts[role] += 1;
  });

  const cards = [
    ["Owners", roleCounts.owner],
    ["Admins", roleCounts.admin],
    ["Managers", roleCounts.manager],
    ["Sales Reps", roleCounts.sales],
    ["Technicians", roleCounts.technician],
    ["Customers", roleCounts.customer]
  ];

  usersRoleGrid.innerHTML = cards.map(([label, count]) => `
    <article class="dashboard-role-card glass-card aurora-card active-glow beam-target">
      <div>
        <strong>${escapeHtml(label)}</strong>
        <span>${count} user${count === 1 ? "" : "s"}</span>
      </div>
      <span class="dashboard-status-pill ${count > 0 ? "success" : "empty"}">${count}</span>
    </article>
  `).join("");
}

function renderLeadFlow(leads) {
  if (!leadFlowStack) return;

  if (!leads.length) {
    leadFlowStack.innerHTML = createStateCard(
      "empty",
      "No leads found",
      "Lead pipeline stages will appear once lead records exist in Firestore."
    );
    return;
  }

  const total = leads.length || 1;
  const statuses = {
    new: 0,
    contacted: 0,
    quoted: 0,
    won: 0
  };

  leads.forEach((lead) => {
    const status = normalizedStatus(lead.status || "new");
    if (statuses[status] !== undefined) statuses[status] += 1;
  });

  const rows = [
    ["New Leads", statuses.new],
    ["Contacted", statuses.contacted],
    ["Quoted", statuses.quoted],
    ["Closed Won", statuses.won]
  ];

  leadFlowStack.innerHTML = rows.map(([label, count]) => {
    const width = Math.max(count === 0 ? 6 : 10, Math.round((count / total) * 100));

    return `
      <div class="dashboard-progress-row glass-card aurora-card active-glow beam-target">
        <div class="dashboard-progress-copy">
          <strong>${escapeHtml(label)}</strong>
          <span>${count} record${count === 1 ? "" : "s"}</span>
        </div>
        <div class="dashboard-progress-bar">
          <span style="width: ${width}%;"></span>
        </div>
      </div>
    `;
  }).join("");
}

function renderJobs(jobs) {
  if (!jobsList) return;

  if (!jobs.length) {
    jobsList.innerHTML = createStateCard(
      "empty",
      "No jobs found",
      "Create job records in Firestore to populate this section."
    );
    return;
  }

  jobsList.innerHTML = jobs.slice(0, 4).map((job) => {
    const status = niceStatus(job.status || "active");
    const pill = statusPillClass(job.status || "active");
    const subtitle =
      textFromRecord(job, ["description", "address", "location", "serviceType"]) ||
      "Job record from Firestore";

    return `
      <article class="dashboard-list-item glass-card aurora-card active-glow beam-target">
        <div>
          <strong>${escapeHtml(titleFromRecord(job, "Job"))}</strong>
          <span>${escapeHtml(subtitle)}</span>
        </div>
        <span class="dashboard-status-pill ${pill}">${escapeHtml(status)}</span>
      </article>
    `;
  }).join("");
}

function buildActivityItems(companies, users, leads, jobs) {
  return [
    ...companies.slice(0, 2).map((item) => ({
      kind: "Company",
      title: titleFromRecord(item, "Company"),
      detail: item.status || item.health || "updated"
    })),
    ...users.slice(0, 2).map((item) => ({
      kind: "User",
      title: titleFromRecord(item, "User"),
      detail: item.role || "updated"
    })),
    ...leads.slice(0, 2).map((item) => ({
      kind: "Lead",
      title: titleFromRecord(item, "Lead"),
      detail: item.status || "updated"
    })),
    ...jobs.slice(0, 2).map((item) => ({
      kind: "Job",
      title: titleFromRecord(item, "Job"),
      detail: item.status || "updated"
    }))
  ].slice(0, 8);
}

function renderActivity(companies, users, leads, jobs) {
  if (!activityFeed) return;

  const merged = buildActivityItems(companies, users, leads, jobs);

  if (!merged.length) {
    activityFeed.innerHTML = createStateCard(
      "empty",
      "No recent records",
      "Once collections are populated, recent activity will appear here."
    );
    return;
  }

  activityFeed.innerHTML = merged.map((item) => `
    <article class="dashboard-feed-item glass-card aurora-card active-glow beam-target">
      <div>
        <strong>${escapeHtml(item.kind)}: ${escapeHtml(item.title)}</strong>
        <span>Status: ${escapeHtml(niceStatus(item.detail))}</span>
      </div>
      <span class="dashboard-status-pill working">${escapeHtml(item.kind)}</span>
    </article>
  `).join("");
}

function updateStats(companies, users, leads, jobs) {
  if (statCompanies) statCompanies.textContent = String(companies.length);
  if (statUsers) statUsers.textContent = String(users.length);
  if (statLeads) statLeads.textContent = String(leads.length);
  if (statJobs) statJobs.textContent = String(jobs.length);

  const activeCompanies = companies.filter((item) =>
    ["active", "healthy", "approved"].includes(normalizedStatus(item.status || item.health || "active"))
  ).length;

  const activeUsers = users.filter((user) =>
    normalizedStatus(user.active) !== "false" &&
    normalizedStatus(user.status) !== "inactive"
  ).length;

  const openLeads = leads.filter((item) =>
    !["won", "closed", "complete", "completed"].includes(normalizedStatus(item.status))
  ).length;

  const inProgressJobs = jobs.filter((item) =>
    ["in progress", "active", "pending", "working", "scheduled"].includes(normalizedStatus(item.status))
  ).length;

  if (statCompaniesMeta) statCompaniesMeta.textContent = `${activeCompanies} active`;
  if (statUsersMeta) statUsersMeta.textContent = `${activeUsers} active accounts`;
  if (statLeadsMeta) statLeadsMeta.textContent = `${openLeads} currently open`;
  if (statJobsMeta) statJobsMeta.textContent = `${inProgressJobs} in motion`;
}

function renderDashboard(data = dashboardCache) {
  updateStats(data.companies, data.users, data.leads, data.jobs);
  renderCompanies(data.companies);
  renderUsers(data.users);
  renderLeadFlow(data.leads);
  renderJobs(data.jobs);
  renderActivity(data.companies, data.users, data.leads, data.jobs);
}

function renderFilteredDashboard(queryText = "") {
  const queryValue = String(queryText || "").trim().toLowerCase();

  if (!queryValue) {
    renderDashboard(dashboardCache);
    return;
  }

  const filterItems = (items) => items.filter((item) => {
    const haystack = [
      item.name,
      item.title,
      item.companyName,
      item.fullName,
      item.displayName,
      item.customerName,
      item.email,
      item.description,
      item.location,
      item.address,
      item.category,
      item.status,
      item.role,
      item.health,
      item.serviceType,
      item.industry
    ].map((value) => String(value || "").toLowerCase()).join(" ");

    return haystack.includes(queryValue);
  });

  renderDashboard({
    companies: filterItems(dashboardCache.companies),
    users: filterItems(dashboardCache.users),
    leads: filterItems(dashboardCache.leads),
    jobs: filterItems(dashboardCache.jobs)
  });
}

function renderErrorState(message = "Some live records could not be loaded.") {
  if (heroStatusTitle) heroStatusTitle.textContent = "Dashboard opened";
  if (heroStatusText) heroStatusText.textContent = message;

  if (!dashboardCache.companies.length && companiesList) {
    companiesList.innerHTML = createStateCard("warning", "Companies unavailable", "Live records will retry next refresh.");
  }

  if (!dashboardCache.users.length && usersRoleGrid) {
    usersRoleGrid.innerHTML = createStateCard("warning", "Users unavailable", "Live records will retry next refresh.");
  }

  if (!dashboardCache.leads.length && leadFlowStack) {
    leadFlowStack.innerHTML = createStateCard("warning", "Leads unavailable", "Live records will retry next refresh.");
  }

  if (!dashboardCache.jobs.length && jobsList) {
    jobsList.innerHTML = createStateCard("warning", "Jobs unavailable", "Live records will retry next refresh.");
  }
}

async function loadDashboardData() {
  if (isLoadingDashboard) return;
  isLoadingDashboard = true;

  if (heroStatusTitle) heroStatusTitle.textContent = "Syncing live system";
  if (heroStatusText) heroStatusText.textContent = "Dashboard is already open. Firestore records are updating in the background.";

  try {
    const companiesPromise = loadCollectionDocs(COLLECTIONS.companies, { orderField: "updatedAt", limitCount: 8 });
    const usersPromise = loadCollectionDocs(COLLECTIONS.users);
    const leadsPromise = loadCollectionDocs(COLLECTIONS.leads);
    const jobsPromise = loadCollectionDocs(COLLECTIONS.jobs, { orderField: "updatedAt", limitCount: 8 });

    const [companiesResult, usersResult, leadsResult, jobsResult] = await Promise.allSettled([
      companiesPromise,
      usersPromise,
      leadsPromise,
      jobsPromise
    ]);

    dashboardCache = {
      companies: companiesResult.status === "fulfilled" ? companiesResult.value : [],
      users: usersResult.status === "fulfilled" ? usersResult.value : [],
      leads: leadsResult.status === "fulfilled" ? leadsResult.value : [],
      jobs: jobsResult.status === "fulfilled" ? jobsResult.value : [],
      cachedAt: Date.now()
    };

    saveDashboardCache(dashboardCache);
    renderFilteredDashboard(dashboardSearch?.value || "");

    const totalRecords =
      dashboardCache.companies.length +
      dashboardCache.users.length +
      dashboardCache.leads.length +
      dashboardCache.jobs.length;

    if (heroStatusTitle) heroStatusTitle.textContent = "Live system connected";
    if (heroStatusText) {
      heroStatusText.textContent = `Synced ${totalRecords} records across companies, users, leads, and jobs.`;
    }
  } catch (error) {
    console.error("Dashboard data load failed:", error);
    renderErrorState("Dashboard stayed open, but live sync failed. Check Firestore rules or connection.");
  } finally {
    isLoadingDashboard = false;
    hasLoadedOnce = true;
  }
}

function bindSidebarAnchors() {
  document.querySelectorAll(".dashboard-nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".dashboard-nav-link").forEach((item) => {
        item.classList.remove("active");
      });
      link.classList.add("active");
    });
  });
}

function bindSearch() {
  if (!dashboardSearch) return;

  dashboardSearch.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      renderFilteredDashboard(dashboardSearch.value);
    }, 80);
  });
}

function hydrateFromCacheOrShell() {
  const cached = readDashboardCache();

  if (cached) {
    dashboardCache = cached;
    renderDashboard(cached);

    if (heroStatusTitle) heroStatusTitle.textContent = "Dashboard restored instantly";
    if (heroStatusText) heroStatusText.textContent = "Showing cached records while live data refreshes in the background.";
    return;
  }

  renderInstantShell();
}

function startBackgroundSync() {
  if (hasLoadedOnce || isLoadingDashboard) return;

  scheduleIdle(() => {
    const localProfile = getLocalProfile();
    const authReady = Boolean(auth.currentUser || localProfile?.uid);

    if (!authReady) {
      window.addEventListener("evara:session-ready", () => {
        scheduleIdle(loadDashboardData, 120);
      }, { once: true });
      return;
    }

    loadDashboardData();
  }, 180);
}

function initDashboard() {
  bindSidebarAnchors();
  bindSearch();
  hydrateFromCacheOrShell();
  startBackgroundSync();

  onAuthStateChanged(auth, (user) => {
    if (!user && !getLocalProfile()?.uid) return;
    startBackgroundSync();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDashboard, { once: true });
} else {
  initDashboard();
}