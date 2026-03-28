import {
  bindTopbar,
  requireAuth,
  fetchAllCollection,
  fetchCompanyCollection,
  fetchActiveSalesReps,
  fetchActiveTechnicians,
  sanitizeCompanyId,
  calculateLeadEstimate,
  SERVICE_LIBRARY,
  ADD_ONS
} from "./app.js";

import {
  canAccess,
  canEditLead,
  canAssignLead,
  canArchiveLead,
  canRequestLeadDelete,
  canApproveLeadDelete,
  canConvertLead,
  filterLeadsForUser
} from "./roles.js";

import {
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "./firebase.js";

const state = {
  user: null,
  leads: [],
  reps: [],
  techs: [],
  activeStage: "all",
  editingLeadId: null
};

function injectLeadsStyles() {
  if (document.getElementById("leadsUpgradeStyles")) return;

  const style = document.createElement("style");
  style.id = "leadsUpgradeStyles";
  style.textContent = `
    .leads-main{
      display:flex;
      flex-direction:column;
      gap:22px;
      padding:22px;
    }
    .section-row{
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:12px;
      flex-wrap:wrap;
    }
    .stage-strip{
      display:grid;
      grid-template-columns:repeat(6,minmax(0,1fr));
      gap:12px;
      margin-top:14px;
    }
    .stage-pill{
      border:1px solid rgba(255,255,255,.08);
      background:rgba(255,255,255,.03);
      border-radius:20px;
      padding:14px;
      cursor:pointer;
      transition:.18s ease;
      text-align:center;
    }
    .stage-pill.active{
      background:linear-gradient(135deg, rgba(255,89,66,.92), rgba(255,116,66,.92));
      border-color:rgba(255,255,255,.12);
    }
    .pipeline-grid{
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:16px;
    }
    .lead-card{
      border-radius:24px;
      padding:18px;
      background:rgba(255,255,255,.03);
      border:1px solid rgba(255,255,255,.08);
      display:flex;
      flex-direction:column;
      gap:12px;
    }
    .lead-actions{
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      margin-top:4px;
    }
    .chip{
      display:inline-flex;
      padding:6px 10px;
      border-radius:999px;
      background:rgba(255,255,255,.08);
      font-size:12px;
      margin:6px 8px 0 0;
      text-transform:capitalize;
    }
    .muted{
      color:#aeb8c8;
      font-size:13px;
    }
    .empty-state{
      color:#aeb8c8;
      padding:8px 0;
    }
    .modal-backdrop{
      position:fixed;
      inset:0;
      background:rgba(0,0,0,.45);
      backdrop-filter:blur(8px);
      display:none;
      align-items:center;
      justify-content:center;
      z-index:9998;
      padding:18px;
    }
    .modal-backdrop.open{
      display:flex;
    }
    .modal-card{
      width:min(760px, 100%);
      max-height:90vh;
      overflow:auto;
      border-radius:28px;
      background:rgba(14,16,24,.96);
      border:1px solid rgba(255,255,255,.08);
      padding:22px;
      box-shadow:0 25px 60px rgba(0,0,0,.35);
    }
    .form-grid{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:14px;
      margin-top:16px;
    }
    .form-grid .full{
      grid-column:1/-1;
    }
    .field{
      display:flex;
      flex-direction:column;
      gap:8px;
    }
    .field label{
      font-size:13px;
      color:#b4bfd0;
    }
    .field input,
    .field select,
    .field textarea{
      width:100%;
      padding:14px 16px;
      border-radius:16px;
      border:1px solid rgba(255,255,255,.08);
      background:rgba(255,255,255,.04);
      color:#fff;
      outline:none;
    }
    .checkbox-grid{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:10px;
    }
    .checkbox-item{
      display:flex;
      align-items:center;
      gap:8px;
      padding:10px 12px;
      border-radius:14px;
      background:rgba(255,255,255,.03);
      border:1px solid rgba(255,255,255,.07);
    }
    .top-actions{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
    }
    @media (max-width: 1100px){
      .pipeline-grid{ grid-template-columns:repeat(2,minmax(0,1fr)); }
      .stage-strip{ grid-template-columns:repeat(3,minmax(0,1fr)); }
    }
    @media (max-width: 700px){
      .pipeline-grid{ grid-template-columns:1fr; }
      .stage-strip{ grid-template-columns:repeat(2,minmax(0,1fr)); }
      .form-grid{ grid-template-columns:1fr; }
      .checkbox-grid{ grid-template-columns:1fr; }
    }
  `;
  document.head.appendChild(style);
}

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
  toast.style.background =
    variant === "error"
      ? "rgba(180,40,40,.94)"
      : "rgba(25,110,55,.94)";
  toast.style.color = "#fff";
  toast.style.boxShadow = "0 12px 30px rgba(0,0,0,.28)";
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 2600);
}

