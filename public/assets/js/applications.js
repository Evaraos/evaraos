import {
  auth,
  db,
  functions,
  onAuthStateChanged,
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  httpsCallable
} from "./firebase.js";

const listEl = document.getElementById("applicationsList");
const searchEl = document.getElementById("applicationsSearch");
const statusFilterEl = document.getElementById("applicationsStatusFilter");
const refreshBtn = document.getElementById("applicationsRefreshBtn");
const appsTotal = document.getElementById("appsTotal");
const appsPending = document.getElementById("appsPending");
const appsApproved = document.getElementById("appsApproved");

const REVIEWER_ROLES = new Set([
  "owner",
  "super_admin",
  "admin",
  "manager",
  "operations_manager",
  "operations_coordinator",
  "hr",
  "hr_manager"
]);

const PLATFORM_ROLES = new Set(["owner", "super_admin"]);

const STAFF_ROLES = [
  ["quality_control", "Quality Control"],
  ["sales", "Sales"],
  ["sales_rep", "Sales Representative"],
  ["technician", "Technician"],
  ["lead_technician", "Lead Technician"],
  ["cleaner", "Cleaner"],
  ["lead_cleaner", "Lead Cleaner"],
  ["staff", "General Staff"],
  ["field_staff", "Field Staff"],
  ["crew_lead", "Crew Lead"]
];

const reviewStaffApplication = httpsCallable(functions, "reviewStaffApplication");

let applications = [];
let companies = [];
let currentUser = null;
let currentProfile = null;
let reviewInFlight = false;

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

function isPlatformReviewer(profile = {}) {
  return PLATFORM_ROLES.has(normalize(profile.role));
}

function canReview(profile = {}) {
  const role = normalize(profile.role);
  return REVIEWER_ROLES.has(role)
    && ["active", "approved"].includes(normalize(profile.status))
    && normalize(profile.approvalStatus) === "approved";
}

function roleLabel(role = "") {
  const normalized = normalize(role);
  return STAFF_ROLES.find(([value]) => value === normalized)?.[1] || role || "Staff";
}

function roleOptions(selected = "") {
  const active = normalize(selected || "staff");
  return STAFF_ROLES.map(([value, label]) => (
    `<option value="${escapeHtml(value)}" ${value === active ? "selected" : ""}>${escapeHtml(label)}</option>`
  )).join("");
}

function companyOptions(selected = "") {
  const active = String(selected || "");
  const options = [`<option value="">Select company</option>`];
  companies.forEach((company) => {
    const id = String(company.id || "");
    const name = String(company.name || company.companyName || id);
    options.push(`<option value="${escapeHtml(id)}" ${id === active ? "selected" : ""}>${escapeHtml(name)}</option>`);
  });
  return options.join("");
}

function statusClass(status = "") {
  const value = normalize(status);
  if (value === "approved") return "success";
  if (value === "rejected") return "error";
  return "warning";
}

function filteredApplications() {
  const term = normalize(searchEl?.value || "");
  const filter = normalize(statusFilterEl?.value || "all");
  return applications.filter((app) => {
    const statusMatch = filter === "all" || normalize(app.status) === filter;
    const textMatch = !term || [
      app.fullName,
      app.applicantEmail,
      app.roleRequested,
      app.desiredCompany,
      app.desiredMarket,
      app.phone,
      app.city,
      app.state,
      app.status,
      app.verificationStatus,
      app.preferredSchedule,
      app.equipmentExperience,
      app.backgroundConsent
    ].some((value) => normalize(value).includes(term));
    return statusMatch && textMatch;
  });
}

function renderStats() {
  if (appsTotal) appsTotal.textContent = String(applications.length);
  if (appsPending) {
    appsPending.textContent = String(applications.filter((app) => ["submitted", "needs_more_info"].includes(normalize(app.status))).length);
  }
  if (appsApproved) {
    appsApproved.textContent = String(applications.filter((app) => normalize(app.status) === "approved").length);
  }
}

function renderAttachments(app = {}) {
  const attachments = Array.isArray(app.attachments) ? app.attachments : [];
  if (!attachments.length) return `<span class="pill error">No attachments</span>`;
  return attachments.map((file) => {
    const label = escapeHtml(file.kind || file.name || "attachment");
    const url = escapeHtml(file.downloadURL || "#");
    return `<a class="pill" href="${url}" target="_blank" rel="noopener noreferrer">Open ${label}</a>`;
  }).join("");
}

