import {
  auth,
  onAuthStateChanged,
  getSavedUserProfile
} from './firebase.js';

import {
  createDashboardRuntime,
  startDashboardRuntime,
  stopDashboardRuntime,
  registerRuntimeCleanup
} from './dashboard-runtime.js';

import {
  startPresenceHeartbeatMonitor,
  stopPresenceHeartbeatMonitor
} from './live-workforce-presence.js';

import {
  startWorkforceAvailabilityEngine,
  stopWorkforceAvailabilityEngine
} from './workforce-availability.js';

import {
  startShiftOrchestration,
  stopShiftOrchestration
} from './shift-orchestration.js';

import {
  startAutoAssignmentEngine,
  stopAutoAssignmentEngine
} from './auto-assignment-engine.js';

import {
  startOperationsCommandCenter,
  stopOperationsCommandCenter,
  subscribeOperationsCommand,
  unsubscribeOperationsCommand,
  refreshOperationsCommand
} from './live-operations-command.js';

const statusNode = document.getElementById('operationsCommandStatus');
const riskScoreNode = document.getElementById('operationsRiskScore');
const riskLevelNode = document.getElementById('operationsRiskLevel');
const activeWorkforceNode = document.getElementById('operationsActiveWorkforce');
const dispatchReadyNode = document.getElementById('operationsDispatchReady');
const activeRoutesNode = document.getElementById('operationsActiveRoutes');
const riskyTerritoriesNode = document.getElementById('operationsRiskyTerritories');
const summaryRoot = document.getElementById('operationsSummaryRoot');
const recommendationRoot = document.getElementById('operationsRecommendationRoot');
const territoryRoot = document.getElementById('operationsTerritoryRoot');
const routeRoot = document.getElementById('operationsRouteRoot');

const runtime = createDashboardRuntime({
  id: 'live-operations-command-runtime',
  name: 'Live Operations Command Runtime',
  metadata: { page: 'live-operations-command.html' }
});

let commandListenerId = null;

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

function isOperationsAdmin() {
  const profile = getSavedUserProfile() || {};
  const role = String(profile.role || '').toLowerCase();
  return ['owner', 'super_admin', 'admin', 'manager', 'operations_manager', 'operations_coordinator'].includes(role);
}

function renderStats(snapshot = {}) {
  if (riskScoreNode) riskScoreNode.textContent = String(snapshot.risk?.score || 0);
  if (riskLevelNode) riskLevelNode.textContent = label(snapshot.risk?.level || 'stable');
  if (activeWorkforceNode) activeWorkforceNode.textContent = String(snapshot.presenceSummary?.active || 0);
  if (dispatchReadyNode) dispatchReadyNode.textContent = String(snapshot.availabilitySummary?.dispatchReady || 0);
  if (activeRoutesNode) activeRoutesNode.textContent = String(snapshot.routeSummary?.active || 0);
  if (riskyTerritoriesNode) riskyTerritoriesNode.textContent = String(snapshot.territorySummary?.risky || 0);
}

function renderSummary(snapshot = {}) {
  if (!summaryRoot) return;

  const rows = [
    ['Workforce Presence', `${snapshot.presenceSummary?.active || 0} active of ${snapshot.presenceSummary?.total || 0} tracked team members.`],
    ['Availability', `${snapshot.availabilitySummary?.dispatchReady || 0} dispatch-ready, ${snapshot.availabilitySummary?.overloaded || 0} overloaded.`],
    ['Dispatch', `${snapshot.dispatchSummary?.withCandidate || 0} recommendations with candidates, ${snapshot.dispatchSummary?.noCandidate || 0} without candidates.`],
    ['Assignments', `${snapshot.assignmentSummary?.eligible || 0} eligible assignments, ${snapshot.assignmentSummary?.noCandidate || 0} needing manual review.`],
    ['Shifts', `${snapshot.shiftSummary?.active || 0} active, ${snapshot.shiftSummary?.missed || 0} missed.`],
    ['Routes', `${snapshot.routeSummary?.active || 0} active routes with ${snapshot.routeSummary?.totalStops || 0} total stops.`]
  ];

  summaryRoot.innerHTML = rows.map(([title, detail]) => {
    return '<article class="item"><h3>' + clean(title) + '</h3><p class="muted">' + clean(detail) + '</p></article>';
  }).join('');
}

function renderRecommendations(snapshot = {}) {
  if (!recommendationRoot) return;

  const rows = snapshot.recommendations || [];
  if (!rows.length) {
    recommendationRoot.innerHTML = '<div class="item muted">No operational recommendations yet.</div>';
    return;
  }

  recommendationRoot.innerHTML = rows.map((recommendation) => {
    return '<article class="item"><h3>Recommended Action</h3><p class="muted">' + clean(recommendation) + '</p></article>';
  }).join('');
}

