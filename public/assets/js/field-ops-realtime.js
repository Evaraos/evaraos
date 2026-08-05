import {
  onSnapshot
} from './firebase.js';

import {
  resolveFieldOpsMapAccessContext,
  buildFieldOpsCollectionQueries,
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

function subscribeScopedCollection(queryRefs, bucketStore, normalizer, onChange, onError) {
  queryRefs.forEach((queryRef, index) => {
    const unsubscribe = onSnapshot(queryRef, (snapshot) => {
      const bucket = new Map();

      snapshot.docs.forEach((docItem) => {
        bucket.set(docItem.id, normalizer({ id: docItem.id, ...docItem.data() }));
      });

      bucketStore.set(index, bucket);
      onChange();
    }, onError);

    unsubscribeListeners.push(unsubscribe);
  });
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
        buildFieldOpsCollectionQueries('leads', context),
        leadBuckets,
        normalizeLeadForMap,
        refreshLeads,
        onError
      );

      subscribeScopedCollection(
        buildFieldOpsCollectionQueries('jobs', context),
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
