const { onCall, HttpsError } = require('firebase-functions/v2/https');
const {
  db,
  FieldValue,
  REGION,
  TERMINAL,
  norm,
  clean,
  num,
  int,
  cents,
  idFor,
  stamp,
  actor,
  policy,
  scheduleMs
} = require('./marketplace-operations-core');

const REVIEW_ROLES = new Set([
  'owner',
  'super_admin',
  'admin',
  'manager',
  'operations_manager',
  'operations_coordinator',
  'field_manager',
  'dispatcher',
  'customer_support'
]);

const PLATFORM_ROLES = new Set(['owner', 'super_admin', 'admin']);
const FINAL_REVIEW_STATUSES = new Set(['approved_override', 'rejected']);

function requireReviewer(user) {
  if (!REVIEW_ROLES.has(user.role)) {
    throw new HttpsError('permission-denied', 'Your role cannot review Marketplace policy exceptions.');
  }
}

function requireCompanyAccess(user, companyId = '') {
  if (PLATFORM_ROLES.has(user.role)) return;
  if (!user.companyId || !companyId || user.companyId !== companyId) {
    throw new HttpsError('permission-denied', 'This request belongs to another company.');
  }
}

function safePercent(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return Math.min(100, Math.max(0, Number(fallback || 0)));
  return Math.min(100, Math.max(0, parsed));
}

function changeView(docSnap) {
  const row = { id: docSnap.id, ...(docSnap.data() || {}) };
  const decision = row.refundDecision || {};
  const rules = row.policy || {};
  return {
    id: row.id,
    type: clean(row.type, 40),
    status: clean(row.status, 60),
    orderId: clean(row.orderId, 180),
    quoteId: clean(row.quoteId, 180),
    invoiceId: clean(row.invoiceId, 180),
    reservationId: clean(row.reservationId, 180),
    companyId: clean(row.companyId, 180),
    companyName: clean(row.companyName, 180),
    customerId: clean(row.customerId, 180),
    customerName: clean(row.customerName, 180),
    reason: clean(row.reason, 800),
    decisionReason: clean(row.decisionReason, 500),
    oldScheduledAtMs: num(row.oldScheduledAtMs),
    requestedScheduledAtMs: num(row.requestedScheduledAtMs),
    noticeHours: num(row.noticeHours),
    requestedAtMs: num(row.requestedAtMs),
    updatedAtMs: num(row.updatedAtMs),
    refundDecision: {
      paidCents: cents(decision.paidCents),
      refundPercent: safePercent(decision.refundPercent),
      refundAmountCents: cents(decision.refundAmountCents),
      disposition: clean(decision.disposition, 80),
      reason: clean(decision.reason, 500),
      noticeHours: num(decision.noticeHours)
    },
    policy: {
      minimumRescheduleNoticeHours: num(rules.minimumRescheduleNoticeHours),
      fullRefundNoticeHours: num(rules.fullRefundNoticeHours),
      partialRefundNoticeHours: num(rules.partialRefundNoticeHours),
      partialRefundPercent: safePercent(rules.partialRefundPercent),
      bookingHorizonDays: num(rules.bookingHorizonDays),
      defaultSlotCapacity: Math.max(1, int(rules.defaultSlotCapacity || 1)),
      policyVersion: clean(rules.policyVersion, 100)
    },
    reviewNotes: clean(row.reviewNotes, 1000),
    reviewedAtMs: num(row.reviewedAtMs),
    reviewedByName: clean(row.reviewedByName, 180),
    refundPercentOverride: Number.isFinite(Number(row.refundPercentOverride))
      ? safePercent(row.refundPercentOverride)
      : null
  };
}

function orderContext(order = {}, invoice = {}) {
  return {
    id: clean(order.id, 180),
    serviceName: clean(order.serviceName || order.service || order.title || 'Marketplace service', 180),
    status: clean(order.status, 60),
    paymentStatus: clean(order.paymentStatus || invoice.paymentStatus, 60),
    scheduleStatus: clean(order.scheduleStatus, 60),
    scheduledAtMs: scheduleMs(order),
    totalCents: cents(order.totalCents || invoice.totalCents),
    paidCents: cents(invoice.paidCents || order.paidCents),
    address: clean(order.address || order.serviceAddress?.formatted || order.propertyAddress, 300),
    refundStatus: clean(order.refundStatus || invoice.refundStatus, 60)
  };
}

