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

const LIVE_LIMIT = 50;
const FEED_LIMIT = 6;
const RENDER_DEBOUNCE_MS = 90;
const SHARED_CACHE_LIMIT = 80;
const SHARED_CACHE_TTL_MS = 1000 * 60 * 12;
const SHARED_CACHE_KEY = "evaraos:dispatch:shared-virtual-cache:v1";

let jobsData = [];
let sortAsc = true;
let hasBoundEvents = false;
let hasStartedAuthWatch = false;
let currentFirebaseUser = null;
let unsubscribeJobs = null;
let isLiveFeedConnected = false;
let renderTimer = null;
let prefetchTimer = null;

let lastListHtml = "";
let lastProgressHtml = "";
let lastFeedHtml = "";
let lastHeroTitle = "";
let lastHeroText = "";
let lastRenderedSignature = "";

const sharedVirtualMemory = new Map();
const idle = window.requestIdleCallback || ((callback) => setTimeout(() => callback({ timeRemaining: () => 8 }), 1));

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

function stableKey(value = "") {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "default";
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

  [jobsRefreshBtnTop, jobsRefreshBtnSide].forEach((btn) => {
    if (!btn) return;

    btn.disabled = false;
    setTextIfChanged(btn, isConnected ? "Reconnect Feed" : "Connect Feed");
  });
}

function rememberVirtualRow(job = {}, html = "") {
  const key = String(job.id || rowSignature(job));
  sharedVirtualMemory.set(key, {
    html,
    signature: rowSignature(job),
    updatedAt: Date.now()
  });

  if (sharedVirtualMemory.size > SHARED_CACHE_LIMIT) {
    const firstKey = sharedVirtualMemory.keys().next().value;
    sharedVirtualMemory.delete(firstKey);
  }
}

function readVirtualRow(job = {}) {
  const key = String(job.id || rowSignature(job));
  const cached = sharedVirtualMemory.get(key);
  if (!cached || cached.signature !== rowSignature(job)) return "";
  return cached.html;
}

function saveOfflineVirtualCache() {
  try {
    const payload = [...sharedVirtualMemory.entries()].slice(-SHARED_CACHE_LIMIT);
    localStorage.setItem(SHARED_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), payload }));
  } catch {
    // Offline persistence is an optimization only.
  }
}

function hydrateOfflineVirtualCache() {
  try {
    const raw = localStorage.getItem(SHARED_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > SHARED_CACHE_TTL_MS) return;

    (parsed.payload || []).forEach(([key, value]) => {
      if (key && value?.html && value?.signature) sharedVirtualMemory.set(key, value);
    });
  } catch {
    // Ignore broken local cache and let realtime data rebuild it.
  }
}

function buildJobCard(job = {}) {
  const cached = readVirtualRow(job);
  if (cached) return cached;

  const id = escapeHtml(job.id);
  const name = escapeHtml(jobName(job));
  const status = escapeHtml(jobStatus(job));
  const description = escapeHtml(jobDescription(job));
  const company = escapeHtml(jobCompany(job));
  const claim = claimPill(job);
  const team = assignedNames(job).length ? escapeHtml(assignedNames(job).join(", ")) : "Unassigned";
  const stateKey = stableKey(`${jobStatus(job)} ${claim.label}`);

  const companyButton = canClaimCompany(job)
    ? `<button type="button" class="btn btn-theme-primary job-company-claim-btn" data-company-claim="${id}">Claim for Company</button>`
    : "";

  const staffButton = canClaimStaff(job)
    ? `<button type="button" class="btn btn-theme-primary job-staff-claim-btn" data-staff-claim="${id}">Accept Job</button>`
    : "";

  const html = `
    <article class="dashboard-list-item glass-card aurora-card active-glow beam-target job-dispatch-item virtual-paint-card" data-job-id="${id}" data-virtual-state="${stateKey}">
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

  rememberVirtualRow(job, html);
  return html;
}

function prefetchVirtualRows(rows = []) {
  if (prefetchTimer) clearTimeout(prefetchTimer);

  prefetchTimer = setTimeout(() => {
    idle(() => {
      rows.slice(0, SHARED_CACHE_LIMIT).forEach((job) => buildJobCard(job));
      saveOfflineVirtualCache();
    });
  }, 120);
}

function renderLoadingState() {
  lastListHtml = setHtmlIfChanged(
    jobsList,
    `
      <div class="dashboard-skeleton-grid virtual-paint-list">
        <div class="dashboard-skeleton-card virtual-paint-card">
          <div class="dashboard-skeleton-line line-1"></div>
          <div class="dashboard-skeleton-line line-2"></div>
          <div class="dashboard-skeleton-line line-3"></div>
        </div>
        <div class="dashboard-skeleton-card virtual-paint-card">
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
    `<article class="dashboard-state-card loading virtual-paint-card"><strong>Connecting live dispatch...</strong><span>Opening optimized Firestore real-time job feed.</span></article>`,
    lastProgressHtml
  );

  lastFeedHtml = setHtmlIfChanged(
    jobsFeed,
    `<article class="dashboard-state-card loading virtual-paint-card"><strong>Live feed starting...</strong><span>Jobs update instantly without full page refresh.</span></article>`,
    lastFeedHtml
  );

  setHero("Connecting live job feed...", "Opening optimized live listener for Uber-style dispatch.");
}

