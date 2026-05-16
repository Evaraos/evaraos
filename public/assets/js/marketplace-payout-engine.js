import { emitEvent } from './operations-events.js';
import { getInvoices } from './invoice-orchestration-engine.js';

const payoutRegistry = new Map();
const payoutListeners = new Map();

let payoutCounter = 0;
let listenerCounter = 0;

const DEFAULT_SPLIT_RULES = Object.freeze({
  platformPercent: 30,
  companyPercent: 40,
  serviceVendorPercent: 30,
  leadVendorPercent: 0
});

function nextPayoutId() {
  payoutCounter += 1;
  return `payout_${Date.now()}_${payoutCounter}`;
}

function nextListenerId() {
  listenerCounter += 1;
  return `payout_listener_${Date.now()}_${listenerCounter}`;
}

function cents(value = 0) {
  return Math.max(0, Math.round(Number(value || 0)));
}

function normalizeStatus(value = 'calculated') {
  const status = String(value || 'calculated').trim().toLowerCase();
  return ['draft', 'calculated', 'approved', 'processing', 'paid', 'failed', 'cancelled'].includes(status) ? status : 'calculated';
}

function percentAmount(totalCents, percent = 0) {
  return Math.round(cents(totalCents) * (Number(percent || 0) / 100));
}

function normalizeSplitRules(rules = {}) {
  return {
    ...DEFAULT_SPLIT_RULES,
    ...rules
  };
}

function publish(item = null) {
  const snapshot = getMarketplacePayouts();
  payoutListeners.forEach((listener) => {
    try {
      listener(item, snapshot);
    } catch (error) {
      console.error('Marketplace payout listener failure:', error);
    }
  });
}

function calculateSplits(totalCents, rules = {}) {
  const config = normalizeSplitRules(rules);

  const leadVendorCents = percentAmount(totalCents, config.leadVendorPercent);
  const platformCents = percentAmount(totalCents, config.platformPercent);
  const companyCents = percentAmount(totalCents, config.companyPercent);
  let serviceVendorCents = percentAmount(totalCents, config.serviceVendorPercent);

  const allocated = leadVendorCents + platformCents + companyCents + serviceVendorCents;
  const remainder = cents(totalCents) - allocated;

  serviceVendorCents = Math.max(0, serviceVendorCents + remainder);

  return {
    grossCents: cents(totalCents),
    leadVendorCents,
    platformCents,
    companyCents,
    serviceVendorCents,
    remainderCents: remainder,
    rules: config
  };
}

function buildPayout(input = {}) {
  const totalCents = cents(input.grossCents || input.totalCents || input.amountCents);
  const splits = calculateSplits(totalCents, input.splitRules || input.rules || {});

  return {
    id: input.id || nextPayoutId(),
    invoiceId: input.invoiceId || '',
    paymentId: input.paymentId || '',
    companyId: input.companyId || '',
    companyName: input.companyName || '',
    customerId: input.customerId || '',
    leadVendorId: input.leadVendorId || '',
    leadVendorName: input.leadVendorName || '',
    serviceVendorId: input.serviceVendorId || '',
    serviceVendorName: input.serviceVendorName || '',
    platformEntityId: input.platformEntityId || 'evaraos',
    status: normalizeStatus(input.status),
    grossCents: splits.grossCents,
    platformCents: splits.platformCents,
    companyCents: splits.companyCents,
    leadVendorCents: splits.leadVendorCents,
    serviceVendorCents: splits.serviceVendorCents,
    remainderCents: splits.remainderCents,
    splitRules: splits.rules,
    approvedAtMs: input.approvedAtMs || 0,
    processedAtMs: input.processedAtMs || 0,
    paidAtMs: input.paidAtMs || 0,
    createdAtMs: input.createdAtMs || Date.now(),
    updatedAtMs: Date.now(),
    metadata: input.metadata || {}
  };
}

export function calculateMarketplacePayout(input = {}) {
  const payout = buildPayout(input);
  payoutRegistry.set(payout.id, payout);
  publish(payout);

  emitEvent('payout.calculated', {
    payoutId: payout.id,
    invoiceId: payout.invoiceId,
    grossCents: payout.grossCents,
    platformCents: payout.platformCents,
    companyCents: payout.companyCents,
    leadVendorCents: payout.leadVendorCents,
    serviceVendorCents: payout.serviceVendorCents,
    status: payout.status
  }, {
    source: 'marketplace-payout-engine',
    severity: 'info',
    correlationId: payout.invoiceId || payout.id
  });

  return payout;
}

