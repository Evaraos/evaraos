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

const leadState = {
  user: null,
  leads: [],
  reps: [],
  technicians: [],
  editingId: null,
  convertingId: null
};

function showToast(message, variant = "success") {
  let container = document.getElementById("leadsToastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "leadsToastContainer";
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

function safeMoney(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD"
  });
}

function computeEstimate() {
  const qty = Number(document.getElementById("leadEstimatedSqFt")?.value || 0);
  const serviceType = document.getElementById("leadServiceType")?.value || "";
  let rate = 1;

  if (serviceType.toLowerCase().includes("bin")) rate = 25;
  if (serviceType.toLowerCase().includes("pressure")) rate = 0.2;
  if (serviceType.toLowerCase().includes("house")) rate = 0.18;

  const total = qty * rate;
  const preview = document.getElementById("leadEstimatePreview");
  if (preview) preview.textContent = `Estimated price: ${safeMoney(total)}`;
  return total;
}

async function loadLeads(user) {
  leadState.user = user;

  const allUsers = ["super_admin", "owner", "admin"].includes(user.role)
    ? await fetchAllCollection("users", { max: 500 })
    : await fetchUsersByCompany(user.companyId);

  leadState.reps = allUsers.filter(item => item.role === "sales_rep");
  leadState.technicians = allUsers.filter(item =>
    ["technician", "tech"].includes(String(item.role || "").toLowerCase())
  );

  const allLeads = await fetchAllCollection("leads", { max: 500 });

  if (["super_admin", "owner", "admin"].includes(user.role)) {
    leadState.leads = allLeads;
  } else {
    leadState.leads = allLeads.filter(item => item.companyId === user.companyId);
  }

  populateLeadSelects();
}

function populateLeadSelects() {
  const repSelect = document.getElementById("leadAssignedRep");
  const categorySelect = document.getElementById("leadCategory");
  const serviceSelect = document.getElementById("leadServiceType");
  const convertTech = document.getElementById("convertTechnician");
  const addOnsWrap = document.getElementById("leadAddOnsWrap");

  if (repSelect) {
    repSelect.innerHTML = `<option value="">Select rep</option>` + leadState.reps.map(rep => `
      <option value="${rep.id}">${rep.name || rep.email || rep.username}</option>
    `).join("");
  }

  if (categorySelect) {
    categorySelect.innerHTML = `
      <option value="">Select category</option>
      <option value="exterior_cleaning">Exterior Cleaning</option>
      <option value="bin_cleaning">Bin Cleaning</option>
      <option value="pressure_washing">Pressure Washing</option>
      <option value="house_washing">House Washing</option>
    `;
  }

  if (serviceSelect) {
    serviceSelect.innerHTML = `
      <option value="">Select service</option>
      <option value="Trash Bin Cleaning">Trash Bin Cleaning</option>
      <option value="Pressure Washing">Pressure Washing</option>
      <option value="House Washing">House Washing</option>
    `;
  }

  if (convertTech) {
    convertTech.innerHTML = `<option value="">Select technician</option>` + leadState.technicians.map(tech => `
      <option value="${tech.id}">${tech.name || tech.email || tech.username}</option>
    `).join("");
  }

  if (addOnsWrap) {
    const addOns = ["Deodorizer", "Deep Clean", "Sidewalk", "Driveway", "Patio"];
    addOnsWrap.innerHTML = addOns.map(item => `
      <label class="chip">
        <input type="checkbox" value="${item}" class="lead-addon-checkbox" style="margin-right:8px;" />
        ${item}
      </label>
    `).join("");
  }
}

