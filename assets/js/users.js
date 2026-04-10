// assets/js/users.js

import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const usersSearch = document.getElementById("usersSearch");
const usersList = document.getElementById("usersList");
const usersRoleGrid = document.getElementById("usersRoleGrid");
const usersFeed = document.getElementById("usersFeed");

const usersHeroTitle = document.getElementById("usersHeroTitle");
const usersHeroText = document.getElementById("usersHeroText");

const usersStatTotal = document.getElementById("usersStatTotal");
const usersStatLeaders = document.getElementById("usersStatLeaders");
const usersStatFiltered = document.getElementById("usersStatFiltered");
const usersStatTopRole = document.getElementById("usersStatTopRole");

const usersStatTotalMeta = document.getElementById("usersStatTotalMeta");
const usersStatLeadersMeta = document.getElementById("usersStatLeadersMeta");
const usersStatFilteredMeta = document.getElementById("usersStatFilteredMeta");
const usersStatTopRoleMeta = document.getElementById("usersStatTopRoleMeta");

const usersRefreshBtnTop = document.getElementById("usersRefreshBtnTop");
const usersRefreshBtnSide = document.getElementById("usersRefreshBtnSide");
const usersSortBtn = document.getElementById("usersSortBtn");

let userRecords = [];
let filteredUsers = [];
let sortAscending = true;

function normalize(value = "") {
  return String(value || "").trim().toLowerCase();
}

function titleFromUser(user) {
  return user.fullName || user.displayName || user.name || user.email || "Unnamed User";
}

