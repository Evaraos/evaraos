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

function statusPillClass(status = "") {
  const value = normalizedStatus(status);

  if (["active", "healthy", "approved", "complete", "completed", "won", "closed"].includes(value)) {
    return "good";
  }

  if (["review", "pending", "new", "quoted"].includes(value)) {
    return "alert";
  }

  return "working";
}

function niceStatus(status = "") {
  const value = String(status || "").trim();
  if (!value) return "Active";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

async function loadCollectionDocs(name, options = {}) {
  const ref = collection(db, name);

  try {
    if (options.orderField) {
      const q = query(ref, orderBy(options.orderField, "desc"), limit(options.limitCount || 3));
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

function renderCompanies(companies) {
  if (!companies.length) {
    companiesList.innerHTML = `
      <article class="dashboard-list-item glass-card aurora-card">
        <div>
          <strong>No companies found</strong>
          <span>Create company records in Firestore to populate this section.</span>
        </div>
        <span class="dashboard-status-pill alert">Empty</span>
      </article>
    `;
    return;
  }

  companiesList.innerHTML = companies.slice(0, 3).map((company) => {
    const status = niceStatus(company.status || company.health || "active");
    const pill = statusPillClass(company.status || company.health || "active");
    const subtitle =
      company.description ||
      company.location ||
      company.category ||
      "Company record from Firestore";

    return `
      <article class="dashboard-list-item glass-card aurora-card">
        <div>
          <strong>${titleFromRecord(company, "Company")}</strong>
          <span>${subtitle}</span>
        </div>
        <span class="dashboard-status-pill ${pill}">${status}</span>
      </article>
    `;
  }).join("");
}

function renderUsers(users) {
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
    <article class="dashboard-role-card glass-card aurora-card">
      <strong>${label}</strong>
      <span>${count} user${count === 1 ? "" : "s"}</span>
    </article>
  `).join("");
}

function renderLeadFlow(leads) {
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
    const width = Math.max(8, Math.round((count / total) * 100));
    return `
      <div class="dashboard-progress-row">
        <div class="dashboard-progress-copy">
          <strong>${label}</strong>
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
  if (!jobs.length) {
    jobsList.innerHTML = `
      <article class="dashboard-list-item glass-card aurora-card">
        <div>
          <strong>No jobs found</strong>
          <span>Create job records in Firestore to populate this section.</span>
        </div>
        <span class="dashboard-status-pill alert">Empty</span>
      </article>
    `;
    return;
  }

  jobsList.innerHTML = jobs.slice(0, 3).map((job) => {
    const status = niceStatus(job.status || "active");
    const pill = statusPillClass(job.status || "active");
    const subtitle =
      job.description ||
      job.address ||
      job.location ||
      "Job record from Firestore";

    return `
      <article class="dashboard-list-item glass-card aurora-card">
        <div>
          <strong>${titleFromRecord(job, "Job")}</strong>
          <span>${subtitle}</span>
        </div>
        <span class="dashboard-status-pill ${pill}">${status}</span>
      </article>
    `;
  }).join("");
}

function renderActivity(companies, users, leads, jobs) {
  const merged = [
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
  ].slice(0, 6);

  if (!merged.length) {
    activityFeed.innerHTML = `
      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>No recent records</strong>
        <span>Once collections are populated, recent activity will appear here.</span>
      </article>
    `;
    return;
  }

  activityFeed.innerHTML = merged.map((item) => `
    <article class="dashboard-feed-item glass-card aurora-card">
      <strong>${item.kind}: ${item.title}</strong>
      <span>Status: ${niceStatus(item.detail)}</span>
    </article>
  `).join("");
}

function updateStats(companies, users, leads, jobs) {
  statCompanies.textContent = String(companies.length);
  statUsers.textContent = String(users.length);
  statLeads.textContent = String(leads.length);
  statJobs.textContent = String(jobs.length);

  const activeCompanies = companies.filter((item) =>
    ["active", "healthy", "approved"].includes(normalizedStatus(item.status || item.health || "active"))
  ).length;

  const openLeads = leads.filter((item) =>
    !["won", "closed", "complete", "completed"].includes(normalizedStatus(item.status))
  ).length;

  const inProgressJobs = jobs.filter((item) =>
    ["in progress", "active", "pending", "working"].includes(normalizedStatus(item.status))
  ).length;

  statCompaniesMeta.textContent = `${activeCompanies} active`;
  statUsersMeta.textContent = `${users.filter((u) => normalizedStatus(u.active) !== "false").length} active accounts`;
  statLeadsMeta.textContent = `${openLeads} currently open`;
  statJobsMeta.textContent = `${inProgressJobs} in motion`;
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
      item.role
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

async function loadDashboardData() {
  heroStatusTitle.textContent = "Loading system data...";
  heroStatusText.textContent = "Connecting to Firestore collections.";

  try {
    const [companies, users, leads, jobs] = await Promise.all([
      loadCollectionDocs("companies", { orderField: "updatedAt", limitCount: 6 }),
      loadCollectionDocs("users"),
      loadCollectionDocs("leads"),
      loadCollectionDocs("jobs", { orderField: "updatedAt", limitCount: 6 })
    ]);

    dashboardCache = { companies, users, leads, jobs };

    renderFilteredDashboard(dashboardSearch?.value || "");

    heroStatusTitle.textContent = "Live system connected";
    heroStatusText.textContent = `Loaded ${companies.length} companies, ${users.length} users, ${leads.length} leads, and ${jobs.length} jobs.`;
  } catch (error) {
    console.error("Dashboard data load failed:", error);

    heroStatusTitle.textContent = "Data load failed";
    heroStatusText.textContent = "Check Firestore rules, collection names, or missing exports in firebase.js.";

    companiesList.innerHTML = `
      <article class="dashboard-list-item glass-card aurora-card">
        <div>
          <strong>Unable to load companies</strong>
          <span>${error.message || "Unknown Firestore error."}</span>
        </div>
        <span class="dashboard-status-pill alert">Error</span>
      </article>
    `;

    usersRoleGrid.innerHTML = `
      <article class="dashboard-role-card glass-card aurora-card">
        <strong>Load error</strong>
        <span>Users could not be read</span>
      </article>
    `;

    leadFlowStack.innerHTML = `
      <div class="dashboard-progress-row">
        <div class="dashboard-progress-copy">
          <strong>Load error</strong>
          <span>Leads could not be read</span>
        </div>
        <div class="dashboard-progress-bar"><span style="width: 8%;"></span></div>
      </div>
    `;

    jobsList.innerHTML = `
      <article class="dashboard-list-item glass-card aurora-card">
        <div>
          <strong>Unable to load jobs</strong>
          <span>Check the jobs collection and Firestore permissions.</span>
        </div>
        <span class="dashboard-status-pill alert">Error</span>
      </article>
    `;

    activityFeed.innerHTML = `
      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>Dashboard activity unavailable</strong>
        <span>${error.message || "Unknown Firestore error."}</span>
      </article>
    `;
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
      window.location.href = "/evaraos/login.html";
      return;
    }
    loadDashboardData();
  });
}

document.addEventListener("DOMContentLoaded", initDashboard);