// Evaraos Dashboard Integration Engine
// Connects widget registry, renderer, and layout manager into one dashboard-ready model.

import {
  renderAdaptiveDashboard,
  groupWidgetViewModels,
  DASHBOARD_WIDGET_RENDERER_VERSION
} from "./dashboard-widget-renderer.js";

import {
  buildDashboardLayout,
  compactLayoutForMobile,
  summarizeLayout,
  DASHBOARD_LAYOUT_MANAGER_VERSION
} from "./dashboard-layout-manager.js";

export const DASHBOARD_INTEGRATION_ENGINE_VERSION = "2026.05.17-dashboard-integration-engine";

export const DASHBOARD_CONTEXTS = Object.freeze({
  owner: "owner",
  organization: "organization",
  vendor: "vendor",
  admin: "admin",
  hr: "hr",
  staff: "staff",
  customer: "customer"
});

export function normalizeDashboardRole(role = "owner") {
  const normalized = String(role || "owner").toLowerCase();

  if (["owner", "super_admin"].includes(normalized)) return DASHBOARD_CONTEXTS.owner;
  if (["organization", "organization_owner", "office_owner", "branch_owner"].includes(normalized)) return DASHBOARD_CONTEXTS.organization;
  if (["vendor", "lead_vendor", "service_vendor", "management_program"].includes(normalized)) return DASHBOARD_CONTEXTS.vendor;
  if (["admin", "manager", "operations_manager", "operations_coordinator"].includes(normalized)) return DASHBOARD_CONTEXTS.admin;
  if (["hr", "hr_manager"].includes(normalized)) return DASHBOARD_CONTEXTS.hr;
  if (["sales", "sales_rep", "technician", "cleaner", "staff"].includes(normalized)) return DASHBOARD_CONTEXTS.staff;
  return DASHBOARD_CONTEXTS.customer;
}

export function buildDashboardModel({
  role = "owner",
  alerts = {},
  health = {},
  dataByType = {},
  mobile = false
} = {}) {
  const dashboardRole = normalizeDashboardRole(role);
  const adaptive = renderAdaptiveDashboard({
    role: dashboardRole,
    alerts,
    health,
    dataByType
  });

  const layout = buildDashboardLayout(adaptive.widgets, dashboardRole);
  const finalLayout = mobile ? compactLayoutForMobile(layout) : layout;

  return {
    role: dashboardRole,
    widgets: adaptive.widgets,
    groupedWidgets: groupWidgetViewModels(adaptive.widgets),
    layout: finalLayout,
    layoutSummary: summarizeLayout(finalLayout),
    registry: adaptive.registry,
    generatedAtMs: Date.now(),
    version: DASHBOARD_INTEGRATION_ENGINE_VERSION,
    rendererVersion: DASHBOARD_WIDGET_RENDERER_VERSION,
    layoutManagerVersion: DASHBOARD_LAYOUT_MANAGER_VERSION
  };
}

export function buildOwnerMegaDashboardModel(input = {}) {
  return buildDashboardModel({
    role: "owner",
    alerts: input.alerts || {},
    health: input.health || {},
    dataByType: input.dataByType || {},
    mobile: input.mobile || false
  });
}

export function buildOrganizationDashboardModel(input = {}) {
  return buildDashboardModel({
    role: "organization",
    alerts: input.alerts || {},
    health: input.health || {},
    dataByType: input.dataByType || {},
    mobile: input.mobile || false
  });
}

export function buildVendorDashboardModel(input = {}) {
  return buildDashboardModel({
    role: "vendor",
    alerts: input.alerts || {},
    health: input.health || {},
    dataByType: input.dataByType || {},
    mobile: input.mobile || false
  });
}

export function buildCustomerDashboardModel(input = {}) {
  return buildDashboardModel({
    role: "customer",
    alerts: input.alerts || {},
    health: input.health || {},
    dataByType: input.dataByType || {},
    mobile: input.mobile || false
  });
}

export function dashboardModelSummary(model = {}) {
  return {
    role: model.role || "owner",
    widgets: model.widgets?.length || 0,
    zones: model.layout?.enabledZones || [],
    generatedAtMs: model.generatedAtMs || Date.now(),
    version: model.version || DASHBOARD_INTEGRATION_ENGINE_VERSION
  };
}
