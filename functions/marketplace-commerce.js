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
const CHECKOUT_HOLD_MINUTES = 30;
const CUSTOMER_QUOTE_STATUSES = new Set(['pending', 'sent', 'viewed']);
const COMPANY_ROLES = new Set([
  'owner', 'super_admin', 'admin', 'manager', 'operations_manager',
  'operations_coordinator', 'field_manager', 'dispatcher', 'sales_manager',
  'sales', 'sales_rep'
]);

function normalize(value = '') {
  return String(value || '').trim().toLowerCase();
}

function cents(value = 0) {
  return Math.max(0, Math.round(Number(value || 0)));
}

function integer(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function safeString(value = '', max = 500) {
  return String(value || '').trim().slice(0, max);
}

function deterministicId(prefix, value) {
  const hash = crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 28);
  return `${prefix}_${hash}`;
}

function customerOwns(data = {}, uid = '') {
  return Boolean(uid) && [data.customerId, data.customerUid, data.userId, data.uid].some((value) => String(value || '') === uid);
}

function validEmail(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function stripeClient() {
  const key = STRIPE_SECRET_KEY.value();
  if (!key) throw new HttpsError('failed-precondition', 'Stripe is not configured.');
  return new Stripe(key, { apiVersion: '2024-12-18.acacia' });
}

function callableOptions(extra = {}) {
  return {
    region: REGION,
    enforceAppCheck: true,
    cors: true,
    secrets: [STRIPE_SECRET_KEY],
    ...extra
  };
}

async function requireUser(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to continue.');

  const profileSnap = await db.doc(`users/${uid}`).get();
  const profile = profileSnap.exists ? profileSnap.data() || {} : {};
  return {
    uid,
    email: request.auth.token?.email || profile.email || '',
    role: normalize(profile.role || request.auth.token?.role || 'customer'),
    companyId: safeString(profile.companyId),
    displayName: safeString(profile.displayName || profile.fullName || profile.name || request.auth.token?.name || request.auth.token?.email || 'Customer', 160),
    profile
  };
}

function quoteLineItems(quote = {}) {
  const rows = Array.isArray(quote.lineItems) ? quote.lineItems : [];
  return rows.map((item, index) => {
    const quantity = Math.max(1, integer(item.quantity, 1));
    const amountCents = cents(item.totalCents || item.amountCents || ((item.unitAmountCents || item.basePriceCents || 0) * quantity));
    return {
      id: safeString(item.id || `line_${index + 1}`, 120),
      serviceId: safeString(item.serviceId, 160),
      serviceName: safeString(item.serviceName || item.title || item.name || `Service ${index + 1}`, 160),
      description: safeString(item.description || '', 500),
      quantity,
      amountCents,
      unitAmountCents: cents(item.unitAmountCents || item.basePriceCents || Math.round(amountCents / quantity)),
      metadata: item.metadata || {}
    };
  }).filter((item) => item.amountCents > 0);
}

function quoteTotalCents(quote = {}, lineItems = quoteLineItems(quote)) {
  const explicit = cents(quote.totalCents);
  return explicit || lineItems.reduce((sum, item) => sum + item.amountCents, 0);
}

function quoteScheduleAtMs(quote = {}) {
  const metadata = quote.metadata || {};
  const candidates = [
    quote.scheduledAtMs,
    quote.requestedScheduleAtMs,
    quote.appointmentAtMs,
    metadata.scheduledAtMs,
    metadata.requestedScheduleAtMs,
    metadata.appointmentAtMs
  ];
  return candidates.map(Number).find((value) => Number.isFinite(value) && value > 0) || 0;
}

function quoteDurationMinutes(quote = {}) {
  const lines = Array.isArray(quote.lineItems) ? quote.lineItems : [];
  const lineDuration = lines.reduce((sum, item) => sum + Math.max(0, Number(item.estimatedDurationMinutes || 0)), 0);
  return Math.max(15, integer(quote.estimatedDurationMinutes || quote.metadata?.estimatedDurationMinutes || lineDuration, 60));
}

function normalizeSubscriptionInterval(value = 'monthly') {
  const interval = normalize(value);
  return ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'].includes(interval) ? interval : 'monthly';
}

function stripeRecurring(interval = 'monthly') {
  const normalized = normalizeSubscriptionInterval(interval);
  if (normalized === 'weekly') return { interval: 'week', interval_count: 1 };
  if (normalized === 'biweekly') return { interval: 'week', interval_count: 2 };
  if (normalized === 'quarterly') return { interval: 'month', interval_count: 3 };
  if (normalized === 'yearly') return { interval: 'year', interval_count: 1 };
  return { interval: 'month', interval_count: 1 };
}

function stripeLineItems(lines = [], mode = 'payment', interval = 'monthly') {
  return lines.map((item) => {
    const quantity = Math.max(1, integer(item.quantity, 1));
    const unitAmount = Math.max(1, cents(item.unitAmountCents || Math.round(item.amountCents / quantity)));
    const priceData = {
      currency: 'usd',
      unit_amount: unitAmount,
      product_data: {
        name: safeString(item.serviceName || 'Marketplace service', 120),
        description: safeString(item.description || '', 400) || undefined,
        metadata: item.serviceId ? { serviceId: safeString(item.serviceId, 160) } : undefined
      }
    };
    if (mode === 'subscription') priceData.recurring = stripeRecurring(interval);
    return { price_data: priceData, quantity };
  });
}

function invoiceNumber(quoteId = '') {
  const suffix = crypto.createHash('sha1').update(String(quoteId)).digest('hex').slice(0, 8).toUpperCase();
  return `EV-${new Date().getFullYear()}-${suffix}`;
}

function safeBaseUrl() {
  const configured = safeString(APP_BASE_URL.value(), 300);
  try {
    const url = new URL(configured);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new Error('Unsafe protocol');
    return url.origin;
  } catch {
    return 'https://evaraos-web.web.app';
  }
}

async function createCheckoutSession({ quote, invoice, subscription, reservation, order, user }) {
  const stripe = stripeClient();
  const mode = subscription ? 'subscription' : 'payment';
  const interval = subscription?.interval || 'monthly';
  const lines = quoteLineItems(quote);
  const amountCents = quoteTotalCents(quote, lines);
  if (!lines.length || amountCents <= 0) throw new HttpsError('failed-precondition', 'This quote has no payable line items.');

  const metadata = {
    quoteId: quote.id,
    invoiceId: invoice.id,
    subscriptionId: subscription?.id || '',
    reservationId: reservation?.id || '',
    orderId: order.id,
    customerId: user.uid,
    companyId: safeString(quote.companyId, 160)
  };

  const params = {
    mode,
    client_reference_id: quote.id,
    line_items: stripeLineItems(lines, mode, interval),
    success_url: `${safeBaseUrl()}/customer-commerce.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${safeBaseUrl()}/customer-commerce.html?checkout=cancelled&quoteId=${encodeURIComponent(quote.id)}`,
    metadata,
    expires_at: Math.floor(Date.now() / 1000) + (CHECKOUT_HOLD_MINUTES * 60),
    billing_address_collection: 'auto',
    phone_number_collection: { enabled: true },
    allow_promotion_codes: true
  };

  const customerEmail = quote.customerEmail || quote.metadata?.customerEmail || user.email;
  if (validEmail(customerEmail)) params.customer_email = customerEmail;

  if (mode === 'payment') {
    params.payment_intent_data = { metadata };
    params.invoice_creation = { enabled: true, invoice_data: { metadata } };
  } else {
    params.subscription_data = { metadata };
  }

  return stripe.checkout.sessions.create(params, {
    idempotencyKey: `marketplace_quote_${quote.id}_${mode}`
  });
}

async function createInvoiceCheckoutSession({ invoice, user }) {
  const stripe = stripeClient();
  const lines = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
  const normalizedLines = lines.map((item, index) => ({
    serviceId: item.serviceId || '',
    serviceName: item.title || item.serviceName || `Invoice item ${index + 1}`,
    description: item.description || '',
    quantity: Math.max(1, integer(item.quantity, 1)),
    amountCents: cents(item.amountCents || item.totalCents),
    unitAmountCents: cents(item.unitAmountCents || Math.round(cents(item.amountCents || item.totalCents) / Math.max(1, integer(item.quantity, 1))))
  })).filter((item) => item.amountCents > 0);

  if (!normalizedLines.length || cents(invoice.balanceDueCents || invoice.totalCents) <= 0) {
    throw new HttpsError('failed-precondition', 'This invoice has no balance due.');
  }

  const metadata = {
    invoiceId: invoice.id,
    quoteId: invoice.quoteId || '',
    subscriptionId: invoice.subscriptionId || '',
    customerId: user.uid,
    companyId: safeString(invoice.companyId, 160)
  };

  const params = {
    mode: 'payment',
    client_reference_id: invoice.id,
    line_items: stripeLineItems(normalizedLines, 'payment'),
    success_url: `${safeBaseUrl()}/customer-commerce.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${safeBaseUrl()}/customer-commerce.html?checkout=cancelled&invoiceId=${encodeURIComponent(invoice.id)}`,
    metadata,
    payment_intent_data: { metadata },
    invoice_creation: { enabled: true, invoice_data: { metadata } },
    expires_at: Math.floor(Date.now() / 1000) + (CHECKOUT_HOLD_MINUTES * 60)
  };

  const customerEmail = invoice.customerEmail || user.email;
  if (validEmail(customerEmail)) params.customer_email = customerEmail;

  return stripe.checkout.sessions.create(params, {
    idempotencyKey: `marketplace_invoice_${invoice.id}_${Date.now().toString().slice(0, 10)}`
  });
}

async function releaseReservationTransaction(transaction, reservationRef, reservation) {
  if (!reservation || !['held', 'payment_failed'].includes(normalize(reservation.status))) return;
  const slotRef = reservation.slotId ? db.doc(`appointment_slots/${reservation.slotId}`) : null;
  const slotSnap = slotRef ? await transaction.get(slotRef) : null;
  if (slotSnap?.exists) {
    const slot = slotSnap.data() || {};
    transaction.set(slotRef, {
      reservedCount: Math.max(0, integer(slot.reservedCount) - 1),
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }
  transaction.set(reservationRef, {
    status: 'released',
    releasedAtMs: Date.now(),
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
}

exports.acceptMarketplaceQuote = onCall(callableOptions(), async (request) => {
  const user = await requireUser(request);
  const quoteId = safeString(request.data?.quoteId, 180);
  if (!quoteId) throw new HttpsError('invalid-argument', 'quoteId is required.');

  const requestedSubscription = Boolean(request.data?.subscription);
  const subscriptionInterval = normalizeSubscriptionInterval(request.data?.interval || 'monthly');
  const quoteRef = db.doc(`quotes/${quoteId}`);
  const invoiceRef = db.doc(`invoices/${deterministicId('invoice', quoteId)}`);
  const subscriptionRef = requestedSubscription ? db.doc(`subscriptions/${deterministicId('subscription', quoteId)}`) : null;
  const orderRef = db.doc(`jobs/${deterministicId('order', quoteId)}`);
  const reservationRef = db.doc(`appointment_reservations/${deterministicId('reservation', quoteId)}`);

  const activation = await db.runTransaction(async (transaction) => {
    const quoteSnap = await transaction.get(quoteRef);
    if (!quoteSnap.exists) throw new HttpsError('not-found', 'Quote not found.');

    const quote = { id: quoteSnap.id, ...quoteSnap.data() };
    if (!customerOwns(quote, user.uid)) throw new HttpsError('permission-denied', 'This quote does not belong to your account.');
    if (Number(quote.expiresAtMs || 0) > 0 && Number(quote.expiresAtMs) <= Date.now()) {
      throw new HttpsError('failed-precondition', 'This quote has expired.');
    }

    const status = normalize(quote.status || 'draft');
    const customerVisibleDraft = status === 'draft' && quote.customerVisible === true;
    const alreadyAccepted = quote.customerAcceptanceStatus === 'accepted' && quote.invoiceId;
    if (!alreadyAccepted && !CUSTOMER_QUOTE_STATUSES.has(status) && !customerVisibleDraft) {
      throw new HttpsError('failed-precondition', 'This quote is not awaiting customer acceptance.');
    }

    const lines = quoteLineItems(quote);
    const totalCents = quoteTotalCents(quote, lines);
    if (!lines.length || totalCents <= 0) throw new HttpsError('failed-precondition', 'This quote has no payable items.');

    const invoiceSnap = await transaction.get(invoiceRef);
    const orderSnap = await transaction.get(orderRef);
    const reservationSnap = await transaction.get(reservationRef);
    const scheduledAtMs = quoteScheduleAtMs(quote);
    const companyRef = quote.companyId ? db.doc(`companies/${quote.companyId}`) : null;
    const companySnap = companyRef ? await transaction.get(companyRef) : null;
    const company = companySnap?.exists ? companySnap.data() || {} : {};

    let reservation = reservationSnap.exists ? { id: reservationSnap.id, ...reservationSnap.data() } : null;
    if (scheduledAtMs && !reservation) {
      const slotId = deterministicId('slot', `${quote.companyId}|${scheduledAtMs}`);
      const slotRef = db.doc(`appointment_slots/${slotId}`);
      const slotSnap = await transaction.get(slotRef);
      const slot = slotSnap.exists ? slotSnap.data() || {} : {};
      const capacity = Math.max(1, integer(
        quote.slotCapacity ||
        quote.metadata?.slotCapacity ||
        company.bookingConfig?.defaultSlotCapacity ||
        company.defaultSlotCapacity ||
        1,
        1
      ));
      const reservedCount = Math.max(0, integer(slot.reservedCount));
      if (reservedCount >= capacity) throw new HttpsError('resource-exhausted', 'That appointment time is no longer available.');

      reservation = {
        id: reservationRef.id,
        slotId,
        quoteId,
        orderId: orderRef.id,
        invoiceId: invoiceRef.id,
        subscriptionId: subscriptionRef?.id || '',
        companyId: quote.companyId || '',
        customerId: user.uid,
        scheduledAtMs,
        durationMinutes: quoteDurationMinutes(quote),
        status: 'held',
        capacity,
        expiresAtMs: Date.now() + (CHECKOUT_HOLD_MINUTES * 60 * 1000),
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };

      transaction.set(slotRef, {
        id: slotId,
        companyId: quote.companyId || '',
        scheduledAtMs,
        capacity,
        reservedCount: reservedCount + 1,
        updatedAtMs: Date.now(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      transaction.set(reservationRef, reservation, { merge: true });
    }

    const invoice = invoiceSnap.exists ? { id: invoiceSnap.id, ...invoiceSnap.data() } : {
      id: invoiceRef.id,
      invoiceNumber: invoiceNumber(quoteId),
      quoteId,
      companyId: quote.companyId || '',
      companyName: quote.companyName || '',
      customerId: user.uid,
      customerUid: user.uid,
      customerName: quote.customerName || user.displayName,
      customerEmail: quote.customerEmail || quote.metadata?.customerEmail || user.email,
      status: 'sent',
      paymentStatus: 'checkout_pending',
      lineItems: lines.map((item) => ({
        id: item.id,
        title: item.serviceName,
        description: item.description,
        quantity: item.quantity,
        unitAmountCents: item.unitAmountCents,
        amountCents: item.amountCents,
        serviceId: item.serviceId,
        metadata: item.metadata
      })),
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
      updatedAtMs: Date.now(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      metadata: { source: 'customer_quote_acceptance', quoteId }
    };

    let subscription = null;
    if (subscriptionRef) {
      const subscriptionSnap = await transaction.get(subscriptionRef);
      subscription = subscriptionSnap.exists ? { id: subscriptionSnap.id, ...subscriptionSnap.data() } : {
        id: subscriptionRef.id,
        quoteId,
        companyId: quote.companyId || '',
        companyName: quote.companyName || '',
        customerId: user.uid,
        customerUid: user.uid,
        customerName: quote.customerName || user.displayName,
        customerEmail: quote.customerEmail || quote.metadata?.customerEmail || user.email,
        status: 'draft',
        paymentStatus: 'checkout_pending',
        interval: subscriptionInterval,
        termMonths: Math.max(1, integer(request.data?.termMonths || quote.metadata?.termMonths, 12)),
        amountCents: totalCents,
        lineItems: lines,
        startAtMs: scheduledAtMs || Date.now(),
        appointmentReservationId: reservation?.id || '',
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        metadata: { source: 'customer_quote_acceptance', quoteId }
      };
      transaction.set(subscriptionRef, subscription, { merge: true });
    }

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
      customerName: quote.customerName || user.displayName,
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
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      source: 'customer_quote_acceptance'
    };

    transaction.set(invoiceRef, invoice, { merge: true });
    transaction.set(orderRef, order, { merge: true });
    transaction.set(quoteRef, {
      status: 'approved',
      customerAcceptanceStatus: 'accepted',
      customerAcceptedAtMs: Date.now(),
      customerAcceptedBy: user.uid,
      invoiceId: invoiceRef.id,
      subscriptionId: subscriptionRef?.id || '',
      orderId: orderRef.id,
      appointmentReservationId: reservation?.id || '',
      paymentStatus: 'checkout_pending',
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return { quote, invoice, subscription, reservation, order, alreadyAccepted };
  });

  try {
    if (activation.invoice.paymentUrl && activation.invoice.stripeSessionId) {
      return {
        quoteId,
        invoiceId: activation.invoice.id,
        subscriptionId: activation.subscription?.id || '',
        orderId: activation.order.id,
        reservationId: activation.reservation?.id || '',
        checkoutUrl: activation.invoice.paymentUrl,
        reused: true
      };
    }

    const session = await createCheckoutSession({ ...activation, user });
    const patch = {
      stripeSessionId: session.id,
      paymentUrl: session.url || '',
      checkoutStatus: session.status || 'open',
      paymentStatus: 'checkout_ready',
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp()
    };

    const batch = db.batch();
    batch.set(invoiceRef, patch, { merge: true });
    batch.set(quoteRef, {
      stripeSessionId: session.id,
      paymentUrl: session.url || '',
      checkoutStatus: session.status || 'open',
      paymentStatus: 'checkout_ready',
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    batch.set(orderRef, {
      stripeSessionId: session.id,
      checkoutStatus: session.status || 'open',
      paymentStatus: 'checkout_ready',
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    if (subscriptionRef) batch.set(subscriptionRef, patch, { merge: true });
    if (activation.reservation) batch.set(reservationRef, {
      stripeSessionId: session.id,
      status: 'held',
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    batch.set(db.doc(`stripe_sessions/${session.id}`), {
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
      amountCents: quoteTotalCents(activation.quote),
      currency: 'usd',
      expiresAtMs: Number(session.expires_at || 0) * 1000,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    await batch.commit();

    return {
      quoteId,
      invoiceId: invoiceRef.id,
      subscriptionId: subscriptionRef?.id || '',
      orderId: orderRef.id,
      reservationId: activation.reservation?.id || '',
      checkoutUrl: session.url || '',
      stripeSessionId: session.id,
      reused: false
    };
  } catch (error) {
    await Promise.allSettled([
      invoiceRef.set({ paymentStatus: 'checkout_creation_failed', checkoutError: safeString(error.message), updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
      quoteRef.set({ paymentStatus: 'checkout_creation_failed', checkoutError: safeString(error.message), updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
      orderRef.set({ paymentStatus: 'checkout_creation_failed', updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    ]);
    if (error instanceof HttpsError) throw error;
    console.error('Marketplace checkout creation failed:', error);
    throw new HttpsError('internal', 'Checkout could not be created.');
  }
});

exports.rejectMarketplaceQuote = onCall({ region: REGION, enforceAppCheck: true, cors: true }, async (request) => {
  const user = await requireUser(request);
  const quoteId = safeString(request.data?.quoteId, 180);
  if (!quoteId) throw new HttpsError('invalid-argument', 'quoteId is required.');
  const quoteRef = db.doc(`quotes/${quoteId}`);

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(quoteRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Quote not found.');
    const quote = snap.data() || {};
    if (!customerOwns(quote, user.uid)) throw new HttpsError('permission-denied', 'This quote does not belong to your account.');
    if (quote.customerAcceptanceStatus === 'accepted') throw new HttpsError('failed-precondition', 'An accepted quote cannot be declined here.');
    transaction.set(quoteRef, {
      status: 'rejected',
      customerAcceptanceStatus: 'rejected',
      customerRejectedAtMs: Date.now(),
      customerRejectedBy: user.uid,
      customerRejectionReason: safeString(request.data?.reason, 500),
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });

  return { quoteId, status: 'rejected' };
});

exports.createMarketplaceInvoiceCheckout = onCall(callableOptions(), async (request) => {
  const user = await requireUser(request);
  const invoiceId = safeString(request.data?.invoiceId, 180);
  if (!invoiceId) throw new HttpsError('invalid-argument', 'invoiceId is required.');
  const invoiceRef = db.doc(`invoices/${invoiceId}`);
  const snap = await invoiceRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Invoice not found.');
  const invoice = { id: snap.id, ...snap.data() };
  if (!customerOwns(invoice, user.uid)) throw new HttpsError('permission-denied', 'This invoice does not belong to your account.');
  if (['paid', 'void', 'uncollectible'].includes(normalize(invoice.status))) throw new HttpsError('failed-precondition', 'This invoice cannot be paid.');

  if (invoice.paymentUrl && invoice.stripeSessionId) {
    return { invoiceId, checkoutUrl: invoice.paymentUrl, stripeSessionId: invoice.stripeSessionId, reused: true };
  }

  const session = await createInvoiceCheckoutSession({ invoice, user });
  const batch = db.batch();
  batch.set(invoiceRef, {
    paymentUrl: session.url || '',
    stripeSessionId: session.id,
    checkoutStatus: session.status || 'open',
    paymentStatus: 'checkout_ready',
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  batch.set(db.doc(`stripe_sessions/${session.id}`), {
    id: session.id,
    providerSessionId: session.id,
    status: session.status || 'open',
    paymentStatus: session.payment_status || 'unpaid',
    mode: 'payment',
    checkoutUrl: session.url || '',
    invoiceId,
    quoteId: invoice.quoteId || '',
    subscriptionId: invoice.subscriptionId || '',
    customerId: user.uid,
    companyId: invoice.companyId || '',
    amountCents: cents(invoice.balanceDueCents || invoice.totalCents),
    currency: 'usd',
    expiresAtMs: Number(session.expires_at || 0) * 1000,
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  await batch.commit();

  return { invoiceId, checkoutUrl: session.url || '', stripeSessionId: session.id, reused: false };
});

exports.manageMarketplaceSubscription = onCall(callableOptions(), async (request) => {
  const user = await requireUser(request);
  const subscriptionId = safeString(request.data?.subscriptionId, 180);
  const action = normalize(request.data?.action);
  if (!subscriptionId || !['pause', 'resume', 'cancel'].includes(action)) {
    throw new HttpsError('invalid-argument', 'A valid subscriptionId and action are required.');
  }

  const ref = db.doc(`subscriptions/${subscriptionId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Subscription not found.');
  const subscription = { id: snap.id, ...snap.data() };
  if (!customerOwns(subscription, user.uid)) throw new HttpsError('permission-denied', 'This subscription does not belong to your account.');
  if (!subscription.providerSubscriptionId) throw new HttpsError('failed-precondition', 'The Stripe subscription is not active yet.');

  const stripe = stripeClient();
  let provider;
  let patch;
  if (action === 'pause') {
    provider = await stripe.subscriptions.update(subscription.providerSubscriptionId, {
      pause_collection: { behavior: 'void' }
    });
    patch = { status: 'paused', pausedAtMs: Date.now(), pauseReason: 'Customer requested pause' };
  } else if (action === 'resume') {
    provider = await stripe.subscriptions.update(subscription.providerSubscriptionId, {
      pause_collection: ''
    });
    patch = { status: 'active', resumedAtMs: Date.now(), pauseReason: '' };
  } else {
    provider = await stripe.subscriptions.update(subscription.providerSubscriptionId, {
      cancel_at_period_end: true
    });
    patch = {
      cancelAtPeriodEnd: true,
      cancellationRequestedAtMs: Date.now(),
      cancelReason: safeString(request.data?.reason || 'Customer requested cancellation', 500)
    };
  }

  await ref.set({
    ...patch,
    providerStatus: provider.status,
    currentPeriodEndMs: Number(provider.current_period_end || 0) * 1000,
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return { subscriptionId, action, status: patch.status || subscription.status, cancelAtPeriodEnd: Boolean(patch.cancelAtPeriodEnd) };
});

exports.vendorRespondMarketplaceOrder = onCall({ region: REGION, enforceAppCheck: true, cors: true }, async (request) => {
  const user = await requireUser(request);
  const orderId = safeString(request.data?.orderId, 180);
  const action = normalize(request.data?.action);
  if (!orderId || !['accept', 'reject'].includes(action)) throw new HttpsError('invalid-argument', 'A valid orderId and action are required.');
  if (!COMPANY_ROLES.has(user.role)) throw new HttpsError('permission-denied', 'Your role cannot respond to Marketplace orders.');

  const ref = db.doc(`jobs/${orderId}`);
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Order not found.');
    const order = snap.data() || {};
    const platformRole = ['owner', 'super_admin', 'admin'].includes(user.role);
    if (!platformRole && (!user.companyId || String(order.companyId || '') !== user.companyId)) {
      throw new HttpsError('permission-denied', 'This order belongs to another company.');
    }

    if (action === 'accept') {
      transaction.set(ref, {
        vendorAcceptanceStatus: 'accepted',
        vendorAcceptedAtMs: Date.now(),
        vendorAcceptedBy: user.uid,
        vendorAcceptedByName: user.displayName,
        status: order.paymentStatus === 'paid' ? (order.scheduledAtMs ? 'scheduled' : 'dispatch_review') : 'awaiting_payment',
        updatedAtMs: Date.now(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    } else {
      transaction.set(ref, {
        vendorAcceptanceStatus: 'rejected',
        vendorRejectedAtMs: Date.now(),
        vendorRejectedBy: user.uid,
        vendorRejectedByName: user.displayName,
        vendorRejectionReason: safeString(request.data?.reason, 500),
        needsReassignment: true,
        status: 'dispatch_review',
        updatedAtMs: Date.now(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
  });

  return { orderId, vendorAcceptanceStatus: action === 'accept' ? 'accepted' : 'rejected' };
});

async function claimWebhookEvent(event) {
  const ref = db.doc(`stripe_webhook_events/${event.id}`);
  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (snap.exists && snap.data()?.processed === true) return false;
    transaction.set(ref, {
      id: event.id,
      type: event.type,
      livemode: Boolean(event.livemode),
      processing: true,
      processed: false,
      receivedAtMs: Date.now(),
      updatedAtMs: Date.now(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return true;
  });
}

async function markWebhookProcessed(event, error = null) {
  await db.doc(`stripe_webhook_events/${event.id}`).set({
    processing: false,
    processed: !error,
    processedAtMs: error ? 0 : Date.now(),
    error: error ? safeString(error.message || error, 1000) : '',
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
}

async function releaseReservationById(reservationId, reason = 'payment_failed') {
  if (!reservationId) return;
  const ref = db.doc(`appointment_reservations/${reservationId}`);
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) return;
    const reservation = snap.data() || {};
    await releaseReservationTransaction(transaction, ref, reservation);
    transaction.set(ref, { releaseReason: reason }, { merge: true });
  });
}

async function subscriptionByProviderId(providerSubscriptionId) {
  if (!providerSubscriptionId) return null;
  const snap = await db.collection('subscriptions').where('providerSubscriptionId', '==', providerSubscriptionId).limit(1).get();
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function processCheckoutSuccess(session) {
  const metadata = session.metadata || {};
  const quoteId = metadata.quoteId || '';
  const invoiceId = metadata.invoiceId || '';
  const subscriptionId = metadata.subscriptionId || '';
  const reservationId = metadata.reservationId || '';
  const orderId = metadata.orderId || '';
  const amountPaid = cents(session.amount_total || session.amount_subtotal);
  const paid = ['paid', 'no_payment_required'].includes(normalize(session.payment_status));

  const batch = db.batch();
  batch.set(db.doc(`stripe_sessions/${session.id}`), {
    id: session.id,
    providerSessionId: session.id,
    status: session.status || 'complete',
    paymentStatus: session.payment_status || (paid ? 'paid' : 'unpaid'),
    providerPaymentIntentId: session.payment_intent || '',
    providerSubscriptionId: session.subscription || '',
    amountCents: amountPaid,
    customerId: metadata.customerId || '',
    companyId: metadata.companyId || '',
    quoteId,
    invoiceId,
    subscriptionId,
    reservationId,
    orderId,
    completedAtMs: Date.now(),
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  if (invoiceId) batch.set(db.doc(`invoices/${invoiceId}`), {
    status: paid ? 'paid' : 'sent',
    paymentStatus: paid ? 'paid' : 'processing',
    paidCents: paid ? amountPaid : 0,
    balanceDueCents: paid ? 0 : amountPaid,
    paidAtMs: paid ? Date.now() : 0,
    providerPaymentIntentId: session.payment_intent || '',
    providerInvoiceId: session.invoice || '',
    stripeSessionId: session.id,
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  if (quoteId) batch.set(db.doc(`quotes/${quoteId}`), {
    paymentStatus: paid ? 'paid' : 'processing',
    checkoutStatus: 'completed',
    paidAtMs: paid ? Date.now() : 0,
    stripeSessionId: session.id,
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  if (subscriptionId) batch.set(db.doc(`subscriptions/${subscriptionId}`), {
    status: paid ? 'active' : 'draft',
    paymentStatus: paid ? 'paid' : 'processing',
    providerSubscriptionId: session.subscription || '',
    providerCustomerId: session.customer || '',
    activatedAtMs: paid ? Date.now() : 0,
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  if (reservationId) batch.set(db.doc(`appointment_reservations/${reservationId}`), {
    status: paid ? 'confirmed' : 'held',
    confirmedAtMs: paid ? Date.now() : 0,
    stripeSessionId: session.id,
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  if (orderId) batch.set(db.doc(`jobs/${orderId}`), {
    paymentStatus: paid ? 'paid' : 'processing',
    status: paid ? 'scheduled' : 'awaiting_payment',
    scheduleStatus: paid ? 'confirmed' : 'reserved_pending_payment',
    vendorAcceptanceStatus: 'pending',
    stripeSessionId: session.id,
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  await batch.commit();
}

async function processPaymentFailure(object = {}, metadata = {}) {
  const invoiceId = metadata.invoiceId || '';
  const quoteId = metadata.quoteId || '';
  const subscriptionId = metadata.subscriptionId || '';
  const reservationId = metadata.reservationId || '';
  const orderId = metadata.orderId || '';
  const batch = db.batch();

  if (invoiceId) batch.set(db.doc(`invoices/${invoiceId}`), {
    status: 'past_due',
    paymentStatus: 'failed',
    paymentFailureCode: object.last_payment_error?.code || '',
    paymentFailureMessage: safeString(object.last_payment_error?.message || object.failure_message || 'Payment failed', 500),
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  if (quoteId) batch.set(db.doc(`quotes/${quoteId}`), { paymentStatus: 'failed', updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  if (subscriptionId) batch.set(db.doc(`subscriptions/${subscriptionId}`), { status: 'past_due', paymentStatus: 'failed', updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  if (orderId) batch.set(db.doc(`jobs/${orderId}`), { paymentStatus: 'failed', status: 'payment_failed', scheduleStatus: 'released', updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await batch.commit();
  await releaseReservationById(reservationId, 'payment_failed');
}

async function processSubscriptionEvent(object = {}, eventType = '') {
  const metadata = object.metadata || {};
  let subscriptionId = metadata.subscriptionId || '';
  let local = null;
  if (!subscriptionId) {
    local = await subscriptionByProviderId(object.id || object.subscription);
    subscriptionId = local?.id || '';
  }
  if (!subscriptionId) return;

  const providerStatus = normalize(object.status || '');
  let status = 'active';
  if (eventType === 'customer.subscription.deleted' || providerStatus === 'canceled') status = 'cancelled';
  else if (providerStatus === 'past_due' || providerStatus === 'unpaid') status = 'past_due';
  else if (object.pause_collection) status = 'paused';

  await db.doc(`subscriptions/${subscriptionId}`).set({
    status,
    providerStatus,
    providerSubscriptionId: object.id || object.subscription || local?.providerSubscriptionId || '',
    cancelAtPeriodEnd: Boolean(object.cancel_at_period_end),
    currentPeriodStartMs: Number(object.current_period_start || 0) * 1000,
    currentPeriodEndMs: Number(object.current_period_end || 0) * 1000,
    cancelledAtMs: status === 'cancelled' ? Date.now() : 0,
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
}

exports.stripeMarketplaceWebhook = onRequest({
  region: REGION,
  secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET]
}, async (request, response) => {
  if (request.method !== 'POST') {
    response.status(405).send('Method Not Allowed');
    return;
  }

  let event;
  try {
    const signature = request.headers['stripe-signature'];
    if (!signature) throw new Error('Missing Stripe signature.');
    event = stripeClient().webhooks.constructEvent(request.rawBody, signature, STRIPE_WEBHOOK_SECRET.value());
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error);
    response.status(400).send('Invalid signature');
    return;
  }

  const claimed = await claimWebhookEvent(event);
  if (!claimed) {
    response.status(200).json({ received: true, duplicate: true });
    return;
  }

  try {
    const object = event.data?.object || {};
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
      await processCheckoutSuccess(object);
    } else if (['checkout.session.async_payment_failed', 'payment_intent.payment_failed'].includes(event.type)) {
      await processPaymentFailure(object, object.metadata || {});
    } else if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
      await processSubscriptionEvent(object, event.type);
    } else if (event.type === 'invoice.payment_failed') {
      const metadata = object.metadata || object.subscription_details?.metadata || {};
      const providerSubscriptionId = object.subscription || '';
      const local = await subscriptionByProviderId(providerSubscriptionId);
      await processPaymentFailure(object, { ...metadata, subscriptionId: metadata.subscriptionId || local?.id || '' });
    } else if (event.type === 'invoice.paid') {
      const providerSubscriptionId = object.subscription || '';
      const local = await subscriptionByProviderId(providerSubscriptionId);
      if (local) {
        await db.doc(`subscriptions/${local.id}`).set({
          status: 'active',
          paymentStatus: 'paid',
          lastPaidAtMs: Date.now(),
          paidCycleCount: integer(local.paidCycleCount) + 1,
          billingCycleCount: integer(local.billingCycleCount) + 1,
          providerInvoiceId: object.id || '',
          updatedAtMs: Date.now(),
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }
    }

    await markWebhookProcessed(event);
    response.status(200).json({ received: true });
  } catch (error) {
    console.error('Stripe webhook processing failed:', error);
    await markWebhookProcessed(event, error);
    response.status(500).json({ received: false });
  }
});

exports.releaseExpiredMarketplaceReservations = onSchedule({
  schedule: 'every 15 minutes',
  region: REGION,
  timeZone: 'America/New_York'
}, async () => {
  const now = Date.now();
  const snap = await db.collection('appointment_reservations')
    .where('expiresAtMs', '<=', now)
    .limit(100)
    .get();

  for (const docSnap of snap.docs) {
    const reservation = { id: docSnap.id, ...docSnap.data() };
    if (normalize(reservation.status) !== 'held') continue;

    await db.runTransaction(async (transaction) => {
      const freshSnap = await transaction.get(docSnap.ref);
      if (!freshSnap.exists) return;
      const fresh = freshSnap.data() || {};
      if (normalize(fresh.status) !== 'held' || Number(fresh.expiresAtMs || 0) > Date.now()) return;
      await releaseReservationTransaction(transaction, docSnap.ref, fresh);
      if (fresh.invoiceId) transaction.set(db.doc(`invoices/${fresh.invoiceId}`), { status: 'void', paymentStatus: 'expired', voidReason: 'Checkout reservation expired', updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      if (fresh.quoteId) transaction.set(db.doc(`quotes/${fresh.quoteId}`), { paymentStatus: 'expired', checkoutStatus: 'expired', acceptanceExpiredAtMs: Date.now(), updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      if (fresh.orderId) transaction.set(db.doc(`jobs/${fresh.orderId}`), { paymentStatus: 'expired', status: 'cancelled', scheduleStatus: 'released', updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });
  }

  return { scanned: snap.size };
});
