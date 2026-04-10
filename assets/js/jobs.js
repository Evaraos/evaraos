// assets/js/jobs.js

import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const jobsSearch = document.getElementById("jobsSearch");
const jobsList = document.getElementById("jobsList");
const jobsFeed = document.getElementById("jobsFeed");
const jobsProgressStack = document.getElementById("jobsProgressStack");

const jobsHeroTitle = document.getElementById("jobsHeroTitle");
const jobsHeroText = document.getElementById("jobsHeroText");

const jobsStatTotal = document.getElementById("jobsStatTotal");
const jobsStatActive = document.getElementById("jobsStatActive");
const jobsStatCompleted = document.getElementById("jobsStatCompleted");
const jobsStatFiltered = document.getElementById("jobsStatFiltered");

const jobsStatTotalMeta = document.getElementById("jobsStatTotalMeta");
const jobsStatActiveMeta = document.getElementById("jobsStatActiveMeta");
const jobsStatCompletedMeta = document.getElementById("jobsStatCompletedMeta");
const jobsStatFilteredMeta = document.getElementById("jobsStatFilteredMeta");

const jobsRefreshBtnTop = document.getElementById("jobsRefreshBtnTop");
const jobsRefreshBtnSide = document.getElementById("jobsRefreshBtnSide");
const jobsSortBtn = document.getElementById("jobsSortBtn");

let jobRecords = [];
let filteredJobs = [];
let sortAscending = true;

function normalize(value = "") {
  return String(value || "").trim().toLowerCase();
}

function jobTitle(job) {
  return job.name || job.title || job.jobName || job.customerName || "Untitled Job";
}

function jobSubtitle(job) {
  return job.description || job.address || job.location || job.serviceType || "Job record from Firestore";
}

function niceStatus(status = "") {
  const value = String(status || "").trim();
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Pending";
}

function statusClass(status = "") {
  const value = normalize(status);

  if (["complete", "completed", "done", "closed"].includes(value)) return "good";
  if (["pending", "review", "queued"].includes(value)) return "alert";
  return "working";
}

function renderStats() {
  const activeCount = jobRecords.filter((job) =>
    ["in progress", "active", "working", "pending"].includes(normalize(job.status || ""))
  ).length;

  const completedCount = jobRecords.filter((job) =>
    ["complete", "completed", "done", "closed"].includes(normalize(job.status || ""))
  ).length;

  jobsStatTotal.textContent = String(jobRecords.length);
  jobsStatActive.textContent = String(activeCount);
  jobsStatCompleted.textContent = String(completedCount);
  jobsStatFiltered.textContent = String(filteredJobs.length);

  jobsStatTotalMeta.textContent = "Job records loaded";
  jobsStatActiveMeta.textContent = "Currently active or pending jobs";
  jobsStatCompletedMeta.textContent = "Completed execution records";
  jobsStatFilteredMeta.textContent = "Matches current search";
}

function renderJobList() {
  if (!filteredJobs.length) {
    jobsList.innerHTML = `
      <article class="dashboard-list-item glass-card aurora-card">
        <div>
          <strong>No jobs found</strong>
          <span>Try a different search or add job records to Firestore.</span>
        </div>
        <span class="dashboard-status-pill alert">Empty</span>
      </article>
    `;
    return;
  }

  jobsList.innerHTML = filteredJobs.map((job) => {
    const status = niceStatus(job.status || "pending");
    const pill = statusClass(job.status || "pending");

    return `
      <article class="dashboard-list-item glass-card aurora-card">
        <div>
          <strong>${jobTitle(job)}</strong>
          <span>${jobSubtitle(job)}</span>
        </div>
        <span class="dashboard-status-pill ${pill}">${status}</span>
      </article>
    `;
  }).join("");
}

function renderJobFeed() {
  if (!jobRecords.length) {
    jobsFeed.innerHTML = `
      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>No execution activity</strong>
        <span>Job feed will appear once records are available.</span>
      </article>
    `;
    return;
  }

  jobsFeed.innerHTML = jobRecords.slice(0, 6).map((job) => `
    <article class="dashboard-feed-item glass-card aurora-card">
      <strong>${jobTitle(job)}</strong>
      <span>Status: ${niceStatus(job.status || "pending")} • ${jobSubtitle(job)}</span>
    </article>
  `).join("");
}

