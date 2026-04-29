import {
  db,
  collection,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp
} from "./firebase.js";

let currentUser = null;

// ===== CLAIM JOB =====
export async function claimJob(jobId, role, user) {
  const jobRef = doc(db, "jobs", jobId);

  const snap = await getDocs(collection(db, "jobs"));
  const job = snap.docs.find(d => d.id === jobId)?.data();

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

    alert("You got the job");
  }
}