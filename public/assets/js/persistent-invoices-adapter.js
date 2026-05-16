import {
  createCollectionAdapter,
  EvaraCollections
} from './firestore-collection-adapter.js';

import {
  createInvoice,
  updateInvoice,
  markInvoicePaid,
  markInvoiceVoid,
  markInvoicePastDue,
  getInvoices,
  summarizeInvoices
} from './invoice-orchestration-engine.js';

const invoiceAdapter = createCollectionAdapter(EvaraCollections.INVOICES);
let unsubscribeLiveInvoices = null;

function normalizeInvoiceInput(input = {}) {
  return {
    ...input,
    status: input.status || 'draft',
    customerId: input.customerId || '',
    companyId: input.companyId || '',
    updatedAtMs: Date.now()
  };
}

function hydrateLocalInvoice(record = {}) {
  if (!record?.id) return null;
  const existing = getInvoices().find((invoice) => invoice.id === record.id);
  if (existing) return updateInvoice(record.id, record);
  return createInvoice(record);
}

export async function createPersistentInvoice(input = {}, options = {}) {
  const localInvoice = createInvoice(normalizeInvoiceInput(input));
  await invoiceAdapter.set(localInvoice.id, localInvoice, { merge: true, ...options });
  return localInvoice;
}

export async function updatePersistentInvoice(invoiceId, patch = {}, options = {}) {
  const localInvoice = updateInvoice(invoiceId, patch);
  await invoiceAdapter.update(invoiceId, { ...patch, updatedAtMs: Date.now() }, options);
  return localInvoice;
}

export async function markPersistentInvoicePaid(invoiceId, payment = {}, options = {}) {
  const localInvoice = markInvoicePaid(invoiceId, payment);
  await invoiceAdapter.set(invoiceId, localInvoice, { merge: true, ...options });
  return localInvoice;
}

export async function markPersistentInvoiceVoid(invoiceId, reason = '', options = {}) {
  const localInvoice = markInvoiceVoid(invoiceId, reason);
  await invoiceAdapter.update(invoiceId, {
    status: 'void',
    voidReason: reason,
    voidedAtMs: Date.now(),
    updatedAtMs: Date.now()
  }, options);
  return localInvoice;
}

export async function markPersistentInvoicePastDue(invoiceId, options = {}) {
  const localInvoice = markInvoicePastDue(invoiceId);
  await invoiceAdapter.update(invoiceId, {
    status: 'past_due',
    updatedAtMs: Date.now()
  }, options);
  return localInvoice;
}

export async function loadPersistentInvoices(options = {}) {
  const records = await invoiceAdapter.list(options);
  records.forEach(hydrateLocalInvoice);
  return getInvoices();
}

export function subscribePersistentInvoices(options = {}, callback = () => {}) {
  if (unsubscribeLiveInvoices) unsubscribeLiveInvoices();

  unsubscribeLiveInvoices = invoiceAdapter.subscribe(options, (records = [], error = null) => {
    if (error) {
      callback(getInvoices(), error);
      return;
    }

    records.forEach(hydrateLocalInvoice);
    callback(getInvoices(), null);
  });

  return unsubscribeLiveInvoices;
}

export function stopPersistentInvoicesSubscription() {
  if (unsubscribeLiveInvoices) unsubscribeLiveInvoices();
  unsubscribeLiveInvoices = null;
}

export async function loadCustomerPersistentInvoices(customerId, options = {}) {
  return loadPersistentInvoices({
    where: [['customerId', '==', customerId]],
    orderBy: [['updatedAtMs', 'desc']],
    ...options
  });
}

export function subscribeCustomerPersistentInvoices(customerId, callback = () => {}, options = {}) {
  return subscribePersistentInvoices({
    where: [['customerId', '==', customerId]],
    orderBy: [['updatedAtMs', 'desc']],
    ...options
  }, callback);
}

export async function loadCompanyPersistentInvoices(companyId, options = {}) {
  return loadPersistentInvoices({
    where: [['companyId', '==', companyId]],
    orderBy: [['updatedAtMs', 'desc']],
    ...options
  });
}

export function subscribeCompanyPersistentInvoices(companyId, callback = () => {}, options = {}) {
  return subscribePersistentInvoices({
    where: [['companyId', '==', companyId]],
    orderBy: [['updatedAtMs', 'desc']],
    ...options
  }, callback);
}

export function summarizePersistentInvoices() {
  return summarizeInvoices(getInvoices());
}

window.EvaraPersistentInvoicesAdapter = {
  createPersistentInvoice,
  updatePersistentInvoice,
  markPersistentInvoicePaid,
  markPersistentInvoiceVoid,
  markPersistentInvoicePastDue,
  loadPersistentInvoices,
  subscribePersistentInvoices,
  stopPersistentInvoicesSubscription,
  loadCustomerPersistentInvoices,
  subscribeCustomerPersistentInvoices,
  loadCompanyPersistentInvoices,
  subscribeCompanyPersistentInvoices,
  summarizePersistentInvoices
};
