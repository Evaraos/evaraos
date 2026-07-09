import { normalizeAccessRole } from '../access-control.js';

const PREVIEW_KEY = 'evaraos-preview-role';
const CONTROLLERS = new Set(['platform_admin', 'owner', 'admin']);
const PREVIEW_ROLES = Object.freeze([
  'owner',
  'admin',
  'manager',
  'sales',
  'technician',
  'cleaner',
  'customer',
  'vendor'
]);

function storedProfile() {
  try {
    const raw = localStorage.getItem('evaraos-user') || sessionStorage.getItem('evaraos-user') || '{}';
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function actualRole() {
  return normalizeAccessRole(storedProfile().role || 'customer');
}

function canControlPreview() {
  return CONTROLLERS.has(actualRole());
}

function label(role) {
  return role ? role.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') : 'Live';
}

function current() {
  if (!canControlPreview()) return '';
  const role = normalizeAccessRole(localStorage.getItem(PREVIEW_KEY) || '');
  return PREVIEW_ROLES.includes(role) ? role : '';
}

function clearUnauthorizedPreview() {
  if (!canControlPreview()) localStorage.removeItem(PREVIEW_KEY);
}

function ensure() {
  clearUnauthorizedPreview();
  if (!canControlPreview()) return;

  if (!document.getElementById('rolePreviewStyle')) {
    const style = document.createElement('style');
    style.id = 'rolePreviewStyle';
    style.textContent = '.role-preview-bar{display:none!important}.role-preview-chip{position:fixed;right:12px;top:calc(82px + env(safe-area-inset-top,0px));z-index:9997;display:none;align-items:center;gap:8px;padding:7px 9px;border-radius:999px;background:linear-gradient(145deg,rgba(242,23,45,.24),rgba(18,19,30,.50));border:1px solid rgba(255,255,255,.28);color:#fff;font-weight:950;font-size:.72rem;letter-spacing:.02em;box-shadow:0 12px 34px rgba(0,0,0,.22);backdrop-filter:blur(18px) saturate(1.2);-webkit-backdrop-filter:blur(18px) saturate(1.2)}.role-preview-chip.is-visible{display:flex}.role-preview-chip button{height:24px;border:1px solid rgba(255,255,255,.24);border-radius:999px;background:rgba(255,255,255,.12);color:#fff;font-size:.68rem;font-weight:900;padding:0 8px}';
    document.head.appendChild(style);
  }

  if (!document.querySelector('.role-preview-bar')) {
    const bar = document.createElement('div');
    bar.className = 'role-preview-bar';
    bar.innerHTML = `<strong>Preview</strong><select data-role-preview>${PREVIEW_ROLES.map((role) => `<option value="${role}">${label(role)}</option>`).join('')}</select><button type="button" data-clear-preview>Exit</button>`;
    document.body.appendChild(bar);
    bar.querySelector('[data-role-preview]')?.addEventListener('change', (event) => setPreview(event.target.value));
    bar.querySelector('[data-clear-preview]')?.addEventListener('click', clearPreview);
  }

  if (!document.querySelector('.role-preview-chip')) {
    const chip = document.createElement('div');
    chip.className = 'role-preview-chip';
    chip.innerHTML = '<span data-preview-label></span><button type="button" data-clear-preview-chip>Exit</button>';
    document.body.appendChild(chip);
    chip.querySelector('[data-clear-preview-chip]')?.addEventListener('click', clearPreview);
  }
}

function apply() {
  ensure();
  const role = current();
  document.documentElement.dataset.evaraPreviewRole = role;

  const select = document.querySelector('[data-role-preview]');
  if (select && role) select.value = role;

  const chip = document.querySelector('.role-preview-chip');
  const labelNode = document.querySelector('[data-preview-label]');
  if (labelNode) labelNode.textContent = role ? `${label(role)} Preview` : '';
  if (chip) chip.classList.toggle('is-visible', Boolean(role));

  window.dispatchEvent(new CustomEvent('evara:role-preview', {
    detail: { role, actualRole: actualRole(), presentationOnly: true }
  }));
}

export function setPreview(role) {
  if (!canControlPreview()) {
    clearUnauthorizedPreview();
    return false;
  }

  const normalized = normalizeAccessRole(role);
  if (!PREVIEW_ROLES.includes(normalized)) return false;
  localStorage.setItem(PREVIEW_KEY, normalized);
  apply();
  return true;
}

export function clearPreview() {
  localStorage.removeItem(PREVIEW_KEY);
  document.documentElement.removeAttribute('data-evara-preview-role');
  apply();
}

function bind() {
  ensure();
  apply();
  window.addEventListener('evara:studio-mode', apply);
  window.addEventListener('evara:session-ready', apply);
}

window.EvaraRolePreview = {
  set: setPreview,
  clear: clearPreview,
  apply,
  canControl: canControlPreview
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bind, { once: true });
} else {
  bind();
}
