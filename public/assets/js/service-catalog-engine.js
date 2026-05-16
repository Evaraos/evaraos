import { emitEvent } from './operations-events.js';

const serviceRegistry = new Map();
const packageRegistry = new Map();
const catalogListeners = new Map();

let serviceCounter = 0;
let packageCounter = 0;
let listenerCounter = 0;

function nextServiceId() {
  serviceCounter += 1;
  return `service_${Date.now()}_${serviceCounter}`;
}

function nextPackageId() {
  packageCounter += 1;
  return `service_package_${Date.now()}_${packageCounter}`;
}

function nextListenerId() {
  listenerCounter += 1;
  return `catalog_listener_${Date.now()}_${listenerCounter}`;
}

function normalizeStatus(value = 'active') {
  const status = String(value || 'active').trim().toLowerCase();
  return ['draft', 'active', 'paused', 'archived'].includes(status) ? status : 'active';
}

function normalizePricingType(value = 'flat') {
  const type = String(value || 'flat').trim().toLowerCase();
  return ['flat', 'per_bin', 'per_sqft', 'hourly', 'custom', 'subscription'].includes(type) ? type : 'flat';
}

function cents(value = 0) {
  return Math.max(0, Math.round(Number(value || 0)));
}

function publish(item = null) {
  const snapshot = getServiceCatalog();
  catalogListeners.forEach((listener) => {
    try {
      listener(item, snapshot);
    } catch (error) {
      console.error('Service catalog listener failure:', error);
    }
  });
}

