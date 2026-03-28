import {
  requireAuth,
  bindTopbar,
  fetchAllCollection,
  fetchUsersByCompany,
  fetchCompanyCollection
} from "./app.js";

function injectStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .perf-container{
      padding:30px;
    }

    .perf-grid{
      display:grid;
      grid-template-columns:repeat(3,1fr);
      gap:16px;
      margin-top:20px;
    }

    .perf-card{
      padding:16px;
      border-radius:16px;
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.08);
    }

    .perf-name{
      font-weight:700;
    }

    .perf-stat{
      font-size:22px;
      margin-top:8px;
    }
  `;
  document.head.appendChild(style);
}

function calculateStats(users, leads, jobs) {
  return users.map(user => {
    const userLeads = leads.filter(l => l.assignedRep === user.id);
    const userJobs = jobs.filter(j => j.assignedTechnician === user.id);

    return {
      ...user,
      leads: userLeads.length,
      jobs: userJobs.length,
      conversions: userLeads.filter(l => l.status === "won").length
    };
  });
}

function renderUsers(data) {
  return data.map(u => `
    <div class="perf-card">
      <div class="perf-name">${u.name || "User"}</div>
      <div class="muted">${u.role}</div>

      <div class="perf-stat">Leads: ${u.leads}</div>
      <div class="perf-stat">Jobs: ${u.jobs}</div>
      <div class="perf-stat">Conversions: ${u.conversions}</div>
    </div>
  `).join("");
}

requireAuth(async (user) => {
  injectStyles();
  await bindTopbar(user);

  const users =
    user.role === "super_admin"
      ? await fetchAllCollection("users")
      : await fetchUsersByCompany(user.companyId);

  const leads = await fetchCompanyCollection("leads", user.companyId);
  const jobs = await fetchCompanyCollection("jobs", user.companyId);

  const stats = calculateStats(users, leads, jobs);

  document.getElementById("performanceRoot").innerHTML = `
    <div class="perf-container">
      <h1>User Performance Dashboard</h1>
      <div class="perf-grid">
        ${renderUsers(stats)}
      </div>
    </div>
  `;
});
