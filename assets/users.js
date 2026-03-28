import {
  bindTopbar,
  requireAuth,
  fetchAllCollection,
  fetchUsersByCompany,
  fetchPendingUsersByCompany,
  sanitizeCompanyId,
  groupUsersByRole
} from "./app.js";

import { canAccess } from "./roles.js";

import {
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "./firebase.js";

const usersState = {
  user: null,
  approved: [],
  pending: [],
  editingId: null,
  search: ""
};

const ROLE_LABELS = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  operations_coordinator: "Operations Coordinator",
  sales_rep: "Sales Rep",
  technician: "Technician",
  hr: "HR",
  customer: "Customer",
  other: "Other"
};

const ROLE_ORDER = [
  "super_admin",
  "admin",
  "manager",
  "operations_coordinator",
  "sales_rep",
  "technician",
  "hr",
  "customer",
  "other"
];

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
  toast.style.background =
    variant === "error" ? "rgba(180,40,40,.94)" : "rgba(25,110,55,.94)";
  toast.style.color = "#fff";
  toast.style.boxShadow = "0 12px 30px rgba(0,0,0,.28)";
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 2600);
}

function injectStyles() {
  if (document.getElementById("usersUpgradeStyles")) return;

  const style = document.createElement("style");
  style.id = "usersUpgradeStyles";
  style.textContent = `
    .users-main{
      display:flex;
      flex-direction:column;
      gap:22px;
      padding:22px;
    }
    .hero-grid{
      display:grid;
      grid-template-columns:1.2fr .8fr;
      gap:16px;
    }
    .stats-grid{
      display:grid;
      grid-template-columns:repeat(4,minmax(0,1fr));
      gap:12px;
      margin-top:14px;
    }
    .stat-card{
      padding:16px;
      border-radius:20px;
      background:rgba(255,255,255,.03);
      border:1px solid rgba(255,255,255,.08);
    }
    .stat-label{
      color:#aeb8c8;
      font-size:12px;
      margin-bottom:8px;
    }
    .stat-value{
      font-size:28px;
      font-weight:800;
      line-height:1.1;
    }
    .split-grid{
      display:grid;
      grid-template-columns:1fr;
      gap:22px;
    }
    .users-grid{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:16px;
    }
    .user-card{
      border-radius:24px;
      padding:18px;
      background:rgba(255,255,255,.03);
      border:1px solid rgba(255,255,255,.08);
      display:flex;
      flex-direction:column;
      gap:12px;
    }
    .user-actions{
      display:flex;
      gap:8px;
      flex-wrap:wrap;
      margin-top:6px;
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
    .role-chip{
      background:rgba(255,255,255,.10);
      font-weight:600;
    }
    .chip[class*="level-"]{
      border:1px solid rgba(255,255,255,.2);
    }
    .muted{
      color:#aeb8c8;
      font-size:13px;
    }
    .empty-state{
      color:#aeb8c8;
      padding:12px 0 4px;
    }
    .section-stack{
      display:flex;
      flex-direction:column;
      gap:16px;
      margin-top:14px;
    }
    .role-section{
      border-radius:24px;
      padding:18px;
      background:rgba(255,255,255,.02);
      border:1px solid rgba(255,255,255,.07);
    }
    .role-header{
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:12px;
      flex-wrap:wrap;
      margin-bottom:14px;
      padding:10px 14px;
      border-radius:14px;
      background:rgba(255,255,255,.05);
    }
    .role-header h3{
      margin:0;
      font-size:14px;
      letter-spacing:.5px;
    }
    .role-count{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-width:42px;
      height:32px;
      border-radius:999px;
      padding:0 12px;
      background:rgba(255,255,255,.08);
      font-size:12px;
      color:#fff;
    }
    .toolbar{
      display:flex;
      gap:12px;
      flex-wrap:wrap;
      align-items:center;
      margin-top:14px;
    }
    .search-input{
      width:100%;
      padding:14px 16px;
      border-radius:16px;
      border:1px solid rgba(255,255,255,.08);
      background:rgba(255,255,255,.04);
      color:#fff;
      outline:none;
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
      width:min(760px,100%);
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
    .kpi-strip{
      display:flex;
      gap:12px;
    }
    .kpi-box{
      flex:1;
      padding:14px;
      border-radius:16px;
      background:rgba(255,255,255,.04);
      display:flex;
      flex-direction:column;
      gap:4px;
    }
    .kpi-box strong{
      font-size:20px;
    }
    @media (max-width: 1100px){
      .hero-grid{
        grid-template-columns:1fr;
      }
      .stats-grid{
        grid-template-columns:repeat(2,minmax(0,1fr));
      }
    }
    @media (max-width: 900px){
      .users-grid,
      .form-grid{
        grid-template-columns:1fr;
      }
    }
    @media (max-width: 640px){
      .stats-grid{
        grid-template-columns:1fr;
      }
      .kpi-strip{
        flex-direction:column;
      }
    }
  `;
  document.head.appendChild(style);
}

