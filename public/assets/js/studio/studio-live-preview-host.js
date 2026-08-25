const PROTOCOL = 'evara:studio-preview:';
const PROTOCOL_VERSION = 1;
const ORIGIN = window.location.origin;
const HOME_ROUTE = '/index.html';
const EDITABLE_IDS = new Set([
  'home.hero.kicker',
  'home.hero.title',
  'home.hero.subtitle',
  'home.platform.heading',
  'home.platform.copy'
]);

let scheduled = false;

function createNonce() {
  const bytes = new Uint8Array(24);
  window.crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function previewMessage(type, nonce, extra = {}) {
  return { type: `${PROTOCOL}${type}`, protocolVersion: PROTOCOL_VERSION, nonce, ...extra };
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
      iframe.contentWindow?.postMessage(previewMessage('activate', nonce), ORIGIN);
      host.dataset.selectionState = 'ready';
      status.textContent = 'Live Home · select approved content';
      return;
    }

    if (!isExpectedMessage(event, iframe, nonce, 'selection')) return;
    const id = String(event.data.editId || '');
    if (!EDITABLE_IDS.has(id)) return;
    host.dataset.selectionState = 'selected';
    host.dataset.selectedEditId = id;
    status.textContent = `Live Home · selected ${id}`;
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
