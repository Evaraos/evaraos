import { emitEvent } from './operations-events.js';
import {
  upsertWorkforcePresence,
  getWorkforcePresence
} from './live-workforce-presence.js';
import {
  refreshWorkforceAvailability
} from './workforce-availability.js';

const shiftRegistry = new Map();
const shiftListeners = new Map();

let shiftCounter = 0;
let listenerCounter = 0;
let shiftMonitorTimer = null;

const SHIFT_MONITOR_INTERVAL_MS = 60 * 1000;

function createShiftId() {
  shiftCounter += 1;
  return `shift_${Date.now()}_${shiftCounter}`;
}

function createListenerId() {
  listenerCounter += 1;
  return `shift_listener_${Date.now()}_${listenerCounter}`;
}

function normalizeStatus(value = 'scheduled') {
  const status = String(value || 'scheduled').trim().toLowerCase();
  if (['scheduled', 'active', 'completed', 'missed', 'cancelled'].includes(status)) return status;
  return 'scheduled';
}

function normalizeRole(value = 'staff') {
  return String(value || 'staff').trim().toLowerCase();
}

function now() {
  return Date.now();
}

function notifyShiftSubscribers(shift = null) {
  const snapshot = getShifts();

  shiftListeners.forEach((listener) => {
    try {
      listener(shift, snapshot);
    } catch (error) {
      console.error('Shift listener failure:', error);
    }
  });
}

function buildShift(input = {}) {
  const id = input.id || createShiftId();
  const startAtMs = Number(input.startAtMs || now());
  const endAtMs = Number(input.endAtMs || startAtMs + (8 * 60 * 60 * 1000));

  if (!input.userId) throw new Error('Shift requires userId.');
  if (endAtMs <= startAtMs) throw new Error('Shift endAtMs must be after startAtMs.');

  return {
    id,
    userId: input.userId,
    displayName: input.displayName || input.name || 'Team Member',
    role: normalizeRole(input.role),
    companyId: input.companyId || '',
    companyName: input.companyName || '',
    territoryId: input.territoryId || '',
    territoryName: input.territoryName || '',
    startAtMs,
    endAtMs,
    status: normalizeStatus(input.status || 'scheduled'),
    breakWindows: Array.isArray(input.breakWindows) ? input.breakWindows : [],
    notes: input.notes || '',
    createdAtMs: input.createdAtMs || now(),
    updatedAtMs: now(),
    metadata: input.metadata || {}
  };
}

function isWithinShiftWindow(shift = {}, timeMs = now()) {
  return Number(shift.startAtMs || 0) <= timeMs && timeMs <= Number(shift.endAtMs || 0);
}

function isPastShift(shift = {}, timeMs = now()) {
  return Number(shift.endAtMs || 0) < timeMs;
}

export function createShift(input = {}) {
  const shift = buildShift(input);
  shiftRegistry.set(shift.id, shift);
  notifyShiftSubscribers(shift);

  emitEvent('shift.created', {
    shiftId: shift.id,
    userId: shift.userId,
    role: shift.role,
    companyId: shift.companyId,
    territoryId: shift.territoryId,
    startAtMs: shift.startAtMs,
    endAtMs: shift.endAtMs
  }, {
    source: 'shift-orchestration',
    severity: 'info',
    correlationId: shift.id
  });

  return shift;
}

export function updateShift(shiftId, patch = {}) {
  const existing = shiftRegistry.get(shiftId);
  if (!existing) return null;

  const updated = {
    ...existing,
    ...patch,
    status: normalizeStatus(patch.status || existing.status),
    role: normalizeRole(patch.role || existing.role),
    updatedAtMs: now()
  };

  shiftRegistry.set(shiftId, updated);
  notifyShiftSubscribers(updated);

  emitEvent('shift.updated', {
    shiftId,
    userId: updated.userId,
    status: updated.status,
    companyId: updated.companyId,
    territoryId: updated.territoryId
  }, {
    source: 'shift-orchestration',
    severity: 'info',
    correlationId: shiftId
  });

  return updated;
}

export function startShift(shiftId, metadata = {}) {
  const shift = updateShift(shiftId, {
    status: 'active',
    startedAtMs: now(),
    metadata
  });

  if (!shift) return null;

  upsertWorkforcePresence({
    userId: shift.userId,
    displayName: shift.displayName,
    role: shift.role,
    companyId: shift.companyId,
    companyName: shift.companyName,
    territoryId: shift.territoryId,
    territoryName: shift.territoryName,
    status: 'available',
    availability: 'active',
    metadata: {
      shiftId: shift.id,
      shiftStatus: 'active'
    }
  });

  refreshWorkforceAvailability();

  emitEvent('shift.started', {
    shiftId: shift.id,
    userId: shift.userId,
    role: shift.role,
    companyId: shift.companyId,
    territoryId: shift.territoryId
  }, {
    source: 'shift-orchestration',
    severity: 'success',
    correlationId: shift.id
  });

  return shift;
}

