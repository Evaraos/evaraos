const admin = require('firebase-admin');
const crypto = require('crypto');
const Stripe = require('stripe');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret, defineString } = require('firebase-functions/params');

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
const APP_BASE_URL = defineString('APP_BASE_URL', { default: 'https://evaraos-web.web.app' });
const REGION = 'us-central1';
const HOLD_MS = 35 * 60 * 1000;
const ACCEPTABLE_QUOTES = new Set(['pending', 'sent', 'viewed']);
const VENDOR_ROLES = new Set(['owner', 'super_admin', 'admin', 'manager', 'operations_manager', 'operations_coordinator', 'field_manager', 'dispatcher', 'sales_manager', 'sales', 'sales_rep']);

const norm = (value = '') => String(value || '').trim().toLowerCase();
const cents = (value = 0) => Math.max(0, Math.round(Number(value || 0)));
const int = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
const text = (value = '', max = 500) => String(value || '').trim().slice(0, max);
const stamp = (patch = {}) => ({ ...patch, updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() });
const idFor = (prefix, value) => `${prefix}_${crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 28)}`;
const owns = (data = {}, uid = '') => Boolean(uid) && [data.customerId, data.customerUid, data.userId, data.uid].some((value) => String(value || '') === uid);
const validEmail = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

function stripe() {
  const key = STRIPE_SECRET_KEY.value();
  if (!key) throw new HttpsError('failed-precondition', 'Stripe is not configured.');
  return new Stripe(key, { apiVersion: '2024-12-18.acacia' });
}

function callableOptions() {
  return { region: REGION, enforceAppCheck: true, cors: true, secrets: [STRIPE_SECRET_KEY] };
}

async function actor(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to continue.');
  const snap = await db.doc(`users/${uid}`).get();
  const profile = snap.exists ? snap.data() || {} : {};
  return {
    uid,
    role: norm(profile.role || request.auth.token?.role || 'customer'),
    companyId: text(profile.companyId, 160),
    email: request.auth.token?.email || profile.email || '',
    name: text(profile.displayName || profile.fullName || profile.name || request.auth.token?.name || request.auth.token?.email || 'Customer', 160)
  };
}

function quoteLines(quote = {}) {
  return (Array.isArray(quote.lineItems) ? quote.lineItems : []).map((item, index) => {
    const quantity = Math.max(1, int(item.quantity, 1));
    const amountCents = cents(item.totalCents || item.amountCents || ((item.unitAmountCents || item.basePriceCents || 0) * quantity));
    return {
      id: text(item.id || `line_${index + 1}`, 120),
      serviceId: text(item.serviceId, 160),
      serviceName: text(item.serviceName || item.title || item.name || `Service ${index + 1}`, 160),
      description: text(item.description, 400),
      quantity,
      amountCents,
      unitAmountCents: cents(item.unitAmountCents || item.basePriceCents || Math.round(amountCents / quantity)),
      estimatedDurationMinutes: Math.max(0, int(item.estimatedDurationMinutes)),
      metadata: item.metadata || {}
    };
  }).filter((item) => item.amountCents > 0);
}

function totalFor(quote = {}, lines = quoteLines(quote)) {
  return cents(quote.totalCents) || lines.reduce((sum, item) => sum + item.amountCents, 0);
}

function scheduleFor(quote = {}) {
  const metadata = quote.metadata || {};
  return [quote.scheduledAtMs, quote.requestedScheduleAtMs, quote.appointmentAtMs, metadata.scheduledAtMs, metadata.requestedScheduleAtMs, metadata.appointmentAtMs]
    .map(Number)
    .find((value) => Number.isFinite(value) && value > 0) || 0;
}

function durationFor(quote = {}, lines = quoteLines(quote)) {
  return Math.max(15, int(quote.estimatedDurationMinutes || quote.metadata?.estimatedDurationMinutes || lines.reduce((sum, item) => sum + item.estimatedDurationMinutes, 0), 60));
}

function intervalFor(value = 'monthly') {
  const interval = norm(value);
  return ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'].includes(interval) ? interval : 'monthly';
}

function recurringFor(interval) {
  if (interval === 'weekly') return { interval: 'week', interval_count: 1 };
  if (interval === 'biweekly') return { interval: 'week', interval_count: 2 };
  if (interval === 'quarterly') return { interval: 'month', interval_count: 3 };
  if (interval === 'yearly') return { interval: 'year', interval_count: 1 };
  return { interval: 'month', interval_count: 1 };
}

function checkoutLines(lines, mode, interval = 'monthly') {
  return lines.map((item) => {
    const priceData = {
      currency: 'usd',
      unit_amount: Math.max(1, cents(item.unitAmountCents || Math.round(item.amountCents / item.quantity))),
      product_data: {
        name: text(item.serviceName || 'Marketplace service', 120),
        description: text(item.description, 400) || undefined,
        metadata: item.serviceId ? { serviceId: text(item.serviceId, 160) } : undefined
      }
    };
    if (mode === 'subscription') priceData.recurring = recurringFor(interval);
    return { price_data: priceData, quantity: Math.max(1, int(item.quantity, 1)) };
  });
}