function renderJobBreakdown() {
  const total = jobRecords.length || 1;

  const statuses = {
    pending: 0,
    inProgress: 0,
    complete: 0,
    review: 0
  };

  jobRecords.forEach((job) => {
    const value = normalize(job.status || "pending");

    if (["pending", "queued"].includes(value)) statuses.pending += 1;
    else if (["in progress", "active", "working"].includes(value)) statuses.inProgress += 1;
    else if (["complete", "completed", "done", "closed"].includes(value)) statuses.complete += 1;
    else statuses.review += 1;
  });

  const rows = [
    ["Pending", statuses.pending],
    ["In Progress", statuses.inProgress],
    ["Completed", statuses.complete],
    ["Review / Other", statuses.review]
  ];

  jobsProgressStack.innerHTML = rows.map(([label, count]) => {
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

function applySearchAndSort() {
  const query = normalize(jobsSearch?.value || "");

  filteredJobs = jobRecords.filter((job) => {
    const haystack = [
      job.name,
      job.title,
      job.jobName,
      job.customerName,
      job.address,
      job.location,
      job.serviceType,
      job.description,
      job.status
    ].map((value) => normalize(value)).join(" ");

    return haystack.includes(query);
  });

  filteredJobs.sort((a, b) => {
    const first = jobTitle(a).toLowerCase();
    const second = jobTitle(b).toLowerCase();
    return sortAscending ? first.localeCompare(second) : second.localeCompare(first);
  });

  renderStats();
  renderJobList();
}

async function loadJobs() {
  jobsHeroTitle.textContent = "Loading jobs...";
  jobsHeroText.textContent = "Connecting to Firestore job records.";

  try {
    const snap = await getDocs(collection(db, "jobs"));
    jobRecords = snap.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data()
    }));

    filteredJobs = [...jobRecords];
    applySearchAndSort();
    renderJobFeed();
    renderJobBreakdown();

    jobsHeroTitle.textContent = "Execution connected";
    jobsHeroText.textContent = `${jobRecords.length} jobs loaded from Firestore.`;
  } catch (error) {
    console.error("Failed loading jobs:", error);

    jobsHeroTitle.textContent = "Load failed";
    jobsHeroText.textContent = "Check Firestore rules and the jobs collection.";

    jobsList.innerHTML = `
      <article class="dashboard-list-item glass-card aurora-card">
        <div>
          <strong>Unable to load jobs</strong>
          <span>${error.message || "Unknown Firestore error."}</span>
        </div>
        <span class="dashboard-status-pill alert">Error</span>
      </article>
    `;

    jobsFeed.innerHTML = `
      <article class="dashboard-feed-item glass-card aurora-card">
        <strong>Job feed unavailable</strong>
        <span>${error.message || "Unknown Firestore error."}</span>
      </article>
    `;

    jobsProgressStack.innerHTML = `
      <div class="dashboard-progress-row">
        <div class="dashboard-progress-copy">
          <strong>Load error</strong>
          <span>Jobs could not be read</span>
        </div>
        <div class="dashboard-progress-bar"><span style="width: 8%;"></span></div>
      </div>
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

if (jobsSearch) {
  jobsSearch.addEventListener("input", applySearchAndSort);
}

if (jobsSortBtn) {
  jobsSortBtn.addEventListener("click", () => {
    sortAscending = !sortAscending;
    jobsSortBtn.textContent = sortAscending ? "Sort A–Z" : "Sort Z–A";
    applySearchAndSort();
  });
}

if (jobsRefreshBtnTop) {
  jobsRefreshBtnTop.addEventListener("click", async () => {
    await loadJobs();
  });
}

if (jobsRefreshBtnSide) {
  jobsRefreshBtnSide.addEventListener("click", async () => {
    await loadJobs();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindSidebarAnchors();

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "/evaraos/login.html";
      return;
    }

    await loadJobs();
  });
});