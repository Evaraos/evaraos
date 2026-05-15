import { loadGoogleMaps } from './maps-loader.js';
import { listTerritories, listRegions } from './territory-engine.js';

function clean(value = '') {
  return String(value || '').trim();
}

function normalizeBoundaryType(value = '') {
  const type = clean(value).toLowerCase();
  if (['polygon', 'zip', 'city', 'market', 'custom'].includes(type)) return type;
  return 'market';
}

export function normalizeTerritoryForMap(territory = {}) {
  return {
    id: territory.id || territory.territoryId || '',
    territoryId: territory.territoryId || territory.id || '',
    name: territory.territoryName || territory.name || 'Untitled Territory',
    regionId: territory.regionId || 'unassigned-region',
    companyId: territory.companyId || '',
    market: territory.market || '',
    city: territory.city || '',
    state: territory.state || '',
    status: territory.status || 'active',
    operatorUid: territory.operatorUid || '',
    dispatcherUid: territory.dispatcherUid || '',
    boundaryType: normalizeBoundaryType(territory.boundaryType),
    boundaryRef: territory.boundaryRef || '',
    lat: Number(territory.lat || territory.latitude || 0),
    lng: Number(territory.lng || territory.longitude || 0)
  };
}

export function normalizeRegionForMap(region = {}) {
  return {
    id: region.id || region.regionId || '',
    regionId: region.regionId || region.id || '',
    name: region.regionName || region.name || 'Untitled Region',
    state: region.state || '',
    country: region.country || 'US',
    status: region.status || 'active',
    companyId: region.companyId || '',
    operatorUid: region.operatorUid || ''
  };
}

export async function loadTerritoryMapData() {
  const [regions, territories] = await Promise.all([
    listRegions(),
    listTerritories()
  ]);

  return {
    regions: regions.map(normalizeRegionForMap),
    territories: territories.map(normalizeTerritoryForMap)
  };
}

export async function createTerritoryMap(container, options = {}) {
  if (!container) throw new Error('Missing map container.');

  const maps = await loadGoogleMaps();
  const center = options.center || { lat: 30.3322, lng: -81.6557 };
  const zoom = Number(options.zoom || 10);

  return new maps.Map(container, {
    center,
    zoom,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true
  });
}

export function renderTerritoryMarkers(map, territories = []) {
  if (!window.google?.maps || !map) return [];

  return territories
    .filter((territory) => territory.lat && territory.lng)
    .map((territory) => {
      const marker = new window.google.maps.Marker({
        map,
        position: { lat: territory.lat, lng: territory.lng },
        title: territory.name
      });

      const info = new window.google.maps.InfoWindow({
        content: '<strong>' + territory.name + '</strong><br>' +
          'Market: ' + (territory.market || territory.city || 'Unassigned') + '<br>' +
          'Boundary: ' + territory.boundaryType
      });

      marker.addListener('click', () => info.open({ map, anchor: marker }));
      return marker;
    });
}

export function groupTerritoriesByRegion(territories = []) {
  return territories.reduce((groups, territory) => {
    const key = territory.regionId || 'unassigned-region';
    groups[key] = groups[key] || [];
    groups[key].push(territory);
    return groups;
  }, {});
}

window.EvaraTerritoryMapLayer = {
  normalizeTerritoryForMap,
  normalizeRegionForMap,
  loadTerritoryMapData,
  createTerritoryMap,
  renderTerritoryMarkers,
  groupTerritoriesByRegion
};
