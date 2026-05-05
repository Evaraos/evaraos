import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  getSavedUserProfile
} from "./firebase.js";

const usersSearch = document.getElementById("usersSearch");
const usersList = document.getElementById("usersList");
const usersFeed = document.getElementById("usersFeed");

const usersHeroTitle = document.getElementById("usersHeroTitle");
const usersHeroText = document.getElementById("usersHeroText");

const usersStatTotal = document.getElementById("usersStatTotal");
const usersStatElevated = document.getElementById("usersStatElevated");
const usersStatCustomers = document.getElementById("usersStatCustomers");
const usersStatFiltered = document.getElementById("usersStatFiltered");

const usersRefreshBtnTop = document.getElementById("usersRefreshBtnTop");
const usersRefreshBtnSide = document.getElementById("usersRefreshBtnSide");
const usersSortBtn = document.getElementById("usersSortBtn");

let usersData = [];
let companiesData = [];
let sortAsc = true;
let isLoadingUsers = false;
let hasBoundEvents = false;
let hasStartedAuthWatch = false;
let currentFirebaseUser = null;
let editingUserId = null;

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "operations_coordinator", label: "Operations Coordinator" },
  { value: "sales_rep", label: "Sales Rep" },
  { value: "technician", label: "Technician" },
  { value: "hr", label: "HR" },
  { value: "customer", label: "Customer" }
];

