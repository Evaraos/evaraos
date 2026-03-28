import {
  fetchAllCollection,
  bindTopbar,
  requireAuth
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

const ROLE_DEFAULT_PERMISSIONS = {
  admin: ["manage_users", "approve", "full_company"],
  manager: ["leads", "jobs", "customers"],
  operations_coordinator: ["jobs", "customers"],
  sales_rep: ["leads", "convert"],
  technician: ["jobs"],
  hr: ["users", "staff"]
};

const ALL_PERMISSION_OPTIONS = [
  "all",
  "manage_users",
  "approve",
  "full_company",
  "users",
  "staff",
  "leads",
  "convert",
  "jobs",
  "customers",
  "self"
];

let ALL_USERS = [];
let ALL_COMPANIES = [];
let CURRENT_USER = null;
let CURRENT_MODAL_USER_ID = null;

requireAuth(async (user) => {
  CURRENT_USER = user;
  await bindTopbar(user);
  await loadOrgChart();

  const params = new URLSearchParams(window.location.search);
  const highlightUserId = params.get("user");
  if (highlightUserId) {
    const found = ALL_USERS.find((u) => u.id === highlightUserId);
    if (found) {
      setTimeout(() => {
        openModal(found);
        const card = document.querySelector(`.user-card[data-id="${highlightUserId}"]`);
        if (card) {
          card.scrollIntoView({ behavior: "smooth", block: "center" });
          card.style.outline = "2px solid rgba(255,255,255,.28)";
          setTimeout(() => {
            card.style.outline = "";
          }, 1800);
        }
      }, 150);
    }
  }
});

async function loadOrgChart() {
  const [users, companies] = await Promise.all([
    fetchAllCollection("users"),
    fetchAllCollection("companies")
  ]);

  ALL_USERS = users.filter((u) => u.approvalStatus !== "pending");
  ALL_COMPANIES = companies;

  const container = document.getElementById("orgChartContainer");
  const grouped = groupByCompany(ALL_USERS);

  const sortedCompanyIds = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  container.innerHTML = sortedCompanyIds
    .map((companyId) => renderCompany(companyId, grouped[companyId]))
    .join("");

  enableDragAndDrop();
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
  const totals = {
    users: users.length,
    admins: users.filter((u) => u.role === "admin").length,
    managers: users.filter((u) => u.role === "manager" || u.role === "operations_coordinator").length,
    field: users.filter((u) => u.role === "sales_rep" || u.role === "technician").length
  };

  return `
    <div class="card company-block">
      <div class="section-title-row">
        <div>
          <h2 style="margin:0;">${company?.name || companyId}</h2>
          <p class="muted" style="margin:10px 0 0;">
            Company ID: ${companyId}
          </p>
        </div>

        <div class="top-actions">
          <span class="chip">${totals.users} Users</span>
          <span class="chip">${totals.admins} Admin</span>
          <span class="chip">${totals.managers} Mgmt</span>
          <span class="chip">${totals.field} Field</span>
        </div>
      </div>

      <div class="role-lanes">
        ${ROLE_ORDER.map((role) => renderRoleLane(role, users)).join("")}
      </div>
    </div>
  `;
}

function renderRoleLane(role, users) {
  const filtered = users.filter((u) => u.role === role);

  return `
    <div class="role-lane" data-role="${role}">
      <h3>${ROLE_LABELS[role]}</h3>

      <div class="lane-users" data-role="${role}">
        ${
          filtered.length
            ? filtered.map(renderUserCard).join("")
            : `<div class="empty">Empty</div>`
        }
      </div>
    </div>
  `;
}

function renderUserCard(user) {
  const permissionCount = Array.isArray(user.permissions) ? user.permissions.length : 0;
  return `
    <div class="user-card" draggable="true" data-id="${user.id}">
      <strong>${user.name || "User"}</strong>
      <span>${user.handle || user.username || ""}</span>
      <span>${user.email || "No email"}</span>
      <span>${permissionCount} permission${permissionCount === 1 ? "" : "s"}</span>
    </div>
  `;
}

function enableDragAndDrop() {
  const cards = document.querySelectorAll(".user-card");
  const lanes = document.querySelectorAll(".lane-users");
  let draggedId = null;

  cards.forEach((card) => {
    card.addEventListener("dragstart", () => {
      draggedId = card.dataset.id;
    });
  });

  lanes.forEach((lane) => {
    lane.addEventListener("dragover", (e) => e.preventDefault());

    lane.addEventListener("drop", async () => {
      const newRole = lane.dataset.role;
      if (!draggedId) return;

      await updateDoc(doc(db, "users", draggedId), {
        role: newRole,
        permissions: ROLE_DEFAULT_PERMISSIONS[newRole] || [],
        organizationLevel: getOrgLevelFromRole(newRole)
      });

      await loadOrgChart();
    });
  });
}

function enableCardClicks() {
  document.querySelectorAll(".user-card").forEach((card) => {
    card.addEventListener("click", () => {
      const user = ALL_USERS.find((u) => u.id === card.dataset.id);
      if (user) openModal(user);
    });
  });
}

function getOrgLevelFromRole(role) {
  const levels = {
    admin: 2,
    manager: 3,
    operations_coordinator: 3,
    sales_rep: 4,
    technician: 5,
    hr: 3
  };
  return levels[role] || 6;
}

function getUserNameById(id) {
  return ALL_USERS.find((u) => u.id === id)?.name || "";
}

function buildPermissionCheckboxes(selected = []) {
  const selectedSet = new Set(Array.isArray(selected) ? selected : []);
  return ALL_PERMISSION_OPTIONS.map((permission) => {
    return `
      <label class="user-card" style="cursor:pointer; padding:12px;">
        <div style="display:flex; gap:10px; align-items:center;">
          <input
            type="checkbox"
            class="permission-checkbox"
            value="${permission}"
            ${selectedSet.has(permission) ? "checked" : ""}
            style="width:auto; min-height:auto;"
          />
          <div>
            <strong style="font-size:14px;">${permission}</strong>
          </div>
        </div>
      </label>
    `;
  }).join("");
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
      <div class="top-actions">
        <a class="btn secondary" href="performance.html?user=${user.id}">Open in Performance</a>
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

      <div class="field full">
        <label>Permissions</label>
        <div class="page-grid-3">
          ${buildPermissionCheckboxes(user.permissions || [])}
        </div>
      </div>
    </div>

    <div class="top-actions" style="margin-top:18px;">
      <button class="btn" id="saveUser">Save Changes</button>
      <button class="btn secondary" id="resetRolePermissions">Use Role Defaults</button>
    </div>

    <div class="card" style="margin-top:18px; padding:16px;">
      <h3 style="margin-bottom:10px;">Quick Info</h3>
      <div class="muted">
        Organization Level: ${user.organizationLevel || "—"}<br>
        Reports To: ${getUserNameById(user.reportsTo) || "Root"}<br>
        Company ID: ${user.companyId || "—"}
      </div>
    </div>
  `;

  document.getElementById("resetRolePermissions")?.addEventListener("click", () => {
    const role = document.getElementById("editRole").value;
    const defaultPermissions = ROLE_DEFAULT_PERMISSIONS[role] || [];
    document.querySelectorAll(".permission-checkbox").forEach((checkbox) => {
      checkbox.checked = defaultPermissions.includes(checkbox.value);
    });
  });

  document.getElementById("saveUser")?.addEventListener("click", async () => {
    const selectedPermissions = [...document.querySelectorAll(".permission-checkbox:checked")].map((el) => el.value);
    const role = document.getElementById("editRole").value;
    const companyId = document.getElementById("editCompany").value;
    const status = document.getElementById("editStatus").value;
    const approvalStatus = document.getElementById("editApproval").value;
    const reportsTo = document.getElementById("editReportsTo").value;

    await updateDoc(doc(db, "users", user.id), {
      role,
      companyId,
      status,
      approvalStatus,
      reportsTo,
      permissions: selectedPermissions,
      organizationLevel: getOrgLevelFromRole(role)
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