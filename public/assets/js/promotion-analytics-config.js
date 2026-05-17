// Evaraos Promotion Analytics
// Dashboard-ready scoring helpers for the Management Expansion Partner Program.

import {
  LEADERSHIP_ENGINE_VERSION,
  MEP_LADDER,
  calculateLeadershipScore,
  classifyLeadershipHealth,
  recommendPromotion
} from "./leadership-score-engine-config.js";

export const PROMOTION_ANALYTICS_VERSION = "2026.05.17-promotion-analytics";

export const PROMOTION_READINESS_STATES = Object.freeze({
  blocked: "blocked",
  needsDevelopment: "needs_development",
  onTrack: "on_track",
  promotionReady: "promotion_ready",
  executiveReview: "executive_review"
});

export const PROMOTION_RISK_FLAGS = Object.freeze({
  lowRetention: "low_retention",
  poorCustomerQuality: "poor_customer_quality",
  unreliableOperations: "unreliable_operations",
  weakLeadershipPipeline: "weak_leadership_pipeline",
  inconsistentProduction: "inconsistent_production",
  complianceRisk: "compliance_risk"
});

export function getLadderRole(role = "sales_rep") {
  const normalized = String(role || "sales_rep").toLowerCase();
  return MEP_LADDER.find((item) => item.role === normalized) || MEP_LADDER[0];
}

export function getNextLadderRole(role = "sales_rep") {
  const current = getLadderRole(role);
  return MEP_LADDER.find((item) => item.level === current.level + 1) || current;
}

export function detectPromotionRiskFlags(metrics = {}) {
  const flags = [];

  if (Number(metrics.retention ?? 0) < 60) flags.push(PROMOTION_RISK_FLAGS.lowRetention);
  if (Number(metrics.customerQuality ?? 0) < 65) flags.push(PROMOTION_RISK_FLAGS.poorCustomerQuality);
  if (Number(metrics.systemReliability ?? 0) < 65) flags.push(PROMOTION_RISK_FLAGS.unreliableOperations);
  if (Number(metrics.leadership ?? 0) < 60) flags.push(PROMOTION_RISK_FLAGS.weakLeadershipPipeline);
  if (Number(metrics.production ?? 0) < 55) flags.push(PROMOTION_RISK_FLAGS.inconsistentProduction);
  if (Number(metrics.compliance ?? 100) < 75) flags.push(PROMOTION_RISK_FLAGS.complianceRisk);

  return flags;
}

export function getReadinessState(score = 0, riskFlags = []) {
  const value = Number(score || 0);

  if (riskFlags.includes(PROMOTION_RISK_FLAGS.complianceRisk)) return PROMOTION_READINESS_STATES.blocked;
  if (riskFlags.length >= 3) return PROMOTION_READINESS_STATES.needsDevelopment;
  if (value >= 85) return PROMOTION_READINESS_STATES.executiveReview;
  if (value >= 75) return PROMOTION_READINESS_STATES.promotionReady;
  if (value >= 65) return PROMOTION_READINESS_STATES.onTrack;
  return PROMOTION_READINESS_STATES.needsDevelopment;
}

export function buildPromotionScorecard(person = {}) {
  const role = person.role || "sales_rep";
  const currentRole = getLadderRole(role);
  const nextRole = getNextLadderRole(role);
  const score = calculateLeadershipScore(person.metrics || {});
  const riskFlags = detectPromotionRiskFlags(person.metrics || {});
  const readinessState = getReadinessState(score.weightedScore, riskFlags);
  const recommendedRole = recommendPromotion(score.weightedScore, currentRole.role);

  return {
    personId: person.id || person.uid || null,
    name: person.name || person.displayName || person.fullName || "Unassigned",
    currentRole,
    nextRole,
    recommendedRole,
    readinessState,
    health: classifyLeadershipHealth(score.weightedScore),
    riskFlags,
    score,
    executiveApprovalRequired: ["junior_partner", "partner", "office_partner"].includes(recommendedRole),
    generatedAtMs: Date.now(),
    version: PROMOTION_ANALYTICS_VERSION,
    leadershipEngineVersion: LEADERSHIP_ENGINE_VERSION
  };
}

export function summarizePromotionPipeline(scorecards = []) {
  const summary = {
    total: scorecards.length,
    blocked: 0,
    needsDevelopment: 0,
    onTrack: 0,
    promotionReady: 0,
    executiveReview: 0,
    elite: 0,
    excellent: 0,
    strong: 0,
    developing: 0,
    needsAttention: 0
  };

  scorecards.forEach((card) => {
    if (card.readinessState === PROMOTION_READINESS_STATES.blocked) summary.blocked += 1;
    if (card.readinessState === PROMOTION_READINESS_STATES.needsDevelopment) summary.needsDevelopment += 1;
    if (card.readinessState === PROMOTION_READINESS_STATES.onTrack) summary.onTrack += 1;
    if (card.readinessState === PROMOTION_READINESS_STATES.promotionReady) summary.promotionReady += 1;
    if (card.readinessState === PROMOTION_READINESS_STATES.executiveReview) summary.executiveReview += 1;

    if (card.health === "elite") summary.elite += 1;
    if (card.health === "excellent") summary.excellent += 1;
    if (card.health === "strong") summary.strong += 1;
    if (card.health === "developing") summary.developing += 1;
    if (card.health === "needs_attention") summary.needsAttention += 1;
  });

  return summary;
}
