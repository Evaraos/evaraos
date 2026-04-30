const admin = require("firebase-admin");
const { onDocumentCreated, onDocumentDeleted, onDocumentWritten } = require("firebase-functions/v2/firestore");

admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const dashboardRef = db.doc("dashboard_stats/global");

const OPEN_LEADS = ["new", "open", "contacted", "qualified", "proposal", "scheduled"];
const HOT_PRIORITIES = ["hot", "high", "urgent"];
const MOVING_JOBS = ["in progress", "active", "pending", "working", "scheduled"];
const INACTIVE = ["inactive", "archived", "deleted", "lost", "cancelled", "canceled"];

function norm(value = "") {
  return String(value || "").trim().toLowerCase();
}

function safeKey(value = "unknown") {
  return norm(value).replace(/[^a-z0-9_]/g, "_") || "unknown";
}

function getCompanyId(data = {}) {
  return String(data.companyId || "unassigned").trim() || "unassigned";
}

function isActive(data = {}) {
  return !INACTIVE.includes(norm(data.status || data.health || "active"));
}

function inc(path, amount) {
  return { [path]: FieldValue.increment(amount) };
}

function stamp(patch = {}) {
  return { ...patch, updatedAt: FieldValue.serverTimestamp() };
}

function createPatch(type, data = {}) {
  if (type === "companies") return { ...inc("companies.total", 1), ...inc("companies.active", isActive(data) ? 1 : 0) };
  if (type === "users") return { ...inc("users.total", 1), ...inc("users.active", isActive(data) ? 1 : 0), ...inc(`users.roles.${safeKey(data.role || "customer")}`, 1) };
  if (type === "leads") {
    const status = safeKey(data.status || "new");
    const priority = safeKey(data.priority || "normal");
    return { ...inc("leads.total", 1), ...inc("leads.open", OPEN_LEADS.includes(status) ? 1 : 0), ...inc("leads.hot", HOT_PRIORITIES.includes(priority) ? 1 : 0), ...inc(`leads.statuses.${status}`, 1), ...inc(`leads.priorities.${priority}`, 1) };
  }
  if (type === "jobs") {
    const status = safeKey(data.status || "active");
    return { ...inc("jobs.total", 1), ...inc("jobs.inMotion", MOVING_JOBS.includes(status) ? 1 : 0), ...inc(`jobs.statuses.${status}`, 1) };
  }
  return {};
}

function deletePatch(type, data = {}) {
  if (type === "companies") return { ...inc("companies.total", -1), ...inc("companies.active", isActive(data) ? -1 : 0) };
  if (type === "users") return { ...inc("users.total", -1), ...inc("users.active", isActive(data) ? -1 : 0), ...inc(`users.roles.${safeKey(data.role || "customer")}`, -1) };
  if (type === "leads") {
    const status = safeKey(data.status || "new");
    const priority = safeKey(data.priority || "normal");
    return { ...inc("leads.total", -1), ...inc("leads.open", OPEN_LEADS.includes(status) ? -1 : 0), ...inc("leads.hot", HOT_PRIORITIES.includes(priority) ? -1 : 0), ...inc(`leads.statuses.${status}`, -1), ...inc(`leads.priorities.${priority}`, -1) };
  }
  if (type === "jobs") {
    const status = safeKey(data.status || "active");
    return { ...inc("jobs.total", -1), ...inc("jobs.inMotion", MOVING_JOBS.includes(status) ? -1 : 0), ...inc(`jobs.statuses.${status}`, -1) };
  }
  return {};
}

