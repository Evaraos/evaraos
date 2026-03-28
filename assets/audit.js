import {
  bindTopbar,
  requireAuth,
  renderSidebar,
  scanSystemDiscrepancies,
  normalizeUserDoc
} from "./app.js";

let currentUser = null;

function renderSection(title, items, type) {
  if (!items.length) {
    return `
      <div class="audit-card">
        <h2 style="margin-top:0;">${title}</h2>
        <div class="audit-empty">No discrepancies found.</div>
      </div>
    `;
  }

  return `
    <div class="audit-card">
      <h2 style="margin-top:0;">${title}</h2>
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
            type === "users"
              ? `
              <div class="audit-actions">
                <button class="btn repair-user-btn" data-id="${item.id}">Repair User</button>
              </div>
            `
              : ``
          }
        </div>
      `).join("")}
    </div>
  `;
}

async function loadAudit() {
  const root = document.getElementById("auditRoot");
  root.innerHTML = `<div class="glass-card">Scanning...</div>`;

  try {
    const data = await scanSystemDiscrepancies();

    root.innerHTML = [
      renderSection("Users", data.users, "users"),
      renderSection("Username Directory", data.usernames, "usernames"),
      renderSection("Companies", data.companies, "companies"),
      renderSection("Leads", data.leads, "leads"),
      renderSection("Jobs", data.jobs, "jobs"),
      renderSection("Services", data.services, "services")
    ].join("");

    document.querySelectorAll(".repair-user-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.textContent = "Repairing...";
        try {
          await normalizeUserDoc(btn.dataset.id);
          btn.textContent = "Fixed";
          await loadAudit();
        } catch (e) {
          btn.disabled = false;
          btn.textContent = "Repair User";
          alert(e.message || "Failed to repair user.");
        }
      });
    });
  } catch (e) {
    root.innerHTML = `<div class="glass-card">Audit failed: ${e.message || e}</div>`;
  }
}

requireAuth(async (user) => {
  currentUser = user;

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
      const data = await scanSystemDiscrepancies();
      for (const userIssue of data.users) {
        await normalizeUserDoc(userIssue.id);
      }
      btn.textContent = "Repair All Users";
      btn.disabled = false;
      await loadAudit();
    } catch (e) {
      btn.textContent = "Repair All Users";
      btn.disabled = false;
      alert(e.message || "Failed to repair users.");
    }
  });

  await loadAudit();
});