function baseUrl() {
  try {
    const url = new URL(text(APP_BASE_URL.value(), 300));
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new Error('unsafe');
    return url.origin;
  } catch {
    return 'https://evaraos-web.web.app';
  }
}

function invoiceNumber(quoteId) {
  return `EV-${new Date().getFullYear()}-${crypto.createHash('sha1').update(String(quoteId)).digest('hex').slice(0, 8).toUpperCase()}`;
}

async function createQuoteCheckout({ quote, invoice, subscription, reservation, order, user }) {
  const mode = subscription ? 'subscription' : 'payment';
  const lines = quoteLines(quote);
  const metadata = {
    quoteId: quote.id,
    invoiceId: invoice.id,
    subscriptionId: subscription?.id || '',
    reservationId: reservation?.id || '',
    orderId: order.id,
    customerId: user.uid,
    companyId: text(quote.companyId, 160)
  };
  const params = {
    mode,
    client_reference_id: quote.id,
    line_items: checkoutLines(lines, mode, subscription?.interval || 'monthly'),
    success_url: `${baseUrl()}/customer-commerce.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl()}/customer-commerce.html?checkout=cancelled&quoteId=${encodeURIComponent(quote.id)}`,
    metadata,
    expires_at: Math.floor((Date.now() + HOLD_MS) / 1000),
    billing_address_collection: 'auto',
    phone_number_collection: { enabled: true },
    allow_promotion_codes: true
  };
  const email = quote.customerEmail || quote.metadata?.customerEmail || user.email;
  if (validEmail(email)) params.customer_email = email;
  if (mode === 'subscription') params.subscription_data = { metadata };
  else {
    params.payment_intent_data = { metadata };
    params.invoice_creation = { enabled: true, invoice_data: { metadata } };
  }
  return stripe().checkout.sessions.create(params, { idempotencyKey: `marketplace_quote_${quote.id}_${mode}` });
}

async function createInvoiceCheckout(invoice, user) {
  const lines = (Array.isArray(invoice.lineItems) ? invoice.lineItems : []).map((item, index) => {
    const quantity = Math.max(1, int(item.quantity, 1));
    const amountCents = cents(item.amountCents || item.totalCents);
    return {
      serviceId: item.serviceId || '',
      serviceName: item.title || item.serviceName || `Invoice item ${index + 1}`,
      description: item.description || '',
      quantity,
      amountCents,
      unitAmountCents: cents(item.unitAmountCents || Math.round(amountCents / quantity))
    };
  }).filter((item) => item.amountCents > 0);
  if (!lines.length || cents(invoice.balanceDueCents || invoice.totalCents) <= 0) throw new HttpsError('failed-precondition', 'This invoice has no balance due.');
  const metadata = { invoiceId: invoice.id, quoteId: invoice.quoteId || '', subscriptionId: invoice.subscriptionId || '', customerId: user.uid, companyId: invoice.companyId || '' };
  const params = {
    mode: 'payment',
    client_reference_id: invoice.id,
    line_items: checkoutLines(lines, 'payment'),
    success_url: `${baseUrl()}/customer-commerce.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl()}/customer-commerce.html?checkout=cancelled&invoiceId=${encodeURIComponent(invoice.id)}`,
    metadata,
    payment_intent_data: { metadata },
    invoice_creation: { enabled: true, invoice_data: { metadata } },
    expires_at: Math.floor((Date.now() + HOLD_MS) / 1000)
  };
  if (validEmail(invoice.customerEmail || user.email)) params.customer_email = invoice.customerEmail || user.email;
  return stripe().checkout.sessions.create(params, { idempotencyKey: `marketplace_invoice_${invoice.id}_${Math.floor(Date.now() / HOLD_MS)}` });
}

async function releaseReservation(transaction, ref, reservation, reason) {
  if (!reservation || norm(reservation.status) !== 'held') return;
  if (reservation.slotId) {
    const slotRef = db.doc(`appointment_slots/${reservation.slotId}`);
    const slotSnap = await transaction.get(slotRef);
    if (slotSnap.exists) {
      transaction.set(slotRef, stamp({ reservedCount: Math.max(0, int(slotSnap.data()?.reservedCount) - 1) }), { merge: true });
    }
  }
  transaction.set(ref, stamp({ status: 'released', releaseReason: reason, releasedAtMs: Date.now() }), { merge: true });
}

