import {
  createCollectionAdapter,
  EvaraCollections
} from './firestore-collection-adapter.js';

import {
  applyPersistentInvoicePayment,
  markPersistentInvoicePastDue
} from './persistent-invoices-adapter.js';

import {
  markPersistentSubscriptionPaid,
  markPersistentSubscriptionPastDue,
  cancelPersistentSubscription
} from './persistent-subscriptions-adapter.js';

import { emitEvent } from './operations-events.js';
import {
  markFirestoreAdapterSynced,
  markFirestoreAdapterError
} from './firestore-sync-health.js';

const stripeEventAdapter = createCollectionAdapter('stripe_webhook_events');
const stripeSessionAdapter = createCollectionAdapter(EvaraCollections.STRIPE_SESSIONS);

function normalizeStripeEvent(event = {}) {
  return {
    id: event.id || `stripe_event_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type: event.type || 'unknown',
    livemode: Boolean(event.livemode),
    created: event.created || 0,
    apiVersion: event.api_version || event.apiVersion || '',
    object: event.object || 'event',
    pendingWebhooks: Number(event.pending_webhooks || event.pendingWebhooks || 0),
    requestId: event.request?.id || event.requestId || '',
    customerId: event.data?.object?.metadata?.customerId || event.customerId || '',
    companyId: event.data?.object?.metadata?.companyId || event.companyId || '',
    invoiceId: event.data?.object?.metadata?.invoiceId || event.invoiceId || '',
    subscriptionId: event.data?.object?.metadata?.subscriptionId || event.subscriptionId || '',
    stripeCustomerId: event.data?.object?.customer || event.stripeCustomerId || '',
    stripePaymentIntentId: event.data?.object?.payment_intent || event.stripePaymentIntentId || '',
    stripeCheckoutSessionId: event.data?.object?.id || event.stripeCheckoutSessionId || '',
    processed: Boolean(event.processed),
    processedAtMs: Number(event.processedAtMs || 0),
    receivedAtMs: Number(event.receivedAtMs || Date.now()),
    updatedAtMs: Date.now(),
    payload: event
  };
}

function amountFromStripeObject(object = {}) {
  return Math.max(0, Math.round(Number(
    object.amount_total ||
    object.amount_paid ||
    object.amount_received ||
    object.amount_due ||
    object.amount ||
    0
  )));
}

async function persistStripeSessionFromEvent(eventRecord = {}) {
  const object = eventRecord.payload?.data?.object || {};
  const sessionId = eventRecord.stripeCheckoutSessionId || object.id || '';
  if (!sessionId) return null;

  const session = {
    id: sessionId,
    stripeSessionId: sessionId,
    status: object.payment_status || object.status || 'unknown',
    mode: object.mode || '',
    customerId: eventRecord.customerId,
    companyId: eventRecord.companyId,
    invoiceId: eventRecord.invoiceId,
    subscriptionId: eventRecord.subscriptionId,
    amountCents: amountFromStripeObject(object),
    currency: object.currency || 'usd',
    customerEmail: object.customer_details?.email || object.customer_email || '',
    stripeCustomerId: eventRecord.stripeCustomerId,
    stripePaymentIntentId: eventRecord.stripePaymentIntentId,
    eventId: eventRecord.id,
    updatedAtMs: Date.now(),
    metadata: object.metadata || {}
  };

  await stripeSessionAdapter.set(session.id, session, { merge: true });
  return session;
}

export async function persistStripeWebhookEvent(event = {}, options = {}) {
  try {
    const eventRecord = normalizeStripeEvent(event);
    await stripeEventAdapter.set(eventRecord.id, eventRecord, { merge: true, ...options });

    const session = await persistStripeSessionFromEvent(eventRecord);

    emitEvent('stripe.webhook_persisted', {
      eventId: eventRecord.id,
      type: eventRecord.type,
      customerId: eventRecord.customerId,
      companyId: eventRecord.companyId,
      invoiceId: eventRecord.invoiceId,
      subscriptionId: eventRecord.subscriptionId,
      stripeSessionId: session?.id || ''
    }, {
      source: 'stripe-webhook-persistence-adapter',
      severity: 'info',
      correlationId: eventRecord.invoiceId || eventRecord.subscriptionId || eventRecord.id
    });

    markFirestoreAdapterSynced('stripe-webhook-persistence-adapter', {
      collectionName: 'stripe_webhook_events',
      eventId: eventRecord.id,
      type: eventRecord.type
    });

    return eventRecord;
  } catch (error) {
    markFirestoreAdapterError('stripe-webhook-persistence-adapter', error);
    throw error;
  }
}

export async function reconcileStripeWebhookEvent(event = {}, options = {}) {
  const eventRecord = await persistStripeWebhookEvent(event, options);
  const object = eventRecord.payload?.data?.object || {};
  const amountCents = amountFromStripeObject(object);

  if (eventRecord.type === 'checkout.session.completed' || eventRecord.type === 'payment_intent.succeeded') {
    if (eventRecord.invoiceId) {
      await applyPersistentInvoicePayment(eventRecord.invoiceId, {
        amountCents,
        provider: 'stripe',
        stripeEventId: eventRecord.id,
        stripePaymentIntentId: eventRecord.stripePaymentIntentId,
        paidAtMs: Date.now()
      });
    }

    if (eventRecord.subscriptionId) {
      await markPersistentSubscriptionPaid(eventRecord.subscriptionId, {
        amountCents,
        provider: 'stripe',
        stripeEventId: eventRecord.id,
        paidAtMs: Date.now()
      });
    }
  }

  if (eventRecord.type === 'invoice.payment_failed') {
    if (eventRecord.invoiceId) await markPersistentInvoicePastDue(eventRecord.invoiceId);
    if (eventRecord.subscriptionId) {
      await markPersistentSubscriptionPastDue(eventRecord.subscriptionId, {
        provider: 'stripe',
        stripeEventId: eventRecord.id,
        failedAtMs: Date.now()
      });
    }
  }

  if (eventRecord.type === 'customer.subscription.deleted' && eventRecord.subscriptionId) {
    await cancelPersistentSubscription(eventRecord.subscriptionId, 'Stripe subscription deleted');
  }

  await stripeEventAdapter.update(eventRecord.id, {
    processed: true,
    processedAtMs: Date.now(),
    updatedAtMs: Date.now()
  });

  return {
    ...eventRecord,
    processed: true,
    processedAtMs: Date.now()
  };
}

export async function loadPersistentStripeWebhookEvents(options = {}) {
  return stripeEventAdapter.list({
    orderBy: [['receivedAtMs', 'desc']],
    limit: 50,
    ...options
  });
}

export function subscribePersistentStripeWebhookEvents(options = {}, callback = () => {}) {
  return stripeEventAdapter.subscribe({
    orderBy: [['receivedAtMs', 'desc']],
    limit: 50,
    ...options
  }, callback);
}

window.EvaraStripeWebhookPersistenceAdapter = {
  persistStripeWebhookEvent,
  reconcileStripeWebhookEvent,
  loadPersistentStripeWebhookEvents,
  subscribePersistentStripeWebhookEvents
};
