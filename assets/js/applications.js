import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
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
  return String(value || "").trim().toLowerCase();
}

function actorSnapshot() {
  const profile = currentProfile || getSavedUserProfile() || {};
  const user = currentUser || auth.currentUser || {};

  return {
    uid: user.uid || profile.uid || "",
    email: user.email || profile.email || "",
    name: profile.displayName || profile.fullName || profile.name || user.displayName || user.email || "Unknown Reviewer"
  };
}

function roleAllowed(role = "") {
  return ["sales", "sales_rep", "technician", "cleaner", "staff", "field_staff", "crew_lead"].includes(normalize(role));
}

function statusClass(status = "") {
  const value = normalize(status);
  if (value === "approved") return "success";
  if (value === "rejected") return "error";
  if (value === "needs_more_info") return "warning";
  return "warning";
}

function displayRole(role = "") {
  const value = normalize(role);
  if (value === "sales_rep" || value === "sales") return "Sales Rep";
  if (value === "technician") return "Technician";
  if (value === "cleaner") return "Cleaner";
  if (value === "field_staff" || value === "staff") return "Field Staff";
  if (value === "crew_lead") return "Crew Lead";
  return role || "Staff";
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
  const disabled = status === "approved" ? "disabled" : "";

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

      <div class="detail-box">
        <strong>Experience</strong>
        <span>${escapeHtml(app.experienceSummary || "No experience summary provided.")}</span>
      </div>

      <div class="detail-box">
        <strong>Equipment / Background</strong>
        <span>${escapeHtml(app.equipmentExperience || "No equipment info.")} ${app.backgroundConsent ? `• Background consent: ${app.backgroundConsent}` : ""}</span>
      </div>

      <div class="attachment-row">
        <span class="pill">ID Type: ${escapeHtml(app.idDocumentType || "Not set")}</span>
        ${renderAttachments(app)}
      </div>

      <div class="review-box">
        <select data-company-choice="${id}">
          <option value="">No company assignment</option>
          <option value="supreme-true-clean|Supreme True Clean">Supreme True Clean</option>
          <option value="oneofone-cleaning|OneofOne Cleaning">OneofOne Cleaning</option>
          <option value="evaraos|Evaraos Inc">Evaraos Inc</option>
        </select>
        <textarea data-review-notes="${id}" placeholder="Review notes, verification result, missing info..."></textarea>
        <button type="button" class="btn btn-theme-primary beam-target" data-approve="${id}" ${disabled}>Approve</button>
        <button type="button" class="btn btn-theme-secondary beam-target" data-more-info="${id}" ${disabled}>More Info</button>
        <button type="button" class="btn btn-theme-secondary beam-target" data-reject="${id}" ${disabled}>Reject</button>
      </div>
    </article>
  `;
}

function renderApplications() {
  renderStats();
  const rows = filteredApplications();

  if (!listEl) return;

  if (!rows.length) {
    listEl.innerHTML = `
      <div class="empty-card">
        <h3>No applications yet</h3>
        <p>Staff can apply directly from the Apply as Staff page. New submissions will appear here for review and approval.</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = rows.map(renderApplicationCard).join("");
}

async function loadApplications() {
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
  return { companyId: companyId || "", companyName: companyName || companyId || "" };
}

function reviewNotes(id) {
  return String(document.querySelector(`[data-review-notes="${CSS.escape(id)}"]`)?.value || "").trim();
}

async function updateApplicationReview(id, status, verificationStatus) {
  const app = getApplication(id);
  if (!app) return;

  const actor = actorSnapshot();
  const nowPayload = {
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
    Object.assign(nowPayload, {
      approvedAt: serverTimestamp(),
      approvedBy: actor.uid,
      approvedByEmail: actor.email,
      approvedByName: actor.name
    });
  }

  if (status === "rejected") {
    Object.assign(nowPayload, {
      rejectedAt: serverTimestamp(),
      rejectedBy: actor.uid,
      rejectedByEmail: actor.email,
      rejectedByName: actor.name
    });
  }

  await updateDoc(doc(db, "staff_applications", id), nowPayload);
}

function buildStaffProfile(app = {}, company = {}, actor = {}) {
  return {
    uid: app.applicantUid,
    userId: app.applicantUid,
    email: app.applicantEmail || "",
    fullName: app.fullName || "",
    phone: app.phone || "",
    role: app.roleRequested,
    companyId: company.companyId || "",
    companyName: company.companyName || app.desiredCompany || "",
    market: app.desiredMarket || "",
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
    applicationId: app.id || app.applicantUid,
    attachments: app.attachments || [],
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
  const app = getApplication(id);
  if (!app) return;
  if (!roleAllowed(app.roleRequested)) return alert("This requested role is not allowed for staff approval.");

  const actor = actorSnapshot();
  const company = companySelection(id);
  const confirmed = window.confirm(`Approve ${app.fullName || app.applicantEmail} as ${displayRole(app.roleRequested)}?`);
  if (!confirmed) return;

  try {
    await updateApplicationReview(id, "approved", "verified");

    await updateDoc(doc(db, "users", app.applicantUid), {
      role: app.roleRequested,
      status: "active",
      approvalStatus: "approved",
      companyId: company.companyId,
      companyName: company.companyName || app.desiredCompany || "",
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
    });

    await setDoc(doc(db, "staff_profiles", app.applicantUid), buildStaffProfile(app, company, actor), { merge: true });

    await loadApplications();
  } catch (error) {
    console.error("Approval failed:", error);
    alert(error.message || "Approval failed.");
  }
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

function removeLegacyInviteButton() {
  document.getElementById("createStaffInviteBtn")?.remove();
}

function bindEvents() {
  removeLegacyInviteButton();
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
      window.location.assign("/evaraos/login.html");
      return;
    }

    currentUser = user;
    currentProfile = getSavedUserProfile() || {};
    await loadApplications();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
