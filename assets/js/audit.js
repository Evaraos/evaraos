import {
  requireAuth,
  bindTopbar
} from "./app.js";

import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const auditState = {
  user: null,
  logs: [],
  search: "",
  actionFilter: "all",
  autoRefreshHandle: null,
  isRefreshing: false,
  pendingRollbackLogId: null,
  activeWarnings: []
};

const ACTION_LABELS = {
  role_drag_move: "Role Change",
  company_drag_move: "Company Move",
  company_and_role_drag_move: "Company + Role Move",
  company_drag_move_keep_role: "Company Move Keep Role",
  modal_user_edit: "Manual Edit",
  modal_role_edit: "Manual Role Edit",
  modal_company_edit: "Manual Company Edit",
  modal_company_and_role_edit: "Manual Company + Role Edit",
  rollback_change: "Rollback Change"
};

const ROLLBACKABLE_ACTIONS = new Set([
  "role_drag_move",
  "company_drag_move",
  "company_and_role_drag_move",
  "company_drag_move_keep_role",
  "modal_role_edit",
  "modal_company_edit",
  "modal_company_and_role_edit"
]);

function injectAuditStyles() {
  if (document.getElementById("auditUpgradeStyles")) return;

  const style = document.createElement("style");
  style.id = "auditUpgradeStyles";
  style.textContent = `
    .audit-stack{
      display:flex;
      flex-direction:column;
      gap:14px;
    }
    .audit-card{
      border-radius:20px;
      padding:18px;
      background:rgba(255,255,255,.03);
      border:1px solid rgba(255,255,255,.08);
      display:flex;
      flex-direction:column;
      gap:12px;
    }
    .audit-head{
      display:flex;
      justify-content:space-between;
      align-items:flex-start;
      gap:14px;
      flex-wrap:wrap;
    }
    .audit-title{
      font-weight:800;
      font-size:16px;
      line-height:1.2;
    }
    .audit-sub{
      color:#aeb8c8;
      font-size:12px;
      margin-top:6px;
      line-height:1.45;
    }
    .audit-chip-row{
      display:flex;
      gap:8px;
      flex-wrap:wrap;
    }
    .audit-chip{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding:6px 10px;
      border-radius:999px;
      background:rgba(255,255,255,.08);
      font-size:12px;
    }
    .audit-grid{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:12px;
    }
    .audit-box{
      border-radius:16px;
      padding:12px 14px;
      background:rgba(255,255,255,.03);
      border:1px solid rgba(255,255,255,.06);
    }
    .audit-label{
      color:#aeb8c8;
      font-size:12px;
      margin-bottom:6px;
    }
    .audit-value{
      font-size:14px;
      line-height:1.45;
      word-break:break-word;
    }
    .audit-empty{
      color:#aeb8c8;
      padding:8px 0 4px;
    }
    .audit-analytics-grid{
      display:grid;
      grid-template-columns:repeat(4,minmax(0,1fr));
      gap:14px;
    }
    .audit-analytics-card{
      border-radius:18px;
      padding:16px;
      background:rgba(255,255,255,.03);
      border:1px solid rgba(255,255,255,.06);
    }
    .audit-analytics-label{
      color:#aeb8c8;
      font-size:12px;
      margin-bottom:8px;
    }
    .audit-analytics-value{
      font-size:26px;
      font-weight:800;
      line-height:1.1;
    }
    .audit-leaderboard{
      display:flex;
      flex-direction:column;
      gap:10px;
    }
    .audit-leaderboard-row{
      display:flex;
      justify-content:space-between;
      gap:12px;
      align-items:center;
      padding:12px 14px;
      border-radius:16px;
      background:rgba(255,255,255,.03);
      border:1px solid rgba(255,255,255,.06);
    }
    .audit-warning{
      border-radius:18px;
      padding:14px 16px;
      background:rgba(180,40,40,.12);
      border:1px solid rgba(180,40,40,.28);
    }
    .audit-warning-title{
      font-weight:700;
      margin-bottom:6px;
    }
    .audit-actions{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      margin-top:6px;
    }
    .audit-chart-grid{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:16px;
    }
    .audit-chart-card{
      border-radius:18px;
      padding:16px;
      background:rgba(255,255,255,.03);
      border:1px solid rgba(255,255,255,.06);
    }
    .audit-chart-stack{
      display:flex;
      flex-direction:column;
      gap:12px;
      margin-top:12px;
    }
    .audit-chart-row{
      display:grid;
      grid-template-columns:120px minmax(0,1fr) 54px;
      gap:10px;
      align-items:center;
    }
    .audit-chart-label{
      font-size:12px;
      color:#fff;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
    .audit-chart-track{
      width:100%;
      height:12px;
      background:rgba(255,255,255,.08);
      border-radius:999px;
      overflow:hidden;
    }
    .audit-chart-bar{
      height:100%;
      border-radius:999px;
      background:linear-gradient(90deg, rgba(227,6,19,.92), rgba(255,106,61,.92));
    }
    .audit-chart-value{
      text-align:right;
      font-size:12px;
      color:#aeb8c8;
    }
    @media (max-width: 980px){
      .audit-analytics-grid,
      .audit-chart-grid{
        grid-template-columns:repeat(2,minmax(0,1fr));
      }
    }
    @media (max-width: 760px){
      .audit-grid,
      .audit-analytics-grid,
      .audit-chart-grid{
        grid-template-columns:1fr;
      }
      .audit-chart-row{
        grid-template-columns:90px minmax(0,1fr) 42px;
      }
    }
  `;
  document.head.appendChild(style);
}

