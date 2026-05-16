import {
  createCollectionAdapter,
  EvaraCollections
} from './firestore-collection-adapter.js';

import {
  createSubscription,
  updateSubscription,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  markSubscriptionPaid,
  markSubscriptionPastDue,
  getSubscriptions,
  summarizeSubscriptions
} from './subscription-lifecycle-engine.js';

const subscriptionAdapter = createCollectionAdapter(EvaraCollections.SUBSCRIPTIONS);
let unsubscribeLiveSubscriptions = null;

function normalizeSubscriptionInput(input = {}) {
  return {
    ...input,
    status: input.status || 'active',
    interval: input.interval || input.subscriptionInterval || 'monthly',
    customerId: input.customerId || '',
    companyId: input.companyId || '',
    updatedAtMs: Date.now()
  };
}

function hydrateLocalSubscription(record = {}) {
  if (!record?.id) return null;
  const existing = getSubscriptions().find((subscription) => subscription.id === record.id);
  if (existing) return updateSubscription(record.id, record);
  return createSubscription(record);
}

export async function createPersistentSubscription(input = {}, options = {}) {
  const localSubscription = createSubscription(normalizeSubscriptionInput(input));
  await subscriptionAdapter.set(localSubscription.id, localSubscription, { merge: true, ...options });
  return localSubscription;
}

export async function updatePersistentSubscription(subscriptionId, patch = {}, options = {}) {
  const localSubscription = updateSubscription(subscriptionId, patch);
  await subscriptionAdapter.update(subscriptionId, { ...patch, updatedAtMs: Date.now() }, options);
  return localSubscription;
}

export async function pausePersistentSubscription(subscriptionId, reason = '', options = {}) {
  const localSubscription = pauseSubscription(subscriptionId, reason);
  await subscriptionAdapter.update(subscriptionId, {
    status: 'paused',
    pauseReason: reason,
    pausedAtMs: Date.now(),
    updatedAtMs: Date.now()
  }, options);
  return localSubscription;
}

export async function resumePersistentSubscription(subscriptionId, options = {}) {
  const localSubscription = resumeSubscription(subscriptionId);
  await subscriptionAdapter.set(subscriptionId, localSubscription, { merge: true, ...options });
  return localSubscription;
}

export async function cancelPersistentSubscription(subscriptionId, reason = '', options = {}) {
  const localSubscription = cancelSubscription(subscriptionId, reason);
  await subscriptionAdapter.update(subscriptionId, {
    status: 'cancelled',
    cancelReason: reason,
    cancelledAtMs: Date.now(),
    updatedAtMs: Date.now()
  }, options);
  return localSubscription;
}

export async function markPersistentSubscriptionPaid(subscriptionId, payment = {}, options = {}) {
  const localSubscription = markSubscriptionPaid(subscriptionId, payment);
  await subscriptionAdapter.set(subscriptionId, localSubscription, { merge: true, ...options });
  return localSubscription;
}

export async function markPersistentSubscriptionPastDue(subscriptionId, payment = {}, options = {}) {
  const localSubscription = markSubscriptionPastDue(subscriptionId, payment);
  await subscriptionAdapter.set(subscriptionId, localSubscription, { merge: true, ...options });
  return localSubscription;
}

export async function loadPersistentSubscriptions(options = {}) {
  const records = await subscriptionAdapter.list(options);
  records.forEach(hydrateLocalSubscription);
  return getSubscriptions();
}

export function subscribePersistentSubscriptions(options = {}, callback = () => {}) {
  if (unsubscribeLiveSubscriptions) unsubscribeLiveSubscriptions();

  unsubscribeLiveSubscriptions = subscriptionAdapter.subscribe(options, (records = [], error = null) => {
    if (error) {
      callback(getSubscriptions(), error);
      return;
    }

    records.forEach(hydrateLocalSubscription);
    callback(getSubscriptions(), null);
  });

  return unsubscribeLiveSubscriptions;
}

export function stopPersistentSubscriptionsSubscription() {
  if (unsubscribeLiveSubscriptions) unsubscribeLiveSubscriptions();
  unsubscribeLiveSubscriptions = null;
}

export async function loadCustomerPersistentSubscriptions(customerId, options = {}) {
  return loadPersistentSubscriptions({
    where: [['customerId', '==', customerId]],
    orderBy: [['updatedAtMs', 'desc']],
    ...options
  });
}

export function subscribeCustomerPersistentSubscriptions(customerId, callback = () => {}, options = {}) {
  return subscribePersistentSubscriptions({
    where: [['customerId', '==', customerId]],
    orderBy: [['updatedAtMs', 'desc']],
    ...options
  }, callback);
}

export async function loadCompanyPersistentSubscriptions(companyId, options = {}) {
  return loadPersistentSubscriptions({
    where: [['companyId', '==', companyId]],
    orderBy: [['updatedAtMs', 'desc']],
    ...options
  });
}

export function subscribeCompanyPersistentSubscriptions(companyId, callback = () => {}, options = {}) {
  return subscribePersistentSubscriptions({
    where: [['companyId', '==', companyId]],
    orderBy: [['updatedAtMs', 'desc']],
    ...options
  }, callback);
}

export function summarizePersistentSubscriptions() {
  return summarizeSubscriptions(getSubscriptions());
}

window.EvaraPersistentSubscriptionsAdapter = {
  createPersistentSubscription,
  updatePersistentSubscription,
  pausePersistentSubscription,
  resumePersistentSubscription,
  cancelPersistentSubscription,
  markPersistentSubscriptionPaid,
  markPersistentSubscriptionPastDue,
  loadPersistentSubscriptions,
  subscribePersistentSubscriptions,
  stopPersistentSubscriptionsSubscription,
  loadCustomerPersistentSubscriptions,
  subscribeCustomerPersistentSubscriptions,
  loadCompanyPersistentSubscriptions,
  subscribeCompanyPersistentSubscriptions,
  summarizePersistentSubscriptions
};
