import {
  auth,
  db,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  getSavedUserProfile
} from '../../firebase.js';
import { STUDIO_COMPONENTS } from '../component-registry.js';
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

const WORKBENCH_VERSION = 'studio-canvas-workbench-v5';
const LOCAL_PREFIX = 'evaraos-studio-workbench-v5:';
const MAX_ASSETS = 120;
const MAX_COMPONENTS = 80;
const MAX_VERSIONS = 30;
const ALLOWED_SPANS = [3, 4, 6, 8, 12];
const DEVICES = ['desktop', 'tablet', 'mobile'];
const ACTION_TYPES = ['navigate', 'open-modal', 'send-email', 'call', 'toggle-visibility'];
const TRIGGERS = ['click', 'submit', 'load'];
const STYLE_FIELDS = new Set([
  'background', 'backgroundColor', 'color', 'borderColor', 'borderWidth', 'borderStyle',
  'borderRadius', 'boxShadow', 'opacity', 'filter', 'fontFamily', 'fontSize', 'fontWeight',
  'lineHeight', 'letterSpacing', 'textAlign', 'textTransform', 'textDecoration', 'transition',
  'rotate', 'scale', 'objectFit', 'objectPosition'
]);

const state = {
  mounted: false,
  open: false,
  tab: 'inspector',
  busy: false,
  previewLogic: false,
  meta: null,
  observer: null,
  resize: null,
  spatialDrag: null,
  clipboard: null,
  status: 'Ready'
};

const storage = getStorage();
const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const text = (value, max = 500) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
const uid = (prefix = 'item') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const number = (value, fallback = 0, min = -100000, max = 100000) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = text(options.text, options.maxText || 3000);
  if (options.type) node.type = options.type;
  if (options.value !== undefined) node.value = String(options.value);
  if (options.checked !== undefined) node.checked = Boolean(options.checked);
  if (options.disabled !== undefined) node.disabled = Boolean(options.disabled);
  if (options.title) node.title = text(options.title, 300);
  if (options.dataset) Object.entries(options.dataset).forEach(([key, value]) => { node.dataset[key] = String(value); });
  if (options.attrs) Object.entries(options.attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  const list = Array.isArray(children) ? children : [children];
  list.filter(Boolean).forEach((child) => node.append(child));
  return node;
}

function profile() {
  return getSavedUserProfile?.() || {};
}

function companyId() {
  return text(profile().companyId || window.__EVARA_COMPANY_ID__ || '', 160);
}

function sandbox() {
  return window.EvaraCanvasSandbox || null;
}

function session() {
  return sandbox()?.getSession?.() || null;
}

function snapshot() {
  return session()?.snapshot?.() || null;
}

function graph() {
  return sandbox()?.getGraph?.() || null;
}

function projection() {
  return sandbox()?.getProjection?.() || null;
}

function walk(node, id) {
  if (!node) return null;
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = walk(child, id);
    if (found) return found;
  }
  return null;
}

function selectedIds() {
  return snapshot()?.selection?.selectedIds || [];
}

function selectedNode() {
  const id = selectedIds()[0];
  return id ? walk(projection()?.page, id) : null;
}

function frameNode() {
  return projection()?.page?.children?.find((node) => ['frame', 'container', 'panel'].includes(node.kind)) || projection()?.page || null;
}

function componentNodes() {
  return (frameNode()?.children || []).filter((node) => node.kind === 'component-instance');
}

function localKey() {
  return `${LOCAL_PREFIX}${companyId() || 'local'}:${snapshot()?.graphId || 'pending'}`;
}

function defaultMeta() {
  return {
    version: 5,
    assets: [],
    reusableComponents: [],
    versions: [],
    publish: {
      channel: 'production',
      slug: 'owner-dashboard',
      seoTitle: '',
      seoDescription: '',
      lastRelease: null
    },
    updatedAt: new Date().toISOString()
  };
}

function normalizeMeta(raw) {
  const fallback = defaultMeta();
  return {
    ...fallback,
    ...(raw || {}),
    assets: Array.isArray(raw?.assets) ? raw.assets.slice(0, MAX_ASSETS) : [],
    reusableComponents: Array.isArray(raw?.reusableComponents) ? raw.reusableComponents.slice(0, MAX_COMPONENTS) : [],
    versions: Array.isArray(raw?.versions) ? raw.versions.slice(0, MAX_VERSIONS) : [],
    publish: { ...fallback.publish, ...(raw?.publish || {}) }
  };
}

function readLocalMeta() {
  try {
    return normalizeMeta(JSON.parse(localStorage.getItem(localKey()) || 'null'));
  } catch {
    return defaultMeta();
  }
}

function persistLocalMeta() {
  if (!state.meta) return;
  state.meta.updatedAt = new Date().toISOString();
  localStorage.setItem(localKey(), JSON.stringify(state.meta));
}

async function readRemoteWorkbench() {
  const id = companyId();
  if (!id || !auth.currentUser) return null;
  const company = await getDoc(doc(db, 'companies', id));
  return company.exists() ? company.data()?.appBuilder?.studioWorkbench || null : null;
}

async function persistRemoteMeta() {
  const id = companyId();
  if (!id || !auth.currentUser) throw new Error('An authenticated company workspace is required.');
  const companyRef = doc(db, 'companies', id);
  const current = await getDoc(companyRef);
  const appBuilder = current.exists() && current.data()?.appBuilder ? current.data().appBuilder : {};
  await setDoc(companyRef, {
    appBuilder: {
      ...appBuilder,
      studioWorkbench: {
        ...clone(state.meta),
        graphId: snapshot()?.graphId || null,
        graphRevision: snapshot()?.graphRevision ?? null,
        updatedBy: auth.currentUser.uid,
        updatedAtMs: Date.now()
      }
    },
    appBuilderUpdatedAt: serverTimestamp()
  }, { merge: true });
}

function setStatus(message, tone = '') {
  state.status = text(message, 600) || 'Ready';
  const node = document.querySelector('[data-workbench-status]');
  if (node) {
    node.textContent = state.status;
    node.dataset.tone = tone;
  }
}

function setBusy(value, message = '') {
  state.busy = Boolean(value);
  document.querySelectorAll('[data-canvas-workbench] button,[data-canvas-workbench] input,[data-canvas-workbench] select,[data-canvas-workbench] textarea')
    .forEach((control) => { control.disabled = state.busy; });
  if (message) setStatus(message);
}

