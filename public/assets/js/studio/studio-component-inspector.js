import { STUDIO_COMPONENTS, componentsByCategory, getStudioComponent } from './component-registry.js';

const STORAGE_KEY = 'evaraos-studio-visual-builder-v1';
const CATEGORY_ORDER = ['foundation', 'analytics', 'workflows', 'settings', 'communications', 'operations', 'marketplace', 'media'];
const CATEGORY_LABELS = Object.freeze({
  foundation: 'Foundation',
  analytics: 'Analytics',
  workflows: 'Workflows',
  settings: 'Settings',
  communications: 'Communications',
  operations: 'Operations',
  marketplace: 'Marketplace',
  media: 'Media'
});
const REQUIRED_FIELDS = new Set(['title', 'label', 'value', 'body', 'status', 'price', 'action']);
const HIDDEN_FROM_INSPECTOR = new Set(['asset', 'radius']);
const SELECT_OPTIONS = Object.freeze({
  action: [
    ['none', 'No action'],
    ['navigate', 'Navigate to page'],
    ['open-panel', 'Open panel'],
    ['submit', 'Submit workflow'],
    ['approve', 'Approve record'],
    ['message', 'Open messages'],
    ['schedule', 'Open scheduling']
  ],
  style: [
    ['primary', 'Primary'],
    ['secondary', 'Secondary'],
    ['quiet', 'Quiet']
  ],
  tone: [
    ['information', 'Information'],
    ['positive', 'Success'],
    ['warning', 'Warning'],
    ['critical', 'Error']
  ],
  direction: [
    ['incoming', 'Incoming'],
    ['outgoing', 'Outgoing']
  ],
  status: [
    ['healthy', 'Healthy'],
    ['pending', 'Pending'],
    ['scheduled', 'Scheduled'],
    ['in-progress', 'In progress'],
    ['complete', 'Complete'],
    ['attention', 'Needs attention'],
    ['unavailable', 'Unavailable']
  ],
  locationSource: [
    ['jobs', 'Jobs'],
    ['customers', 'Customers'],
    ['teams', 'Teams'],
    ['vendors', 'Vendors']
  ],
  zoom: [
    ['street', 'Street'],
    ['city', 'City'],
    ['region', 'Region']
  ]
});

let booted = false;
let propertiesOpen = false;
let enhancementFrame = 0;
let observer = null;

const root = () => document.querySelector('#appRoot');
const workspace = () => document.querySelector('.studio-workspace');
const selectedElement = () => document.querySelector('.studio-node.is-selected[data-node-id]');
const text = (value, max = 2000) => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, max);

function make(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = text(options.text, options.maxText || 2000);
  if (options.type) node.type = options.type;
  if (options.value !== undefined) node.value = String(options.value);
  if (options.placeholder) node.placeholder = text(options.placeholder, 200);
  if (options.required !== undefined) node.required = Boolean(options.required);
  if (options.disabled !== undefined) node.disabled = Boolean(options.disabled);
  if (options.dataset) Object.entries(options.dataset).forEach(([key, value]) => { node.dataset[key] = String(value); });
  if (options.attrs) Object.entries(options.attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  const list = Array.isArray(children) ? children : [children];
  list.filter(Boolean).forEach((child) => node.append(child));
  return node;
}

function readBuilderState() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

function activePageState(state = readBuilderState()) {
  if (!state || !Array.isArray(state.pages)) return null;
  return state.pages.find((page) => page.id === state.activePageId) || state.pages[0] || null;
}

function selectedNodeState(state = readBuilderState()) {
  const page = activePageState(state);
  if (!page || !Array.isArray(page.nodes)) return null;
  return page.nodes.find((node) => node.id === state.selectedNodeId) || null;
}

function fieldsFor(component) {
  const fields = [...(component?.fields || [])].filter((field) => !HIDDEN_FROM_INSPECTOR.has(field));
  if (component?.defaults?.icon !== undefined && !fields.includes('icon')) fields.push('icon');
  return fields;
}

function fieldLabel(field) {
  const labels = {
    body: 'Description',
    locationSource: 'Location source',
    accept: 'Accepted files',
    eta: 'Estimated arrival',
    direction: 'Message direction'
  };
  return labels[field] || field.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase());
}