function getStageCounts(leads) {
  const base = { new: 0, contacted: 0, quoted: 0, booked: 0, won: 0, lost: 0 };
  leads.forEach((lead) => {
    let key = String(lead.status || "new").toLowerCase();
    if (key === "scheduled") key = "booked";
    if (base[key] !== undefined) base[key] += 1;
  });
  return base;
}

function filteredLeads() {
  if (state.activeStage === "all") return state.leads;
  return state.leads.filter((lead) => {
    const status = String(lead.status || "").toLowerCase();
    const normalized = status === "scheduled" ? "booked" : status;
    return normalized === state.activeStage;
  });
}

function openModal(lead = null) {
  state.editingLeadId = lead?.id || null;
  const modal = document.getElementById("leadModal");
  modal.classList.add("open");

  document.getElementById("leadModalTitle").textContent = lead ? "Edit Lead" : "Add Lead";

  document.getElementById("leadFullName").value = lead?.fullName || "";
  document.getElementById("leadPhone").value = lead?.phone || "";
  document.getElementById("leadEmail").value = lead?.email || "";
  document.getElementById("leadAddress").value = lead?.address || "";
  document.getElementById("leadCity").value = lead?.city || "";
  document.getElementById("leadState").value = lead?.state || "";
  document.getElementById("leadZip").value = lead?.zip || "";
  document.getElementById("leadCategory").value = lead?.serviceCategory || "";
  populateServiceTypeOptions(lead?.serviceCategory || "", lead?.serviceType || "");
  document.getElementById("leadLeadSource").value = lead?.leadSource || "";
  document.getElementById("leadContactMethod").value = lead?.preferredContactMethod || "";
  document.getElementById("leadEstimatedSqFt").value = lead?.estimatedSqFt || "";
  document.getElementById("leadStatus").value = lead?.status || "new";
  document.getElementById("leadNotes").value = lead?.notes || "";
  document.getElementById("leadAppointmentDate").value = lead?.appointmentDate || "";
  document.getElementById("leadAssignedRep").value = lead?.assignedRep || "";

  const addOnIds = Array.isArray(lead?.addOns) ? lead.addOns : [];
  document.querySelectorAll('input[name="leadAddOns"]').forEach((el) => {
    el.checked = addOnIds.includes(el.value);
  });

  recalcEstimatePreview();
}

function closeModal() {
  document.getElementById("leadModal").classList.remove("open");
  state.editingLeadId = null;
}

function openConvertModal(leadId) {
  document.getElementById("convertLeadId").value = leadId;
  document.getElementById("convertScheduledDate").value = "";
  document.getElementById("convertTimeWindow").value = "";
  document.getElementById("convertTechnician").value = "";
  document.getElementById("convertNotes").value = "";
  document.getElementById("convertModal").classList.add("open");
}

function closeConvertModal() {
  document.getElementById("convertModal").classList.remove("open");
}

function populateServiceTypeOptions(category, selected = "") {
  const select = document.getElementById("leadServiceType");
  const library = SERVICE_LIBRARY[category] || [];
  select.innerHTML = `<option value="">Select service</option>` + library
    .map((item) => `<option value="${item.id}" ${selected === item.id ? "selected" : ""}>${item.label}</option>`)
    .join("");
}

function recalcEstimatePreview() {
  const category = document.getElementById("leadCategory").value;
  const serviceType = document.getElementById("leadServiceType").value;
  const sqft = document.getElementById("leadEstimatedSqFt").value;
  const addOns = [...document.querySelectorAll('input[name="leadAddOns"]:checked')].map((el) => el.value);

  const total = calculateLeadEstimate(category, serviceType, sqft, addOns);
  document.getElementById("leadEstimatePreview").textContent = `Estimated price: $${Number(total).toFixed(2)}`;
}

async function loadLeadsData(user) {
  state.user = user;

  const isGlobal = user.role === "super_admin";
  const [leads, reps, techs] = await Promise.all([
    isGlobal ? fetchAllCollection("leads") : fetchCompanyCollection("leads", user.companyId),
    isGlobal ? fetchAllCollection("users") : fetchActiveSalesReps(user.companyId),
    isGlobal ? fetchAllCollection("users") : fetchActiveTechnicians(user.companyId)
  ]);

  state.leads = filterLeadsForUser(user, leads);
  state.reps = reps.filter((u) => u.role === "sales_rep" || !u.role);
  state.techs = techs.filter((u) => u.role === "technician" || !u.role);
}

