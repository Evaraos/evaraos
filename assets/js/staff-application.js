import {
  auth,
  db,
  setAuthPersistence,
  createUserWithEmailAndPassword,
  updateProfile,
  syncUserSession,
  doc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  limit,
  serverTimestamp
} from "./firebase.js";

import { getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const DEFAULT_PUBLIC_ROLE = "customer";
const DEFAULT_PUBLIC_STATUS = "pending";
const DEFAULT_PUBLIC_APPROVAL = "pending";
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

const AVAILABLE_STAFF_ROLES = [
  { value: "sales_rep", label: "Sales Rep" },
  { value: "technician", label: "Technician" },
  { value: "cleaner", label: "Cleaner" },
  { value: "staff", label: "General Staff" }
];

const form = document.getElementById("staffApplicationForm");
const submitBtn = document.getElementById("staffApplicationSubmit");
const messageEl = document.getElementById("staffApplicationMessage");

function byId(id) {
  return document.getElementById(id);
}

function value(id) {
  return String(byId(id)?.value || "").trim();
}

function checkboxValue(id) {
  return Boolean(byId(id)?.checked);
}

function fileValue(id) {
  return byId(id)?.files?.[0] || null;
}

function setMessage(message = "", state = "") {
  if (!messageEl) return;
  messageEl.textContent = message;
  messageEl.dataset.state = state;
}

function setBusy(isBusy, text = "Submit Staff Application") {
  if (!submitBtn) return;
  submitBtn.disabled = isBusy;
  submitBtn.textContent = isBusy ? text : "Submit Staff Application";
}

function normalizeUsername(email = "") {
  return String(email || "").trim().toLowerCase().split("@")[0].replace(/[^a-z0-9._-]+/g, "").slice(0, 40);
}

function sanitizeRole(role = "") {
  const cleaned = String(role || "").trim().toLowerCase();
  return AVAILABLE_STAFF_ROLES.some((item) => item.value === cleaned) ? cleaned : "";
}

function validateAttachment(file, label, required = false) {
  if (!file) {
    if (required) throw new Error(`${label} is required.`);
    return;
  }

  const isAllowed = file.type.startsWith("image/") || file.type === "application/pdf";
  if (!isAllowed) throw new Error(`${label} must be an image or PDF.`);
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error(`${label} must be under 15MB.`);
}

function validateForm() {
  const required = [
    ["appFullName", "Full legal name"],
    ["appEmail", "Email"],
    ["appPassword", "Password"],
    ["appRole", "Role"],
    ["appPhone", "Phone"],
    ["appDob", "Date of birth"],
    ["appAddress", "Street address"],
    ["appCity", "City"],
    ["appState", "State"],
    ["appZip", "ZIP"],
    ["appWorkAuth", "Work authorization"],
    ["appDriversLicense", "Driver’s license answer"],
    ["appTransportation", "Transportation answer"],
    ["appAvailability", "Availability"],
    ["appEmploymentType", "Employment type"],
    ["appEarliestStartDate", "Earliest start date"],
    ["appBackgroundConsent", "Background check consent"],
    ["appIdType", "Document type"],
    ["appEmergencyName", "Emergency contact name"],
    ["appEmergencyPhone", "Emergency contact phone"]
  ];

  for (const [id, label] of required) {
    if (!value(id)) throw new Error(`${label} is required.`);
  }

  if (!sanitizeRole(value("appRole"))) {
    throw new Error("Select a valid role to apply for.");
  }

  if (value("appPassword").length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  if (!value("appPasswordConfirm")) {
    throw new Error("Confirm your password before submitting.");
  }

  if (value("appPassword") !== value("appPasswordConfirm")) {
    throw new Error("Passwords do not match.");
  }

  if (!checkboxValue("appConsentAccurate")) {
    throw new Error("Confirm that the application information is accurate before submitting.");
  }

  validateAttachment(fileValue("appIdFront"), "Identity document", true);
  validateAttachment(fileValue("appIdBack"), "Back side attachment", false);
  validateAttachment(fileValue("appResume"), "Resume / extra proof", false);
  validateAttachment(fileValue("appProfilePhoto"), "Profile photo", false);
}

async function usernameAvailable() {
  return true;
}

function fileExtension(file = {}) {
  const name = String(file.name || "");
  const ext = name.includes(".") ? name.split(".").pop() : "file";
  return ext.toLowerCase().replace(/[^a-z0-9]+/g, "") || "file";
}

async function uploadAttachment(uid, file, kind) {
  if (!file) return null;

  const storage = getStorage(getApp());
  const safeKind = String(kind || "attachment").replace(/[^a-z0-9_-]+/gi, "_");
  const path = `staff_applications/${uid}/${Date.now()}_${safeKind}.${fileExtension(file)}`;
  const ref = storageRef(storage, path);

  await uploadBytes(ref, file, {
    contentType: file.type,
    customMetadata: {
      ownerUid: uid,
      applicationId: uid,
      kind: safeKind
    }
  });

  const downloadURL = await getDownloadURL(ref);

  return {
    kind: safeKind,
    name: file.name,
    size: file.size,
    type: file.type,
    path,
    downloadURL,
    verified: false,
    uploadedAt: new Date().toISOString()
  };
}

function buildApplicationPayload(user, attachments = []) {
  const email = value("appEmail").toLowerCase();
  const roleRequested = sanitizeRole(value("appRole"));
  const profilePhoto = attachments.find((item) => item.kind === "profile_photo");

  return {
    applicantUid: user.uid,
    applicantEmail: email,
    fullName: value("appFullName"),
    username: normalizeUsername(email),
    roleRequested,
    desiredRole: roleRequested,
    desiredCompany: value("appDesiredCompany"),
    desiredMarket: value("appDesiredMarket"),
    phone: value("appPhone"),
    address: value("appAddress"),
    city: value("appCity"),
    state: value("appState"),
    zip: value("appZip"),
    dateOfBirth: value("appDob"),
    workAuthorization: value("appWorkAuth"),
    hasDriversLicense: value("appDriversLicense"),
    driversLicenseState: value("appDriversState"),
    hasReliableTransportation: value("appTransportation"),
    availability: value("appAvailability"),
    preferredSchedule: value("appPreferredSchedule"),
    employmentType: value("appEmploymentType"),
    earliestStartDate: value("appEarliestStartDate"),
    payExpectation: value("appPayExpectation"),
    equipmentExperience: value("appEquipmentExperience"),
    backgroundConsent: value("appBackgroundConsent"),
    consentAccurate: checkboxValue("appConsentAccurate"),
    experienceSummary: value("appExperience"),
    idDocumentType: value("appIdType"),
    emergencyContactName: value("appEmergencyName"),
    emergencyContactPhone: value("appEmergencyPhone"),
    attachments,
    attachmentCount: attachments.length,
    profilePhotoUploaded: Boolean(profilePhoto),
    profilePhotoURL: profilePhoto?.downloadURL || "",
    status: "submitted",
    verificationStatus: "pending_review",
    reviewNotes: "",
    createdAt: serverTimestamp(),
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    searchText: [
      value("appFullName"),
      email,
      roleRequested,
      value("appDesiredCompany"),
      value("appDesiredMarket"),
      value("appPhone"),
      value("appCity"),
      value("appState"),
      value("appEmploymentType")
    ].filter(Boolean).join(" ").toLowerCase()
  };
}

async function handleSubmit(event) {
  event.preventDefault();

  try {
    validateForm();
    setBusy(true, "Creating secure account...");
    setMessage("Creating your secure applicant account...", "");

    const email = value("appEmail").toLowerCase();
    const usernameLower = normalizeUsername(email);
    await setAuthPersistence(true);
    const result = await createUserWithEmailAndPassword(auth, email, value("appPassword"));
    const user = result.user;

    await updateProfile(user, { displayName: value("appFullName") });

    const userDoc = {
      uid: user.uid,
      id: user.uid,
      email,
      username: usernameLower,
      usernameLower,
      displayName: value("appFullName"),
      fullName: value("appFullName"),
      name: value("appFullName"),
      role: DEFAULT_PUBLIC_ROLE,
      phone: value("appPhone"),
      bio: "Staff applicant pending review.",
      status: DEFAULT_PUBLIC_STATUS,
      approvalStatus: DEFAULT_PUBLIC_APPROVAL,
      staffApplicationStatus: "submitted",
      staffApplicationRoleRequested: sanitizeRole(value("appRole")),
      companyId: "",
      companyName: value("appDesiredCompany"),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, "users", user.uid), userDoc, { merge: true });

    syncUserSession(user, DEFAULT_PUBLIC_ROLE, {
      displayName: value("appFullName"),
      fullName: value("appFullName"),
      name: value("appFullName"),
      username: usernameLower,
      companyName: value("appDesiredCompany"),
      approvalStatus: DEFAULT_PUBLIC_APPROVAL,
      status: DEFAULT_PUBLIC_STATUS
    });

    setBusy(true, "Uploading verification...");
    setMessage("Uploading verification attachments...", "");

    const uploads = [];
    const profilePhoto = await uploadAttachment(user.uid, fileValue("appProfilePhoto"), "profile_photo");
    if (profilePhoto) uploads.push(profilePhoto);

    const idFront = await uploadAttachment(user.uid, fileValue("appIdFront"), "id_front");
    if (idFront) uploads.push(idFront);

    const idBack = await uploadAttachment(user.uid, fileValue("appIdBack"), "id_back");
    if (idBack) uploads.push(idBack);

    const resume = await uploadAttachment(user.uid, fileValue("appResume"), "resume_or_extra_proof");
    if (resume) uploads.push(resume);

    setBusy(true, "Submitting application...");
    setMessage("Saving your staff application for review...", "");

    await setDoc(doc(db, "staff_applications", user.uid), buildApplicationPayload(user, uploads), { merge: false });

    setMessage("Application submitted. Leadership will review your verification and approve your role if accepted.", "success");
    form?.reset();
    document.querySelectorAll(".role-pill").forEach((pill) => pill.classList.remove("active"));

    setTimeout(() => {
      window.location.assign("/customer_dashboard.html");
    }, 900);
  } catch (error) {
    console.error("Staff application failed:", error);
    setMessage(error.message || "Could not submit staff application.", "error");
  } finally {
    setBusy(false);
  }
}

function injectConfirmPasswordField() {
  if (document.getElementById("appPasswordConfirm")) return;

  const passwordField = byId("appPassword")?.closest(".application-field");
  if (!passwordField?.parentElement) return;

  const confirmField = document.createElement("div");
  confirmField.className = "application-field";
  confirmField.innerHTML = `
    <label for="appPasswordConfirm">Confirm password</label>
    <input id="appPasswordConfirm" type="password" autocomplete="new-password" minlength="6" required />
  `;

  passwordField.parentElement.insertBefore(confirmField, passwordField.nextSibling);
}

function injectAppCheckNotice() {
  if (!form || document.getElementById("staffAppCheckNotice")) return;

  const notice = document.createElement("p");
  notice.id = "staffAppCheckNotice";
  notice.className = "application-notice";
  notice.textContent = "Protected by Evaraos App Check and reCAPTCHA Enterprise. Submit only accurate information for review.";

  const actions = document.querySelector(".application-actions");
  if (actions?.parentElement) actions.parentElement.insertBefore(notice, actions);
  else form.appendChild(notice);
}

function removeStaffInviteField() {
  const inviteField = byId("appInviteCode")?.closest(".application-field");
  inviteField?.remove();
}

function upgradeRolePicker() {
  const roleSelect = byId("appRole");
  if (!roleSelect || document.getElementById("appRolePills")) return;

  const wrapper = document.createElement("div");
  wrapper.className = "application-field full";
  wrapper.innerHTML = `
    <label>Role you want to apply for</label>
    <p class="form-subnote">Pick the role you want. Leadership can approve, deny, or move you into a better fit after review.</p>
    <div id="appRolePills" class="role-pill-container">
      ${AVAILABLE_STAFF_ROLES.map((role) => `<button type="button" class="role-pill" data-role="${role.value}">${role.label}</button>`).join("")}
    </div>
  `;

  const roleField = roleSelect.closest(".application-field");
  roleField?.parentElement?.insertBefore(wrapper, roleField);
  roleSelect.type = "hidden";
  roleField.style.display = "none";

  wrapper.querySelectorAll(".role-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      wrapper.querySelectorAll(".role-pill").forEach((item) => item.classList.remove("active"));
      pill.classList.add("active");
      roleSelect.value = pill.dataset.role || "";
    });
  });
}