function openLeadModal(lead = null) {
  leadState.editingId = lead?.id || null;
  document.getElementById("leadModal")?.classList.add("open");
  document.getElementById("leadModalTitle").textContent = lead ? "Edit Lead" : "Add Lead";

  document.getElementById("leadFullName").value = lead?.fullName || "";
  document.getElementById("leadPhone").value = lead?.phone || "";
  document.getElementById("leadEmail").value = lead?.email || "";
  document.getElementById("leadAssignedRep").value = lead?.assignedRep || "";
  document.getElementById("leadAddress").value = lead?.address || "";
  document.getElementById("leadCity").value = lead?.city || "";
  document.getElementById("leadState").value = lead?.state || "";
  document.getElementById("leadZip").value = lead?.zip || "";
  document.getElementById("leadCategory").value = lead?.category || "";
  document.getElementById("leadServiceType").value = lead?.serviceType || "";
  document.getElementById("leadEstimatedSqFt").value = lead?.estimatedSqFt || "";
  document.getElementById("leadStatus").value = lead?.status || "new";
  document.getElementById("leadLeadSource").value = lead?.leadSource || "";
  document.getElementById("leadContactMethod").value = lead?.contactMethod || "";
  document.getElementById("leadAppointmentDate").value = lead?.appointmentDate || "";
  document.getElementById("leadNotes").value = lead?.notes || "";

  document.querySelectorAll(".lead-addon-checkbox").forEach(box => {
    box.checked = Array.isArray(lead?.addOns) ? lead.addOns.includes(box.value) : false;
  });

  computeEstimate();
}

function closeLeadModal() {
  document.getElementById("leadModal")?.classList.remove("open");
  leadState.editingId = null;
}

function openConvertModal(leadId) {
  leadState.convertingId = leadId;
  document.getElementById("convertLeadId").value = leadId;
  document.getElementById("convertModal")?.classList.add("open");
}

function closeConvertModal() {
  document.getElementById("convertModal")?.classList.remove("open");
  leadState.convertingId = null;
}

function renderLeads() {
  const root = document.getElementById("leadsRoot");
  if (!root) return;

  root.innerHTML = `
    <section class="glass-card aurora-card shine-border">
      <div class="section-title-row">
        <div>
          <h2 style="margin:0;">Lead Pipeline</h2>
          <p class="muted" style="margin:8px 0 0;">Capture leads, assign reps, price services, and convert leads into jobs.</p>
        </div>
        <div class="top-actions">
          <button class="btn" id="openLeadModalBtn" type="button">Add Lead</button>
        </div>
      </div>

      ${
        !leadState.leads.length
          ? `<div class="muted" style="padding-top:16px;">No leads found.</div>`
          : `
            <div class="quick-links-grid" style="margin-top:18px;">
              ${leadState.leads.map(lead => `
                <div class="quick-link-card aurora-card shine-border" style="display:block; min-height:auto;">
                  <div>
                    <strong>${lead.fullName || "Unnamed Lead"}</strong>
                    <div class="muted" style="margin-top:8px;">
                      ${lead.email || "No email"}<br>
                      ${lead.phone || "No phone"}<br>
                      ${lead.address || "No address"}
                    </div>
                  </div>

                  <div style="margin-top:12px;">
                    <span class="chip">${lead.status || "new"}</span>
                    <span class="chip">${lead.serviceType || "service"}</span>
                    <span class="chip">${lead.leadSource || "source"}</span>
                  </div>

                  <div class="muted" style="margin-top:12px;">
                    Estimate: ${safeMoney(lead.estimatedPrice || 0)}
                  </div>

                  <div class="top-actions" style="margin-top:14px;">
                    <button class="btn btn-secondary edit-lead-btn" data-id="${lead.id}" type="button">Edit</button>
                    <button class="btn btn-secondary convert-lead-btn" data-id="${lead.id}" type="button">Convert</button>
                  </div>
                </div>
              `).join("")}
            </div>
          `
      }
    </section>
  `;

  document.getElementById("openLeadModalBtn")?.addEventListener("click", () => openLeadModal());

  document.querySelectorAll(".edit-lead-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const lead = leadState.leads.find(item => item.id === btn.dataset.id);
      openLeadModal(lead);
    });
  });

  document.querySelectorAll(".convert-lead-btn").forEach(btn => {
    btn.addEventListener("click", () => openConvertModal(btn.dataset.id));
  });
}

