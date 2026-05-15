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

import {
  loadFieldOpsMapData,
  renderFieldOpsMarkers,
  groupFieldOpsByTerritory,
  groupFieldOpsByAssignee
} from './field-ops-map-layer.js';

const mapCanvas = document.getElementById('territoryMapCanvas');
const statusNode = document.getElementById('territoryMapStatus');
const feedRoot = document.getElementById('territoryMapFeed');
const territoryCountNode = document.getElementById('territoryMapCount');
const regionCountNode = document.getElementById('territoryRegionCount');

let activeMap = null;
let activeTerritoryMarkers = [];
let activeFieldOpsMarkers = [];

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

function renderFeed(territories = [], fieldOps = []) {
  if (!feedRoot) return;

  const territoryHtml = territories.length
    ? territories.map((territory) => '<article class="item"><h3>' + clean(territory.name) + '</h3><p class="muted">' + clean(territory.market || territory.city || 'No market assigned') + '</p><div class="row"><span class="pill">Territory</span><span class="pill">' + clean(territory.boundaryType || 'market') + '</span></div></article>').join('')
    : '<div class="item muted">No mapped territories yet. Add territories with coordinates to activate territory overlays.</div>';

  const fieldOpsHtml = fieldOps.length
    ? fieldOps.slice(0, 12).map((record) => '<article class="item"><h3>' + clean(record.title) + '</h3><p class="muted">' + clean(record.type.toUpperCase()) + ' • ' + clean(record.status) + '</p><div class="row"><span class="pill">' + clean(record.territoryId || 'unassigned') + '</span><span class="pill">' + clean(record.assignedToName || 'Unassigned') + '</span></div></article>').join('')
    : '<div class="item muted">No mapped leads or jobs yet. Add coordinates to leads/jobs to activate operational overlays.</div>';

  feedRoot.innerHTML = territoryHtml + fieldOpsHtml;
}

function renderStats(regions = [], territories = [], fieldOps = []) {
  if (territoryCountNode) {
    territoryCountNode.textContent = territories.length + ' Territories';
  }

  if (regionCountNode) {
    regionCountNode.textContent = regions.length + ' Regions • ' + fieldOps.length + ' Ops Pins';
  }
}

function clearMarkers(markers = []) {
  markers.forEach((marker) => marker?.setMap?.(null));
}

async function initializeMap(territories = [], fieldOps = []) {
  try {
    activeMap = await createTerritoryMap(mapCanvas, {
      center: { lat: 30.3322, lng: -81.6557 },
      zoom: 9
    });

    clearMarkers(activeTerritoryMarkers);
    clearMarkers(activeFieldOpsMarkers);

    activeTerritoryMarkers = renderTerritoryMarkers(activeMap, territories);
    activeFieldOpsMarkers = renderFieldOpsMarkers(activeMap, fieldOps);

    status('Map layer active with territory and field operations overlays.');
  } catch (error) {
    console.error(error);
    status('Google Maps unavailable. Configure the Maps API key to activate overlays.');
  }
}

async function loadMapDashboard() {
  status('Loading map intelligence...');

  const [territoryData, fieldOpsData] = await Promise.all([
    loadTerritoryMapData(),
    loadFieldOpsMapData()
  ]);

  const territoriesByRegion = groupTerritoriesByRegion(territoryData.territories);
  const opsByTerritory = groupFieldOpsByTerritory(fieldOpsData.records);
  const opsByAssignee = groupFieldOpsByAssignee(fieldOpsData.records);

  renderStats(territoryData.regions, territoryData.territories, fieldOpsData.records);
  renderFeed(territoryData.territories, fieldOpsData.records);

  await initializeMap(territoryData.territories, fieldOpsData.records);

  console.info('Territories grouped by region:', territoriesByRegion);
  console.info('Field ops grouped by territory:', opsByTerritory);
  console.info('Field ops grouped by assignee:', opsByAssignee);
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
