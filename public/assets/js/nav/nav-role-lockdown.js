import {
  CANONICAL_ROLES,
  canAccessPageName,
  defaultRouteForRole,
  normalizeAccessRole
} from '../access-control.js';

const PREVIEW_KEY = 'evaraos-preview-role';
const PREVIEW_CONTROLLERS = new Set(['platform_admin', 'owner', 'admin']);

function storedProfile() {
  try {
    const raw = localStorage.getItem('evaraos-user') || sessionStorage.getItem('evaraos-user') || '{}';
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function actualRole() {
  const profile = storedProfile();
  return normalizeAccessRole(
    profile.role ||
    localStorage.getItem('evaraos-role') ||
    sessionStorage.getItem('evaraos-role') ||
    'customer'
  );
}

function requestedPreviewRole() {
  const raw = String(localStorage.getItem(PREVIEW_KEY) || '').trim();
  if (!raw) return '';
  const normalized = normalizeAccessRole(raw);
  return CANONICAL_ROLES.includes(normalized) ? normalized : '';
}

function previewRole() {
  const actual = actualRole();
  if (!PREVIEW_CONTROLLERS.has(actual)) return '';
  return requestedPreviewRole();
}

function routeFromHref(href = '') {
  try {
    const url = new URL(href, location.origin);
    if (url.origin !== location.origin) return '';
    return url.pathname;
  } catch {
    return '';
  }
}

function allowed(path) {
  const actual = actualRole();
  const preview = previewRole();
  const actualAllowed = canAccessPageName(path, actual);
  const previewAllowed = !preview || canAccessPageName(path, preview);
  return actualAllowed && previewAllowed;
}

export function applyNavRoleLockdown() {
  const actual = actualRole();
  const preview = previewRole();
  const effective = preview || actual;

  document.documentElement.dataset.evaraosActualRole = actual;
  document.documentElement.dataset.evaraosEffectiveRole = effective;
  document.documentElement.dataset.evaraosPreviewRoleActive = preview ? 'true' : 'false';

  document.querySelectorAll('#evaLinks a[href], .eva-menu-panel a[href]').forEach((link) => {
    const path = routeFromHref(link.getAttribute('href'));
    if (!path || !allowed(path)) link.remove();
  });

  document.querySelectorAll('.eva-app-section').forEach((section) => {
    if (!section.querySelector('.eva-app-link')) section.remove();
  });
}

function schedule() {
  requestAnimationFrame(applyNavRoleLockdown);
  setTimeout(applyNavRoleLockdown, 250);
  setTimeout(applyNavRoleLockdown, 900);
}

window.addEventListener('evara:session-ready', schedule);
window.addEventListener('evara:role-preview', schedule);
window.addEventListener('pageshow', schedule);

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href]');
  if (!link) return;

  const path = routeFromHref(link.getAttribute('href'));
  if (!path || allowed(path)) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  location.assign(defaultRouteForRole(previewRole() || actualRole()));
}, true);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', schedule, { once: true });
} else {
  schedule();
}