export function endShift(shiftId, metadata = {}) {
  const shift = updateShift(shiftId, {
    status: 'completed',
    completedAtMs: now(),
    metadata
  });

  if (!shift) return null;

  upsertWorkforcePresence({
    userId: shift.userId,
    displayName: shift.displayName,
    role: shift.role,
    companyId: shift.companyId,
    companyName: shift.companyName,
    territoryId: shift.territoryId,
    territoryName: shift.territoryName,
    status: 'offline',
    availability: 'inactive',
    metadata: {
      shiftId: shift.id,
      shiftStatus: 'completed'
    }
  });

  refreshWorkforceAvailability();

  emitEvent('shift.completed', {
    shiftId: shift.id,
    userId: shift.userId,
    role: shift.role,
    companyId: shift.companyId,
    territoryId: shift.territoryId
  }, {
    source: 'shift-orchestration',
    severity: 'success',
    correlationId: shift.id
  });

  return shift;
}

export function getShifts(options = {}) {
  let rows = [...shiftRegistry.values()];

  if (options.status) rows = rows.filter((row) => row.status === normalizeStatus(options.status));
  if (options.userId) rows = rows.filter((row) => row.userId === options.userId);
  if (options.role) rows = rows.filter((row) => row.role === normalizeRole(options.role));
  if (options.companyId) rows = rows.filter((row) => row.companyId === options.companyId);
  if (options.territoryId) rows = rows.filter((row) => row.territoryId === options.territoryId);

  return rows.sort((a, b) => Number(a.startAtMs || 0) - Number(b.startAtMs || 0));
}

export function getActiveShifts(timeMs = now()) {
  return getShifts().filter((shift) => shift.status === 'active' || (shift.status === 'scheduled' && isWithinShiftWindow(shift, timeMs)));
}

export function summarizeShifts(rows = getShifts()) {
  return rows.reduce((summary, shift) => {
    summary.total += 1;
    summary.byStatus[shift.status] = (summary.byStatus[shift.status] || 0) + 1;
    summary.byRole[shift.role] = (summary.byRole[shift.role] || 0) + 1;
    if (shift.status === 'active') summary.active += 1;
    if (shift.status === 'scheduled') summary.scheduled += 1;
    if (shift.status === 'missed') summary.missed += 1;
    return summary;
  }, {
    total: 0,
    active: 0,
    scheduled: 0,
    missed: 0,
    byStatus: {},
    byRole: {}
  });
}

export function runShiftMonitor(timeMs = now()) {
  const changes = [];

  shiftRegistry.forEach((shift) => {
    if (shift.status === 'scheduled' && isWithinShiftWindow(shift, timeMs)) {
      changes.push(startShift(shift.id, { reason: 'auto_shift_window_started' }));
    }

    if (shift.status === 'active' && isPastShift(shift, timeMs)) {
      changes.push(endShift(shift.id, { reason: 'auto_shift_window_completed' }));
    }
  });

  const missed = getShifts({ status: 'scheduled' }).filter((shift) => isPastShift(shift, timeMs));
  missed.forEach((shift) => {
    changes.push(updateShift(shift.id, {
      status: 'missed',
      missedAtMs: timeMs,
      metadata: {
        ...(shift.metadata || {}),
        reason: 'missed_shift_window'
      }
    }));
  });

  return changes.filter(Boolean);
}

export function subscribeShifts(callback) {
  if (typeof callback !== 'function') throw new Error('subscribeShifts requires a callback.');

  const listenerId = createListenerId();
  shiftListeners.set(listenerId, callback);
  callback(null, getShifts());

  return listenerId;
}

export function unsubscribeShifts(listenerId) {
  return shiftListeners.delete(listenerId);
}

export function startShiftOrchestration(options = {}) {
  stopShiftOrchestration();

  shiftMonitorTimer = window.setInterval(() => {
    runShiftMonitor();
  }, Number(options.intervalMs || SHIFT_MONITOR_INTERVAL_MS));

  runShiftMonitor();
  return stopShiftOrchestration;
}

export function stopShiftOrchestration() {
  if (shiftMonitorTimer) window.clearInterval(shiftMonitorTimer);
  shiftMonitorTimer = null;
}

export function clearShifts() {
  shiftRegistry.clear();
  notifyShiftSubscribers(null);
}

window.EvaraShiftOrchestration = {
  createShift,
  updateShift,
  startShift,
  endShift,
  getShifts,
  getActiveShifts,
  summarizeShifts,
  runShiftMonitor,
  subscribeShifts,
  unsubscribeShifts,
  startShiftOrchestration,
  stopShiftOrchestration,
  clearShifts
};
