import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  getSavedUserProfile
} from "./firebase.js";

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
let hasBoundEvents = false;
let hasStartedAuthWatch = false;
let currentFirebaseUser = null;

function navigateWithLoader(url, options = {}) {
  if (window.EvaraLoader && typeof window.EvaraLoader.beginNavigationLoad === "function") {
    window.EvaraLoader.beginNavigationLoad(options);
  }
  requestAnimationFrame(() => window.location.assign(url));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalize(value = "") {
  return String(value || "").trim().toLowerCase();
}

function jobName(job = {}) {
  return job.title || job.name || job.jobName || job.customerName || "Untitled Job";
}

function jobStatus(job = {}) {
  return job.status || "scheduled";
}

function jobDescription(job = {}) {
  return job.description || job.notes || job.service || job.serviceType || "No job summary provided.";
}

function jobCompany(job = {}) {
  return job.companyName || job.companyId || "No company assigned";
}

function assignedNames(job = {}) {
  if (Array.isArray(job.assignedToNames) && job.assignedToNames.length) return job.assignedToNames;
  if (Array.isArray(job.assignedTeamNames) && job.assignedTeamNames.length) return job.assignedTeamNames;
  if (job.staffClaimedByName) return [job.staffClaimedByName];
  if (job.assignedToName) return [job.assignedToName];
  return [];
}

function pillClass(status = "") {
  const safe = normalize(status);
  if (["completed", "done", "closed"].includes(safe)) return "success";
  if (["open", "available", "claimed", "scheduled", "in_progress", "in progress", "active", "working"].includes(safe)) return "working";
  if (["cancelled", "canceled", "archived", "paused"].includes(safe)) return "empty";
  return "warning";
}

function claimPill(job = {}) {
  if (job.staffClaimed) return { label: "Staff Claimed", cls: "success" };
  if (job.companyClaimed) return { label: "Company Claimed", cls: "working" };
  return { label: "Open Market", cls: "warning" };
}

function actorProfile() {
  const profile = getSavedUserProfile?.() || {};
  return {
    uid: currentFirebaseUser?.uid || profile.uid || "",
    email: currentFirebaseUser?.email || profile.email || "",
    displayName: profile.displayName || profile.fullName || profile.name || currentFirebaseUser?.displayName || currentFirebaseUser?.email || "Unknown User",
    role: normalize(profile.role || "customer"),
    companyId: profile.companyId || "",
    companyName: profile.companyName || ""
  };
}

function isCompanyLevelRole(role = "") {
  return ["owner", "admin", "manager", "operations_coordinator", "sales", "sales_rep"].includes(normalize(role));
}

function isStaffRole(role = "") {
  return ["technician", "tech", "cleaner", "staff", "sales", "sales_rep", "manager", "operations_coordinator", "owner", "admin"].includes(normalize(role));
}

function canClaimCompany(job = {}) {
  const actor = actorProfile();
  if (!actor.uid || !isCompanyLevelRole(actor.role)) return false;
  if (job.companyClaimed) return false;
  return true;
}

function canClaimStaff(job = {}) {
  const actor = actorProfile();
  if (!actor.uid || !isStaffRole(actor.role)) return false;
  if (!job.companyClaimed) return false;
  if (job.staffClaimed) return false;
  if (job.companyId && actor.companyId && String(job.companyId) !== String(actor.companyId)) return false;
  return true;
}

function setButtonLoading(isLoading) {
  [jobsRefreshBtnTop, jobsRefreshBtnSide].forEach((btn) => {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.textContent = isLoading ? "Refreshing..." : "Refresh Data";
  });
}

function filteredJobs() {
  const term = normalize(jobsSearch?.value || "");
  let rows = [...jobsData];

  if (term) {
    rows = rows.filter((job) => {
      return [
        jobName(job),
        jobStatus(job),
        jobDescription(job),
        jobCompany(job),
        job.customerName,
        job.customerEmail,
        job.customerPhone,
        job.serviceType,
        job.address,
        assignedNames(job).join(" ")
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
    ["open", "available", "claimed", "scheduled", "in_progress", "in progress", "active", "working"].includes(normalize(jobStatus(row)))
  ).length;
  const completed = rows.filter((row) => ["completed", "done", "closed"].includes(normalize(jobStatus(row)))).length;

  if (jobsStatTotal) jobsStatTotal.textContent = String(jobsData.length);
  if (jobsStatActive) jobsStatActive.textContent = String(active);
  if (jobsStatCompleted) jobsStatCompleted.textContent = String(completed);
  if (jobsStatFiltered) jobsStatFiltered.textContent = String(rows.length);

  if (jobsHeroTitle) jobsHeroTitle.textContent = jobsData.length ? `${jobsData.length} jobs connected` : "No jobs found yet.";
  if (jobsHeroText) {
    jobsHeroText.textContent = jobsData.length
      ? "Dispatch is live: companies claim platform jobs first, then staff claim execution first-come first-served."
      : "Create or convert leads into jobs to populate the dispatch board.";
  }
}

function renderLoadingState() {
  if (jobsList) {
    jobsList.innerHTML = `
      <div class="dashboard-skeleton-grid">
        <div class="dashboard-skeleton-card"><div class="dashboard-skeleton-line line-1"></div><div class="dashboard-skeleton-line line-2"></div><div class="dashboard-skeleton-line line-3"></div></div>
        <div class="dashboard-skeleton-card"><div class="dashboard-skeleton-line line-1"></div><div class="dashboard-skeleton-line line-2"></div><div class="dashboard-skeleton-line line-3"></div></div>
      </div>
    `;
  }
  if (jobsProgressStack) jobsProgressStack.innerHTML = `<article class="dashboard-state-card loading"><strong>Loading dispatch board...</strong><span>Preparing job claim status and execution buckets.</span></article>`;
  if (jobsFeed) jobsFeed.innerHTML = `<article class="dashboard-state-card loading"><strong>Loading jobs...</strong><span>Pulling Firestore job records and preparing the feed.</span></article>`;
  if (jobsHeroTitle) jobsHeroTitle.textContent = "Loading jobs...";
  if (jobsHeroText) jobsHeroText.textContent = "Connecting to Firestore job records.";
}

function renderList(rows) {
  if (!jobsList) return;

  if (!rows.length) {
    jobsList.innerHTML = `<article class="dashboard-state-card empty"><strong>No jobs found</strong><span>Try another search or convert a lead into a job.</span></article>`;
    return;
  }

  jobsList.innerHTML = rows.map((job) => {
    const id = escapeHtml(job.id);
    const name = escapeHtml(jobName(job));
    const status = escapeHtml(jobStatus(job));
    const description = escapeHtml(jobDescription(job));
    const company = escapeHtml(jobCompany(job));
    const claim = claimPill(job);
    const team = assignedNames(job).length ? escapeHtml(assignedNames(job).join(", ")) : "Unassigned";
    const companyButton = canClaimCompany(job)
      ? `<button type="button" class="btn btn-theme-primary job-company-claim-btn" data-company-claim="${id}">Claim for Company</button>`
      : "";
    const staffButton = canClaimStaff(job)
      ? `<button type="button" class="btn btn-theme-primary job-staff-claim-btn" data-staff-claim="${id}">Accept Job</button>`
      : "";

    return `
      <article class="dashboard-list-item glass-card aurora-card active-glow beam-target job-dispatch-item" data-job-id="${id}">
        <div class="job-dispatch-content">
          <strong>${name}</strong>
          <span>${description}</span>
          <div class="job-dispatch-meta">
            <span>${company}</span>
            <span>Team: ${team}</span>
            <span>${escapeHtml(job.customerPhone || job.customerEmail || "No customer contact")}</span>
          </div>
        </div>
        <div class="job-dispatch-actions">
          <span class="dashboard-status-pill ${pillClass(status)}">${status}</span>
          <span class="dashboard-status-pill ${claim.cls}">${claim.label}</span>
          ${companyButton}
          ${staffButton}
        </div>
      </article>
    `;
  }).join("");
}

function renderProgress(rows) {
  if (!jobsProgressStack) return;

  const buckets = [
    { key: "open", label: "Open Market" },
    { key: "claimed", label: "Company Claimed" },
    { key: "in_progress", label: "Staff Accepted" },
    { key: "scheduled", label: "Scheduled" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" }
  ];

  const total = rows.length || 1;
  jobsProgressStack.innerHTML = buckets.map((bucket) => {
    const count = rows.filter((row) => normalize(jobStatus(row)) === bucket.key || (bucket.key === "in_progress" && normalize(jobStatus(row)) === "in progress")).length;
    const width = Math.max(6, Math.round((count / total) * 100));
    return `
      <div class="dashboard-progress-row glass-card aurora-card active-glow beam-target">
        <div class="dashboard-progress-copy"><strong>${bucket.label}</strong><span>${count} job(s)</span></div>
        <div class="dashboard-progress-bar"><span style="width: ${width}%;"></span></div>
      </div>
    `;
  }).join("");
}

function renderFeed(rows) {
  if (!jobsFeed) return;

  if (!rows.length) {
    jobsFeed.innerHTML = `<article class="dashboard-state-card empty"><strong>No job activity</strong><span>Recent execution activity will appear here once records exist.</span></article>`;
    return;
  }

  jobsFeed.innerHTML = rows.slice(0, 8).map((job) => {
    const name = escapeHtml(jobName(job));
    const status = escapeHtml(jobStatus(job));
    const claim = claimPill(job);
    return `<article class="dashboard-feed-item glass-card aurora-card active-glow beam-target"><strong>${name}</strong><span>Status: ${status} • ${claim.label}</span></article>`;
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
    jobsData = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    renderJobs();
  } catch (error) {
    console.error("Failed to load jobs:", error);
    const errorCard = `<article class="dashboard-state-card error"><strong>Unable to load jobs</strong><span>${escapeHtml(error.message || "Firestore request failed.")}</span></article>`;
    if (jobsList) jobsList.innerHTML = errorCard;
    if (jobsProgressStack) jobsProgressStack.innerHTML = errorCard;
    if (jobsFeed) jobsFeed.innerHTML = errorCard;
  } finally {
    isLoadingJobs = false;
    setButtonLoading(false);
  }
}

async function claimCompanyJob(jobId) {
  const job = jobsData.find((item) => String(item.id) === String(jobId));
  const actor = actorProfile();
  if (!job || !actor.uid) return;
  if (job.companyClaimed) return alert("Already claimed by another company.");

  await updateDoc(doc(db, "jobs", jobId), {
    companyId: actor.companyId || job.companyId || "platform-company",
    companyName: actor.companyName || job.companyName || "Platform Company",
    companyClaimed: true,
    companyClaimedBy: actor.uid,
    companyClaimedByName: actor.displayName,
    companyClaimedAt: serverTimestamp(),
    status: "claimed",
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
    updatedByEmail: actor.email,
    updatedByName: actor.displayName
  });

  await loadJobs();
}

async function claimStaffJob(jobId) {
  const job = jobsData.find((item) => String(item.id) === String(jobId));
  const actor = actorProfile();
  if (!job || !actor.uid) return;
  if (!job.companyClaimed) return alert("A company must claim this job first.");
  if (job.staffClaimed) return alert("Already accepted by another staff member.");
  if (job.companyId && actor.companyId && String(job.companyId) !== String(actor.companyId)) return alert("This job belongs to another company.");

  await updateDoc(doc(db, "jobs", jobId), {
    assignedTo: [actor.uid],
    assignedToNames: [actor.displayName],
    assignedTeamIds: [actor.uid],
    assignedTeamNames: [actor.displayName],
    staffClaimed: true,
    staffClaimedBy: actor.uid,
    staffClaimedByName: actor.displayName,
    staffClaimedAt: serverTimestamp(),
    status: "in_progress",
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
    updatedByEmail: actor.email,
    updatedByName: actor.displayName
  });

  await loadJobs();
}

function injectDispatchStyles() {
  if (document.getElementById("jobDispatchStyles")) return;
  const style = document.createElement("style");
  style.id = "jobDispatchStyles";
  style.textContent = `
    .job-dispatch-item { align-items: flex-start; gap: 16px; }
    .job-dispatch-content { min-width: 0; display: grid; gap: 8px; }
    .job-dispatch-meta { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 4px; }
    .job-dispatch-meta span { border-radius: 999px; padding: 6px 9px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); color: var(--text-muted, rgba(255,255,255,0.68)); font-size: 11px; font-weight: 800; }
    .job-dispatch-actions { display: flex; justify-content: flex-end; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 260px; }
    .job-dispatch-actions .btn { min-height: 34px; padding: 8px 10px; font-size: 12px; }
    @media (max-width: 760px) { .job-dispatch-item { display: grid; } .job-dispatch-actions { justify-content: flex-start; min-width: 0; } }
  `;
  document.head.appendChild(style);
}

function bindEvents() {
  if (hasBoundEvents) return;
  hasBoundEvents = true;
  injectDispatchStyles();

  jobsSearch?.addEventListener("input", renderJobs);
  jobsRefreshBtnTop?.addEventListener("click", loadJobs);
  jobsRefreshBtnSide?.addEventListener("click", loadJobs);

  jobsSortBtn?.addEventListener("click", () => {
    sortAsc = !sortAsc;
    jobsSortBtn.textContent = sortAsc ? "Sort A–Z" : "Sort Z–A";
    renderJobs();
  });

  jobsList?.addEventListener("click", async (event) => {
    const companyBtn = event.target.closest("[data-company-claim]");
    const staffBtn = event.target.closest("[data-staff-claim]");
    if (companyBtn) return claimCompanyJob(companyBtn.getAttribute("data-company-claim"));
    if (staffBtn) return claimStaffJob(staffBtn.getAttribute("data-staff-claim"));
  });

  document.querySelectorAll(".dashboard-nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".dashboard-nav-link").forEach((item) => item.classList.remove("active"));
      link.classList.add("active");
    });
  });
}

function initJobsPage() {
  if (hasStartedAuthWatch) return;
  hasStartedAuthWatch = true;
  bindEvents();

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      navigateWithLoader("/evaraos/login.html", { title: "Returning to login", subtitle: "Your session is not active." });
      return;
    }
    currentFirebaseUser = user;
    loadJobs();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initJobsPage);
} else {
  initJobsPage();
}
