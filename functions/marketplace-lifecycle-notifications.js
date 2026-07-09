const admin = require('firebase-admin');
const crypto = require('crypto');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const REGION = 'us-central1';

function clean(value = '', max = 800) {
  return String(value || '').trim().slice(0, max);
}

function norm(value = '') {
  return String(value || '').trim().toLowerCase();
}

function number(value = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hash(value = '') {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 28);
}

function eventId(prefix, entityId, event, value = '') {
  return `${prefix}_${hash(`${entityId}|${event}|${value}`)}`;
}

function assignedUids(order = {}) {
  const values = [
    ...(Array.isArray(order.assignedTo) ? order.assignedTo : []),
    ...(Array.isArray(order.assignedTeamIds) ? order.assignedTeamIds : []),
    order.staffClaimedBy,
    order.assignedToUid,
    order.technicianId,
    order.cleanerId
  ];
  return [...new Set(values.map((value) => clean(value, 180)).filter(Boolean))];
}

function customerNotification({ id, customerId, companyId = '', companyName = '', title, body, type = 'service', priority = 'normal', relatedType = 'order', relatedId = '', metadata = {} }) {
  return {
    id,
    customerId,
    companyId,
    companyName,
    title: clean(title, 180),
    body: clean(body, 800),
    type,
    priority,
    status: 'unread',
    relatedType,
    relatedId,
    actionUrl: '/customer-commerce.html',
    metadata,
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
}

function internalNotification({ id, userId = '', companyId = '', title, body, type = 'marketplace', priority = 'normal', relatedType = 'order', relatedId = '', metadata = {} }) {
  return {
    id,
    userId,
    companyId,
    title: clean(title, 180),
    body: clean(body, 800),
    type,
    priority,
    status: 'unread',
    relatedType,
    relatedId,
    actionUrl: '/jobs.html',
    metadata,
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
}

function addCustomer(batch, order, event, title, body, options = {}) {
  const customerId = clean(order.customerId || order.customerUid, 180);
  if (!customerId) return;
  const id = eventId('customer_notification', order.id, event, options.value || '');
  batch.set(db.doc(`customer_notifications/${id}`), customerNotification({
    id,
    customerId,
    companyId: clean(order.companyId, 180),
    companyName: clean(order.companyName, 180),
    title,
    body,
    type: options.type || 'service',
    priority: options.priority || 'normal',
    relatedId: order.id,
    metadata: { event, ...options.metadata }
  }), { merge: true });
}

function addCompany(batch, order, event, title, body, options = {}) {
  const companyId = clean(order.companyId, 180);
  if (!companyId) return;
  const id = eventId('notification', order.id, event, options.value || '');
  batch.set(db.doc(`notifications/${id}`), internalNotification({
    id,
    companyId,
    title,
    body,
    priority: options.priority || 'normal',
    relatedId: order.id,
    metadata: { event, audience: 'company_operations', ...options.metadata }
  }), { merge: true });
}

function addStaff(batch, order, event, title, body, options = {}) {
  assignedUids(order).forEach((userId) => {
    const id = eventId('notification', order.id, event, `${userId}|${options.value || ''}`);
    batch.set(db.doc(`notifications/${id}`), internalNotification({
      id,
      userId,
      companyId: clean(order.companyId, 180),
      title,
      body,
      priority: options.priority || 'normal',
      relatedId: order.id,
      metadata: { event, audience: 'assigned_staff', ...options.metadata }
    }), { merge: true });
  });
}

function formatAppointment(value) {
  const ms = number(value);
  if (!ms) return 'the scheduled time';
  return new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York'
  });
}

