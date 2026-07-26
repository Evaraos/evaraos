import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  writeBatch,
  getSavedUserProfile,
  serverTimestamp
} from "./firebase.js";

const listEl = document.getElementById("applicationsList");
const searchEl = document.getElementById("applicationsSearch");
const statusFilterEl = document.getElementById("applicationsStatusFilter");
const refreshBtn = document.getElementById("applicationsRefreshBtn");
const appsTotal = document.getElementById("appsTotal");
const appsPending = document.getElementById("appsPending");
const appsApproved = document.getElementById("appsApproved");

const PLATFORM_REVIEWER_ROLES = new Set(["platform_admin", "owner", "super_admin"]);
const ASSIGNABLE_STAFF_ROLES = new Set([
  "sales",
  "sales_rep",
  "lead_generator",
  "sales_manager",
  "technician",
  "lead_technician",
  "cleaner",
  "lead_cleaner",
  "staff",
  "field_staff",
  "crew_lead",
  "dispatcher",
  "operations_coordinator",
  "field_manager",
  "quality_control",
  "customer_support",
  "hr"
]);

const ROLE_LABELS = Object.freeze({
  sales: "Sales Representative",
  sales_rep: "Sales Representative",
  lead_generator: "Lead Generator",
  sales_manager: "Sales Manager",
  technician: "Technician",
  lead_technician: "Lead Technician",
  cleaner: "Cleaner",
  lead_cleaner: "Lead Cleaner",
  staff: "General Staff",
  field_staff: "Field Staff",
  crew_lead: "Crew Lead",
  dispatcher: "Dispatcher",
  operations_coordinator: "Operations Coordinator",
  field_manager: "Field Manager",
  quality_control: "Quality Control",
  customer_support: "Customer Support",
  hr: "Human Resources"
});

let applications = [];
let currentUser = null;
let currentProfile = null;

