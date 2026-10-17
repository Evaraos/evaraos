import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  where
} from './firebase.js';
import { buildRoleScopedQueryRefs, buildRoleScopedReadPlan } from './role-scoped-firestore-queries.mjs?v=assignment-index-2';

const READABLE_ROLE_COLLECTIONS = new Set(['jobs', 'leads']);

export function buildRoleScopedCollectionQueries(collectionName, profile, userId, maxPerQuery = null) {
  if (!READABLE_ROLE_COLLECTIONS.has(collectionName)) {
    throw new Error('This role-scoped reader only supports jobs and leads.');
  }

  const plan = buildRoleScopedReadPlan(collectionName, profile, userId);
  const source = collection(db, collectionName);
  const queryRefs = buildRoleScopedQueryRefs(source, profile, userId, { query, where });
  const indexRef = plan.kind === 'assigned-index'
    ? collection(db, 'users', userId, plan.indexCollection)
    : null;
  const shouldLimit = Number.isInteger(maxPerQuery) && maxPerQuery > 0;

  return {
    plan,
    queryRefs: shouldLimit ? queryRefs.map((queryRef) => query(queryRef, limit(maxPerQuery))) : queryRefs,
    indexRef: indexRef && shouldLimit ? query(indexRef, limit(maxPerQuery)) : indexRef
  };
}

async function resolveAssignedRecords(collectionName, referenceSnapshot) {
  const lookups = await Promise.allSettled(referenceSnapshot.docs.map((reference) =>
    getDoc(doc(db, collectionName, reference.id))
  ));
  const documents = [];

  for (const result of lookups) {
    if (result.status === 'fulfilled') {
      if (result.value.exists()) documents.push(result.value);
      continue;
    }

    const code = String(result.reason?.code || '');
    if (code === 'permission-denied' || code === 'not-found') continue;
    throw result.reason;
  }

  return documents;
}

function mergeSnapshots(snapshots) {
  const docsById = new Map();
  for (const snapshot of snapshots) {
    for (const document of snapshot?.docs || []) docsById.set(document.id, document);
  }
  return [...docsById.values()];
}

export async function getRoleScopedCollectionDocs(collectionName, profile, userId, maxPerQuery = null) {
  const { plan, queryRefs, indexRef } = buildRoleScopedCollectionQueries(collectionName, profile, userId, maxPerQuery);
  const snapshots = await Promise.all(queryRefs.map((queryRef) => getDocs(queryRef)));

  if (plan.kind === 'assigned-index') {
    const references = await getDocs(indexRef);
    snapshots.push({ docs: await resolveAssignedRecords(collectionName, references) });
  }

  return mergeSnapshots(snapshots);
}

export function subscribeRoleScopedCollection(collectionName, profile, userId, onRows, onError = console.error, maxPerQuery = null) {
  const { plan, queryRefs, indexRef } = buildRoleScopedCollectionQueries(collectionName, profile, userId, maxPerQuery);
  const snapshots = new Map();
  const unsubscribers = [];
  const assignedSnapshots = new Map();
  const assignedUnsubscribers = new Map();
  const initialAssignedIds = new Set();
  let stopped = false;
  let indexSnapshotLoaded = false;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    for (const unsubscribe of unsubscribers.splice(0)) unsubscribe();
    for (const unsubscribe of assignedUnsubscribers.values()) unsubscribe();
    assignedUnsubscribers.clear();
  };

  const emit = () => {
    if (stopped || snapshots.size !== queryRefs.length) return;
    if (plan.kind === 'assigned-index'
      && (!indexSnapshotLoaded || initialAssignedIds.size > 0)) return;
    const assigned = plan.kind === 'assigned-index'
      ? [{ docs: [...assignedSnapshots.values()] }]
      : [];
    onRows(mergeSnapshots([...snapshots.values(), ...assigned]));
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

  if (plan.kind === 'assigned-index') {
    unsubscribers.push(onSnapshot(indexRef, (references) => {
      const recordIds = new Set(references.docs.map((reference) => reference.id));
      if (!indexSnapshotLoaded) {
        for (const recordId of recordIds) initialAssignedIds.add(recordId);
        indexSnapshotLoaded = true;
      }

      for (const [recordId, unsubscribe] of assignedUnsubscribers) {
        if (recordIds.has(recordId)) continue;
        unsubscribe();
        assignedUnsubscribers.delete(recordId);
        assignedSnapshots.delete(recordId);
        initialAssignedIds.delete(recordId);
      }

      for (const recordId of recordIds) {
        if (assignedUnsubscribers.has(recordId)) continue;
        const unsubscribe = onSnapshot(doc(db, collectionName, recordId), (snapshot) => {
          if (stopped) return;
          if (snapshot.exists()) assignedSnapshots.set(recordId, snapshot);
          else assignedSnapshots.delete(recordId);
          initialAssignedIds.delete(recordId);
          emit();
        }, (error) => {
          if (stopped) return;
          assignedUnsubscribers.get(recordId)?.();
          assignedUnsubscribers.delete(recordId);
          assignedSnapshots.delete(recordId);
          initialAssignedIds.delete(recordId);
          if (error?.code === 'permission-denied' || error?.code === 'not-found') {
            emit();
            return;
          }
          stop();
          onError(error);
        });
        assignedUnsubscribers.set(recordId, unsubscribe);
      }
      emit();
    }, (error) => {
      stop();
      onError(error);
    }));
  }

  return stop;
}
