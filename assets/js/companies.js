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
let isLoadingCompanies = false;
let hasBoundEvents = false;
let hasStartedAuthWatch = false;

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
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
  if (["inactive", "paused", "archived"].includes(value)) return "empty";
  return "warning";
}

function setButtonLoading(isLoading) {
  [companiesRefreshBtnTop, companiesRefreshBtnSide].forEach((btn) => {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.textContent = isLoading ? "Refreshing..." : "Refresh";
  });
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

function renderLoadingState() {
  if (companiesList) {
    companiesList.innerHTML = `
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

  if (companiesFeed) {
    companiesFeed.innerHTML = `
      <article class="dashboard-state-card loading">
        <strong>Loading portfolio...</strong>
        <span>Pulling Firestore company records and preparing the portfolio feed.</span>
      </article>
    `;
  }

  if (companiesHeroTitle) companiesHeroTitle.textContent = "Loading companies...";
  if (companiesHeroText) companiesHeroText.textContent = "Connecting to Firestore company records.";
}

function renderList(rows) {
  if (!companiesList) return;

  if (!rows.length) {
    companiesList.innerHTML = `
      <article class="dashboard-state-card empty">
        <strong>No companies found</strong>
        <span>Try another search or add company records in Firestore.</span>
      </article>
    `;
    return;
  }

  companiesList.innerHTML = rows.map((company) => {
    const name = escapeHtml(companyName(company));
    const status = escapeHtml(companyStatus(company));
    const description = escapeHtml(companyDescription(company));

    return `
      <article class="dashboard-list-item glass-card aurora-card active-glow beam-target">
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
      <article class="dashboard-state-card empty">
        <strong>No portfolio activity</strong>
        <span>Company activity will appear here once records exist.</span>
      </article>
    `;
    return;
  }

  companiesFeed.innerHTML = rows.slice(0, 6).map((company) => {
    const name = escapeHtml(companyName(company));
    const status = escapeHtml(companyStatus(company));

    return `
      <article class="dashboard-feed-item glass-card aurora-card active-glow beam-target">
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
  if (isLoadingCompanies) return;

  isLoadingCompanies = true;
  setButtonLoading(true);
  renderLoadingState();

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
        <article class="dashboard-state-card error">
          <strong>Unable to load companies</strong>
          <span>${escapeHtml(error.message || "Firestore request failed.")}</span>
        </article>
      `;
    }

    if (companiesFeed) {
      companiesFeed.innerHTML = `
        <article class="dashboard-state-card error">
          <strong>Load failed</strong>
          <span>${escapeHtml(error.message || "Firestore request failed.")}</span>
        </article>
      `;
    }
  } finally {
    isLoadingCompanies = false;
    setButtonLoading(false);
  }
}

function bindEvents() {
  if (hasBoundEvents) return;
  hasBoundEvents = true;

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

function initCompaniesPage() {
  if (hasStartedAuthWatch) return;
  hasStartedAuthWatch = true;

  bindEvents();

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      navigateWithLoader("/evaraos/login.html", {
        title: "Returning to login",
        subtitle: "Your session is not active."
      });
      return;
    }

    loadCompanies();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCompaniesPage);
} else {
  initCompaniesPage();
}