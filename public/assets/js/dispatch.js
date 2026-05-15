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

const dispatchNew = document.getElementById("dispatchNew");
const dispatchClaimed = document.getElementById("dispatchClaimed");
const dispatchActiveList = document.getElementById("dispatchActiveList");
const dispatchSearch = document.getElementById("dispatchSearch");
const dispatchCompanyFilter = document.getElementById("dispatchCompanyFilter");
const dispatchRefresh = document.getElementById("dispatchRefresh");
const dispatchTotal = document.getElementById("dispatchTotal");
const dispatchOpen = document.getElementById("dispatchOpen");
const dispatchActive = document.getElementById("dispatchActive");

let jobs = [];

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

function actorSnapshot() {
  const profile = getSavedUserProfile() || {};
  const user = auth.currentUser || {};

  return {
    uid: user.uid || profile.uid || "",
    name: profile.displayName || profile.fullName || profile.name || user.displayName || user.email || "Dispatcher"
  };
}

function cardMarkup(job = {}) {
  const status = normalize(job.status || "new");

  return `
    <article class="dispatch-card glass-card aurora-card beam-target" data-job-id="${escapeHtml(job.id || "")}">
      <h3>${escapeHtml(job.customerName || job.title || "Untitled Job")}</h3>
      <p>${escapeHtml(job.service || job.serviceType || "Service pending")} • ${escapeHtml(job.city || job.market || "Unknown market")}</p>

      <div class="dispatch-meta">
        <span class="dispatch-pill ${status === "completed" ? "go" : status === "in_progress" ? "hot" : ""}">${escapeHtml(status.replaceAll("_", " "))}</span>
        <span class="dispatch-pill">${escapeHtml(job.companyName || "No company")}</span>
        ${job.assignedStaffName ? `<span class="dispatch-pill go">${escapeHtml(job.assignedStaffName)}</span>` : ""}
      </div>

      <div class="dispatch-actions">
        ${status === "new" || status === "dispatch_review" ? `<button class="btn btn-theme-primary beam-target" data-claim="${escapeHtml(job.id || "")}">Claim</button>` : ""}
        ${status === "claimed" || status === "scheduled" ? `<button class="btn btn-theme-secondary beam-target" data-start="${escapeHtml(job.id || "")}">Start</button>` : ""}
        ${status === "in_progress" ? `<button class="btn btn-theme-primary beam-target" data-complete="${escapeHtml(job.id || "")}">Complete</button>` : ""}
      </div>
    </article>
  `;
}

function applyFilters(items = []) {
  const term = normalize(dispatchSearch?.value || "");
  const company = normalize(dispatchCompanyFilter?.value || "all");

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
      job.status
    ].some((value) => normalize(value).includes(term));

    const companyMatch = company === "all" || normalize(job.companyId) === company;

    return textMatch && companyMatch;
  });
}

function renderColumn(element, rows = []) {
  if (!element) return;

  if (!rows.length) {
    element.innerHTML = `<div class="empty-card">No matching dispatch records.</div>`;
    return;
  }

  element.innerHTML = rows.map(cardMarkup).join("");
}

function renderBoard() {
  const filtered = applyFilters(jobs);

  const open = filtered.filter((job) => ["new", "dispatch_review"].includes(normalize(job.status)));
  const claimed = filtered.filter((job) => ["claimed", "scheduled"].includes(normalize(job.status)));
  const active = filtered.filter((job) => ["in_progress", "completed"].includes(normalize(job.status)));

  renderColumn(dispatchNew, open);
  renderColumn(dispatchClaimed, claimed);
  renderColumn(dispatchActiveList, active);

  dispatchTotal.textContent = String(filtered.length);
  dispatchOpen.textContent = String(open.length);
  dispatchActive.textContent = String(active.length + claimed.length);
}

async function loadJobs() {
  dispatchRefresh.textContent = "Refreshing...";

  try {
    const snap = await getDocs(collection(db, "jobs"));

    jobs = snap.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    jobs.sort((a, b) => Number(b.createdAt?.seconds || 0) - Number(a.createdAt?.seconds || 0));

    renderBoard();
  } catch (error) {
    console.error("Dispatch load failed:", error);

    dispatchNew.innerHTML = `
      <div class="empty-card">
        Unable to load dispatch queue.<br /><br />${escapeHtml(error.message || "Firestore error")}
      </div>
    `;
  } finally {
    dispatchRefresh.textContent = "Refresh";
  }
}

async function updateJob(jobId, payload = {}) {
  await updateDoc(doc(db, "jobs", jobId), {
    ...payload,
    updatedAt: serverTimestamp()
  });

  await loadJobs();
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

function bindEvents() {
  dispatchSearch?.addEventListener("input", renderBoard);
  dispatchCompanyFilter?.addEventListener("change", renderBoard);
  dispatchRefresh?.addEventListener("click", loadJobs);

  document.addEventListener("click", async (event) => {
    const claim = event.target.closest("[data-claim]");
    const start = event.target.closest("[data-start]");
    const complete = event.target.closest("[data-complete]");

    try {
      if (claim) return claimJob(claim.getAttribute("data-claim"));
      if (start) return startJob(start.getAttribute("data-start"));
      if (complete) return completeJob(complete.getAttribute("data-complete"));
    } catch (error) {
      console.error("Dispatch action failed:", error);
      alert(error.message || "Dispatch update failed.");
    }
  });
}

function init() {
  bindEvents();

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.assign("/login.html");
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
