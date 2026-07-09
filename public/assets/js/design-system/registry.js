export const DESIGN_SYSTEM_VERSION = '2.0.0';
export const DESIGN_SYSTEM_REGISTRY_VERSION = 'registry-v1';

const freezeList = (items) => Object.freeze(items.map((item) => Object.freeze(item)));

export const DESIGN_SYSTEM_LAYERS = freezeList([
  {
    id: 'tokens',
    name: 'Foundation Tokens',
    source: '/assets/css/base/variables.css',
    status: 'stable',
    owns: ['spacing', 'type', 'shape', 'icons', 'motion', 'semantic colors', 'elevation', 'responsive layout']
  },
  {
    id: 'material',
    name: 'Liquid Glass Material Engine',
    source: '/assets/css/theme/liquid-optics.css',
    status: 'authoritative',
    owns: ['glass fill', 'blur', 'edge', 'highlight', 'material elevation', 'surface material states']
  },
  {
    id: 'primitives',
    name: 'Core UI Primitives',
    source: '/assets/css/design-system/primitives.css',
    status: 'stable',
    owns: ['layout', 'surface anatomy', 'cards', 'typography', 'icons', 'controls', 'interaction states']
  },
  {
    id: 'workflows',
    name: 'Workflow Primitives',
    source: '/assets/css/design-system/workflows.css',
    status: 'stable',
    owns: ['applications', 'approvals', 'onboarding', 'enterprise forms', 'uploads', 'workflow status']
  },
  {
    id: 'settings',
    name: 'Settings Primitives',
    source: '/assets/css/design-system/settings.css',
    status: 'stable',
    owns: ['settings hubs', 'preferences', 'appearance controls', 'notification rows', 'save bars']
  },
  {
    id: 'communications',
    name: 'Communication Primitives',
    source: '/assets/css/design-system/communications.css',
    status: 'stable',
    owns: ['conversation rails', 'conversation rows', 'message bubbles', 'composer', 'sheets', 'media viewer']
  },
  {
    id: 'marketplace',
    name: 'Marketplace & Operations Primitives',
    source: '/assets/css/design-system/marketplace.css',
    status: 'stable',
    owns: ['services', 'quotes', 'orders', 'invoices', 'subscriptions', 'payouts', 'schedules', 'dispatch', 'tracking', 'field work']
  }
]);