async function scopedChangeDocuments(user) {
  let snapshot;
  if (PLATFORM_ROLES.has(user.role)) {
    snapshot = await db.collection('marketplace_change_requests').limit(200).get();
  } else {
    if (!user.companyId) return [];
    snapshot = await db.collection('marketplace_change_requests')
      .where('companyId', '==', user.companyId)
      .limit(200)
      .get();
  }
  return snapshot.docs;
}

async function hydrateQueue(rows = []) {
  const orderIds = [...new Set(rows.map((row) => clean(row.orderId, 180)).filter(Boolean))].slice(0, 100);
  const invoiceIds = [...new Set(rows.map((row) => clean(row.invoiceId, 180)).filter(Boolean))].slice(0, 100);
  const [orders, invoices] = await Promise.all([
    Promise.all(orderIds.map((id) => db.doc(`jobs/${id}`).get())),
    Promise.all(invoiceIds.map((id) => db.doc(`invoices/${id}`).get()))
  ]);
  const orderMap = new Map(orders.filter((snap) => snap.exists).map((snap) => [snap.id, { id: snap.id, ...snap.data() }]));
  const invoiceMap = new Map(invoices.filter((snap) => snap.exists).map((snap) => [snap.id, { id: snap.id, ...snap.data() }]));

  return rows.map((row) => ({
    ...row,
    order: orderContext(orderMap.get(row.orderId) || {}, invoiceMap.get(row.invoiceId) || {})
  }));
}

exports.getMarketplaceExceptionQueue = onCall({
  region: REGION,
  enforceAppCheck: true,
  cors: true
}, async (request) => {
  const user = await actor(request);
  requireReviewer(user);

  const docs = await scopedChangeDocuments(user);
  const rows = docs
    .map(changeView)
    .sort((left, right) => (right.updatedAtMs || right.requestedAtMs) - (left.updatedAtMs || left.requestedAtMs));

  const pendingRows = await hydrateQueue(rows.filter((row) => row.status === 'pending_review').slice(0, 100));
  const recentRows = await hydrateQueue(rows.filter((row) => FINAL_REVIEW_STATUSES.has(row.status)).slice(0, 30));

  return {
    generatedAtMs: Date.now(),
    reviewer: {
      uid: user.uid,
      name: user.name,
      role: user.role,
      companyId: user.companyId
    },
    pending: pendingRows,
    recent: recentRows,
    summary: {
      pendingCount: pendingRows.length,
      cancellationCount: pendingRows.filter((row) => row.type === 'cancel').length,
      rescheduleCount: pendingRows.filter((row) => row.type === 'reschedule').length,
      recentDecisionCount: recentRows.length
    }
  };
});

