const EXECUTIVE_ROLES = new Set(['owner', 'super_admin', 'admin']);
const STAFF_ROLES = new Set(['staff', 'sales', 'sales_rep', 'technician', 'cleaner', 'field_staff', 'crew_lead', 'customer_support', 'quality_control']);
const CUSTOMER_ROLES = new Set(['customer']);
const EXECUTIVE_ROUTES = new Set([
  '/website-builder.html',
  '/companies.html',
  '/users.html',
  '/org.html',
  '/applications.html',
  '/enterprise-finance-dashboard.html',
  '/marketplace-payouts.html',
  '/governance-dashboard.html',
  '/governance-analytics.html',
  '/anomaly-dashboard.html',
  '/audit-dashboard.html',
  '/replay-dashboard.html',
  '/live-operations-command.html',
  '/operations-visibility.html',
  '/notifications.html',
  '/executive-queue.html',
  '/workflow-monitor-dashboard.html',
  '/alerts-dashboard.html',
  '/analytics-dashboard.html',
  '/territories.html',
  '/qa.html'
]);
const CUSTOMER_ONLY_ROUTES = new Set(['/customer_dashboard.html', '/customer-commerce.html', '/customer-service-history.html']);
const STAFF_ALLOWED_ROUTES = new Set(['/dashboard.html', '/leads.html', '/jobs.html', '/presence.html', '/territory-map.html', '/customer-messaging.html', '/messages.html', '/settings-v2.html', '/settings.html']);

function previewRole() { return String(localStorage.getItem('evaraos-preview-role') || '').toLowerCase(); }
function role() {
  const preview = previewRole();
  if (preview) return preview;
  try {
    const raw = localStorage.getItem('evaraos-user') || sessionStorage.getItem('evaraos-user') || '{}';
    const user = JSON.parse(raw);
    return String(user.role || localStorage.getItem('evaraos-role') || sessionStorage.getItem('evaraos-role') || 'guest').toLowerCase();
  } catch {
    return 'guest';
  }
}
function norm(value) {
  if (['owner', 'super_admin'].includes(value)) return 'owner';
  if (value === 'admin') return 'admin';
  if (STAFF_ROLES.has(value)) return 'staff';
  if (CUSTOMER_ROLES.has(value)) return 'customer';
  return value || 'guest';
}
function routeFromHref(href = '') {
  try { return new URL(href, location.origin).pathname; }
  catch { return href; }
}
function allowed(path, currentRole) {
  if (EXECUTIVE_ROUTES.has(path)) return EXECUTIVE_ROLES.has(currentRole);
  if (currentRole === 'customer') return CUSTOMER_ONLY_ROUTES.has(path) || ['/customer-messaging.html', '/messages.html', '/settings-v2.html', '/settings.html', '/index.html', '/'].includes(path);
  if (currentRole === 'staff') return STAFF_ALLOWED_ROUTES.has(path) || !EXECUTIVE_ROUTES.has(path);
  return true;
}
export function applyNavRoleLockdown() {
  const currentRole = norm(role());
  document.documentElement.dataset.evaraosEffectiveRole = currentRole;
  document.documentElement.dataset.evaraosPreviewRoleActive = previewRole() ? 'true' : 'false';
  document.querySelectorAll('#evaLinks a[href], .eva-menu-panel a[href]').forEach((link) => {
    const path = routeFromHref(link.getAttribute('href'));
    if (!allowed(path, currentRole)) link.remove();
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
  const currentRole = norm(role());
  const path = routeFromHref(link.getAttribute('href'));
  if (!allowed(path, currentRole)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    location.assign(currentRole === 'customer' ? '/customer_dashboard.html' : '/dashboard.html');
  }
}, true);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
else schedule();