import {
  auth,
  db,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  getSavedUserProfile
} from "./firebase.js";

const STAFF_ROLES = [
  ["hr", "HR"],
  ["hr_manager", "HR Manager"],
  ["operations_manager", "Operations Manager"],
  ["dispatcher", "Dispatcher"],
  ["field_manager", "Field Manager"],
  ["sales_manager", "Sales Manager"],
  ["customer_support", "Customer Support"],
  ["quality_control", "Quality Control"],
  ["sales_rep", "Sales Rep"],
  ["sales", "Sales"],
  ["technician", "Technician"],
  ["lead_technician", "Lead Technician"],
  ["cleaner", "Cleaner"],
  ["lead_cleaner", "Lead Cleaner"],
  ["field_staff", "Field Staff"],
  ["crew_lead", "Crew Lead"],
  ["staff", "General Staff"]
];

const COMPANY_OPTIONS = [
  ["", "No company assignment"],
  ["supreme-true-clean|Supreme True Clean", "Supreme True Clean"],
  ["oneofone-cleaning|OneofOne Cleaning", "OneofOne Cleaning"],
  ["evaraos|Evaraos Inc", "Evaraos Inc"]
];

function normalize(value = "") {
  return String(value || "").trim().toLowerCase();
}

function roleLabel(role = "") {
  const match = STAFF_ROLES.find(([value]) => value === normalize(role));
  return match?.[1] || role || "Staff";
}

function roleAllowed(role = "") {
  return STAFF_ROLES.some(([value]) => value === normalize(role));
}

function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function actorSnapshot() {
  const profile = getSavedUserProfile() || {};
  const user = auth.currentUser || {};
  return {
    uid: user.uid || profile.uid || "",
    email: user.email || profile.email || "",
    name: profile.displayName || profile.fullName || profile.name || user.displayName || user.email || "Unknown Reviewer"
  };
}

function roleOptions(selected = "") {
  const active = normalize(selected || "staff");
  return STAFF_ROLES.map(([value, label]) => `<option value="${escapeHtml(value)}" ${active === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
}

function companyOptions() {
  return COMPANY_OPTIONS.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("");
}

function enhanceReviewBox(card) {
  if (!card || card.dataset.hrEnhanced === "true") return;
  const id = card.dataset.applicationId;
  const reviewBox = card.querySelector(".review-box");
  if (!id || !reviewBox) return;

  const currentRoleText = card.querySelector(".pill-row .pill:nth-child(3)")?.textContent || "";
  const guessedRole = STAFF_ROLES.find(([, label]) => currentRoleText.toLowerCase().includes(label.toLowerCase()))?.[0] || "staff";

  if (!reviewBox.querySelector("[data-final-role-choice]")) {
    const roleSelect = document.createElement("select");
    roleSelect.dataset.finalRoleChoice = id;
    roleSelect.setAttribute("aria-label", "Final approved role");
    roleSelect.innerHTML = roleOptions(guessedRole);
    reviewBox.insertBefore(roleSelect, reviewBox.firstChild);
  }

  const companySelect = reviewBox.querySelector(`[data-company-choice="${CSS.escape(id)}"]`);
  if (companySelect && companySelect.options.length < COMPANY_OPTIONS.length) {
    companySelect.innerHTML = companyOptions();
  }

  card.dataset.hrEnhanced = "true";
}

function enhanceAllCards() {
  document.querySelectorAll(".application-card[data-application-id]").forEach(enhanceReviewBox);
}

function companySelection(id) {
  const raw = document.querySelector(`[data-company-choice="${CSS.escape(id)}"]`)?.value || "";
  if (!raw) return { companyId: "", companyName: "" };
  const [companyId, companyName] = raw.split("|");
  return { companyId: companyId || "", companyName: companyName || companyId || "" };
}

function finalRoleSelection(id, fallback = "staff") {
  const role = normalize(document.querySelector(`[data-final-role-choice="${CSS.escape(id)}"]`)?.value || fallback);
  return roleAllowed(role) ? role : "staff";
}

function reviewNotes(id) {
  return String(document.querySelector(`[data-review-notes="${CSS.escape(id)}"]`)?.value || "").trim();
}

async function loadApplication(id) {
  const snap = await getDoc(doc(db, "staff_applications", id));
  if (!snap.exists()) throw new Error("Application not found.");
  return { id: snap.id, ...snap.data() };
}

function buildStaffProfile(app, company, actor, finalRole) {
  return {
    uid: app.applicantUid,
    userId: app.applicantUid,
    email: app.applicantEmail || "",
    fullName: app.fullName || "",
    phone: app.phone || "",
    role: finalRole,
    requestedRole: app.roleRequested || "",
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

async function approveWithFinalRole(id) {
  const app = await loadApplication(id);
  const finalRole = finalRoleSelection(id, app.roleRequested);
  if (!roleAllowed(finalRole)) return alert("Select a valid final role before approving.");

  const company = companySelection(id);
  const actor = actorSnapshot();
  const confirmed = window.confirm(`Approve ${app.fullName || app.applicantEmail} as ${roleLabel(finalRole)}?`);
  if (!confirmed) return;

  await updateDoc(doc(db, "staff_applications", id), {
    status: "approved",
    verificationStatus: "verified",
    reviewNotes: reviewNotes(id),
    approvedRole: finalRole,
    finalRole,
    reviewedAt: serverTimestamp(),
    reviewedBy: actor.uid,
    reviewedByEmail: actor.email,
    reviewedByName: actor.name,
    approvedAt: serverTimestamp(),
    approvedBy: actor.uid,
    approvedByEmail: actor.email,
    approvedByName: actor.name,
    updatedAt: serverTimestamp()
  });

  await updateDoc(doc(db, "users", app.applicantUid), {
    role: finalRole,
    requestedRole: app.roleRequested || "",
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

  await setDoc(doc(db, "staff_profiles", app.applicantUid), buildStaffProfile(app, company, actor, finalRole), { merge: true });

  window.location.reload();
}

function bindApprovalOverride() {
  document.addEventListener("click", async (event) => {
    const button = event.target.closest?.("[data-approve]");
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    button.disabled = true;
    const original = button.textContent;
    button.textContent = "Approving...";

    try {
      await approveWithFinalRole(button.getAttribute("data-approve"));
    } catch (error) {
      console.error("Final role approval failed:", error);
      alert(error.message || "Approval failed.");
      button.disabled = false;
      button.textContent = original;
    }
  }, true);
}

function init() {
  enhanceAllCards();
  bindApprovalOverride();

  const list = document.getElementById("applicationsList");
  if (list) {
    new MutationObserver(enhanceAllCards).observe(list, { childList: true, subtree: true });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
