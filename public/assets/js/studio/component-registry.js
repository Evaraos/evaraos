export const STUDIO_COMPONENT_VERSION = 'component-engine-v1';

export const STUDIO_COMPONENTS = Object.freeze([
  {
    id: 'glass-card',
    name: 'Glass Card',
    category: 'foundation',
    icon: '◈',
    description: 'Reusable Liquid Glass content card.',
    fields: ['title', 'body', 'icon', 'action'],
    permissions: ['view', 'edit', 'move', 'delete'],
    defaults: { title: 'Glass card', body: 'Editable reusable card.', icon: '◈', action: 'Open' }
  },
  {
    id: 'metric-card',
    name: 'Metric Card',
    category: 'analytics',
    icon: '◬',
    description: 'KPI card for revenue, jobs, leads, or performance.',
    fields: ['label', 'value', 'trend', 'icon'],
    permissions: ['view', 'edit', 'move'],
    defaults: { label: 'Revenue', value: '$0', trend: '+0%', icon: '$' }
  },
  {
    id: 'map-block',
    name: 'Map Block',
    category: 'operations',
    icon: '⬢',
    description: 'Map placeholder for routes, jobs, service areas, or customers.',
    fields: ['title', 'locationSource', 'zoom'],
    permissions: ['view', 'edit', 'move'],
    defaults: { title: 'Operations Map', locationSource: 'jobs', zoom: 'city' }
  },
  {
    id: 'image-block',
    name: 'Image Block',
    category: 'media',
    icon: '▧',
    description: 'Reusable image/media block connected to the Asset Library.',
    fields: ['asset', 'caption', 'radius'],
    permissions: ['view', 'edit', 'move', 'delete'],
    defaults: { caption: 'Image caption', radius: '24' }
  },
  {
    id: 'action-button',
    name: 'Action Button',
    category: 'foundation',
    icon: '＋',
    description: 'Primary or secondary CTA connected to an action.',
    fields: ['label', 'action', 'style'],
    permissions: ['view', 'edit', 'move', 'delete'],
    defaults: { label: 'Continue', action: 'none', style: 'primary' }
  },
  {
    id: 'dev-block',
    name: 'Developer Block',
    category: 'advanced',
    icon: '</>',
    description: 'Advanced owner/senior engineer logic placeholder.',
    fields: ['name', 'module', 'notes'],
    permissions: ['view', 'edit', 'move', 'delete', 'publish'],
    defaults: { name: 'Developer block', module: 'custom', notes: 'Advanced logic placeholder.' }
  }
]);

export function getStudioComponent(id) {
  return STUDIO_COMPONENTS.find((component) => component.id === id) || null;
}

export function componentsByCategory() {
  return STUDIO_COMPONENTS.reduce((groups, component) => {
    if (!groups[component.category]) groups[component.category] = [];
    groups[component.category].push(component);
    return groups;
  }, {});
}

export function renderComponentPreview(component, values = {}) {
  const data = { ...(component?.defaults || {}), ...(values || {}) };
  const icon = data.icon || component?.icon || '◈';
  if (!component) return '';
  if (component.id === 'metric-card') {
    return `<article class="eva-card studio-component-preview" data-studio-component="${component.id}"><span>${icon}</span><small>${data.label}</small><strong>${data.value}</strong><em>${data.trend}</em></article>`;
  }
  if (component.id === 'map-block') {
    return `<article class="eva-card studio-component-preview" data-studio-component="${component.id}"><strong>${data.title}</strong><div class="studio-preview-map">Map</div><small>${data.locationSource}</small></article>`;
  }
  if (component.id === 'image-block') {
    return `<article class="eva-card studio-component-preview" data-studio-component="${component.id}"><div class="studio-preview-image">Image</div><small>${data.caption}</small></article>`;
  }
  if (component.id === 'action-button') {
    return `<article class="studio-component-preview" data-studio-component="${component.id}"><button class="btn btn-theme-primary" type="button">${data.label}</button></article>`;
  }
  return `<article class="eva-card studio-component-preview" data-studio-component="${component.id}"><span>${icon}</span><strong>${data.title || data.name || component.name}</strong><small>${data.body || data.notes || component.description}</small></article>`;
}

window.EvaraStudioComponents = { version: STUDIO_COMPONENT_VERSION, components: STUDIO_COMPONENTS, get: getStudioComponent, byCategory: componentsByCategory, renderPreview: renderComponentPreview };