function navigateWithLoader(url, options = {}) {
  if (window.EvaraLoader && typeof window.EvaraLoader.beginNavigationLoad === "function") {
    window.EvaraLoader.beginNavigationLoad(options);
  }

  requestAnimationFrame(() => {
    window.location.assign(url);
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeRole(value = "") {
  const role = String(value || "").trim().toLowerCase();
  if (role === "sales") return "sales_rep";
  if (role === "tech") return "technician";
  return role || "customer";
}

function normalizeStatus(value = "") {
  return String(value || "").trim().toLowerCase();
}

function normalizeUsername(value = "") {
  return String(value || "").trim().toLowerCase();
}

function userName(user = {}) {
  return (
    user.fullName ||
    user.displayName ||
    user.name ||
    user.username ||
    user.email ||
    "Unnamed User"
  );
}

function userEmail(user = {}) {
  return user.email || "No email";
}

function userRole(user = {}) {
  return normalizeRole(user.role || "customer");
}

function userStatus(user = {}) {
  return normalizeStatus(user.status || "active");
}

function userApproval(user = {}) {
  return normalizeStatus(user.approvalStatus || "approved");
}

function companyName(company = {}) {
  return company.name || company.companyName || company.brand || company.title || "Untitled Company";
}

function getCompanyById(companyId = "") {
  return companiesData.find((company) => String(company.id) === String(companyId));
}

function userCompanyName(user = {}) {
  const company = getCompanyById(user.companyId || "");
  return user.companyName || (company ? companyName(company) : "No company assigned");
}

function roleLabel(role = "") {
  const normalized = normalizeRole(role);
  return ROLE_OPTIONS.find((item) => item.value === normalized)?.label || normalized || "Customer";
}

function userPillClass(role = "") {
  const value = normalizeRole(role);
  if (["owner", "admin", "manager"].includes(value)) return "success";
  if (["operations_coordinator", "sales_rep", "technician", "hr"].includes(value)) return "working";
  if (["customer"].includes(value)) return "empty";
  return "warning";
}

function statusPillClass(status = "") {
  const value = normalizeStatus(status);
  if (["active", "approved", "live"].includes(value)) return "success";
  if (["pending", "review", "invited"].includes(value)) return "working";
  if (["inactive", "paused", "disabled"].includes(value)) return "empty";
  return "warning";
}

function currentActor() {
  const profile = getSavedUserProfile() || {};
  return {
    uid: currentFirebaseUser?.uid || profile.uid || "",
    email: currentFirebaseUser?.email || profile.email || "",
    displayName:
      profile.displayName ||
      profile.fullName ||
      profile.name ||
      currentFirebaseUser?.displayName ||
      currentFirebaseUser?.email ||
      "Unknown User"
  };
}

function setButtonLoading(isLoading) {
  [usersRefreshBtnTop, usersRefreshBtnSide].forEach((btn) => {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.textContent = isLoading ? "Refreshing..." : "Refresh";
  });
}

function showMessage(message = "", tone = "") {
  const messageEl = document.getElementById("userCrudMessage");
  if (!messageEl) return;

  messageEl.textContent = message;
  messageEl.dataset.tone = tone;
}

function filteredUsers() {
  const term = String(usersSearch?.value || "").trim().toLowerCase();
  let rows = [...usersData];

  if (term) {
    rows = rows.filter((user) => {
      return [
        userName(user),
        userEmail(user),
        roleLabel(userRole(user)),
        userRole(user),
        user.username || "",
        user.uid || "",
        user.id || "",
        userCompanyName(user),
        userStatus(user),
        userApproval(user),
        user.phone || ""
      ].some((value) => String(value || "").toLowerCase().includes(term));
    });
  }

  rows.sort((a, b) => {
    const left = userName(a).toLowerCase();
    const right = userName(b).toLowerCase();

    if (left < right) return sortAsc ? -1 : 1;
    if (left > right) return sortAsc ? 1 : -1;
    return 0;
  });

  return rows;
}

function renderStats(rows) {
  const elevated = usersData.filter((row) =>
    ["owner", "admin", "manager"].includes(userRole(row))
  ).length;

  const customers = usersData.filter((row) => userRole(row) === "customer").length;

  if (usersStatTotal) usersStatTotal.textContent = String(usersData.length);
  if (usersStatElevated) usersStatElevated.textContent = String(elevated);
  if (usersStatCustomers) usersStatCustomers.textContent = String(customers);
  if (usersStatFiltered) usersStatFiltered.textContent = String(rows.length);

  if (usersHeroTitle) {
    usersHeroTitle.textContent = usersData.length
      ? `${usersData.length} users connected`
      : "No users found yet.";
  }

  if (usersHeroText) {
    usersHeroText.textContent = usersData.length
      ? "Firestore user records are live. You can edit role, company assignment, account status, and profile data."
      : "Create a user record or let a new user register from the signup page.";
  }
}

function renderLoadingState() {
  if (usersList) {
    usersList.innerHTML = `
      <div class="dashboard-skeleton-grid">
        <div class="dashboard-skeleton-card">
          <div class="dashboard-skeleton-line line-1"></div>
          <div class="dashboard-skeleton-line line-2"></div>
          <div class="dashboard-skeleton-line line-3"></div>
        </div>
        <div class="dashboard-skeleton-card">
          <div class="dashboard-skeleton-line line-1"></div>
          <div class="dashboard-skeleton-line line-2"></div>
          <div class="dashboard-skeleton-line line-3"></div>
        </div>
      </div>
    `;
  }

  if (usersFeed) {
    usersFeed.innerHTML = `
      <article class="dashboard-state-card loading">
        <strong>Loading users...</strong>
        <span>Pulling Firestore user records, companies, roles, and account states.</span>
      </article>
    `;
  }

  if (usersHeroTitle) usersHeroTitle.textContent = "Loading users...";
  if (usersHeroText) usersHeroText.textContent = "Connecting to Firestore user records.";
}

function renderList(rows) {
  if (!usersList) return;

  if (!rows.length) {
    usersList.innerHTML = `
      <article class="dashboard-state-card empty">
        <strong>No users found</strong>
        <span>Try another search, create a Firestore user record, or let a user sign up.</span>
      </article>
    `;
    return;
  }

  usersList.innerHTML = rows.map((user) => {
    const id = escapeHtml(user.id || user.uid || "");
    const name = escapeHtml(userName(user));
    const email = escapeHtml(userEmail(user));
    const role = escapeHtml(roleLabel(userRole(user)));
    const rawRole = escapeHtml(userRole(user));
    const company = escapeHtml(userCompanyName(user));
    const status = escapeHtml(userStatus(user));
    const approval = escapeHtml(userApproval(user));
    const username = escapeHtml(user.username ? `@${user.username}` : "No username");
    const pillClass = userPillClass(rawRole);

    return `
      <article class="dashboard-list-item glass-card aurora-card active-glow beam-target user-crud-item" data-user-id="${id}">
        <div class="user-crud-content">
          <strong>${name}</strong>
          <span>${email}</span>
          <div class="user-crud-meta">
            <span>${username}</span>
            <span>${company}</span>
            <span>Status: ${status}</span>
            <span>Approval: ${approval}</span>
          </div>
        </div>

        <div class="user-crud-actions">
          <span class="dashboard-status-pill ${pillClass}">${role}</span>
          <button type="button" class="btn btn-theme-secondary user-edit-btn" data-user-edit="${id}">Edit</button>
          <button type="button" class="btn btn-theme-secondary user-delete-btn" data-user-delete="${id}">Delete</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderFeed(rows) {
  if (!usersFeed) return;

  if (!rows.length) {
    usersFeed.innerHTML = `
      <article class="dashboard-state-card empty">
        <strong>No user activity</strong>
        <span>User highlights will appear here once records exist.</span>
      </article>
    `;
    return;
  }

  usersFeed.innerHTML = rows.slice(0, 8).map((user) => {
    const name = escapeHtml(userName(user));
    const role = escapeHtml(roleLabel(userRole(user)));
    const company = escapeHtml(userCompanyName(user));

    return `
      <article class="dashboard-feed-item glass-card aurora-card active-glow beam-target">
        <strong>${name}</strong>
        <span>${role} • ${company}</span>
      </article>
    `;
  }).join("");
}

function renderUsers() {
  const rows = filteredUsers();
  renderStats(rows);
  renderList(rows);
  renderFeed(rows);
}

async function loadCompanies() {
  try {
    const snap = await getDocs(collection(db, "companies"));
    companiesData = snap.docs
      .map((companyDoc) => ({ id: companyDoc.id, ...companyDoc.data() }))
      .sort((a, b) => companyName(a).localeCompare(companyName(b)));
  } catch (error) {
    console.warn("Failed to load companies for users page:", error);
    companiesData = [];
  }
}

async function loadUsers() {
  if (isLoadingUsers) return;

  isLoadingUsers = true;
  setButtonLoading(true);
  renderLoadingState();

  try {
    await loadCompanies();

    const snap = await getDocs(collection(db, "users"));
    usersData = snap.docs.map((userDoc) => ({
      id: userDoc.id,
      ...userDoc.data()
    }));

    renderUsers();
  } catch (error) {
    console.error("Failed to load users:", error);

    if (usersList) {
      usersList.innerHTML = `
        <article class="dashboard-state-card error">
          <strong>Unable to load users</strong>
          <span>${escapeHtml(error.message || "Firestore request failed.")}</span>
        </article>
      `;
    }

    if (usersFeed) {
      usersFeed.innerHTML = `
        <article class="dashboard-state-card error">
          <strong>Load failed</strong>
          <span>${escapeHtml(error.message || "Firestore request failed.")}</span>
        </article>
      `;
    }
  } finally {
    isLoadingUsers = false;
    setButtonLoading(false);
  }
}

function injectCrudStyles() {
  if (document.getElementById("userCrudStyles")) return;

  const style = document.createElement("style");
  style.id = "userCrudStyles";
  style.textContent = `
    .user-crud-item {
      align-items: flex-start;
      gap: 16px;
    }

    .user-crud-content {
      min-width: 0;
      display: grid;
      gap: 8px;
    }

    .user-crud-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 4px;
    }

    .user-crud-meta span {
      border-radius: 999px;
      padding: 6px 9px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.06);
      color: var(--text-muted, rgba(255,255,255,0.68));
      font-size: 11px;
      font-weight: 800;
    }

    .user-crud-actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      min-width: 210px;
    }

    .user-crud-actions .btn {
      min-height: 34px;
      padding: 8px 10px;
      font-size: 12px;
    }

    .user-crud-modal {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: none;
      place-items: center;
      padding: 20px;
      background: rgba(0,0,0,0.62);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
    }

    .user-crud-modal.open { display: grid; }

    .user-crud-card {
      width: min(900px, 100%);
      max-height: min(840px, calc(100vh - 40px));
      overflow: auto;
      border-radius: 28px;
      padding: 22px;
      background: rgba(10, 12, 26, 0.90);
      border: 1px solid rgba(255,255,255,0.16);
      box-shadow: 0 34px 120px rgba(0,0,0,0.46);
    }

    .user-crud-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 16px;
    }

    .user-crud-head h2 {
      margin: 0;
      letter-spacing: -0.04em;
    }

    .user-crud-head p,
    .user-crud-note {
      margin: 7px 0 0;
      color: var(--text-muted, rgba(255,255,255,0.68));
      line-height: 1.5;
    }

    .user-crud-note {
      padding: 12px 14px;
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.06);
      margin-bottom: 16px;
      font-size: 13px;
      font-weight: 700;
    }

    .user-crud-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    .user-crud-field.full {
      grid-column: 1 / -1;
    }

    .user-crud-field label {
      display: block;
      margin-bottom: 8px;
      color: var(--text-muted, rgba(255,255,255,0.68));
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .user-crud-field input,
    .user-crud-field select,
    .user-crud-field textarea {
      width: 100%;
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.14);
      background: rgba(255,255,255,0.08);
      color: var(--text-primary, #fff);
      padding: 13px 14px;
      outline: none;
      font: inherit;
    }

    .user-crud-field select option {
      color: #111;
    }

    .user-crud-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 18px;
    }

    .user-crud-footer-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    #userCrudMessage {
      margin: 0;
      color: var(--text-muted, rgba(255,255,255,0.68));
      font-size: 13px;
      font-weight: 800;
    }

    #userCrudMessage[data-tone="success"] { color: #70ffbd; }
    #userCrudMessage[data-tone="error"] { color: #ff9b8f; }

    @media (max-width: 760px) {
      .user-crud-item {
        display: grid;
      }

      .user-crud-actions {
        justify-content: flex-start;
        min-width: 0;
      }

      .user-crud-grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  document.head.appendChild(style);
}

