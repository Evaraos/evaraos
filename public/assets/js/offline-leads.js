import {
  db,
  doc,
  setDoc,
  serverTimestamp,
  getSavedUserProfile
} from "./firebase.js";

import {
  queueLead,
  getQueuedLeads,
  markLeadSyncing,
  markLeadFailed,
  archiveSyncedLead,
  getLeadQueueCounts
} from "./offline-lead-queue.js";

import { canUseOfflineStaffTools } from "./device-trust.js";
import { notify } from "./evara-notifications.js";

let syncing = false;
let formInterceptorBound = false;

function actor() {
  const profile = getSavedUserProfile?.() || {};
  return {
    uid: profile.uid || "",
    email: profile.email || "",
    name: profile.displayName || profile.fullName || profile.name || profile.email || "Staff",
    role: profile.role || "",
    companyId: profile.companyId || ""
  };
}

function offlineAllowed() {
  const profile = getSavedUserProfile?.() || {};
  return canUseOfflineStaffTools(profile);
}

function guardOfflineTools({ notifyUser = false } = {}) {
  const allowed = offlineAllowed();
  document.documentElement.toggleAttribute("data-offline-staff-ready", allowed);
  if (!allowed && notifyUser) {
    notify({
      title: "Offline locked",
      message: "Staff must log in and check Remember this device before using offline lead capture.",
      tone: "warning"
    });
  }
  return allowed;
}

function value(id) {
  return String(document.getElementById(id)?.value || "").trim();
}

function selectedAssignedIds() {
  return Array.from(document.querySelectorAll("input[name='assignedTo']:checked")).map((input) => input.value).filter(Boolean);
}

function selectedAssignedNames() {
  return Array.from(document.querySelectorAll("input[name='assignedTo']:checked")).map((input) => input.closest("label")?.textContent?.trim() || "").filter(Boolean);
}

