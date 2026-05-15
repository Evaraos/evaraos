import {
  auth,
  onAuthStateChanged,
  getSavedUserProfile
} from './firebase.js';

import {
  loadTerritoryMapData,
  createTerritoryMap,
  renderTerritoryMarkers,
  groupTerritoriesByRegion
} from './territory-map-layer.js';

const mapCanvas = document.getElementById('territoryMapCanvas');
const statusNode = document.getElementById('territoryMapStatus');
const feedRoot = document.getElementById('territoryMapFeed');
const territoryCountNode = document.getElementById('territoryMapCount');
const regionCountNode = document.getElementById('territoryRegionCount');

let activeMap = null;
let activeMarkers = [];

function clean(value = '') {
  return String(value || '').replace(/[<>]/g, '');
}

function status(message = '') {
  if (statusNode) statusNode.textContent = message;
}

function isMapAdmin() {
  const profile = getSavedUserProfile() || {};
  const role = String(profile.role || '').toLowerCase();

  return [
    'owner',
    'super_admin',
    'admin',
    'manager',
    'operations_manager',
    'dispatcher',
    'sales_manager'
  ].includes(role);
}

function renderFeed(territories = []) {
  if (!feedRoot) return;

  if (!territories.length) {
    feedRoot.innerHTML = '<div class="item muted">No mapped territories yet. Add territories with coordinates to activate overlays.</div>';
    return;
  }

  feedRoot.innerHTML = territories.map((territory) => {
    return '<article class="item"><h3>' + clean(territory.name) + '</h3><p class="muted">' + clean(territory.market || territory.city || 'No market assigned') + '</p><div class="row"><span class="pill">' + clean(territory.regionId || 'unassigned-region') + '</span><span class="pill">' + clean(territory.boundaryType || 'market') + '</span></div></article>';
  }).join('');
}

function renderStats(regions = [], territories = []) {
  if (territoryCountNode) {
    territoryCountNode.textContent = territories.length + ' Territories';
  }

  if (regionCountNode) {
    regionCountNode.textContent = regions.length + ' Regions';
  }
}

async function initializeMap(territories = []) {
  try {
    activeMap = await createTerritoryMap(mapCanvas, {
      center: { lat: 30.3322, lng: -81.6557 },
      zoom: 9
    });

    activeMarkers = renderTerritoryMarkers(activeMap, territories);

    status('Map layer active.');
  } catch (error) {
    console.error(error);
    status('Google Maps unavailable. Configure the Maps API key to activate overlays.');
  }
}

async function loadMapDashboard() {
  status('Loading map intelligence...');

  const data = await loadTerritoryMapData();
  const grouped = groupTerritoriesByRegion(data.territories);

  renderStats(data.regions, data.territories);
  renderFeed(data.territories);

  await initializeMap(data.territories);

  console.info('Territories grouped by region:', grouped);
}

function init() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.assign('/login.html');
      return;
    }

    if (!isMapAdmin()) {
      status('Map access requires operational permissions.');
      if (feedRoot) {
        feedRoot.innerHTML = '<div class="item muted">You do not have access to territory mapping.</div>';
      }
      return;
    }

    try {
      await loadMapDashboard();
    } catch (error) {
      console.error(error);
      status('Territory map failed to load.');
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
