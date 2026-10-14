import {
  db,
  collection,
  getDocs,
  limit,
  onSnapshot,
  query,
  where
} from './firebase.js';
import { buildRoleScopedQueryRefs } from './role-scoped-firestore-queries.mjs';

const READABLE_ROLE_COLLECTIONS = new Set(['jobs', 'leads']);

export function buildRoleScopedCollectionQueries(collectionName, profile, userId, maxPerQuery = null) {
  if (!READABLE_ROLE_COLLECTIONS.has(collectionName)) {
    throw new Error('This role-scoped reader only supports jobs and leads.');
  }
  const refs = buildRoleScopedQueryRefs(
    collection(db, collectionName),
    profile,
    userId,
    { query, where }
  );
  if (!Number.isInteger(maxPerQuery) || maxPerQuery < 1) return refs;
  return refs.map((queryRef) => query(queryRef, limit(maxPerQuery)));
}

export async function getRoleScopedCollectionDocs(collectionName, profile, userId, maxPerQuery = null) {
  const snapshots = await Promise.all(
    buildRoleScopedCollectionQueries(collectionName, profile, userId, maxPerQuery).map((queryRef) => getDocs(queryRef))
  );
  const docsById = new Map();
  for (const snapshot of snapshots) {
    for (const document of snapshot.docs) docsById.set(document.id, document);
  }
  return [...docsById.values()];
}

export function subscribeRoleScopedCollection(collectionName, profile, userId, onRows, onError = console.error, maxPerQuery = null) {
  const queryRefs = buildRoleScopedCollectionQueries(collectionName, profile, userId, maxPerQuery);
  const snapshots = new Map();
  const unsubscribers = [];
  let stopped = false;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    for (const unsubscribe of unsubscribers.splice(0)) unsubscribe();
  };

  const emit = () => {
    if (stopped || snapshots.size !== queryRefs.length) return;
    const docsById = new Map();
    for (const snapshot of snapshots.values()) {
      for (const document of snapshot.docs) docsById.set(document.id, document);
    }
    onRows([...docsById.values()]);
  };

  queryRefs.forEach((queryRef, index) => {
    unsubscribers.push(onSnapshot(queryRef, (snapshot) => {
      snapshots.set(index, snapshot);
      emit();
    }, (error) => {
      stop();
      onError(error);
    }));
  });

  return stop;
}
