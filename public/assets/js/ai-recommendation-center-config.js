// Evaraos AI Recommendation Center
// AI-assisted operational recommendations for leadership, organizations, vendors, payroll, and ecosystem health.

export const AI_RECOMMENDATION_CENTER_VERSION = "2026.05.17-ai-recommendation-center";

export const RECOMMENDATION_PRIORITY = Object.freeze({
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
  informational: "informational"
});

export const RECOMMENDATION_TYPES = Object.freeze({
  promotion: "promotion",
  retention: "retention",
  payroll: "payroll",
  expansion: "expansion",
  compliance: "compliance",
  staffing: "staffing",
  leadership: "leadership",
  operations: "operations",
  customerQuality: "customer_quality",
  ecosystemRisk: "ecosystem_risk"
});

export const RECOMMENDATION_STATUS = Object.freeze({
  pending: "pending",
  reviewed: "reviewed",
  approved: "approved",
  dismissed: "dismissed",
  completed: "completed"
});

export function createRecommendation({
  type = RECOMMENDATION_TYPES.operations,
  priority = RECOMMENDATION_PRIORITY.medium,
  title = "AI Recommendation",
  message = "An operational recommendation has been generated.",
  confidence = 70,
  relatedEntityId = null,
  organizationId = null,
  officeId = null,
  vendorId = null,
  recommendedAction = null,
  metadata = {}
} = {}) {
  return {
    id: `recommendation_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type,
    priority,
    title,
    message,
    confidence: Number(confidence || 0),
    relatedEntityId,
    organizationId,
    officeId,
    vendorId,
    recommendedAction,
    metadata,
    status: RECOMMENDATION_STATUS.pending,
    createdAtMs: Date.now(),
    reviewedAtMs: null,
    completedAtMs: null,
    version: AI_RECOMMENDATION_CENTER_VERSION
  };
}

export function recommendPromotionAction(person = {}) {
  const leadershipScore = Number(person.leadershipScore || 0);
  const retention = Number(person.retention || 0);
  const customerQuality = Number(person.customerQuality || 0);

  if (leadershipScore >= 90 && retention >= 85 && customerQuality >= 85) {
    return createRecommendation({
      type: RECOMMENDATION_TYPES.promotion,
      priority: RECOMMENDATION_PRIORITY.high,
      title: "Promotion Candidate Identified",
      message: `${person.name || "A leader"} is ready for executive review and possible promotion.`,
      confidence: 95,
      relatedEntityId: person.id || null,
      recommendedAction: "review_for_partner_or_office_level"
    });
  }

  return null;
}

export function recommendRetentionIntervention(entity = {}) {
  const retention = Number(entity.retention || 0);

  if (retention < 60) {
    return createRecommendation({
      type: RECOMMENDATION_TYPES.retention,
      priority: RECOMMENDATION_PRIORITY.high,
      title: "Retention Risk Detected",
      message: `${entity.name || "Organization"} is showing signs of retention instability.`,
      confidence: 88,
      relatedEntityId: entity.id || null,
      organizationId: entity.organizationId || null,
      recommendedAction: "schedule_leadership_review"
    });
  }

  return null;
}

export function recommendExpansionOpportunity(entity = {}) {
  const revenue = Number(entity.revenue30Days || 0);
  const leadership = Number(entity.leadershipScore || 0);

  if (revenue >= 100000 && leadership >= 85) {
    return createRecommendation({
      type: RECOMMENDATION_TYPES.expansion,
      priority: RECOMMENDATION_PRIORITY.high,
      title: "Expansion Opportunity Detected",
      message: `${entity.name || "Organization"} may be ready for office or branch expansion.`,
      confidence: 91,
      relatedEntityId: entity.id || null,
      organizationId: entity.organizationId || null,
      recommendedAction: "review_for_expansion"
    });
  }

  return null;
}

export function recommendPayrollReview(entity = {}) {
  const payrollReliability = Number(entity.payrollReliability || 100);

  if (payrollReliability < 70) {
    return createRecommendation({
      type: RECOMMENDATION_TYPES.payroll,
      priority: RECOMMENDATION_PRIORITY.critical,
      title: "Payroll Reliability Issue",
      message: `${entity.name || "Office"} may require payroll review or intervention.`,
      confidence: 94,
      relatedEntityId: entity.id || null,
      officeId: entity.officeId || null,
      recommendedAction: "trigger_hr_and_payroll_review"
    });
  }

  return null;
}

export function buildRecommendationPipeline({ people = [], organizations = [], offices = [], vendors = [] } = {}) {
  const recommendations = [];

  people.forEach((person) => {
    const promotion = recommendPromotionAction(person);
    if (promotion) recommendations.push(promotion);
  });

  [...organizations, ...offices, ...vendors].forEach((entity) => {
    const retention = recommendRetentionIntervention(entity);
    const expansion = recommendExpansionOpportunity(entity);
    const payroll = recommendPayrollReview(entity);

    if (retention) recommendations.push(retention);
    if (expansion) recommendations.push(expansion);
    if (payroll) recommendations.push(payroll);
  });

  return recommendations.sort((a, b) => {
    const priorityOrder = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
      informational: 0
    };

    return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
  });
}

export function summarizeRecommendations(recommendations = []) {
  const summary = {
    total: recommendations.length,
    critical: 0,
    high: 0,
    promotion: 0,
    retention: 0,
    expansion: 0,
    payroll: 0
  };

  recommendations.forEach((item) => {
    if (item.priority === RECOMMENDATION_PRIORITY.critical) summary.critical += 1;
    if (item.priority === RECOMMENDATION_PRIORITY.high) summary.high += 1;
    if (item.type === RECOMMENDATION_TYPES.promotion) summary.promotion += 1;
    if (item.type === RECOMMENDATION_TYPES.retention) summary.retention += 1;
    if (item.type === RECOMMENDATION_TYPES.expansion) summary.expansion += 1;
    if (item.type === RECOMMENDATION_TYPES.payroll) summary.payroll += 1;
  });

  return {
    ...summary,
    generatedAtMs: Date.now(),
    version: AI_RECOMMENDATION_CENTER_VERSION
  };
}
