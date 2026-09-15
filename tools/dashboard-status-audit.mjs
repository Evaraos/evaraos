import assert from "node:assert/strict";
import fs from "node:fs";
import { DASHBOARD_STATUS, getDashboardStatusCopy } from "../public/assets/js/dashboard-status.mjs";

const dashboardHtml = fs.readFileSync("public/dashboard.html", "utf8");
const dashboardStats = fs.readFileSync("public/assets/js/dashboard-stats.js", "utf8");
const dashboardRuntime = fs.readFileSync("public/assets/js/dashboard.js", "utf8");
const widgetRenderer = fs.readFileSync("public/assets/js/dashboard-widget-renderer.js", "utf8");
const mapCard = fs.readFileSync("public/assets/js/dashboard-live-map-card.js", "utf8");

assert.equal(getDashboardStatusCopy(DASHBOARD_STATUS.proven).title, "Dashboard data available");
assert.match(getDashboardStatusCopy(DASHBOARD_STATUS.proven).text, /dashboard_stats\/global/);

for (const status of [DASHBOARD_STATUS.loading, DASHBOARD_STATUS.cached, DASHBOARD_STATUS.unavailable, DASHBOARD_STATUS.deferred]) {
  const copy = getDashboardStatusCopy(status);
  assert.doesNotMatch(`${copy.title} ${copy.text}`, /\b(READY|ready|live|online|connected|operational)\b/i);
}

assert.match(dashboardHtml, /Awaiting dashboard data/);
assert.doesNotMatch(dashboardHtml, />\s*(READY|Live Platform|Workspace ready)\s*</i);
assert.match(dashboardStats, /DASHBOARD_STATUS\.proven/);
assert.match(dashboardStats, /DASHBOARD_STATUS\.unavailable/);
assert.match(dashboardStats, /DASHBOARD_STATUS\.cached/);
assert.match(dashboardRuntime, /routeTo\(url\)/);
assert.match(dashboardRuntime, /evara:session-ready/);
assert.match(widgetRenderer, /state = data\.state \|\| WIDGET_RENDER_STATE\.loading/);
assert.match(mapCard, /Map preview loaded/);
assert.doesNotMatch(mapCard, /readyStatus:\s*['"][^'"]*ready/i);

console.log("Dashboard status audit passed.");
