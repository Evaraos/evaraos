// assets/js/dashboard.js

import { auth, db } from "./firebase.js";
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

let dashboardCache = {
  companies: [],
  users: [],
  leads: [],
  jobs: []
};

let isLoadingDashboard = false;

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

async function loadCollectionDocs(name, options = {}) {
  const ref = collection(db, name);

  try {
    if (options.orderField) {
      const q = query(ref, orderBy(options.orderField, "desc"), limit(options.limitCount || 6));
      const snap = await getDocs(q);
      return safeArray(snap);
    }

    const snap = await getDocs(ref);
    return safeArray(snap);
  } catch (error) {
    console.warn(`Failed loading collection "${name}" with query, retrying basic read.`, error);
    const snap = await getDocs(ref);
    return safeArray(snap);
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

function createSkeletonCards(count = 3) {
  return `
    <div class="dashboard-skeleton-grid">
      ${Array.from({ length: count }).map(() => `
        <article class="dashboard-skeleton-card">
          <span class="dashboard-skeleton-line line-1"></span>
          <span class="dashboard-skeleton-line line-2"></span>
          <span class="dashboard-skeleton-line line-3"></span>
        </article>
      `).join("")}
    </div>
  `;
}

function renderLoadingStates() {
  if (companiesList) companiesList.innerHTML = createSkeletonCards(3);
  if (usersRoleGrid) usersRoleGrid.innerHTML = createSkeletonCards(3);
  if (leadFlowStack) leadFlowStack.innerHTML = createSkeletonCards(3);
  if (jobsList) jobsList.innerHTML = createSkeletonCards(3);
  if (activityFeed) activityFeed.innerHTML = createSkeletonCards(3);

  if (statCompanies) statCompanies.textContent = "—";
  if (statUsers) statUsers.textContent = "—";
  if (statLeads) statLeads.textContent = "—";
  if (statJobs) statJobs.textContent = "—";

  if (statCompaniesMeta) statCompaniesMeta.textContent = "Loading companies...";
  if (statUsersMeta) statUsersMeta.textContent = "Loading users...";
  if (statLeadsMeta) statLeadsMeta.textContent = "Loading leads...";
  if (statJobsMeta) statJobsMeta.textContent = "Loading jobs...";
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

  const openLeads = leads.filter((item) =>
    !["won", "closed", "complete", "completed"].includes(normalizedStatus(item.status))
  ).length;

  const inProgressJobs = jobs.filter((item) =>
    ["in progress", "active", "pending", "working", "scheduled"].includes(normalizedStatus(item.status))
  ).length;

  if (statCompaniesMeta) statCompaniesMeta.textContent = `${activeCompanies} active`;
  if (statUsersMeta) statUsersMeta.textContent = `${users.filter((u) => normalizedStatus(u.active) !== "false").length} active accounts`;
  if (statLeadsMeta) statLeadsMeta.textContent = `${openLeads} currently open`;
  if (statJobsMeta) statJobsMeta.textContent = `${inProgressJobs} in motion`;
}

function renderFilteredDashboard(queryText = "") {
  const queryValue = String(queryText || "").trim().toLowerCase();

  if (!queryValue) {
    updateStats(dashboardCache.companies, dashboardCache.users, dashboardCache.leads, dashboardCache.jobs);
    renderCompanies(dashboardCache.companies);
    renderUsers(dashboardCache.users);
    renderLeadFlow(dashboardCache.leads);
    renderJobs(dashboardCache.jobs);
    renderActivity(dashboardCache.companies, dashboardCache.users, dashboardCache.leads, dashboardCache.jobs);
    return;
  }

  const filterItems = (items) => items.filter((item) => {
    const haystack = [
      item.name,
      item.title,
      item.companyName,
      item.fullName,
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

  const companies = filterItems(dashboardCache.companies);
  const users = filterItems(dashboardCache.users);
  const leads = filterItems(dashboardCache.leads);
  const jobs = filterItems(dashboardCache.jobs);

  updateStats(companies, users, leads, jobs);
  renderCompanies(companies);
  renderUsers(users);
  renderLeadFlow(leads);
  renderJobs(jobs);
  renderActivity(companies, users, leads, jobs);
}

function renderErrorState(error) {
  const message = error?.message || "Unknown Firestore error.";

  if (companiesList) {
    companiesList.innerHTML = createStateCard(
      "error",
      "Unable to load companies",
      message
    );
  }

  if (usersRoleGrid) {
    usersRoleGrid.innerHTML = createStateCard(
      "error",
      "Users could not be read",
      "Check Firestore permissions and collection structure."
    );
  }

  if (leadFlowStack) {
    leadFlowStack.innerHTML = createStateCard(
      "error",
      "Leads could not be read",
      "Check the leads collection and Firestore rules."
    );
  }

  if (jobsList) {
    jobsList.innerHTML = createStateCard(
      "error",
      "Unable to load jobs",
      "Check the jobs collection and Firestore permissions."
    );
  }

  if (activityFeed) {
    activityFeed.innerHTML = createStateCard(
      "error",
      "Dashboard activity unavailable",
      message
    );
  }

  if (statCompanies) statCompanies.textContent = "0";
  if (statUsers) statUsers.textContent = "0";
  if (statLeads) statLeads.textContent = "0";
  if (statJobs) statJobs.textContent = "0";

  if (statCompaniesMeta) statCompaniesMeta.textContent = "Load error";
  if (statUsersMeta) statUsersMeta.textContent = "Load error";
  if (statLeadsMeta) statLeadsMeta.textContent = "Load error";
  if (statJobsMeta) statJobsMeta.textContent = "Load error";
}

async function loadDashboardData() {
  if (isLoadingDashboard) return;
  isLoadingDashboard = true;

  if (heroStatusTitle) heroStatusTitle.textContent = "Loading system data...";
  if (heroStatusText) heroStatusText.textContent = "Connecting to Firestore collections.";
  renderLoadingStates();

  try {
    const [companies, users, leads, jobs] = await Promise.all([
      loadCollectionDocs("companies", { orderField: "updatedAt", limitCount: 8 }),
      loadCollectionDocs("users"),
      loadCollectionDocs("leads"),
      loadCollectionDocs("jobs", { orderField: "updatedAt", limitCount: 8 })
    ]);

    dashboardCache = { companies, users, leads, jobs };

    renderFilteredDashboard(dashboardSearch?.value || "");

    const totalRecords = companies.length + users.length + leads.length + jobs.length;
    if (heroStatusTitle) heroStatusTitle.textContent = "Live system connected";
    if (heroStatusText) {
      heroStatusText.textContent = `Loaded ${totalRecords} total records across ${companies.length} companies, ${users.length} users, ${leads.length} leads, and ${jobs.length} jobs.`;
    }
  } catch (error) {
    console.error("Dashboard data load failed:", error);

    if (heroStatusTitle) heroStatusTitle.textContent = "Data load failed";
    if (heroStatusText) {
      heroStatusText.textContent = "Check Firestore rules, collection names, or missing exports in firebase.js.";
    }
    renderErrorState(error);
  } finally {
    isLoadingDashboard = false;
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
    renderFilteredDashboard(dashboardSearch.value);
  });
}

function initDashboard() {
  bindSidebarAnchors();
  bindSearch();

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.replace("/evaraos/login.html");
      return;
    }
    loadDashboardData();
  });
}

document.addEventListener("DOMContentLoaded", initDashboard);