function roleOptionsHtml(selectedRole = "customer") {
  const selected = normalizeRole(selectedRole);
  return ROLE_OPTIONS.map((option) => `
    <option value="${option.value}" ${option.value === selected ? "selected" : ""}>${option.label}</option>
  `).join("");
}

function companyOptionsHtml(selectedCompanyId = "") {
  const selected = String(selectedCompanyId || "");
  return `
    <option value="">No company assigned</option>
    ${companiesData.map((company) => {
      const id = escapeHtml(company.id);
      const name = escapeHtml(companyName(company));
      const selectedAttr = String(company.id) === selected ? "selected" : "";
      return `<option value="${id}" ${selectedAttr}>${name}</option>`;
    }).join("")}
  `;
}

function injectCrudUi() {
  injectCrudStyles();

  const heroActions = document.querySelector("#usersHeroSection .dashboard-hero-actions");
  if (heroActions && !document.getElementById("userCreateBtn")) {
    const button = document.createElement("button");
    button.type = "button";
    button.id = "userCreateBtn";
    button.className = "btn btn-theme-primary beam-target";
    button.textContent = "Add User Record";
    heroActions.prepend(button);
  }

  if (document.getElementById("userCrudModal")) return;

  const modal = document.createElement("div");
  modal.id = "userCrudModal";
  modal.className = "user-crud-modal";
  modal.innerHTML = `
    <section class="user-crud-card aurora-card active-glow beam-target" role="dialog" aria-modal="true" aria-labelledby="userCrudTitle">
      <div class="user-crud-head">
        <div>
          <h2 id="userCrudTitle">Add User Record</h2>
          <p id="userCrudSubtitle">Create or update a Firestore user profile connected to Evaraos companies.</p>
        </div>
        <button type="button" class="btn btn-theme-secondary beam-target" id="userCrudCloseBtn">Close</button>
      </div>

      <p class="user-crud-note">
        This manages the Firestore user profile. New login accounts still need to register through Signup or be created through Firebase Auth.
      </p>

      <form id="userCrudForm" novalidate>
        <div class="user-crud-grid">
          <div class="user-crud-field">
            <label for="userFullNameInput">Full Name</label>
            <input id="userFullNameInput" name="fullName" type="text" placeholder="Jane Doe" required />
          </div>

          <div class="user-crud-field">
            <label for="userUsernameInput">Username</label>
            <input id="userUsernameInput" name="username" type="text" placeholder="jane" />
          </div>

          <div class="user-crud-field">
            <label for="userEmailInput">Email</label>
            <input id="userEmailInput" name="email" type="email" placeholder="jane@example.com" />
          </div>

          <div class="user-crud-field">
            <label for="userPhoneInput">Phone</label>
            <input id="userPhoneInput" name="phone" type="tel" placeholder="904-000-0000" />
          </div>

          <div class="user-crud-field">
            <label for="userRoleInput">Role</label>
            <select id="userRoleInput" name="role"></select>
          </div>

          <div class="user-crud-field">
            <label for="userCompanyInput">Company</label>
            <select id="userCompanyInput" name="companyId"></select>
          </div>

          <div class="user-crud-field">
            <label for="userStatusInput">Account Status</label>
            <select id="userStatusInput" name="status">
              <option value="active">Active</option>
              <option value="invited">Invited</option>
              <option value="pending">Pending</option>
              <option value="paused">Paused</option>
              <option value="inactive">Inactive</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>

          <div class="user-crud-field">
            <label for="userApprovalInput">Approval Status</label>
            <select id="userApprovalInput" name="approvalStatus">
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="review">Review</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div class="user-crud-field full">
            <label for="userBioInput">Bio / Notes</label>
            <textarea id="userBioInput" name="bio" rows="4" placeholder="Internal notes, territory, onboarding context..."></textarea>
          </div>
        </div>

        <div class="user-crud-footer">
          <p id="userCrudMessage" aria-live="polite"></p>
          <div class="user-crud-footer-actions">
            <button type="button" class="btn btn-theme-secondary beam-target" id="userCrudCancelBtn">Cancel</button>
            <button type="submit" class="btn btn-theme-primary beam-target" id="userCrudSaveBtn">Save User</button>
          </div>
        </div>
      </form>
    </section>
  `;

  document.body.appendChild(modal);
}