function makeId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `lead_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function currentCompanyName() {
  const select = document.getElementById("leadCompanyInput");
  const selected = select?.selectedOptions?.[0];
  return selected?.value ? selected.textContent.trim() : "";
}

function setLeadCrudMessage(message, tone = "") {
  const el = document.getElementById("leadCrudMessage");
  if (!el) return;
  el.textContent = message;
  el.dataset.tone = tone;
}

function closeLeadModal() {
  const modal = document.getElementById("leadCrudModal");
  modal?.classList.remove("open");
}

export function buildOfflineLeadPayload() {
  const user = actor();
  const clientLeadId = makeId();
  const fullName = value("leadFullNameInput");
  const leadValue = Number(value("leadValueInput") || 0);
  const assignedTo = selectedAssignedIds();
  const assignedToNames = selectedAssignedNames();

  return {
    clientLeadId,
    id: clientLeadId,
    fullName,
    name: fullName,
    customerName: fullName,
    email: value("leadEmailInput"),
    phone: value("leadPhoneInput"),
    companyId: value("leadCompanyInput") || user.companyId || "",
    companyName: currentCompanyName(),
    status: value("leadStatusInput") || "new",
    priority: value("leadPriorityInput") || "normal",
    source: value("leadSourceInput"),
    leadSource: value("leadSourceInput"),
    value: Number.isFinite(leadValue) ? leadValue : 0,
    estimatedPrice: Number.isFinite(leadValue) ? leadValue : 0,
    address: value("leadAddressInput"),
    territory: value("leadAddressInput"),
    notes: value("leadNotesInput"),
    description: value("leadNotesInput"),
    nextStep: value("leadNextStepInput"),
    assignedTo,
    assignedTeamIds: assignedTo,
    assignedToNames,
    assignedTeamNames: assignedToNames,
    createdBy: user.uid,
    createdByEmail: user.email,
    createdByName: user.name,
    createdByRole: user.role,
    updatedBy: user.uid,
    updatedByEmail: user.email,
    updatedByName: user.name,
    createdOfflineCapable: true,
    searchText: [fullName, value("leadEmailInput"), value("leadPhoneInput"), value("leadSourceInput"), value("leadAddressInput"), value("leadNotesInput"), value("leadNextStepInput"), assignedToNames.join(" ")]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
  };
}

async function writeLead(clientLeadId, payload) {
  await setDoc(doc(db, "leads", clientLeadId), {
    ...payload,
    clientLeadId,
    id: clientLeadId,
    syncStatus: "synced",
    syncedAt: serverTimestamp(),
    createdAt: payload.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function saveLeadOfflineCapable(payload = buildOfflineLeadPayload()) {
  const clientLeadId = payload.clientLeadId || makeId();
  const finalPayload = { ...payload, clientLeadId, id: clientLeadId };

  if (!navigator.onLine) {
    if (!guardOfflineTools({ notifyUser: true })) {
      return { queued: false, blocked: true, clientLeadId };
    }

    const record = await queueLead({
      ...finalPayload,
      syncStatus: "pending_offline",
      createdOfflineAt: new Date().toISOString()
    });

    await refreshLeadQueueUi();
    notify({ title: "Lead saved offline", message: "It will upload automatically when WiFi returns.", tone: "success" });
    return { queued: true, clientLeadId, record };
  }

  try {
    await writeLead(clientLeadId, finalPayload);
    await refreshLeadQueueUi();
    return { queued: false, clientLeadId };
  } catch (error) {
    if (!guardOfflineTools({ notifyUser: true })) {
      throw error;
    }

    const record = await queueLead({
      ...finalPayload,
      syncStatus: "pending_retry",
      createdOfflineAt: new Date().toISOString(),
      lastOnlineError: error.message || String(error)
    });

    await refreshLeadQueueUi();
    notify({ title: "Lead queued", message: "Connection failed, so this lead is waiting in offline queue.", tone: "warning" });
    return { queued: true, clientLeadId, record, error };
  }
}

export async function syncLeadQueue() {
  if (syncing || !navigator.onLine) return { synced: 0, failed: 0 };
  if (!guardOfflineTools()) return { synced: 0, failed: 0, blocked: true };

  syncing = true;
  let synced = 0;
  let failed = 0;

  try {
    const rows = await getQueuedLeads();
    if (rows.length) notify({ title: "Syncing leads", message: `${rows.length} queued lead${rows.length === 1 ? "" : "s"} uploading now.`, tone: "info" });

    for (const row of rows) {
      try {
        await markLeadSyncing(row.clientLeadId, Number(row.attempts || 0));
        await writeLead(row.clientLeadId, {
          ...row.payload,
          syncStatus: "synced_from_queue"
        });
        await archiveSyncedLead(row.clientLeadId);
        synced += 1;
      } catch (error) {
        failed += 1;
        await markLeadFailed(row.clientLeadId, error.message || String(error));
      }
    }
  } finally {
    syncing = false;
    await refreshLeadQueueUi();
  }

  if (synced || failed) {
    notify({
      title: failed ? "Lead sync finished with issues" : "Lead sync complete",
      message: `Synced: ${synced}. Failed: ${failed}.`,
      tone: failed ? "warning" : "success"
    });
  }

  return { synced, failed };
}

function ensureLeadQueueUi() {
  if (document.getElementById("leadOfflineStatus")) return;
  const target = document.querySelector("#leadsOverviewSection .dashboard-hero-actions") || document.querySelector(".dashboard-hero-actions");
  if (!target) return;

  const wrap = document.createElement("div");
  wrap.className = "offline-lead-status-wrap";
  wrap.innerHTML = `
    <span id="leadOfflineStatus" class="dashboard-status-pill working">Online</span>
    <button type="button" id="leadQueueSyncBtn" class="btn btn-theme-secondary">Queue Clear</button>
  `;
  target.appendChild(wrap);

  document.getElementById("leadQueueSyncBtn")?.addEventListener("click", async () => {
    const result = await syncLeadQueue();
    if (result.blocked) {
      notify({ title: "Offline locked", message: "Log in with Remember this device checked to sync offline leads.", tone: "warning" });
    }
  });
}

export async function refreshLeadQueueUi() {
  ensureLeadQueueUi();
  const status = document.getElementById("leadOfflineStatus");
  const queueBtn = document.getElementById("leadQueueSyncBtn");
  const allowed = guardOfflineTools();
  const counts = await getLeadQueueCounts().catch(() => ({ total: 0, failed: 0 }));

  if (status) {
    if (!allowed) {
      status.textContent = navigator.onLine ? "Offline Locked" : "Offline Locked";
      status.className = "dashboard-status-pill warning";
    } else {
      status.textContent = navigator.onLine ? "Online" : "Offline Ready";
      status.className = `dashboard-status-pill ${navigator.onLine ? "success" : "warning"}`;
    }
  }

  if (queueBtn) {
    queueBtn.textContent = counts.total ? `Queued: ${counts.total}${counts.failed ? ` • Failed: ${counts.failed}` : ""}` : "Queue Clear";
    queueBtn.disabled = !allowed && !counts.total;
  }
}

function bindOfflineFormInterceptor() {
  if (formInterceptorBound) return;
  formInterceptorBound = true;

  document.addEventListener("submit", async (event) => {
    const form = event.target?.closest?.("#leadCrudForm");
    if (!form) return;
    if (navigator.onLine) return;

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();

    if (!guardOfflineTools({ notifyUser: true })) {
      setLeadCrudMessage("Offline is locked. Log in and check Remember this device first.", "error");
      return;
    }

    const payload = buildOfflineLeadPayload();
    if (!payload.fullName) {
      setLeadCrudMessage("Lead name is required before saving offline.", "error");
      return;
    }

    await saveLeadOfflineCapable(payload);
    setLeadCrudMessage("Saved offline. This lead will upload automatically when WiFi returns.", "success");

    setTimeout(() => {
      closeLeadModal();
      window.dispatchEvent(new CustomEvent("evara:lead-saved-offline", { detail: { clientLeadId: payload.clientLeadId } }));
    }, 450);
  }, true);
}

function init() {
  ensureLeadQueueUi();
  bindOfflineFormInterceptor();
  refreshLeadQueueUi();
  if (navigator.onLine) syncLeadQueue();
  window.addEventListener("online", () => { refreshLeadQueueUi(); syncLeadQueue(); });
  window.addEventListener("offline", refreshLeadQueueUi);
  window.addEventListener("evara:lead-queue-changed", refreshLeadQueueUi);
  window.addEventListener("evara:session-ready", refreshLeadQueueUi);
}

window.EvaraOfflineLeads = {
  buildOfflineLeadPayload,
  saveLeadOfflineCapable,
  syncLeadQueue,
  refreshLeadQueueUi,
  guardOfflineTools
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
