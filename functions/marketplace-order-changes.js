const { onCall, HttpsError } = require('firebase-functions/v2/https');
const {
  db, FieldValue, REGION, HOUR_MS, DAY_MS, TERMINAL,
  norm, clean, num, int, cents, idFor, stamp, owns, actor,
  policy, scheduleMs, notification, refundDecision, releaseReservation
} = require('./marketplace-operations-core');

exports.requestMarketplaceReschedule = onCall({ region: REGION, enforceAppCheck: true, cors: true }, async (request) => {
  const user = await actor(request);
  const orderId = clean(request.data?.orderId, 180);
  const requestedAtMs = num(request.data?.newScheduledAtMs);
  const reason = clean(request.data?.reason, 500);
  if (!orderId || requestedAtMs <= Date.now()) throw new HttpsError('invalid-argument', 'A valid order and future appointment time are required.');

  const orderRef = db.doc(`jobs/${orderId}`);
  const changeId = idFor('change_request', `${orderId}|reschedule|${requestedAtMs}`);
  const changeRef = db.doc(`marketplace_change_requests/${changeId}`);

  const result = await db.runTransaction(async (transaction) => {
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists) throw new HttpsError('not-found', 'Order not found.');
    const order = { id: orderSnap.id, ...orderSnap.data() };
    if (!owns(order, user.uid)) throw new HttpsError('permission-denied', 'This order does not belong to your account.');
    if (TERMINAL.has(norm(order.status))) throw new HttpsError('failed-precondition', 'This order can no longer be rescheduled.');

    const companyRef = order.companyId ? db.doc(`companies/${order.companyId}`) : null;
    const reservationRef = db.doc(`appointment_reservations/${order.appointmentReservationId || idFor('reservation', order.quoteId || orderId)}`);
    const newSlotRef = db.doc(`appointment_slots/${idFor('slot', `${order.companyId}|${requestedAtMs}`)}`);
    const [companySnap, reservationSnap, newSlotSnap, changeSnap] = await Promise.all([
      companyRef ? transaction.get(companyRef) : Promise.resolve(null),
      transaction.get(reservationRef),
      transaction.get(newSlotRef),
      transaction.get(changeRef)
    ]);

    if (changeSnap.exists && ['approved', 'pending_review'].includes(norm(changeSnap.data()?.status))) return { ...changeSnap.data(), reused: true };

    const company = companySnap?.exists ? companySnap.data() || {} : {};
    const rules = policy(company);
    const oldAtMs = scheduleMs(order);
    const noticeHours = oldAtMs > Date.now() ? (oldAtMs - Date.now()) / HOUR_MS : 0;
    if (requestedAtMs > Date.now() + rules.bookingHorizonDays * DAY_MS) throw new HttpsError('failed-precondition', 'The requested appointment is outside the booking horizon.');

    const base = {
      id: changeId, type: 'reschedule', orderId,
      quoteId: order.quoteId || '', invoiceId: order.invoiceId || '',
      reservationId: reservationRef.id, companyId: order.companyId || '', companyName: order.companyName || '',
      customerId: user.uid, customerName: order.customerName || user.name,
      oldScheduledAtMs: oldAtMs, requestedScheduledAtMs: requestedAtMs,
      reason, noticeHours, policy: rules,
      requestedAtMs: Date.now(), requestedBy: user.uid,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), updatedAtMs: Date.now()
    };

    if (noticeHours < rules.minimumRescheduleNoticeHours && rules.lateRescheduleRequiresReview) {
      const pending = { ...base, status: 'pending_review', decisionReason: 'Inside the configured reschedule notice window.' };
      transaction.set(changeRef, pending, { merge: true });
      transaction.set(orderRef, stamp({ rescheduleStatus: 'pending_review', pendingRescheduleRequestId: changeId, pendingScheduledAtMs: requestedAtMs }), { merge: true });
      const note = notification({ customerId: user.uid, companyId: order.companyId || '', companyName: order.companyName || '', title: 'Reschedule request submitted', body: 'Your requested appointment change is inside the notice window and is awaiting review.', priority: 'high', relatedId: orderId, metadata: { changeRequestId: changeId, requestedScheduledAtMs: requestedAtMs } });
      transaction.set(db.doc(`customer_notifications/${note.id}`), note, { merge: true });
      return { ...pending, reused: false };
    }

    const reservation = reservationSnap.exists ? reservationSnap.data() || {} : {};
    const slot = newSlotSnap.exists ? newSlotSnap.data() || {} : {};
    const capacity = Math.max(1, int(slot.capacity || order.slotCapacity || rules.defaultSlotCapacity));
    const reserved = Math.max(0, int(slot.reservedCount));
    const sameSlot = reservation.slotId === newSlotRef.id && ['held', 'confirmed'].includes(norm(reservation.status));
    if (!sameSlot && reserved >= capacity) throw new HttpsError('resource-exhausted', 'That appointment time is no longer available.');

    let oldSlotRef = null;
    let oldSlotSnap = null;
    if (!sameSlot && reservation.slotId) {
      oldSlotRef = db.doc(`appointment_slots/${reservation.slotId}`);
      oldSlotSnap = await transaction.get(oldSlotRef);
    }

    if (oldSlotSnap?.exists) transaction.set(oldSlotRef, stamp({ reservedCount: Math.max(0, int(oldSlotSnap.data()?.reservedCount) - 1) }), { merge: true });
    if (!sameSlot) transaction.set(newSlotRef, stamp({ id: newSlotRef.id, companyId: order.companyId || '', scheduledAtMs: requestedAtMs, capacity, reservedCount: reserved + 1 }), { merge: true });

    const reservationStatus = norm(order.paymentStatus) === 'paid' ? 'confirmed' : 'held';
    transaction.set(reservationRef, stamp({
      id: reservationRef.id, orderId, quoteId: order.quoteId || '', invoiceId: order.invoiceId || '',
      companyId: order.companyId || '', customerId: user.uid, slotId: newSlotRef.id,
      scheduledAtMs: requestedAtMs, status: reservationStatus, capacity,
      expiresAtMs: reservationStatus === 'held' ? Date.now() + 35 * 60 * 1000 : 0,
      previousScheduledAtMs: oldAtMs, rescheduledAtMs: Date.now(), rescheduledBy: user.uid, rescheduleReason: reason
    }), { merge: true });

    const approved = { ...base, status: 'approved', approvedAtMs: Date.now(), approvedBy: 'policy_engine' };
    transaction.set(changeRef, approved, { merge: true });
    transaction.set(orderRef, stamp({
      scheduledAtMs: requestedAtMs, scheduledAt: new Date(requestedAtMs).toISOString(), scheduledFor: new Date(requestedAtMs).toISOString(),
      scheduleStatus: reservationStatus === 'confirmed' ? 'confirmed' : 'reserved_pending_payment',
      rescheduleStatus: 'approved', rescheduledAtMs: Date.now(), rescheduledBy: user.uid,
      previousScheduledAtMs: oldAtMs, pendingRescheduleRequestId: '', pendingScheduledAtMs: 0,
      rescheduleCount: int(order.rescheduleCount) + 1, appointmentReservationId: reservationRef.id
    }), { merge: true });
    if (order.quoteId) transaction.set(db.doc(`quotes/${order.quoteId}`), stamp({ scheduledAtMs: requestedAtMs, requestedScheduleAtMs: requestedAtMs, appointmentReservationId: reservationRef.id, rescheduleStatus: 'approved' }), { merge: true });

    const note = notification({ customerId: user.uid, companyId: order.companyId || '', companyName: order.companyName || '', title: 'Appointment rescheduled', body: `Your appointment was moved to ${new Date(requestedAtMs).toLocaleString('en-US', { timeZone: 'America/New_York' })}.`, relatedId: orderId, metadata: { changeRequestId: changeId, scheduledAtMs: requestedAtMs } });
    transaction.set(db.doc(`customer_notifications/${note.id}`), note, { merge: true });
    return { ...approved, reused: false };
  });

  return { orderId, changeRequestId: changeId, status: result.status, scheduledAtMs: result.status === 'approved' ? requestedAtMs : 0, requiresReview: result.status === 'pending_review', reused: Boolean(result.reused) };
});