function getModal() {
  return document.getElementById("userCrudModal");
}

function getUserById(id) {
  return usersData.find((user) => String(user.id || user.uid) === String(id));
}

function setSelectValuesForModal(user = {}) {
  const roleInput = document.getElementById("userRoleInput");
  const companyInput = document.getElementById("userCompanyInput");

  if (roleInput) roleInput.innerHTML = roleOptionsHtml(user.role || "customer");
  if (companyInput) companyInput.innerHTML = companyOptionsHtml(user.companyId || "");
}

function setFormValues(user = {}) {
  document.getElementById("userFullNameInput").value = userName(user) === "Unnamed User" ? "" : userName(user);
  document.getElementById("userUsernameInput").value = user.username || "";
  document.getElementById("userEmailInput").value = user.email || "";
  document.getElementById("userPhoneInput").value = user.phone || "";
  document.getElementById("userStatusInput").value = userStatus(user) || "active";
  document.getElementById("userApprovalInput").value = userApproval(user) || "approved";
  document.getElementById("userBioInput").value = user.bio || user.notes || "";
  setSelectValuesForModal(user);
}

function openUserModal(userId = null) {
  injectCrudUi();

  editingUserId = userId;
  const user = userId ? getUserById(userId) : null;
  const modal = getModal();
  const form = document.getElementById("userCrudForm");
  const title = document.getElementById("userCrudTitle");
  const subtitle = document.getElementById("userCrudSubtitle");
  const saveBtn = document.getElementById("userCrudSaveBtn");

  if (!modal || !form) return;

  form.reset();
  showMessage("");

  if (user) {
    if (title) title.textContent = "Edit User";
    if (subtitle) subtitle.textContent = `Updating ${userName(user)} in Firestore.`;
    if (saveBtn) saveBtn.textContent = "Save Changes";
    setFormValues(user);
  } else {
    if (title) title.textContent = "Add User Record";
    if (subtitle) subtitle.textContent = "Create a Firestore user profile. Login access still requires Signup/Firebase Auth.";
    if (saveBtn) saveBtn.textContent = "Create User Record";
    setFormValues({ role: "customer", status: "invited", approvalStatus: "pending" });
  }

  modal.classList.add("open");

  setTimeout(() => {
    document.getElementById("userFullNameInput")?.focus();
  }, 60);
}