function roleLabel(role = "") {
  const value = String(role || "").trim().toLowerCase();
  if (!value) return "Customer";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function roleStatusClass(role = "") {
  const value = normalize(role);
  if (["owner", "admin", "manager"].includes(value)) return "good";
  if (["sales", "technician"].includes(value)) return "working";
  return "alert";
}

function getRoleCounts(users) {
  const counts = {};
  users.forEach((user) => {
    const role = normalize(user.role || "customer");
    counts[role] = (counts[role] || 0) + 1;
  });
  return counts;
}

function renderStats() {
  const roleCounts = getRoleCounts(userRecords);
  const leaderCount = (roleCounts.owner || 0) + (roleCounts.admin || 0);

  const topRoleEntry = Object.entries(roleCounts).sort((a, b) => b[1] - a[1])[0];
  const topRole = topRoleEntry ? roleLabel(topRoleEntry[0]) : "—";

  usersStatTotal.textContent = String(userRecords.length);
  usersStatLeaders.textContent = String(leaderCount);
  usersStatFiltered.textContent = String(filteredUsers.length);
  usersStatTopRole.textContent = topRole;

  usersStatTotalMeta.textContent = "User records loaded";
  usersStatLeadersMeta.textContent = "Owner and admin accounts";
  usersStatFilteredMeta.textContent = "Matches current search";
  usersStatTopRoleMeta.textContent = topRoleEntry ? `${topRoleEntry[1]} user(s)` : "No roles found";
}

function renderUsersList() {
  if (!filteredUsers.length) {
    usersList.innerHTML = `
      <article class="dashboard-list-item glass-card aurora-card">
        <div>
          <strong>No users found</strong>
          <span>Try a different search or add user records to Firestore.</span>
        </div>
        <span class="dashboard-status-pill alert">Empty</span>
      </article>
    `;
    return;
  }

  usersList.innerHTML = filteredUsers.map((user) => `
    <article class="dashboard-list-item glass-card aurora-card">
      <div>
        <strong>${titleFromUser(user)}</strong>
        <span>${user.email || "No email"} • ${roleLabel(user.role || "customer")}</span>
      </div>
      <span class="dashboard-status-pill ${roleStatusClass(user.role)}">${roleLabel(user.role || "customer")}</span>
    </article>
  `).join("");
}

function renderRoleGrid() {
  const roleCounts = getRoleCounts(userRecords);
  const orderedRoles = ["owner", "admin", "manager", "sales", "technician", "customer"];

  usersRoleGrid.innerHTML = orderedRoles.map((role) => `
    <article class="dashboard-role-card glass-card aurora-card">
      <strong>${roleLabel(role)}</strong>
      <span>${roleCounts[role] || 0} user(s)</span>
    </article>
  `).join("");
}

function renderUsersFeed() {
  if (!userRecords.length) {
    usersFeed.innerHTML = `
      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>No user activity</strong>
        <span>User feed will appear once directory records are available.</span>
      </article>
    `;
    return;
  }

  usersFeed.innerHTML = userRecords.slice(0, 6).map((user) => `
    <article class="dashboard-feed-item glass-card aurora-card">
      <strong>${titleFromUser(user)}</strong>
      <span>${user.email || "No email"} • Role: ${roleLabel(user.role || "customer")}</span>
    </article>
  `).join("");
}

function applySearchAndSort() {
  const query = normalize(usersSearch?.value || "");

  filteredUsers = userRecords.filter((user) => {
    const haystack = [
      user.fullName,
      user.displayName,
      user.name,
      user.email,
      user.role
    ].map((value) => normalize(value)).join(" ");

    return haystack.includes(query);
  });

  filteredUsers.sort((a, b) => {
    const first = titleFromUser(a).toLowerCase();
    const second = titleFromUser(b).toLowerCase();
    return sortAscending ? first.localeCompare(second) : second.localeCompare(first);
  });

  renderStats();
  renderUsersList();
}

async function loadUsers() {
  usersHeroTitle.textContent = "Loading users...";
  usersHeroText.textContent = "Connecting to Firestore user records.";

  try {
    const snap = await getDocs(collection(db, "users"));
    userRecords = snap.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data()
    }));

    filteredUsers = [...userRecords];
    applySearchAndSort();
    renderRoleGrid();
    renderUsersFeed();

    usersHeroTitle.textContent = "Directory connected";
    usersHeroText.textContent = `${userRecords.length} users loaded from Firestore.`;
  } catch (error) {
    console.error("Failed loading users:", error);

    usersHeroTitle.textContent = "Load failed";
    usersHeroText.textContent = "Check Firestore rules and the users collection.";

    usersList.innerHTML = `
      <article class="dashboard-list-item glass-card aurora-card">
        <div>
          <strong>Unable to load users</strong>
          <span>${error.message || "Unknown Firestore error."}</span>
        </div>
        <span class="dashboard-status-pill alert">Error</span>
      </article>
    `;

    usersRoleGrid.innerHTML = `
      <article class="dashboard-role-card glass-card aurora-card">
        <strong>Role load failed</strong>
        <span>${error.message || "Unknown Firestore error."}</span>
      </article>
    `;

    usersFeed.innerHTML = `
      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>User feed unavailable</strong>
        <span>${error.message || "Unknown Firestore error."}</span>
      </article>
    `;
  }
}

function bindSidebarAnchors() {
  document.querySelectorAll(".dashboard-nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".dashboard-nav-link").forEach((item) => {
        item.classList.remove("active");
      });
      link.classList.add("active");
    });
  });
}

if (usersSearch) {
  usersSearch.addEventListener("input", applySearchAndSort);
}

if (usersSortBtn) {
  usersSortBtn.addEventListener("click", () => {
    sortAscending = !sortAscending;
    usersSortBtn.textContent = sortAscending ? "Sort A–Z" : "Sort Z–A";
    applySearchAndSort();
  });
}

if (usersRefreshBtnTop) {
  usersRefreshBtnTop.addEventListener("click", async () => {
    await loadUsers();
  });
}

if (usersRefreshBtnSide) {
  usersRefreshBtnSide.addEventListener("click", async () => {
    await loadUsers();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindSidebarAnchors();

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "/evaraos/login.html";
      return;
    }

    await loadUsers();
  });
});