function renderApplicationCard(app = {}) {
  const id = escapeHtml(app.id || app.applicantUid || "");
  const status = normalize(app.status || "submitted");
  const verification = normalize(app.verificationStatus || "pending_review");
  const finalized = ["approved", "rejected"].includes(status);
  const selectedRole = normalize(app.finalRole || app.approvedRole || app.roleRequested || "staff");
  const selectedCompany = String(app.companyId || "");

  return `
    <article class="application-card glass-card aurora-card active-glow beam-target" data-application-id="${id}">
      <div class="application-card-head">
        <div>
          <h3>${escapeHtml(app.fullName || "Unnamed Applicant")}</h3>
          <p class="muted">${escapeHtml(app.applicantEmail || "No email")} • ${escapeHtml(app.phone || "No phone")}</p>
        </div>
        <div class="pill-row">
          <span class="pill ${statusClass(status)}">${escapeHtml(status.replaceAll("_", " "))}</span>
          <span class="pill ${statusClass(verification)}">Verification: ${escapeHtml(verification.replaceAll("_", " "))}</span>
          <span class="pill">${escapeHtml(roleLabel(selectedRole))}</span>
        </div>
      </div>

      <div class="application-details">
        <div class="detail-box"><strong>Desired Company</strong><span>${escapeHtml(app.desiredCompany || "Not set")}</span></div>
        <div class="detail-box"><strong>Market</strong><span>${escapeHtml(app.desiredMarket || `${app.city || ""} ${app.state || ""}`.trim() || "Not set")}</span></div>
        <div class="detail-box"><strong>Address</strong><span>${escapeHtml([app.address, app.city, app.state, app.zip].filter(Boolean).join(", ") || "Not set")}</span></div>
        <div class="detail-box"><strong>Work Auth</strong><span>${escapeHtml(app.workAuthorization || "Not set")}</span></div>
        <div class="detail-box"><strong>Driver / Transport</strong><span>${escapeHtml(`DL: ${app.hasDriversLicense || "?"} • Transport: ${app.hasReliableTransportation || "?"}`)}</span></div>
        <div class="detail-box"><strong>Availability</strong><span>${escapeHtml(app.availability || app.preferredSchedule || "Not set")}</span></div>
        <div class="detail-box"><strong>Employment Type</strong><span>${escapeHtml(app.employmentType || "Not set")}</span></div>
        <div class="detail-box"><strong>Start Date</strong><span>${escapeHtml(app.earliestStartDate || "Not set")}</span></div>
        <div class="detail-box"><strong>Pay Expectation</strong><span>${escapeHtml(app.payExpectation || "Not set")}</span></div>
      </div>

      <div class="detail-box"><strong>Experience</strong><span>${escapeHtml(app.experienceSummary || "No experience summary provided.")}</span></div>
      <div class="detail-box"><strong>Equipment / Background</strong><span>${escapeHtml(app.equipmentExperience || "No equipment info.")} ${app.backgroundConsent ? `• Background consent: ${escapeHtml(app.backgroundConsent)}` : ""}</span></div>
      <div class="attachment-row"><span class="pill">ID Type: ${escapeHtml(app.idDocumentType || "Not set")}</span>${renderAttachments(app)}</div>

      <div class="review-box">
        <select data-final-role-choice="${id}" aria-label="Final approved role" ${finalized ? "disabled" : ""}>${roleOptions(selectedRole)}</select>
        <select data-company-choice="${id}" aria-label="Assigned company" ${finalized ? "disabled" : ""}>${companyOptions(selectedCompany)}</select>
        <textarea data-review-notes="${id}" placeholder="Review notes, verification result, missing info..." ${finalized ? "disabled" : ""}>${escapeHtml(app.reviewNotes || "")}</textarea>
        <button type="button" class="btn btn-theme-primary beam-target" data-decision="approved" data-application-id="${id}" ${finalized ? "disabled" : ""}>Approve</button>
        <button type="button" class="btn btn-theme-secondary beam-target" data-decision="needs_more_info" data-application-id="${id}" ${finalized ? "disabled" : ""}>More Info</button>
        <button type="button" class="btn btn-theme-secondary beam-target" data-decision="rejected" data-application-id="${id}" ${finalized ? "disabled" : ""}>Reject</button>
      </div>
    </article>
  `;
}

function renderApplications() {
  renderStats();
  const rows = filteredApplications();
  if (!listEl) return;
  if (!rows.length) {
    listEl.innerHTML = `<div class="empty-card"><h3>No applications yet</h3><p>New staff submissions will appear here for review.</p></div>`;
    return;
  }
  listEl.innerHTML = rows.map(renderApplicationCard).join("");
}

async function loadReviewerProfile(user) {
  const snapshot = await getDoc(doc(db, "users", user.uid));
  if (!snapshot.exists()) throw new Error("Reviewer profile not found.");
  currentProfile = { id: snapshot.id, ...snapshot.data() };
  if (!canReview(currentProfile)) throw new Error("This account is not authorized to review staff applications.");
}

