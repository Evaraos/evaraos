import { getSavedUserProfile, getSavedUserRole, normalizeRole } from '../firebase.js';
import { STUDIO_COMPONENTS } from './component-registry.js';

const OWNER_ROLES = new Set(['owner', 'super_admin', 'admin']);
const STORAGE_KEY = 'evaraos-studio-visual-builder-v1';
const LIVE_KEY = 'evaraos-studio-visual-builder-live-v1';
const HISTORY_LIMIT = 40;
const DEVICES = new Set(['desktop', 'tablet', 'mobile']);
const ROLES = ['owner', 'admin', 'manager', 'sales', 'technician', 'cleaner', 'customer', 'vendor'];
const ICONS = ['◈', '✦', '＋', '▣', '⬢', '▧', '◎', '◬', '◆', '↗'];
const ALLOWED_SPANS = new Set([3, 4, 6, 8, 12]);
const COMPONENT_TYPES = new Set(['hero-block', ...STUDIO_COMPONENTS.map((item) => item.id)]);

const PAGE_LIBRARY = [
  { id: 'owner-dashboard', name: 'Owner Dashboard', route: '/dashboard.html', role: 'owner' },
  { id: 'customer-portal', name: 'Customer Portal', route: '/customer_dashboard.html', role: 'customer' },
  { id: 'jobs', name: 'Jobs', route: '/jobs.html', role: 'technician' },
  { id: 'leads', name: 'Leads', route: '/leads.html', role: 'sales' },
  { id: 'settings', name: 'Settings', route: '/settings-v2.html', role: 'owner' }
];

const DEFAULT_ASSETS = [
  { id: 'evara-app-icon', name: 'EvaraOS App Icon', url: '/assets/brand/evaraos-app-icon.png' },
  { id: 'evara-brand-mark', name: 'EvaraOS Brand Mark', url: '/assets/brand/evaraos-mark.png' }
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || min));
const text = (value, max = 500) => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, max);
const hexColor = (value) => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : '#f2172d';
const uid = (prefix = 'node') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const clone = (value) => JSON.parse(JSON.stringify(value));

