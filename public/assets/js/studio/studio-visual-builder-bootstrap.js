import { getSavedUserProfile, getSavedUserRole, normalizeRole } from '../firebase.js';

const ALLOWED_ROLES = new Set(['owner', 'admin']);
const STUDIO_BUILD = 'studio-owner-builder-v6';
let started = false;

function currentRole() {
  const profile = getSavedUserProfile?.() || {};
  return normalizeRole?.(profile.role || getSavedUserRole?.() || '') || '';
}

function sessionSettled() {
  return !document.documentElement.classList.contains('auth-pending')
    && !document.body?.classList.contains('auth-pending');
}

function renderRestricted() {
  const root = document.getElementById('appRoot');
  if (!root) return;
  const main = document.createElement('main');
  main.style.cssText = 'padding:140px 24px;text-align:center;color:var(--text-primary,#fff)';
  const title = document.createElement('h1');
  title.textContent = 'Studio access restricted';
  const copy = document.createElement('p');
  copy.textContent = 'Only authorized owners and administrators can open Evara Studio.';
  main.append(title, copy);
  root.replaceChildren(main);
}

async function start() {
  if (started || !sessionSettled()) return;
  const role = currentRole();
  if (!ALLOWED_ROLES.has(role)) {
    started = true;
    renderRestricted();
    return;
  }
  started = true;
  try {
    document.documentElement.dataset.studioBuild = STUDIO_BUILD;
    await import('./studio-visual-builder.js?v=4-boundary-accessibility');
  } catch (error) {
    started = false;
    console.error('Evara Studio failed to load:', error);
    const root = document.getElementById('appRoot');
    if (root) root.textContent = 'Evara Studio could not load. Refresh the page and try again.';
  }
}

window.addEventListener('evara:session-ready', start);
window.addEventListener('pageshow', start);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(start, 120), { once: true });
} else {
  setTimeout(start, 120);
}
