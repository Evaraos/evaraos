import {
  auth,
  onAuthStateChanged,
  getSavedUserProfile
} from './firebase.js';

import {
  startNotificationEventBridge,
  stopNotificationEventBridge,
  subscribeNotifications,
  unsubscribeNotifications,
  getNotifications,
  markNotificationRead,
  resolveNotification,
  archiveNotification
} from './operations-notifications.js';

import {
  startAutomationEngine,
  stopAutomationEngine,
  subscribeAutomations,
  unsubscribeAutomations,
  getAutomationActions,
  updateAutomationAction
} from './operations-automations.js';

const statusNode = document.getElementById('executiveQueueStatus');
const queueRoot = document.getElementById('executiveQueueRoot');
const actionRoot = document.getElementById('executiveActionRoot');
const criticalNode = document.getElementById('executiveCriticalCount');
const highNode = document.getElementById('executiveHighCount');
const queueNode = document.getElementById('executiveQueueCount');
const actionNode = document.getElementById('executiveActionCount');

let notificationListenerId = null;
let automationListenerId = null;

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

function isExecutiveUser() {
  const profile = getSavedUserProfile() || {};
  const role = String(profile.role || '').toLowerCase();
  return ['owner', 'super_admin', 'admin', 'manager', 'operations_manager'].includes(role);
}

function executiveNotifications() {
  return getNotifications({ includeArchived: false }).filter((notification) => {
    const executiveAudience = notification.audience === 'executive' || notification.audience === 'operations';
    const urgentPriority = ['critical', 'high'].includes(notification.priority);
    const unresolved = !notification.resolved && notification.state !== 'resolved';
    return executiveAudience && urgentPriority && unresolved;
  });
}

function executiveActions() {
  return getAutomationActions().filter((action) => {
    const urgent = ['critical', 'warning'].includes(action.severity);
    const open = !['completed', 'skipped'].includes(action.status);
    return urgent && open;
  });
}

function renderStats(notifications = executiveNotifications(), actions = executiveActions()) {
  const critical = notifications.filter((row) => row.priority === 'critical' || row.level === 'critical').length;
  const high = notifications.filter((row) => row.priority === 'high' || row.level === 'warning').length;

  if (criticalNode) criticalNode.textContent = String(critical);
  if (highNode) highNode.textContent = String(high);
  if (queueNode) queueNode.textContent = String(notifications.length);
  if (actionNode) actionNode.textContent = String(actions.length);
}

function renderQueue() {
  if (!queueRoot) return;

  const rows = executiveNotifications();
  const actions = executiveActions();
  renderStats(rows, actions);

  if (!rows.length) {
    queueRoot.innerHTML = '<div class="item muted">No executive notifications require review.</div>';
    return;
  }

  queueRoot.innerHTML = rows.map((notification) => {
    const actionLink = notification.actionUrl
      ? '<a class="btn btn-theme-primary beam-target" href="' + clean(notification.actionUrl) + '">' + clean(notification.actionLabel || 'Open') + '</a>'
      : '';

    return '<article class="item"><h3>' + clean(notification.title) + '</h3><p class="muted">' + clean(notification.detail || 'No details.') + '</p><div class="row"><span class="pill">' + clean(label(notification.priority)) + '</span><span class="pill">' + clean(label(notification.type)) + '</span><span class="pill">' + clean(label(notification.state)) + '</span></div><div class="row" style="margin-top:12px">' + actionLink + '<button class="btn btn-theme-secondary beam-target" data-exec-note-action="read" data-id="' + clean(notification.id) + '">Acknowledge</button><button class="btn btn-theme-secondary beam-target" data-exec-note-action="resolve" data-id="' + clean(notification.id) + '">Resolve</button><button class="btn btn-theme-secondary beam-target" data-exec-note-action="archive" data-id="' + clean(notification.id) + '">Archive</button></div></article>';
  }).join('');
}

function renderActions() {
  if (!actionRoot) return;

  const rows = executiveActions();
  renderStats(executiveNotifications(), rows);

  if (!rows.length) {
    actionRoot.innerHTML = '<div class="item muted">No executive workflow actions require review.</div>';
    return;
  }

  actionRoot.innerHTML = rows.map((action) => {
    const actionLink = action.actionUrl
      ? '<a class="btn btn-theme-primary beam-target" href="' + clean(action.actionUrl) + '">Open</a>'
      : '';

    return '<article class="item"><h3>' + clean(action.title) + '</h3><p class="muted">' + clean(action.detail || 'No details.') + '</p><div class="row"><span class="pill">' + clean(label(action.severity)) + '</span><span class="pill">' + clean(label(action.status)) + '</span><span class="pill">' + clean(label(action.actionType)) + '</span></div><div class="row" style="margin-top:12px">' + actionLink + '<button class="btn btn-theme-secondary beam-target" data-exec-action="complete" data-id="' + clean(action.id) + '">Complete</button><button class="btn btn-theme-secondary beam-target" data-exec-action="skip" data-id="' + clean(action.id) + '">Skip</button></div></article>';
  }).join('');
}

function bindEvents() {
  queueRoot?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-exec-note-action]');
    if (!button) return;

    const id = button.getAttribute('data-id');
    const action = button.getAttribute('data-exec-note-action');

    if (action === 'read') markNotificationRead(id);
    if (action === 'resolve') resolveNotification(id);
    if (action === 'archive') archiveNotification(id);

    renderQueue();
  });

  actionRoot?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-exec-action]');
    if (!button) return;

    const id = button.getAttribute('data-id');
    const action = button.getAttribute('data-exec-action');

    if (action === 'complete') updateAutomationAction(id, { status: 'completed' });
    if (action === 'skip') updateAutomationAction(id, { status: 'skipped' });

    renderActions();
  });
}

function startExecutiveQueue() {
  stopExecutiveQueue();
  startNotificationEventBridge();
  startAutomationEngine();

  notificationListenerId = subscribeNotifications(() => {
    renderQueue();
    status('Executive queue synced.');
  });

  automationListenerId = subscribeAutomations(() => {
    renderActions();
    status('Executive actions synced.');
  });

  renderQueue();
  renderActions();
}

function stopExecutiveQueue() {
  if (notificationListenerId) unsubscribeNotifications(notificationListenerId);
  if (automationListenerId) unsubscribeAutomations(automationListenerId);
  notificationListenerId = null;
  automationListenerId = null;
  stopNotificationEventBridge();
  stopAutomationEngine();
}

function init() {
  bindEvents();
  window.EvaraPageLifecycle?.registerCleanup?.(stopExecutiveQueue);
  window.addEventListener('pagehide', stopExecutiveQueue);

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      stopExecutiveQueue();
      window.location.assign('/login.html');
      return;
    }

    if (!isExecutiveUser()) {
      status('Executive queue requires leadership permissions.');
      if (queueRoot) queueRoot.innerHTML = '<div class="item muted">You do not have access to the executive queue.</div>';
      return;
    }

    try {
      startExecutiveQueue();
    } catch (error) {
      console.error(error);
      status('Executive queue failed to start.');
    }
  });
}

window.EvaraExecutiveQueue = {
  startExecutiveQueue,
  stopExecutiveQueue,
  executiveNotifications,
  executiveActions,
  renderQueue,
  renderActions
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
