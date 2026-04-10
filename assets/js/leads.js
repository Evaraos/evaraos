// assets/js/leads.js

import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const leadsSearch = document.getElementById("leadsSearch");
const leadsList = document.getElementById("leadsList");
const leadFlowStack = document.getElementById("leadFlowStack");
const leadsFeed = document.getElementById("leadsFeed");

const leadsHeroTitle = document.getElementById("leadsHeroTitle");
const leadsHeroText = document.getElementById("leadsHeroText");

const leadsStatTotal = document.getElementById("leadsStatTotal");
const leadsStatOpen = document.getElementById("leadsStatOpen");
const leadsStatHot = document.getElementById("leadsStatHot");
const leadsStatFiltered = document.getElementById("leadsStatFiltered");

const leadsStatTotalMeta = document.getElementById("leadsStatTotalMeta");
const leadsStatOpenMeta = document.getElementById("leadsStatOpenMeta");
const leadsStatHotMeta = document.getElementById("leadsStatHotMeta");
const leadsStatFilteredMeta = document.getElementById("leadsStatFilteredMeta");

const leadsRefreshBtnTop = document.getElementById("leadsRefreshBtnTop");
const leadsRefreshBtnSide = document.getElementById("leadsRefreshBtnSide");
const leadsSortBtn = document.getElementById("leadsSortBtn");

let leadRecords = [];
let filteredLeads = [];
let sortAscending = true;

function normalize(value = "") {
  return String(value || "").trim().toLowerCase();
}

function leadTitle(lead) {
  return lead.name || lead.title || lead.customerName || lead.email || "Untitled Lead";
}

function leadSubtitle(lead) {
  return lead.description || lead.address || lead.location || lead.phone || "Lead record from Firestore";
}

function niceStatus(status = "") {
  const value = String(status || "").trim();
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "New";
}

function statusClass(status = "") {
  const value = normalize(status);

  if (["won", "closed", "complete", "completed"].includes(value)) return "good";
  if (["quoted", "pending", "new", "hot"].includes(value)) return "alert";
  return "working";
}

function renderStats() {
  const openCount = leadRecords.filter((lead) =>
    !["won", "closed", "complete", "completed"].includes(normalize(lead.status))
  ).length;

  const hotCount = leadRecords.filter((lead) =>
    ["hot", "high", "priority"].includes(normalize(lead.priority || lead.status))
  ).length;

  leadsStatTotal.textContent = String(leadRecords.length);
  leadsStatOpen.textContent = String(openCount);
  leadsStatHot.textContent = String(hotCount);
  leadsStatFiltered.textContent = String(filteredLeads.length);

  leadsStatTotalMeta.textContent = "Lead records loaded";
  leadsStatOpenMeta.textContent = "Open pipeline opportunities";
  leadsStatHotMeta.textContent = "High-priority opportunities";
  leadsStatFilteredMeta.textContent = "Matches current search";
}

function renderLeadList() {
  if (!filteredLeads.length) {
    leadsList.innerHTML = `
      <article class="dashboard-list-item glass-card aurora-card">
        <div>
          <strong>No leads found</strong>
          <span>Try a different search or add lead records to Firestore.</span>
        </div>
        <span class="dashboard-status-pill alert">Empty</span>
      </article>
    `;
    return;
  }

  leadsList.innerHTML = filteredLeads.map((lead) => {
    const status = niceStatus(lead.status || "new");
    const pill = statusClass(lead.status || lead.priority || "new");

    return `
      <article class="dashboard-list-item glass-card aurora-card">
        <div>
          <strong>${leadTitle(lead)}</strong>
          <span>${leadSubtitle(lead)}</span>
        </div>
        <span class="dashboard-status-pill ${pill}">${status}</span>
      </article>
    `;
  }).join("");
}

