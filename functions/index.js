const admin = require("firebase-admin");
const { onDocumentCreated, onDocumentDeleted, onDocumentWritten } = require("firebase-functions/v2/firestore");
const functions = require("firebase-functions");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const dashboardRef = db.doc("dashboard_stats/global");

function env(name) {
  return process.env[name] || functions.config()?.evaraos?.[name.toLowerCase()] || "";
}

function norm(value = "") {
  return String(value || "").trim().toLowerCase();
}

function key(value = "unknown") {
  return norm(value).replace(/[^a-z0-9_]/g, "_") || "unknown";
}

function companyId(data = {}) {
  return String(data.companyId || "unassigned").trim() || "unassigned";
}

function isActive(data = {}) {
  return !["inactive", "archived", "deleted", "lost", "cancelled", "canceled"].includes(norm(data.status || data.health || "active"));
}

function isLeadOpen(status = "") {
  return ["new", "open", "contacted", "qualified", "proposal", "scheduled"].includes(norm(status));
}

function isHot(priority = "") {
  return ["hot", "high", "urgent"].includes(norm(priority));
}

function isJobMoving(status = "") {
  return ["in progress", "active", "pending", "working", "scheduled"].includes(norm(status));
}

function inc(path, amount) {
  return { [path]: FieldValue.increment(amount) };
}

function withUpdatedAt(patch = {}) {
  return { ...patch, updatedAt: FieldValue.serverTimestamp() };
}

async function setDashboard(patch) {
  await dashboardRef.set(withUpdatedAt(patch), { merge: true });
}

async function setCompanyStats(id, patch) {
  await db.doc(`company_stats/${id || "unassigned"}`).set(withUpdatedAt(patch), { merge: true });
}

function createPatch(type, data = {}) {
  if (type === "companies") return { ...inc("companies.total", 1), ...inc("companies.active", isActive(data) ? 1 : 0) };
  if (type === "users") {
    const role = key(data.role || "customer");
    return { ...inc("users.total", 1), ...inc("users.active", isActive(data) ? 1 : 0), ...inc(`users.roles.${role}`, 1) };
  }
  if (type === "leads") {
    const status = key(data.status || "new");
    const priority = key(data.priority || "normal");
    return {
      ...inc("leads.total", 1),
      ...inc("leads.open", isLeadOpen(status) ? 1 : 0),
      ...inc("leads.hot", isHot(priority) ? 1 : 0),
      ...inc(`leads.statuses.${status}`, 1),
      ...inc(`leads.priorities.${priority}`, 1)
    };
  }
  if (type === "jobs") {
    const status = key(data.status || "active");
    return { ...inc("jobs.total", 1), ...inc("jobs.inMotion", isJobMoving(status) ? 1 : 0), ...inc(`jobs.statuses.${status}`, 1) };
  }
  return {};
}

function deletePatch(type, data = {}) {
  const patch = createPatch(type, data);
  Object.keys(patch).forEach((path) => { patch[path] = FieldValue.increment(-Math.abs(patch[path]._operand || 1)); });
  return negativeCreatePatch(type, data);
}

function negativeCreatePatch(type, data = {}) {
  if (type === "companies") return { ...inc("companies.total", -1), ...inc("companies.active", isActive(data) ? -1 : 0) };
  if (type === "users") {
    const role = key(data.role || "customer");
    return { ...inc("users.total", -1), ...inc("users.active", isActive(data) ? -1 : 0), ...inc(`users.roles.${role}`, -1) };
  }
  if (type === "leads") {
    const status = key(data.status || "new");
    const priority = key(data.priority || "normal");
    return {
      ...inc("leads.total", -1),
      ...inc("leads.open", isLeadOpen(status) ? -1 : 0),
      ...inc("leads.hot", isHot(priority) ? -1 : 0),
      ...inc(`leads.statuses.${status}`, -1),
      ...inc(`leads.priorities.${priority}`, -1)
    };
  }
  if (type === "jobs") {
    const status = key(data.status || "active");
    return { ...inc("jobs.total", -1), ...inc("jobs.inMotion", isJobMoving(status) ? -1 : 0), ...inc(`jobs.statuses.${status}`, -1) };
  }
  return {};
}

