import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  getSavedUserProfile
} from "./firebase.js";

const dispatchMain = document.getElementById("dispatchMain");
const dispatchBoard = document.getElementById("dispatchBoard");
const dispatchNew = document.getElementById("dispatchNew");
const dispatchClaimed = document.getElementById("dispatchClaimed");
const dispatchActiveList = document.getElementById("dispatchActiveList");
const dispatchSearch = document.getElementById("dispatchSearch");
const dispatchCompanyFilter = document.getElementById("dispatchCompanyFilter");
const dispatchStatusFilter = document.getElementById("dispatchStatusFilter");
const dispatchClearFilters = document.getElementById("dispatchClearFilters");
const dispatchRefresh = document.getElementById("dispatchRefresh");
const dispatchTotal = document.getElementById("dispatchTotal");
const dispatchOpen = document.getElementById("dispatchOpen");
const dispatchClaimedTotal = document.getElementById("dispatchClaimedTotal");
const dispatchActive = document.getElementById("dispatchActive");
const dispatchNewCount = document.getElementById("dispatchNewCount");
const dispatchClaimedCount = document.getElementById("dispatchClaimedCount");
const dispatchActiveCount = document.getElementById("dispatchActiveCount");
const dispatchConnectionLabel = document.getElementById("dispatchConnectionLabel");
const dispatchStatusCopy = document.getElementById("dispatchStatusCopy");
const dispatchVisibleSummary = document.getElementById("dispatchVisibleSummary");

const SEARCH_DEBOUNCE_MS = 90;
const COLUMN_KEYS = Object.freeze(["open", "claimed", "active"]);
const columnCache = new Map();

let jobs = [];
let searchTimer = null;
let hasLoaded = false;
let hasBoundEvents = false;
let hasStartedAuthWatch = false;
let lastFilterSignature = "";

function escapeHtml(value = "") {
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
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "record";
}

