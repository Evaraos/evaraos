// Evaraos Leadership Score Engine
// AI-assisted leadership scoring, promotion tracking, organization health, and ecosystem growth.

export const LEADERSHIP_ENGINE_VERSION = "2026.05.17-leadership-score-engine";

export const LEADERSHIP_SCORE_WEIGHTS = Object.freeze({
  production: 40,
  leadership: 25,
  retention: 15,
  customerQuality: 10,
  systemReliability: 10
});

export const MANAGEMENT_EXPANSION_PARTNER_PROGRAM = Object.freeze({
  name: "Evaraos Management Expansion Partner Program",
  shortName: "MEP Program",
  philosophy:
    "Production creates opportunity. Leadership creates scalability. System health creates longevity.",
  promotionModel: "ai_assisted_human_approval"
});

export const MEP_LADDER = Object.freeze([
  {
    level: 1,
    role: "sales_rep",
    label: "Sales Representative",
    category: "entry"
  },
  {
    level: 2,
    role: "team_leader",
    label: "Team Leader",
    category: "leadership",
    requirements: {
      weeklyProductionUsd: 1500,
      orTwoWeekProductionUsd: 3000,
      consecutiveWeeksRequired: 2
    }
  },
  {
    level: 3,
    role: "supervisor",
    label: "Supervisor",
    category: "leadership",
    requirements: {
      activeSalespeople: 2,
      requiredTeamLeaders: 1,
      consistencyRequired: true
    }
  },
  {
    level: 4,
    role: "assistant_manager",
    label: "Assistant Manager",
    category: "management",
    requirements: {
      teamSize: 4,
      requiredSalesReps: 1,
      requiredTeamLeaders: 1,
      requiredSupervisors: 2
    }
  },
  {
    level: 5,
    role: "manager",
    label: "Manager",
    category: "management",
    requirements: {
      minimumTeamSize: 8,
      requiredTeamLeaders: 2,
      requiredSupervisors: 2,
      productionConsistencyDays: 30,
      qualityScoreMinimum: 80
    }
  },
  {
    level: 6,
    role: "junior_partner",
    label: "Junior Partner",
    category: "executive",
    requirements: {
      minimumTeamSize: 12,
      minimumProduction30DaysUsd: 25000,
      maximumProduction30DaysUsd: 40000,
      leadershipCapabilityRequired: true,
      payrollReadinessRequired: true
    }
  },
  {
    level: 7,
    role: "partner",
    label: "Partner",
    category: "executive",
    requirements: {
      minimumTeamSize: 20,
      minimumProduction90DaysUsd: 75000,
      maximumProduction90DaysUsd: 100000,
      requiredPromotedLeaders: 2,
      customerQualityMinimum: 85,
      operationalReliabilityMinimum: 85
    }
  },
  {
    level: 8,
    role: "office_partner",
    label: "Office Partner",
    category: "organization",
    requirements: {
      executiveApprovalRequired: true,
      organizationReadinessRequired: true,
      leadershipHealthMinimum: 90,
      canOperateOffice: true
    }
  }
]);

export function calculateLeadershipScore(metrics = {}) {
  const production = Number(metrics.production ?? 0);
  const leadership = Number(metrics.leadership ?? 0);
  const retention = Number(metrics.retention ?? 0);
  const customerQuality = Number(metrics.customerQuality ?? 0);
  const systemReliability = Number(metrics.systemReliability ?? 0);

  const weightedScore = (
    production * (LEADERSHIP_SCORE_WEIGHTS.production / 100) +
    leadership * (LEADERSHIP_SCORE_WEIGHTS.leadership / 100) +
    retention * (LEADERSHIP_SCORE_WEIGHTS.retention / 100) +
    customerQuality * (LEADERSHIP_SCORE_WEIGHTS.customerQuality / 100) +
    systemReliability * (LEADERSHIP_SCORE_WEIGHTS.systemReliability / 100)
  );

  return {
    weightedScore: Math.round(weightedScore * 100) / 100,
    breakdown: {
      production,
      leadership,
      retention,
      customerQuality,
      systemReliability
    },
    weights: LEADERSHIP_SCORE_WEIGHTS,
    generatedAtMs: Date.now(),
    version: LEADERSHIP_ENGINE_VERSION
  };
}

export function recommendPromotion(score = 0, currentRole = "sales_rep") {
  const normalizedScore = Number(score || 0);

  if (normalizedScore >= 90) return "office_partner";
  if (normalizedScore >= 85) return "partner";
  if (normalizedScore >= 80) return "junior_partner";
  if (normalizedScore >= 75) return "manager";
  if (normalizedScore >= 70) return "assistant_manager";
  if (normalizedScore >= 65) return "supervisor";
  if (normalizedScore >= 60) return "team_leader";

  return currentRole;
}

export function classifyLeadershipHealth(score = 0) {
  const normalized = Number(score || 0);

  if (normalized >= 90) return "elite";
  if (normalized >= 80) return "excellent";
  if (normalized >= 70) return "strong";
  if (normalized >= 60) return "developing";
  return "needs_attention";
}
