const admin = require('firebase-admin');
const crypto = require('crypto');
const { HttpsError } = require('firebase-functions/v2/https');

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const REGION = 'us-central1';
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const TERMINAL = new Set(['completed', 'cancelled', 'canceled', 'refunded', 'closed', 'void']);
const OPS_ROLES = new Set(['owner', 'super_admin', 'admin', 'manager', 'operations_manager', 'operations_coordinator', 'field_manager', 'dispatcher', 'finance', 'accounting', 'customer_support']);

const norm = (v = '') => String(v || '').trim().toLowerCase();
const clean = (v = '', max = 500) => String(v || '').trim().slice(0, max);
const num = (v = 0) => Number.isFinite(Number(v)) ? Number(v) : 0;
const int = (v = 0) => Math.trunc(num(v));
const cents = (v = 0) => Math.max(0, Math.round(num(v)));
const idFor = (prefix, value) => `${prefix}_${crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 28)}`;
const stamp = (patch = {}) => ({ ...patch, updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() });
const owns = (data = {}, uid = '') => Boolean(uid) && [data.customerId, data.customerUid, data.userId, data.uid].some((v) => String(v || '') === uid);

async function actor(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to continue.');
  const snap = await db.doc(`users/${uid}`).get();
  const profile = snap.exists ? snap.data() || {} : {};
  return {
    uid,
    email: request.auth.token?.email || profile.email || '',
    name: clean(profile.displayName || profile.fullName || profile.name || request.auth.token?.name || request.auth.token?.email || 'User', 180),
    role: norm(profile.role || request.auth.token?.role || 'customer'),
    companyId: clean(profile.companyId, 180)
  };
}

function policy(company = {}) {
  const source = company.marketplacePolicies || company.orderPolicies || company.cancellationPolicy || {};
  return {
    minimumRescheduleNoticeHours: Math.max(1, num(source.minimumRescheduleNoticeHours || source.rescheduleNoticeHours || 4)),
    fullRefundNoticeHours: Math.max(1, num(source.fullRefundNoticeHours || source.fullRefundHours || 24)),
    partialRefundNoticeHours: Math.max(0, num(source.partialRefundNoticeHours || source.partialRefundHours || 6)),
    partialRefundPercent: Math.min(100, Math.max(0, num(source.partialRefundPercent || 50))),
    lateCancellationRequiresReview: source.lateCancellationRequiresReview !== false,
    lateRescheduleRequiresReview: source.lateRescheduleRequiresReview !== false,
    bookingHorizonDays: Math.max(1, num(source.bookingHorizonDays || 90)),
    defaultSlotCapacity: Math.max(1, int(source.defaultSlotCapacity || company.bookingConfig?.defaultSlotCapacity || company.defaultSlotCapacity || 1)),
    policyVersion: clean(source.policyVersion || 'marketplace-default-v1', 80)
  };
}

function scheduleMs(row = {}) {
  for (const value of [row.scheduledAtMs, row.requestedScheduleAtMs, row.appointmentAtMs, row.scheduledAt, row.scheduledFor]) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value) {
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (Number.isFinite(value?.seconds)) return value.seconds * 1000;
  }
  return 0;
}

function notification({ customerId, companyId = '', companyName = '', title, body, type = 'service', priority = 'normal', relatedId = '', metadata = {} }) {
  const id = idFor('customer_notification', `${customerId}|${relatedId}|${title}|${body}`);
  return {
    id, customerId, companyId, companyName,
    title: clean(title, 180), body: clean(body, 800), type, priority,
    status: 'unread', relatedType: 'order', relatedId,
    actionUrl: '/customer-commerce.html', metadata,
    createdAtMs: Date.now(), updatedAtMs: Date.now(),
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
  };
}

function refundDecision(order = {}, invoice = {}, rules = {}, now = Date.now()) {
  const paidCents = cents(invoice.paidCents || order.paidCents || order.totalCents);
  if (norm(invoice.paymentStatus || order.paymentStatus) !== 'paid' || paidCents <= 0) {
    return { paidCents, refundPercent: 0, refundAmountCents: 0, disposition: 'not_required', reason: 'No captured payment requires a refund.' };
  }
  const appointment = scheduleMs(order);
  const noticeHours = appointment > now ? (appointment - now) / HOUR_MS : 0;
  if (noticeHours >= rules.fullRefundNoticeHours) {
    return { paidCents, noticeHours, refundPercent: 100, refundAmountCents: paidCents, disposition: 'eligible', reason: `Cancellation was submitted at least ${rules.fullRefundNoticeHours} hours before service.` };
  }
  if (noticeHours >= rules.partialRefundNoticeHours && rules.partialRefundPercent > 0) {
    return { paidCents, noticeHours, refundPercent: rules.partialRefundPercent, refundAmountCents: Math.round(paidCents * rules.partialRefundPercent / 100), disposition: 'eligible', reason: `Cancellation qualifies for the configured ${rules.partialRefundPercent}% refund tier.` };
  }
  return { paidCents, noticeHours, refundPercent: 0, refundAmountCents: 0, disposition: rules.lateCancellationRequiresReview ? 'manual_review' : 'not_eligible', reason: rules.lateCancellationRequiresReview ? 'Late cancellation requires an operations review.' : 'Cancellation falls outside the configured refund window.' };
}

async function releaseReservation(transaction, reservationRef, reservation, reason) {
  if (!reservationRef || !reservation || !['held', 'confirmed'].includes(norm(reservation.status))) return;
  if (reservation.slotId) {
    const slotRef = db.doc(`appointment_slots/${reservation.slotId}`);
    const slotSnap = await transaction.get(slotRef);
    if (slotSnap.exists) transaction.set(slotRef, stamp({ reservedCount: Math.max(0, int(slotSnap.data()?.reservedCount) - 1) }), { merge: true });
  }
  transaction.set(reservationRef, stamp({ status: 'released', releaseReason: reason, releasedAtMs: Date.now() }), { merge: true });
}

module.exports = { db, FieldValue, REGION, HOUR_MS, DAY_MS, TERMINAL, OPS_ROLES, norm, clean, num, int, cents, idFor, stamp, owns, actor, policy, scheduleMs, notification, refundDecision, releaseReservation };