function fieldHelp(field, component) {
  const help = {
    action: 'Choose a safe no-code action. Detailed destinations are configured in the action phase.',
    tone: 'Uses the shared semantic color system rather than a custom color.',
    status: 'Select a semantic operational state.',
    direction: 'Controls message alignment without changing message permissions.',
    icon: 'Use a concise symbol. The icon library will replace free-text symbols in a later phase.',
    price: 'Presentation only. Marketplace pricing logic remains outside Studio.',
    eta: 'Presentation only. Live ETA continues to come from the tracking runtime.',
    distance: 'Presentation only. Live distance continues to come from the mapping runtime.',
    accept: 'Describes supported file formats; Storage rules remain authoritative.'
  };
  return help[field] || `Edits the ${component?.name || 'component'} content through the existing Studio history and persistence flow.`;
}

function fieldValue(node, component, field) {
  const supplied = node?.props?.[field];
  if (supplied !== undefined && supplied !== null) return String(supplied);
  return String(component?.defaults?.[field] ?? '');
}

function createControl(field, value, component) {
  const common = {
    className: 'studio-property-control',
    value,
    required: REQUIRED_FIELDS.has(field),
    dataset: { propertyField: field, componentId: component.id },
    attrs: { 'aria-label': fieldLabel(field) }
  };

  if (SELECT_OPTIONS[field]) {
    const select = make('select', common);
    SELECT_OPTIONS[field].forEach(([optionValue, label]) => {
      const option = make('option', { value: optionValue, text: label });
      option.selected = String(value).toLowerCase() === optionValue;
      select.append(option);
    });
    return select;
  }

  if (field === 'body' || field === 'notes') {
    return make('textarea', { ...common, attrs: { ...common.attrs, rows: '4' } });
  }

  return make('input', { ...common, type: 'text', placeholder: fieldLabel(field) });
}

function validateControl(control) {
  const field = control?.dataset?.propertyField;
  if (!field) return true;
  const wrapper = control.closest('.studio-property-field');
  const message = wrapper?.querySelector('[data-property-error]');
  const valid = !REQUIRED_FIELDS.has(field) || String(control.value || '').trim().length > 0;
  control.setAttribute('aria-invalid', String(!valid));
  wrapper?.classList.toggle('has-error', !valid);
  if (message) message.textContent = valid ? '' : `${fieldLabel(field)} is required.`;
  return valid;
}

function ensureFieldBridges(nodeElement, nodeState, component) {
  if (!nodeElement || !nodeState || !component) return;
  fieldsFor(component).forEach((field) => {
    if (nodeElement.querySelector(`[data-catalog-field-bridge][data-field="${CSS.escape(field)}"]`)) return;
    const bridge = make('span', {
      className: 'studio-catalog-field-bridge',
      text: fieldValue(nodeState, component, field),
      dataset: { catalogFieldBridge: 'true', editableText: 'true', field },
      attrs: { tabindex: '-1', 'aria-hidden': 'true' }
    });
    nodeElement.append(bridge);
  });
}

