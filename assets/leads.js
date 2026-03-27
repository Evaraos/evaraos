import {
  bindTopbar,
  requireAuth,
  fetchCompanyCollection,
  fetchActiveSalesReps,
  renderSidebar,
  roleGuard,
  createLead,
  updateLead
} from "./app.js";

let currentUser = null;
let editingLeadId = null;
let currentSalesReps = [];

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

function prettyRep(value) {
  const rep = currentSalesReps.find((r) => r.id === value);
  return rep ? rep.fullName : "—";
}

async function loadAssignedRepOptions() {
  currentSalesReps = await fetchActiveSalesReps(currentUser.companyId);
  const select = document.getElementById("leadAssignedRep");

  select.innerHTML = `
    <option value="">Assigned Sales Rep</option>
    ${currentSalesReps.map((rep) => `<option value="${rep.id}">${rep.fullName}</option>`).join("")}
  `;
}

async function renderLeads() {
  const leads = await fetchCompanyCollection("leads", currentUser.companyId);
  const leadsList = document.getElementById("leadsList");

  if (!leads.length) {
    leadsList.innerHTML = `<div class="muted">No leads yet.</div>`;
    return;
  }

  leadsList.innerHTML = leads.map((lead) => `
    <div class="row">
      <div>
        <strong>${lead.fullName || "Unnamed Lead"}</strong><br>
        <span class="muted">${lead.serviceInterest || "No service selected"}</span>
        <div class="meta-line">
          Source: ${prettySource(lead.leadSource)}<br>
          Rep: ${prettyRep(lead.assignedRep)}
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
        <button class="btn secondary edit-lead-btn" data-id="${lead.id}">Edit</button>
        <div class="meta-line">
          Created: ${formatDate(lead.createdAt)}<br>
          Updated: ${formatDate(lead.updatedAt)}
        </div>
      </div>
    </div>
  `).join("");

  document.querySelectorAll(".edit-lead-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const selectedLead = leads.find((lead) => lead.id === btn.dataset.id);
      if (!selectedLead) return;

      editingLeadId = selectedLead.id;
      fillLeadForm(selectedLead);
      document.getElementById("cancelLeadEditBtn").style.display = "inline-flex";
      document.getElementById("leadMsg").textContent = `Editing ${selectedLead.fullName || "lead"}`;
      openModal("leadModal");
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
});