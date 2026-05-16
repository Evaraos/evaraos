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
  getAuditEntries,
  summarizeAuditLog
} from './audit-log-engine.js';

import {
  startEventPersistence,
  stopEventPersistence,
  isEventPersistenceEnabled
} from './operations-event-persistence.js';

import {
  createDashboardRuntime,
  startDashboardRuntime,
  stopDashboardRuntime,
  registerRuntimeCleanup
} from './dashboard-runtime.js';

const statusNode = document.getElementById('auditStatus');
const auditRoot = document.getElementById('auditRoot');
const detailRoot = document.getElementById('auditDetail');
const totalNode = document.getElementById('auditTotalCount');
const criticalNode = document.getElementById('auditCriticalCount');
const warningNode = document.getElementById('auditWarningCount');
const categoryNode = document.getElementById('auditCategoryCount');
const persistenceNode = document.getElementById('auditPersistenceStatus');
const filterRoot = document.getElementById('auditFilters');

const runtime = createDashboardRuntime({
  id: 'audit-dashboard-runtime',
  name: 'Audit Dashboard Runtime',
  metadata: { page: 'audit-dashboard.html' }
});

let auditListenerId = null;
let activeCategory = 'all';
let selectedAuditId = '';

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

function isAuditAdmin() {
  const profile = getSavedUserProfile() || {};
  const role = String(profile.role || '').toLowerCase();
  return ['owner', 'super_admin', 'admin', 'manager', 'operations_manager'].includes(role);
}

function filteredEntries() {
  if (activeCategory === 'all') return getAuditEntries();
  if (activeCategory === 'critical') return getAuditEntries({ severity: 'critical' });
  if (activeCategory === 'warning') return getAuditEntries({ severity: 'warning' });
  return getAuditEntries({ category: activeCategory });
}

function renderStats(entries = getAuditEntries()) {
  const summary = summarizeAuditLog(entries);
  const categories = Object.keys(summary.byCategory || {}).length;

  if (totalNode) totalNode.textContent = String(summary.total || 0);
  if (criticalNode) criticalNode.textContent = String(summary.bySeverity?.critical || 0);
  if (warningNode) warningNode.textContent = String(summary.bySeverity?.warning || 0);
  if (categoryNode) categoryNode.textContent = String(categories || 0);
  if (persistenceNode) persistenceNode.textContent = isEventPersistenceEnabled() ? 'Enabled' : 'Stopped';
}

function renderFilters(entries = getAuditEntries()) {
  if (!filterRoot) return;

  const summary = summarizeAuditLog(entries);
  const categories = ['all', 'critical', 'warning', ...Object.keys(summary.byCategory || {})];

  filterRoot.innerHTML = [...new Set(categories)].map((category) => {
    const active = category === activeCategory ? ' active' : '';
    return '<button type="button" class="btn btn-theme-secondary beam-target audit-filter' + active + '" data-audit-filter="' + clean(category) + '">' + clean(label(category)) + '</button>';
  }).join('');
}

function renderList() {
  if (!auditRoot) return;

  const entries = filteredEntries();
  const allEntries = getAuditEntries();

  renderStats(allEntries);
  renderFilters(allEntries);

  if (!entries.length) {
    auditRoot.innerHTML = '<div class="item muted">No audit entries for this filter yet.</div>';
    renderDetail(null);
    return;
  }

  if (!selectedAuditId || !entries.some((entry) => entry.id === selectedAuditId)) {
    selectedAuditId = entries[0].id;
  }

  auditRoot.innerHTML = entries.slice(0, 40).map((entry) => {
    const selected = entry.id === selectedAuditId ? ' active' : '';
    return '<article class="item audit-item' + selected + '" data-audit-id="' + clean(entry.id) + '"><h3>' + clean(entry.eventType) + '</h3><p class="muted">Source: ' + clean(entry.source || 'evaraos') + '</p><div class="row"><span class="pill">' + clean(label(entry.category)) + '</span><span class="pill">' + clean(label(entry.severity)) + '</span><span class="pill">' + clean(entry.correlationId || 'no-correlation') + '</span></div></article>';
  }).join('');

  renderDetail(entries.find((entry) => entry.id === selectedAuditId));
}

function renderDetail(entry) {
  if (!detailRoot) return;

  if (!entry) {
    detailRoot.innerHTML = '<div class="item muted">Select an audit entry to inspect traceability context.</div>';
    return;
  }

  const payload = JSON.stringify(entry.payloadSnapshot || {}, null, 2);
  const metadata = JSON.stringify(entry.metadata || {}, null, 2);

  detailRoot.innerHTML = '<article class="item"><h3>' + clean(entry.eventType) + '</h3><p class="muted">Event ID: ' + clean(entry.eventId || 'none') + '</p><p class="muted">Correlation: ' + clean(entry.correlationId || 'none') + '</p><div class="row"><span class="pill">' + clean(label(entry.category)) + '</span><span class="pill">' + clean(label(entry.severity)) + '</span><span class="pill">' + clean(entry.source || 'evaraos') + '</span></div></article><article class="item"><h3>Payload Snapshot</h3><pre class="muted" style="white-space:pre-wrap;overflow:auto;max-height:260px">' + clean(payload) + '</pre></article><article class="item"><h3>Metadata</h3><pre class="muted" style="white-space:pre-wrap;overflow:auto;max-height:220px">' + clean(metadata) + '</pre></article>';
}

function bindEvents() {
  filterRoot?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-audit-filter]');
    if (!button) return;

    activeCategory = button.getAttribute('data-audit-filter') || 'all';
    selectedAuditId = '';
    renderList();
  });

  auditRoot?.addEventListener('click', (event) => {
    const item = event.target.closest('[data-audit-id]');
    if (!item) return;

    selectedAuditId = item.getAttribute('data-audit-id') || '';
    const entry = getAuditEntries().find((row) => row.id === selectedAuditId);
    renderList();
    renderDetail(entry);
  });
}

async function startAuditDashboard() {
  stopAuditDashboard();

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
      label: 'Subscribe audit dashboard renderer',
      run() {
        auditListenerId = subscribeAuditLog(() => {
          renderList();
          status('Audit dashboard synced.');
        });

        return () => {
          if (auditListenerId) unsubscribeAuditLog(auditListenerId);
          auditListenerId = null;
        };
      }
    }
  ]);

  renderList();
}

function stopAuditDashboard() {
  if (auditListenerId) unsubscribeAuditLog(auditListenerId);
  auditListenerId = null;
  stopDashboardRuntime(runtime.id);
}

function init() {
  bindEvents();
  registerRuntimeCleanup(runtime.id, stopAuditDashboard);
  window.EvaraPageLifecycle?.registerCleanup?.(stopAuditDashboard);
  window.addEventListener('pagehide', stopAuditDashboard);

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      stopAuditDashboard();
      window.location.assign('/login.html');
      return;
    }

    if (!isAuditAdmin()) {
      status('Audit dashboard requires leadership permissions.');
      if (auditRoot) auditRoot.innerHTML = '<div class="item muted">You do not have access to audit compliance tools.</div>';
      return;
    }

    startAuditDashboard().catch((error) => {
      console.error(error);
      status('Audit dashboard failed to start.');
    });
  });
}

window.EvaraAuditDashboard = {
  startAuditDashboard,
  stopAuditDashboard,
  renderList,
  filteredEntries
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
