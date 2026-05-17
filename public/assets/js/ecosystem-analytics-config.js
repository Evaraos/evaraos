// Evaraos Executive Ecosystem Analytics
// Owner-level analytics foundation for organizations, offices, vendors, payroll, leadership, and risk.

export const ECOSYSTEM_ANALYTICS_VERSION = "2026.05.17-executive-ecosystem-analytics";

export const ECOSYSTEM_ANALYTICS_CATEGORIES = Object.freeze({
  organizations: "organizations",
  offices: "offices",
  vendors: "vendors",
  managementPrograms: "management_programs",
  leadershipPipeline: "leadership_pipeline",
  revenue: "revenue",
  payroll: "payroll",
  customerQuality: "customer_quality",
  operations: "operations",
  risk: "risk"
});

export const ECOSYSTEM_HEALTH_STATES = Object.freeze({
  elite: "elite",
  healthy: "healthy",
  stable: "stable",
  developing: "developing",
  needsAttention: "needs_attention",
  critical: "critical"
});

export function classifyEcosystemHealth(score = 0) {
  const value = Number(score || 0);
  if (value >= 92) return ECOSYSTEM_HEALTH_STATES.elite;
  if (value >= 82) return ECOSYSTEM_HEALTH_STATES.healthy;
  if (value >= 72) return ECOSYSTEM_HEALTH_STATES.stable;
  if (value >= 62) return ECOSYSTEM_HEALTH_STATES.developing;
  if (value >= 45) return ECOSYSTEM_HEALTH_STATES.needsAttention;
  return ECOSYSTEM_HEALTH_STATES.critical;
}

export function calculateEcosystemHealth(metrics = {}) {
  const revenue = Number(metrics.revenue || 0);
  const leadership = Number(metrics.leadership || 0);
  const retention = Number(metrics.retention || 0);
  const operations = Number(metrics.operations || 0);
  const customerQuality = Number(metrics.customerQuality || 0);
  const payrollReliability = Number(metrics.payrollReliability || 0);

  const score =
    revenue * 0.22 +
    leadership * 0.22 +
    retention * 0.16 +
    operations * 0.16 +
    customerQuality * 0.12 +
    payrollReliability * 0.12;

  return {
    score: Math.round(score * 100) / 100,
    state: classifyEcosystemHealth(score),
    breakdown: {
      revenue,
      leadership,
      retention,
      operations,
      customerQuality,
      payrollReliability
    },
    generatedAtMs: Date.now(),
    version: ECOSYSTEM_ANALYTICS_VERSION
  };
}

export function summarizeEcosystem({ organizations = [], offices = [], vendors = [], people = [], revenue = {} } = {}) {
  const totalRevenue30Days = Number(revenue.totalRevenue30Days || 0);
  const totalPayroll30Days = Number(revenue.totalPayroll30Days || 0);
  const totalPlatformShare30Days = Number(revenue.totalPlatformShare30Days || 0);

  const activeOrganizations = organizations.filter((item) => item.status !== "closed").length;
  const activeOffices = offices.filter((item) => item.status !== "closed").length;
  const activeVendors = vendors.filter((item) => item.status !== "closed").length;
  const promotionCandidates = people.filter((person) => Number(person.leadershipScore || 0) >= 75).length;
  const riskCount = [...organizations, ...offices, ...vendors].filter((item) => {
    const score = Number(item.healthScore || 0);
    return score > 0 && score < 65;
  }).length;

  return {
    activeOrganizations,
    activeOffices,
    activeVendors,
    totalPeople: people.length,
    promotionCandidates,
    riskCount,
    totalRevenue30Days,
    totalPayroll30Days,
    totalPlatformShare30Days,
    generatedAtMs: Date.now(),
    version: ECOSYSTEM_ANALYTICS_VERSION
  };
}

export function buildExecutiveAnalyticsSnapshot(input = {}) {
  const summary = summarizeEcosystem(input);
  const health = calculateEcosystemHealth(input.healthMetrics || {});

  return {
    summary,
    health,
    watchlist: {
      riskCount: summary.riskCount,
      promotionCandidates: summary.promotionCandidates,
      platformShare30Days: summary.totalPlatformShare30Days
    },
    generatedAtMs: Date.now(),
    version: ECOSYSTEM_ANALYTICS_VERSION
  };
}