function safeAssetUrl(value) {
  const candidate = text(value, 1000);
  if (candidate.startsWith('/')) return candidate;
  try {
    const url = new URL(candidate, location.origin);
    return url.origin === location.origin && ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = text(options.text, options.maxText || 2000);
  if (options.type) node.type = options.type;
  if (options.title) node.title = text(options.title, 200);
  if (options.value !== undefined) node.value = String(options.value);
  if (options.checked !== undefined) node.checked = Boolean(options.checked);
  if (options.disabled !== undefined) node.disabled = Boolean(options.disabled);
  if (options.draggable !== undefined) node.draggable = Boolean(options.draggable);
  if (options.hidden !== undefined) node.hidden = Boolean(options.hidden);
  if (options.contentEditable !== undefined) node.contentEditable = String(Boolean(options.contentEditable));
  if (options.attrs) Object.entries(options.attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  if (options.dataset) Object.entries(options.dataset).forEach(([key, value]) => { node.dataset[key] = String(value); });
  const list = Array.isArray(children) ? children : [children];
  list.filter(Boolean).forEach((child) => node.append(child));
  return node;
}

function defaultVisibility(role = 'owner') {
  return { roles: Object.fromEntries(ROLES.map((item) => [item, item === role || item === 'owner' || item === 'admin'])) };
}

function createNode(type, overrides = {}) {
  const normalizedType = COMPONENT_TYPES.has(type) ? type : 'glass-card';
  const component = STUDIO_COMPONENTS.find((item) => item.id === normalizedType);
  const role = ROLES.includes(overrides.role) ? overrides.role : 'owner';
  const base = {
    id: uid(normalizedType),
    type: normalizedType,
    span: normalizedType === 'map-block' || normalizedType === 'image-block' ? 8 : 4,
    props: { ...(component?.defaults || {}) },
    style: { radius: 28, glass: 72 },
    visibility: defaultVisibility(role)
  };
  if (normalizedType === 'hero-block') {
    base.span = 12;
    base.props = {
      eyebrow: 'EVARAOS OPERATING SYSTEM',
      title: 'Run the entire business from one intelligent workspace.',
      body: 'Manage customers, teams, jobs, revenue, service delivery, and growth without switching between disconnected tools.',
      action: 'Open Workspace'
    };
  }
  return normalizeNode({ ...base, ...overrides, props: { ...base.props, ...(overrides.props || {}) } }, role);
}

function normalizeNode(raw, fallbackRole = 'owner') {
  const type = COMPONENT_TYPES.has(raw?.type) ? raw.type : 'glass-card';
  const visibility = { roles: {} };
  ROLES.forEach((role) => {
    const supplied = raw?.visibility?.roles?.[role];
    visibility.roles[role] = typeof supplied === 'boolean' ? supplied : defaultVisibility(fallbackRole).roles[role];
  });
  const props = {};
  Object.entries(raw?.props || {}).slice(0, 30).forEach(([key, value]) => { props[text(key, 60)] = text(value, 2000); });
  return {
    id: /^[a-z0-9-]{3,120}$/i.test(String(raw?.id || '')) ? String(raw.id) : uid(type),
    type,
    span: ALLOWED_SPANS.has(Number(raw?.span)) ? Number(raw.span) : (type === 'hero-block' ? 12 : 4),
    props,
    style: { radius: clamp(raw?.style?.radius, 8, 48), glass: clamp(raw?.style?.glass, 20, 100) },
    visibility
  };
}

function defaultPages() {
  return PAGE_LIBRARY.map((page, index) => ({
    ...page,
    nodes: index === 0 ? [
      createNode('hero-block', { role: page.role }),
      createNode('metric-card', { role: page.role, props: { label: 'Revenue', value: '$124,800', trend: '+18.4%', icon: '$' }, span: 3 }),
      createNode('metric-card', { role: page.role, props: { label: 'Active Jobs', value: '248', trend: '+12 today', icon: '◬' }, span: 3 }),
      createNode('metric-card', { role: page.role, props: { label: 'Team', value: '42', trend: '96% active', icon: '◎' }, span: 3 }),
      createNode('metric-card', { role: page.role, props: { label: 'Customers', value: '1,284', trend: '+34 this week', icon: '◆' }, span: 3 }),
      createNode('glass-card', { role: page.role, props: { title: 'Today at a glance', body: 'Everything requiring your attention appears here automatically.', icon: '✦' }, span: 4 }),
      createNode('map-block', { role: page.role, props: { title: 'Live Operations Map', locationSource: 'jobs', zoom: 'city' }, span: 8 })
    ] : [
      createNode('hero-block', { role: page.role, props: { eyebrow: page.name.toUpperCase(), title: `Build the ${page.name} visually.`, body: 'Select any element, edit it directly, and assemble the experience from reusable EvaraOS components.', action: 'Get Started' } }),
      createNode('glass-card', { role: page.role, props: { title: `${page.name} overview`, body: 'This page is ready for visual editing.', icon: '◈' }, span: 6 }),
      createNode('metric-card', { role: page.role, props: { label: 'Status', value: 'Ready', trend: 'Draft', icon: '✦' }, span: 6 })
    ]
  }));
}

function defaultState() {
  return {
    version: 2,
    activePageId: 'owner-dashboard',
    selectedNodeId: null,
    device: 'desktop',
    previewRole: 'owner',
    preview: false,
    activeSheet: null,
    theme: { accent: '#f2172d', radius: 28, glass: 72 },
    pages: defaultPages(),
    assets: DEFAULT_ASSETS,
    updatedAt: new Date().toISOString()
  };
}

function normalizeState(raw) {
  const fallback = defaultState();
  const pages = PAGE_LIBRARY.map((definition) => {
    const saved = Array.isArray(raw?.pages) ? raw.pages.find((page) => page?.id === definition.id) : null;
    return {
      ...definition,
      nodes: Array.isArray(saved?.nodes) && saved.nodes.length <= 100
        ? saved.nodes.map((node) => normalizeNode(node, definition.role))
        : fallback.pages.find((page) => page.id === definition.id).nodes
    };
  });
  const assets = Array.isArray(raw?.assets) ? raw.assets.slice(0, 100).map((asset) => ({
    id: text(asset?.id, 100) || uid('asset'),
    name: text(asset?.name, 160) || 'Asset',
    url: safeAssetUrl(asset?.url)
  })).filter((asset) => asset.url) : DEFAULT_ASSETS;
  return {
    ...fallback,
    activePageId: PAGE_LIBRARY.some((page) => page.id === raw?.activePageId) ? raw.activePageId : fallback.activePageId,
    selectedNodeId: text(raw?.selectedNodeId, 120) || null,
    device: DEVICES.has(raw?.device) ? raw.device : 'desktop',
    previewRole: ROLES.includes(raw?.previewRole) ? raw.previewRole : 'owner',
    preview: Boolean(raw?.preview),
    activeSheet: ['add', 'pages', 'assets', 'roles', 'style'].includes(raw?.activeSheet) ? raw.activeSheet : null,
    theme: { accent: hexColor(raw?.theme?.accent), radius: clamp(raw?.theme?.radius, 8, 48), glass: clamp(raw?.theme?.glass, 20, 100) },
    pages,
    assets: assets.length ? assets : DEFAULT_ASSETS
  };
}

function readState() {
  try { return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')); }
  catch { return defaultState(); }
}

function currentRole() {
  const profile = getSavedUserProfile?.() || {};
  return normalizeRole?.(profile.role || getSavedUserRole?.() || '') || '';
}

function isAllowed() { return OWNER_ROLES.has(currentRole()); }

let state = readState();
let history = [];
let future = [];
let editSnapshot = null;
let dragType = null;
let booted = false;

const activePage = () => state.pages.find((page) => page.id === state.activePageId) || state.pages[0];
const selectedNode = () => activePage()?.nodes?.find((node) => node.id === state.selectedNodeId) || null;
const roleCanSee = (node, role = state.previewRole) => node?.visibility?.roles?.[role] !== false;

function persist() {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function snapshot() {
  history.push(clone(state));
  if (history.length > HISTORY_LIMIT) history.shift();
  future = [];
}

function mutate(callback) {
  snapshot();
  callback(state);
  state = normalizeState(state);
  persist();
  renderApp();
}

function undo() {
  if (!history.length) return;
  future.push(clone(state));
  state = normalizeState(history.pop());
  persist();
  renderApp();
}

function redo() {
  if (!future.length) return;
  history.push(clone(state));
  state = normalizeState(future.pop());
  persist();
  renderApp();
}

function toast(message) {
  let node = document.querySelector('.studio-toast');
  if (!node) {
    node = el('div', { className: 'studio-toast' });
    document.body.append(node);
  }
  node.textContent = text(message, 240);
  node.classList.add('is-visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('is-visible'), 1800);
}

function editable(tag, field, value, className = '') {
  return el(tag, { className, text: value, dataset: { editableText: 'true', field } });
}

function nodeShell(node, className, children) {
  const shell = el('article', {
    className: `studio-node ${className}${node.id === state.selectedNodeId ? ' is-selected' : ''}`,
    dataset: { nodeId: node.id, nodeType: node.type, span: node.span, hiddenInPreview: String(!roleCanSee(node)) }
  }, [el('span', { className: 'studio-node-badge', text: node.type.replaceAll('-', ' ') }), ...children]);
  shell.style.setProperty('--node-radius', `${clamp(node.style.radius, 8, 48)}px`);
  shell.style.setProperty('--node-glass', String(clamp(node.style.glass, 20, 100)));
  shell.style.setProperty('--node-glass-opacity', String(clamp(node.style.glass, 20, 100) / 100));
  return shell;
}

function renderNode(node) {
  const props = node.props || {};
  if (node.type === 'hero-block') {
    return nodeShell(node, 'studio-hero-block', [el('div', { className: 'studio-hero-content' }, [
      editable('span', 'eyebrow', props.eyebrow || 'Page', 'studio-eyebrow'),
      editable('h1', 'title', props.title || 'Build visually'),
      editable('p', 'body', props.body || ''),
      editable('button', 'action', props.action || 'Continue', 'studio-canvas-cta')
    ])]);
  }
  if (node.type === 'metric-card') {
    return nodeShell(node, 'studio-metric-block', [el('div', {}, [
      editable('small', 'label', props.label || 'Metric'),
      editable('strong', 'value', props.value || '0'),
      editable('em', 'trend', props.trend || '+0%')
    ])]);
  }
  if (node.type === 'map-block') {
    return nodeShell(node, 'studio-map-block', [
      editable('h3', 'title', props.title || 'Map'),
      el('div', { className: 'studio-map-surface', text: 'Live map preview' })
    ]);
  }
  if (node.type === 'image-block') {
    const asset = state.assets.find((item) => item.id === props.assetId) || state.assets[0];
    const surface = el('div', { className: 'studio-image-surface' });
    const url = safeAssetUrl(asset?.url);
    if (url) surface.append(el('img', { attrs: { src: url, alt: 'Studio asset preview' } }));
    else surface.textContent = 'Choose image';
    return nodeShell(node, 'studio-image-block', [surface, editable('small', 'caption', props.caption || 'Image caption')]);
  }
  if (node.type === 'action-button') {
    return nodeShell(node, 'studio-button-block', [editable('button', 'label', props.label || 'Continue', 'studio-canvas-cta')]);
  }
  const icon = el('button', { className: 'studio-node-icon', type: 'button', text: props.icon || '◈', attrs: { 'aria-label': 'Change icon' }, dataset: { iconField: 'icon' } });
  return nodeShell(node, 'studio-card-block', [icon, editable('h3', 'title', props.title || props.name || 'Glass card'), editable('p', 'body', props.body || props.notes || 'Editable reusable card.')]);
}

function renderCanvas() {
  const page = activePage();
  const canvas = el('div', { className: 'studio-canvas-page', dataset: { canvasDropzone: 'true' } });
  canvas.append(el('header', { className: 'studio-canvas-header' }, [
    el('div', { className: 'studio-canvas-brand' }, [el('span', { text: 'E' }), el('strong', { text: 'EvaraOS' })]),
    el('nav', { className: 'studio-canvas-nav' }, ['Overview', 'Operations', 'Growth', 'Settings'].map((label) => el('span', { text: label })))
  ]));
  page.nodes.filter((node) => node.type === 'hero-block').forEach((node) => canvas.append(renderNode(node)));
  const grid = el('section', { className: 'studio-node-grid' });
  page.nodes.filter((node) => node.type !== 'hero-block').forEach((node) => grid.append(renderNode(node)));
  canvas.append(grid, el('div', { className: 'studio-drop-indicator', text: 'Drop component here' }));
  return canvas;
}

function renderTopbar() {
  const pageSelect = el('select', { className: 'studio-page-picker', attrs: { 'aria-label': 'Select page' }, dataset: { pagePicker: 'true' } });
  state.pages.forEach((page) => {
    const option = el('option', { value: page.id, text: page.name });
    option.selected = page.id === state.activePageId;
    pageSelect.append(option);
  });
  const roleSelect = el('select', { attrs: { 'aria-label': 'Preview role' }, dataset: { previewRole: 'true' } });
  ROLES.forEach((role) => {
    const option = el('option', { value: role, text: role });
    option.selected = role === state.previewRole;
    roleSelect.append(option);
  });
  const topbar = el('header', { className: 'studio-topbar' });
  topbar.append(
    el('div', { className: 'studio-brand-cluster' }, [
      el('div', { className: 'studio-mark', text: 'E' }),
      el('div', { className: 'studio-brand-copy' }, [el('strong', { text: 'Evara Studio' }), el('span', { text: 'Visual operating system builder' })]),
      pageSelect
    ]),
    el('div', { className: 'studio-viewport-switcher', attrs: { 'aria-label': 'Viewport' } }, ['desktop', 'tablet', 'mobile'].map((device) => el('button', { type: 'button', className: state.device === device ? 'is-active' : '', text: device === 'desktop' ? '▱' : device === 'tablet' ? '▯' : '▥', title: device, dataset: { device } }))),
    el('div', { className: 'studio-top-actions' }, [
      el('div', { className: 'studio-role-preview' }, [roleSelect]),
      el('button', { type: 'button', className: 'studio-icon-button', text: '↶', title: 'Undo', disabled: history.length === 0, dataset: { action: 'undo' } }),
      el('button', { type: 'button', className: 'studio-icon-button', text: '↷', title: 'Redo', disabled: future.length === 0, dataset: { action: 'redo' } }),
      el('button', { type: 'button', className: 'studio-text-button', text: state.preview ? 'Edit' : 'Preview', dataset: { action: 'preview' } }),
      el('button', { type: 'button', className: 'studio-text-button', text: 'Save', dataset: { action: 'save' } }),
      el('button', { type: 'button', className: 'studio-primary-button', text: 'Publish', dataset: { action: 'publish' } })
    ])
  );
  return topbar;
}

function renderDock() {
  const dock = el('nav', { className: 'studio-dock', attrs: { 'aria-label': 'Studio tools' } });
  [['add', '＋', 'Add'], ['pages', '▤', 'Pages'], ['assets', '▧', 'Assets'], ['roles', '◎', 'Roles'], ['style', '✦', 'Style']].forEach(([id, icon, label]) => {
    dock.append(el('button', { type: 'button', className: `studio-dock-button${state.activeSheet === id ? ' is-active' : ''}`, dataset: { sheet: id } }, [el('span', { text: icon }), el('small', { text: label })]));
  });
  return dock;
}

function sheetHeader(title, copy) {
  return el('div', { className: 'studio-sheet-header' }, [
    el('div', {}, [el('h2', { text: title }), el('p', { text: copy })]),
    el('button', { type: 'button', className: 'studio-sheet-close', text: '×', attrs: { 'aria-label': 'Close' }, dataset: { closeSheet: 'true' } })
  ]);
}

function renderAddSheet(sheet) {
  sheet.append(sheetHeader('Add anything', 'Drag a block onto the canvas or click once to add it.'));
  const list = el('div', { className: 'studio-component-list' });
  STUDIO_COMPONENTS.filter((item) => item.id !== 'dev-block').forEach((component) => list.append(el('button', {
    type: 'button', className: 'studio-component-tile', draggable: true, dataset: { addComponent: component.id }
  }, [el('span', { text: component.icon }), el('div', {}, [el('strong', { text: component.name }), el('small', { text: component.description })]), el('em', { text: '＋' })])));
  sheet.append(list);
}

function renderPagesSheet(sheet) {
  sheet.append(sheetHeader('Pages', 'Switch pages without leaving the visual canvas.'));
  const list = el('div', { className: 'studio-page-list' });
  state.pages.forEach((page) => list.append(el('button', { type: 'button', className: `studio-page-tile studio-component-tile${page.id === state.activePageId ? ' is-active' : ''}`, dataset: { openPage: page.id } }, [el('span', { text: '▤' }), el('div', {}, [el('strong', { text: page.name }), el('small', { text: `${page.route} • ${page.role}` })]), el('em', { text: '›' })])));
  sheet.append(list);
}

function renderAssetsSheet(sheet) {
  sheet.append(sheetHeader('Assets', 'Select an image to apply it to the chosen image block.'));
  const list = el('div', { className: 'studio-asset-list' });
  state.assets.forEach((asset) => {
    const thumb = el('span', { className: 'studio-asset-thumb' });
    const url = safeAssetUrl(asset.url);
    if (url) thumb.append(el('img', { attrs: { src: url, alt: '' } }));
    list.append(el('button', { type: 'button', className: 'studio-asset-tile studio-component-tile', dataset: { applyAsset: asset.id } }, [thumb, el('div', {}, [el('strong', { text: asset.name }), el('small', { text: asset.url })]), el('em', { text: 'Use' })]));
  });
  sheet.append(list, el('div', { className: 'studio-sheet-actions' }, [el('button', { type: 'button', text: 'Open Brand Library', dataset: { action: 'open-brand' } })]));
}

function renderRolesSheet(sheet) {
  const node = selectedNode();
  sheet.append(sheetHeader('Role visibility', node ? 'Every component has explicit role access.' : 'Select a component first.'));
  if (!node) {
    sheet.append(el('div', { className: 'studio-empty-state', text: 'Click any component on the canvas, then choose exactly which roles can see it.' }));
    return;
  }
  const list = el('div', { className: 'studio-role-list' });
  ROLES.forEach((role) => list.append(el('label', { className: 'studio-role-row' }, [
    el('div', {}, [el('strong', { text: role }), el('span', { text: roleCanSee(node, role) ? 'Visible' : 'Hidden' })]),
    el('input', { type: 'checkbox', checked: roleCanSee(node, role), dataset: { roleVisibility: role } })
  ])));
  sheet.append(list);
}

function styleField(label, control) {
  return el('div', { className: 'studio-style-field' }, [el('label', { text: label }), control]);
}

function renderStyleSheet(sheet) {
  const node = selectedNode();
  sheet.append(sheetHeader(node ? 'Component style' : 'Page style', node ? 'Change only the selected component.' : 'Change the page theme and future components.'));
  const grid = el('div', { className: 'studio-style-grid' });
  grid.append(
    styleField('Accent', el('input', { type: 'color', value: state.theme.accent, dataset: { styleField: 'accent' } })),
    styleField(`Corner radius ${node?.style?.radius ?? state.theme.radius}px`, el('input', { type: 'range', value: node?.style?.radius ?? state.theme.radius, attrs: { min: 8, max: 48 }, dataset: { styleField: 'radius' } })),
    styleField(`Glass strength ${node?.style?.glass ?? state.theme.glass}%`, el('input', { type: 'range', value: node?.style?.glass ?? state.theme.glass, attrs: { min: 20, max: 100 }, dataset: { styleField: 'glass' } }))
  );
  if (node) {
    const select = el('select', { dataset: { styleField: 'span' } });
    [[3, 'Quarter'], [4, 'Third'], [6, 'Half'], [8, 'Two thirds'], [12, 'Full width']].forEach(([value, label]) => {
      const option = el('option', { value, text: label });
      option.selected = node.span === value;
      select.append(option);
    });
    grid.append(styleField('Width', select));
  }
  sheet.append(grid);
}

function renderSheet() {
  if (!state.activeSheet) return null;
  const sheet = el('aside', { className: 'studio-sheet', dataset: { studioSheet: 'true' } });
  if (state.activeSheet === 'add') renderAddSheet(sheet);
  else if (state.activeSheet === 'pages') renderPagesSheet(sheet);
  else if (state.activeSheet === 'assets') renderAssetsSheet(sheet);
  else if (state.activeSheet === 'roles') renderRolesSheet(sheet);
  else renderStyleSheet(sheet);
  return sheet;
}

function renderContextToolbar() {
  const toolbar = el('div', { className: 'studio-context-toolbar', hidden: !state.selectedNodeId || state.preview, dataset: { contextToolbar: 'true' } });
  [['edit', 'Edit'], ['style', 'Style'], ['roles', 'Roles'], ['up', '↑'], ['down', '↓'], ['duplicate', 'Duplicate'], ['delete', 'Delete']].forEach(([action, label]) => toolbar.append(el('button', { type: 'button', text: label, dataset: { contextAction: action } })));
  return toolbar;
}

function renderApp() {
  document.documentElement.style.setProperty('--studio-accent', state.theme.accent);
  document.documentElement.style.setProperty('--studio-radius', `${state.theme.radius}px`);
  document.documentElement.style.setProperty('--studio-glass-blur', `${Math.max(14, state.theme.glass / 2)}px`);
  const root = document.querySelector('#appRoot');
  if (!root) return;
  const main = el('main', { className: `visual-studio${state.preview ? ' is-preview' : ''}`, dataset: { visualStudio: 'true' } });
  const workspace = el('section', { className: 'studio-workspace' });
  const stage = el('div', { className: `studio-stage${state.preview ? ' is-previewing' : ''}`, dataset: { device: state.device } }, [renderCanvas()]);
  workspace.append(renderDock());
  const sheet = renderSheet();
  if (sheet) workspace.append(sheet);
  workspace.append(el('div', { className: 'studio-stage-scroll' }, [stage]), renderContextToolbar());
  main.append(renderTopbar(), workspace);
  root.replaceChildren(main);
  requestAnimationFrame(positionToolbar);
}

function positionToolbar() {
  const toolbar = document.querySelector('[data-context-toolbar]');
  const selected = state.selectedNodeId ? document.querySelector(`[data-node-id="${CSS.escape(state.selectedNodeId)}"]`) : null;
  if (!toolbar || !selected || state.preview) return;
  const rect = selected.getBoundingClientRect();
  toolbar.style.left = `${Math.min(window.innerWidth - 16, Math.max(16, rect.left + rect.width / 2))}px`;
  toolbar.style.top = `${Math.max(144, rect.top - 10)}px`;
}

function selectNode(nodeId) {
  state.selectedNodeId = text(nodeId, 120) || null;
  persist();
  renderApp();
}

function startInlineEdit(field) {
  const node = selectedNode();
  if (!node || state.preview) return;
  const target = document.querySelector(`[data-node-id="${CSS.escape(node.id)}"] [data-field="${CSS.escape(field || '')}"]`);
  if (!target) return;
  editSnapshot = clone(state);
  target.contentEditable = 'true';
  target.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(target);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function finishInlineEdit(element) {
  if (element.contentEditable !== 'true') return;
  element.contentEditable = 'false';
  const node = selectedNode();
  const field = text(element.dataset.field, 60);
  if (!node || !field) return;
  const next = text(element.textContent, 2000).trim();
  if (node.props[field] === next) { editSnapshot = null; return; }
  if (editSnapshot) {
    history.push(editSnapshot);
    if (history.length > HISTORY_LIMIT) history.shift();
    future = [];
  }
  node.props[field] = next;
  editSnapshot = null;
  persist();
  renderApp();
  toast('Text updated');
}

function addComponent(type) {
  const page = activePage();
  mutate(() => {
    const node = createNode(type, { role: page.role });
    if (node.type === 'image-block') node.props.assetId = state.assets[0]?.id || '';
    page.nodes.push(node);
    state.selectedNodeId = node.id;
    state.activeSheet = null;
  });
  toast('Component added');
}

function moveSelected(direction) {
  const page = activePage();
  const index = page.nodes.findIndex((node) => node.id === state.selectedNodeId);
  const next = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || next < 0 || next >= page.nodes.length) return;
  mutate(() => { [page.nodes[index], page.nodes[next]] = [page.nodes[next], page.nodes[index]]; });
}

function duplicateSelected() {
  const page = activePage();
  const index = page.nodes.findIndex((node) => node.id === state.selectedNodeId);
  if (index < 0) return;
  mutate(() => {
    const copy = clone(page.nodes[index]);
    copy.id = uid(copy.type);
    page.nodes.splice(index + 1, 0, copy);
    state.selectedNodeId = copy.id;
  });
  toast('Component duplicated');
}

function deleteSelected() {
  const page = activePage();
  const index = page.nodes.findIndex((node) => node.id === state.selectedNodeId);
  if (index < 0) return;
  mutate(() => { page.nodes.splice(index, 1); state.selectedNodeId = null; });
  toast('Component removed');
}

function cycleIcon() {
  const node = selectedNode();
  if (!node) return;
  mutate(() => { node.props.icon = ICONS[(ICONS.indexOf(node.props.icon) + 1 + ICONS.length) % ICONS.length]; });
}

function handleContextAction(action) {
  if (action === 'edit') startInlineEdit(document.querySelector(`[data-node-id="${CSS.escape(state.selectedNodeId || '')}"] [data-editable-text="true"]`)?.dataset.field);
  else if (action === 'style' || action === 'roles') { state.activeSheet = action; persist(); renderApp(); }
  else if (action === 'up' || action === 'down') moveSelected(action);
  else if (action === 'duplicate') duplicateSelected();
  else if (action === 'delete') deleteSelected();
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    const device = event.target.closest('[data-device]');
    if (device) { state.device = DEVICES.has(device.dataset.device) ? device.dataset.device : 'desktop'; persist(); renderApp(); return; }
    const node = event.target.closest('[data-node-id]');
    if (node && !state.preview) {
      state.selectedNodeId = node.dataset.nodeId;
      persist();
      if (event.target.closest('[data-icon-field]')) cycleIcon();
      else renderApp();
      return;
    }
    const sheet = event.target.closest('[data-sheet]');
    if (sheet) { state.activeSheet = state.activeSheet === sheet.dataset.sheet ? null : sheet.dataset.sheet; persist(); renderApp(); return; }
    if (event.target.closest('[data-close-sheet]')) { state.activeSheet = null; persist(); renderApp(); return; }
    const add = event.target.closest('[data-add-component]');
    if (add) { addComponent(add.dataset.addComponent); return; }
    const page = event.target.closest('[data-open-page]');
    if (page) { state.activePageId = page.dataset.openPage; state.selectedNodeId = null; state.activeSheet = null; persist(); renderApp(); return; }
    const asset = event.target.closest('[data-apply-asset]');
    if (asset) {
      const selected = selectedNode();
      if (!selected || selected.type !== 'image-block') { toast('Select an image block first'); return; }
      mutate(() => { selected.props.assetId = asset.dataset.applyAsset; });
      toast('Image applied');
      return;
    }
    const context = event.target.closest('[data-context-action]');
    if (context) { handleContextAction(context.dataset.contextAction); return; }
    const action = event.target.closest('[data-action]');
    if (!action) return;
    if (action.dataset.action === 'undo') undo();
    else if (action.dataset.action === 'redo') redo();
    else if (action.dataset.action === 'preview') { state.preview = !state.preview; state.activeSheet = null; persist(); renderApp(); }
    else if (action.dataset.action === 'save') { persist(); toast('Draft saved'); }
    else if (action.dataset.action === 'publish') { persist(); localStorage.setItem(LIVE_KEY, JSON.stringify({ ...state, publishedAt: new Date().toISOString() })); toast('Studio changes published'); }
    else if (action.dataset.action === 'open-brand') location.assign('/settings/icons.html');
  });

  document.addEventListener('dblclick', (event) => {
    const editableTarget = event.target.closest('[data-editable-text]');
    const node = event.target.closest('[data-node-id]');
    if (!editableTarget || !node || state.preview) return;
    state.selectedNodeId = node.dataset.nodeId;
    persist();
    renderApp();
    requestAnimationFrame(() => startInlineEdit(editableTarget.dataset.field));
  });

  document.addEventListener('focusout', (event) => {
    if (event.target.matches('[contenteditable="true"]')) finishInlineEdit(event.target);
  });

  document.addEventListener('keydown', (event) => {
    const editing = event.target.matches?.('[contenteditable="true"]');
    if (editing && event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.target.blur(); return; }
    if (editing && event.key === 'Escape') { event.preventDefault(); editSnapshot = null; renderApp(); return; }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); persist(); toast('Draft saved'); return; }
    if ((event.key === 'Delete' || event.key === 'Backspace') && state.selectedNodeId && !editing && !event.target.matches('input,select,textarea')) { event.preventDefault(); deleteSelected(); }
  });

  document.addEventListener('change', (event) => {
    if (event.target.matches('[data-page-picker]')) { state.activePageId = event.target.value; state.selectedNodeId = null; persist(); renderApp(); return; }
    if (event.target.matches('[data-preview-role]')) { state.previewRole = ROLES.includes(event.target.value) ? event.target.value : 'owner'; persist(); renderApp(); return; }
    if (event.target.matches('[data-role-visibility]')) {
      const node = selectedNode();
      if (!node) return;
      mutate(() => { node.visibility.roles[event.target.dataset.roleVisibility] = event.target.checked; });
      return;
    }
    if (event.target.matches('[data-style-field]')) {
      const node = selectedNode();
      const field = event.target.dataset.styleField;
      const value = event.target.value;
      mutate(() => {
        if (field === 'accent') state.theme.accent = hexColor(value);
        else if (field === 'span' && node) node.span = ALLOWED_SPANS.has(Number(value)) ? Number(value) : 4;
        else if (field === 'radius') (node ? node.style : state.theme).radius = clamp(value, 8, 48);
        else if (field === 'glass') (node ? node.style : state.theme).glass = clamp(value, 20, 100);
      });
    }
  });

  document.addEventListener('dragstart', (event) => {
    const component = event.target.closest('[data-add-component]');
    if (!component) return;
    dragType = component.dataset.addComponent;
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/plain', dragType);
    document.querySelector('[data-canvas-dropzone]')?.classList.add('is-dragging');
  });
  document.addEventListener('dragend', () => { dragType = null; document.querySelector('[data-canvas-dropzone]')?.classList.remove('is-dragging'); });
  document.addEventListener('dragover', (event) => { if (event.target.closest('[data-canvas-dropzone]')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } });
  document.addEventListener('drop', (event) => {
    if (!event.target.closest('[data-canvas-dropzone]')) return;
    event.preventDefault();
    const type = dragType || event.dataTransfer.getData('text/plain');
    document.querySelector('[data-canvas-dropzone]')?.classList.remove('is-dragging');
    if (COMPONENT_TYPES.has(type)) addComponent(type);
    dragType = null;
  });

  window.addEventListener('resize', positionToolbar);
  document.addEventListener('scroll', positionToolbar, true);
}

function boot() {
  if (booted) return;
  booted = true;
  document.body.classList.add('studio-visual-page');
  const root = document.querySelector('#appRoot');
  if (!isAllowed()) {
    if (root) root.replaceChildren(el('main', { attrs: { style: 'padding:140px 24px;text-align:center;color:white' } }, [el('h1', { text: 'Studio access restricted' }), el('p', { text: 'Only authorized owners and administrators can open Evara Studio.' })]));
    return;
  }
  bindEvents();
  renderApp();
}

window.addEventListener('evara:session-ready', boot, { once: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 450), { once: true });
else setTimeout(boot, 450);