exports.acceptMarketplaceQuote = onCall(callableOptions(), async (request) => {
  const user = await actor(request);
  const quoteId = text(request.data?.quoteId, 180);
  if (!quoteId) throw new HttpsError('invalid-argument', 'quoteId is required.');
  const wantsSubscription = Boolean(request.data?.subscription);
  const interval = intervalFor(request.data?.interval);
  const quoteRef = db.doc(`quotes/${quoteId}`);
  let invoiceRef = null;
  let subscriptionRef = null;
  let orderRef = null;
  let reservationRef = null;

  const activation = await db.runTransaction(async (transaction) => {
    const quoteSnap = await transaction.get(quoteRef);
    if (!quoteSnap.exists) throw new HttpsError('not-found', 'Quote not found.');
    const quote = { id: quoteSnap.id, ...quoteSnap.data() };
    if (!owns(quote, user.uid)) throw new HttpsError('permission-denied', 'This quote does not belong to your account.');
    if (Number(quote.expiresAtMs || 0) > 0 && Number(quote.expiresAtMs) <= Date.now()) throw new HttpsError('failed-precondition', 'This quote has expired.');
    const status = norm(quote.status || 'draft');
    const alreadyAccepted = quote.customerAcceptanceStatus === 'accepted' && quote.invoiceId;
    if (!alreadyAccepted && !ACCEPTABLE_QUOTES.has(status) && !(status === 'draft' && quote.customerVisible === true)) {
      throw new HttpsError('failed-precondition', 'This quote is not awaiting customer acceptance.');
    }

    const lines = quoteLines(quote);
    const totalCents = totalFor(quote, lines);
    if (!lines.length || totalCents <= 0) throw new HttpsError('failed-precondition', 'This quote has no payable items.');

    invoiceRef = db.doc(`invoices/${text(quote.invoiceId, 180) || idFor('invoice', quoteId)}`);
    subscriptionRef = wantsSubscription
      ? db.doc(`subscriptions/${text(quote.subscriptionId, 180) || idFor('subscription', quoteId)}`)
      : null;
    orderRef = db.doc(`jobs/${text(quote.orderId, 180) || idFor('order', quoteId)}`);
    reservationRef = db.doc(`appointment_reservations/${text(quote.appointmentReservationId, 180) || idFor('reservation', quoteId)}`);

    const scheduledAtMs = scheduleFor(quote);
    const companyRef = quote.companyId ? db.doc(`companies/${quote.companyId}`) : null;
    const slotRef = scheduledAtMs ? db.doc(`appointment_slots/${idFor('slot', `${quote.companyId}|${scheduledAtMs}`)}`) : null;

    const [invoiceSnap, orderSnap, reservationSnap, subscriptionSnap, companySnap, slotSnap] = await Promise.all([
      transaction.get(invoiceRef),
      transaction.get(orderRef),
      transaction.get(reservationRef),
      subscriptionRef ? transaction.get(subscriptionRef) : Promise.resolve(null),
      companyRef ? transaction.get(companyRef) : Promise.resolve(null),
      slotRef ? transaction.get(slotRef) : Promise.resolve(null)
    ]);

    const company = companySnap?.exists ? companySnap.data() || {} : {};
    const storedReservation = reservationSnap.exists ? { id: reservationSnap.id, ...reservationSnap.data() } : null;
    const reservationStatus = norm(storedReservation?.status);
    const reservationActive = reservationStatus === 'confirmed' || (
      reservationStatus === 'held' && Number(storedReservation?.expiresAtMs || 0) > Date.now()
    );
    let reservation = reservationActive ? storedReservation : null;
    if (scheduledAtMs && !reservation) {
      const slot = slotSnap?.exists ? slotSnap.data() || {} : {};
      const capacity = Math.max(1, int(quote.slotCapacity || quote.metadata?.slotCapacity || company.bookingConfig?.defaultSlotCapacity || company.defaultSlotCapacity, 1));
      const reservedCount = Math.max(0, int(slot.reservedCount));
      if (reservedCount >= capacity) throw new HttpsError('resource-exhausted', 'That appointment time is no longer available.');
      reservation = {
        id: reservationRef.id,
        slotId: slotRef.id,
        quoteId,
        orderId: orderRef.id,
        invoiceId: invoiceRef.id,
        subscriptionId: subscriptionRef?.id || '',
        companyId: quote.companyId || '',
        customerId: user.uid,
        scheduledAtMs,
        durationMinutes: durationFor(quote, lines),
        status: 'held',
        capacity,
        expiresAtMs: Date.now() + HOLD_MS,
        createdAtMs: Date.now(),
        createdAt: FieldValue.serverTimestamp()
      };
      transaction.set(slotRef, stamp({ id: slotRef.id, companyId: quote.companyId || '', scheduledAtMs, capacity, reservedCount: reservedCount + 1 }), { merge: true });
      transaction.set(reservationRef, stamp(reservation), { merge: true });
    }

    const existingInvoice = invoiceSnap.exists ? { id: invoiceSnap.id, ...invoiceSnap.data() } : null;
    const reusableCheckout = Boolean(
      existingInvoice?.paymentUrl &&
      existingInvoice?.stripeSessionId &&
      ['checkout_ready', 'processing'].includes(norm(existingInvoice.paymentStatus)) &&
      (!scheduledAtMs || reservationActive)
    );
    const invoice = existingInvoice ? {
      ...existingInvoice,
      status: norm(existingInvoice.status) === 'paid' ? 'paid' : 'sent',
      paymentStatus: reusableCheckout ? existingInvoice.paymentStatus : 'checkout_pending',
      paymentUrl: reusableCheckout ? existingInvoice.paymentUrl : '',
      stripeSessionId: reusableCheckout ? existingInvoice.stripeSessionId : '',
      checkoutStatus: reusableCheckout ? existingInvoice.checkoutStatus : 'pending',
      appointmentReservationId: reservation?.id || existingInvoice.appointmentReservationId || ''
    } : {
      id: invoiceRef.id,
      invoiceNumber: invoiceNumber(quoteId),
      quoteId,
      companyId: quote.companyId || '',
      companyName: quote.companyName || '',
      customerId: user.uid,
      customerUid: user.uid,
      customerName: quote.customerName || user.name,
      customerEmail: quote.customerEmail || quote.metadata?.customerEmail || user.email,
      status: 'sent',
      paymentStatus: 'checkout_pending',
      lineItems: lines.map((item) => ({ id: item.id, title: item.serviceName, description: item.description, quantity: item.quantity, unitAmountCents: item.unitAmountCents, amountCents: item.amountCents, serviceId: item.serviceId, metadata: item.metadata })),
      subtotalCents: totalCents,
      discountCents: cents(quote.discountCents),
      taxCents: cents(quote.taxCents),
      feeCents: cents(quote.feeCents),
      paidCents: 0,
      totalCents,
      balanceDueCents: totalCents,
      issuedAtMs: Date.now(),
      dueAtMs: Date.now() + (7 * 24 * 60 * 60 * 1000),
      appointmentReservationId: reservation?.id || '',
      createdAtMs: Date.now(),
      createdAt: FieldValue.serverTimestamp(),
      metadata: { source: 'customer_quote_acceptance', quoteId }
    };

    const subscription = subscriptionRef ? (subscriptionSnap?.exists ? { id: subscriptionSnap.id, ...subscriptionSnap.data() } : {
      id: subscriptionRef.id,
      quoteId,
      companyId: quote.companyId || '',
      companyName: quote.companyName || '',
      customerId: user.uid,
      customerUid: user.uid,
      customerName: quote.customerName || user.name,
      customerEmail: quote.customerEmail || quote.metadata?.customerEmail || user.email,
      status: 'draft',
      paymentStatus: 'checkout_pending',
      interval,
      termMonths: Math.max(1, int(request.data?.termMonths || quote.metadata?.termMonths, 12)),
      amountCents: totalCents,
      lineItems: lines,
      startAtMs: scheduledAtMs || Date.now(),
      appointmentReservationId: reservation?.id || '',
      createdAtMs: Date.now(),
      createdAt: FieldValue.serverTimestamp(),
      metadata: { source: 'customer_quote_acceptance', quoteId }
    }) : null;

    const order = orderSnap.exists ? { id: orderSnap.id, ...orderSnap.data() } : {
      id: orderRef.id,
      orderId: orderRef.id,
      quoteId,
      invoiceId: invoiceRef.id,
      subscriptionId: subscriptionRef?.id || '',
      appointmentReservationId: reservation?.id || '',
      companyId: quote.companyId || '',
      companyName: quote.companyName || '',
      vendorCompanyId: quote.companyId || '',
      vendorCompanyName: quote.companyName || '',
      customerId: user.uid,
      customerUid: user.uid,
      customerName: quote.customerName || user.name,
      customerEmail: quote.customerEmail || quote.metadata?.customerEmail || user.email,
      service: lines[0]?.serviceName || 'Marketplace service',
      serviceName: lines[0]?.serviceName || 'Marketplace service',
      serviceNames: lines.map((item) => item.serviceName),
      serviceIds: lines.map((item) => item.serviceId).filter(Boolean),
      lineItems: lines,
      totalCents,
      currency: 'usd',
      status: scheduledAtMs ? 'awaiting_payment' : 'dispatch_review',
      scheduleStatus: scheduledAtMs ? 'reserved_pending_payment' : 'needs_scheduling',
      scheduledAtMs,
      scheduledAt: scheduledAtMs ? new Date(scheduledAtMs).toISOString() : '',
      scheduledFor: scheduledAtMs ? new Date(scheduledAtMs).toISOString() : '',
      paymentStatus: 'checkout_pending',
      vendorAcceptanceStatus: 'pending',
      source: 'customer_quote_acceptance',
      createdAtMs: Date.now(),
      createdAt: FieldValue.serverTimestamp()
    };

    transaction.set(invoiceRef, stamp(invoice), { merge: true });
    if (subscriptionRef) transaction.set(subscriptionRef, stamp(subscription), { merge: true });
    transaction.set(orderRef, stamp(order), { merge: true });
    transaction.set(quoteRef, stamp({ status: 'approved', customerAcceptanceStatus: 'accepted', customerAcceptedAtMs: Date.now(), customerAcceptedBy: user.uid, invoiceId: invoiceRef.id, subscriptionId: subscriptionRef?.id || '', orderId: orderRef.id, appointmentReservationId: reservation?.id || '', paymentStatus: 'checkout_pending' }), { merge: true });
    return { quote, invoice, subscription, reservation, order };
  });

  if (activation.invoice.paymentUrl && activation.invoice.stripeSessionId) {
    return { quoteId, invoiceId: activation.invoice.id, subscriptionId: activation.subscription?.id || '', orderId: activation.order.id, reservationId: activation.reservation?.id || '', checkoutUrl: activation.invoice.paymentUrl, reused: true };
  }

  try {
    const session = await createQuoteCheckout({ ...activation, user });
    const patch = stamp({ stripeSessionId: session.id, paymentUrl: session.url || '', checkoutStatus: session.status || 'open', checkoutExpiresAtMs: Number(session.expires_at || 0) * 1000, paymentStatus: 'checkout_ready' });
    const batch = db.batch();
    batch.set(invoiceRef, patch, { merge: true });
    batch.set(quoteRef, patch, { merge: true });
    batch.set(orderRef, stamp({ stripeSessionId: session.id, checkoutStatus: session.status || 'open', paymentStatus: 'checkout_ready' }), { merge: true });
    if (subscriptionRef) batch.set(subscriptionRef, patch, { merge: true });
    if (activation.reservation) batch.set(reservationRef, stamp({ stripeSessionId: session.id, status: 'held' }), { merge: true });
    batch.set(db.doc(`stripe_sessions/${session.id}`), stamp({
      id: session.id,
      providerSessionId: session.id,
      status: session.status || 'open',
      paymentStatus: session.payment_status || 'unpaid',
      mode: session.mode,
      checkoutUrl: session.url || '',
      quoteId,
      invoiceId: invoiceRef.id,
      subscriptionId: subscriptionRef?.id || '',
      reservationId: activation.reservation?.id || '',
      orderId: orderRef.id,
      customerId: user.uid,
      companyId: activation.quote.companyId || '',
      amountCents: totalFor(activation.quote),
      currency: 'usd',
      expiresAtMs: Number(session.expires_at || 0) * 1000,
      createdAtMs: Date.now(),
      createdAt: FieldValue.serverTimestamp()
    }), { merge: true });
    await batch.commit();
    return { quoteId, invoiceId: invoiceRef.id, subscriptionId: subscriptionRef?.id || '', orderId: orderRef.id, reservationId: activation.reservation?.id || '', checkoutUrl: session.url || '', stripeSessionId: session.id, reused: false };
  } catch (error) {
    await Promise.allSettled([
      invoiceRef.set(stamp({ paymentStatus: 'checkout_creation_failed', checkoutError: text(error.message) }), { merge: true }),
      quoteRef.set(stamp({ paymentStatus: 'checkout_creation_failed', checkoutError: text(error.message) }), { merge: true }),
      orderRef.set(stamp({ paymentStatus: 'checkout_creation_failed' }), { merge: true })
    ]);
    if (error instanceof HttpsError) throw error;
    console.error('Marketplace checkout creation failed:', error);
    throw new HttpsError('internal', 'Checkout could not be created.');
  }
});

