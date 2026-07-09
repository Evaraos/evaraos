const { onCall, HttpsError } = require('firebase-functions/v2/https');
const {
  db, REGION, HOUR_MS, TERMINAL, norm, clean, num, policy, scheduleMs
} = require('./marketplace-operations-core');

const TRACKABLE = new Set(['en_route', 'en route', 'on_the_way', 'on the way', 'arriving', 'in_progress', 'in progress', 'working']);

function coords(row = {}) {
  for (const source of [row, row.location, row.coordinates, row.serviceLocation, row.serviceAddress, row.property, row.metadata?.location, row.metadata?.coordinates]) {
    if (!source || typeof source !== 'object') continue;
    const lat = num(source.lat ?? source.latitude);
    const lng = num(source.lng ?? source.lon ?? source.longitude);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && (lat || lng)) return { lat, lng };
  }
  return null;
}

function assignedUids(order = {}) {
  const values = [
    ...(Array.isArray(order.assignedTo) ? order.assignedTo : []),
    ...(Array.isArray(order.assignedTeamIds) ? order.assignedTeamIds : []),
    order.staffClaimedBy, order.assignedToUid, order.technicianId, order.cleanerId
  ];
  return [...new Set(values.map((v) => clean(v, 180)).filter(Boolean))];
}