async function loadUsers(user) {
  usersState.user = user;

  const isSuper = user.role === "super_admin";

  const [allUsers, pendingUsers] = await Promise.all([
    isSuper ? fetchAllCollection("users") : fetchUsersByCompany(user.companyId),
    isSuper ? fetchPendingUsersByCompany("", true) : fetchPendingUsersByCompany(user.companyId, false)
  ]);

  usersState.pending = pendingUsers;

  usersState.approved = allUsers.filter((item) => {
    const sameCompany = sanitizeCompanyId(item.companyId || "") === sanitizeCompanyId(user.companyId || "");
    if (isSuper) return item.approvalStatus !== "pending";
    return sameCompany && item.approvalStatus !== "pending";
  });
}

function openUserModal(userRecord) {
  usersState.editingId = userRecord.id;
  document.getElementById("userModal").classList.add("open");

  document.getElementById("userModalTitle").textContent = `Edit ${userRecord.name || userRecord.email || "User"}`;
  document.getElementById("editUserName").value = userRecord.name || "";
  document.getElementById("editUserEmail").value = userRecord.email || "";
  document.getElementById("editUserPhone").value = userRecord.phone || "";
  document.getElementById("editUserRole").value = userRecord.role || "customer";
  document.getElementById("editUserStatus").value = userRecord.status || "active";
  document.getElementById("editUserApproval").value = userRecord.approvalStatus || "approved";
  document.getElementById("editUserReportsTo").value = userRecord.reportsTo || "";
}

function closeUserModal() {
  document.getElementById("userModal").classList.remove("open");
  usersState.editingId = null;
}