export const DESIGN_SYSTEM_COMPONENTS = freezeList([
  { id: 'container', category: 'foundation', name: 'Container', selector: '[data-ui="container"]', className: 'eva-container', source: 'primitives', status: 'stable', properties: ['maxWidth', 'gutter'] },
  { id: 'stack', category: 'foundation', name: 'Stack', selector: '[data-layout="stack"]', className: 'eva-stack', source: 'primitives', status: 'stable', properties: ['gap'] },
  { id: 'cluster', category: 'foundation', name: 'Cluster', selector: '[data-layout="cluster"]', className: 'eva-cluster', source: 'primitives', status: 'stable', properties: ['gap', 'alignment', 'wrap'] },
  { id: 'grid', category: 'foundation', name: 'Responsive Grid', selector: '[data-layout="grid"]', className: 'eva-grid', source: 'primitives', status: 'stable', properties: ['minimumColumnWidth', 'gap'] },
  { id: 'split', category: 'foundation', name: 'Split Layout', selector: '[data-layout="split"]', className: 'eva-split', source: 'primitives', status: 'stable', properties: ['gap', 'alignment'] },
  { id: 'surface', category: 'foundation', name: 'Surface', selector: '[data-ui="surface"]', className: 'eva-surface', source: 'primitives', status: 'stable', properties: ['size', 'shape', 'glass'] },
  { id: 'card', category: 'foundation', name: 'Card', selector: '[data-ui="card"]', className: 'eva-card', source: 'primitives', status: 'stable', properties: ['size', 'density', 'shape', 'glass'] },
  { id: 'divider', category: 'foundation', name: 'Divider', selector: '[data-ui="divider"]', className: 'eva-divider', source: 'primitives', status: 'stable', properties: [] },
  { id: 'text', category: 'foundation', name: 'Typography', selector: '[data-ui="text"]', className: 'eva-body', source: 'primitives', status: 'stable', properties: ['style', 'tone'] },
  { id: 'icon', category: 'foundation', name: 'Icon Frame', selector: '[data-ui="icon"]', className: 'eva-icon', source: 'primitives', status: 'stable', properties: ['size', 'shape', 'glass'] },
  { id: 'control', category: 'foundation', name: 'Control', selector: '[data-ui="control"]', className: 'eva-control', source: 'primitives', status: 'stable', properties: ['size', 'shape', 'width', 'pressed', 'busy', 'disabled', 'glass'] },

  { id: 'workflow-shell', category: 'workflow', name: 'Workflow Shell', selector: '.eva-workflow-shell', className: 'eva-workflow-shell', source: 'workflows', status: 'stable', properties: ['contentWidth', 'sectionGap'] },
  { id: 'workflow-hero', category: 'workflow', name: 'Workflow Hero', selector: '.eva-workflow-hero', className: 'eva-workflow-hero', source: 'workflows', status: 'stable', properties: ['columns', 'gap'] },
  { id: 'workflow-form', category: 'workflow', name: 'Workflow Form', selector: '.eva-workflow-form', className: 'eva-workflow-form', source: 'workflows', status: 'stable', properties: ['density', 'glass'] },
  { id: 'workflow-field', category: 'workflow', name: 'Workflow Field', selector: '.eva-workflow-field', className: 'eva-workflow-field', source: 'workflows', status: 'stable', properties: ['type', 'required', 'validation', 'width'] },
  { id: 'workflow-upload', category: 'workflow', name: 'File Upload', selector: '.eva-workflow-upload', className: 'eva-workflow-upload', source: 'workflows', status: 'stable', properties: ['accept', 'multiple', 'status'] },
  { id: 'workflow-notice', category: 'workflow', name: 'Workflow Notice', selector: '.eva-workflow-notice', className: 'eva-workflow-notice', source: 'workflows', status: 'stable', properties: ['tone'] },

  { id: 'settings-shell', category: 'settings', name: 'Settings Shell', selector: '.eva-settings-shell', className: 'eva-settings-shell', source: 'settings', status: 'stable', properties: ['contentWidth', 'sectionGap'] },
  { id: 'settings-panel', category: 'settings', name: 'Settings Panel', selector: '.eva-settings-panel', className: 'eva-settings-panel', source: 'settings', status: 'stable', properties: ['density', 'glass'] },
  { id: 'settings-hub-card', category: 'settings', name: 'Settings Hub Card', selector: '.eva-settings-hub-card', className: 'eva-settings-hub-card', source: 'settings', status: 'stable', properties: ['icon', 'title', 'description', 'action'] },
  { id: 'settings-field', category: 'settings', name: 'Settings Field', selector: '.eva-settings-field', className: 'eva-settings-field', source: 'settings', status: 'stable', properties: ['type', 'label', 'value', 'validation'] },
  { id: 'settings-choice-grid', category: 'settings', name: 'Settings Choices', selector: '.eva-settings-choice-grid', className: 'eva-settings-choice-grid', source: 'settings', status: 'stable', properties: ['columns', 'selectionMode'] },
  { id: 'settings-switch', category: 'settings', name: 'Settings Switch', selector: '.eva-settings-switch', className: 'eva-settings-switch', source: 'settings', status: 'stable', properties: ['checked', 'disabled'] },

  { id: 'conversation-list', category: 'communications', name: 'Conversation List', selector: '.conversation-list', className: 'conversation-list', source: 'communications', status: 'stable', properties: ['density', 'selection'] },
  { id: 'conversation-row', category: 'communications', name: 'Conversation Row', selector: '.conversation-item', className: 'conversation-item', source: 'communications', status: 'stable', properties: ['avatar', 'title', 'preview', 'timestamp', 'unread', 'muted', 'selected'] },
  { id: 'message-bubble', category: 'communications', name: 'Message Bubble', selector: '.message-bubble', className: 'message-bubble', source: 'communications', status: 'stable', properties: ['direction', 'body', 'timestamp', 'deliveryState', 'attachments'] },
  { id: 'message-composer', category: 'communications', name: 'Message Composer', selector: '.messages-composer', className: 'messages-composer', source: 'communications', status: 'stable', properties: ['placeholder', 'sendState', 'attachments'] },
  { id: 'communication-sheet', category: 'communications', name: 'Communication Action Sheet', selector: '.messages-action-sheet', className: 'messages-action-sheet', source: 'communications', status: 'stable', properties: ['title', 'actions', 'destructiveAction'] },
  { id: 'communication-viewer', category: 'communications', name: 'Conversation Media Viewer', selector: '.messages-photo-viewer', className: 'messages-photo-viewer', source: 'communications', status: 'stable', properties: ['asset', 'caption', 'changeAction'] },

  { id: 'service-card', category: 'marketplace', name: 'Service Card', selector: '.eva-service-card', className: 'eva-service-card', source: 'marketplace', status: 'stable', properties: ['image', 'title', 'description', 'price', 'action'] },
  { id: 'marketplace-cart', category: 'marketplace', name: 'Marketplace Cart', selector: '.eva-marketplace-cart', className: 'eva-marketplace-cart', source: 'marketplace', status: 'stable', properties: ['items', 'totals', 'provider', 'action'] },
  { id: 'marketplace-status', category: 'marketplace', name: 'Operational Status Pill', selector: '.eva-marketplace-pill', className: 'eva-marketplace-pill', source: 'marketplace', status: 'stable', properties: ['tone', 'label'] },
  { id: 'marketplace-tracking', category: 'marketplace', name: 'Live Tracking Card', selector: '.eva-marketplace-tracking', className: 'eva-marketplace-tracking', source: 'marketplace', status: 'stable', properties: ['state', 'eta', 'distance', 'updatedAt', 'mapAction'] },
  { id: 'marketplace-map', category: 'marketplace', name: 'Marketplace Map', selector: '.eva-marketplace-map', className: 'eva-marketplace-map', source: 'marketplace', status: 'stable', properties: ['source', 'zoom', 'overlays', 'status'] },
  { id: 'marketplace-calendar', category: 'marketplace', name: 'Operations Calendar', selector: '.calendar-grid', className: 'calendar-grid', source: 'marketplace', status: 'stable', properties: ['month', 'events', 'statusColors'] },
  { id: 'dispatch-board', category: 'marketplace', name: 'Dispatch Board', selector: '.dispatch-board', className: 'dispatch-board', source: 'marketplace', status: 'stable', properties: ['columns', 'records', 'filters', 'actions'] },
  { id: 'field-card', category: 'marketplace', name: 'Field Assignment Card', selector: '.field-card', className: 'field-card', source: 'marketplace', status: 'stable', properties: ['assignment', 'status', 'mapsAction', 'beforePhotos', 'afterPhotos'] },
  { id: 'marketplace-timeline', category: 'marketplace', name: 'Lifecycle Timeline', selector: '.eva-marketplace-timeline', className: 'eva-marketplace-timeline', source: 'marketplace', status: 'stable', properties: ['steps', 'activeStep', 'completedSteps'] }
]);

