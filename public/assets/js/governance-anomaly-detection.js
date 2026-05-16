import { getAuditEntries } from './audit-log-engine.js';
import { buildReplayTimelines } from './compliance-replay.js';
import { buildGovernanceAnalytics } from './governance-analytics.js';

const DEFAULT_ANOMALY_THRESHOLDS = Object.freeze({
  criticalRate: 15,
  warningRate: 35,
  minimumCorrelationRate: 60,
  longTimelineEvents: 8,
  hotspotRiskWeight: 12,
  staleCriticalMinutes: 60
});

function normalize(value = '') {
  return String(value || '').trim().toLowerCase();
}

function minutesSince(ms = 0) {
  if (!ms) return 0;
  return Math.max(0, Math.round((Date.now() - Number(ms)) / 60000));
}

function createAnomaly(input = {}) {
  return {
    id: input.id || `anom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: input.title || 'Governance anomaly detected',
    detail: input.detail || '',
    level: input.level || 'info',
    category: input.category || 'governance',
    source: input.source || 'governance-anomaly-detection',
    recommendation: input.recommendation || 'Review the related governance records.',
    metadata: input.metadata || {},
    createdAtMs: Date.now()
  };
}

function mergeThresholds(thresholds = {}) {
  return {
    ...DEFAULT_ANOMALY_THRESHOLDS,
    ...thresholds
  };
}

export function detectAuditAnomalies(entries = getAuditEntries(), thresholds = {}) {
  const config = mergeThresholds(thresholds);
  const analytics = buildGovernanceAnalytics(entries);
  const audit = analytics.auditMetrics || {};
  const anomalies = [];

  if (Number(audit.criticalRate || 0) >= config.criticalRate) {
    anomalies.push(createAnomaly({
      title: 'Critical event density is elevated',
      detail: `${audit.criticalRate}% of audit entries are critical severity.`,
      level: 'critical',
      category: 'audit',
      recommendation: 'Review critical event sources and executive escalation history.',
      metadata: { criticalRate: audit.criticalRate, threshold: config.criticalRate }
    }));
  }

  if (Number(audit.warningRate || 0) >= config.warningRate) {
    anomalies.push(createAnomaly({
      title: 'Warning event density is elevated',
      detail: `${audit.warningRate}% of audit entries are warning severity.`,
      level: 'warning',
      category: 'audit',
      recommendation: 'Review warning-heavy workflow categories for operational instability.',
      metadata: { warningRate: audit.warningRate, threshold: config.warningRate }
    }));
  }

  if (Number(audit.correlationRate || 0) < config.minimumCorrelationRate && Number(audit.total || 0) > 0) {
    anomalies.push(createAnomaly({
      title: 'Correlation integrity is below target',
      detail: `${audit.correlationRate}% of audit entries include correlation IDs.`,
      level: 'warning',
      category: 'correlation',
      recommendation: 'Improve event correlation IDs so replay and forensic reconstruction are stronger.',
      metadata: { correlationRate: audit.correlationRate, threshold: config.minimumCorrelationRate }
    }));
  }

  return anomalies;
}

export function detectReplayAnomalies(timelines = buildReplayTimelines(), thresholds = {}) {
  const config = mergeThresholds(thresholds);
  const anomalies = [];

  timelines.forEach((timeline) => {
    const count = Number(timeline.summary?.count || 0);
    const hasCritical = (timeline.summary?.severities || []).includes('critical');
    const latestAtMs = Number(timeline.summary?.lastAtMs || 0);
    const age = minutesSince(latestAtMs);

    if (count >= config.longTimelineEvents) {
      anomalies.push(createAnomaly({
        title: 'Long governance replay chain detected',
        detail: `Timeline ${timeline.correlationId} contains ${count} events.`,
        level: hasCritical ? 'critical' : 'warning',
        category: 'replay',
        recommendation: 'Inspect the replay chain for loops, repeated escalations, or unresolved workflows.',
        metadata: { correlationId: timeline.correlationId, count, threshold: config.longTimelineEvents }
      }));
    }

    if (hasCritical && age >= config.staleCriticalMinutes) {
      anomalies.push(createAnomaly({
        title: 'Critical replay chain may be stale',
        detail: `Critical timeline ${timeline.correlationId} has not changed for ${age} minutes.`,
        level: 'critical',
        category: 'replay',
        recommendation: 'Confirm whether the related critical escalation has been resolved or needs executive review.',
        metadata: { correlationId: timeline.correlationId, ageMinutes: age, threshold: config.staleCriticalMinutes }
      }));
    }
  });

  return anomalies;
}

export function detectHotspotAnomalies(entries = getAuditEntries(), thresholds = {}) {
  const config = mergeThresholds(thresholds);
  const analytics = buildGovernanceAnalytics(entries);
  const hotspots = analytics.hotspots || [];

  return hotspots
    .filter((hotspot) => Number(hotspot.riskWeight || 0) >= config.hotspotRiskWeight)
    .map((hotspot) => createAnomaly({
      title: 'Governance hotspot detected',
      detail: `${hotspot.category} has a risk weight of ${hotspot.riskWeight}.`,
      level: Number(hotspot.critical || 0) > 0 ? 'critical' : 'warning',
      category: 'hotspot',
      recommendation: 'Review this category for operational concentration, repeated warnings, or automation instability.',
      metadata: hotspot
    }));
}

export function detectGovernanceAnomalies(entries = getAuditEntries(), thresholds = {}) {
  const timelines = buildReplayTimelines(entries);
  const anomalies = [
    ...detectAuditAnomalies(entries, thresholds),
    ...detectReplayAnomalies(timelines, thresholds),
    ...detectHotspotAnomalies(entries, thresholds)
  ];

  const priority = { critical: 0, warning: 1, info: 2 };

  return anomalies.sort((a, b) => (priority[normalize(a.level)] ?? 9) - (priority[normalize(b.level)] ?? 9));
}

export function summarizeGovernanceAnomalies(anomalies = detectGovernanceAnomalies()) {
  return anomalies.reduce((summary, anomaly) => {
    summary.total += 1;
    summary.byLevel[anomaly.level] = (summary.byLevel[anomaly.level] || 0) + 1;
    summary.byCategory[anomaly.category] = (summary.byCategory[anomaly.category] || 0) + 1;
    return summary;
  }, {
    total: 0,
    byLevel: {},
    byCategory: {}
  });
}

window.EvaraGovernanceAnomalyDetection = {
  DEFAULT_ANOMALY_THRESHOLDS,
  detectAuditAnomalies,
  detectReplayAnomalies,
  detectHotspotAnomalies,
  detectGovernanceAnomalies,
  summarizeGovernanceAnomalies
};
