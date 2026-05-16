import {
  createCollectionAdapter,
  EvaraCollections
} from './firestore-collection-adapter.js';

import {
  addCustomerServiceHistory,
  updateCustomerServiceHistory,
  syncCustomerServiceHistory,
  getCustomerServiceHistory,
  summarizeCustomerServiceHistory
} from './customer-service-history.js';

const historyAdapter = createCollectionAdapter(EvaraCollections.CUSTOMER_SERVICE_HISTORY);
let unsubscribeLiveHistory = null;

function hydrateLocalHistory(record = {}) {
  if (!record?.id) return null;
  const existing = getCustomerServiceHistory().find((entry) => entry.id === record.id);
  if (existing) return updateCustomerServiceHistory(record.id, record);
  return addCustomerServiceHistory(record);
}

export async function addPersistentCustomerServiceHistory(input = {}, options = {}) {
  const localEntry = addCustomerServiceHistory(input);
  await historyAdapter.set(localEntry.id, localEntry, { merge: true, ...options });
  return localEntry;
}

export async function updatePersistentCustomerServiceHistory(historyId, patch = {}, options = {}) {
  const localEntry = updateCustomerServiceHistory(historyId, patch);
  await historyAdapter.update(historyId, { ...patch, updatedAtMs: Date.now() }, options);
  return localEntry;
}

export async function syncPersistentCustomerServiceHistory(customerId, options = {}) {
  const created = syncCustomerServiceHistory(customerId, options);

  await Promise.all(created.map((entry) => {
    return historyAdapter.set(entry.id, entry, { merge: true });
  }));

  return getCustomerServiceHistory({ customerId, companyId: options.companyId });
}

export async function loadPersistentCustomerServiceHistory(options = {}) {
  const records = await historyAdapter.list(options);
  records.forEach(hydrateLocalHistory);
  return getCustomerServiceHistory();
}

export function subscribePersistentCustomerServiceHistory(options = {}, callback = () => {}) {
  if (unsubscribeLiveHistory) unsubscribeLiveHistory();

  unsubscribeLiveHistory = historyAdapter.subscribe(options, (records = [], error = null) => {
    if (error) {
      callback(getCustomerServiceHistory(), error);
      return;
    }

    records.forEach(hydrateLocalHistory);
    callback(getCustomerServiceHistory(), null);
  });

  return unsubscribeLiveHistory;
}

export function stopPersistentCustomerServiceHistorySubscription() {
  if (unsubscribeLiveHistory) unsubscribeLiveHistory();
  unsubscribeLiveHistory = null;
}

export async function loadCustomerPersistentServiceHistory(customerId, options = {}) {
  return loadPersistentCustomerServiceHistory({
    where: [['customerId', '==', customerId]],
    orderBy: [['serviceDateMs', 'desc']],
    ...options
  });
}

export function subscribeCustomerPersistentServiceHistory(customerId, callback = () => {}, options = {}) {
  return subscribePersistentCustomerServiceHistory({
    where: [['customerId', '==', customerId]],
    orderBy: [['serviceDateMs', 'desc']],
    ...options
  }, callback);
}

export async function loadCompanyPersistentServiceHistory(companyId, options = {}) {
  return loadPersistentCustomerServiceHistory({
    where: [['companyId', '==', companyId]],
    orderBy: [['serviceDateMs', 'desc']],
    ...options
  });
}

export function subscribeCompanyPersistentServiceHistory(companyId, callback = () => {}, options = {}) {
  return subscribePersistentCustomerServiceHistory({
    where: [['companyId', '==', companyId]],
    orderBy: [['serviceDateMs', 'desc']],
    ...options
  }, callback);
}

export function summarizePersistentCustomerServiceHistory(options = {}) {
  return summarizeCustomerServiceHistory(getCustomerServiceHistory(options));
}

window.EvaraPersistentCustomerServiceHistoryAdapter = {
  addPersistentCustomerServiceHistory,
  updatePersistentCustomerServiceHistory,
  syncPersistentCustomerServiceHistory,
  loadPersistentCustomerServiceHistory,
  subscribePersistentCustomerServiceHistory,
  stopPersistentCustomerServiceHistorySubscription,
  loadCustomerPersistentServiceHistory,
  subscribeCustomerPersistentServiceHistory,
  loadCompanyPersistentServiceHistory,
  subscribeCompanyPersistentServiceHistory,
  summarizePersistentCustomerServiceHistory
};