function humanize(value = "") {
  return String(value || "new")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function notify(title, message, tone = "info") {
  window.dispatchEvent(new CustomEvent("evara:notify", {
    detail: { title, message, tone }
  }));
}

function navigateWithLoader(url, options = {}) {
  if (window.EvaraLoader && typeof window.EvaraLoader.beginNavigationLoad === "function") {
    window.EvaraLoader.beginNavigationLoad(options);
  }

  requestAnimationFrame(() => window.location.assign(url));
}

function actorSnapshot() {
  const profile = getSavedUserProfile() || {};
  const user = auth.currentUser || {};

  return {
    uid: user.uid || profile.uid || "",
    name: profile.displayName || profile.fullName || profile.name || user.displayName || user.email || "Dispatcher"
  };
}

function statusGroup(status = "") {
  const safe = normalize(status);

  if (["new", "dispatch_review", "open", "available"].includes(safe)) return "open";
  if (["claimed", "scheduled"].includes(safe)) return "claimed";
  if (["in_progress", "in progress", "active", "working"].includes(safe)) return "active";
  if (["completed", "done", "closed"].includes(safe)) return "completed";

  return "open";
}

function statusTone(status = "") {
  const group = statusGroup(status);
  if (group === "completed") return "go";
  if (group === "claimed" || group === "active") return "hot";
  return "";
}

function companyKey(job = {}) {
  return normalize(job.companyId || job.companyName || "unassigned");
}

function companyLabel(job = {}) {
  return job.companyName || job.companyId || "Unassigned company";
}

function timestampSeconds(value) {
  if (!value) return 0;
  if (typeof value?.seconds === "number") return value.seconds;
  if (typeof value?.toDate === "function") return Math.floor(value.toDate().getTime() / 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : Math.floor(date.getTime() / 1000);
}

function formatTimestamp(value) {
  const seconds = timestampSeconds(value);
  if (!seconds) return "";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(seconds * 1000));
}

function setText(element, value) {
  if (!element) return;
  const next = String(value ?? "");
  if (element.textContent !== next) element.textContent = next;
}

function setBusy(isBusy) {
  dispatchMain?.setAttribute("aria-busy", String(Boolean(isBusy)));
  [dispatchNew, dispatchClaimed, dispatchActiveList].forEach((element) => {
    element?.setAttribute("aria-busy", String(Boolean(isBusy)));
  });
}

function setConnectionState(state, message) {
  const label = state === "connected" ? "Dispatch Connected" : state === "error" ? "Connection Failed" : "Connecting";
  setText(dispatchConnectionLabel, label);
  setText(dispatchStatusCopy, message);

  const shell = dispatchConnectionLabel?.closest(".dispatch-live-label");
  shell?.classList.toggle("is-connected", state === "connected");
  shell?.classList.toggle("is-error", state === "error");
}

function setRefreshBusy(isBusy) {
  if (!dispatchRefresh) return;

  dispatchRefresh.disabled = Boolean(isBusy);
  dispatchRefresh.toggleAttribute("aria-busy", Boolean(isBusy));
  setText(dispatchRefresh, isBusy ? "Refreshing…" : "Refresh");
}

function setActionBusy(button, isBusy, label = "Working…") {
  if (!button) return;

  if (isBusy) {
    button.dataset.defaultLabel = button.textContent || "Action";
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = label;
    return;
  }

  button.disabled = false;
  button.removeAttribute("aria-busy");
  button.textContent = button.dataset.defaultLabel || button.textContent || "Action";
  delete button.dataset.defaultLabel;
}

function cardMarkup(job = {}) {
  const id = escapeHtml(job.id || "");
  const title = escapeHtml(job.customerName || job.title || "Untitled Job");
  const titleId = `dispatch-title-${stableKey(job.id || title)}`;
  const status = normalize(job.status || "new");
  const group = statusGroup(status);
  const service = escapeHtml(job.service || job.serviceType || "Service pending");
  const market = escapeHtml(job.city || job.market || "Market not assigned");
  const company = escapeHtml(companyLabel(job));
  const staff = escapeHtml(job.assignedStaffName || job.staffClaimedByName || "");
  const created = escapeHtml(formatTimestamp(job.createdAt));

  const action = group === "open"
    ? `<button type="button" class="btn btn-theme-primary beam-target" data-claim="${id}" aria-label="Claim ${title}">Claim</button>`
    : group === "claimed"
      ? `<button type="button" class="btn btn-theme-secondary beam-target" data-start="${id}" aria-label="Start ${title}">Start</button>`
      : group === "active"
        ? `<button type="button" class="btn btn-theme-primary beam-target" data-complete="${id}" aria-label="Complete ${title}">Complete</button>`
        : "";

  return `
    <article class="dispatch-card glass-card aurora-card beam-target" data-job-id="${id}" data-status-group="${group}" aria-labelledby="${titleId}">
      <div class="dispatch-card-head">
        <div class="dispatch-card-copy">
          <h4 id="${titleId}">${title}</h4>
          <p class="dispatch-card-service">${service} • ${market}</p>
        </div>
        ${created ? `<time class="dispatch-card-time">${created}</time>` : ""}
      </div>

      <div class="dispatch-meta" aria-label="Dispatch record metadata">
        <span class="dispatch-pill ${statusTone(status)}">${escapeHtml(humanize(status))}</span>
        <span class="dispatch-pill">${company}</span>
        ${staff ? `<span class="dispatch-pill go">${staff}</span>` : ""}
      </div>

      ${action ? `<div class="dispatch-actions" aria-label="Dispatch actions">${action}</div>` : ""}
    </article>
  `;
}

function emptyMarkup(title, message) {
  return `
    <div class="empty-card">
      <span class="dispatch-empty-icon" data-evara-icon="dispatch" aria-hidden="true"></span>
      <span class="dispatch-empty-copy"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span></span>
    </div>
  `;
}

function skeletonMarkup() {
  return `
    <div class="dispatch-skeleton" aria-hidden="true">
      <span class="dispatch-skeleton-line"></span>
      <span class="dispatch-skeleton-line"></span>
      <span class="dispatch-skeleton-line"></span>
      <span class="dispatch-skeleton-line"></span>
    </div>
  `;
}

function renderLoadingState() {
  setBusy(true);
  setConnectionState("loading", "Loading current jobs and preparing the operations pipeline.");
  setText(dispatchVisibleSummary, "Loading records…");
  setRefreshBusy(true);

  [dispatchNew, dispatchClaimed, dispatchActiveList].forEach((element) => {
    if (element) element.innerHTML = skeletonMarkup();
  });
}

function populateCompanyFilter(items = []) {
  if (!dispatchCompanyFilter) return;

  const selected = dispatchCompanyFilter.value || "all";
  const companies = new Map();

  items.forEach((job) => {
    const key = companyKey(job);
    const label = companyLabel(job);
    if (!companies.has(key)) companies.set(key, label);
  });

  const options = [
    `<option value="all">All companies</option>`,
    ...[...companies.entries()]
      .sort((left, right) => String(left[1]).localeCompare(String(right[1])))
      .map(([key, label]) => `<option value="${escapeHtml(key)}">${escapeHtml(label)}</option>`)
  ].join("");

  if (dispatchCompanyFilter.innerHTML !== options) dispatchCompanyFilter.innerHTML = options;
  dispatchCompanyFilter.value = companies.has(selected) || selected === "all" ? selected : "all";
}

function matchesWorkflow(job, filter) {
  if (filter === "all") return true;
  const group = statusGroup(job.status);
  if (filter === "completed") return group === "completed";
  return group === filter;
}

function applyFilters(items = []) {
  const term = normalize(dispatchSearch?.value || "");
  const company = normalize(dispatchCompanyFilter?.value || "all");
  const workflow = normalize(dispatchStatusFilter?.value || "all");

  return items.filter((job) => {
    const textMatch = !term || [
      job.customerName,
      job.title,
      job.service,
      job.serviceType,
      job.city,
      job.market,
      job.companyName,
      job.assignedStaffName,
      job.staffClaimedByName,
      job.status
    ].some((value) => normalize(value).includes(term));

    const companyMatch = company === "all" || companyKey(job) === company;
    const workflowMatch = matchesWorkflow(job, workflow);

    return textMatch && companyMatch && workflowMatch;
  });
}

function renderColumn(key, element, rows = []) {
  if (!element) return;

  const html = rows.length
    ? rows.map(cardMarkup).join("")
    : emptyMarkup(
        key === "open" ? "Queue is clear" : key === "claimed" ? "Nothing is waiting" : "No active work",
        "No records match the current dispatch filters."
      );

  if (columnCache.get(key) !== html) {
    element.innerHTML = html;
    columnCache.set(key, html);
  }
}

function renderBoard({ force = false } = {}) {
  const filterSignature = [
    normalize(dispatchSearch?.value || ""),
    normalize(dispatchCompanyFilter?.value || "all"),
    normalize(dispatchStatusFilter?.value || "all"),
    jobs.map((job) => `${job.id}:${job.status}:${job.companyId}:${job.assignedStaffName || job.staffClaimedByName || ""}`).join("|")
  ].join("~");

  if (!force && filterSignature === lastFilterSignature) return;
  lastFilterSignature = filterSignature;

  const filtered = applyFilters(jobs);
  const open = filtered.filter((job) => statusGroup(job.status) === "open");
  const claimed = filtered.filter((job) => statusGroup(job.status) === "claimed");
  const active = filtered.filter((job) => ["active", "completed"].includes(statusGroup(job.status)));

  renderColumn("open", dispatchNew, open);
  renderColumn("claimed", dispatchClaimed, claimed);
  renderColumn("active", dispatchActiveList, active);

  setText(dispatchTotal, filtered.length);
  setText(dispatchOpen, open.length);
  setText(dispatchClaimedTotal, claimed.length);
  setText(dispatchActive, active.length);
  setText(dispatchNewCount, open.length);
  setText(dispatchClaimedCount, claimed.length);
  setText(dispatchActiveCount, active.length);
  setText(dispatchVisibleSummary, `${filtered.length} of ${jobs.length} records visible`);
  setText(dispatchStatusCopy, `${open.length} awaiting review, ${claimed.length} claimed or scheduled, and ${active.length} active or completed.`);
  setBusy(false);
}

function renderError(error) {
  const message = error?.message || "Firestore error";
  const html = emptyMarkup("Unable to load dispatch", message);

  COLUMN_KEYS.forEach((key) => columnCache.delete(key));
  [dispatchNew, dispatchClaimed, dispatchActiveList].forEach((element) => {
    if (element) element.innerHTML = html;
  });

  setConnectionState("error", "The dispatch board could not load. Use Refresh to try again.");
  setText(dispatchVisibleSummary, "Dispatch unavailable");
  setBusy(false);
}

async function loadJobs({ showSkeleton = !hasLoaded } = {}) {
  if (showSkeleton) renderLoadingState();
  else {
    setRefreshBusy(true);
    setConnectionState("loading", "Refreshing the dispatch queue.");
  }

  try {
    const snap = await getDocs(collection(db, "jobs"));

    jobs = snap.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));
    jobs.sort((a, b) => timestampSeconds(b.createdAt) - timestampSeconds(a.createdAt));

    populateCompanyFilter(jobs);
    hasLoaded = true;
    setConnectionState("connected", "Dispatch is synchronized with the latest available job records.");
    renderBoard({ force: true });
  } catch (error) {
    console.error("Dispatch load failed:", error);
    renderError(error);
  } finally {
    setRefreshBusy(false);
  }
}

