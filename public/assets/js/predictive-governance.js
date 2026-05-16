import { getAuditEntries } from './audit-log-engine.js';
import { buildReplayTimelines } from './compliance-replay.js';
import { detectGovernanceAnomalies } from './governance-anomaly-detection.js';

function normalize(value = '') {
  return String(value || '').trim().toLowerCase();
}

function timestamp(entry = {}) {
  return Number(entry.createdAtMs || entry.timestamp || 0);
}

function percent(part = 0, total = 0) {
  if (!total) return 0;
  return Number(((Number(part || 0) / Number(total || 0)) * 100).toFixed(1));
}

function recentEntries(entries = [], minutes = 60) {
  const cutoff = Date.now() - (minutes * 60 * 1000);
  return entries.filter((entry) => timestamp(entry) >= cutoff);
}

export function calculateAnomalyVelocity(entries = getAuditEntries()) {
  const lastHour = recentEntries(entries, 60);
  const previousHour = entries.filter((entry) => {
    const time = timestamp(entry);
    return time >= Date.now() - (120 * 60 * 1000) && time < Date.now() - (60 * 60 * 1000);
  });

  const currentCritical = lastHour.filter((entry) => normalize(entry.severity) === 'critical').length;
  const previousCritical = previousHour.filter((entry) => normalize(entry.severity) === 'critical').length;

  const velocity = currentCritical - previousCritical;

  return {
    currentCritical,
    previousCritical,
    velocity,
    accelerationRisk: velocity > 3 ? 'critical' : velocity > 1 ? 'warning' : 'stable'
  };
}

export function calculateReplayInstabilityForecast(timelines = buildReplayTimelines()) {
  const unstable = timelines.filter((timeline) => {
    const severities = timeline.summary?.severities || [];
    return severities.includes('critical') || Number(timeline.summary?.count || 0) >= 6;
  });

  const longChains = unstable.filter((timeline) => Number(timeline.summary?.count || 0) >= 10).length;

  const forecastScore = Math.min(100, Number(((unstable.length * 7) + (longChains * 12)).toFixed(1)));

  return {
    unstableChains: unstable.length,
    longChains,
    forecastScore,
    projectedRisk: forecastScore >= 70 ? 'critical' : forecastScore >= 40 ? 'high' : forecastScore >= 20 ? 'medium' : 'low'
  };
}

export function calculateGovernanceTrendForecast(entries = getAuditEntries()) {
  const anomalies = detectGovernanceAnomalies(entries);

  const critical = anomalies.filter((anomaly) => anomaly.level === 'critical').length;
  const warning = anomalies.filter((anomaly) => anomaly.level === 'warning').length;

  const momentum = Number(((critical * 2.5) + (warning * 1.2)).toFixed(1));

  return {
    criticalSignals: critical,
    warningSignals: warning,
    momentum,
    projectedDirection: momentum >= 25 ? 'degrading' : momentum >= 12 ? 'unstable' : 'stable'
  };
}

export function calculatePredictiveGovernanceScore(entries = getAuditEntries()) {
  const velocity = calculateAnomalyVelocity(entries);
  const replay = calculateReplayInstabilityForecast(buildReplayTimelines(entries));
  const trends = calculateGovernanceTrendForecast(entries);

  const score = Math.min(100,
    Number((
      (Math.max(0, velocity.velocity) * 8) +
      (replay.forecastScore * 0.45) +
      (trends.momentum * 1.8)
    ).toFixed(1))
  );

  let level = 'stable';
  if (score >= 75) level = 'critical';
  else if (score >= 50) level = 'high';
  else if (score >= 25) level = 'elevated';

  return {
    score,
    level,
    velocity,
    replay,
    trends,
    generatedAtMs: Date.now()
  };
}

export function buildPredictiveGovernanceForecast(entries = getAuditEntries()) {
  const prediction = calculatePredictiveGovernanceScore(entries);

  return {
    ...prediction,
    recommendations: [
      prediction.level === 'critical'
        ? 'Escalate governance review immediately and inspect replay chains.'
        : 'Continue monitoring governance velocity and replay instability.',
      prediction.replay.projectedRisk === 'critical'
        ? 'Investigate long replay chains for unresolved operational loops.'
        : 'Replay systems are operating within acceptable predictive thresholds.'
    ]
  };
}

window.EvaraPredictiveGovernance = {
  calculateAnomalyVelocity,
  calculateReplayInstabilityForecast,
  calculateGovernanceTrendForecast,
  calculatePredictiveGovernanceScore,
  buildPredictiveGovernanceForecast
};
