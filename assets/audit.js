import {
  bindTopbar,
  requireAuth,
  renderSidebar,
  scanSystemDiscrepancies,
  normalizeUserDoc,
  normalizeCompanyDoc,
  normalizeLeadDoc,
  normalizeJobDoc,
  normalizeServiceDoc,
  fetchAllCollection
} from "./app.js";

function renderSection(title, items, type, repairable = false) {
  if (!items.length) {
    return `
      <div class="audit-card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
          <h2 style="margin-top:0;">${title}</h2>
          ${repairable ? `<button class="btn secondary repair-section-btn" data-type="${type}">Repair ${title}</button>` : ``}
        </div>
        <div class="audit-empty">No discrepancies found.</div>
      </div>
    `;
  }

  return `
    <div class="audit-card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <h2 style="margin-top:0;">${title}</h2>
        ${repairable ? `<button class="btn secondary repair-section-btn" data-type="${type}">Repair ${title}</button>` : ``}
      </div>

      ${items.map((item) => `
        <div class="audit-row">
          <strong>${item.name || item.id}</strong><br>
          ${item.role ? `<span class="muted">${item.role}</span><br>` : ""}

          ${
            item.missingFields?.length
              ? `<div style="margin-top:10px;"><strong>Missing Fields:</strong><br>${item.missingFields.map((field) => `<span class="audit-badge">${field}</span>`).join("")}</div>`
              : ``
          }

          ${
            item.mismatchFields?.length
              ? `<div style="margin-top:10px;"><strong>Mismatches:</strong><br>${item.mismatchFields.map((field) => `<span class="audit-badge">${field}</span>`).join("")}</div>`
              : ``
          }

          ${
            item.issues?.length
              ? `<div style="margin-top:10px;"><strong>Issues:</strong><br>${item.issues.map((field) => `<span class="audit-badge">${field}</span>`).join("")}</div>`
              : ``
          }

          ${
            repairable
              ? `<div class="audit-actions"><button class="btn repair-item-btn" data-type="${type}" data-id="${item.id}">Repair</button></div>`
              : ``
          }
        </div>
      `).join("")}
    </div>
  `;
}

function renderFullRepairCard() {
  return `
    <section class="glass-card" id="fullRepairCard">
      <div class="action-row" style="justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;">
        <div>
          <h2 style="margin:0;">Full System Repair</h2>
          <p class="muted" style="margin:8px 0 0;">Repairs users, username directory, companies, leads, jobs, and services.</p>
        </div>
        <button class="btn" id="repairEverythingBtn">Repair All System Data</button>
      </div>
    </section>
  `;
}

async function repairItem(type, id) {
  if (type === "users") return normalizeUserDoc(id);
  if (type === "companies") return normalizeCompanyDoc(id);
  if (type === "leads") return normalizeLeadDoc(id);
  if (type === "jobs") return normalizeJobDoc(id);
  if (type === "services") return normalizeServiceDoc(id);
}

async function repairSection(type) {
  const data = await scanSystemDiscrepancies();
  const section = data[type] || [];
  for (const item of section) {
    await repairItem(type, item.id);
  }
}

async function repairUsernameDirectory() {
  const users = await fetchAllCollection("users");
  for (const user of users) {
    if (user.username) {
      await normalizeUserDoc(user.id);
    }
  }
}

async function wireAuditButtons() {
  document.querySelectorAll(".repair-item-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "Repairing...";
      try {
        await repairItem(btn.dataset.type, btn.dataset.id);
        await loadAudit();
      } catch (e) {
        btn.disabled = false;
        btn.textContent = "Repair";
        alert(e.message || "Failed to repair item.");
      }
    });
  });

  document.querySelectorAll(".repair-section-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "Repairing...";
      try {
        await repairSection(btn.dataset.type);
        await loadAudit();
      } catch (e) {
        btn.disabled = false;
        btn.textContent = `Repair ${btn.dataset.type}`;
        alert(e.message || "Failed to repair section.");
      }
    });
  });

  const repairEverythingBtn = document.getElementById("repairEverythingBtn");
  if (repairEverythingBtn) {
    repairEverythingBtn.addEventListener("click", async () => {
      repairEverythingBtn.disabled = true;
      repairEverythingBtn.textContent = "Repairing Everything...";
      try {
        await repairSection("users");
        await repairUsernameDirectory();
        await repairSection("companies");
        await repairSection("leads");
        await repairSection("jobs");
        await repairSection("services");
        repairEverythingBtn.textContent = "Repair All System Data";
        repairEverythingBtn.disabled = false;
        await loadAudit();
      } catch (e) {
        repairEverythingBtn.textContent = "Repair All System Data";
        repairEverythingBtn.disabled = false;
        alert(e.message || "Failed to repair all system data.");
      }
    });
  }
}

async function loadAudit() {
  const root = document.getElementById("auditRoot");
  root.innerHTML = `
    ${renderFullRepairCard()}
    <div class="glass-card">Scanning...</div>
  `;

  try {
    const data = await scanSystemDiscrepancies();

    root.innerHTML = [
      renderFullRepairCard(),
      renderSection("Users", data.users, "users", true),
      renderSection("Username Directory", data.usernames, "usernames", false),
      renderSection("Companies", data.companies, "companies", true),
      renderSection("Leads", data.leads, "leads", true),
      renderSection("Jobs", data.jobs, "jobs", true),
      renderSection("Services", data.services, "services", true)
    ].join("");

    await wireAuditButtons();
  } catch (e) {
    root.innerHTML = `
      ${renderFullRepairCard()}
      <div class="glass-card">Audit failed: ${e.message || e}</div>
    `;
    await wireAuditButtons();
  }
}

requireAuth(async (user) => {
  if (user.role !== "super_admin") {
    document.body.innerHTML = `
      <div class="auth-shell">
        <div class="auth-card">
          <h2>Access denied</h2>
          <p class="muted">Only super admins can access the audit page.</p>
        </div>
      </div>
    `;
    return;
  }

  await bindTopbar(user);
  document.getElementById("sidebar").innerHTML = renderSidebar(user.role, "audit");

  const runAuditBtn = document.getElementById("runAuditBtn");
  if (runAuditBtn) {
    runAuditBtn.addEventListener("click", loadAudit);
  }

  const repairAllUsersBtn = document.getElementById("repairAllUsersBtn");
  if (repairAllUsersBtn) {
    repairAllUsersBtn.addEventListener("click", async () => {
      repairAllUsersBtn.disabled = true;
      repairAllUsersBtn.textContent = "Repairing...";
      try {
        await repairSection("users");
        await repairUsernameDirectory();
        repairAllUsersBtn.textContent = "Repair All Users";
        repairAllUsersBtn.disabled = false;
        await loadAudit();
      } catch (e) {
        repairAllUsersBtn.textContent = "Repair All Users";
        repairAllUsersBtn.disabled = false;
        alert(e.message || "Failed to repair users.");
      }
    });
  }

  await loadAudit();
});