const eventRegistry = new Map();
const wildcardRegistry = new Map();
const globalListeners = new Map();

let subscriptionCounter = 0;

function createSubscriptionId() {
  subscriptionCounter += 1;
  return `evt_sub_${Date.now()}_${subscriptionCounter}`;
}

function createEventId() {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeType(type = '') {
  return String(type || '').trim().toLowerCase();
}

function isWildcard(type = '') {
  return normalizeType(type).includes('*');
}

function wildcardPrefix(type = '') {
  return normalizeType(type).replace('*', '');
}

function createEvent(type, payload = {}, options = {}) {
  return {
    id: createEventId(),
    type: normalizeType(type),
    timestamp: Date.now(),
    payload,
    source: options.source || 'evaraos',
    actor: options.actor || null,
    severity: options.severity || 'info',
    correlationId: options.correlationId || null,
    metadata: options.metadata || {}
  };
}

function listenersForType(type = '') {
  return eventRegistry.get(normalizeType(type)) || [];
}

function wildcardListeners(type = '') {
  const normalized = normalizeType(type);

  return [...wildcardRegistry.entries()].flatMap(([prefix, listeners]) => {
    return normalized.startsWith(prefix)
      ? listeners
      : [];
  });
}

function invokeListeners(listeners = [], event) {
  listeners.forEach((listener) => {
    try {
      listener.callback(event);
    } catch (error) {
      console.error('Event listener failure:', error);
    }
  });
}

export function emitEvent(type, payload = {}, options = {}) {
  const event = createEvent(type, payload, options);

  invokeListeners(listenersForType(event.type), event);
  invokeListeners(wildcardListeners(event.type), event);
  invokeListeners([...globalListeners.values()], event);

  return event;
}

export function subscribeEvent(type, callback) {
  if (typeof callback !== 'function') {
    throw new Error('subscribeEvent requires a callback function.');
  }

  const normalized = normalizeType(type);
  const subscriptionId = createSubscriptionId();
  const listener = {
    id: subscriptionId,
    type: normalized,
    callback
  };

  if (normalized === '*') {
    globalListeners.set(subscriptionId, listener);
    return subscriptionId;
  }

  if (isWildcard(normalized)) {
    const prefix = wildcardPrefix(normalized);
    const current = wildcardRegistry.get(prefix) || [];

    wildcardRegistry.set(prefix, [...current, listener]);
    return subscriptionId;
  }

  const current = eventRegistry.get(normalized) || [];
  eventRegistry.set(normalized, [...current, listener]);

  return subscriptionId;
}

export function unsubscribeEvent(subscriptionId) {
  if (!subscriptionId) return false;

  if (globalListeners.has(subscriptionId)) {
    globalListeners.delete(subscriptionId);
    return true;
  }

  for (const [type, listeners] of eventRegistry.entries()) {
    const filtered = listeners.filter((listener) => listener.id !== subscriptionId);

    if (filtered.length !== listeners.length) {
      eventRegistry.set(type, filtered);
      return true;
    }
  }

  for (const [prefix, listeners] of wildcardRegistry.entries()) {
    const filtered = listeners.filter((listener) => listener.id !== subscriptionId);

    if (filtered.length !== listeners.length) {
      wildcardRegistry.set(prefix, filtered);
      return true;
    }
  }

  return false;
}

export function clearEventBus() {
  eventRegistry.clear();
  wildcardRegistry.clear();
  globalListeners.clear();
}

export function getEventBusSnapshot() {
  return {
    directListeners: [...eventRegistry.entries()].reduce((acc, [type, listeners]) => {
      acc[type] = listeners.length;
      return acc;
    }, {}),
    wildcardListeners: [...wildcardRegistry.entries()].reduce((acc, [prefix, listeners]) => {
      acc[prefix + '*'] = listeners.length;
      return acc;
    }, {}),
    globalListeners: globalListeners.size
  };
}

export const OPERATIONS_EVENT_TYPES = Object.freeze({
  LEAD_CREATED: 'lead.created',
  LEAD_UPDATED: 'lead.updated',
  LEAD_ASSIGNED: 'lead.assigned',
  LEAD_CONVERTED: 'lead.converted',
  LEAD_LOST: 'lead.lost',

  JOB_CREATED: 'job.created',
  JOB_ASSIGNED: 'job.assigned',
  JOB_STARTED: 'job.started',
  JOB_COMPLETED: 'job.completed',
  JOB_CANCELLED: 'job.cancelled',

  WORKER_AVAILABLE: 'worker.available',
  WORKER_BUSY: 'worker.busy',
  WORKER_BREAK: 'worker.break',
  WORKER_OFFLINE: 'worker.offline',

  TERRITORY_CREATED: 'territory.created',
  TERRITORY_UPDATED: 'territory.updated',
  TERRITORY_OVERLOADED: 'territory.overloaded',
  TERRITORY_REBALANCED: 'territory.rebalanced',

  ALERT_WARNING: 'alert.warning',
  ALERT_CRITICAL: 'alert.critical',
  ALERT_RESOLVED: 'alert.resolved'
});

window.EvaraOperationsEvents = {
  emitEvent,
  subscribeEvent,
  unsubscribeEvent,
  clearEventBus,
  getEventBusSnapshot,
  OPERATIONS_EVENT_TYPES
};
