import {
  auth,
  onAuthStateChanged,
  getSavedUserProfile
} from './firebase.js';

import {
  startAuditLogEngine,
  stopAuditLogEngine,
  getAuditEntries
} from './audit-log-engine.js';

import {
  startEventPersistence,
  stopEventPersistence,
  isEventPersistenceEnabled
} from './operations-event-persistence.js';

import {
  buildReplayTimelines,
  buildTimelineDetail,
  subscribeReplayTimelines,
  unsubscribeReplayTimelines,
  summarizeReplayTimelines
} from './compliance-replay.js';

const statusNode = document.getElementById('replayStatus');
const timelineRoot = document.getElementById('replayTimelineRoot');
const detailRoot = document.getElementById('replayDetailRoot');
const totalTimelineNode = document.getElementById('replayTimelineCount');
const totalEventNode = document.getElementById('replayEventCount');
const criticalNode = document.getElementById('replayCriticalCount');
const persistenceNode = document.getElementById('replayPersistenceStatus');
const filterRoot = document.getElementById('replayFilters');

let replayListenerId = null;
let activeFilter = 'all';
let selectedTimelineId = '';

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

function isReplayAdmin() {
  const profile = getSavedUserProfile() || {};
  const role = String(profile.role || '').toLowerCase();
  return ['owner', 'super_admin', 'admin', 'manager', 'operations_manager'].includes(role);
}

function timelineOptions() {
  if (activeFilter === 'all') return {};
  if (activeFilter === 'critical') return { severity: 'critical' };
  if (activeFilter === 'warning') return { severity: 'warning' };
  return { category: activeFilter };
}

function currentTimelines() {
  return buildReplayTimelines(getAuditEntries(), timelineOptions());
}

function formatDate(ms) {
  if (!ms) return 'No timestamp';
  try {
    return new Date(Number(ms)).toLocaleString();
  } catch (error) {
    return 'Invalid timestamp';
  }
}

function renderStats(timelines = currentTimelines()) {
  const summary = summarizeReplayTimelines(timelines);
  const critical = Number(summary.bySeverity?.critical || 0);

  if (totalTimelineNode) totalTimelineNode.textContent = String(summary.totalTimelines || 0);
  if (totalEventNode) totalEventNode.textContent = String(summary.totalEvents || 0);
  if (criticalNode) criticalNode.textContent = String(critical);
  if (persistenceNode) persistenceNode.textContent = isEventPersistenceEnabled() ? 'Enabled' : 'Stopped';
}

function renderFilters() {
  if (!filterRoot) return;

  const timelines = buildReplayTimelines(getAuditEntries());
  const summary = summarizeReplayTimelines(timelines);
  const filters = ['all', 'critical', 'warning', ...Object.keys(summary.byCategory || {})];

  filterRoot.innerHTML = [...new Set(filters)].map((filter) => {
    const active = filter === activeFilter ? ' active' : '';
    return '<button type="button" class="dashboard-nav-link' + active + '" data-replay-filter="' + clean(filter) + '"><span class="dashboard-nav-icon">◌</span><span>' + clean(label(filter)) + '</span></button>';
  }).join('');
}

function renderTimelines(timelines = currentTimelines()) {
  if (!timelineRoot) return;

  renderStats(timelines);
  renderFilters();

  if (!timelines.length) {
    timelineRoot.innerHTML = '<div class="item muted">No replay timelines for this filter yet.</div>';
    renderDetail(null);
    return;
  }

  if (!selectedTimelineId || !timelines.some((timeline) => timeline.id === selectedTimelineId)) {
    selectedTimelineId = timelines[0].id;
  }

  timelineRoot.innerHTML = timelines.slice(0, 40).map((timeline) => {
    const selected = timeline.id === selectedTimelineId ? ' active' : '';
    const summary = timeline.summary || {};
    return '<article class="item replay-item' + selected + '" data-replay-id="' + clean(timeline.id) + '"><h3>' + clean(timeline.correlationId || 'Uncorrelated timeline') + '</h3><p class="muted">Last event: ' + clean(formatDate(summary.lastAtMs)) + '</p><div class="row"><span class="pill">Events: ' + clean(String(summary.count || 0)) + '</span><span class="pill">' + clean((summary.categories || []).map(label).join(', ') || 'System') + '</span><span class="pill">' + clean((summary.severities || []).map(label).join(', ') || 'Info') + '</span></div></article>';
  }).join('');

  renderDetail(timelines.find((timeline) => timeline.id === selectedTimelineId));
}

