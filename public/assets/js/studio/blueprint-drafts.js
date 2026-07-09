import { functions, httpsCallable, getSavedUserProfile } from '../firebase.js';
import { getBlueprint } from './blueprint-registry.js';

const DRAFT_CACHE_KEY = 'evaraos-blueprint-draft-cache-v2';
const COMPANY_SCOPE_KEY = 'evaraos-studio-company-id';

const saveDraftCall = httpsCallable(functions, 'saveBlueprintDraft');
const publishCall = httpsCallable(functions, 'publishBlueprint');
const rollbackCall = httpsCallable(functions, 'rollbackBlueprint');
const getStateCall = httpsCallable(functions, 'getBlueprintState');

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_CACHE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function writeCache(value) {
  try {
    localStorage.setItem(DRAFT_CACHE_KEY, JSON.stringify(value || {}));
  } catch {}
}

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function now() {
  return new Date().toISOString();
}

function companyScope(explicitCompanyId = '') {
  const profile = getSavedUserProfile?.() || {};
  return String(
    explicitCompanyId ||
    profile.companyId ||
    localStorage.getItem(COMPANY_SCOPE_KEY) ||
    ''
  ).trim();
}

function cacheDraft(blueprint) {
  const cache = readCache();
  cache[blueprint.id] = clone(blueprint);
  writeCache(cache);
  return cache[blueprint.id];
}

function event(name, detail = {}) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function statePayload(idOrRole, options = {}) {
  const base = getBlueprint(idOrRole);
  return {
    blueprintId: base.id,
    companyId: companyScope(options.companyId)
  };
}

function errorMessage(error) {
  return String(error?.message || error?.code || 'Blueprint request failed.');
}

export function setBlueprintCompanyScope(companyId = '') {
  const value = String(companyId || '').trim();
  if (value) localStorage.setItem(COMPANY_SCOPE_KEY, value);
  else localStorage.removeItem(COMPANY_SCOPE_KEY);
  return value;
}

export function getDraftBlueprint(idOrRole = 'customer') {
  const cache = readCache();
  const base = getBlueprint(idOrRole);
  return cache[base.id] || {
    ...clone(base),
    draftVersion: 0,
    draftStatus: 'local_only',
    syncStatus: 'not_synced',
    updatedAt: now()
  };
}

export async function saveDraftBlueprint(idOrRole, patch = {}, options = {}) {
  const current = getDraftBlueprint(idOrRole);
  const optimistic = cacheDraft({
    ...current,
    ...clone(patch),
    id: current.id,
    role: current.role,
    draftStatus: 'draft',
    syncStatus: 'syncing',
    updatedAt: now()
  });

  event('evara:blueprint-draft-saving', { blueprint: optimistic });

  try {
    const response = await saveDraftCall({
      ...statePayload(idOrRole, options),
      blueprint: optimistic
    });
    const state = response?.data?.state || {};
    const confirmed = cacheDraft({
      ...(state.draft || optimistic),
      draftVersion: Number(state.draftVersion || state.draft?.draftVersion || 0),
      draftStatus: state.draftStatus || 'draft',
      syncStatus: 'synced',
      serverConfirmedAt: now()
    });
    event('evara:blueprint-draft-saved', { blueprint: confirmed, state });
    return confirmed;
  } catch (error) {
    const failed = cacheDraft({
      ...optimistic,
      syncStatus: 'failed',
      syncError: errorMessage(error)
    });
    event('evara:blueprint-draft-error', { blueprint: failed, error });
    throw error;
  }
}

export async function publishBlueprint(idOrRole = 'customer', options = {}) {
  const response = await publishCall(statePayload(idOrRole, options));
  const state = response?.data?.state || {};
  if (!state.live) throw new Error('The trusted publishing service returned no live blueprint.');

  cacheDraft({
    ...(state.draft || state.live),
    draftVersion: Number(state.draftVersion || 0),
    liveVersion: Number(state.liveVersion || 0),
    draftStatus: state.draftStatus || 'published',
    syncStatus: 'synced',
    serverConfirmedAt: now()
  });

  event('evara:blueprint-published', { blueprint: state.live, state });
  return state.live;
}

export async function rollbackBlueprint(idOrRole = 'customer', options = {}) {
  const response = await rollbackCall(statePayload(idOrRole, options));
  const state = response?.data?.state || {};
  if (!state.live) throw new Error('The trusted rollback service returned no live blueprint.');

  cacheDraft({
    ...(state.draft || state.live),
    draftVersion: Number(state.draftVersion || 0),
    liveVersion: Number(state.liveVersion || 0),
    draftStatus: state.draftStatus || 'published',
    syncStatus: 'synced',
    serverConfirmedAt: now()
  });

  event('evara:blueprint-rollback', { blueprint: state.live, state });
  return state.live;
}

export async function syncBlueprintState(idOrRole = 'customer', options = {}) {
  const response = await getStateCall(statePayload(idOrRole, options));
  const state = response?.data?.state || {};

  if (state.draft) {
    cacheDraft({
      ...state.draft,
      draftVersion: Number(state.draftVersion || state.draft.draftVersion || 0),
      liveVersion: Number(state.liveVersion || 0),
      draftStatus: state.draftStatus || 'draft',
      syncStatus: 'synced',
      serverConfirmedAt: now()
    });
  }

  event('evara:blueprint-state-synced', { state });
  return state;
}

export async function getLiveBlueprint(idOrRole = 'customer', options = {}) {
  const state = await syncBlueprintState(idOrRole, options);
  return state.live || getBlueprint(idOrRole);
}

export async function blueprintDraftSummary(options = {}) {
  const response = await getStateCall({ companyId: companyScope(options.companyId) });
  const states = Array.isArray(response?.data?.states) ? response.data.states : [];
  return states.map((state) => ({
    id: state.blueprintId,
    name: state.draft?.name || state.live?.name || `${state.blueprintId} Blueprint`,
    role: state.draft?.role || state.live?.role || state.blueprintId,
    draftVersion: Number(state.draftVersion || 0),
    liveVersion: Number(state.liveVersion || 0),
    status: state.draftStatus || 'none',
    updatedAtMs: state.updatedAtMs || null,
    publishedAtMs: state.publishedAtMs || null
  }));
}

window.EvaraBlueprintDrafts = {
  getDraft: getDraftBlueprint,
  saveDraft: saveDraftBlueprint,
  publish: publishBlueprint,
  rollback: rollbackBlueprint,
  getLive: getLiveBlueprint,
  sync: syncBlueprintState,
  summary: blueprintDraftSummary,
  setCompanyScope: setBlueprintCompanyScope,
  authority: 'trusted-server'
};
