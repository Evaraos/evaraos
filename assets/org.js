import {
  fetchAllCollection,
  bindTopbar,
  requireAuth
} from "./app.js";

import { db } from "./firebase.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

requireAuth(async (user) => {
  await bindTopbar(user);
  loadOrgChart();
});

async function loadOrgChart() {
  const [users, companies] = await Promise.all([
    fetchAllCollection("users"),
    fetchAllCollection("companies")
  ]);

  const container = document.getElementById("orgChartContainer");

  const grouped = groupByCompany(users);

  container.innerHTML = Object.keys(grouped)
    .map(companyId => renderCompany(companyId, grouped[companyId], companies))
    .join("");

  enableDragAndDrop();
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

function renderCompany(companyId, users, companies) {
  const company = companies.find(c => c.id === companyId);

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

function enableDragAndDrop() {
  const cards = document.querySelectorAll(".user-card");
  const lanes = document.querySelectorAll(".lane-users");

  let draggedId = null;

  cards.forEach(card => {
    card.addEventListener("dragstart", e => {
      draggedId = card.dataset.id;
    });
  });

  lanes.forEach(lane => {
    lane.addEventListener("dragover", e => e.preventDefault());

    lane.addEventListener("drop", async e => {
      e.preventDefault();

      const newRole = lane.dataset.role;

      if (!draggedId) return;

      await updateDoc(doc(db, "users", draggedId), {
        role: newRole
      });

      loadOrgChart();
    });
  });
}