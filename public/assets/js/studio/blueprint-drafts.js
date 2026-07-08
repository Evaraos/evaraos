import { getBlueprint } from './blueprint-registry.js';

const DRAFT_KEY = 'evaraos-blueprint-drafts-v1';
const LIVE_KEY = 'evaraos-blueprint-live-v1';
const HISTORY_KEY = 'evaraos-blueprint-history-v1';

function read(key) { try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { return {}; } }
function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
function clone(value) { return JSON.parse(JSON.stringify(value || {})); }
function now() { return new Date().toISOString(); }

export function getDraftBlueprint(idOrRole = 'customer') {
  const drafts = read(DRAFT_KEY);
  const base = getBlueprint(idOrRole);
  return drafts[base.id] || { ...clone(base), draftVersion: 1, draftStatus: 'draft', updatedAt: now() };
}

export function saveDraftBlueprint(idOrRole, patch = {}) {
  const drafts = read(DRAFT_KEY);
  const current = getDraftBlueprint(idOrRole);
  const next = { ...current, ...clone(patch), draftStatus: 'draft', updatedAt: now(), draftVersion: Number(current.draftVersion || 1) + 1 };
  drafts[current.id] = next;
  write(DRAFT_KEY, drafts);
  window.dispatchEvent(new CustomEvent('evara:blueprint-draft-saved', { detail: { blueprint: next } }));
  return next;
}

export function publishBlueprint(idOrRole = 'customer') {
  const live = read(LIVE_KEY);
  const history = read(HISTORY_KEY);
  const draft = getDraftBlueprint(idOrRole);
  const previous = live[draft.id];
  if (previous) {
    history[draft.id] = Array.isArray(history[draft.id]) ? history[draft.id] : [];
    history[draft.id].unshift({ ...previous, archivedAt: now() });
    history[draft.id] = history[draft.id].slice(0, 10);
  }
  const published = { ...clone(draft), draftStatus: 'published', publishedAt: now(), liveVersion: Number(previous?.liveVersion || 0) + 1 };
  live[draft.id] = published;
  write(LIVE_KEY, live);
  write(HISTORY_KEY, history);
  window.dispatchEvent(new CustomEvent('evara:blueprint-published', { detail: { blueprint: published } }));
  return published;
}

export function rollbackBlueprint(idOrRole = 'customer') {
  const base = getBlueprint(idOrRole);
  const live = read(LIVE_KEY);
  const history = read(HISTORY_KEY);
  const previous = Array.isArray(history[base.id]) ? history[base.id].shift() : null;
  if (!previous) return null;
  live[base.id] = { ...previous, rollbackAt: now() };
  write(LIVE_KEY, live);
  write(HISTORY_KEY, history);
  window.dispatchEvent(new CustomEvent('evara:blueprint-rollback', { detail: { blueprint: live[base.id] } }));
  return live[base.id];
}

export function getLiveBlueprint(idOrRole = 'customer') {
  const base = getBlueprint(idOrRole);
  return read(LIVE_KEY)[base.id] || base;
}

export function blueprintDraftSummary() {
  const drafts = read(DRAFT_KEY);
  const live = read(LIVE_KEY);
  return Object.values(drafts).map((draft) => ({
    id: draft.id,
    name: draft.name,
    role: draft.role,
    draftVersion: draft.draftVersion || 1,
    liveVersion: live[draft.id]?.liveVersion || 0,
    status: draft.draftStatus || 'draft',
    updatedAt: draft.updatedAt
  }));
}

window.EvaraBlueprintDrafts = { getDraft: getDraftBlueprint, saveDraft: saveDraftBlueprint, publish: publishBlueprint, rollback: rollbackBlueprint, getLive: getLiveBlueprint, summary: blueprintDraftSummary };