function closeUserModal() {
  getModal()?.classList.remove("open");
  editingUserId = null;
  showMessage("");
}

function formToUserPayload() {
  const fullName = String(document.getElementById("userFullNameInput")?.value || "").trim();
  const username = String(document.getElementById("userUsernameInput")?.value || "").trim();
  const usernameLower = normalizeUsername(username);
  const email = String(document.getElementById("userEmailInput")?.value || "").trim().toLowerCase();
  const phone = String(document.getElementById("userPhoneInput")?.value || "").trim();
  const role = normalizeRole(document.getElementById("userRoleInput")?.value || "customer");
  const companyId = String(document.getElementById("userCompanyInput")?.value || "").trim();
  const status = normalizeStatus(document.getElementById("userStatusInput")?.value || "active");
  const approvalStatus = normalizeStatus(document.getElementById("userApprovalInput")?.value || "approved");
  const bio = String(document.getElementById("userBioInput")?.value || "").trim();

  if (!fullName) {
    throw new Error("Full name is required.");
  }

  const company = getCompanyById(companyId);
  const actor = currentActor();

  return {
    displayName: fullName,
    fullName,
    name: fullName,
    username,
    usernameLower,
    email,
    phone,
    role,
    companyId,
    companyName: company ? companyName(company) : "",
    companySlug: company?.slug || "",
    companyCategory: company?.category || company?.industry || "",
    status,
    approvalStatus,
    bio,
    notes: bio,
    searchText: [fullName, username, email, phone, role, company ? companyName(company) : "", status, approvalStatus, bio]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
    updatedByEmail: actor.email,
    updatedByName: actor.displayName
  };
}

