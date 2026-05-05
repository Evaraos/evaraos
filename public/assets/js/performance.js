import {
  requireAuth,
  bindTopbar,
  renderSidebar,
  fetchAllCollection,
  fetchUsersByCompany
} from "./app.js";

import { canAccess } from "./roles.js";

const state = {
  user: null,
  users: [],
  leads: [],
  jobs: [],
  filteredUsers: [],
  search: "",
  roleFilter: "all"
};

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });
}

function percent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function normalize(value = "") {
  return String(value || "").trim().toLowerCase();
}

async function loadData(user) {
  state.user = user;

  const [users, leads, jobs] = await Promise.all([
    ["super_admin", "owner", "admin"].includes(user.role)
      ? fetchAllCollection("users", { max: 500 })
      : fetchUsersByCompany(user.companyId),
    fetchAllCollection("leads", { max: 500 }),
    fetchAllCollection("jobs", { max: 500 })
  ]);

  state.users = ["super_admin", "owner", "admin"].includes(user.role)
    ? users
    : users.filter(item => item.companyId === user.companyId);

  state.leads = ["super_admin", "owner", "admin"].includes(user.role)
    ? leads
    : leads.filter(item => item.companyId === user.companyId);

  state.jobs = ["super_admin", "owner", "admin"].includes(user.role)
    ? jobs
    : jobs.filter(item => item.companyId === user.companyId);

  applyFilters();
}

function getUserLeadStats(user) {
  const assignedLeads = state.leads.filter(item => {
    return (
      item.assignedRep === user.id ||
      normalize(item.assignedRep) === normalize(user.username) ||
      normalize(item.assignedRep) === normalize(user.email)
    );
  });

  const wonLeads = assignedLeads.filter(item =>
    ["won", "scheduled", "booked"].includes(normalize(item.status))
  );

  const quotedLeads = assignedLeads.filter(item =>
    normalize(item.status) === "quoted"
  );

  return {
    assignedLeads,
    wonLeads,
    quotedLeads
  };
}

function getUserJobStats(user) {
  const assignedJobs = state.jobs.filter(item => {
    return (
      item.assignedTechnician === user.id ||
      normalize(item.assignedTechnician) === normalize(user.username) ||
      normalize(item.assignedTechnician) === normalize(user.email)
    );
  });

  const completedJobs = assignedJobs.filter(item =>
    normalize(item.status) === "completed"
  );

  const inProgressJobs = assignedJobs.filter(item =>
    normalize(item.status) === "in_progress"
  );

  return {
    assignedJobs,
    completedJobs,
    inProgressJobs
  };
}

function buildUserRow(user) {
  const { assignedLeads, wonLeads, quotedLeads } = getUserLeadStats(user);
  const { assignedJobs, completedJobs, inProgressJobs } = getUserJobStats(user);

  const leadRevenue = wonLeads.reduce((sum, item) => sum + Number(item.estimatedPrice || 0), 0);
  const jobRevenue = completedJobs.reduce((sum, item) => sum + Number(item.estimatedPrice || 0), 0);

  const conversionRate = assignedLeads.length
    ? (wonLeads.length / assignedLeads.length) * 100
    : 0;

  let score = 0;

  if (normalize(user.role) === "sales_rep") {
    score = wonLeads.length * 10 + quotedLeads.length * 4 + assignedLeads.length * 2;
  } else if (["technician", "tech"].includes(normalize(user.role))) {
    score = completedJobs.length * 10 + inProgressJobs.length * 4 + assignedJobs.length * 2;
  } else {
    score = assignedLeads.length + completedJobs.length;
  }

  return {
    ...user,
    assignedLeadsCount: assignedLeads.length,
    wonLeadsCount: wonLeads.length,
    quotedLeadsCount: quotedLeads.length,
    assignedJobsCount: assignedJobs.length,
    completedJobsCount: completedJobs.length,
    inProgressJobsCount: inProgressJobs.length,
    leadRevenue,
    jobRevenue,
    totalRevenue: leadRevenue + jobRevenue,
    conversionRate,
    score
  };
}

