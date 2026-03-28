import {
  bindTopbar,
  requireAuth,
  renderSidebar,
  fetchAllCollection,
  fetchCompanyCollection,
  fetchUsersByCompany
} from "./app.js";

import {
  filterLeadsForUser,
  filterJobsForUser,
  filterUsersForUser,
  canAccess
} from "./roles.js";

function currency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function percent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

function getLeadStageCounts(leads) {
  const base = {
    new: 0,
    contacted: 0,
    quoted: 0,
    booked: 0,
    won: 0,
    lost: 0
  };

  leads.forEach((lead) => {
    let status = String(lead.status || "").toLowerCase();
    if (status === "scheduled") status = "booked";
    if (base[status] !== undefined) base[status] += 1;
  });

  return base;
}

function getDashboardMetrics(leads, jobs, users) {
  const wonLeads = leads.filter((lead) =>
    ["won", "scheduled", "booked"].includes(String(lead.status || "").toLowerCase())
  );
  const completedJobs = jobs.filter((job) => String(job.status || "").toLowerCase() === "completed");
  const scheduledJobs = jobs.filter((job) => String(job.status || "").toLowerCase() === "scheduled");
  const inProgressJobs = jobs.filter((job) => String(job.status || "").toLowerCase() === "in_progress");
  const activeReps = users.filter((u) => u.role === "sales_rep" && String(u.status || "").toLowerCase() === "active");
  const activeTechs = users.filter((u) => u.role === "technician" && String(u.status || "").toLowerCase() === "active");

  const revenue = completedJobs.reduce((sum, job) => sum + Number(job.estimatedPrice || 0), 0);
  const conversionRate = leads.length ? (wonLeads.length / leads.length) * 100 : 0;

  return {
    revenue,
    totalLeads: leads.length,
    scheduledJobs: scheduledJobs.length,
    completedJobs: completedJobs.length,
    inProgressJobs: inProgressJobs.length,
    activeReps: activeReps.length,
    activeTechs: activeTechs.length,
    conversionRate
  };
}

function renderKpiCard(label, value, sub = "") {
  return `
    <div class="metric-card">
      <div class="metric-label">${label}</div>
      <div class="metric-value">${value}</div>
      ${sub ? `<div class="metric-sub">${sub}</div>` : ""}
    </div>
  `;
}

