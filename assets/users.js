import {
  bindTopbar,
  requireAuth,
  fetchAllCollection,
  fetchUsersByCompany,
  fetchPendingUsersByCompany,
  sanitizeCompanyId
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
    .muted{
      color:#aeb8c8;
      font-size:13px;
    }
    .empty-state{
      color:#aeb8c8;
      padding:12px 0 4px;
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
    .split-grid{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:22px;
    }
    @media (max-width: 900px){
      .split-grid,
      .users-grid,
      .form-grid{
        grid-template-columns:1fr;
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

function renderPendingCard(userRecord) {
  return `
    <div class="user-card">
      <div>
        <strong>${userRecord.name || "Unnamed User"}</strong>
        <div class="muted" style="margin-top:6px;">${userRecord.email || "No email"} · ${userRecord.phone || "No phone"}</div>
      </div>

      <div>
        <span class="chip">${userRecord.role || "unknown"}</span>
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
  return `
    <div class="user-card">
      <div>
        <strong>${userRecord.name || "Unnamed User"}</strong>
        <div class="muted" style="margin-top:6px;">${userRecord.email || "No email"} · ${userRecord.phone || "No phone"}</div>
      </div>

      <div>
        <span class="chip">${userRecord.role || "unknown"}</span>
        <span class="chip">${userRecord.approvalStatus || "approved"}</span>
        <span class="chip">${userRecord.status || "active"}</span>
      </div>

      <div class="muted">
        Company: ${userRecord.companyId || "—"}<br>
        Username: ${userRecord.username || "—"}<br>
        Handle: ${userRecord.handle || "—"}<br>
        Reports To: ${userRecord.reportsTo || "—"}
      </div>

      <div class="user-actions">
        <button class="btn secondary edit-user-btn" data-id="${userRecord.id}">Edit</button>
      </div>
    </div>
  `;
}

function renderPage() {
  const root = document.getElementById("usersRoot");
  root.innerHTML = `
    <main class="users-main">
      <section class="glass-card">
        <div class="section-title-row">
          <div>
            <h1 style="margin:0;">Users & Approvals</h1>
            <p class="muted" style="margin:10px 0 0;">Manage staff roles, approval flow, and account status.</p>
          </div>
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
                <div class="users-grid" style="grid-template-columns:1fr; margin-top:14px;">
                  ${usersState.pending.map(renderPendingCard).join("")}
                </div>
              `
          }
        </section>

        <section class="glass-card">
          <div class="section-title-row">
            <h2>Approved Users</h2>
            <div class="muted">${usersState.approved.length} active records</div>
          </div>

          ${
            !usersState.approved.length
              ? `<div class="empty-state">No approved users found.</div>`
              : `
                <div class="users-grid" style="grid-template-columns:1fr; margin-top:14px;">
                  ${usersState.approved.map(renderApprovedCard).join("")}
                </div>
              `
          }
        </section>
      </div>
    </main>
  `;

  wirePageEvents();
}

function wirePageEvents() {
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