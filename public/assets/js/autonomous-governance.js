import { emitEvent } from './operations-events.js';
import { createNotification } from './operations-notifications.js';
import { createAutomationAction } from './operations-automations.js';
import { getAuditEntries } from './audit-log-engine.js';
import { buildPredictiveGovernanceForecast } from './predictive-governance.js';
import { detectGovernanceAnomalies } from './governance-anomaly-detection.js';

const interventionRegistry = new Map();
let interventionCounter = 0;

function createInterventionId() {
  interventionCounter += 1;
  return `gov_int_${Date.now()}_${interventionCounter}`;
}

function normalizeLevel(value = 'info') {
  const level = String(value || 'info').trim().toLowerCase();
  if (['critical', 'high', 'warning', 'elevated', 'stable', 'info'].includes(level)) return level;
  return 'info';
}

function createIntervention(input = {}) {
  const intervention = {
    id: input.id || createInterventionId(),
    title: input.title || 'Governance intervention recommended',
    detail: input.detail || '',
    level: normalizeLevel(input.level),
    interventionType: input.interventionType || 'review',
    mode: input.mode || 'recommendation',
    status: input.status || 'queued',
    actionUrl: input.actionUrl || './anomaly-dashboard.html',
    recommendation: input.recommendation || 'Review governance state before intervention.',
    metadata: input.metadata || {},
    createdAtMs: Date.now()
  };

  interventionRegistry.set(intervention.id, intervention);
  return intervention;
}

function routeIntervention(intervention = {}) {
  const event = emitEvent('governance.intervention_recommended', intervention, {
    source: 'autonomous-governance',
    severity: intervention.level === 'critical' ? 'critical' : 'warning',
    correlationId: intervention.id
  });

  const notification = createNotification({
    title: intervention.title,
    detail: intervention.detail,
    type: 'governance_intervention',
    level: intervention.level === 'critical' ? 'critical' : 'warning',
    priority: intervention.level === 'critical' ? 'critical' : 'high',
    audience: 'executive',
    sourceEventId: event.id,
    sourceEventType: event.type,
    actionUrl: intervention.actionUrl,
    actionType: 'review',
    actionLabel: 'Review Intervention',
    metadata: intervention
  });

  const action = createAutomationAction({
    title: intervention.title,
    detail: intervention.recommendation,
    status: 'queued',
    severity: intervention.level === 'critical' ? 'critical' : 'warning',
    sourceEventId: event.id,
    sourceEventType: event.type,
    actionType: intervention.interventionType,
    actionUrl: intervention.actionUrl,
    metadata: intervention
  });

  return { event, notification, action };
}

export function recommendGovernanceInterventions(entries = getAuditEntries()) {
  const forecast = buildPredictiveGovernanceForecast(entries);
  const anomalies = detectGovernanceAnomalies(entries);
  const interventions = [];

  if (['critical', 'high'].includes(forecast.level)) {
    interventions.push(createIntervention({
      title: 'Predictive governance intervention recommended',
      detail: `Predictive governance risk is ${forecast.level} with score ${forecast.score}.`,
      level: forecast.level,
      interventionType: 'predictive_governance_review',
      recommendation: 'Review escalation velocity, replay instability, and anomaly trends before conditions degrade further.',
      metadata: forecast
    }));
  }

  if (forecast.replay?.projectedRisk === 'critical') {
    interventions.push(createIntervention({
      title: 'Replay stabilization recommended',
      detail: 'Replay instability forecast indicates critical risk.',
      level: 'critical',
      interventionType: 'replay_stabilization_review',
      actionUrl: './replay-dashboard.html',
      recommendation: 'Inspect long replay chains and preserve forensic context for unstable workflows.',
      metadata: forecast.replay
    }));
  }

  const criticalAnomalies = anomalies.filter((anomaly) => anomaly.level === 'critical');
  if (criticalAnomalies.length >= 3) {
    interventions.push(createIntervention({
      title: 'Governance safe-mode review recommended',
      detail: `${criticalAnomalies.length} critical anomalies are active.`,
      level: 'critical',
      interventionType: 'safe_mode_review',
      recommendation: 'Consider pausing risky automation paths and routing governance activity through executive review.',
      metadata: { criticalAnomalies }
    }));
  }

  return interventions;
}

export function runAutonomousGovernanceInterventions(entries = getAuditEntries()) {
  const interventions = recommendGovernanceInterventions(entries);
  return interventions.map((intervention) => ({
    intervention,
    routed: routeIntervention(intervention)
  }));
}

export function getGovernanceInterventions(options = {}) {
  let rows = [...interventionRegistry.values()];

  if (options.status) rows = rows.filter((row) => row.status === options.status);
  if (options.level) rows = rows.filter((row) => row.level === options.level);
  if (options.interventionType) rows = rows.filter((row) => row.interventionType === options.interventionType);

  return rows.sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
}

export function updateGovernanceIntervention(interventionId, patch = {}) {
  const intervention = interventionRegistry.get(interventionId);
  if (!intervention) return null;

  const updated = {
    ...intervention,
    ...patch,
    updatedAtMs: Date.now()
  };

  interventionRegistry.set(interventionId, updated);
  return updated;
}

export function clearGovernanceInterventions() {
  interventionRegistry.clear();
}

window.EvaraAutonomousGovernance = {
  recommendGovernanceInterventions,
  runAutonomousGovernanceInterventions,
  getGovernanceInterventions,
  updateGovernanceIntervention,
  clearGovernanceInterventions
};
