import { normalizeAccessRole } from '../access-control.js';

export const BLUEPRINT_ENGINE_VERSION = 'blueprint-engine-v2';

export const EVARA_BLUEPRINTS = Object.freeze([
  {
    id: 'owner',
    name: 'Owner Blueprint',
    role: 'owner',
    status: 'draft',
    version: 2,
    navigation: ['Dashboard', 'Studio', 'Finance', 'Operations', 'HR', 'Marketplace', 'AI', 'Settings'],
    sections: [
      { id: 'owner-command', title: 'Command Center', components: ['metric-card', 'glass-card', 'map-block'] },
      { id: 'owner-growth', title: 'Growth & Finance', components: ['metric-card', 'glass-card'] },
      { id: 'owner-ops', title: 'Operations', components: ['map-block', 'glass-card'] }
    ],
    permissions: ['view', 'edit', 'publish', 'delegate']
  },
  {
    id: 'admin', name: 'Admin Blueprint', role: 'admin', status: 'draft', version: 2,
    navigation: ['Dashboard', 'Applications', 'Users', 'Jobs', 'Reports', 'Settings'],
    sections: [
      { id: 'admin-queue', title: 'Applications & Users', components: ['metric-card', 'glass-card'] },
      { id: 'admin-ops', title: 'Operations Queue', components: ['map-block', 'glass-card'] }
    ],
    permissions: ['view', 'edit', 'approve']
  },
  {
    id: 'manager', name: 'Manager Blueprint', role: 'manager', status: 'draft', version: 2,
    navigation: ['Dashboard', 'Applications', 'Users', 'Jobs', 'Dispatch', 'Schedule', 'Messages', 'Settings'],
    sections: [
      { id: 'manager-queue', title: 'Operations Queue', components: ['metric-card', 'status-card', 'field-card'] },
      { id: 'manager-dispatch', title: 'Dispatch & Scheduling', components: ['map-block', 'tracking-card', 'timeline-card'] }
    ],
    permissions: ['view', 'edit', 'approve', 'dispatch']
  },
  {
    id: 'sales', name: 'Sales Blueprint', role: 'sales', status: 'draft', version: 2,
    navigation: ['Leads', 'Map', 'Schedule', 'Commissions', 'Messages'],
    sections: [
      { id: 'sales-leads', title: 'Lead Pipeline', components: ['metric-card', 'glass-card', 'map-block'] }
    ],
    permissions: ['view', 'create_leads', 'update_leads']
  },
  {
    id: 'technician', name: 'Technician Blueprint', role: 'technician', status: 'draft', version: 2,
    navigation: ['Today', 'Jobs', 'Map', 'Photos', 'Checklist', 'Messages'],
    sections: [
      { id: 'tech-today', title: "Today's Jobs", components: ['glass-card', 'map-block', 'action-button'] }
    ],
    permissions: ['view', 'update_jobs', 'upload_photos']
  },
  {
    id: 'cleaner', name: 'Cleaner Blueprint', role: 'cleaner', status: 'draft', version: 2,
    navigation: ['Today', 'Jobs', 'Checklist', 'Photos', 'Messages'],
    sections: [
      { id: 'cleaner-work', title: 'Cleaning Queue', components: ['glass-card', 'action-button'] }
    ],
    permissions: ['view', 'update_jobs', 'upload_photos']
  },
  {
    id: 'customer', name: 'Customer Blueprint', role: 'customer', status: 'draft', version: 2,
    navigation: ['Marketplace', 'Orders', 'Map', 'Invoices', 'Support', 'Profile'],
    sections: [
      { id: 'customer-marketplace', title: 'Book Services', components: ['glass-card', 'image-block', 'action-button'] },
      { id: 'customer-orders', title: 'Orders & Service Map', components: ['map-block', 'glass-card'] }
    ],
    permissions: ['view', 'book_services', 'pay_invoices']
  },
  {
    id: 'vendor', name: 'Vendor Blueprint', role: 'vendor', status: 'draft', version: 2,
    navigation: ['Dashboard', 'Jobs', 'Leads', 'Payouts', 'Team', 'Settings'],
    sections: [
      { id: 'vendor-ops', title: 'Vendor Operations', components: ['metric-card', 'map-block', 'glass-card'] }
    ],
    permissions: ['view', 'manage_team', 'accept_jobs']
  }
]);

export function getBlueprint(idOrRole = 'customer') {
  const raw = String(idOrRole || 'customer').trim().toLowerCase();
  const normalized = normalizeAccessRole(raw);
  return EVARA_BLUEPRINTS.find((blueprint) => blueprint.id === raw || blueprint.role === raw || blueprint.id === normalized || blueprint.role === normalized)
    || EVARA_BLUEPRINTS.find((blueprint) => blueprint.id === 'customer');
}

export function blueprintsForStudio() {
  return EVARA_BLUEPRINTS.map((blueprint) => ({
    id: blueprint.id,
    name: blueprint.name,
    role: blueprint.role,
    status: blueprint.status,
    version: blueprint.version,
    sectionCount: blueprint.sections.length,
    componentCount: blueprint.sections.reduce((sum, section) => sum + section.components.length, 0)
  }));
}

if (typeof window !== 'undefined') {
  window.EvaraBlueprints = {
    version: BLUEPRINT_ENGINE_VERSION,
    all: EVARA_BLUEPRINTS,
    get: getBlueprint,
    list: blueprintsForStudio
  };
}
