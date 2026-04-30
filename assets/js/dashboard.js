// assets/js/dashboard.js
// Compatibility entry for dashboard.html.
// The dashboard now reads dashboard_stats/global through dashboard-stats.js instead of scanning collections.

import "./dashboard-stats.js?v=1";

window.EvaraDashboard = {
  mode: "stats-document",
  source: "dashboard_stats/global"
};