function applyFilters() {
  const q = normalize(state.search);
  const role = normalize(state.roleFilter);

  state.filteredUsers = state.users
    .filter(user => {
      const matchesRole = role === "all" ? true : normalize(user.role) === role;

      const haystack = [
        user.name,
        user.email,
        user.username,
        user.handle,
        user.role,
        user.companyId
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !q || haystack.includes(q);

      return matchesRole && matchesSearch;
    })
    .map(buildUserRow)
    .sort((a, b) => b.score - a.score);
}

function summaryStats() {
  const totalUsers = state.filteredUsers.length;
  const totalLeads = state.filteredUsers.reduce((sum, item) => sum + item.assignedLeadsCount, 0);
  const totalCompletedJobs = state.filteredUsers.reduce((sum, item) => sum + item.completedJobsCount, 0);
  const totalRevenue = state.filteredUsers.reduce((sum, item) => sum + item.totalRevenue, 0);

  return { totalUsers, totalLeads, totalCompletedJobs, totalRevenue };
}

function renderSummary() {
  const stats = summaryStats();

  return `
    <div class="grid grid-3" style="margin-top:18px;">
      <div class="card aurora-card shine-border">
        <h3>Visible Users</h3>
        <p style="font-size:32px; font-weight:800;">${stats.totalUsers}</p>
      </div>
      <div class="card aurora-card shine-border">
        <h3>Completed Jobs</h3>
        <p style="font-size:32px; font-weight:800;">${stats.totalCompletedJobs}</p>
      </div>
      <div class="card aurora-card shine-border">
        <h3>Tracked Revenue</h3>
        <p style="font-size:32px; font-weight:800;">${money(stats.totalRevenue)}</p>
      </div>
    </div>
  `;
}

function renderCards() {
  if (!state.filteredUsers.length) {
    return `<div class="muted" style="padding-top:16px;">No users match this filter.</div>`;
  }

  return `
    <div class="quick-links-grid" style="margin-top:18px;">
      ${state.filteredUsers.map((row, index) => `
        <div class="quick-link-card aurora-card shine-border" style="display:block; min-height:auto;">
          <div class="section-title-row">
            <strong>${row.name || row.email || "User"}</strong>
            <span class="chip">#${index + 1}</span>
          </div>

          <div class="muted" style="margin-top:8px;">
            ${row.role || "role"}<br>
            ${row.email || "No email"}<br>
            ${row.companyId || "No company"}
          </div>

          <div style="margin-top:12px;">
            <span class="chip">Leads: ${row.assignedLeadsCount}</span>
            <span class="chip">Won: ${row.wonLeadsCount}</span>
            <span class="chip">Jobs: ${row.completedJobsCount}</span>
          </div>

          <div class="muted" style="margin-top:12px;">
            Lead Revenue: ${money(row.leadRevenue)}<br>
            Job Revenue: ${money(row.jobRevenue)}<br>
            Total Revenue: ${money(row.totalRevenue)}<br>
            Conversion Rate: ${percent(row.conversionRate)}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderPage() {
  const root = document.getElementById("performanceRoot");
  if (!root) return;

  root.innerHTML = `
    <section class="glass-card aurora-card shine-border">
      <div class="section-title-row">
        <div>
          <h2 style="margin:0;">Performance Overview</h2>
          <p class="muted" style="margin:8px 0 0;">Track user activity across leads, jobs, and revenue.</p>
        </div>
        <div class="top-actions">
          <button class="btn btn-secondary" id="refreshPerformanceBtn" type="button">Refresh</button>
        </div>
      </div>

      <div class="form-grid" style="margin-top:18px;">
        <div class="field">
          <label for="performanceSearchInput">Search</label>
          <input id="performanceSearchInput" value="${state.search.replace(/"/g, "&quot;")}" placeholder="Search name, email, username, role..." />
        </div>

        <div class="field">
          <label for="performanceRoleFilter">Role Filter</label>
          <select id="performanceRoleFilter">
            <option value="all" ${state.roleFilter === "all" ? "selected" : ""}>All Roles</option>
            <option value="super_admin" ${state.roleFilter === "super_admin" ? "selected" : ""}>Super Admin</option>
            <option value="admin" ${state.roleFilter === "admin" ? "selected" : ""}>Admin</option>
            <option value="manager" ${state.roleFilter === "manager" ? "selected" : ""}>Manager</option>
            <option value="operations_coordinator" ${state.roleFilter === "operations_coordinator" ? "selected" : ""}>Operations Coordinator</option>
            <option value="sales_rep" ${state.roleFilter === "sales_rep" ? "selected" : ""}>Sales Rep</option>
            <option value="technician" ${state.roleFilter === "technician" ? "selected" : ""}>Technician</option>
            <option value="hr" ${state.roleFilter === "hr" ? "selected" : ""}>HR</option>
            <option value="customer" ${state.roleFilter === "customer" ? "selected" : ""}>Customer</option>
          </select>
        </div>
      </div>

      ${renderSummary()}
    </section>

    <section class="glass-card aurora-card shine-border">
      <div class="section-title-row">
        <h2 style="margin:0;">User Performance Cards</h2>
        <div class="muted">${state.filteredUsers.length} visible user(s)</div>
      </div>

      ${renderCards()}
    </section>
  `;

  wireEvents();
}

function wireEvents() {
  document.getElementById("performanceSearchInput")?.addEventListener("input", (e) => {
    state.search = e.target.value || "";
    applyFilters();
    renderPage();
  });

  document.getElementById("performanceRoleFilter")?.addEventListener("change", (e) => {
    state.roleFilter = e.target.value || "all";
    applyFilters();
    renderPage();
  });

  document.getElementById("refreshPerformanceBtn")?.addEventListener("click", async () => {
    await loadData(state.user);
    renderPage();
  });
}

requireAuth(async (user) => {
  await bindTopbar(user, "Performance");

  const sidebar = document.getElementById("sidebar");
  if (sidebar) {
    sidebar.innerHTML = renderSidebar(user.role, "performance");
  }

  if (!canAccess(user.role, "performance")) {
    document.getElementById("performanceRoot").innerHTML =
      `<section class="glass-card aurora-card shine-border">Access denied.</section>`;
    return;
  }

  document.getElementById("performanceRoot").innerHTML =
    `<section class="glass-card aurora-card shine-border">Loading performance...</section>`;

  try {
    await loadData(user);
    renderPage();
  } catch (error) {
    console.error(error);
    document.getElementById("performanceRoot").innerHTML =
      `<section class="glass-card aurora-card shine-border">Performance page failed: ${error.message || error}</section>`;
  }
});