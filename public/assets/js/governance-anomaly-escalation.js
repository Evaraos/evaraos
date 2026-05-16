import {
  emitEvent,
  subscribeEvent,
  unsubscribeEvent
} from './operations-events.js';

import {
  createNotification
} from './operations-notifications.js';

import {
  createAutomationAction
} from './operations-automations.js';

import {
  detectGovernanceAnomalies
} from './governance-anomaly-detection.js';

import {
  getAuditEntries,
  subscribeAuditLog,
  unsubscribeAuditLog
} from './audit-log-engine.js';

const escalatedAnomalies = new Set();
let auditSubscriptionId = null;
let eventSubscriptionId = null;

function anomalyFingerprint(anomaly = {}) {
  return [
    anomaly.title || '',
    anomaly.level || '',
    anomaly.category || '',
    JSON.stringify(anomaly.metadata || {})
  ].join('|');
}

function shouldEscalate(anomaly = {}) {
  return ['critical', 'warning'].includes(String(anomaly.level || '').toLowerCase());
}

export function escalateGovernanceAnomaly(anomaly = {}) {
  if (!shouldEscalate(anomaly)) return null;

  const fingerprint = anomalyFingerprint(anomaly);
  if (escalatedAnomalies.has(fingerprint)) return null;
  escalatedAnomalies.add(fingerprint);

  const event = emitEvent('governance.anomaly_detected', {
    anomalyId: anomaly.id,
    title: anomaly.title,
    detail: anomaly.detail,
    level: anomaly.level,
    category: anomaly.category,
    recommendation: anomaly.recommendation,
    metadata: anomaly.metadata || {}
  }, {
    source: 'governance-anomaly-escalation',
    severity: anomaly.level || 'warning',
    correlationId: anomaly.id || null
  });

  const notification = createNotification({
    title: anomaly.title || 'Governance anomaly detected',
    detail: anomaly.detail || 'A governance anomaly requires review.',
    type: 'governance_anomaly',
    level: anomaly.level || 'warning',
    priority: anomaly.level === 'critical' ? 'critical' : 'high',
    audience: 'executive',
    sourceEventId: event.id,
    sourceEventType: event.type,
    actionUrl: './anomaly-dashboard.html',
    actionType: 'review',
    actionLabel: 'Review Anomaly',
    metadata: anomaly
  });

  const action = createAutomationAction({
    title: anomaly.level === 'critical' ? 'Critical governance anomaly review' : 'Governance anomaly review',
    detail: anomaly.recommendation || 'Review the anomaly and related governance records.',
    status: 'queued',
    severity: anomaly.level || 'warning',
    sourceEventId: event.id,
    sourceEventType: event.type,
    actionType: 'governance_review',
    actionUrl: './anomaly-dashboard.html',
    metadata: anomaly
  });

  return {
    event,
    notification,
    action
  };
}

export function runGovernanceAnomalyEscalation(entries = getAuditEntries()) {
  const anomalies = detectGovernanceAnomalies(entries);

  return anomalies
    .map((anomaly) => escalateGovernanceAnomaly(anomaly))
    .filter(Boolean);
}

export function startGovernanceAnomalyEscalation() {
  stopGovernanceAnomalyEscalation();

  auditSubscriptionId = subscribeAuditLog(() => {
    runGovernanceAnomalyEscalation(getAuditEntries());
  });

  eventSubscriptionId = subscribeEvent('governance.anomaly_reset', () => {
    escalatedAnomalies.clear();
  });

  runGovernanceAnomalyEscalation(getAuditEntries());

  return stopGovernanceAnomalyEscalation;
}

export function stopGovernanceAnomalyEscalation() {
  if (auditSubscriptionId) unsubscribeAuditLog(auditSubscriptionId);
  if (eventSubscriptionId) unsubscribeEvent(eventSubscriptionId);
  auditSubscriptionId = null;
  eventSubscriptionId = null;
}

export function clearGovernanceAnomalyEscalations() {
  escalatedAnomalies.clear();
}

export function getGovernanceAnomalyEscalationCount() {
  return escalatedAnomalies.size;
}

window.EvaraGovernanceAnomalyEscalation = {
  escalateGovernanceAnomaly,
  runGovernanceAnomalyEscalation,
  startGovernanceAnomalyEscalation,
  stopGovernanceAnomalyEscalation,
  clearGovernanceAnomalyEscalations,
  getGovernanceAnomalyEscalationCount
};
