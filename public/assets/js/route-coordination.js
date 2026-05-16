import { emitEvent } from './operations-events.js';
import { getWorkforceAvailability } from './workforce-availability.js';
import { getAutoAssignments } from './auto-assignment-engine.js';

const routes = new Map();
const listeners = new Map();
let routeCounter = 0;
let listenerCounter = 0;

function nextRouteId() {
  routeCounter += 1;
  return `route_${Date.now()}_${routeCounter}`;
}

function nextListenerId() {
  listenerCounter += 1;
  return `route_listener_${Date.now()}_${listenerCounter}`;
}

function cleanStatus(value = 'planned') {
  const status = String(value || 'planned').toLowerCase();
  return ['planned', 'active', 'paused', 'completed', 'cancelled'].includes(status) ? status : 'planned';
}

function cleanStopStatus(value = 'queued') {
  const status = String(value || 'queued').toLowerCase();
  return ['queued', 'en_route', 'arrived', 'completed', 'skipped', 'cancelled'].includes(status) ? status : 'queued';
}

function makeStop(input = {}, index = 0) {
  return {
    id: input.id || `route_stop_${Date.now()}_${index}`,
    assignmentId: input.assignmentId || input.jobId || input.leadId || '',
    assignmentType: input.assignmentType || input.type || 'job',
    title: input.title || input.customerName || input.serviceType || 'Route Stop',
    address: input.address || '',
    companyId: input.companyId || '',
    territoryId: input.territoryId || '',
    sequence: Number(input.sequence ?? index),
    status: cleanStopStatus(input.status),
    estimatedDurationMinutes: Number(input.estimatedDurationMinutes || 45),
    location: input.location || null,
    metadata: input.metadata || {}
  };
}

function stats(stops = []) {
  const completed = stops.filter((stop) => stop.status === 'completed').length;
  const duration = stops.reduce((sum, stop) => sum + Number(stop.estimatedDurationMinutes || 0), 0);
  return {
    stopCount: stops.length,
    completedStops: completed,
    queuedStops: stops.filter((stop) => stop.status === 'queued').length,
    totalDurationMinutes: duration,
    progressPercent: stops.length ? Number(((completed / stops.length) * 100).toFixed(1)) : 0
  };
}

function publish(route = null) {
  const snapshot = getRoutes();
  listeners.forEach((listener) => {
    try {
      listener(route, snapshot);
    } catch (error) {
      console.error('Route listener failure:', error);
    }
  });
}

export function createRoute(input = {}) {
  if (!input.assignedToUid && !input.userId) throw new Error('Route requires assignedToUid.');

  const stops = (input.stops || []).map(makeStop).sort((a, b) => a.sequence - b.sequence);
  const route = {
    id: input.id || nextRouteId(),
    title: input.title || 'Operational Route',
    assignedToUid: input.assignedToUid || input.userId,
    assignedToName: input.assignedToName || input.displayName || 'Team Member',
    role: input.role || '',
    companyId: input.companyId || '',
    territoryId: input.territoryId || '',
    routeDate: input.routeDate || new Date().toISOString().slice(0, 10),
    status: cleanStatus(input.status),
    stops,
    stats: stats(stops),
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
    metadata: input.metadata || {}
  };

  routes.set(route.id, route);
  publish(route);

  emitEvent('route.created', {
    routeId: route.id,
    assignedToUid: route.assignedToUid,
    stopCount: route.stats.stopCount,
    companyId: route.companyId,
    territoryId: route.territoryId
  }, {
    source: 'route-coordination',
    severity: 'info',
    correlationId: route.id
  });

  return route;
}

export function updateRoute(routeId, patch = {}) {
  const existing = routes.get(routeId);
  if (!existing) return null;

  const stops = patch.stops ? patch.stops.map(makeStop).sort((a, b) => a.sequence - b.sequence) : existing.stops;
  const updated = {
    ...existing,
    ...patch,
    status: cleanStatus(patch.status || existing.status),
    stops,
    stats: stats(stops),
    updatedAtMs: Date.now()
  };

  routes.set(routeId, updated);
  publish(updated);

  emitEvent('route.updated', {
    routeId,
    status: updated.status,
    progressPercent: updated.stats.progressPercent
  }, {
    source: 'route-coordination',
    severity: 'info',
    correlationId: routeId
  });

  return updated;
}

