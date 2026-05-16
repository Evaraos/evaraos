import { emitEvent } from './operations-events.js';
import { getWorkforceAvailability } from './workforce-availability.js';
import { getRoutes } from './route-coordination.js';
import { getAutoAssignments } from './auto-assignment-engine.js';
import { getActiveShifts } from './shift-orchestration.js';

const balanceListeners = new Map();
let listenerCounter = 0;
let latestSnapshot = [];

function nextListenerId() {
  listenerCounter += 1;
  return `territory_balance_listener_${Date.now()}_${listenerCounter}`;
}

function territoryKey(value = '') {
  return String(value || 'unassigned').trim() || 'unassigned';
}

function label(value = '') {
  return String(value || 'Unassigned Territory');
}

function buildBaseTerritory(id, name = '') {
  return {
    territoryId: territoryKey(id),
    territoryName: name || label(id),
    workforceCount: 0,
    dispatchReadyCount: 0,
    overloadedCount: 0,
    activeShiftCount: 0,
    activeRouteCount: 0,
    routeStopCount: 0,
    queuedAssignmentCount: 0,
    approvedAssignmentCount: 0,
    completedRouteStopCount: 0,
    loadScore: 0,
    capacityScore: 0,
    balanceScore: 0,
    status: 'stable',
    updatedAtMs: Date.now()
  };
}

function getOrCreate(groups, territoryId, territoryName = '') {
  const id = territoryKey(territoryId);
  if (!groups.has(id)) groups.set(id, buildBaseTerritory(id, territoryName));
  return groups.get(id);
}

function calculateStatus(row) {
  const load = Number(row.queuedAssignmentCount || 0) + Number(row.activeRouteCount || 0) + Math.ceil(Number(row.routeStopCount || 0) / 3);
  const capacity = Number(row.dispatchReadyCount || 0) + Number(row.activeShiftCount || 0);
  const overloadedPressure = Number(row.overloadedCount || 0) * 2;

  row.loadScore = load + overloadedPressure;
  row.capacityScore = capacity;
  row.balanceScore = Number((capacity - row.loadScore).toFixed(1));

  if (row.dispatchReadyCount === 0 && row.queuedAssignmentCount > 0) row.status = 'critical';
  else if (row.balanceScore <= -3) row.status = 'overloaded';
  else if (row.balanceScore <= -1) row.status = 'strained';
  else if (row.balanceScore >= 4) row.status = 'underutilized';
  else row.status = 'stable';

  return row;
}

function publish(row = null) {
  const snapshot = getTerritoryBalance();
  balanceListeners.forEach((listener) => {
    try {
      listener(row, snapshot);
    } catch (error) {
      console.error('Territory balance listener failure:', error);
    }
  });
}

export function calculateTerritoryBalance() {
  const groups = new Map();

  getWorkforceAvailability().forEach((member) => {
    const row = getOrCreate(groups, member.territoryId, member.territoryName);
    row.workforceCount += 1;
    if (member.dispatchReady) row.dispatchReadyCount += 1;
    if (member.availabilityState === 'overloaded') row.overloadedCount += 1;
  });

  getActiveShifts().forEach((shift) => {
    const row = getOrCreate(groups, shift.territoryId, shift.territoryName);
    row.activeShiftCount += 1;
  });

  getRoutes().forEach((route) => {
    const row = getOrCreate(groups, route.territoryId, route.territoryName);
    if (route.status === 'active') row.activeRouteCount += 1;
    row.routeStopCount += Number(route.stats?.stopCount || 0);
    row.completedRouteStopCount += Number(route.stats?.completedStops || 0);
  });

  getAutoAssignments().forEach((assignment) => {
    const row = getOrCreate(groups, assignment.territoryId);
    if (assignment.status === 'queued' || assignment.status === 'recommended') row.queuedAssignmentCount += 1;
    if (assignment.status === 'approved') row.approvedAssignmentCount += 1;
  });

  return [...groups.values()].map(calculateStatus).sort((a, b) => {
    const priority = { critical: 0, overloaded: 1, strained: 2, stable: 3, underutilized: 4 };
    return (priority[a.status] ?? 9) - (priority[b.status] ?? 9);
  });
}

