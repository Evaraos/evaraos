import { subscribeRoleScopedCollection } from './firestore-role-scoped-collections.js?v=assignment-index-1';

import {
  resolveFieldOpsMapAccessContext,
  normalizeLeadForMap,
  normalizeJobForMap,
  groupFieldOpsByTerritory,
  groupFieldOpsByAssignee
} from './field-ops-map-layer.js';

let activeGeneration = 0;
let unsubscribeListeners = [];
let leadBuckets = new Map();
let jobBuckets = new Map();
let currentLeads = [];
let currentJobs = [];

function stopExistingListeners() {
  unsubscribeListeners.forEach((unsubscribe) => unsubscribe?.());
  unsubscribeListeners = [];
}

function mergeBuckets(buckets = new Map()) {
  const records = new Map();

  buckets.forEach((bucket) => {
    bucket.forEach((record, id) => records.set(id, record));
  });

  return [...records.values()];
}

function emitUpdate(callback) {
  const records = [...currentLeads, ...currentJobs];

  callback({
    leads: currentLeads,
    jobs: currentJobs,
    records,
    byTerritory: groupFieldOpsByTerritory(records),
    byAssignee: groupFieldOpsByAssignee(records)
  });
}

function subscribeScopedCollection(collectionName, context, bucketStore, normalizer, onChange, onError) {
  const unsubscribe = subscribeRoleScopedCollection(collectionName, context, context.uid, (documents) => {
    const bucket = new Map();
    documents.forEach((document) => {
      bucket.set(document.id, normalizer({ id: document.id, ...document.data() }));
    });
    bucketStore.clear();
    bucketStore.set(0, bucket);
    onChange();
  }, onError);

  unsubscribeListeners.push(unsubscribe);
}

export function startFieldOpsRealtime(callback, options = {}) {
  if (typeof callback !== 'function') {
    throw new Error('startFieldOpsRealtime requires a callback.');
  }

  stopFieldOpsRealtime();
  const generation = activeGeneration;

  const onError = typeof options.onError === 'function'
    ? options.onError
    : (error) => console.error('Field ops realtime failed:', error);

  Promise.resolve()
    .then(async () => {
      const context = options.context || await resolveFieldOpsMapAccessContext(options);
      if (generation !== activeGeneration) return;

      const refreshLeads = () => {
        if (generation !== activeGeneration) return;
        currentLeads = mergeBuckets(leadBuckets);
        emitUpdate(callback);
      };

      const refreshJobs = () => {
        if (generation !== activeGeneration) return;
        currentJobs = mergeBuckets(jobBuckets);
        emitUpdate(callback);
      };

      subscribeScopedCollection(
        'leads',
        context,
        leadBuckets,
        normalizeLeadForMap,
        refreshLeads,
        onError
      );

      subscribeScopedCollection(
        'jobs',
        context,
        jobBuckets,
        normalizeJobForMap,
        refreshJobs,
        onError
      );
    })
    .catch(onError);

  return stopFieldOpsRealtime;
}

export function stopFieldOpsRealtime() {
  activeGeneration += 1;
  stopExistingListeners();
  leadBuckets = new Map();
  jobBuckets = new Map();
  currentLeads = [];
  currentJobs = [];
}

window.EvaraFieldOpsRealtime = {
  startFieldOpsRealtime,
  stopFieldOpsRealtime
};