function renderQuickActions() {
  const links = [
    { label: "Open Sales Reps", href: "sales_reps.html", show: canAccess(state.user.role, "sales_reps") },
    { label: "Open Companies", href: "companies.html", show: canAccess(state.user.role, "companies") },
    { label: "Open Jobs", href: "jobs.html", show: canAccess(state.user.role, "jobs") },
    { label: "Open Audit", href: "audit.html", show: canAccess(state.user.role, "audit") }
  ].filter((item) => item.show);

  if (!links.length) return "";

  return `
    <section class="glass-card">
      <div class="section-row">
        <h2 style="margin:0;">Quick Actions</h2>
      </div>
      <div class="top-actions" style="margin-top:14px;">
        ${links.map((item) => `<a class="btn secondary" href="${item.href}">${item.label}</a>`).join("")}
      </div>
    </section>
  `;
}

function renderPage() {
  const root = document.getElementById("leadsRoot");
  const counts = getStageCounts(state.leads);
  const visibleLeads = filteredLeads();

  root.innerHTML = `
    <main class="leads-main">
      ${renderQuickActions()}

      <section class="glass-card">
        <div class="section-row">
          <div>
            <h1 style="margin:0;">Leads Pipeline</h1>
            <p class="muted" style="margin:10px 0 0;">Role-scoped pipeline visibility, assignments, and lead actions.</p>
          </div>
          <div class="top-actions">
            ${canAccess(state.user.role, "leads") ? `<button class="btn" id="openLeadModalBtn">Add Lead</button>` : ""}
          </div>
        </div>

        <div class="stage-strip">
          ${[
            ["all", "All", state.leads.length],
            ["new", "New", counts.new],
            ["contacted", "Contacted", counts.contacted],
            ["quoted", "Quoted", counts.quoted],
            ["booked", "Booked", counts.booked],
            ["won", "Won", counts.won + counts.booked]
          ]
            .map(
              ([key, label, value]) => `
                <button class="stage-pill ${state.activeStage === key ? "active" : ""}" data-stage="${key}">
                  <span class="muted" style="display:block;margin-bottom:6px;">${label}</span>
                  <strong>${value}</strong>
                </button>
              `
            )
            .join("")}
        </div>
      </section>

      <section class="glass-card">
        <div class="section-row">
          <h2 style="margin:0;">Pipeline Cards</h2>
          <div class="muted">${visibleLeads.length} visible lead(s)</div>
        </div>

        ${
          !visibleLeads.length
            ? `<div class="empty-state">No leads match this view.</div>`
            : `
              <div class="pipeline-grid" style="margin-top:16px;">
                ${visibleLeads
                  .map(
                    (lead) => `
                      <div class="lead-card">
                        <div>
                          <strong>${lead.fullName || "Unnamed Lead"}</strong>
                          <div class="muted" style="margin-top:6px;">${lead.email || "No email"} · ${lead.phone || "No phone"}</div>
                        </div>

                        <div>
                          <span class="chip">${lead.status || "new"}</span>
                          <span class="chip">${lead.serviceInterest || lead.serviceType || "No service"}</span>
                          <span class="chip">$${Number(lead.estimatedPrice || 0).toFixed(2)}</span>
                        </div>

                        <div class="muted">
                          ${lead.address || "No address"}<br>
                          ${lead.city || ""} ${lead.state || ""} ${lead.zip || ""}
                        </div>

                        <div class="lead-actions">
                          ${canEditLead(state.user, lead) ? `<button class="btn secondary edit-lead-btn" data-id="${lead.id}">Edit</button>` : ""}
                          ${canAssignLead(state.user) ? `<button class="btn secondary assign-lead-btn" data-id="${lead.id}">Assign</button>` : ""}
                          ${canArchiveLead(state.user, lead) ? `<button class="btn secondary archive-lead-btn" data-id="${lead.id}">Archive</button>` : ""}
                          ${canRequestLeadDelete(state.user, lead) ? `<button class="btn secondary request-delete-btn" data-id="${lead.id}">Request Delete</button>` : ""}
                          ${canApproveLeadDelete(state.user) && lead.deleteRequested ? `<button class="btn secondary approve-delete-btn" data-id="${lead.id}">Approve Delete</button>` : ""}
                          ${canConvertLead(state.user, lead) ? `<button class="btn convert-lead-btn" data-id="${lead.id}">Convert to Job</button>` : ""}
                        </div>
                      </div>
                    `
                  )
                  .join("")}
              </div>
            `
        }
      </section>
    </main>
  `;

  wirePageEvents();
}

