import {
  db,
  collection,
  onSnapshot
} from './firebase.js';

import {
  normalizeLeadForMap,
  normalizeJobForMap,
  groupFieldOpsByTerritory,
  groupFieldOpsByAssignee
} from './field-ops-map-layer.js';

let unsubscribeLeads = null;
let unsubscribeJobs = null;
let currentLeads = [];
let currentJobs = [];

function stopExistingListeners() {
  if (unsubscribeLeads) unsubscribeLeads();
  if (unsubscribeJobs) unsubscribeJobs();
  unsubscribeLeads = null;
  unsubscribeJobs = null;
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

export function startFieldOpsRealtime(callback, options = {}) {
  if (typeof callback !== 'function') {
    throw new Error('startFieldOpsRealtime requires a callback.');
  }

  stopExistingListeners();

  const onError = typeof options.onError === 'function'
    ? options.onError
    : (error) => console.error('Field ops realtime failed:', error);

  unsubscribeLeads = onSnapshot(collection(db, 'leads'), (snap) => {
    currentLeads = snap.docs.map((docItem) => normalizeLeadForMap({
      id: docItem.id,
      ...docItem.data()
    }));

    emitUpdate(callback);
  }, onError);

  unsubscribeJobs = onSnapshot(collection(db, 'jobs'), (snap) => {
    currentJobs = snap.docs.map((docItem) => normalizeJobForMap({
      id: docItem.id,
      ...docItem.data()
    }));

    emitUpdate(callback);
  }, onError);

  return stopFieldOpsRealtime;
}

export function stopFieldOpsRealtime() {
  stopExistingListeners();
  currentLeads = [];
  currentJobs = [];
}

window.EvaraFieldOpsRealtime = {
  startFieldOpsRealtime,
  stopFieldOpsRealtime
};
