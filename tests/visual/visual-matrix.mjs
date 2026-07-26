import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

export const ROLE_DEFINITIONS = Object.freeze([
  {
    id: 'platform_admin',
    secret: 'PLATFORM_ADMIN',
    routes: ['/dashboard.html', '/website-builder.html', '/qa-v2.html', '/applications.html', '/jobs.html', '/dispatch.html', '/schedule.html', '/territory-map.html', '/marketplace-payouts.html', '/live-operations-command.html', '/operations-visibility.html'],
    criticalRoutes: ['/dashboard.html', '/website-builder.html', '/qa-v2.html']
  },
  {
    id: 'owner',
    secret: 'OWNER',
    required: true,
    routes: ['/dashboard.html', '/settings-v2.html', '/settings/account.html', '/settings/appearance.html', '/settings/icons.html', '/settings/notifications.html', '/settings/workspace-v2.html', '/messages.html', '/website-builder.html', '/applications.html', '/jobs.html', '/dispatch.html', '/schedule.html', '/field.html', '/territory-map.html', '/marketplace-payouts.html', '/live-operations-command.html', '/operations-visibility.html', '/qa-v2.html'],
    criticalRoutes: ['/dashboard.html', '/settings-v2.html', '/messages.html', '/website-builder.html', '/qa-v2.html']
  },
  {
    id: 'admin',
    secret: 'ADMIN',
    routes: ['/dashboard.html', '/settings-v2.html', '/messages.html', '/website-builder.html', '/applications.html', '/jobs.html', '/dispatch.html', '/schedule.html', '/territory-map.html', '/marketplace-payouts.html', '/qa-v2.html'],
    criticalRoutes: ['/dashboard.html', '/messages.html', '/qa-v2.html']
  },
  {
    id: 'manager',
    secret: 'MANAGER',
    routes: ['/dashboard.html', '/settings-v2.html', '/messages.html', '/users.html', '/applications.html', '/jobs.html', '/leads.html', '/dispatch.html', '/schedule.html', '/field.html', '/live-operations-command.html', '/operations-visibility.html'],
    criticalRoutes: ['/dashboard.html', '/dispatch.html', '/schedule.html']
  },
  {
    id: 'sales',
    secret: 'SALES',
    routes: ['/dashboard.html', '/settings-v2.html', '/messages.html', '/leads.html', '/jobs.html', '/field.html', '/schedule.html', '/territory-map.html'],
    criticalRoutes: ['/dashboard.html', '/leads.html']
  },
  {
    id: 'technician',
    secret: 'TECHNICIAN',
    routes: ['/dashboard.html', '/settings-v2.html', '/messages.html', '/jobs.html', '/field.html', '/schedule.html', '/territory-map.html'],
    criticalRoutes: ['/field.html', '/jobs.html']
  },
  {
    id: 'cleaner',
    secret: 'CLEANER',
    routes: ['/dashboard.html', '/settings-v2.html', '/messages.html', '/jobs.html', '/field.html', '/schedule.html', '/territory-map.html'],
    criticalRoutes: ['/field.html', '/jobs.html']
  },
  {
    id: 'customer',
    secret: 'CUSTOMER',
    routes: ['/customer_dashboard.html', '/settings-v2.html', '/messages.html', '/customer-messaging.html', '/customer-commerce.html', '/customer-service-history.html', '/customer_bills.html'],
    criticalRoutes: ['/customer_dashboard.html', '/customer-commerce.html', '/customer-messaging.html']
  },
  {
    id: 'vendor',
    secret: 'VENDOR',
    routes: ['/dashboard.html', '/settings-v2.html', '/messages.html', '/jobs.html', '/leads.html', '/dispatch.html', '/schedule.html', '/field.html', '/territory-map.html', '/revenue.html', '/job_billing.html', '/marketplace-payouts.html'],
    criticalRoutes: ['/dashboard.html', '/dispatch.html', '/marketplace-payouts.html']
  }
]);

export const APPEARANCES = Object.freeze([
  { id: 'light', mode: 'light', colorScheme: 'light' },
  { id: 'dark', mode: 'dark', colorScheme: 'dark' },
  { id: 'system', mode: 'system', colorScheme: 'light' },
  { id: 'image', mode: 'image', colorScheme: 'dark', imagePath: '/assets/brand/evaraos-app-icon.png' }
]);

export const CRITICAL_VISUAL_CASES = Object.freeze([
  { role: 'owner', route: '/dashboard.html' },
  { role: 'owner', route: '/settings-v2.html' },
  { role: 'owner', route: '/messages.html' },
  { role: 'owner', route: '/website-builder.html' },
  { role: 'owner', route: '/qa-v2.html' },
  { role: 'manager', route: '/dispatch.html' },
  { role: 'technician', route: '/field.html' },
  { role: 'customer', route: '/customer_dashboard.html' },
  { role: 'customer', route: '/customer-commerce.html' },
  { role: 'vendor', route: '/marketplace-payouts.html' }
]);

export function credentialsFor(role) {
  const prefix = `EVARA_QA_${role.secret}`;
  const email = String(process.env[`${prefix}_EMAIL`] || '').trim();
  const password = String(process.env[`${prefix}_PASSWORD`] || '');
  return { email, password, available: Boolean(email && password) };
}

export function configuredRoles() {
  return ROLE_DEFINITIONS.filter((role) => credentialsFor(role).available);
}

export function storageStatePath(roleId) {
  return path.join(root, '.auth', `${roleId}.json`);
}

export function routeSlug(route) {
  return route.replace(/^\//, '').replace(/\.html$/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'index';
}
