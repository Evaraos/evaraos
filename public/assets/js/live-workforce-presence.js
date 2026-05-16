import { emitEvent } from './operations-events.js';

const presenceRegistry = new Map();
const presenceListeners = new Map();

let listenerCounter = 0;
let heartbeatTimer = null;

const PRESENCE_TIMEOUT_MS = 90 * 1000;
const HEARTBEAT_INTERVAL_MS = 30 * 1000;

function createListenerId() {
  listenerCounter += 1;
  return `presence_listener_${Date.now()}_${listenerCounter}`;
}

function normalizeStatus(value = 'offline') {
  const status = String(value || 'offline').trim().toLowerCase();
  if (['online', 'available', 'busy', 'on_job', 'on_break', 'offline', 'inactive'].includes(status)) return status;
  return 'offline';
}

function normalizeRole(value = 'staff') {
  const role = String(value || 'staff').trim().toLowerCase();
  if (['owner', 'admin', 'manager', 'operations_manager', 'sales', 'sales_rep', 'technician', 'cleaner', 'staff'].includes(role)) return role;
  return 'staff';
}

function notifyPresenceSubscribers(member = null) {
  const snapshot = getWorkforcePresence();

  presenceListeners.forEach((listener) => {
    try {
      listener(member, snapshot);
    } catch (error) {
      console.error('Presence listener failure:', error);
    }
  });
}

function buildPresenceRecord(input = {}) {
  const id = input.userId || input.uid || input.id;
  if (!id) throw new Error('Presence record requires userId.');

  const existing = presenceRegistry.get(id) || {};
  const now = Date.now();

  return {
    id,
    userId: id,
    displayName: input.displayName || input.name || existing.displayName || 'Team Member',
    email: input.email || existing.email || '',
    role: normalizeRole(input.role || existing.role),
    companyId: input.companyId || existing.companyId || '',
    companyName: input.companyName || existing.companyName || '',
    status: normalizeStatus(input.status || existing.status || 'online'),
    availability: input.availability || existing.availability || 'active',
    currentJobId: input.currentJobId || existing.currentJobId || '',
    currentLeadId: input.currentLeadId || existing.currentLeadId || '',
    territoryId: input.territoryId || existing.territoryId || '',
    territoryName: input.territoryName || existing.territoryName || '',
    location: input.location || existing.location || null,
    lastSeenAtMs: input.lastSeenAtMs || now,
    heartbeatAtMs: input.heartbeatAtMs || now,
    createdAtMs: existing.createdAtMs || now,
    updatedAtMs: now,
    metadata: {
      ...(existing.metadata || {}),
      ...(input.metadata || {})
    }
  };
}

export function upsertWorkforcePresence(input = {}) {
  const record = buildPresenceRecord(input);
  const previous = presenceRegistry.get(record.userId) || null;

  presenceRegistry.set(record.userId, record);
  notifyPresenceSubscribers(record);

  emitEvent('presence.updated', {
    userId: record.userId,
    displayName: record.displayName,
    role: record.role,
    previousStatus: previous?.status || null,
    status: record.status,
    companyId: record.companyId,
    territoryId: record.territoryId,
    currentJobId: record.currentJobId
  }, {
    source: 'live-workforce-presence',
    severity: record.status === 'offline' ? 'warning' : 'info',
    correlationId: record.userId
  });

  return record;
}

export function heartbeatWorkforcePresence(userId, patch = {}) {
  const existing = presenceRegistry.get(userId);
  if (!existing) return upsertWorkforcePresence({ ...patch, userId, status: patch.status || 'online' });

  return upsertWorkforcePresence({
    ...existing,
    ...patch,
    userId,
    heartbeatAtMs: Date.now(),
    lastSeenAtMs: Date.now(),
    status: patch.status || existing.status || 'online'
  });
}

