import {
  DESIGN_SYSTEM_VERSION,
  EVARA_DESIGN_SYSTEM_REGISTRY,
  getDesignSystemComponent
} from '../design-system/registry.js';

export const STUDIO_COMPONENT_VERSION = 'component-engine-v3';

const CONTRACT_BY_COMPONENT = Object.freeze({
  'glass-card': 'card',
  'metric-card': 'card',
  'map-block': 'marketplace-map',
  'image-block': 'card',
  'action-button': 'control',
  'dev-block': 'card'
});

function registerContract(component) {
  const contractId = CONTRACT_BY_COMPONENT[component.id] || 'card';
  const contract = getDesignSystemComponent(contractId);
  return Object.freeze({
    ...component,
    designSystem: Object.freeze({
      version: DESIGN_SYSTEM_VERSION,
      contractId,
      source: contract?.source || 'primitives',
      status: contract?.status || 'stable',
      selector: contract?.selector || '[data-ui="card"]',
      properties: Object.freeze([...(contract?.properties || [])])
    })
  });
}

export const STUDIO_COMPONENTS = Object.freeze([
  {
    id: 'glass-card',
    name: 'Glass Card',
    category: 'foundation',
    icon: '◈',
    description: 'Reusable Liquid Glass content card.',
    fields: ['title', 'body', 'icon', 'action'],
    permissions: ['view', 'edit', 'move', 'delete'],
    primitive: { ui: 'card', glass: 'card', density: 'comfortable', size: 'md' },
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
    primitive: { ui: 'card', glass: 'card', density: 'compact', size: 'md' },
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
    primitive: { ui: 'card', glass: 'card', density: 'comfortable', size: 'lg' },
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
    primitive: { ui: 'card', glass: 'card', density: 'compact', size: 'md' },
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
    primitive: { ui: 'control', glass: 'control', size: 'md', shape: 'pill' },
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
    primitive: { ui: 'card', glass: 'card', density: 'comfortable', size: 'md' },
    defaults: { name: 'Developer block', module: 'custom', notes: 'Advanced logic placeholder.' }
  }
].map(registerContract));

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

function primitiveAttributes(component, overrides = {}) {
  const primitive = { ...(component?.primitive || {}), ...(overrides || {}) };
  return [
    primitive.ui ? `data-ui="${primitive.ui}"` : '',
    primitive.glass ? `data-glass="${primitive.glass}"` : '',
    primitive.size ? `data-size="${primitive.size}"` : '',
    primitive.density ? `data-density="${primitive.density}"` : '',
    primitive.shape ? `data-shape="${primitive.shape}"` : ''
  ].filter(Boolean).join(' ');
}

export function renderComponentPreview(component, values = {}) {
  const data = { ...(component?.defaults || {}), ...(values || {}) };
  const icon = data.icon || component?.icon || '◈';
  if (!component) return '';

  const cardAttributes = primitiveAttributes(component, { ui: 'card', glass: 'card' });
  const iconMarkup = `<span class="eva-icon" data-ui="icon" data-size="sm" data-glass="control" aria-hidden="true">${icon}</span>`;

  if (component.id === 'metric-card') {
    return `<article class="eva-card studio-component-preview" ${cardAttributes} data-studio-component="${component.id}" data-design-system-contract="${component.designSystem.contractId}"><header class="eva-card__header" data-ui="card-header">${iconMarkup}<small class="eva-overline" data-ui="text" data-style="overline">${data.label}</small></header><strong class="eva-title" data-ui="text" data-style="title">${data.value}</strong><em class="eva-caption" data-ui="text" data-style="caption">${data.trend}</em></article>`;
  }
  if (component.id === 'map-block') {
    return `<article class="eva-card studio-component-preview" ${cardAttributes} data-studio-component="${component.id}" data-design-system-contract="${component.designSystem.contractId}"><header class="eva-card__header" data-ui="card-header"><strong class="eva-heading" data-ui="text" data-style="heading">${data.title}</strong>${iconMarkup}</header><div class="studio-preview-map">Map</div><small class="eva-caption" data-ui="text" data-style="caption">${data.locationSource}</small></article>`;
  }
  if (component.id === 'image-block') {
    return `<article class="eva-card studio-component-preview" ${cardAttributes} data-studio-component="${component.id}" data-design-system-contract="${component.designSystem.contractId}"><div class="studio-preview-image">Image</div><small class="eva-caption" data-ui="text" data-style="caption">${data.caption}</small></article>`;
  }
  if (component.id === 'action-button') {
    const controlAttributes = primitiveAttributes(component, { ui: 'control', glass: 'control' });
    return `<article class="studio-component-preview" data-studio-component="${component.id}" data-design-system-contract="${component.designSystem.contractId}"><button class="btn btn-theme-primary eva-control" ${controlAttributes} type="button">${data.label}</button></article>`;
  }
  return `<article class="eva-card studio-component-preview" ${cardAttributes} data-studio-component="${component.id}" data-design-system-contract="${component.designSystem.contractId}"><header class="eva-card__header" data-ui="card-header">${iconMarkup}<strong class="eva-heading" data-ui="text" data-style="heading">${data.title || data.name || component.name}</strong></header><small class="eva-body" data-ui="text" data-style="body">${data.body || data.notes || component.description}</small></article>`;
}

window.EvaraStudioComponents = {
  version: STUDIO_COMPONENT_VERSION,
  designSystemVersion: DESIGN_SYSTEM_VERSION,
  registry: EVARA_DESIGN_SYSTEM_REGISTRY,
  components: STUDIO_COMPONENTS,
  get: getStudioComponent,
  byCategory: componentsByCategory,
  renderPreview: renderComponentPreview
};
