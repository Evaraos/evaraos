const syncHealthListeners = new Map();
const adapterStatus = new Map();

let listenerCounter = 0;
let syncHealthStarted = false;
let lastOnlineAtMs = navigator.onLine ? Date.now() : 0;
let lastOfflineAtMs = navigator.onLine ? 0 : Date.now();
let lastHeartbeatAtMs = 0;
let heartbeatTimer = null;

const DEFAULT_HEARTBEAT_MS = 30000;

function nextListenerId() {
  listenerCounter += 1;
  return `firestore_sync_health_listener_${Date.now()}_${listenerCounter}`;
}

function publish() {
  const snapshot = getFirestoreSyncHealth();
  syncHealthListeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      console.error('Firestore sync health listener failure:', error);
    }
  });
}

function updateOnlineState() {
  if (navigator.onLine) lastOnlineAtMs = Date.now();
  else lastOfflineAtMs = Date.now();
  publish();
}

export function startFirestoreSyncHealth(options = {}) {
  if (syncHealthStarted) return getFirestoreSyncHealth();

  syncHealthStarted = true;
  window.addEventListener('online', updateOnlineState);
  window.addEventListener('offline', updateOnlineState);

  heartbeatTimer = window.setInterval(() => {
    lastHeartbeatAtMs = Date.now();
    publish();
  }, Number(options.heartbeatMs || DEFAULT_HEARTBEAT_MS));

  lastHeartbeatAtMs = Date.now();
  publish();
  return getFirestoreSyncHealth();
}

export function stopFirestoreSyncHealth() {
  if (heartbeatTimer) window.clearInterval(heartbeatTimer);
  heartbeatTimer = null;
  syncHealthStarted = false;
  window.removeEventListener('online', updateOnlineState);
  window.removeEventListener('offline', updateOnlineState);
  publish();
}

export function registerFirestoreAdapterHealth(adapterName, status = {}) {
  if (!adapterName) throw new Error('Adapter name is required.');

  adapterStatus.set(adapterName, {
    adapterName,
    ready: Boolean(status.ready ?? true),
    collectionName: status.collectionName || '',
    lastSyncAtMs: status.lastSyncAtMs || Date.now(),
    lastError: status.lastError || null,
    metadata: status.metadata || {}
  });

  publish();
  return adapterStatus.get(adapterName);
}

export function markFirestoreAdapterSynced(adapterName, metadata = {}) {
  const existing = adapterStatus.get(adapterName) || { adapterName };
  return registerFirestoreAdapterHealth(adapterName, {
    ...existing,
    ready: true,
    lastSyncAtMs: Date.now(),
    lastError: null,
    metadata: {
      ...(existing.metadata || {}),
      ...metadata
    }
  });
}

export function markFirestoreAdapterError(adapterName, error = {}) {
  const existing = adapterStatus.get(adapterName) || { adapterName };
  return registerFirestoreAdapterHealth(adapterName, {
    ...existing,
    ready: false,
    lastSyncAtMs: existing.lastSyncAtMs || 0,
    lastError: {
      message: error?.message || String(error || 'Unknown sync error'),
      code: error?.code || 'sync_error',
      atMs: Date.now()
    }
  });
}

export function getFirestoreSyncHealth() {
  const adapters = [...adapterStatus.values()];
  const failingAdapters = adapters.filter((adapter) => adapter.lastError || !adapter.ready);

  return {
    started: syncHealthStarted,
    online: navigator.onLine,
    lastOnlineAtMs,
    lastOfflineAtMs,
    lastHeartbeatAtMs,
    adapterCount: adapters.length,
    failingAdapterCount: failingAdapters.length,
    status: !navigator.onLine ? 'offline' : failingAdapters.length ? 'degraded' : 'healthy',
    adapters,
    updatedAtMs: Date.now()
  };
}

export function subscribeFirestoreSyncHealth(callback) {
  if (typeof callback !== 'function') throw new Error('subscribeFirestoreSyncHealth requires a callback.');
  const id = nextListenerId();
  syncHealthListeners.set(id, callback);
  callback(getFirestoreSyncHealth());
  return id;
}

export function unsubscribeFirestoreSyncHealth(listenerId) {
  return syncHealthListeners.delete(listenerId);
}

window.EvaraFirestoreSyncHealth = {
  startFirestoreSyncHealth,
  stopFirestoreSyncHealth,
  registerFirestoreAdapterHealth,
  markFirestoreAdapterSynced,
  markFirestoreAdapterError,
  getFirestoreSyncHealth,
  subscribeFirestoreSyncHealth,
  unsubscribeFirestoreSyncHealth
};

startFirestoreSyncHealth();
