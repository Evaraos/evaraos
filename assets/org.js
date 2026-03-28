import {
  requireAuth,
  bindTopbar,
  fetchAllCollection,
  fetchUsersByCompany,
  sanitizeCompanyId,
  formatHandle
} from "./app.js";

import { canAccess } from "./roles.js";

import {
  doc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "./firebase.js";

const orgState = {
  user: null,
  users: [],
  tree: [],
  selectedUserId: null,
  dragUserId: null,
  search: ""
};

function injectStyles() {
  if (document.getElementById("orgChartStyles")) return;

  const style = document.createElement("style");
  style.id = "orgChartStyles";
  style.textContent = `
    .org-page{
      display:flex;
      flex-direction:column;
      gap:22px;
      padding:22px;
    }
    .org-toolbar{
      display:flex;
      gap:12px;
      flex-wrap:wrap;
      margin-top:14px;
    }
    .org-search{
      width:100%;
      padding:14px 16px;
      border-radius:16px;
      border:1px solid rgba(255,255,255,.08);
      background:rgba(255,255,255,.04);
      color:#fff;
      outline:none;
    }
    .org-help{
      color:#aeb8c8;
      font-size:13px;
      line-height:1.5;
    }
    .org-tree-wrap{
      overflow:auto;
      padding-bottom:12px;
    }
    .org-tree{
      display:flex;
      flex-direction:column;
      gap:18px;
      min-width:780px;
    }
    .org-level{
      display:flex;
      flex-wrap:wrap;
      gap:18px;
      padding-left:24px;
      position:relative;
    }
    .org-level.root{
      padding-left:0;
    }
    .org-level:not(.root)::before{
      content:"";
      position:absolute;
      left:8px;
      top:0;
      bottom:0;
      width:1px;
      border-left:1px dashed rgba(255,255,255,.12);
    }
    .org-branch{
      display:flex;
      flex-direction:column;
      gap:16px;
      position:relative;
    }
    .org-node{
      width:290px;
      border:1px solid rgba(255,255,255,.08);
      border-radius:22px;
      padding:16px;
      background:rgba(255,255,255,.03);
      transition:.18s ease;
      cursor:pointer;
      user-select:none;
      position:relative;
    }
    .org-node:hover{
      transform:translateY(-2px);
      background:rgba(255,255,255,.06);
    }
    .org-node.selected{
      border-color:rgba(255,255,255,.26);
      background:rgba(255,255,255,.08);
      box-shadow:0 14px 32px rgba(0,0,0,.22);
    }
    .org-node.dragging{
      opacity:.55;
      transform:scale(.985);
    }
    .org-node.drag-over{
      border-color:rgba(255,122,89,.92);
      box-shadow:0 0 0 2px rgba(255,122,89,.25);
      background:rgba(255,122,89,.10);
    }
    .org-node-header{
      display:flex;
      justify-content:space-between;
      align-items:flex-start;
      gap:12px;
    }
    .org-name{
      font-weight:800;
      font-size:16px;
      line-height:1.2;
    }
    .org-role{
      font-size:12px;
      color:#aeb8c8;
      margin-top:6px;
      text-transform:capitalize;
    }
    .org-meta{
      color:#aeb8c8;
      font-size:12px;
      line-height:1.5;
      margin-top:10px;
    }
    .org-chip-row{
      display:flex;
      gap:8px;
      flex-wrap:wrap;
      margin-top:12px;
    }
    .org-chip{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding:6px 10px;
      border-radius:999px;
      background:rgba(255,255,255,.08);
      font-size:12px;
      text-transform:capitalize;
    }
    .org-drop-hint{
      margin-top:12px;
      font-size:12px;
      color:#ffb39f;
      display:none;
    }
    .org-node.drag-over .org-drop-hint{
      display:block;
    }
    .org-actions{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      margin-top:14px;
    }
    .org-empty{
      color:#aeb8c8;
      padding:14px 0 6px;
    }
    .org-profile-grid{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:14px;
      margin-top:8px;
    }
    .org-profile-box{
      border-radius:18px;
      padding:14px;
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.07);
    }
    .org-profile-label{
      font-size:12px;
      color:#aeb8c8;
      margin-bottom:8px;
    }
    .org-profile-value{
      font-size:14px;
      color:#fff;
      line-height:1.4;
      word-break:break-word;
    }
    @media (max-width: 800px){
      .org-profile-grid{
        grid-template-columns:1fr;
      }
      .org-tree{
        min-width:unset;
      }
      .org-level{
        padding-left:14px;
      }
      .org-node{
        width:100%;
      }
    }
  `;
  document.head.appendChild(style);
}

function showToast(message, variant = "success") {
  let container = document.getElementById("orgToastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "orgToastContainer";
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

function filteredUsers() {
  const q = orgState.search.trim().toLowerCase();
  if (!q) return orgState.users;

  return orgState.users.filter((u) => {
    return [
      u.name,
      u.email,
      u.role,
      u.username,
      u.handle,
      u.companyId
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
  });
}

function buildTree(users) {
  const map = {};
  const roots = [];

  users.forEach((u) => {
    map[u.id] = { ...u, children: [] };
  });

  users.forEach((u) => {
    const reportsTo = String(u.reportsTo || "").trim();
    if (reportsTo && map[reportsTo] && reportsTo !== u.id) {
      map[reportsTo].children.push(map[u.id]);
    } else {
      roots.push(map[u.id]);
    }
  });

  return roots;
}

function userById(id) {
  return orgState.users.find((u) => u.id === id) || null;
}

function descendantsOf(node) {
  const ids = [];
  function walk(item) {
    (item.children || []).forEach((child) => {
      ids.push(child.id);
      walk(child);
    });
  }
  walk(node);
  return ids;
}

function canDropOnTarget(dragId, targetId) {
  if (!dragId || !targetId) return false;
  if (dragId === targetId) return false;

  const tree = buildTree(orgState.users);
  let dragNode = null;

  function findNode(nodes) {
    for (const node of nodes) {
      if (node.id === dragId) return node;
      const found = findNode(node.children || []);
      if (found) return found;
    }
    return null;
  }

  dragNode = findNode(tree);
  if (!dragNode) return false;

  const descendants = descendantsOf(dragNode);
  if (descendants.includes(targetId)) return false;

  return true;
}

function renderNode(node) {
  const selected = orgState.selectedUserId === node.id ? "selected" : "";
  return `
    <div class="org-branch">
      <div
        class="org-node ${selected}"
        data-id="${node.id}"
        draggable="true"
      >
        <div class="org-node-header">
          <div>
            <div class="org-name">${node.name || "No Name"}</div>
            <div class="org-role">${node.role || "unknown role"}</div>
          </div>
        </div>

        <div class="org-chip-row">
          <span class="org-chip">${node.status || "inactive"}</span>
          <span class="org-chip">${node.approvalStatus || "pending"}</span>
          <span class="org-chip">Level ${node.organizationLevel || "—"}</span>
        </div>

        <div class="org-meta">
          ${node.email || "No email"}<br>
          ${node.phone || "No phone"}<br>
          ${formatHandle(node)}
        </div>

        <div class="org-drop-hint">Drop here to make this user the manager.</div>
      </div>

      ${
        node.children && node.children.length
          ? `<div class="org-level">${node.children.map(renderNode).join("")}</div>`
          : ``
      }
    </div>
  `;
}

function renderTree(tree) {
  if (!tree.length) return `<div class="org-empty">No hierarchy found.</div>`;

  return `
    <div class="org-tree">
      <div class="org-level root">
        ${tree.map(renderNode).join("")}
      </div>
    </div>
  `;
}

function openProfile(userRecord) {
  orgState.selectedUserId = userRecord.id;

  document.getElementById("orgProfileTitle").textContent =
    userRecord.name || userRecord.email || "Profile";

  document.getElementById("orgProfileBody").innerHTML = `
    <div class="org-chip-row" style="margin-top:0;">
      <span class="org-chip">${userRecord.role || "unknown"}</span>
      <span class="org-chip">${userRecord.status || "inactive"}</span>
      <span class="org-chip">${userRecord.approvalStatus || "pending"}</span>
      <span class="org-chip">Level ${userRecord.organizationLevel || "—"}</span>
    </div>

    <div class="org-profile-grid">
      <div class="org-profile-box">
        <div class="org-profile-label">Full Name</div>
        <div class="org-profile-value">${userRecord.name || "—"}</div>
      </div>
      <div class="org-profile-box">
        <div class="org-profile-label">Role</div>
        <div class="org-profile-value">${userRecord.role || "—"}</div>
      </div>
      <div class="org-profile-box">
        <div class="org-profile-label">Email</div>
        <div class="org-profile-value">${userRecord.email || "—"}</div>
      </div>
      <div class="org-profile-box">
        <div class="org-profile-label">Phone</div>
        <div class="org-profile-value">${userRecord.phone || "—"}</div>
      </div>
      <div class="org-profile-box">
        <div class="org-profile-label">Username / Handle</div>
        <div class="org-profile-value">${userRecord.username || "—"} / ${userRecord.handle || "—"}</div>
      </div>
      <div class="org-profile-box">
        <div class="org-profile-label">Company</div>
        <div class="org-profile-value">${userRecord.companyId || "—"}</div>
      </div>
      <div class="org-profile-box">
        <div class="org-profile-label">Reports To</div>
        <div class="org-profile-value">${userById(userRecord.reportsTo)?.name || userRecord.reportsTo || "Root / No manager"}</div>
      </div>
      <div class="org-profile-box">
        <div class="org-profile-label">Last Login</div>
        <div class="org-profile-value">${userRecord.lastLogin || "—"}</div>
      </div>
    </div>

    <div class="org-actions">
      <button class="btn secondary" id="clearManagerBtn">Make Root Node</button>
    </div>
  `;

  document.getElementById("orgProfileModal").classList.add("open");

  document.getElementById("clearManagerBtn")?.addEventListener("click", async () => {
    try {
      await updateDoc(doc(db, "users", userRecord.id), {
        reportsTo: "",
        updatedAt: serverTimestamp()
      });
      showToast("User moved to root level.");
      closeProfile();
      await reloadAndRender();
    } catch (e) {
      showToast(e.message || "Could not update hierarchy.", "error");
    }
  });
}

function closeProfile() {
  document.getElementById("orgProfileModal").classList.remove("open");
}

async function reloadData() {
  const user = orgState.user;
  const users =
    user.role === "super_admin"
      ? await fetchAllCollection("users")
      : await fetchUsersByCompany(user.companyId);

  const normalizedCompany = sanitizeCompanyId(user.companyId || "");

  orgState.users =
    user.role === "super_admin"
      ? users.filter((u) => u.approvalStatus !== "pending")
      : users.filter(
          (u) =>
            sanitizeCompanyId(u.companyId || "") === normalizedCompany &&
            u.approvalStatus !== "pending"
        );

  orgState.tree = buildTree(filteredUsers());
}

function renderPage() {
  orgState.tree = buildTree(filteredUsers());

  document.getElementById("orgRoot").innerHTML = `
    <main class="org-page">
      <section class="glass-card">
        <div class="section-title-row">
          <div>
            <h1 style="margin:0;">Interactive Org Chart</h1>
            <p class="org-help" style="margin:10px 0 0;">
              Click a user to open their profile. Drag one user card onto another to reassign reporting structure.
            </p>
          </div>
          <div class="top-actions">
            <button class="btn" id="refreshOrgBtn">Refresh</button>
          </div>
        </div>

        <div class="org-toolbar">
          <input
            id="orgSearchInput"
            class="org-search"
            placeholder="Search by name, role, email, username, or company..."
            value="${orgState.search.replace(/"/g, "&quot;")}"
          />
        </div>
      </section>

      <section class="glass-card org-tree-wrap">
        ${renderTree(orgState.tree)}
      </section>
    </main>
  `;

  wireEvents();
}

async function moveUserUnderManager(userId, managerId) {
  if (!canDropOnTarget(userId, managerId)) {
    showToast("Invalid hierarchy move.", "error");
    return;
  }

  await updateDoc(doc(db, "users", userId), {
    reportsTo: managerId,
    updatedAt: serverTimestamp()
  });

  showToast("Reporting structure updated.");
  await reloadAndRender();
}

function wireEvents() {
  document.getElementById("refreshOrgBtn")?.addEventListener("click", async () => {
    await reloadAndRender();
    showToast("Org chart refreshed.");
  });

  document.getElementById("orgSearchInput")?.addEventListener("input", (e) => {
    orgState.search = e.target.value || "";
    renderPage();
  });

  document.querySelectorAll(".org-node").forEach((nodeEl) => {
    const nodeId = nodeEl.dataset.id;

    nodeEl.addEventListener("click", () => {
      const record = userById(nodeId);
      if (record) openProfile(record);
    });

    nodeEl.addEventListener("dragstart", (e) => {
      orgState.dragUserId = nodeId;
      nodeEl.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", nodeId);
    });

    nodeEl.addEventListener("dragend", () => {
      nodeEl.classList.remove("dragging");
      document.querySelectorAll(".org-node").forEach((el) => el.classList.remove("drag-over"));
    });

    nodeEl.addEventListener("dragover", (e) => {
      if (canDropOnTarget(orgState.dragUserId, nodeId)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        nodeEl.classList.add("drag-over");
      }
    });

    nodeEl.addEventListener("dragleave", () => {
      nodeEl.classList.remove("drag-over");
    });

    nodeEl.addEventListener("drop", async (e) => {
      e.preventDefault();
      nodeEl.classList.remove("drag-over");
      const draggedId = e.dataTransfer.getData("text/plain") || orgState.dragUserId;
      if (!draggedId) return;

      try {
        await moveUserUnderManager(draggedId, nodeId);
      } catch (err) {
        showToast(err.message || "Could not move user.", "error");
      }
    });
  });

  document.getElementById("orgProfileCloseBtn")?.addEventListener("click", closeProfile);
}

async function reloadAndRender() {
  await reloadData();
  renderPage();
}

requireAuth(async (user) => {
  injectStyles();
  await bindTopbar(user);

  if (!canAccess(user.role, "users")) {
    document.getElementById("orgRoot").innerHTML = `<section class="glass-card" style="margin:22px;">Access denied for org chart.</section>`;
    return;
  }

  orgState.user = user;

  const sidebarTop = document.getElementById("sidebar");
  if (sidebarTop) sidebarTop.innerHTML = "";

  document.getElementById("orgRoot").innerHTML = `<section class="glass-card" style="margin:22px;">Loading org chart...</section>`;

  try {
    await reloadData();
    renderPage();
  } catch (e) {
    document.getElementById("orgRoot").innerHTML = `<section class="glass-card" style="margin:22px;">Org chart failed: ${e.message || e}</section>`;
  }
});