function safeUrl(value) {
  const raw = text(value, 1600);
  if (!raw) return '';
  if (raw.startsWith('/')) return raw;
  try {
    const url = new URL(raw, location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

async function dispatch(type, payload, statusMessage = '') {
  const api = sandbox();
  if (!api?.dispatch) throw new Error('Graph Canvas is not ready.');
  const result = await api.dispatch(type, payload);
  if (statusMessage) setStatus(statusMessage, 'success');
  return result;
}

async function setProperty(nodeId, property, value, statusMessage = '') {
  return dispatch('canvas.property.set', { nodeId, property, value }, statusMessage);
}

async function setLayout(nodeId, layout, statusMessage = '') {
  return dispatch('canvas.layout.set', { nodeId, layout }, statusMessage);
}

function field(label, control, help = '') {
  return el('label', { className: 'studio-workbench-field' }, [
    el('span', { text: label }),
    control,
    help ? el('small', { text: help }) : null
  ]);
}

function inputControl(path, value, type = 'text', options = {}) {
  return el('input', {
    type,
    value: value ?? '',
    checked: type === 'checkbox' ? Boolean(value) : undefined,
    dataset: { workbenchField: path, valueType: options.valueType || type },
    attrs: options.attrs || {}
  });
}

function selectControl(path, value, values) {
  const select = el('select', { dataset: { workbenchField: path, valueType: 'select' } });
  values.forEach((item) => {
    const pair = Array.isArray(item) ? item : [item, item];
    const option = el('option', { value: pair[0], text: pair[1] });
    option.selected = String(value ?? '') === String(pair[0]);
    select.append(option);
  });
  return select;
}

function button(label, action, options = {}) {
  return el('button', {
    type: 'button',
    className: options.className || '',
    text: label,
    title: options.title || '',
    disabled: options.disabled,
    dataset: { workbenchAction: action, ...(options.dataset || {}) }
  });
}

function section(title, copy = '') {
  return el('section', { className: 'studio-workbench-section' }, [
    el('header', {}, [el('h3', { text: title }), copy ? el('p', { text: copy }) : null])
  ]);
}

function selectedSummary() {
  const node = selectedNode();
  return node ? `${node.name} • ${node.componentType}` : 'Select a component on the Graph Canvas.';
}

function renderInspector() {
  const node = selectedNode();
  const root = el('div', { className: 'studio-workbench-stack' });
  const summary = section('Inspector', selectedSummary());
  if (!node || node.kind !== 'component-instance') {
    summary.append(el('div', { className: 'studio-workbench-empty', text: 'Select a component to edit content, layout, typography, appearance, effects, media, links, and component settings.' }));
    root.append(summary);
    return root;
  }

  const definition = STUDIO_COMPONENTS.find((item) => item.id === node.componentType);
  const content = section('Content', 'Fields come from the registered component contract.');
  const contentGrid = el('div', { className: 'studio-workbench-grid' });
  const fields = definition?.fields?.length ? definition.fields : Object.keys(node.content || {});
  fields.forEach((name) => {
    contentGrid.append(field(name.replaceAll('-', ' '), inputControl(`content.${name}`, node.content?.[name] ?? '')));
  });
  content.append(contentGrid);

  const layout = section('Layout', 'Grid, spatial positioning, constraints, spacing, and layer order.');
  const layoutGrid = el('div', { className: 'studio-workbench-grid' });
  layoutGrid.append(
    field('Mode', selectControl('layout.mode', node.layout.mode, ['grid', 'flow', 'spatial'])),
    field('Grid span', selectControl('layout.span', node.layout.sourceSpan, ALLOWED_SPANS.map((span) => [span, `${span}/12`]))),
    field('Width', inputControl('layout.width', node.layout.width, 'number', { valueType: 'number', attrs: { min: '40', max: '4000' } })),
    field('Height', inputControl('layout.height', node.layout.height, 'number', { valueType: 'number', attrs: { min: '40', max: '4000' } })),
    field('Min width', inputControl('layout.minWidth', node.layout.minWidth, 'number', { valueType: 'number' })),
    field('Max width', inputControl('layout.maxWidth', node.layout.maxWidth || 4000, 'number', { valueType: 'number' })),
    field('Min height', inputControl('layout.minHeight', node.layout.minHeight, 'number', { valueType: 'number' })),
    field('Max height', inputControl('layout.maxHeight', node.layout.maxHeight || 4000, 'number', { valueType: 'number' })),
    field('X', inputControl('layout.x', node.layout.x, 'number', { valueType: 'number' })),
    field('Y', inputControl('layout.y', node.layout.y, 'number', { valueType: 'number' })),
    field('Z index', inputControl('layout.zIndex', node.layout.zIndex, 'number', { valueType: 'number' })),
    field('Gap', inputControl('layout.gap', node.layout.gap, 'number', { valueType: 'number' })),
    field('Padding', inputControl('layout.padding', typeof node.layout.padding === 'number' ? node.layout.padding : 24, 'number', { valueType: 'number' })),
    field('Align', selectControl('layout.align', node.layout.align, ['start', 'center', 'end', 'stretch'])),
    field('Justify', selectControl('layout.justify', node.layout.justify, ['start', 'center', 'end', 'space-between']))
  );
  layout.append(layoutGrid, el('div', { className: 'studio-workbench-actions' }, [
    button('Back', 'layer-back'), button('Backward', 'layer-backward'), button('Forward', 'layer-forward'), button('Front', 'layer-front')
  ]));

  const style = node.style || {};
  const typography = section('Typography');
  const typographyGrid = el('div', { className: 'studio-workbench-grid' });
  typographyGrid.append(
    field('Font family', inputControl('style.fontFamily', style.fontFamily || 'Inter, system-ui')),
    field('Font size', inputControl('style.fontSize', style.fontSize || 16, 'number', { valueType: 'number' })),
    field('Weight', selectControl('style.fontWeight', style.fontWeight || 700, [300, 400, 500, 600, 700, 800, 900])),
    field('Line height', inputControl('style.lineHeight', style.lineHeight || 1.4, 'number', { valueType: 'number', attrs: { step: '0.05' } })),
    field('Letter spacing', inputControl('style.letterSpacing', style.letterSpacing || 0, 'number', { valueType: 'number', attrs: { step: '0.1' } })),
    field('Text align', selectControl('style.textAlign', style.textAlign || 'left', ['left', 'center', 'right', 'justify'])),
    field('Transform', selectControl('style.textTransform', style.textTransform || 'none', ['none', 'uppercase', 'lowercase', 'capitalize'])),
    field('Decoration', selectControl('style.textDecoration', style.textDecoration || 'none', ['none', 'underline', 'line-through'])),
    field('Text color', inputControl('style.color', style.color || '#11131a', 'color'))
  );
  typography.append(typographyGrid);

  const appearance = section('Appearance and effects');
  const appearanceGrid = el('div', { className: 'studio-workbench-grid' });
  appearanceGrid.append(
    field('Background', inputControl('style.backgroundColor', style.backgroundColor || '#ffffff', 'color')),
    field('Border color', inputControl('style.borderColor', style.borderColor || '#ffffff', 'color')),
    field('Border width', inputControl('style.borderWidth', style.borderWidth || 1, 'number', { valueType: 'number' })),
    field('Border style', selectControl('style.borderStyle', style.borderStyle || 'solid', ['none', 'solid', 'dashed', 'dotted', 'double'])),
    field('Radius', inputControl('style.radius', style.radius || 24, 'number', { valueType: 'number' })),
    field('Opacity', inputControl('style.opacity', style.opacity ?? 1, 'number', { valueType: 'number', attrs: { min: '0', max: '1', step: '0.05' } })),
    field('Shadow', inputControl('style.boxShadow', style.boxShadow || '0 18px 50px rgba(0,0,0,.14)')),
    field('Blur', inputControl('style.filter', style.filter || 'none')),
    field('Rotation', inputControl('style.rotate', style.rotate || 0, 'number', { valueType: 'number' })),
    field('Scale', inputControl('style.scale', style.scale || 1, 'number', { valueType: 'number', attrs: { min: '.1', max: '5', step: '.05' } })),
    field('Transition', inputControl('style.transition', style.transition || 'all .2s ease'))
  );
  appearance.append(appearanceGrid);

  const stateSection = section('Element state');
  stateSection.append(el('div', { className: 'studio-workbench-actions' }, [
    button(node.visibility?.locked ? 'Unlock' : 'Lock', 'toggle-lock'),
    button(node.visibility?.hidden ? 'Show' : 'Hide', 'toggle-hidden'),
    button('Duplicate', 'duplicate'),
    button('Delete', 'delete', { className: 'is-danger' })
  ]));

  root.append(content, layout, typography, appearance, stateSection);
  return root;
}

function renderComponents() {
  const root = el('div', { className: 'studio-workbench-stack' });
  const catalog = section('Component Catalog', 'Insert registered EvaraOS components into the authoritative graph.');
  const list = el('div', { className: 'studio-workbench-list' });
  STUDIO_COMPONENTS.filter((item) => item.id !== 'dev-block').forEach((item) => {
    list.append(el('button', {
      type: 'button',
      className: 'studio-workbench-component',
      dataset: { workbenchAction: 'insert-component', componentType: item.id }
    }, [
      el('span', { text: item.icon }),
      el('div', {}, [el('strong', { text: item.name }), el('small', { text: item.description })]),
      el('em', { text: '+' })
    ]));
  });
  catalog.append(list);

  const reusable = section('Reusable Components', selectedSummary());
  reusable.append(field('Component name', inputControl('reusable-name', selectedNode()?.name || 'Reusable component')),
    button('Save selected as reusable', 'save-reusable'));
  const saved = el('div', { className: 'studio-workbench-list' });
  if (!state.meta.reusableComponents.length) saved.append(el('div', { className: 'studio-workbench-empty', text: 'No reusable components saved yet.' }));
  state.meta.reusableComponents.forEach((item) => {
    saved.append(el('article', { className: 'studio-workbench-row' }, [
      el('div', {}, [el('strong', { text: item.name }), el('small', { text: item.componentType })]),
      el('div', { className: 'studio-workbench-actions' }, [
        button('Insert', 'insert-reusable', { dataset: { itemId: item.id } }),
        button('Delete', 'delete-reusable', { dataset: { itemId: item.id }, className: 'is-danger' })
      ])
    ]));
  });
  reusable.append(saved);
  root.append(catalog, reusable);
  return root;
}

function assetRow(item) {
  const preview = el('div', { className: 'studio-workbench-asset-preview' });
  if (item.type === 'video') {
    preview.append(el('video', { attrs: { src: item.url, muted: '', playsinline: '' } }));
  } else {
    preview.append(el('img', { attrs: { src: item.url, alt: '' } }));
  }
  return el('article', { className: 'studio-workbench-row is-asset' }, [
    preview,
    el('div', {}, [el('strong', { text: item.name }), el('small', { text: item.type })]),
    el('div', { className: 'studio-workbench-actions' }, [
      button('Apply', 'apply-asset', { dataset: { itemId: item.id } }),
      button('Delete', 'delete-asset', { dataset: { itemId: item.id }, className: 'is-danger' })
    ])
  ]);
}

function renderMedia() {
  const root = el('div', { className: 'studio-workbench-stack' });
  const upload = section('Media Manager', 'Upload images and videos to the company-scoped Firebase Storage library.');
  upload.append(
    field('Upload file', el('input', { type: 'file', dataset: { workbenchUpload: 'true' }, attrs: { accept: 'image/*,video/*' } })),
    el('div', { className: 'studio-workbench-grid' }, [
      field('External or app URL', inputControl('media-url', '', 'url')),
      field('Asset name', inputControl('media-name', '')),
      field('Type', selectControl('media-type', 'image', ['image', 'video']))
    ]),
    button('Add URL asset', 'add-url-asset')
  );
  const library = section('Asset Library', `${state.meta.assets.length} saved assets`);
  const list = el('div', { className: 'studio-workbench-list' });
  if (!state.meta.assets.length) list.append(el('div', { className: 'studio-workbench-empty', text: 'Upload or add an asset to begin.' }));
  state.meta.assets.forEach((item) => list.append(assetRow(item)));
  library.append(list);

  const node = selectedNode();
  const crop = section('Selected media settings', node ? selectedSummary() : 'Select a component first.');
  if (node) {
    crop.append(el('div', { className: 'studio-workbench-grid' }, [
      field('Alt text', inputControl('content.alt', node.content?.alt || '')),
      field('Object fit', selectControl('style.objectFit', node.style?.objectFit || 'cover', ['cover', 'contain', 'fill', 'none', 'scale-down'])),
      field('Object position', selectControl('style.objectPosition', node.style?.objectPosition || 'center', ['center', 'top', 'bottom', 'left', 'right']))
    ]));
  }
  root.append(upload, library, crop);
  return root;
}

function renderResponsive() {
  const root = el('div', { className: 'studio-workbench-stack' });
  const node = selectedNode();
  const panel = section('Responsive Builder', node ? selectedSummary() : 'Select a component first.');
  if (!node) {
    panel.append(el('div', { className: 'studio-workbench-empty', text: 'Select a component to set independent desktop, tablet, and mobile rules.' }));
  } else {
    DEVICES.forEach((device) => {
      const rules = node.responsive?.[device] || {};
      panel.append(el('div', { className: 'studio-workbench-device-card' }, [
        el('strong', { text: device }),
        el('div', { className: 'studio-workbench-grid' }, [
          field('Width', selectControl(`responsive.${device}.span`, rules.span || node.layout.sourceSpan, ALLOWED_SPANS.map((span) => [span, `${span}/12`]))),
          field('Visibility', selectControl(`responsive.${device}.visible`, rules.visible !== false, [['true', 'Visible'], ['false', 'Hidden']]))
        ])
      ]));
    });
  }
  root.append(panel);
  return root;
}

function renderLogic() {
  const root = el('div', { className: 'studio-workbench-stack' });
  const node = selectedNode();
  const panel = section('No-code Logic', node ? selectedSummary() : 'Select a component first.');
  if (!node) {
    panel.append(el('div', { className: 'studio-workbench-empty', text: 'Select a component to attach an interaction.' }));
  } else {
    const action = node.action || {};
    panel.append(el('div', { className: 'studio-workbench-grid' }, [
      field('Trigger', selectControl('action.trigger', action.trigger || 'click', TRIGGERS)),
      field('Action', selectControl('action.type', action.type || 'navigate', ACTION_TYPES.map((value) => [value, value.replaceAll('-', ' ')]))),
      field('Target or value', inputControl('action.value', action.value || '')),
      field('Open in', selectControl('action.target', action.target || 'same', [['same', 'Same window'], ['new', 'New window']]))
    ]),
    el('div', { className: 'studio-workbench-actions' }, [
      button(state.previewLogic ? 'Exit logic preview' : 'Preview logic', 'toggle-logic-preview'),
      button('Clear interaction', 'clear-logic')
    ]));
  }
  root.append(panel);
  return root;
}

function renderVersions() {
  const root = el('div', { className: 'studio-workbench-stack' });
  const create = section('Version History', 'Trusted checkpoints synchronize the graph before recording a restore point.');
  create.append(field('Version name', inputControl('version-name', `Version ${state.meta.versions.length + 1}`)), button('Create trusted version', 'create-version', { className: 'is-primary' }));
  const listSection = section('Restore Points', `${state.meta.versions.length} versions`);
  const list = el('div', { className: 'studio-workbench-list' });
  if (!state.meta.versions.length) list.append(el('div', { className: 'studio-workbench-empty', text: 'No trusted restore points yet.' }));
  state.meta.versions.forEach((item) => {
    list.append(el('article', { className: 'studio-workbench-row' }, [
      el('div', {}, [el('strong', { text: item.name }), el('small', { text: `${new Date(item.createdAt).toLocaleString()} • r${item.graphRevision}` })]),
      button('Restore', 'restore-version', { dataset: { itemId: item.id }, disabled: !item.checkpointId })
    ]));
  });
  listSection.append(list);
  root.append(create, listSection);
  return root;
}

function renderPublish() {
  const root = el('div', { className: 'studio-workbench-stack' });
  const publish = state.meta.publish;
  const panel = section('Publishing', 'Immutable releases require a synchronized graph, trusted checkpoint, App Check, and the server release service.');
  panel.append(el('div', { className: 'studio-workbench-grid' }, [
    field('Channel', selectControl('publish-channel', publish.channel, ['production', 'staging'])),
    field('Slug', inputControl('publish-slug', publish.slug)),
    field('SEO title', inputControl('publish-title', publish.seoTitle)),
    field('SEO description', el('textarea', { text: publish.seoDescription, dataset: { workbenchLocalField: 'publish-description' }, attrs: { maxlength: '320' } }))
  ]),
  el('div', { className: 'studio-workbench-actions' }, [
    button('Save workspace metadata', 'save-meta'),
    button('Prepare immutable release', 'publish', { className: 'is-primary' })
  ]));
  if (publish.lastRelease) panel.append(el('dl', { className: 'studio-workbench-release' }, [
    el('div', {}, [el('dt', { text: 'Release' }), el('dd', { text: publish.lastRelease.releaseId || 'confirmed' })]),
    el('div', {}, [el('dt', { text: 'Checkpoint' }), el('dd', { text: publish.lastRelease.checkpointId || 'confirmed' })]),
    el('div', {}, [el('dt', { text: 'Published' }), el('dd', { text: new Date(publish.lastRelease.publishedAt).toLocaleString() })])
  ]));
  root.append(panel);
  return root;
}

function renderBody() {
  if (state.tab === 'components') return renderComponents();
  if (state.tab === 'media') return renderMedia();
  if (state.tab === 'responsive') return renderResponsive();
  if (state.tab === 'logic') return renderLogic();
  if (state.tab === 'versions') return renderVersions();
  if (state.tab === 'publish') return renderPublish();
  return renderInspector();
}

function renderPanel() {
  const panel = document.querySelector('[data-canvas-workbench]');
  if (!panel) return;
  panel.classList.toggle('is-open', state.open);
  panel.querySelectorAll('[data-workbench-tab]').forEach((tab) => tab.classList.toggle('is-active', tab.dataset.workbenchTab === state.tab));
  const body = panel.querySelector('[data-workbench-body]');
  if (body) body.replaceChildren(renderBody());
  setStatus(state.status);
  applyPresentation();
}

function mountPanel() {
  if (document.querySelector('[data-canvas-workbench]')) return;
  const panel = el('aside', {
    className: 'studio-canvas-workbench',
    dataset: { canvasWorkbench: 'true', version: WORKBENCH_VERSION },
    attrs: { 'aria-label': 'Evara Studio workbench' }
  });
  const header = el('header', { className: 'studio-workbench-header' }, [
    el('div', {}, [el('small', { text: 'EVARA STUDIO' }), el('h2', { text: 'Graph Workbench' }), el('p', { text: 'All eight milestones on the trusted Canvas model' })]),
    button('×', 'close-workbench', { title: 'Close workbench' })
  ]);
  const tabs = el('nav', { className: 'studio-workbench-tabs' });
  [
    ['inspector', 'Inspector'], ['components', 'Components'], ['media', 'Media'], ['responsive', 'Responsive'],
    ['logic', 'Logic'], ['versions', 'Versions'], ['publish', 'Publish']
  ].forEach(([id, label]) => tabs.append(el('button', { type: 'button', text: label, dataset: { workbenchTab: id } })));
  panel.append(header, tabs, el('div', { className: 'studio-workbench-body', dataset: { workbenchBody: 'true' } }),
    el('footer', { className: 'studio-workbench-footer' }, [
      el('span', { text: 'Ready', dataset: { workbenchStatus: 'true' }, attrs: { role: 'status' } }),
      button('Save', 'save-meta', { className: 'is-primary' })
    ]));
  document.body.append(panel);
}

function injectWorkbenchToggle() {
  const headerTools = document.querySelector('.studio-canvas-sandbox-tools');
  if (!headerTools || headerTools.querySelector('[data-workbench-toggle]')) return;
  const toggle = el('button', {
    type: 'button',
    className: 'studio-canvas-sandbox-icon-button studio-workbench-toggle',
    text: 'Build',
    dataset: { workbenchToggle: 'true' },
    title: 'Open the full Graph Workbench'
  });
  headerTools.prepend(toggle);
}

function nodeRules(node) {
  const device = snapshot()?.viewport?.device || 'desktop';
  const responsive = node?.responsive?.[device] || {};
  return {
    hidden: node?.visibility?.hidden === true || responsive.visible === false,
    locked: node?.visibility?.locked === true,
    device
  };
}

function applyStyle(article, node) {
  const style = node?.style || {};
  STYLE_FIELDS.forEach((name) => {
    let value = style[name];
    if (value === undefined || value === null || value === '') return;
    if (['fontSize', 'borderWidth', 'borderRadius'].includes(name) && typeof value === 'number') value = `${value}px`;
    if (name === 'rotate') return;
    if (name === 'scale') return;
    article.style[name] = String(value);
  });
  const rotate = number(style.rotate, 0, -3600, 3600);
  const scale = number(style.scale, 1, 0.05, 20);
  const x = node.layout?.mode === 'spatial' ? number(node.layout.x, 0) : 0;
  const y = node.layout?.mode === 'spatial' ? number(node.layout.y, 0) : 0;
  article.style.transform = `translate(${x}px, ${y}px) rotate(${rotate}deg) scale(${scale})`;
  article.style.zIndex = String(node.layout?.zIndex || 0);
  article.style.maxWidth = node.layout?.maxWidth ? `${node.layout.maxWidth}px` : '';
  article.style.maxHeight = node.layout?.maxHeight ? `${node.layout.maxHeight}px` : '';
  if (node.layout?.mode === 'spatial') {
    article.style.width = `${node.layout.width}px`;
    article.style.height = `${node.layout.height}px`;
  }
}

function applyMedia(article, node) {
  article.querySelectorAll('[data-workbench-media]').forEach((item) => item.remove());
  const url = safeUrl(node.content?.assetUrl || node.content?.mediaUrl || '');
  if (!url) return;
  const type = node.content?.assetType === 'video' ? 'video' : 'image';
  const media = el(type === 'video' ? 'video' : 'img', {
    className: 'studio-workbench-node-media',
    dataset: { workbenchMedia: 'true' },
    attrs: type === 'video'
      ? { src: url, controls: '', playsinline: '', preload: 'metadata' }
      : { src: url, alt: text(node.content?.alt || node.name, 240), loading: 'lazy' }
  });
  media.style.objectFit = node.style?.objectFit || 'cover';
  media.style.objectPosition = node.style?.objectPosition || 'center';
  const content = article.querySelector('.studio-canvas-graph-card,.studio-canvas-graph-hero,.studio-canvas-graph-metric,.studio-canvas-graph-map');
  (content || article).prepend(media);
}

function addResizeHandles(article, node) {
  article.querySelectorAll('[data-workbench-resize]').forEach((handle) => handle.remove());
  article.querySelector('[data-sandbox-resize-handle]')?.setAttribute('hidden', '');
  if (!article.classList.contains('is-selected') || nodeRules(node).locked) return;
  ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach((direction) => {
    article.append(el('button', {
      type: 'button',
      className: `studio-workbench-resize is-${direction}`,
      dataset: { workbenchResize: direction, nodeId: node.id },
      attrs: { 'aria-label': `Resize ${direction}` }
    }));
  });
}

function applyPresentation() {
  const currentProjection = projection();
  if (!currentProjection?.page) return;
  document.querySelectorAll('[data-sandbox-node-id]').forEach((article) => {
    const node = walk(currentProjection.page, article.dataset.sandboxNodeId);
    if (!node) return;
    const rules = nodeRules(node);
    article.dataset.workbenchLocked = String(rules.locked);
    article.dataset.workbenchHidden = String(rules.hidden);
    article.draggable = !rules.locked && node.layout.mode !== 'spatial';
    article.setAttribute('aria-disabled', rules.locked ? 'true' : 'false');
    article.classList.toggle('is-workbench-hidden', rules.hidden);
    article.classList.toggle('is-workbench-locked', rules.locked);
    applyStyle(article, node);
    applyMedia(article, node);
    addResizeHandles(article, node);
  });
  document.body.classList.toggle('is-studio-logic-preview', state.previewLogic);
}

function readWorkbenchInput(path) {
  const control = document.querySelector(`[data-workbench-field="${CSS.escape(path)}"]`);
  if (!control) return '';
  if (control.type === 'checkbox') return control.checked;
  const valueType = control.dataset.valueType;
  if (valueType === 'number') return number(control.value, 0);
  if (valueType === 'select' && ['true', 'false'].includes(control.value)) return control.value === 'true';
  return control.value;
}

async function handleFieldChange(control) {
  const node = selectedNode();
  if (!node) return;
  const path = control.dataset.workbenchField;
  let value = control.type === 'checkbox' ? control.checked : control.value;
  if (control.dataset.valueType === 'number') value = number(value, 0);
  if (control.dataset.valueType === 'select' && ['true', 'false'].includes(value)) value = value === 'true';
  if (path.startsWith('layout.')) {
    await setLayout(node.id, { [path.slice(7)]: value }, `${path.slice(7)} updated.`);
  } else {
    await setProperty(node.id, path, value, `${path} updated.`);
  }
  renderPanel();
}

async function insertComponent(componentType, source = null) {
  const parent = frameNode();
  if (!parent) throw new Error('Canvas frame is unavailable.');
  const definition = STUDIO_COMPONENTS.find((item) => item.id === componentType);
  const content = clone(source?.content || definition?.defaults || { title: 'New component', body: 'Edit this component in the Graph Workbench.' });
  const result = await dispatch('canvas.component.insert', {
    parentId: parent.id,
    componentType,
    name: source?.name || definition?.name || componentType.replaceAll('-', ' '),
    span: source?.layout?.sourceSpan || definition?.defaultSpan || 4,
    width: source?.layout?.width,
    height: source?.layout?.height,
    content,
    style: clone(source?.style || { radius: 24, glass: 72, tone: 'neutral' }),
    visibility: clone(source?.visibility || { roles: { owner: true, admin: true } })
  }, 'Component inserted.');
  const created = result?.acceptedOperations?.find((operation) => operation.type === 'node.create')?.payload?.node?.id;
  if (created && source) {
    if (source.responsive) await setProperty(created, 'responsive', source.responsive);
    if (source.action) await setProperty(created, 'action', source.action);
    if (source.content?.assetUrl) await setProperty(created, 'content.assetUrl', source.content.assetUrl);
  }
  if (created) session()?.selection?.replace?.([created]);
  renderPanel();
}

async function layerSelected(mode) {
  const node = selectedNode();
  if (!node) return;
  const siblings = componentNodes();
  const index = siblings.findIndex((item) => item.id === node.id);
  if (index < 0) return;
  let toIndex = index;
  if (mode === 'front') toIndex = siblings.length - 1;
  if (mode === 'back') toIndex = 0;
  if (mode === 'forward') toIndex = Math.min(siblings.length - 1, index + 1);
  if (mode === 'backward') toIndex = Math.max(0, index - 1);
  await dispatch('canvas.component.move', { nodeId: node.id, toIndex }, `Moved ${mode}.`);
}

async function toggleNodeState(name) {
  const node = selectedNode();
  if (!node) return;
  await setProperty(node.id, `visibility.${name}`, node.visibility?.[name] !== true, `${name} updated.`);
  renderPanel();
}

async function saveReusable() {
  const node = selectedNode();
  if (!node) throw new Error('Select a component first.');
  const name = text(readWorkbenchInput('reusable-name') || node.name, 160);
  state.meta.reusableComponents.unshift({
    id: uid('reusable'),
    name,
    componentType: node.componentType,
    node: clone(node),
    createdAt: new Date().toISOString()
  });
  state.meta.reusableComponents = state.meta.reusableComponents.slice(0, MAX_COMPONENTS);
  persistLocalMeta();
  await persistRemoteMeta();
  setStatus('Reusable component saved.', 'success');
  renderPanel();
}

async function uploadAsset(file) {
  if (!file) return;
  const id = companyId();
  if (!id || !auth.currentUser) throw new Error('An authenticated company workspace is required for uploads.');
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) throw new Error('Only image and video files are supported.');
  const maxBytes = file.type.startsWith('video/') ? 80 * 1024 * 1024 : 16 * 1024 * 1024;
  if (file.size > maxBytes) throw new Error(`File exceeds the ${file.type.startsWith('video/') ? '80 MB' : '16 MB'} limit.`);
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-160);
  const path = `companies/${id}/studio/media/${Date.now()}-${uid('asset')}-${cleanName}`;
  const reference = storageRef(storage, path);
  const task = uploadBytesResumable(reference, file, {
    contentType: file.type,
    customMetadata: { companyId: id, uploadedBy: auth.currentUser.uid, studioVersion: WORKBENCH_VERSION }
  });
  const progress = await new Promise((resolve, reject) => {
    task.on('state_changed', (current) => {
      const percent = Math.round((current.bytesTransferred / current.totalBytes) * 100);
      setStatus(`Uploading ${percent}%…`);
    }, reject, () => resolve(task.snapshot));
  });
  const url = await getDownloadURL(progress.ref);
  state.meta.assets.unshift({
    id: uid('asset'), name: file.name, url, type: file.type.startsWith('video/') ? 'video' : 'image',
    storagePath: path, size: file.size, contentType: file.type, createdAt: new Date().toISOString()
  });
  state.meta.assets = state.meta.assets.slice(0, MAX_ASSETS);
  persistLocalMeta();
  await persistRemoteMeta();
  setStatus('Upload complete.', 'success');
  renderPanel();
}

async function addUrlAsset() {
  const url = safeUrl(readWorkbenchInput('media-url'));
  if (!url) throw new Error('Enter a valid HTTP, HTTPS, or app-relative URL.');
  const name = text(readWorkbenchInput('media-name') || 'Untitled asset', 160);
  const type = readWorkbenchInput('media-type') === 'video' ? 'video' : 'image';
  state.meta.assets.unshift({ id: uid('asset'), name, url, type, storagePath: '', createdAt: new Date().toISOString() });
  state.meta.assets = state.meta.assets.slice(0, MAX_ASSETS);
  persistLocalMeta();
  await persistRemoteMeta();
  setStatus('Asset added.', 'success');
  renderPanel();
}

async function applyAsset(itemId) {
  const node = selectedNode();
  const item = state.meta.assets.find((asset) => asset.id === itemId);
  if (!node || !item) throw new Error('Select a component and choose an asset.');
  await setProperty(node.id, 'content.assetUrl', item.url);
  await setProperty(node.id, 'content.assetType', item.type);
  await setProperty(node.id, 'content.alt', item.name, 'Media applied.');
  renderPanel();
}

async function deleteAsset(itemId) {
  const item = state.meta.assets.find((asset) => asset.id === itemId);
  if (!item) return;
  if (item.storagePath) await deleteObject(storageRef(storage, item.storagePath)).catch(() => undefined);
  state.meta.assets = state.meta.assets.filter((asset) => asset.id !== itemId);
  persistLocalMeta();
  await persistRemoteMeta();
  setStatus('Asset deleted.', 'success');
  renderPanel();
}

async function createVersion() {
  const adapter = window.EvaraTrustedStudioJournal;
  const currentGraph = graph();
  if (!adapter?.checkpoint || !currentGraph) throw new Error('Trusted checkpoint service is unavailable. App Check and authentication must be ready.');
  const name = text(readWorkbenchInput('version-name') || `Version ${state.meta.versions.length + 1}`, 160);
  setBusy(true, 'Synchronizing and creating trusted checkpoint…');
  const checkpoint = await adapter.checkpoint(currentGraph, name);
  state.meta.versions.unshift({
    id: uid('version'), name, checkpointId: checkpoint.checkpointId, branchId: checkpoint.branchId,
    graphId: currentGraph.graphId, graphRevision: currentGraph.revision, createdAt: new Date().toISOString()
  });
  state.meta.versions = state.meta.versions.slice(0, MAX_VERSIONS);
  persistLocalMeta();
  await persistRemoteMeta();
  setBusy(false);
  setStatus('Trusted version created.', 'success');
  renderPanel();
}

async function restoreVersion(itemId) {
  const item = state.meta.versions.find((version) => version.id === itemId);
  const adapter = window.EvaraTrustedStudioJournal;
  if (!item?.checkpointId || !adapter?.restore) throw new Error('Trusted restore point is unavailable.');
  if (!window.confirm(`Restore ${item.name}? Current unsynchronized changes must be resolved first.`)) return;
  setBusy(true, 'Preparing trusted restore…');
  await adapter.restore({ graphId: item.graphId, checkpointId: item.checkpointId });
  setStatus('Trusted restore prepared. Reloading…', 'success');
  location.reload();
}

async function publishRelease() {
  const adapter = window.EvaraTrustedStudioJournal;
  const currentGraph = graph();
  if (!adapter?.release || !currentGraph) throw new Error('Trusted immutable release service is unavailable.');
  const channel = readWorkbenchInput('publish-channel') || 'production';
  const slug = text(readWorkbenchInput('publish-slug') || 'owner-dashboard', 120);
  const seoTitle = text(readWorkbenchInput('publish-title'), 180);
  const seoDescription = text(document.querySelector('[data-workbench-local-field="publish-description"]')?.value || '', 320);
  const releaseId = `${channel}-${slug}-${Date.now().toString(36)}`;
  setBusy(true, 'Synchronizing graph and preparing immutable release…');
  const result = await adapter.release(currentGraph, { releaseId });
  state.meta.publish = {
    ...state.meta.publish,
    channel,
    slug,
    seoTitle,
    seoDescription,
    lastRelease: {
      releaseId: result.release?.releaseId || releaseId,
      checkpointId: result.release?.checkpointId || result.checkpoint?.checkpointId || null,
      graphId: currentGraph.graphId,
      graphRevision: currentGraph.revision,
      publishedAt: new Date().toISOString(),
      idempotent: Boolean(result.idempotent)
    }
  };
  persistLocalMeta();
  await persistRemoteMeta();
  setBusy(false);
  setStatus('Immutable release prepared and server confirmed.', 'success');
  window.dispatchEvent(new CustomEvent('evara:studio-release-complete', { detail: clone(state.meta.publish.lastRelease) }));
  renderPanel();
}

function safeNavigation(value) {
  const raw = text(value, 1000);
  if (!raw) return '';
  if (raw.startsWith('/')) return raw;
  try {
    const url = new URL(raw, location.origin);
    return url.origin === location.origin && ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function executeAction(node) {
  const action = node?.action || {};
  const type = ACTION_TYPES.includes(action.type) ? action.type : '';
  const value = text(action.value, 1000);
  if (!type) return;
  if (type === 'navigate') {
    const target = safeNavigation(value);
    if (!target) return setStatus('Navigation target must be same-origin.', 'error');
    if (action.target === 'new') window.open(target, '_blank', 'noopener,noreferrer');
    else location.assign(target);
  } else if (type === 'send-email') {
    location.href = `mailto:${value.replace(/[^a-zA-Z0-9@._+\-]/g, '')}`;
  } else if (type === 'call') {
    location.href = `tel:${value.replace(/[^0-9+() .\-]/g, '')}`;
  } else if (type === 'open-modal') {
    const modal = el('div', { className: 'studio-workbench-preview-modal', dataset: { workbenchPreviewModal: 'true' }, attrs: { role: 'dialog', 'aria-modal': 'true' } }, [
      el('section', {}, [el('h2', { text: node.name }), el('p', { text: value || 'Modal action preview' }), button('Close', 'close-preview-modal')])
    ]);
    document.body.append(modal);
  } else if (type === 'toggle-visibility') {
    const target = document.querySelector(`[data-sandbox-node-id="${CSS.escape(value)}"]`);
    target?.classList.toggle('is-workbench-runtime-hidden');
  }
}

function startDirectionalResize(event, handle) {
  const node = walk(projection()?.page, handle.dataset.nodeId);
  const article = handle.closest('[data-sandbox-node-id]');
  if (!node || !article || nodeRules(node).locked) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const rect = article.getBoundingClientRect();
  state.resize = {
    pointerId: event.pointerId,
    nodeId: node.id,
    direction: handle.dataset.workbenchResize,
    startX: event.clientX,
    startY: event.clientY,
    width: node.layout.width || rect.width,
    height: node.layout.height || rect.height,
    x: node.layout.x || 0,
    y: node.layout.y || 0,
    ratio: rect.width / Math.max(1, rect.height),
    article
  };
  handle.setPointerCapture?.(event.pointerId);
  article.classList.add('is-resizing');
}

function updateDirectionalResize(event) {
  const item = state.resize;
  if (!item || event.pointerId !== item.pointerId) return;
  const dx = event.clientX - item.startX;
  const dy = event.clientY - item.startY;
  let width = item.width;
  let height = item.height;
  let x = item.x;
  let y = item.y;
  if (item.direction.includes('e')) width += dx;
  if (item.direction.includes('s')) height += dy;
  if (item.direction.includes('w')) { width -= dx; x += dx; }
  if (item.direction.includes('n')) { height -= dy; y += dy; }
  if (event.shiftKey) {
    if (Math.abs(dx) > Math.abs(dy)) height = width / item.ratio;
    else width = height * item.ratio;
  }
  width = Math.round(Math.max(40, width) / 8) * 8;
  height = Math.round(Math.max(40, height) / 8) * 8;
  item.next = { width, height, x: Math.round(x / 8) * 8, y: Math.round(y / 8) * 8 };
  item.article.style.width = `${width}px`;
  item.article.style.height = `${height}px`;
}

async function finishDirectionalResize(event) {
  const item = state.resize;
  if (!item || event?.pointerId !== item.pointerId) return;
  state.resize = null;
  item.article.classList.remove('is-resizing');
  const next = item.next || { width: item.width, height: item.height, x: item.x, y: item.y };
  await dispatch('canvas.component.resize', { nodeId: item.nodeId, width: next.width, height: next.height, span: selectedNode()?.layout?.sourceSpan || 4 });
  await setLayout(item.nodeId, { x: next.x, y: next.y }, 'Resize completed.');
}

function startSpatialDrag(event, article, node) {
  if (node.layout.mode !== 'spatial' || nodeRules(node).locked || event.target.closest('button,input,select,textarea,a,video')) return false;
  event.preventDefault();
  event.stopImmediatePropagation();
  state.spatialDrag = {
    pointerId: event.pointerId,
    nodeId: node.id,
    startX: event.clientX,
    startY: event.clientY,
    x: node.layout.x || 0,
    y: node.layout.y || 0,
    article
  };
  article.setPointerCapture?.(event.pointerId);
  article.classList.add('is-dragging');
  return true;
}

function updateSpatialDrag(event) {
  const item = state.spatialDrag;
  if (!item || event.pointerId !== item.pointerId) return;
  const viewport = document.querySelector('[data-sandbox-viewport]')?.getBoundingClientRect();
  let x = item.x + event.clientX - item.startX;
  let y = item.y + event.clientY - item.startY;
  x = Math.round(x / 8) * 8;
  y = Math.round(y / 8) * 8;
  if (viewport) {
    const centerX = viewport.width / 2 - item.article.offsetWidth / 2;
    const centerY = viewport.height / 2 - item.article.offsetHeight / 2;
    if (Math.abs(x - centerX) <= 8) x = centerX;
    if (Math.abs(y - centerY) <= 8) y = centerY;
  }
  item.next = { x: Math.round(x), y: Math.round(y) };
  const node = walk(projection()?.page, item.nodeId);
  applyStyle(item.article, { ...node, layout: { ...node.layout, ...item.next } });
}

async function finishSpatialDrag(event) {
  const item = state.spatialDrag;
  if (!item || event?.pointerId !== item.pointerId) return;
  state.spatialDrag = null;
  item.article.classList.remove('is-dragging');
  await setLayout(item.nodeId, item.next || { x: item.x, y: item.y }, 'Position updated.');
}

async function pasteClipboard() {
  if (!state.clipboard) return;
  await insertComponent(state.clipboard.componentType, state.clipboard);
}

async function handleAction(action, element) {
  const node = selectedNode();
  if (action === 'close-workbench') { state.open = false; renderPanel(); return; }
  if (action === 'save-meta') { persistLocalMeta(); await persistRemoteMeta(); setStatus('Workspace metadata saved.', 'success'); return; }
  if (action === 'insert-component') return insertComponent(element.dataset.componentType);
  if (action === 'save-reusable') return saveReusable();
  if (action === 'insert-reusable') {
    const item = state.meta.reusableComponents.find((entry) => entry.id === element.dataset.itemId);
    if (item) return insertComponent(item.componentType, item.node);
  }
  if (action === 'delete-reusable') {
    state.meta.reusableComponents = state.meta.reusableComponents.filter((item) => item.id !== element.dataset.itemId);
    persistLocalMeta(); await persistRemoteMeta(); renderPanel(); return;
  }
  if (action === 'add-url-asset') return addUrlAsset();
  if (action === 'apply-asset') return applyAsset(element.dataset.itemId);
  if (action === 'delete-asset') return deleteAsset(element.dataset.itemId);
  if (action === 'create-version') return createVersion();
  if (action === 'restore-version') return restoreVersion(element.dataset.itemId);
  if (action === 'publish') return publishRelease();
  if (action === 'toggle-logic-preview') { state.previewLogic = !state.previewLogic; renderPanel(); return; }
  if (action === 'clear-logic' && node) { await setProperty(node.id, 'action', {}); renderPanel(); return; }
  if (action === 'toggle-lock') return toggleNodeState('locked');
  if (action === 'toggle-hidden') return toggleNodeState('hidden');
  if (action === 'duplicate') return sandbox()?.dispatch?.('canvas.component.duplicate', { nodeId: node?.id });
  if (action === 'delete' && node && !nodeRules(node).locked) return sandbox()?.dispatch?.('canvas.component.delete', { nodeId: node.id });
  if (action === 'layer-front') return layerSelected('front');
  if (action === 'layer-back') return layerSelected('back');
  if (action === 'layer-forward') return layerSelected('forward');
  if (action === 'layer-backward') return layerSelected('backward');
  if (action === 'close-preview-modal') element.closest('[data-workbench-preview-modal]')?.remove();
}

function bindEvents() {
  document.addEventListener('click', async (event) => {
    if (event.target.closest('[data-workbench-toggle]')) {
      state.open = !state.open;
      renderPanel();
      return;
    }
    const tab = event.target.closest('[data-workbench-tab]');
    if (tab) {
      state.tab = tab.dataset.workbenchTab;
      renderPanel();
      return;
    }
    const action = event.target.closest('[data-workbench-action]');
    if (action) {
      try {
        await handleAction(action.dataset.workbenchAction, action);
      } catch (error) {
        setBusy(false);
        setStatus(error?.message || 'Workbench action failed.', 'error');
      }
    }
  });

  document.addEventListener('change', async (event) => {
    const control = event.target.closest('[data-workbench-field]');
    if (control && !['reusable-name', 'media-url', 'media-name', 'media-type', 'version-name', 'publish-channel', 'publish-slug', 'publish-title'].includes(control.dataset.workbenchField)) {
      try { await handleFieldChange(control); }
      catch (error) { setStatus(error?.message || 'Property update failed.', 'error'); }
    }
    const upload = event.target.closest('[data-workbench-upload]');
    if (upload?.files?.[0]) {
      try { setBusy(true, 'Starting upload…'); await uploadAsset(upload.files[0]); }
      catch (error) { setStatus(error?.message || 'Upload failed.', 'error'); }
      finally { setBusy(false); }
    }
  });

  document.addEventListener('pointerdown', (event) => {
    const handle = event.target.closest('[data-workbench-resize]');
    if (handle) { startDirectionalResize(event, handle); return; }
    const article = event.target.closest('[data-sandbox-node-id]');
    const node = article ? walk(projection()?.page, article.dataset.sandboxNodeId) : null;
    if (article && node) startSpatialDrag(event, article, node);
  }, true);

  window.addEventListener('pointermove', (event) => {
    updateDirectionalResize(event);
    updateSpatialDrag(event);
  }, true);
  window.addEventListener('pointerup', async (event) => {
    await finishDirectionalResize(event);
    await finishSpatialDrag(event);
  }, true);
  window.addEventListener('pointercancel', async (event) => {
    await finishDirectionalResize(event);
    await finishSpatialDrag(event);
  }, true);

  document.addEventListener('click', (event) => {
    if (!state.previewLogic) return;
    const article = event.target.closest('[data-sandbox-node-id]');
    if (!article) return;
    const node = walk(projection()?.page, article.dataset.sandboxNodeId);
    if (!node?.action?.type) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    executeAction(node);
  }, true);

  document.addEventListener('dragstart', (event) => {
    const article = event.target.closest('[data-sandbox-node-id]');
    if (article?.dataset.workbenchLocked === 'true') {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener('keydown', async (event) => {
    if (!document.body.classList.contains('is-canvas-sandbox-open')) return;
    const typing = event.target.matches?.('input,textarea,select,[contenteditable="true"]');
    const command = event.metaKey || event.ctrlKey;
    if (command && event.key.toLowerCase() === 'c' && !typing) {
      const node = selectedNode();
      if (node) { state.clipboard = clone(node); setStatus('Component copied.', 'success'); }
    } else if (command && event.key.toLowerCase() === 'v' && !typing) {
      event.preventDefault();
      await pasteClipboard();
    } else if (command && event.key.toLowerCase() === 'd' && !typing) {
      event.preventDefault();
      const node = selectedNode();
      if (node) await sandbox()?.dispatch?.('canvas.component.duplicate', { nodeId: node.id });
    }
  });

  window.addEventListener('evara:canvas-session-change', () => {
    injectWorkbenchToggle();
    applyPresentation();
    if (state.open) renderPanel();
  });
}

async function hydrateMeta() {
  state.meta = readLocalMeta();
  try {
    const remote = await readRemoteWorkbench();
    if (remote) {
      const localUpdated = Date.parse(state.meta.updatedAt || 0) || 0;
      const remoteUpdated = Number(remote.updatedAtMs) || Date.parse(remote.updatedAt || 0) || 0;
      if (remoteUpdated >= localUpdated) state.meta = normalizeMeta(remote);
      persistLocalMeta();
    }
  } catch (error) {
    setStatus(error?.message || 'Remote workbench metadata could not be loaded.', 'error');
  }
}

async function promoteGraphCanvas() {
  if (!sandbox()?.open) return false;
  await sandbox().open();
  await hydrateMeta();
  mountPanel();
  injectWorkbenchToggle();
  applyPresentation();
  renderPanel();
  document.body.dataset.studioPrimarySurface = 'graph-canvas';
  window.dispatchEvent(new CustomEvent('evara:studio-workbench-ready', {
    detail: { version: WORKBENCH_VERSION, graphId: snapshot()?.graphId || null }
  }));
  return true;
}

async function boot() {
  if (state.mounted) return;
  state.mounted = true;
  bindEvents();
  state.observer = new MutationObserver(() => {
    injectWorkbenchToggle();
    applyPresentation();
  });
  state.observer.observe(document.body, { childList: true, subtree: true });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      if (await promoteGraphCanvas()) return;
    } catch (error) {
      setStatus(error?.message || 'Graph Canvas could not initialize.', 'error');
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  state.mounted = false;
}

window.EvaraStudioWorkbench = Object.freeze({
  version: WORKBENCH_VERSION,
  open: (tab = 'inspector') => { state.tab = tab; state.open = true; renderPanel(); },
  close: () => { state.open = false; renderPanel(); },
  refresh: () => { applyPresentation(); renderPanel(); },
  createVersion,
  publishRelease,
  getMeta: () => clone(state.meta),
  getSelectedNode: () => clone(selectedNode())
});

window.addEventListener('evara:session-ready', () => setTimeout(boot, 120));
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 500), { once: true });
else setTimeout(boot, 500);
