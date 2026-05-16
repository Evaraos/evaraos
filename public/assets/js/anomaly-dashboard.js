import {
  auth,
  onAuthStateChanged,
  getSavedUserProfile
} from './firebase.js';

import {
  startAuditLogEngine,
  stopAuditLogEngine,
  subscribeAuditLog,
  unsubscribeAuditLog,
  getAuditEntries
} from './audit-log-engine.js';

import {
  startEventPersistence,
  stopEventPersistence,
  isEventPersistenceEnabled
} from './operations-event-persistence.js';

import {
  detectGovernanceAnomalies,
  summarizeGovernanceAnomalies
} from './governance-anomaly-detection.js';

import {
  startGovernanceAnomalyEscalation,
  stopGovernanceAnomalyEscalation,
  runGovernanceAnomalyEscalation,
  getGovernanceAnomalyEscalationCount
} from './governance-anomaly-escalation.js';

const statusNode = document.getElementById('anomalyStatus');
const totalNode = document.getElementById('anomalyTotalCount');
const criticalNode = document.getElementById('anomalyCriticalCount');
const warningNode = document.getElementById('anomalyWarningCount');
const categoryNode = document.getElementById('anomalyCategoryCount');
const persistenceNode = document.getElementById('anomalyPersistenceStatus');
const anomalyRoot = document.getElementById('anomalyRoot');
const recommendationRoot = document.getElementById('anomalyRecommendationRoot');
const filterRoot = document.getElementById('anomalyFilters');

let auditListenerId = null;
let activeFilter = 'all';

function clean(value = '') {
  return String(value || '').replace(/[<>]/g, '');
}