function applyNodeMetadata(nodeElement, nodeState, component) {
  if (!nodeElement || !nodeState || !component) return;
  const props = { ...(component.defaults || {}), ...(nodeState.props || {}) };
  ['tone', 'status', 'direction', 'style'].forEach((field) => {
    if (props[field]) nodeElement.dataset[`catalog${field[0].toUpperCase()}${field.slice(1)}`] = text(props[field], 60).toLowerCase();
  });

  let meta = nodeElement.querySelector('[data-catalog-meta]');
  const metaFields = {
    'workflow-form': ['action'],
    'upload-field': ['accept'],
    'notice-banner': ['tone'],
    'preference-row': ['value'],
    'conversation-row': ['time'],
    'message-bubble': ['time'],
    'tracking-card': ['eta', 'distance'],
    'field-card': ['status', 'action'],
    'service-card': ['price', 'action'],
    'timeline-card': ['status'],
    'status-card': ['status']
  }[component.id] || [];

  if (!metaFields.length) {
    meta?.remove();
    return;
  }

  if (!meta) {
    meta = make('div', { className: 'studio-catalog-meta', dataset: { catalogMeta: 'true' }, attrs: { 'aria-hidden': 'true' } });
    nodeElement.append(meta);
  }
  meta.replaceChildren(...metaFields.map((field) => make('span', { text: props[field] || fieldLabel(field), dataset: { catalogMetaField: field } })));
}

function enhanceCanvasNodes() {
  const state = readBuilderState();
  const page = activePageState(state);
  if (!page) return;
  document.querySelectorAll('.studio-node[data-node-id]').forEach((nodeElement) => {
    const nodeState = page.nodes?.find((node) => node.id === nodeElement.dataset.nodeId);
    const component = getStudioComponent(nodeState?.type);
    if (!nodeState || !component) return;
    ensureFieldBridges(nodeElement, nodeState, component);
    applyNodeMetadata(nodeElement, nodeState, component);
  });
}

function categoryGroups() {
  const grouped = componentsByCategory();
  return CATEGORY_ORDER.map((category) => [category, grouped[category] || []]).filter(([, items]) => items.some((item) => item.id !== 'dev-block'));
}

function applyCatalogFilter(sheet, query = '') {
  const normalized = String(query || '').trim().toLowerCase();
  let visibleCount = 0;
  sheet.querySelectorAll('[data-catalog-group]').forEach((group) => {
    let groupVisible = 0;
    group.querySelectorAll('[data-add-component]').forEach((tile) => {
      const component = getStudioComponent(tile.dataset.addComponent);
      const haystack = [component?.name, component?.description, component?.category, ...(component?.fields || [])].join(' ').toLowerCase();
      const visible = !normalized || haystack.includes(normalized);
      tile.hidden = !visible;
      if (visible) groupVisible += 1;
    });
    group.hidden = groupVisible === 0;
    visibleCount += groupVisible;
  });
  const result = sheet.querySelector('[data-catalog-results]');
  if (result) result.textContent = normalized ? `${visibleCount} matching component${visibleCount === 1 ? '' : 's'}` : `${visibleCount} reusable components`;
}

function organizeAddSheet() {
  const firstTile = document.querySelector('.studio-sheet [data-add-component]');
  if (!firstTile) return;
  const sheet = firstTile.closest('.studio-sheet');
  const list = firstTile.closest('.studio-component-list');
  if (!sheet || !list || sheet.matches('[data-catalog-sheet]')) return;

  if (!sheet.querySelector('[data-catalog-search]')) {
    const search = make('label', { className: 'studio-catalog-search' }, [
      make('span', { text: 'Search components' }),
      make('input', {
        type: 'search',
        placeholder: 'Search cards, workflows, messages…',
        dataset: { catalogSearch: 'true' },
        attrs: { autocomplete: 'off' }
      }),
      make('small', { dataset: { catalogResults: 'true' }, attrs: { role: 'status', 'aria-live': 'polite' } })
    ]);
    sheet.querySelector('.studio-sheet-header')?.after(search);
  }

  if (!list.dataset.catalogOrganized) {
    const tiles = new Map([...list.querySelectorAll('[data-add-component]')].map((tile) => [tile.dataset.addComponent, tile]));
    list.replaceChildren();
    categoryGroups().forEach(([category, components]) => {
      const group = make('section', { className: 'studio-catalog-group', dataset: { catalogGroup: category } }, [
        make('header', { className: 'studio-catalog-group-header' }, [
          make('strong', { text: CATEGORY_LABELS[category] || category }),
          make('small', { text: `${components.filter((item) => item.id !== 'dev-block').length}` })
        ])
      ]);
      const grid = make('div', { className: 'studio-catalog-group-list' });
      components.filter((component) => component.id !== 'dev-block').forEach((component) => {
        const tile = tiles.get(component.id);
        if (tile) grid.append(tile);
      });
      group.append(grid);
      list.append(group);
    });
    list.dataset.catalogOrganized = 'true';
  }

  applyCatalogFilter(sheet, sheet.querySelector('[data-catalog-search]')?.value || '');
}

