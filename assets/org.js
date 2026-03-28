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

let ALL_USERS = [];
let ALL_COMPANIES = [];

requireAuth(async (user) => {
  await bindTopbar(user);
  loadOrgChart();
});

async function loadOrgChart() {
  const [users, companies] = await Promise.all([
    fetchAllCollection("users"),
    fetchAllCollection("companies")
  ]);

  ALL_USERS = users;
  ALL_COMPANIES = companies;

  const container = document.getElementById("orgChartContainer");

  const grouped = groupByCompany(users);

  container.innerHTML = Object.keys(grouped)
    .map(companyId => renderCompany(companyId, grouped[companyId]))
    .join("");

  enableDragAndDrop();
  enableCardClicks();
}

function groupByCompany(users) {
  const map = {};
  users.forEach(u => {
    const company = u.companyId || "unknown";
    if (!map[company]) map[company] = [];
    map[company].push(u);
  });
  return map;
}

function renderCompany(companyId, users) {
  const company = ALL_COMPANIES.find(c => c.id === companyId);

  return `
    <div class="card company-block">
      <h2>${company?.name || companyId}</h2>

      <div class="role-lanes">
        ${ROLE_ORDER.map(role => renderRoleLane(role, users))}
      </div>
    </div>
  `;
}

function renderRoleLane(role, users) {
  const filtered = users.filter(u => u.role === role);

  return `
    <div class="role-lane" data-role="${role}">
      <h3>${ROLE_LABELS[role]}</h3>

      <div class="lane-users" data-role="${role}">
        ${filtered.map(renderUserCard).join("") || `<div class="empty">Empty</div>`}
      </div>
    </div>
  `;
}

function renderUserCard(user) {
  return `
    <div class="user-card" draggable="true" data-id="${user.id}">
      <strong>${user.name || "User"}</strong>
      <span>${user.handle || ""}</span>
    </div>
  `;
}

/* =========================
   DRAG & DROP
========================= */

function enableDragAndDrop() {
  const cards = document.querySelectorAll(".user-card");
  const lanes = document.querySelectorAll(".lane-users");

  let draggedId = null;

  cards.forEach(card => {
    card.addEventListener("dragstart", () => {
      draggedId = card.dataset.id;
    });
  });

  lanes.forEach(lane => {
    lane.addEventListener("dragover", e => e.preventDefault());

    lane.addEventListener("drop", async () => {
      const newRole = lane.dataset.role;

      await updateDoc(doc(db, "users", draggedId), {
        role: newRole
      });

      loadOrgChart();
    });
  });
}

/* =========================
   CLICK → MODAL
========================= */

function enableCardClicks() {
  document.querySelectorAll(".user-card").forEach(card => {
    card.addEventListener("click", () => {
      const user = ALL_USERS.find(u => u.id === card.dataset.id);
      openModal(user);
    });
  });
}

function openModal(user) {
  document.getElementById("modal").classList.add("open");

  document.getElementById("modalContent").innerHTML = `
    <h2>${user.name}</h2>

    <div class="form-grid">

      <div class="field">
        <label>Role</label>
        <select id="editRole">
          ${ROLE_ORDER.map(r => `
            <option value="${r}" ${user.role === r ? "selected" : ""}>
              ${ROLE_LABELS[r]}
            </option>
          `).join("")}
        </select>
      </div>

      <div class="field">
        <label>Company</label>
        <select id="editCompany">
          ${ALL_COMPANIES.map(c => `
            <option value="${c.id}" ${user.companyId === c.id ? "selected" : ""}>
              ${c.name}
            </option>
          `).join("")}
        </select>
      </div>

      <div class="field full">
        <label>Permissions (comma separated)</label>
        <input id="editPermissions" value="${(user.permissions || []).join(",")}"/>
      </div>

    </div>

    <div style="margin-top:16px;">
      <button class="btn" id="saveUser">Save Changes</button>
    </div>
  `;

  document.getElementById("saveUser").onclick = async () => {
    await updateDoc(doc(db, "users", user.id), {
      role: document.getElementById("editRole").value,
      companyId: document.getElementById("editCompany").value,
      permissions: document.getElementById("editPermissions").value.split(",").map(p => p.trim())
    });

    closeModal();
    loadOrgChart();
  };
}

window.closeModal = function () {
  document.getElementById("modal").classList.remove("open");
};