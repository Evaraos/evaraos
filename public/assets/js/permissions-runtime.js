import { canUseFeature, canAccessPageName, normalizeAccessRole, permissionsForRole } from './access-control.js';

function currentRole() {
  try {
    const raw = localStorage.getItem('evaraos-user') || sessionStorage.getItem('evaraos-user') || '{}';
    const user = JSON.parse(raw);
    return normalizeAccessRole(user.role || localStorage.getItem('evaraos-role') || sessionStorage.getItem('evaraos-role') || 'customer');
  } catch { return 'customer'; }
}

function applyNodeState(node, allowed) {
  const mode = node.dataset.permissionMode || 'hide';
  if (mode === 'disable') {
    node.disabled = !allowed;
    node.setAttribute('aria-disabled', String(!allowed));
    node.classList.toggle('is-permission-disabled', !allowed);
    return;
  }
  node.hidden = !allowed;
  node.setAttribute('aria-hidden', String(!allowed));
}

export function refreshPermissions() {
  const role = currentRole();
  const report = { role, features: 0, pages: 0, blocked: 0 };
  document.documentElement.dataset.evaraosPermissionRole = role;
  document.querySelectorAll('[data-feature-permission]').forEach((node) => {
    const allowed = canUseFeature(node.dataset.featurePermission, role);
    applyNodeState(node, allowed);
    report.features += 1;
    if (!allowed) report.blocked += 1;
  });
  document.querySelectorAll('[data-action-permission]').forEach((node) => {
    const allowed = canUseFeature(node.dataset.actionPermission, role);
    applyNodeState(node, allowed);
    report.features += 1;
    if (!allowed) report.blocked += 1;
  });
  document.querySelectorAll('[data-page-permission]').forEach((node) => {
    const allowed = canAccessPageName(node.dataset.pagePermission, role);
    applyNodeState(node, allowed);
    report.pages += 1;
    if (!allowed) report.blocked += 1;
  });
  window.dispatchEvent(new CustomEvent('evara:permissions-refreshed', { detail: report }));
  return report;
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
window.addEventListener('storage', refreshPermissions);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refreshPermissions, { once: true });
else refreshPermissions();