// assets/js/companies.js

import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const companiesSearch = document.getElementById("companiesSearch");
const companiesList = document.getElementById("companiesList");
const companiesFeed = document.getElementById("companiesFeed");

const companiesHeroTitle = document.getElementById("companiesHeroTitle");
const companiesHeroText = document.getElementById("companiesHeroText");

const companiesStatTotal = document.getElementById("companiesStatTotal");
const companiesStatHealthy = document.getElementById("companiesStatHealthy");
const companiesStatReview = document.getElementById("companiesStatReview");
const companiesStatFiltered = document.getElementById("companiesStatFiltered");

const companiesRefreshBtnTop = document.getElementById("companiesRefreshBtnTop");
const companiesRefreshBtnSide = document.getElementById("companiesRefreshBtnSide");
const companiesSortBtn = document.getElementById("companiesSortBtn");

let companiesData = [];
let sortAsc = true;

function normalizeStatus(value = "") {
  return String(value || "").trim().toLowerCase();
}

function companyName(company = {}) {
  return (
    company.name ||
    company.companyName ||
    company.title ||
    company.brand ||
    "Untitled Company"
  );
}

function companyStatus(company = {}) {
  return (
    company.status ||
    company.health ||
    company.state ||
    "active"
  );
}

function companyDescription(company = {}) {
  return (
    company.description ||
    company.summary ||
    company.notes ||
    "No company summary provided."
  );
}

function companyPillClass(status = "") {
  const value = normalizeStatus(status);
  if (["active", "healthy", "live", "approved"].includes(value)) return "success";
  if (["review", "pending", "draft"].includes(value)) return "working";
  if (["inactive", "paused", "archived"].includes(value)) return "muted";
  return "working";
}

function filteredCompanies() {
  const term = String(companiesSearch?.value || "").trim().toLowerCase();
  let rows = [...companiesData];

  if (term) {
    rows = rows.filter((company) => {
      return [
        companyName(company),
        companyDescription(company),
        companyStatus(company)
      ].some((value) => String(value || "").toLowerCase().includes(term));
    });
  }

  rows.sort((a, b) => {
    const left = companyName(a).toLowerCase();
    const right = companyName(b).toLowerCase();

    if (left < right) return sortAsc ? -1 : 1;
    if (left > right) return sortAsc ? 1 : -1;
    return 0;
  });

  return rows;
}

function renderStats(rows) {
  const healthy = rows.filter((row) =>
    ["active", "healthy", "live", "approved"].includes(normalizeStatus(companyStatus(row)))
  ).length;

  const review = rows.filter((row) =>
    ["review", "pending", "draft"].includes(normalizeStatus(companyStatus(row)))
  ).length;

  if (companiesStatTotal) companiesStatTotal.textContent = String(companiesData.length);
  if (companiesStatHealthy) companiesStatHealthy.textContent = String(healthy);
  if (companiesStatReview) companiesStatReview.textContent = String(review);
  if (companiesStatFiltered) companiesStatFiltered.textContent = String(rows.length);

  if (companiesHeroTitle) {
    companiesHeroTitle.textContent = companiesData.length
      ? `${companiesData.length} companies connected`
      : "No companies found yet.";
  }

  if (companiesHeroText) {
    companiesHeroText.textContent = companiesData.length
      ? "Firestore company records are live and ready for review."
      : "Create company records in Firestore to populate this page.";
  }
}

function renderList(rows) {
  if (!companiesList) return;

  if (!rows.length) {
    companiesList.innerHTML = `
      <article class="dashboard-list-item glass-card aurora-card">
        <div>
          <strong>No companies found</strong>
          <span>Try another search or add company records in Firestore.</span>
        </div>
        <span class="dashboard-status-pill muted">Empty</span>
      </article>
    `;
    return;
  }

  companiesList.innerHTML = rows.map((company) => {
    const name = companyName(company);
    const status = companyStatus(company);
    const description = companyDescription(company);

    return `
      <article class="dashboard-list-item glass-card aurora-card">
        <div>
          <strong>${name}</strong>
          <span>${description}</span>
        </div>
        <span class="dashboard-status-pill ${companyPillClass(status)}">${status}</span>
      </article>
    `;
  }).join("");
}

function renderFeed(rows) {
  if (!companiesFeed) return;

  if (!rows.length) {
    companiesFeed.innerHTML = `
      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>No portfolio activity</strong>
        <span>Company activity will appear here once records exist.</span>
      </article>
    `;
    return;
  }

  companiesFeed.innerHTML = rows.slice(0, 6).map((company) => {
    const name = companyName(company);
    const status = companyStatus(company);

    return `
      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>${name}</strong>
        <span>Status: ${status}</span>
      </article>
    `;
  }).join("");
}

function renderCompanies() {
  const rows = filteredCompanies();
  renderStats(rows);
  renderList(rows);
  renderFeed(rows);
}

async function loadCompanies() {
  try {
    const snap = await getDocs(collection(db, "companies"));
    companiesData = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    renderCompanies();
  } catch (error) {
    console.error("Failed to load companies:", error);

    if (companiesList) {
      companiesList.innerHTML = `
        <article class="dashboard-list-item glass-card aurora-card">
          <div>
            <strong>Unable to load companies</strong>
            <span>${error.message || "Firestore request failed."}</span>
          </div>
          <span class="dashboard-status-pill danger">Error</span>
        </article>
      `;
    }

    if (companiesFeed) {
      companiesFeed.innerHTML = `
        <article class="dashboard-feed-item glass-card aurora-card">
          <strong>Load failed</strong>
          <span>${error.message || "Firestore request failed."}</span>
        </article>
      `;
    }
  }
}

function bindEvents() {
  companiesSearch?.addEventListener("input", renderCompanies);

  companiesRefreshBtnTop?.addEventListener("click", loadCompanies);
  companiesRefreshBtnSide?.addEventListener("click", loadCompanies);

  companiesSortBtn?.addEventListener("click", () => {
    sortAsc = !sortAsc;
    companiesSortBtn.textContent = sortAsc ? "Sort A–Z" : "Sort Z–A";
    renderCompanies();
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

  loadCompanies();
});

document.addEventListener("DOMContentLoaded", bindEvents);