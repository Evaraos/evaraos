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

const jobsRefreshBtnTop = document.getElementById("jobsRefreshBtnTop");
const jobsRefreshBtnSide = document.getElementById("jobsRefreshBtnSide");
const jobsSortBtn = document.getElementById("jobsSortBtn");

let jobsData = [];
let sortAsc = true;
let isLoadingJobs = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function jobName(job = {}) {
  return (
    job.title ||
    job.name ||
    job.jobName ||
    job.customerName ||
    "Untitled Job"
  );
}

function jobStatus(job = {}) {
  return job.status || "scheduled";
}

function jobDescription(job = {}) {
  return (
    job.description ||
    job.notes ||
    job.service ||
    "No job summary provided."
  );
}

function pillClass(status = "") {
  const safe = String(status || "").toLowerCase();
  if (["completed", "done", "closed"].includes(safe)) return "success";
  if (["scheduled", "in progress", "active", "working"].includes(safe)) return "working";
  if (["cancelled", "archived", "paused"].includes(safe)) return "empty";
  return "warning";
}

function setButtonLoading(isLoading) {
  [jobsRefreshBtnTop, jobsRefreshBtnSide].forEach((btn) => {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.textContent = isLoading ? "Refreshing..." : "Refresh Data";
  });
}

function filteredJobs() {
  const term = String(jobsSearch?.value || "").trim().toLowerCase();
  let rows = [...jobsData];

  if (term) {
    rows = rows.filter((job) => {
      return [
        jobName(job),
        jobStatus(job),
        jobDescription(job)
      ].some((value) => String(value || "").toLowerCase().includes(term));
    });
  }

  rows.sort((a, b) => {
    const left = jobName(a).toLowerCase();
    const right = jobName(b).toLowerCase();

    if (left < right) return sortAsc ? -1 : 1;
    if (left > right) return sortAsc ? 1 : -1;
    return 0;
  });

  return rows;
}

function renderStats(rows) {
  const active = rows.filter((row) =>
    ["scheduled", "in progress", "active", "working"].includes(String(jobStatus(row)).toLowerCase())
  ).length;

  const completed = rows.filter((row) =>
    ["completed", "done", "closed"].includes(String(jobStatus(row)).toLowerCase())
  ).length;

  if (jobsStatTotal) jobsStatTotal.textContent = String(jobsData.length);
  if (jobsStatActive) jobsStatActive.textContent = String(active);
  if (jobsStatCompleted) jobsStatCompleted.textContent = String(completed);
  if (jobsStatFiltered) jobsStatFiltered.textContent = String(rows.length);

  if (jobsHeroTitle) {
    jobsHeroTitle.textContent = jobsData.length
      ? `${jobsData.length} jobs connected`
      : "No jobs found yet.";
  }

  if (jobsHeroText) {
    jobsHeroText.textContent = jobsData.length
      ? "Firestore job records are live and ready for review."
      : "Create job records in Firestore to populate this page.";
  }
}