function updatePatch(type, before = {}, after = {}) {
  const patch = {};
  if (type === "companies" && isActive(before) !== isActive(after)) Object.assign(patch, inc("companies.active", isActive(after) ? 1 : -1));
  if (type === "users") {
    const oldRole = key(before.role || "customer");
    const newRole = key(after.role || "customer");
    if (oldRole !== newRole) Object.assign(patch, inc(`users.roles.${oldRole}`, -1), inc(`users.roles.${newRole}`, 1));
    if (isActive(before) !== isActive(after)) Object.assign(patch, inc("users.active", isActive(after) ? 1 : -1));
  }
  if (type === "leads") {
    const oldStatus = key(before.status || "new");
    const newStatus = key(after.status || "new");
    const oldPriority = key(before.priority || "normal");
    const newPriority = key(after.priority || "normal");
    if (oldStatus !== newStatus) {
      Object.assign(patch, inc(`leads.statuses.${oldStatus}`, -1), inc(`leads.statuses.${newStatus}`, 1));
      if (isLeadOpen(oldStatus) !== isLeadOpen(newStatus)) Object.assign(patch, inc("leads.open", isLeadOpen(newStatus) ? 1 : -1));
    }
    if (oldPriority !== newPriority) {
      Object.assign(patch, inc(`leads.priorities.${oldPriority}`, -1), inc(`leads.priorities.${newPriority}`, 1));
      if (isHot(oldPriority) !== isHot(newPriority)) Object.assign(patch, inc("leads.hot", isHot(newPriority) ? 1 : -1));
    }
  }
  if (type === "jobs") {
    const oldStatus = key(before.status || "active");
    const newStatus = key(after.status || "active");
    if (oldStatus !== newStatus) {
      Object.assign(patch, inc(`jobs.statuses.${oldStatus}`, -1), inc(`jobs.statuses.${newStatus}`, 1));
      if (isJobMoving(oldStatus) !== isJobMoving(newStatus)) Object.assign(patch, inc("jobs.inMotion", isJobMoving(newStatus) ? 1 : -1));
    }
  }
  return patch;
}

function attachCollectionStats(collectionName) {
  exports[`on_${collectionName}_created`] = onDocumentCreated(`${collectionName}/{id}`, async (event) => {
    const data = event.data.data() || {};
    const patch = createPatch(collectionName, data);
    const writes = [setDashboard(patch)];
    if (["leads", "jobs"].includes(collectionName)) writes.push(setCompanyStats(companyId(data), patch));
    await Promise.all(writes);
  });

  exports[`on_${collectionName}_deleted`] = onDocumentDeleted(`${collectionName}/{id}`, async (event) => {
    const data = event.data.data() || {};
    const patch = negativeCreatePatch(collectionName, data);
    const writes = [setDashboard(patch)];
    if (["leads", "jobs"].includes(collectionName)) writes.push(setCompanyStats(companyId(data), patch));
    await Promise.all(writes);
  });

  exports[`on_${collectionName}_written`] = onDocumentWritten(`${collectionName}/{id}`, async (event) => {
    if (!event.data.before.exists || !event.data.after.exists) return;
    const before = event.data.before.data() || {};
    const after = event.data.after.data() || {};
    const patch = updatePatch(collectionName, before, after);
    if (!Object.keys(patch).length) return;

    const writes = [setDashboard(patch)];
    if (["leads", "jobs"].includes(collectionName)) {
      const beforeCompany = companyId(before);
      const afterCompany = companyId(after);
      if (beforeCompany !== afterCompany) {
        writes.push(setCompanyStats(beforeCompany, negativeCreatePatch(collectionName, before)));
        writes.push(setCompanyStats(afterCompany, createPatch(collectionName, after)));
      } else {
        writes.push(setCompanyStats(afterCompany, patch));
      }
    }
    await Promise.all(writes);
  });
}

["companies", "users", "leads", "jobs"].forEach(attachCollectionStats);

exports.auditAlert = functions.firestore.document("audit_logs/{logId}").onCreate(async (snap, context) => {
  const data = snap.data() || {};
  const action = String(data.action || "").trim();
  const suspiciousActions = ["ROLE_CHANGE", "COMPANY_MOVE", "DELETE_USER"];
  if (!suspiciousActions.includes(action)) return null;

  const emailUser = env("EMAIL_USER");
  const emailPass = env("EMAIL_PASS");
  if (!emailUser || !emailPass) {
    console.warn("auditAlert skipped: EMAIL_USER or EMAIL_PASS not configured.");
    return null;
  }

  const transporter = nodemailer.createTransport({ service: "gmail", auth: { user: emailUser, pass: emailPass } });
  await transporter.sendMail({
    from: emailUser,
    to: emailUser,
    subject: "Suspicious Activity Detected",
    text: `Suspicious activity detected in audit_logs.\n\nAction: ${action}\nActor: ${data.actor || data.actorName || "Unknown"}\nTarget: ${data.target || data.targetUser || "Unknown"}\nLog ID: ${context.params.logId}\n`
  });
  return null;
});
