const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const INACTIVE = ["inactive", "archived", "deleted", "lost", "cancelled", "canceled", "suspended", "disabled"];
const OPEN_LEADS = ["new", "open", "contacted", "qualified", "proposal", "scheduled"];
const HOT_PRIORITIES = ["hot", "high", "urgent"];
const MOVING_JOBS = ["in progress", "in_progress", "active", "pending", "working", "scheduled"];

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
  return !INACTIVE.includes(norm(data.status || data.health || "active"));
}

function makeEmptyDashboardStats() {
  return {
    companies: { total: 0, active: 0 },
    users: { total: 0, active: 0, roles: {} },
    leads: { total: 0, open: 0, hot: 0, statuses: {}, priorities: {} },
    jobs: { total: 0, inMotion: 0, statuses: {} },
    rebuiltAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
}

function makeEmptyCompanyStats() {
  return {
    leads: { total: 0, open: 0, hot: 0, statuses: {}, priorities: {} },
    jobs: { total: 0, inMotion: 0, statuses: {} },
    rebuiltAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
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
    if (OPEN_LEADS.includes(norm(data.status || "new"))) bump(target, "leads.open");
    if (HOT_PRIORITIES.includes(norm(data.priority || "normal"))) bump(target, "leads.hot");
    bump(target, `leads.statuses.${status}`);
    bump(target, `leads.priorities.${priority}`);
  });
}

function countJob(stats, companyStats, data = {}) {
  const status = key(data.status || "active");
  const targets = [stats, companyBucket(companyStats, companyId(data))];
  targets.forEach((target) => {
    bump(target, "jobs.total");
    if (MOVING_JOBS.includes(norm(data.status || "active"))) bump(target, "jobs.inMotion");
    bump(target, `jobs.statuses.${status}`);
  });
}

async function scanCollection(collectionName, visitor) {
  let last = null;
  let total = 0;

  while (true) {
    let query = db.collection(collectionName)
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(500);
    if (last) query = query.startAfter(last);

    const snapshot = await query.get();
    if (snapshot.empty) break;

    snapshot.docs.forEach((document) => {
      visitor({ id: document.id, ...(document.data() || {}) });
      total += 1;
    });

    last = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < 500) break;
  }

  return total;
}

async function assertPlatformAdmin(uid) {
  const snapshot = await db.doc(`users/${uid}`).get();
  if (!snapshot.exists) throw new HttpsError("permission-denied", "Administrator profile not found.");

  const user = snapshot.data() || {};
  const role = norm(user.role);
  const active = ["active", "approved"].includes(norm(user.status))
    && norm(user.approvalStatus) === "approved";
  const authorized = role === "owner"
    || role === "super_admin"
    || (role === "admin" && user.platformAccess === true);

  if (!active || !authorized) {
    throw new HttpsError("permission-denied", "Platform administration is required.");
  }
  return user;
}

async function rebuildStats() {
  const stats = makeEmptyDashboardStats();
  const companyStats = {};

  const companies = await scanCollection("companies", (item) => countCompany(stats, item));
  const users = await scanCollection("users", (item) => countUser(stats, item));
  const leads = await scanCollection("leads", (item) => countLead(stats, companyStats, item));
  const jobs = await scanCollection("jobs", (item) => countJob(stats, companyStats, item));

  const writer = db.bulkWriter();
  writer.set(db.doc("dashboard_stats/global"), stats, { merge: false });

  const entries = Object.entries(companyStats);
  if (!entries.length) {
    writer.set(db.doc("company_stats/unassigned"), makeEmptyCompanyStats(), { merge: false });
  } else {
    entries.forEach(([id, data]) => {
      writer.set(db.doc(`company_stats/${id}`), data, { merge: false });
    });
  }

  await writer.close();
  return {
    companies,
    users,
    leads,
    jobs,
    companyStats: Math.max(entries.length, 1)
  };
}

exports.rebuildStats = onCall(
  {
    region: "us-central1",
    enforceAppCheck: true,
    cors: true,
    timeoutSeconds: 540,
    memory: "1GiB"
  },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in before rebuilding statistics.");
    await assertPlatformAdmin(request.auth.uid);

    const result = await rebuildStats();
    await db.collection("audit_logs").add({
      action: "dashboard_stats_rebuilt",
      actorUserId: request.auth.uid,
      actorName: request.auth.token?.name || request.auth.token?.email || request.auth.uid,
      actorRole: request.auth.token?.role || "platform_admin",
      companyId: "",
      targetCollection: "dashboard_stats",
      targetDocumentId: "global",
      source: "rebuildStats",
      result,
      createdAt: FieldValue.serverTimestamp()
    });

    return { ok: true, result };
  }
);

exports.rebuildStatsNow = rebuildStats;
