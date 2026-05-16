import {
  auth,
  onAuthStateChanged,
  getSavedUserProfile
} from './firebase.js';

import { loadOperationsAnalytics } from './operations-analytics.js';
import {
  startOperationsAnalyticsRealtime,
  stopOperationsAnalyticsRealtime
} from './operations-analytics-realtime.js';
import { evaluateOperationsAlerts } from './operations-alerts.js';

const statusNode = document.getElementById('alertsStatus');
const criticalNode = document.getElementById('alertsCriticalCount');
const warningNode = document.getElementById('alertsWarningCount');
const infoNode = document.getElementById('alertsInfoCount');
const totalNode = document.getElementById('alertsTotalCount');
const root = document.getElementById('alertsRoot');
const feedRoot = document.getElementById('alertsFeedRoot');

let realtimeStarted = false;

function clean(value = '') {
  return String(value || '').replace(/[<>]/g, '');
}

function status(message = '') {
  if (statusNode) statusNode.textContent = message;
}

function isAlertsAdmin() {
  const profile = getSavedUserProfile() || {};
  const role = String(profile.role || '').toLowerCase();
  return ['owner', 'super_admin', 'admin', 'manager', 'operations_manager', 'dispatcher', 'sales_manager'].includes(role);
}

function summarize(alerts = []) {
  const summary = alerts.reduce((acc, alert) => {
    const level = alert.level || 'info';
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, { critical: 0, warning: 0, info: 0 });

  if (criticalNode) criticalNode.textContent = String(summary.critical || 0);
  if (warningNode) warningNode.textContent = String(summary.warning || 0);
  if (infoNode) infoNode.textContent = String(summary.info || 0);
  if (totalNode) totalNode.textContent = String(alerts.length);
}

function levelLabel(level = '') {
  const normalized = String(level || 'info').toLowerCase();
  if (normalized === 'critical') return 'Critical';
  if (normalized === 'warning') return 'Warning';
  return 'Info';
}

function renderAlerts(alerts = []) {
  if (!root) return;

  summarize(alerts);

  if (!alerts.length) {
    root.innerHTML = '<div class="item muted">No executive alerts right now. Operations are within configured thresholds.</div>';
    return;
  }

  root.innerHTML = alerts.map((alert) => {
    return '<article class="item"><h3>' + clean(alert.title) + '</h3><p class="muted">' + clean(alert.detail) + '</p><div class="row"><span class="pill">' + clean(levelLabel(alert.level)) + '</span><span class="pill">Threshold Alert</span></div></article>';
  }).join('');
}

function renderFeed(analytics = {}, alerts = []) {
  if (!feedRoot) return;

  const leadRate = analytics.leadAnalytics?.conversionRate || 0;
  const completionRate = analytics.jobAnalytics?.completionRate || 0;
  const revenue = Number(analytics.jobAnalytics?.revenue || 0).toFixed(2);

  const items = [
    ['Alert Volume', alerts.length + ' active alert(s) detected.'],
    ['Lead Conversion', leadRate + '% current lead conversion rate.'],
    ['Job Completion', completionRate + '% current job completion rate.'],
    ['Revenue Watch', '$' + revenue + ' tracked operational revenue.']
  ];

  feedRoot.innerHTML = items.map(([title, detail]) => {
    return '<article class="item"><h3>' + clean(title) + '</h3><p class="muted">' + clean(detail) + '</p></article>';
  }).join('');
}

function renderAll(analytics) {
  const alerts = evaluateOperationsAlerts(analytics);
  renderAlerts(alerts);
  renderFeed(analytics, alerts);
  status('Executive alerts synced.');
}

async function loadDashboard() {
  status('Loading executive alerts...');
  const analytics = await loadOperationsAnalytics();
  renderAll(analytics);
}

function startRealtime() {
  if (realtimeStarted) return;
  realtimeStarted = true;

  startOperationsAnalyticsRealtime((analytics) => {
    renderAll(analytics);
  }, {
    onError(error) {
      console.error(error);
      status('Realtime alerts listener failed.');
    }
  });
}

function cleanup() {
  stopOperationsAnalyticsRealtime();
  realtimeStarted = false;
}

function init() {
  window.EvaraPageLifecycle?.registerCleanup?.(cleanup);
  window.addEventListener('pagehide', cleanup);

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      cleanup();
      window.location.assign('/login.html');
      return;
    }

    if (!isAlertsAdmin()) {
      status('Alerts access requires operational permissions.');
      if (root) root.innerHTML = '<div class="item muted">You do not have access to executive alerts.</div>';
      if (feedRoot) feedRoot.innerHTML = '<div class="item muted">You do not have access to executive alerts.</div>';
      return;
    }

    try {
      await loadDashboard();
      startRealtime();
    } catch (error) {
      console.error(error);
      status('Executive alerts failed to load.');
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
