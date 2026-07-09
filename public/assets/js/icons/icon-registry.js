export const EVARA_ICON_REGISTRY_VERSION = 'icon-registry-v1';

const ICONS = [
  ['sparkles', 'Sparkles', ['general', 'ai', 'highlight'], [['path', { d: 'M12 3l1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1L6.5 8.5l4.1-1.4L12 3z' }], ['path', { d: 'M18.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z' }], ['path', { d: 'M5 15l.7 1.8 1.8.7-1.8.7L5 20l-.7-1.8-1.8-.7 1.8-.7L5 15z' }]]],
  ['plus', 'Add', ['general', 'create'], [['path', { d: 'M12 5v14M5 12h14' }]]],
  ['card', 'Card', ['layout', 'component'], [['rect', { x: '3', y: '5', width: '18', height: '14', rx: '3' }], ['path', { d: 'M7 9h10M7 13h7' }]]],
  ['text', 'Text', ['content', 'type'], [['path', { d: 'M5 5h14M12 5v14M8 19h8' }]]],
  ['chart', 'Analytics', ['analytics', 'metric'], [['path', { d: 'M4 19V9M10 19V5M16 19v-7M22 19H2' }]]],
  ['status', 'Status', ['state', 'health'], [['circle', { cx: '12', cy: '12', r: '8' }], ['path', { d: 'M8.5 12l2.2 2.2L15.8 9' }]]],
  ['form', 'Form', ['workflow', 'input'], [['rect', { x: '4', y: '3', width: '16', height: '18', rx: '3' }], ['path', { d: 'M8 8h8M8 12h8M8 16h5' }]]],
  ['upload', 'Upload', ['file', 'workflow'], [['path', { d: 'M12 16V4M7 9l5-5 5 5' }], ['path', { d: 'M5 14v5h14v-5' }]]],
  ['warning', 'Warning', ['state', 'alert'], [['path', { d: 'M12 3l10 18H2L12 3z' }], ['path', { d: 'M12 9v5M12 17.5h.01' }]]],
  ['settings', 'Settings', ['system', 'preferences'], [['circle', { cx: '12', cy: '12', r: '3' }], ['path', { d: 'M19.4 15a1.7 1.7 0 00.3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21h-4v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3v-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 001.9.3 1.7 1.7 0 001-1.5V3h4v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 00-.3 1.9 1.7 1.7 0 001.5 1h.1v4h-.1a1.7 1.7 0 00-1.5 1z' }]]],
  ['toggle', 'Preference', ['settings', 'control'], [['rect', { x: '3', y: '7', width: '18', height: '10', rx: '5' }], ['circle', { cx: '15.5', cy: '12', r: '3' }]]],
  ['conversation', 'Conversation', ['message', 'communication'], [['path', { d: 'M4 5h16v11H9l-5 4V5z' }], ['path', { d: 'M8 9h8M8 12h5' }]]],
  ['message', 'Message', ['communication', 'chat'], [['path', { d: 'M21 12a8 8 0 01-8 8H5l-2 2v-8a8 8 0 118-10' }], ['path', { d: 'M8 11h8M8 14h5' }]]],
  ['map', 'Map', ['location', 'operations'], [['path', { d: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z' }], ['path', { d: 'M9 3v15M15 6v15' }]]],
  ['location', 'Location', ['map', 'pin'], [['path', { d: 'M12 22s7-6.1 7-13a7 7 0 10-14 0c0 6.9 7 13 7 13z' }], ['circle', { cx: '12', cy: '9', r: '2.5' }]]],
  ['route', 'Route', ['tracking', 'operations'], [['circle', { cx: '5', cy: '18', r: '2' }], ['circle', { cx: '19', cy: '6', r: '2' }], ['path', { d: 'M7 18h4a3 3 0 003-3V9a3 3 0 013-3' }]]],
  ['briefcase', 'Job', ['work', 'field'], [['rect', { x: '3', y: '7', width: '18', height: '13', rx: '3' }], ['path', { d: 'M9 7V4h6v3M3 12h18M10 12v2h4v-2' }]]],
  ['service', 'Service', ['marketplace', 'offering'], [['path', { d: 'M12 3l8 4v5c0 5-3.4 8.2-8 9-4.6-.8-8-4-8-9V7l8-4z' }], ['path', { d: 'M8.5 12l2.2 2.2 4.8-5' }]]],
  ['timeline', 'Timeline', ['lifecycle', 'progress'], [['path', { d: 'M6 4v16M6 7h10M6 12h7M6 17h12' }], ['circle', { cx: '6', cy: '7', r: '1.5' }], ['circle', { cx: '6', cy: '12', r: '1.5' }], ['circle', { cx: '6', cy: '17', r: '1.5' }]]],
  ['image', 'Image', ['media', 'asset'], [['rect', { x: '3', y: '4', width: '18', height: '16', rx: '3' }], ['circle', { cx: '9', cy: '9', r: '2' }], ['path', { d: 'M4 17l5-5 4 4 2-2 5 4' }]]],
  ['code', 'Developer', ['advanced', 'code'], [['path', { d: 'M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14' }]]],
  ['home', 'Home', ['navigation', 'dashboard'], [['path', { d: 'M3 11l9-8 9 8' }], ['path', { d: 'M5 10v11h14V10M9 21v-7h6v7' }]]],
  ['users', 'Team', ['people', 'organization'], [['circle', { cx: '9', cy: '8', r: '3' }], ['circle', { cx: '17', cy: '9', r: '2.5' }], ['path', { d: 'M3 20c0-4 2.5-6 6-6s6 2 6 6M15 15c3 0 5 1.7 5 5' }]]],
  ['customer', 'Customer', ['people', 'account'], [['circle', { cx: '12', cy: '8', r: '4' }], ['path', { d: 'M4 21c0-5 3.2-8 8-8s8 3 8 8' }]]],
  ['vendor', 'Vendor', ['marketplace', 'partner'], [['path', { d: 'M4 10h16l-2-6H6l-2 6zM5 10v10h14V10M9 20v-6h6v6' }]]],
  ['calendar', 'Calendar', ['schedule', 'date'], [['rect', { x: '3', y: '5', width: '18', height: '16', rx: '3' }], ['path', { d: 'M7 3v4M17 3v4M3 10h18M7 14h3M14 14h3M7 18h3' }]]],
  ['clock', 'Time', ['schedule', 'time'], [['circle', { cx: '12', cy: '12', r: '9' }], ['path', { d: 'M12 7v5l3 2' }]]],
  ['dollar', 'Revenue', ['finance', 'metric'], [['circle', { cx: '12', cy: '12', r: '9' }], ['path', { d: 'M15.5 8.5c-.7-.8-1.8-1.2-3.3-1.2-1.8 0-3.2.9-3.2 2.3 0 3.5 6.5 1.7 6.5 5.1 0 1.5-1.4 2.4-3.4 2.4-1.5 0-2.8-.5-3.6-1.4M12 5v14' }]]],
  ['search', 'Search', ['general', 'find'], [['circle', { cx: '11', cy: '11', r: '7' }], ['path', { d: 'M16 16l5 5' }]]],
  ['arrow-right', 'Arrow Right', ['navigation', 'action'], [['path', { d: 'M5 12h14M14 7l5 5-5 5' }]]],
  ['check', 'Complete', ['state', 'success'], [['path', { d: 'M4 12l5 5L20 6' }]]],
  ['info', 'Information', ['state', 'help'], [['circle', { cx: '12', cy: '12', r: '9' }], ['path', { d: 'M12 11v6M12 7h.01' }]]],
  ['bell', 'Notification', ['alert', 'communication'], [['path', { d: 'M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4' }]]],
  ['ai', 'AI', ['intelligence', 'assistant'], [['circle', { cx: '12', cy: '12', r: '3' }], ['path', { d: 'M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3' }]]]
];

export const EVARA_ICONS = Object.freeze(ICONS.map(([id, name, keywords, nodes]) => Object.freeze({
  id,
  name,
  keywords: Object.freeze([...keywords]),
  nodes: Object.freeze(nodes.map(([tag, attrs]) => Object.freeze({ tag, attrs: Object.freeze({ ...attrs }) })))
})));

const ICON_MAP = new Map(EVARA_ICONS.map((icon) => [icon.id, icon]));
const LEGACY_ALIASES = Object.freeze({
  '◈': 'card', T: 'text', '＋': 'plus', '◬': 'chart', '●': 'status', '▤': 'form', '⇧': 'upload', '!': 'warning',
  '◆': 'settings', '◉': 'toggle', '◎': 'conversation', '✦': 'sparkles', '⬢': 'map', '⌖': 'route', '↗': 'briefcase',
  '◇': 'service', '⋮': 'timeline', '▧': 'image', '</>': 'code', '$': 'dollar', A: 'customer'
});

export const DEFAULT_COMPONENT_ICONS = Object.freeze({
  'glass-card': 'card', 'text-block': 'text', 'action-button': 'arrow-right', 'metric-card': 'chart', 'status-card': 'status',
  'workflow-form': 'form', 'upload-field': 'upload', 'notice-banner': 'warning', 'settings-panel': 'settings', 'preference-row': 'toggle',
  'conversation-row': 'conversation', 'message-bubble': 'message', 'map-block': 'map', 'tracking-card': 'route', 'field-card': 'briefcase',
  'service-card': 'service', 'timeline-card': 'timeline', 'image-block': 'image', 'dev-block': 'code'
});

export function normalizeEvaraIconId(value = '', fallback = 'sparkles') {
  const candidate = String(value || '').trim();
  if (ICON_MAP.has(candidate)) return candidate;
  if (LEGACY_ALIASES[candidate]) return LEGACY_ALIASES[candidate];
  return ICON_MAP.has(fallback) ? fallback : 'sparkles';
}

export function getEvaraIcon(id = '') {
  return ICON_MAP.get(normalizeEvaraIconId(id)) || ICON_MAP.get('sparkles');
}

export function searchEvaraIcons(query = '') {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return [...EVARA_ICONS];
  return EVARA_ICONS.filter((icon) => [icon.id, icon.name, ...icon.keywords].join(' ').toLowerCase().includes(needle));
}

export function createEvaraIconElement(id, options = {}) {
  const icon = getEvaraIcon(id);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', options.className || 'eva-icon');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', String(options.strokeWidth || 1.8));
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', options.decorative === false ? 'false' : 'true');
  svg.dataset.evaraIcon = icon.id;
  if (options.label) {
    svg.setAttribute('aria-label', String(options.label));
    svg.removeAttribute('aria-hidden');
    svg.setAttribute('role', 'img');
  }
  icon.nodes.forEach(({ tag, attrs }) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    svg.append(node);
  });
  return svg;
}

if (typeof window !== 'undefined') {
  window.EvaraIcons = Object.freeze({
    version: EVARA_ICON_REGISTRY_VERSION,
    icons: EVARA_ICONS,
    get: getEvaraIcon,
    search: searchEvaraIcons,
    normalize: normalizeEvaraIconId,
    create: createEvaraIconElement,
    componentDefaults: DEFAULT_COMPONENT_ICONS
  });
}
