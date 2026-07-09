const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

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

const STAFF_ROLES = new Set([
  "hr",
  "hr_manager",
  "operations_manager",
  "operations_coordinator",
  "dispatcher",
  "field_manager",
  "sales_manager",
  "customer_support",
  "quality_control",
  "sales",
  "sales_rep",
  "technician",
  "lead_technician",
  "cleaner",
  "lead_cleaner",
  "staff",
  "field_staff",
  "crew_lead"
]);

const DECISIONS = new Set(["approved", "rejected", "needs_more_info"]);

function normalize(value = "") {
  return String(value || "").trim().toLowerCase();
}

function cleanText(value = "", maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

function activeApproved(user = {}) {
  return ["active", "approved"].includes(normalize(user.status))
    && normalize(user.approvalStatus) === "approved";
}

function platformReviewer(user = {}) {
  const role = normalize(user.role);
  return role === "owner"
    || role === "super_admin"
    || (role === "admin" && user.platformAccess === true);
}

function assertReviewer(user = {}) {
  if (!activeApproved(user) || !REVIEWER_ROLES.has(normalize(user.role))) {
    throw new HttpsError("permission-denied", "This account cannot review staff applications.");
  }
}

function assertTenantScope(reviewer, application, companyId) {
  if (platformReviewer(reviewer)) return;

  const reviewerCompanyId = cleanText(reviewer.companyId, 120);
  const applicationCompanyId = cleanText(application.companyId, 120);
  if (!reviewerCompanyId) {
    throw new HttpsError("permission-denied", "A company assignment is required for this reviewer.");
  }

  if (companyId && companyId !== reviewerCompanyId) {
    throw new HttpsError("permission-denied", "You can only assign applicants to your company.");
  }

  if (applicationCompanyId && applicationCompanyId !== reviewerCompanyId) {
    throw new HttpsError("permission-denied", "This application belongs to another company.");
  }
}

function actorSnapshot(request, reviewer = {}) {
  return {
    uid: request.auth.uid,
    email: cleanText(request.auth.token?.email || reviewer.email, 320),
    name: cleanText(
      reviewer.displayName
        || reviewer.fullName
        || reviewer.name
        || reviewer.username
        || request.auth.token?.name
        || request.auth.token?.email
        || "Authorized Reviewer",
      180
    ),
    role: normalize(reviewer.role),
    companyId: cleanText(reviewer.companyId, 120)
  };
}

function staffProfile(application, company, actor, finalRole) {
  return {
    uid: application.applicantUid,
    userId: application.applicantUid,
    email: cleanText(application.applicantEmail, 320),
    fullName: cleanText(application.fullName, 180),
    phone: cleanText(application.phone, 80),
    role: finalRole,
    requestedRole: normalize(application.roleRequested),
    companyId: company.id,
    companyName: company.name,
    market: cleanText(application.desiredMarket, 180),
    status: "active",
    approvalStatus: "approved",
    employmentType: cleanText(application.employmentType, 80),
    availability: cleanText(application.availability || application.preferredSchedule, 500),
    earliestStartDate: cleanText(application.earliestStartDate, 80),
    payExpectation: cleanText(application.payExpectation, 120),
    hasDriversLicense: cleanText(application.hasDriversLicense, 40),
    driversLicenseState: cleanText(application.driversLicenseState, 40),
    hasReliableTransportation: cleanText(application.hasReliableTransportation, 40),
    equipmentExperience: cleanText(application.equipmentExperience, 2000),
    profilePhotoURL: Array.isArray(application.attachments)
      ? cleanText(application.attachments.find((file) => file?.kind === "profile_photo")?.downloadURL, 2000)
      : "",
    applicationId: application.id || application.applicantUid,
    attachments: Array.isArray(application.attachments) ? application.attachments.slice(0, 20) : [],
    onboardingStage: "approved_pending_setup",
    onboardingTasks: {
      reviewPolicies: false,
      completeTaxDocs: false,
      completeTraining: false,
      receiveAssignment: false,
      activatePayouts: false
    },
    approvedAt: FieldValue.serverTimestamp(),
    approvedBy: actor.uid,
    approvedByName: actor.name,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
}

async function syncClaims(uid, claims) {
  try {
    const authUser = await admin.auth().getUser(uid);
    await admin.auth().setCustomUserClaims(uid, {
      ...(authUser.customClaims || {}),
      role: claims.role,
      companyId: claims.companyId,
      platformAccess: false,
      accountStatus: "active",
      approvalStatus: "approved"
    });

    await db.doc(`users/${uid}`).set({
      claimsSyncStatus: "synced",
      claimsSyncedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Staff claim synchronization failed", { uid, error });
    await db.doc(`users/${uid}`).set({
      claimsSyncStatus: "pending_retry",
      claimsSyncError: String(error?.code || error?.message || "unknown").slice(0, 300),
      claimsSyncUpdatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }
}

exports.reviewStaffApplication = onCall(
  {
    region: "us-central1",
    enforceAppCheck: true,
    cors: true,
    timeoutSeconds: 30,
    memory: "256MiB"
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Sign in before reviewing an application.");
    }

    const applicationId = cleanText(request.data?.applicationId, 160);
    const decision = normalize(request.data?.decision);
    const reviewNotes = cleanText(request.data?.reviewNotes, 4000);
    const requestedCompanyId = cleanText(request.data?.companyId, 120);
    const requestedCompanyName = cleanText(request.data?.companyName, 180);
    const finalRole = normalize(request.data?.finalRole);

    if (!applicationId || !DECISIONS.has(decision)) {
      throw new HttpsError("invalid-argument", "A valid application and review decision are required.");
    }

    if (decision === "approved" && !STAFF_ROLES.has(finalRole)) {
      throw new HttpsError("invalid-argument", "Select a valid staff role.");
    }

    if (decision === "approved" && !requestedCompanyId) {
      throw new HttpsError("failed-precondition", "Approved staff must be assigned to a company.");
    }

    const reviewerRef = db.doc(`users/${request.auth.uid}`);
    const applicationRef = db.doc(`staff_applications/${applicationId}`);
    const reviewerSnapshot = await reviewerRef.get();
    if (!reviewerSnapshot.exists) {
      throw new HttpsError("permission-denied", "Reviewer profile not found.");
    }

    const reviewer = reviewerSnapshot.data() || {};
    assertReviewer(reviewer);
    const actor = actorSnapshot(request, reviewer);

    let approvedClaims = null;

    await db.runTransaction(async (transaction) => {
      const applicationSnapshot = await transaction.get(applicationRef);
      if (!applicationSnapshot.exists) {
        throw new HttpsError("not-found", "Staff application not found.");
      }

      const application = { id: applicationSnapshot.id, ...(applicationSnapshot.data() || {}) };
      const applicantUid = cleanText(application.applicantUid, 160);
      if (!applicantUid || applicantUid !== applicationId) {
        throw new HttpsError("failed-precondition", "The application identity is invalid.");
      }

      if (["approved", "rejected"].includes(normalize(application.status))) {
        throw new HttpsError("failed-precondition", "This application has already been finalized.");
      }

      assertTenantScope(reviewer, application, requestedCompanyId);

      const commonReview = {
        status: decision,
        verificationStatus: decision === "approved" ? "verified" : decision,
        reviewNotes,
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: actor.uid,
        reviewedByName: actor.name,
        reviewerRole: actor.role,
        updatedAt: FieldValue.serverTimestamp()
      };

      if (decision !== "approved") {
        transaction.update(applicationRef, {
          ...commonReview,
          ...(decision === "rejected" ? {
            rejectedAt: FieldValue.serverTimestamp(),
            rejectedBy: actor.uid,
            rejectedByName: actor.name
          } : {})
        });

        transaction.set(db.collection("audit_logs").doc(), {
          action: `staff_application_${decision}`,
          actorUserId: actor.uid,
          actorName: actor.name,
          actorRole: actor.role,
          companyId: actor.companyId || cleanText(application.companyId, 120),
          targetCollection: "staff_applications",
          targetDocumentId: applicationId,
          targetUserId: applicantUid,
          decision,
          source: "reviewStaffApplication",
          createdAt: FieldValue.serverTimestamp()
        });
        return;
      }

      const applicantRef = db.doc(`users/${applicantUid}`);
      const companyRef = db.doc(`companies/${requestedCompanyId}`);
      const applicantSnapshot = await transaction.get(applicantRef);
      const companySnapshot = await transaction.get(companyRef);

      if (!applicantSnapshot.exists) {
        throw new HttpsError("failed-precondition", "Applicant user profile not found.");
      }
      if (!companySnapshot.exists) {
        throw new HttpsError("failed-precondition", "Selected company not found.");
      }

      const companyData = companySnapshot.data() || {};
      const company = {
        id: requestedCompanyId,
        name: cleanText(requestedCompanyName || companyData.name || companyData.companyName || requestedCompanyId, 180)
      };

      transaction.update(applicationRef, {
        ...commonReview,
        companyId: company.id,
        companyName: company.name,
        approvedRole: finalRole,
        finalRole,
        approvedAt: FieldValue.serverTimestamp(),
        approvedBy: actor.uid,
        approvedByName: actor.name
      });

      transaction.update(applicantRef, {
        role: finalRole,
        requestedRole: normalize(application.roleRequested),
        status: "active",
        approvalStatus: "approved",
        companyId: company.id,
        companyName: company.name,
        companySlug: company.id,
        companyCategory: "staff",
        platformAccess: false,
        staffApplicationId: applicationId,
        approvedAt: FieldValue.serverTimestamp(),
        approvedBy: actor.uid,
        approvedByName: actor.name,
        claimsSyncStatus: "pending",
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.uid,
        updatedByName: actor.name
      });

      transaction.set(
        db.doc(`staff_profiles/${applicantUid}`),
        staffProfile(application, company, actor, finalRole),
        { merge: true }
      );

      transaction.set(db.collection("audit_logs").doc(), {
        action: "staff_application_approved",
        actorUserId: actor.uid,
        actorName: actor.name,
        actorRole: actor.role,
        companyId: company.id,
        targetCollection: "staff_applications",
        targetDocumentId: applicationId,
        targetUserId: applicantUid,
        assignedRole: finalRole,
        source: "reviewStaffApplication",
        createdAt: FieldValue.serverTimestamp()
      });

      approvedClaims = { uid: applicantUid, role: finalRole, companyId: company.id };
    });

    if (approvedClaims) {
      await syncClaims(approvedClaims.uid, approvedClaims);
    }

    return {
      ok: true,
      applicationId,
      decision,
      role: approvedClaims?.role || null,
      companyId: approvedClaims?.companyId || null
    };
  }
);
