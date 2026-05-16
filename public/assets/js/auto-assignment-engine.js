import { emitEvent } from './operations-events.js';
import { createAutomationAction } from './operations-automations.js';
import {
  recommendDispatchAssignment,
  getDispatchRecommendations,
  subscribeDispatchRecommendations,
  unsubscribeDispatchRecommendations
} from './intelligent-dispatch-routing.js';

const assignmentQueue = new Map();
const assignmentListeners = new Map();

let assignmentCounter = 0;
let listenerCounter = 0;
let dispatchSubscriptionId = null;

const DEFAULT_AUTO_ASSIGNMENT_THRESHOLD = 70;

function createAssignmentId() {
  assignmentCounter += 1;
  return `auto_assign_${Date.now()}_${assignmentCounter}`;
}

function createListenerId() {
  listenerCounter += 1;
  return `assignment_listener_${Date.now()}_${listenerCounter}`;
}

function normalizeStatus(value = 'queued') {
  const status = String(value || 'queued').trim().toLowerCase();
  if (['queued', 'recommended', 'approved', 'assigned', 'rejected', 'failed', 'no_candidate'].includes(status)) return status;
  return 'queued';
}

function notifyAssignmentSubscribers(item = null) {
  const snapshot = getAutoAssignments();

  assignmentListeners.forEach((listener) => {
    try {
      listener(item, snapshot);
    } catch (error) {
      console.error('Auto-assignment listener failure:', error);
    }
  });
}

function buildAutoAssignment(recommendation = {}, options = {}) {
  const best = recommendation.bestCandidate || null;
  const threshold = Number(options.threshold || DEFAULT_AUTO_ASSIGNMENT_THRESHOLD);
  const score = Number(best?.dispatchScore || 0);
  const eligible = Boolean(best && score >= threshold);

  return {
    id: options.id || createAssignmentId(),
    recommendationId: recommendation.id || '',
    assignmentId: recommendation.assignmentId || '',
    assignmentType: recommendation.assignmentType || 'job',
    companyId: recommendation.companyId || '',
    territoryId: recommendation.territoryId || '',
    candidateUserId: best?.userId || '',
    candidateName: best?.displayName || '',
    candidateRole: best?.role || '',
    score,
    threshold,
    eligible,
    status: eligible ? 'recommended' : 'no_candidate',
    mode: options.mode || 'review_required',
    reason: eligible
      ? `Best candidate scored ${score} and meets assignment threshold ${threshold}.`
      : `No candidate met assignment threshold ${threshold}.`,
    recommendation,
    createdAtMs: Date.now(),
    metadata: options.metadata || {}
  };
}

export function queueAutoAssignment(assignment = {}, options = {}) {
  const recommendation = options.recommendation || recommendDispatchAssignment(assignment, options);
  const item = buildAutoAssignment(recommendation, options);

  assignmentQueue.set(item.id, item);
  notifyAssignmentSubscribers(item);

  emitEvent('dispatch.auto_assignment_queued', {
    autoAssignmentId: item.id,
    recommendationId: item.recommendationId,
    assignmentId: item.assignmentId,
    assignmentType: item.assignmentType,
    candidateUserId: item.candidateUserId,
    score: item.score,
    threshold: item.threshold,
    eligible: item.eligible,
    status: item.status
  }, {
    source: 'auto-assignment-engine',
    severity: item.eligible ? 'info' : 'warning',
    correlationId: item.assignmentId || item.id
  });

  createAutomationAction({
    title: item.eligible ? 'Review recommended assignment' : 'Dispatch assignment needs manual review',
    detail: item.reason,
    status: 'queued',
    severity: item.eligible ? 'info' : 'warning',
    sourceEventId: item.id,
    sourceEventType: 'dispatch.auto_assignment_queued',
    actionType: 'assignment_review',
    actionUrl: './jobs.html',
    metadata: item
  });

  return item;
}

export function approveAutoAssignment(autoAssignmentId, approvedBy = {}) {
  const item = assignmentQueue.get(autoAssignmentId);
  if (!item) return null;

  const updated = {
    ...item,
    status: 'approved',
    approvedAtMs: Date.now(),
    approvedBy
  };

  assignmentQueue.set(autoAssignmentId, updated);
  notifyAssignmentSubscribers(updated);

  emitEvent('dispatch.auto_assignment_approved', {
    autoAssignmentId,
    assignmentId: updated.assignmentId,
    assignmentType: updated.assignmentType,
    candidateUserId: updated.candidateUserId,
    approvedBy
  }, {
    source: 'auto-assignment-engine',
    severity: 'success',
    correlationId: updated.assignmentId || autoAssignmentId
  });

  return updated;
}

