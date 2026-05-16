import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp
} from './firebase.js';

function cleanCollectionName(name = '') {
  const value = String(name || '').trim();
  if (!value) throw new Error('Collection name is required.');
  if (value.includes('//')) throw new Error('Invalid collection path.');
  return value;
}

function nowMs() {
  return Date.now();
}

function buildQueryConstraints(options = {}) {
  const constraints = [];

  (options.where || []).forEach((rule) => {
    if (!Array.isArray(rule) || rule.length < 3) return;
    constraints.push(where(rule[0], rule[1], rule[2]));
  });

  (options.orderBy || []).forEach((rule) => {
    if (typeof rule === 'string') constraints.push(orderBy(rule));
    else if (Array.isArray(rule)) constraints.push(orderBy(rule[0], rule[1] || 'asc'));
  });

  if (options.limit) constraints.push(limit(Number(options.limit)));
  return constraints;
}

function normalizeSnapshot(docSnap) {
  return docSnap.exists()
    ? { id: docSnap.id, ...docSnap.data() }
    : null;
}

export function collectionRef(collectionName) {
  return collection(db, cleanCollectionName(collectionName));
}

export function documentRef(collectionName, documentId) {
  if (!documentId) throw new Error('Document ID is required.');
  return doc(db, cleanCollectionName(collectionName), String(documentId));
}

export async function createPersistentRecord(collectionName, input = {}, options = {}) {
  const id = options.id || input.id || doc(collectionRef(collectionName)).id;
  const payload = {
    ...input,
    id,
    createdAtMs: input.createdAtMs || nowMs(),
    updatedAtMs: nowMs(),
    createdAt: options.includeServerTimestamp === false ? input.createdAt || null : serverTimestamp(),
    updatedAt: options.includeServerTimestamp === false ? input.updatedAt || null : serverTimestamp()
  };

  await setDoc(documentRef(collectionName, id), payload, { merge: Boolean(options.merge) });
  return payload;
}

export async function setPersistentRecord(collectionName, documentId, input = {}, options = {}) {
  const payload = {
    ...input,
    id: documentId,
    updatedAtMs: nowMs(),
    updatedAt: options.includeServerTimestamp === false ? input.updatedAt || null : serverTimestamp()
  };

  if (!input.createdAtMs && !options.merge) payload.createdAtMs = nowMs();
  if (options.includeServerTimestamp !== false && !options.merge) payload.createdAt = serverTimestamp();

  await setDoc(documentRef(collectionName, documentId), payload, { merge: options.merge !== false });
  return payload;
}

export async function updatePersistentRecord(collectionName, documentId, patch = {}, options = {}) {
  const payload = {
    ...patch,
    updatedAtMs: nowMs(),
    updatedAt: options.includeServerTimestamp === false ? patch.updatedAt || null : serverTimestamp()
  };

  await updateDoc(documentRef(collectionName, documentId), payload);
  return { id: documentId, ...payload };
}

export async function deletePersistentRecord(collectionName, documentId) {
  await deleteDoc(documentRef(collectionName, documentId));
  return { id: documentId, deleted: true };
}

export async function getPersistentRecord(collectionName, documentId) {
  const snap = await getDoc(documentRef(collectionName, documentId));
  return normalizeSnapshot(snap);
}

export async function listPersistentRecords(collectionName, options = {}) {
  const constraints = buildQueryConstraints(options);
  const q = constraints.length
    ? query(collectionRef(collectionName), ...constraints)
    : query(collectionRef(collectionName));

  const snap = await getDocs(q);
  return snap.docs.map(normalizeSnapshot).filter(Boolean);
}

export function subscribePersistentRecords(collectionName, options = {}, callback = () => {}) {
  const constraints = buildQueryConstraints(options);
  const q = constraints.length
    ? query(collectionRef(collectionName), ...constraints)
    : query(collectionRef(collectionName));

  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(normalizeSnapshot).filter(Boolean));
  }, (error) => {
    console.error(`Firestore subscription failed for ${collectionName}:`, error);
    callback([], error);
  });
}

export function createCollectionAdapter(collectionName, defaults = {}) {
  const name = cleanCollectionName(collectionName);

  return {
    collectionName: name,
    create(input = {}, options = {}) {
      return createPersistentRecord(name, { ...defaults, ...input }, options);
    },
    set(documentId, input = {}, options = {}) {
      return setPersistentRecord(name, documentId, { ...defaults, ...input }, options);
    },
    update(documentId, patch = {}, options = {}) {
      return updatePersistentRecord(name, documentId, patch, options);
    },
    delete(documentId) {
      return deletePersistentRecord(name, documentId);
    },
    get(documentId) {
      return getPersistentRecord(name, documentId);
    },
    list(options = {}) {
      return listPersistentRecords(name, options);
    },
    subscribe(options = {}, callback = () => {}) {
      return subscribePersistentRecords(name, options, callback);
    }
  };
}

export const EvaraCollections = Object.freeze({
  SERVICE_CATALOG: 'service_catalog',
  SERVICE_PACKAGES: 'service_packages',
  QUOTES: 'quotes',
  SUBSCRIPTIONS: 'subscriptions',
  INVOICES: 'invoices',
  STRIPE_SESSIONS: 'stripe_sessions',
  MARKETPLACE_PAYOUTS: 'marketplace_payouts',
  REVENUE_ANALYTICS: 'revenue_analytics',
  CUSTOMER_MESSAGE_THREADS: 'customer_message_threads',
  CUSTOMER_SERVICE_HISTORY: 'customer_service_history',
  CUSTOMER_NOTIFICATIONS: 'customer_notifications',
  OPERATION_EVENTS: 'operation_events'
});

window.EvaraFirestoreCollectionAdapter = {
  EvaraCollections,
  collectionRef,
  documentRef,
  createPersistentRecord,
  setPersistentRecord,
  updatePersistentRecord,
  deletePersistentRecord,
  getPersistentRecord,
  listPersistentRecords,
  subscribePersistentRecords,
  createCollectionAdapter
};