function getSearchFilteredApprovedUsers() {
  const q = usersState.search.trim().toLowerCase();
  if (!q) return usersState.approved;

  return usersState.approved.filter((user) => {
    return [
      user.name,
      user.email,
      user.username,
      user.handle,
      user.role,
      user.companyId
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
  });
}

function getRoleStats(users) {
  const grouped = groupUsersByRole(users);
  return {
    total: users.length,
    admins: (grouped.super_admin?.length || 0) + (grouped.admin?.length || 0),
    managers: (grouped.manager?.length || 0) + (grouped.operations_coordinator?.length || 0),
    sales: grouped.sales_rep?.length || 0,
    techs: grouped.technician?.length || 0
  };
}

function renderPendingCard(userRecord) {
  return `
    <div class="user-card">
      <div>
        <strong>${userRecord.name || "Unnamed User"}</strong>
        <div class="muted" style="margin-top:6px;">${userRecord.email || "No email"} · ${userRecord.phone || "No phone"}</div>
      </div>

      <div>
        <span class="chip role-chip">${ROLE_LABELS[userRecord.role] || userRecord.role || "Unknown"}</span>
        <span class="chip">${userRecord.approvalStatus || "pending"}</span>
        <span class="chip">${userRecord.status || "inactive"}</span>
      </div>

      <div class="muted">
        Company: ${userRecord.companyId || "—"}<br>
        Username: ${userRecord.username || "—"}<br>
        Handle: ${userRecord.handle || "—"}
      </div>

      <div class="user-actions">
        <button class="btn approve-user-btn" data-id="${userRecord.id}">Approve</button>
        <button class="btn secondary deny-user-btn" data-id="${userRecord.id}">Deny</button>
      </div>
    </div>
  `;
}

function renderApprovedCard(userRecord) {
  const level = Number(userRecord.organizationLevel || 0);

  return `
    <div class="user-card">
      <div>
        <strong>${userRecord.name || "Unnamed User"}</strong>
        <div class="muted" style="margin-top:6px;">${userRecord.email || "No email"} · ${userRecord.phone || "No phone"}</div>
      </div>

      <div>
        <span class="chip role-chip">${ROLE_LABELS[userRecord.role] || userRecord.role || "Unknown"}</span>
        <span class="chip">${userRecord.approvalStatus || "approved"}</span>
        <span class="chip">${userRecord.status || "active"}</span>
        <span class="chip level-${level}">Level ${level || "—"}</span>
        <span class="chip">${userRecord.lastLogin ? "Active" : "Inactive"}</span>
      </div>

      <div class="muted">
        Company: ${userRecord.companyId || "—"}<br>
        Username: ${userRecord.username || "—"}<br>
        Handle: ${userRecord.handle || "—"}<br>
        Reports To: ${userRecord.reportsTo || "—"}
      </div>

      <div class="user-actions">
        <button class="btn secondary edit-user-btn" data-id="${userRecord.id}">Edit</button>
        <button class="btn secondary impersonate-btn" data-id="${userRecord.id}">View As</button>
      </div>
    </div>
  `;
}

function renderApprovedByRole() {
  const filtered = getSearchFilteredApprovedUsers();
  const grouped = groupUsersByRole(filtered);

  return ROLE_ORDER
    .filter((role) => (grouped[role] || []).length > 0)
    .map((role) => {
      const users = grouped[role] || [];
      return `
        <div class="role-section">
          <div class="role-header">
            <h3>${ROLE_LABELS[role] || role}</h3>
            <span class="role-count">${users.length}</span>
          </div>
          <div class="users-grid">
            ${users.map(renderApprovedCard).join("")}
          </div>
        </div>
      `;
    })
    .join("");
}

function renderPage() {
  const filteredApproved = getSearchFilteredApprovedUsers();
  const stats = getRoleStats(filteredApproved);

  const root = document.getElementById("usersRoot");
  root.innerHTML = `
    <main class="users-main">
      <section class="glass-card">
        <div class="section-title-row">
          <div>
            <h1 style="margin:0;">Users Control Center</h1>
            <p class="muted" style="margin:10px 0 0;">Manage approvals, hierarchy, team structure, and account health.</p>
          </div>

          <div class="top-actions">
            <button class="btn" id="refreshUsersBtn">Refresh</button>
          </div>
        </div>

        <div class="toolbar">
          <input
            id="userSearchInput"
            class="search-input"
            placeholder="Search by name, email, username, handle, role, or company..."
            value="${usersState.search.replace(/"/g, "&quot;")}"
          />
        </div>
      </section>

      <section class="glass-card kpi-strip">
        <div class="kpi-box">
          <strong>${stats.total}</strong>
          <span>Approved Users</span>
        </div>
        <div class="kpi-box">
          <strong>${usersState.pending.length}</strong>
          <span>Pending</span>
        </div>
        <div class="kpi-box">
          <strong>${stats.admins}</strong>
          <span>Admins</span>
        </div>
        <div class="kpi-box">
          <strong>${stats.sales + stats.techs}</strong>
          <span>Sales + Techs</span>
        </div>
      </section>

      <div class="split-grid">
        <section class="glass-card">
          <div class="section-title-row">
            <h2>Pending Approvals</h2>
            <div class="muted">${usersState.pending.length} pending</div>
          </div>

          ${
            !usersState.pending.length
              ? `<div class="empty-state">No pending users.</div>`
              : `
                <div class="users-grid" style="margin-top:14px;">
                  ${usersState.pending.map(renderPendingCard).join("")}
                </div>
              `
          }
        </section>

        <section class="glass-card">
          <div class="section-title-row">
            <h2>Approved Users by Role</h2>
            <div class="muted">${filteredApproved.length} visible</div>
          </div>

          ${
            !filteredApproved.length
              ? `<div class="empty-state">No approved users match your search.</div>`
              : `<div class="section-stack">${renderApprovedByRole()}</div>`
          }
        </section>
      </div>
    </main>
  `;

  wirePageEvents();
}

function wirePageEvents() {
  document.getElementById("userSearchInput")?.addEventListener("input", (e) => {
    usersState.search = e.target.value || "";
    renderPage();
  });

  document.getElementById("refreshUsersBtn")?.addEventListener("click", async () => {
    await reloadAndRender();
    showToast("Users refreshed.");
  });

  document.querySelectorAll(".approve-user-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await updateDoc(doc(db, "users", btn.dataset.id), {
        approvalStatus: "approved",
        status: "active",
        updatedAt: serverTimestamp()
      });
      showToast("User approved.");
      await reloadAndRender();
    });
  });

  document.querySelectorAll(".deny-user-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await deleteDoc(doc(db, "users", btn.dataset.id));
      showToast("Pending user denied and removed.");
      await reloadAndRender();
    });
  });

  document.querySelectorAll(".edit-user-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const found = usersState.approved.find((item) => item.id === btn.dataset.id);
      if (found) openUserModal(found);
    });
  });

  document.querySelectorAll(".impersonate-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      showToast("View As is reserved for the next upgrade.");
    });
  });

  document.getElementById("userModalCloseBtn")?.addEventListener("click", closeUserModal);
  document.getElementById("userModalCancelBtn")?.addEventListener("click", closeUserModal);
  document.getElementById("userForm")?.addEventListener("submit", saveUserEdit);
}