exports.rejectMarketplaceQuote = onCall({ region: REGION, enforceAppCheck: true, cors: true }, async (request) => {
  const user = await actor(request);
  const quoteId = text(request.data?.quoteId, 180);
  if (!quoteId) throw new HttpsError('invalid-argument', 'quoteId is required.');
  const ref = db.doc(`quotes/${quoteId}`);
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Quote not found.');
    const quote = snap.data() || {};
    if (!owns(quote, user.uid)) throw new HttpsError('permission-denied', 'This quote does not belong to your account.');
    if (quote.customerAcceptanceStatus === 'accepted') throw new HttpsError('failed-precondition', 'An accepted quote cannot be declined here.');
    transaction.set(ref, stamp({ status: 'rejected', customerAcceptanceStatus: 'rejected', customerRejectedAtMs: Date.now(), customerRejectedBy: user.uid, customerRejectionReason: text(request.data?.reason) }), { merge: true });
  });
  return { quoteId, status: 'rejected' };
});

exports.createMarketplaceInvoiceCheckout = onCall(callableOptions(), async (request) => {
  const user = await actor(request);
  const invoiceId = text(request.data?.invoiceId, 180);
  if (!invoiceId) throw new HttpsError('invalid-argument', 'invoiceId is required.');
  const ref = db.doc(`invoices/${invoiceId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Invoice not found.');
  const invoice = { id: snap.id, ...snap.data() };
  if (!owns(invoice, user.uid)) throw new HttpsError('permission-denied', 'This invoice does not belong to your account.');
  if (['paid', 'void', 'uncollectible'].includes(norm(invoice.status))) throw new HttpsError('failed-precondition', 'This invoice cannot be paid.');
  const reusableCheckout = Boolean(
    invoice.paymentUrl &&
    invoice.stripeSessionId &&
    norm(invoice.checkoutStatus) !== 'expired' &&
    !['expired', 'failed'].includes(norm(invoice.paymentStatus)) &&
    (!invoice.checkoutExpiresAtMs || Number(invoice.checkoutExpiresAtMs) > Date.now())
  );
  if (reusableCheckout) return { invoiceId, checkoutUrl: invoice.paymentUrl, stripeSessionId: invoice.stripeSessionId, reused: true };
  const session = await createInvoiceCheckout(invoice, user);
  const batch = db.batch();
  batch.set(ref, stamp({ paymentUrl: session.url || '', stripeSessionId: session.id, checkoutStatus: session.status || 'open', checkoutExpiresAtMs: Number(session.expires_at || 0) * 1000, paymentStatus: 'checkout_ready' }), { merge: true });
  batch.set(db.doc(`stripe_sessions/${session.id}`), stamp({ id: session.id, providerSessionId: session.id, status: session.status || 'open', paymentStatus: session.payment_status || 'unpaid', mode: 'payment', checkoutUrl: session.url || '', invoiceId, quoteId: invoice.quoteId || '', subscriptionId: invoice.subscriptionId || '', customerId: user.uid, companyId: invoice.companyId || '', amountCents: cents(invoice.balanceDueCents || invoice.totalCents), currency: 'usd', expiresAtMs: Number(session.expires_at || 0) * 1000, createdAtMs: Date.now(), createdAt: FieldValue.serverTimestamp() }), { merge: true });
  await batch.commit();
  return { invoiceId, checkoutUrl: session.url || '', stripeSessionId: session.id, reused: false };
});

exports.manageMarketplaceSubscription = onCall(callableOptions(), async (request) => {
  const user = await actor(request);
  const subscriptionId = text(request.data?.subscriptionId, 180);
  const action = norm(request.data?.action);
  if (!subscriptionId || !['pause', 'resume', 'cancel'].includes(action)) throw new HttpsError('invalid-argument', 'A valid subscriptionId and action are required.');
  const ref = db.doc(`subscriptions/${subscriptionId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Subscription not found.');
  const subscription = { id: snap.id, ...snap.data() };
  if (!owns(subscription, user.uid)) throw new HttpsError('permission-denied', 'This subscription does not belong to your account.');
  if (!subscription.providerSubscriptionId) throw new HttpsError('failed-precondition', 'The Stripe subscription is not active yet.');
  let provider;
  let patch;
  if (action === 'pause') {
    provider = await stripe().subscriptions.update(subscription.providerSubscriptionId, { pause_collection: { behavior: 'void' } });
    patch = { status: 'paused', pausedAtMs: Date.now(), pauseReason: 'Customer requested pause' };
  } else if (action === 'resume') {
    provider = await stripe().subscriptions.update(subscription.providerSubscriptionId, { pause_collection: '' });
    patch = { status: 'active', resumedAtMs: Date.now(), pauseReason: '' };
  } else {
    provider = await stripe().subscriptions.update(subscription.providerSubscriptionId, { cancel_at_period_end: true });
    patch = { cancelAtPeriodEnd: true, cancellationRequestedAtMs: Date.now(), cancelReason: text(request.data?.reason || 'Customer requested cancellation') };
  }
  await ref.set(stamp({ ...patch, providerStatus: provider.status, currentPeriodEndMs: Number(provider.current_period_end || 0) * 1000 }), { merge: true });
  return { subscriptionId, action, status: patch.status || subscription.status, cancelAtPeriodEnd: Boolean(patch.cancelAtPeriodEnd) };
});

exports.vendorRespondMarketplaceOrder = onCall({ region: REGION, enforceAppCheck: true, cors: true }, async (request) => {
  const user = await actor(request);
  const orderId = text(request.data?.orderId, 180);
  const action = norm(request.data?.action);
  if (!orderId || !['accept', 'reject'].includes(action)) throw new HttpsError('invalid-argument', 'A valid orderId and action are required.');
  if (!VENDOR_ROLES.has(user.role)) throw new HttpsError('permission-denied', 'Your role cannot respond to Marketplace orders.');
  const ref = db.doc(`jobs/${orderId}`);
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Order not found.');
    const order = snap.data() || {};
    const platform = ['owner', 'super_admin', 'admin'].includes(user.role);
    if (!platform && (!user.companyId || String(order.companyId || '') !== user.companyId)) throw new HttpsError('permission-denied', 'This order belongs to another company.');
    const patch = action === 'accept'
      ? { vendorAcceptanceStatus: 'accepted', vendorAcceptedAtMs: Date.now(), vendorAcceptedBy: user.uid, vendorAcceptedByName: user.name, status: order.paymentStatus === 'paid' ? (order.scheduledAtMs ? 'scheduled' : 'dispatch_review') : 'awaiting_payment' }
      : { vendorAcceptanceStatus: 'rejected', vendorRejectedAtMs: Date.now(), vendorRejectedBy: user.uid, vendorRejectedByName: user.name, vendorRejectionReason: text(request.data?.reason), needsReassignment: true, status: 'dispatch_review' };
    transaction.set(ref, stamp(patch), { merge: true });
  });
  return { orderId, vendorAcceptanceStatus: action === 'accept' ? 'accepted' : 'rejected' };
});