function filteredJobs() {
  const term = normalize(jobsSearch?.value || "");
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

  setHero(
    isLiveFeedConnected
      ? `${jobsData.length} jobs live`
      : jobsData.length
        ? `${jobsData.length} jobs connected`
        : "No jobs found yet.",
    isLiveFeedConnected
      ? `Optimized live dispatch connected. Showing up to ${LIVE_LIMIT} jobs with shared paint virtualization.`
      : jobsData.length
        ? "Dispatch is live: companies claim platform jobs first, then staff claim execution first-come first-served."
        : "Create or convert leads into jobs to populate the dispatch board."
  );
}

function renderList(rows) {
  const visibleRows = rows.slice(0, LIVE_LIMIT);

  if (!visibleRows.length) {
    lastListHtml = setHtmlIfChanged(
      jobsList,
      `<article class="dashboard-state-card empty virtual-paint-card"><strong>No jobs found</strong><span>Try another search or convert a lead into a job.</span></article>`,
      lastListHtml
    );
    return;
  }

  const signature = visibleRows.map(rowSignature).join("|") + `:${sortAsc}:${normalize(jobsSearch?.value || "")}`;
  if (signature === lastRenderedSignature && lastListHtml) return;
  lastRenderedSignature = signature;

  const html =
    visibleRows.map((job) => buildJobCard(job)).join("") +
    (rows.length > LIVE_LIMIT
      ? `<article class="dashboard-state-card working virtual-paint-card"><strong>Showing first ${LIVE_LIMIT}</strong><span>Use search to narrow ${rows.length} live jobs.</span></article>`
      : "");

  lastListHtml = setHtmlIfChanged(jobsList, html, lastListHtml);
  prefetchVirtualRows(rows.slice(LIVE_LIMIT));
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

      return `
        <div class="dashboard-progress-row glass-card aurora-card active-glow beam-target virtual-paint-card">
          <div class="dashboard-progress-copy">
            <strong>${bucket.label}</strong>
            <span>${count} job(s)</span>
          </div>
          <div class="dashboard-progress-bar"><span style="width: ${width}%;"></span></div>
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
      `<article class="dashboard-state-card empty virtual-paint-card"><strong>No job activity</strong><span>Recent execution activity will appear here once records exist.</span></article>`,
      lastFeedHtml
    );
    return;
  }

  const html = visibleRows
    .map((job) => {
      const name = escapeHtml(jobName(job));
      const status = escapeHtml(jobStatus(job));
      const claim = claimPill(job);

      return `
        <article class="dashboard-feed-item glass-card aurora-card active-glow beam-target virtual-paint-card">
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
      prefetchVirtualRows(jobsData);
      scheduleRenderJobs();
    },
    (error) => {
      console.error("Live jobs feed failed:", error);
      setFeedConnectedState(false);

      const errorCard = `<article class="dashboard-state-card error virtual-paint-card"><strong>Live feed disconnected</strong><span>${escapeHtml(
        error.message || "Firestore listener failed."
      )}</span></article>`;

      lastListHtml = setHtmlIfChanged(jobsList, errorCard, lastListHtml);
      lastProgressHtml = setHtmlIfChanged(jobsProgressStack, errorCard, lastProgressHtml);
      lastFeedHtml = setHtmlIfChanged(jobsFeed, errorCard, lastFeedHtml);
    }
  );
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
}

