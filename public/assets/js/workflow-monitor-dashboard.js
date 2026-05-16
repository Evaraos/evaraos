import {
  auth,
  onAuthStateChanged,
  getSavedUserProfile
} from './firebase.js';

import {
  startAutomationEngine,
  stopAutomationEngine,
  subscribeAutomations,
  unsubscribeAutomations,
  getAutomationRules
} from './operations-automations.js';

import {
  startNotificationEventBridge,
  stopNotificationEventBridge,
  subscribeNotifications,
  unsubscribeNotifications,
  getNotifications
} from './operations-notifications.js';

import {
  startAuditLogEngine,
  stopAuditLogEngine,
  subscribeAuditLog,
  unsubscribeAuditLog,
  summarizeAuditLog
} from './audit-log-engine.js';

import {
  startEventPersistence,
  stopEventPersistence,
  isEventPersistenceEnabled
} from './operations-event-persistence.js';

import { getEventBusSnapshot } from './operations-events.js';

const statusNode = document.getElementById('workflowStatus');
const actionsRoot = document.getElementById('workflowActionsRoot');
const notificationsRoot = document.getElementById('workflowNotificationsRoot');
const auditRoot = document.getElementById('workflowAuditRoot');
const rulesRoot = document.getElementById('workflowRulesRoot');
const eventBusNode = document.getElementById('workflowEventBusCount');
const actionsNode = document.getElementById('workflowActionsCount');
const notificationsNode = document.getElementById('workflowNotificationsCount');
const auditNode = document.getElementById('workflowAuditCount');
const persistenceNode = document.getElementById('workflowPersistenceStatus');

let automationListenerId = null;
let notificationListenerId = null;
let auditListenerId = null;

function clean(value = '') {
  return String(value || '').replace(/[<>]/g, '');
}

function status(message = '') {
  if (statusNode) statusNode.textContent = message;
}

function isWorkflowAdmin() {
  const profile = getSavedUserProfile() || {};
  const role = String(profile.role || '').toLowerCase();
  return ['owner', 'super_admin', 'admin', 'manager', 'operations_manager'].includes(role);
}

function renderStats(actions = [], notifications = [], auditEntries = []) {
  const snapshot = getEventBusSnapshot();
  const eventBusTotal = Object.values(snapshot.directListeners || {}).reduce((sum, count) => sum + count, 0)
    + Object.values(snapshot.wildcardListeners || {}).reduce((sum, count) => sum + count, 0)
    + Number(snapshot.globalListeners || 0);

  if (eventBusNode) eventBusNode.textContent = String(eventBusTotal);
  if (actionsNode) actionsNode.textContent = String(actions.length);
  if (notificationsNode) notificationsNode.textContent = String(notifications.length);
  if (auditNode) auditNode.textContent = String(auditEntries.length);
  if (persistenceNode) persistenceNode.textContent = isEventPersistenceEnabled() ? 'Enabled' : 'Stopped';
}

function renderActions(actions = []) {
  if (!actionsRoot) return;

  if (!actions.length) {
    actionsRoot.innerHTML = '<div class="item muted">No automation actions yet.</div>';
    return;
  }

  actionsRoot.innerHTML = actions.slice(0, 12).map((action) => {
    return '<article class="item"><h3>' + clean(action.title) + '</h3><p class="muted">' + clean(action.detail || 'No action detail.') + '</p><div class="row"><span class="pill">' + clean(action.status || 'queued') + '</span><span class="pill">' + clean(action.severity || 'info') + '</span><span class="pill">' + clean(action.actionType || 'review') + '</span></div></article>';
  }).join('');
}