exports.reviewMarketplaceException = onCall({
  region: REGION,
  enforceAppCheck: true,
  cors: true
}, async (request) => {
  const user = await actor(request);
  requireReviewer(user);

  const changeRequestId = clean(request.data?.changeRequestId, 180);
  const decision = norm(request.data?.decision);
  const reviewNotes = clean(request.data?.reviewNotes, 1000);
  const hasRefundOverride = request.data?.refundPercentOverride !== undefined && request.data?.refundPercentOverride !== null && request.data?.refundPercentOverride !== '';
  const requestedRefundOverride = hasRefundOverride ? safePercent(request.data.refundPercentOverride) : null;

  if (!changeRequestId || !['approve', 'reject'].includes(decision)) {
    throw new HttpsError('invalid-argument', 'A valid change request and decision are required.');
  }
  if (reviewNotes.length < 5) {
    throw new HttpsError('invalid-argument', 'Enter a meaningful review note before completing the decision.');
  }

  const changeRef = db.doc(`marketplace_change_requests/${changeRequestId}`);
  const auditRef = db.doc(`marketplace_exception_reviews/${changeRequestId}`);

  const result = await db.runTransaction(async (transaction) => {
    const changeSnap = await transaction.get(changeRef);
    if (!changeSnap.exists) throw new HttpsError('not-found', 'Policy exception request not found.');
    const change = { id: changeSnap.id, ...changeSnap.data() };
    requireCompanyAccess(user, clean(change.companyId, 180));

    const existingStatus = norm(change.status);
    if (FINAL_REVIEW_STATUSES.has(existingStatus)) {
      return {
        changeRequestId,
        status: existingStatus,
        orderId: clean(change.orderId, 180),
        refundRequestId: clean(change.refundRequestId, 180),
        reused: true
      };
    }
    if (existingStatus !== 'pending_review') {
      throw new HttpsError('failed-precondition', 'This policy exception is not awaiting review.');
    }
    if (!['cancel', 'reschedule'].includes(norm(change.type))) {
      throw new HttpsError('failed-precondition', 'This change type is not supported by the Marketplace exception reviewer.');
    }

    const orderRef = db.doc(`jobs/${clean(change.orderId, 180)}`);
    const invoiceRef = change.invoiceId ? db.doc(`invoices/${clean(change.invoiceId, 180)}`) : null;
    const companyRef = change.companyId ? db.doc(`companies/${clean(change.companyId, 180)}`) : null;
    const reservationRef = change.reservationId ? db.doc(`appointment_reservations/${clean(change.reservationId, 180)}`) : null;

    const [orderSnap, invoiceSnap, companySnap, reservationSnap, auditSnap] = await Promise.all([
      transaction.get(orderRef),
      invoiceRef ? transaction.get(invoiceRef) : Promise.resolve(null),
      companyRef ? transaction.get(companyRef) : Promise.resolve(null),
      reservationRef ? transaction.get(reservationRef) : Promise.resolve(null),
      transaction.get(auditRef)
    ]);

    if (!orderSnap.exists) throw new HttpsError('not-found', 'The linked Marketplace order no longer exists.');
    if (auditSnap.exists) {
      const audit = auditSnap.data() || {};
      return {
        changeRequestId,
        status: clean(audit.resultStatus || existingStatus, 60),
        orderId: clean(change.orderId, 180),
        refundRequestId: clean(audit.refundRequestId, 180),
        reused: true
      };
    }

    const order = { id: orderSnap.id, ...orderSnap.data() };
    const invoice = invoiceSnap?.exists ? { id: invoiceSnap.id, ...invoiceSnap.data() } : {};
    const company = companySnap?.exists ? companySnap.data() || {} : {};
    const reservation = reservationSnap?.exists ? reservationSnap.data() || {} : null;
    const rules = change.policy || policy(company);
    const type = norm(change.type);
    const reviewedAtMs = Date.now();

    let newSlotRef = null;
    let newSlotSnap = null;
    let oldSlotRef = null;
    let oldSlotSnap = null;

    if (decision === 'approve' && type === 'reschedule') {
      const requestedAtMs = num(change.requestedScheduledAtMs);
      if (requestedAtMs <= Date.now()) {
        throw new HttpsError('failed-precondition', 'The requested appointment time has already passed.');
      }
      const bookingHorizonDays = Math.max(1, num(rules.bookingHorizonDays || 90));
      if (requestedAtMs > Date.now() + bookingHorizonDays * 24 * 60 * 60 * 1000) {
        throw new HttpsError('failed-precondition', 'The requested appointment is outside the booking horizon.');
      }

      newSlotRef = db.doc(`appointment_slots/${idFor('slot', `${order.companyId}|${requestedAtMs}`)}`);
      newSlotSnap = await transaction.get(newSlotRef);
      if (reservation?.slotId && reservation.slotId !== newSlotRef.id) {
        oldSlotRef = db.doc(`appointment_slots/${reservation.slotId}`);
        oldSlotSnap = await transaction.get(oldSlotRef);
      }
    }

    let refundRef = null;
    let refundSnap = null;
    let refundRequestId = '';
    let refundPercent = 0;
    let refundAmountCents = 0;
    const paidCents = cents(invoice.paidCents || order.paidCents || order.totalCents);

    if (decision === 'approve' && type === 'cancel') {
      const suggestedPercent = safePercent(change.refundDecision?.refundPercent, 0);
      refundPercent = requestedRefundOverride === null ? suggestedPercent : requestedRefundOverride;
      refundAmountCents = norm(invoice.paymentStatus || order.paymentStatus) === 'paid'
        ? Math.min(paidCents, Math.round(paidCents * refundPercent / 100))
        : 0;
      if (refundAmountCents > 0) {
        refundRequestId = idFor('refund_request', `${order.id}|exception|${changeRequestId}`);
        refundRef = db.doc(`refund_requests/${refundRequestId}`);
        refundSnap = await transaction.get(refundRef);
      }
      if (reservation?.slotId && ['held', 'confirmed'].includes(norm(reservation.status))) {
        oldSlotRef = db.doc(`appointment_slots/${reservation.slotId}`);
        oldSlotSnap = await transaction.get(oldSlotRef);
      }
    }

    const resultStatus = decision === 'approve' ? 'approved_override' : 'rejected';
    const audit = {
      id: changeRequestId,
      changeRequestId,
      orderId: order.id,
      quoteId: clean(change.quoteId, 180),
      invoiceId: clean(change.invoiceId, 180),
      reservationId: clean(change.reservationId, 180),
      companyId: clean(change.companyId, 180),
      companyName: clean(change.companyName, 180),
      customerId: clean(change.customerId, 180),
      customerName: clean(change.customerName, 180),
      type,
      decision,
      resultStatus,
      reviewNotes,
      reviewedAtMs,
      reviewedBy: user.uid,
      reviewedByName: user.name,
      reviewedByRole: user.role,
      policySnapshot: rules,
      requestedChange: {
        oldScheduledAtMs: num(change.oldScheduledAtMs),
        requestedScheduledAtMs: num(change.requestedScheduledAtMs),
        reason: clean(change.reason, 800),
        noticeHours: num(change.noticeHours)
      },
      refundPercentOverride: type === 'cancel' && decision === 'approve' ? refundPercent : null,
      refundAmountCents,
      refundRequestId,
      createdAtMs: reviewedAtMs,
      createdAt: FieldValue.serverTimestamp()
    };

    if (decision === 'reject') {
      const orderPatch = type === 'reschedule'
        ? {
            rescheduleStatus: 'rejected',
            pendingRescheduleRequestId: '',
            pendingScheduledAtMs: 0,
            lastChangeReviewId: changeRequestId
          }
        : {
            cancellationStatus: 'rejected',
            cancellationRequestId: changeRequestId,
            lastChangeReviewId: changeRequestId
          };

      transaction.set(orderRef, stamp(orderPatch), { merge: true });
      transaction.set(changeRef, stamp({
        status: resultStatus,
        reviewNotes,
        reviewedAtMs,
        reviewedBy: user.uid,
        reviewedByName: user.name,
        reviewedByRole: user.role
      }), { merge: true });
      transaction.create(auditRef, audit);
      return { changeRequestId, status: resultStatus, orderId: order.id, refundRequestId: '', reused: false };
    }

    if (TERMINAL.has(norm(order.status))) {
      throw new HttpsError('failed-precondition', 'The linked order is already in a terminal state.');
    }

    if (type === 'reschedule') {
      const requestedAtMs = num(change.requestedScheduledAtMs);
      const slot = newSlotSnap?.exists ? newSlotSnap.data() || {} : {};
      const capacity = Math.max(1, int(slot.capacity || rules.defaultSlotCapacity || company.bookingConfig?.defaultSlotCapacity || 1));
      const reservedCount = Math.max(0, int(slot.reservedCount));
      const sameSlot = reservation?.slotId === newSlotRef.id && ['held', 'confirmed'].includes(norm(reservation?.status));

      if (!sameSlot && reservedCount >= capacity) {
        throw new HttpsError('resource-exhausted', 'The requested appointment time is no longer available.');
      }
      if (oldSlotSnap?.exists) {
        transaction.set(oldSlotRef, stamp({ reservedCount: Math.max(0, int(oldSlotSnap.data()?.reservedCount) - 1) }), { merge: true });
      }
      if (!sameSlot) {
        transaction.set(newSlotRef, stamp({
          id: newSlotRef.id,
          companyId: clean(order.companyId, 180),
          scheduledAtMs: requestedAtMs,
          capacity,
          reservedCount: reservedCount + 1
        }), { merge: true });
      }

      const reservationStatus = norm(order.paymentStatus) === 'paid' ? 'confirmed' : 'held';
      if (reservationRef) {
        transaction.set(reservationRef, stamp({
          slotId: newSlotRef.id,
          scheduledAtMs: requestedAtMs,
          status: reservationStatus,
          capacity,
          expiresAtMs: reservationStatus === 'held' ? Date.now() + 35 * 60 * 1000 : 0,
          previousScheduledAtMs: scheduleMs(order),
          rescheduledAtMs: reviewedAtMs,
          rescheduledBy: user.uid,
          rescheduledByName: user.name,
          rescheduleReason: clean(change.reason, 800),
          policyExceptionReviewId: changeRequestId
        }), { merge: true });
      }

      transaction.set(orderRef, stamp({
        scheduledAtMs: requestedAtMs,
        scheduledAt: new Date(requestedAtMs).toISOString(),
        scheduledFor: new Date(requestedAtMs).toISOString(),
        scheduleStatus: reservationStatus === 'confirmed' ? 'confirmed' : 'reserved_pending_payment',
        rescheduleStatus: resultStatus,
        previousScheduledAtMs: scheduleMs(order),
        rescheduledAtMs: reviewedAtMs,
        rescheduledBy: user.uid,
        rescheduledByName: user.name,
        pendingRescheduleRequestId: '',
        pendingScheduledAtMs: 0,
        rescheduleCount: int(order.rescheduleCount) + 1,
        lastChangeReviewId: changeRequestId
      }), { merge: true });
      if (change.quoteId) {
        transaction.set(db.doc(`quotes/${clean(change.quoteId, 180)}`), stamp({
          scheduledAtMs: requestedAtMs,
          requestedScheduleAtMs: requestedAtMs,
          rescheduleStatus: resultStatus,
          policyExceptionReviewId: changeRequestId
        }), { merge: true });
      }
    } else {
      if (oldSlotSnap?.exists) {
        transaction.set(oldSlotRef, stamp({ reservedCount: Math.max(0, int(oldSlotSnap.data()?.reservedCount) - 1) }), { merge: true });
      }
      if (reservationRef && reservation) {
        transaction.set(reservationRef, stamp({
          status: 'released',
          releaseReason: 'approved_policy_exception_cancellation',
          releasedAtMs: reviewedAtMs,
          releasedBy: user.uid,
          policyExceptionReviewId: changeRequestId
        }), { merge: true });
      }

      if (refundRef && !refundSnap?.exists) {
        const providerPaymentIntentId = clean(invoice.providerPaymentIntentId || order.providerPaymentIntentId, 180);
        transaction.create(refundRef, {
          id: refundRequestId,
          orderId: order.id,
          quoteId: clean(change.quoteId, 180),
          invoiceId: clean(change.invoiceId, 180),
          companyId: clean(change.companyId, 180),
          companyName: clean(change.companyName, 180),
          customerId: clean(change.customerId, 180),
          customerName: clean(change.customerName, 180),
          customerEmail: clean(order.customerEmail, 240),
          currency: 'usd',
          amountCents: refundAmountCents,
          paidCents,
          refundPercent,
          reason: clean(change.reason, 800),
          policyReason: 'Approved through Marketplace policy-exception review.',
          providerPaymentIntentId,
          status: providerPaymentIntentId ? 'approved_pending_execution' : 'pending_payment_reference',
          approvedBy: user.uid,
          approvedByName: user.name,
          approvedAtMs: reviewedAtMs,
          policyExceptionReviewId: changeRequestId,
          createdAtMs: reviewedAtMs,
          updatedAtMs: reviewedAtMs,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      }

      const orderStatus = refundAmountCents > 0 ? 'cancelled_pending_refund' : 'cancelled';
      transaction.set(orderRef, stamp({
        status: orderStatus,
        scheduleStatus: 'cancelled',
        cancellationStatus: resultStatus,
        cancellationRequestId: changeRequestId,
        cancellationReason: clean(change.reason, 800),
        cancelledAtMs: reviewedAtMs,
        cancelledBy: user.uid,
        cancelledByName: user.name,
        refundStatus: refundAmountCents > 0 ? 'pending' : 'not_required',
        refundRequestId,
        refundAmountCents,
        refundPercent,
        lastChangeReviewId: changeRequestId
      }), { merge: true });
      if (change.quoteId) {
        transaction.set(db.doc(`quotes/${clean(change.quoteId, 180)}`), stamp({
          cancellationStatus: resultStatus,
          cancelledAtMs: reviewedAtMs,
          cancelledBy: user.uid,
          paymentStatus: refundAmountCents > 0 ? 'refund_pending' : clean(order.paymentStatus, 60),
          policyExceptionReviewId: changeRequestId
        }), { merge: true });
      }
      if (invoiceRef) {
        transaction.set(invoiceRef, stamp({
          refundStatus: refundAmountCents > 0 ? 'pending' : 'not_required',
          refundRequestId,
          refundableCents: refundAmountCents,
          refundPercent,
          cancellationRequestId: changeRequestId,
          policyExceptionReviewId: changeRequestId
        }), { merge: true });
      }
    }

    transaction.set(changeRef, stamp({
      status: resultStatus,
      reviewNotes,
      reviewedAtMs,
      reviewedBy: user.uid,
      reviewedByName: user.name,
      reviewedByRole: user.role,
      refundPercentOverride: type === 'cancel' ? refundPercent : null,
      refundAmountCents,
      refundRequestId,
      policyExceptionReviewId: changeRequestId
    }), { merge: true });
    transaction.create(auditRef, audit);

    return {
      changeRequestId,
      status: resultStatus,
      orderId: order.id,
      refundRequestId,
      refundAmountCents,
      reused: false
    };
  });

  return result;
});
