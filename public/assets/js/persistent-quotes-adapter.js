import {
  createCollectionAdapter,
  EvaraCollections
} from './firestore-collection-adapter.js';

import {
  createQuote,
  updateQuote,
  approveQuote,
  rejectQuote,
  getQuotes,
  summarizeQuotes
} from './dynamic-quoting-engine.js';

const quoteAdapter = createCollectionAdapter(EvaraCollections.QUOTES);
let unsubscribeLiveQuotes = null;

function normalizeQuoteInput(input = {}) {
  return {
    ...input,
    status: input.status || 'draft',
    customerId: input.customerId || '',
    companyId: input.companyId || '',
    updatedAtMs: Date.now()
  };
}

function hydrateLocalQuote(record = {}) {
  if (!record?.id) return null;
  const existing = getQuotes().find((quote) => quote.id === record.id);
  if (existing) return updateQuote(record.id, record);
  return createQuote(record);
}

export async function createPersistentQuote(input = {}, options = {}) {
  const localQuote = createQuote(normalizeQuoteInput(input));
  await quoteAdapter.set(localQuote.id, localQuote, { merge: true, ...options });
  return localQuote;
}

export async function updatePersistentQuote(quoteId, patch = {}, options = {}) {
  const localQuote = updateQuote(quoteId, patch);
  await quoteAdapter.update(quoteId, { ...patch, updatedAtMs: Date.now() }, options);
  return localQuote;
}

export async function approvePersistentQuote(quoteId, options = {}) {
  const localQuote = approveQuote(quoteId);
  await quoteAdapter.update(quoteId, {
    status: 'approved',
    approvedAtMs: Date.now(),
    updatedAtMs: Date.now()
  }, options);
  return localQuote;
}

export async function rejectPersistentQuote(quoteId, options = {}) {
  const localQuote = rejectQuote(quoteId);
  await quoteAdapter.update(quoteId, {
    status: 'rejected',
    rejectedAtMs: Date.now(),
    updatedAtMs: Date.now()
  }, options);
  return localQuote;
}

export async function loadPersistentQuotes(options = {}) {
  const records = await quoteAdapter.list(options);
  records.forEach(hydrateLocalQuote);
  return getQuotes();
}

export function subscribePersistentQuotes(options = {}, callback = () => {}) {
  if (unsubscribeLiveQuotes) unsubscribeLiveQuotes();

  unsubscribeLiveQuotes = quoteAdapter.subscribe(options, (records = [], error = null) => {
    if (error) {
      callback(getQuotes(), error);
      return;
    }

    records.forEach(hydrateLocalQuote);
    callback(getQuotes(), null);
  });

  return unsubscribeLiveQuotes;
}

export function stopPersistentQuotesSubscription() {
  if (unsubscribeLiveQuotes) unsubscribeLiveQuotes();
  unsubscribeLiveQuotes = null;
}

export async function loadCustomerPersistentQuotes(customerId, options = {}) {
  return loadPersistentQuotes({
    where: [['customerId', '==', customerId]],
    orderBy: [['updatedAtMs', 'desc']],
    ...options
  });
}

export function subscribeCustomerPersistentQuotes(customerId, callback = () => {}, options = {}) {
  return subscribePersistentQuotes({
    where: [['customerId', '==', customerId]],
    orderBy: [['updatedAtMs', 'desc']],
    ...options
  }, callback);
}

export async function loadCompanyPersistentQuotes(companyId, options = {}) {
  return loadPersistentQuotes({
    where: [['companyId', '==', companyId]],
    orderBy: [['updatedAtMs', 'desc']],
    ...options
  });
}

export function subscribeCompanyPersistentQuotes(companyId, callback = () => {}, options = {}) {
  return subscribePersistentQuotes({
    where: [['companyId', '==', companyId]],
    orderBy: [['updatedAtMs', 'desc']],
    ...options
  }, callback);
}

export function summarizePersistentQuotes() {
  return summarizeQuotes(getQuotes());
}

window.EvaraPersistentQuotesAdapter = {
  createPersistentQuote,
  updatePersistentQuote,
  approvePersistentQuote,
  rejectPersistentQuote,
  loadPersistentQuotes,
  subscribePersistentQuotes,
  stopPersistentQuotesSubscription,
  loadCustomerPersistentQuotes,
  subscribeCustomerPersistentQuotes,
  loadCompanyPersistentQuotes,
  subscribeCompanyPersistentQuotes,
  summarizePersistentQuotes
};
