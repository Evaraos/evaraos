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

async function loadAudit() {
  const root = document.getElementById("auditRoot");
  root.innerHTML = `<div class="glass-card">Scanning...</div>`;

  try {
    const data = await scanSystemDiscrepancies();

    root.innerHTML = [
      renderSection("Users", data.users, "users", true),
      renderSection("Username Directory", data.usernames, "usernames", false),
      renderSection("Companies", data.companies, "companies", true),
      renderSection("Leads", data.leads, "leads", true),
      renderSection("Jobs", data.jobs, "jobs", true),
      renderSection("Services", data.services, "services", true)
    ].join("");

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
  } catch (e) {
    root.innerHTML = `<div class="glass-card">Audit failed: ${e.message || e}</div>`;
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

  document.getElementById("runAuditBtn").addEventListener("click", loadAudit);

  document.getElementById("repairAllUsersBtn").addEventListener("click", async () => {
    const btn = document.getElementById("repairAllUsersBtn");
    btn.disabled = true;
    btn.textContent = "Repairing...";
    try {
      await repairSection("users");
      await repairUsernameDirectory();
      btn.textContent = "Repair All Users";
      btn.disabled = false;
      await loadAudit();
    } catch (e) {
      btn.textContent = "Repair All Users";
      btn.disabled = false;
      alert(e.message || "Failed to repair users.");
    }
  });

  const root = document.getElementById("auditRoot");
  const fullRepairWrap = document.createElement("section");
  fullRepairWrap.className = "glass-card";
  fullRepairWrap.innerHTML = `
    <div class="action-row" style="justify-content:space-between;align-items:center;">
      <div>
        <h2 style="margin:0;">Full System Repair</h2>
        <p class="muted" style="margin:8px 0 0;">Repairs users, username directory, companies, leads, jobs, and services.</p>
      </div>
      <button class="btn" id="repairEverythingBtn">Repair All System Data</button>
    </div>
  `;
  root.parentNode.insertBefore(fullRepairWrap, root);

  document.getElementById("repairEverythingBtn").addEventListener("click", async () => {
    const btn = document.getElementById("repairEverythingBtn");
    btn.disabled = true;
    btn.textContent = "Repairing Everything...";
    try {
      await repairSection("users");
      await repairUsernameDirectory();
      await repairSection("companies");
      await repairSection("leads");
      await repairSection("jobs");
      await repairSection("services");
      btn.textContent = "Repair All System Data";
      btn.disabled = false;
      await loadAudit();
    } catch (e) {
      btn.textContent = "Repair All System Data";
      btn.disabled = false;
      alert(e.message || "Failed to repair all system data.");
    }
  });

  await loadAudit();
});