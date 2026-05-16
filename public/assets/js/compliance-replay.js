import {
  getAuditEntries,
  subscribeAuditLog,
  unsubscribeAuditLog
} from './audit-log-engine.js';

const replayListeners = new Map();
let replayListenerCounter = 0;
let auditSubscriptionId = null;

function createListenerId() {
  replayListenerCounter += 1;
  return `replay_listener_${Date.now()}_${replayListenerCounter}`;
}

function cleanType(value = '') {
  return String(value || '').trim().toLowerCase();
}

function getReplayKey(entry = {}) {
  return entry.correlationId || entry.eventId || entry.id || 'uncorrelated';
}

function getTimestamp(entry = {}) {
  return Number(entry.createdAtMs || entry.timestamp || Date.now());
}

function summarizeTimeline(entries = []) {
  const sorted = [...entries].sort((a, b) => getTimestamp(a) - getTimestamp(b));
  const first = sorted[0] || null;
  const last = sorted[sorted.length - 1] || null;

  return {
    count: sorted.length,
    firstAtMs: first ? getTimestamp(first) : null,
    lastAtMs: last ? getTimestamp(last) : null,
    categories: [...new Set(sorted.map((entry) => entry.category || 'system'))],
    severities: [...new Set(sorted.map((entry) => entry.severity || 'info'))],
    sources: [...new Set(sorted.map((entry) => entry.source || 'evaraos'))]
  };
}

export function buildReplayTimelines(entries = getAuditEntries(), options = {}) {
  let rows = [...entries];

  if (options.category) {
    const category = cleanType(options.category);
    rows = rows.filter((entry) => cleanType(entry.category) === category);
  }

  if (options.severity) {
    const severity = cleanType(options.severity);
    rows = rows.filter((entry) => cleanType(entry.severity) === severity);
  }

  if (options.source) {
    const source = cleanType(options.source);
    rows = rows.filter((entry) => cleanType(entry.source) === source);
  }

  const grouped = rows.reduce((groups, entry) => {
    const key = getReplayKey(entry);
    groups[key] = groups[key] || [];
    groups[key].push(entry);
    return groups;
  }, {});

  return Object.entries(grouped)
    .map(([correlationId, timelineEntries]) => {
      const sorted = [...timelineEntries].sort((a, b) => getTimestamp(a) - getTimestamp(b));
      return {
        id: correlationId,
        correlationId,
        entries: sorted,
        summary: summarizeTimeline(sorted)
      };
    })
    .sort((a, b) => Number(b.summary.lastAtMs || 0) - Number(a.summary.lastAtMs || 0));
}

export function buildTimelineDetail(correlationId, entries = getAuditEntries()) {
  const timelines = buildReplayTimelines(entries);
  return timelines.find((timeline) => timeline.correlationId === correlationId) || null;
}

export function subscribeReplayTimelines(callback, options = {}) {
  if (typeof callback !== 'function') {
    throw new Error('subscribeReplayTimelines requires a callback.');
  }

  const listenerId = createListenerId();
  replayListeners.set(listenerId, callback);

  callback(buildReplayTimelines(getAuditEntries(), options));

  if (!auditSubscriptionId) {
    auditSubscriptionId = subscribeAuditLog(() => {
      const entries = getAuditEntries();
      const timelines = buildReplayTimelines(entries, options);

      replayListeners.forEach((listener) => {
        try {
          listener(timelines);
        } catch (error) {
          console.error('Replay timeline listener failed:', error);
        }
      });
    });
  }

  return listenerId;
}

export function unsubscribeReplayTimelines(listenerId) {
  const deleted = replayListeners.delete(listenerId);

  if (!replayListeners.size && auditSubscriptionId) {
    unsubscribeAuditLog(auditSubscriptionId);
    auditSubscriptionId = null;
  }

  return deleted;
}

export function summarizeReplayTimelines(timelines = buildReplayTimelines()) {
  return timelines.reduce((summary, timeline) => {
    summary.totalTimelines += 1;
    summary.totalEvents += timeline.summary.count || 0;

    timeline.summary.categories.forEach((category) => {
      summary.byCategory[category] = (summary.byCategory[category] || 0) + 1;
    });

    timeline.summary.severities.forEach((severity) => {
      summary.bySeverity[severity] = (summary.bySeverity[severity] || 0) + 1;
    });

    return summary;
  }, {
    totalTimelines: 0,
    totalEvents: 0,
    byCategory: {},
    bySeverity: {}
  });
}

window.EvaraComplianceReplay = {
  buildReplayTimelines,
  buildTimelineDetail,
  subscribeReplayTimelines,
  unsubscribeReplayTimelines,
  summarizeReplayTimelines
};
