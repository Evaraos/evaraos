const PROTOCOL = 'evara:studio-preview:';
const PROTOCOL_VERSION = 1;
const ORIGIN = window.location.origin;
const HOME_ROUTE = '/index.html';
const EDIT_SLOT_CONFIG = Object.freeze({
  'home.hero.kicker': Object.freeze({ maxLength: 180, experienceControlled: true, linePolicy: 'single' }),
  'home.hero.title': Object.freeze({ maxLength: 260, experienceControlled: true, linePolicy: 'single' }),
  'home.hero.subtitle': Object.freeze({ maxLength: 1200, experienceControlled: true, linePolicy: 'single' }),
  'home.platform.heading': Object.freeze({ maxLength: 180, experienceControlled: false, linePolicy: 'single' }),
  'home.platform.copy': Object.freeze({ maxLength: 1200, experienceControlled: false, linePolicy: 'single' })
});
const EDIT_SLOT_IDS = new Set(Object.keys(EDIT_SLOT_CONFIG));

let scheduled = false;

function createNonce() {
  const bytes = new Uint8Array(24);
  window.crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function previewMessage(type, nonce, extra = {}) {
  return { type: `${PROTOCOL}${type}`, protocolVersion: PROTOCOL_VERSION, nonce, ...extra };
}

function normalizeSlotText(value, slot) {
  const source = String(value ?? '');
  const normalized = slot.linePolicy === 'single'
    ? source
    .replace(/[\r\n\u2028\u2029]+/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    : source;
  return Array.from(normalized)
    .slice(0, slot.maxLength)
    .join('');
}

function draftPayload(drafts) {
  const payload = {};
  for (const [editId, slot] of Object.entries(EDIT_SLOT_CONFIG)) {
    const draft = drafts.get(editId);
    if (!draft) continue;
    payload[editId] = {
      ...draft,
      value: normalizeSlotText(draft.value, slot)
    };
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

  const status = document.createElement('p');
  status.className = 'studio-live-preview-status';
  status.textContent = 'Live Home · establishing protected preview';

  const viewport = document.createElement('div');
  viewport.className = 'studio-live-preview-viewport';
  viewport.dataset.studioLivePreviewViewport = 'true';

  const iframe = document.createElement('iframe');
  iframe.className = 'studio-live-preview-frame';
  iframe.title = 'Live EvaraOS Home preview';
  iframe.setAttribute('data-studio-live-preview-frame', 'home');
  iframe.src = `${HOME_ROUTE}?studioPreview=edit&studioNonce=${encodeURIComponent(nonce)}`;
  viewport.append(iframe);
  host.append(status, viewport);
  stage.append(host);
  stage.classList.add('has-studio-live-preview');
  syncViewport(host);

  window.addEventListener('message', (event) => {
    if (isExpectedMessage(event, iframe, nonce, 'ready')) {
      editSessions.clear();
      activeEditId = null;
      iframe.contentWindow?.postMessage(previewMessage('activate', nonce, {
        drafts: draftPayload(drafts)
      }), ORIGIN);
      host.dataset.selectionState = 'ready';
      status.textContent = 'Live Home · select approved content';
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
        if (!priorDraft) {
          drafts.set(editId, {
            value: normalizeSlotText(event.data.value, slot),
            dirty: false,
            committedInSession: false
          });
        }
        activeEditId = editId;
        host.dataset.selectionState = 'editing';
        status.textContent = `Live Home · editing ${editId}`;
        return;
      }

      if (activeEditId !== editId || !editSessions.has(editId)) return;

      if (type === 'edit-draft') {
        drafts.set(editId, {
          value: normalizeSlotText(event.data.value, slot),
          dirty: true,
          committedInSession: false
        });
        return;
      }

      if (type === 'edit-commit') {
        drafts.set(editId, {
          value: normalizeSlotText(event.data.value, slot),
          dirty: true,
          committedInSession: true
        });
        editSessions.delete(editId);
        activeEditId = null;
        host.dataset.selectionState = 'selected';
        status.textContent = `Live Home · session draft kept for ${editId}`;
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