async function claimEvent(event) {
  const ref = db.doc(`stripe_webhook_events/${event.id}`);
  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (snap.exists && snap.data()?.processed === true) return false;
    transaction.set(ref, stamp({ id: event.id, type: event.type, livemode: Boolean(event.livemode), processing: true, processed: false, receivedAtMs: Date.now(), createdAt: FieldValue.serverTimestamp() }), { merge: true });
    return true;
  });
}

async function finishEvent(event, error = null) {
  await db.doc(`stripe_webhook_events/${event.id}`).set(stamp({ processing: false, processed: !error, processedAtMs: error ? 0 : Date.now(), error: error ? text(error.message || error, 1000) : '' }), { merge: true });
}

async function releaseReservationById(reservationId, reason) {
  if (!reservationId) return;
  const ref = db.doc(`appointment_reservations/${reservationId}`);
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) return;
    await releaseReservation(transaction, ref, snap.data() || {}, reason);
  });
}

async function localSubscription(providerSubscriptionId) {
  if (!providerSubscriptionId) return null;
  const snap = await db.collection('subscriptions').where('providerSubscriptionId', '==', providerSubscriptionId).limit(1).get();
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function checkoutSucceeded(session) {
  const metadata = session.metadata || {};
  const paid = ['paid', 'no_payment_required'].includes(norm(session.payment_status));
  const amountPaid = cents(session.amount_total || session.amount_subtotal);
  const batch = db.batch();
  batch.set(db.doc(`stripe_sessions/${session.id}`), stamp({ id: session.id, providerSessionId: session.id, status: session.status || 'complete', paymentStatus: session.payment_status || (paid ? 'paid' : 'unpaid'), providerPaymentIntentId: session.payment_intent || '', providerSubscriptionId: session.subscription || '', amountCents: amountPaid, customerId: metadata.customerId || '', companyId: metadata.companyId || '', quoteId: metadata.quoteId || '', invoiceId: metadata.invoiceId || '', subscriptionId: metadata.subscriptionId || '', reservationId: metadata.reservationId || '', orderId: metadata.orderId || '', completedAtMs: Date.now() }), { merge: true });
  if (metadata.invoiceId) batch.set(db.doc(`invoices/${metadata.invoiceId}`), stamp({ status: paid ? 'paid' : 'sent', paymentStatus: paid ? 'paid' : 'processing', paidCents: paid ? amountPaid : 0, balanceDueCents: paid ? 0 : amountPaid, paidAtMs: paid ? Date.now() : 0, providerPaymentIntentId: session.payment_intent || '', providerInvoiceId: session.invoice || '', stripeSessionId: session.id }), { merge: true });
  if (metadata.quoteId) batch.set(db.doc(`quotes/${metadata.quoteId}`), stamp({ paymentStatus: paid ? 'paid' : 'processing', checkoutStatus: 'completed', paidAtMs: paid ? Date.now() : 0, stripeSessionId: session.id }), { merge: true });
  if (metadata.subscriptionId) batch.set(db.doc(`subscriptions/${metadata.subscriptionId}`), stamp({ status: paid ? 'active' : 'draft', paymentStatus: paid ? 'paid' : 'processing', providerSubscriptionId: session.subscription || '', providerCustomerId: session.customer || '', activatedAtMs: paid ? Date.now() : 0 }), { merge: true });
  if (metadata.reservationId) batch.set(db.doc(`appointment_reservations/${metadata.reservationId}`), stamp({ status: paid ? 'confirmed' : 'held', confirmedAtMs: paid ? Date.now() : 0, stripeSessionId: session.id }), { merge: true });
  if (metadata.orderId) batch.set(db.doc(`jobs/${metadata.orderId}`), stamp({ paymentStatus: paid ? 'paid' : 'processing', status: paid ? 'scheduled' : 'awaiting_payment', scheduleStatus: paid ? 'confirmed' : 'reserved_pending_payment', vendorAcceptanceStatus: 'pending', stripeSessionId: session.id }), { merge: true });
  await batch.commit();
}

async function paymentFailed(object, metadata = {}) {
  const batch = db.batch();
  if (metadata.invoiceId) batch.set(db.doc(`invoices/${metadata.invoiceId}`), stamp({ status: 'past_due', paymentStatus: 'failed', paymentFailureCode: object.last_payment_error?.code || '', paymentFailureMessage: text(object.last_payment_error?.message || object.failure_message || 'Payment failed') }), { merge: true });
  if (metadata.quoteId) batch.set(db.doc(`quotes/${metadata.quoteId}`), stamp({ paymentStatus: 'failed' }), { merge: true });
  if (metadata.subscriptionId) batch.set(db.doc(`subscriptions/${metadata.subscriptionId}`), stamp({ status: 'past_due', paymentStatus: 'failed' }), { merge: true });
  if (metadata.orderId) batch.set(db.doc(`jobs/${metadata.orderId}`), stamp({ paymentStatus: 'failed', status: 'payment_failed', scheduleStatus: 'released' }), { merge: true });
  await batch.commit();
  await releaseReservationById(metadata.reservationId, 'payment_failed');
}

async function syncSubscription(object, eventType) {
  const metadata = object.metadata || {};
  const local = metadata.subscriptionId ? null : await localSubscription(object.id || object.subscription);
  const subscriptionId = metadata.subscriptionId || local?.id || '';
  if (!subscriptionId) return;
  const providerStatus = norm(object.status);
  let status = 'active';
  if (eventType === 'customer.subscription.deleted' || providerStatus === 'canceled') status = 'cancelled';
  else if (['past_due', 'unpaid'].includes(providerStatus)) status = 'past_due';
  else if (object.pause_collection) status = 'paused';
  await db.doc(`subscriptions/${subscriptionId}`).set(stamp({ status, providerStatus, providerSubscriptionId: object.id || object.subscription || local?.providerSubscriptionId || '', cancelAtPeriodEnd: Boolean(object.cancel_at_period_end), currentPeriodStartMs: Number(object.current_period_start || 0) * 1000, currentPeriodEndMs: Number(object.current_period_end || 0) * 1000, cancelledAtMs: status === 'cancelled' ? Date.now() : 0 }), { merge: true });
}

exports.stripeMarketplaceWebhook = onRequest({ region: REGION, secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] }, async (request, response) => {
  if (request.method !== 'POST') return response.status(405).send('Method Not Allowed');
  let event;
  try {
    const signature = request.headers['stripe-signature'];
    if (!signature) throw new Error('Missing Stripe signature.');
    event = stripe().webhooks.constructEvent(request.rawBody, signature, STRIPE_WEBHOOK_SECRET.value());
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error);
    return response.status(400).send('Invalid signature');
  }
  if (!(await claimEvent(event))) return response.status(200).json({ received: true, duplicate: true });
  try {
    const object = event.data?.object || {};
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) await checkoutSucceeded(object);
    else if (['checkout.session.async_payment_failed', 'payment_intent.payment_failed'].includes(event.type)) await paymentFailed(object, object.metadata || {});
    else if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) await syncSubscription(object, event.type);
    else if (event.type === 'invoice.payment_failed') {
      const local = await localSubscription(object.subscription || '');
      await paymentFailed(object, { ...(object.metadata || object.subscription_details?.metadata || {}), subscriptionId: object.metadata?.subscriptionId || local?.id || '' });
    } else if (event.type === 'invoice.paid') {
      const local = await localSubscription(object.subscription || '');
      if (local) await db.doc(`subscriptions/${local.id}`).set(stamp({ status: 'active', paymentStatus: 'paid', lastPaidAtMs: Date.now(), paidCycleCount: int(local.paidCycleCount) + 1, billingCycleCount: int(local.billingCycleCount) + 1, providerInvoiceId: object.id || '' }), { merge: true });
    }
    await finishEvent(event);
    return response.status(200).json({ received: true });
  } catch (error) {
    console.error('Stripe webhook processing failed:', error);
    await finishEvent(event, error);
    return response.status(500).json({ received: false });
  }
});

