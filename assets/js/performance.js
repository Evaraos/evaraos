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
  jobs: []
};

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });
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
}

function getStatsForUser(user) {
  const leads = state.leads.filter(item => item.assignedRep === user.id);
  const jobs = state.jobs.filter(item => item.assignedTechnician === user.id);

  const wonLeads = leads.filter(item => ["won", "scheduled", "booked"].includes(String(item.status || "").toLowerCase()));
  const completedJobs = jobs.filter(item => String(item.status || "").toLowerCase() === "completed");

  return {
    leadsAssigned: leads.length,
    wonLeads: wonLeads.length,
    completedJobs: completedJobs.length,
    revenue:
      wonLeads.reduce((sum, item) => sum + Number(item.estimatedPrice || 0), 0) +
      completedJobs.reduce((sum, item) => sum + Number(item.estimatedPrice || 0), 0)
  };
}

function renderPage() {
  const root = document.getElementById("performanceRoot");
  if (!root) return;

  const rows = state.users.map(user => ({
    ...user,
    ...getStatsForUser(user)
  }));

  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);

  root.innerHTML = `
    <section class="glass-card aurora-card shine-border">
      <div class="section-title-row">
        <div>
          <h2 style="margin:0;">Performance Overview</h2>
          <p class="muted" style="margin:8px 0 0;">Track user activity across leads, jobs, and revenue.</p>
        </div>
      </div>

      <div class="grid grid-3" style="margin-top:18px;">
        <div class="card aurora-card shine-border">
          <h3>Visible Users</h3>
          <p style="font-size:32px; font-weight:800;">${rows.length}</p>
        </div>
        <div class="card aurora-card shine-border">
          <h3>Total Leads</h3>
          <p style="font-size:32px; font-weight:800;">${state.leads.length}</p>
        </div>
        <div class="card aurora-card shine-border">
          <h3>Tracked Revenue</h3>
          <p style="font-size:32px; font-weight:800;">${money(totalRevenue)}</p>
        </div>
      </div>
    </section>

    <section class="glass-card aurora-card shine-border">
      <div class="section-title-row">
        <h2 style="margin:0;">User Performance Cards</h2>
      </div>

      ${
        !rows.length
          ? `<div class="muted" style="padding-top:16px;">No performance data found.</div>`
          : `
            <div class="quick-links-grid" style="margin-top:18px;">
              ${rows.map(row => `
                <div class="quick-link-card aurora-card shine-border" style="display:block; min-height:auto;">
                  <div>
                    <strong>${row.name || row.email || "User"}</strong>
                    <div class="muted" style="margin-top:8px;">
                      ${row.role || "role"}<br>
                      ${row.email || "No email"}
                    </div>
                  </div>

                  <div style="margin-top:12px;">
                    <span class="chip">Leads: ${row.leadsAssigned}</span>
                    <span class="chip">Won: ${row.wonLeads}</span>
                    <span class="chip">Jobs: ${row.completedJobs}</span>
                  </div>

                  <div class="muted" style="margin-top:12px;">
                    Revenue: ${money(row.revenue)}
                  </div>
                </div>
              `).join("")}
            </div>
          `
      }
    </section>
  `;
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