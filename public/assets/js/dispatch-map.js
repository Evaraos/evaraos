import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  serverTimestamp,
  getSavedUserProfile,
  getSavedUserRole
} from './firebase.js';
import { setDoc as setFirestoreDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { loadGoogleMaps } from './maps-loader.js';

const statusEl = document.getElementById('mapStatus');
const jobsEl = document.getElementById('mapJobs');
const staffEl = document.getElementById('mapStaff');
const onlineEl = document.getElementById('mapOnline');
const mapEl = document.getElementById('dispatchMap');
const startLocationButton = document.getElementById('startLocation');
const stopLocationButton = document.getElementById('stopLocation');

const PLATFORM_ROLES = new Set(['owner', 'super_admin', 'admin']);
const DISPATCH_ROLES = new Set([
  'owner',
  'super_admin',
  'admin',
  'manager',
  'operations_manager',
  'operations_coordinator',
  'field_manager',
  'dispatcher',
  'quality_control',
  'technician',
  'lead_technician',
  'cleaner',
  'lead_cleaner',
  'staff',
  'field_staff',
  'crew_lead',
  'sales',
  'sales_rep',
  'customer_support'
]);
const FIELD_TRACKING_ROLES = new Set([
  'owner',
  'super_admin',
  'admin',
  'manager',
  'operations_manager',
  'operations_coordinator',
  'field_manager',
  'dispatcher',
  'technician',
  'lead_technician',
  'cleaner',
  'lead_cleaner',
  'staff',
  'field_staff',
  'crew_lead',
  'sales',
  'sales_rep'
]);

const LOCATION_WRITE_INTERVAL_MS = 7000;

let map = null;
let unsubscribeJobs = null;
let unsubscribeLocations = null;
let locationWatchId = null;
let locationWriteInFlight = false;
let lastLocationWriteAt = 0;
let activeUser = null;
let activeProfile = {};
let activeRole = '';
let activeCompanyId = '';
let firstLocationFix = true;
const jobMarkers = new Map();
const staffMarkers = new Map();

function setStatus(message) {
  if (statusEl) statusEl.textContent = message;
}

function normalizeRole(value = '') {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'tech') return 'technician';
  return role;
}

function setTrackingControls({ canStart = false, tracking = false } = {}) {
  if (startLocationButton) startLocationButton.disabled = !canStart || tracking;
  if (stopLocationButton) stopLocationButton.disabled = !tracking;
}

function stateFrom(row = {}) {
  if (row.trackingStatus === 'stopped') return 'offline';
  const diff = Date.now() - Number(row.lastSeenMs || 0);
  if (diff <= 120000) return 'online';
  if (diff <= 900000) return 'idle';
  return 'offline';
}

function clearMarkers(store) {
  store.forEach((marker) => marker.setMap(null));
  store.clear();
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
    const baseTitle = kind === 'job'
      ? row.customerName || row.serviceType || row.service || 'Job'
      : row.displayName || row.email || 'Staff';
    const title = kind === 'staff' ? `${baseTitle} • ${stateFrom(row)}` : baseTitle;

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
  const online = rows.filter((row) => stateFrom(row) === 'online').length;
  if (staffEl) staffEl.textContent = String(count);
  if (onlineEl) onlineEl.textContent = String(online);
}

function cleanupListeners() {
  if (unsubscribeJobs) unsubscribeJobs();
  if (unsubscribeLocations) unsubscribeLocations();
  unsubscribeJobs = null;
  unsubscribeLocations = null;
}

function scopedFeed(collectionName) {
  const source = collection(db, collectionName);
  if (activeCompanyId) return query(source, where('companyId', '==', activeCompanyId));
  if (PLATFORM_ROLES.has(activeRole)) return source;
  return null;
}

function startRealtimeMarkers() {
  cleanupListeners();
  clearMarkers(jobMarkers);
  clearMarkers(staffMarkers);

  const jobsFeed = scopedFeed('jobs');
  const locationsFeed = scopedFeed('workforce_locations');

  if (!jobsFeed || !locationsFeed) {
    setStatus('A company assignment is required before dispatch data can load.');
    return;
  }

  unsubscribeJobs = onSnapshot(jobsFeed, renderJobs, (error) => {
    console.error('Dispatch jobs feed failed:', error);
    setStatus('Job marker feed unavailable.');
  });

  unsubscribeLocations = onSnapshot(locationsFeed, renderStaff, (error) => {
    console.error('Dispatch workforce feed failed:', error);
    setStatus('Workforce marker feed unavailable.');
  });
}

function locationErrorMessage(error) {
  if (error?.code === 1) return 'Location permission was denied.';
  if (error?.code === 2) return 'Your current location is unavailable.';
  if (error?.code === 3) return 'Location request timed out.';
  return error?.message || 'Location tracking failed.';
}

