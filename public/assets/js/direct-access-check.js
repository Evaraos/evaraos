import { canAccessPageName, defaultRouteForRole, normalizeAccessRole } from './access-control.js';

function currentRole() {
  try {
    const raw = localStorage.getItem('evaraos-user') || sessionStorage.getItem('evaraos-user') || '{}';
    const user = JSON.parse(raw);
    return normalizeAccessRole(user.role || localStorage.getItem('evaraos-role') || sessionStorage.getItem('evaraos-role') || 'customer');
  } catch {
    return 'customer';
  }
}

function currentPage() {
  return location.pathname || '/index.html';
}

export function checkDirectPageAccess() {
  const role = currentRole();
  const page = currentPage();
  document.documentElement.dataset.evaraosAccessRole = role;
  if (!canAccessPageName(page, role)) {
    const destination = defaultRouteForRole(role);
    window.EvaraLoader?.beginNavigationLoad?.({ title: 'Opening your dashboard', subtitle: 'That page is not available for this account.' });
    setTimeout(() => location.replace(destination), 60);
    return false;
  }
  return true;
}

window.addEventListener('evara:session-ready', checkDirectPageAccess);
window.addEventListener('pageshow', checkDirectPageAccess);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', checkDirectPageAccess, { once: true });
else checkDirectPageAccess();
