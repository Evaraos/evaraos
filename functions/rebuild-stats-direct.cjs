const admin = require("firebase-admin");

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "evaraos-web";

admin.initializeApp({ projectId });
const db = admin.firestore();

const INACTIVE = ["inactive", "archived", "deleted", "lost", "cancelled", "canceled"];
const OPEN_LEADS = ["new", "open", "contacted", "qualified", "proposal", "scheduled"];
const HOT_PRIORITIES = ["hot", "high", "urgent"];
const MOVING_JOBS = ["in progress", "active", "pending", "working", "scheduled"];

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

function emptyDashboardStats() {
  return {
    companies: { total: 0, active: 0 },
    users: { total: 0, active: 0, roles: {} },
    leads: { total: 0, open: 0, hot: 0, statuses: {}, priorities: {} },
    jobs: { total: 0, inMotion: 0, statuses: {} },
    rebuiltBy: "direct-cloud-shell-script",
    rebuiltAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

function emptyCompanyStats() {
  return {
    leads: { total: 0, open: 0, hot: 0, statuses: {}, priorities: {} },
    jobs: { total: 0, inMotion: 0, statuses: {} },
    rebuiltBy: "direct-cloud-shell-script",
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
  if (!companyStats[id]) companyStats[id] = emptyCompanyStats();
  return companyStats[id];
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

function countCompany(stats, item) {
  bump(stats, "companies.total");
  if (isActive(item)) bump(stats, "companies.active");
}

function countUser(stats, item) {
  bump(stats, "users.total");
  if (isActive(item)) bump(stats, "users.active");
  bump(stats, `users.roles.${key(item.role || "customer")}`);
}

function countLead(stats, companyStats, item) {
  const status = key(item.status || "new");
  const priority = key(item.priority || "normal");
  const targets = [stats, companyBucket(companyStats, companyId(item))];

  targets.forEach((target) => {
    bump(target, "leads.total");
    if (OPEN_LEADS.includes(status)) bump(target, "leads.open");
    if (HOT_PRIORITIES.includes(priority)) bump(target, "leads.hot");
    bump(target, `leads.statuses.${status}`);
    bump(target, `leads.priorities.${priority}`);
  });
}

function countJob(stats, companyStats, item) {
  const status = key(item.status || "active");
  const targets = [stats, companyBucket(companyStats, companyId(item))];

  targets.forEach((target) => {
    bump(target, "jobs.total");
    if (MOVING_JOBS.includes(status)) bump(target, "jobs.inMotion");
    bump(target, `jobs.statuses.${status}`);
  });
}

async function main() {
  console.log(`Rebuilding dashboard stats for project: ${projectId}`);

  const [companies, users, leads, jobs] = await Promise.all([
    readAll("companies"),
    readAll("users"),
    readAll("leads"),
    readAll("jobs")
  ]);

  const stats = emptyDashboardStats();
  const companyStats = {};

  companies.forEach((item) => countCompany(stats, item));
  users.forEach((item) => countUser(stats, item));
  leads.forEach((item) => countLead(stats, companyStats, item));
  jobs.forEach((item) => countJob(stats, companyStats, item));

  const batch = db.batch();
  batch.set(db.doc("dashboard_stats/global"), stats, { merge: false });
  Object.entries(companyStats).forEach(([id, data]) => {
    batch.set(db.doc(`company_stats/${id}`), data, { merge: false });
  });

  if (!Object.keys(companyStats).length) {
    batch.set(db.doc("company_stats/unassigned"), emptyCompanyStats(), { merge: false });
  }

  await batch.commit();

  console.log("Stats rebuild complete:");
  console.log(JSON.stringify({
    companies: companies.length,
    users: users.length,
    leads: leads.length,
    jobs: jobs.length,
    companyStats: Math.max(Object.keys(companyStats).length, 1)
  }, null, 2));
}

main().catch((error) => {
  console.error("Stats rebuild failed:", error);
  process.exit(1);
});
