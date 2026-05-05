const DB_NAME = "evaraos-offline-leads";
const DB_VERSION = 1;
const QUEUE_STORE = "leadQueue";
const ARCHIVE_STORE = "leadArchive";

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const queue = db.createObjectStore(QUEUE_STORE, { keyPath: "clientLeadId" });
        queue.createIndex("createdAtMs", "createdAtMs", { unique: false });
        queue.createIndex("syncStatus", "syncStatus", { unique: false });
      }
      if (!db.objectStoreNames.contains(ARCHIVE_STORE)) {
        const archive = db.createObjectStore(ARCHIVE_STORE, { keyPath: "clientLeadId" });
        archive.createIndex("syncedAtMs", "syncedAtMs", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(storeName, mode, callback) {
  const db = await openDb();
  try {
    return await callback(db.transaction(storeName, mode).objectStore(storeName));
  } finally {
    db.close();
  }
}

function makeClientLeadId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `lead_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export async function queueLead(payload = {}) {
  const now = Date.now();
  const clientLeadId = payload.clientLeadId || makeClientLeadId();
  const record = {
    clientLeadId,
    payload: { ...payload, clientLeadId, id: clientLeadId },
    syncStatus: "pending",
    createdAtMs: now,
    updatedAtMs: now,
    attempts: 0,
    lastError: ""
  };

  await withStore(QUEUE_STORE, "readwrite", (store) => requestToPromise(store.put(record)));
  window.dispatchEvent(new CustomEvent("evara:lead-queue-changed", { detail: { clientLeadId } }));
  return record;
}

export async function getQueuedLeads() {
  const rows = await withStore(QUEUE_STORE, "readonly", (store) => requestToPromise(store.getAll()));
  return rows.sort((a, b) => Number(a.createdAtMs || 0) - Number(b.createdAtMs || 0));
}

export async function markLeadSyncing(clientLeadId, attempts = 0) {
  const rows = await getQueuedLeads();
  const record = rows.find((row) => row.clientLeadId === clientLeadId);
  if (!record) return null;

  const next = {
    ...record,
    syncStatus: "syncing",
    attempts: attempts + 1,
    updatedAtMs: Date.now(),
    lastError: ""
  };

  await withStore(QUEUE_STORE, "readwrite", (store) => requestToPromise(store.put(next)));
  window.dispatchEvent(new CustomEvent("evara:lead-queue-changed", { detail: { clientLeadId } }));
  return next;
}

export async function markLeadFailed(clientLeadId, message = "Sync failed") {
  const rows = await getQueuedLeads();
  const record = rows.find((row) => row.clientLeadId === clientLeadId);
  if (!record) return null;

  const next = {
    ...record,
    syncStatus: "failed",
    lastError: message,
    updatedAtMs: Date.now()
  };

  await withStore(QUEUE_STORE, "readwrite", (store) => requestToPromise(store.put(next)));
  window.dispatchEvent(new CustomEvent("evara:lead-queue-changed", { detail: { clientLeadId } }));
  return next;
}

export async function archiveSyncedLead(clientLeadId) {
  const rows = await getQueuedLeads();
  const record = rows.find((row) => row.clientLeadId === clientLeadId);
  if (!record) return null;

  const archived = {
    ...record,
    syncStatus: "synced",
    syncedAtMs: Date.now(),
    archivedAtMs: Date.now(),
    lastError: ""
  };

  await withStore(ARCHIVE_STORE, "readwrite", (store) => requestToPromise(store.put(archived)));
  await withStore(QUEUE_STORE, "readwrite", (store) => requestToPromise(store.delete(clientLeadId)));
  window.dispatchEvent(new CustomEvent("evara:lead-queue-changed", { detail: { clientLeadId } }));
  return archived;
}

export async function getLeadQueueCounts() {
  const rows = await getQueuedLeads();
  return {
    total: rows.length,
    pending: rows.filter((row) => row.syncStatus === "pending" || row.syncStatus === "failed").length,
    syncing: rows.filter((row) => row.syncStatus === "syncing").length,
    failed: rows.filter((row) => row.syncStatus === "failed").length
  };
}

window.EvaraLeadQueue = {
  queueLead,
  getQueuedLeads,
  markLeadSyncing,
  markLeadFailed,
  archiveSyncedLead,
  getLeadQueueCounts
};