function buildService(input = {}) {
  const id = input.id || nextServiceId();
  return {
    id,
    companyId: input.companyId || '',
    companyName: input.companyName || '',
    category: input.category || 'general',
    name: input.name || 'Service',
    slug: input.slug || String(input.name || id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    description: input.description || '',
    status: normalizeStatus(input.status),
    pricingType: normalizePricingType(input.pricingType),
    basePriceCents: cents(input.basePriceCents),
    minimumPriceCents: cents(input.minimumPriceCents || input.basePriceCents),
    unitLabel: input.unitLabel || '',
    recurringEligible: Boolean(input.recurringEligible),
    subscriptionInterval: input.subscriptionInterval || '',
    subscriptionTermMonths: Number(input.subscriptionTermMonths || 0),
    estimatedDurationMinutes: Number(input.estimatedDurationMinutes || 60),
    requiresQuote: Boolean(input.requiresQuote),
    addOns: Array.isArray(input.addOns) ? input.addOns : [],
    fees: Array.isArray(input.fees) ? input.fees : [],
    tags: Array.isArray(input.tags) ? input.tags : [],
    createdAtMs: input.createdAtMs || Date.now(),
    updatedAtMs: Date.now(),
    metadata: input.metadata || {}
  };
}

function buildPackage(input = {}) {
  const id = input.id || nextPackageId();
  return {
    id,
    companyId: input.companyId || '',
    companyName: input.companyName || '',
    name: input.name || 'Service Package',
    description: input.description || '',
    status: normalizeStatus(input.status),
    serviceIds: Array.isArray(input.serviceIds) ? input.serviceIds : [],
    discountType: input.discountType || 'none',
    discountValue: Number(input.discountValue || 0),
    recurringEligible: Boolean(input.recurringEligible),
    subscriptionInterval: input.subscriptionInterval || '',
    createdAtMs: input.createdAtMs || Date.now(),
    updatedAtMs: Date.now(),
    metadata: input.metadata || {}
  };
}

export function createService(input = {}) {
  const service = buildService(input);
  serviceRegistry.set(service.id, service);
  publish(service);

  emitEvent('catalog.service_created', {
    serviceId: service.id,
    companyId: service.companyId,
    name: service.name,
    pricingType: service.pricingType,
    basePriceCents: service.basePriceCents,
    status: service.status
  }, {
    source: 'service-catalog-engine',
    severity: 'info',
    correlationId: service.id
  });

  return service;
}

export function updateService(serviceId, patch = {}) {
  const existing = serviceRegistry.get(serviceId);
  if (!existing) return null;

  const updated = buildService({
    ...existing,
    ...patch,
    id: serviceId,
    createdAtMs: existing.createdAtMs
  });

  serviceRegistry.set(serviceId, updated);
  publish(updated);

  emitEvent('catalog.service_updated', {
    serviceId,
    companyId: updated.companyId,
    name: updated.name,
    status: updated.status
  }, {
    source: 'service-catalog-engine',
    severity: 'info',
    correlationId: serviceId
  });

  return updated;
}

export function archiveService(serviceId) {
  return updateService(serviceId, { status: 'archived' });
}

export function createServicePackage(input = {}) {
  const item = buildPackage(input);
  packageRegistry.set(item.id, item);
  publish(item);

  emitEvent('catalog.package_created', {
    packageId: item.id,
    companyId: item.companyId,
    name: item.name,
    serviceCount: item.serviceIds.length,
    status: item.status
  }, {
    source: 'service-catalog-engine',
    severity: 'info',
    correlationId: item.id
  });

  return item;
}

export function updateServicePackage(packageId, patch = {}) {
  const existing = packageRegistry.get(packageId);
  if (!existing) return null;

  const updated = buildPackage({
    ...existing,
    ...patch,
    id: packageId,
    createdAtMs: existing.createdAtMs
  });

  packageRegistry.set(packageId, updated);
  publish(updated);

  emitEvent('catalog.package_updated', {
    packageId,
    companyId: updated.companyId,
    name: updated.name,
    status: updated.status
  }, {
    source: 'service-catalog-engine',
    severity: 'info',
    correlationId: packageId
  });

  return updated;
}

export function calculateServiceEstimate(serviceId, quantity = 1, options = {}) {
  const service = serviceRegistry.get(serviceId);
  if (!service) return null;

  const qty = Math.max(1, Number(quantity || 1));
  const base = service.pricingType === 'flat' ? service.basePriceCents : service.basePriceCents * qty;
  const addOns = (options.addOns || []).reduce((sum, addOn) => sum + cents(addOn.priceCents), 0);
  const fees = (service.fees || []).reduce((sum, fee) => sum + cents(fee.amountCents), 0);
  const subtotal = Math.max(service.minimumPriceCents || 0, base + addOns + fees);

  return {
    serviceId,
    serviceName: service.name,
    pricingType: service.pricingType,
    quantity: qty,
    basePriceCents: service.basePriceCents,
    addOnTotalCents: addOns,
    feeTotalCents: fees,
    subtotalCents: subtotal,
    requiresQuote: service.requiresQuote,
    estimatedDurationMinutes: service.estimatedDurationMinutes
  };
}

export function getServiceCatalog(options = {}) {
  let services = [...serviceRegistry.values()];
  let packages = [...packageRegistry.values()];

  if (options.companyId) {
    services = services.filter((service) => service.companyId === options.companyId);
    packages = packages.filter((item) => item.companyId === options.companyId);
  }

  if (options.status) {
    services = services.filter((service) => service.status === normalizeStatus(options.status));
    packages = packages.filter((item) => item.status === normalizeStatus(options.status));
  }

  if (options.category) services = services.filter((service) => service.category === options.category);

  return {
    services: services.sort((a, b) => String(a.name).localeCompare(String(b.name))),
    packages: packages.sort((a, b) => String(a.name).localeCompare(String(b.name)))
  };
}

export function summarizeServiceCatalog(catalog = getServiceCatalog()) {
  return catalog.services.reduce((summary, service) => {
    summary.totalServices += 1;
    summary.byStatus[service.status] = (summary.byStatus[service.status] || 0) + 1;
    summary.byPricingType[service.pricingType] = (summary.byPricingType[service.pricingType] || 0) + 1;
    if (service.recurringEligible) summary.recurringEligible += 1;
    if (service.requiresQuote) summary.requiresQuote += 1;
    return summary;
  }, {
    totalServices: 0,
    totalPackages: catalog.packages.length,
    recurringEligible: 0,
    requiresQuote: 0,
    byStatus: {},
    byPricingType: {}
  });
}

export function subscribeServiceCatalog(callback) {
  if (typeof callback !== 'function') throw new Error('subscribeServiceCatalog requires a callback.');
  const id = nextListenerId();
  catalogListeners.set(id, callback);
  callback(null, getServiceCatalog());
  return id;
}

export function unsubscribeServiceCatalog(listenerId) {
  return catalogListeners.delete(listenerId);
}

export function clearServiceCatalog() {
  serviceRegistry.clear();
  packageRegistry.clear();
  publish(null);
}

window.EvaraServiceCatalogEngine = {
  createService,
  updateService,
  archiveService,
  createServicePackage,
  updateServicePackage,
  calculateServiceEstimate,
  getServiceCatalog,
  summarizeServiceCatalog,
  subscribeServiceCatalog,
  unsubscribeServiceCatalog,
  clearServiceCatalog
};
