// Evaraos Widget Registry
// Central source of truth for dashboard widgets, role visibility, categories, layouts, refresh behavior, and future AI widget prioritization.

import {
  WIDGET_TYPES,
  WIDGET_ROLES,
  WIDGET_LAYOUTS,
  createWidget,
  EXECUTIVE_WIDGET_ENGINE_VERSION
} from "./executive-widget-engine.js";

export const WIDGET_REGISTRY_VERSION = "2026.05.17-widget-registry";

export const WIDGET_CATEGORIES = Object.freeze({
  executive: "executive",
  operations: "operations",
  leadership: "leadership",
  organization: "organization",
  vendor: "vendor",
  payroll: "payroll",
  finance: "finance",
  customer: "customer",
  ai: "ai",
  maps: "maps",
  analytics: "analytics"
});

export const WIDGET_REGISTRY = Object.freeze([
  {
    type: WIDGET_TYPES.ecosystemHealth,
    title: "Ecosystem Health",
    category: WIDGET_CATEGORIES.executive,
    roles: [WIDGET_ROLES.owner],
    layout: WIDGET_LAYOUTS.hero,
    refreshIntervalMs: 30000,
    priority: 100
  },
  {
    type: WIDGET_TYPES.liveRevenue,
    title: "Live Revenue",
    category: WIDGET_CATEGORIES.finance,
    roles: [WIDGET_ROLES.owner, WIDGET_ROLES.organization, WIDGET_ROLES.vendor],
    layout: WIDGET_LAYOUTS.wide,
    refreshIntervalMs: 30000,
    priority: 95
  },
  {
    type: WIDGET_TYPES.aiRecommendations,
    title: "AI Recommendation Center",
    category: WIDGET_CATEGORIES.ai,
    roles: [WIDGET_ROLES.owner, WIDGET_ROLES.organization, WIDGET_ROLES.vendor, WIDGET_ROLES.admin],
    layout: WIDGET_LAYOUTS.standard,
    refreshIntervalMs: 45000,
    priority: 92
  },
  {
    type: WIDGET_TYPES.liveActivity,
    title: "Live Activity Feed",
    category: WIDGET_CATEGORIES.operations,
    roles: [WIDGET_ROLES.owner, WIDGET_ROLES.organization, WIDGET_ROLES.vendor, WIDGET_ROLES.admin, WIDGET_ROLES.hr, WIDGET_ROLES.staff, WIDGET_ROLES.customer],
    layout: WIDGET_LAYOUTS.standard,
    refreshIntervalMs: 15000,
    priority: 90
  },
  {
    type: WIDGET_TYPES.organizationTree,
    title: "Organization Tree",
    category: WIDGET_CATEGORIES.organization,
    roles: [WIDGET_ROLES.owner, WIDGET_ROLES.organization],
    layout: WIDGET_LAYOUTS.wide,
    refreshIntervalMs: 60000,
    priority: 88
  },
  {
    type: WIDGET_TYPES.promotionPipeline,
    title: "Promotion Pipeline",
    category: WIDGET_CATEGORIES.leadership,
    roles: [WIDGET_ROLES.owner, WIDGET_ROLES.organization, WIDGET_ROLES.vendor, WIDGET_ROLES.admin],
    layout: WIDGET_LAYOUTS.standard,
    refreshIntervalMs: 60000,
    priority: 86
  },
  {
    type: WIDGET_TYPES.payrollHealth,
    title: "Payroll Health",
    category: WIDGET_CATEGORIES.payroll,
    roles: [WIDGET_ROLES.owner, WIDGET_ROLES.hr, WIDGET_ROLES.admin],
    layout: WIDGET_LAYOUTS.standard,
    refreshIntervalMs: 45000,
    priority: 84
  },
  {
    type: WIDGET_TYPES.vendorHealth,
    title: "Vendor Health",
    category: WIDGET_CATEGORIES.vendor,
    roles: [WIDGET_ROLES.owner, WIDGET_ROLES.organization, WIDGET_ROLES.vendor],
    layout: WIDGET_LAYOUTS.standard,
    refreshIntervalMs: 60000,
    priority: 80
  },
  {
    type: WIDGET_TYPES.customerQuality,
    title: "Customer Quality",
    category: WIDGET_CATEGORIES.customer,
    roles: [WIDGET_ROLES.owner, WIDGET_ROLES.organization, WIDGET_ROLES.vendor, WIDGET_ROLES.admin, WIDGET_ROLES.staff],
    layout: WIDGET_LAYOUTS.standard,
    refreshIntervalMs: 60000,
    priority: 78
  },
  {
    type: WIDGET_TYPES.operationsMap,
    title: "Global Operations Map",
    category: WIDGET_CATEGORIES.maps,
    roles: [WIDGET_ROLES.owner, WIDGET_ROLES.organization, WIDGET_ROLES.admin],
    layout: WIDGET_LAYOUTS.wide,
    refreshIntervalMs: 60000,
    priority: 76
  },
  {
    type: WIDGET_TYPES.expansionOpportunities,
    title: "Expansion Opportunities",
    category: WIDGET_CATEGORIES.analytics,
    roles: [WIDGET_ROLES.owner, WIDGET_ROLES.organization, WIDGET_ROLES.vendor],
    layout: WIDGET_LAYOUTS.standard,
    refreshIntervalMs: 60000,
    priority: 74
  },
  {
    type: WIDGET_TYPES.riskWatchlist,
    title: "Risk Watchlist",
    category: WIDGET_CATEGORIES.analytics,
    roles: [WIDGET_ROLES.owner, WIDGET_ROLES.organization, WIDGET_ROLES.admin, WIDGET_ROLES.hr],
    layout: WIDGET_LAYOUTS.standard,
    refreshIntervalMs: 30000,
    priority: 98
  }
]);

