import {
  bindTopbar,
  requireAuth,
  fetchUsersByCompany,
  fetchAllCollection,
  fetchPendingUsersByCompany,
  renderSidebar,
  roleGuard,
  updateUserAdmin,
  groupUsersByRole,
  approveUser,
  rejectUser
} from "./app.js";

let currentUser = null;
let editingUserId = null;
let currentUsers = [];
let currentPendingUsers = [];

function fillUserForm(user) {
  document.getElementById("userName").value = user.name || "";
  document.getElementById("userUsername").value = user.username || "";
  document.getElementById("userEmail").value = user.email || "";
  document.getElementById("userRole").value = user.role || "customer";
  document.getElementById("userApprovalStatus").value = user.approvalStatus || "pending";
  document.getElementById("userCompanyId").value = user.companyId || "";
  document.getElementById("userStatus").value = user.status || "active";
  document.getElementById("userPhone").value = user.phone || "";
  document.getElementById("userAddress").value = user.address || "";
  document.getElementById("userCity").value = user.city || "";
  document.getElementById("userState").value = user.state || "";
  document.getElementById("userZip").value = user.zip || "";
}

function clearUserForm() {
  editingUserId = null;
  document.getElementById("userName").value = "";
  document.getElementById("userUsername").value = "";
  document.getElementById("userEmail").value = "";
  document.getElementById("userRole").value = "customer";
  document.getElementById("userApprovalStatus").value = "pending";
  document.getElementById("userCompanyId").value = "";
  document.getElementById("userStatus").value = "active";
  document.getElementById("userPhone").value = "";
  document.getElementById("userAddress").value = "";
  document.getElementById("userCity").value = "";
  document.getElementById("userState").value = "";
  document.getElementById("userZip").value = "";
  document.getElementById("userMsg").textContent = "";
}

function openModal(id) {
  document.getElementById(id).classList.add("active");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("active");
}

function userCard(user) {
  return `
    <div class="row">
      <div>
        <strong>${user.name || "Unnamed User"}</strong><br>
        <span class="muted">@${user.username || "no-username"}</span><br>
        <span class="muted">${user.email || "No email"}</span>
      </div>
      <div>
        ${user.role || "No role"}<br>
        <span class="muted">${user.approvalStatus || "pending"} | ${user.status || "active"}</span>
      </div>
      <div>
        ${user.phone || "No phone"}<br>
        <span class="muted">${user.city || ""} ${user.state || ""}</span>
      </div>
      <div>
        <button class="btn secondary edit-user-btn" data-id="${user.id}">Edit</button>
      </div>
    </div>
  `;
}

function pendingUserCard(user) {
  return `
    <div class="approval-row">
      <div>
        <strong>${user.name || "Unnamed User"}</strong><br>
        <span class="muted">@${user.username || "no-username"}</span><br>
        <span class="muted">${user.email || "No email"}</span>
      </div>
      <div>
        ${user.role || "No role"}<br>
        <span class="muted">Approval: ${user.approvalStatus || "pending"}</span>
      </div>
      <div>
        ${user.phone || "No phone"}<br>
        <span class="muted">${user.city || ""} ${user.state || ""}</span>
      </div>
      <div class="action-row">
        <button class="btn approve-user-btn" data-id="${user.id}">Approve</button>
        <button class="btn secondary reject-user-btn" data-id="${user.id}">Reject</button>
        <button class="btn secondary edit-user-btn" data-id="${user.id}">Edit</button>
      </div>
    </div>
  `;
}

async function renderPendingUsers() {
  const includeAll = currentUser.role === "super_admin";
  currentPendingUsers = includeAll
    ? await fetchPendingUsersByCompany(currentUser.companyId, true)
    : await fetchPendingUsersByCompany(currentUser.companyId, false);

  const root = document.getElementById("pendingUsersList");

  if (!currentPendingUsers.length) {
    root.innerHTML = `<div class="empty-group">No pending users right now.</div>`;
    return;
  }

  root.innerHTML = currentPendingUsers.map(pendingUserCard).join("");

  document.querySelectorAll(".approve-user-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await approveUser(btn.dataset.id);
      await renderPendingUsers();
      await renderUsers();
    });
  });

  document.querySelectorAll(".reject-user-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await rejectUser(btn.dataset.id);
      await renderPendingUsers();
      await renderUsers();
    });
  });

  document.querySelectorAll(".edit-user-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const selectedUser =
        currentPendingUsers.find((user) => user.id === btn.dataset.id) ||
        currentUsers.find((user) => user.id === btn.dataset.id);

      if (!selectedUser) return;

      editingUserId = selectedUser.id;
      fillUserForm(selectedUser);
      openModal("userModal");
    });
  });
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

  document.querySelectorAll("#usersGroupedList .edit-user-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const selectedUser = currentUsers.find((user) => user.id === btn.dataset.id);
      if (!selectedUser) return;

      editingUserId = selectedUser.id;
      fillUserForm(selectedUser);
      openModal("userModal");
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

  await renderPendingUsers();
  await renderUsers();

  document.getElementById("closeUserModalBtn").addEventListener("click", () => closeModal("userModal"));

  document.getElementById("saveUserBtn").addEventListener("click", async () => {
    const msg = document.getElementById("userMsg");

    if (!editingUserId) {
      msg.textContent = "Select a user from the list to edit.";
      return;
    }

    try {
      await updateUserAdmin(editingUserId, {
        name: document.getElementById("userName").value.trim(),
        username: document.getElementById("userUsername").value.trim().toLowerCase(),
        role: document.getElementById("userRole").value,
        approvalStatus: document.getElementById("userApprovalStatus").value,
        companyId: document.getElementById("userCompanyId").value.trim(),
        status: document.getElementById("userStatus").value,
        phone: document.getElementById("userPhone").value.trim(),
        address: document.getElementById("userAddress").value.trim(),
        city: document.getElementById("userCity").value.trim(),
        state: document.getElementById("userState").value,
        zip: document.getElementById("userZip").value.trim()
      });

      msg.textContent = "User updated successfully.";
      await renderPendingUsers();
      await renderUsers();
      closeModal("userModal");
      clearUserForm();
    } catch (e) {
      msg.textContent = e.message || "Failed to update user.";
    }
  });
});