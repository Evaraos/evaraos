import {
  db,
  collection,
  onSnapshot
} from './firebase.js';

import {
  calculateLeadAnalytics,
  calculateJobAnalytics,
  calculateTerritoryAnalytics
} from './operations-analytics.js';

let unsubscribeLeads = null;
let unsubscribeJobs = null;
let unsubscribeTerritories = null;

let currentLeads = [];
let currentJobs = [];
let currentTerritories = [];

function stopListeners() {
  if (unsubscribeLeads) unsubscribeLeads();
  if (unsubscribeJobs) unsubscribeJobs();
  if (unsubscribeTerritories) unsubscribeTerritories();

  unsubscribeLeads = null;
  unsubscribeJobs = null;
  unsubscribeTerritories = null;
}

function rows(snapshot) {
  return snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data()
  }));
}

function emit(callback) {
  const leadAnalytics = calculateLeadAnalytics(currentLeads);
  const jobAnalytics = calculateJobAnalytics(currentJobs);
  const territoryAnalytics = calculateTerritoryAnalytics(
    currentTerritories,
    currentLeads,
    currentJobs
  );

  callback({
    leads: currentLeads,
    jobs: currentJobs,
    territories: currentTerritories,
    leadAnalytics,
    jobAnalytics,
    territoryAnalytics
  });
}

export function startOperationsAnalyticsRealtime(callback, options = {}) {
  if (typeof callback !== 'function') {
    throw new Error('startOperationsAnalyticsRealtime requires a callback.');
  }

  stopListeners();

  const onError = typeof options.onError === 'function'
    ? options.onError
    : (error) => console.error('Realtime analytics failed:', error);

  unsubscribeLeads = onSnapshot(collection(db, 'leads'), (snapshot) => {
    currentLeads = rows(snapshot);
    emit(callback);
  }, onError);

  unsubscribeJobs = onSnapshot(collection(db, 'jobs'), (snapshot) => {
    currentJobs = rows(snapshot);
    emit(callback);
  }, onError);

  unsubscribeTerritories = onSnapshot(collection(db, 'territories'), (snapshot) => {
    currentTerritories = rows(snapshot);
    emit(callback);
  }, onError);

  return stopOperationsAnalyticsRealtime;
}

export function stopOperationsAnalyticsRealtime() {
  stopListeners();
  currentLeads = [];
  currentJobs = [];
  currentTerritories = [];
}

window.EvaraOperationsAnalyticsRealtime = {
  startOperationsAnalyticsRealtime,
  stopOperationsAnalyticsRealtime
};
