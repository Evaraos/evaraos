// Evaraos Dashboard Widget UI
// Browser-side bridge that renders dashboard integration models into safe widget grids.

import {
  buildDashboardModel,
  buildOwnerMegaDashboardModel,
  buildOrganizationDashboardModel,
  buildVendorDashboardModel,
  buildCustomerDashboardModel,
  dashboardModelSummary
} from "./dashboard-integration-engine.js";

export const DASHBOARD_WIDGET_UI_VERSION = "2026.05.17-dashboard-widget-ui";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function widgetCard(widget = {}) {
  const title = escapeHtml(widget.title || "Evaraos Widget");
  const subtitle = escapeHtml(widget.subtitle || "Live intelligence module");
  const state = escapeHtml(widget.state || "ready");
  const value = widget.value === null || widget.value === undefined ? "—" : escapeHtml(widget.value);
  const category = escapeHtml(widget.category || "general");

  const items = Array.isArray(widget.items) && widget.items.length
    ? `<ul class="eva-widget-list">${widget.items.slice(0, 5).map((item) => `<li>${escapeHtml(item.title || item.label || item.message || item)}</li>`).join("")}</ul>`
    : `<p class="eva-widget-empty">Waiting for live ${category} data.</p>`;

  return `
    <article class="eva-widget-card eva-widget-card--${escapeHtml(widget.layout || "standard")} eva-widget-card--${state}" data-widget-type="${escapeHtml(widget.type || "generic")}">
      <div class="eva-widget-card-head">
        <span class="eva-widget-kicker">${category}</span>
        <span class="eva-widget-state">${state}</span>
      </div>
      <h3>${title}</h3>
      <p>${subtitle}</p>
      <strong class="eva-widget-value">${value}</strong>
      ${items}
    </article>
  `;
}

function zoneMarkup(zoneName, widgets = []) {
  if (!widgets.length) return "";
  return `
    <section class="eva-widget-zone eva-widget-zone--${escapeHtml(zoneName)}" data-widget-zone="${escapeHtml(zoneName)}">
      ${widgets.map(widgetCard).join("")}
    </section>
  `;
}

export function renderDashboardWidgetGrid(model = {}) {
  const zones = model.layout?.zones || {};
  return `
    <section class="eva-dashboard-widget-system" data-dashboard-role="${escapeHtml(model.role || "owner")}">
      <div class="eva-widget-system-head">
        <div>
          <p>LIVE INTELLIGENCE</p>
          <h2>${escapeHtml((model.role || "owner").replaceAll("_", " "))} command surface</h2>
        </div>
        <span>${escapeHtml(model.widgets?.length || 0)} widgets</span>
      </div>
      ${zoneMarkup("priority", zones.priority)}
      ${zoneMarkup("hero", zones.hero)}
      ${zoneMarkup("wide", zones.wide)}
      ${zoneMarkup("main", zones.main)}
      ${zoneMarkup("sidebar", zones.sidebar)}
      ${zoneMarkup("compact", zones.compact)}
      ${zoneMarkup("footer", zones.footer)}
    </section>
  `;
}

export function mountDashboardWidgets(target, model = {}) {
  const mount = typeof target === "string" ? document.querySelector(target) : target;
  if (!mount) return false;
  mount.innerHTML = renderDashboardWidgetGrid(model);
  mount.dataset.widgetUiVersion = DASHBOARD_WIDGET_UI_VERSION;
  mount.dataset.dashboardSummary = JSON.stringify(dashboardModelSummary(model));
  return true;
}

export function buildModelForCurrentDashboard(role = "owner", input = {}) {
  const normalized = String(role || "owner").toLowerCase();
  if (normalized === "owner") return buildOwnerMegaDashboardModel(input);
  if (normalized === "organization") return buildOrganizationDashboardModel(input);
  if (normalized === "vendor") return buildVendorDashboardModel(input);
  if (normalized === "customer") return buildCustomerDashboardModel(input);
  return buildDashboardModel({ role: normalized, ...input });
}

export function injectWidgetUiStyles() {
  if (document.getElementById("evaDashboardWidgetUiStyles")) return;
  const style = document.createElement("style");
  style.id = "evaDashboardWidgetUiStyles";
  style.textContent = `
    .eva-dashboard-widget-system { display: grid; gap: 18px; margin: 22px 0; }
    .eva-widget-system-head { display: flex; align-items: end; justify-content: space-between; gap: 18px; padding: 18px; border-radius: 28px; background: rgba(255,255,255,.58); border: 1px solid rgba(255,255,255,.68); backdrop-filter: blur(24px); }
    .eva-widget-system-head p { margin: 0 0 4px; font-size: .72rem; font-weight: 900; letter-spacing: .14em; opacity: .62; }
    .eva-widget-system-head h2 { margin: 0; text-transform: capitalize; }
    .eva-widget-system-head span { font-weight: 900; opacity: .7; }
    .eva-widget-zone { display: grid; gap: 16px; }
    .eva-widget-zone--hero, .eva-widget-zone--priority { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
    .eva-widget-zone--wide { grid-template-columns: 1fr; }
    .eva-widget-zone--main, .eva-widget-zone--sidebar, .eva-widget-zone--compact, .eva-widget-zone--footer { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
    .eva-widget-card { position: relative; min-height: 180px; padding: 18px; border-radius: 28px; background: rgba(255,255,255,.62); border: 1px solid rgba(255,255,255,.72); box-shadow: 0 18px 44px rgba(15,23,42,.08); backdrop-filter: blur(24px); overflow: hidden; }
    .eva-widget-card--hero { min-height: 230px; }
    .eva-widget-card--wide { min-height: 240px; }
    .eva-widget-card--critical { border-color: rgba(214,31,66,.45); }
    .eva-widget-card-head { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 12px; }
    .eva-widget-kicker, .eva-widget-state { font-size: .68rem; font-weight: 900; text-transform: uppercase; letter-spacing: .1em; opacity: .62; }
    .eva-widget-card h3 { margin: 0 0 8px; font-size: 1.08rem; }
    .eva-widget-card p { margin: 0; opacity: .72; line-height: 1.45; }
    .eva-widget-value { display: block; margin-top: 16px; font-size: 1.65rem; letter-spacing: -.04em; }
    .eva-widget-list { margin: 14px 0 0; padding-left: 18px; }
    .eva-widget-list li { margin: 6px 0; opacity: .76; }
    .eva-widget-empty { margin-top: 14px !important; font-size: .88rem; }
    html[data-theme="dark"] .eva-widget-system-head, html[data-theme="dark"] .eva-widget-card { background: rgba(18,22,30,.72); border-color: rgba(255,255,255,.12); box-shadow: 0 18px 44px rgba(0,0,0,.32); }
    @media (max-width: 760px) { .eva-widget-system-head { align-items: start; flex-direction: column; } .eva-widget-card { min-height: 156px; } }
  `;
  document.head.appendChild(style);
}

export function autoMountDashboardWidgets({ selector = "#dashboardWidgetMount", role = "owner", input = {} } = {}) {
  injectWidgetUiStyles();
  const model = buildModelForCurrentDashboard(role, input);
  return mountDashboardWidgets(selector, model);
}

window.EvaraDashboardWidgetUI = {
  version: DASHBOARD_WIDGET_UI_VERSION,
  buildModelForCurrentDashboard,
  renderDashboardWidgetGrid,
  mountDashboardWidgets,
  autoMountDashboardWidgets,
  injectWidgetUiStyles
};
