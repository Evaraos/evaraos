const DB_NAME = "evaraos-offline";
const DB_VERSION = 1;
const STORES = {
  leadQueue: "leadQueue",
  leadArchive: "leadArchive"
};

function openOfflineDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORES.leadQueue)) {
        const queue = db.createObjectStore(STORES.leadQueue, { keyPath: "clientLeadId" });
        queue.createIndex("createdAtMs", "createdAtMs", { unique: false });
        queue.createIndex("syncStatus", "syncStatus", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.leadArchive)) {
        const archive = db.createObjectStore(STORES.leadArchive, { keyPath: "clientLeadId" });
        archive.createIndex("syncedAtMs", "syncedAtMs", { unique: false });
        archive.createIndex("syncStatus", "syncStatus", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txStore(db, storeName, mode = "readonly") {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function put(storeName, value) {
  const db = await openOfflineDb();
  try {
    return await requestToPromise(txStore(db, storeName, "readwrite").put(value));
  } finally {
    db.close();
  }
}

async function remove(storeName, key) {
  const db = await openOfflineDb();
  try {
    return await requestToPromise(txStore(db, storeName, "readwrite").delete(key));
  } finally {
    db.close();
  }
}

async function getAll(storeName) {
  const db = await openOfflineDb();
  try {
    return await requestToPromise(txStore(db, storeName).getAll());
  } finally {
    db.close();
  }
}

async function get(storeName, key) {
  const db = await openOfflineDb();
  try {
    return await requestToPromise(txStore(db, storeName).get(key));
  } finally {
    db.close();
  }
}

export async function queueLeadForSync(record) {
  const now = Date.now();
  const clientLeadId = record.clientLeadId || crypto.randomUUID();

  const queued = {
    clientLeadId,
    payload: record.payload || {},
    syncStatus: record.syncStatus || "pending",
    createdAtMs: record.createdAtMs || now,
    updatedAtMs: now,
    attempts: Number(record.attempts || 0),
    lastError: record.lastError || ""
  };

  await put(STORES.leadQueue, queued);
  window.dispatchEvent(new CustomEvent("evara:offline-queue-changed", { detail: { type: "lead", clientLeadId } }));
  return queued;
}

export async function updateQueuedLead(clientLeadId, patch = {}) {
  const existing = await get(STORES.leadQueue, clientLeadId);
  if (!existing) return null;

  const next = {
    ...existing,
    ...patch,
    updatedAtMs: Date.now()
  };

  await put(STORES.leadQueue, next);
  window.dispatchEvent(new CustomEvent("evara:offline-queue-changed", { detail: { type: "lead", clientLeadId } }));
  return next;
}

export async function archiveQueuedLead(clientLeadId, patch = {}) {
  const existing = await get(STORES.leadQueue, clientLeadId);
  if (!existing) return null;

  const archived = {
    ...existing,
    ...patch,
    syncStatus: patch.syncStatus || "synced",
    syncedAtMs: patch.syncedAtMs || Date.now(),
    archivedAtMs: Date.now()
  };

  await put(STORES.leadArchive, archived);
  await remove(STORES.leadQueue, clientLeadId);
  window.dispatchEvent(new CustomEvent("evara:offline-queue-changed", { detail: { type: "lead", clientLeadId } }));
  return archived;
}

export async function getQueuedLeads() {
  const rows = await getAll(STORES.leadQueue);
  return rows.sort((a, b) => Number(a.createdAtMs || 0) - Number(b.createdAtMs || 0));
}

export async function getLeadArchive() {
  const rows = await getAll(STORES.leadArchive);
  return rows.sort((a, b) => Number(b.syncedAtMs || 0) - Number(a.syncedAtMs || 0));
}

export async function getOfflineLeadCounts() {
  const [queue, archive] = await Promise.all([getQueuedLeads(), getLeadArchive()]);
  return {
    pending: queue.filter((item) => item.syncStatus !== "syncing").length,
    syncing: queue.filter((item) => item.syncStatus === "syncing").length,
    queued: queue.length,
    archived: archive.length
  };
}

export const EvaraOfflineDb = {
  queueLeadForSync,
  updateQueuedLead,
  archiveQueuedLead,
  getQueuedLeads,
  getLeadArchive,
  getOfflineLeadCounts
};

window.EvaraOfflineDb = EvaraOfflineDb;