async function saveUser(event) {
  event?.preventDefault();

  const saveBtn = document.getElementById("userCrudSaveBtn");

  try {
    const payload = formToUserPayload();

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = editingUserId ? "Saving..." : "Creating...";
    }

    if (editingUserId) {
      await updateDoc(doc(db, "users", editingUserId), payload);
      showMessage("User updated successfully.", "success");
    } else {
      const actor = currentActor();
      await addDoc(collection(db, "users"), {
        ...payload,
        uid: "",
        id: "",
        authLinked: false,
        createdAt: serverTimestamp(),
        createdBy: actor.uid,
        createdByEmail: actor.email,
        createdByName: actor.displayName
      });
      showMessage("User record created. They still need a Firebase Auth login to sign in.", "success");
    }

    await loadUsers();

    setTimeout(() => {
      closeUserModal();
    }, 450);
  } catch (error) {
    console.error("User save failed:", error);
    showMessage(error.message || "User save failed.", "error");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = editingUserId ? "Save Changes" : "Create User Record";
    }
  }
}

async function deleteUser(userId) {
  const user = getUserById(userId);
  if (!user) return;

  if (String(user.id) === String(currentFirebaseUser?.uid)) {
    alert("You cannot delete your own active user document from this page.");
    return;
  }

  const confirmed = window.confirm(
    `Delete Firestore profile for ${userName(user)}? This does not delete the Firebase Auth login. This cannot be undone.`
  );

  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, "users", userId));
    usersData = usersData.filter((item) => String(item.id || item.uid) !== String(userId));
    renderUsers();
  } catch (error) {
    console.error("User delete failed:", error);
    alert(error.message || "Unable to delete user.");
  }
}

function bindCrudEvents() {
  injectCrudUi();

  document.getElementById("userCreateBtn")?.addEventListener("click", () => openUserModal());
  document.getElementById("userCrudCloseBtn")?.addEventListener("click", closeUserModal);
  document.getElementById("userCrudCancelBtn")?.addEventListener("click", closeUserModal);
  document.getElementById("userCrudForm")?.addEventListener("submit", saveUser);

  getModal()?.addEventListener("click", (event) => {
    if (event.target === getModal()) closeUserModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && getModal()?.classList.contains("open")) {
      closeUserModal();
    }
  });

  usersList?.addEventListener("click", (event) => {
    const editBtn = event.target.closest("[data-user-edit]");
    const deleteBtn = event.target.closest("[data-user-delete]");

    if (editBtn) {
      openUserModal(editBtn.getAttribute("data-user-edit"));
      return;
    }

    if (deleteBtn) {
      deleteUser(deleteBtn.getAttribute("data-user-delete"));
    }
  });
}

function bindEvents() {
  if (hasBoundEvents) return;
  hasBoundEvents = true;

  injectCrudUi();
  bindCrudEvents();

  usersSearch?.addEventListener("input", renderUsers);

  usersRefreshBtnTop?.addEventListener("click", loadUsers);
  usersRefreshBtnSide?.addEventListener("click", loadUsers);

  usersSortBtn?.addEventListener("click", () => {
    sortAsc = !sortAsc;
    usersSortBtn.textContent = sortAsc ? "Sort A–Z" : "Sort Z–A";
    renderUsers();
  });

  document.querySelectorAll(".dashboard-nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".dashboard-nav-link").forEach((item) => {
        item.classList.remove("active");
      });
      link.classList.add("active");
    });
  });
}

function initUsersPage() {
  if (hasStartedAuthWatch) return;
  hasStartedAuthWatch = true;

  bindEvents();

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      navigateWithLoader("/login.html", {
        title: "Returning to login",
        subtitle: "Your session is not active."
      });
      return;
    }

    currentFirebaseUser = user;
    loadUsers();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initUsersPage);
} else {
  initUsersPage();
}
