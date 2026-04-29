import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  getSavedUserProfile
} from "./firebase.js";

const leadsSearch = document.getElementById("leadsSearch");
const leadsList = document.getElementById("leadsList");
const leadsFeed = document.getElementById("leadsFeed");
const leadFlowStack = document.getElementById("leadFlowStack");

const leadsHeroTitle = document.getElementById("leadsHeroTitle");
const leadsHeroText = document.getElementById("leadsHeroText");

const leadsStatTotal = document.getElementById("leadsStatTotal");
const leadsStatOpen = document.getElementById("leadsStatOpen");
const leadsStatHot = document.getElementById("leadsStatHot");
const leadsStatFiltered = document.getElementById("leadsStatFiltered");

const leadsRefreshBtnTop = document.getElementById("leadsRefreshBtnTop");
const leadsRefreshBtnSide = document.getElementById("leadsRefreshBtnSide");
const leadsSortBtn = document.getElementById("leadsSortBtn");

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "open", label: "Open" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "scheduled", label: "Scheduled" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "archived", label: "Archived" }
];

const PRIORITY_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "hot", label: "Hot" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
  { value: "low", label: "Low" },
  { value: "cold", label: "Cold" }
];

const ACTIVITY_OPTIONS = [
  { value: "note", label: "Note" },
  { value: "call", label: "Call" },
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "door_knock", label: "Door Knock" },
  { value: "follow_up", label: "Follow Up" }
];

let leadsData = [];
let companiesData = [];
let usersData = [];
let sortAsc = true;
let isLoadingLeads = false;
let hasBoundEvents = false;
let hasStartedAuthWatch = false;
let currentFirebaseUser = null;
let editingLeadId = null;
let currentLeadActivities = [];

function navigateWithLoader(url, options = {}) {
  if (window.EvaraLoader && typeof window.EvaraLoader.beginNavigationLoad === "function") {
    window.EvaraLoader.beginNavigationLoad(options);
  }
  requestAnimationFrame(() => window.location.assign(url));
}

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

function humanize(value = "") {
  const safe = String(value || "").trim().replaceAll("_", " ");
  if (!safe) return "Activity";
  return safe.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function timestampMs(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatActivityTime(value) {
  const ms = timestampMs(value);
  if (!ms) return "Just now";
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(ms));
  } catch {
    return "Recent";
  }
}

function leadName(lead = {}) {
  return lead.fullName || lead.name || lead.customerName || lead.company || lead.email || "Untitled Lead";
}

function leadStatus(lead = {}) {
  return normalize(lead.status || "new");
}

function leadPriority(lead = {}) {
  return normalize(lead.priority || "normal");
}

function leadDescription(lead = {}) {
  return lead.description || lead.notes || lead.source || lead.leadSource || "No lead notes provided.";
}

function companyName(company = {}) {
  return company.name || company.companyName || company.brand || company.title || "Untitled Company";
}

function userName(user = {}) {
  return user.fullName || user.displayName || user.name || user.username || user.email || "Unnamed User";
}

function getCompanyById(companyId = "") {
  return companiesData.find((company) => String(company.id) === String(companyId));
}

function getUserById(userId = "") {
  return usersData.find((user) => String(user.id || user.uid) === String(userId));
}

function leadCompanyName(lead = {}) {
  const company = getCompanyById(lead.companyId || "");
  return lead.companyName || (company ? companyName(company) : "No company assigned");
}

function assignedNames(lead = {}) {
  if (Array.isArray(lead.assignedToNames) && lead.assignedToNames.length) return lead.assignedToNames;
  if (Array.isArray(lead.assignedTeamNames) && lead.assignedTeamNames.length) return lead.assignedTeamNames;
  if (lead.assignedToName) return [lead.assignedToName];
  if (lead.assignedRep) return [lead.assignedRep];
  if (Array.isArray(lead.assignedTo) && lead.assignedTo.length) {
    return lead.assignedTo.map((id) => userName(getUserById(id))).filter(Boolean);
  }
  return [];
}

function selectedAssignedIds(lead = {}) {
  if (Array.isArray(lead.assignedTo)) return lead.assignedTo;
  if (Array.isArray(lead.assignedTeamIds)) return lead.assignedTeamIds;
  if (lead.assignedTo) return [lead.assignedTo];
  if (lead.assignedRep) return [lead.assignedRep];
  return [];
}

function pillClass(value = "") {
  const safe = normalize(value);
  if (["won", "closed", "active", "scheduled"].includes(safe)) return "success";
  if (["new", "open", "contacted", "qualified", "proposal"].includes(safe)) return "working";
  if (["lost", "cold", "archived"].includes(safe)) return "empty";
  return "warning";
}

function priorityPillClass(value = "") {
  const safe = normalize(value);
  if (["hot", "high", "urgent"].includes(safe)) return "warning";
  if (["low", "cold"].includes(safe)) return "empty";
  return "working";
}

