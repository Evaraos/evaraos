const PROTOCOL = 'evara:studio-preview:';
const PROTOCOL_VERSION = 1;
const ORIGIN = window.location.origin;
const EDITABLE = new Set([
  'home.hero.kicker',
  'home.hero.title',
  'home.hero.subtitle',
  'home.platform.heading',
  'home.platform.copy'
]);

const params = new URLSearchParams(window.location.search);
const nonce = params.get('studioNonce') || '';
const requestedPreview = params.get('studioPreview') === 'edit';
const validNonce = /^[A-Za-z0-9_-]{32,128}$/.test(nonce);

function hasAuthorizedParent() {
  if (!requestedPreview || !validNonce || window.parent === window) return false;
  try {
    return window.parent.location.origin === ORIGIN
      && window.parent.location.pathname === '/website-builder.html';
  } catch {
    return false;
  }
}

function message(type, extra = {}) {
  return { type: `${PROTOCOL}${type}`, protocolVersion: PROTOCOL_VERSION, nonce, ...extra };
}

function editableTarget(target) {
  if (!(target instanceof Element)) return null;
  const element = target.closest('[data-evara-page="home"][data-evara-editable="text"][data-evara-region="content"][data-evara-edit-id]');
  if (!element || !EDITABLE.has(element.dataset.evaraEditId || '')) return null;
  return element;
}

function isProtectedAction(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('a, button, input, select, textarea, form, [role="button"], #universalNavRoot, .eva-bottom-nav, [data-eva-shell-motion]'));
}

function createSelectionOverlay() {
  const outline = document.createElement('div');
  outline.className = 'evara-studio-preview-outline';
  outline.hidden = true;
  outline.setAttribute('aria-hidden', 'true');
  const label = document.createElement('div');
  label.className = 'evara-studio-preview-label';
  label.hidden = true;
  label.setAttribute('aria-hidden', 'true');
  document.body.append(outline, label);
  return { outline, label };
}

function activatePreview() {
  let selected = null;
  const overlay = createSelectionOverlay();

  const positionOverlay = () => {
    if (!selected) return;
    const rect = selected.getBoundingClientRect();
    overlay.outline.style.left = `${rect.left}px`;
    overlay.outline.style.top = `${rect.top}px`;
    overlay.outline.style.width = `${rect.width}px`;
    overlay.outline.style.height = `${rect.height}px`;
    overlay.label.style.left = `${rect.left}px`;
    overlay.label.style.top = `${Math.max(8, rect.top - 27)}px`;
  };

  const select = (element) => {
    selected = element;
    overlay.label.textContent = element.dataset.evaraEditId || '';
    overlay.outline.hidden = false;
    overlay.label.hidden = false;
    positionOverlay();
    window.parent.postMessage(message('selection', { editId: element.dataset.evaraEditId, editable: 'text' }), ORIGIN);
  };

  window.addEventListener('click', (event) => {
    const element = editableTarget(event.target);
    if (element) {
      event.preventDefault();
      event.stopImmediatePropagation();
      select(element);
      return;
    }
    if (isProtectedAction(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  window.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && isProtectedAction(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener('resize', positionOverlay);
  window.addEventListener('scroll', positionOverlay, true);
}

if (hasAuthorizedParent()) {
  const onMessage = (event) => {
    const data = event.data;
    if (event.origin !== ORIGIN || event.source !== window.parent || !data || typeof data !== 'object') return;
    if (data.type !== `${PROTOCOL}activate` || data.protocolVersion !== PROTOCOL_VERSION || data.nonce !== nonce) return;
    window.removeEventListener('message', onMessage);
    activatePreview();
  };
  window.addEventListener('message', onMessage);
  window.parent.postMessage(message('ready', { page: 'home' }), ORIGIN);
}
