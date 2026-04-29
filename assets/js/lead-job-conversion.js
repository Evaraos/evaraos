import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  getSavedUserProfile
} from "./firebase.js";

let currentUser = null;
let activeLeadId = null;
let activeLeadData = null;
let hasInjectedStyles = false;
let hasBoundEvents = false;

const JOB_STATUS = "scheduled";
const LEAD_CONVERTED_STATUS = "won";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalize(value = "") {
  return String(value || "").trim().toLowerCase();
}

function actorSnapshot() {
  const profile = getSavedUserProfile?.() || {};
  return {
    uid: currentUser?.uid || profile.uid || "",
    email: currentUser?.email || profile.email || "",
    displayName:
      profile.displayName ||
      profile.fullName ||
      profile.name ||
      currentUser?.displayName ||
      currentUser?.email ||
      "Unknown User"
  };
}

function leadName(lead = {}) {
  return lead.fullName || lead.name || lead.customerName || lead.company || lead.email || "Untitled Lead";
}

function leadSource(lead = {}) {
  return lead.source || lead.leadSource || "Lead Conversion";
}

function leadValue(lead = {}) {
  const value = Number(lead.value ?? lead.estimatedPrice ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function assignedIds(lead = {}) {
  if (Array.isArray(lead.assignedTo)) return lead.assignedTo;
  if (Array.isArray(lead.assignedTeamIds)) return lead.assignedTeamIds;
  if (lead.assignedTo) return [lead.assignedTo];
  if (lead.assignedRep) return [lead.assignedRep];
  return [];
}

function assignedNames(lead = {}) {
  if (Array.isArray(lead.assignedToNames)) return lead.assignedToNames;
  if (Array.isArray(lead.assignedTeamNames)) return lead.assignedTeamNames;
  if (lead.assignedToName) return [lead.assignedToName];
  if (lead.assignedRep) return [lead.assignedRep];
  return [];
}

function injectStyles() {
  if (hasInjectedStyles || document.getElementById("leadJobConversionStyles")) return;
  hasInjectedStyles = true;

  const style = document.createElement("style");
  style.id = "leadJobConversionStyles";
  style.textContent = `
    .lead-convert-box {
      margin-top: 16px;
      padding: 14px;
      border-radius: 22px;
      border: 1px solid rgba(255,255,255,0.14);
      background: rgba(255,255,255,0.055);
      display: grid;
      gap: 12px;
    }

    .lead-convert-box[hidden] { display: none; }

    .lead-convert-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      flex-wrap: wrap;
    }

    .lead-convert-head strong {
      display: block;
      color: var(--text-primary, #fff);
      font-size: 15px;
      letter-spacing: -0.02em;
    }

    .lead-convert-head span,
    .lead-convert-result {
      color: var(--text-muted, rgba(255,255,255,0.68));
      font-size: 13px;
      line-height: 1.45;
      font-weight: 700;
    }

    .lead-convert-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .lead-convert-field.full { grid-column: 1 / -1; }

    .lead-convert-field label {
      display: block;
      margin-bottom: 7px;
      color: var(--text-muted, rgba(255,255,255,0.68));
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .lead-convert-field input,
    .lead-convert-field textarea {
      width: 100%;
      border-radius: 15px;
      border: 1px solid rgba(255,255,255,0.14);
      background: rgba(255,255,255,0.08);
      color: var(--text-primary, #fff);
      padding: 12px 13px;
      outline: none;
      font: inherit;
    }

    .lead-convert-actions {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }

    .lead-convert-result[data-tone="success"] { color: #70ffbd; }
    .lead-convert-result[data-tone="error"] { color: #ff9b8f; }

    @media (max-width: 760px) {
      .lead-convert-grid { grid-template-columns: 1fr; }
    }
  `;

  document.head.appendChild(style);
}

function getLeadModal() {
  return document.getElementById("leadCrudModal");
}

function getConversionBox() {
  return document.getElementById("leadJobConversionBox");
}

function readLeadFormFallback() {
  return {
    fullName: document.getElementById("leadFullNameInput")?.value || "",
    email: document.getElementById("leadEmailInput")?.value || "",
    phone: document.getElementById("leadPhoneInput")?.value || "",
    source: document.getElementById("leadSourceInput")?.value || "",
    value: Number(document.getElementById("leadValueInput")?.value || 0),
    address: document.getElementById("leadAddressInput")?.value || "",
    notes: document.getElementById("leadNotesInput")?.value || "",
    nextStep: document.getElementById("leadNextStepInput")?.value || ""
  };
}

function injectConversionUi() {
  injectStyles();

  const form = document.getElementById("leadCrudForm");
  if (!form || getConversionBox()) return;

  const footer = form.querySelector(".lead-crud-footer");
  const box = document.createElement("section");
  box.id = "leadJobConversionBox";
  box.className = "lead-convert-box";
  box.hidden = true;
  box.innerHTML = `
    <div class="lead-convert-head">
      <div>
        <strong>Convert Lead → Job</strong>
        <span>Create a job from this lead, keep the lead connected, and write timeline history.</span>
      </div>
    </div>

    <div class="lead-convert-grid">
      <div class="lead-convert-field">
        <label for="leadConvertJobTitle">Job Title</label>
        <input id="leadConvertJobTitle" type="text" placeholder="Exterior Cleaning Job" />
      </div>

      <div class="lead-convert-field">
        <label for="leadConvertServiceType">Service Type</label>
        <input id="leadConvertServiceType" type="text" placeholder="Trash Bin Cleaning, Pressure Washing, House Wash..." />
      </div>

      <div class="lead-convert-field">
        <label for="leadConvertScheduledDate">Scheduled Date</label>
        <input id="leadConvertScheduledDate" type="date" />
      </div>

      <div class="lead-convert-field">
        <label for="leadConvertEstimatedTotal">Estimated Total</label>
        <input id="leadConvertEstimatedTotal" type="number" min="0" step="1" placeholder="250" />
      </div>

      <div class="lead-convert-field full">
        <label for="leadConvertJobNotes">Job Notes</label>
        <textarea id="leadConvertJobNotes" rows="3" placeholder="Anything the operations team needs to know..."></textarea>
      </div>
    </div>

    <div class="lead-convert-actions">
      <button type="button" class="btn btn-theme-primary beam-target" id="leadConvertToJobBtn">Convert to Job</button>
      <span id="leadConvertResult" class="lead-convert-result"></span>
    </div>
  `;

  if (footer) form.insertBefore(box, footer);
  else form.appendChild(box);

  document.getElementById("leadConvertToJobBtn")?.addEventListener("click", convertActiveLeadToJob);
}

function setConversionMessage(message = "", tone = "") {
  const result = document.getElementById("leadConvertResult");
  if (!result) return;
  result.textContent = message;
  result.dataset.tone = tone;
}

function hydrateConversionForm(lead = {}) {
  const merged = {
    ...readLeadFormFallback(),
    ...lead
  };

  const titleInput = document.getElementById("leadConvertJobTitle");
  const serviceInput = document.getElementById("leadConvertServiceType");
  const totalInput = document.getElementById("leadConvertEstimatedTotal");
  const notesInput = document.getElementById("leadConvertJobNotes");

  if (titleInput) titleInput.value = `${leadName(merged)} Job`;
  if (serviceInput) serviceInput.value = merged.serviceType || merged.service || leadSource(merged) || "General Service";
  if (totalInput) totalInput.value = String(leadValue(merged) || "");
  if (notesInput) {
    notesInput.value = [
      merged.notes || merged.description || "",
      merged.nextStep ? `Next step: ${merged.nextStep}` : "",
      merged.address || merged.territory ? `Address: ${merged.address || merged.territory}` : ""
    ].filter(Boolean).join("\n");
  }

  setConversionMessage("");
}

async function fetchLead(leadId) {
  if (!leadId) return null;

  try {
    const snap = await getDoc(doc(db, "leads", leadId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch (error) {
    console.warn("Lead conversion fetch failed:", error);
    return null;
  }
}

async function addLeadActivity(leadId, activity = {}) {
  if (!leadId) return null;
  const actor = actorSnapshot();

  return addDoc(collection(db, "leads", leadId, "activities"), {
    type: activity.type || "job_conversion",
    eventType: activity.type || "job_conversion",
    message: activity.message || "Lead converted to job",
    jobId: activity.jobId || "",
    createdAt: serverTimestamp(),
    createdBy: actor.uid,
    createdByName: actor.displayName,
    createdByEmail: actor.email
  });
}

function jobPayloadFromLead(lead = {}) {
  const actor = actorSnapshot();
  const fallback = readLeadFormFallback();
  const merged = { ...fallback, ...lead };

  const title = String(document.getElementById("leadConvertJobTitle")?.value || `${leadName(merged)} Job`).trim();
  const serviceType = String(document.getElementById("leadConvertServiceType")?.value || leadSource(merged) || "General Service").trim();
  const scheduledDate = String(document.getElementById("leadConvertScheduledDate")?.value || "").trim();
  const estimatedTotalRaw = Number(document.getElementById("leadConvertEstimatedTotal")?.value || leadValue(merged) || 0);
  const jobNotes = String(document.getElementById("leadConvertJobNotes")?.value || merged.notes || merged.description || "").trim();
  const estimatedTotal = Number.isFinite(estimatedTotalRaw) ? estimatedTotalRaw : 0;

  return {
    title,
    name: title,
    jobName: title,
    customerName: leadName(merged),
    customerEmail: merged.email || "",
    customerPhone: merged.phone || "",
    serviceType,
    service: serviceType,
    status: JOB_STATUS,
    source: "lead_conversion",
    leadSource: leadSource(merged),
    leadId: activeLeadId,
    leadName: leadName(merged),
    companyId: merged.companyId || "",
    companyName: merged.companyName || "",
    assignedTo: assignedIds(merged),
    assignedToNames: assignedNames(merged),
    assignedTeamIds: assignedIds(merged),
    assignedTeamNames: assignedNames(merged),
    address: merged.address || merged.territory || "",
    territory: merged.territory || merged.address || "",
    scheduledDate,
    estimatedTotal,
    value: estimatedTotal,
    estimatedPrice: estimatedTotal,
    notes: jobNotes,
    description: jobNotes || `Converted from lead: ${leadName(merged)}`,
    convertedFromLead: true,
    convertedFromLeadId: activeLeadId,
    convertedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: actor.uid,
    createdByEmail: actor.email,
    createdByName: actor.displayName,
    updatedBy: actor.uid,
    updatedByEmail: actor.email,
    updatedByName: actor.displayName,
    searchText: [
      title,
      leadName(merged),
      merged.email,
      merged.phone,
      serviceType,
      merged.companyName,
      merged.address,
      merged.territory,
      jobNotes
    ].filter(Boolean).join(" ").toLowerCase()
  };
}

async function convertActiveLeadToJob() {
  if (!activeLeadId) {
    setConversionMessage("Open an existing saved lead before converting.", "error");
    return;
  }

  const btn = document.getElementById("leadConvertToJobBtn");
  const existingLead = activeLeadData || await fetchLead(activeLeadId) || readLeadFormFallback();
  const leadAlreadyConverted = Boolean(existingLead.convertedToJobId || existingLead.convertedFromLeadId);

  if (leadAlreadyConverted) {
    const confirmed = window.confirm("This lead already appears converted. Create another job anyway?");
    if (!confirmed) return;
  }

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Converting...";
    }

    setConversionMessage("Creating job from lead...", "");

    const payload = jobPayloadFromLead(existingLead);
    const jobRef = await addDoc(collection(db, "jobs"), payload);

    await updateDoc(doc(db, "leads", activeLeadId), {
      status: LEAD_CONVERTED_STATUS,
      convertedToJob: true,
      convertedToJobId: jobRef.id,
      convertedToJobAt: serverTimestamp(),
      convertedToJobStatus: JOB_STATUS,
      lastActivityType: "job_conversion",
      lastActivityMessage: `Converted to job ${jobRef.id}`,
      lastActivityAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await addLeadActivity(activeLeadId, {
      type: "job_conversion",
      message: `Lead converted to job: ${payload.title}`,
      jobId: jobRef.id
    });

    setConversionMessage("Converted. Job created and lead timeline updated.", "success");

    setTimeout(() => {
      const openJobs = window.confirm("Job created. Open Jobs page now?");
      if (openJobs) window.location.assign("/evaraos/jobs.html");
    }, 350);
  } catch (error) {
    console.error("Lead to job conversion failed:", error);
    setConversionMessage(error.message || "Conversion failed.", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Convert to Job";
    }
  }
}

async function activateForLead(leadId) {
  if (!leadId) return;

  activeLeadId = leadId;
  injectConversionUi();

  const box = getConversionBox();
  if (box) box.hidden = false;

  activeLeadData = await fetchLead(leadId);
  hydrateConversionForm(activeLeadData || readLeadFormFallback());
}

function bindEvents() {
  if (hasBoundEvents) return;
  hasBoundEvents = true;

  document.addEventListener("click", (event) => {
    const editBtn = event.target.closest("[data-lead-edit]");
    if (editBtn) {
      const leadId = editBtn.getAttribute("data-lead-edit");
      setTimeout(() => activateForLead(leadId), 150);
      return;
    }

    if (event.target.closest("#leadCreateBtn")) {
      activeLeadId = null;
      activeLeadData = null;
      setTimeout(() => {
        injectConversionUi();
        const box = getConversionBox();
        if (box) box.hidden = true;
      }, 150);
    }
  });

  const observer = new MutationObserver(() => {
    const modal = getLeadModal();
    if (!modal || !modal.classList.contains("open")) return;
    injectConversionUi();
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function initLeadJobConversion() {
  injectStyles();
  bindEvents();

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLeadJobConversion, { once: true });
} else {
  initLeadJobConversion();
}
