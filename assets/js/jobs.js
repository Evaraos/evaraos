import {
  bindTopbar,
  requireAuth,
  renderSidebar,
  fetchAllCollection,
  fetchUsersByCompany,
  createDocument,
  updateDocument
} from "./app.js";

import { canAccess } from "./roles.js";

const jobState = {
  user: null,
  jobs: [],
  technicians: [],
  editingId: null
};

function showToast(message, variant = "success") {
  let container = document.getElementById("jobsToastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "jobsToastContainer";
    container.style.position = "fixed";
    container.style.top = "20px";
    container.style.right = "20px";
    container.style.zIndex = "9999";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "10px";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.padding = "14px 16px";
  toast.style.borderRadius = "16px";
  toast.style.background = variant === "error" ? "rgba(180,40,40,.94)" : "rgba(25,110,55,.94)";
  toast.style.color = "#fff";
  toast.style.boxShadow = "0 12px 30px rgba(0,0,0,.28)";
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 2600);
}

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD"
  });
}

async function loadJobs(user) {
  jobState.user = user;

  const users = ["super_admin", "owner", "admin"].includes(user.role)
    ? await fetchAllCollection("users", { max: 500 })
    : await fetchUsersByCompany(user.companyId);

  jobState.technicians = users.filter(item => ["technician", "tech"].includes(String(item.role || "").toLowerCase()));

  const allJobs = await fetchAllCollection("jobs", { max: 500 });

  if (["super_admin", "owner", "admin"].includes(user.role)) {
    jobState.jobs = allJobs;
  } else {
    jobState.jobs = allJobs.filter(item => item.companyId === user.companyId);
  }

  populateTechnicians();
}

function populateTechnicians() {
  const select = document.getElementById("jobAssignedTechnician");
  if (!select) return;

  select.innerHTML = `<option value="">Assigned Technician</option>` + jobState.technicians.map(tech => `
    <option value="${tech.id}">${tech.name || tech.email || tech.username}</option>
  `).join("");
}

function openJobModal(job = null) {
  jobState.editingId = job?.id || null;
  document.getElementById("jobModal")?.classList.add("open");
  document.getElementById("jobModalTitle").textContent = job ? "Edit Job" : "Add Job";

  document.getElementById("jobCustomerName").value = job?.customerName || "";
  document.getElementById("jobCustomerPhone").value = job?.customerPhone || "";
  document.getElementById("jobCustomerEmail").value = job?.customerEmail || "";
  document.getElementById("jobAddress").value = job?.address || "";
  document.getElementById("jobCity").value = job?.city || "";
  document.getElementById("jobState").value = job?.state || "";
  document.getElementById("jobZip").value = job?.zip || "";
  document.getElementById("jobServiceType").value = job?.serviceType || "";
  document.getElementById("jobAssignedTechnician").value = job?.assignedTechnician || "";
  document.getElementById("jobScheduledDate").value = job?.scheduledDate || "";
  document.getElementById("jobScheduledTimeWindow").value = job?.scheduledTimeWindow || "";
  document.getElementById("jobEstimatedSqFt").value = job?.estimatedSqFt || "";
  document.getElementById("jobEstimatedPrice").value = job?.estimatedPrice || "";
  document.getElementById("jobStatus").value = job?.status || "scheduled";
  document.getElementById("jobNotes").value = job?.notes || "";
  document.getElementById("jobMsg").textContent = "";
}

function closeJobModal() {
  document.getElementById("jobModal")?.classList.remove("open");
  jobState.editingId = null;
  document.getElementById("jobMsg").textContent = "";
}

