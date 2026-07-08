export const STUDIO_MODULE_VERSION = 'module-registry-v1';

export const STUDIO_MODULES = Object.freeze([
  { id: 'core', name: 'Core Engine', status: 'active', progress: 92, permissions: ['owner', 'admin'], dependencies: ['permissions', 'design-system'], routes: ['/dashboard.html'] },
  { id: 'permissions', name: 'Permission Engine', status: 'active', progress: 100, permissions: ['owner', 'admin'], dependencies: [], routes: [] },
  { id: 'design-system', name: 'Design System', status: 'active', progress: 78, permissions: ['owner', 'admin'], dependencies: [], routes: [] },
  { id: 'studio', name: 'Evara Studio', status: 'rebuild', progress: 18, permissions: ['owner', 'admin'], dependencies: ['permissions', 'design-system', 'components'], routes: ['/website-builder.html'] },
  { id: 'components', name: 'Component Engine', status: 'new', progress: 10, permissions: ['owner', 'admin'], dependencies: ['design-system'], routes: [] },
  { id: 'operations', name: 'Operations OS', status: 'active', progress: 36, permissions: ['owner', 'admin', 'organization', 'vendor', 'staff'], dependencies: ['core'], routes: ['/jobs.html', '/leads.html', '/schedule.html'] },
  { id: 'finance', name: 'Finance OS', status: 'planned', progress: 18, permissions: ['owner', 'admin', 'organization', 'vendor'], dependencies: ['core'], routes: ['/revenue.html', '/ledger.html'] },
  { id: 'hr', name: 'HR OS', status: 'planned', progress: 22, permissions: ['owner', 'admin', 'hr'], dependencies: ['core'], routes: ['/applications.html', '/users.html'] },
  { id: 'marketplace', name: 'Marketplace', status: 'planned', progress: 15, permissions: ['owner', 'admin', 'customer'], dependencies: ['operations', 'finance'], routes: ['/customer-commerce.html'] },
  { id: 'ai', name: 'AI OS', status: 'planned', progress: 10, permissions: ['owner', 'admin', 'organization'], dependencies: ['core', 'data'], routes: ['/ai_command.html'] },
  { id: 'data', name: 'Data Engine', status: 'planned', progress: 0, permissions: ['owner', 'admin'], dependencies: ['permissions'], routes: [] }
]);

export function getStudioModule(id) {
  return STUDIO_MODULES.find((module) => module.id === id) || null;
}

export function modulesForRole(role = 'customer') {
  const normalized = String(role || 'customer').toLowerCase();
  return STUDIO_MODULES.filter((module) => module.permissions.includes(normalized) || (['super_admin'].includes(normalized) && module.permissions.includes('owner')));
}

export function studioProgress() {
  const total = STUDIO_MODULES.reduce((sum, module) => sum + Number(module.progress || 0), 0);
  return Math.round(total / STUDIO_MODULES.length);
}

window.EvaraStudioModules = { version: STUDIO_MODULE_VERSION, modules: STUDIO_MODULES, get: getStudioModule, forRole: modulesForRole, progress: studioProgress };
