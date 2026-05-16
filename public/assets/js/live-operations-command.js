import { emitEvent } from './operations-events.js';
import { getWorkforcePresence, summarizeWorkforcePresence } from './live-workforce-presence.js';
import { getWorkforceAvailability, summarizeWorkforceAvailability } from './workforce-availability.js';
import { getDispatchRecommendations, summarizeDispatchRecommendations } from './intelligent-dispatch-routing.js';
import { getAutoAssignments, summarizeAutoAssignments } from './auto-assignment-engine.js';
import { getShifts, summarizeShifts } from './shift-orchestration.js';
import { getRoutes, summarizeRoutes } from './route-coordination.js';
import { getTerritoryBalance, summarizeTerritoryBalance, recommendTerritoryRebalancing } from './territory-balancing.js';

const commandListeners = new Map();
let listenerCounter = 0;
let commandTimer = null;
let latestSnapshot = null;

const DEFAULT_REFRESH_MS = 30 * 1000;

function nextListenerId() {
  listenerCounter += 1;
  return `operations_command_listener_${Date.now()}_${listenerCounter}`;
}

function riskLevel(score = 0) {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'elevated';
  return 'stable';
}

function calculateOperationsRisk({ presence, availability, dispatch, assignments, shifts, routes, territories } = {}) {
  let score = 0;

  score += Number(availability?.overloaded || 0) * 12;
  score += Number(dispatch?.noCandidate || 0) * 10;
  score += Number(assignments?.noCandidate || 0) * 10;
  score += Number(shifts?.missed || 0) * 8;
  score += Number(territories?.risky || 0) * 14;

  if (Number(presence?.active || 0) === 0 && Number(assignments?.total || 0) > 0) score += 25;
  if (Number(routes?.active || 0) === 0 && Number(routes?.total || 0) > 0) score += 8;

  const normalized = Math.min(100, Number(score.toFixed(1)));

  return {
    score: normalized,
    level: riskLevel(normalized)
  };
}

function buildCommandRecommendations(snapshot = {}) {
  const recommendations = [];
  const territoryRecommendations = recommendTerritoryRebalancing(snapshot.territoryBalance || []);

  if (snapshot.risk?.level === 'critical') {
    recommendations.push('Immediate operations leadership review recommended. Critical operational pressure is active.');
  }

  if (snapshot.availabilitySummary?.overloaded > 0) {
    recommendations.push('Review overloaded workforce and rebalance assignments before dispatching more work.');
  }

  if (snapshot.dispatchSummary?.noCandidate > 0 || snapshot.assignmentSummary?.noCandidate > 0) {
    recommendations.push('Manual dispatch review needed for assignments without qualified candidates.');
  }

  if (snapshot.shiftSummary?.missed > 0) {
    recommendations.push('Review missed shifts and confirm workforce coverage for active territories.');
  }

  territoryRecommendations.slice(0, 5).forEach((row) => recommendations.push(row.recommendation));

  if (!recommendations.length) {
    recommendations.push('Operations appear stable. Continue monitoring workforce, territory, and route flow.');
  }

  return [...new Set(recommendations)].slice(0, 8);
}

function publish(snapshot = null) {
  const current = snapshot || latestSnapshot || buildOperationsCommandSnapshot();

  commandListeners.forEach((listener) => {
    try {
      listener(current);
    } catch (error) {
      console.error('Operations command listener failure:', error);
    }
  });
}

export function buildOperationsCommandSnapshot() {
  const workforcePresence = getWorkforcePresence();
  const workforceAvailability = getWorkforceAvailability();
  const dispatchRecommendations = getDispatchRecommendations();
  const autoAssignments = getAutoAssignments();
  const shifts = getShifts();
  const routes = getRoutes();
  const territoryBalance = getTerritoryBalance();

  const presenceSummary = summarizeWorkforcePresence(workforcePresence);
  const availabilitySummary = summarizeWorkforceAvailability(workforceAvailability);
  const dispatchSummary = summarizeDispatchRecommendations(dispatchRecommendations);
  const assignmentSummary = summarizeAutoAssignments(autoAssignments);
  const shiftSummary = summarizeShifts(shifts);
  const routeSummary = summarizeRoutes(routes);
  const territorySummary = summarizeTerritoryBalance(territoryBalance);

  const risk = calculateOperationsRisk({
    presence: presenceSummary,
    availability: availabilitySummary,
    dispatch: dispatchSummary,
    assignments: assignmentSummary,
    shifts: shiftSummary,
    routes: routeSummary,
    territories: territorySummary
  });

  const snapshot = {
    id: `operations_command_${Date.now()}`,
    generatedAtMs: Date.now(),
    risk,
    presenceSummary,
    availabilitySummary,
    dispatchSummary,
    assignmentSummary,
    shiftSummary,
    routeSummary,
    territorySummary,
    workforcePresence,
    workforceAvailability,
    dispatchRecommendations,
    autoAssignments,
    shifts,
    routes,
    territoryBalance
  };

  snapshot.recommendations = buildCommandRecommendations(snapshot);
  return snapshot;
}

export function refreshOperationsCommand() {
  latestSnapshot = buildOperationsCommandSnapshot();

  if (['critical', 'high'].includes(latestSnapshot.risk.level)) {
    emitEvent('operations.command_risk_detected', {
      riskScore: latestSnapshot.risk.score,
      riskLevel: latestSnapshot.risk.level,
      recommendations: latestSnapshot.recommendations,
      summaries: {
        presence: latestSnapshot.presenceSummary,
        availability: latestSnapshot.availabilitySummary,
        dispatch: latestSnapshot.dispatchSummary,
        assignments: latestSnapshot.assignmentSummary,
        territories: latestSnapshot.territorySummary
      }
    }, {
      source: 'live-operations-command',
      severity: latestSnapshot.risk.level === 'critical' ? 'critical' : 'warning',
      correlationId: latestSnapshot.id
    });
  }

  publish(latestSnapshot);
  return latestSnapshot;
}

export function getOperationsCommandSnapshot() {
  return latestSnapshot || buildOperationsCommandSnapshot();
}

export function subscribeOperationsCommand(callback) {
  if (typeof callback !== 'function') throw new Error('subscribeOperationsCommand requires a callback.');
  const id = nextListenerId();
  commandListeners.set(id, callback);
  callback(getOperationsCommandSnapshot());
  return id;
}

export function unsubscribeOperationsCommand(listenerId) {
  return commandListeners.delete(listenerId);
}

export function startOperationsCommandCenter(options = {}) {
  stopOperationsCommandCenter();
  refreshOperationsCommand();

  commandTimer = window.setInterval(() => {
    refreshOperationsCommand();
  }, Number(options.refreshMs || DEFAULT_REFRESH_MS));

  return stopOperationsCommandCenter;
}

export function stopOperationsCommandCenter() {
  if (commandTimer) window.clearInterval(commandTimer);
  commandTimer = null;
}

export function clearOperationsCommandSnapshot() {
  latestSnapshot = null;
  publish(null);
}

window.EvaraLiveOperationsCommand = {
  buildOperationsCommandSnapshot,
  refreshOperationsCommand,
  getOperationsCommandSnapshot,
  subscribeOperationsCommand,
  unsubscribeOperationsCommand,
  startOperationsCommandCenter,
  stopOperationsCommandCenter,
  clearOperationsCommandSnapshot
};
