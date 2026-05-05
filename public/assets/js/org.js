import {
  fetchAllCollection,
  bindTopbar,
  requireAuth,
  renderSidebar
} from "./app.js";

import { db } from "./firebase.js";
import {
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ROLE_ORDER = [
  "admin",
  "manager",
  "operations_coordinator",
  "sales_rep",
  "technician",
  "hr"
];

const ROLE_LABELS = {
  admin: "Admin",
  manager: "Managers",
  operations_coordinator: "Operations",
  sales_rep: "Sales Reps",
  technician: "Technicians",
  hr: "HR"
};

let ALL_USERS = [];
let ALL_COMPANIES = [];
let CURRENT_USER = null;
let CURRENT_MODAL_USER_ID = null;

requireAuth(async (user) => {
  CURRENT_USER = user;
  await bindTopbar(user, "Organization");

  const sidebar = document.getElementById("sidebar");
  if (sidebar) sidebar.innerHTML = renderSidebar(user.role, "org");

  await loadOrgChart();
});

async function loadOrgChart() {
  const [users, companies] = await Promise.all([
    fetchAllCollection("users", { max: 500 }),
    fetchAllCollection("companies", { max: 500 })
  ]);

  ALL_USERS = users.filter((u) => u.approvalStatus !== "pending");
  ALL_COMPANIES = companies;

  const container = document.getElementById("orgChartContainer");
  const grouped = groupByCompany(ALL_USERS);
  const sortedCompanyIds = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  container.innerHTML = sortedCompanyIds
    .map((companyId) => renderCompany(companyId, grouped[companyId]))
    .join("");

  enableCardClicks();
}

function groupByCompany(users) {
  const map = {};
  users.forEach((u) => {
    const company = u.companyId || "unknown";
    if (!map[company]) map[company] = [];
    map[company].push(u);
  });
  return map;
}

function renderCompany(companyId, users) {
  const company = ALL_COMPANIES.find((c) => c.id === companyId);

  return `
    <div class="card glass-card aurora-card shine-border" style="margin-bottom:18px;">
      <div class="section-title-row">
        <div>
          <h2 style="margin:0;">${company?.name || companyId}</h2>
          <p class="muted" style="margin:10px 0 0;">
            Company ID: ${companyId}
          </p>
        </div>
      </div>

      <div class="grid grid-3" style="margin-top:18px;">
        ${ROLE_ORDER.map((role) => renderRoleLane(role, users)).join("")}
      </div>
    </div>
  `;
}

function renderRoleLane(role, users) {
  const filtered = users.filter((u) => u.role === role);

  return `
    <div class="card aurora-card shine-border">
      <h3 style="margin-top:0;">${ROLE_LABELS[role]}</h3>

      <div style="display:grid; gap:12px;">
        ${
          filtered.length
            ? filtered.map(renderUserCard).join("")
            : `<div class="muted">Empty</div>`
        }
      </div>
    </div>
  `;
}

function renderUserCard(user) {
  return `
    <div class="quick-link-card aurora-card shine-border org-user-card" data-id="${user.id}" style="display:block; min-height:auto; cursor:pointer;">
      <strong>${user.name || "User"}</strong>
      <div class="muted" style="margin-top:8px;">
        ${user.handle || user.username || ""}<br>
        ${user.email || "No email"}<br>
        Reports To: ${user.reportsTo || "Root"}
      </div>
    </div>
  `;
}

function enableCardClicks() {
  document.querySelectorAll(".org-user-card").forEach((card) => {
    card.addEventListener("click", () => {
      const user = ALL_USERS.find((u) => u.id === card.dataset.id);
      if (user) openModal(user);
    });
  });
}

function openModal(user) {
  CURRENT_MODAL_USER_ID = user.id;
  document.getElementById("modal").classList.add("open");

  document.getElementById("modalContent").innerHTML = `
    <div class="section-title-row">
      <div>
        <h2 style="margin:0;">${user.name || "User"}</h2>
        <p class="muted" style="margin:10px 0 0;">
          ${user.email || "No email"} · ${user.handle || user.username || "No handle"}
        </p>
      </div>
    </div>

    <div class="form-grid" style="margin-top:18px;">
      <div class="field">
        <label>Role</label>
        <select id="editRole">
          ${ROLE_ORDER.map((r) => `
            <option value="${r}" ${user.role === r ? "selected" : ""}>
              ${ROLE_LABELS[r]}
            </option>
          `).join("")}
        </select>
      </div>

      <div class="field">
        <label>Company</label>
        <select id="editCompany">
          ${ALL_COMPANIES.map((c) => `
            <option value="${c.id}" ${user.companyId === c.id ? "selected" : ""}>
              ${c.name || c.id}
            </option>
          `).join("")}
        </select>
      </div>

      <div class="field">
        <label>Status</label>
        <select id="editStatus">
          <option value="active" ${user.status === "active" ? "selected" : ""}>Active</option>
          <option value="inactive" ${user.status === "inactive" ? "selected" : ""}>Inactive</option>
        </select>
      </div>

      <div class="field">
        <label>Approval Status</label>
        <select id="editApproval">
          <option value="approved" ${user.approvalStatus === "approved" ? "selected" : ""}>Approved</option>
          <option value="pending" ${user.approvalStatus === "pending" ? "selected" : ""}>Pending</option>
          <option value="denied" ${user.approvalStatus === "denied" ? "selected" : ""}>Denied</option>
        </select>
      </div>

      <div class="field full">
        <label>Reports To</label>
        <select id="editReportsTo">
          <option value="">No Manager / Root</option>
          ${ALL_USERS
            .filter((u) => u.id !== user.id)
            .map((u) => `
              <option value="${u.id}" ${user.reportsTo === u.id ? "selected" : ""}>
                ${u.name || u.email || u.id}
              </option>
            `)
            .join("")}
        </select>
      </div>
    </div>

    <div class="top-actions" style="margin-top:18px;">
      <button class="btn" id="saveUser" type="button">Save Changes</button>
    </div>
  `;

  document.getElementById("saveUser")?.addEventListener("click", async () => {
    await updateDoc(doc(db, "users", user.id), {
      role: document.getElementById("editRole").value,
      companyId: document.getElementById("editCompany").value,
      status: document.getElementById("editStatus").value,
      approvalStatus: document.getElementById("editApproval").value,
      reportsTo: document.getElementById("editReportsTo").value
    });

    closeModal();
    await loadOrgChart();
  });
}

window.closeModal = function () {
  closeModal();
};

function closeModal() {
  CURRENT_MODAL_USER_ID = null;
  document.getElementById("modal").classList.remove("open");
}