import {
  bindTopbar,
  requireAuth,
  fetchAllCollection,
  fetchUsersByCompany,
  createSalesRep,
  updateSalesRep
} from "./app.js";

import { canAccess } from "./roles.js";

const salesRepState = {
  user: null,
  reps: [],
  editingId: null
};

function showToast(message, variant = "success") {
  let container = document.getElementById("salesRepToastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "salesRepToastContainer";
    container.style.position = "fixed";
    container.style.top = "20px";
    container.style.right = "20px";
    container.style.zIndex = "9999";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "10px";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.padding = "14px 16px";
  toast.style.borderRadius = "16px";
  toast.style.background =
    variant === "error" ? "rgba(180,40,40,.94)" : "rgba(25,110,55,.94)";
  toast.style.color = "#fff";
  toast.style.boxShadow = "0 12px 30px rgba(0,0,0,.28)";
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 2600);
}

function injectStyles() {
  if (document.getElementById("salesRepsUpgradeStyles")) return;

  const style = document.createElement("style");
  style.id = "salesRepsUpgradeStyles";
  style.textContent = `
    .page-main{
      display:flex;
      flex-direction:column;
      gap:22px;
      padding:22px;
    }
    .card-grid{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:16px;
    }
    .rep-card{
      border-radius:24px;
      padding:18px;
      background:rgba(255,255,255,.03);
      border:1px solid rgba(255,255,255,.08);
      display:flex;
      flex-direction:column;
      gap:12px;
    }
    .rep-actions{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      margin-top:8px;
    }
    .muted{
      color:#aeb8c8;
      font-size:13px;
    }
    .modal-backdrop{
      position:fixed;
      inset:0;
      background:rgba(0,0,0,.45);
      backdrop-filter:blur(8px);
      display:none;
      align-items:center;
      justify-content:center;
      z-index:9998;
      padding:18px;
    }
    .modal-backdrop.open{
      display:flex;
    }
    .modal-card{
      width:min(720px,100%);
      max-height:90vh;
      overflow:auto;
      border-radius:28px;
      background:rgba(14,16,24,.96);
      border:1px solid rgba(255,255,255,.08);
      padding:22px;
      box-shadow:0 25px 60px rgba(0,0,0,.35);
    }
    .form-grid{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:14px;
      margin-top:16px;
    }
    .full{
      grid-column:1/-1;
    }
    .field{
      display:flex;
      flex-direction:column;
      gap:8px;
    }
    .field label{
      font-size:13px;
      color:#b4bfd0;
    }
    .field input,
    .field select,
    .field textarea{
      width:100%;
      padding:14px 16px;
      border-radius:16px;
      border:1px solid rgba(255,255,255,.08);
      background:rgba(255,255,255,.04);
      color:#fff;
      outline:none;
    }
    .top-actions{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
    }
    .empty-state{
      color:#aeb8c8;
      padding:12px 0 4px;
    }
    .chip{
      display:inline-flex;
      padding:6px 10px;
      border-radius:999px;
      background:rgba(255,255,255,.08);
      font-size:12px;
      margin:6px 8px 0 0;
      text-transform:capitalize;
    }
    @media (max-width: 700px){
      .card-grid{ grid-template-columns:1fr; }
      .form-grid{ grid-template-columns:1fr; }
    }
  `;
  document.head.appendChild(style);
}

async function loadSalesReps(user) {
  salesRepState.user = user;

  const users = user.role === "super_admin"
    ? await fetchAllCollection("users")
    : await fetchUsersByCompany(user.companyId);

  salesRepState.reps = users.filter((item) => item.role === "sales_rep");
}

function openRepModal(rep = null) {
  salesRepState.editingId = rep?.id || null;
  document.getElementById("repModal").classList.add("open");
  document.getElementById("repModalTitle").textContent = rep ? "Edit Sales Rep" : "Add Sales Rep";

  document.getElementById("repFullName").value = rep?.name || "";
  document.getElementById("repUsername").value = rep?.username || "";
  document.getElementById("repEmail").value = rep?.email || "";
  document.getElementById("repPhone").value = rep?.phone || "";
  document.getElementById("repStatus").value = rep?.status || "active";
  document.getElementById("repNotes").value = rep?.notes || "";
}

