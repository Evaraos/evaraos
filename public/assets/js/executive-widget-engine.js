// Evaraos Executive Widget Engine
// Executive command-center widget orchestration for owner, organization, vendor, admin, HR, staff, and customer dashboards.

export const EXECUTIVE_WIDGET_ENGINE_VERSION = "2026.05.17-executive-widget-engine";

export const WIDGET_TYPES = Object.freeze({
  ecosystemHealth: "ecosystem_health",
  liveRevenue: "live_revenue",
  liveActivity: "live_activity",
  aiRecommendations: "ai_recommendations",
  organizationTree: "organization_tree",
  promotionPipeline: "promotion_pipeline",
  payrollHealth: "payroll_health",
  vendorHealth: "vendor_health",
  customerQuality: "customer_quality",
  operationsMap: "operations_map",
  expansionOpportunities: "expansion_opportunities",
  riskWatchlist: "risk_watchlist"
});

export const WIDGET_ROLES = Object.freeze({
  owner: "owner",
  organization: "organization",
  vendor: "vendor",
  admin: "admin",
  hr: "hr",
  staff: "staff",
  customer: "customer"
});

export const WIDGET_LAYOUTS = Object.freeze({
  hero: "hero",
  wide: "wide",
  standard: "standard",
  compact: "compact",
  sidebar: "sidebar"
});

export function createWidget({
  id = null,
  type = WIDGET_TYPES.liveActivity,
  title = "Executive Widget",
  role = WIDGET_ROLES.owner,
  layout = WIDGET_LAYOUTS.standard,
  refreshIntervalMs = 30000,
  enabled = true,
  metadata = {}
} = {}) {
  return {
    id: id || `widget_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type,
    title,
    role,
    layout,
    refreshIntervalMs,
    enabled,
    metadata,
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
    version: EXECUTIVE_WIDGET_ENGINE_VERSION
  };
}

export function defaultWidgetsForRole(role = "owner") {
  const normalized = String(role || "owner").toLowerCase();

  if (normalized === "owner") {
    return [
      createWidget({ type: WIDGET_TYPES.ecosystemHealth, title: "Ecosystem Health", layout: WIDGET_LAYOUTS.hero }),
      createWidget({ type: WIDGET_TYPES.liveRevenue, title: "Live Revenue", layout: WIDGET_LAYOUTS.wide }),
      createWidget({ type: WIDGET_TYPES.liveActivity, title: "Live Activity Feed" }),
      createWidget({ type: WIDGET_TYPES.aiRecommendations, title: "AI Recommendation Center" }),
      createWidget({ type: WIDGET_TYPES.organizationTree, title: "Organization Tree", layout: WIDGET_LAYOUTS.wide }),
      createWidget({ type: WIDGET_TYPES.operationsMap, title: "Global Operations Map", layout: WIDGET_LAYOUTS.wide })
    ];
  }

  if (normalized === "organization") {
    return [
      createWidget({ type: WIDGET_TYPES.liveRevenue, title: "Organization Revenue" }),
      createWidget({ type: WIDGET_TYPES.promotionPipeline, title: "Promotion Pipeline" }),
      createWidget({ type: WIDGET_TYPES.liveActivity, title: "Organization Activity" }),
      createWidget({ type: WIDGET_TYPES.vendorHealth, title: "Vendor Health" })
    ];
  }

  if (normalized === "vendor") {
    return [
      createWidget({ type: WIDGET_TYPES.customerQuality, title: "Customer Quality" }),
      createWidget({ type: WIDGET_TYPES.liveActivity, title: "Vendor Activity" }),
      createWidget({ type: WIDGET_TYPES.expansionOpportunities, title: "Expansion Opportunities" })
    ];
  }

  return [
    createWidget({ type: WIDGET_TYPES.liveActivity, title: "Dashboard Activity" })
  ];
}

export function summarizeWidgetLayout(widgets = []) {
  return {
    total: widgets.length,
    hero: widgets.filter((w) => w.layout === WIDGET_LAYOUTS.hero).length,
    wide: widgets.filter((w) => w.layout === WIDGET_LAYOUTS.wide).length,
    standard: widgets.filter((w) => w.layout === WIDGET_LAYOUTS.standard).length,
    compact: widgets.filter((w) => w.layout === WIDGET_LAYOUTS.compact).length,
    enabled: widgets.filter((w) => w.enabled).length,
    generatedAtMs: Date.now(),
    version: EXECUTIVE_WIDGET_ENGINE_VERSION
  };
}
