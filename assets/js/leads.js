import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const leadsSearch = document.getElementById("leadsSearch");
const leadsList = document.getElementById("leadsList");
const leadsFeed = document.getElementById("leadsFeed");
const leadFlowStack = document.getElementById("leadFlowStack");

const leadsHeroTitle = document.getElementById("leadsHeroTitle");
const leadsHeroText = document.getElementById("leadsHeroText");

const leadsStatTotal = document.getElementById("leadsStatTotal");
const leadsStatOpen = document.getElementById("leadsStatOpen");
const leadsStatHot = document.getElementById("leadsStatHot");
const leadsStatFiltered = document.getElementById("leadsStatFiltered");

const leadsRefreshBtnTop = document.getElementById("leadsRefreshBtnTop");
const leadsRefreshBtnSide = document.getElementById("leadsRefreshBtnSide");
const leadsSortBtn = document.getElementById("leadsSortBtn");

let leadsData = [];
let sortAsc = true;

function leadName(lead = {}) {
  return (
    lead.name ||
    lead.fullName ||
    lead.company ||
    lead.email ||
    "Untitled Lead"
  );
}

function leadStatus(lead = {}) {
  return lead.status || "new";
}

function leadPriority(lead = {}) {
  return (lead.priority || "normal").toString().toLowerCase();
}

function leadDescription(lead = {}) {
  return (
    lead.description ||
    lead.notes ||
    lead.source ||
    "No lead notes provided."
  );
}

function pillClass(status = "") {
  const safe = String(status || "").toLowerCase();
  if (["won", "closed", "active"].includes(safe)) return "success";
  if (["new", "open", "contacted", "qualified"].includes(safe)) return "working";
  if (["lost", "cold", "archived"].includes(safe)) return "muted";
  return "working";
}

function filteredLeads() {
  const term = String(leadsSearch?.value || "").trim().toLowerCase();
  let rows = [...leadsData];

  if (term) {
    rows = rows.filter((lead) => {
      return [
        leadName(lead),
        leadStatus(lead),
        leadPriority(lead),
        leadDescription(lead)
      ].some((value) => String(value || "").toLowerCase().includes(term));
    });
  }

  rows.sort((a, b) => {
    const left = leadName(a).toLowerCase();
    const right = leadName(b).toLowerCase();

    if (left < right) return sortAsc ? -1 : 1;
    if (left > right) return sortAsc ? 1 : -1;
    return 0;
  });

  return rows;
}

function renderStats(rows) {
  const open = rows.filter((row) =>
    ["new", "open", "contacted", "qualified"].includes(String(leadStatus(row)).toLowerCase())
  ).length;

  const hot = rows.filter((row) =>
    ["hot", "high", "urgent"].includes(leadPriority(row))
  ).length;

  if (leadsStatTotal) leadsStatTotal.textContent = String(leadsData.length);
  if (leadsStatOpen) leadsStatOpen.textContent = String(open);
  if (leadsStatHot) leadsStatHot.textContent = String(hot);
  if (leadsStatFiltered) leadsStatFiltered.textContent = String(rows.length);

  if (leadsHeroTitle) {
    leadsHeroTitle.textContent = leadsData.length
      ? `${leadsData.length} leads connected`
      : "No leads found yet.";
  }

  if (leadsHeroText) {
    leadsHeroText.textContent = leadsData.length
      ? "Firestore lead records are live and ready for review."
      : "Create lead records in Firestore to populate this page.";
  }
}

function renderList(rows) {
  if (!leadsList) return;

  if (!rows.length) {
    leadsList.innerHTML = `
      <article class="dashboard-list-item glass-card aurora-card">
        <div>
          <strong>No leads found</strong>
          <span>Try another search or add lead records in Firestore.</span>
        </div>
        <span class="dashboard-status-pill muted">Empty</span>
      </article>
    `;
    return;
  }

  leadsList.innerHTML = rows.map((lead) => {
    const name = leadName(lead);
    const status = leadStatus(lead);
    const description = leadDescription(lead);

    return `
      <article class="dashboard-list-item glass-card aurora-card">
        <div>
          <strong>${name}</strong>
          <span>${description}</span>
        </div>
        <span class="dashboard-status-pill ${pillClass(status)}">${status}</span>
      </article>
    `;
  }).join("");
}

function renderFlow(rows) {
  if (!leadFlowStack) return;

  const buckets = [
    { key: "new", label: "New" },
    { key: "open", label: "Open" },
    { key: "contacted", label: "Contacted" },
    { key: "qualified", label: "Qualified" },
    { key: "won", label: "Won" }
  ];

  const total = rows.length || 1;

  leadFlowStack.innerHTML = buckets.map((bucket) => {
    const count = rows.filter((row) => String(leadStatus(row)).toLowerCase() === bucket.key).length;
    const width = Math.max(6, Math.round((count / total) * 100));

    return `
      <div class="dashboard-progress-row">
        <div class="dashboard-progress-copy">
          <strong>${bucket.label}</strong>
          <span>${count} lead(s)</span>
        </div>
        <div class="dashboard-progress-bar"><span style="width: ${width}%;"></span></div>
      </div>
    `;
  }).join("");
}

function renderFeed(rows) {
  if (!leadsFeed) return;

  if (!rows.length) {
    leadsFeed.innerHTML = `
      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>No lead activity</strong>
        <span>Recent lead activity will appear here once records exist.</span>
      </article>
    `;
    return;
  }

  leadsFeed.innerHTML = rows.slice(0, 6).map((lead) => {
    const name = leadName(lead);
    const status = leadStatus(lead);
    const priority = leadPriority(lead);

    return `
      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>${name}</strong>
        <span>Status: ${status} • Priority: ${priority}</span>
      </article>
    `;
  }).join("");
}

function renderLeads() {
  const rows = filteredLeads();
  renderStats(rows);
  renderList(rows);
  renderFlow(rows);
  renderFeed(rows);
}

async function loadLeads() {
  try {
    const snap = await getDocs(collection(db, "leads"));
    leadsData = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    renderLeads();
  } catch (error) {
    console.error("Failed to load leads:", error);

    if (leadsList) {
      leadsList.innerHTML = `
        <article class="dashboard-list-item glass-card aurora-card">
          <div>
            <strong>Unable to load leads</strong>
            <span>${error.message || "Firestore request failed."}</span>
          </div>
          <span class="dashboard-status-pill danger">Error</span>
        </article>
      `;
    }

    if (leadsFeed) {
      leadsFeed.innerHTML = `
        <article class="dashboard-feed-item glass-card aurora-card">
          <strong>Load failed</strong>
          <span>${error.message || "Firestore request failed."}</span>
        </article>
      `;
    }
  }
}

function bindEvents() {
  leadsSearch?.addEventListener("input", renderLeads);

  leadsRefreshBtnTop?.addEventListener("click", loadLeads);
  leadsRefreshBtnSide?.addEventListener("click", loadLeads);

  leadsSortBtn?.addEventListener("click", () => {
    sortAsc = !sortAsc;
    leadsSortBtn.textContent = sortAsc ? "Sort A–Z" : "Sort Z–A";
    renderLeads();
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

  loadLeads();
});

document.addEventListener("DOMContentLoaded", bindEvents);