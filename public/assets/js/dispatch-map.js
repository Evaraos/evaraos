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

const statusEl = document.getElementById('mapStatus');
const statusDetailEl = document.getElementById('mapStatusDetail');
const nearbyCountEl = document.getElementById('nearbyCount');
const closestDistanceEl = document.getElementById('closestDistance');
const onlineTeamCountEl = document.getElementById('onlineTeamCount');
const locationAccuracyEl = document.getElementById('locationAccuracy');
const nearbySummaryEl = document.getElementById('nearbySummary');
const nearbyListEl = document.getElementById('nearbyList');
const mapEl = document.getElementById('dispatchMap');
const locationToggle = document.getElementById('liveLocationToggle');
const locationLabel = document.getElementById('liveLocationLabel');
const centerOnMeButton = document.getElementById('centerOnMe');
const fitPinsButton = document.getElementById('fitVisiblePins');
const refreshButton = document.getElementById('refreshMapData');
const searchInput = document.getElementById('mapSearch');
const typeFilter = document.getElementById('mapTypeFilter');
const radiusFilter = document.getElementById('mapRadiusFilter');
const selectedCard = document.getElementById('selectedMapCard');
const selectedTitle = document.getElementById('selectedMapTitle');
const selectedMeta = document.getElementById('selectedMapMeta');
const selectedDirections = document.getElementById('selectedMapDirections');
const selectedClose = document.getElementById('selectedMapClose');

