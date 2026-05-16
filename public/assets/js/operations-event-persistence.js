import {
  db,
  collection,
  addDoc,
  serverTimestamp
} from './firebase.js';

import {
  subscribeEvent,
  unsubscribeEvent
} from './operations-events.js';

let persistenceSubscriptionId = null;
let persistenceEnabled = false;

const DEFAULT_PERSISTED_EVENTS = Object.freeze([
  'alert.*',
  'automation.*',
  'audit.*',
  'notification.*',
  'job.completed',
  'job.cancelled',
  'lead.converted',
  'lead.lost',
  'territory.overloaded'
]);

function normalizeType(type = '') {
  return String(type || '').trim().toLowerCase();
}

function matchesPattern(type = '', pattern = '') {
  const eventType = normalizeType(type);
  const rule = normalizeType(pattern);

  if (rule === '*') return true;
  if (rule.endsWith('*')) return eventType.startsWith(rule.replace('*', ''));

  return eventType === rule;
}

function shouldPersistEvent(event = {}, patterns = DEFAULT_PERSISTED_EVENTS) {
  return patterns.some((pattern) => matchesPattern(event.type, pattern));
}

function safePayload(value) {
  try {
    return JSON.parse(JSON.stringify(value || {}));
  } catch (error) {
    return {
      serializationError: true,
      message: error.message || String(error)
    };
  }
}

export async function persistOperationEvent(event = {}, options = {}) {
  if (!event.type) throw new Error('Cannot persist event without type.');

  const collectionName = options.collectionName || 'operation_events';

  const payload = {
    eventId: event.id || '',
    eventType: normalizeType(event.type),
    timestamp: Number(event.timestamp || Date.now()),
    source: event.source || 'evaraos',
    actor: event.actor || null,
    severity: event.severity || 'info',
    correlationId: event.correlationId || '',
    payload: safePayload(event.payload),
    metadata: safePayload(event.metadata),
    persistedAt: serverTimestamp()
  };

  const ref = await addDoc(collection(db, collectionName), payload);

  return {
    id: ref.id,
    ...payload
  };
}

export function startEventPersistence(options = {}) {
  stopEventPersistence();

  const patterns = options.patterns || DEFAULT_PERSISTED_EVENTS;
  const collectionName = options.collectionName || 'operation_events';
  const onError = typeof options.onError === 'function'
    ? options.onError
    : (error) => console.error('Event persistence failed:', error);

  persistenceEnabled = true;

  persistenceSubscriptionId = subscribeEvent('*', (event) => {
    if (!persistenceEnabled) return;
    if (!shouldPersistEvent(event, patterns)) return;

    persistOperationEvent(event, { collectionName }).catch(onError);
  });

  return stopEventPersistence;
}

export function stopEventPersistence() {
  if (persistenceSubscriptionId) unsubscribeEvent(persistenceSubscriptionId);
  persistenceSubscriptionId = null;
  persistenceEnabled = false;
}

export function isEventPersistenceEnabled() {
  return persistenceEnabled;
}

export function getDefaultPersistedEvents() {
  return [...DEFAULT_PERSISTED_EVENTS];
}

window.EvaraOperationsEventPersistence = {
  persistOperationEvent,
  startEventPersistence,
  stopEventPersistence,
  isEventPersistenceEnabled,
  getDefaultPersistedEvents
};
