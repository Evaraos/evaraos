import {
  bindTopbar,
  requireAuth,
  fetchCompanyCollection,
  fetchActiveTechnicians,
  renderSidebar,
  roleGuard
} from "./app.js";
import {
  doc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase.js";

let currentUser = null;
let editingJobId = null;
let currentJobs = [];
let currentTechnicians = [];

function formatDate(value) {
  if (!value) return "—";
  try {
    if (value.toDate) return value.toDate().toLocaleString();
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function openModal(id) {
  document.getElementById(id).classList.add("active");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("active");
}

async function loadTechnicianOptions() {
  currentTechnicians = await fetchActiveTechnicians(currentUser.companyId);
  const select = document.getElementById("jobAssignedTechnician");
  select.innerHTML = `
    <option value="">Assigned Technician</option>
    ${currentTechnicians.map((tech) => `<option value="${tech.id}">${tech.name || tech.email}</option>`).join("")}
  `;
}

function fillJobForm(job) {
  document.getElementById("jobCustomerName").value = job.customerName || "";
  document.getElementById("jobServiceType").value = job.serviceType || "";
  document.getElementById("jobAssignedTechnician").value = job.assignedTechnician || "";
  document.getElementById("jobScheduledDate").value = job.scheduledDate || "";
  document.getElementById("jobScheduledTimeWindow").value = job.scheduledTimeWindow || "";
  document.getElementById("jobStatus").value = job.status || "scheduled";
  document.getElementById("jobNotes").value = job.notes || "";
}

function technicianName(id) {
  const tech = currentTechnicians.find((item) => item.id === id);
  return tech ? (tech.name || tech.email) : "—";
}

async function renderJobs() {
  currentJobs = await fetchCompanyCollection("jobs", currentUser.companyId);
  const jobsList = document.getElementById("jobsList");

  if (!currentJobs.length) {
    jobsList.innerHTML = `<div class="muted">No jobs yet.</div>`;
    return;
  }

  jobsList.innerHTML = currentJobs.map((job) => `
    <div class="row">
      <div>
        <strong>${job.customerName || "Unnamed Job"}</strong><br>
        <span class="muted">${job.serviceType || "No service type"}</span>
      </div>
      <div>
        ${job.address || "No address"}<br>
        <span class="muted">${job.city || ""} ${job.state || ""} ${job.zip || ""}</span>
      </div>
      <div>
        Tech: ${technicianName(job.assignedTechnician)}<br>
        <span class="muted">${job.scheduledDate || "—"} | ${job.scheduledTimeWindow || "—"}</span>
      </div>
      <div>
        <button class="btn secondary edit-job-btn" data-id="${job.id}">Edit</button>
        <div class="meta-line">
          Status: ${job.status || "scheduled"}<br>
          Updated: ${formatDate(job.updatedAt)}
        </div>
      </div>
    </div>
  `).join("");

  document.querySelectorAll(".edit-job-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const selectedJob = currentJobs.find((job) => job.id === btn.dataset.id);
      if (!selectedJob) return;

      editingJobId = selectedJob.id;
      fillJobForm(selectedJob);
      document.getElementById("jobMsg").textContent = `Editing ${selectedJob.customerName || "job"}`;
      openModal("jobModal");
    });
  });
}

requireAuth(async (user) => {
  currentUser = user;

  if (!roleGuard(user, "jobs")) {
    document.body.innerHTML = `
      <div class="auth-shell">
        <div class="auth-card">
          <h2>Access denied</h2>
          <p class="muted">Your role does not have access to Jobs.</p>
        </div>
      </div>
    `;
    return;
  }

  await bindTopbar(user);
  document.getElementById("sidebar").innerHTML = renderSidebar(user.role, "jobs");

  await loadTechnicianOptions();
  await renderJobs();

  document.getElementById("closeJobModalBtn").addEventListener("click", () => closeModal("jobModal"));

  document.getElementById("saveJobBtn").addEventListener("click", async () => {
    const msg = document.getElementById("jobMsg");

    if (!editingJobId) {
      msg.textContent = "Select a job to edit.";
      return;
    }

    try {
      await updateDoc(doc(db, "jobs", editingJobId), {
        serviceType: document.getElementById("jobServiceType").value.trim(),
        assignedTechnician: document.getElementById("jobAssignedTechnician").value,
        scheduledDate: document.getElementById("jobScheduledDate").value,
        scheduledTimeWindow: document.getElementById("jobScheduledTimeWindow").value,
        status: document.getElementById("jobStatus").value,
        notes: document.getElementById("jobNotes").value.trim(),
        updatedAt: serverTimestamp()
      });

      msg.textContent = "Job updated successfully.";
      await renderJobs();
      closeModal("jobModal");
    } catch (e) {
      msg.textContent = e.message || "Failed to update job.";
    }
  });
});