export function rejectAutoAssignment(autoAssignmentId, rejectedBy = {}, reason = '') {
  const item = assignmentQueue.get(autoAssignmentId);
  if (!item) return null;

  const updated = {
    ...item,
    status: 'rejected',
    rejectedAtMs: Date.now(),
    rejectedBy,
    rejectionReason: reason
  };

  assignmentQueue.set(autoAssignmentId, updated);
  notifyAssignmentSubscribers(updated);

  emitEvent('dispatch.auto_assignment_rejected', {
    autoAssignmentId,
    assignmentId: updated.assignmentId,
    assignmentType: updated.assignmentType,
    candidateUserId: updated.candidateUserId,
    rejectedBy,
    reason
  }, {
    source: 'auto-assignment-engine',
    severity: 'warning',
    correlationId: updated.assignmentId || autoAssignmentId
  });

  return updated;
}

export function markAutoAssignmentAssigned(autoAssignmentId, patch = {}) {
  const item = assignmentQueue.get(autoAssignmentId);
  if (!item) return null;

  const updated = {
    ...item,
    ...patch,
    status: 'assigned',
    assignedAtMs: Date.now()
  };

  assignmentQueue.set(autoAssignmentId, updated);
  notifyAssignmentSubscribers(updated);

  emitEvent('dispatch.auto_assignment_completed', {
    autoAssignmentId,
    assignmentId: updated.assignmentId,
    assignmentType: updated.assignmentType,
    candidateUserId: updated.candidateUserId
  }, {
    source: 'auto-assignment-engine',
    severity: 'success',
    correlationId: updated.assignmentId || autoAssignmentId
  });

  return updated;
}

export function getAutoAssignments(options = {}) {
  let rows = [...assignmentQueue.values()];

  if (options.status) rows = rows.filter((row) => row.status === normalizeStatus(options.status));
  if (options.assignmentType) rows = rows.filter((row) => row.assignmentType === options.assignmentType);
  if (options.companyId) rows = rows.filter((row) => row.companyId === options.companyId);
  if (options.territoryId) rows = rows.filter((row) => row.territoryId === options.territoryId);
  if (options.eligible === true) rows = rows.filter((row) => row.eligible === true);

  return rows.sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
}

export function summarizeAutoAssignments(rows = getAutoAssignments()) {
  return rows.reduce((summary, row) => {
    summary.total += 1;
    summary.byStatus[row.status] = (summary.byStatus[row.status] || 0) + 1;
    summary.byType[row.assignmentType] = (summary.byType[row.assignmentType] || 0) + 1;
    if (row.eligible) summary.eligible += 1;
    if (row.status === 'no_candidate') summary.noCandidate += 1;
    return summary;
  }, {
    total: 0,
    eligible: 0,
    noCandidate: 0,
    byStatus: {},
    byType: {}
  });
}

export function subscribeAutoAssignments(callback) {
  if (typeof callback !== 'function') throw new Error('subscribeAutoAssignments requires a callback.');

  const listenerId = createListenerId();
  assignmentListeners.set(listenerId, callback);
  callback(null, getAutoAssignments());

  return listenerId;
}

export function unsubscribeAutoAssignments(listenerId) {
  return assignmentListeners.delete(listenerId);
}

export function startAutoAssignmentEngine(options = {}) {
  stopAutoAssignmentEngine();

  dispatchSubscriptionId = subscribeDispatchRecommendations((recommendation) => {
    if (!recommendation || recommendation.status !== 'recommended') return;
    if (options.autoQueue === false) return;

    queueAutoAssignment({}, {
      ...options,
      recommendation
    });
  });

  getDispatchRecommendations({ status: 'recommended' }).forEach((recommendation) => {
    if (options.autoQueue === false) return;
    queueAutoAssignment({}, {
      ...options,
      recommendation
    });
  });

  return stopAutoAssignmentEngine;
}

export function stopAutoAssignmentEngine() {
  if (dispatchSubscriptionId) unsubscribeDispatchRecommendations(dispatchSubscriptionId);
  dispatchSubscriptionId = null;
}

export function clearAutoAssignments() {
  assignmentQueue.clear();
  notifyAssignmentSubscribers(null);
}

window.EvaraAutoAssignmentEngine = {
  queueAutoAssignment,
  approveAutoAssignment,
  rejectAutoAssignment,
  markAutoAssignmentAssigned,
  getAutoAssignments,
  summarizeAutoAssignments,
  subscribeAutoAssignments,
  unsubscribeAutoAssignments,
  startAutoAssignmentEngine,
  stopAutoAssignmentEngine,
  clearAutoAssignments
};