export function addRouteStop(routeId, stop = {}) {
  const route = routes.get(routeId);
  if (!route) return null;
  return updateRoute(routeId, { stops: [...route.stops, makeStop(stop, route.stops.length)] });
}

export function updateRouteStop(routeId, stopId, patch = {}) {
  const route = routes.get(routeId);
  if (!route) return null;

  const stops = route.stops.map((stop) => stop.id === stopId ? { ...stop, ...patch, status: cleanStopStatus(patch.status || stop.status) } : stop);
  return updateRoute(routeId, { stops });
}

export function startRoute(routeId) {
  return updateRoute(routeId, { status: 'active', startedAtMs: Date.now() });
}

export function completeRoute(routeId) {
  return updateRoute(routeId, { status: 'completed', completedAtMs: Date.now() });
}

export function buildRouteFromAssignments(userId, assignments = getAutoAssignments({ status: 'approved' }), options = {}) {
  const member = getWorkforceAvailability().find((row) => row.userId === userId) || {};
  const rows = assignments.filter((item) => item.candidateUserId === userId || options.includeUnassigned === true);

  return createRoute({
    title: options.title || 'Auto-Built Operational Route',
    assignedToUid: userId,
    assignedToName: member.displayName || options.assignedToName || 'Team Member',
    role: member.role || options.role || '',
    companyId: options.companyId || member.companyId || rows[0]?.companyId || '',
    territoryId: options.territoryId || member.territoryId || rows[0]?.territoryId || '',
    stops: rows.map((assignment, index) => ({
      assignmentId: assignment.assignmentId,
      assignmentType: assignment.assignmentType,
      title: assignment.recommendation?.serviceType || assignment.assignmentType || 'Assignment',
      companyId: assignment.companyId,
      territoryId: assignment.territoryId,
      sequence: index,
      metadata: assignment
    })),
    metadata: { source: 'auto_assignment_queue', assignmentCount: rows.length }
  });
}

export function getRoutes(options = {}) {
  let rows = [...routes.values()];
  if (options.status) rows = rows.filter((row) => row.status === cleanStatus(options.status));
  if (options.assignedToUid) rows = rows.filter((row) => row.assignedToUid === options.assignedToUid);
  if (options.companyId) rows = rows.filter((row) => row.companyId === options.companyId);
  if (options.territoryId) rows = rows.filter((row) => row.territoryId === options.territoryId);
  if (options.routeDate) rows = rows.filter((row) => row.routeDate === options.routeDate);
  return rows.sort((a, b) => Number(b.updatedAtMs || 0) - Number(a.updatedAtMs || 0));
}

export function summarizeRoutes(rows = getRoutes()) {
  return rows.reduce((summary, route) => {
    summary.total += 1;
    summary.byStatus[route.status] = (summary.byStatus[route.status] || 0) + 1;
    summary.totalStops += Number(route.stats?.stopCount || 0);
    summary.completedStops += Number(route.stats?.completedStops || 0);
    if (route.status === 'active') summary.active += 1;
    if (route.status === 'completed') summary.completed += 1;
    return summary;
  }, { total: 0, active: 0, completed: 0, totalStops: 0, completedStops: 0, byStatus: {} });
}

export function subscribeRoutes(callback) {
  if (typeof callback !== 'function') throw new Error('subscribeRoutes requires a callback.');
  const id = nextListenerId();
  listeners.set(id, callback);
  callback(null, getRoutes());
  return id;
}

export function unsubscribeRoutes(listenerId) {
  return listeners.delete(listenerId);
}

export function clearRoutes() {
  routes.clear();
  publish(null);
}

window.EvaraRouteCoordination = {
  createRoute,
  updateRoute,
  addRouteStop,
  updateRouteStop,
  startRoute,
  completeRoute,
  buildRouteFromAssignments,
  getRoutes,
  summarizeRoutes,
  subscribeRoutes,
  unsubscribeRoutes,
  clearRoutes
};
