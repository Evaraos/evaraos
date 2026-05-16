import {
  createCollectionAdapter,
  EvaraCollections,
  createPersistentRecord,
  listPersistentRecords,
  subscribePersistentRecords
} from './firestore-collection-adapter.js';

import {
  createCustomerMessageThread,
  addCustomerMessage,
  updateCustomerMessageThread,
  markCustomerThreadRead,
  resolveCustomerThread,
  getCustomerMessageThreads,
  getCustomerThreadMessages,
  summarizeCustomerMessages
} from './customer-messaging-center.js';

const threadAdapter = createCollectionAdapter(EvaraCollections.CUSTOMER_MESSAGE_THREADS);
let unsubscribeLiveThreads = null;
let unsubscribeLiveMessages = null;

function messageCollectionPath(threadId) {
  return `${EvaraCollections.CUSTOMER_MESSAGE_THREADS}/${threadId}/messages`;
}

function hydrateLocalThread(record = {}) {
  if (!record?.id) return null;
  const existing = getCustomerMessageThreads().find((thread) => thread.id === record.id);
  if (existing) return updateCustomerMessageThread(record.id, record);
  return createCustomerMessageThread(record);
}

function hydrateLocalMessage(threadId, record = {}) {
  if (!threadId || !record?.id) return null;
  const exists = getCustomerThreadMessages(threadId).some((message) => message.id === record.id);
  if (exists) return record;
  return addCustomerMessage(threadId, record);
}

export async function createPersistentCustomerThread(input = {}, options = {}) {
  const localThread = createCustomerMessageThread(input);
  await threadAdapter.set(localThread.id, localThread, { merge: true, ...options });
  return localThread;
}

export async function updatePersistentCustomerThread(threadId, patch = {}, options = {}) {
  const localThread = updateCustomerMessageThread(threadId, patch);
  await threadAdapter.update(threadId, { ...patch, updatedAtMs: Date.now() }, options);
  return localThread;
}

export async function addPersistentCustomerMessage(threadId, input = {}, options = {}) {
  const localMessage = addCustomerMessage(threadId, input);
  if (!localMessage) return null;

  await createPersistentRecord(messageCollectionPath(threadId), localMessage, {
    id: localMessage.id,
    merge: true,
    ...options
  });

  const thread = getCustomerMessageThreads().find((row) => row.id === threadId);
  if (thread) await threadAdapter.set(threadId, thread, { merge: true });

  return localMessage;
}

export async function markPersistentCustomerThreadRead(threadId, reader = 'customer', options = {}) {
  const localThread = markCustomerThreadRead(threadId, reader);
  if (!localThread) return null;
  await threadAdapter.set(threadId, localThread, { merge: true, ...options });
  return localThread;
}

export async function resolvePersistentCustomerThread(threadId, resolvedBy = {}, options = {}) {
  const localThread = resolveCustomerThread(threadId, resolvedBy);
  if (!localThread) return null;
  await threadAdapter.set(threadId, localThread, { merge: true, ...options });
  return localThread;
}

export async function loadPersistentCustomerThreads(options = {}) {
  const records = await threadAdapter.list(options);
  records.forEach(hydrateLocalThread);
  return getCustomerMessageThreads();
}

export async function loadPersistentCustomerMessages(threadId, options = {}) {
  const records = await listPersistentRecords(messageCollectionPath(threadId), {
    orderBy: [['createdAtMs', 'asc']],
    ...options
  });

  records.forEach((record) => hydrateLocalMessage(threadId, record));
  return getCustomerThreadMessages(threadId);
}

export function subscribePersistentCustomerThreads(options = {}, callback = () => {}) {
  if (unsubscribeLiveThreads) unsubscribeLiveThreads();

  unsubscribeLiveThreads = threadAdapter.subscribe(options, (records = [], error = null) => {
    if (error) {
      callback(getCustomerMessageThreads(), error);
      return;
    }

    records.forEach(hydrateLocalThread);
    callback(getCustomerMessageThreads(), null);
  });

  return unsubscribeLiveThreads;
}

export function subscribePersistentCustomerMessages(threadId, callback = () => {}, options = {}) {
  if (unsubscribeLiveMessages) unsubscribeLiveMessages();

  unsubscribeLiveMessages = subscribePersistentRecords(messageCollectionPath(threadId), {
    orderBy: [['createdAtMs', 'asc']],
    ...options
  }, (records = [], error = null) => {
    if (error) {
      callback(getCustomerThreadMessages(threadId), error);
      return;
    }

    records.forEach((record) => hydrateLocalMessage(threadId, record));
    callback(getCustomerThreadMessages(threadId), null);
  });

  return unsubscribeLiveMessages;
}

export function stopPersistentCustomerMessagingSubscriptions() {
  if (unsubscribeLiveThreads) unsubscribeLiveThreads();
  if (unsubscribeLiveMessages) unsubscribeLiveMessages();
  unsubscribeLiveThreads = null;
  unsubscribeLiveMessages = null;
}

export function subscribeCustomerPersistentThreads(customerId, callback = () => {}, options = {}) {
  return subscribePersistentCustomerThreads({
    where: [['customerId', '==', customerId]],
    orderBy: [['lastMessageAtMs', 'desc']],
    ...options
  }, callback);
}

export function subscribeCompanyPersistentThreads(companyId, callback = () => {}, options = {}) {
  return subscribePersistentCustomerThreads({
    where: [['companyId', '==', companyId]],
    orderBy: [['lastMessageAtMs', 'desc']],
    ...options
  }, callback);
}

export function summarizePersistentCustomerMessages() {
  return summarizeCustomerMessages(getCustomerMessageThreads());
}

window.EvaraPersistentCustomerMessagingAdapter = {
  createPersistentCustomerThread,
  updatePersistentCustomerThread,
  addPersistentCustomerMessage,
  markPersistentCustomerThreadRead,
  resolvePersistentCustomerThread,
  loadPersistentCustomerThreads,
  loadPersistentCustomerMessages,
  subscribePersistentCustomerThreads,
  subscribePersistentCustomerMessages,
  stopPersistentCustomerMessagingSubscriptions,
  subscribeCustomerPersistentThreads,
  subscribeCompanyPersistentThreads,
  summarizePersistentCustomerMessages
};
