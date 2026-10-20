import {
  db,
  updateDoc,
  doc,
  serverTimestamp
} from "./firebase.js";
import { getRoleScopedCollectionDocs } from "./firestore-role-scoped-collections.js?v=assignment-index-2";
import { syncStaffAssignmentIndex } from "./staff-assignment-index.js";

let currentUser = null;

// ===== CLAIM JOB =====
export async function claimJob(jobId, role, user) {
  const jobRef = doc(db, "jobs", jobId);

  const documents = await getRoleScopedCollectionDocs("jobs", user, user.uid);
  const jobSnapshot = documents.find((document) => document.id === jobId);
  const job = jobSnapshot?.data();

  if (!job) return alert("Job not found");

  // ===== COMPANY CLAIM =====
  if (role === "company") {
    if (job.companyClaimed) {
      return alert("Already claimed by another company");
    }

    await updateDoc(jobRef, {
      companyId: user.companyId,
      companyClaimed: true,
      companyClaimedBy: user.uid,
      companyClaimedAt: serverTimestamp(),
      status: "claimed"
    });

    alert("Company claimed job");
  }

  // ===== STAFF CLAIM =====
  if (role === "staff") {
    if (!job.companyClaimed) {
      return alert("Company must claim first");
    }

    if (job.staffClaimed) {
      return alert("Already taken");
    }

    if (job.companyId !== user.companyId) {
      return alert("Not your company job");
    }

    await updateDoc(jobRef, {
      assignedTo: [user.uid],
      staffClaimed: true,
      staffClaimedBy: user.uid,
      staffClaimedAt: serverTimestamp(),
      status: "in_progress"
    });

    try {
      await syncStaffAssignmentIndex("jobs", jobId, {}, {
        assignedTo: [user.uid],
        staffClaimedBy: user.uid
      });
    } catch (error) {
      console.error("Claimed job assignment reference could not be synchronized:", error);
      return alert("Job accepted, but your work list could not refresh. Ask a manager to repair the assignment index.");
    }

    alert("You got the job");
  }
}