export function refreshTerritoryBalance() {
  latestSnapshot = calculateTerritoryBalance();

  const risky = latestSnapshot.filter((row) => ['critical', 'overloaded', 'strained'].includes(row.status));
  if (risky.length) {
    emitEvent('territory.balance_risk_detected', {
      riskyCount: risky.length,
      territories: risky.map((row) => ({
        territoryId: row.territoryId,
        territoryName: row.territoryName,
        status: row.status,
        balanceScore: row.balanceScore,
        dispatchReadyCount: row.dispatchReadyCount,
        queuedAssignmentCount: row.queuedAssignmentCount
      }))
    }, {
      source: 'territory-balancing',
      severity: risky.some((row) => row.status === 'critical') ? 'critical' : 'warning',
      correlationId: `territory_balance_${Date.now()}`
    });
  }

  publish(null);
  return latestSnapshot;
}

export function getTerritoryBalance(options = {}) {
  let rows = latestSnapshot.length ? [...latestSnapshot] : calculateTerritoryBalance();
  if (options.status) rows = rows.filter((row) => row.status === options.status);
  if (options.territoryId) rows = rows.filter((row) => row.territoryId === territoryKey(options.territoryId));
  return rows;
}

export function summarizeTerritoryBalance(rows = getTerritoryBalance()) {
  return rows.reduce((summary, row) => {
    summary.total += 1;
    summary.byStatus[row.status] = (summary.byStatus[row.status] || 0) + 1;
    summary.dispatchReady += Number(row.dispatchReadyCount || 0);
    summary.queuedAssignments += Number(row.queuedAssignmentCount || 0);
    summary.activeRoutes += Number(row.activeRouteCount || 0);
    if (['critical', 'overloaded', 'strained'].includes(row.status)) summary.risky += 1;
    return summary;
  }, {
    total: 0,
    risky: 0,
    dispatchReady: 0,
    queuedAssignments: 0,
    activeRoutes: 0,
    byStatus: {}
  });
}

export function recommendTerritoryRebalancing(rows = getTerritoryBalance()) {
  const overloaded = rows.filter((row) => ['critical', 'overloaded', 'strained'].includes(row.status));
  const underutilized = rows.filter((row) => row.status === 'underutilized' || row.balanceScore > 1);

  return overloaded.map((row) => ({
    territoryId: row.territoryId,
    territoryName: row.territoryName,
    status: row.status,
    recommendation: underutilized.length
      ? `Move overflow from ${row.territoryName} toward ${underutilized[0].territoryName}.`
      : `Add available workforce or reduce queued assignments in ${row.territoryName}.`,
    suggestedSupportTerritoryId: underutilized[0]?.territoryId || '',
    createdAtMs: Date.now()
  }));
}

export function subscribeTerritoryBalance(callback) {
  if (typeof callback !== 'function') throw new Error('subscribeTerritoryBalance requires a callback.');
  const id = nextListenerId();
  balanceListeners.set(id, callback);
  callback(null, getTerritoryBalance());
  return id;
}

export function unsubscribeTerritoryBalance(listenerId) {
  return balanceListeners.delete(listenerId);
}

export function clearTerritoryBalance() {
  latestSnapshot = [];
  publish(null);
}

window.EvaraTerritoryBalancing = {
  calculateTerritoryBalance,
  refreshTerritoryBalance,
  getTerritoryBalance,
  summarizeTerritoryBalance,
  recommendTerritoryRebalancing,
  subscribeTerritoryBalance,
  unsubscribeTerritoryBalance,
  clearTerritoryBalance
};
