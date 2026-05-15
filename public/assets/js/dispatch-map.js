import { auth, db, onAuthStateChanged, collection, onSnapshot } from './firebase.js';
import { loadGoogleMaps } from './maps-loader.js';

const statusEl = document.getElementById('mapStatus');
const jobsEl = document.getElementById('mapJobs');
const staffEl = document.getElementById('mapStaff');
const onlineEl = document.getElementById('mapOnline');
const mapEl = document.getElementById('dispatchMap');

let map = null;
let unsubscribeJobs = null;
let unsubscribeLocations = null;
const jobMarkers = new Map();
const staffMarkers = new Map();

function setStatus(message) {
  if (statusEl) statusEl.textContent = message;
}

function stateFrom(lastSeen) {
  const diff = Date.now() - Number(lastSeen || 0);
  if (diff <= 120000) return 'online';
  if (diff <= 900000) return 'idle';
  return 'offline';
}

function syncMarkers(store, rows, kind) {
  const active = new Set();

  rows.forEach((row) => {
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const id = row.id || row.uid || `${kind}-${lat}-${lng}`;
    active.add(id);

    const position = { lat, lng };
    const title = kind === 'job'
      ? row.customerName || row.serviceType || row.service || 'Job'
      : row.displayName || row.email || 'Staff';

    const existing = store.get(id);
    if (existing) {
      existing.setPosition(position);
      existing.setTitle(title);
      return;
    }

    store.set(id, new google.maps.Marker({ map, position, title }));
  });

  store.forEach((marker, id) => {
    if (!active.has(id)) {
      marker.setMap(null);
      store.delete(id);
    }
  });

  return store.size;
}

function renderJobs(snapshot) {
  const rows = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  const count = syncMarkers(jobMarkers, rows, 'job');
  if (jobsEl) jobsEl.textContent = String(count);
}

function renderStaff(snapshot) {
  const rows = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  const count = syncMarkers(staffMarkers, rows, 'staff');
  const online = rows.filter((row) => stateFrom(row.lastSeenMs) === 'online').length;
  if (staffEl) staffEl.textContent = String(count);
  if (onlineEl) onlineEl.textContent = String(online);
}

function cleanupListeners() {
  if (unsubscribeJobs) unsubscribeJobs();
  if (unsubscribeLocations) unsubscribeLocations();
  unsubscribeJobs = null;
  unsubscribeLocations = null;
}

function startRealtimeMarkers() {
  cleanupListeners();

  unsubscribeJobs = onSnapshot(collection(db, 'jobs'), renderJobs, () => {
    setStatus('Job marker feed blocked');
  });

  unsubscribeLocations = onSnapshot(collection(db, 'workforce_locations'), renderStaff, () => {
    setStatus('Workforce marker feed blocked');
  });
}

async function initMap() {
  if (!mapEl) {
    setStatus('Map container missing');
    return;
  }

  await loadGoogleMaps();

  map = new google.maps.Map(mapEl, {
    center: { lat: 30.3322, lng: -81.6557 },
    zoom: 11,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    gestureHandling: 'greedy'
  });

  setStatus('Map ready');
  startRealtimeMarkers();
}

function init() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.assign('/login.html');
      return;
    }

    try {
      await initMap();
    } catch (error) {
      console.error(error);
      setStatus(error.message || 'Map failed to load');
    }
  });
}

window.addEventListener('beforeunload', cleanupListeners);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