async function saveLead(e) {
  e.preventDefault();

  const addOns = [...document.querySelectorAll(".lead-addon-checkbox:checked")].map(item => item.value);
  const estimatedPrice = computeEstimate();

  const payload = {
    fullName: document.getElementById("leadFullName").value.trim(),
    phone: document.getElementById("leadPhone").value.trim(),
    email: document.getElementById("leadEmail").value.trim().toLowerCase(),
    assignedRep: document.getElementById("leadAssignedRep").value,
    address: document.getElementById("leadAddress").value.trim(),
    city: document.getElementById("leadCity").value.trim(),
    state: document.getElementById("leadState").value.trim(),
    zip: document.getElementById("leadZip").value.trim(),
    category: document.getElementById("leadCategory").value,
    serviceType: document.getElementById("leadServiceType").value,
    estimatedSqFt: Number(document.getElementById("leadEstimatedSqFt").value || 0),
    estimatedPrice,
    status: document.getElementById("leadStatus").value,
    leadSource: document.getElementById("leadLeadSource").value,
    contactMethod: document.getElementById("leadContactMethod").value,
    appointmentDate: document.getElementById("leadAppointmentDate").value,
    addOns,
    notes: document.getElementById("leadNotes").value.trim(),
    companyId: leadState.user.companyId || ""
  };

  if (!payload.fullName) {
    showToast("Lead name is required.", "error");
    return;
  }

  try {
    if (leadState.editingId) {
      await updateDocument("leads", leadState.editingId, payload);
      showToast("Lead updated.");
    } else {
      await createDocument("leads", payload);
      showToast("Lead created.");
    }

    closeLeadModal();
    await loadLeads(leadState.user);
    renderLeads();
  } catch (error) {
    console.error(error);
    showToast(error.message || "Could not save lead.", "error");
  }
}

async function convertLead(e) {
  e.preventDefault();

  const leadId = document.getElementById("convertLeadId").value;
  const lead = leadState.leads.find(item => item.id === leadId);

  if (!lead) {
    showToast("Lead not found.", "error");
    return;
  }

  const payload = {
    customerName: lead.fullName || "",
    customerPhone: lead.phone || "",
    customerEmail: lead.email || "",
    address: lead.address || "",
    city: lead.city || "",
    state: lead.state || "",
    zip: lead.zip || "",
    serviceType: lead.serviceType || "",
    assignedTechnician: document.getElementById("convertTechnician").value,
    scheduledDate: document.getElementById("convertScheduledDate").value,
    scheduledTimeWindow: document.getElementById("convertTimeWindow").value,
    notes: document.getElementById("convertNotes").value.trim(),
    estimatedPrice: lead.estimatedPrice || 0,
    status: "scheduled",
    companyId: lead.companyId || leadState.user.companyId || "",
    sourceLeadId: lead.id
  };

  try {
    await createDocument("jobs", payload);
    await updateDocument("leads", lead.id, { status: "won" });
    closeConvertModal();
    await loadLeads(leadState.user);
    renderLeads();
    showToast("Lead converted to job.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Could not convert lead.", "error");
  }
}

requireAuth(async (user) => {
  await bindTopbar(user, "Leads");

  const sidebar = document.getElementById("sidebar");
  if (sidebar) {
    sidebar.innerHTML = renderSidebar(user.role, "leads");
  }

  if (!canAccess(user.role, "leads")) {
    document.getElementById("leadsRoot").innerHTML =
      `<section class="glass-card aurora-card shine-border">Access denied.</section>`;
    return;
  }

  document.getElementById("leadsRoot").innerHTML =
    `<section class="glass-card aurora-card shine-border">Loading leads...</section>`;

  try {
    await loadLeads(user);
    renderLeads();
  } catch (error) {
    console.error(error);
    document.getElementById("leadsRoot").innerHTML =
      `<section class="glass-card aurora-card shine-border">Leads page failed: ${error.message || error}</section>`;
  }

  document.getElementById("leadModalCloseBtn")?.addEventListener("click", closeLeadModal);
  document.getElementById("leadModalCancelBtn")?.addEventListener("click", closeLeadModal);
  document.getElementById("leadForm")?.addEventListener("submit", saveLead);

  document.getElementById("convertModalCloseBtn")?.addEventListener("click", closeConvertModal);
  document.getElementById("convertModalCancelBtn")?.addEventListener("click", closeConvertModal);
  document.getElementById("convertForm")?.addEventListener("submit", convertLead);

  document.getElementById("leadEstimatedSqFt")?.addEventListener("input", computeEstimate);
  document.getElementById("leadServiceType")?.addEventListener("change", computeEstimate);
});