import {
  createCollectionAdapter,
  EvaraCollections
} from './firestore-collection-adapter.js';

import {
  buildRevenueAnalytics,
  refreshRevenueAnalytics,
  getRevenueAnalyticsSnapshot
} from './revenue-analytics-engine.js';

import {
  markFirestoreAdapterSynced,
  markFirestoreAdapterError
} from './firestore-sync-health.js';

const analyticsAdapter = createCollectionAdapter(EvaraCollections.REVENUE_ANALYTICS);
let unsubscribeLiveAnalytics = null;
let latestPersistentSnapshot = null;

function normalizeSnapshot(snapshot = {}) {
  return {
    ...snapshot,
    id: snapshot.id || `revenue_analytics_${Date.now()}`,
    generatedAtMs: Number(snapshot.generatedAtMs || Date.now()),
    persistedAtMs: Date.now(),
    updatedAtMs: Date.now()
  };
}

function hydrateAnalyticsSnapshot(record = {}) {
  if (!record?.id) return null;
  latestPersistentSnapshot = record;
  return record;
}

export async function persistRevenueAnalyticsSnapshot(snapshot = null, options = {}) {
  try {
    const payload = normalizeSnapshot(snapshot || getRevenueAnalyticsSnapshot() || buildRevenueAnalytics(options));
    await analyticsAdapter.set(payload.id, payload, { merge: true });
    latestPersistentSnapshot = payload;
    markFirestoreAdapterSynced('persistent-revenue-analytics-adapter', {
      collectionName: EvaraCollections.REVENUE_ANALYTICS,
      snapshotId: payload.id
    });
    return payload;
  } catch (error) {
    markFirestoreAdapterError('persistent-revenue-analytics-adapter', error);
    throw error;
  }
}

export async function refreshAndPersistRevenueAnalytics(options = {}) {
  const snapshot = refreshRevenueAnalytics(options);
  return persistRevenueAnalyticsSnapshot(snapshot, options);
}

export async function loadPersistentRevenueAnalytics(options = {}) {
  try {
    const records = await analyticsAdapter.list({
      orderBy: [['generatedAtMs', 'desc']],
      limit: 25,
      ...options
    });

    records.forEach(hydrateAnalyticsSnapshot);
    markFirestoreAdapterSynced('persistent-revenue-analytics-adapter', {
      collectionName: EvaraCollections.REVENUE_ANALYTICS,
      records: records.length
    });
    return records;
  } catch (error) {
    markFirestoreAdapterError('persistent-revenue-analytics-adapter', error);
    throw error;
  }
}

export function subscribePersistentRevenueAnalytics(options = {}, callback = () => {}) {
  if (unsubscribeLiveAnalytics) unsubscribeLiveAnalytics();

  unsubscribeLiveAnalytics = analyticsAdapter.subscribe({
    orderBy: [['generatedAtMs', 'desc']],
    limit: 25,
    ...options
  }, (records = [], error = null) => {
    if (error) {
      markFirestoreAdapterError('persistent-revenue-analytics-adapter', error);
      callback([], error);
      return;
    }

    records.forEach(hydrateAnalyticsSnapshot);
    markFirestoreAdapterSynced('persistent-revenue-analytics-adapter', {
      collectionName: EvaraCollections.REVENUE_ANALYTICS,
      records: records.length
    });
    callback(records, null);
  });

  return unsubscribeLiveAnalytics;
}

export function stopPersistentRevenueAnalyticsSubscription() {
  if (unsubscribeLiveAnalytics) unsubscribeLiveAnalytics();
  unsubscribeLiveAnalytics = null;
}

export function getLatestPersistentRevenueAnalyticsSnapshot() {
  return latestPersistentSnapshot;
}

export async function persistScheduledRevenueAnalytics(options = {}) {
  const snapshot = await refreshAndPersistRevenueAnalytics(options);
  return {
    snapshotId: snapshot.id,
    generatedAtMs: snapshot.generatedAtMs,
    persistedAtMs: snapshot.persistedAtMs,
    risk: snapshot.risk,
    kpis: snapshot.kpis
  };
}

window.EvaraPersistentRevenueAnalyticsAdapter = {
  persistRevenueAnalyticsSnapshot,
  refreshAndPersistRevenueAnalytics,
  loadPersistentRevenueAnalytics,
  subscribePersistentRevenueAnalytics,
  stopPersistentRevenueAnalyticsSubscription,
  getLatestPersistentRevenueAnalyticsSnapshot,
  persistScheduledRevenueAnalytics
};
