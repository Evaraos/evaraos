import {
  bindTopbar,
  requireAuth,
  fetchCompanyCollection,
  fetchActiveSalesReps,
  fetchActiveTechnicians,
  renderSidebar,
  roleGuard,
  createLead,
  updateLead,
  convertLeadToJob
} from "./app.js";

let currentUser = null;
let editingLeadId = null;
let convertingLeadId = null;
let currentSalesReps = [];
let currentTechnicians = [];
let currentLeads = [];

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

function getLeadFormData() {
  return {
    fullName: document.getElementById("leadFullName").value.trim(),
    phone: document.getElementById("leadPhone").value.trim(),
    email: document.getElementById("leadEmail").value.trim(),
    address: document.getElementById("leadAddress").value.trim(),
    city: document.getElementById("leadCity").value.trim(),
    state: document.getElementById("leadState").value,
    zip: document.getElementById("leadZip").value.trim(),
    serviceInterest: document.getElementById("leadServiceInterest").value.trim(),
    leadSource: document.getElementById("leadSource").value,
    preferredContactMethod: document.getElementById("leadPreferredContactMethod").value,
    estimatedSqFt: document.getElementById("leadEstimatedSqFt").value,
    assignedRep: document.getElementById("leadAssignedRep").value,
    status: document.getElementById("leadStatus").value,
    appointmentDate: document.getElementById("leadAppointmentDate").value,
    notes: document.getElementById("leadNotes").value.trim()
  };
}

function fillLeadForm(lead) {
  document.getElementById("leadFullName").value = lead.fullName || "";
  document.getElementById("leadPhone").value = lead.phone || "";
  document.getElementById("leadEmail").value = lead.email || "";
  document.getElementById("leadAddress").value = lead.address || "";
  document.getElementById("leadCity").value = lead.city || "";
  document.getElementById("leadState").value = lead.state || "";
  document.getElementById("leadZip").value = lead.zip || "";
  document.getElementById("leadServiceInterest").value = lead.serviceInterest || "";
  document.getElementById("leadSource").value = lead.leadSource || "";
  document.getElementById("leadPreferredContactMethod").value = lead.preferredContactMethod || "";
  document.getElementById("leadEstimatedSqFt").value = lead.estimatedSqFt || "";
  document.getElementById("leadAssignedRep").value = lead.assignedRep || "";
  document.getElementById("leadStatus").value = lead.status || "new";
  document.getElementById("leadAppointmentDate").value = lead.appointmentDate || "";
  document.getElementById("leadNotes").value = lead.notes || "";
}

function clearLeadForm() {
  editingLeadId = null;
  document.getElementById("leadFullName").value = "";
  document.getElementById("leadPhone").value = "";
  document.getElementById("leadEmail").value = "";
  document.getElementById("leadAddress").value = "";
  document.getElementById("leadCity").value = "";
  document.getElementById("leadState").value = "";
  document.getElementById("leadZip").value = "";
  document.getElementById("leadServiceInterest").value = "";
  document.getElementById("leadSource").value = "";
  document.getElementById("leadPreferredContactMethod").value = "";
  document.getElementById("leadEstimatedSqFt").value = "";
  document.getElementById("leadAssignedRep").value = "";
  document.getElementById("leadStatus").value = "new";
  document.getElementById("leadAppointmentDate").value = "";
  document.getElementById("leadNotes").value = "";
  document.getElementById("cancelLeadEditBtn").style.display = "none";
  document.getElementById("leadMsg").textContent = "";
}

function prettySource(value) {
  const map = {
    website: "🌐 Website",
    referral: "🤝 Referral",
    door_to_door: "🚪 Door to Door",
    facebook: "📘 Facebook",
    instagram: "📸 Instagram",
    x_twitter: "🐦 X / Twitter",
    tiktok: "🎵 TikTok",
    google: "🔎 Google",
    yelp: "⭐ Yelp",
    phone_call: "📞 Phone Call",
    other: "➕ Other"
  };
  return map[value] || "—";
}

function repName(value) {
  const rep = currentSalesReps.find((r) => r.id === value);
  return rep ? rep.fullName : "—";
}

function techName(value) {
  const tech = currentTechnicians.find((r) => r.id === value);
  return tech ? (tech.name || tech.email) : "—";
}

async function loadAssignedRepOptions() {
  currentSalesReps = await fetchActiveSalesReps(currentUser.companyId);
  const select = document.getElementById("leadAssignedRep");

  select.innerHTML = `
    <option value="">Assigned Sales Rep</option>
    ${currentSalesReps.map((rep) => `<option value="${rep.id}">${rep.fullName}</option>`).join("")}
  `;
}

async function loadTechnicianOptions() {
  currentTechnicians = await fetchActiveTechnicians(currentUser.companyId);
  const select = document.getElementById("convertAssignedTechnician");

  select.innerHTML = `
    <option value="">Assigned Technician</option>
    ${currentTechnicians.map((tech) => `<option value="${tech.id}">${tech.name || tech.email}</option>`).join("")}
  `;
}

