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
  cleanupUsernameDirectory,
  cleanupLegacyCompanyDocs
} from "./app.js";

let currentActionLock = false;

function ensureToastContainer() {
  let el = document.getElementById("auditToastContainer");
  if (!el) {
    el = document.createElement("div");
    el.id = "auditToastContainer";
    el.style.position = "fixed";
    el.style.top = "20px";
    el.style.right = "20px";
    el.style.zIndex = "9999";
    el.style.display = "flex";
    el.style.flexDirection = "column";
    el.style.gap = "10px";
    el.style.maxWidth = "320px";
    document.body.appendChild(el);
  }
  return el;
}

function showToast(message, variant = "success") {
  const container = ensureToastContainer();
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.padding = "14px 16px";
  toast.style.borderRadius = "16px";
  toast.style.backdropFilter = "blur(14px)";
  toast.style.background =
    variant === "error"
      ? "rgba(180,40,40,0.92)"
      : variant === "info"
      ? "rgba(35,35,50,0.92)"
      : "rgba(25,110,55,0.92)";
  toast.style.color = "#fff";
  toast.style.boxShadow = "0 12px 30px rgba(0,0,0,0.28)";
  toast.style.fontSize = "14px";
  toast.style.lineHeight = "1.4";
  toast.style.border = "1px solid rgba(255,255,255,0.12)";
  toast.style.opacity = "0";
  toast.style.transform = "translateY(-6px)";
  toast.style.transition = "all .22s ease";

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-6px)";
    setTimeout(() => toast.remove(), 220);
  }, 2800);
}

function setButtonLoading(btn, isLoading, loadingText = "Loading...") {
  if (!btn) return;
  if (isLoading) {
    btn.dataset.originalText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = `<span class="audit-spinner"></span> ${loadingText}`;
    btn.style.opacity = "0.8";
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.originalText || btn.textContent;
    btn.style.opacity = "1";
  }
}

function injectAuditStyles() {
  if (document.getElementById("auditExtraStyles")) return;

  const style = document.createElement("style");
  style.id = "auditExtraStyles";
  style.textContent = `
    .audit-hero{
      display:flex;
      justify-content:space-between;
      align-items:flex-start;
      gap:18px;
      flex-wrap:wrap;
    }
    .audit-button-stack,
    .audit-button-grid{
      display:flex;
      flex-direction:column;
      gap:12px;
      min-width:260px;
      width:100%;
      max-width:360px;
    }
    .audit-button-grid .btn,
    .audit-button-stack .btn{
      width:100%;
      justify-content:center;
    }
    .audit-section-header{
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:12px;
      flex-wrap:wrap;
      margin-bottom:8px;
    }
    .audit-section-header h2{
      margin:0;
    }
    .audit-row{
      border:1px solid rgba(255,255,255,.08);
      border-radius:24px;
      padding:18px;
      margin-top:16px;
      background:rgba(255,255,255,.02);
    }
    .audit-actions{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      margin-top:16px;
    }
    .audit-badge{
      display:inline-flex;
      align-items:center;
      padding:8px 12px;
      border-radius:999px;
      background:rgba(255,255,255,.07);
      margin:6px 8px 0 0;
      font-size:13px;
      line-height:1.2;
    }
    .audit-empty{
      color:#aeb8c7;
      margin-top:8px;
    }
    .audit-spinner{
      width:14px;
      height:14px;
      border:2px solid rgba(255,255,255,.35);
      border-top-color:#fff;
      border-radius:50%;
      display:inline-block;
      animation:auditSpin .8s linear infinite;
      vertical-align:middle;
    }
    @keyframes auditSpin{
      to{ transform:rotate(360deg); }
    }
    @media (max-width: 768px){
      .audit-button-grid,
      .audit-button-stack{
        max-width:none;
      }
    }
  `;
  document.head.appendChild(style);
}

function renderSystemAuditCard() {
  return `
    <section class="glass-card">
      <div class="audit-hero">
        <div>
          <h1 style="margin:0;">System Audit</h1>
          <p class="muted" style="margin:12px 0 0;">Super admin discrepancy checker and repair console.</p>
        </div>
        <div class="audit-button-stack">
          <button id="runAuditBtnTop" class="btn secondary">Run Audit</button>
          <button id="repairAllUsersBtnTop" class="btn">Repair All Users</button>
        </div>
      </div>
    </section>
  `;
}

function renderFullRepairCard() {
  return `
    <section class="glass-card">
      <div class="audit-hero">
        <div>
          <h2 style="margin:0;">Full System Repair</h2>
          <p class="muted" style="margin:12px 0 0;">Repairs users, usernames, companies, leads, jobs, and services.</p>
        </div>
        <div class="audit-button-grid">
          <button class="btn" id="repairEverythingBtn">Repair All System Data</button>
          <button class="btn secondary" id="repairUsernameDirectoryBtn">Repair Username Directory</button>
          <button class="btn secondary" id="canonicalizeCompaniesBtn">Canonicalize Companies</button>
        </div>
      </div>
    </section>
  `;
}

