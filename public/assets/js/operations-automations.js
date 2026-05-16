import {
  subscribeEvent,
  unsubscribeEvent,
  emitEvent,
  OPERATIONS_EVENT_TYPES
} from './operations-events.js';

import { createNotification } from './operations-notifications.js';

const automationRules = new Map();
const automationActions = new Map();
const automationListeners = new Map();

let ruleCounter = 0;
let actionCounter = 0;
let listenerCounter = 0;
let eventSubscriptionIds = [];

function createRuleId() {
  ruleCounter += 1;
  return `auto_rule_${Date.now()}_${ruleCounter}`;
}

function createActionId() {
  actionCounter += 1;
  return `auto_action_${Date.now()}_${actionCounter}`;
}

function createListenerId() {
  listenerCounter += 1;
  return `auto_listener_${Date.now()}_${listenerCounter}`;
}

function normalizeSeverity(value = 'info') {
  const severity = String(value || 'info').trim().toLowerCase();
  if (['critical', 'warning', 'info', 'success'].includes(severity)) return severity;
  return 'info';
}

function normalizeStatus(value = 'queued') {
  const status = String(value || 'queued').trim().toLowerCase();
  if (['queued', 'completed', 'skipped', 'failed'].includes(status)) return status;
  return 'queued';
}

function notifyAutomationSubscribers(action = null) {
  const actions = getAutomationActions();

  automationListeners.forEach((listener) => {
    try {
      listener(action, actions);
    } catch (error) {
      console.error('Automation listener failure:', error);
    }
  });
}

export function registerAutomationRule(rule = {}) {
  if (!rule.eventType) throw new Error('Automation rule requires eventType.');
  if (typeof rule.handler !== 'function') throw new Error('Automation rule requires handler function.');

  const id = rule.id || createRuleId();

  const normalized = {
    id,
    eventType: rule.eventType,
    title: rule.title || 'Automation Rule',
    description: rule.description || '',
    enabled: rule.enabled !== false,
    handler: rule.handler,
    createdAtMs: rule.createdAtMs || Date.now()
  };

  automationRules.set(id, normalized);
  return normalized;
}

export function unregisterAutomationRule(ruleId) {
  return automationRules.delete(ruleId);
}

export function getAutomationRules() {
  return [...automationRules.values()].map((rule) => ({
    id: rule.id,
    eventType: rule.eventType,
    title: rule.title,
    description: rule.description,
    enabled: rule.enabled,
    createdAtMs: rule.createdAtMs
  }));
}

export function createAutomationAction(input = {}) {
  const action = {
    id: input.id || createActionId(),
    title: input.title || 'Automation Action',
    detail: input.detail || '',
    status: normalizeStatus(input.status),
    severity: normalizeSeverity(input.severity),
    sourceEventId: input.sourceEventId || '',
    sourceEventType: input.sourceEventType || '',
    actionType: input.actionType || 'review',
    actionUrl: input.actionUrl || '',
    metadata: input.metadata || {},
    createdAtMs: input.createdAtMs || Date.now()
  };

  automationActions.set(action.id, action);
  notifyAutomationSubscribers(action);

  emitEvent('automation.action_created', action, {
    source: 'operations-automations',
    severity: action.severity,
    correlationId: action.sourceEventId || null
  });

  return action;
}

export function updateAutomationAction(actionId, patch = {}) {
  const action = automationActions.get(actionId);
  if (!action) return null;

  const updated = {
    ...action,
    ...patch,
    status: normalizeStatus(patch.status || action.status),
    severity: normalizeSeverity(patch.severity || action.severity),
    updatedAtMs: Date.now()
  };

  automationActions.set(actionId, updated);
  notifyAutomationSubscribers(updated);

  return updated;
}

export function getAutomationActions(options = {}) {
  let rows = [...automationActions.values()];

  if (options.status) {
    const status = normalizeStatus(options.status);
    rows = rows.filter((action) => action.status === status);
  }

  if (options.severity) {
    const severity = normalizeSeverity(options.severity);
    rows = rows.filter((action) => action.severity === severity);
  }

  return rows.sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
}

