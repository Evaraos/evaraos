const Stripe = require('stripe');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const {
  db, REGION, OPS_ROLES, norm, clean, cents, stamp, actor, notification
} = require('./marketplace-operations-core');

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');

function stripe() {
  const key = STRIPE_SECRET_KEY.value();
  if (!key) throw new HttpsError('failed-precondition', 'Stripe is not configured yet.');
  return new Stripe(key, { apiVersion: '2024-12-18.acacia' });
}

exports.processMarketplaceRefund = onCall({
  region: REGION,
  enforceAppCheck: true,
  cors: true,
  secrets: [STRIPE_SECRET_KEY]
}, async (request) => {
  const user = await actor(request);
  if (!OPS_ROLES.has(user.role)) throw new HttpsError('permission-denied', 'Your role cannot process refunds.');

  const refundRequestId = clean(request.data?.refundRequestId, 180);
  if (!refundRequestId) throw new HttpsError('invalid-argument', 'refundRequestId is required.');
  const refundRef = db.doc(`refund_requests/${refundRequestId}`);
  const snap = await refundRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Refund request not found.');
  const row = { id: snap.id, ...snap.data() };

  const platformRole = ['owner', 'super_admin', 'admin'].includes(user.role);
  if (!platformRole && user.companyId && row.companyId && user.companyId !== row.companyId) throw new HttpsError('permission-denied', 'This refund belongs to another company.');
  if (norm(row.status) === 'succeeded') return { refundRequestId, status: 'succeeded', providerRefundId: row.providerRefundId || '', reused: true };
  if (!row.providerPaymentIntentId) throw new HttpsError('failed-precondition', 'The captured Stripe payment reference is not available yet.');
  if (cents(row.amountCents) <= 0) throw new HttpsError('failed-precondition', 'The refund amount is invalid.');

  await refundRef.set(stamp({ status: 'processing', processingAtMs: Date.now(), processingBy: user.uid, processingByName: user.name }), { merge: true });

  try {
    const provider = await stripe().refunds.create({
      payment_intent: row.providerPaymentIntentId,
      amount: cents(row.amountCents),
      reason: 'requested_by_customer',
      metadata: {
        refundRequestId,
        orderId: row.orderId || '',
        invoiceId: row.invoiceId || '',
        customerId: row.customerId || '',
        companyId: row.companyId || ''
      }
    }, { idempotencyKey: `marketplace_refund_${refundRequestId}` });

    const succeeded = provider.status === 'succeeded';
    const batch = db.batch();
    batch.set(refundRef, stamp({
      status: succeeded ? 'succeeded' : 'pending_provider',
      providerRefundId: provider.id,
      providerStatus: provider.status,
      processedAtMs: Date.now(),
      processedBy: user.uid,
      processedByName: user.name
    }), { merge: true });
    if (row.orderId) batch.set(db.doc(`jobs/${row.orderId}`), stamp({
      refundStatus: succeeded ? 'refunded' : 'processing',
      refundedAtMs: succeeded ? Date.now() : 0,
      providerRefundId: provider.id,
      status: succeeded ? 'refunded' : 'cancelled_pending_refund'
    }), { merge: true });
    if (row.invoiceId) batch.set(db.doc(`invoices/${row.invoiceId}`), stamp({
      refundStatus: succeeded ? 'refunded' : 'processing',
      refundedCents: succeeded ? cents(row.amountCents) : 0,
      providerRefundId: provider.id
    }), { merge: true });

    const note = notification({
      customerId: row.customerId,
      companyId: row.companyId,
      companyName: row.companyName,
      title: succeeded ? 'Refund processed' : 'Refund processing',
      body: succeeded ? 'Your refund was submitted successfully. Your bank may take additional time to post it.' : 'Your refund was submitted to the payment provider and is still processing.',
      type: 'billing', priority: 'high', relatedId: row.orderId,
      metadata: { refundRequestId, providerRefundId: provider.id }
    });
    batch.set(db.doc(`customer_notifications/${note.id}`), note, { merge: true });
    await batch.commit();

    return { refundRequestId, status: succeeded ? 'succeeded' : 'pending_provider', providerRefundId: provider.id, reused: false };
  } catch (error) {
    console.error('Marketplace refund failed:', error);
    await refundRef.set(stamp({ status: 'failed', failureCode: clean(error.code, 120), failureMessage: clean(error.message, 800), failedAtMs: Date.now() }), { merge: true });
    throw new HttpsError('internal', 'The refund could not be processed.');
  }
});