async function updateJob(jobId, payload = {}) {
  await updateDoc(doc(db, "jobs", jobId), {
    ...payload,
    updatedAt: serverTimestamp()
  });

  await loadJobs({ showSkeleton: false });
}

async function claimJob(jobId) {
  const actor = actorSnapshot();

  await updateJob(jobId, {
    status: "claimed",
    companyClaimed: true,
    staffClaimed: true,
    companyClaimedBy: actor.uid,
    staffClaimedBy: actor.uid,
    assignedStaffName: actor.name,
    claimedAt: serverTimestamp()
  });
}

async function startJob(jobId) {
  await updateJob(jobId, {
    status: "in_progress",
    startedAt: serverTimestamp()
  });
}

async function completeJob(jobId) {
  await updateJob(jobId, {
    status: "completed",
    completedAt: serverTimestamp()
  });
}

function scheduleRender() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchTimer = null;
    renderBoard();
  }, SEARCH_DEBOUNCE_MS);
}

function clearFilters() {
  if (dispatchSearch) dispatchSearch.value = "";
  if (dispatchCompanyFilter) dispatchCompanyFilter.value = "all";
  if (dispatchStatusFilter) dispatchStatusFilter.value = "all";
  renderBoard({ force: true });
  dispatchSearch?.focus();
}

