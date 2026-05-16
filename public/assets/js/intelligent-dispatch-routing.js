import { emitEvent } from './operations-events.js';

import {
  getWorkforceAvailability,
  refreshWorkforceAvailability
} from './workforce-availability.js';

const dispatchRecommendations = new Map();
const dispatchListeners = new Map();

let recommendationCounter = 0;
let listenerCounter = 0;

function createRecommendationId() {
  recommendationCounter += 1;
  return `dispatch_rec_${Date.now()}_${recommendationCounter}`;
}

function createListenerId() {
  listenerCounter += 1;
  return `dispatch_listener_${Date.now()}_${listenerCounter}`;
}

function normalize(value = '') {
  return String(value || '').trim().toLowerCase();
}

function distanceScore(candidate = {}, assignment = {}) {
  if (!candidate.territoryId || !assignment.territoryId) return 15;
  return candidate.territoryId === assignment.territoryId ? 30 : 5;
}

function roleScore(candidate = {}, assignment = {}) {
  const role = normalize(candidate.role);
  const type = normalize(assignment.assignmentType || assignment.type || 'job');
  const serviceType = normalize(assignment.serviceType || assignment.category || '');

  if (type === 'lead' && ['sales', 'sales_rep'].includes(role)) return 30;
  if (type === 'job' && ['technician', 'cleaner', 'staff'].includes(role)) return 30;
  if (serviceType.includes('clean') && ['technician', 'cleaner'].includes(role)) return 20;
  if (['manager', 'operations_manager', 'admin', 'owner'].includes(role)) return 10;

  return 0;
}

function loadScore(candidate = {}) {
  const score = Number(candidate.availabilityScore || 0);
  return Math.round(score * 0.35);
}

function companyScore(candidate = {}, assignment = {}) {
  if (!assignment.companyId || !candidate.companyId) return 10;
  return candidate.companyId === assignment.companyId ? 20 : 0;
}

function statusScore(candidate = {}) {
  if (candidate.dispatchReady) return 30;
  if (candidate.availabilityState === 'available_soon') return 15;
  if (candidate.availabilityState === 'near_capacity') return 8;
  return 0;
}

function buildCandidateScore(candidate = {}, assignment = {}) {
  const score =
    roleScore(candidate, assignment) +
    distanceScore(candidate, assignment) +
    companyScore(candidate, assignment) +
    statusScore(candidate) +
    loadScore(candidate);

  const reasons = [];
  if (candidate.dispatchReady) reasons.push('dispatch ready');
  if (candidate.territoryId && candidate.territoryId === assignment.territoryId) reasons.push('same territory');
  if (candidate.companyId && candidate.companyId === assignment.companyId) reasons.push('same company');
  if (candidate.availabilityState) reasons.push(candidate.availabilityState.replaceAll('_', ' '));

  return {
    ...candidate,
    dispatchScore: Math.max(0, Math.min(100, score)),
    dispatchReasons: reasons
  };
}

function notifyDispatchSubscribers(recommendation = null) {
  const snapshot = getDispatchRecommendations();

  dispatchListeners.forEach((listener) => {
    try {
      listener(recommendation, snapshot);
    } catch (error) {
      console.error('Dispatch listener failure:', error);
    }
  });
}

export function recommendDispatchAssignment(assignment = {}, options = {}) {
  refreshWorkforceAvailability();

  const candidates = getWorkforceAvailability({
    companyId: options.companyId || assignment.companyId || undefined,
    territoryId: options.strictTerritory ? assignment.territoryId : undefined
  })
    .filter((candidate) => candidate.dispatchReady || options.includeNonReady === true)
    .map((candidate) => buildCandidateScore(candidate, assignment))
    .sort((a, b) => Number(b.dispatchScore || 0) - Number(a.dispatchScore || 0));

  const recommendation = {
    id: assignment.recommendationId || createRecommendationId(),
    assignmentId: assignment.id || assignment.jobId || assignment.leadId || '',
    assignmentType: assignment.assignmentType || assignment.type || 'job',
    companyId: assignment.companyId || '',
    territoryId: assignment.territoryId || '',
    serviceType: assignment.serviceType || assignment.category || '',
    bestCandidate: candidates[0] || null,
    candidates: candidates.slice(0, Number(options.limit || 8)),
    status: candidates.length ? 'recommended' : 'no_candidate',
    createdAtMs: Date.now(),
    metadata: assignment.metadata || {}
  };

  dispatchRecommendations.set(recommendation.id, recommendation);
  notifyDispatchSubscribers(recommendation);

  emitEvent('dispatch.recommendation_created', {
    recommendationId: recommendation.id,
    assignmentId: recommendation.assignmentId,
    assignmentType: recommendation.assignmentType,
    bestCandidateUserId: recommendation.bestCandidate?.userId || '',
    bestCandidateScore: recommendation.bestCandidate?.dispatchScore || 0,
    candidateCount: recommendation.candidates.length,
    status: recommendation.status
  }, {
    source: 'intelligent-dispatch-routing',
    severity: recommendation.status === 'no_candidate' ? 'warning' : 'info',
    correlationId: recommendation.assignmentId || recommendation.id
  });

  return recommendation;
}

export function getDispatchRecommendations(options = {}) {
  let rows = [...dispatchRecommendations.values()];

  if (options.status) rows = rows.filter((row) => row.status === options.status);
  if (options.assignmentType) rows = rows.filter((row) => row.assignmentType === options.assignmentType);
  if (options.companyId) rows = rows.filter((row) => row.companyId === options.companyId);
  if (options.territoryId) rows = rows.filter((row) => row.territoryId === options.territoryId);

  return rows.sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
}

export function summarizeDispatchRecommendations(rows = getDispatchRecommendations()) {
  return rows.reduce((summary, row) => {
    summary.total += 1;
    summary.byStatus[row.status] = (summary.byStatus[row.status] || 0) + 1;
    summary.byType[row.assignmentType] = (summary.byType[row.assignmentType] || 0) + 1;
    if (row.bestCandidate) summary.withCandidate += 1;
    if (row.status === 'no_candidate') summary.noCandidate += 1;
    return summary;
  }, {
    total: 0,
    withCandidate: 0,
    noCandidate: 0,
    byStatus: {},
    byType: {}
  });
}

export function subscribeDispatchRecommendations(callback) {
  if (typeof callback !== 'function') throw new Error('subscribeDispatchRecommendations requires a callback.');

  const listenerId = createListenerId();
  dispatchListeners.set(listenerId, callback);
  callback(null, getDispatchRecommendations());

  return listenerId;
}

export function unsubscribeDispatchRecommendations(listenerId) {
  return dispatchListeners.delete(listenerId);
}

export function clearDispatchRecommendations() {
  dispatchRecommendations.clear();
  notifyDispatchSubscribers(null);
}

window.EvaraIntelligentDispatchRouting = {
  recommendDispatchAssignment,
  getDispatchRecommendations,
  summarizeDispatchRecommendations,
  subscribeDispatchRecommendations,
  unsubscribeDispatchRecommendations,
  clearDispatchRecommendations
};
