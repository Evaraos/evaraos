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
  roleFilter: "all",
  rows: [],
  selectedUserId: null
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
      cursor:pointer;
      transition:.18s ease;
    }
    .perf-card:hover{
      transform:translateY(-2px);
      background:rgba(255,255,255,.06);
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
    .perf-section-grid{
      display:grid;
      grid-template-columns:1.15fr .85fr;
      gap:16px;
      margin-top:16px;
    }
    .perf-panel{
      padding:18px;
      border-radius:22px;
      background:rgba(255,255,255,.03);
      border:1px solid rgba(255,255,255,.08);
    }
    .perf-panel h3{
      margin:0 0 12px 0;
    }
    .perf-rollup-list{
      display:flex;
      flex-direction:column;
      gap:12px;
    }
    .perf-rollup-item{
      display:flex;
      justify-content:space-between;
      gap:12px;
      align-items:center;
      padding:12px 14px;
      border-radius:16px;
      background:rgba(255,255,255,.03);
      border:1px solid rgba(255,255,255,.06);
    }
    .perf-rollup-meta{
      color:#aeb8c8;
      font-size:12px;
      margin-top:4px;
      line-height:1.4;
    }
    .perf-chart-wrap{
      display:flex;
      flex-direction:column;
      gap:16px;
    }
    .perf-chart{
      display:flex;
      flex-direction:column;
      gap:12px;
    }
    .perf-chart-row{
      display:grid;
      grid-template-columns:140px minmax(0,1fr) 70px;
      gap:12px;
      align-items:center;
    }
    .perf-chart-label{
      font-size:13px;
      color:#fff;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
    .perf-chart-bar-track{
      width:100%;
      height:12px;
      border-radius:999px;
      background:rgba(255,255,255,.08);
      overflow:hidden;
    }
    .perf-chart-bar{
      height:100%;
      border-radius:999px;
      background:linear-gradient(90deg, rgba(255,94,77,0.95), rgba(255,140,92,0.95));
    }
    .perf-chart-value{
      text-align:right;
      font-size:12px;
      color:#aeb8c8;
    }
    .perf-modal-backdrop{
      position:fixed;
      inset:0;
      background:rgba(0,0,0,.45);
      backdrop-filter:blur(8px);
      display:none;
      align-items:center;
      justify-content:center;
      z-index:9998;
      padding:18px;
    }
    .perf-modal-backdrop.open{
      display:flex;
    }
    .perf-modal-card{
      width:min(860px,100%);
      max-height:90vh;
      overflow:auto;
      border-radius:28px;
      background:rgba(14,16,24,.96);
      border:1px solid rgba(255,255,255,.08);
      padding:22px;
      box-shadow:0 25px 60px rgba(0,0,0,.35);
    }
    .perf-detail-grid{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:14px;
      margin-top:16px;
    }
    .perf-detail-box{
      padding:14px;
      border-radius:18px;
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.07);
    }
    .perf-detail-label{
      font-size:12px;
      color:#aeb8c8;
      margin-bottom:8px;
    }
    .perf-detail-value{
      font-size:14px;
      line-height:1.45;
    }
    @media (max-width: 1200px){
      .perf-summary-grid{
        grid-template-columns:repeat(2,minmax(0,1fr));
      }
      .perf-grid{
        grid-template-columns:repeat(2,minmax(0,1fr));
      }
      .perf-section-grid{
        grid-template-columns:1fr;
      }
    }
    @media (max-width: 700px){
      .perf-summary-grid,
      .perf-grid,
      .perf-stats,
      .perf-detail-grid{
        grid-template-columns:1fr;
      }
      .perf-toolbar{
        flex-direction:column;
      }
      .perf-search,
      .perf-select{
        width:100%;
      }
      .perf-chart-row{
        grid-template-columns:100px minmax(0,1fr) 56px;
      }
    }
  `;
  document.head.appendChild(style);
}

function ensureModalShell() {
  if (document.getElementById("performanceDetailModal")) return;

  const wrap = document.createElement("div");
  wrap.className = "perf-modal-backdrop";
  wrap.id = "performanceDetailModal";
  wrap.innerHTML = `
    <div class="perf-modal-card">
      <div class="section-title-row">
        <h2 id="performanceDetailTitle" style="margin:0;">User Detail</h2>
        <button class="btn secondary" id="performanceDetailCloseBtn" type="button">Close</button>
      </div>
      <div id="performanceDetailBody" style="margin-top:16px;"></div>
    </div>
  `;
  document.body.appendChild(wrap);

  document.getElementById("performanceDetailCloseBtn")?.addEventListener("click", closeUserDetailModal);
}

function openUserDetailModal(userId) {
  performanceState.selectedUserId = userId;
  const row = performanceState.rows.find((item) => item.id === userId);
  if (!row) return;

  ensureModalShell();

  document.getElementById("performanceDetailTitle").textContent =
    row.name || row.email || "User Detail";

  document.getElementById("performanceDetailBody").innerHTML = `
    <div class="perf-chip-row" style="margin-top:0;">
      <span class="perf-chip">${ROLE_LABELS[row.role] || row.role || "Unknown"}</span>
      <span class="perf-chip">${row.status || "inactive"}</span>
      <span class="perf-chip">${row.approvalStatus || "pending"}</span>
      <span class="perf-chip">Level ${row.organizationLevel || "—"}</span>
      <span class="perf-chip">Rank #${row.rank}</span>
    </div>

    <div class="perf-detail-grid">
      <div class="perf-detail-box">
        <div class="perf-detail-label">Name</div>
        <div class="perf-detail-value">${row.name || "—"}</div>
      </div>
      <div class="perf-detail-box">
        <div class="perf-detail-label">Email</div>
        <div class="perf-detail-value">${row.email || "—"}</div>
      </div>
      <div class="perf-detail-box">
        <div class="perf-detail-label">Phone</div>
        <div class="perf-detail-value">${row.phone || "—"}</div>
      </div>
      <div class="perf-detail-box">
        <div class="perf-detail-label">Username</div>
        <div class="perf-detail-value">${row.username || "—"}</div>
      </div>
      <div class="perf-detail-box">
        <div class="perf-detail-label">Assigned Leads</div>
        <div class="perf-detail-value">${row.leadsAssigned}</div>
      </div>
      <div class="perf-detail-box">
        <div class="perf-detail-label">Converted Leads</div>
        <div class="perf-detail-value">${row.convertedLeads}</div>
      </div>
      <div class="perf-detail-box">
        <div class="perf-detail-label">Completed Jobs</div>
        <div class="perf-detail-value">${row.completedJobs}</div>
      </div>
      <div class="perf-detail-box">
        <div class="perf-detail-label">In Progress Jobs</div>
        <div class="perf-detail-value">${row.inProgressJobs}</div>
      </div>
      <div class="perf-detail-box">
        <div class="perf-detail-label">Revenue from Leads</div>
        <div class="perf-detail-value">${safeCurrency(row.revenueFromLeads)}</div>
      </div>
      <div class="perf-detail-box">
        <div class="perf-detail-label">Revenue from Jobs</div>
        <div class="perf-detail-value">${safeCurrency(row.revenueFromJobs)}</div>
      </div>
      <div class="perf-detail-box">
        <div class="perf-detail-label">Conversion Rate</div>
        <div class="perf-detail-value">${safePercent(row.conversionRate)}</div>
      </div>
      <div class="perf-detail-box">
        <div class="perf-detail-label">Direct Reports</div>
        <div class="perf-detail-value">${row.directReports}</div>
      </div>
    </div>
  `;

  document.getElementById("performanceDetailModal").classList.add("open");
}

function closeUserDetailModal() {
  document.getElementById("performanceDetailModal")?.classList.remove("open");
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

  const directReportUsers = performanceState.users.filter(
    (candidate) => normalizeText(candidate.reportsTo) === normalizeText(user.id)
  );

  const teamLeadCount = performanceState.leads.filter((lead) =>
    directReportUsers.some((rep) => matchesAssignedRep(lead, rep))
  ).length;

  const teamCompletedJobs = performanceState.jobs.filter((job) =>
    directReportUsers.some((member) => matchesAssignedTech(job, member))
  ).filter(isCompletedJob).length;

  let score = 0;

  if (role === "sales_rep") {
    score = convertedLeads.length * 10 + quotedLeads.length * 4 + bookedLeads.length * 6;
  } else if (role === "technician") {
    score = completedJobs.length * 10 + inProgressJobs.length * 4;
  } else if (role === "manager" || role === "operations_coordinator" || role === "admin" || role === "super_admin") {
    score = directReportUsers.length * 5 + teamLeadCount * 2 + teamCompletedJobs * 3;
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
    directReports: directReportUsers.length,
    teamLeadCount,
    teamCompletedJobs,
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

function aggregateByRole(rows) {
  const map = new Map();

  rows.forEach((row) => {
    const key = row.role || "unknown";
    if (!map.has(key)) {
      map.set(key, {
        role: key,
        leads: 0,
        jobs: 0,
        revenue: 0
      });
    }

    const bucket = map.get(key);
    bucket.leads += Number(row.leadsAssigned || 0);
    bucket.jobs += Number(row.completedJobs || 0);
    bucket.revenue += Number(row.revenueFromLeads || 0) + Number(row.revenueFromJobs || 0);
  });

  return [...map.values()];
}

function renderBarChart(title, items, valueKey, formatter = (v) => v) {
  const max = Math.max(...items.map((item) => Number(item[valueKey] || 0)), 0);

  return `
    <div class="perf-chart">
      <h3 style="margin:0;">${title}</h3>
      ${
        items.length
          ? items
              .map((item) => {
                const raw = Number(item[valueKey] || 0);
                const width = max > 0 ? (raw / max) * 100 : 0;
                return `
                  <div class="perf-chart-row">
                    <div class="perf-chart-label">${ROLE_LABELS[item.role] || item.role}</div>
                    <div class="perf-chart-bar-track">
                      <div class="perf-chart-bar" style="width:${width}%;"></div>
                    </div>
                    <div class="perf-chart-value">${formatter(raw)}</div>
                  </div>
                `;
              })
              .join("")
          : `<div class="perf-empty">No chart data.</div>`
      }
    </div>
  `;
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
    <div class="perf-card" data-user-id="${row.id}">
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

function renderRollups(rows) {
  const managers = rows
    .filter((row) =>
      ["super_admin", "admin", "manager", "operations_coordinator"].includes(row.role)
    )
    .sort((a, b) => (b.directReports + b.teamCompletedJobs) - (a.directReports + a.teamCompletedJobs));

  return `
    <div class="perf-panel">
      <h3>Manager / Team Rollups</h3>
      ${
        managers.length
          ? `<div class="perf-rollup-list">
              ${managers
                .map(
                  (row) => `
                    <div class="perf-rollup-item">
                      <div>
                        <strong>${row.name || "User"}</strong>
                        <div class="perf-rollup-meta">
                          ${ROLE_LABELS[row.role] || row.role}<br>
                          Direct Reports: ${row.directReports}<br>
                          Team Leads: ${row.teamLeadCount}<br>
                          Team Completed Jobs: ${row.teamCompletedJobs}
                        </div>
                      </div>
                      <div class="perf-rank">#${row.rank}</div>
                    </div>
                  `
                )
                .join("")}
            </div>`
          : `<div class="perf-empty">No manager rollups available.</div>`
      }
    </div>
  `;
}

function renderCharts(rows) {
  const roleBuckets = aggregateByRole(rows);

  return `
    <div class="perf-panel">
      <div class="perf-chart-wrap">
        ${renderBarChart("Leads by Role", roleBuckets, "leads")}
        ${renderBarChart("Completed Jobs by Role", roleBuckets, "jobs")}
        ${renderBarChart("Revenue by Role", roleBuckets, "revenue", (v) => safeCurrency(v))}
      </div>
    </div>
  `;
}

function renderPage() {
  performanceState.rows = buildPerformanceRows();
  const rows = performanceState.rows;

  document.getElementById("performanceRoot").innerHTML = `
    <main class="perf-page">
      <section class="glass-card">
        <div class="section-title-row">
          <div>
            <h1 style="margin:0;">User Performance Dashboard</h1>
            <p class="muted" style="margin:10px 0 0;">
              Track team output across leads, jobs, conversions, hierarchy, revenue, and role performance.
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

      <section class="glass-card">
        <div class="section-title-row">
          <h2>Performance Insights</h2>
        </div>
        <div class="perf-section-grid">
          ${renderRollups(rows)}
          ${renderCharts(rows)}
        </div>
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

  document.querySelectorAll(".perf-card").forEach((card) => {
    card.addEventListener("click", () => {
      openUserDetailModal(card.dataset.userId);
    });
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
  ensureModalShell();
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