function updatePatch(type, before = {}, after = {}) {
  const patch = {};
  if (type === "companies" && isActive(before) !== isActive(after)) Object.assign(patch, inc("companies.active", isActive(after) ? 1 : -1));
  if (type === "users") {
    const oldRole = safeKey(before.role || "customer");
    const newRole = safeKey(after.role || "customer");
    if (oldRole !== newRole) Object.assign(patch, inc(`users.roles.${oldRole}`, -1), inc(`users.roles.${newRole}`, 1));
    if (isActive(before) !== isActive(after)) Object.assign(patch, inc("users.active", isActive(after) ? 1 : -1));
  }
  if (type === "leads") {
    const oldStatus = safeKey(before.status || "new");
    const newStatus = safeKey(after.status || "new");
    const oldPriority = safeKey(before.priority || "normal");
    const newPriority = safeKey(after.priority || "normal");
    if (oldStatus !== newStatus) {
      Object.assign(patch, inc(`leads.statuses.${oldStatus}`, -1), inc(`leads.statuses.${newStatus}`, 1));
      if (OPEN_LEADS.includes(oldStatus) !== OPEN_LEADS.includes(newStatus)) Object.assign(patch, inc("leads.open", OPEN_LEADS.includes(newStatus) ? 1 : -1));
    }
    if (oldPriority !== newPriority) {
      Object.assign(patch, inc(`leads.priorities.${oldPriority}`, -1), inc(`leads.priorities.${newPriority}`, 1));
      if (HOT_PRIORITIES.includes(oldPriority) !== HOT_PRIORITIES.includes(newPriority)) Object.assign(patch, inc("leads.hot", HOT_PRIORITIES.includes(newPriority) ? 1 : -1));
    }
  }
  if (type === "jobs") {
    const oldStatus = safeKey(before.status || "active");
    const newStatus = safeKey(after.status || "active");
    if (oldStatus !== newStatus) {
      Object.assign(patch, inc(`jobs.statuses.${oldStatus}`, -1), inc(`jobs.statuses.${newStatus}`, 1));
      if (MOVING_JOBS.includes(oldStatus) !== MOVING_JOBS.includes(newStatus)) Object.assign(patch, inc("jobs.inMotion", MOVING_JOBS.includes(newStatus) ? 1 : -1));
    }
  }
  return patch;
}

async function writeDashboard(patch) {
  await dashboardRef.set(stamp(patch), { merge: true });
}

async function writeCompany(companyId, patch) {
  await db.doc(`company_stats/${companyId || "unassigned"}`).set(stamp(patch), { merge: true });
}

function attachStats(type) {
  exports[`on_${type}_created`] = onDocumentCreated(`${type}/{id}`, async (event) => {
    const data = event.data.data() || {};
    const patch = createPatch(type, data);
    const writes = [writeDashboard(patch)];
    if (["leads", "jobs"].includes(type)) writes.push(writeCompany(getCompanyId(data), patch));
    await Promise.all(writes);
  });

  exports[`on_${type}_deleted`] = onDocumentDeleted(`${type}/{id}`, async (event) => {
    const data = event.data.data() || {};
    const patch = deletePatch(type, data);
    const writes = [writeDashboard(patch)];
    if (["leads", "jobs"].includes(type)) writes.push(writeCompany(getCompanyId(data), patch));
    await Promise.all(writes);
  });

  exports[`on_${type}_written`] = onDocumentWritten(`${type}/{id}`, async (event) => {
    if (!event.data.before.exists || !event.data.after.exists) return;
    const before = event.data.before.data() || {};
    const after = event.data.after.data() || {};
    const patch = updatePatch(type, before, after);
    const writes = [];
    if (Object.keys(patch).length) writes.push(writeDashboard(patch));

    if (["leads", "jobs"].includes(type)) {
      const beforeCompany = getCompanyId(before);
      const afterCompany = getCompanyId(after);
      if (beforeCompany !== afterCompany) {
        writes.push(writeCompany(beforeCompany, deletePatch(type, before)));
        writes.push(writeCompany(afterCompany, createPatch(type, after)));
      } else if (Object.keys(patch).length) {
        writes.push(writeCompany(afterCompany, patch));
      }
    }

    if (writes.length) await Promise.all(writes);
  });
}

["companies", "users", "leads", "jobs"].forEach(attachStats);
exports.rebuildStats = require("./stats-rebuild").rebuildStats;
exports.sanitizeLeadIdentity = require("./lead-privacy").sanitizeLeadIdentity;
exports.notifyLeadAssignment = require("./lead-notifications").notifyLeadAssignment;
