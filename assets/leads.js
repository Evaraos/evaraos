import {
  bindTopbar,
  requireAuth,
  fetchCompanyCollection,
  fetchActiveSalesReps,
  fetchActiveTechnicians,
  fetchUsersByCompany,
  renderSidebar,
  roleGuard,
  createLead,
  updateLead,
  convertLeadToJob,
  archiveLead,
  requestDeleteLead,
  approveDeleteLead,
  SERVICE_LIBRARY,
  ADD_ONS,
  calculateLeadEstimate
} from "./app.js";

let currentUser = null;
let editingLeadId = null;
let convertingLeadId = null;
let currentSalesReps = [];
let currentTechnicians = [];
let currentLeads = [];
let currentUsers = [];

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

function getSelectedAddOns() {
  return Array.from(document.getElementById("leadAddOns").selectedOptions).map((opt) => opt.value);
}

function getServiceLabel(category, type) {
  const service = (SERVICE_LIBRARY[category] || []).find((s) => s.id === type);
  return service ? service.label : "";
}

function refreshServiceTypeOptions() {
  const category = document.getElementById("leadServiceCategory").value;
  const typeSelect = document.getElementById("leadServiceType");
  const items = SERVICE_LIBRARY[category] || [];

  typeSelect.innerHTML = `
    <option value="">Select Service</option>
    ${items.map((item) => `<option value="${item.id}">${item.label}</option>`).join("")}
  `;
}

function updateEstimateField() {
  const category = document.getElementById("leadServiceCategory").value;
  const type = document.getElementById("leadServiceType").value;
  const qty = document.getElementById("leadEstimatedSqFt").value;
  const addOns = getSelectedAddOns();

  const estimate = calculateLeadEstimate(category, type, qty, addOns);
  document.getElementById("leadEstimatedPrice").value = estimate ? `$${estimate.toFixed(2)}` : "";
}