exports.cancelMarketplaceOrder = onCall({ region: REGION, enforceAppCheck: true, cors: true }, async (request) => {
  const user = await actor(request);
  const orderId = clean(request.data?.orderId, 180);
  const reason = clean(request.data?.reason || 'Customer requested cancellation', 500);
  if (!orderId) throw new HttpsError('invalid-argument', 'orderId is required.');

  const orderRef = db.doc(`jobs/${orderId}`);
  const changeId = idFor('change_request', `${orderId}|cancel`);
  const changeRef = db.doc(`marketplace_change_requests/${changeId}`);

  const result = await db.runTransaction(async (transaction) => {
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists) throw new HttpsError('not-found', 'Order not found.');
    const order = { id: orderSnap.id, ...orderSnap.data() };
    if (!owns(order, user.uid)) throw new HttpsError('permission-denied', 'This order does not belong to your account.');
    if (TERMINAL.has(norm(order.status))) return { orderId, status: norm(order.status), alreadyFinal: true, refundRequestId: order.refundRequestId || '' };

    const companyRef = order.companyId ? db.doc(`companies/${order.companyId}`) : null;
    const invoiceRef = order.invoiceId ? db.doc(`invoices/${order.invoiceId}`) : null;
    const reservationRef = order.appointmentReservationId ? db.doc(`appointment_reservations/${order.appointmentReservationId}`) : null;
    const [companySnap, invoiceSnap, reservationSnap, changeSnap] = await Promise.all([
      companyRef ? transaction.get(companyRef) : Promise.resolve(null),
      invoiceRef ? transaction.get(invoiceRef) : Promise.resolve(null),
      reservationRef ? transaction.get(reservationRef) : Promise.resolve(null),
      transaction.get(changeRef)
    ]);
    if (changeSnap.exists && ['approved', 'pending_review'].includes(norm(changeSnap.data()?.status))) return { ...changeSnap.data(), reused: true };

    const company = companySnap?.exists ? companySnap.data() || {} : {};
    const invoice = invoiceSnap?.exists ? { id: invoiceSnap.id, ...invoiceSnap.data() } : {};
    const reservation = reservationSnap?.exists ? reservationSnap.data() || {} : null;
    const rules = policy(company);
    const refund = refundDecision(order, invoice, rules);
    const needsReview = refund.disposition === 'manual_review';
    const refundId = refund.refundAmountCents > 0 ? idFor('refund_request', `${orderId}|${refund.refundAmountCents}`) : '';
    const refundRef = refundId ? db.doc(`refund_requests/${refundId}`) : null;
    const refundSnap = refundRef ? await transaction.get(refundRef) : null;

    const change = {
      id: changeId, type: 'cancel', orderId, quoteId: order.quoteId || '', invoiceId: order.invoiceId || '',
      reservationId: order.appointmentReservationId || '', companyId: order.companyId || '', companyName: order.companyName || '',
      customerId: user.uid, customerName: order.customerName || user.name, reason, policy: rules, refundDecision: refund,
      status: needsReview ? 'pending_review' : 'approved', requestedAtMs: Date.now(), requestedBy: user.uid,
      approvedAtMs: needsReview ? 0 : Date.now(), approvedBy: needsReview ? '' : 'policy_engine',
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), updatedAtMs: Date.now()
    };

    if (needsReview) {
      transaction.set(changeRef, change, { merge: true });
      transaction.set(orderRef, stamp({ cancellationStatus: 'pending_review', cancellationRequestId: changeId, cancellationReason: reason }), { merge: true });
      const note = notification({ customerId: user.uid, companyId: order.companyId || '', companyName: order.companyName || '', title: 'Cancellation review started', body: 'Your cancellation request is inside the configured policy window and is awaiting review.', priority: 'high', relatedId: orderId, metadata: { cancellationRequestId: changeId } });
      transaction.set(db.doc(`customer_notifications/${note.id}`), note, { merge: true });
      return { ...change, refundRequestId: refundId, reused: false };
    }

    if (reservationRef && reservation) await releaseReservation(transaction, reservationRef, reservation, 'customer_cancelled');
    transaction.set(changeRef, change, { merge: true });

    if (refundRef && !refundSnap?.exists) {
      const paymentIntent = invoice.providerPaymentIntentId || order.providerPaymentIntentId || '';
      transaction.set(refundRef, {
        id: refundId, orderId, quoteId: order.quoteId || '', invoiceId: order.invoiceId || '',
        companyId: order.companyId || '', companyName: order.companyName || '', customerId: user.uid,
        customerName: order.customerName || user.name, customerEmail: order.customerEmail || user.email,
        currency: 'usd', amountCents: refund.refundAmountCents, paidCents: refund.paidCents,
        refundPercent: refund.refundPercent, reason, policyReason: refund.reason,
        providerPaymentIntentId: paymentIntent,
        status: paymentIntent ? 'approved_pending_execution' : 'pending_payment_reference',
        createdAtMs: Date.now(), updatedAtMs: Date.now(), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }

    const orderStatus = refundId ? 'cancelled_pending_refund' : 'cancelled';
    transaction.set(orderRef, stamp({
      status: orderStatus, scheduleStatus: 'cancelled', cancellationStatus: 'approved',
      cancellationRequestId: changeId, cancellationReason: reason, cancelledAtMs: Date.now(), cancelledBy: user.uid,
      refundStatus: refundId ? 'pending' : 'not_required', refundRequestId: refundId, refundAmountCents: refund.refundAmountCents
    }), { merge: true });
    if (order.quoteId) transaction.set(db.doc(`quotes/${order.quoteId}`), stamp({ cancellationStatus: 'approved', cancelledAtMs: Date.now(), cancelledBy: user.uid, paymentStatus: refundId ? 'refund_pending' : order.paymentStatus || '' }), { merge: true });
    if (invoiceRef) transaction.set(invoiceRef, stamp({ refundStatus: refundId ? 'pending' : 'not_required', refundRequestId: refundId, refundableCents: refund.refundAmountCents, cancellationRequestId: changeId }), { merge: true });

    const note = notification({
      customerId: user.uid, companyId: order.companyId || '', companyName: order.companyName || '',
      title: refundId ? 'Order cancelled · Refund queued' : 'Order cancelled',
      body: refundId ? `Your order was cancelled and a ${refund.refundPercent}% refund was queued for processing.` : 'Your order was cancelled. No captured payment requires an automatic refund.',
      type: refundId ? 'billing' : 'service', priority: refundId ? 'high' : 'normal', relatedId: orderId,
      metadata: { cancellationRequestId: changeId, refundRequestId: refundId, refundAmountCents: refund.refundAmountCents }
    });
    transaction.set(db.doc(`customer_notifications/${note.id}`), note, { merge: true });
    return { ...change, refundRequestId: refundId, reused: false };
  });

  return { orderId, cancellationRequestId: changeId, status: result.status, requiresReview: result.status === 'pending_review', refundRequestId: result.refundRequestId || '', refundAmountCents: cents(result.refundDecision?.refundAmountCents), alreadyFinal: Boolean(result.alreadyFinal), reused: Boolean(result.reused) };
});