function renderLoadingState() {
  if (jobsList) {
    jobsList.innerHTML = `
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

  if (jobsProgressStack) {
    jobsProgressStack.innerHTML = `
      <article class="dashboard-state-card loading">
        <strong>Loading execution breakdown...</strong>
        <span>Preparing job status buckets and counts.</span>
      </article>
    `;
  }

  if (jobsFeed) {
    jobsFeed.innerHTML = `
      <article class="dashboard-state-card loading">
        <strong>Loading jobs...</strong>
        <span>Pulling Firestore job records and preparing the feed.</span>
      </article>
    `;
  }

  if (jobsHeroTitle) jobsHeroTitle.textContent = "Loading jobs...";
  if (jobsHeroText) jobsHeroText.textContent = "Connecting to Firestore job records.";
}

function renderList(rows) {
  if (!jobsList) return;

  if (!rows.length) {
    jobsList.innerHTML = `
      <article class="dashboard-state-card empty">
        <strong>No jobs found</strong>
        <span>Try another search or add job records in Firestore.</span>
      </article>
    `;
    return;
  }

  jobsList.innerHTML = rows.map((job) => {
    const name = escapeHtml(jobName(job));
    const status = escapeHtml(jobStatus(job));
    const description = escapeHtml(jobDescription(job));

    return `
      <article class="dashboard-list-item glass-card aurora-card active-glow beam-target">
        <div>
          <strong>${name}</strong>
          <span>${description}</span>
        </div>
        <span class="dashboard-status-pill ${pillClass(status)}">${status}</span>
      </article>
    `;
  }).join("");
}

function renderProgress(rows) {
  if (!jobsProgressStack) return;

  const buckets = [
    { key: "scheduled", label: "Scheduled" },
    { key: "in progress", label: "In Progress" },
    { key: "active", label: "Active" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" }
  ];

  const total = rows.length || 1;

  jobsProgressStack.innerHTML = buckets.map((bucket) => {
    const count = rows.filter((row) => String(jobStatus(row)).toLowerCase() === bucket.key).length;
    const width = Math.max(6, Math.round((count / total) * 100));

    return `
      <div class="dashboard-progress-row glass-card aurora-card active-glow beam-target">
        <div class="dashboard-progress-copy">
          <strong>${bucket.label}</strong>
          <span>${count} job(s)</span>
        </div>
        <div class="dashboard-progress-bar"><span style="width: ${width}%;"></span></div>
      </div>
    `;
  }).join("");
}

function renderFeed(rows) {
  if (!jobsFeed) return;

  if (!rows.length) {
    jobsFeed.innerHTML = `
      <article class="dashboard-state-card empty">
        <strong>No job activity</strong>
        <span>Recent execution activity will appear here once records exist.</span>
      </article>
    `;
    return;
  }

  jobsFeed.innerHTML = rows.slice(0, 6).map((job) => {
    const name = escapeHtml(jobName(job));
    const status = escapeHtml(jobStatus(job));

    return `
      <article class="dashboard-feed-item glass-card aurora-card active-glow beam-target">
        <strong>${name}</strong>
        <span>Status: ${status}</span>
      </article>
    `;
  }).join("");
}

function renderJobs() {
  const rows = filteredJobs();
  renderStats(rows);
  renderList(rows);
  renderProgress(rows);
  renderFeed(rows);
}

async function loadJobs() {
  if (isLoadingJobs) return;

  isLoadingJobs = true;
  setButtonLoading(true);
  renderLoadingState();

  try {
    const snap = await getDocs(collection(db, "jobs"));
    jobsData = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    renderJobs();
  } catch (error) {
    console.error("Failed to load jobs:", error);

    if (jobsList) {
      jobsList.innerHTML = `
        <article class="dashboard-state-card error">
          <strong>Unable to load jobs</strong>
          <span>${escapeHtml(error.message || "Firestore request failed.")}</span>
        </article>
      `;
    }

    if (jobsProgressStack) {
      jobsProgressStack.innerHTML = `
        <article class="dashboard-state-card error">
          <strong>Execution load failed</strong>
          <span>${escapeHtml(error.message || "Firestore request failed.")}</span>
        </article>
      `;
    }

    if (jobsFeed) {
      jobsFeed.innerHTML = `
        <article class="dashboard-state-card error">
          <strong>Load failed</strong>
          <span>${escapeHtml(error.message || "Firestore request failed.")}</span>
        </article>
      `;
    }
  } finally {
    isLoadingJobs = false;
    setButtonLoading(false);
  }
}

function bindEvents() {
  jobsSearch?.addEventListener("input", renderJobs);

  jobsRefreshBtnTop?.addEventListener("click", loadJobs);
  jobsRefreshBtnSide?.addEventListener("click", loadJobs);

  jobsSortBtn?.addEventListener("click", () => {
    sortAsc = !sortAsc;
    jobsSortBtn.textContent = sortAsc ? "Sort A–Z" : "Sort Z–A";
    renderJobs();
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
    window.location.replace("/evaraos/login.html");
    return;
  }

  loadJobs();
});

document.addEventListener("DOMContentLoaded", bindEvents);