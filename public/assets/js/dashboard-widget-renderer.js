// Evaraos Dashboard Widget Renderer
// Converts registered widgets into dashboard-ready UI view models.

import {
  widgetsForRole,
  recommendWidgetsForContext,
  summarizeWidgetRegistry,
  WIDGET_REGISTRY_VERSION
} from "./widget-registry.js";

export const DASHBOARD_WIDGET_RENDERER_VERSION = "2026.05.17-dashboard-widget-renderer";

export const WIDGET_RENDER_STATE = Object.freeze({
  loading: "loading",
  ready: "ready",
  empty: "empty",
  warning: "warning",
  critical: "critical",
  error: "error"
});

export function createWidgetViewModel(widget = {}, data = {}) {
  const state = data.state || WIDGET_RENDER_STATE.ready;

  return {
    id: widget.id,
    type: widget.type,
    title: widget.title,
    role: widget.role,
    layout: widget.layout,
    category: widget.metadata?.category || "general",
    priority: widget.metadata?.priority || 0,
    refreshIntervalMs: widget.refreshIntervalMs || 30000,
    state,
    value: data.value ?? null,
    subtitle: data.subtitle || "Live Evaraos intelligence",
    items: Array.isArray(data.items) ? data.items : [],
    actions: Array.isArray(data.actions) ? data.actions : [],
    updatedAtMs: Date.now(),
    version: DASHBOARD_WIDGET_RENDERER_VERSION
  };
}

export function renderWidgetsForRole(role = "owner", dataByType = {}) {
  return widgetsForRole(role).map((widget) => {
    return createWidgetViewModel(widget, dataByType[widget.type] || {});
  });
}

export function renderAdaptiveDashboard({ role = "owner", alerts = {}, health = {}, dataByType = {} } = {}) {
  const widgets = recommendWidgetsForContext({ role, alerts, health });

  return {
    role,
    widgets: widgets.map((widget) => createWidgetViewModel(widget, dataByType[widget.type] || {})),
    registry: summarizeWidgetRegistry(),
    generatedAtMs: Date.now(),
    rendererVersion: DASHBOARD_WIDGET_RENDERER_VERSION,
    registryVersion: WIDGET_REGISTRY_VERSION
  };
}

export function groupWidgetViewModels(widgets = []) {
  return widgets.reduce((groups, widget) => {
    const category = widget.category || "general";
    if (!groups[category]) groups[category] = [];
    groups[category].push(widget);
    return groups;
  }, {});
}

export function widgetCssClass(widget = {}) {
  const layout = widget.layout || "standard";
  const state = widget.state || WIDGET_RENDER_STATE.ready;
  return `eva-widget eva-widget--${layout} eva-widget--${state} eva-widget--${widget.type || "generic"}`;
}

export function widgetAccessibilityLabel(widget = {}) {
  return `${widget.title || "Dashboard widget"}. ${widget.subtitle || "Live Evaraos widget."}`;
}