async function loadCompanies() {
  companies = [];
  if (isPlatformReviewer(currentProfile)) {
    const snapshot = await getDocs(collection(db, "companies"));
    companies = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  } else if (currentProfile?.companyId) {
    const snapshot = await getDoc(doc(db, "companies", currentProfile.companyId));
    if (snapshot.exists()) companies = [{ id: snapshot.id, ...snapshot.data() }];
  }
  companies.sort((a, b) => String(a.name || a.companyName || a.id).localeCompare(String(b.name || b.companyName || b.id)));
}

async function loadApplications() {
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.textContent = "Refreshing...";
  }
  try {
    const applicationsRef = collection(db, "staff_applications");
    const platformScope = isPlatformReviewer(currentProfile);
    const companyId = String(currentProfile?.companyId || "").trim();
    if (!platformScope && !companyId) {
      throw new Error("A company assignment is required to review staff applications.");
    }

    const applicationsQuery = platformScope
      ? applicationsRef
      : query(applicationsRef, where("companyId", "==", companyId));
    const snapshot = await getDocs(applicationsQuery);
    applications = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    applications.sort((a, b) => Number(b.submittedAt?.seconds || b.createdAt?.seconds || 0) - Number(a.submittedAt?.seconds || a.createdAt?.seconds || 0));
    renderApplications();
  } catch (error) {
    console.error("Failed to load applications:", error);
    if (listEl) listEl.innerHTML = `<div class="empty-card"><h3>Unable to load applications</h3><p>${escapeHtml(error.message || "Firestore error")}</p></div>`;
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = "Refresh";
    }
  }
}

function formValue(selector) {
  return String(document.querySelector(selector)?.value || "").trim();
}

function friendlyFunctionError(error) {
  const code = String(error?.code || "").replace(/^functions\//, "");
  if (code === "permission-denied") return "Your account is not authorized to review this application.";
  if (code === "failed-precondition") return error?.message || "This application cannot be reviewed in its current state.";
  if (code === "invalid-argument") return error?.message || "Review selections are invalid.";
  if (code === "unauthenticated") return "Your session expired. Sign in again.";
  return error?.message || "The review could not be completed.";
}

async function submitDecision(button) {
  if (reviewInFlight) return;
  const applicationId = String(button.dataset.applicationId || "");
  const decision = normalize(button.dataset.decision);
  const app = applications.find((item) => String(item.id) === applicationId);
  if (!app) return alert("Application not found. Refresh and try again.");

  const finalRole = formValue(`[data-final-role-choice="${CSS.escape(applicationId)}"]`);
  const companyId = formValue(`[data-company-choice="${CSS.escape(applicationId)}"]`);
  const company = companies.find((item) => String(item.id) === companyId);
  const reviewNotes = formValue(`[data-review-notes="${CSS.escape(applicationId)}"]`);

  if (decision === "approved" && !companyId) return alert("Select a company before approving this applicant.");
  if (decision === "approved" && !STAFF_ROLES.some(([role]) => role === normalize(finalRole))) return alert("Select a valid final role.");

  const actionText = decision === "approved" ? `approve ${app.fullName || app.applicantEmail} as ${roleLabel(finalRole)}` : `${decision.replaceAll("_", " ")} for ${app.fullName || app.applicantEmail}`;
  if (!window.confirm(`Confirm: ${actionText}?`)) return;

  reviewInFlight = true;
  const buttons = listEl?.querySelectorAll("[data-decision]") || [];
  buttons.forEach((node) => { node.disabled = true; });
  const originalText = button.textContent;
  button.textContent = "Saving...";

  try {
    await reviewStaffApplication({
      applicationId,
      decision,
      reviewNotes,
      companyId: decision === "approved" ? companyId : "",
      companyName: decision === "approved" ? String(company?.name || company?.companyName || companyId) : "",
      finalRole: decision === "approved" ? normalize(finalRole) : ""
    });
    await currentUser.getIdToken(true);
    await loadApplications();
  } catch (error) {
    console.error("Staff review failed:", error);
    alert(friendlyFunctionError(error));
  } finally {
    reviewInFlight = false;
    button.textContent = originalText;
    buttons.forEach((node) => { node.disabled = false; });
    renderApplications();
  }
}

function bindEvents() {
  document.getElementById("createStaffInviteBtn")?.remove();
  searchEl?.addEventListener("input", renderApplications);
  statusFilterEl?.addEventListener("change", renderApplications);
  refreshBtn?.addEventListener("click", loadApplications);
  listEl?.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-decision]");
    if (button) submitDecision(button);
  });
}

async function initialize(user) {
  currentUser = user;
  try {
    await loadReviewerProfile(user);
    await loadCompanies();
    await loadApplications();
  } catch (error) {
    console.error("Applications initialization failed:", error);
    if (listEl) listEl.innerHTML = `<div class="empty-card"><h3>Applications unavailable</h3><p>${escapeHtml(error.message || "Authorization failed")}</p></div>`;
  }
}

function init() {
  bindEvents();
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.assign("/login.html");
      return;
    }
    initialize(user);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