function propertyField(component, node, field) {
  const value = fieldValue(node, component, field);
  const control = createControl(field, value, component);
  const wrapper = make('label', { className: 'studio-property-field', dataset: { propertyWrapper: field } }, [
    make('span', { className: 'studio-property-label', text: `${fieldLabel(field)}${REQUIRED_FIELDS.has(field) ? ' *' : ''}` }),
    control,
    make('small', { className: 'studio-property-help', text: fieldHelp(field, component) }),
    make('small', { className: 'studio-property-error', dataset: { propertyError: 'true' }, attrs: { role: 'alert' } })
  ]);
  validateControl(control);
  return wrapper;
}

function renderPropertyInspector() {
  const mount = workspace();
  const existing = mount?.querySelector('[data-catalog-sheet="properties"]');
  if (!propertiesOpen || !mount || document.querySelector('.visual-studio.is-preview')) {
    existing?.remove();
    return;
  }

  const state = readBuilderState();
  const node = selectedNodeState(state);
  const component = getStudioComponent(node?.type);
  existing?.remove();

  const sheet = make('aside', { className: 'studio-sheet studio-component-inspector', dataset: { catalogSheet: 'properties' } });
  const header = make('div', { className: 'studio-sheet-header' }, [
    make('div', {}, [
      make('h2', { text: component ? `${component.name} properties` : 'Component properties' }),
      make('p', { text: component ? 'Edit content and semantic behavior through the existing Studio state and history system.' : 'Select a component on the canvas.' })
    ]),
    make('button', { className: 'studio-sheet-close', type: 'button', text: '×', dataset: { catalogAction: 'close-properties' }, attrs: { 'aria-label': 'Close properties' } })
  ]);
  sheet.append(header);

  if (!node || !component) {
    sheet.append(make('div', { className: 'studio-empty-state', text: 'Select a registered component to edit its properties.' }));
    mount.append(sheet);
    return;
  }

  sheet.append(make('section', { className: 'studio-property-contract' }, [
    make('span', { text: component.icon || '◈', attrs: { 'aria-hidden': 'true' } }),
    make('div', {}, [make('strong', { text: component.name }), make('small', { text: component.description })]),
    make('em', { text: component.designSystem?.contractId || 'card' })
  ]));

  const form = make('form', { className: 'studio-property-form', attrs: { novalidate: 'novalidate' } });
  fieldsFor(component).forEach((field) => form.append(propertyField(component, node, field)));
  sheet.append(form);

  if (component.fields?.includes('asset') || component.fields?.includes('radius')) {
    sheet.append(make('div', { className: 'studio-property-linked-tools' }, [
      component.fields.includes('asset') ? make('button', { type: 'button', text: 'Open Assets', dataset: { catalogAction: 'open-assets' } }) : null,
      component.fields.includes('radius') ? make('button', { type: 'button', text: 'Open Style', dataset: { catalogAction: 'open-style' } }) : null
    ]));
  }

  sheet.append(make('footer', { className: 'studio-property-footer' }, [
    make('span', { text: `Design System ${component.designSystem?.version || '2.0.0'}` }),
    make('span', { text: `${component.designSystem?.source || 'primitives'} • ${component.designSystem?.status || 'stable'}` })
  ]));
  mount.append(sheet);
}