function wirePageEvents() {
  document.querySelectorAll(".stage-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activeStage = btn.dataset.stage;
      renderPage();
    });
  });

  document.getElementById("openLeadModalBtn")?.addEventListener("click", () => openModal());

  document.querySelectorAll(".edit-lead-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lead = state.leads.find((item) => item.id === btn.dataset.id);
      openModal(lead);
    });
  });

  document.querySelectorAll(".assign-lead-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const leadId = btn.dataset.id;
      const repName = prompt("Enter sales rep username, name, email, or ID to assign:");
      if (!repName) return;

      await updateDoc(doc(db, "leads", leadId), {
        assignedRep: repName,
        updatedAt: serverTimestamp()
      });

      showToast("Lead assigned.");
      await reloadAndRender();
    });
  });

  document.querySelectorAll(".archive-lead-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await updateDoc(doc(db, "leads", btn.dataset.id), {
        isArchived: true,
        updatedAt: serverTimestamp()
      });
      showToast("Lead archived.");
      await reloadAndRender();
    });
  });

  document.querySelectorAll(".request-delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await updateDoc(doc(db, "leads", btn.dataset.id), {
        deleteRequested: true,
        deleteRequestedBy: state.user.email || state.user.id || "",
        updatedAt: serverTimestamp()
      });
      showToast("Delete request sent.");
      await reloadAndRender();
    });
  });

  document.querySelectorAll(".approve-delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await deleteDoc(doc(db, "leads", btn.dataset.id));
      showToast("Lead deleted.");
      await reloadAndRender();
    });
  });

  document.querySelectorAll(".convert-lead-btn").forEach((btn) => {
    btn.addEventListener("click", () => openConvertModal(btn.dataset.id));
  });

  document.getElementById("leadCategory")?.addEventListener("change", (e) => {
    populateServiceTypeOptions(e.target.value);
    recalcEstimatePreview();
  });

  document.getElementById("leadServiceType")?.addEventListener("change", recalcEstimatePreview);
  document.getElementById("leadEstimatedSqFt")?.addEventListener("input", recalcEstimatePreview);
  document.querySelectorAll('input[name="leadAddOns"]').forEach((el) => {
    el.addEventListener("change", recalcEstimatePreview);
  });

  document.getElementById("leadModalCloseBtn")?.addEventListener("click", closeModal);
  document.getElementById("leadModalCancelBtn")?.addEventListener("click", closeModal);
  document.getElementById("convertModalCloseBtn")?.addEventListener("click", closeConvertModal);
  document.getElementById("convertModalCancelBtn")?.addEventListener("click", closeConvertModal);

  document.getElementById("leadForm")?.addEventListener("submit", saveLead);
  document.getElementById("convertForm")?.addEventListener("submit", convertLeadToJob);
}

async function saveLead(e) {
  e.preventDefault();

  const category = document.getElementById("leadCategory").value;
  const serviceType = document.getElementById("leadServiceType").value;
  const sqft = Number(document.getElementById("leadEstimatedSqFt").value || 0);
  const addOns = [...document.querySelectorAll('input[name="leadAddOns"]:checked')].map((el) => el.value);

  const payload = {
    companyId: sanitizeCompanyId(state.user.companyId),
    fullName: document.getElementById("leadFullName").value.trim(),
    phone: document.getElementById("leadPhone").value.trim(),
    email: document.getElementById("leadEmail").value.trim(),
    address: document.getElementById("leadAddress").value.trim(),
    city: document.getElementById("leadCity").value.trim(),
    state: document.getElementById("leadState").value.trim(),
    zip: document.getElementById("leadZip").value.trim(),
    serviceCategory: category,
    serviceType,
    serviceInterest: serviceType,
    addOns,
    leadSource: document.getElementById("leadLeadSource").value,
    preferredContactMethod: document.getElementById("leadContactMethod").value,
    estimatedSqFt: sqft,
    estimatedPrice: calculateLeadEstimate(category, serviceType, sqft, addOns),
    assignedRep: document.getElementById("leadAssignedRep").value || (state.user.role === "sales_rep" ? (state.user.username || state.user.id || state.user.email) : ""),
    status: document.getElementById("leadStatus").value,
    notes: document.getElementById("leadNotes").value.trim(),
    appointmentDate: document.getElementById("leadAppointmentDate").value,
    isArchived: false,
    deleteRequested: false,
    deleteRequestedBy: "",
    deleteApprovedBy: "",
    createdBy: state.user.id || state.user.uid || state.user.email || "",
    updatedAt: serverTimestamp()
  };

  if (state.editingLeadId) {
    await updateDoc(doc(db, "leads", state.editingLeadId), payload);
    showToast("Lead updated.");
  } else {
    await addDoc(collection(db, "leads"), {
      ...payload,
      createdAt: serverTimestamp()
    });
    showToast("Lead created.");
  }

  closeModal();
  await reloadAndRender();
}

