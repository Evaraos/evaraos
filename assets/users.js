import {
  bindTopbar,
  requireAuth,
  fetchUsersByCompany,
  fetchAllCollection,
  renderSidebar,
  roleGuard,
  updateUserAdmin,
  groupUsersByRole
} from "./app.js";

let currentUser = null;
let editingUserId = null;
let currentUsers = [];

function fillUserForm(user) {
  document.getElementById("userName").value = user.name || "";
  document.getElementById("userEmail").value = user.email || "";
  document.getElementById("userRole").value = user.role || "customer";
  document.getElementById("userApprovalStatus").value = user.approvalStatus || "pending";
  document.getElementById("userCompanyId").value = user.companyId || "";
  document.getElementById("userStatus").value = user.status || "active";
  document.getElementById("userCompanyAccessLevel").value = user.companyAccessLevel || "subsidiary";
  document.getElementById("userOrganizationLevel").value = user.organizationLevel || "";
  document.getElementById("userPermissions").value = Array.isArray(user.permissions) ? user.permissions.join(", ") : "";
}

function clearUserForm() {
  editingUserId = null;
  document.getElementById("userName").value = "";
  document.getElementById("userEmail").value = "";
  document.getElementById("userRole").value = "customer";
  document.getElementById("userApprovalStatus").value = "pending";
  document.getElementById("userCompanyId").value = "";
  document.getElementById("userStatus").value = "active";
  document.getElementById("userCompanyAccessLevel").value = "subsidiary";
  document.getElementById("userOrganizationLevel").value = "";
  document.getElementById("userPermissions").value = "";
  document.getElementById("cancelUserEditBtn").style.display = "none";
}

function userCard(user) {
  return `
    <div class="row">
      <div>
        <strong>${user.name || "Unnamed User"}</strong><br>
        <span class="muted">${user.email || "No email"}</span>
      </div>
      <div>
        ${user.role || "No role"}<br>
        <span class="muted">${user.approvalStatus || "pending"} | ${user.status || "active"}</span>
      </div>
      <div>
        ${user.companyId || "No company"}<br>
        <span class="muted">Level ${user.organizationLevel || "—"} | ${user.companyAccessLevel || "subsidiary"}</span>
      </div>
      <div>
        <button class="btn secondary edit-user-btn" data-id="${user.id}">Edit</button>
      </div>
    </div>
  `;
}

async function renderUsers() {
  currentUsers = currentUser.role === "super_admin"
    ? await fetchAllCollection("users")
    : await fetchUsersByCompany(currentUser.companyId);

  const grouped = groupUsersByRole(currentUsers);
  const root = document.getElementById("usersGroupedList");

  const sectionOrder = [
    ["super_admin", "Super Admin"],
    ["admin", "Admins"],
    ["manager", "Managers"],
    ["operations_coordinator", "Operations Coordinators"],
    ["sales_rep", "Sales Reps"],
    ["technician", "Technicians"],
    ["hr", "HR"],
    ["customer", "Customers"],
    ["other", "Other"]
  ];

  root.innerHTML = sectionOrder.map(([key, label]) => {
    const users = grouped[key] || [];
    return `
      <div class="role-group">
        <h3>${label}</h3>
        ${users.length ? users.map(userCard).join("") : `<div class="empty-group">No users in this category.</div>`}
      </div>
    `;
  }).join("");

  document.querySelectorAll(".edit-user-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const selectedUser = currentUsers.find((user) => user.id === btn.dataset.id);
      if (!selectedUser) return;

      editingUserId = selectedUser.id;
      fillUserForm(selectedUser);
      document.getElementById("cancelUserEditBtn").style.display = "inline-flex";
      document.getElementById("userMsg").textContent = `Editing ${selectedUser.name || "user"}`;
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

requireAuth(async (user) => {
  currentUser = user;

  if (!roleGuard(user, "users")) {
    document.body.innerHTML = `
      <div class="auth-shell">
        <div class="auth-card">
          <h2>Access denied</h2>
          <p class="muted">Your role does not have access to Users management.</p>
        </div>
      </div>
    `;
    return;
  }

  await bindTopbar(user);
  document.getElementById("sidebar").innerHTML = renderSidebar(user.role, "users");

  await renderUsers();

  document.getElementById("saveUserBtn").addEventListener("click", async () => {
    const msg = document.getElementById("userMsg");

    if (!editingUserId) {
      msg.textContent = "Select a user from the list to edit.";
      return;
    }

    try {
      const permissionArray = document.getElementById("userPermissions").value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      await updateUserAdmin(editingUserId, {
        name: document.getElementById("userName").value.trim(),
        role: document.getElementById("userRole").value,
        approvalStatus: document.getElementById("userApprovalStatus").value,
        companyId: document.getElementById("userCompanyId").value.trim(),
        status: document.getElementById("userStatus").value,
        companyAccessLevel: document.getElementById("userCompanyAccessLevel").value,
        organizationLevel: document.getElementById("userOrganizationLevel").value || 0,
        permissions: permissionArray
      });

      msg.textContent = "User updated successfully.";
      clearUserForm();
      await renderUsers();
    } catch (e) {
      msg.textContent = e.message || "Failed to update user.";
    }
  });

  document.getElementById("cancelUserEditBtn").addEventListener("click", () => {
    clearUserForm();
    document.getElementById("userMsg").textContent = "Edit cancelled.";
  });
});