exports.notifyMarketplaceOrderLifecycle = onDocumentWritten({
  document: 'jobs/{orderId}',
  region: REGION
}, async (event) => {
  const beforeExists = event.data?.before?.exists;
  const afterExists = event.data?.after?.exists;
  if (!afterExists) return;

  const before = beforeExists ? event.data.before.data() || {} : {};
  const after = { id: event.params.orderId, ...(event.data.after.data() || {}) };
  const isMarketplace = Boolean(after.quoteId || after.invoiceId || after.source === 'customer_quote_acceptance' || after.vendorAcceptanceStatus);
  if (!isMarketplace) return;

  const batch = db.batch();
  let writes = 0;
  const queue = (fn) => {
    fn();
    writes += 1;
  };

  if (!beforeExists) {
    queue(() => addCustomer(batch, after, 'order_created', 'Order created', 'Your Marketplace order has been created and is moving through confirmation.'));
    queue(() => addCompany(batch, after, 'order_created', 'New Marketplace order', `${after.customerName || 'A customer'} has a new Marketplace order.`, { priority: 'high' }));
  }

  if (norm(before.paymentStatus) !== norm(after.paymentStatus)) {
    const paymentStatus = norm(after.paymentStatus);
    if (paymentStatus === 'paid') {
      queue(() => addCustomer(batch, after, 'payment_paid', 'Payment confirmed', 'Your payment was confirmed and your appointment is secured.', { type: 'billing', priority: 'high', value: paymentStatus }));
      queue(() => addCompany(batch, after, 'payment_paid', 'Marketplace payment confirmed', `Payment is confirmed for ${after.customerName || 'the customer'}'s order.`, { priority: 'high', value: paymentStatus }));
    } else if (paymentStatus === 'failed') {
      queue(() => addCustomer(batch, after, 'payment_failed', 'Payment needs attention', 'Your payment did not complete. Return to the customer portal to try again.', { type: 'billing', priority: 'urgent', value: paymentStatus }));
      queue(() => addCompany(batch, after, 'payment_failed', 'Marketplace payment failed', `Payment failed for order ${after.id}.`, { priority: 'high', value: paymentStatus }));
    }
  }

  if (number(before.scheduledAtMs) !== number(after.scheduledAtMs) && number(after.scheduledAtMs) > 0) {
    const appointment = formatAppointment(after.scheduledAtMs);
    queue(() => addCustomer(batch, after, 'schedule_changed', 'Appointment updated', `Your service is scheduled for ${appointment}.`, { priority: 'high', value: after.scheduledAtMs }));
    queue(() => addCompany(batch, after, 'schedule_changed', 'Marketplace appointment updated', `Order ${after.id} is scheduled for ${appointment}.`, { value: after.scheduledAtMs }));
    queue(() => addStaff(batch, after, 'schedule_changed', 'Assigned appointment updated', `Your assigned Marketplace order is scheduled for ${appointment}.`, { priority: 'high', value: after.scheduledAtMs }));
  }

  if (norm(before.vendorAcceptanceStatus) !== norm(after.vendorAcceptanceStatus)) {
    const vendorStatus = norm(after.vendorAcceptanceStatus);
    if (vendorStatus === 'accepted') {
      queue(() => addCustomer(batch, after, 'vendor_accepted', 'Provider confirmed', 'Your service provider accepted the order and is preparing for fulfillment.', { value: vendorStatus }));
      queue(() => addCompany(batch, after, 'vendor_accepted', 'Marketplace order accepted', `Order ${after.id} entered the fulfillment workflow.`, { value: vendorStatus }));
    } else if (vendorStatus === 'rejected') {
      queue(() => addCustomer(batch, after, 'vendor_rejected', 'Provider reassignment underway', 'The original provider could not fulfill this order. Dispatch is working on reassignment.', { priority: 'high', value: vendorStatus }));
      queue(() => addCompany(batch, after, 'vendor_rejected', 'Marketplace order needs reassignment', `Order ${after.id} was rejected by the provider.`, { priority: 'urgent', value: vendorStatus }));
    }
  }

  if (norm(before.status) !== norm(after.status)) {
    const status = norm(after.status);
    const statusEvents = {
      scheduled: ['Service confirmed', 'Your service is confirmed and scheduled.'],
      in_progress: ['Service started', 'Your assigned team has started the service.'],
      'in progress': ['Service started', 'Your assigned team has started the service.'],
      completed: ['Service completed', 'Your service has been marked complete.'],
      cancelled: ['Order cancelled', 'Your Marketplace order has been cancelled.'],
      cancelled_pending_refund: ['Order cancelled', 'Your order is cancelled and its refund is pending.'],
      refunded: ['Order refunded', 'Your order refund has been completed.']
    };
    if (statusEvents[status]) {
      const [title, body] = statusEvents[status];
      queue(() => addCustomer(batch, after, `status_${status}`, title, body, { priority: ['cancelled', 'cancelled_pending_refund'].includes(status) ? 'high' : 'normal', value: status }));
    }
    if (['scheduled', 'in_progress', 'in progress', 'completed'].includes(status)) {
      queue(() => addStaff(batch, after, `status_${status}`, `Order ${status.replace('_', ' ')}`, `${after.customerName || 'Customer'} · ${after.serviceName || after.service || 'Marketplace service'}`, { value: status }));
    }
  }

  if (norm(before.cancellationStatus) !== norm(after.cancellationStatus) && norm(after.cancellationStatus) === 'pending_review') {
    queue(() => addCompany(batch, after, 'cancellation_review', 'Cancellation requires review', `Order ${after.id} has a cancellation request inside the policy window.`, { priority: 'urgent', value: after.cancellationRequestId || '' }));
  }

  if (norm(before.rescheduleStatus) !== norm(after.rescheduleStatus) && norm(after.rescheduleStatus) === 'pending_review') {
    queue(() => addCompany(batch, after, 'reschedule_review', 'Reschedule requires review', `Order ${after.id} has a late reschedule request awaiting review.`, { priority: 'urgent', value: after.pendingRescheduleRequestId || '' }));
  }

  if (norm(before.refundStatus) !== norm(after.refundStatus)) {
    const refundStatus = norm(after.refundStatus);
    if (['pending', 'processing'].includes(refundStatus)) {
      queue(() => addCustomer(batch, after, `refund_${refundStatus}`, 'Refund update', `Your refund is ${refundStatus}.`, { type: 'billing', priority: 'high', value: refundStatus }));
      queue(() => addCompany(batch, after, `refund_${refundStatus}`, 'Refund action required', `Refund status for order ${after.id}: ${refundStatus}.`, { priority: 'high', value: refundStatus }));
    } else if (refundStatus === 'refunded') {
      queue(() => addCustomer(batch, after, 'refund_refunded', 'Refund completed', 'Your refund has been processed by the payment provider.', { type: 'billing', priority: 'high', value: refundStatus }));
    }
  }

  if (writes) await batch.commit();
});