function closeRepModal() {
  document.getElementById("repModal").classList.remove("open");
  salesRepState.editingId = null;
}

function renderPage() {
  const root = document.getElementById("salesRepsRoot");
  root.innerHTML = `
    <main class="page-main">
      <section class="glass-card">
        <div class="section-title-row">
          <div>
            <h1 style="margin:0;">Sales Reps Management</h1>
            <p class="muted" style="margin:10px 0 0;">Add, edit, and manage your sales team.</p>
          </div>
          <div class="top-actions">
            <button class="btn" id="openRepModalBtn">Add Sales Rep</button>
          </div>
        </div>
      </section>

      <section class="glass-card">
        <div class="section-title-row">
          <h2>Sales Reps List</h2>
          <div class="muted">${salesRepState.reps.length} rep(s)</div>
        </div>

        ${
          !salesRepState.reps.length
            ? `<div class="empty-state">No sales reps found.</div>`
            : `
              <div class="card-grid" style="margin-top:14px;">
                ${salesRepState.reps
                  .map(
                    (rep) => `
                      <div class="rep-card">
                        <div>
                          <strong>${rep.name || "Unnamed Rep"}</strong>
                          <div class="muted" style="margin-top:6px;">${rep.email || "No email"} · ${rep.phone || "No phone"}</div>
                        </div>

                        <div>
                          <span class="chip">${rep.status || "active"}</span>
                          <span class="chip">@${rep.username || "no-username"}</span>
                        </div>

                        <div class="muted">
                          Company: ${rep.companyId || "—"}<br>
                          Reports To: ${rep.reportsTo || "—"}
                        </div>

                        <div class="rep-actions">
                          <button class="btn secondary edit-rep-btn" data-id="${rep.id}">Edit</button>
                        </div>
                      </div>
                    `
                  )
                  .join("")}
              </div>
            `
        }
      </section>
    </main>
  `;

  document.getElementById("openRepModalBtn")?.addEventListener("click", () => openRepModal());

  document.querySelectorAll(".edit-rep-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const rep = salesRepState.reps.find((item) => item.id === btn.dataset.id);
      openRepModal(rep);
    });
  });
}

async function saveRep(e) {
  e.preventDefault();

  const payload = {
    fullName: document.getElementById("repFullName").value.trim(),
    username: document.getElementById("repUsername").value.trim(),
    email: document.getElementById("repEmail").value.trim(),
    phone: document.getElementById("repPhone").value.trim(),
    status: document.getElementById("repStatus").value,
    notes: document.getElementById("repNotes").value.trim()
  };

  if (!payload.fullName || !payload.username) {
    showToast("Name and username are required.", "error");
    return;
  }

  if (salesRepState.editingId) {
    await updateSalesRep(salesRepState.editingId, payload);
    showToast("Sales rep updated.");
  } else {
    await createSalesRep(payload, salesRepState.user);
    showToast("Sales rep created.");
  }

  closeRepModal();
  await loadSalesReps(salesRepState.user);
  renderPage();
}

requireAuth(async (user) => {
  injectStyles();
  await bindTopbar(user);

  if (!canAccess(user.role, "sales_reps")) {
    document.getElementById("salesRepsRoot").innerHTML = `<section class="glass-card" style="margin:22px;">Access denied for sales reps.</section>`;
    return;
  }

  const topSidebar = document.getElementById("sidebar");
  if (topSidebar) {
    topSidebar.innerHTML = "";
  }

  const root = document.getElementById("salesRepsRoot");
  root.innerHTML = `<section class="glass-card" style="margin:22px;">Loading sales reps...</section>`;

  try {
    await loadSalesReps(user);
    renderPage();
  } catch (e) {
    root.innerHTML = `<section class="glass-card" style="margin:22px;">Sales reps page failed: ${e.message || e}</section>`;
  }

  document.getElementById("repModalCloseBtn")?.addEventListener("click", closeRepModal);
  document.getElementById("repModalCancelBtn")?.addEventListener("click", closeRepModal);
  document.getElementById("repForm")?.addEventListener("submit", saveRep);
});