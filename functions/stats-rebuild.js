const functions = require("firebase-functions");
const admin = require("firebase-admin");

const db = admin.firestore();

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

function makeEmptyDashboardStats() {
  return {
    companies: { total: 0, active: 0 },
    users: { total: 0, active: 0, roles: {} },
    leads: { total: 0, open: 0, hot: 0, statuses: {}, priorities: {} },
    jobs: { total: 0, inMotion: 0, statuses: {} },
    rebuiltAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

function makeEmptyCompanyStats() {
  return {
    leads: { total: 0, open: 0, hot: 0, statuses: {}, priorities: {} },
    jobs: { total: 0, inMotion: 0, statuses: {} },
    rebuiltAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

function bump(object, path, amount = 1) {
  const parts = path.split(".");
  let cursor = object;
  while (parts.length > 1) {
    const part = parts.shift();
    cursor[part] = cursor[part] || {};
    cursor = cursor[part];
  }
  const final = parts[0];
  cursor[final] = Number(cursor[final] || 0) + amount;
}

function companyBucket(companyStats, id) {
  if (!companyStats[id]) companyStats[id] = makeEmptyCompanyStats();
  return companyStats[id];
}

function countCompany(stats, data = {}) {
  bump(stats, "companies.total");
  if (isActive(data)) bump(stats, "companies.active");
}

function countUser(stats, data = {}) {
  bump(stats, "users.total");
  if (isActive(data)) bump(stats, "users.active");
  bump(stats, `users.roles.${key(data.role || "customer")}`);
}

function countLead(stats, companyStats, data = {}) {
  const status = key(data.status || "new");
  const priority = key(data.priority || "normal");
  const targets = [stats, companyBucket(companyStats, companyId(data))];
  targets.forEach((target) => {
    bump(target, "leads.total");
    if (isLeadOpen(status)) bump(target, "leads.open");
    if (isHot(priority)) bump(target, "leads.hot");
    bump(target, `leads.statuses.${status}`);
    bump(target, `leads.priorities.${priority}`);
  });
}

function countJob(stats, companyStats, data = {}) {
  const status = key(data.status || "active");
  const targets = [stats, companyBucket(companyStats, companyId(data))];
  targets.forEach((target) => {
    bump(target, "jobs.total");
    if (isJobMoving(status)) bump(target, "jobs.inMotion");
    bump(target, `jobs.statuses.${status}`);
  });
}

async function readAll(collectionName) {
  const rows = [];
  let query = db.collection(collectionName).orderBy(admin.firestore.FieldPath.documentId()).limit(500);
  let last = null;

  while (true) {
    const snap = last ? await query.startAfter(last).get() : await query.get();
    if (snap.empty) break;
    snap.docs.forEach((doc) => rows.push({ id: doc.id, ...doc.data() }));
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < 500) break;
  }

  return rows;
}

async function rebuildStats() {
  const stats = makeEmptyDashboardStats();
  const companyStats = {};

  const [companies, users, leads, jobs] = await Promise.all([
    readAll("companies"),
    readAll("users"),
    readAll("leads"),
    readAll("jobs")
  ]);

  companies.forEach((item) => countCompany(stats, item));
  users.forEach((item) => countUser(stats, item));
  leads.forEach((item) => countLead(stats, companyStats, item));
  jobs.forEach((item) => countJob(stats, companyStats, item));

  const batch = db.batch();
  batch.set(db.doc("dashboard_stats/global"), stats, { merge: false });
  Object.entries(companyStats).forEach(([id, data]) => {
    batch.set(db.doc(`company_stats/${id}`), data, { merge: false });
  });
  await batch.commit();

  return {
    companies: companies.length,
    users: users.length,
    leads: leads.length,
    jobs: jobs.length,
    companyStats: Object.keys(companyStats).length
  };
}

exports.rebuildStats = functions.https.onRequest(async (req, res) => {
  try {
    const token = req.get("x-evaraos-admin-token") || req.query.token || "";
    const expected = env("STATS_REBUILD_TOKEN");

    if (!expected || token !== expected) {
      res.status(403).json({ ok: false, error: "Forbidden" });
      return;
    }

    const result = await rebuildStats();
    res.json({ ok: true, result });
  } catch (error) {
    console.error("rebuildStats failed:", error);
    res.status(500).json({ ok: false, error: error.message || String(error) });
  }
});
