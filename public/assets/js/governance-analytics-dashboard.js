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

import { buildGovernanceAnalytics } from './governance-analytics.js';

import {
  createDashboardRuntime,
  startDashboardRuntime,
  stopDashboardRuntime,
  registerRuntimeCleanup
} from './dashboard-runtime.js';

const statusNode = document.getElementById('governanceAnalyticsStatus');
const riskScoreNode = document.getElementById('governanceRiskScore');
const riskLevelNode = document.getElementById('governanceRiskLevel');
const auditTotalNode = document.getElementById('governanceAuditTotal');
const correlationRateNode = document.getElementById('governanceCorrelationRate');
const replayTimelineNode = document.getElementById('governanceReplayTimelines');
const reconstructionRateNode = document.getElementById('governanceReconstructionRate');
const persistenceNode = document.getElementById('governancePersistenceStatus');
const hotspotRoot = document.getElementById('governanceHotspotRoot');
const intelligenceRoot = document.getElementById('governanceIntelligenceRoot');
const replayRoot = document.getElementById('governanceReplayMetricsRoot');

const runtime = createDashboardRuntime({
  id: 'governance-analytics-dashboard-runtime',
  name: 'Governance Analytics Dashboard Runtime',
  metadata: { page: 'governance-analytics.html' }
});

let auditListenerId = null;

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

function isGovernanceAdmin() {
  const profile = getSavedUserProfile() || {};
  const role = String(profile.role || '').toLowerCase();
  return ['owner', 'super_admin', 'admin', 'manager', 'operations_manager'].includes(role);
}

function renderStats(data) {
  const audit = data.auditMetrics || {};
  const replay = data.replayMetrics || {};
  const risk = data.risk || {};

  if (riskScoreNode) riskScoreNode.textContent = String(risk.score || 0);
  if (riskLevelNode) riskLevelNode.textContent = label(risk.level || 'low');
  if (auditTotalNode) auditTotalNode.textContent = String(audit.total || 0);
  if (correlationRateNode) correlationRateNode.textContent = String(audit.correlationRate || 0) + '%';
  if (replayTimelineNode) replayTimelineNode.textContent = String(replay.totalTimelines || 0);
  if (reconstructionRateNode) reconstructionRateNode.textContent = String(replay.reconstructionRate || 0) + '%';
  if (persistenceNode) persistenceNode.textContent = isEventPersistenceEnabled() ? 'Enabled' : 'Stopped';
}

function renderHotspots(hotspots = []) {
  if (!hotspotRoot) return;

  if (!hotspots.length) {
    hotspotRoot.innerHTML = '<div class="item muted">No governance hotspots detected yet.</div>';
    return;
  }

  hotspotRoot.innerHTML = hotspots.slice(0, 12).map((row) => {
    return '<article class="item"><h3>' + clean(label(row.category)) + '</h3><p class="muted">Risk weight: ' + clean(String(row.riskWeight || 0)) + ' • Latest activity: ' + clean(String(row.latestAgeMinutes || 0)) + ' minutes ago</p><div class="row"><span class="pill">Events: ' + clean(String(row.total || 0)) + '</span><span class="pill">Critical: ' + clean(String(row.critical || 0)) + '</span><span class="pill">Warnings: ' + clean(String(row.warning || 0)) + '</span></div></article>';
  }).join('');
}

function renderIntelligence(data) {
  if (!intelligenceRoot) return;

  const audit = data.auditMetrics || {};
  const risk = data.risk || {};

  const items = [
    ['Governance Risk', 'Current governance risk is ' + (risk.level || 'low') + ' with a score of ' + (risk.score || 0) + '.'],
    ['Correlation Integrity', (audit.correlationRate || 0) + '% of audit events include correlation IDs.'],
    ['Critical Density', (audit.criticalRate || 0) + '% of audit events are critical severity.'],
    ['Warning Density', (audit.warningRate || 0) + '% of audit events are warning severity.']
  ];

  intelligenceRoot.innerHTML = items.map(([title, detail]) => {
    return '<article class="item"><h3>' + clean(title) + '</h3><p class="muted">' + clean(detail) + '</p></article>';
  }).join('');
}

function renderReplayMetrics(data) {
  if (!replayRoot) return;

  const replay = data.replayMetrics || {};

  const items = [
    ['Replay Timelines', String(replay.totalTimelines || 0) + ' correlation timelines detected.'],
    ['Replay Events', String(replay.totalEvents || 0) + ' replayable events across governance timelines.'],
    ['Average Events', String(replay.averageEventsPerTimeline || 0) + ' events per timeline.'],
    ['Longest Timeline', String(replay.longestTimelineEvents || 0) + ' events in the longest timeline.']
  ];

  replayRoot.innerHTML = items.map(([title, detail]) => {
    return '<article class="item"><h3>' + clean(title) + '</h3><p class="muted">' + clean(detail) + '</p></article>';
  }).join('');
}

function renderDashboard() {
  const data = buildGovernanceAnalytics(getAuditEntries());
  renderStats(data);
  renderHotspots(data.hotspots || []);
  renderIntelligence(data);
  renderReplayMetrics(data);
  status('Governance analytics synced.');
}

async function startGovernanceAnalyticsDashboard() {
  stopGovernanceAnalyticsDashboard();

  await startDashboardRuntime(runtime.id, [
    {
      label: 'Start audit log engine',
      run() {
        startAuditLogEngine();
        return stopAuditLogEngine;
      }
    },
    {
      label: 'Start event persistence',
      run() {
        startEventPersistence();
        return stopEventPersistence;
      }
    },
    {
      label: 'Subscribe governance analytics renderer',
      run() {
        auditListenerId = subscribeAuditLog(() => {
          renderDashboard();
        });

        return () => {
          if (auditListenerId) unsubscribeAuditLog(auditListenerId);
          auditListenerId = null;
        };
      }
    }
  ]);

  renderDashboard();
}

function stopGovernanceAnalyticsDashboard() {
  if (auditListenerId) unsubscribeAuditLog(auditListenerId);
  auditListenerId = null;
  stopDashboardRuntime(runtime.id);
}

function init() {
  registerRuntimeCleanup(runtime.id, stopGovernanceAnalyticsDashboard);
  window.EvaraPageLifecycle?.registerCleanup?.(stopGovernanceAnalyticsDashboard);
  window.addEventListener('pagehide', stopGovernanceAnalyticsDashboard);

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      stopGovernanceAnalyticsDashboard();
      window.location.assign('/login.html');
      return;
    }

    if (!isGovernanceAdmin()) {
      status('Governance analytics requires leadership permissions.');
      if (hotspotRoot) hotspotRoot.innerHTML = '<div class="item muted">You do not have access to governance analytics.</div>';
      return;
    }

    startGovernanceAnalyticsDashboard().catch((error) => {
      console.error(error);
      status('Governance analytics failed to start.');
    });
  });
}

window.EvaraGovernanceAnalyticsDashboard = {
  startGovernanceAnalyticsDashboard,
  stopGovernanceAnalyticsDashboard,
  renderDashboard
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
