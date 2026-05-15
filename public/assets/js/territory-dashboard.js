import {
  auth,
  onAuthStateChanged,
  getSavedUserProfile
} from './firebase.js';

import {
  buildRegionConfig,
  buildTerritoryConfig,
  saveRegion,
  saveTerritory,
  listRegions,
  listTerritories
} from './territory-engine.js';

const regionForm = document.getElementById('regionForm');
const territoryForm = document.getElementById('territoryForm');
const regionsRoot = document.getElementById('regionsRoot');
const territoriesRoot = document.getElementById('territoriesRoot');
const statusNode = document.getElementById('territoryStatus');
const regionSelect = document.getElementById('territoryRegionId');

let regions = [];
let territories = [];

function clean(value = '') {
  return String(value || '').replace(/[<>]/g, '');
}

function status(message = '') {
  if (statusNode) statusNode.textContent = message;
}

function isTerritoryAdmin() {
  const profile = getSavedUserProfile() || {};
  const role = String(profile.role || '').toLowerCase();
  return ['owner', 'super_admin', 'admin', 'manager', 'operations_manager', 'dispatcher'].includes(role);
}

function renderRegionOptions() {
  if (!regionSelect) return;

  if (!regions.length) {
    regionSelect.innerHTML = '<option value="unassigned-region">Unassigned Region</option>';
    return;
  }

  regionSelect.innerHTML = regions.map((region) => {
    return '<option value="' + clean(region.regionId || region.id) + '">' + clean(region.regionName || region.name || region.id) + '</option>';
  }).join('');
}

function renderRegions() {
  if (!regionsRoot) return;

  if (!regions.length) {
    regionsRoot.innerHTML = '<div class="item muted">No regions yet. Create your first region to organize territories.</div>';
    return;
  }

  regionsRoot.innerHTML = regions.map((region) => {
    return '<article class="item"><h3>' + clean(region.regionName || region.name || region.id) + '</h3><p class="muted">' + clean(region.state || 'No state assigned') + '</p><div class="row"><span class="pill">' + clean(region.status || 'active') + '</span><span class="pill">' + clean(region.companyId || 'platform') + '</span></div></article>';
  }).join('');
}

function renderTerritories() {
  if (!territoriesRoot) return;

  if (!territories.length) {
    territoriesRoot.innerHTML = '<div class="item muted">No territories yet. Add a territory to activate market ownership.</div>';
    return;
  }

  territoriesRoot.innerHTML = territories.map((territory) => {
    return '<article class="item"><h3>' + clean(territory.territoryName || territory.name || territory.id) + '</h3><p class="muted">' + clean(territory.city || territory.market || 'Market not assigned') + '</p><p class="muted">Region: ' + clean(territory.regionId || 'unassigned-region') + '</p><div class="row"><span class="pill">' + clean(territory.status || 'active') + '</span><span class="pill">' + clean(territory.boundaryType || 'market') + '</span></div></article>';
  }).join('');
}

async function refreshTerritoryData() {
  status('Loading regions and territories...');
  regions = await listRegions();
  territories = await listTerritories();
  renderRegionOptions();
  renderRegions();
  renderTerritories();
  status('Territory layer ready.');
}

function formValue(form, name, fallback = '') {
  return String(form?.elements?.[name]?.value || fallback).trim();
}

async function handleRegionSave(event) {
  event.preventDefault();

  const payload = buildRegionConfig({}, {
    name: formValue(regionForm, 'name'),
    state: formValue(regionForm, 'state'),
    companyId: formValue(regionForm, 'companyId'),
    ownerUid: formValue(regionForm, 'ownerUid'),
    operatorUid: formValue(regionForm, 'operatorUid'),
    notes: formValue(regionForm, 'notes')
  });

  await saveRegion(payload.regionId, payload);
  regionForm.reset();
  await refreshTerritoryData();
  status('Region saved.');
}

async function handleTerritorySave(event) {
  event.preventDefault();

  const payload = buildTerritoryConfig({}, {
    name: formValue(territoryForm, 'name'),
    regionId: formValue(territoryForm, 'regionId', 'unassigned-region'),
    market: formValue(territoryForm, 'market'),
    city: formValue(territoryForm, 'city'),
    state: formValue(territoryForm, 'state'),
    companyId: formValue(territoryForm, 'companyId'),
    operatorUid: formValue(territoryForm, 'operatorUid'),
    dispatcherUid: formValue(territoryForm, 'dispatcherUid'),
    boundaryType: formValue(territoryForm, 'boundaryType', 'market'),
    boundaryRef: formValue(territoryForm, 'boundaryRef'),
    notes: formValue(territoryForm, 'notes')
  });

  await saveTerritory(payload.territoryId, payload);
  territoryForm.reset();
  await refreshTerritoryData();
  status('Territory saved.');
}

function bindEvents() {
  regionForm?.addEventListener('submit', async (event) => {
    try {
      status('Saving region...');
      await handleRegionSave(event);
    } catch (error) {
      console.error(error);
      status(error.message || 'Region save failed.');
    }
  });

  territoryForm?.addEventListener('submit', async (event) => {
    try {
      status('Saving territory...');
      await handleTerritorySave(event);
    } catch (error) {
      console.error(error);
      status(error.message || 'Territory save failed.');
    }
  });
}

function init() {
  bindEvents();

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.assign('/login.html');
      return;
    }

    if (!isTerritoryAdmin()) {
      status('Territory access requires admin or dispatch permissions.');
      if (regionsRoot) regionsRoot.innerHTML = '<div class="item muted">You do not have access to territory management.</div>';
      if (territoriesRoot) territoriesRoot.innerHTML = '<div class="item muted">You do not have access to territory management.</div>';
      return;
    }

    try {
      await refreshTerritoryData();
    } catch (error) {
      console.error(error);
      status('Territory dashboard failed to load.');
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
