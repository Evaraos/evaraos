import {
  bindTopbar,
  requireAuth,
  renderSidebar,
  fetchAllCollection,
  fetchUsersByCompany,
  updateDocument
} from "./app.js";

import { canAccess } from "./roles.js";

const state = {
  user: null,
  users: [],
  editingId: null
};

function showToast(message, variant = "success") {
  let container = document.getElementById("usersToastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "usersToastContainer";
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

async function loadUsers(user) {
  state.user = user;

  if (["super_admin", "owner", "admin"].includes(user.role)) {
    state.users = await fetchAllCollection("users", { max: 500 });
    return;
  }

  state.users = await fetchUsersByCompany(user.companyId);
}

function openUserModal(user = null) {
  state.editingId = user?.id || null;

  document.getElementById("userModal")?.classList.add("open");
  document.getElementById("userModalTitle").textContent = user ? "Edit User" : "Edit User";

  document.getElementById("editUserName").value = user?.name || "";
  document.getElementById("editUserEmail").value = user?.email || "";
  document.getElementById("editUserPhone").value = user?.phone || "";
  document.getElementById("editUserRole").value = user?.role || "customer";
  document.getElementById("editUserStatus").value = user?.status || "active";
  document.getElementById("editUserApproval").value = user?.approvalStatus || "approved";
  document.getElementById("editUserReportsTo").value = user?.reportsTo || "";
}

function closeUserModal() {
  document.getElementById("userModal")?.classList.remove("open");
  state.editingId = null;
}

function renderUsers() {
  const root = document.getElementById("usersRoot");
  if (!root) return;

  root.innerHTML = `
    <section class="glass-card aurora-card shine-border">
      <div class="section-title-row">
        <div>
          <h2 style="margin:0;">User Directory</h2>
          <p class="muted" style="margin:8px 0 0;">Edit team members, roles, statuses, approvals, and reporting lines.</p>
        </div>
        <div class="muted">${state.users.length} user(s)</div>
      </div>

      ${
        !state.users.length
          ? `<div class="muted" style="padding-top:16px;">No users found.</div>`
          : `
            <div class="quick-links-grid" style="margin-top:18px;">
              ${state.users.map(user => `
                <div class="quick-link-card aurora-card shine-border" style="display:block; min-height:auto;">
                  <div>
                    <strong>${user.name || "Unnamed User"}</strong>
                    <div class="muted" style="margin-top:8px;">
                      ${user.email || "No email"}<br>
                      ${user.phone || "No phone"}<br>
                      Reports To: ${user.reportsTo || "—"}
                    </div>
                  </div>

                  <div style="margin-top:12px;">
                    <span class="chip">${user.role || "customer"}</span>
                    <span class="chip">${user.status || "active"}</span>
                    <span class="chip">${user.approvalStatus || "approved"}</span>
                  </div>

                  <div class="top-actions" style="margin-top:14px;">
                    <button class="btn btn-secondary edit-user-btn" data-id="${user.id}" type="button">Edit</button>
                  </div>
                </div>
              `).join("")}
            </div>
          `
      }
    </section>
  `;

  document.querySelectorAll(".edit-user-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const user = state.users.find(item => item.id === btn.dataset.id);
      openUserModal(user);
    });
  });
}

async function saveUser(e) {
  e.preventDefault();

  if (!state.editingId) {
    showToast("No user selected.", "error");
    return;
  }

  const payload = {
    name: document.getElementById("editUserName").value.trim(),
    email: document.getElementById("editUserEmail").value.trim().toLowerCase(),
    phone: document.getElementById("editUserPhone").value.trim(),
    role: document.getElementById("editUserRole").value,
    status: document.getElementById("editUserStatus").value,
    approvalStatus: document.getElementById("editUserApproval").value,
    reportsTo: document.getElementById("editUserReportsTo").value.trim(),
    active: document.getElementById("editUserStatus").value !== "inactive"
  };

  try {
    await updateDocument("users", state.editingId, payload);
    closeUserModal();
    await loadUsers(state.user);
    renderUsers();
    showToast("User updated.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Could not update user.", "error");
  }
}

requireAuth(async (user) => {
  await bindTopbar(user, "Users");

  const sidebar = document.getElementById("sidebar");
  if (sidebar) {
    sidebar.innerHTML = renderSidebar(user.role, "users");
  }

  if (!canAccess(user.role, "users")) {
    document.getElementById("usersRoot").innerHTML =
      `<section class="glass-card aurora-card shine-border">Access denied.</section>`;
    return;
  }

  document.getElementById("usersRoot").innerHTML =
    `<section class="glass-card aurora-card shine-border">Loading users...</section>`;

  try {
    await loadUsers(user);
    renderUsers();
  } catch (error) {
    console.error(error);
    document.getElementById("usersRoot").innerHTML =
      `<section class="glass-card aurora-card shine-border">Users page failed: ${error.message || error}</section>`;
  }

  document.getElementById("userModalCloseBtn")?.addEventListener("click", closeUserModal);
  document.getElementById("userModalCancelBtn")?.addEventListener("click", closeUserModal);
  document.getElementById("userForm")?.addEventListener("submit", saveUser);
});