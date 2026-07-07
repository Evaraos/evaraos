import { canUseFeature, canAccessPageName, normalizeAccessRole, permissionsForRole } from './access-control.js';

function currentRole() {
  try {
    const raw = localStorage.getItem('evaraos-user') || sessionStorage.getItem('evaraos-user') || '{}';
    const user = JSON.parse(raw);
    return normalizeAccessRole(user.role || localStorage.getItem('evaraos-role') || sessionStorage.getItem('evaraos-role') || 'customer');
  } catch {
    return 'customer';
  }
}

export function refreshPermissions() {
  const role = currentRole();
  document.documentElement.dataset.evaraosPermissionRole = role;
  document.querySelectorAll('[data-feature-permission]').forEach((node) => {
    const allowed = canUseFeature(node.dataset.featurePermission, role);
    node.hidden = !allowed;
    node.setAttribute('aria-hidden', String(!allowed));
  });
  document.querySelectorAll('[data-page-permission]').forEach((node) => {
    const allowed = canAccessPageName(node.dataset.pagePermission, role);
    node.hidden = !allowed;
    node.setAttribute('aria-hidden', String(!allowed));
  });
}

window.EvaraPermissions = {
  role: currentRole,
  refresh: refreshPermissions,
  canUseFeature: (feature) => canUseFeature(feature, currentRole()),
  canAccessPage: (page) => canAccessPageName(page, currentRole()),
  list: () => permissionsForRole(currentRole())
};

window.addEventListener('evara:session-ready', refreshPermissions);
window.addEventListener('pageshow', refreshPermissions);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refreshPermissions, { once: true });
else refreshPermissions();