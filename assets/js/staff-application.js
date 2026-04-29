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

const form = document.getElementById("staffApplicationForm");
const submitBtn = document.getElementById("staffApplicationSubmit");
const messageEl = document.getElementById("staffApplicationMessage");

function byId(id) {
  return document.getElementById(id);
}

function value(id) {
  return String(byId(id)?.value || "").trim();
}

function inviteCodeValue() {
  return value("appInviteCode").toUpperCase().replace(/[^A-Z0-9-]+/g, "").slice(0, 32);
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
    ["appIdType", "Document type"],
    ["appEmergencyName", "Emergency contact name"],
    ["appEmergencyPhone", "Emergency contact phone"]
  ];

  for (const [id, label] of required) {
    if (!value(id)) throw new Error(`${label} is required.`);
  }

  if (value("appPassword").length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  validateAttachment(fileValue("appIdFront"), "Identity document", true);
  validateAttachment(fileValue("appIdBack"), "Back side attachment", false);
  validateAttachment(fileValue("appResume"), "Resume / extra proof", false);
}

async function usernameAvailable(usernameLower) {
  const q = query(collection(db, "users"), where("usernameLower", "==", usernameLower), limit(1));
  const snap = await getDocs(q);
  return snap.empty;
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
    uploadedAt: new Date().toISOString()
  };
}

function buildApplicationPayload(user, attachments = []) {
  const email = value("appEmail").toLowerCase();
  const roleRequested = value("appRole");
  const inviteCode = inviteCodeValue();

  return {
    applicantUid: user.uid,
    applicantEmail: email,
    fullName: value("appFullName"),
    username: normalizeUsername(email),
    inviteCode,
    inviteCodeNormalized: inviteCode,
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
    experienceSummary: value("appExperience"),
    idDocumentType: value("appIdType"),
    emergencyContactName: value("appEmergencyName"),
    emergencyContactPhone: value("appEmergencyPhone"),
    attachments,
    attachmentCount: attachments.length,
    status: "submitted",
    verificationStatus: "pending_review",
    reviewNotes: "",
    createdAt: serverTimestamp(),
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    searchText: [
      value("appFullName"),
      email,
      inviteCode,
      roleRequested,
      value("appDesiredCompany"),
      value("appDesiredMarket"),
      value("appPhone"),
      value("appCity"),
      value("appState")
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
    const usernameIsFree = await usernameAvailable(usernameLower);

    if (!usernameIsFree) {
      throw new Error("This email username is already connected to an account. Please sign in or use another email.");
    }

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
      staffApplicationRoleRequested: value("appRole"),
      staffInviteCode: inviteCodeValue(),
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

    setTimeout(() => {
      window.location.assign("/evaraos/customer_dashboard.html");
    }, 900);
  } catch (error) {
    console.error("Staff application failed:", error);
    setMessage(error.message || "Could not submit staff application.", "error");
  } finally {
    setBusy(false);
  }
}

function prefillInviteCode() {
  const inviteInput = byId("appInviteCode");
  if (!inviteInput) return;

  const params = new URLSearchParams(window.location.search);
  const invite = params.get("invite") || params.get("code") || "";
  if (invite) inviteInput.value = invite.toUpperCase();
}

function init() {
  if (!form) return;
  prefillInviteCode();
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
