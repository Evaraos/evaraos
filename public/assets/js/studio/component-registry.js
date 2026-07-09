import {
  DESIGN_SYSTEM_VERSION,
  EVARA_DESIGN_SYSTEM_REGISTRY,
  getDesignSystemComponent
} from '../design-system/registry.js';

export const STUDIO_COMPONENT_VERSION = 'component-engine-v4';

const CONTRACT_BY_COMPONENT = Object.freeze({
  'glass-card': 'card',
  'text-block': 'text',
  'action-button': 'control',
  'metric-card': 'card',
  'status-card': 'card',
  'map-block': 'marketplace-map',
  'image-block': 'card',
  'workflow-form': 'workflow-form',
  'upload-field': 'workflow-upload',
  'notice-banner': 'workflow-notice',
  'settings-panel': 'settings-panel',
  'preference-row': 'settings-field',
  'conversation-row': 'conversation-row',
  'message-bubble': 'message-bubble',
  'service-card': 'service-card',
  'tracking-card': 'marketplace-tracking',
  'timeline-card': 'marketplace-timeline',
  'field-card': 'field-card',
  'dev-block': 'card'
});

function registerContract(component) {
  const contractId = CONTRACT_BY_COMPONENT[component.id] || 'card';
  const contract = getDesignSystemComponent(contractId);
  return Object.freeze({
    defaultSpan: 4,
    catalogStatus: 'studio-ready',
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
    id: 'text-block',
    name: 'Text Block',
    category: 'foundation',
    icon: 'T',
    description: 'Section heading and supporting copy using the shared type scale.',
    fields: ['title', 'body'],
    permissions: ['view', 'edit', 'move', 'delete'],
    primitive: { ui: 'text', density: 'comfortable', size: 'lg' },
    defaultSpan: 6,
    defaults: { title: 'Section heading', body: 'Add concise supporting copy that explains the section.', icon: 'T' }
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
    id: 'metric-card',
    name: 'Metric Card',
    category: 'analytics',
    icon: '◬',
    description: 'KPI card for revenue, jobs, leads, or performance.',
    fields: ['label', 'value', 'trend', 'icon'],
    permissions: ['view', 'edit', 'move'],
    primitive: { ui: 'card', glass: 'card', density: 'compact', size: 'md' },
    defaultSpan: 3,
    defaults: { label: 'Revenue', value: '$0', trend: '+0%', icon: '$' }
  },
  {
    id: 'status-card',
    name: 'Status Card',
    category: 'analytics',
    icon: '●',
    description: 'Operational state with a clear semantic summary.',
    fields: ['title', 'body', 'status', 'icon'],
    permissions: ['view', 'edit', 'move', 'delete'],
    primitive: { ui: 'card', glass: 'card', density: 'compact', size: 'md' },
    defaults: { title: 'System status', body: 'All monitored services are operating normally.', status: 'Healthy', icon: '●' }
  },
  {
    id: 'workflow-form',
    name: 'Workflow Form',
    category: 'workflows',
    icon: '▤',
    description: 'Reusable form section for applications, approvals, and onboarding.',
    fields: ['title', 'body', 'action'],
    permissions: ['view', 'edit', 'move', 'delete'],
    primitive: { ui: 'card', glass: 'card', density: 'comfortable', size: 'lg' },
    defaultSpan: 8,
    defaults: { title: 'Application details', body: 'Collect the information required to continue this workflow.', action: 'Continue', icon: '▤' }
  },
  {
    id: 'upload-field',
    name: 'Upload Field',
    category: 'workflows',
    icon: '⇧',
    description: 'Accessible file-upload area with helper and status messaging.',
    fields: ['title', 'body', 'accept'],
    permissions: ['view', 'edit', 'move', 'delete'],
    primitive: { ui: 'card', glass: 'card', density: 'comfortable', size: 'md' },
    defaultSpan: 6,
    defaults: { title: 'Upload documents', body: 'Drag files here or choose files from your device.', accept: 'PDF, JPG, PNG', icon: '⇧' }
  },
  {
    id: 'notice-banner',
    name: 'Notice Banner',
    category: 'workflows',
    icon: '!',
    description: 'Semantic workflow guidance, warning, success, or error notice.',
    fields: ['title', 'body', 'tone'],
    permissions: ['view', 'edit', 'move', 'delete'],
    primitive: { ui: 'card', glass: 'card', density: 'compact', size: 'md' },
    defaultSpan: 12,
    defaults: { title: 'Action required', body: 'Review the highlighted information before continuing.', tone: 'warning', icon: '!' }
  },
  {
    id: 'settings-panel',
    name: 'Settings Panel',
    category: 'settings',
    icon: '◆',
    description: 'Reusable preference panel for account and workspace settings.',
    fields: ['title', 'body'],
    permissions: ['view', 'edit', 'move', 'delete'],
    primitive: { ui: 'card', glass: 'card', density: 'comfortable', size: 'lg' },
    defaultSpan: 8,
    defaults: { title: 'Workspace preferences', body: 'Configure how this workspace behaves for your team.', icon: '◆' }
  },
  {
    id: 'preference-row',
    name: 'Preference Row',
    category: 'settings',
    icon: '◉',
    description: 'Single labeled preference with description and current value.',
    fields: ['title', 'body', 'value'],
    permissions: ['view', 'edit', 'move', 'delete'],
    primitive: { ui: 'card', glass: 'card', density: 'compact', size: 'md' },
    defaultSpan: 6,
    defaults: { title: 'Automatic scheduling', body: 'Allow EvaraOS to suggest the best available time.', value: 'On', icon: '◉' }
  },
  {
    id: 'conversation-row',
    name: 'Conversation Row',
    category: 'communications',
    icon: '◎',
    description: 'Inbox row with participant, preview, timestamp, and unread state.',
    fields: ['title', 'body', 'time'],
    permissions: ['view', 'edit', 'move', 'delete'],
    primitive: { ui: 'card', glass: 'card', density: 'compact', size: 'md' },
    defaultSpan: 6,
    defaults: { title: 'Alex Morgan', body: 'The customer confirmed tomorrow morning.', time: '9:41 AM', icon: 'A' }
  },
  {
    id: 'message-bubble',
    name: 'Message Bubble',
    category: 'communications',
    icon: '✦',
    description: 'Incoming or outgoing message with author and timestamp.',
    fields: ['title', 'body', 'time', 'direction'],
    permissions: ['view', 'edit', 'move', 'delete'],
    primitive: { ui: 'card', glass: 'card', density: 'compact', size: 'md' },
    defaultSpan: 6,
    defaults: { title: 'You', body: 'Your appointment has been confirmed.', time: '9:42 AM', direction: 'outgoing', icon: '✦' }
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
    defaultSpan: 8,
    defaults: { title: 'Operations Map', locationSource: 'jobs', zoom: 'city' }
  },
  {
    id: 'tracking-card',
    name: 'Tracking Card',
    category: 'operations',
    icon: '⌖',
    description: 'Live service tracking summary with status, ETA, and distance.',
    fields: ['title', 'body', 'eta', 'distance'],
    permissions: ['view', 'edit', 'move', 'delete'],
    primitive: { ui: 'card', glass: 'card', density: 'comfortable', size: 'md' },
    defaultSpan: 6,
    defaults: { title: 'Technician en route', body: 'Live location is updating securely.', eta: '12 min', distance: '4.2 mi', icon: '⌖' }
  },
  {
    id: 'field-card',
    name: 'Field Assignment',
    category: 'operations',
    icon: '↗',
    description: 'Assigned field job with status, location, and primary action.',
    fields: ['title', 'body', 'status', 'action'],
    permissions: ['view', 'edit', 'move', 'delete'],
    primitive: { ui: 'card', glass: 'card', density: 'comfortable', size: 'md' },
    defaultSpan: 6,
    defaults: { title: 'Exterior cleaning', body: '1842 Riverside Drive • Jacksonville', status: 'Scheduled', action: 'Open job', icon: '↗' }
  },
  {
    id: 'service-card',
    name: 'Service Card',
    category: 'marketplace',
    icon: '◇',
    description: 'Marketplace service with description, price, and action.',
    fields: ['title', 'body', 'price', 'action'],
    permissions: ['view', 'edit', 'move', 'delete'],
    primitive: { ui: 'card', glass: 'card', density: 'comfortable', size: 'md' },
    defaultSpan: 4,
    defaults: { title: 'Home cleaning', body: 'Professional recurring or one-time cleaning.', price: 'From $149', action: 'View service', icon: '◇' }
  },
  {
    id: 'timeline-card',
    name: 'Lifecycle Timeline',
    category: 'marketplace',
    icon: '⋮',
    description: 'Order, job, or approval lifecycle represented as clear steps.',
    fields: ['title', 'body', 'status'],
    permissions: ['view', 'edit', 'move', 'delete'],
    primitive: { ui: 'card', glass: 'card', density: 'comfortable', size: 'lg' },
    defaultSpan: 8,
    defaults: { title: 'Service progress', body: 'Requested • Confirmed • In progress • Complete', status: 'Confirmed', icon: '⋮' }
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
    defaultSpan: 8,
    defaults: { caption: 'Image caption', radius: '24' }
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
