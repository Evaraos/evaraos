import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
let sortAsc = true;

function normalizeRole(value = "") {
  return String(value || "").trim().toLowerCase();
}

function userName(user = {}) {
  return (
    user.fullName ||
    user.displayName ||
    user.name ||
    user.email ||
    "Unnamed User"
  );
}

function userEmail(user = {}) {
  return user.email || "No email";
}

function userRole(user = {}) {
  return user.role || "customer";
}

function userPillClass(role = "") {
  const value = normalizeRole(role);
  if (["owner", "admin", "manager"].includes(value)) return "success";
  if (["sales", "technician"].includes(value)) return "working";
  return "muted";
}

function filteredUsers() {
  const term = String(usersSearch?.value || "").trim().toLowerCase();
  let rows = [...usersData];

  if (term) {
    rows = rows.filter((user) => {
      return [
        userName(user),
        userEmail(user),
        userRole(user)
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
  const elevated = rows.filter((row) =>
    ["owner", "admin", "manager"].includes(normalizeRole(userRole(row)))
  ).length;

  const customers = rows.filter((row) =>
    normalizeRole(userRole(row)) === "customer"
  ).length;

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
      ? "Firestore user records are live and ready for review."
      : "Create user records in Firestore to populate this page.";
  }
}

function renderList(rows) {
  if (!usersList) return;

  if (!rows.length) {
    usersList.innerHTML = `
      <article class="dashboard-list-item glass-card aurora-card">
        <div>
          <strong>No users found</strong>
          <span>Try another search or add user records in Firestore.</span>
        </div>
        <span class="dashboard-status-pill muted">Empty</span>
      </article>
    `;
    return;
  }

  usersList.innerHTML = rows.map((user) => {
    const name = userName(user);
    const email = userEmail(user);
    const role = userRole(user);

    return `
      <article class="dashboard-list-item glass-card aurora-card">
        <div>
          <strong>${name}</strong>
          <span>${email}</span>
        </div>
        <span class="dashboard-status-pill ${userPillClass(role)}">${role}</span>
      </article>
    `;
  }).join("");
}

function renderFeed(rows) {
  if (!usersFeed) return;

  if (!rows.length) {
    usersFeed.innerHTML = `
      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>No user activity</strong>
        <span>User highlights will appear here once records exist.</span>
      </article>
    `;
    return;
  }

  usersFeed.innerHTML = rows.slice(0, 6).map((user) => {
    const name = userName(user);
    const role = userRole(user);

    return `
      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>${name}</strong>
        <span>Role: ${role}</span>
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

async function loadUsers() {
  try {
    const snap = await getDocs(collection(db, "users"));
    usersData = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    renderUsers();
  } catch (error) {
    console.error("Failed to load users:", error);

    if (usersList) {
      usersList.innerHTML = `
        <article class="dashboard-list-item glass-card aurora-card">
          <div>
            <strong>Unable to load users</strong>
            <span>${error.message || "Firestore request failed."}</span>
          </div>
          <span class="dashboard-status-pill danger">Error</span>
        </article>
      `;
    }

    if (usersFeed) {
      usersFeed.innerHTML = `
        <article class="dashboard-feed-item glass-card aurora-card">
          <strong>Load failed</strong>
          <span>${error.message || "Firestore request failed."}</span>
        </article>
      `;
    }
  }
}

function bindEvents() {
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

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "/evaraos/login.html";
    return;
  }

  loadUsers();
});

document.addEventListener("DOMContentLoaded", bindEvents);