async function renderLeads() {
  currentLeads = await fetchCompanyCollection("leads", currentUser.companyId);
  const leadsList = document.getElementById("leadsList");

  if (!currentLeads.length) {
    leadsList.innerHTML = `<div class="muted">No leads yet.</div>`;
    return;
  }

  leadsList.innerHTML = currentLeads.map((lead) => `
    <div class="row">
      <div>
        <strong>${lead.fullName || "Unnamed Lead"}</strong><br>
        <span class="muted">${lead.serviceInterest || "No service selected"}</span>
        <div class="meta-line">
          Source: ${prettySource(lead.leadSource)}<br>
          Rep: ${repName(lead.assignedRep)}
        </div>
      </div>
      <div>
        ${lead.phone || "No phone"}<br>
        <span class="muted">${lead.email || "No email"}</span>
        <div class="meta-line">
          Contact: ${lead.preferredContactMethod || "—"}<br>
          Sq Ft: ${lead.estimatedSqFt || 0}
        </div>
      </div>
      <div>
        ${lead.address || "No address"}<br>
        <span class="muted">${lead.city || ""} ${lead.state || ""} ${lead.zip || ""}</span>
        <div class="meta-line">
          Status: ${lead.status || "new"}<br>
          Appointment: ${lead.appointmentDate || "—"}
        </div>
      </div>
      <div>
        <div class="action-row">
          <button class="btn secondary edit-lead-btn" data-id="${lead.id}">Edit</button>
          <button class="btn convert-lead-btn" data-id="${lead.id}" ${lead.convertedToJobId ? "disabled" : ""}>
            ${lead.convertedToJobId ? "Converted" : "Convert"}
          </button>
        </div>
        <div class="meta-line">
          Created: ${formatDate(lead.createdAt)}<br>
          Updated: ${formatDate(lead.updatedAt)}<br>
          Job: ${lead.convertedToJobId || "—"}
        </div>
      </div>
    </div>
  `).join("");

  document.querySelectorAll(".edit-lead-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const selectedLead = currentLeads.find((lead) => lead.id === btn.dataset.id);
      if (!selectedLead) return;

      editingLeadId = selectedLead.id;
      fillLeadForm(selectedLead);
      document.getElementById("cancelLeadEditBtn").style.display = "inline-flex";
      document.getElementById("leadMsg").textContent = `Editing ${selectedLead.fullName || "lead"}`;
      openModal("leadModal");
    });
  });

  document.querySelectorAll(".convert-lead-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const selectedLead = currentLeads.find((lead) => lead.id === btn.dataset.id);
      if (!selectedLead || selectedLead.convertedToJobId) return;

      convertingLeadId = selectedLead.id;
      document.getElementById("convertCustomerName").value = selectedLead.fullName || "";
      document.getElementById("convertServiceType").value = selectedLead.serviceInterest || "";
      document.getElementById("convertAssignedTechnician").value = "";
      document.getElementById("convertScheduledDate").value = selectedLead.appointmentDate || "";
      document.getElementById("convertScheduledTimeWindow").value = "";
      document.getElementById("convertNotes").value = selectedLead.notes || "";
      document.getElementById("convertMsg").textContent = "";
      openModal("convertModal");
    });
  });
}

requireAuth(async (user) => {
  currentUser = user;

  if (!roleGuard(user, "leads")) {
    document.body.innerHTML = `
      <div class="auth-shell">
        <div class="auth-card">
          <h2>Access denied</h2>
          <p class="muted">Your role does not have access to the Leads module.</p>
        </div>
      </div>
    `;
    return;
  }

  await bindTopbar(user);
  document.getElementById("sidebar").innerHTML = renderSidebar(user.role, "leads");

  await loadAssignedRepOptions();
  await loadTechnicianOptions();
  await renderLeads();

  document.getElementById("openLeadModalBtn").addEventListener("click", async () => {
    clearLeadForm();
    await loadAssignedRepOptions();
    openModal("leadModal");
  });

  document.getElementById("closeLeadModalBtn").addEventListener("click", () => closeModal("leadModal"));
  document.getElementById("cancelLeadEditBtn").addEventListener("click", () => {
    clearLeadForm();
    closeModal("leadModal");
  });

  document.getElementById("closeConvertModalBtn").addEventListener("click", () => closeModal("convertModal"));

  document.getElementById("saveLeadBtn").addEventListener("click", async () => {
    const msg = document.getElementById("leadMsg");
    const data = getLeadFormData();

    if (!data.fullName || !data.phone || !data.address) {
      msg.textContent = "Full name, phone, and address are required.";
      return;
    }

    try {
      if (editingLeadId) {
        await updateLead(editingLeadId, data);
        msg.textContent = "Lead updated successfully.";
      } else {
        await createLead(data, currentUser);
        msg.textContent = "Lead created successfully.";
      }

      await renderLeads();
      clearLeadForm();
      closeModal("leadModal");
    } catch (e) {
      msg.textContent = e.message || "Failed to save lead.";
    }
  });

  document.getElementById("confirmConvertBtn").addEventListener("click", async () => {
    const msg = document.getElementById("convertMsg");
    const lead = currentLeads.find((item) => item.id === convertingLeadId);

    if (!lead) {
      msg.textContent = "Lead not found.";
      return;
    }

    try {
      await convertLeadToJob(lead, {
        serviceType: document.getElementById("convertServiceType").value.trim(),
        assignedTechnician: document.getElementById("convertAssignedTechnician").value,
        scheduledDate: document.getElementById("convertScheduledDate").value,
        scheduledTimeWindow: document.getElementById("convertScheduledTimeWindow").value,
        notes: document.getElementById("convertNotes").value.trim()
      }, currentUser);

      msg.textContent = "Lead converted to job successfully.";
      await renderLeads();
      closeModal("convertModal");
    } catch (e) {
      msg.textContent = e.message || "Failed to convert lead.";
    }
  });
});