function renderTerritories(snapshot = {}) {
  if (!territoryRoot) return;

  const rows = snapshot.territoryBalance || [];
  if (!rows.length) {
    territoryRoot.innerHTML = '<div class="item muted">No territory balance data yet.</div>';
    return;
  }

  territoryRoot.innerHTML = rows.slice(0, 12).map((territory) => {
    return '<article class="item"><h3>' + clean(territory.territoryName || territory.territoryId) + '</h3><p class="muted">Status: ' + clean(label(territory.status)) + ' • Balance score: ' + clean(String(territory.balanceScore || 0)) + '</p><div class="row"><span class="pill">Ready: ' + clean(String(territory.dispatchReadyCount || 0)) + '</span><span class="pill">Queued: ' + clean(String(territory.queuedAssignmentCount || 0)) + '</span><span class="pill">Routes: ' + clean(String(territory.activeRouteCount || 0)) + '</span></div></article>';
  }).join('');
}

function renderRoutes(snapshot = {}) {
  if (!routeRoot) return;

  const rows = snapshot.routes || [];
  if (!rows.length) {
    routeRoot.innerHTML = '<div class="item muted">No operational routes yet.</div>';
    return;
  }

  routeRoot.innerHTML = rows.slice(0, 12).map((route) => {
    return '<article class="item"><h3>' + clean(route.title || 'Operational Route') + '</h3><p class="muted">Assigned to ' + clean(route.assignedToName || 'Team Member') + ' • Status: ' + clean(label(route.status)) + '</p><div class="row"><span class="pill">Stops: ' + clean(String(route.stats?.stopCount || 0)) + '</span><span class="pill">Done: ' + clean(String(route.stats?.completedStops || 0)) + '</span><span class="pill">Progress: ' + clean(String(route.stats?.progressPercent || 0)) + '%</span></div></article>';
  }).join('');
}

function renderCommand(snapshot = {}) {
  renderStats(snapshot);
  renderSummary(snapshot);
  renderRecommendations(snapshot);
  renderTerritories(snapshot);
  renderRoutes(snapshot);
  status('Live operations command synced.');
}

async function startLiveOperationsCommandDashboard() {
  stopLiveOperationsCommandDashboard();

  await startDashboardRuntime(runtime.id, [
    {
      label: 'Start presence heartbeat monitor',
      run() {
        startPresenceHeartbeatMonitor();
        return stopPresenceHeartbeatMonitor;
      }
    },
    {
      label: 'Start workforce availability engine',
      run() {
        startWorkforceAvailabilityEngine();
        return stopWorkforceAvailabilityEngine;
      }
    },
    {
      label: 'Start shift orchestration',
      run() {
        startShiftOrchestration();
        return stopShiftOrchestration;
      }
    },
    {
      label: 'Start auto-assignment engine',
      run() {
        startAutoAssignmentEngine({ autoQueue: false });
        return stopAutoAssignmentEngine;
      }
    },
    {
      label: 'Start operations command center',
      run() {
        startOperationsCommandCenter();
        return stopOperationsCommandCenter;
      }
    },
    {
      label: 'Subscribe operations command renderer',
      run() {
        commandListenerId = subscribeOperationsCommand((snapshot) => {
          renderCommand(snapshot);
        });

        return () => {
          if (commandListenerId) unsubscribeOperationsCommand(commandListenerId);
          commandListenerId = null;
        };
      }
    }
  ]);

  renderCommand(refreshOperationsCommand());
}

function stopLiveOperationsCommandDashboard() {
  if (commandListenerId) unsubscribeOperationsCommand(commandListenerId);
  commandListenerId = null;
  stopDashboardRuntime(runtime.id);
}

function init() {
  registerRuntimeCleanup(runtime.id, stopLiveOperationsCommandDashboard);
  window.EvaraPageLifecycle?.registerCleanup?.(stopLiveOperationsCommandDashboard);
  window.addEventListener('pagehide', stopLiveOperationsCommandDashboard);

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      stopLiveOperationsCommandDashboard();
      window.location.assign('/login.html');
      return;
    }

    if (!isOperationsAdmin()) {
      status('Live operations command requires operations leadership permissions.');
      if (summaryRoot) summaryRoot.innerHTML = '<div class="item muted">You do not have access to live operations command.</div>';
      return;
    }

    startLiveOperationsCommandDashboard().catch((error) => {
      console.error(error);
      status('Live operations command failed to start.');
    });
  });
}

window.EvaraLiveOperationsCommandDashboard = {
  startLiveOperationsCommandDashboard,
  stopLiveOperationsCommandDashboard,
  renderCommand
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