exports.notifyMarketplaceChangeRequest = onDocumentWritten({
  document: 'marketplace_change_requests/{requestId}',
  region: REGION
}, async (event) => {
  if (!event.data?.after?.exists) return;
  const before = event.data.before.exists ? event.data.before.data() || {} : {};
  const after = { id: event.params.requestId, ...(event.data.after.data() || {}) };
  if (norm(before.status) === norm(after.status) && event.data.before.exists) return;

  const status = norm(after.status);
  const batch = db.batch();
  let hasWrite = false;

  if (status === 'pending_review' && after.companyId) {
    const id = eventId('notification', after.id, 'change_pending', status);
    batch.set(db.doc(`notifications/${id}`), internalNotification({
      id,
      companyId: after.companyId,
      title: `${after.type === 'cancel' ? 'Cancellation' : 'Reschedule'} needs review`,
      body: `Marketplace order ${after.orderId} has a policy exception awaiting review.`,
      priority: 'urgent',
      relatedType: 'marketplace_change_request',
      relatedId: after.id,
      metadata: { orderId: after.orderId, changeType: after.type }
    }), { merge: true });
    hasWrite = true;
  }

  if (['approved', 'approved_override', 'rejected'].includes(status) && after.customerId) {
    const id = eventId('customer_notification', after.id, 'change_decision', status);
    const approved = status.startsWith('approved');
    batch.set(db.doc(`customer_notifications/${id}`), customerNotification({
      id,
      customerId: after.customerId,
      companyId: after.companyId || '',
      companyName: after.companyName || '',
      title: `${after.type === 'cancel' ? 'Cancellation' : 'Reschedule'} ${approved ? 'approved' : 'declined'}`,
      body: approved
        ? 'Your requested Marketplace order change was approved.'
        : clean(after.reviewNotes || 'Your requested Marketplace order change was declined.'),
      priority: approved ? 'normal' : 'high',
      relatedType: 'marketplace_change_request',
      relatedId: after.id,
      metadata: { orderId: after.orderId, status }
    }), { merge: true });
    hasWrite = true;
  }

  if (hasWrite) await batch.commit();
});

exports.notifyMarketplaceRefundRequest = onDocumentWritten({
  document: 'refund_requests/{refundRequestId}',
  region: REGION
}, async (event) => {
  if (!event.data?.after?.exists) return;
  const before = event.data.before.exists ? event.data.before.data() || {} : {};
  const after = { id: event.params.refundRequestId, ...(event.data.after.data() || {}) };
  if (norm(before.status) === norm(after.status) && event.data.before.exists) return;

  const status = norm(after.status);
  const batch = db.batch();
  let hasWrite = false;

  if (['approved_pending_execution', 'pending_payment_reference', 'failed'].includes(status) && after.companyId) {
    const id = eventId('notification', after.id, 'refund_action', status);
    batch.set(db.doc(`notifications/${id}`), internalNotification({
      id,
      companyId: after.companyId,
      title: status === 'failed' ? 'Refund failed' : 'Refund requires action',
      body: `Refund ${after.id} for order ${after.orderId} is ${status.replaceAll('_', ' ')}.`,
      priority: status === 'failed' ? 'urgent' : 'high',
      relatedType: 'refund_request',
      relatedId: after.id,
      metadata: { orderId: after.orderId, amountCents: after.amountCents, status }
    }), { merge: true });
    hasWrite = true;
  }

  if (['processing', 'pending_provider', 'succeeded', 'failed'].includes(status) && after.customerId) {
    const id = eventId('customer_notification', after.id, 'refund_status', status);
    const title = status === 'succeeded' ? 'Refund processed' : status === 'failed' ? 'Refund needs attention' : 'Refund update';
    const body = status === 'succeeded'
      ? 'Your refund was processed. Your bank may take additional time to post it.'
      : status === 'failed'
        ? 'The refund could not be completed automatically. The support team has been notified.'
        : `Your refund is ${status.replaceAll('_', ' ')}.`;
    batch.set(db.doc(`customer_notifications/${id}`), customerNotification({
      id,
      customerId: after.customerId,
      companyId: after.companyId || '',
      companyName: after.companyName || '',
      title,
      body,
      type: 'billing',
      priority: status === 'failed' ? 'urgent' : 'high',
      relatedType: 'refund_request',
      relatedId: after.id,
      metadata: { orderId: after.orderId, amountCents: after.amountCents, status }
    }), { merge: true });
    hasWrite = true;
  }

  if (hasWrite) await batch.commit();
});
