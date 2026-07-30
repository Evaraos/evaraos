import {
  canAccessPageName,
  defaultRouteForRole
} from '../access-control.js';
import { actualRole } from './nav-authority-v1.js';

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
  const role = actualRole();
  return Boolean(role && canAccessPageName(path, role));
}

export function applyNavRoleLockdown() {
  const role = actualRole();

  document.documentElement.dataset.evaraosActualRole = role || 'guest';
  document.documentElement.dataset.evaraosEffectiveRole = role || 'guest';
  document.documentElement.dataset.evaraosPreviewRoleActive = 'false';

  document.querySelectorAll('#evaLinks a[href], .eva-menu-panel a[href]').forEach((link) => {
    const path = routeFromHref(link.getAttribute('href'));
    if (!path) return;
    if (!allowed(path)) link.remove();
  });

  document.querySelectorAll('.eva-app-section').forEach((section) => {
    if (!section.querySelector('.eva-app-link')) section.remove();
  });
}

function schedule() {
  requestAnimationFrame(applyNavRoleLockdown);
  setTimeout(applyNavRoleLockdown, 250);
}

window.addEventListener('evara:session-ready', schedule);
window.addEventListener('pageshow', schedule);
window.addEventListener('storage', (event) => {
  if (['evaraos-user', 'evaraos-role'].includes(event.key)) schedule();
});

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href]');
  if (!link) return;

  const path = routeFromHref(link.getAttribute('href'));
  if (!path || allowed(path)) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  location.assign(defaultRouteForRole(actualRole()));
}, true);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', schedule, { once: true });
} else {
  schedule();
}
