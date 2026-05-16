import {
  auth,
  onAuthStateChanged,
  getSavedUserProfile
} from './firebase.js';

import {
  subscribeWorkforcePresence,
  unsubscribeWorkforcePresence,
  startPresenceHeartbeat,
  stopPresenceHeartbeat,
  updateMyPresence,
  markMyPresenceOffline
} from './workforce-presence.js';

const root = document.getElementById('presenceRoot');
const statusNode = document.getElementById('presenceStatus');
const countNode = document.getElementById('presenceCount');
const availableNode = document.getElementById('presenceAvailable');
const busyNode = document.getElementById('presenceBusy');
const breakNode = document.getElementById('presenceBreak');
const offlineNode = document.getElementById('presenceOffline');
const myStatusSelect = document.getElementById('myPresenceStatus');
const saveMyStatusButton = document.getElementById('saveMyPresenceStatus');

function clean(value = '') {
  return String(value || '').replace(/[<>]/g, '');
}

function status(message = '') {
  if (statusNode) statusNode.textContent = message;
}

function isPresenceAdmin() {
  const profile = getSavedUserProfile() || {};
  const role = String(profile.role || '').toLowerCase();
  return ['owner', 'super_admin', 'admin', 'manager', 'operations_manager', 'dispatcher', 'sales_manager', 'field_manager'].includes(role);
}

function normalizeStatus(value = '') {
  const current = String(value || '').trim().toLowerCase();
  if (['available', 'busy', 'break', 'offline'].includes(current)) return current;
  return 'available';
}

function lastSeenLabel(ms = 0) {
  const value = Number(ms || 0);
  if (!value) return 'No heartbeat yet';

  const diff = Date.now() - value;
  const minutes = Math.max(0, Math.round(diff / 60000));

  if (minutes < 1) return 'Just now';
  if (minutes === 1) return '1 minute ago';
  return minutes + ' minutes ago';
}

function roleLabel(role = '') {
  return String(role || 'staff').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function summarize(rows = []) {
  const summary = rows.reduce((acc, row) => {
    const key = normalizeStatus(row.status);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, { available: 0, busy: 0, break: 0, offline: 0 });

  if (countNode) countNode.textContent = String(rows.length);
  if (availableNode) availableNode.textContent = String(summary.available || 0);
  if (busyNode) busyNode.textContent = String(summary.busy || 0);
  if (breakNode) breakNode.textContent = String(summary.break || 0);
  if (offlineNode) offlineNode.textContent = String(summary.offline || 0);
}

function renderRows(rows = []) {
  if (!root) return;

  summarize(rows);

  if (!rows.length) {
    root.innerHTML = '<div class="item muted">No workforce presence records yet. Presence activates when team members sign in.</div>';
    return;
  }

  const sorted = [...rows].sort((a, b) => Number(b.lastSeenMs || 0) - Number(a.lastSeenMs || 0));

  root.innerHTML = sorted.map((row) => {
    const currentStatus = normalizeStatus(row.status);
    return '<article class="item"><h3>' + clean(row.displayName || row.email || 'Team Member') + '</h3><p class="muted">' + clean(roleLabel(row.role)) + ' • ' + clean(row.companyName || row.companyId || 'No company') + '</p><p class="muted">Territory: ' + clean(row.territoryId || 'Unassigned') + ' • Region: ' + clean(row.regionId || 'Unassigned') + '</p><div class="row"><span class="pill">' + clean(currentStatus) + '</span><span class="pill">' + clean(lastSeenLabel(row.lastSeenMs)) + '</span></div></article>';
  }).join('');
}

async function saveMyStatus() {
  const nextStatus = normalizeStatus(myStatusSelect?.value || 'available');
  await updateMyPresence({ status: nextStatus });
  status('Your presence was updated to ' + nextStatus + '.');
}

function bindEvents() {
  saveMyStatusButton?.addEventListener('click', async () => {
    try {
      saveMyStatusButton.disabled = true;
      await saveMyStatus();
    } catch (error) {
      console.error(error);
      status(error.message || 'Presence update failed.');
    } finally {
      saveMyStatusButton.disabled = false;
    }
  });
}

function cleanup() {
  unsubscribeWorkforcePresence();
  stopPresenceHeartbeat();
  markMyPresenceOffline();
}

function init() {
  bindEvents();
  window.EvaraPageLifecycle?.registerCleanup?.(cleanup);
  window.addEventListener('pagehide', cleanup);

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      cleanup();
      window.location.assign('/login.html');
      return;
    }

    startPresenceHeartbeat({ status: myStatusSelect?.value || 'available' });

    if (!isPresenceAdmin()) {
      status('Presence dashboard requires operational permissions. Your own presence heartbeat is still active.');
      if (root) root.innerHTML = '<div class="item muted">You do not have access to workforce presence visibility.</div>';
      return;
    }

    status('Presence dashboard live.');

    subscribeWorkforcePresence((rows) => {
      renderRows(rows);
      status('Presence synced: ' + rows.length + ' team member(s).');
    }, {
      onError(error) {
        console.error(error);
        status('Presence listener failed.');
      }
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