function currentActor() {
  const profile = getSavedUserProfile() || {};
  return {
    uid: currentFirebaseUser?.uid || profile.uid || "",
    email: currentFirebaseUser?.email || profile.email || "",
    displayName:
      profile.displayName ||
      profile.fullName ||
      profile.name ||
      currentFirebaseUser?.displayName ||
      currentFirebaseUser?.email ||
      "Unknown User"
  };
}

function setButtonLoading(isLoading) {
  [leadsRefreshBtnTop, leadsRefreshBtnSide].forEach((btn) => {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.textContent = isLoading ? "Refreshing..." : "Refresh Data";
  });
}

function showMessage(message = "", tone = "") {
  const messageEl = document.getElementById("leadCrudMessage");
  if (!messageEl) return;
  messageEl.textContent = message;
  messageEl.dataset.tone = tone;
}

function filteredLeads() {
  const term = normalize(leadsSearch?.value || "");
  let rows = [...leadsData];

  if (term) {
    rows = rows.filter((lead) => {
      return [
        leadName(lead),
        lead.email,
        lead.phone,
        leadStatus(lead),
        leadPriority(lead),
        leadDescription(lead),
        leadCompanyName(lead),
        lead.source,
        lead.leadSource,
        lead.value,
        lead.estimatedPrice,
        assignedNames(lead).join(" ")
      ].some((value) => String(value || "").toLowerCase().includes(term));
    });
  }

  rows.sort((a, b) => {
    const left = leadName(a).toLowerCase();
    const right = leadName(b).toLowerCase();
    if (left < right) return sortAsc ? -1 : 1;
    if (left > right) return sortAsc ? 1 : -1;
    return 0;
  });

  return rows;
}

function renderStats(rows) {
  const open = leadsData.filter((row) =>
    ["new", "open", "contacted", "qualified", "proposal", "scheduled"].includes(leadStatus(row))
  ).length;

  const hot = leadsData.filter((row) =>
    ["hot", "high", "urgent"].includes(leadPriority(row))
  ).length;

  if (leadsStatTotal) leadsStatTotal.textContent = String(leadsData.length);
  if (leadsStatOpen) leadsStatOpen.textContent = String(open);
  if (leadsStatHot) leadsStatHot.textContent = String(hot);
  if (leadsStatFiltered) leadsStatFiltered.textContent = String(rows.length);

  if (leadsHeroTitle) {
    leadsHeroTitle.textContent = leadsData.length
      ? `${leadsData.length} leads connected`
      : "No leads found yet.";
  }

  if (leadsHeroText) {
    leadsHeroText.textContent = leadsData.length
      ? "Advanced CRM is live: company links, multi-rep assignments, pipeline status, priority, and timeline-ready updates."
      : "Create your first lead to start building the Evaraos sales pipeline.";
  }
}

function renderLoadingState() {
  if (leadsList) {
    leadsList.innerHTML = `
      <div class="dashboard-skeleton-grid">
        <div class="dashboard-skeleton-card"><div class="dashboard-skeleton-line line-1"></div><div class="dashboard-skeleton-line line-2"></div><div class="dashboard-skeleton-line line-3"></div></div>
        <div class="dashboard-skeleton-card"><div class="dashboard-skeleton-line line-1"></div><div class="dashboard-skeleton-line line-2"></div><div class="dashboard-skeleton-line line-3"></div></div>
      </div>
    `;
  }

  if (leadFlowStack) {
    leadFlowStack.innerHTML = `<article class="dashboard-state-card loading"><strong>Loading pipeline...</strong><span>Preparing lead flow buckets and status counts.</span></article>`;
  }

  if (leadsFeed) {
    leadsFeed.innerHTML = `<article class="dashboard-state-card loading"><strong>Loading lead activity...</strong><span>Pulling Firestore lead records and preparing the feed.</span></article>`;
  }

  if (leadsHeroTitle) leadsHeroTitle.textContent = "Loading leads...";
  if (leadsHeroText) leadsHeroText.textContent = "Connecting to Firestore lead records.";
}

