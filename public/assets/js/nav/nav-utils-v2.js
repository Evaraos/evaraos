import {
  actualRole,
  displayProfile,
  isActuallyAuthenticated,
  navigationAuthoritySnapshot
} from './nav-authority-v1.js';

export function getMount() {
  return document.getElementById('universalNavRoot') || document.getElementById('universalNav');
}

export function getBasePath() {
  const path = window.location.pathname || '/';
  const segments = path.split('/').filter(Boolean);
  const last = segments[segments.length - 1] || '';
  const isFile = /\.[a-z0-9]+$/i.test(last);
  if (!segments.length || isFile) return '';
  return `/${segments.join('/')}`;
}

export function normalizeRoute(page) {
  const raw = String(page || 'index.html').replace(/^\//, '');
  return raw === 'settings.html' ? 'settings-v2.html' : raw;
}

export function buildHref(page) {
  return `/${normalizeRoute(page)}`;
}

export function normalizePage(path) {
  const file = String(path || '').split('/').pop() || 'index.html';
  return file === 'settings.html' ? 'settings-v2.html' : file;
}

export function isCurrentPage(path) {
  const current = normalizePage(window.location.pathname.replace(/\/+$/, ''));
  const target = normalizePage(path);
  return current === target || (current === '' && target === 'index.html');
}

export function getStoredUser() {
  return displayProfile();
}

export function isPrivateRoutePending() {
  const mode = document.body?.dataset?.routeGuard || '';
  const authResolving = document.documentElement.classList.contains('auth-pending') ||
    document.body?.classList.contains('auth-pending') ||
    document.body?.classList.contains('app-loading');
  return (mode === 'private' || mode === 'auth') && authResolving;
}

export function isAuthenticated() {
  return isActuallyAuthenticated();
}

export function getRole() {
  return actualRole() || 'guest';
}

export function getDisplayName() {
  return displayProfile().name || 'Profile';
}

export function getAppearanceTheme() {
  return window.EvaraTheme?.getTheme?.() || 'adaptive';
}

export function getAppearanceMode() {
  return window.EvaraTheme?.getThemeMode?.() || 'image';
}

export function setTheme() {
  window.EvaraTheme?.applyAppearance?.();
}

export function syncThemeLabel() {
  window.EvaraTheme?.updateThemeControls?.();
}

export function forcePageVisible() {
  const root = document.documentElement;
  root.classList.remove('auth-pending', 'boot-pending', 'evara-boot-lock');
  root.classList.add('evara-theme-painted');
  document.body?.classList.remove('auth-pending', 'app-loading');
  document.body?.classList.add('app-ready');
}

export function getVisibleLinks() {
  const authority = navigationAuthoritySnapshot();
  return {
    authed: authority.authenticated,
    role: authority.role || 'guest',
    displayName: authority.profile?.name || 'Profile',
    authority
  };
}

export function navHaptic(ms = 8) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(ms);
  } catch {}
}

export function getBrandBlock() { return document.querySelector('.eva-brand,[data-home-link]'); }
export function getNavShell() { return document.getElementById('evaNavShell'); }
export function getMenuZone() { return document.getElementById('evaMenuZone'); }
export function getMenuBtn() { return document.getElementById('evaMenuBtn'); }
export function getMenuPanel() { return document.getElementById('evaMenuPanel'); }