function renderJobs() {
  const root = document.getElementById("jobsRoot");
  if (!root) return;

  root.innerHTML = `
    <section class="glass-card aurora-card shine-border">
      <div class="section-title-row">
        <div>
          <h2 style="margin:0;">Job List</h2>
          <p class="muted" style="margin:8px 0 0;">View, edit, and schedule company jobs.</p>
        </div>
        <div class="muted">${jobState.jobs.length} job(s)</div>
      </div>

      ${
        !jobState.jobs.length
          ? `<div class="muted" style="padding-top:16px;">No jobs found.</div>`
          : `
            <div class="quick-links-grid" style="margin-top:18px;">
              ${jobState.jobs.map(job => `
                <div class="quick-link-card aurora-card shine-border" style="display:block; min-height:auto;">
                  <div>
                    <strong>${job.customerName || "Unnamed Job"}</strong>
                    <div class="muted" style="margin-top:8px;">
                      ${job.serviceType || "No service"}<br>
                      ${job.address || "No address"}<br>
                      ${job.city || ""} ${job.state || ""} ${job.zip || ""}
                    </div>
                  </div>

                  <div style="margin-top:12px;">
                    <span class="chip">${job.status || "scheduled"}</span>
                    <span class="chip">${job.scheduledTimeWindow || "no-window"}</span>
                  </div>

                  <div class="muted" style="margin-top:12px;">
                    Date: ${job.scheduledDate || "—"}<br>
                    Estimate: ${money(job.estimatedPrice || 0)}<br>
                    Tech: ${resolveTechName(job.assignedTechnician)}
                  </div>

                  <div class="top-actions" style="margin-top:14px;">
                    <button class="btn btn-secondary edit-job-btn" data-id="${job.id}" type="button">Edit</button>
                  </div>
                </div>
              `).join("")}
            </div>
          `
      }
    </section>
  `;

  document.querySelectorAll(".edit-job-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const job = jobState.jobs.find(item => item.id === btn.dataset.id);
      openJobModal(job);
    });
  });

  document.getElementById("openJobModalBtn")?.addEventListener("click", () => openJobModal());
}

function resolveTechName(id) {
  if (!id) return "—";
  const tech = jobState.technicians.find(item => item.id === id);
  return tech?.name || tech?.email || tech?.username || id;
}

async function saveJob(e) {
  e.preventDefault();

  const payload = {
    customerName: document.getElementById("jobCustomerName").value.trim(),
    customerPhone: document.getElementById("jobCustomerPhone").value.trim(),
    customerEmail: document.getElementById("jobCustomerEmail").value.trim().toLowerCase(),
    address: document.getElementById("jobAddress").value.trim(),
    city: document.getElementById("jobCity").value.trim(),
    state: document.getElementById("jobState").value.trim(),
    zip: document.getElementById("jobZip").value.trim(),
    serviceType: document.getElementById("jobServiceType").value.trim(),
    assignedTechnician: document.getElementById("jobAssignedTechnician").value,
    scheduledDate: document.getElementById("jobScheduledDate").value,
    scheduledTimeWindow: document.getElementById("jobScheduledTimeWindow").value,
    estimatedSqFt: Number(document.getElementById("jobEstimatedSqFt").value || 0),
    estimatedPrice: Number(document.getElementById("jobEstimatedPrice").value || 0),
    status: document.getElementById("jobStatus").value,
    notes: document.getElementById("jobNotes").value.trim(),
    companyId: jobState.user.companyId || ""
  };

  if (!payload.customerName) {
    document.getElementById("jobMsg").textContent = "Customer name is required.";
    return;
  }

  if (!payload.serviceType) {
    document.getElementById("jobMsg").textContent = "Service type is required.";
    return;
  }

  try {
    if (jobState.editingId) {
      await updateDocument("jobs", jobState.editingId, payload);
      showToast("Job updated.");
    } else {
      await createDocument("jobs", payload);
      showToast("Job created.");
    }

    closeJobModal();
    await loadJobs(jobState.user);
    renderJobs();
  } catch (error) {
    console.error(error);
    document.getElementById("jobMsg").textContent = error.message || "Could not save job.";
    showToast(error.message || "Could not save job.", "error");
  }
}

requireAuth(async (user) => {
  await bindTopbar(user, "Jobs");

  const sidebar = document.getElementById("sidebar");
  if (sidebar) {
    sidebar.innerHTML = renderSidebar(user.role, "jobs");
  }

  if (!canAccess(user.role, "jobs")) {
    document.getElementById("jobsRoot").innerHTML =
      `<section class="glass-card aurora-card shine-border">Access denied.</section>`;
    return;
  }

  document.getElementById("jobsRoot").innerHTML =
    `<section class="glass-card aurora-card shine-border">Loading jobs...</section>`;

  try {
    await loadJobs(user);
    renderJobs();
  } catch (error) {
    console.error(error);
    document.getElementById("jobsRoot").innerHTML =
      `<section class="glass-card aurora-card shine-border">Jobs page failed: ${error.message || error}</section>`;
  }

  document.getElementById("closeJobModalBtn")?.addEventListener("click", closeJobModal);
  document.getElementById("cancelJobModalBtn")?.addEventListener("click", closeJobModal);
  document.getElementById("jobForm")?.addEventListener("submit", saveJob);
});