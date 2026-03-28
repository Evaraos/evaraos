import {
  requireAuth,
  bindTopbar,
  fetchAllCollection,
  fetchUsersByCompany,
  fetchCompanyCollection,
  sanitizeCompanyId
} from "./app.js";

import { canAccess } from "./roles.js";

const performanceState = {
  user: null,
  users: [],
  leads: [],
  jobs: [],
  search: "",
  roleFilter: "all"
};

const ROLE_LABELS = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  operations_coordinator: "Operations Coordinator",
  sales_rep: "Sales Rep",
  technician: "Technician",
  hr: "HR",
  customer: "Customer"
};

function injectStyles() {
  if (document.getElementById("performancePageStyles")) return;

  const style = document.createElement("style");
  style.id = "performancePageStyles";
  style.textContent = `
    .perf-page{
      display:flex;
      flex-direction:column;
      gap:22px;
      padding:22px;
    }
    .perf-toolbar{
      display:flex;
      gap:12px;
      flex-wrap:wrap;
      margin-top:14px;
    }
    .perf-search,
    .perf-select{
      padding:14px 16px;
      border-radius:16px;
      border:1px solid rgba(255,255,255,.08);
      background:rgba(255,255,255,.04);
      color:#fff;
      outline:none;
      min-height:50px;
      box-sizing:border-box;
    }
    .perf-search{
      flex:1 1 320px;
      min-width:240px;
    }
    .perf-select{
      min-width:220px;
    }
    .perf-summary-grid{
      display:grid;
      grid-template-columns:repeat(4,minmax(0,1fr));
      gap:14px;
      margin-top:14px;
    }
    .perf-summary-card{
      padding:18px;
      border-radius:22px;
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.08);
    }
    .perf-summary-label{
      font-size:12px;
      color:#aeb8c8;
      margin-bottom:8px;
    }
    .perf-summary-value{
      font-size:28px;
      font-weight:800;
      line-height:1.1;
    }
    .perf-grid{
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:16px;
    }
    .perf-card{
      padding:18px;
      border-radius:22px;
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.08);
      display:flex;
      flex-direction:column;
      gap:12px;
    }
    .perf-head{
      display:flex;
      justify-content:space-between;
      align-items:flex-start;
      gap:12px;
    }
    .perf-name{
      font-weight:800;
      font-size:16px;
      line-height:1.2;
    }
    .perf-role{
      color:#aeb8c8;
      font-size:12px;
      margin-top:6px;
      text-transform:capitalize;
    }
    .perf-chip-row{
      display:flex;
      gap:8px;
      flex-wrap:wrap;
      margin-top:4px;
    }
    .perf-chip{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding:6px 10px;
      border-radius:999px;
      background:rgba(255,255,255,.08);
      font-size:12px;
      text-transform:capitalize;
    }
    .perf-stats{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:10px;
      margin-top:6px;
    }
    .perf-stat-box{
      padding:12px;
      border-radius:16px;
      background:rgba(255,255,255,.03);
      border:1px solid rgba(255,255,255,.06);
    }
    .perf-stat-label{
      font-size:12px;
      color:#aeb8c8;
      margin-bottom:6px;
    }
    .perf-stat-value{
      font-size:20px;
      font-weight:700;
      line-height:1.1;
    }
    .perf-meta{
      color:#aeb8c8;
      font-size:13px;
      line-height:1.55;
    }
    .perf-rank{
      min-width:42px;
      height:42px;
      border-radius:999px;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      background:rgba(255,255,255,.08);
      font-size:14px;
      font-weight:700;
    }
    .perf-empty{
      color:#aeb8c8;
      padding:10px 0 4px;
    }
    @media (max-width: 1100px){
      .perf-summary-grid{
        grid-template-columns:repeat(2,minmax(0,1fr));
      }
      .perf-grid{
        grid-template-columns:repeat(2,minmax(0,1fr));
      }
    }
    @media (max-width: 700px){
      .perf-summary-grid,
      .perf-grid,
      .perf-stats{
        grid-template-columns:1fr;
      }
      .perf-toolbar{
        flex-direction:column;
      }
      .perf-search,
      .perf-select{
        width:100%;
      }
    }
  `;
  document.head.appendChild(style);
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function userIdentifiers(user) {
  return new Set(
    [
      user.id,
      user.uid,
      user.email,
      user.username,
      user.handle,
      user.name
    ]
      .filter(Boolean)
      .map(normalizeText)
  );
}

function matchesAssignedRep(record, user) {
  const ids = userIdentifiers(user);
  const values = [
    record.assignedRep,
    record.createdBy,
    record.repId,
    record.ownerId,
    record.ownerEmail
  ]
    .filter(Boolean)
    .map(normalizeText);

  return values.some((value) => ids.has(value));
}

function matchesAssignedTech(record, user) {
  const ids = userIdentifiers(user);
  const directValues = [
    record.assignedTechnician,
    record.technicianId
  ]
    .filter(Boolean)
    .map(normalizeText);

  const crewValues = Array.isArray(record.assignedCrewIds)
    ? record.assignedCrewIds.map(normalizeText)
    : [];

  return [...directValues, ...crewValues].some((value) => ids.has(value));
}

function isWonLead(lead) {
  const status = normalizeText(lead.status);
  return status === "won" || status === "scheduled" || status === "booked";
}

function isCompletedJob(job) {
  return normalizeText(job.status) === "completed";
}

function safeCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function safePercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function getScopedUsers() {
  const q = normalizeText(performanceState.search);
  const roleFilter = performanceState.roleFilter;

  return performanceState.users.filter((user) => {
    const matchesRole = roleFilter === "all" ? true : user.role === roleFilter;
    const matchesSearch =
      !q ||
      [
        user.name,
        user.email,
        user.username,
        user.handle,
        user.role,
        user.companyId
      ]
        .filter(Boolean)
        .some((value) => normalizeText(value).includes(q));

    return matchesRole && matchesSearch;
  });
}

function calculateUserStats(user) {
  const role = normalizeText(user.role);
  const leadsAssigned = performanceState.leads.filter((lead) => matchesAssignedRep(lead, user));
  const convertedLeads = leadsAssigned.filter(isWonLead);
  const quotedLeads = leadsAssigned.filter((lead) => normalizeText(lead.status) === "quoted");
  const bookedLeads = leadsAssigned.filter((lead) => {
    const status = normalizeText(lead.status);
    return status === "scheduled" || status === "booked";
  });

  const assignedJobs = performanceState.jobs.filter((job) => matchesAssignedTech(job, user));
  const completedJobs = assignedJobs.filter(isCompletedJob);
  const inProgressJobs = assignedJobs.filter((job) => normalizeText(job.status) === "in_progress");

  const revenueFromLeads = convertedLeads.reduce((sum, lead) => sum + Number(lead.estimatedPrice || 0), 0);
  const revenueFromJobs = completedJobs.reduce((sum, job) => sum + Number(job.estimatedPrice || 0), 0);

  const directReports = performanceState.users.filter(
    (candidate) => normalizeText(candidate.reportsTo) === normalizeText(user.id)
  );

  let score = 0;

  if (role === "sales_rep") {
    score = convertedLeads.length * 10 + quotedLeads.length * 4 + bookedLeads.length * 6;
  } else if (role === "technician") {
    score = completedJobs.length * 10 + inProgressJobs.length * 4;
  } else if (role === "manager" || role === "operations_coordinator" || role === "admin" || role === "super_admin") {
    const teamLeadCount = performanceState.leads.filter((lead) =>
      directReports.some((rep) => matchesAssignedRep(lead, rep))
    ).length;
    const teamJobCount = performanceState.jobs.filter((job) =>
      directReports.some((tech) => matchesAssignedTech(job, tech))
    ).length;
    score = directReports.length * 5 + teamLeadCount * 2 + teamJobCount * 2;
  } else {
    score = leadsAssigned.length + assignedJobs.length;
  }

  const conversionRate = leadsAssigned.length
    ? (convertedLeads.length / leadsAssigned.length) * 100
    : 0;

  return {
    ...user,
    leadsAssigned: leadsAssigned.length,
    convertedLeads: convertedLeads.length,
    quotedLeads: quotedLeads.length,
    bookedLeads: bookedLeads.length,
    assignedJobs: assignedJobs.length,
    completedJobs: completedJobs.length,
    inProgressJobs: inProgressJobs.length,
    revenueFromLeads,
    revenueFromJobs,
    conversionRate,
    directReports: directReports.length,
    score
  };
}

function buildPerformanceRows() {
  return getScopedUsers()
    .map(calculateUserStats)
    .sort((a, b) => b.score - a.score)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

function summaryStats(rows) {
  const totalUsers = rows.length;
  const totalLeads = rows.reduce((sum, row) => sum + row.leadsAssigned, 0);
  const totalCompletedJobs = rows.reduce((sum, row) => sum + row.completedJobs, 0);
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenueFromLeads + row.revenueFromJobs, 0);

  return {
    totalUsers,
    totalLeads,
    totalCompletedJobs,
    totalRevenue
  };
}

function renderSummaryCards(rows) {
  const stats = summaryStats(rows);

  return `
    <div class="perf-summary-grid">
      <div class="perf-summary-card">
        <div class="perf-summary-label">Visible Users</div>
        <div class="perf-summary-value">${stats.totalUsers}</div>
      </div>
      <div class="perf-summary-card">
        <div class="perf-summary-label">Assigned Leads</div>
        <div class="perf-summary-value">${stats.totalLeads}</div>
      </div>
      <div class="perf-summary-card">
        <div class="perf-summary-label">Completed Jobs</div>
        <div class="perf-summary-value">${stats.totalCompletedJobs}</div>
      </div>
      <div class="perf-summary-card">
        <div class="perf-summary-label">Tracked Revenue</div>
        <div class="perf-summary-value">${safeCurrency(stats.totalRevenue)}</div>
      </div>
    </div>
  `;
}

function renderCard(row) {
  return `
    <div class="perf-card">
      <div class="perf-head">
        <div>
          <div class="perf-name">${row.name || "User"}</div>
          <div class="perf-role">${ROLE_LABELS[row.role] || row.role || "Unknown"}</div>
        </div>
        <div class="perf-rank">#${row.rank}</div>
      </div>

      <div class="perf-chip-row">
        <span class="perf-chip">${row.status || "inactive"}</span>
        <span class="perf-chip">${row.approvalStatus || "pending"}</span>
        <span class="perf-chip">Level ${row.organizationLevel || "—"}</span>
      </div>

      <div class="perf-stats">
        <div class="perf-stat-box">
          <div class="perf-stat-label">Assigned Leads</div>
          <div class="perf-stat-value">${row.leadsAssigned}</div>
        </div>
        <div class="perf-stat-box">
          <div class="perf-stat-label">Conversions</div>
          <div class="perf-stat-value">${row.convertedLeads}</div>
        </div>
        <div class="perf-stat-box">
          <div class="perf-stat-label">Completed Jobs</div>
          <div class="perf-stat-value">${row.completedJobs}</div>
        </div>
        <div class="perf-stat-box">
          <div class="perf-stat-label">Direct Reports</div>
          <div class="perf-stat-value">${row.directReports}</div>
        </div>
      </div>

      <div class="perf-meta">
        Revenue from Leads: ${safeCurrency(row.revenueFromLeads)}<br>
        Revenue from Jobs: ${safeCurrency(row.revenueFromJobs)}<br>
        Conversion Rate: ${safePercent(row.conversionRate)}<br>
        Email: ${row.email || "—"}<br>
        Username: ${row.username || "—"}
      </div>
    </div>
  `;
}

function renderPage() {
  const rows = buildPerformanceRows();

  document.getElementById("performanceRoot").innerHTML = `
    <main class="perf-page">
      <section class="glass-card">
        <div class="section-title-row">
          <div>
            <h1 style="margin:0;">User Performance Dashboard</h1>
            <p class="muted" style="margin:10px 0 0;">
              Track team output across leads, jobs, conversions, hierarchy, and revenue.
            </p>
          </div>
          <div class="top-actions">
            <button class="btn" id="refreshPerformanceBtn">Refresh</button>
          </div>
        </div>

        <div class="perf-toolbar">
          <input
            id="performanceSearchInput"
            class="perf-search"
            placeholder="Search by name, email, username, role, or company..."
            value="${performanceState.search.replace(/"/g, "&quot;")}"
          />

          <select id="performanceRoleFilter" class="perf-select">
            <option value="all" ${performanceState.roleFilter === "all" ? "selected" : ""}>All Roles</option>
            <option value="super_admin" ${performanceState.roleFilter === "super_admin" ? "selected" : ""}>Super Admin</option>
            <option value="admin" ${performanceState.roleFilter === "admin" ? "selected" : ""}>Admin</option>
            <option value="manager" ${performanceState.roleFilter === "manager" ? "selected" : ""}>Manager</option>
            <option value="operations_coordinator" ${performanceState.roleFilter === "operations_coordinator" ? "selected" : ""}>Operations Coordinator</option>
            <option value="sales_rep" ${performanceState.roleFilter === "sales_rep" ? "selected" : ""}>Sales Rep</option>
            <option value="technician" ${performanceState.roleFilter === "technician" ? "selected" : ""}>Technician</option>
            <option value="hr" ${performanceState.roleFilter === "hr" ? "selected" : ""}>HR</option>
            <option value="customer" ${performanceState.roleFilter === "customer" ? "selected" : ""}>Customer</option>
          </select>
        </div>

        ${renderSummaryCards(rows)}
      </section>

      <section class="glass-card">
        <div class="section-title-row">
          <h2>Performance Cards</h2>
          <div class="muted">${rows.length} visible user(s)</div>
        </div>

        ${
          rows.length
            ? `<div class="perf-grid" style="margin-top:16px;">${rows.map(renderCard).join("")}</div>`
            : `<div class="perf-empty">No users match this filter.</div>`
        }
      </section>
    </main>
  `;

  wireEvents();
}

function wireEvents() {
  document.getElementById("performanceSearchInput")?.addEventListener("input", (e) => {
    performanceState.search = e.target.value || "";
    renderPage();
  });

  document.getElementById("performanceRoleFilter")?.addEventListener("change", (e) => {
    performanceState.roleFilter = e.target.value || "all";
    renderPage();
  });

  document.getElementById("refreshPerformanceBtn")?.addEventListener("click", async () => {
    await loadData();
    renderPage();
  });
}

async function loadData() {
  const user = performanceState.user;
  const isSuper = user.role === "super_admin";

  const [users, leads, jobs] = await Promise.all([
    isSuper ? fetchAllCollection("users") : fetchUsersByCompany(user.companyId),
    isSuper ? fetchAllCollection("leads") : fetchCompanyCollection("leads", user.companyId),
    isSuper ? fetchAllCollection("jobs") : fetchCompanyCollection("jobs", user.companyId)
  ]);

  if (isSuper) {
    performanceState.users = users.filter((u) => u.approvalStatus !== "pending");
    performanceState.leads = leads;
    performanceState.jobs = jobs;
  } else {
    const companyId = sanitizeCompanyId(user.companyId || "");
    performanceState.users = users.filter(
      (u) =>
        sanitizeCompanyId(u.companyId || "") === companyId &&
        u.approvalStatus !== "pending"
    );
    performanceState.leads = leads.filter(
      (l) => sanitizeCompanyId(l.companyId || "") === companyId
    );
    performanceState.jobs = jobs.filter(
      (j) => sanitizeCompanyId(j.companyId || "") === companyId
    );
  }
}

requireAuth(async (user) => {
  injectStyles();
  await bindTopbar(user);

  if (!canAccess(user.role, "users")) {
    document.getElementById("performanceRoot").innerHTML =
      `<section class="glass-card" style="margin:22px;">Access denied for performance dashboard.</section>`;
    return;
  }

  performanceState.user = user;

  const sidebarTop = document.getElementById("sidebar");
  if (sidebarTop) sidebarTop.innerHTML = "";

  document.getElementById("performanceRoot").innerHTML =
    `<section class="glass-card" style="margin:22px;">Loading performance dashboard...</section>`;

  try {
    await loadData();
    renderPage();
  } catch (e) {
    document.getElementById("performanceRoot").innerHTML =
      `<section class="glass-card" style="margin:22px;">Performance dashboard failed: ${e.message || e}</section>`;
  }
});