function miles(a, b) {
  if (!a || !b) return 0;
  const rad = (d) => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.7613 * (2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

function tracking(order, locations) {
  if (!TRACKABLE.has(norm(order.status))) return { available: false, state: 'not_active' };
  const destination = coords(order);
  if (!destination) return { available: false, state: 'destination_unavailable' };
  const location = assignedUids(order)
    .map((uid) => locations.get(uid))
    .filter(Boolean)
    .filter((row) => norm(row.trackingStatus) === 'active' && Date.now() - num(row.lastSeenMs) <= 15 * 60 * 1000)
    .sort((a, b) => num(b.lastSeenMs) - num(a.lastSeenMs))[0];
  if (!location) return { available: false, state: 'worker_offline' };
  const origin = coords(location);
  if (!origin) return { available: false, state: 'location_unavailable' };
  const distance = miles(origin, destination);
  const speedMph = num(location.speedMetersPerSecond) > 1 ? Math.min(80, num(location.speedMetersPerSecond) * 2.236936) : 25;
  return {
    available: true,
    state: 'live',
    workerName: clean(location.displayName || 'Assigned professional', 160),
    lat: Math.round(origin.lat * 10000) / 10000,
    lng: Math.round(origin.lng * 10000) / 10000,
    lastSeenMs: num(location.lastSeenMs),
    distanceMiles: Math.round(distance * 10) / 10,
    etaMinutes: Math.max(2, Math.min(180, Math.round(distance / Math.max(5, speedMph) * 60)))
  };
}

function refundEstimate(order, invoice, rules) {
  const paid = Math.max(0, num(invoice?.paidCents || order.paidCents));
  if (norm(invoice?.paymentStatus || order.paymentStatus) !== 'paid' || !paid) return { percent: 0, amountCents: 0, disposition: 'not_required' };
  const appointment = scheduleMs(order);
  const hours = appointment > Date.now() ? (appointment - Date.now()) / HOUR_MS : 0;
  if (hours >= rules.fullRefundNoticeHours) return { percent: 100, amountCents: paid, disposition: 'eligible', noticeHours: hours };
  if (hours >= rules.partialRefundNoticeHours && rules.partialRefundPercent > 0) return { percent: rules.partialRefundPercent, amountCents: Math.round(paid * rules.partialRefundPercent / 100), disposition: 'eligible', noticeHours: hours };
  return { percent: 0, amountCents: 0, disposition: rules.lateCancellationRequiresReview ? 'manual_review' : 'not_eligible', noticeHours: hours };
}

async function customerDocs(name, uid) {
  const [a, b] = await Promise.all([
    db.collection(name).where('customerId', '==', uid).limit(100).get(),
    db.collection(name).where('customerUid', '==', uid).limit(100).get()
  ]);
  const unique = new Map();
  [...a.docs, ...b.docs].forEach((doc) => unique.set(doc.id, doc));
  return [...unique.values()];
}

async function docsById(name, ids) {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 50);
  return (await Promise.all(unique.map((id) => db.doc(`${name}/${id}`).get()))).filter((doc) => doc.exists);
}

function orderView(doc, context) {
  const row = { id: doc.id, ...(doc.data() || {}) };
  const status = norm(row.status);
  const appointment = scheduleMs(row);
  const rules = context.policies.get(row.companyId) || policy({});
  const invoice = context.invoices.get(row.invoiceId) || {};
  const cancelPending = norm(row.cancellationStatus) === 'pending_review';
  const reschedulePending = norm(row.rescheduleStatus) === 'pending_review';
  return {
    id: row.id,
    quoteId: clean(row.quoteId, 180),
    invoiceId: clean(row.invoiceId, 180),
    companyId: clean(row.companyId, 180),
    companyName: clean(row.companyName, 180),
    serviceName: clean(row.serviceName || row.service || row.title || 'Marketplace service', 180),
    status: clean(row.status || 'pending', 60),
    paymentStatus: clean(row.paymentStatus, 60),
    scheduleStatus: clean(row.scheduleStatus, 60),
    vendorAcceptanceStatus: clean(row.vendorAcceptanceStatus, 60),
    cancellationStatus: clean(row.cancellationStatus, 60),
    rescheduleStatus: clean(row.rescheduleStatus, 60),
    refundStatus: clean(row.refundStatus, 60),
    refundRequestId: clean(row.refundRequestId, 180),
    refundAmountCents: Math.max(0, num(row.refundAmountCents)),
    totalCents: Math.max(0, num(row.totalCents || invoice.totalCents)),
    scheduledAtMs: appointment,
    previousScheduledAtMs: num(row.previousScheduledAtMs),
    pendingScheduledAtMs: num(row.pendingScheduledAtMs),
    canReschedule: !TERMINAL.has(status) && appointment > Date.now() && !cancelPending && !reschedulePending,
    canCancel: !TERMINAL.has(status) && !cancelPending,
    cancellationPending: cancelPending,
    reschedulePending,
    policy: rules,
    refundEstimate: refundEstimate(row, invoice, rules),
    tracking: tracking(row, context.locations),
    address: clean(row.address || row.serviceAddress?.formatted || row.propertyAddress || '', 300),
    createdAtMs: num(row.createdAtMs),
    updatedAtMs: num(row.updatedAtMs)
  };
}

function noteView(doc) {
  const row = doc.data() || {};
  return {
    id: doc.id,
    title: clean(row.title || 'Update', 180),
    body: clean(row.body, 800),
    type: clean(row.type || 'account', 60),
    priority: clean(row.priority || 'normal', 60),
    status: clean(row.status || 'unread', 60),
    relatedId: clean(row.relatedId, 180),
    createdAtMs: num(row.createdAtMs),
    updatedAtMs: num(row.updatedAtMs)
  };
}

function refundView(doc) {
  const row = doc.data() || {};
  return {
    id: doc.id,
    orderId: clean(row.orderId, 180),
    status: clean(row.status, 80),
    amountCents: Math.max(0, num(row.amountCents)),
    refundPercent: Math.max(0, num(row.refundPercent)),
    reason: clean(row.reason, 500),
    policyReason: clean(row.policyReason, 500),
    providerStatus: clean(row.providerStatus, 80),
    createdAtMs: num(row.createdAtMs),
    updatedAtMs: num(row.updatedAtMs)
  };
}

exports.getMarketplaceOperationsSnapshot = onCall({ region: REGION, enforceAppCheck: true, cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to continue.');

  const [orderDocs, noteDocs, refundDocs, invoiceDocs] = await Promise.all([
    customerDocs('jobs', uid),
    customerDocs('customer_notifications', uid),
    customerDocs('refund_requests', uid),
    customerDocs('invoices', uid)
  ]);
  const rawOrders = orderDocs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
  const [companyDocs, locationDocs] = await Promise.all([
    docsById('companies', rawOrders.map((row) => clean(row.companyId, 180))),
    docsById('workforce_locations', rawOrders.flatMap(assignedUids))
  ]);
  const invoices = new Map(invoiceDocs.map((doc) => [doc.id, { id: doc.id, ...(doc.data() || {}) }]));
  const policies = new Map(companyDocs.map((doc) => [doc.id, policy(doc.data() || {})]));
  const locations = new Map(locationDocs.map((doc) => [doc.id, { id: doc.id, ...(doc.data() || {}) }]));
  const orders = orderDocs.map((doc) => orderView(doc, { invoices, policies, locations })).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  const notifications = noteDocs.map(noteView).sort((a, b) => b.createdAtMs - a.createdAtMs).slice(0, 50);
  const refunds = refundDocs.map(refundView).sort((a, b) => b.updatedAtMs - a.updatedAtMs);

  return {
    customerId: uid,
    generatedAtMs: Date.now(),
    orders,
    notifications,
    refunds,
    summary: {
      activeOrders: orders.filter((order) => !TERMINAL.has(norm(order.status))).length,
      liveTrackedOrders: orders.filter((order) => order.tracking.available).length,
      unreadNotifications: notifications.filter((note) => norm(note.status) === 'unread').length,
      pendingRefunds: refunds.filter((refund) => !['succeeded', 'cancelled', 'rejected'].includes(norm(refund.status))).length
    }
  };
});