function showToast(message, variant = "success") {
  let wrap = document.getElementById("auditToastWrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "auditToastWrap";
    wrap.style.position = "fixed";
    wrap.style.top = "18px";
    wrap.style.right = "18px";
    wrap.style.zIndex = "10000";
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.gap = "10px";
    document.body.appendChild(wrap);
  }

  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.padding = "14px 16px";
  toast.style.borderRadius = "16px";
  toast.style.color = "#fff";
  toast.style.maxWidth = "320px";
  toast.style.boxShadow = "0 12px 30px rgba(0,0,0,.28)";
  toast.style.background =
    variant === "error"
      ? "rgba(180,40,40,.94)"
      : "rgba(25,110,55,.94)";

  wrap.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}

function formatTimestamp(timestamp) {
  if (!timestamp) return "—";

  if (timestamp?.seconds) {
    return new Date(timestamp.seconds * 1000).toLocaleString();
  }

  if (typeof timestamp === "string") {
    const parsed = new Date(timestamp);
    if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleString();
  }

  return "—";
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function labelForAction(action) {
  return ACTION_LABELS[action] || action || "Unknown";
}

async function loadLogs() {
  const qRef = query(
    collection(db, "audit_logs"),
    orderBy("createdAt", "desc"),
    limit(400)
  );

  const snap = await getDocs(qRef);
  auditState.logs = snap.docs.map((d) => ({
    id: d.id,
    ...d.data()
  }));
}

function getFilteredLogs() {
  const q = normalizeText(auditState.search);
  const actionFilter = auditState.actionFilter;

  return auditState.logs.filter((log) => {
    const matchesAction = actionFilter === "all" ? true : log.action === actionFilter;

    const haystack = [
      log.action,
      log.actorName,
      log.actorRole,
      log.targetUserName,
      log.oldRole,
      log.newRole,
      log.oldCompanyId,
      log.newCompanyId,
      log.notes
    ]
      .filter(Boolean)
      .map(normalizeText)
      .join(" ");

    const matchesSearch = !q || haystack.includes(q);

    return matchesAction && matchesSearch;
  });
}

function isRollbackAllowed(log) {
  if (!ROLLBACKABLE_ACTIONS.has(log.action)) return false;
  if (!log.targetUserId) return false;
  return true;
}

function isRecentLog(log) {
  if (!log?.createdAt?.seconds) return false;
  const diffMs = Date.now() - log.createdAt.seconds * 1000;
  return diffMs <= 1000 * 60 * 60 * 24;
}

function renderAuditCard(log) {
  const roleLine =
    log.oldRole || log.newRole
      ? `${log.oldRole || "—"} → ${log.newRole || "—"}`
      : "—";

  const companyLine =
    log.oldCompanyId || log.newCompanyId
      ? `${log.oldCompanyId || "—"} → ${log.newCompanyId || "—"}`
      : "—";

  return `
    <div class="audit-card">
      <div class="audit-head">
        <div>
          <div class="audit-title">${labelForAction(log.action)}</div>
          <div class="audit-sub">${formatTimestamp(log.createdAt)}</div>
        </div>

        <div class="audit-chip-row">
          <span class="audit-chip">${log.type || "log"}</span>
          <span class="audit-chip">${log.actorRole || "unknown actor role"}</span>
          ${isRecentLog(log) ? `<span class="audit-chip">Recent</span>` : ""}
        </div>
      </div>

      <div class="audit-grid">
        <div class="audit-box">
          <div class="audit-label">Actor</div>
          <div class="audit-value">
            ${log.actorName || "—"}<br>
            ${log.actorUserId || ""}
          </div>
        </div>

        <div class="audit-box">
          <div class="audit-label">Target User</div>
          <div class="audit-value">
            ${log.targetUserName || "—"}<br>
            ${log.targetUserId || ""}
          </div>
        </div>

        <div class="audit-box">
          <div class="audit-label">Role Change</div>
          <div class="audit-value">${roleLine}</div>
        </div>

        <div class="audit-box">
          <div class="audit-label">Company Change</div>
          <div class="audit-value">${companyLine}</div>
        </div>
      </div>

      ${
        log.notes
          ? `
            <div class="audit-box">
              <div class="audit-label">Notes</div>
              <div class="audit-value">${log.notes}</div>
            </div>
          `
          : ""
      }

      <div class="audit-actions">
        ${
          isRollbackAllowed(log)
            ? `<button class="btn secondary rollback-btn" data-log-id="${log.id}">Undo Change</button>`
            : ""
        }
      </div>
    </div>
  `;
}

function buildActorLeaderboard(logs) {
  const counts = new Map();

  logs.forEach((log) => {
    const key = log.actorName || log.actorUserId || "Unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
}

function renderAnalytics() {
  const logs = getFilteredLogs();
  const recent24h = logs.filter((log) => {
    if (!log?.createdAt?.seconds) return false;
    return Date.now() - log.createdAt.seconds * 1000 <= 1000 * 60 * 60 * 24;
  });

  const roleMoves = logs.filter((log) =>
    ["role_drag_move", "company_and_role_drag_move", "modal_role_edit", "modal_company_and_role_edit"].includes(log.action)
  ).length;

  const companyMoves = logs.filter((log) =>
    ["company_drag_move", "company_and_role_drag_move", "company_drag_move_keep_role", "modal_company_edit", "modal_company_and_role_edit"].includes(log.action)
  ).length;

  const rollbacks = logs.filter((log) => log.action === "rollback_change").length;
  const topActors = buildActorLeaderboard(logs);

  document.getElementById("auditAnalyticsRoot").innerHTML = `
    <div class="audit-analytics-grid">
      <div class="audit-analytics-card">
        <div class="audit-analytics-label">Visible Logs</div>
        <div class="audit-analytics-value">${logs.length}</div>
      </div>
      <div class="audit-analytics-card">
        <div class="audit-analytics-label">Last 24h Activity</div>
        <div class="audit-analytics-value">${recent24h.length}</div>
      </div>
      <div class="audit-analytics-card">
        <div class="audit-analytics-label">Role Changes</div>
        <div class="audit-analytics-value">${roleMoves}</div>
      </div>
      <div class="audit-analytics-card">
        <div class="audit-analytics-label">Company Moves / Rollbacks</div>
        <div class="audit-analytics-value">${companyMoves + rollbacks}</div>
      </div>
    </div>

    <div class="glass-card" style="margin-top:16px; padding:16px;">
      <h3 style="margin:0 0 12px 0;">Top Actors</h3>
      ${
        topActors.length
          ? `<div class="audit-leaderboard">
              ${topActors.map(([name, count]) => `
                <div class="audit-leaderboard-row">
                  <strong>${name}</strong>
                  <span class="chip">${count} changes</span>
                </div>
              `).join("")}
            </div>`
          : `<div class="audit-empty">No actor analytics available.</div>`
      }
    </div>
  `;
}

function groupCounts(logs, bucketFn) {
  const map = new Map();
  logs.forEach((log) => {
    const key = bucketFn(log);
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
}

function renderChartCard(title, items) {
  const max = Math.max(...items.map(([, count]) => count), 0);

  return `
    <div class="audit-chart-card">
      <h3 style="margin:0;">${title}</h3>
      ${
        items.length
          ? `<div class="audit-chart-stack">
              ${items.map(([label, count]) => {
                const width = max ? (count / max) * 100 : 0;
                return `
                  <div class="audit-chart-row">
                    <div class="audit-chart-label">${label}</div>
                    <div class="audit-chart-track">
                      <div class="audit-chart-bar" style="width:${width}%;"></div>
                    </div>
                    <div class="audit-chart-value">${count}</div>
                  </div>
                `;
              }).join("")}
            </div>`
          : `<div class="audit-empty" style="margin-top:12px;">No chart data.</div>`
      }
    </div>
  `;
}

function renderCharts() {
  const logs = getFilteredLogs();
  const actorCounts = groupCounts(logs, (log) => log.actorName || log.actorUserId || "");
  const actionCounts = groupCounts(logs, (log) => labelForAction(log.action));
  const targetCounts = groupCounts(logs, (log) => log.targetUserName || log.targetUserId || "");

  document.getElementById("auditChartsRoot").innerHTML = `
    <div class="audit-chart-grid">
      ${renderChartCard("Changes by Actor", actorCounts)}
      ${renderChartCard("Changes by Action", actionCounts)}
      ${renderChartCard("Most Changed Users", targetCounts)}
    </div>
  `;
}

function buildSuspiciousWarnings() {
  const logs = auditState.logs;
  const warnings = [];
  const actorBuckets = new Map();

  logs.forEach((log) => {
    if (!log?.createdAt?.seconds) return;
    const key = log.actorUserId || log.actorName || "unknown";
    if (!actorBuckets.has(key)) actorBuckets.set(key, []);
    actorBuckets.get(key).push(log);
  });

  actorBuckets.forEach((bucket, actorKey) => {
    const recentHour = bucket.filter((log) => {
      return Date.now() - log.createdAt.seconds * 1000 <= 1000 * 60 * 60;
    });

    if (recentHour.length >= 8) {
      warnings.push({
        id: `high_volume_${actorKey}`,
        title: "High change volume",
        text: `${bucket[0]?.actorName || actorKey} made ${recentHour.length} changes in the last hour.`,
        severity: "high"
      });
    }

    const companyMoves = recentHour.filter((log) =>
      ["company_drag_move", "company_and_role_drag_move", "company_drag_move_keep_role", "modal_company_edit", "modal_company_and_role_edit"].includes(log.action)
    );

    if (companyMoves.length >= 3) {
      warnings.push({
        id: `company_moves_${actorKey}`,
        title: "Frequent company moves",
        text: `${bucket[0]?.actorName || actorKey} moved users across companies ${companyMoves.length} times in the last hour.`,
        severity: "medium"
      });
    }
  });

  const recentRollbacks = logs.filter((log) => {
    if (log.action !== "rollback_change" || !log?.createdAt?.seconds) return false;
    return Date.now() - log.createdAt.seconds * 1000 <= 1000 * 60 * 60 * 24;
  });

  if (recentRollbacks.length >= 5) {
    warnings.push({
      id: "heavy_rollback_usage",
      title: "Heavy rollback usage",
      text: `${recentRollbacks.length} rollback actions were triggered in the last 24 hours.`,
      severity: "medium"
    });
  }

  return warnings;
}

async function queueSuspiciousEmailAlerts(warnings) {
  for (const warning of warnings) {
    const alertRef = doc(db, "security_alerts", warning.id);
    const existing = await getDoc(alertRef);

    if (existing.exists()) {
      const existingData = existing.data();
      const createdAtSeconds = existingData?.createdAt?.seconds || 0;
      const ageMs = Date.now() - createdAtSeconds * 1000;

      if (ageMs < 1000 * 60 * 60) {
        continue;
      }
    }

    await setDoc(alertRef, {
      type: "suspicious_audit_activity",
      title: warning.title,
      text: warning.text,
      severity: warning.severity,
      status: "queued",
      createdAt: serverTimestamp(),
      createdBy: auditState.user?.id || auditState.user?.uid || ""
    });
  }
}

async function renderSuspiciousActivity() {
  const warnings = buildSuspiciousWarnings();
  auditState.activeWarnings = warnings;

  document.getElementById("auditSuspiciousRoot").innerHTML = warnings.length
    ? warnings.map((warning) => `
        <div class="audit-warning" style="margin-bottom:12px;">
          <div class="audit-warning-title">${warning.title}</div>
          <div>${warning.text}</div>
        </div>
      `).join("")
    : `<div class="audit-empty">No suspicious activity detected right now.</div>`;

  if (warnings.length) {
    await queueSuspiciousEmailAlerts(warnings);
  }
}

function renderLogs() {
  const filtered = getFilteredLogs();
  const root = document.getElementById("auditRoot");
  const countLabel = document.getElementById("auditCountLabel");

  countLabel.textContent = `${filtered.length} log${filtered.length === 1 ? "" : "s"}`;

  root.innerHTML = filtered.length
    ? `<div class="audit-stack">${filtered.map(renderAuditCard).join("")}</div>`
    : `<div class="audit-empty">No audit logs match your current filters.</div>`;

  wireRollbackButtons();
  renderAnalytics();
  renderCharts();
  renderSuspiciousActivity();
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv() {
  const rows = getFilteredLogs();

  const headers = [
    "Time",
    "Action",
    "Actor Name",
    "Actor Role",
    "Target User",
    "Old Role",
    "New Role",
    "Old Company",
    "New Company",
    "Notes"
  ];

  const body = rows.map((log) => [
    formatTimestamp(log.createdAt),
    labelForAction(log.action),
    log.actorName || "",
    log.actorRole || "",
    log.targetUserName || "",
    log.oldRole || "",
    log.newRole || "",
    log.oldCompanyId || "",
    log.newCompanyId || "",
    log.notes || ""
  ]);

  const csv = [
    headers.map(csvEscape).join(","),
    ...body.map((row) => row.map(csvEscape).join(","))
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit_logs_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportPdf() {
  const rows = getFilteredLogs();
  const html = `
    <html>
      <head>
        <title>Audit Logs PDF</title>
        <style>
          body{font-family:Arial,Helvetica,sans-serif;color:#000;padding:24px;}
          h1,h2{margin:0 0 12px 0;}
          .meta{color:#444;font-size:12px;margin-bottom:18px;}
          table{width:100%;border-collapse:collapse;margin-top:12px;}
          th,td{border:1px solid #ccc;padding:8px;text-align:left;font-size:12px;vertical-align:top;}
          th{background:#f2f2f2;}
        </style>
      </head>
      <body>
        <h1>Audit Logs</h1>
        <div class="meta">
          Generated: ${new Date().toLocaleString()}<br>
          Visible Logs: ${rows.length}
        </div>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Target</th>
              <th>Role</th>
              <th>Company</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((log) => `
              <tr>
                <td>${formatTimestamp(log.createdAt)}</td>
                <td>${labelForAction(log.action)}</td>
                <td>${log.actorName || ""}<br>${log.actorRole || ""}</td>
                <td>${log.targetUserName || ""}</td>
                <td>${log.oldRole || "—"} → ${log.newRole || "—"}</td>
                <td>${log.oldCompanyId || "—"} → ${log.newCompanyId || "—"}</td>
                <td>${log.notes || ""}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </body>
    </html>
  `;

  const printWindow = window.open("", "_blank", "width=1100,height=900");
  if (!printWindow) {
    showToast("Popup blocked. Allow popups for PDF export.", "error");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
  }, 250);
}

function openRollbackReasonModal(logId) {
  auditState.pendingRollbackLogId = logId;
  document.getElementById("rollbackReasonInput").value = "";
  document.getElementById("rollbackReasonModal").classList.add("open");
}

function closeRollbackReasonModal() {
  auditState.pendingRollbackLogId = null;
  document.getElementById("rollbackReasonModal").classList.remove("open");
}

async function rollbackLogChange(logId, reason) {
  const log = auditState.logs.find((item) => item.id === logId);
  if (!log) {
    showToast("Audit log not found.", "error");
    return;
  }

  if (!isRollbackAllowed(log)) {
    showToast("This change cannot be rolled back.", "error");
    return;
  }

  const targetRef = doc(db, "users", log.targetUserId);
  const targetSnap = await getDoc(targetRef);

  if (!targetSnap.exists()) {
    showToast("Target user no longer exists.", "error");
    return;
  }

  const patch = {};

  if (log.oldRole !== undefined && log.oldRole !== null && log.oldRole !== "") {
    patch.role = log.oldRole;
  }

  if (log.oldCompanyId !== undefined && log.oldCompanyId !== null && log.oldCompanyId !== "") {
    patch.companyId = log.oldCompanyId;
  }

  if (patch.role) {
    const roleLevels = {
      admin: 2,
      manager: 3,
      operations_coordinator: 3,
      sales_rep: 4,
      technician: 5,
      hr: 3
    };
    const roleDefaults = {
      admin: ["manage_users", "approve", "full_company"],
      manager: ["leads", "jobs", "customers"],
      operations_coordinator: ["jobs", "customers"],
      sales_rep: ["leads", "convert"],
      technician: ["jobs"],
      hr: ["users", "staff"]
    };

    patch.organizationLevel = roleLevels[patch.role] || 6;
    patch.permissions = roleDefaults[patch.role] || [];
  }

  await updateDoc(targetRef, patch);

  await addDoc(collection(db, "audit_logs"), {
    type: "org_chart_change",
    action: "rollback_change",
    targetUserId: log.targetUserId || "",
    targetUserName: log.targetUserName || "",
    actorUserId: auditState.user?.id || auditState.user?.uid || "",
    actorName: auditState.user?.name || auditState.user?.email || "",
    actorRole: auditState.user?.role || "",
    oldRole: log.newRole || null,
    newRole: log.oldRole || null,
    oldCompanyId: log.newCompanyId || null,
    newCompanyId: log.oldCompanyId || null,
    notes: `Rollback of audit log ${log.id}. Reason: ${reason || "No reason provided."}`,
    createdAt: serverTimestamp()
  });

  showToast("Change rolled back.");
  await refreshAudit();
}

function wireRollbackButtons() {
  document.querySelectorAll(".rollback-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      openRollbackReasonModal(btn.dataset.logId);
    });
  });
}

async function refreshAudit() {
  if (auditState.isRefreshing) return;
  auditState.isRefreshing = true;

  try {
    await loadLogs();
    renderLogs();
  } finally {
    auditState.isRefreshing = false;
  }
}

function wireEvents() {
  document.getElementById("auditSearchInput")?.addEventListener("input", (e) => {
    auditState.search = e.target.value || "";
    renderLogs();
  });

  document.getElementById("auditActionFilter")?.addEventListener("change", (e) => {
    auditState.actionFilter = e.target.value || "all";
    renderLogs();
  });

  document.getElementById("refreshAuditBtn")?.addEventListener("click", async () => {
    document.getElementById("auditRoot").innerHTML = "Refreshing audit logs...";
    await refreshAudit();
    showToast("Audit refreshed.");
  });

  document.getElementById("exportCsvBtn")?.addEventListener("click", () => {
    exportCsv();
    showToast("CSV exported.");
  });

  document.getElementById("exportPdfBtn")?.addEventListener("click", () => {
    exportPdf();
    showToast("PDF print window opened.");
  });

  document.getElementById("closeRollbackModalBtn")?.addEventListener("click", closeRollbackReasonModal);
  document.getElementById("cancelRollbackBtn")?.addEventListener("click", closeRollbackReasonModal);

  document.getElementById("confirmRollbackBtn")?.addEventListener("click", async () => {
    const reason = document.getElementById("rollbackReasonInput").value.trim();
    const logId = auditState.pendingRollbackLogId;
    if (!logId) return;

    try {
      await rollbackLogChange(logId, reason);
      closeRollbackReasonModal();
    } catch (e) {
      showToast(e.message || "Rollback failed.", "error");
    }
  });
}

function startLiveFeed() {
  stopLiveFeed();
  auditState.autoRefreshHandle = setInterval(async () => {
    await refreshAudit();
  }, 20000);
}

function stopLiveFeed() {
  if (auditState.autoRefreshHandle) {
    clearInterval(auditState.autoRefreshHandle);
    auditState.autoRefreshHandle = null;
  }
}

requireAuth(async (user) => {
  injectAuditStyles();
  await bindTopbar(user);

  if (user.role !== "super_admin") {
    document.body.innerHTML = `
      <header id="topbar"></header>
      <main class="page-container">
        <section class="glass-card">
          <h2 style="margin:0;">Access denied</h2>
          <p class="muted" style="margin:10px 0 0;">Only super admins can view audit logs.</p>
        </section>
      </main>
    `;
    return;
  }

  auditState.user = user;

  try {
    await loadLogs();
    renderLogs();
    wireEvents();
    startLiveFeed();

    window.addEventListener("beforeunload", stopLiveFeed);
  } catch (e) {
    document.getElementById("auditRoot").innerHTML = `Audit page failed: ${e.message || e}`;
  }
});
