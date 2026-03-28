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
  limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const auditState = {
  user: null,
  logs: [],
  search: "",
  actionFilter: "all"
};

const ACTION_LABELS = {
  role_drag_move: "Role Change",
  company_drag_move: "Company Move",
  company_and_role_drag_move: "Company + Role Move",
  company_drag_move_keep_role: "Company Move Keep Role",
  modal_user_edit: "Manual Edit",
  modal_role_edit: "Manual Role Edit",
  modal_company_edit: "Manual Company Edit",
  modal_company_and_role_edit: "Manual Company + Role Edit"
};

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
    @media (max-width: 760px){
      .audit-grid{
        grid-template-columns:1fr;
      }
    }
  `;
  document.head.appendChild(style);
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
    limit(300)
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
          <div class="audit-sub">
            ${formatTimestamp(log.createdAt)}
          </div>
        </div>

        <div class="audit-chip-row">
          <span class="audit-chip">${log.type || "log"}</span>
          <span class="audit-chip">${log.actorRole || "unknown actor role"}</span>
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
    </div>
  `;
}

function renderLogs() {
  const filtered = getFilteredLogs();
  const root = document.getElementById("auditRoot");
  const countLabel = document.getElementById("auditCountLabel");

  countLabel.textContent = `${filtered.length} log${filtered.length === 1 ? "" : "s"}`;

  root.innerHTML = filtered.length
    ? `<div class="audit-stack">${filtered.map(renderAuditCard).join("")}</div>`
    : `<div class="audit-empty">No audit logs match your current filters.</div>`;
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
    await loadLogs();
    renderLogs();
  });
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
  } catch (e) {
    document.getElementById("auditRoot").innerHTML = `Audit page failed: ${e.message || e}`;
  }
});