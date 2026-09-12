const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} = require("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc } = require("firebase/firestore");

const projectId = `${process.env.GCLOUD_PROJECT || "evaraos-web"}-staff-applicant-lifecycle`;
const root = path.resolve(__dirname, "../..");
let env;

function pendingProfile(uid, overrides = {}) {
  return {
    uid,
    id: uid,
    email: `${uid}@example.com`,
    username: uid,
    usernameLower: uid.toLowerCase(),
    displayName: "Pending Applicant",
    fullName: "Pending Applicant",
    name: "Pending Applicant",
    role: "customer",
    phone: "555-0100",
    bio: "Staff applicant pending review.",
    status: "pending",
    approvalStatus: "pending",
    companyId: "",
    companyName: "",
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
    ...overrides
  };
}

function submittedApplication(uid, overrides = {}) {
  return {
    applicantUid: uid,
    applicantEmail: `${uid}@example.com`,
    fullName: "Pending Applicant",
    roleRequested: "technician",
    desiredRole: "technician",
    desiredCompany: "Preferred Company",
    status: "submitted",
    verificationStatus: "pending_review",
    attachments: [],
    attachmentCount: 0,
    documentVerificationStatus: "deferred",
    documentVerificationReason: "document_collection_unavailable",
    createdAtMs: Date.now(),
    submittedAtMs: Date.now(),
    updatedAtMs: Date.now(),
    ...overrides
  };
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync(path.join(root, "firebase/firestore.rules"), "utf8")
    }
  });
});

test.beforeEach(async () => {
  await env.clearFirestore();
});

test.after(async () => {
  await env.cleanup();
});

test("staff applicant can create only a pending unassigned canonical profile", async () => {
  const allowedDb = env.authenticatedContext("applicantAllowed").firestore();
  await assertSucceeds(setDoc(
    doc(allowedDb, "users", "applicantAllowed"),
    pendingProfile("applicantAllowed")
  ));

  const preferredCompanyDb = env.authenticatedContext("applicantPreferredCompany").firestore();
  await assertFails(setDoc(
    doc(preferredCompanyDb, "users", "applicantPreferredCompany"),
    pendingProfile("applicantPreferredCompany", { companyName: "Preferred Company" })
  ));

  const companyIdDb = env.authenticatedContext("applicantCompanyId").firestore();
  await assertFails(setDoc(
    doc(companyIdDb, "users", "applicantCompanyId"),
    pendingProfile("applicantCompanyId", { companyId: "company-a" })
  ));

  const redundantNameDb = env.authenticatedContext("applicantRedundantName").firestore();
  await assertFails(setDoc(
    doc(redundantNameDb, "users", "applicantRedundantName"),
    pendingProfile("applicantRedundantName", { firstName: "Pending" })
  ));
});

test("staff applicant submission remains unassigned and readable only by its owner", async () => {
  const applicantDb = env.authenticatedContext("applicant").firestore();
  await assertSucceeds(setDoc(doc(applicantDb, "users", "applicant"), pendingProfile("applicant")));
  await assertSucceeds(setDoc(
    doc(applicantDb, "staff_applications", "applicant"),
    submittedApplication("applicant")
  ));
  await assertSucceeds(getDoc(doc(applicantDb, "staff_applications", "applicant")));

  const otherDb = env.authenticatedContext("otherApplicant").firestore();
  await assertFails(getDoc(doc(otherDb, "staff_applications", "applicant")));
  await assertFails(setDoc(
    doc(otherDb, "staff_applications", "otherApplicant"),
    submittedApplication("otherApplicant", { companyId: "company-a" })
  ));
});

test("public application creation enforces the requestable role catalog", async () => {
  const allowedDb = env.authenticatedContext("allowedRole").firestore();
  await assertSucceeds(setDoc(
    doc(allowedDb, "staff_applications", "allowedRole"),
    submittedApplication("allowedRole", { roleRequested: "field_staff", desiredRole: "field_staff" })
  ));

  const forgedManagerDb = env.authenticatedContext("forgedManager").firestore();
  await assertFails(setDoc(
    doc(forgedManagerDb, "staff_applications", "forgedManager"),
    submittedApplication("forgedManager", { roleRequested: "sales_manager", desiredRole: "sales_manager" })
  ));

  const mismatchedRoleDb = env.authenticatedContext("mismatchedRole").firestore();
  await assertFails(setDoc(
    doc(mismatchedRoleDb, "staff_applications", "mismatchedRole"),
    submittedApplication("mismatchedRole", { roleRequested: "technician", desiredRole: "manager" })
  ));
});


test("applicants cannot self-assign canonical or legacy platform authority", async () => {
  for (const role of ["platform_admin", "super_admin", "owner", "admin", "manager"]) {
    const uid = `forged_${role}`;
    const db = env.authenticatedContext(uid).firestore();
    await assertFails(setDoc(doc(db, "users", uid), pendingProfile(uid, {role})));
    await assertFails(setDoc(doc(db, "staff_applications", uid), submittedApplication(uid, {roleRequested:role,desiredRole:role})));
  }
});