function renderPipeline(stageCounts) {
  const stages = [
    ["new", "New"],
    ["contacted", "Contacted"],
    ["quoted", "Quoted"],
    ["booked", "Booked"],
    ["won", "Won"],
    ["lost", "Lost"]
  ];

  return `
    <section class="glass-card">
      <div class="section-title-row">
        <h2>Pipeline Snapshot</h2>
      </div>
      <div class="pipeline-grid">
        ${stages
          .map(
            ([key, label]) => `
              <div class="pipeline-stage">
                <span class="pipeline-label">${label}</span>
                <strong class="pipeline-count">${stageCounts[key] || 0}</strong>
              </div>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderRecentLeads(leads) {
  const sorted = [...leads]
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .slice(0, 6);

  return `
    <section class="glass-card">
      <div class="section-title-row">
        <h2>Recent Leads</h2>
      </div>
      ${
        !sorted.length
          ? `<div class="empty-state">No leads available.</div>`
          : `
            <div class="list-stack">
              ${sorted
                .map(
                  (lead) => `
                    <div class="list-row">
                      <div>
                        <strong>${lead.fullName || "Unnamed Lead"}</strong>
                        <div class="muted">${lead.serviceInterest || lead.serviceType || "No service selected"}</div>
                      </div>
                      <div style="text-align:right;">
                        <div class="status-pill">${lead.status || "new"}</div>
                        <div class="muted">${currency(lead.estimatedPrice || 0)}</div>
                      </div>
                    </div>
                  `
                )
                .join("")}
            </div>
          `
      }
    </section>
  `;
}

function renderUpcomingJobs(jobs) {
  const sorted = [...jobs]
    .filter((job) => ["scheduled", "in_progress"].includes(String(job.status || "").toLowerCase()))
    .sort((a, b) => String(a.scheduledDate || "").localeCompare(String(b.scheduledDate || "")))
    .slice(0, 6);

  return `
    <section class="glass-card">
      <div class="section-title-row">
        <h2>Upcoming Jobs</h2>
      </div>
      ${
        !sorted.length
          ? `<div class="empty-state">No upcoming jobs.</div>`
          : `
            <div class="list-stack">
              ${sorted
                .map(
                  (job) => `
                    <div class="list-row">
                      <div>
                        <strong>${job.customerName || "Unnamed Customer"}</strong>
                        <div class="muted">${job.serviceType || "Service not set"}</div>
                      </div>
                      <div style="text-align:right;">
                        <div class="status-pill">${job.status || "scheduled"}</div>
                        <div class="muted">${formatDate(job.scheduledDate)}</div>
                      </div>
                    </div>
                  `
                )
                .join("")}
            </div>
          `
      }
    </section>
  `;
}

function getQuickLinks(user) {
  const links = [
    { key: "overview", label: "Overview", href: "dashboard.html", desc: "Main dashboard" },
    { key: "users", label: "Users", href: "users.html", desc: "Team and account records" },
    { key: "leads", label: "Leads", href: "leads.html", desc: "Pipeline and conversions" },
    { key: "sales_reps", label: "Sales Reps", href: "sales_reps.html", desc: "Rep management" },
    { key: "companies", label: "Companies", href: "companies.html", desc: "Company records" },
    { key: "jobs", label: "Jobs", href: "jobs.html", desc: "Scheduling and operations" },
    { key: "audit", label: "Audit", href: "audit.html", desc: "Repair tools" }
  ];

  return links.filter((item) => item.key === "overview" || canAccess(user.role, item.key));
}

function renderHeaderCard(user) {
  return `
    <section class="glass-card">
      <div class="page-header-card">
        <div>
          <div class="eyebrow">Evaraos Inc</div>
          <h1 class="page-title">Dashboard</h1>
          <div class="muted">Supreme TrueClean operating overview</div>
        </div>

        <div class="identity-card">
          <strong>${user.name || "User"}</strong>
          <span>${user.handle || (user.username ? `@${user.username}` : "@user")}</span>
          <small>${user.companyId || "supreme_trueclean"}</small>
        </div>
      </div>
    </section>
  `;
}

function renderNavDropdown(user) {
  return `
    <section class="glass-card nav-dropdown-wrap">
      <div class="section-title-row">
        <h2>Navigation</h2>
        <button id="navDropdownToggle" class="btn secondary" type="button">Toggle Menu</button>
      </div>
      <div id="navDropdownBody" class="nav-dropdown-body">
        <nav class="sidebar-nav">${renderSidebar(user.role, "overview")}</nav>
      </div>
    </section>
  `;
}

function renderQuickLinks(user) {
  const links = getQuickLinks(user);

  return `
    <section class="glass-card">
      <div class="section-title-row">
        <h2>Quick Access</h2>
      </div>
      <div class="quick-links-grid">
        ${links
          .map(
            (item) => `
              <a class="quick-link-card ${item.key === "overview" ? "active" : ""}" href="${item.href}">
                <strong>${item.label}</strong>
                <span>${item.desc}</span>
              </a>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function injectDashboardStyles() {
  if (document.getElementById("dashboardRestoreStyles")) return;

  const style = document.createElement("style");
  style.id = "dashboardRestoreStyles";
  style.textContent = `
    .dashboard-shell{
      display:flex;
      flex-direction:column;
      gap:22px;
      padding:22px;
    }
    .page-header-card{
      display:flex;
      justify-content:space-between;
      align-items:flex-start;
      gap:18px;
      flex-wrap:wrap;
    }
    .eyebrow{
      color:#aeb8c8;
      font-size:13px;
      margin-bottom:10px;
      text-transform:uppercase;
      letter-spacing:.08em;
    }
    .page-title{
      margin:0;
      font-size:54px;
      line-height:1;
    }
    .identity-card{
      display:flex;
      flex-direction:column;
      gap:6px;
      align-items:flex-end;
      text-align:right;
      min-width:180px;
    }
    .identity-card strong{
      font-size:22px;
    }
    .identity-card span,
    .identity-card small{
      color:#aeb8c8;
    }
    .nav-dropdown-body{
      overflow:hidden;
      max-height:0;
      opacity:0;
      transition:max-height .28s ease, opacity .2s ease, margin-top .2s ease;
      margin-top:0;
    }
    .nav-dropdown-body.open{
      max-height:700px;
      opacity:1;
      margin-top:12px;
    }
    .sidebar-nav{
      display:flex;
      flex-direction:column;
      gap:10px;
    }
    .sidebar-nav a{
      display:flex;
      align-items:center;
      padding:14px 16px;
      border-radius:18px;
      background:rgba(255,255,255,.03);
      border:1px solid rgba(255,255,255,.07);
      color:#fff;
      text-decoration:none;
      transition:.18s ease;
    }
    .sidebar-nav a:hover,
    .sidebar-nav a.active{
      background:rgba(255,255,255,.09);
      transform:translateY(-1px);
    }
    .metric-grid{
      display:grid;
      grid-template-columns:repeat(4,minmax(0,1fr));
      gap:16px;
    }
    .metric-card{
      padding:18px;
      border-radius:22px;
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.08);
    }
    .metric-label{
      font-size:13px;
      color:#adb7c7;
      margin-bottom:8px;
    }
    .metric-value{
      font-size:30px;
      font-weight:800;
      line-height:1.1;
    }
    .metric-sub{
      margin-top:8px;
      font-size:13px;
      color:#9db0c9;
    }
    .pipeline-grid{
      display:grid;
      grid-template-columns:repeat(6,minmax(0,1fr));
      gap:12px;
      margin-top:14px;
    }
    .pipeline-stage{
      border-radius:18px;
      padding:16px;
      background:rgba(255,255,255,.035);
      border:1px solid rgba(255,255,255,.08);
      text-align:center;
    }
    .pipeline-label{
      display:block;
      color:#aeb8c8;
      font-size:13px;
      margin-bottom:8px;
    }
    .pipeline-count{
      font-size:28px;
    }
    .section-title-row{
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:12px;
      margin-bottom:8px;
      flex-wrap:wrap;
    }
    .list-stack{
      display:flex;
      flex-direction:column;
      gap:12px;
      margin-top:12px;
    }
    .list-row{
      display:flex;
      justify-content:space-between;
      gap:12px;
      align-items:center;
      padding:14px 16px;
      border-radius:18px;
      background:rgba(255,255,255,.03);
      border:1px solid rgba(255,255,255,.07);
    }
    .status-pill{
      display:inline-flex;
      padding:6px 10px;
      border-radius:999px;
      background:rgba(255,255,255,.08);
      font-size:12px;
      text-transform:capitalize;
    }
    .empty-state{
      color:#aeb8c8;
      padding:12px 0 4px;
    }
    .muted{
      color:#aeb8c8;
      font-size:13px;
    }
    .quick-links-grid{
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:14px;
      margin-top:12px;
    }
    .quick-link-card{
      display:flex;
      flex-direction:column;
      gap:8px;
      padding:18px;
      border-radius:22px;
      text-decoration:none;
      color:#fff;
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.08);
      transition:.18s ease;
    }
    .quick-link-card:hover,
    .quick-link-card.active{
      transform:translateY(-2px);
      background:rgba(255,255,255,.08);
    }
    .quick-link-card span{
      color:#aeb8c8;
      font-size:13px;
      line-height:1.4;
    }
    @media (max-width: 1100px){
      .metric-grid{ grid-template-columns:repeat(2,minmax(0,1fr)); }
      .pipeline-grid{ grid-template-columns:repeat(3,minmax(0,1fr)); }
      .quick-links-grid{ grid-template-columns:repeat(2,minmax(0,1fr)); }
      .page-title{ font-size:42px; }
    }
    @media (max-width: 700px){
      .metric-grid{ grid-template-columns:1fr; }
      .pipeline-grid{ grid-template-columns:repeat(2,minmax(0,1fr)); }
      .quick-links-grid{ grid-template-columns:1fr; }
      .identity-card{ align-items:flex-start; text-align:left; }
      .page-title{ font-size:34px; }
    }
  `;
  document.head.appendChild(style);
}

async function loadScopedData(user) {
  const isGlobal = user.role === "super_admin";

  let leads;
  let jobs;
  let users;

  if (isGlobal) {
    [leads, jobs, users] = await Promise.all([
      fetchAllCollection("leads"),
      fetchAllCollection("jobs"),
      fetchAllCollection("users")
    ]);
  } else {
    [leads, jobs, users] = await Promise.all([
      fetchCompanyCollection("leads", user.companyId),
      fetchCompanyCollection("jobs", user.companyId),
      fetchUsersByCompany(user.companyId)
    ]);
  }

  return {
    leads: filterLeadsForUser(user, leads),
    jobs: filterJobsForUser(user, jobs),
    users: filterUsersForUser(user, users)
  };
}

function renderDashboard(user, scoped) {
  const metrics = getDashboardMetrics(scoped.leads, scoped.jobs, scoped.users);
  const stageCounts = getLeadStageCounts(scoped.leads);

  const root = document.getElementById("dashboardRoot");
  root.innerHTML = `
    <div class="dashboard-shell">
      ${renderHeaderCard(user)}
      ${renderNavDropdown(user)}

      <section class="glass-card">
        <div class="section-title-row">
          <div>
            <h2 style="margin:0;">Overview</h2>
            <p class="muted" style="margin:10px 0 0;">Role-scoped analytics and real-time pipeline visibility.</p>
          </div>
        </div>

        <div class="metric-grid" style="margin-top:16px;">
          ${renderKpiCard("Revenue", currency(metrics.revenue), "Completed jobs")}
          ${renderKpiCard("Total Leads", metrics.totalLeads)}
          ${renderKpiCard("Scheduled Jobs", metrics.scheduledJobs)}
          ${renderKpiCard("Completed Jobs", metrics.completedJobs)}
          ${renderKpiCard("In Progress", metrics.inProgressJobs)}
          ${renderKpiCard("Conversion Rate", percent(metrics.conversionRate))}
          ${renderKpiCard("Active Reps", metrics.activeReps)}
          ${renderKpiCard("Active Technicians", metrics.activeTechs)}
        </div>
      </section>

      ${renderQuickLinks(user)}
      ${canAccess(user.role, "leads") ? renderPipeline(stageCounts) : ""}

      <div class="metric-grid" style="grid-template-columns:repeat(2,minmax(0,1fr));">
        ${canAccess(user.role, "leads") ? renderRecentLeads(scoped.leads) : ""}
        ${canAccess(user.role, "jobs") ? renderUpcomingJobs(scoped.jobs) : ""}
      </div>
    </div>
  `;

  const toggleBtn = document.getElementById("navDropdownToggle");
  const body = document.getElementById("navDropdownBody");
  if (toggleBtn && body) {
    toggleBtn.addEventListener("click", () => {
      body.classList.toggle("open");
    });
  }
}

requireAuth(async (user) => {
  injectDashboardStyles();
  await bindTopbar(user);

  const sidebarTop = document.getElementById("sidebar");
  if (sidebarTop) {
    sidebarTop.innerHTML = "";
  }

  const root = document.getElementById("dashboardRoot");
  root.innerHTML = `<section class="glass-card">Loading dashboard...</section>`;

  try {
    const scoped = await loadScopedData(user);
    renderDashboard(user, scoped);
  } catch (e) {
    root.innerHTML = `<section class="glass-card">Dashboard failed to load: ${e.message || e}</section>`;
  }
});