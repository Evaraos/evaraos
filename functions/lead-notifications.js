const admin = require("firebase-admin");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

function toList(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (value) return [String(value)];
  return [];
}

function unique(values) {
  return Array.from(new Set((values || []).filter(Boolean).map(String)));
}

function added(before, after) {
  const oldSet = new Set((before || []).map(String));
  return unique(after || []).filter((id) => !oldSet.has(id));
}

function nameOfLead(lead) {
  return lead.fullName || lead.name || lead.customerName || lead.email || "New lead";
}

function getAssignedIds(lead) {
  return unique([
    ...toList(lead.assignedTo),
    ...toList(lead.assignedTeamIds),
    ...toList(lead.assignedRep),
    ...toList(lead.assignedToUid),
    ...toList(lead.staffClaimedBy)
  ]);
}

async function readUser(userId) {
  if (!userId) return null;
  const snap = await db.doc("users/" + userId).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function createUserNotification(userId, leadId, lead) {
  const user = await readUser(userId);
  await db.collection("notifications").add({
    type: "lead_assignment",
    title: "New lead assigned",
    message: nameOfLead(lead) + " was assigned to you.",
    status: "unread",
    priority: lead.priority || "normal",
    userId,
    userEmail: user && user.email ? user.email : "",
    companyId: lead.companyId || (user && user.companyId) || "",
    companyName: lead.companyName || (user && user.companyName) || "",
    leadId,
    leadName: nameOfLead(lead),
    leadStatus: lead.status || "new",
    route: "/evaraos/leads.html",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
}

async function createCompanyNotification(leadId, lead) {
  if (!lead.companyId) return;
  await db.collection("notifications").add({
    type: lead.customerSubmitted ? "customer_lead_routed" : "company_lead_update",
    title: lead.customerSubmitted ? "Customer request routed" : "Lead updated",
    message: nameOfLead(lead) + " is ready for " + (lead.companyName || lead.companyId) + ".",
    status: "unread",
    companyId: lead.companyId,
    companyName: lead.companyName || "",
    leadId,
    leadName: nameOfLead(lead),
    leadStatus: lead.status || "new",
    customerSubmitted: !!lead.customerSubmitted,
    route: "/evaraos/leads.html",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
}

exports.notifyLeadAssignment = onDocumentWritten("leads/{leadId}", async (event) => {
  if (!event.data || !event.data.after.exists) return null;

  const before = event.data.before.exists ? event.data.before.data() || {} : {};
  const after = event.data.after.data() || {};
  const leadId = event.params.leadId;

  const addedAssignees = event.data.before.exists ? added(getAssignedIds(before), getAssignedIds(after)) : getAssignedIds(after);
  const tasks = [];

  addedAssignees.forEach((userId) => tasks.push(createUserNotification(userId, leadId, after)));

  if (!event.data.before.exists || before.companyId !== after.companyId || before.customerSubmitted !== after.customerSubmitted) {
    tasks.push(createCompanyNotification(leadId, after));
  }

  if (!tasks.length) return null;
  await Promise.all(tasks);

  await db.doc("leads/" + leadId).set({
    notificationProcessedAt: FieldValue.serverTimestamp(),
    automationStatus: after.automationStatus || "notifications_sent"
  }, { merge: true });

  return null;
});
