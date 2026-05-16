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

const statusNode = document.getElementById('analyticsStatus');
const leadTotalNode = document.getElementById('analyticsLeadTotal');
const leadConversionNode = document.getElementById('analyticsLeadConversion');
const jobTotalNode = document.getElementById('analyticsJobTotal');
const jobCompletionNode = document.getElementById('analyticsJobCompletion');
const revenueNode = document.getElementById('analyticsRevenue');
const territoryCountNode = document.getElementById('analyticsTerritoryCount');
const territoryRoot = document.getElementById('analyticsTerritoryRoot');
const feedRoot = document.getElementById('analyticsFeedRoot');

let realtimeStarted = false;

function clean(value = '') {
  return String(value || '').replace(/[<>]/g, '');
}

function money(value = 0) {
  return '$' + Number(value || 0).toFixed(2);
}

function status(message = '') {
  if (statusNode) statusNode.textContent = message;
}

function isAnalyticsAdmin() {
  const profile = getSavedUserProfile() || {};
  const role = String(profile.role || '').toLowerCase();
  return ['owner', 'super_admin', 'admin', 'manager', 'operations_manager', 'dispatcher', 'sales_manager'].includes(role);
}

function renderKpis(data) {
  if (leadTotalNode) leadTotalNode.textContent = String(data.leadAnalytics.total);
  if (leadConversionNode) leadConversionNode.textContent = data.leadAnalytics.conversionRate + '%';
  if (jobTotalNode) jobTotalNode.textContent = String(data.jobAnalytics.total);
  if (jobCompletionNode) jobCompletionNode.textContent = data.jobAnalytics.completionRate + '%';
  if (revenueNode) revenueNode.textContent = money(data.jobAnalytics.revenue);
  if (territoryCountNode) territoryCountNode.textContent = String(data.territoryAnalytics.length);
}

function renderTerritories(rows = []) {
  if (!territoryRoot) return;

  if (!rows.length) {
    territoryRoot.innerHTML = '<div class="item muted">No territory analytics yet.</div>';
    return;
  }

  const sorted = [...rows].sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0));

  territoryRoot.innerHTML = sorted.map((row) => {
    return '<article class="item"><h3>' + clean(row.name) + '</h3><p class="muted">Region: ' + clean(row.regionId || 'unassigned-region') + '</p><div class="row"><span class="pill">Leads: ' + clean(String(row.leads || 0)) + '</span><span class="pill">Jobs: ' + clean(String(row.jobs || 0)) + '</span><span class="pill">Done: ' + clean(String(row.completionRate || 0)) + '%</span><span class="pill">' + money(row.revenue) + '</span></div></article>';
  }).join('');
}

function renderFeed(data) {
  if (!feedRoot) return;

  const items = [
    ['Lead Conversion', data.leadAnalytics.converted + ' converted out of ' + data.leadAnalytics.total + ' leads.'],
    ['Job Completion', data.jobAnalytics.completed + ' completed out of ' + data.jobAnalytics.total + ' jobs.'],
    ['Active Work', data.jobAnalytics.active + ' active jobs and ' + data.leadAnalytics.active + ' active leads.'],
    ['Operational Revenue', money(data.jobAnalytics.revenue) + ' currently tracked from jobs.']
  ];

  feedRoot.innerHTML = items.map(([title, detail]) => {
    return '<article class="item"><h3>' + clean(title) + '</h3><p class="muted">' + clean(detail) + '</p></article>';
  }).join('');
}

function renderAll(data) {
  renderKpis(data);
  renderTerritories(data.territoryAnalytics);
  renderFeed(data);
}

async function loadDashboard() {
  status('Loading operational analytics...');

  const data = await loadOperationsAnalytics();
  renderAll(data);

  status('Analytics synced.');
}

function startRealtime() {
  if (realtimeStarted) return;
  realtimeStarted = true;

  startOperationsAnalyticsRealtime((data) => {
    renderAll(data);
    status('Realtime analytics synced.');
  }, {
    onError(error) {
      console.error(error);
      status('Realtime analytics listener failed.');
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

    if (!isAnalyticsAdmin()) {
      status('Analytics access requires operational permissions.');
      if (territoryRoot) territoryRoot.innerHTML = '<div class="item muted">You do not have access to operational analytics.</div>';
      if (feedRoot) feedRoot.innerHTML = '<div class="item muted">You do not have access to operational analytics.</div>';
      return;
    }

    try {
      await loadDashboard();
      startRealtime();
    } catch (error) {
      console.error(error);
      status('Analytics failed to load.');
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