function renderLeadFlow() {
  const total = leadRecords.length || 1;

  const statuses = {
    new: 0,
    contacted: 0,
    quoted: 0,
    won: 0
  };

  leadRecords.forEach((lead) => {
    const status = normalize(lead.status || "new");
    if (statuses[status] !== undefined) {
      statuses[status] += 1;
    }
  });

  const rows = [
    ["New Leads", statuses.new],
    ["Contacted", statuses.contacted],
    ["Quoted", statuses.quoted],
    ["Closed Won", statuses.won]
  ];

  leadFlowStack.innerHTML = rows.map(([label, count]) => {
    const width = Math.max(8, Math.round((count / total) * 100));
    return `
      <div class="dashboard-progress-row">
        <div class="dashboard-progress-copy">
          <strong>${label}</strong>
          <span>${count} record${count === 1 ? "" : "s"}</span>
        </div>
        <div class="dashboard-progress-bar">
          <span style="width: ${width}%;"></span>
        </div>
      </div>
    `;
  }).join("");
}

function renderLeadFeed() {
  if (!leadRecords.length) {
    leadsFeed.innerHTML = `
      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>No lead activity</strong>
        <span>Lead feed will appear once records are available.</span>
      </article>
    `;
    return;
  }

  leadsFeed.innerHTML = leadRecords.slice(0, 6).map((lead) => `
    <article class="dashboard-feed-item glass-card aurora-card">
      <strong>${leadTitle(lead)}</strong>
      <span>Status: ${niceStatus(lead.status || "new")} • ${leadSubtitle(lead)}</span>
    </article>
  `).join("");
}

function applySearchAndSort() {
  const query = normalize(leadsSearch?.value || "");

  filteredLeads = leadRecords.filter((lead) => {
    const haystack = [
      lead.name,
      lead.title,
      lead.customerName,
      lead.email,
      lead.phone,
      lead.address,
      lead.location,
      lead.description,
      lead.status,
      lead.priority
    ].map((value) => normalize(value)).join(" ");

    return haystack.includes(query);
  });

  filteredLeads.sort((a, b) => {
    const first = leadTitle(a).toLowerCase();
    const second = leadTitle(b).toLowerCase();
    return sortAscending ? first.localeCompare(second) : second.localeCompare(first);
  });

  renderStats();
  renderLeadList();
}

async function loadLeads() {
  leadsHeroTitle.textContent = "Loading leads...";
  leadsHeroText.textContent = "Connecting to Firestore lead records.";

  try {
    const snap = await getDocs(collection(db, "leads"));
    leadRecords = snap.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data()
    }));

    filteredLeads = [...leadRecords];
    applySearchAndSort();
    renderLeadFlow();
    renderLeadFeed();

    leadsHeroTitle.textContent = "Pipeline connected";
    leadsHeroText.textContent = `${leadRecords.length} leads loaded from Firestore.`;
  } catch (error) {
    console.error("Failed loading leads:", error);

    leadsHeroTitle.textContent = "Load failed";
    leadsHeroText.textContent = "Check Firestore rules and the leads collection.";

    leadsList.innerHTML = `
      <article class="dashboard-list-item glass-card aurora-card">
        <div>
          <strong>Unable to load leads</strong>
          <span>${error.message || "Unknown Firestore error."}</span>
        </div>
        <span class="dashboard-status-pill alert">Error</span>
      </article>
    `;

    leadFlowStack.innerHTML = `
      <div class="dashboard-progress-row">
        <div class="dashboard-progress-copy">
          <strong>Load error</strong>
          <span>Leads could not be read</span>
        </div>
        <div class="dashboard-progress-bar"><span style="width: 8%;"></span></div>
      </div>
    `;

    leadsFeed.innerHTML = `
      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>Lead feed unavailable</strong>
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

if (leadsSearch) {
  leadsSearch.addEventListener("input", applySearchAndSort);
}

if (leadsSortBtn) {
  leadsSortBtn.addEventListener("click", () => {
    sortAscending = !sortAscending;
    leadsSortBtn.textContent = sortAscending ? "Sort A–Z" : "Sort Z–A";
    applySearchAndSort();
  });
}

if (leadsRefreshBtnTop) {
  leadsRefreshBtnTop.addEventListener("click", async () => {
    await loadLeads();
  });
}

if (leadsRefreshBtnSide) {
  leadsRefreshBtnSide.addEventListener("click", async () => {
    await loadLeads();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindSidebarAnchors();

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "/evaraos/login.html";
      return;
    }

    await loadLeads();
  });
});