export function calculatePayoutFromInvoice(invoiceId, options = {}) {
  const invoice = getInvoices().find((row) => row.id === invoiceId);
  if (!invoice) return null;

  return calculateMarketplacePayout({
    invoiceId: invoice.id,
    companyId: invoice.companyId,
    companyName: invoice.companyName,
    customerId: invoice.customerId,
    grossCents: invoice.paidCents || invoice.totalCents,
    status: options.status || 'calculated',
    splitRules: options.splitRules,
    leadVendorId: options.leadVendorId || invoice.metadata?.leadVendorId || '',
    leadVendorName: options.leadVendorName || invoice.metadata?.leadVendorName || '',
    serviceVendorId: options.serviceVendorId || invoice.metadata?.serviceVendorId || '',
    serviceVendorName: options.serviceVendorName || invoice.metadata?.serviceVendorName || '',
    metadata: {
      source: 'invoice',
      invoice,
      ...(options.metadata || {})
    }
  });
}

export function updateMarketplacePayout(payoutId, patch = {}) {
  const existing = payoutRegistry.get(payoutId);
  if (!existing) return null;

  const updated = {
    ...existing,
    ...patch,
    status: normalizeStatus(patch.status || existing.status),
    updatedAtMs: Date.now()
  };

  payoutRegistry.set(payoutId, updated);
  publish(updated);

  emitEvent('payout.updated', {
    payoutId,
    status: updated.status,
    grossCents: updated.grossCents
  }, {
    source: 'marketplace-payout-engine',
    severity: 'info',
    correlationId: updated.invoiceId || payoutId
  });

  return updated;
}

export function approveMarketplacePayout(payoutId, approvedBy = {}) {
  return updateMarketplacePayout(payoutId, {
    status: 'approved',
    approvedAtMs: Date.now(),
    approvedBy
  });
}

export function markPayoutProcessing(payoutId, provider = {}) {
  return updateMarketplacePayout(payoutId, {
    status: 'processing',
    processedAtMs: Date.now(),
    provider
  });
}

export function markPayoutPaid(payoutId, provider = {}) {
  return updateMarketplacePayout(payoutId, {
    status: 'paid',
    paidAtMs: Date.now(),
    provider
  });
}

export function markPayoutFailed(payoutId, failure = {}) {
  return updateMarketplacePayout(payoutId, {
    status: 'failed',
    failedAtMs: Date.now(),
    failure
  });
}

export function getMarketplacePayouts(options = {}) {
  let rows = [...payoutRegistry.values()];

  if (options.status) rows = rows.filter((row) => row.status === normalizeStatus(options.status));
  if (options.companyId) rows = rows.filter((row) => row.companyId === options.companyId);
  if (options.invoiceId) rows = rows.filter((row) => row.invoiceId === options.invoiceId);
  if (options.leadVendorId) rows = rows.filter((row) => row.leadVendorId === options.leadVendorId);
  if (options.serviceVendorId) rows = rows.filter((row) => row.serviceVendorId === options.serviceVendorId);

  return rows.sort((a, b) => Number(b.updatedAtMs || 0) - Number(a.updatedAtMs || 0));
}

export function summarizeMarketplacePayouts(rows = getMarketplacePayouts()) {
  return rows.reduce((summary, payout) => {
    summary.total += 1;
    summary.grossCents += Number(payout.grossCents || 0);
    summary.platformCents += Number(payout.platformCents || 0);
    summary.companyCents += Number(payout.companyCents || 0);
    summary.leadVendorCents += Number(payout.leadVendorCents || 0);
    summary.serviceVendorCents += Number(payout.serviceVendorCents || 0);
    summary.byStatus[payout.status] = (summary.byStatus[payout.status] || 0) + 1;
    if (payout.status === 'paid') summary.paid += 1;
    if (payout.status === 'failed') summary.failed += 1;
    return summary;
  }, {
    total: 0,
    paid: 0,
    failed: 0,
    grossCents: 0,
    platformCents: 0,
    companyCents: 0,
    leadVendorCents: 0,
    serviceVendorCents: 0,
    byStatus: {}
  });
}

export function subscribeMarketplacePayouts(callback) {
  if (typeof callback !== 'function') throw new Error('subscribeMarketplacePayouts requires a callback.');
  const id = nextListenerId();
  payoutListeners.set(id, callback);
  callback(null, getMarketplacePayouts());
  return id;
}

export function unsubscribeMarketplacePayouts(listenerId) {
  return payoutListeners.delete(listenerId);
}

export function clearMarketplacePayouts() {
  payoutRegistry.clear();
  publish(null);
}

window.EvaraMarketplacePayoutEngine = {
  calculateMarketplacePayout,
  calculatePayoutFromInvoice,
  updateMarketplacePayout,
  approveMarketplacePayout,
  markPayoutProcessing,
  markPayoutPaid,
  markPayoutFailed,
  getMarketplacePayouts,
  summarizeMarketplacePayouts,
  subscribeMarketplacePayouts,
  unsubscribeMarketplacePayouts,
  clearMarketplacePayouts
};
