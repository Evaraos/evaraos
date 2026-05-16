const DEFAULT_THRESHOLDS = Object.freeze({
  minimumLeadConversionRate: 20,
  minimumJobCompletionRate: 70,
  minimumTerritoryCompletionRate: 60,
  minimumRevenue: 0,
  highActiveJobCount: 20,
  highLostLeadRate: 35
});

function numberValue(value = 0) {
  return Number(value || 0);
}

function makeAlert(level = 'info', title = '', detail = '', meta = {}) {
  return {
    level,
    title,
    detail,
    meta,
    createdAtMs: Date.now()
  };
}

function mergeThresholds(thresholds = {}) {
  return {
    ...DEFAULT_THRESHOLDS,
    ...thresholds
  };
}

export function evaluateLeadAlerts(leadAnalytics = {}, thresholds = {}) {
  const config = mergeThresholds(thresholds);
  const alerts = [];
  const total = numberValue(leadAnalytics.total);
  const lost = numberValue(leadAnalytics.lost);
  const conversionRate = numberValue(leadAnalytics.conversionRate);
  const lostRate = total ? Number(((lost / total) * 100).toFixed(1)) : 0;

  if (total > 0 && conversionRate < config.minimumLeadConversionRate) {
    alerts.push(makeAlert(
      'warning',
      'Lead conversion below target',
      'Current conversion rate is ' + conversionRate + '%, below the ' + config.minimumLeadConversionRate + '% threshold.',
      { conversionRate, threshold: config.minimumLeadConversionRate }
    ));
  }

  if (total > 0 && lostRate >= config.highLostLeadRate) {
    alerts.push(makeAlert(
      'critical',
      'Lost lead rate is high',
      'Lost lead rate is ' + lostRate + '%, which needs review.',
      { lostRate, threshold: config.highLostLeadRate }
    ));
  }

  return alerts;
}

export function evaluateJobAlerts(jobAnalytics = {}, thresholds = {}) {
  const config = mergeThresholds(thresholds);
  const alerts = [];
  const total = numberValue(jobAnalytics.total);
  const active = numberValue(jobAnalytics.active);
  const completionRate = numberValue(jobAnalytics.completionRate);
  const revenue = numberValue(jobAnalytics.revenue);

  if (total > 0 && completionRate < config.minimumJobCompletionRate) {
    alerts.push(makeAlert(
      'warning',
      'Job completion below target',
      'Current job completion rate is ' + completionRate + '%, below the ' + config.minimumJobCompletionRate + '% threshold.',
      { completionRate, threshold: config.minimumJobCompletionRate }
    ));
  }

  if (active >= config.highActiveJobCount) {
    alerts.push(makeAlert(
      'info',
      'High active job load',
      active + ' jobs are currently active. Dispatch capacity should be reviewed.',
      { active, threshold: config.highActiveJobCount }
    ));
  }

  if (config.minimumRevenue > 0 && revenue < config.minimumRevenue) {
    alerts.push(makeAlert(
      'warning',
      'Revenue below target',
      'Operational revenue is below the configured target.',
      { revenue, threshold: config.minimumRevenue }
    ));
  }

  return alerts;
}

export function evaluateTerritoryAlerts(territoryAnalytics = [], thresholds = {}) {
  const config = mergeThresholds(thresholds);

  return territoryAnalytics.flatMap((territory) => {
    const alerts = [];
    const jobs = numberValue(territory.jobs);
    const completionRate = numberValue(territory.completionRate);

    if (jobs > 0 && completionRate < config.minimumTerritoryCompletionRate) {
      alerts.push(makeAlert(
        'warning',
        'Territory needs review',
        (territory.name || territory.id || 'Territory') + ' has a ' + completionRate + '% completion rate.',
        {
          territoryId: territory.id,
          territoryName: territory.name,
          completionRate,
          threshold: config.minimumTerritoryCompletionRate
        }
      ));
    }

    return alerts;
  });
}

export function evaluateOperationsAlerts(analytics = {}, thresholds = {}) {
  const alerts = [
    ...evaluateLeadAlerts(analytics.leadAnalytics || {}, thresholds),
    ...evaluateJobAlerts(analytics.jobAnalytics || {}, thresholds),
    ...evaluateTerritoryAlerts(analytics.territoryAnalytics || [], thresholds)
  ];

  const priority = { critical: 0, warning: 1, info: 2 };

  return alerts.sort((a, b) => {
    return (priority[a.level] ?? 9) - (priority[b.level] ?? 9);
  });
}

window.EvaraOperationsAlerts = {
  DEFAULT_THRESHOLDS,
  evaluateLeadAlerts,
  evaluateJobAlerts,
  evaluateTerritoryAlerts,
  evaluateOperationsAlerts
};