function getLeadFormData() {
  const serviceCategory = document.getElementById("leadServiceCategory").value;
  const serviceType = document.getElementById("leadServiceType").value;
  const addOns = getSelectedAddOns();
  const estimatedSqFt = document.getElementById("leadEstimatedSqFt").value;
  const estimatedPrice = calculateLeadEstimate(serviceCategory, serviceType, estimatedSqFt, addOns);

  return {
    fullName: document.getElementById("leadFullName").value.trim(),
    phone: document.getElementById("leadPhone").value.trim(),
    email: document.getElementById("leadEmail").value.trim(),
    address: document.getElementById("leadAddress").value.trim(),
    city: document.getElementById("leadCity").value.trim(),
    state: document.getElementById("leadState").value,
    zip: document.getElementById("leadZip").value.trim(),
    serviceCategory,
    serviceType,
    serviceLabel: getServiceLabel(serviceCategory, serviceType),
    addOns,
    leadSource: document.getElementById("leadLeadSource").value,
    preferredContactMethod: document.getElementById("leadPreferredContactMethod").value,
    estimatedSqFt,
    estimatedPrice,
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
  document.getElementById("leadServiceCategory").value = lead.serviceCategory || "";
  refreshServiceTypeOptions();
  document.getElementById("leadServiceType").value = lead.serviceType || "";

  Array.from(document.getElementById("leadAddOns").options).forEach((option) => {
    option.selected = Array.isArray(lead.addOns) ? lead.addOns.includes(option.value) : false;
  });

  document.getElementById("leadLeadSource").value = lead.leadSource || "";
  document.getElementById("leadPreferredContactMethod").value = lead.preferredContactMethod || "";
  document.getElementById("leadEstimatedSqFt").value = lead.estimatedSqFt || "";
  document.getElementById("leadEstimatedPrice").value = lead.estimatedPrice ? `$${Number(lead.estimatedPrice).toFixed(2)}` : "";
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
  document.getElementById("leadServiceCategory").value = "";
  refreshServiceTypeOptions();
  document.getElementById("leadServiceType").value = "";
  Array.from(document.getElementById("leadAddOns").options).forEach((option) => option.selected = false);
  document.getElementById("leadLeadSource").value = "";
  document.getElementById("leadPreferredContactMethod").value = "";
  document.getElementById("leadEstimatedSqFt").value = "";
  document.getElementById("leadEstimatedPrice").value = "";
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

function findUserById(id) {
  return currentUsers.find((u) => u.id === id) || null;
}

function formatHandleFromUser(user) {
  return user?.handle || (user?.username ? `@${user.username}` : "@user");
}

function formatDisplayNameFromUser(user) {
  return user?.displayUsername || user?.username || user?.name || "User";
}

function repName(value) {
  const rep = findUserById(value);
  if (!rep) return "—";
  return `${rep.name || formatDisplayNameFromUser(rep)} • ${formatHandleFromUser(rep)}`;
}

function creatorName(email) {
  if (!email) return "—";
  const creator = currentUsers.find((u) => u.email === email);
  if (!creator) return email;
  return `${creator.name || formatDisplayNameFromUser(creator)} • ${formatHandleFromUser(creator)}`;
}

function formatAddOns(addOns = []) {
  if (!addOns.length) return "—";
  return addOns.map((id) => ADD_ONS.find((a) => a.id === id)?.label || id).join(", ");
}

async function loadAssignedRepOptions() {
  currentSalesReps = await fetchActiveSalesReps(currentUser.companyId);
  const select = document.getElementById("leadAssignedRep");

  select.innerHTML = `
    <option value="">Assigned Sales Rep</option>
    ${currentSalesReps.map((rep) => {
      const handle = rep.handle || (rep.username ? `@${rep.username}` : "@user");
      const label = rep.name || rep.displayUsername || rep.username || rep.email;
      return `<option value="${rep.id}">${label} • ${handle}</option>`;
    }).join("")}
  `;
}

async function loadTechnicianOptions() {
  currentTechnicians = await fetchActiveTechnicians(currentUser.companyId);
  const select = document.getElementById("convertAssignedTechnician");

  select.innerHTML = `
    <option value="">Assigned Technician</option>
    ${currentTechnicians.map((tech) => {
      const handle = tech.handle || (tech.username ? `@${tech.username}` : "@user");
      const label = tech.name || tech.displayUsername || tech.username || tech.email;
      return `<option value="${tech.id}">${label} • ${handle}</option>`;
    }).join("")}
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
          Category: ${lead.serviceCategory || "—"}<br>
          Add-ons: ${formatAddOns(lead.addOns || [])}
        </div>
      </div>
      <div>
        ${lead.phone || "No phone"}<br>
        <span class="muted">${lead.email || "No email"}</span>
        <div class="meta-line">
          Source: ${prettySource(lead.leadSource)}<br>
          Rep: ${repName(lead.assignedRep)}
        </div>
      </div>
      <div>
        ${lead.address || "No address"}<br>
        <span class="muted">${lead.city || ""} ${lead.state || ""} ${lead.zip || ""}</span>
        <div class="meta-line">
          Sq Ft / Qty: ${lead.estimatedSqFt || 0}<br>
          Estimate: $${Number(lead.estimatedPrice || 0).toFixed(2)}<br>
          Status: ${lead.status || "new"}
        </div>
      </div>
      <div>
        <div class="action-row">
          <button class="btn secondary edit-lead-btn" data-id="${lead.id}">Edit</button>
          <button class="btn convert-lead-btn" data-id="${lead.id}" ${lead.convertedToJobId ? "disabled" : ""}>
            ${lead.convertedToJobId ? "Converted" : "Convert"}
          </button>
          <button class="btn secondary archive-lead-btn" data-id="${lead.id}" ${lead.isArchived ? "disabled" : ""}>
            ${lead.isArchived ? "Archived" : "Archive"}
          </button>
          <button class="btn secondary delete-lead-btn" data-id="${lead.id}">
            ${lead.deleteRequested && currentUser.role !== "admin" && currentUser.role !== "super_admin" ? "Delete Requested" : "Delete"}
          </button>
        </div>
        <div class="meta-line">
          Created By: ${creatorName(lead.createdBy)}<br>
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

  document.querySelectorAll(".archive-lead-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await archiveLead(btn.dataset.id, currentUser);
      await renderLeads();
    });
  });

  document.querySelectorAll(".delete-lead-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const selectedLead = currentLeads.find((lead) => lead.id === btn.dataset.id);
      if (!selectedLead) return;

      if (currentUser.role === "admin" || currentUser.role === "super_admin") {
        await approveDeleteLead(selectedLead.id, currentUser);
      } else {
        await requestDeleteLead(selectedLead.id, currentUser);
      }

      await renderLeads();
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

  currentUsers = await fetchUsersByCompany(user.companyId);
  await loadAssignedRepOptions();
  await loadTechnicianOptions();
  refreshServiceTypeOptions();
  await renderLeads();

  document.getElementById("leadServiceCategory").addEventListener("change", () => {
    refreshServiceTypeOptions();
    updateEstimateField();
  });
  document.getElementById("leadServiceType").addEventListener("change", updateEstimateField);
  document.getElementById("leadEstimatedSqFt").addEventListener("input", updateEstimateField);
  document.getElementById("leadAddOns").addEventListener("change", updateEstimateField);

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

    if (!data.fullName || !data.phone || !data.address || !data.serviceCategory || !data.serviceType) {
      msg.textContent = "Name, phone, address, service category, and service type are required.";
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