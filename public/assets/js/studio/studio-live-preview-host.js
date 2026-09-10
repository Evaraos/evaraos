import {
  HOME_DRAFT_PAGE_ID,
  HOME_DRAFT_PREVIEW_MARKER_KEY,
  HOME_DRAFT_SCHEMA_VERSION,
  HOME_DRAFT_SOURCE_FINGERPRINT,
  HOME_TEXT_DRAFT_SLOT_IDS,
  HOME_TEXT_DRAFT_SLOTS,
  isVerifiedStudioHomeDraftSession,
  normalizeHomeDraftText
} from './studio-home-draft-contract.js';
import { deleteHomeDraft, loadHomeDraft, saveHomeDraft } from './studio-home-draft-store.js';

const PROTOCOL = 'evara:studio-preview:';
const PROTOCOL_VERSION = 1;
const ORIGIN = window.location.origin;
const HOME_ROUTE = '/index.html';
const EDIT_SLOT_CONFIG = HOME_TEXT_DRAFT_SLOTS;
const EDIT_SLOT_IDS = new Set(HOME_TEXT_DRAFT_SLOT_IDS);

let scheduled = false;

function createNonce() {
  const bytes = new Uint8Array(24);
  window.crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function previewMessage(type, nonce, extra = {}) {
  return { type: `${PROTOCOL}${type}`, protocolVersion: PROTOCOL_VERSION, nonce, ...extra };
}

function normalizeSlotText(editId, value) {
  return normalizeHomeDraftText(editId, value) || '';
}

function draftPayload(drafts) {
  const payload = {};
  for (const editId of HOME_TEXT_DRAFT_SLOT_IDS) {
    const draft = drafts.get(editId);
    if (!draft) continue;
    payload[editId] = { ...draft, value: normalizeSlotText(editId, draft.value) };
  }
  return payload;
}

function isExpectedMessage(event, iframe, nonce, type) {
  if (event.origin !== ORIGIN || event.source !== iframe.contentWindow) return false;
  const data = event.data;
  return Boolean(data && typeof data === 'object' && !Array.isArray(data)
    && data.type === `${PROTOCOL}${type}`
    && data.protocolVersion === PROTOCOL_VERSION
    && data.nonce === nonce);
}

function syncViewport(host) {
  const stage = host.closest('.studio-stage');
  const viewport = host.querySelector('[data-studio-live-preview-viewport]');
  if (!stage || !viewport) return;
  viewport.dataset.device = stage.dataset.device || 'desktop';
}

function currentEligibleSession() {
  return isVerifiedStudioHomeDraftSession(window.EvaraRouteSession) ? window.EvaraRouteSession : null;
}

function setPreviewMarker(record) {
  try {
    sessionStorage.setItem(HOME_DRAFT_PREVIEW_MARKER_KEY, JSON.stringify({
      schemaVersion: HOME_DRAFT_SCHEMA_VERSION,
      sourceFingerprint: HOME_DRAFT_SOURCE_FINGERPRINT,
      ownerUid: record.ownerUid,
      pageId: HOME_DRAFT_PAGE_ID,
      draftId: record.draftId
    }));
    return true;
  } catch {
    return false;
  }
}

function clearPreviewMarker(ownerUid = '') {
  try {
    const marker = JSON.parse(sessionStorage.getItem(HOME_DRAFT_PREVIEW_MARKER_KEY) || 'null');
    if (!ownerUid || marker?.ownerUid === ownerUid) sessionStorage.removeItem(HOME_DRAFT_PREVIEW_MARKER_KEY);
  } catch {
    sessionStorage.removeItem(HOME_DRAFT_PREVIEW_MARKER_KEY);
  }
}

function populateDrafts(drafts, record) {
  drafts.clear();
  for (const editId of HOME_TEXT_DRAFT_SLOT_IDS) {
    const slot = record?.slots?.[editId];
    if (slot) drafts.set(editId, { value: slot.value, dirty: false, committedInSession: true });
  }
}

function mountLiveHome(stage) {
  if (stage.querySelector('[data-studio-live-preview-host]')) {
    syncViewport(stage.querySelector('[data-studio-live-preview-host]'));
    return;
  }

  let nonce;
  try {
    nonce = createNonce();
  } catch (error) {
    console.error('Studio live preview nonce unavailable:', error);
    return;
  }

  const host = document.createElement('section');
  host.className = 'studio-live-preview-host';
  host.dataset.studioLivePreviewHost = 'home';
  host.dataset.selectionState = 'waiting';
  const drafts = new Map();
  const editSessions = new Map();
  let activeEditId = null;
  let durableRecord = null;
  let initializedUid = '';
  let saveQueue = Promise.resolve();
  let saveToken = 0;
  let discarding = false;

  const status = document.createElement('p');
  status.className = 'studio-live-preview-status';
  status.setAttribute('aria-live', 'polite');
  status.textContent = 'Live Home · establishing protected preview';

  const discard = document.createElement('button');
  discard.type = 'button';
  discard.className = 'studio-dock-button';
  discard.textContent = 'Discard local draft';
  discard.hidden = true;

  const viewport = document.createElement('div');
  viewport.className = 'studio-live-preview-viewport';
  viewport.dataset.studioLivePreviewViewport = 'true';

  const iframe = document.createElement('iframe');
  iframe.className = 'studio-live-preview-frame';
  iframe.title = 'Live EvaraOS Home preview';
  iframe.setAttribute('data-studio-live-preview-frame', 'home');
  iframe.src = `${HOME_ROUTE}?studioPreview=edit&studioNonce=${encodeURIComponent(nonce)}`;
  viewport.append(iframe);
  host.append(status, discard, viewport);
  stage.append(host);
  stage.classList.add('has-studio-live-preview');
  syncViewport(host);

  const activateIframe = () => {
    iframe.contentWindow?.postMessage(previewMessage('activate', nonce, { drafts: draftPayload(drafts) }), ORIGIN);
  };
  const updateDiscard = () => { discard.hidden = !durableRecord; };
  const restoreDurableDraft = async () => {
    const session = currentEligibleSession();
    if (!session || session.userId === initializedUid) return;
    initializedUid = session.userId;
    try {
      const record = await loadHomeDraft(session.userId);
      if (session.userId !== currentEligibleSession()?.userId) return;
      durableRecord = record;
      populateDrafts(drafts, record);
      updateDiscard();
      activateIframe();
      if (record) {
        if (setPreviewMarker(record)) status.textContent = 'Local Home draft restored';
        else status.textContent = 'Local Home draft restored · Home preview unavailable in this tab';
      }
    } catch {
      durableRecord = null;
      updateDiscard();
      status.textContent = 'Storage unavailable · session draft only';
    }
  };

  const persistCommittedDraft = () => {
    const session = currentEligibleSession();
    if (!session || discarding) {
      status.textContent = 'Live Home · session draft only';
      return;
    }
    const token = ++saveToken;
    const ownerUid = session.userId;
    const snapshot = draftPayload(drafts);
    saveQueue = saveQueue.catch(() => {}).then(async () => {
      if (token !== saveToken || currentEligibleSession()?.userId !== ownerUid) return;
      const record = await saveHomeDraft(ownerUid, snapshot);
      if (token !== saveToken || currentEligibleSession()?.userId !== ownerUid) return;
      durableRecord = record;
      updateDiscard();
      status.textContent = setPreviewMarker(record)
        ? 'Saved locally'
        : 'Saved locally · Home preview unavailable in this tab';
    }).catch(() => {
      if (token === saveToken) status.textContent = 'Storage unavailable · session draft only';
    });
  };

  discard.addEventListener('click', async () => {
    const session = currentEligibleSession();
    if (!session || discarding) return;
    discarding = true;
    discard.disabled = true;
    const pendingSaves = saveQueue.catch(() => {});
    saveToken += 1;
    try {
      await pendingSaves;
      await deleteHomeDraft(session.userId);
      if (currentEligibleSession()?.userId !== session.userId) return;
      clearPreviewMarker(session.userId);
      drafts.clear();
      editSessions.clear();
      activeEditId = null;
      durableRecord = null;
      updateDiscard();
      status.textContent = 'Local draft discarded';
      iframe.src = `${HOME_ROUTE}?studioPreview=edit&studioNonce=${encodeURIComponent(nonce)}`;
    } catch {
      status.textContent = 'Unable to discard local draft';
    } finally {
      discarding = false;
      discard.disabled = false;
    }
  });

  window.addEventListener('evara:session-ready', restoreDurableDraft);
  restoreDurableDraft();

  window.addEventListener('message', (event) => {
    if (isExpectedMessage(event, iframe, nonce, 'ready')) {
      editSessions.clear();
      activeEditId = null;
      activateIframe();
      host.dataset.selectionState = 'ready';
      if (!durableRecord) status.textContent = 'Live Home · select approved content';
      return;
    }

    if (isExpectedMessage(event, iframe, nonce, 'selection')) {
      const id = String(event.data.editId || '');
      if (!EDIT_SLOT_IDS.has(id)) return;
      host.dataset.selectionState = 'selected';
      host.dataset.selectedEditId = id;
      status.textContent = `Live Home · selected ${id}`;
      return;
    }

    const editMessageTypes = ['edit-started', 'edit-draft', 'edit-commit', 'edit-cancel'];
    for (const type of editMessageTypes) {
      if (!isExpectedMessage(event, iframe, nonce, type)) continue;
      const editId = String(event.data.elementId || '');
      const slot = EDIT_SLOT_CONFIG[editId];
      if (!slot) return;

      if (type === 'edit-started') {
        if (activeEditId && activeEditId !== editId) return;
        if (editSessions.has(editId)) return;
        const priorDraft = drafts.get(editId);
        editSessions.set(editId, priorDraft ? { ...priorDraft } : null);
        if (!priorDraft) drafts.set(editId, {
          value: normalizeSlotText(editId, event.data.value), dirty: false, committedInSession: false
        });
        activeEditId = editId;
        host.dataset.selectionState = 'editing';
        status.textContent = `Live Home · editing ${editId}`;
        return;
      }

      if (activeEditId !== editId || !editSessions.has(editId)) return;

      if (type === 'edit-draft') {
        drafts.set(editId, {
          value: normalizeSlotText(editId, event.data.value), dirty: true, committedInSession: false
        });
        return;
      }

      if (type === 'edit-commit') {
        drafts.set(editId, {
          value: normalizeSlotText(editId, event.data.value), dirty: true, committedInSession: true
        });
        editSessions.delete(editId);
        activeEditId = null;
        host.dataset.selectionState = 'selected';
        persistCommittedDraft();
        return;
      }

      const priorDraft = editSessions.get(editId);
      if (priorDraft) drafts.set(editId, priorDraft);
      else drafts.delete(editId);
      editSessions.delete(editId);
      activeEditId = null;
      host.dataset.selectionState = 'selected';
      status.textContent = `Live Home · edit cancelled for ${editId}`;
      return;
    }
  });
}

function ensureLiveHome() {
  scheduled = false;
  const studio = document.querySelector('[data-visual-studio]');
  const stage = studio?.querySelector('.studio-stage');
  if (stage) mountLiveHome(stage);
}

function scheduleEnsureLiveHome() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(ensureLiveHome);
}

new MutationObserver(scheduleEnsureLiveHome).observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['data-device']
});

scheduleEnsureLiveHome();
