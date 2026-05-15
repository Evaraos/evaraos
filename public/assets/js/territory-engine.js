import {
  db,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  serverTimestamp
} from './firebase.js';

function normalizeId(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

function cleanText(value = '') {
  return String(value || '').trim();
}

export function buildRegionConfig(region = {}, overrides = {}) {
  const name = cleanText(overrides.name || region.name || region.regionName || 'Untitled Region');
  const regionId = normalizeId(overrides.regionId || region.regionId || region.id || name);

  return {
    regionId,
    name,
    regionName: name,
    state: cleanText(overrides.state || region.state || ''),
    country: cleanText(overrides.country || region.country || 'US'),
    status: cleanText(overrides.status || region.status || 'active'),
    ownerUid: cleanText(overrides.ownerUid || region.ownerUid || ''),
    operatorUid: cleanText(overrides.operatorUid || region.operatorUid || ''),
    companyId: cleanText(overrides.companyId || region.companyId || ''),
    notes: cleanText(overrides.notes || region.notes || ''),
    updatedAt: serverTimestamp()
  };
}

export function buildTerritoryConfig(territory = {}, overrides = {}) {
  const name = cleanText(overrides.name || territory.name || territory.territoryName || 'Untitled Territory');
  const territoryId = normalizeId(overrides.territoryId || territory.territoryId || territory.id || name);
  const regionId = normalizeId(overrides.regionId || territory.regionId || 'unassigned-region');

  return {
    territoryId,
    name,
    territoryName: name,
    regionId,
    market: cleanText(overrides.market || territory.market || ''),
    city: cleanText(overrides.city || territory.city || ''),
    state: cleanText(overrides.state || territory.state || ''),
    status: cleanText(overrides.status || territory.status || 'active'),
    companyId: cleanText(overrides.companyId || territory.companyId || ''),
    ownerUid: cleanText(overrides.ownerUid || territory.ownerUid || ''),
    operatorUid: cleanText(overrides.operatorUid || territory.operatorUid || ''),
    dispatcherUid: cleanText(overrides.dispatcherUid || territory.dispatcherUid || ''),
    salesManagerUid: cleanText(overrides.salesManagerUid || territory.salesManagerUid || ''),
    serviceManagerUid: cleanText(overrides.serviceManagerUid || territory.serviceManagerUid || ''),
    boundaryType: cleanText(overrides.boundaryType || territory.boundaryType || 'market'),
    boundaryRef: cleanText(overrides.boundaryRef || territory.boundaryRef || ''),
    notes: cleanText(overrides.notes || territory.notes || ''),
    updatedAt: serverTimestamp()
  };
}

export async function saveRegion(regionId, config = {}) {
  const payload = buildRegionConfig({ regionId }, config);
  if (!payload.regionId) throw new Error('Missing regionId.');

  await setDoc(doc(db, 'regions', payload.regionId), {
    ...payload,
    updatedAt: serverTimestamp()
  }, { merge: true });

  return payload;
}

export async function saveTerritory(territoryId, config = {}) {
  const payload = buildTerritoryConfig({ territoryId }, config);
  if (!payload.territoryId) throw new Error('Missing territoryId.');

  await setDoc(doc(db, 'territories', payload.territoryId), {
    ...payload,
    updatedAt: serverTimestamp()
  }, { merge: true });

  return payload;
}

export async function getRegion(regionId) {
  if (!regionId) return null;
  const snap = await getDoc(doc(db, 'regions', regionId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getTerritory(territoryId) {
  if (!territoryId) return null;
  const snap = await getDoc(doc(db, 'territories', territoryId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function listRegions() {
  const snap = await getDocs(collection(db, 'regions'));
  return snap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
}

export async function listTerritories() {
  const snap = await getDocs(collection(db, 'territories'));
  return snap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
}

export function territoryMatchesCompany(territory = {}, companyId = '') {
  if (!companyId) return true;
  return !territory.companyId || territory.companyId === companyId;
}

export function territoryMatchesRegion(territory = {}, regionId = '') {
  if (!regionId) return true;
  return territory.regionId === regionId;
}

window.EvaraTerritoryEngine = {
  buildRegionConfig,
  buildTerritoryConfig,
  saveRegion,
  saveTerritory,
  getRegion,
  getTerritory,
  listRegions,
  listTerritories,
  territoryMatchesCompany,
  territoryMatchesRegion
};
