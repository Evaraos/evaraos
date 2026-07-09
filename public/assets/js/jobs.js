import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  onSnapshot,
  query,
  limit,
  updateDoc,
  doc,
  serverTimestamp,
  getSavedUserProfile
} from "./firebase.js";
import { createVirtualizationEngine, installSharedVirtualStyles } from "./shared-virtualization.js";

const jobsSearch = document.getElementById("jobsSearch");
const jobsSearchToolbar = document.getElementById("jobsSearchToolbar");
const jobsSearchInputs = [jobsSearch, jobsSearchToolbar].filter(Boolean);
const jobsList = document.getElementById("jobsList");
const jobsFeed = document.getElementById("jobsFeed");
const jobsProgressStack = document.getElementById("jobsProgressStack");
const jobsMain = document.getElementById("jobsMain");

const jobsHeroTitle = document.getElementById("jobsHeroTitle");
const jobsHeroText = document.getElementById("jobsHeroText");
const jobsConnectionLabel = document.getElementById("jobsConnectionLabel");
const jobsStatusTitle = document.getElementById("jobsStatusTitle");
const jobsStatusLive = document.getElementById("jobsStatusLive");

const jobsStatTotal = document.getElementById("jobsStatTotal");
const jobsStatActive = document.getElementById("jobsStatActive");
const jobsStatCompleted = document.getElementById("jobsStatCompleted");
const jobsStatFiltered = document.getElementById("jobsStatFiltered");

const jobsRefreshBtnTop = document.getElementById("jobsRefreshBtnTop");
const jobsRefreshBtnSide = document.getElementById("jobsRefreshBtnSide");
const jobsSortBtn = document.getElementById("jobsSortBtn");

const LIVE_LIMIT = 50;
const FEED_LIMIT = 6;
const RENDER_DEBOUNCE_MS = 90;

const dispatchVirtualEngine = createVirtualizationEngine("dispatch-jobs", {
  cacheLimit: 80,
  ttlMs: 1000 * 60 * 12,
  debounceMs: 120
});

let jobsData = [];
let sortAsc = true;
let hasBoundEvents = false;
let hasStartedAuthWatch = false;
let currentFirebaseUser = null;
let unsubscribeJobs = null;
let isLiveFeedConnected = false;
let renderTimer = null;
let currentSearchTerm = "";

let lastListHtml = "";
let lastProgressHtml = "";
let lastFeedHtml = "";
let lastHeroTitle = "";
let lastHeroText = "";
let lastRenderedSignature = "";

function navigateWithLoader(url, options = {}) {
  if (window.EvaraLoader && typeof window.EvaraLoader.beginNavigationLoad === "function") {
    window.EvaraLoader.beginNavigationLoad(options);
  }

  requestAnimationFrame(() => window.location.assign(url));
}