function renderList(rows) {
  if (!leadsList) return;

  if (!rows.length) {
    leadsList.innerHTML = `<article class="dashboard-state-card empty"><strong>No leads found</strong><span>Try another search or add your first lead from the Add Lead button.</span></article>`;
    return;
  }

  leadsList.innerHTML = rows.map((lead) => {
    const id = escapeHtml(lead.id);
    const name = escapeHtml(leadName(lead));
    const status = escapeHtml(leadStatus(lead));
    const priority = escapeHtml(leadPriority(lead));
    const description = escapeHtml(leadDescription(lead));
    const company = escapeHtml(leadCompanyName(lead));
    const email = escapeHtml(lead.email || "No email");
    const phone = escapeHtml(lead.phone || "No phone");
    const team = assignedNames(lead).length ? escapeHtml(assignedNames(lead).join(", ")) : "Unassigned";

    return `
      <article class="dashboard-list-item glass-card aurora-card active-glow beam-target lead-crud-item" data-lead-id="${id}">
        <div class="lead-crud-content">
          <strong>${name}</strong>
          <span>${description}</span>
          <div class="lead-crud-meta">
            <span>${company}</span>
            <span>${email}</span>
            <span>${phone}</span>
            <span>Team: ${team}</span>
          </div>
        </div>
        <div class="lead-crud-actions">
          <span class="dashboard-status-pill ${priorityPillClass(priority)}">${priority}</span>
          <span class="dashboard-status-pill ${pillClass(status)}">${status}</span>
          <button type="button" class="btn btn-theme-secondary lead-edit-btn" data-lead-edit="${id}">Edit</button>
          <button type="button" class="btn btn-theme-secondary lead-delete-btn" data-lead-delete="${id}">Delete</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderFlow(rows) {
  if (!leadFlowStack) return;
  const total = rows.length || 1;

  leadFlowStack.innerHTML = STATUS_OPTIONS.filter((bucket) => bucket.value !== "archived").map((bucket) => {
    const count = rows.filter((row) => leadStatus(row) === bucket.value).length;
    const width = Math.max(6, Math.round((count / total) * 100));
    return `
      <div class="dashboard-progress-row glass-card aurora-card active-glow beam-target">
        <div class="dashboard-progress-copy"><strong>${bucket.label}</strong><span>${count} lead(s)</span></div>
        <div class="dashboard-progress-bar"><span style="width: ${width}%;"></span></div>
      </div>
    `;
  }).join("");
}

function renderFeed(rows) {
  if (!leadsFeed) return;

  if (!rows.length) {
    leadsFeed.innerHTML = `<article class="dashboard-state-card empty"><strong>No lead activity</strong><span>Recent lead activity will appear here once records exist.</span></article>`;
    return;
  }

  leadsFeed.innerHTML = rows.slice(0, 8).map((lead) => {
    const name = escapeHtml(leadName(lead));
    const status = escapeHtml(leadStatus(lead));
    const priority = escapeHtml(leadPriority(lead));
    const company = escapeHtml(leadCompanyName(lead));
    const team = assignedNames(lead).length ? escapeHtml(assignedNames(lead).join(", ")) : "Unassigned";

    return `
      <article class="dashboard-feed-item glass-card aurora-card active-glow beam-target">
        <strong>${name}</strong>
        <span>${company} • ${status} • ${priority} • ${team}</span>
      </article>
    `;
  }).join("");
}

function renderLeads() {
  const rows = filteredLeads();
  renderStats(rows);
  renderList(rows);
  renderFlow(rows);
  renderFeed(rows);
}

async function loadCompanies() {
  try {
    const snap = await getDocs(collection(db, "companies"));
    companiesData = snap.docs
      .map((companyDoc) => ({ id: companyDoc.id, ...companyDoc.data() }))
      .sort((a, b) => companyName(a).localeCompare(companyName(b)));
  } catch (error) {
    console.warn("Failed to load companies for leads:", error);
    companiesData = [];
  }
}

async function loadUsers() {
  try {
    const snap = await getDocs(collection(db, "users"));
    usersData = snap.docs
      .map((userDoc) => ({ id: userDoc.id, ...userDoc.data() }))
      .sort((a, b) => userName(a).localeCompare(userName(b)));
  } catch (error) {
    console.warn("Failed to load users for leads:", error);
    usersData = [];
  }
}

async function loadLeads() {
  if (isLoadingLeads) return;
  isLoadingLeads = true;
  setButtonLoading(true);
  renderLoadingState();

  try {
    await Promise.all([loadCompanies(), loadUsers()]);
    const snap = await getDocs(collection(db, "leads"));
    leadsData = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    renderLeads();
  } catch (error) {
    console.error("Failed to load leads:", error);
    const errorCard = `<article class="dashboard-state-card error"><strong>Unable to load leads</strong><span>${escapeHtml(error.message || "Firestore request failed.")}</span></article>`;
    if (leadsList) leadsList.innerHTML = errorCard;
    if (leadFlowStack) leadFlowStack.innerHTML = errorCard;
    if (leadsFeed) leadsFeed.innerHTML = errorCard;
  } finally {
    isLoadingLeads = false;
    setButtonLoading(false);
  }
}

function injectCrudStyles() {
  if (document.getElementById("leadCrudStyles")) return;

  const style = document.createElement("style");
  style.id = "leadCrudStyles";
  style.textContent = `
    .lead-crud-item { align-items: flex-start; gap: 16px; }
    .lead-crud-content { min-width: 0; display: grid; gap: 8px; }
    .lead-crud-meta { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 4px; }
    .lead-crud-meta span { border-radius: 999px; padding: 6px 9px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); color: var(--text-muted, rgba(255,255,255,0.68)); font-size: 11px; font-weight: 800; }
    .lead-crud-actions { display: flex; justify-content: flex-end; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 250px; }
    .lead-crud-actions .btn { min-height: 34px; padding: 8px 10px; font-size: 12px; }

    .lead-crud-modal { position: fixed; inset: 0; z-index: 9999; display: none; place-items: center; padding: 20px; background: rgba(0,0,0,0.62); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); }
    .lead-crud-modal.open { display: grid; }
    .lead-crud-card { width: min(980px, 100%); max-height: min(880px, calc(100vh - 40px)); overflow: auto; border-radius: 28px; padding: 22px; background: rgba(10, 12, 26, 0.90); border: 1px solid rgba(255,255,255,0.16); box-shadow: 0 34px 120px rgba(0,0,0,0.46); }
    .lead-crud-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
    .lead-crud-head h2 { margin: 0; letter-spacing: -0.04em; }
    .lead-crud-head p, .lead-crud-note { margin: 7px 0 0; color: var(--text-muted, rgba(255,255,255,0.68)); line-height: 1.5; }
    .lead-crud-note { padding: 12px 14px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); margin-bottom: 16px; font-size: 13px; font-weight: 700; }

    .lead-crud-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .lead-crud-field.full { grid-column: 1 / -1; }
    .lead-crud-field label, .lead-activity-title { display: block; margin-bottom: 8px; color: var(--text-muted, rgba(255,255,255,0.68)); font-size: 12px; font-weight: 900; letter-spacing: 0.04em; text-transform: uppercase; }
    .lead-crud-field input, .lead-crud-field select, .lead-crud-field textarea, .lead-activity-controls input, .lead-activity-controls select { width: 100%; border-radius: 16px; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.08); color: var(--text-primary, #fff); padding: 13px 14px; outline: none; font: inherit; }
    .lead-crud-field select option, .lead-activity-controls select option { color: #111; }

    .lead-crud-team-box { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; max-height: 190px; overflow: auto; padding: 10px; border-radius: 18px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); }
    .lead-crud-check { display: flex; align-items: center; gap: 8px; padding: 9px 10px; border-radius: 14px; background: rgba(255,255,255,0.05); color: var(--text-muted, rgba(255,255,255,0.72)); font-size: 13px; font-weight: 800; }
    .lead-crud-check input { width: auto; }

    .lead-activity-shell { margin-top: 18px; border-radius: 24px; padding: 14px; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.055); }
    .lead-activity-controls { display: grid; grid-template-columns: 150px minmax(0, 1fr) auto; gap: 10px; align-items: center; margin-bottom: 14px; }
    .lead-activity-list { display: grid; gap: 10px; max-height: 260px; overflow: auto; padding-right: 4px; }
    .lead-activity-item { border-radius: 18px; padding: 12px 13px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); display: grid; gap: 6px; }
    .lead-activity-item strong { color: var(--text-primary, #fff); }
    .lead-activity-item span, .lead-activity-item small { color: var(--text-muted, rgba(255,255,255,0.68)); line-height: 1.45; }

    .lead-crud-footer { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 18px; }
    .lead-crud-footer-actions { display: flex; gap: 10px; flex-wrap: wrap; }
    #leadCrudMessage { margin: 0; color: var(--text-muted, rgba(255,255,255,0.68)); font-size: 13px; font-weight: 800; }
    #leadCrudMessage[data-tone="success"] { color: #70ffbd; }
    #leadCrudMessage[data-tone="error"] { color: #ff9b8f; }

    @media (max-width: 760px) {
      .lead-crud-item { display: grid; }
      .lead-crud-actions { justify-content: flex-start; min-width: 0; }
      .lead-crud-grid, .lead-crud-team-box, .lead-activity-controls { grid-template-columns: 1fr; }
    }
  `;

  document.head.appendChild(style);
}

function selectOptions(options, selectedValue = "") {
  return options.map((option) =>
    `<option value="${escapeHtml(option.value)}" ${option.value === selectedValue ? "selected" : ""}>${escapeHtml(option.label)}</option>`
  ).join("");
}

function companyOptionsHtml(selectedCompanyId = "") {
  return `
    <option value="">No company assigned</option>
    ${companiesData.map((company) =>
      `<option value="${escapeHtml(company.id)}" ${String(company.id) === String(selectedCompanyId) ? "selected" : ""}>${escapeHtml(companyName(company))}</option>`
    ).join("")}
  `;
}

function teamCheckboxesHtml(selectedIds = []) {
  const selected = new Set((selectedIds || []).map(String));
  if (!usersData.length) return `<div class="lead-crud-check">No users available yet.</div>`;

  return usersData.map((user) => {
    const id = String(user.id || user.uid || "");
    return `<label class="lead-crud-check"><input type="checkbox" name="assignedTo" value="${escapeHtml(id)}" ${selected.has(id) ? "checked" : ""}>${escapeHtml(userName(user))}</label>`;
  }).join("");
}

function activityTypeOptionsHtml(selectedValue = "note") {
  return ACTIVITY_OPTIONS.map((option) =>
    `<option value="${escapeHtml(option.value)}" ${option.value === selectedValue ? "selected" : ""}>${escapeHtml(option.label)}</option>`
  ).join("");
}

function injectCrudUi() {
  injectCrudStyles();

  const heroActions = document.querySelector("#leadsOverviewSection .dashboard-hero-actions");
  if (heroActions && !document.getElementById("leadCreateBtn")) {
    const button = document.createElement("button");
    button.type = "button";
    button.id = "leadCreateBtn";
    button.className = "btn btn-theme-primary beam-target";
    button.textContent = "Add Lead";
    heroActions.prepend(button);
  }

  if (document.getElementById("leadCrudModal")) return;

  const modal = document.createElement("div");
  modal.id = "leadCrudModal";
  modal.className = "lead-crud-modal";
  modal.innerHTML = `
    <section class="lead-crud-card aurora-card active-glow beam-target" role="dialog" aria-modal="true" aria-labelledby="leadCrudTitle">
      <div class="lead-crud-head">
        <div>
          <h2 id="leadCrudTitle">Add Lead</h2>
          <p id="leadCrudSubtitle">Create an advanced CRM lead with company and team assignment.</p>
        </div>
        <button type="button" class="btn btn-theme-secondary beam-target" id="leadCrudCloseBtn">Close</button>
      </div>

      <p class="lead-crud-note">
        Advanced CRM mode: one lead can be attached to a company, assigned to multiple reps, and tracked through a permanent activity timeline.
      </p>

      <form id="leadCrudForm" novalidate>
        <div class="lead-crud-grid">
          <div class="lead-crud-field">
            <label for="leadFullNameInput">Lead Name</label>
            <input id="leadFullNameInput" name="fullName" type="text" placeholder="Customer or decision maker" required>
          </div>

          <div class="lead-crud-field">
            <label for="leadCompanyInput">Company</label>
            <select id="leadCompanyInput" name="companyId"></select>
          </div>

          <div class="lead-crud-field">
            <label for="leadEmailInput">Email</label>
            <input id="leadEmailInput" name="email" type="email" placeholder="lead@example.com">
          </div>

          <div class="lead-crud-field">
            <label for="leadPhoneInput">Phone</label>
            <input id="leadPhoneInput" name="phone" type="tel" placeholder="904-000-0000">
          </div>

          <div class="lead-crud-field">
            <label for="leadStatusInput">Pipeline Status</label>
            <select id="leadStatusInput" name="status"></select>
          </div>

          <div class="lead-crud-field">
            <label for="leadPriorityInput">Priority</label>
            <select id="leadPriorityInput" name="priority"></select>
          </div>

          <div class="lead-crud-field">
            <label for="leadSourceInput">Source</label>
            <input id="leadSourceInput" name="source" type="text" placeholder="D2D, Website, Referral, Clean Machine">
          </div>

          <div class="lead-crud-field">
            <label for="leadValueInput">Estimated Value</label>
            <input id="leadValueInput" name="value" type="number" min="0" step="1" placeholder="250">
          </div>

          <div class="lead-crud-field full">
            <label>Assigned Sales Team</label>
            <div id="leadAssignedTeamBox" class="lead-crud-team-box"></div>
          </div>

          <div class="lead-crud-field full">
            <label for="leadAddressInput">Address / Territory</label>
            <input id="leadAddressInput" name="address" type="text" placeholder="Street, city, state, or territory">
          </div>

          <div class="lead-crud-field full">
            <label for="leadNotesInput">Notes</label>
            <textarea id="leadNotesInput" name="notes" rows="4" placeholder="Conversation notes, objection, next step, gate code, etc..."></textarea>
          </div>

          <div class="lead-crud-field full">
            <label for="leadNextStepInput">Next Step</label>
            <textarea id="leadNextStepInput" name="nextStep" rows="3" placeholder="Call back, quote, schedule visit, send proposal..."></textarea>
          </div>
        </div>

        <section id="leadActivityShell" class="lead-activity-shell" hidden>
          <strong class="lead-activity-title">Lead Activity Timeline</strong>

          <div class="lead-activity-controls">
            <select id="leadActivityTypeInput">${activityTypeOptionsHtml("note")}</select>
            <input id="leadActivityMessageInput" type="text" placeholder="Add a note, call log, or follow-up...">
            <button type="button" id="leadActivityAddBtn" class="btn btn-theme-primary beam-target">Add Activity</button>
          </div>

          <div id="leadActivityTimeline" class="lead-activity-list"></div>
        </section>

        <div class="lead-crud-footer">
          <p id="leadCrudMessage" aria-live="polite"></p>
          <div class="lead-crud-footer-actions">
            <button type="button" class="btn btn-theme-secondary beam-target" id="leadCrudCancelBtn">Cancel</button>
            <button type="submit" class="btn btn-theme-primary beam-target" id="leadCrudSaveBtn">Save Lead</button>
          </div>
        </div>
      </form>
    </section>
  `;

  document.body.appendChild(modal);
}

function getModal() {
  return document.getElementById("leadCrudModal");
}

function getLeadById(id) {
  return leadsData.find((lead) => String(lead.id) === String(id));
}

function setFormValues(lead = {}) {
  document.getElementById("leadFullNameInput").value = leadName(lead) === "Untitled Lead" ? "" : leadName(lead);
  document.getElementById("leadEmailInput").value = lead.email || "";
  document.getElementById("leadPhoneInput").value = lead.phone || "";
  document.getElementById("leadSourceInput").value = lead.source || lead.leadSource || "";
  document.getElementById("leadValueInput").value = lead.value || lead.estimatedPrice || "";
  document.getElementById("leadAddressInput").value = lead.address || lead.territory || "";
  document.getElementById("leadNotesInput").value = lead.notes || lead.description || "";
  document.getElementById("leadNextStepInput").value = lead.nextStep || "";
  document.getElementById("leadStatusInput").innerHTML = selectOptions(STATUS_OPTIONS, leadStatus(lead));
  document.getElementById("leadPriorityInput").innerHTML = selectOptions(PRIORITY_OPTIONS, leadPriority(lead));
  document.getElementById("leadCompanyInput").innerHTML = companyOptionsHtml(lead.companyId || "");
  document.getElementById("leadAssignedTeamBox").innerHTML = teamCheckboxesHtml(selectedAssignedIds(lead));
}

function renderActivityTimeline(activities = []) {
  const container = document.getElementById("leadActivityTimeline");
  if (!container) return;

  if (!activities.length) {
    container.innerHTML = `<article class="lead-activity-item"><strong>No activity yet</strong><span>Add the first note, call, text, or follow-up for this lead.</span></article>`;
    return;
  }

  container.innerHTML = activities
    .slice()
    .sort((a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt))
    .map((activity) => {
      const type = escapeHtml(humanize(activity.type || activity.eventType || "activity"));
      const message = escapeHtml(activity.message || activity.text || activity.notes || `${activity.from || ""} → ${activity.to || ""}` || "Activity recorded");
      const actor = escapeHtml(activity.createdByName || activity.actorName || "System");
      const time = escapeHtml(formatActivityTime(activity.createdAt));

      return `
        <article class="lead-activity-item">
          <strong>${type}</strong>
          <span>${message}</span>
          <small>${actor} • ${time}</small>
        </article>
      `;
    })
    .join("");
}

async function loadLeadActivities(leadId) {
  const shell = document.getElementById("leadActivityShell");
  const container = document.getElementById("leadActivityTimeline");

  if (shell) shell.hidden = false;
  if (container) {
    container.innerHTML = `<article class="lead-activity-item"><strong>Loading timeline...</strong><span>Pulling lead activity records.</span></article>`;
  }

  if (!leadId) {
    currentLeadActivities = [];
    renderActivityTimeline([]);
    return;
  }

  try {
    const snap = await getDocs(collection(db, "leads", leadId, "activities"));
    currentLeadActivities = snap.docs.map((activityDoc) => ({
      id: activityDoc.id,
      ...activityDoc.data()
    }));

    renderActivityTimeline(currentLeadActivities);
  } catch (error) {
    console.warn("Lead activity load failed:", error);

    if (container) {
      container.innerHTML = `<article class="lead-activity-item"><strong>Timeline unavailable</strong><span>${escapeHtml(error.message || "Could not load activities.")}</span></article>`;
    }
  }
}

async function addLeadActivity(leadId, data = {}) {
  if (!leadId) return null;

  const actor = currentActor();
  const existingLead = getLeadById(leadId) || {};

  const payload = {
    type: data.type || "note",
    eventType: data.type || "note",
    message: data.message || data.text || "Activity recorded",
    from: data.from || "",
    to: data.to || "",
    leadId,
    leadName: leadName(existingLead),
    companyId: existingLead.companyId || "",
    companyName: existingLead.companyName || "",
    createdAt: serverTimestamp(),
    createdBy: actor.uid,
    createdByName: actor.displayName,
    createdByEmail: actor.email
  };

  return addDoc(collection(db, "leads", leadId, "activities"), payload);
}

function openLeadModal(leadId = null) {
  injectCrudUi();

  editingLeadId = leadId;
  const lead = leadId ? getLeadById(leadId) : null;
  const modal = getModal();
  const form = document.getElementById("leadCrudForm");
  const title = document.getElementById("leadCrudTitle");
  const subtitle = document.getElementById("leadCrudSubtitle");
  const saveBtn = document.getElementById("leadCrudSaveBtn");
  const activityShell = document.getElementById("leadActivityShell");

  if (!modal || !form) return;

  form.reset();
  showMessage("");

  if (lead) {
    if (title) title.textContent = "Edit Lead";
    if (subtitle) subtitle.textContent = `Updating ${leadName(lead)} in Firestore.`;
    if (saveBtn) saveBtn.textContent = "Save Changes";
    setFormValues(lead);
    loadLeadActivities(leadId);
  } else {
    if (title) title.textContent = "Add Lead";
    if (subtitle) subtitle.textContent = "Create an advanced CRM lead with company and multi-rep assignment.";
    if (saveBtn) saveBtn.textContent = "Create Lead";
    setFormValues({ status: "new", priority: "normal", assignedTo: [] });
    currentLeadActivities = [];
    if (activityShell) activityShell.hidden = true;
  }

  modal.classList.add("open");
  setTimeout(() => document.getElementById("leadFullNameInput")?.focus(), 60);
}

function closeLeadModal() {
  getModal()?.classList.remove("open");
  editingLeadId = null;
  currentLeadActivities = [];
  showMessage("");
}

function selectedTeam() {
  const checked = Array.from(document.querySelectorAll('#leadAssignedTeamBox input[name="assignedTo"]:checked'));
  const ids = checked.map((input) => input.value);
  const names = ids.map((id) => userName(getUserById(id))).filter(Boolean);
  return { ids, names };
}

function formToLeadPayload() {
  const fullName = String(document.getElementById("leadFullNameInput")?.value || "").trim();
  const companyId = String(document.getElementById("leadCompanyInput")?.value || "").trim();
  const email = String(document.getElementById("leadEmailInput")?.value || "").trim().toLowerCase();
  const phone = String(document.getElementById("leadPhoneInput")?.value || "").trim();
  const status = normalize(document.getElementById("leadStatusInput")?.value || "new");
  const priority = normalize(document.getElementById("leadPriorityInput")?.value || "normal");
  const source = String(document.getElementById("leadSourceInput")?.value || "").trim();
  const value = Number(document.getElementById("leadValueInput")?.value || 0);
  const address = String(document.getElementById("leadAddressInput")?.value || "").trim();
  const notes = String(document.getElementById("leadNotesInput")?.value || "").trim();
  const nextStep = String(document.getElementById("leadNextStepInput")?.value || "").trim();

  if (!fullName) throw new Error("Lead name is required.");

  const company = getCompanyById(companyId);
  const team = selectedTeam();
  const actor = currentActor();

  return {
    fullName,
    name: fullName,
    email,
    phone,
    companyId,
    companyName: company ? companyName(company) : "",
    companySlug: company?.slug || "",
    status,
    priority,
    source,
    leadSource: source,
    value: Number.isFinite(value) ? value : 0,
    estimatedPrice: Number.isFinite(value) ? value : 0,
    address,
    territory: address,
    notes,
    description: notes,
    nextStep,
    assignedTo: team.ids,
    assignedToNames: team.names,
    assignedTeamIds: team.ids,
    assignedTeamNames: team.names,
    assignmentCount: team.ids.length,
    lastActivityType: editingLeadId ? "lead_updated" : "lead_created",
    lastActivityAt: serverTimestamp(),
    searchText: [
      fullName,
      email,
      phone,
      company ? companyName(company) : "",
      status,
      priority,
      source,
      address,
      notes,
      nextStep,
      team.names.join(" ")
    ].filter(Boolean).join(" ").toLowerCase(),
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
    updatedByEmail: actor.email,
    updatedByName: actor.displayName
  };
}

async function saveLead(event) {
  event?.preventDefault();

  const saveBtn = document.getElementById("leadCrudSaveBtn");
  const previous = editingLeadId ? getLeadById(editingLeadId) : null;

  try {
    const payload = formToLeadPayload();

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = editingLeadId ? "Saving..." : "Creating...";
    }

    let savedLeadId = editingLeadId;

    if (editingLeadId) {
      await updateDoc(doc(db, "leads", editingLeadId), payload);

      await addLeadActivity(editingLeadId, {
        type: "lead_updated",
        message: "Lead updated"
      });

      if (previous && leadStatus(previous) !== payload.status) {
        await addLeadActivity(editingLeadId, {
          type: "status_change",
          message: `Status changed from ${humanize(leadStatus(previous))} to ${humanize(payload.status)}`,
          from: leadStatus(previous),
          to: payload.status
        });
      }

      showMessage("Lead updated successfully.", "success");
    } else {
      const actor = currentActor();

      const newDoc = await addDoc(collection(db, "leads"), {
        ...payload,
        createdAt: serverTimestamp(),
        createdBy: actor.uid,
        createdByEmail: actor.email,
        createdByName: actor.displayName
      });

      savedLeadId = newDoc.id;

      await addLeadActivity(savedLeadId, {
        type: "lead_created",
        message: "Lead created"
      });

      showMessage("Lead created successfully.", "success");
    }

    await loadLeads();

    if (savedLeadId) {
      openLeadModal(savedLeadId);
      showMessage("Saved. Timeline updated.", "success");
    }
  } catch (error) {
    console.error("Lead save failed:", error);
    showMessage(error.message || "Lead save failed.", "error");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = editingLeadId ? "Save Changes" : "Create Lead";
    }
  }
}

async function addManualActivity() {
  if (!editingLeadId) {
    showMessage("Save the lead before adding timeline activity.", "error");
    return;
  }

  const typeInput = document.getElementById("leadActivityTypeInput");
  const messageInput = document.getElementById("leadActivityMessageInput");
  const addBtn = document.getElementById("leadActivityAddBtn");

  const type = typeInput?.value || "note";
  const message = String(messageInput?.value || "").trim();

  if (!message) {
    showMessage("Type an activity note first.", "error");
    return;
  }

  try {
    if (addBtn) {
      addBtn.disabled = true;
      addBtn.textContent = "Adding...";
    }

    await addLeadActivity(editingLeadId, {
      type,
      message
    });

    if (messageInput) messageInput.value = "";

    await updateDoc(doc(db, "leads", editingLeadId), {
      lastActivityType: type,
      lastActivityAt: serverTimestamp(),
      lastActivityMessage: message
    });

    await loadLeadActivities(editingLeadId);
    showMessage("Activity added.", "success");
  } catch (error) {
    console.error("Activity add failed:", error);
    showMessage(error.message || "Activity could not be added.", "error");
  } finally {
    if (addBtn) {
      addBtn.disabled = false;
      addBtn.textContent = "Add Activity";
    }
  }
}

async function deleteLead(leadId) {
  const lead = getLeadById(leadId);
  if (!lead) return;

  const confirmed = window.confirm(
    `Delete ${leadName(lead)}? This removes the lead from Firestore and writes history. This cannot be undone.`
  );

  if (!confirmed) return;

  try {
    await addLeadActivity(leadId, {
      type: "lead_deleted",
      message: "Lead deleted"
    });

    await deleteDoc(doc(db, "leads", leadId));

    leadsData = leadsData.filter((item) => String(item.id) !== String(leadId));
    renderLeads();
  } catch (error) {
    console.error("Lead delete failed:", error);
    alert(error.message || "Unable to delete lead.");
  }
}

function bindCrudEvents() {
  injectCrudUi();

  document.getElementById("leadCreateBtn")?.addEventListener("click", () => openLeadModal());
  document.getElementById("leadCrudCloseBtn")?.addEventListener("click", closeLeadModal);
  document.getElementById("leadCrudCancelBtn")?.addEventListener("click", closeLeadModal);
  document.getElementById("leadCrudForm")?.addEventListener("submit", saveLead);
  document.getElementById("leadActivityAddBtn")?.addEventListener("click", addManualActivity);

  document.getElementById("leadActivityMessageInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addManualActivity();
    }
  });

  getModal()?.addEventListener("click", (event) => {
    if (event.target === getModal()) closeLeadModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && getModal()?.classList.contains("open")) {
      closeLeadModal();
    }
  });

  leadsList?.addEventListener("click", (event) => {
    const editBtn = event.target.closest("[data-lead-edit]");
    const deleteBtn = event.target.closest("[data-lead-delete]");

    if (editBtn) return openLeadModal(editBtn.getAttribute("data-lead-edit"));
    if (deleteBtn) return deleteLead(deleteBtn.getAttribute("data-lead-delete"));
  });
}

function bindEvents() {
  if (hasBoundEvents) return;
  hasBoundEvents = true;

  injectCrudUi();
  bindCrudEvents();

  leadsSearch?.addEventListener("input", renderLeads);
  leadsRefreshBtnTop?.addEventListener("click", loadLeads);
  leadsRefreshBtnSide?.addEventListener("click", loadLeads);

  leadsSortBtn?.addEventListener("click", () => {
    sortAsc = !sortAsc;
    leadsSortBtn.textContent = sortAsc ? "Sort A–Z" : "Sort Z–A";
    renderLeads();
  });

  document.querySelectorAll(".dashboard-nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".dashboard-nav-link").forEach((item) => item.classList.remove("active"));
      link.classList.add("active");
    });
  });
}

function initLeadsPage() {
  if (hasStartedAuthWatch) return;
  hasStartedAuthWatch = true;

  bindEvents();

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      navigateWithLoader("/evaraos/login.html", {
        title: "Returning to login",
        subtitle: "Your session is not active."
      });
      return;
    }

    currentFirebaseUser = user;
    loadLeads();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLeadsPage);
} else {
  initLeadsPage();
}