export function markWorkforceOffline(userId, metadata = {}) {
  const existing = presenceRegistry.get(userId);
  if (!existing) return null;

  return upsertWorkforcePresence({
    ...existing,
    status: 'offline',
    availability: 'inactive',
    metadata: {
      ...(existing.metadata || {}),
      ...metadata,
      offlineAtMs: Date.now()
    }
  });
}

export function getWorkforcePresence(options = {}) {
  let rows = [...presenceRegistry.values()];

  if (options.status) rows = rows.filter((row) => row.status === normalizeStatus(options.status));
  if (options.role) rows = rows.filter((row) => row.role === normalizeRole(options.role));
  if (options.companyId) rows = rows.filter((row) => row.companyId === options.companyId);
  if (options.territoryId) rows = rows.filter((row) => row.territoryId === options.territoryId);

  return rows.sort((a, b) => Number(b.lastSeenAtMs || 0) - Number(a.lastSeenAtMs || 0));
}

export function summarizeWorkforcePresence(rows = getWorkforcePresence()) {
  return rows.reduce((summary, row) => {
    summary.total += 1;
    summary.byStatus[row.status] = (summary.byStatus[row.status] || 0) + 1;
    summary.byRole[row.role] = (summary.byRole[row.role] || 0) + 1;
    if (['online', 'available', 'busy', 'on_job', 'on_break'].includes(row.status)) summary.active += 1;
    if (row.status === 'available') summary.available += 1;
    if (row.status === 'on_job') summary.onJob += 1;
    return summary;
  }, {
    total: 0,
    active: 0,
    available: 0,
    onJob: 0,
    byStatus: {},
    byRole: {}
  });
}

export function subscribeWorkforcePresence(callback) {
  if (typeof callback !== 'function') throw new Error('subscribeWorkforcePresence requires a callback.');

  const listenerId = createListenerId();
  presenceListeners.set(listenerId, callback);
  callback(null, getWorkforcePresence());

  return listenerId;
}

export function unsubscribeWorkforcePresence(listenerId) {
  return presenceListeners.delete(listenerId);
}

export function sweepInactivePresence(timeoutMs = PRESENCE_TIMEOUT_MS) {
  const now = Date.now();
  const updated = [];

  presenceRegistry.forEach((record) => {
    if (record.status === 'offline') return;
    if (now - Number(record.heartbeatAtMs || record.lastSeenAtMs || 0) <= timeoutMs) return;

    const offline = markWorkforceOffline(record.userId, {
      reason: 'heartbeat_timeout',
      timeoutMs
    });

    if (offline) updated.push(offline);
  });

  return updated;
}

export function startPresenceHeartbeatMonitor(options = {}) {
  stopPresenceHeartbeatMonitor();

  const intervalMs = options.intervalMs || HEARTBEAT_INTERVAL_MS;
  const timeoutMs = options.timeoutMs || PRESENCE_TIMEOUT_MS;

  heartbeatTimer = window.setInterval(() => {
    const offline = sweepInactivePresence(timeoutMs);
    if (offline.length) {
      emitEvent('presence.inactive_sweep', {
        offlineCount: offline.length,
        timeoutMs
      }, {
        source: 'live-workforce-presence',
        severity: 'warning',
        correlationId: `presence_sweep_${Date.now()}`
      });
    }
  }, intervalMs);

  return stopPresenceHeartbeatMonitor;
}

export function stopPresenceHeartbeatMonitor() {
  if (heartbeatTimer) window.clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

export function clearWorkforcePresence() {
  presenceRegistry.clear();
  notifyPresenceSubscribers(null);
}

window.EvaraLiveWorkforcePresence = {
  upsertWorkforcePresence,
  heartbeatWorkforcePresence,
  markWorkforceOffline,
  getWorkforcePresence,
  summarizeWorkforcePresence,
  subscribeWorkforcePresence,
  unsubscribeWorkforcePresence,
  sweepInactivePresence,
  startPresenceHeartbeatMonitor,
  stopPresenceHeartbeatMonitor,
  clearWorkforcePresence
};