const PLATFORM_ROLES = new Set(['owner', 'super_admin']);
const COMPANY_MAP_ROLES = new Set([
  'owner',
  'super_admin',
  'admin',
  'manager',
  'operations_manager',
  'operations_coordinator',
  'field_manager',
  'sales_manager',
  'dispatcher',
  'hr',
  'hr_manager'
]);
const TEAM_LOCATION_ROLES = new Set([
  'owner',
  'super_admin',
  'admin',
  'manager',
  'operations_manager',
  'operations_coordinator',
  'hr',
  'hr_manager'
]);
const DISPATCH_ROLES = new Set([
  ...COMPANY_MAP_ROLES,
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
const LOCATION_SHARING_ROLES = new Set([...DISPATCH_ROLES]);

const JACKSONVILLE = [30.3322, -81.6557];
const LOCATION_WRITE_INTERVAL_MS = 10000;
const LOCATION_WRITE_DISTANCE_MILES = 0.03;
const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const IDLE_WINDOW_MS = 15 * 60 * 1000;
const OFFLINE_HIDE_WINDOW_MS = 12 * 60 * 60 * 1000;

let map = null;
let tileLayer = null;
let selfMarker = null;
let accuracyCircle = null;
let radiusCircle = null;
let locationWatchId = null;
let locationWriteInFlight = false;
let lastLocationWriteAt = 0;
let lastPersistedPosition = null;
let activeUser = null;
let activeProfile = {};
let activeRole = '';
let activeCompanyId = '';
let lastKnownPosition = null;
let selectedRecordKey = '';
let selectedRecord = null;
let firstLocationFix = true;
let feedGeneration = 0;

const records = new Map();
const markers = new Map();
const feedPartitions = new Map();
const unsubscribers = [];

function normalizeRole(value = '') {
  const role = String(value || '').trim().toLowerCase();
  return role === 'tech' ? 'technician' : role;
}

function cleanText(value = '') {
  return String(value ?? '').trim();
}

function escapeHtml(value = '') {
  return cleanText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function coordinatesFrom(row = {}) {
  const location = row.location || row.coordinates || row.geo || {};
  const lat = numeric(row.lat ?? row.latitude ?? location.lat ?? location.latitude);
  const lng = numeric(row.lng ?? row.longitude ?? location.lng ?? location.longitude);
  if (lat === null || lng === null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function toRadians(value) {
  return value * (Math.PI / 180);
}

function distanceMiles(a, b) {
  if (!a || !b) return null;
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const calculation =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return earthRadiusMiles * (2 * Math.atan2(Math.sqrt(calculation), Math.sqrt(1 - calculation)));
}

function timestampMs(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (Number.isFinite(Number(value))) return Number(value);
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizedStatus(value = '') {
  return cleanText(value).toLowerCase().replace(/\s+/g, '_') || 'unknown';
}

function stateFrom(row = {}) {
  if (row.trackingStatus === 'stopped') return 'offline';
  const lastSeen = numeric(row.lastSeenMs) || timestampMs(row.updatedAt);
  const age = Date.now() - lastSeen;
  if (age <= ONLINE_WINDOW_MS) return 'online';
  if (age <= IDLE_WINDOW_MS) return 'idle';
  return 'offline';
}

function titleFor(kind, row = {}) {
  if (kind === 'staff') {
    return cleanText(row.displayName || row.fullName || row.name || row.email || 'Field teammate');
  }
  if (kind === 'lead') {
    return cleanText(row.customerName || row.name || row.title || row.serviceType || row.service || 'Lead');
  }
  return cleanText(row.customerName || row.title || row.serviceType || row.service || 'Job');
}

function subtitleFor(kind, row = {}) {
  if (kind === 'staff') {
    const state = stateFrom(row);
    const role = cleanText(row.role).replace(/_/g, ' ');
    return [role, state].filter(Boolean).join(' • ');
  }

  const service = cleanText(row.serviceType || row.service || row.category || row.jobType || row.leadType);
  const area = cleanText(
    row.city ||
    row.serviceCity ||
    row.address?.city ||
    row.locationLabel ||
    row.territoryName ||
    row.regionName
  );
  const status = normalizedStatus(row.status || row.jobStatus || row.leadStatus).replace(/_/g, ' ');
  return [service, area, status].filter(Boolean).join(' • ');
}

function normalizeRecord(kind, id, row = {}) {
  const position = coordinatesFrom(row);
  if (!position) return null;
  const key = `${kind}:${id}`;
  const status = normalizedStatus(row.status || row.jobStatus || row.leadStatus || row.trackingStatus);
  const updatedAtMs = numeric(row.updatedAtMs) || numeric(row.lastSeenMs) || timestampMs(row.updatedAt || row.createdAt);
  const distance = lastKnownPosition ? distanceMiles(lastKnownPosition, position) : null;

  return {
    key,
    id,
    kind,
    raw: row,
    position,
    title: titleFor(kind, row),
    subtitle: subtitleFor(kind, row),
    status,
    distance,
    updatedAtMs,
    assignedToUid: cleanText(row.assignedToUid || row.assignedRep || row.staffClaimedBy),
    onlineState: kind === 'staff' ? stateFrom(row) : ''
  };
}

function setStatus(message, detail = '') {
  if (statusEl) statusEl.textContent = message;
  if (statusDetailEl && detail) statusDetailEl.textContent = detail;
}

function isPlatformUser() {
  return PLATFORM_ROLES.has(activeRole) || (activeRole === 'admin' && activeProfile.platformAccess === true);
}

function canViewCompanyMap() {
  return COMPANY_MAP_ROLES.has(activeRole);
}

function canViewTeamLocations() {
  return TEAM_LOCATION_ROLES.has(activeRole);
}

function canShareLocation() {
  if (!activeUser || !LOCATION_SHARING_ROLES.has(activeRole)) return false;
  return Boolean(activeCompanyId || isPlatformUser());
}

function isDarkMapMode() {
  const root = document.documentElement;
  const environment = cleanText(root.dataset.environment || root.dataset.theme || root.dataset.appearance).toLowerCase();
  if (environment.includes('dark') || root.classList.contains('dark')) return true;
  if (environment.includes('light')) return false;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches || false;
}

function applyBaseLayer() {
  if (!map || !window.L) return;
  if (tileLayer) tileLayer.remove();
  const dark = isDarkMapMode();
  const style = dark ? 'dark_all' : 'light_all';
  tileLayer = window.L.tileLayer(`https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png`, {
    maxZoom: 20,
    subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  }).addTo(map);
  tileLayer.bringToBack();
}

function initMap() {
  if (!mapEl) throw new Error('Map container missing.');
  if (!window.L) throw new Error('The live map library could not load. Check the network connection and reload.');

  map = window.L.map(mapEl, {
    center: JACKSONVILLE,
    zoom: 11,
    zoomControl: false,
    preferCanvas: true,
    attributionControl: true
  });

  applyBaseLayer();
  window.L.control.zoom({ position: 'bottomright' }).addTo(map);
  map.on('click', clearSelectedRecord);

  const observer = new MutationObserver(() => applyBaseLayer());
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'data-environment', 'data-appearance', 'class']
  });

  window.setTimeout(() => map.invalidateSize(), 120);
}

function markerIcon(kind, selected = false) {
  if (kind === 'self') {
    return window.L.divIcon({
      className: 'eva-map-div-icon',
      html: '<div class="eva-self-marker" aria-hidden="true"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });
  }

  const label = kind === 'lead' ? 'L' : kind === 'staff' ? 'T' : 'J';
  const classes = [
    'eva-map-pin',
    `eva-map-pin--${kind}`,
    selected ? 'eva-map-pin--selected' : ''
  ].filter(Boolean).join(' ');

  return window.L.divIcon({
    className: 'eva-map-div-icon',
    html: `<div class="${classes}" aria-hidden="true"><span>${label}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 30],
    popupAnchor: [0, -26]
  });
}

function popupHtml(record) {
  const distance = record.distance === null ? '' : `<br><strong>${formatDistance(record.distance)} away</strong>`;
  return `<strong>${escapeHtml(record.title)}</strong><br>${escapeHtml(record.subtitle || record.kind)}${distance}`;
}

function syncMarker(record) {
  const existing = markers.get(record.key);
  if (existing) {
    existing.setLatLng([record.position.lat, record.position.lng]);
    existing.setIcon(markerIcon(record.kind, record.key === selectedRecordKey));
    existing.setPopupContent(popupHtml(record));
    return;
  }

  const marker = window.L.marker([record.position.lat, record.position.lng], {
    icon: markerIcon(record.kind, record.key === selectedRecordKey),
    title: record.title,
    keyboard: true,
    riseOnHover: true
  }).addTo(map);

  marker.bindPopup(popupHtml(record), { closeButton: false, offset: [0, -4] });
  marker.on('click', (event) => {
    window.L.DomEvent.stopPropagation(event);
    selectRecord(record.key, { openPopup: true, pan: false });
  });
  markers.set(record.key, marker);
}

function removeUnusedMarkers(visibleKeys) {
  markers.forEach((marker, key) => {
    if (visibleKeys.has(key)) return;
    marker.remove();
    markers.delete(key);
  });
}

function formatDistance(value) {
  if (!Number.isFinite(value)) return '—';
  if (value < 0.1) return '<0.1 mi';
  if (value < 10) return `${value.toFixed(1)} mi`;
  return `${Math.round(value)} mi`;
}

function recordSearchText(record) {
  return [record.title, record.subtitle, record.status, record.kind].join(' ').toLowerCase();
}

function visibleRecords() {
  const requestedKind = typeFilter?.value || 'all';
  const radiusValue = radiusFilter?.value || '15';
  const radiusMiles = radiusValue === 'all' ? null : Number(radiusValue);
  const search = cleanText(searchInput?.value).toLowerCase();

  return Array.from(records.values())
    .map((record) => ({
      ...record,
      distance: lastKnownPosition ? distanceMiles(lastKnownPosition, record.position) : null
    }))
    .filter((record) => {
      if (requestedKind !== 'all' && record.kind !== requestedKind) return false;
      if (search && !recordSearchText(record).includes(search)) return false;
      if (record.kind === 'staff') {
        const age = Date.now() - record.updatedAtMs;
        if (record.onlineState === 'offline' && age > OFFLINE_HIDE_WINDOW_MS) return false;
      }
      if (radiusMiles !== null && lastKnownPosition && Number.isFinite(record.distance) && record.distance > radiusMiles) return false;
      return true;
    })
    .sort((a, b) => {
      if (Number.isFinite(a.distance) && Number.isFinite(b.distance)) return a.distance - b.distance;
      if (Number.isFinite(a.distance)) return -1;
      if (Number.isFinite(b.distance)) return 1;
      return b.updatedAtMs - a.updatedAtMs;
    });
}

function renderNearbyList(items) {
  if (!nearbyListEl) return;
  if (!items.length) {
    nearbyListEl.innerHTML = '<div class="nearby-empty">No permitted pins match these filters. Try a wider radius or clear the search.</div>';
    return;
  }

  nearbyListEl.innerHTML = items.slice(0, 80).map((record) => {
    const label = record.kind === 'lead' ? 'L' : record.kind === 'staff' ? 'T' : 'J';
    return `
      <button class="nearby-card" type="button" data-record-key="${escapeHtml(record.key)}" aria-pressed="${record.key === selectedRecordKey}">
        <span class="nearby-icon" data-kind="${record.kind}" aria-hidden="true">${label}</span>
        <span class="nearby-main">
          <strong>${escapeHtml(record.title)}</strong>
          <span>${escapeHtml(record.subtitle || record.kind)}</span>
        </span>
        <span class="nearby-distance">${formatDistance(record.distance)}</span>
      </button>`;
  }).join('');
}

function renderStats(items) {
  const opportunities = items.filter((record) => record.kind === 'lead' || record.kind === 'job');
  const teamOnline = Array.from(records.values()).filter((record) => record.kind === 'staff' && record.onlineState === 'online').length;
  const closest = opportunities.find((record) => Number.isFinite(record.distance));

  if (nearbyCountEl) nearbyCountEl.textContent = String(items.length);
  if (closestDistanceEl) closestDistanceEl.textContent = closest ? formatDistance(closest.distance) : '—';
  if (onlineTeamCountEl) onlineTeamCountEl.textContent = String(teamOnline);

  if (nearbySummaryEl) {
    if (!lastKnownPosition) {
      nearbySummaryEl.textContent = `${items.length} permitted pin${items.length === 1 ? '' : 's'} available. Turn on live location to sort by distance.`;
    } else {
      const radiusText = radiusFilter?.value === 'all' ? 'at any distance' : `within ${radiusFilter?.value || '15'} miles`;
      nearbySummaryEl.textContent = `${items.length} pin${items.length === 1 ? '' : 's'} ${radiusText}, sorted nearest first.`;
    }
  }
}

function renderRadiusCircle() {
  if (!map || !lastKnownPosition || !window.L) return;
  const radiusValue = radiusFilter?.value || '15';
  if (radiusCircle) {
    radiusCircle.remove();
    radiusCircle = null;
  }
  if (radiusValue === 'all') return;

  radiusCircle = window.L.circle([lastKnownPosition.lat, lastKnownPosition.lng], {
    radius: Number(radiusValue) * 1609.344,
    color: '#d71920',
    weight: 1,
    opacity: 0.35,
    fillColor: '#d71920',
    fillOpacity: 0.035,
    interactive: false
  }).addTo(map);
}

function render() {
  if (!map) return;
  const items = visibleRecords();
  const visibleKeys = new Set(items.map((record) => record.key));
  items.forEach(syncMarker);
  removeUnusedMarkers(visibleKeys);
  renderNearbyList(items);
  renderStats(items);
  renderRadiusCircle();

  if (selectedRecordKey && !visibleKeys.has(selectedRecordKey)) clearSelectedRecord();
}

function selectRecord(key, { openPopup = false, pan = true } = {}) {
  const record = records.get(key);
  if (!record) return;

  const previousKey = selectedRecordKey;
  selectedRecordKey = key;
  selectedRecord = {
    ...record,
    distance: lastKnownPosition ? distanceMiles(lastKnownPosition, record.position) : null
  };

  if (previousKey && markers.has(previousKey)) markers.get(previousKey).setIcon(markerIcon(records.get(previousKey)?.kind || 'job', false));
  if (markers.has(key)) {
    const marker = markers.get(key);
    marker.setIcon(markerIcon(record.kind, true));
    if (openPopup) marker.openPopup();
  }

  if (selectedTitle) selectedTitle.textContent = selectedRecord.title;
  if (selectedMeta) selectedMeta.textContent = [selectedRecord.subtitle, formatDistance(selectedRecord.distance)].filter(Boolean).join(' • ');
  if (selectedCard) selectedCard.dataset.visible = 'true';
  if (pan) map.panTo([record.position.lat, record.position.lng], { animate: true });
  renderNearbyList(visibleRecords());
}

function clearSelectedRecord() {
  if (selectedRecordKey && markers.has(selectedRecordKey)) {
    const record = records.get(selectedRecordKey);
    markers.get(selectedRecordKey).setIcon(markerIcon(record?.kind || 'job', false));
  }
  selectedRecordKey = '';
  selectedRecord = null;
  if (selectedCard) selectedCard.dataset.visible = 'false';
  renderNearbyList(visibleRecords());
}

function openDirections() {
  if (!selectedRecord) return;
  const destination = `${selectedRecord.position.lat},${selectedRecord.position.lng}`;
  const origin = lastKnownPosition ? `&origin=${lastKnownPosition.lat},${lastKnownPosition.lng}` : '';
  window.open(
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}${origin}`,
    '_blank',
    'noopener,noreferrer'
  );
}

function updateSelfLocation(position) {
  const latitude = numeric(position?.coords?.latitude);
  const longitude = numeric(position?.coords?.longitude);
  if (latitude === null || longitude === null || !map) return;

  lastKnownPosition = { lat: latitude, lng: longitude };
  const latLng = [latitude, longitude];
  const accuracy = Math.max(0, numeric(position.coords.accuracy) || 0);

  if (!selfMarker) {
    selfMarker = window.L.marker(latLng, {
      icon: markerIcon('self'),
      title: 'Your live location',
      zIndexOffset: 1000,
      keyboard: true
    }).addTo(map).bindTooltip('You are here', { direction: 'top', offset: [0, -12] });
  } else {
    selfMarker.setLatLng(latLng);
  }

  if (!accuracyCircle) {
    accuracyCircle = window.L.circle(latLng, {
      radius: accuracy,
      color: '#2878ff',
      weight: 1,
      opacity: .35,
      fillColor: '#2878ff',
      fillOpacity: .08,
      interactive: false
    }).addTo(map);
  } else {
    accuracyCircle.setLatLng(latLng);
    accuracyCircle.setRadius(accuracy);
  }

  if (locationAccuracyEl) locationAccuracyEl.textContent = accuracy ? `±${Math.round(accuracy)} m` : 'Live';

  if (firstLocationFix) {
    map.flyTo(latLng, Math.max(map.getZoom(), 14), { duration: .8 });
    firstLocationFix = false;
  }

  render();
}

function shouldPersistLocation(nextPosition) {
  if (!lastLocationWriteAt || !lastPersistedPosition) return true;
  if (Date.now() - lastLocationWriteAt >= LOCATION_WRITE_INTERVAL_MS) return true;
  const moved = distanceMiles(lastPersistedPosition, nextPosition);
  return Number.isFinite(moved) && moved >= LOCATION_WRITE_DISTANCE_MILES;
}

async function writeLocation(position) {
  updateSelfLocation(position);
  if (!activeUser || locationWriteInFlight || !lastKnownPosition || !shouldPersistLocation(lastKnownPosition)) return;

  locationWriteInFlight = true;
  const now = Date.now();

  try {
    await setFirestoreDoc(doc(db, 'workforce_locations', activeUser.uid), {
      uid: activeUser.uid,
      userId: activeUser.uid,
      companyId: activeCompanyId,
      companyName: cleanText(activeProfile.companyName),
      displayName:
        cleanText(activeProfile.displayName || activeProfile.fullName || activeProfile.name) ||
        cleanText(activeUser.displayName || activeUser.email) ||
        'Field staff',
      email: cleanText(activeUser.email || activeProfile.email),
      role: activeRole,
      lat: lastKnownPosition.lat,
      lng: lastKnownPosition.lng,
      accuracyMeters: numeric(position.coords.accuracy) || 0,
      altitudeMeters: numeric(position.coords.altitude),
      headingDegrees: numeric(position.coords.heading),
      speedMetersPerSecond: numeric(position.coords.speed),
      trackingStatus: 'active',
      lastSeenMs: now,
      capturedAtMs: numeric(position.timestamp) || now,
      source: 'dispatch_live_map',
      updatedAt: serverTimestamp()
    }, { merge: true });

    lastLocationWriteAt = now;
    lastPersistedPosition = { ...lastKnownPosition };
    setStatus('Live location is on', 'Your position and nearby distances are updating in real time.');
  } catch (error) {
    console.error('Live location update failed:', error);
    setStatus('Map is live locally', error?.message || 'Your position is visible on this device, but it could not be shared with your company.');
  } finally {
    locationWriteInFlight = false;
  }
}

async function markTrackingStopped() {
  if (!activeUser || !activeCompanyId) return;
  try {
    await setFirestoreDoc(doc(db, 'workforce_locations', activeUser.uid), {
      uid: activeUser.uid,
      userId: activeUser.uid,
      companyId: activeCompanyId,
      role: activeRole,
      trackingStatus: 'stopped',
      lastSeenMs: Date.now(),
      source: 'dispatch_live_map',
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn('Unable to persist stopped location state:', error);
  }
}

function locationErrorMessage(error) {
  if (error?.code === 1) return 'Location permission was denied. Enable it in your browser settings to use live distance and routing.';
  if (error?.code === 2) return 'Your current position is unavailable. Check device location services and try again.';
  if (error?.code === 3) return 'The location request timed out. Move to an area with a clearer GPS or network signal and retry.';
  return error?.message || 'Location tracking could not start.';
}

function setLocationControls(tracking) {
  if (locationToggle) {
    locationToggle.dataset.live = tracking ? 'true' : 'false';
    locationToggle.disabled = !canShareLocation();
  }
  if (locationLabel) locationLabel.textContent = tracking ? 'Stop live location' : 'Share live location';
  if (centerOnMeButton) centerOnMeButton.disabled = !lastKnownPosition;
}

function startLocationTracking({ requestedByUser = true } = {}) {
  if (!canShareLocation()) {
    setStatus('Location sharing unavailable', 'Your account needs an active company assignment and an approved field role.');
    return;
  }
  if (!navigator.geolocation) {
    setStatus('Location unsupported', 'This browser or device does not expose live location.');
    return;
  }
  if (locationWatchId !== null) return;

  firstLocationFix = true;
  lastLocationWriteAt = 0;
  setLocationControls(true);
  setStatus('Finding your location…', requestedByUser ? 'Approve the browser permission prompt to activate live distance and routing.' : 'Restoring your previously approved live location permission.');

  locationWatchId = navigator.geolocation.watchPosition(
    writeLocation,
    (error) => {
      setStatus('Location needs attention', locationErrorMessage(error));
      stopLocationTracking({ persist: false, keepLocalMarker: true });
    },
    {
      enableHighAccuracy: true,
      maximumAge: 3000,
      timeout: 20000
    }
  );
}

async function stopLocationTracking({ persist = true, keepLocalMarker = true } = {}) {
  if (locationWatchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(locationWatchId);
  locationWatchId = null;
  setLocationControls(false);
  if (persist) await markTrackingStopped();
  if (!keepLocalMarker) {
    selfMarker?.remove();
    accuracyCircle?.remove();
    selfMarker = null;
    accuracyCircle = null;
    lastKnownPosition = null;
    if (locationAccuracyEl) locationAccuracyEl.textContent = '—';
  }
  if (persist) setStatus('Live location is off', 'Your last position remains on this device so you can still inspect nearby pins.');
}

async function restoreGrantedLocationPermission() {
  if (!canShareLocation() || !navigator.permissions?.query) return;
  try {
    const permission = await navigator.permissions.query({ name: 'geolocation' });
    if (permission.state === 'granted') startLocationTracking({ requestedByUser: false });
    permission.addEventListener?.('change', () => {
      if (permission.state === 'granted' && locationWatchId === null) startLocationTracking({ requestedByUser: false });
      if (permission.state === 'denied' && locationWatchId !== null) stopLocationTracking({ persist: true });
    });
  } catch (error) {
    console.debug('Geolocation permission state unavailable:', error);
  }
}

function partitionKey(kind, scope) {
  return `${kind}:${scope}`;
}

function replacePartition(key, kind, snapshot) {
  const partition = new Map();
  snapshot.docs.forEach((item) => {
    if (kind === 'staff' && activeUser && item.id === activeUser.uid) return;
    const row = { id: item.id, ...item.data() };
    const record = normalizeRecord(kind, item.id, row);
    if (record) partition.set(record.key, record);
  });
  feedPartitions.set(key, partition);
  rebuildRecords();
}

function rebuildRecords() {
  records.clear();
  feedPartitions.forEach((partition) => {
    partition.forEach((record, key) => records.set(key, record));
  });
  render();
}

function watchFeed(feed, kind, scope, generation) {
  const key = partitionKey(kind, scope);
  const unsubscribe = onSnapshot(feed, (snapshot) => {
    if (generation !== feedGeneration) return;
    replacePartition(key, kind, snapshot);
    setStatus(
      locationWatchId !== null ? 'Live location is on' : 'Live map ready',
      locationWatchId !== null
        ? 'Your position and permitted company pins are updating in real time.'
        : 'Turn on live location to sort nearby pins and calculate distance.'
    );
  }, (error) => {
    console.warn(`Map feed failed (${key}):`, error);
    feedPartitions.delete(key);
    rebuildRecords();
  });
  unsubscribers.push(unsubscribe);
}

function companyFeed(collectionName) {
  const source = collection(db, collectionName);
  if (activeCompanyId) return query(source, where('companyId', '==', activeCompanyId));
  return isPlatformUser() ? source : null;
}

function subscribeAssignedFeeds(collectionName, kind, generation) {
  const source = collection(db, collectionName);
  const constraints = [
    ['assignedToUid', '=='],
    ['assignedRep', '=='],
    ['staffClaimedBy', '=='],
    ['assignedTo', 'array-contains'],
    ['assignedTeamIds', 'array-contains']
  ];

  constraints.forEach(([field, operator]) => {
    watchFeed(
      query(source, where(field, operator, activeUser.uid)),
      kind,
      `mine-${field}`,
      generation
    );
  });
}

function startRealtimeFeeds() {
  cleanupFeeds();
  feedGeneration += 1;
  const generation = feedGeneration;

  if (canViewCompanyMap()) {
    const leadsFeed = companyFeed('leads');
    const jobsFeed = companyFeed('jobs');
    if (leadsFeed) watchFeed(leadsFeed, 'lead', 'company', generation);
    if (jobsFeed) watchFeed(jobsFeed, 'job', 'company', generation);
  } else {
    subscribeAssignedFeeds('leads', 'lead', generation);
    subscribeAssignedFeeds('jobs', 'job', generation);
  }

  if (canViewTeamLocations()) {
    const workforceFeed = companyFeed('workforce_locations');
    if (workforceFeed) watchFeed(workforceFeed, 'staff', 'company', generation);
  }
}

function cleanupFeeds() {
  while (unsubscribers.length) {
    const unsubscribe = unsubscribers.pop();
    try { unsubscribe?.(); } catch (error) { console.debug(error); }
  }
  feedPartitions.clear();
  records.clear();
  markers.forEach((marker) => marker.remove());
  markers.clear();
}

function centerOnMe() {
  if (!map || !lastKnownPosition) {
    setStatus('Location is not available yet', 'Turn on live location, then use Center on me.');
    return;
  }
  map.flyTo([lastKnownPosition.lat, lastKnownPosition.lng], Math.max(map.getZoom(), 15), { duration: .7 });
}

function fitVisiblePins() {
  if (!map || !window.L) return;
  const points = visibleRecords().map((record) => [record.position.lat, record.position.lng]);
  if (lastKnownPosition) points.unshift([lastKnownPosition.lat, lastKnownPosition.lng]);
  if (!points.length) {
    setStatus('No visible pins to fit', 'Change the search or radius filters and try again.');
    return;
  }
  if (points.length === 1) {
    map.flyTo(points[0], 15, { duration: .7 });
    return;
  }
  map.fitBounds(window.L.latLngBounds(points), { padding: [48, 48], maxZoom: 16, animate: true });
}

function bindEvents() {
  locationToggle?.addEventListener('click', () => {
    if (locationWatchId === null) startLocationTracking({ requestedByUser: true });
    else stopLocationTracking({ persist: true, keepLocalMarker: true });
  });
  centerOnMeButton?.addEventListener('click', centerOnMe);
  fitPinsButton?.addEventListener('click', fitVisiblePins);
  refreshButton?.addEventListener('click', () => {
    startRealtimeFeeds();
    setStatus('Refreshing live data…', 'Reconnecting to your permitted company feeds.');
  });
  searchInput?.addEventListener('input', render);
  typeFilter?.addEventListener('change', render);
  radiusFilter?.addEventListener('change', render);
  selectedDirections?.addEventListener('click', openDirections);
  selectedClose?.addEventListener('click', clearSelectedRecord);
  nearbyListEl?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-record-key]');
    if (!button) return;
    selectRecord(button.getAttribute('data-record-key'), { openPopup: true, pan: true });
  });
  window.addEventListener('resize', () => map?.invalidateSize());
  setLocationControls(false);
}

function cleanup({ persistTrackingState = false } = {}) {
  cleanupFeeds();
  if (locationWatchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(locationWatchId);
  locationWatchId = null;
  if (persistTrackingState) markTrackingStopped();
}

function init() {
  bindEvents();

  onAuthStateChanged(auth, async (user) => {
    cleanup();

    if (!user) {
      window.location.assign('/login.html');
      return;
    }

    activeUser = user;
    activeProfile = getSavedUserProfile() || {};
    activeRole = normalizeRole(activeProfile.role || getSavedUserRole());
    activeCompanyId = cleanText(activeProfile.companyId);

    if (!DISPATCH_ROLES.has(activeRole)) {
      setLocationControls(false);
      setStatus('Live map access unavailable', 'This account does not have a field, sales, dispatch, or operations role.');
      return;
    }

    if (!map) {
      try {
        initMap();
      } catch (error) {
        console.error(error);
        setStatus('Map failed to load', error?.message || 'Reload the page and try again.');
        return;
      }
    }

    setLocationControls(false);
    startRealtimeFeeds();
    setStatus('Live map ready', 'Turn on live location to sort nearby pins and calculate distance.');
    await restoreGrantedLocationPermission();
  });
}

window.addEventListener('pagehide', () => cleanup({ persistTrackingState: false }));
window.addEventListener('beforeunload', () => cleanup({ persistTrackingState: false }));

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') map?.invalidateSize();
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