function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalize(value = "") {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function actorSnapshot() {
  const profile = currentProfile || getSavedUserProfile() || {};
  const user = currentUser || auth.currentUser || {};
  return {
    uid: String(user.uid || profile.uid || ""),
    email: String(user.email || profile.email || ""),
    name: String(profile.displayName || profile.fullName || profile.name || user.displayName || user.email || "Unknown Reviewer")
  };
}

function reviewerCanApprove(profile = currentProfile || {}) {
  const role = normalize(profile.role);
  return PLATFORM_REVIEWER_ROLES.has(role) || (role === "admin" && profile.platformAccess === true);
}

function roleAllowed(role = "") {
  return ASSIGNABLE_STAFF_ROLES.has(normalize(role));
}

function displayRole(role = "") {
  const normalized = normalize(role);
  return ROLE_LABELS[normalized] || String(role || "Staff");
}

function statusClass(status = "") {
  const value = normalize(status);
  if (value === "approved") return "success";
  if (value === "rejected") return "error";
  return "warning";
}

function renderAccessDenied() {
  if (!listEl) return;
  listEl.innerHTML = `
    <div class="empty-card">
      <h3>Platform approval access required</h3>
      <p>Only a platform administrator, owner, super administrator, or an admin with platform access can review and approve staff applications.</p>
    </div>
  `;
  [searchEl, statusFilterEl, refreshBtn].forEach((node) => {
    if (node) node.disabled = true;
  });
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
  if (appsPending) appsPending.textContent = String(applications.filter((app) => ["submitted", "needs_more_info"].includes(normalize(app.status))).length);
  if (appsApproved) appsApproved.textContent = String(applications.filter((app) => normalize(app.status) === "approved").length);
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
  const disabled = status === "approved" || status === "rejected" ? "disabled" : "";
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
          <span class="pill">${escapeHtml(displayRole(app.roleRequested))}</span>
          ${app.profilePhotoUploaded ? `<span class="pill success">Photo Added</span>` : ""}
        </div>
      </div>
      <div class="application-details">
        <div class="detail-box"><strong>Desired Company</strong><span>${escapeHtml(app.desiredCompany || "Not set")}</span></div>
        <div class="detail-box"><strong>Market</strong><span>${escapeHtml(app.desiredMarket || `${app.city || ""} ${app.state || ""}`.trim() || "Not set")}</span></div>
        <div class="detail-box"><strong>Address</strong><span>${escapeHtml([app.address, app.city, app.state, app.zip].filter(Boolean).join(", "))}</span></div>
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
        <select data-company-choice="${id}" ${disabled}>
          <option value="">Select company assignment</option>
          <option value="supreme-true-clean|Supreme True Clean">Supreme True Clean</option>
          <option value="oneofone-cleaning|OneofOne Cleaning">OneofOne Cleaning</option>
          <option value="evaraos|Evaraos Inc">Evaraos Inc</option>
        </select>
        <textarea data-review-notes="${id}" placeholder="Review notes, verification result, missing info..." ${disabled}></textarea>
        <button type="button" class="btn btn-theme-primary beam-target" data-approve="${id}" ${disabled}>Approve</button>
        <button type="button" class="btn btn-theme-secondary beam-target" data-more-info="${id}" ${disabled}>More Info</button>
        <button type="button" class="btn btn-theme-secondary beam-target" data-reject="${id}" ${disabled}>Reject</button>
      </div>
    </article>
  `;
}

function renderApplications() {
  renderStats();
  if (!listEl) return;
  const rows = filteredApplications();
  if (!rows.length) {
    listEl.innerHTML = `<div class="empty-card"><h3>No applications yet</h3><p>Staff can apply directly from the Apply as Staff page. New submissions will appear here for review and approval.</p></div>`;
    return;
  }
  listEl.innerHTML = rows.map(renderApplicationCard).join("");
}

async function loadApplications() {
  if (!reviewerCanApprove()) {
    renderAccessDenied();
    return;
  }
  if (refreshBtn) refreshBtn.textContent = "Refreshing...";
  try {
    const snap = await getDocs(collection(db, "staff_applications"));
    applications = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
    applications.sort((a, b) => Number(b.submittedAt?.seconds || 0) - Number(a.submittedAt?.seconds || 0));
    renderApplications();
  } catch (error) {
    console.error("Failed to load applications:", error);
    if (listEl) listEl.innerHTML = `<div class="empty-card"><h3>Unable to load applications</h3><p>${escapeHtml(error.message || "Firestore error")}</p></div>`;
  } finally {
    if (refreshBtn) refreshBtn.textContent = "Refresh";
  }
}

function getApplication(id) {
  return applications.find((app) => String(app.id) === String(id));
}

function companySelection(id) {
  const raw = document.querySelector(`[data-company-choice="${CSS.escape(id)}"]`)?.value || "";
  if (!raw) return { companyId: "", companyName: "" };
  const [companyId, companyName] = raw.split("|");
  return { companyId: String(companyId || ""), companyName: String(companyName || companyId || "") };
}

function reviewNotes(id) {
  return String(document.querySelector(`[data-review-notes="${CSS.escape(id)}"]`)?.value || "").trim();
}

function reviewPayload(id, status, verificationStatus, actor) {
  const payload = {
    status,
    verificationStatus,
    reviewNotes: reviewNotes(id),
    reviewedAt: serverTimestamp(),
    reviewedBy: actor.uid,
    reviewedByEmail: actor.email,
    reviewedByName: actor.name,
    updatedAt: serverTimestamp()
  };
  if (status === "approved") {
    Object.assign(payload, {
      approvedAt: serverTimestamp(),
      approvedBy: actor.uid,
      approvedByEmail: actor.email,
      approvedByName: actor.name
    });
  }
  if (status === "rejected") {
    Object.assign(payload, {
      rejectedAt: serverTimestamp(),
      rejectedBy: actor.uid,
      rejectedByEmail: actor.email,
      rejectedByName: actor.name
    });
  }
  return payload;
}

function userPromotionPayload(app, company, actor, id) {
  return {
    role: normalize(app.roleRequested),
    status: "active",
    approvalStatus: "approved",
    companyId: company.companyId,
    companyName: company.companyName,
    companySlug: company.companyId,
    companyCategory: "staff",
    staffApplicationId: id,
    approvedAt: serverTimestamp(),
    approvedBy: actor.uid,
    approvedByEmail: actor.email,
    approvedByName: actor.name,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
    updatedByEmail: actor.email,
    updatedByName: actor.name
  };
}

function buildStaffProfile(app, company, actor, id) {
  return {
    uid: app.applicantUid,
    userId: app.applicantUid,
    email: app.applicantEmail || "",
    fullName: app.fullName || "",
    phone: app.phone || "",
    role: normalize(app.roleRequested),
    companyId: company.companyId,
    companyName: company.companyName,
    market: app.desiredMarket || app.preferredCity || "",
    status: "active",
    approvalStatus: "approved",
    employmentType: app.employmentType || "",
    availability: app.availability || app.preferredSchedule || "",
    earliestStartDate: app.earliestStartDate || "",
    payExpectation: app.payExpectation || "",
    hasDriversLicense: app.hasDriversLicense || "",
    driversLicenseState: app.driversLicenseState || "",
    hasReliableTransportation: app.hasReliableTransportation || "",
    equipmentExperience: app.equipmentExperience || "",
    profilePhotoURL: (app.attachments || []).find((file) => file.kind === "profile_photo")?.downloadURL || "",
    applicationId: id,
    attachments: Array.isArray(app.attachments) ? app.attachments : [],
    onboardingStage: "approved_pending_setup",
    onboardingTasks: {
      reviewPolicies: false,
      completeTaxDocs: false,
      completeTraining: false,
      receiveAssignment: false,
      activatePayouts: false
    },
    approvedAt: serverTimestamp(),
    approvedBy: actor.uid,
    approvedByEmail: actor.email,
    approvedByName: actor.name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
}

async function approveApplication(id) {
  if (!reviewerCanApprove()) return alert("Platform approval access is required.");
  const cached = getApplication(id);
  if (!cached) return alert("Application not found. Refresh and try again.");
  const role = normalize(cached.roleRequested);
  if (!roleAllowed(role)) return alert("This requested role is not allowed for staff approval.");
  const company = companySelection(id);
  if (!company.companyId) return alert("Select a company assignment before approving this applicant.");
  const confirmed = window.confirm(`Approve ${cached.fullName || cached.applicantEmail} as ${displayRole(role)} for ${company.companyName}?`);
  if (!confirmed) return;

  const button = document.querySelector(`[data-approve="${CSS.escape(id)}"]`);
  if (button) {
    button.disabled = true;
    button.textContent = "Approving...";
  }

  try {
    const applicationRef = doc(db, "staff_applications", id);
    const applicationSnapshot = await getDoc(applicationRef);
    if (!applicationSnapshot.exists()) throw new Error("Application no longer exists.");
    const app = { id: applicationSnapshot.id, ...applicationSnapshot.data() };
    if (app.applicantUid !== id) throw new Error("Application identity does not match the applicant account.");
    if (!["submitted", "needs_more_info"].includes(normalize(app.status))) throw new Error("This application is no longer eligible for approval.");
    if (!roleAllowed(app.roleRequested)) throw new Error("The requested role is not approved for staff onboarding.");

    const userRef = doc(db, "users", id);
    const userSnapshot = await getDoc(userRef);
    if (!userSnapshot.exists()) throw new Error("The applicant user profile is missing.");

    const actor = actorSnapshot();
    const batch = writeBatch(db);
    batch.update(applicationRef, reviewPayload(id, "approved", "verified", actor));
    batch.update(userRef, userPromotionPayload(app, company, actor, id));
    batch.set(doc(db, "staff_profiles", id), buildStaffProfile(app, company, actor, id), { merge: true });
    await batch.commit();
    await loadApplications();
  } catch (error) {
    console.error("Approval failed:", error);
    alert(error.message || "Approval failed.");
    if (button) {
      button.disabled = false;
      button.textContent = "Approve";
    }
  }
}

async function updateApplicationReview(id, status, verificationStatus) {
  if (!reviewerCanApprove()) throw new Error("Platform approval access is required.");
  const actor = actorSnapshot();
  await updateDoc(doc(db, "staff_applications", id), reviewPayload(id, status, verificationStatus, actor));
}

async function moreInfoApplication(id) {
  try {
    await updateApplicationReview(id, "needs_more_info", "needs_more_info");
    await loadApplications();
  } catch (error) {
    console.error("More info update failed:", error);
    alert(error.message || "Could not request more info.");
  }
}

async function rejectApplication(id) {
  const confirmed = window.confirm("Reject this staff application?");
  if (!confirmed) return;
  try {
    await updateApplicationReview(id, "rejected", "rejected");
    await loadApplications();
  } catch (error) {
    console.error("Reject failed:", error);
    alert(error.message || "Could not reject application.");
  }
}

function bindEvents() {
  document.getElementById("createStaffInviteBtn")?.remove();
  searchEl?.addEventListener("input", renderApplications);
  statusFilterEl?.addEventListener("change", renderApplications);
  refreshBtn?.addEventListener("click", loadApplications);
  listEl?.addEventListener("click", (event) => {
    const approve = event.target.closest("[data-approve]");
    const moreInfo = event.target.closest("[data-more-info]");
    const reject = event.target.closest("[data-reject]");
    if (approve) return approveApplication(approve.getAttribute("data-approve"));
    if (moreInfo) return moreInfoApplication(moreInfo.getAttribute("data-more-info"));
    if (reject) return rejectApplication(reject.getAttribute("data-reject"));
  });
}

function init() {
  bindEvents();
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.assign("/login.html");
      return;
    }
    currentUser = user;
    currentProfile = getSavedUserProfile() || {};
    if (!reviewerCanApprove(currentProfile)) {
      renderAccessDenied();
      return;
    }
    await loadApplications();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