export function subscribeAutomations(callback) {
  if (typeof callback !== 'function') throw new Error('subscribeAutomations requires a callback.');

  const listenerId = createListenerId();
  automationListeners.set(listenerId, callback);
  callback(null, getAutomationActions());

  return listenerId;
}

export function unsubscribeAutomations(listenerId) {
  return automationListeners.delete(listenerId);
}

function runRulesForEvent(event = {}) {
  automationRules.forEach((rule) => {
    if (!rule.enabled) return;
    if (rule.eventType !== event.type && rule.eventType !== '*') return;

    try {
      rule.handler(event, {
        createAutomationAction,
        createNotification,
        emitEvent
      });
    } catch (error) {
      console.error('Automation rule failed:', error);
      createAutomationAction({
        title: 'Automation rule failed',
        detail: rule.title + ' failed while processing ' + event.type + '.',
        status: 'failed',
        severity: 'warning',
        sourceEventId: event.id,
        sourceEventType: event.type,
        actionType: 'automation_error',
        metadata: {
          ruleId: rule.id,
          error: error.message || String(error)
        }
      });
    }
  });
}

export function registerDefaultAutomationRules() {
  registerAutomationRule({
    id: 'default_critical_alert_action',
    eventType: OPERATIONS_EVENT_TYPES.ALERT_CRITICAL,
    title: 'Create executive action for critical alerts',
    description: 'Critical alerts create executive review actions.',
    handler(event, tools) {
      tools.createAutomationAction({
        title: event.payload?.title || 'Critical alert requires executive review',
        detail: event.payload?.detail || 'A critical threshold was triggered and needs review.',
        severity: 'critical',
        sourceEventId: event.id,
        sourceEventType: event.type,
        actionType: 'executive_review',
        actionUrl: './alerts-dashboard.html',
        metadata: event.payload || {}
      });
    }
  });

  registerAutomationRule({
    id: 'default_territory_overload_action',
    eventType: OPERATIONS_EVENT_TYPES.TERRITORY_OVERLOADED,
    title: 'Create territory review action',
    description: 'Overloaded territories create dispatch review actions.',
    handler(event, tools) {
      tools.createAutomationAction({
        title: 'Territory review needed',
        detail: event.payload?.territoryName ? event.payload.territoryName + ' needs review.' : 'A territory needs review.',
        severity: 'warning',
        sourceEventId: event.id,
        sourceEventType: event.type,
        actionType: 'territory_review',
        actionUrl: './territories.html',
        metadata: event.payload || {}
      });
    }
  });

  registerAutomationRule({
    id: 'default_job_assigned_notification',
    eventType: OPERATIONS_EVENT_TYPES.JOB_ASSIGNED,
    title: 'Create dispatch action for assigned jobs',
    description: 'Assigned jobs create dispatch visibility actions.',
    handler(event, tools) {
      tools.createAutomationAction({
        title: 'Dispatch assignment created',
        detail: event.payload?.customerName ? 'Job assigned for ' + event.payload.customerName + '.' : 'A job was assigned.',
        severity: 'info',
        sourceEventId: event.id,
        sourceEventType: event.type,
        actionType: 'dispatch_assignment',
        actionUrl: './jobs.html',
        metadata: event.payload || {}
      });
    }
  });
}

export function startAutomationEngine() {
  stopAutomationEngine();
  registerDefaultAutomationRules();

  eventSubscriptionIds = [
    subscribeEvent('*', runRulesForEvent)
  ];

  return stopAutomationEngine;
}

export function stopAutomationEngine() {
  eventSubscriptionIds.forEach((id) => unsubscribeEvent(id));
  eventSubscriptionIds = [];
}

export function clearAutomationActions() {
  automationActions.clear();
  notifyAutomationSubscribers(null);
}

window.EvaraOperationsAutomations = {
  registerAutomationRule,
  unregisterAutomationRule,
  getAutomationRules,
  createAutomationAction,
  updateAutomationAction,
  getAutomationActions,
  subscribeAutomations,
  unsubscribeAutomations,
  registerDefaultAutomationRules,
  startAutomationEngine,
  stopAutomationEngine,
  clearAutomationActions
};