exports.releaseExpiredMarketplaceReservations = onSchedule({ schedule: 'every 15 minutes', region: REGION, timeZone: 'America/New_York' }, async () => {
  const snap = await db.collection('appointment_reservations').where('expiresAtMs', '<=', Date.now()).limit(100).get();
  for (const docSnap of snap.docs) {
    if (norm(docSnap.data()?.status) !== 'held') continue;
    await db.runTransaction(async (transaction) => {
      const freshSnap = await transaction.get(docSnap.ref);
      if (!freshSnap.exists) return;
      const reservation = freshSnap.data() || {};
      if (norm(reservation.status) !== 'held' || Number(reservation.expiresAtMs || 0) > Date.now()) return;
      await releaseReservation(transaction, docSnap.ref, reservation, 'checkout_expired');
      if (reservation.invoiceId) transaction.set(db.doc(`invoices/${reservation.invoiceId}`), stamp({ status: 'void', paymentStatus: 'expired', checkoutStatus: 'expired', paymentUrl: '', stripeSessionId: '', voidReason: 'Checkout reservation expired' }), { merge: true });
      if (reservation.quoteId) transaction.set(db.doc(`quotes/${reservation.quoteId}`), stamp({ paymentStatus: 'expired', checkoutStatus: 'expired', paymentUrl: '', stripeSessionId: '', acceptanceExpiredAtMs: Date.now() }), { merge: true });
      if (reservation.orderId) transaction.set(db.doc(`jobs/${reservation.orderId}`), stamp({ paymentStatus: 'expired', status: 'cancelled', scheduleStatus: 'released' }), { merge: true });
    });
  }
  return { scanned: snap.size };
});
