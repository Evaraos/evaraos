import {
  canAccessPageName,
  defaultRouteForRole,
  normalizeAccessRole
} from './access-control.js';

function currentPath() {
  return location.pathname || '/index.html';
}

function verifiedRouteSession(value = window.EvaraRouteSession) {
  const source = String(value?.source || '');
  const role = normalizeAccessRole(value?.role || '');
  if (source !== 'verified-route-guard' || !value?.authenticated || !role) return null;
  return Object.freeze({
    authenticated: true,
    role,
    userId: String(value?.userId || ''),
    source
  });
}

export function checkDirectPageAccess(sessionValue = window.EvaraRouteSession) {
  const session = verifiedRouteSession(sessionValue);
  if (!session) return true;

  const page = currentPath();
  document.documentElement.dataset.evaraosAccessRole = session.role;

  if (!canAccessPageName(page, session.role)) {
    const destination = defaultRouteForRole(session.role);
    window.EvaraLoader?.beginNavigationLoad?.({
      title: 'Opening your dashboard',
      subtitle: 'That page is not available for this account.'
    });
    setTimeout(() => location.replace(destination), 60);
    return false;
  }

  return true;
}

window.addEventListener('evara:session-ready', (event) => {
  checkDirectPageAccess(event.detail);
});

window.addEventListener('pageshow', () => {
  checkDirectPageAccess(window.EvaraRouteSession);
});

if (window.EvaraRouteSession) {
  checkDirectPageAccess(window.EvaraRouteSession);
}