async function handleBoardAction(event) {
  const claim = event.target.closest("[data-claim]");
  const start = event.target.closest("[data-start]");
  const complete = event.target.closest("[data-complete]");
  const button = claim || start || complete;

  if (!button || !dispatchBoard?.contains(button)) return;

  const jobId = claim?.getAttribute("data-claim") || start?.getAttribute("data-start") || complete?.getAttribute("data-complete");
  const job = jobs.find((item) => String(item.id) === String(jobId));
  const actionLabel = claim ? "Claiming…" : start ? "Starting…" : "Completing…";

  setActionBusy(button, true, actionLabel);

  try {
    if (claim) await claimJob(jobId);
    else if (start) await startJob(jobId);
    else await completeJob(jobId);

    const verb = claim ? "claimed" : start ? "started" : "completed";
    notify("Dispatch updated", `${job?.customerName || job?.title || "Job"} was ${verb}.`, "success");
  } catch (error) {
    console.error("Dispatch action failed:", error);
    setConnectionState("error", "The last dispatch action failed. The board was not changed.");
    notify("Dispatch update failed", error?.message || "The record could not be updated.", "error");
  } finally {
    setActionBusy(button, false);
  }
}

function bindEvents() {
  if (hasBoundEvents) return;
  hasBoundEvents = true;

  dispatchSearch?.addEventListener("input", scheduleRender);
  dispatchCompanyFilter?.addEventListener("change", () => renderBoard({ force: true }));
  dispatchStatusFilter?.addEventListener("change", () => renderBoard({ force: true }));
  dispatchClearFilters?.addEventListener("click", clearFilters);
  dispatchRefresh?.addEventListener("click", () => loadJobs({ showSkeleton: false }));
  dispatchBoard?.addEventListener("click", handleBoardAction);

  window.addEventListener("pagehide", () => {
    if (searchTimer) clearTimeout(searchTimer);
  }, { once: true });
}

function init() {
  if (hasStartedAuthWatch) return;
  hasStartedAuthWatch = true;

  bindEvents();

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      navigateWithLoader("/login.html", {
        title: "Returning to login",
        subtitle: "Your session is not active."
      });
      return;
    }

    await loadJobs();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