export function getRegisteredWidget(type) {
  return WIDGET_REGISTRY.find((widget) => widget.type === type) || null;
}

export function widgetsForRole(role = WIDGET_ROLES.owner) {
  const normalized = String(role || WIDGET_ROLES.owner).toLowerCase();
  return WIDGET_REGISTRY
    .filter((widget) => widget.roles.includes(normalized))
    .sort((a, b) => b.priority - a.priority)
    .map((widget) => createWidget({
      type: widget.type,
      title: widget.title,
      role: normalized,
      layout: widget.layout,
      refreshIntervalMs: widget.refreshIntervalMs,
      metadata: {
        category: widget.category,
        priority: widget.priority,
        registryVersion: WIDGET_REGISTRY_VERSION
      }
    }));
}

export function widgetsByCategory(category, role = WIDGET_ROLES.owner) {
  return widgetsForRole(role).filter((widget) => widget.metadata?.category === category);
}

export function recommendWidgetsForContext({ role = WIDGET_ROLES.owner, alerts = {}, health = {} } = {}) {
  const widgets = widgetsForRole(role);
  const priorityBoosts = new Map();

  if (Number(alerts.critical || 0) > 0) priorityBoosts.set(WIDGET_TYPES.riskWatchlist, 50);
  if (Number(alerts.payroll || 0) > 0) priorityBoosts.set(WIDGET_TYPES.payrollHealth, 45);
  if (Number(alerts.promotion || 0) > 0) priorityBoosts.set(WIDGET_TYPES.promotionPipeline, 40);
  if (String(health.state || "").includes("critical") || String(health.state || "").includes("needs")) priorityBoosts.set(WIDGET_TYPES.ecosystemHealth, 50);

  return widgets
    .map((widget) => ({
      ...widget,
      adaptivePriority: Number(widget.metadata?.priority || 0) + Number(priorityBoosts.get(widget.type) || 0)
    }))
    .sort((a, b) => b.adaptivePriority - a.adaptivePriority);
}

export function summarizeWidgetRegistry() {
  return {
    totalWidgets: WIDGET_REGISTRY.length,
    categories: Object.keys(WIDGET_CATEGORIES).length,
    roles: Object.keys(WIDGET_ROLES).length,
    engineVersion: EXECUTIVE_WIDGET_ENGINE_VERSION,
    registryVersion: WIDGET_REGISTRY_VERSION,
    generatedAtMs: Date.now()
  };
}