async function claimStaffJob(jobId) {
  const job = jobsData.find((item) => String(item.id) === String(jobId));
  const actor = actorProfile();

  if (!job || !actor.uid) return;
  if (!job.companyClaimed) return alert("A company must claim this job first.");
  if (job.staffClaimed) return alert("Already accepted by another staff member.");
  if (job.companyId && actor.companyId && String(job.companyId) !== String(actor.companyId)) {
    return alert("This job belongs to another company.");
  }

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
}

function injectDispatchStyles() {
  if (document.getElementById("jobDispatchStyles")) return;

  const style = document.createElement("style");
  style.id = "jobDispatchStyles";
  style.textContent = `
    .job-dispatch-item {
      align-items: flex-start;
      gap: 14px;
      contain: content;
      content-visibility: auto;
      contain-intrinsic-size: 164px;
    }

    .virtual-paint-card {
      contain: layout paint style;
      backface-visibility: hidden;
      transform: translateZ(0);
      will-change: auto;
    }

    .job-dispatch-content {
      min-width: 0;
      display: grid;
      gap: 7px;
    }

    .job-dispatch-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 4px;
    }

    .job-dispatch-meta span {
      border-radius: 999px;
      padding: 6px 9px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.05);
      color: var(--text-muted, rgba(255,255,255,0.68));
      font-size: 11px;
      font-weight: 800;
    }

    .job-dispatch-actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      min-width: 250px;
    }

    .job-dispatch-actions .btn {
      min-height: 34px;
      padding: 8px 10px;
      font-size: 12px;
    }

    @media (max-width: 760px) {
      .job-dispatch-item {
        display: grid;
        box-shadow: none !important;
        animation: none !important;
        contain-intrinsic-size: 210px;
      }

      .job-dispatch-actions {
        justify-content: flex-start;
        min-width: 0;
      }

      .job-dispatch-meta span {
        font-size: 10px;
        padding: 5px 8px;
      }

      #jobsList .aurora-card,
      #jobsFeed .aurora-card,
      #jobsProgressStack .aurora-card {
        animation: none !important;
      }
    }
  `;

  document.head.appendChild(style);
}

function bindEvents() {
  if (hasBoundEvents) return;
  hasBoundEvents = true;

  hydrateOfflineVirtualCache();
  injectDispatchStyles();

  jobsSearch?.addEventListener("input", scheduleRenderJobs);
  jobsRefreshBtnTop?.addEventListener("click", startLiveJobsFeed);
  jobsRefreshBtnSide?.addEventListener("click", startLiveJobsFeed);

  jobsSortBtn?.addEventListener("click", () => {
    sortAsc = !sortAsc;
    jobsSortBtn.textContent = sortAsc ? "Sort A–Z" : "Sort Z–A";
    scheduleRenderJobs();
  });

  jobsList?.addEventListener("click", async (event) => {
    const companyBtn = event.target.closest("[data-company-claim]");
    const staffBtn = event.target.closest("[data-staff-claim]");

    if (companyBtn) return claimCompanyJob(companyBtn.getAttribute("data-company-claim"));
    if (staffBtn) return claimStaffJob(staffBtn.getAttribute("data-staff-claim"));
  });

  window.addEventListener("beforeunload", () => {
    saveOfflineVirtualCache();
    if (unsubscribeJobs) unsubscribeJobs();
    if (renderTimer) clearTimeout(renderTimer);
    if (prefetchTimer) clearTimeout(prefetchTimer);
  });
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
  document.addEventListener("DOMContentLoaded", initJobsPage);
} else {
  initJobsPage();
}