async function saveUserEdit(e) {
  e.preventDefault();
  if (!usersState.editingId) return;

  await updateDoc(doc(db, "users", usersState.editingId), {
    name: document.getElementById("editUserName").value.trim(),
    email: document.getElementById("editUserEmail").value.trim(),
    phone: document.getElementById("editUserPhone").value.trim(),
    role: document.getElementById("editUserRole").value,
    status: document.getElementById("editUserStatus").value,
    approvalStatus: document.getElementById("editUserApproval").value,
    reportsTo: document.getElementById("editUserReportsTo").value.trim(),
    updatedAt: serverTimestamp()
  });

  closeUserModal();
  showToast("User updated.");
  await reloadAndRender();
}

async function reloadAndRender() {
  await loadUsers(usersState.user);
  renderPage();
}

requireAuth(async (user) => {
  injectStyles();
  await bindTopbar(user);

  if (!canAccess(user.role, "users")) {
    document.getElementById("usersRoot").innerHTML = `<section class="glass-card" style="margin:22px;">Access denied for users.</section>`;
    return;
  }

  const sidebarTop = document.getElementById("sidebar");
  if (sidebarTop) sidebarTop.innerHTML = "";

  document.getElementById("usersRoot").innerHTML = `<section class="glass-card" style="margin:22px;">Loading users...</section>`;

  try {
    await loadUsers(user);
    renderPage();
  } catch (e) {
    document.getElementById("usersRoot").innerHTML = `<section class="glass-card" style="margin:22px;">Users page failed: ${e.message || e}</section>`;
  }
});