async function convertLeadToJob(e) {
  e.preventDefault();

  const leadId = document.getElementById("convertLeadId").value;
  const lead = state.leads.find((item) => item.id === leadId);
  if (!lead) {
    showToast("Lead not found.", "error");
    return;
  }

  const technician = document.getElementById("convertTechnician").value;
  const scheduledDate = document.getElementById("convertScheduledDate").value;
  const timeWindow = document.getElementById("convertTimeWindow").value;
  const notes = document.getElementById("convertNotes").value;

  const jobRef = await addDoc(collection(db, "jobs"), {
    companyId: sanitizeCompanyId(state.user.companyId),
    sourceLeadId: lead.id,
    customerName: lead.fullName || "",
    customerPhone: lead.phone || "",
    customerEmail: lead.email || "",
    address: lead.address || "",
    city: lead.city || "",
    state: lead.state || "",
    zip: lead.zip || "",
    serviceType: lead.serviceInterest || lead.serviceType || "",
    assignedRep: lead.assignedRep || "",
    assignedTechnician: technician || "",
    scheduledDate: scheduledDate || "",
    scheduledTimeWindow: timeWindow || "",
    estimatedSqFt: Number(lead.estimatedSqFt || 0),
    estimatedPrice: Number(lead.estimatedPrice || 0),
    status: "scheduled",
    notes: notes || lead.notes || "",
    beforePhotos: [],
    afterPhotos: [],
    completionNotes: "",
    paymentStatus: "unpaid",
    invoiceId: "",
    customerSignature: "",
    routeOrder: 0,
    crewNotes: "",
    arrivalTime: "",
    departureTime: "",
    assignedCrewIds: technician ? [technician] : [],
    serviceAddOns: Array.isArray(lead.addOns) ? lead.addOns : [],
    createdBy: state.user.id || state.user.uid || state.user.email || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await updateDoc(doc(db, "leads", lead.id), {
    status: "scheduled",
    convertedToJobId: jobRef.id,
    updatedAt: serverTimestamp()
  });

  showToast("Lead converted to job.");
  closeConvertModal();
  await reloadAndRender();
}

async function reloadAndRender() {
  await loadLeadsData(state.user);
  renderPage();
}

function populateReferenceOptions() {
  const repSelect = document.getElementById("leadAssignedRep");
  repSelect.innerHTML = `<option value="">Unassigned</option>` + state.reps
    .map((rep) => {
      const value = rep.username || rep.id || rep.email || rep.name;
      const label = rep.name || rep.username || rep.email || rep.id;
      return `<option value="${value}">${label}</option>`;
    })
    .join("");

  const techSelect = document.getElementById("convertTechnician");
  techSelect.innerHTML = `<option value="">No technician yet</option>` + state.techs
    .map((tech) => {
      const value = tech.id || tech.username || tech.email;
      const label = tech.name || tech.username || tech.email || tech.id;
      return `<option value="${value}">${label}</option>`;
    })
    .join("");

  const categorySelect = document.getElementById("leadCategory");
  categorySelect.innerHTML = `
    <option value="">Select category</option>
    <option value="exterior">Exterior</option>
    <option value="trash_bin">Trash Bin</option>
    <option value="bundle">Bundle</option>
  `;

  const addOnWrap = document.getElementById("leadAddOnsWrap");
  addOnWrap.innerHTML = ADD_ONS.map((addon) => `
    <label class="checkbox-item">
      <input type="checkbox" name="leadAddOns" value="${addon.id}">
      <span>${addon.label}</span>
    </label>
  `).join("");
}

requireAuth(async (user) => {
  injectLeadsStyles();
  await bindTopbar(user);

  if (!canAccess(user.role, "leads")) {
    document.getElementById("leadsRoot").innerHTML = `<section class="glass-card" style="margin:22px;">Access denied for leads.</section>`;
    return;
  }

  const sidebarTop = document.getElementById("sidebar");
  if (sidebarTop) {
    sidebarTop.innerHTML = "";
  }

  document.getElementById("leadsRoot").innerHTML = `<section class="glass-card" style="margin:22px;">Loading leads pipeline...</section>`;

  try {
    await loadLeadsData(user);
    populateReferenceOptions();
    renderPage();
  } catch (e) {
    document.getElementById("leadsRoot").innerHTML = `<section class="glass-card" style="margin:22px;">Leads page failed: ${e.message || e}</section>`;
  }
});