function label(value = '') {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function status(message = '') {
  if (statusNode) statusNode.textContent = message;
}

function isAnomalyAdmin() {
  const profile = getSavedUserProfile() || {};
  const role = String(profile.role || '').toLowerCase();
  return ['owner', 'super_admin', 'admin', 'manager', 'operations_manager'].includes(role);
}

function allAnomalies() {
  return detectGovernanceAnomalies(getAuditEntries());
}

function filteredAnomalies() {
  const anomalies = allAnomalies();

  if (activeFilter === 'all') return anomalies;
  if (activeFilter === 'critical' || activeFilter === 'warning' || activeFilter === 'info') {
    return anomalies.filter((anomaly) => anomaly.level === activeFilter);
  }

  return anomalies.filter((anomaly) => anomaly.category === activeFilter);
}

function renderStats(anomalies = allAnomalies()) {
  const summary = summarizeGovernanceAnomalies(anomalies);
  const categories = Object.keys(summary.byCategory || {}).length;

  if (totalNode) totalNode.textContent = String(summary.total || 0);
  if (criticalNode) criticalNode.textContent = String(summary.byLevel?.critical || 0);
  if (warningNode) warningNode.textContent = String(summary.byLevel?.warning || 0);
  if (categoryNode) categoryNode.textContent = String(categories || 0);
  if (persistenceNode) persistenceNode.textContent = isEventPersistenceEnabled() ? 'Enabled' : 'Stopped';
}

function renderFilters(anomalies = allAnomalies()) {
  if (!filterRoot) return;

  const summary = summarizeGovernanceAnomalies(anomalies);
  const filters = ['all', 'critical', 'warning', ...Object.keys(summary.byCategory || {})];

  filterRoot.innerHTML = [...new Set(filters)].map((filter) => {
    const active = filter === activeFilter ? ' active' : '';
    return '<button type="button" class="dashboard-nav-link' + active + '" data-anomaly-filter="' + clean(filter) + '"><span class="dashboard-nav-icon">▲</span><span>' + clean(label(filter)) + '</span></button>';
  }).join('');
}

function renderAnomalies() {
  if (!anomalyRoot) return;

  const all = allAnomalies();
  const rows = filteredAnomalies();

  renderStats(all);
  renderFilters(all);
  renderRecommendations(all);

  if (!rows.length) {
    anomalyRoot.innerHTML = '<div class="item muted">No governance anomalies detected for this filter.</div>';
    return;
  }

  anomalyRoot.innerHTML = rows.map((anomaly) => {
    return '<article class="item"><h3>' + clean(anomaly.title) + '</h3><p class="muted">' + clean(anomaly.detail || 'No details.') + '</p><div class="row"><span class="pill">' + clean(label(anomaly.level)) + '</span><span class="pill">' + clean(label(anomaly.category)) + '</span><span class="pill">' + clean(anomaly.source || 'governance') + '</span></div><p class="muted" style="margin-top:12px"><strong>Recommendation:</strong> ' + clean(anomaly.recommendation || 'Review related governance records.') + '</p></article>';
  }).join('');
}

function renderRecommendations(anomalies = allAnomalies()) {
  if (!recommendationRoot) return;

  if (!anomalies.length) {
    recommendationRoot.innerHTML = '<div class="item muted">No recommendations right now. Governance patterns are within configured thresholds.</div>';
    return;
  }

  const grouped = anomalies.reduce((groups, anomaly) => {
    const recommendation = anomaly.recommendation || 'Review related governance records.';
    groups[recommendation] = groups[recommendation] || {
      recommendation,
      count: 0,
      highestLevel: 'info'
    };
    groups[recommendation].count += 1;
    if (anomaly.level === 'critical') groups[recommendation].highestLevel = 'critical';
    else if (anomaly.level === 'warning' && groups[recommendation].highestLevel !== 'critical') groups[recommendation].highestLevel = 'warning';
    return groups;
  }, {});

  recommendationRoot.innerHTML = Object.values(grouped).map((row) => {
    return '<article class="item"><h3>' + clean(label(row.highestLevel)) + ' Recommendation</h3><p class="muted">' + clean(row.recommendation) + '</p><div class="row"><span class="pill">Signals: ' + clean(String(row.count || 0)) + '</span></div></article>';
  }).join('');
}

function syncEscalations() {
  const created = runGovernanceAnomalyEscalation(getAuditEntries());
  const total = getGovernanceAnomalyEscalationCount();
  if (created.length) status('Governance anomalies synced. ' + created.length + ' new escalation(s), ' + total + ' total routed.');
  else status('Governance anomalies synced. ' + total + ' escalation(s) routed.');
}

function bindEvents() {
  filterRoot?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-anomaly-filter]');
    if (!button) return;

    activeFilter = button.getAttribute('data-anomaly-filter') || 'all';
    renderAnomalies();
  });
}

function startAnomalyDashboard() {
  stopAnomalyDashboard();
  startAuditLogEngine();
  startEventPersistence();
  startGovernanceAnomalyEscalation();

  auditListenerId = subscribeAuditLog(() => {
    renderAnomalies();
    syncEscalations();
  });

  renderAnomalies();
  syncEscalations();
}

function stopAnomalyDashboard() {
  if (auditListenerId) unsubscribeAuditLog(auditListenerId);
  auditListenerId = null;
  stopGovernanceAnomalyEscalation();
  stopAuditLogEngine();
  stopEventPersistence();
}

function init() {
  bindEvents();
  window.EvaraPageLifecycle?.registerCleanup?.(stopAnomalyDashboard);
  window.addEventListener('pagehide', stopAnomalyDashboard);

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      stopAnomalyDashboard();
      window.location.assign('/login.html');
      return;
    }

    if (!isAnomalyAdmin()) {
      status('Anomaly dashboard requires leadership permissions.');
      if (anomalyRoot) anomalyRoot.innerHTML = '<div class="item muted">You do not have access to governance anomaly tools.</div>';
      return;
    }

    try {
      startAnomalyDashboard();
    } catch (error) {
      console.error(error);
      status('Anomaly dashboard failed to start.');
    }
  });
}

window.EvaraAnomalyDashboard = {
  startAnomalyDashboard,
  stopAnomalyDashboard,
  renderAnomalies,
  allAnomalies,
  syncEscalations
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