function renderSection(title, items, type, repairable = false) {
  if (!items.length) {
    return `
      <div class="audit-card">
        <div class="audit-section-header">
          <h2>${title}</h2>
          ${repairable ? `<button class="btn secondary repair-section-btn" data-type="${type}">Repair ${title}</button>` : ``}
        </div>
        <div class="audit-empty">No discrepancies found.</div>
      </div>
    `;
  }

  return `
    <div class="audit-card">
      <div class="audit-section-header">
        <h2>${title}</h2>
        ${repairable ? `<button class="btn secondary repair-section-btn" data-type="${type}">Repair ${title}</button>` : ``}
      </div>

      ${items.map((item) => `
        <div class="audit-row">
          <strong>${item.name || item.id}</strong>
          ${item.role ? `<div class="muted" style="margin-top:6px;">${item.role}</div>` : ""}

          ${
            item.missingFields?.length
              ? `<div style="margin-top:12px;"><strong>Missing Fields:</strong><br>${item.missingFields.map((field) => `<span class="audit-badge">${field}</span>`).join("")}</div>`
              : ``
          }

          ${
            item.mismatchFields?.length
              ? `<div style="margin-top:12px;"><strong>Mismatches:</strong><br>${item.mismatchFields.map((field) => `<span class="audit-badge">${field}</span>`).join("")}</div>`
              : ``
          }

          ${
            item.issues?.length
              ? `<div style="margin-top:12px;"><strong>Issues:</strong><br>${item.issues.map((field) => `<span class="audit-badge">${field}</span>`).join("")}</div>`
              : ``
          }

          ${
            repairable
              ? `
                <div class="audit-actions">
                  <button class="btn repair-item-btn" data-type="${type}" data-id="${item.id}">Repair</button>
                </div>
              `
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
  throw new Error(`Unknown repair type: ${type}`);
}

async function repairSection(type) {
  const data = await scanSystemDiscrepancies();
  const section = data[type] || [];
  for (const item of section) {
    await repairItem(type, item.id);
  }
}

async function runGuardedAction(button, loadingText, successText, fn) {
  if (currentActionLock) return;
  currentActionLock = true;
  setButtonLoading(button, true, loadingText);

  try {
    const result = await fn();
    setButtonLoading(button, false);
    showToast(successText, "success");
    currentActionLock = false;
    return result;
  } catch (e) {
    setButtonLoading(button, false);
    showToast(e.message || "Action failed.", "error");
    currentActionLock = false;
    throw e;
  }
}

async function wireAuditButtons() {
  document.getElementById("runAuditBtnTop")?.addEventListener("click", async (e) => {
    await runGuardedAction(e.currentTarget, "Scanning...", "Audit refreshed.", loadAudit);
  });

  document.getElementById("repairAllUsersBtnTop")?.addEventListener("click", async (e) => {
    await runGuardedAction(e.currentTarget, "Repairing users...", "User repair complete.", async () => {
      await repairSection("users");
      await cleanupUsernameDirectory();
      await loadAudit();
    });
  });

  document.getElementById("repairEverythingBtn")?.addEventListener("click", async (e) => {
    await runGuardedAction(e.currentTarget, "Repairing system...", "Full system repair complete.", async () => {
      await repairSection("users");
      await cleanupUsernameDirectory();
      await repairSection("companies");
      await cleanupLegacyCompanyDocs();
      await repairSection("leads");
      await repairSection("jobs");
      await repairSection("services");
      await loadAudit();
    });
  });

  document.getElementById("repairUsernameDirectoryBtn")?.addEventListener("click", async (e) => {
    await runGuardedAction(e.currentTarget, "Repairing usernames...", "Username directory repaired.", async () => {
      await cleanupUsernameDirectory();
      await loadAudit();
    });
  });

  document.getElementById("canonicalizeCompaniesBtn")?.addEventListener("click", async (e) => {
    await runGuardedAction(e.currentTarget, "Canonicalizing...", "Companies canonicalized.", async () => {
      await cleanupLegacyCompanyDocs();
      await loadAudit();
    });
  });

  document.querySelectorAll(".repair-item-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await runGuardedAction(btn, "Repairing...", "Item repaired.", async () => {
        await repairItem(btn.dataset.type, btn.dataset.id);
        if (btn.dataset.type === "companies") {
          await cleanupLegacyCompanyDocs();
        }
        await loadAudit();
      });
    });
  });

  document.querySelectorAll(".repair-section-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const pretty = btn.dataset.type.replace(/_/g, " ");
      await runGuardedAction(btn, "Repairing...", `${pretty} repaired.`, async () => {
        await repairSection(btn.dataset.type);
        if (btn.dataset.type === "companies") {
          await cleanupLegacyCompanyDocs();
        }
        if (btn.dataset.type === "users") {
          await cleanupUsernameDirectory();
        }
        await loadAudit();
      });
    });
  });
}

async function loadAudit() {
  injectAuditStyles();
  const root = document.getElementById("auditRoot");
  root.innerHTML = `
    ${renderSystemAuditCard()}
    ${renderFullRepairCard()}
    <div class="glass-card">Scanning...</div>
  `;

  try {
    const data = await scanSystemDiscrepancies();

    root.innerHTML = [
      renderSystemAuditCard(),
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
      ${renderSystemAuditCard()}
      ${renderFullRepairCard()}
      <div class="glass-card">Audit failed: ${e.message || e}</div>
    `;
    await wireAuditButtons();
    showToast(`Audit failed: ${e.message || e}`, "error");
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
  const sidebar = document.getElementById("sidebar");
  if (sidebar) {
    sidebar.innerHTML = renderSidebar(user.role, "audit");
  }

  await loadAudit();
});