export const DESIGN_SYSTEM_COMPATIBILITY = freezeList([
  { selector: '.glass-card', status: 'compatibility', replacement: '[data-ui="surface"][data-glass="surface"]', rule: 'Existing production markup may keep this class. New Studio components must declare the canonical data contracts.' },
  { selector: '.btn-theme-primary', status: 'compatibility', replacement: '.eva-control[data-ui="control"][data-glass="control"] plus the existing primary material class', rule: 'Keep the class only as a material variant hook.' },
  { selector: '.btn-theme-secondary', status: 'compatibility', replacement: '.eva-control[data-ui="control"][data-glass="control"] plus the existing secondary material class', rule: 'Keep the class only as a material variant hook.' },
  { selector: '.input-shell', status: 'compatibility', replacement: '[data-ui="control"][data-glass="control"]', rule: 'New fields must use domain field anatomy and central focus tokens.' },
  { selector: '.aurora-card', status: 'compatibility', replacement: '[data-ui="surface"]', rule: 'Decoration hook only; it may not own structural spacing or material paint.' },
  { selector: '.active-glow', status: 'compatibility', replacement: '[data-state="active"]', rule: 'Use explicit state metadata for new components.' },
  { selector: '.beam-target', status: 'runtime-hook', replacement: '[data-interactive="true"]', rule: 'Pointer-effect hook only; it may not define component anatomy.' },
  { selector: '.item', status: 'domain-compatibility', replacement: 'A registered workflow, communication, or Marketplace card contract', rule: 'Do not introduce new globally generic item cards.' },
  { selector: '.pill', status: 'domain-compatibility', replacement: 'A registered semantic status or metadata component', rule: 'New pills must declare semantic purpose and tone.' },
  { selector: 'page-level material paint', status: 'deprecated', replacement: 'theme/liquid-optics.css custom-property presets', rule: 'Pages may compose layout but may not create independent glass fills, blur engines, or shadow systems.' }
]);

export function getDesignSystemLayer(id) {
  return DESIGN_SYSTEM_LAYERS.find((layer) => layer.id === id) || null;
}

export function getDesignSystemComponent(id) {
  return DESIGN_SYSTEM_COMPONENTS.find((component) => component.id === id) || null;
}

export function designSystemComponentsByCategory() {
  return DESIGN_SYSTEM_COMPONENTS.reduce((groups, component) => {
    if (!groups[component.category]) groups[component.category] = [];
    groups[component.category].push(component);
    return groups;
  }, {});
}

export function getCompatibilityContract(selector) {
  return DESIGN_SYSTEM_COMPATIBILITY.find((entry) => entry.selector === selector) || null;
}

export function studioReadyComponents() {
  return DESIGN_SYSTEM_COMPONENTS.filter((component) => component.status === 'stable');
}

export const EVARA_DESIGN_SYSTEM_REGISTRY = Object.freeze({
  version: DESIGN_SYSTEM_VERSION,
  registryVersion: DESIGN_SYSTEM_REGISTRY_VERSION,
  bundle: '/assets/css/design-system.css?v=2',
  prerequisites: ['/assets/css/base.css', '/assets/css/theme.css'],
  materialAuthority: '/assets/css/theme/liquid-optics.css',
  layers: DESIGN_SYSTEM_LAYERS,
  components: DESIGN_SYSTEM_COMPONENTS,
  compatibility: DESIGN_SYSTEM_COMPATIBILITY
});

if (typeof window !== 'undefined') {
  window.EvaraDesignSystemRegistry = EVARA_DESIGN_SYSTEM_REGISTRY;
}
