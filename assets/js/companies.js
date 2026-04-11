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
  return c.description || c.location || "Company record";
}

function statusClass(status = "") {
  const v = normalize(status);
  if (["active", "healthy", "approved"].includes(v)) return "good";
  if (["review", "pending"].includes(v)) return "alert";
  return "working";
}

function renderStats() {
  const healthy = records.filter(r => ["active", "healthy"].includes(normalize(r.status))).length;
  const review = records.filter(r => ["review", "pending"].includes(normalize(r.status))).length;

  statTotal.textContent = records.length;
  statHealthy.textContent = healthy;
  statReview.textContent = review;
  statFiltered.textContent = filtered.length;
}

function renderList() {
  if (!filtered.length) {
    companiesList.innerHTML = `<p>No companies found</p>`;
    return;
  }

  companiesList.innerHTML = filtered.map(c => `
    <article class="dashboard-list-item glass-card aurora-card">
      <div>
        <strong>${title(c)}</strong>
        <span>${subtitle(c)}</span>
      </div>
      <span class="dashboard-status-pill ${statusClass(c.status)}">
        ${c.status || "active"}
      </span>
    </article>
  `).join("");
}

function renderFeed() {
  companiesFeed.innerHTML = records.slice(0, 5).map(c => `
    <article class="dashboard-feed-item glass-card aurora-card">
      <strong>${title(c)}</strong>
      <span>${subtitle(c)}</span>
    </article>
  `).join("");
}

function applySearch() {
  const q = normalize(companiesSearch.value);

  filtered = records.filter(c =>
    (title(c) + subtitle(c) + c.status).toLowerCase().includes(q)
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
  const snap = await getDocs(collection(db, "companies"));

  records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  filtered = [...records];

  applySearch();
  renderFeed();

  companiesHeroTitle.textContent = "Companies loaded";
  companiesHeroText.textContent = `${records.length} records`;
}

companiesSearch?.addEventListener("input", applySearch);

sortBtn?.addEventListener("click", () => {
  sortAsc = !sortAsc;
  applySearch();
});

refreshTop?.addEventListener("click", load);
refreshSide?.addEventListener("click", load);

onAuthStateChanged(auth, user => {
  if (!user) window.location.href = "/evaraos/login.html";
  else load();
});