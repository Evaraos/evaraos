// Evaraos Dashboard Layout Manager
// Layout intelligence for arranging widget view models into dashboard-ready sections.

import {
  WIDGET_RENDER_STATE,
  DASHBOARD_WIDGET_RENDERER_VERSION
} from "./dashboard-widget-renderer.js";

export const DASHBOARD_LAYOUT_MANAGER_VERSION = "2026.05.17-dashboard-layout-manager";

export const DASHBOARD_ZONES = Object.freeze({
  hero: "hero",
  priority: "priority",
  main: "main",
  wide: "wide",
  sidebar: "sidebar",
  compact: "compact",
  footer: "footer"
});

export const DASHBOARD_LAYOUT_MODES = Object.freeze({
  executive: "executive",
  organization: "organization",
  vendor: "vendor",
  staff: "staff",
  customer: "customer",
  mobile: "mobile"
});

function zoneForWidget(widget = {}) {
  if (widget.state === WIDGET_RENDER_STATE.critical) return DASHBOARD_ZONES.priority;
  if (widget.layout === "hero") return DASHBOARD_ZONES.hero;
  if (widget.layout === "wide") return DASHBOARD_ZONES.wide;
  if (widget.layout === "compact") return DASHBOARD_ZONES.compact;
  if (widget.layout === "sidebar") return DASHBOARD_ZONES.sidebar;
  return DASHBOARD_ZONES.main;
}

export function createEmptyLayout(mode = DASHBOARD_LAYOUT_MODES.executive) {
  return {
    mode,
    zones: {
      hero: [],
      priority: [],
      main: [],
      wide: [],
      sidebar: [],
      compact: [],
      footer: []
    },
    generatedAtMs: Date.now(),
    version: DASHBOARD_LAYOUT_MANAGER_VERSION,
    rendererVersion: DASHBOARD_WIDGET_RENDERER_VERSION
  };
}

export function buildDashboardLayout(widgets = [], mode = DASHBOARD_LAYOUT_MODES.executive) {
  const layout = createEmptyLayout(mode);

  widgets.forEach((widget) => {
    const zone = zoneForWidget(widget);
    layout.zones[zone].push(widget);
  });

  Object.keys(layout.zones).forEach((zone) => {
    layout.zones[zone].sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
  });

  layout.totalWidgets = widgets.length;
  layout.enabledZones = Object.entries(layout.zones)
    .filter(([, items]) => items.length > 0)
    .map(([zone]) => zone);

  return layout;
}

export function compactLayoutForMobile(layout = createEmptyLayout(DASHBOARD_LAYOUT_MODES.mobile)) {
  const ordered = [
    ...layout.zones.priority,
    ...layout.zones.hero,
    ...layout.zones.wide,
    ...layout.zones.main,
    ...layout.zones.sidebar,
    ...layout.zones.compact,
    ...layout.zones.footer
  ];

  return {
    mode: DASHBOARD_LAYOUT_MODES.mobile,
    zones: {
      hero: [],
      priority: ordered.slice(0, 3),
      main: ordered.slice(3),
      wide: [],
      sidebar: [],
      compact: [],
      footer: []
    },
    totalWidgets: ordered.length,
    enabledZones: ["priority", "main"],
    generatedAtMs: Date.now(),
    version: DASHBOARD_LAYOUT_MANAGER_VERSION,
    sourceLayoutVersion: layout.version
  };
}

export function persistLayoutPreference(role = "owner", layout = {}) {
  try {
    const key = `evaraos-dashboard-layout-${role}`;
    localStorage.setItem(key, JSON.stringify({
      role,
      zones: layout.zones || {},
      updatedAtMs: Date.now(),
      version: DASHBOARD_LAYOUT_MANAGER_VERSION
    }));
    return true;
  } catch {
    return false;
  }
}

export function readLayoutPreference(role = "owner") {
  try {
    const key = `evaraos-dashboard-layout-${role}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function summarizeLayout(layout = {}) {
  const zones = layout.zones || {};
  return {
    mode: layout.mode || DASHBOARD_LAYOUT_MODES.executive,
    totalWidgets: layout.totalWidgets || Object.values(zones).reduce((sum, items) => sum + (items?.length || 0), 0),
    hero: zones.hero?.length || 0,
    priority: zones.priority?.length || 0,
    wide: zones.wide?.length || 0,
    main: zones.main?.length || 0,
    sidebar: zones.sidebar?.length || 0,
    compact: zones.compact?.length || 0,
    generatedAtMs: Date.now(),
    version: DASHBOARD_LAYOUT_MANAGER_VERSION
  };
}