function notify(title, message, tone = "info") {
  window.dispatchEvent(new CustomEvent("evara:notify", {
    detail: { title, message, tone }
  }));
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

function stableKey(value = "") {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "default";
}

function humanize(value = "") {
  return String(value || "open")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function jobName(job = {}) {
  return job.title || job.name || job.jobName || job.customerName || "Untitled Job";
}

function jobStatus(job = {}) {
  return job.status || "open";
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

function rowSignature(job = {}) {
  return [
    job.id,
    jobName(job),
    jobStatus(job),
    jobDescription(job),
    jobCompany(job),
    job.customerPhone,
    job.customerEmail,
    job.companyClaimed,
    job.staffClaimed,
    assignedNames(job).join("|")
  ].map((item) => String(item ?? "")).join("~");
}

function virtualKey(job = {}) {
  return String(job.id || rowSignature(job));
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
    displayName:
      profile.displayName ||
      profile.fullName ||
      profile.name ||
      currentFirebaseUser?.displayName ||
      currentFirebaseUser?.email ||
      "Unknown User",
    role: normalize(profile.role || "customer"),
    companyId: profile.companyId || "",
    companyName: profile.companyName || ""
  };
}

function isCompanyLevelRole(role = "") {
  return ["owner", "admin", "manager", "operations_coordinator", "sales", "sales_rep"].includes(normalize(role));
}

function isStaffRole(role = "") {
  return [
    "technician",
    "tech",
    "cleaner",
    "staff",
    "sales",
    "sales_rep",
    "manager",
    "operations_coordinator",
    "owner",
    "admin"
  ].includes(normalize(role));
}

function canClaimCompany(job = {}) {
  const actor = actorProfile();
  return Boolean(actor.uid && isCompanyLevelRole(actor.role) && !job.companyClaimed);
}

function canClaimStaff(job = {}) {
  const actor = actorProfile();

  if (!actor.uid || !isStaffRole(actor.role)) return false;
  if (!job.companyClaimed || job.staffClaimed) return false;
  if (job.companyId && actor.companyId && String(job.companyId) !== String(actor.companyId)) return false;

  return true;
}

function setTextIfChanged(el, value) {
  if (!el) return;

  const next = String(value ?? "");
  if (el.textContent !== next) el.textContent = next;
}

function setHtmlIfChanged(el, html, cacheValue) {
  if (!el) return cacheValue;

  if (cacheValue !== html) {
    el.innerHTML = html;
  }

  return html;
}

function setRegionBusy(isBusy) {
  [jobsMain, jobsList, jobsFeed, jobsProgressStack].forEach((region) => {
    if (region) region.setAttribute("aria-busy", String(Boolean(isBusy)));
  });
}

function setStatus(title, message) {
  setTextIfChanged(jobsStatusTitle, title);
  setTextIfChanged(jobsStatusLive, message);
}

function setHero(title, text) {
  if (title !== lastHeroTitle) {
    setTextIfChanged(jobsHeroTitle, title);
    lastHeroTitle = title;
  }

  if (text !== lastHeroText) {
    setTextIfChanged(jobsHeroText, text);
    lastHeroText = text;
  }
}

function setFeedConnectedState(isConnected) {
  isLiveFeedConnected = isConnected;
  setTextIfChanged(jobsConnectionLabel, isConnected ? "Live Feed Connected" : "Feed Disconnected");

  [jobsRefreshBtnTop, jobsRefreshBtnSide].forEach((btn) => {
    if (!btn) return;

    btn.disabled = false;
    btn.removeAttribute("aria-busy");
    setTextIfChanged(btn, isConnected ? "Reconnect Feed" : "Connect Feed");
  });
}

function setActionBusy(button, isBusy, busyLabel = "Working…") {
  if (!button) return;

  if (isBusy) {
    button.dataset.defaultLabel = button.textContent || "Action";
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = busyLabel;
    return;
  }

  button.disabled = false;
  button.removeAttribute("aria-busy");
  button.textContent = button.dataset.defaultLabel || button.textContent || "Action";
  delete button.dataset.defaultLabel;
}

function buildJobCard(job = {}) {
  const id = escapeHtml(job.id);
  const titleId = `job-title-${stableKey(job.id || jobName(job))}`;
  const name = escapeHtml(jobName(job));
  const statusRaw = jobStatus(job);
  const status = escapeHtml(humanize(statusRaw));
  const description = escapeHtml(jobDescription(job));
  const company = escapeHtml(jobCompany(job));
  const claim = claimPill(job);
  const team = assignedNames(job).length ? escapeHtml(assignedNames(job).join(", ")) : "Unassigned";
  const contact = escapeHtml(job.customerPhone || job.customerEmail || "No customer contact");
  const stateKey = stableKey(`${statusRaw} ${claim.label}`);

  const companyButton = canClaimCompany(job)
    ? `<button type="button" class="btn btn-theme-primary job-company-claim-btn" data-company-claim="${id}" aria-label="Claim ${name} for company">Claim for Company</button>`
    : "";

  const staffButton = canClaimStaff(job)
    ? `<button type="button" class="btn btn-theme-primary job-staff-claim-btn" data-staff-claim="${id}" aria-label="Accept ${name}">Accept Job</button>`
    : "";

  return `
    <article class="dashboard-list-item glass-card aurora-card active-glow beam-target job-dispatch-item virtual-paint-card shared-virtual-card" data-job-id="${id}" data-virtual-state="${stateKey}" aria-labelledby="${titleId}">
      <div class="job-dispatch-content">
        <strong id="${titleId}">${name}</strong>
        <span>${description}</span>

        <div class="job-dispatch-meta" aria-label="Job details">
          <span>${company}</span>
          <span>Team: ${team}</span>
          <span>${contact}</span>
        </div>
      </div>

      <div class="job-dispatch-actions" aria-label="Job status and actions">
        <span class="dashboard-status-pill ${pillClass(statusRaw)}">${status}</span>
        <span class="dashboard-status-pill ${claim.cls}">${claim.label}</span>
        ${companyButton}
        ${staffButton}
      </div>
    </article>
  `;
}

function renderLoadingState() {
  setRegionBusy(true);
  setTextIfChanged(jobsConnectionLabel, "Connecting");
  setStatus("Preparing operations", "Opening the secure live job feed.");

  [jobsRefreshBtnTop, jobsRefreshBtnSide].forEach((btn) => {
    if (!btn) return;
    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    setTextIfChanged(btn, "Connecting…");
  });

  lastListHtml = setHtmlIfChanged(
    jobsList,
    `
      <div class="dashboard-skeleton-grid virtual-paint-list shared-virtual-list" aria-hidden="true">
        <div class="dashboard-skeleton-card virtual-paint-card shared-virtual-card">
          <div class="dashboard-skeleton-line line-1"></div>
          <div class="dashboard-skeleton-line line-2"></div>
          <div class="dashboard-skeleton-line line-3"></div>
        </div>
        <div class="dashboard-skeleton-card virtual-paint-card shared-virtual-card">
          <div class="dashboard-skeleton-line line-1"></div>
          <div class="dashboard-skeleton-line line-2"></div>
          <div class="dashboard-skeleton-line line-3"></div>
        </div>
      </div>
    `,
    lastListHtml
  );

  lastProgressHtml = setHtmlIfChanged(
    jobsProgressStack,
    `<article class="dashboard-state-card loading virtual-paint-card shared-virtual-card"><strong>Connecting live dispatch...</strong><span>Opening optimized Firestore real-time job feed.</span></article>`,
    lastProgressHtml
  );

  lastFeedHtml = setHtmlIfChanged(
    jobsFeed,
    `<article class="dashboard-state-card loading virtual-paint-card shared-virtual-card"><strong>Live feed starting...</strong><span>Jobs update instantly without full page refresh.</span></article>`,
    lastFeedHtml
  );

  setHero("Connecting live job feed...", "Opening the optimized live workspace for companies, teams, and field execution.");
}

function filteredJobs() {
  const term = normalize(currentSearchTerm);
  let rows = jobsData;

  if (term) {
    rows = rows.filter((job) =>
      [
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
      ].some((value) => String(value || "").toLowerCase().includes(term))
    );
  }

  rows = [...rows].sort((a, b) => {
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
    ["open", "available", "claimed", "scheduled", "in_progress", "in progress", "active", "working"].includes(
      normalize(jobStatus(row))
    )
  ).length;

  const completed = rows.filter((row) =>
    ["completed", "done", "closed"].includes(normalize(jobStatus(row)))
  ).length;

  setTextIfChanged(jobsStatTotal, jobsData.length);
  setTextIfChanged(jobsStatActive, active);
  setTextIfChanged(jobsStatCompleted, completed);
  setTextIfChanged(jobsStatFiltered, rows.length);

  const title = isLiveFeedConnected
    ? `${jobsData.length} jobs live`
    : jobsData.length
      ? `${jobsData.length} jobs connected`
      : "No jobs found yet.";

  const text = isLiveFeedConnected
    ? `Live dispatch is connected. Showing up to ${LIVE_LIMIT} jobs with the shared virtualization engine.`
    : jobsData.length
      ? "Companies claim platform jobs first, then eligible staff accept execution work."
      : "Create or convert leads into jobs to populate the operations board.";

  setHero(title, text);
  setStatus(
    isLiveFeedConnected ? "Operations synchronized" : "Operations ready",
    `${rows.length} of ${jobsData.length} jobs are visible with the current search and sort settings.`
  );
}

function renderList(rows) {
  const visibleRows = rows.slice(0, LIVE_LIMIT);

  if (!visibleRows.length) {
    lastListHtml = setHtmlIfChanged(
      jobsList,
      `<article class="dashboard-state-card empty virtual-paint-card shared-virtual-card"><strong>No jobs found</strong><span>Try another search or convert a lead into a job.</span></article>`,
      lastListHtml
    );
    return;
  }

  const signature = visibleRows.map(rowSignature).join("|") + `:${sortAsc}:${normalize(currentSearchTerm)}`;
  if (signature === lastRenderedSignature && lastListHtml) return;
  lastRenderedSignature = signature;

  const rendered = dispatchVirtualEngine.renderRows(visibleRows, {
    keyFn: virtualKey,
    signatureFn: rowSignature,
    htmlFn: buildJobCard,
    lastHtml: lastListHtml,
    skipWhenSame: false
  });

  const html =
    rendered.html +
    (rows.length > LIVE_LIMIT
      ? `<article class="dashboard-state-card working virtual-paint-card shared-virtual-card"><strong>Showing first ${LIVE_LIMIT}</strong><span>Use search to narrow ${rows.length} live jobs.</span></article>`
      : "");

  lastListHtml = setHtmlIfChanged(jobsList, html, lastListHtml);
  dispatchVirtualEngine.prefetch(rows.slice(LIVE_LIMIT), {
    keyFn: virtualKey,
    signatureFn: rowSignature,
    htmlFn: buildJobCard
  });
}

function renderProgress(rows) {
  const buckets = [
    { key: "open", label: "Open Market" },
    { key: "claimed", label: "Company Claimed" },
    { key: "in_progress", label: "Staff Accepted" },
    { key: "scheduled", label: "Scheduled" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" }
  ];

  const total = rows.length || 1;

  const html = buckets
    .map((bucket) => {
      const count = rows.filter(
        (row) =>
          normalize(jobStatus(row)) === bucket.key ||
          (bucket.key === "in_progress" && normalize(jobStatus(row)) === "in progress")
      ).length;

      const width = Math.max(6, Math.round((count / total) * 100));
      const exactPercent = rows.length ? Math.round((count / rows.length) * 100) : 0;

      return `
        <div class="dashboard-progress-row glass-card aurora-card active-glow beam-target virtual-paint-card shared-virtual-card">
          <div class="dashboard-progress-copy">
            <strong>${bucket.label}</strong>
            <span>${count} job${count === 1 ? "" : "s"}</span>
          </div>
          <div class="dashboard-progress-bar" role="progressbar" aria-label="${bucket.label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${exactPercent}"><span style="width: ${width}%;"></span></div>
        </div>
      `;
    })
    .join("");

  lastProgressHtml = setHtmlIfChanged(jobsProgressStack, html, lastProgressHtml);
}

function renderFeed(rows) {
  const visibleRows = rows.slice(0, FEED_LIMIT);

  if (!visibleRows.length) {
    lastFeedHtml = setHtmlIfChanged(
      jobsFeed,
      `<article class="dashboard-state-card empty virtual-paint-card shared-virtual-card"><strong>No job activity</strong><span>Recent execution activity will appear here once records exist.</span></article>`,
      lastFeedHtml
    );
    return;
  }

  const html = visibleRows
    .map((job) => {
      const name = escapeHtml(jobName(job));
      const status = escapeHtml(humanize(jobStatus(job)));
      const claim = claimPill(job);

      return `
        <article class="dashboard-feed-item glass-card aurora-card active-glow beam-target virtual-paint-card shared-virtual-card">
          <strong>${name}</strong>
          <span>Status: ${status} • ${claim.label}</span>
        </article>
      `;
    })
    .join("");

  lastFeedHtml = setHtmlIfChanged(jobsFeed, html, lastFeedHtml);
}

function renderJobsNow() {
  renderTimer = null;

  const rows = filteredJobs();

  renderStats(rows);
  renderList(rows);
  renderProgress(rows);
  renderFeed(rows);
  setRegionBusy(false);
}

function scheduleRenderJobs() {
  if (renderTimer) clearTimeout(renderTimer);
  renderTimer = setTimeout(renderJobsNow, RENDER_DEBOUNCE_MS);
}

function startLiveJobsFeed() {
  if (unsubscribeJobs) {
    unsubscribeJobs();
    unsubscribeJobs = null;
  }

  renderLoadingState();

  unsubscribeJobs = onSnapshot(
    query(collection(db, "jobs"), limit(LIVE_LIMIT)),
    (snapshot) => {
      jobsData = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      setFeedConnectedState(true);
      dispatchVirtualEngine.prefetch(jobsData, {
        keyFn: virtualKey,
        signatureFn: rowSignature,
        htmlFn: buildJobCard
      });
      scheduleRenderJobs();
    },
    (error) => {
      console.error("Live jobs feed failed:", error);
      setFeedConnectedState(false);
      setRegionBusy(false);
      setStatus("Live feed unavailable", "The jobs workspace could not connect. Use Connect Feed to retry.");

      const errorCard = `<article class="dashboard-state-card error virtual-paint-card shared-virtual-card"><strong>Live feed disconnected</strong><span>${escapeHtml(
        error.message || "Firestore listener failed."
      )}</span></article>`;

      lastListHtml = setHtmlIfChanged(jobsList, errorCard, lastListHtml);
      lastProgressHtml = setHtmlIfChanged(jobsProgressStack, errorCard, lastProgressHtml);
      lastFeedHtml = setHtmlIfChanged(jobsFeed, errorCard, lastFeedHtml);
    }
  );
}

async function claimCompanyJob(jobId, button) {
  const job = jobsData.find((item) => String(item.id) === String(jobId));
  const actor = actorProfile();

  if (!job || !actor.uid) return;
  if (job.companyClaimed) {
    notify("Job already claimed", "Another company claimed this job before your action completed.", "warning");
    return;
  }

  setActionBusy(button, true, "Claiming…");
  try {
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
    notify("Job claimed", `${jobName(job)} is now assigned to your company.`, "success");
  } catch (error) {
    console.error("Company job claim failed:", error);
    notify("Unable to claim job", error?.message || "The job could not be claimed.", "error");
  } finally {
    setActionBusy(button, false);
  }
}

async function claimStaffJob(jobId, button) {
  const job = jobsData.find((item) => String(item.id) === String(jobId));
  const actor = actorProfile();

  if (!job || !actor.uid) return;
  if (!job.companyClaimed) {
    notify("Company claim required", "A company must claim this job before staff can accept it.", "warning");
    return;
  }
  if (job.staffClaimed) {
    notify("Job already accepted", "Another team member accepted this job first.", "warning");
    return;
  }
  if (job.companyId && actor.companyId && String(job.companyId) !== String(actor.companyId)) {
    notify("Different company", "This job belongs to another company.", "warning");
    return;
  }

  setActionBusy(button, true, "Accepting…");
  try {
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
    notify("Job accepted", `${jobName(job)} is now assigned to you.`, "success");
  } catch (error) {
    console.error("Staff job claim failed:", error);
    notify("Unable to accept job", error?.message || "The job could not be accepted.", "error");
  } finally {
    setActionBusy(button, false);
  }
}

function syncSearchInputs(source) {
  currentSearchTerm = source?.value || "";
  jobsSearchInputs.forEach((input) => {
    if (input !== source && input.value !== currentSearchTerm) input.value = currentSearchTerm;
  });
  scheduleRenderJobs();
}

function bindEvents() {
  if (hasBoundEvents) return;
  hasBoundEvents = true;

  installSharedVirtualStyles();

  jobsSearchInputs.forEach((input) => {
    input.addEventListener("input", () => syncSearchInputs(input));
  });

  jobsRefreshBtnTop?.addEventListener("click", startLiveJobsFeed);
  jobsRefreshBtnSide?.addEventListener("click", startLiveJobsFeed);

  jobsSortBtn?.addEventListener("click", () => {
    sortAsc = !sortAsc;
    jobsSortBtn.textContent = sortAsc ? "Sort A–Z" : "Sort Z–A";
    jobsSortBtn.setAttribute("aria-pressed", String(!sortAsc));
    scheduleRenderJobs();
  });

  jobsList?.addEventListener("click", async (event) => {
    const companyBtn = event.target.closest("[data-company-claim]");
    const staffBtn = event.target.closest("[data-staff-claim]");

    if (companyBtn) return claimCompanyJob(companyBtn.getAttribute("data-company-claim"), companyBtn);
    if (staffBtn) return claimStaffJob(staffBtn.getAttribute("data-staff-claim"), staffBtn);
  });

  window.addEventListener("pagehide", () => {
    dispatchVirtualEngine.save();
    if (unsubscribeJobs) unsubscribeJobs();
    if (renderTimer) clearTimeout(renderTimer);
  }, { once: true });
}

function initJobsPage() {
  if (hasStartedAuthWatch) return;
  hasStartedAuthWatch = true;

  bindEvents();

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      navigateWithLoader("/login.html", {
        title: "Returning to login",
        subtitle: "Your session is not active."
      });
      return;
    }

    currentFirebaseUser = user;
    startLiveJobsFeed();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initJobsPage, { once: true });
} else {
  initJobsPage();
}