function renderNotifications(notifications = []) {
  if (!notificationsRoot) return;

  if (!notifications.length) {
    notificationsRoot.innerHTML = '<div class="item muted">No operational notifications yet.</div>';
    return;
  }

  notificationsRoot.innerHTML = notifications.slice(0, 12).map((notification) => {
    return '<article class="item"><h3>' + clean(notification.title) + '</h3><p class="muted">' + clean(notification.detail || 'No notification detail.') + '</p><div class="row"><span class="pill">' + clean(notification.level || 'info') + '</span><span class="pill">' + clean(notification.audience || 'operations') + '</span><span class="pill">' + clean(notification.read ? 'read' : 'unread') + '</span></div></article>';
  }).join('');
}

function renderAudit(entries = []) {
  if (!auditRoot) return;

  if (!entries.length) {
    auditRoot.innerHTML = '<div class="item muted">No audit entries yet.</div>';
    return;
  }

  const summary = summarizeAuditLog(entries);
  const categories = Object.entries(summary.byCategory || {}).map(([key, count]) => key + ': ' + count).join(' • ');

  auditRoot.innerHTML = '<article class="item"><h3>Audit Summary</h3><p class="muted">' + clean(categories || 'No category summary yet.') + '</p><div class="row"><span class="pill">Total: ' + clean(String(summary.total || 0)) + '</span></div></article>' + entries.slice(0, 10).map((entry) => {
    return '<article class="item"><h3>' + clean(entry.eventType) + '</h3><p class="muted">Source: ' + clean(entry.source || 'evaraos') + '</p><div class="row"><span class="pill">' + clean(entry.category || 'system') + '</span><span class="pill">' + clean(entry.severity || 'info') + '</span></div></article>';
  }).join('');
}

function renderRules() {
  if (!rulesRoot) return;

  const rules = getAutomationRules();

  if (!rules.length) {
    rulesRoot.innerHTML = '<div class="item muted">No automation rules registered yet.</div>';
    return;
  }

  rulesRoot.innerHTML = rules.map((rule) => {
    return '<article class="item"><h3>' + clean(rule.title) + '</h3><p class="muted">' + clean(rule.description || 'No rule description.') + '</p><div class="row"><span class="pill">' + clean(rule.eventType) + '</span><span class="pill">' + clean(rule.enabled ? 'enabled' : 'disabled') + '</span></div></article>';
  }).join('');
}

function wireSubscriptions() {
  automationListenerId = subscribeAutomations((action, actions) => {
    const notifications = getNotifications();
    renderActions(actions);
    renderStats(actions, notifications, []);
  });

  notificationListenerId = subscribeNotifications((notification, notifications) => {
    renderNotifications(notifications);
    renderStats([], notifications, []);
  });

  auditListenerId = subscribeAuditLog((entry, entries) => {
    renderAudit(entries);
    renderStats([], getNotifications(), entries);
  });
}

function startWorkflowSystems() {
  startNotificationEventBridge();
  startAutomationEngine();
  startAuditLogEngine();
  startEventPersistence();
  wireSubscriptions();
  renderRules();
  status('Workflow orchestration monitor live.');
}

function cleanup() {
  if (automationListenerId) unsubscribeAutomations(automationListenerId);
  if (notificationListenerId) unsubscribeNotifications(notificationListenerId);
  if (auditListenerId) unsubscribeAuditLog(auditListenerId);

  automationListenerId = null;
  notificationListenerId = null;
  auditListenerId = null;

  stopAutomationEngine();
  stopNotificationEventBridge();
  stopAuditLogEngine();
  stopEventPersistence();
}

function init() {
  window.EvaraPageLifecycle?.registerCleanup?.(cleanup);
  window.addEventListener('pagehide', cleanup);

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      cleanup();
      window.location.assign('/login.html');
      return;
    }

    if (!isWorkflowAdmin()) {
      status('Workflow monitoring requires admin permissions.');
      if (actionsRoot) actionsRoot.innerHTML = '<div class="item muted">You do not have access to workflow monitoring.</div>';
      return;
    }

    try {
      startWorkflowSystems();
    } catch (error) {
      console.error(error);
      status('Workflow monitor failed to start.');
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