function injectDetailedApplicationFields() {
  if (document.getElementById("appEmploymentType")) return;

  const transportationSection = byId("appExperience")?.closest(".form-section");
  const identitySection = byId("appIdType")?.closest(".form-section");
  if (!transportationSection || !identitySection) return;

  const details = document.createElement("div");
  details.className = "form-section";
  details.innerHTML = `
    <h2 class="form-section-title">Work Preferences + Screening</h2>
    <p class="form-subnote">This helps Evaraos route you to the right company, crew, schedule, and onboarding path.</p>
    <div class="application-grid">
      <div class="application-field">
        <label for="appEmploymentType">Employment type desired</label>
        <select id="appEmploymentType" required>
          <option value="">Select</option>
          <option value="1099_contractor">1099 Contractor</option>
          <option value="w2_employee">W-2 Employee</option>
          <option value="part_time">Part-Time</option>
          <option value="full_time">Full-Time</option>
        </select>
      </div>
      <div class="application-field">
        <label for="appEarliestStartDate">Earliest start date</label>
        <input id="appEarliestStartDate" type="date" required />
      </div>
      <div class="application-field">
        <label for="appPayExpectation">Pay expectation</label>
        <input id="appPayExpectation" type="text" placeholder="$18/hr, commission, per job, negotiable..." />
      </div>
      <div class="application-field">
        <label for="appBackgroundConsent">Background check consent</label>
        <select id="appBackgroundConsent" required>
          <option value="">Select</option>
          <option value="yes">Yes, I consent if required</option>
          <option value="no">No</option>
        </select>
      </div>
      <div class="application-field full">
        <label for="appPreferredSchedule">Preferred schedule details</label>
        <textarea id="appPreferredSchedule" rows="3" placeholder="Best days, blocked times, weekly availability, travel range..."></textarea>
      </div>
      <div class="application-field full">
        <label for="appEquipmentExperience">Equipment / field experience</label>
        <textarea id="appEquipmentExperience" rows="4" placeholder="Pressure washer, truck/trailer, cleaning chemicals, D2D sales, CRM apps, route work, customer service..."></textarea>
      </div>
    </div>
  `;

  identitySection.parentElement.insertBefore(details, identitySection);

  const photoField = document.createElement("div");
  photoField.className = "application-field";
  photoField.innerHTML = `
    <label for="appProfilePhoto">Profile photo</label>
    <input id="appProfilePhoto" type="file" accept="image/*" />
  `;
  identitySection.querySelector(".application-grid")?.prepend(photoField);

  const consent = document.createElement("div");
  consent.className = "application-notice";
  consent.innerHTML = `
    <label style="display:flex;gap:10px;align-items:flex-start;font-weight:900;color:inherit;">
      <input id="appConsentAccurate" type="checkbox" style="width:auto;margin-top:4px;" />
      <span>I confirm this application is accurate, my documents belong to me, and Evaraos may review my information for staff onboarding.</span>
    </label>
  `;
  form?.insertBefore(consent, document.querySelector(".application-actions"));
}

function init() {
  if (!form) return;
  removeStaffInviteField();
  injectConfirmPasswordField();
  upgradeRolePicker();
  injectDetailedApplicationFields();
  injectAppCheckNotice();
  form.addEventListener("submit", handleSubmit);

  if (window.EvaraLoader?.markAppReady) {
    window.EvaraLoader.markAppReady();
  }
  document.body?.classList.remove("app-loading");
  document.body?.classList.add("app-ready");
  document.documentElement.classList.remove("boot-pending");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
