import {
  requireAuth,
  bindTopbar,
  renderSidebar,
  fetchAllCollection
} from "./app.js";

import { canAccess } from "./roles.js";

const auditState = {
  user: null,
  logs: [],
  filtered: [],
  rollbackTarget: null
};

function formatDate(value) {
  if (!value) return "—";

  try {
    if (value?.seconds) {
      return new Date(value.seconds * 1000).toLocaleString();
    }
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

async function loadAudit(user) {
  auditState.user = user;
  auditState.logs = await fetchAllCollection("audit_logs", { max: 500 });
  auditState.filtered = [...auditState.logs].reverse();
}

function applyFilters() {
  const search = String(document.getElementById("auditSearchInput")?.value || "").trim().toLowerCase();
  const action = document.getElementById("auditActionFilter")?.value || "all";

  auditState.filtered = auditState.logs.filter(log => {
    const matchesAction = action === "all" ? true : String(log.action || "") === action;
    const haystack = [
      log.actorName,
      log.targetUserName,
      log.action,
      log.notes,
      log.oldRole,
      log.newRole,
      log.oldCompanyId,
      log.newCompanyId
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch = !search || haystack.includes(search);
    return matchesAction && matchesSearch;
  }).reverse();

  renderAudit();
}

function renderAudit() {
  const root = document.getElementById("auditRoot");
  const countLabel = document.getElementById("auditCountLabel");
  const analytics = document.getElementById("auditAnalyticsRoot");
  const suspicious = document.getElementById("auditSuspiciousRoot");
  const charts = document.getElementById("auditChartsRoot");

  if (countLabel) countLabel.textContent = `${auditState.filtered.length} logs`;

  if (analytics) {
    const uniqueActors = new Set(auditState.filtered.map(item => item.actorUserId).filter(Boolean)).size;
    const roleChanges = auditState.filtered.filter(item => String(item.action || "").includes("role")).length;
    const companyMoves = auditState.filtered.filter(item => String(item.action || "").includes("company")).length;

    analytics.innerHTML = `
      <div class="grid grid-3">
        <div class="card aurora-card shine-border">
          <h3>Total Visible Logs</h3>
          <p style="font-size:32px; font-weight:800;">${auditState.filtered.length}</p>
        </div>
        <div class="card aurora-card shine-border">
          <h3>Unique Actors</h3>
          <p style="font-size:32px; font-weight:800;">${uniqueActors}</p>
        </div>
        <div class="card aurora-card shine-border">
          <h3>Role / Company Changes</h3>
          <p style="font-size:32px; font-weight:800;">${roleChanges + companyMoves}</p>
        </div>
      </div>
    `;
  }

  if (suspicious) {
    const suspiciousLogs = auditState.filtered.filter(item =>
      String(item.action || "").includes("company") && String(item.oldCompanyId || "") !== String(item.newCompanyId || "")
    );

    suspicious.innerHTML = suspiciousLogs.length
      ? suspiciousLogs.slice(0, 5).map(item => `
          <div class="card aurora-card shine-border" style="margin-top:10px;">
            <strong>${item.targetUserName || "User"}</strong>
            <div class="muted" style="margin-top:8px;">
              ${item.action || "change"}<br>
              ${item.oldCompanyId || "—"} → ${item.newCompanyId || "—"}<br>
              ${formatDate(item.createdAt)}
            </div>
          </div>
        `).join("")
      : `<div class="audit-empty">No suspicious signals found.</div>`;
  }

  if (charts) {
    const counts = {};
    auditState.filtered.forEach(item => {
      const key = item.action || "unknown";
      counts[key] = (counts[key] || 0) + 1;
    });

    charts.innerHTML = Object.keys(counts).length
      ? `
          <div class="grid grid-3">
            ${Object.entries(counts).map(([key, value]) => `
              <div class="card aurora-card shine-border">
                <h3>${key}</h3>
                <p style="font-size:32px; font-weight:800;">${value}</p>
              </div>
            `).join("")}
          </div>
        `
      : `<div class="audit-empty">No chart data.</div>`;
  }

  if (!root) return;

  root.innerHTML = !auditState.filtered.length
    ? `<div class="audit-empty">No audit logs found.</div>`
    : auditState.filtered.map(item => `
        <div class="card aurora-card shine-border" style="margin-top:12px;">
          <div class="section-title-row">
            <div>
              <strong>${item.action || "audit_event"}</strong>
              <div class="muted" style="margin-top:8px;">
                Actor: ${item.actorName || "—"}<br>
                Target: ${item.targetUserName || "—"}<br>
                Date: ${formatDate(item.createdAt)}
              </div>
            </div>
          </div>

          <div class="muted" style="margin-top:12px;">
            Old Role: ${item.oldRole || "—"}<br>
            New Role: ${item.newRole || "—"}<br>
            Old Company: ${item.oldCompanyId || "—"}<br>
            New Company: ${item.newCompanyId || "—"}<br>
            Notes: ${item.notes || "—"}
          </div>
        </div>
      `).join("");
}

requireAuth(async (user) => {
  await bindTopbar(user, "Audit");

  const sidebar = document.getElementById("sidebar");
  if (sidebar) {
    sidebar.innerHTML = renderSidebar(user.role, "audit");
  }

  if (!canAccess(user.role, "audit")) {
    document.getElementById("auditRoot").innerHTML =
      `<section class="glass-card aurora-card shine-border">Access denied.</section>`;
    return;
  }

  try {
    await loadAudit(user);
    renderAudit();
  } catch (error) {
    console.error(error);
    document.getElementById("auditRoot").innerHTML =
      `<section class="glass-card aurora-card shine-border">Audit page failed: ${error.message || error}</section>`;
  }

  document.getElementById("auditSearchInput")?.addEventListener("input", applyFilters);
  document.getElementById("auditActionFilter")?.addEventListener("change", applyFilters);
  document.getElementById("refreshAuditBtn")?.addEventListener("click", async () => {
    await loadAudit(user);
    renderAudit();
  });
});