function renderDetail(timeline) {
  if (!detailRoot) return;

  if (!timeline) {
    detailRoot.innerHTML = '<div class="item muted">Select a replay timeline to inspect operational sequence.</div>';
    return;
  }

  const summary = timeline.summary || {};
  const eventHtml = (timeline.entries || []).map((entry, index) => {
    const payload = JSON.stringify(entry.payloadSnapshot || {}, null, 2);
    return '<article class="item"><h3>' + clean(String(index + 1)) + '. ' + clean(entry.eventType || 'system.event') + '</h3><p class="muted">' + clean(formatDate(entry.createdAtMs)) + ' • Source: ' + clean(entry.source || 'evaraos') + '</p><div class="row"><span class="pill">' + clean(label(entry.category || 'system')) + '</span><span class="pill">' + clean(label(entry.severity || 'info')) + '</span></div><pre class="muted" style="white-space:pre-wrap;overflow:auto;max-height:180px;margin-top:12px">' + clean(payload) + '</pre></article>';
  }).join('');

  detailRoot.innerHTML = '<article class="item"><h3>Timeline Summary</h3><p class="muted">Correlation: ' + clean(timeline.correlationId || 'none') + '</p><p class="muted">Window: ' + clean(formatDate(summary.firstAtMs)) + ' → ' + clean(formatDate(summary.lastAtMs)) + '</p><div class="row"><span class="pill">Events: ' + clean(String(summary.count || 0)) + '</span><span class="pill">Sources: ' + clean((summary.sources || []).length) + '</span></div></article>' + eventHtml;
}

function bindEvents() {
  filterRoot?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-replay-filter]');
    if (!button) return;

    activeFilter = button.getAttribute('data-replay-filter') || 'all';
    selectedTimelineId = '';
    renderTimelines();
  });

  timelineRoot?.addEventListener('click', (event) => {
    const item = event.target.closest('[data-replay-id]');
    if (!item) return;

    selectedTimelineId = item.getAttribute('data-replay-id') || '';
    const detail = buildTimelineDetail(selectedTimelineId, getAuditEntries());
    renderTimelines();
    renderDetail(detail);
  });
}

function startReplayDashboard() {
  stopReplayDashboard();
  startAuditLogEngine();
  startEventPersistence();

  replayListenerId = subscribeReplayTimelines((timelines) => {
    renderTimelines(currentTimelines().length ? currentTimelines() : timelines);
    status('Replay timelines synced.');
  }, timelineOptions());

  renderTimelines();
}

function stopReplayDashboard() {
  if (replayListenerId) unsubscribeReplayTimelines(replayListenerId);
  replayListenerId = null;
  stopAuditLogEngine();
  stopEventPersistence();
}

function init() {
  bindEvents();
  window.EvaraPageLifecycle?.registerCleanup?.(stopReplayDashboard);
  window.addEventListener('pagehide', stopReplayDashboard);

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      stopReplayDashboard();
      window.location.assign('/login.html');
      return;
    }

    if (!isReplayAdmin()) {
      status('Replay dashboard requires leadership permissions.');
      if (timelineRoot) timelineRoot.innerHTML = '<div class="item muted">You do not have access to compliance replay tools.</div>';
      return;
    }

    try {
      startReplayDashboard();
    } catch (error) {
      console.error(error);
      status('Replay dashboard failed to start.');
    }
  });
}

window.EvaraReplayDashboard = {
  startReplayDashboard,
  stopReplayDashboard,
  renderTimelines,
  currentTimelines
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