async function writeLocation(position) {
  if (!activeUser || locationWriteInFlight) return;

  const now = Date.now();
  if (lastLocationWriteAt && now - lastLocationWriteAt < LOCATION_WRITE_INTERVAL_MS) return;

  const latitude = Number(position?.coords?.latitude);
  const longitude = Number(position?.coords?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

  locationWriteInFlight = true;
  try {
    await setFirestoreDoc(doc(db, 'workforce_locations', activeUser.uid), {
      uid: activeUser.uid,
      userId: activeUser.uid,
      companyId: activeCompanyId,
      companyName: activeProfile.companyName || '',
      displayName:
        activeProfile.displayName ||
        activeProfile.fullName ||
        activeProfile.name ||
        activeUser.displayName ||
        activeUser.email ||
        'Field staff',
      email: activeUser.email || activeProfile.email || '',
      role: activeRole,
      lat: latitude,
      lng: longitude,
      accuracyMeters: Number(position.coords.accuracy || 0),
      altitudeMeters: Number.isFinite(position.coords.altitude) ? Number(position.coords.altitude) : null,
      headingDegrees: Number.isFinite(position.coords.heading) ? Number(position.coords.heading) : null,
      speedMetersPerSecond: Number.isFinite(position.coords.speed) ? Number(position.coords.speed) : null,
      trackingStatus: 'active',
      lastSeenMs: now,
      capturedAtMs: Number(position.timestamp || now),
      source: 'dispatch_map',
      updatedAt: serverTimestamp()
    }, { merge: true });

    lastLocationWriteAt = now;
    setStatus('Live location sharing is active.');

    if (firstLocationFix && map) {
      map.panTo({ lat: latitude, lng: longitude });
      map.setZoom(Math.max(map.getZoom() || 11, 14));
      firstLocationFix = false;
    }
  } catch (error) {
    console.error('Location update failed:', error);
    setStatus(error.message || 'Location update could not be saved.');
  } finally {
    locationWriteInFlight = false;
  }
}

async function markTrackingStopped() {
  if (!activeUser) return;

  try {
    await setFirestoreDoc(doc(db, 'workforce_locations', activeUser.uid), {
      uid: activeUser.uid,
      userId: activeUser.uid,
      companyId: activeCompanyId,
      role: activeRole,
      trackingStatus: 'stopped',
      lastSeenMs: Date.now(),
      source: 'dispatch_map',
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn('Unable to persist stopped tracking state:', error);
  }
}

function canShareLocation() {
  if (!activeUser || !FIELD_TRACKING_ROLES.has(activeRole)) return false;
  return Boolean(activeCompanyId || PLATFORM_ROLES.has(activeRole));
}

function startLocationTracking() {
  if (!canShareLocation()) {
    setStatus('Your role or company assignment does not allow field tracking.');
    return;
  }

  if (!navigator.geolocation) {
    setStatus('This device does not support location tracking.');
    return;
  }

  if (locationWatchId !== null) return;

  firstLocationFix = true;
  lastLocationWriteAt = 0;
  setStatus('Requesting location permission...');
  setTrackingControls({ canStart: true, tracking: true });

  locationWatchId = navigator.geolocation.watchPosition(
    (position) => writeLocation(position),
    (error) => {
      setStatus(locationErrorMessage(error));
      stopLocationTracking({ persist: false });
    },
    {
      enableHighAccuracy: true,
      maximumAge: 4000,
      timeout: 15000
    }
  );
}

async function stopLocationTracking({ persist = true } = {}) {
  if (locationWatchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(locationWatchId);
  }

  locationWatchId = null;
  setTrackingControls({ canStart: canShareLocation(), tracking: false });

  if (persist) await markTrackingStopped();
  if (persist) setStatus('Location sharing is off.');
}

function bindTrackingControls() {
  startLocationButton?.addEventListener('click', startLocationTracking);
  stopLocationButton?.addEventListener('click', () => stopLocationTracking({ persist: true }));
  setTrackingControls({ canStart: false, tracking: false });
}

async function initMap() {
  if (!mapEl) {
    setStatus('Map container missing.');
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

  setTrackingControls({ canStart: canShareLocation(), tracking: false });
  setStatus(canShareLocation() ? 'Map ready • Location sharing is off.' : 'Map ready.');
  startRealtimeMarkers();
}

function cleanup({ persistTrackingState = false } = {}) {
  cleanupListeners();
  if (locationWatchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(locationWatchId);
  }
  locationWatchId = null;
  if (persistTrackingState) markTrackingStopped();
}

function init() {
  bindTrackingControls();

  onAuthStateChanged(auth, async (user) => {
    cleanup();

    if (!user) {
      window.location.assign('/login.html');
      return;
    }

    activeUser = user;
    activeProfile = getSavedUserProfile() || {};
    activeRole = normalizeRole(activeProfile.role || getSavedUserRole());
    activeCompanyId = String(activeProfile.companyId || '').trim();

    if (!DISPATCH_ROLES.has(activeRole)) {
      setTrackingControls({ canStart: false, tracking: false });
      setStatus('Dispatch access is unavailable for this account.');
      return;
    }

    try {
      await initMap();
    } catch (error) {
      console.error(error);
      setStatus(error.message || 'Map failed to load.');
    }
  });
}

window.addEventListener('pagehide', () => cleanup());
window.addEventListener('beforeunload', () => cleanup());

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