function injectPropertyTools() {
  const dock = document.querySelector('.studio-dock');
  if (dock && !dock.querySelector('[data-catalog-tool="properties"]')) {
    dock.append(make('button', {
      className: `studio-dock-button${propertiesOpen ? ' is-active' : ''}`,
      type: 'button',
      title: 'Component properties',
      dataset: { catalogTool: 'properties' },
      attrs: { 'aria-label': 'Open component properties' }
    }, [make('span', { text: 'P' }), make('small', { text: 'Props' })]));
  }

  const toolbar = document.querySelector('.studio-context-toolbar');
  if (toolbar && !toolbar.querySelector('[data-catalog-action="open-properties"]')) {
    toolbar.prepend(make('button', { type: 'button', text: 'Properties', dataset: { catalogAction: 'open-properties' } }));
  }

  document.querySelector('[data-catalog-tool="properties"]')?.classList.toggle('is-active', propertiesOpen);
}

function scheduleEnhance() {
  cancelAnimationFrame(enhancementFrame);
  enhancementFrame = requestAnimationFrame(() => {
    if (!document.querySelector('[data-visual-studio]')) return;
    injectPropertyTools();
    organizeAddSheet();
    enhanceCanvasNodes();
    renderPropertyInspector();
  });
}

function closeNativeSheet() {
  const active = document.querySelector('.studio-dock-button.is-active[data-sheet]');
  active?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

function openNativeSheet(name) {
  propertiesOpen = false;
  renderPropertyInspector();
  const button = document.querySelector(`[data-sheet="${CSS.escape(name)}"]`);
  if (button && !button.classList.contains('is-active')) button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

function commitField(control) {
  if (!validateControl(control)) return;
  const field = control.dataset.propertyField;
  const nodeElement = selectedElement();
  if (!field || !nodeElement) return;
  const bridge = nodeElement.querySelector(`[data-catalog-field-bridge][data-field="${CSS.escape(field)}"]`);
  if (!bridge) return;

  bridge.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  setTimeout(() => {
    const currentNode = selectedElement();
    const editor = currentNode?.querySelector(`[data-catalog-field-bridge][data-field="${CSS.escape(field)}"]`);
    if (!editor) return;
    editor.textContent = text(control.value, 2000).trim();
    editor.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  }, 50);
}

function bindEvents() {
  document.addEventListener('input', (event) => {
    if (event.target.matches('[data-catalog-search]')) applyCatalogFilter(event.target.closest('.studio-sheet'), event.target.value);
    if (event.target.matches('[data-property-field]')) validateControl(event.target);
  });

  document.addEventListener('change', (event) => {
    if (event.target.matches('[data-property-field]')) commitField(event.target);
  });

  document.addEventListener('focusout', (event) => {
    if (event.target.matches('input[data-property-field], textarea[data-property-field]')) commitField(event.target);
  });

  document.addEventListener('click', (event) => {
    const tool = event.target.closest('[data-catalog-tool="properties"], [data-catalog-action="open-properties"]');
    if (tool) {
      closeNativeSheet();
      propertiesOpen = true;
      scheduleEnhance();
      return;
    }

    const action = event.target.closest('[data-catalog-action]')?.dataset.catalogAction;
    if (action === 'close-properties') {
      propertiesOpen = false;
      renderPropertyInspector();
      return;
    }
    if (action === 'open-assets') {
      openNativeSheet('assets');
      return;
    }
    if (action === 'open-style') {
      openNativeSheet('style');
      return;
    }

    if (event.target.closest('[data-sheet]')) {
      propertiesOpen = false;
      renderPropertyInspector();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && propertiesOpen && !event.target.matches('input,textarea,select')) {
      propertiesOpen = false;
      renderPropertyInspector();
    }
  });
}

function boot() {
  if (booted) return;
  booted = true;
  bindEvents();
  observer = new MutationObserver(scheduleEnhance);
  if (root()) observer.observe(root(), { childList: true, subtree: true });
  scheduleEnhance();
}

window.addEventListener('evara:session-ready', boot, { once: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 650), { once: true });
else setTimeout(boot, 650);
