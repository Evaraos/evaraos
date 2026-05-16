import { emitEvent } from './operations-events.js';

import {
  getWorkforcePresence,
  subscribeWorkforcePresence,
  unsubscribeWorkforcePresence
} from './live-workforce-presence.js';

const availabilityListeners = new Map();
let listenerCounter = 0;
let presenceSubscriptionId = null;
let availabilitySnapshot = [];

const DEFAULT_CAPACITY = Object.freeze({
  sales: 6,
  sales_rep: 6,
  technician: 4,
  cleaner: 4,
  staff: 3,
  manager: 8,
  operations_manager: 8,
  admin: 10,
  owner: 10
});

function createListenerId() {
  listenerCounter += 1;
  return `availability_listener_${Date.now()}_${listenerCounter}`;
}

function normalizeRole(value = 'staff') {
  return String(value || 'staff').trim().toLowerCase();
}

function capacityFor(member = {}) {
  const role = normalizeRole(member.role);
  return Number(member.metadata?.capacity || DEFAULT_CAPACITY[role] || DEFAULT_CAPACITY.staff);
}

function activeLoad(member = {}) {
  return Number(member.metadata?.activeLoad || member.metadata?.openAssignments || (member.currentJobId ? 1 : 0) || 0);
}

function scoreAvailability(member = {}) {
  const status = String(member.status || 'offline').toLowerCase();
  const capacity = capacityFor(member);
  const load = activeLoad(member);
  const loadRatio = capacity ? load / capacity : 1;

  let dispatchReady = false;
  let availabilityState = 'offline';
  let score = 0;

  if (status === 'available') {
    dispatchReady = loadRatio < 1;
    availabilityState = loadRatio >= 0.85 ? 'near_capacity' : 'dispatch_ready';
    score = Math.max(0, Math.round(100 - (loadRatio * 70)));
  } else if (['online', 'busy'].includes(status)) {
    dispatchReady = status === 'online' && loadRatio < 0.75;
    availabilityState = dispatchReady ? 'available_soon' : 'busy';
    score = Math.max(0, Math.round(70 - (loadRatio * 60)));
  } else if (status === 'on_job') {
    availabilityState = loadRatio >= 1 ? 'overloaded' : 'on_job';
    score = Math.max(0, Math.round(45 - (loadRatio * 30)));
  } else if (status === 'on_break') {
    availabilityState = 'on_break';
    score = 20;
  }

  if (loadRatio >= 1) {
    dispatchReady = false;
    availabilityState = 'overloaded';
    score = Math.min(score, 15);
  }

  return {
    ...member,
    capacity,
    activeLoad: load,
    loadRatio: Number(loadRatio.toFixed(2)),
    dispatchReady,
    availabilityState,
    availabilityScore: score
  };
}

function notifyAvailabilitySubscribers(member = null) {
  const snapshot = getWorkforceAvailability();

  availabilityListeners.forEach((listener) => {
    try {
      listener(member, snapshot);
    } catch (error) {
      console.error('Availability listener failure:', error);
    }
  });
}

export function calculateWorkforceAvailability(rows = getWorkforcePresence()) {
  return rows.map(scoreAvailability).sort((a, b) => Number(b.availabilityScore || 0) - Number(a.availabilityScore || 0));
}

export function refreshWorkforceAvailability() {
  availabilitySnapshot = calculateWorkforceAvailability(getWorkforcePresence());
  notifyAvailabilitySubscribers(null);

  const overloaded = availabilitySnapshot.filter((member) => member.availabilityState === 'overloaded');
  if (overloaded.length) {
    emitEvent('workforce.availability_overload', {
      overloadedCount: overloaded.length,
      members: overloaded.map((member) => ({
        userId: member.userId,
        displayName: member.displayName,
        role: member.role,
        activeLoad: member.activeLoad,
        capacity: member.capacity
      }))
    }, {
      source: 'workforce-availability',
      severity: 'warning',
      correlationId: `availability_overload_${Date.now()}`
    });
  }

  return availabilitySnapshot;
}

export function getWorkforceAvailability(options = {}) {
  let rows = availabilitySnapshot.length ? [...availabilitySnapshot] : calculateWorkforceAvailability(getWorkforcePresence());

  if (options.dispatchReady === true) rows = rows.filter((member) => member.dispatchReady === true);
  if (options.state) rows = rows.filter((member) => member.availabilityState === options.state);
  if (options.role) rows = rows.filter((member) => normalizeRole(member.role) === normalizeRole(options.role));
  if (options.companyId) rows = rows.filter((member) => member.companyId === options.companyId);
  if (options.territoryId) rows = rows.filter((member) => member.territoryId === options.territoryId);

  return rows;
}

export function summarizeWorkforceAvailability(rows = getWorkforceAvailability()) {
  return rows.reduce((summary, member) => {
    summary.total += 1;
    summary.byState[member.availabilityState] = (summary.byState[member.availabilityState] || 0) + 1;
    summary.byRole[member.role] = (summary.byRole[member.role] || 0) + 1;
    if (member.dispatchReady) summary.dispatchReady += 1;
    if (member.availabilityState === 'overloaded') summary.overloaded += 1;
    if (member.availabilityState === 'near_capacity') summary.nearCapacity += 1;
    return summary;
  }, {
    total: 0,
    dispatchReady: 0,
    overloaded: 0,
    nearCapacity: 0,
    byState: {},
    byRole: {}
  });
}

export function subscribeWorkforceAvailability(callback) {
  if (typeof callback !== 'function') throw new Error('subscribeWorkforceAvailability requires a callback.');

  const listenerId = createListenerId();
  availabilityListeners.set(listenerId, callback);
  callback(null, getWorkforceAvailability());

  return listenerId;
}

export function unsubscribeWorkforceAvailability(listenerId) {
  return availabilityListeners.delete(listenerId);
}

export function startWorkforceAvailabilityEngine() {
  stopWorkforceAvailabilityEngine();

  availabilitySnapshot = calculateWorkforceAvailability(getWorkforcePresence());

  presenceSubscriptionId = subscribeWorkforcePresence(() => {
    refreshWorkforceAvailability();
  });

  return stopWorkforceAvailabilityEngine;
}

export function stopWorkforceAvailabilityEngine() {
  if (presenceSubscriptionId) unsubscribeWorkforcePresence(presenceSubscriptionId);
  presenceSubscriptionId = null;
}

export function clearWorkforceAvailability() {
  availabilitySnapshot = [];
  notifyAvailabilitySubscribers(null);
}

window.EvaraWorkforceAvailability = {
  calculateWorkforceAvailability,
  refreshWorkforceAvailability,
  getWorkforceAvailability,
  summarizeWorkforceAvailability,
  subscribeWorkforceAvailability,
  unsubscribeWorkforceAvailability,
  startWorkforceAvailabilityEngine,
  stopWorkforceAvailabilityEngine,
  clearWorkforceAvailability
};
