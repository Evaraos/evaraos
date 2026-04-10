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

const companiesStatTotalMeta = document.getElementById("companiesStatTotalMeta");
const companiesStatHealthyMeta = document.getElementById("companiesStatHealthyMeta");
const companiesStatReviewMeta = document.getElementById("companiesStatReviewMeta");
const companiesStatFilteredMeta = document.getElementById("companiesStatFilteredMeta");

const companiesRefreshBtnTop = document.getElementById("companiesRefreshBtnTop");
const companiesRefreshBtnSide = document.getElementById("companiesRefreshBtnSide");
const companiesSortBtn = document.getElementById("companiesSortBtn");

let companyRecords = [];
let filteredCompanies = [];
let sortAscending = true;

function normalize(value = "") {
  return String(value || "").trim().toLowerCase();
}

function niceStatus(status = "") {
  const value = String(status || "").trim();
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Active";
}

function statusClass(status = "") {
  const value = normalize(status);

  if (["healthy", "active", "approved", "complete", "completed"].includes(value)) {
    return "good";
  }

  if (["review", "pending", "new"].includes(value)) {
    return "alert";
  }

  return "working";
}

function companyTitle(company) {
  return company.name || company.title || company.companyName || "Untitled Company";
}

function companySubtitle(company) {
  return company.description || company.location || company.category || "Company record from Firestore";
}

function renderStats() {
  const healthyCount = companyRecords.filter((company) =>
    ["healthy", "active", "approved"].includes(normalize(company.status || company.health || "active"))
  ).length;

  const reviewCount = companyRecords.filter((company) =>
    ["review", "pending"].includes(normalize(company.status || company.health || ""))
  ).length;

  companiesStatTotal.textContent = String(companyRecords.length);
  companiesStatHealthy.textContent = String(healthyCount);
  companiesStatReview.textContent = String(reviewCount);
  companiesStatFiltered.textContent = String(filteredCompanies.length);

  companiesStatTotalMeta.textContent = "Company records loaded";
  companiesStatHealthyMeta.textContent = "Healthy or active companies";
  companiesStatReviewMeta.textContent = "Records needing review";
  companiesStatFilteredMeta.textContent = "Matches current search";
}

function renderCompaniesList() {
  if (!filteredCompanies.length) {
    companiesList.innerHTML = `
      <article class="dashboard-list-item glass-card aurora-card">
        <div>
          <strong>No companies found</strong>
          <span>Try a different search or add company records to Firestore.</span>
        </div>
        <span class="dashboard-status-pill alert">Empty</span>
      </article>
    `;
    return;
  }

  companiesList.innerHTML = filteredCompanies.map((company) => {
    const status = niceStatus(company.status || company.health || "active");
    const pill = statusClass(company.status || company.health || "active");

    return `
      <article class="dashboard-list-item glass-card aurora-card">
        <div>
          <strong>${companyTitle(company)}</strong>
          <span>${companySubtitle(company)}</span>
        </div>
        <span class="dashboard-status-pill ${pill}">${status}</span>
      </article>
    `;
  }).join("");
}

function renderCompaniesFeed() {
  if (!companyRecords.length) {
    companiesFeed.innerHTML = `
      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>No portfolio activity</strong>
        <span>Company activity will appear once records are available.</span>
      </article>
    `;
    return;
  }

  companiesFeed.innerHTML = companyRecords.slice(0, 6).map((company) => `
    <article class="dashboard-feed-item glass-card aurora-card">
      <strong>${companyTitle(company)}</strong>
      <span>Status: ${niceStatus(company.status || company.health || "active")} • ${companySubtitle(company)}</span>
    </article>
  `).join("");
}

function applySearchAndSort() {
  const query = normalize(companiesSearch?.value || "");

  filteredCompanies = companyRecords.filter((company) => {
    const haystack = [
      company.name,
      company.title,
      company.companyName,
      company.description,
      company.location,
      company.category,
      company.status,
      company.health
    ].map((value) => normalize(value)).join(" ");

    return haystack.includes(query);
  });

  filteredCompanies.sort((a, b) => {
    const first = companyTitle(a).toLowerCase();
    const second = companyTitle(b).toLowerCase();
    return sortAscending ? first.localeCompare(second) : second.localeCompare(first);
  });

  renderStats();
  renderCompaniesList();
}

async function loadCompanies() {
  companiesHeroTitle.textContent = "Loading companies...";
  companiesHeroText.textContent = "Connecting to Firestore company records.";

  try {
    const snap = await getDocs(collection(db, "companies"));
    companyRecords = snap.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data()
    }));

    filteredCompanies = [...companyRecords];
    applySearchAndSort();
    renderCompaniesFeed();

    companiesHeroTitle.textContent = "Portfolio connected";
    companiesHeroText.textContent = `${companyRecords.length} companies loaded from Firestore.`;
  } catch (error) {
    console.error("Failed loading companies:", error);

    companiesHeroTitle.textContent = "Load failed";
    companiesHeroText.textContent = "Check Firestore rules and the companies collection.";

    companiesList.innerHTML = `
      <article class="dashboard-list-item glass-card aurora-card">
        <div>
          <strong>Unable to load companies</strong>
          <span>${error.message || "Unknown Firestore error."}</span>
        </div>
        <span class="dashboard-status-pill alert">Error</span>
      </article>
    `;

    companiesFeed.innerHTML = `
      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>Portfolio feed unavailable</strong>
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

if (companiesSearch) {
  companiesSearch.addEventListener("input", applySearchAndSort);
}

if (companiesSortBtn) {
  companiesSortBtn.addEventListener("click", () => {
    sortAscending = !sortAscending;
    companiesSortBtn.textContent = sortAscending ? "Sort A–Z" : "Sort Z–A";
    applySearchAndSort();
  });
}

if (companiesRefreshBtnTop) {
  companiesRefreshBtnTop.addEventListener("click", async () => {
    await loadCompanies();
  });
}

if (companiesRefreshBtnSide) {
  companiesRefreshBtnSide.addEventListener("click", async () => {
    await loadCompanies();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindSidebarAnchors();

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "/evaraos/login.html";
      return;
    }

    await loadCompanies();
  });
});