import {
  bindTopbar,
  requireAuth,
  fetchCompanyCollection,
  fetchActiveTechnicians,
  fetchUsersByCompany,
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
let currentJobs = [];
let currentTechnicians = [];
let currentUsers = [];
let editingJobId = null;

function openModal(id) {
  document.getElementById(id).classList.add("active");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("active");
}

function formatDate(value) {
  if (!value) return "—";
  try {
    if (value.toDate) return value.toDate().toLocaleString();
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function findUserById(id) {
  return currentUsers.find((u) => u.id === id) || null;
}

function formatHandleFromUser(user) {
  return user?.handle || (user?.username ? `@${user.username}` : "@user");
}

function formatDisplayNameFromUser(user) {
  return user?.displayUsername || user?.username || user?.name || "User";
}

function technicianLabel(techId) {
  const tech = findUserById(techId);
  if (!tech) return "Unassigned";
  return `${tech.name || formatDisplayNameFromUser(tech)} • ${formatHandleFromUser(tech)}`;
}

function createdByLabel(job) {
  if (!job.createdBy) return "—";
  const match = currentUsers.find((u) => u.email === job.createdBy);
  if (!match) return job.createdBy;
  return `${match.name || formatDisplayNameFromUser(match)} • ${formatHandleFromUser(match)}`;
}

function repLabel(job) {
  if (!job.assignedRep) return "—";
  const rep = findUserById(job.assignedRep);
  if (!rep) return job.assignedRep;
  return `${rep.name || formatDisplayNameFromUser(rep)} • ${formatHandleFromUser(rep)}`;
}

function statusClass(status) {
  return `status-${status || "scheduled"}`;
}

function fillJobForm(job) {
  document.getElementById("jobCustomerName").value = job.customerName || "";
  document.getElementById("jobCustomerPhone").value = job.customerPhone || "";
  document.getElementById("jobCustomerEmail").value = job.customerEmail || "";
  document.getElementById("jobAddress").value = job.address || "";
  document.getElementById("jobCity").value = job.city || "";
  document.getElementById("jobState").value = job.state || "";
  document.getElementById("jobZip").value = job.zip || "";
  document.getElementById("jobServiceType").value = job.serviceType || "";
  document.getElementById("jobAssignedTechnician").value = job.assignedTechnician || "";
  document.getElementById("jobScheduledDate").value = job.scheduledDate || "";
  document.getElementById("jobScheduledTimeWindow").value = job.scheduledTimeWindow || "";
  document.getElementById("jobEstimatedSqFt").value = job.estimatedSqFt || "";
  document.getElementById("jobEstimatedPrice").value = job.estimatedPrice || "";
  document.getElementById("jobStatus").value = job.status || "scheduled";
  document.getElementById("jobNotes").value = job.notes || "";
}

async function loadTechnicians() {
  currentTechnicians = await fetchActiveTechnicians(currentUser.companyId);
  const select = document.getElementById("jobAssignedTechnician");

  select.innerHTML = `
    <option value="">Assigned Technician</option>
    ${currentTechnicians.map((tech) => {
      const handle = tech.handle || (tech.username ? `@${tech.username}` : "@user");
      const label = tech.name || tech.displayUsername || tech.username || tech.email;
      return `<option value="${tech.id}">${label} • ${handle}</option>`;
    }).join("")}
  `;
}

async function renderJobs() {
  currentJobs = await fetchCompanyCollection("jobs", currentUser.companyId);
  const root = document.getElementById("jobsList");

  if (!currentJobs.length) {
    root.innerHTML = `<div class="muted">No jobs yet.</div>`;
    return;
  }

  root.innerHTML = currentJobs.map((job) => `
    <div class="pipeline-card">
      <div class="pipeline-head">
        <div>
          <h3 class="pipeline-name">${job.customerName || "Unnamed Job"}</h3>
          <div class="pipeline-sub">${job.serviceType || "No service type"}</div>
        </div>

        <div class="badge-row">
          <span class="status-badge ${statusClass(job.status)}">${(job.status || "scheduled").replaceAll("_", " ")}</span>
        </div>
      </div>

      <div>
        <span class="identity-chip">Tech: ${technicianLabel(job.assignedTechnician)}</span>
        <span class="identity-chip">Rep: ${repLabel(job)}</span>
        <span class="identity-chip">Created By: ${createdByLabel(job)}</span>
      </div>

      <div class="pipeline-grid">
        <div class="pipeline-box">
          <div class="pipeline-label">Customer</div>
          <div class="pipeline-value">
            ${job.customerPhone || "No phone"}<br>
            ${job.customerEmail || "No email"}
          </div>
        </div>

        <div class="pipeline-box">
          <div class="pipeline-label">Location</div>
          <div class="pipeline-value">
            ${job.address || "No address"}<br>
            ${job.city || ""} ${job.state || ""} ${job.zip || ""}
          </div>
        </div>

        <div class="pipeline-box">
          <div class="pipeline-label">Schedule</div>
          <div class="pipeline-value">
            Date: ${job.scheduledDate || "—"}<br>
            Window: ${job.scheduledTimeWindow || "—"}<br>
            Status: ${(job.status || "scheduled").replaceAll("_", " ")}
          </div>
        </div>

        <div class="pipeline-box">
          <div class="pipeline-label">Estimate</div>
          <div class="pipeline-value">
            Sq Ft: ${job.estimatedSqFt || 0}<br>
            Price: $${Number(job.estimatedPrice || 0).toFixed(2)}<br>
            Lead ID: ${job.sourceLeadId || "—"}
          </div>
        </div>
      </div>

      <div class="pipeline-actions">
        <button class="btn secondary edit-job-btn" data-id="${job.id}">Edit</button>
      </div>

      <div class="meta-line">
        Created: ${formatDate(job.createdAt)}<br>
        Updated: ${formatDate(job.updatedAt)}<br>
        Notes: ${job.notes || "—"}
      </div>
    </div>
  `).join("");

  document.querySelectorAll(".edit-job-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const selectedJob = currentJobs.find((job) => job.id === btn.dataset.id);
      if (!selectedJob) return;

      editingJobId = selectedJob.id;
      fillJobForm(selectedJob);
      document.getElementById("jobMsg").textContent = "";
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
          <p class="muted">Your role does not have access to the Jobs module.</p>
        </div>
      </div>
    `;
    return;
  }

  await bindTopbar(user);
  document.getElementById("sidebar").innerHTML = renderSidebar(user.role, "jobs");

  currentUsers = await fetchUsersByCompany(user.companyId);
  await loadTechnicians();
  await renderJobs();

  document.getElementById("closeJobModalBtn").addEventListener("click", () => closeModal("jobModal"));

  document.getElementById("saveJobBtn").addEventListener("click", async () => {
    const msg = document.getElementById("jobMsg");

    if (!editingJobId) {
      msg.textContent = "No job selected.";
      return;
    }

    try {
      await updateDoc(doc(db, "jobs", editingJobId), {
        customerName: document.getElementById("jobCustomerName").value.trim(),
        customerPhone: document.getElementById("jobCustomerPhone").value.trim(),
        customerEmail: document.getElementById("jobCustomerEmail").value.trim(),
        address: document.getElementById("jobAddress").value.trim(),
        city: document.getElementById("jobCity").value.trim(),
        state: document.getElementById("jobState").value,
        zip: document.getElementById("jobZip").value.trim(),
        serviceType: document.getElementById("jobServiceType").value.trim(),
        assignedTechnician: document.getElementById("jobAssignedTechnician").value,
        scheduledDate: document.getElementById("jobScheduledDate").value,
        scheduledTimeWindow: document.getElementById("jobScheduledTimeWindow").value,
        estimatedSqFt: Number(document.getElementById("jobEstimatedSqFt").value || 0),
        estimatedPrice: Number(document.getElementById("jobEstimatedPrice").value || 0),
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