import {
  bindTopbar,
  requireAuth,
  renderSidebar,
  fetchAllCollection,
  fetchUsersByCompany,
  createSalesRep,
  updateSalesRep
} from "./app.js";

import { canAccess } from "./roles.js";

const repState = {
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
  toast.style.background = variant === "error" ? "rgba(180,40,40,.94)" : "rgba(25,110,55,.94)";
  toast.style.color = "#fff";
  toast.style.boxShadow = "0 12px 30px rgba(0,0,0,.28)";
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 2600);
}

async function loadSalesReps(user) {
  repState.user = user;

  const users = ["super_admin", "owner", "admin"].includes(user.role)
    ? await fetchAllCollection("users", { max: 500 })
    : await fetchUsersByCompany(user.companyId);

  repState.reps = users.filter(item => item.role === "sales_rep");
}

function openRepModal(rep = null) {
  repState.editingId = rep?.id || null;
  document.getElementById("repModal")?.classList.add("open");
  document.getElementById("repModalTitle").textContent = rep ? "Edit Sales Rep" : "Add Sales Rep";

  document.getElementById("repFullName").value = rep?.name || "";
  document.getElementById("repUsername").value = rep?.username || "";
  document.getElementById("repEmail").value = rep?.email || "";
  document.getElementById("repPhone").value = rep?.phone || "";
  document.getElementById("repStatus").value = rep?.status || "active";
  document.getElementById("repNotes").value = rep?.notes || "";
}

function closeRepModal() {
  document.getElementById("repModal")?.classList.remove("open");
  repState.editingId = null;
}

function renderSalesReps() {
  const root = document.getElementById("salesRepsRoot");
  if (!root) return;

  root.innerHTML = `
    <section class="glass-card aurora-card shine-border">
      <div class="section-title-row">
        <div>
          <h2 style="margin:0;">Sales Reps Directory</h2>
          <p class="muted" style="margin:8px 0 0;">Add, edit, and manage your sales team.</p>
        </div>
        <div class="top-actions">
          <button class="btn" id="openRepModalBtn" type="button">Add Sales Rep</button>
        </div>
      </div>

      ${
        !repState.reps.length
          ? `<div class="muted" style="padding-top:16px;">No sales reps found.</div>`
          : `
            <div class="quick-links-grid" style="margin-top:18px;">
              ${repState.reps.map(rep => `
                <div class="quick-link-card aurora-card shine-border" style="display:block; min-height:auto;">
                  <div>
                    <strong>${rep.name || "Unnamed Rep"}</strong>
                    <div class="muted" style="margin-top:8px;">
                      ${rep.email || "No email"}<br>
                      ${rep.phone || "No phone"}<br>
                      @${rep.username || "no-username"}
                    </div>
                  </div>

                  <div style="margin-top:12px;">
                    <span class="chip">${rep.status || "active"}</span>
                    <span class="chip">${rep.companyId || "no-company"}</span>
                  </div>

                  <div class="top-actions" style="margin-top:14px;">
                    <button class="btn btn-secondary edit-rep-btn" data-id="${rep.id}" type="button">Edit</button>
                  </div>
                </div>
              `).join("")}
            </div>
          `
      }
    </section>
  `;

  document.getElementById("openRepModalBtn")?.addEventListener("click", () => openRepModal());

  document.querySelectorAll(".edit-rep-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const rep = repState.reps.find(item => item.id === btn.dataset.id);
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

  try {
    if (repState.editingId) {
      await updateSalesRep(repState.editingId, payload);
      showToast("Sales rep updated.");
    } else {
      await createSalesRep(payload, repState.user);
      showToast("Sales rep created.");
    }

    closeRepModal();
    await loadSalesReps(repState.user);
    renderSalesReps();
  } catch (error) {
    console.error(error);
    showToast(error.message || "Could not save sales rep.", "error");
  }
}

requireAuth(async (user) => {
  await bindTopbar(user, "Sales Reps");

  const sidebar = document.getElementById("sidebar");
  if (sidebar) {
    sidebar.innerHTML = renderSidebar(user.role, "sales_reps");
  }

  if (!canAccess(user.role, "sales_reps")) {
    document.getElementById("salesRepsRoot").innerHTML =
      `<section class="glass-card aurora-card shine-border">Access denied.</section>`;
    return;
  }

  document.getElementById("salesRepsRoot").innerHTML =
    `<section class="glass-card aurora-card shine-border">Loading sales reps...</section>`;

  try {
    await loadSalesReps(user);
    renderSalesReps();
  } catch (error) {
    console.error(error);
    document.getElementById("salesRepsRoot").innerHTML =
      `<section class="glass-card aurora-card shine-border">Sales reps page failed: ${error.message || error}</section>`;
  }

  document.getElementById("repModalCloseBtn")?.addEventListener("click", closeRepModal);
  document.getElementById("repModalCancelBtn")?.addEventListener("click", closeRepModal);
  document.getElementById("repForm")?.addEventListener("submit", saveRep);
});