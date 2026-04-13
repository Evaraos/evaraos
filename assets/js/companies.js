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

const statTotal = document.getElementById("companiesStatTotal");
const statHealthy = document.getElementById("companiesStatHealthy");
const statReview = document.getElementById("companiesStatReview");
const statFiltered = document.getElementById("companiesStatFiltered");

const statTotalMeta = document.getElementById("companiesStatTotalMeta");
const statHealthyMeta = document.getElementById("companiesStatHealthyMeta");
const statReviewMeta = document.getElementById("companiesStatReviewMeta");
const statFilteredMeta = document.getElementById("companiesStatFilteredMeta");

const refreshTop = document.getElementById("companiesRefreshBtnTop");
const refreshSide = document.getElementById("companiesRefreshBtnSide");
const sortBtn = document.getElementById("companiesSortBtn");

let records = [];
let filtered = [];
let sortAsc = true;

function normalize(v = "") {
  return String(v || "").toLowerCase().trim();
}

function title(c) {
  return c.name || c.companyName || "Untitled Company";
}

function subtitle(c) {
  return c.description || c.location || c.category || "Company record from Firestore";
}

function prettyStatus(status = "") {
  const value = String(status || "").trim();
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Active";
}

function statusClass(status = "") {
  const v = normalize(status);
  if (["active", "healthy", "approved"].includes(v)) return "good";
  if (["review", "pending"].includes(v)) return "alert";
  return "working";
}

function renderStats() {
  const healthy = records.filter((r) =>
    ["active", "healthy", "approved"].includes(normalize(r.status || r.health || "active"))
  ).length;

  const review = records.filter((r) =>
    ["review", "pending"].includes(normalize(r.status || r.health || ""))
  ).length;

  statTotal.textContent = String(records.length);
  statHealthy.textContent = String(healthy);
  statReview.textContent = String(review);
  statFiltered.textContent = String(filtered.length);

  if (statTotalMeta) statTotalMeta.textContent = "Company records loaded";
  if (statHealthyMeta) statHealthyMeta.textContent = "Healthy or active companies";
  if (statReviewMeta) statReviewMeta.textContent = "Records needing review";
  if (statFilteredMeta) statFilteredMeta.textContent = "Matches current search";
}

function renderList() {
  if (!filtered.length) {
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

  companiesList.innerHTML = filtered.map((c) => `
    <article class="dashboard-list-item glass-card aurora-card">
      <div>
        <strong>${title(c)}</strong>
        <span>${subtitle(c)}</span>
      </div>
      <span class="dashboard-status-pill ${statusClass(c.status || c.health)}">
        ${prettyStatus(c.status || c.health || "active")}
      </span>
    </article>
  `).join("");
}

function renderFeed() {
  if (!records.length) {
    companiesFeed.innerHTML = `
      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>No portfolio activity</strong>
        <span>Company activity will appear once records are available.</span>
      </article>
    `;
    return;
  }

  companiesFeed.innerHTML = records.slice(0, 5).map((c) => `
    <article class="dashboard-feed-item glass-card aurora-card">
      <strong>${title(c)}</strong>
      <span>Status: ${prettyStatus(c.status || c.health || "active")} • ${subtitle(c)}</span>
    </article>
  `).join("");
}

function applySearch() {
  const q = normalize(companiesSearch?.value || "");

  filtered = records.filter((c) =>
    [title(c), subtitle(c), c.status, c.health, c.category]
      .map((value) => normalize(value))
      .join(" ")
      .includes(q)
  );

  filtered.sort((a, b) =>
    sortAsc
      ? title(a).localeCompare(title(b))
      : title(b).localeCompare(title(a))
  );

  renderStats();
  renderList();
}

async function load() {
  companiesHeroTitle.textContent = "Loading companies...";
  companiesHeroText.textContent = "Connecting to Firestore company records.";

  try {
    const snap = await getDocs(collection(db, "companies"));

    records = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    filtered = [...records];

    applySearch();
    renderFeed();

    companiesHeroTitle.textContent = "Portfolio connected";
    companiesHeroText.textContent = `${records.length} companies loaded from Firestore.`;
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

companiesSearch?.addEventListener("input", applySearch);

sortBtn?.addEventListener("click", () => {
  sortAsc = !sortAsc;
  sortBtn.textContent = sortAsc ? "Sort A–Z" : "Sort Z–A";
  applySearch();
});

refreshTop?.addEventListener("click", load);
refreshSide?.addEventListener("click", load);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/evaraos/login.html";
    return;
  }

  await load();
});