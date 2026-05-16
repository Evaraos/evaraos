import {
  getAuditEntries
} from './audit-log-engine.js';

import {
  buildReplayTimelines
} from './compliance-replay.js';

function normalize(value = '') {
  return String(value || '').trim().toLowerCase();
}

function percent(part = 0, total = 0) {
  if (!total) return 0;
  return Number(((Number(part || 0) / Number(total || 0)) * 100).toFixed(1));
}

function timestamp(entry = {}) {
  return Number(entry.createdAtMs || entry.timestamp || 0);
}

function ageMinutes(ms = 0) {
  if (!ms) return 0;
  return Math.max(0, Math.round((Date.now() - Number(ms)) / 60000));
}

export function calculateAuditGovernanceMetrics(entries = getAuditEntries()) {
  const total = entries.length;
  const critical = entries.filter((entry) => normalize(entry.severity) === 'critical').length;
  const warning = entries.filter((entry) => normalize(entry.severity) === 'warning').length;
  const automation = entries.filter((entry) => normalize(entry.category) === 'automation').length;
  const notification = entries.filter((entry) => normalize(entry.category) === 'notification').length;
  const alert = entries.filter((entry) => normalize(entry.category) === 'alert').length;
  const correlated = entries.filter((entry) => entry.correlationId).length;

  return {
    total,
    critical,
    warning,
    automation,
    notification,
    alert,
    correlated,
    criticalRate: percent(critical, total),
    warningRate: percent(warning, total),
    correlationRate: percent(correlated, total)
  };
}

export function calculateReplayGovernanceMetrics(timelines = buildReplayTimelines()) {
  const totalTimelines = timelines.length;
  const totalEvents = timelines.reduce((sum, timeline) => sum + Number(timeline.summary?.count || 0), 0);
  const criticalTimelines = timelines.filter((timeline) => (timeline.summary?.severities || []).includes('critical')).length;
  const warningTimelines = timelines.filter((timeline) => (timeline.summary?.severities || []).includes('warning')).length;
  const multiEventTimelines = timelines.filter((timeline) => Number(timeline.summary?.count || 0) > 1).length;

  const longestTimeline = timelines.reduce((winner, timeline) => {
    const count = Number(timeline.summary?.count || 0);
    return count > Number(winner.summary?.count || 0) ? timeline : winner;
  }, { summary: { count: 0 } });

  return {
    totalTimelines,
    totalEvents,
    criticalTimelines,
    warningTimelines,
    multiEventTimelines,
    criticalTimelineRate: percent(criticalTimelines, totalTimelines),
    reconstructionRate: percent(multiEventTimelines, totalTimelines),
    averageEventsPerTimeline: totalTimelines ? Number((totalEvents / totalTimelines).toFixed(1)) : 0,
    longestTimelineId: longestTimeline.id || '',
    longestTimelineEvents: Number(longestTimeline.summary?.count || 0)
  };
}

export function calculateGovernanceRiskScore(entries = getAuditEntries(), timelines = buildReplayTimelines(entries)) {
  const audit = calculateAuditGovernanceMetrics(entries);
  const replay = calculateReplayGovernanceMetrics(timelines);

  let score = 0;
  score += audit.criticalRate * 2.5;
  score += audit.warningRate * 1.2;
  score += replay.criticalTimelineRate * 2;
  score += Math.max(0, 100 - audit.correlationRate) * 0.35;

  const normalizedScore = Math.min(100, Number(score.toFixed(1)));

  let level = 'low';
  if (normalizedScore >= 70) level = 'critical';
  else if (normalizedScore >= 45) level = 'high';
  else if (normalizedScore >= 25) level = 'medium';

  return {
    score: normalizedScore,
    level,
    audit,
    replay
  };
}

export function findGovernanceHotspots(entries = getAuditEntries()) {
  const grouped = entries.reduce((groups, entry) => {
    const category = normalize(entry.category || 'system');
    groups[category] = groups[category] || {
      category,
      total: 0,
      critical: 0,
      warning: 0,
      latestAtMs: 0
    };

    groups[category].total += 1;
    if (normalize(entry.severity) === 'critical') groups[category].critical += 1;
    if (normalize(entry.severity) === 'warning') groups[category].warning += 1;
    groups[category].latestAtMs = Math.max(groups[category].latestAtMs, timestamp(entry));

    return groups;
  }, {});

  return Object.values(grouped)
    .map((row) => ({
      ...row,
      riskWeight: row.critical * 4 + row.warning * 2 + row.total,
      latestAgeMinutes: ageMinutes(row.latestAtMs)
    }))
    .sort((a, b) => b.riskWeight - a.riskWeight);
}

export function buildGovernanceAnalytics(entries = getAuditEntries()) {
  const timelines = buildReplayTimelines(entries);

  return {
    generatedAtMs: Date.now(),
    auditMetrics: calculateAuditGovernanceMetrics(entries),
    replayMetrics: calculateReplayGovernanceMetrics(timelines),
    risk: calculateGovernanceRiskScore(entries, timelines),
    hotspots: findGovernanceHotspots(entries),
    timelines
  };
}

window.EvaraGovernanceAnalytics = {
  calculateAuditGovernanceMetrics,
  calculateReplayGovernanceMetrics,
  calculateGovernanceRiskScore,
  findGovernanceHotspots,
  buildGovernanceAnalytics
};
