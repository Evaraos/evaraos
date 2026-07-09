const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const REGION = 'us-central1';

function clean(value = '', max = 1000) {
  return String(value || '').slice(0, max);
}

function number(value = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function lineItems(rows = []) {
  return (Array.isArray(rows) ? rows : []).slice(0, 50).map((item = {}) => ({
    id: clean(item.id, 160),
    serviceId: clean(item.serviceId, 160),
    serviceName: clean(item.serviceName || item.title || item.name || 'Service', 180),
    title: clean(item.title || item.serviceName || item.name || 'Service', 180),
    description: clean(item.description, 500),
    quantity: Math.max(1, number(item.quantity) || 1),
    unitAmountCents: Math.max(0, number(item.unitAmountCents || item.basePriceCents)),
    amountCents: Math.max(0, number(item.amountCents || item.totalCents)),
    totalCents: Math.max(0, number(item.totalCents || item.amountCents)),
    estimatedDurationMinutes: Math.max(0, number(item.estimatedDurationMinutes)),
    recurringEligible: Boolean(item.recurringEligible || item.metadata?.recurringEligible),
    metadata: {
      recurringEligible: Boolean(item.metadata?.recurringEligible),
      category: clean(item.metadata?.category, 100)
    }
  }));
}

function quoteView(docSnap) {
  const row = docSnap.data() || {};
  return {
    id: docSnap.id,
    companyId: clean(row.companyId, 180),
    companyName: clean(row.companyName, 180),
    customerId: clean(row.customerId || row.customerUid, 180),
    status: clean(row.status, 60),
    customerAcceptanceStatus: clean(row.customerAcceptanceStatus, 60),
    paymentStatus: clean(row.paymentStatus, 60),
    checkoutStatus: clean(row.checkoutStatus, 60),
    totalCents: Math.max(0, number(row.totalCents)),
    subtotalCents: Math.max(0, number(row.subtotalCents)),
    discountCents: Math.max(0, number(row.discountCents)),
    taxCents: Math.max(0, number(row.taxCents)),
    feeCents: Math.max(0, number(row.feeCents)),
    lineItems: lineItems(row.lineItems),
    notes: clean(row.notes, 1000),
    expiresAtMs: number(row.expiresAtMs),
    requestedScheduleAtMs: number(row.requestedScheduleAtMs || row.scheduledAtMs || row.metadata?.requestedScheduleAtMs || row.metadata?.scheduledAtMs),
    customerVisible: Boolean(row.customerVisible),
    recurringEligible: Boolean(row.recurringEligible || row.subscriptionEligible || row.metadata?.recurringEligible || row.metadata?.subscriptionRequested),
    subscriptionInterval: clean(row.subscriptionInterval || row.metadata?.subscriptionInterval || 'monthly', 40),
    invoiceId: clean(row.invoiceId, 180),
    subscriptionId: clean(row.subscriptionId, 180),
    orderId: clean(row.orderId, 180),
    paymentUrl: clean(row.paymentUrl, 1000),
    createdAtMs: number(row.createdAtMs),
    updatedAtMs: number(row.updatedAtMs)
  };
}

function invoiceView(docSnap) {
  const row = docSnap.data() || {};
  return {
    id: docSnap.id,
    invoiceNumber: clean(row.invoiceNumber || docSnap.id, 180),
    quoteId: clean(row.quoteId, 180),
    subscriptionId: clean(row.subscriptionId, 180),
    companyId: clean(row.companyId, 180),
    companyName: clean(row.companyName, 180),
    status: clean(row.status, 60),
    paymentStatus: clean(row.paymentStatus, 60),
    totalCents: Math.max(0, number(row.totalCents)),
    paidCents: Math.max(0, number(row.paidCents)),
    balanceDueCents: Math.max(0, number(row.balanceDueCents)),
    dueAtMs: number(row.dueAtMs),
    paidAtMs: number(row.paidAtMs),
    paymentUrl: clean(row.paymentUrl, 1000),
    stripeSessionId: clean(row.stripeSessionId, 180),
    lineItems: lineItems(row.lineItems),
    createdAtMs: number(row.createdAtMs),
    updatedAtMs: number(row.updatedAtMs)
  };
}

function subscriptionView(docSnap) {
  const row = docSnap.data() || {};
  return {
    id: docSnap.id,
    quoteId: clean(row.quoteId, 180),
    companyId: clean(row.companyId, 180),
    companyName: clean(row.companyName, 180),
    status: clean(row.status, 60),
    paymentStatus: clean(row.paymentStatus, 60),
    interval: clean(row.interval || 'monthly', 40),
    termMonths: Math.max(0, number(row.termMonths)),
    amountCents: Math.max(0, number(row.amountCents)),
    nextBillingAtMs: number(row.nextBillingAtMs),
    currentPeriodEndMs: number(row.currentPeriodEndMs),
    cancelAtPeriodEnd: Boolean(row.cancelAtPeriodEnd),
    providerActive: Boolean(row.providerSubscriptionId),
    lineItems: lineItems(row.lineItems),
    createdAtMs: number(row.createdAtMs),
    updatedAtMs: number(row.updatedAtMs)
  };
}

async function customerDocs(collectionName, uid) {
  const [byCustomerId, byCustomerUid] = await Promise.all([
    db.collection(collectionName).where('customerId', '==', uid).limit(100).get(),
    db.collection(collectionName).where('customerUid', '==', uid).limit(100).get()
  ]);
  const unique = new Map();
  [...byCustomerId.docs, ...byCustomerUid.docs].forEach((docSnap) => unique.set(docSnap.id, docSnap));
  return [...unique.values()];
}

exports.getMarketplaceCommerceSnapshot = onCall({
  region: REGION,
  enforceAppCheck: true,
  cors: true
}, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to continue.');

  const [quoteDocs, invoiceDocs, subscriptionDocs] = await Promise.all([
    customerDocs('quotes', uid),
    customerDocs('invoices', uid),
    customerDocs('subscriptions', uid)
  ]);

  const quotes = quoteDocs.map(quoteView).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  const invoices = invoiceDocs.map(invoiceView).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  const subscriptions = subscriptionDocs.map(subscriptionView).sort((a, b) => b.updatedAtMs - a.updatedAtMs);

  return {
    customerId: uid,
    generatedAtMs: Date.now(),
    quotes,
    invoices,
    subscriptions,
    summary: {
      quoteCount: quotes.length,
      openQuotes: quotes.filter((quote) => ['pending', 'sent', 'viewed'].includes(String(quote.status).toLowerCase())).length,
      outstandingCents: invoices.reduce((sum, invoice) => sum + invoice.balanceDueCents, 0),
      paidCents: invoices.reduce((sum, invoice) => sum + invoice.paidCents, 0),
      activeSubscriptions: subscriptions.filter((subscription) => subscription.status === 'active').length
    }
  };
});
