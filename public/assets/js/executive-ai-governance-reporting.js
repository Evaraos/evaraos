import { getAuditEntries } from './audit-log-engine.js';
import { buildGovernanceAnalytics } from './governance-analytics.js';
import { detectGovernanceAnomalies } from './governance-anomaly-detection.js';
import { buildPredictiveGovernanceForecast } from './predictive-governance.js';
import { getGovernanceInterventions } from './autonomous-governance.js';

function label(value = '') {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function topRows(rows = [], limit = 5) {
  return rows.slice(0, limit);
}

function buildExecutiveSummary(analytics, forecast, anomalies, interventions) {
  const risk = analytics.risk || {};
  const anomalyCount = anomalies.length;
  const interventionCount = interventions.length;

  if (forecast.level === 'critical' || risk.level === 'critical') {
    return `Governance risk is elevated to critical. Predictive scoring shows ${forecast.score || 0}, with ${anomalyCount} anomaly signal(s) and ${interventionCount} intervention recommendation(s). Leadership review is recommended immediately.`;
  }

  if (forecast.level === 'high' || risk.level === 'high') {
    return `Governance risk is high. Predictive scoring shows ${forecast.score || 0}, with ${anomalyCount} anomaly signal(s). Leadership should review hotspots and replay instability before escalation increases.`;
  }

  if (forecast.level === 'elevated' || risk.level === 'medium') {
    return `Governance risk is elevated but manageable. The platform detected ${anomalyCount} anomaly signal(s). Continue monitoring trend velocity, correlation integrity, and replay chain depth.`;
  }

  return `Governance systems appear stable. Predictive scoring shows ${forecast.score || 0}, with ${anomalyCount} anomaly signal(s). Continue standard monitoring and preserve audit/replay integrity.`;
}

function buildKeyFindings(analytics, forecast, anomalies) {
  const audit = analytics.auditMetrics || {};
  const replay = analytics.replayMetrics || {};
  const hotspots = analytics.hotspots || [];
  const findings = [];

  findings.push(`Predictive governance level is ${label(forecast.level || 'stable')} with score ${forecast.score || 0}.`);
  findings.push(`Audit correlation integrity is ${audit.correlationRate || 0}%.`);
  findings.push(`Replay reconstruction rate is ${replay.reconstructionRate || 0}% across ${replay.totalTimelines || 0} timeline(s).`);

  if (hotspots.length) {
    findings.push(`Top governance hotspot is ${label(hotspots[0].category)} with risk weight ${hotspots[0].riskWeight}.`);
  }

  if (anomalies.length) {
    const critical = anomalies.filter((anomaly) => anomaly.level === 'critical').length;
    const warning = anomalies.filter((anomaly) => anomaly.level === 'warning').length;
    findings.push(`${critical} critical anomaly signal(s) and ${warning} warning signal(s) are active.`);
  }

  return findings;
}

function buildRecommendedActions(forecast, anomalies, interventions) {
  const actions = [];

  if (forecast.recommendations?.length) actions.push(...forecast.recommendations);

  topRows(anomalies, 3).forEach((anomaly) => {
    if (anomaly.recommendation) actions.push(anomaly.recommendation);
  });

  topRows(interventions, 3).forEach((intervention) => {
    if (intervention.recommendation) actions.push(intervention.recommendation);
  });

  return [...new Set(actions)].slice(0, 8);
}

export function buildExecutiveGovernanceReport(entries = getAuditEntries()) {
  const analytics = buildGovernanceAnalytics(entries);
  const forecast = buildPredictiveGovernanceForecast(entries);
  const anomalies = detectGovernanceAnomalies(entries);
  const interventions = getGovernanceInterventions();

  return {
    id: `exec_gov_report_${Date.now()}`,
    generatedAtMs: Date.now(),
    title: 'Executive Governance Intelligence Report',
    summary: buildExecutiveSummary(analytics, forecast, anomalies, interventions),
    keyFindings: buildKeyFindings(analytics, forecast, anomalies),
    recommendedActions: buildRecommendedActions(forecast, anomalies, interventions),
    metrics: {
      governanceRisk: analytics.risk,
      predictiveForecast: forecast,
      auditMetrics: analytics.auditMetrics,
      replayMetrics: analytics.replayMetrics,
      anomalyCount: anomalies.length,
      interventionCount: interventions.length
    },
    hotspots: topRows(analytics.hotspots || [], 8),
    anomalies: topRows(anomalies, 10),
    interventions: topRows(interventions, 10)
  };
}

export function formatExecutiveGovernanceReport(report = buildExecutiveGovernanceReport()) {
  const findings = (report.keyFindings || []).map((item) => `- ${item}`).join('\n');
  const actions = (report.recommendedActions || []).map((item) => `- ${item}`).join('\n');

  return `# ${report.title}\n\n${report.summary}\n\n## Key Findings\n${findings || '- No key findings.'}\n\n## Recommended Actions\n${actions || '- Continue standard monitoring.'}`;
}

window.EvaraExecutiveAIGovernanceReporting = {
  buildExecutiveGovernanceReport,
  formatExecutiveGovernanceReport
};
