import { componentsByCategory, getStudioComponent } from './component-registry.js';

const STORAGE_KEY = 'evaraos-studio-visual-builder-v1';
const CATEGORY_ORDER = ['foundation', 'analytics', 'workflows', 'settings', 'communications', 'operations', 'marketplace', 'media'];
const REQUIRED_FIELDS = new Set(['title', 'label', 'value', 'body', 'status', 'price', 'action']);
const HIDDEN_FIELDS = new Set(['asset', 'radius']);
const SELECT_OPTIONS = Object.freeze({
  action: [['none', 'No action'], ['navigate', 'Navigate'], ['open-panel', 'Open panel'], ['submit', 'Submit'], ['approve', 'Approve'], ['message', 'Messages'], ['schedule', 'Scheduling']],
  style: [['primary', 'Primary'], ['secondary', 'Secondary'], ['quiet', 'Quiet']],
  tone: [['information', 'Information'], ['positive', 'Success'], ['warning', 'Warning'], ['critical', 'Error']],
  direction: [['incoming', 'Incoming'], ['outgoing', 'Outgoing']],
  status: [['healthy', 'Healthy'], ['pending', 'Pending'], ['scheduled', 'Scheduled'], ['in-progress', 'In progress'], ['complete', 'Complete'], ['attention', 'Needs attention'], ['unavailable', 'Unavailable']],
  locationSource: [['jobs', 'Jobs'], ['customers', 'Customers'], ['teams', 'Teams'], ['vendors', 'Vendors']],
  zoom: [['street', 'Street'], ['city', 'City'], ['region', 'Region']]
});

let booted = false;
let propertiesOpen = false;
let frame = 0;

const root = () => document.querySelector('#appRoot');
const workspace = () => document.querySelector('.studio-workspace');
const selectedElement = () => document.querySelector('.studio-node.is-selected[data-node-id]');
const clean = (value, max = 2000) => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, max);

function make(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = clean(options.text);
  if (options.type) node.type = options.type;
  if (options.value !== undefined) node.value = String(options.value);
  if (options.placeholder) node.placeholder = clean(options.placeholder, 200);
  if (options.required !== undefined) node.required = Boolean(options.required);
  if (options.dataset) Object.entries(options.dataset).forEach(([key, value]) => { node.dataset[key] = String(value); });
  if (options.attrs) Object.entries(options.attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  (Array.isArray(children) ? children : [children]).filter(Boolean).forEach((child) => node.append(child));
  return node;
}

function readState() {
  try {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return state && typeof state === 'object' ? state : null;
  } catch {
    return null;
  }
}

function activePage(state = readState()) {
  return state?.pages?.find((page) => page.id === state.activePageId) || state?.pages?.[0] || null;
}

function selectedNode(state = readState()) {
  const page = activePage(state);
  return page?.nodes?.find((node) => node.id === state.selectedNodeId) || null;
}

function fieldsFor(component) {
  const fields = [...(component?.fields || [])].filter((field) => !HIDDEN_FIELDS.has(field));
  if (component?.defaults?.icon !== undefined && !fields.includes('icon')) fields.push('icon');
  return fields;
}

function labelFor(field) {
  const labels = { body: 'Description', locationSource: 'Location source', accept: 'Accepted files', eta: 'Estimated arrival', direction: 'Message direction' };
  return labels[field] || field.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase());
}

function helpFor(field, component) {
  const help = {
    action: 'Stores a no-code action intent; destinations remain controlled by the action runtime.',
    tone: 'Uses shared semantic color tokens.',
    status: 'Uses a semantic operational state.',
    direction: 'Changes message presentation, not message permissions.',
    price: 'Presentation only; Marketplace pricing remains authoritative.',
    eta: 'Presentation only; live ETA remains owned by tracking.',
    distance: 'Presentation only; live distance remains owned by mapping.',
    accept: 'Describes formats; Storage rules remain authoritative.'
  };
  return help[field] || `Updates ${component?.name || 'component'} content through the existing Studio state and history flow.`;
}

function valueFor(node, component, field) {
  return String(node?.props?.[field] ?? component?.defaults?.[field] ?? '');
}

function validate(control) {
  const field = control?.dataset?.propertyField;
  if (!field) return true;
  const valid = !REQUIRED_FIELDS.has(field) || String(control.value || '').trim().length > 0;
  const wrapper = control.closest('.studio-property-field');
  control.setAttribute('aria-invalid', String(!valid));
  wrapper?.classList.toggle('has-error', !valid);
  const error = wrapper?.querySelector('[data-property-error]');
  if (error) error.textContent = valid ? '' : `${labelFor(field)} is required.`;
  return valid;
}

function createControl(component, field, value) {
  const common = { className: 'studio-property-control', value, required: REQUIRED_FIELDS.has(field), dataset: { propertyField: field, componentId: component.id }, attrs: { 'aria-label': labelFor(field) } };
  if (SELECT_OPTIONS[field]) {
    const select = make('select', common);
    SELECT_OPTIONS[field].forEach(([optionValue, label]) => {
      const option = make('option', { value: optionValue, text: label });
      option.selected = String(value).toLowerCase() === optionValue;
      select.append(option);
    });
    return select;
  }
  if (field === 'body' || field === 'notes') return make('textarea', { ...common, attrs: { ...common.attrs, rows: '4' } });
  return make('input', { ...common, type: 'text', placeholder: labelFor(field) });
}

function removeLegacyFieldBridges(element) {
  element.querySelectorAll(':scope > [data-catalog-field-bridge]').forEach((bridge) => bridge.remove());
}

function applyMetadata(element, node, component) {
  const props = { ...(component.defaults || {}), ...(node.props || {}) };
  ['tone', 'status', 'direction', 'style'].forEach((field) => {
    if (props[field]) element.dataset[`catalog${field[0].toUpperCase()}${field.slice(1)}`] = clean(props[field], 60).toLowerCase();
  });
  const fields = {
    'workflow-form': ['action'], 'upload-field': ['accept'], 'notice-banner': ['tone'],
    'preference-row': ['value'], 'conversation-row': ['time'], 'message-bubble': ['time'],
    'tracking-card': ['eta', 'distance'], 'field-card': ['status', 'action'],
    'service-card': ['price', 'action'], 'timeline-card': ['status'], 'status-card': ['status']
  }[component.id] || [];
  const signature = fields.map((field) => `${field}:${props[field] || ''}`).join('|');
  let meta = element.querySelector('[data-catalog-meta]');
  if (!fields.length) return meta?.remove();
  if (meta?.dataset.catalogSignature === signature) return;
  if (!meta) {
    meta = make('div', { className: 'studio-catalog-meta', dataset: { catalogMeta: 'true' }, attrs: { 'aria-hidden': 'true' } });
    element.append(meta);
  }
  meta.dataset.catalogSignature = signature;
  meta.replaceChildren(...fields.map((field) => make('span', { text: props[field] || labelFor(field), dataset: { catalogMetaField: field } })));
}

function enhanceNodes() {
  const state = readState();
  const page = activePage(state);
  if (!page) return;
  document.querySelectorAll('.studio-node[data-node-id]').forEach((element) => {
    const node = page.nodes?.find((item) => item.id === element.dataset.nodeId);
    const component = getStudioComponent(node?.type);
    if (!node || !component) return;
    removeLegacyFieldBridges(element);
    applyMetadata(element, node, component);
  });
}

function applyFilter(sheet, query = '') {
  const needle = String(query).trim().toLowerCase();
  let visible = 0;
  sheet.querySelectorAll('[data-catalog-group]').forEach((group) => {
    let groupVisible = 0;
    group.querySelectorAll('[data-add-component]').forEach((tile) => {
      const component = getStudioComponent(tile.dataset.addComponent);
      const haystack = [component?.name, component?.description, component?.category, ...(component?.fields || [])].join(' ').toLowerCase();
      tile.hidden = Boolean(needle && !haystack.includes(needle));
      if (!tile.hidden) groupVisible += 1;
    });
    group.hidden = groupVisible === 0;
    visible += groupVisible;
  });
  const result = sheet.querySelector('[data-catalog-results]');
  if (result) result.textContent = needle ? `${visible} matching component${visible === 1 ? '' : 's'}` : `${visible} reusable components`;
}

function organizeCatalog() {
  const tile = document.querySelector('.studio-sheet [data-add-component]');
  const sheet = tile?.closest('.studio-sheet');
  const list = tile?.closest('.studio-component-list');
  if (!sheet || !list || sheet.matches('[data-catalog-sheet]')) return;
  if (!sheet.querySelector('[data-catalog-search]')) {
    sheet.querySelector('.studio-sheet-header')?.after(make('label', { className: 'studio-catalog-search' }, [
      make('span', { text: 'Search components' }),
      make('input', { type: 'search', placeholder: 'Search cards, workflows, messages…', dataset: { catalogSearch: 'true' }, attrs: { autocomplete: 'off' } }),
      make('small', { dataset: { catalogResults: 'true' }, attrs: { role: 'status', 'aria-live': 'polite' } })
    ]));
  }
  if (!list.dataset.catalogOrganized) {
    const tiles = new Map([...list.querySelectorAll('[data-add-component]')].map((item) => [item.dataset.addComponent, item]));
    const grouped = componentsByCategory();
    list.replaceChildren();
    CATEGORY_ORDER.forEach((category) => {
      const components = (grouped[category] || []).filter((component) => component.id !== 'dev-block');
      if (!components.length) return;
      const group = make('section', { className: 'studio-catalog-group', dataset: { catalogGroup: category } }, [
        make('header', { className: 'studio-catalog-group-header' }, [make('strong', { text: category }), make('small', { text: components.length })]),
        make('div', { className: 'studio-catalog-group-list' }, components.map((component) => tiles.get(component.id)).filter(Boolean))
      ]);
      list.append(group);
    });
    list.dataset.catalogOrganized = 'true';
  }
  applyFilter(sheet, sheet.querySelector('[data-catalog-search]')?.value || '');
}

function propertyField(component, node, field) {
  const control = createControl(component, field, valueFor(node, component, field));
  const wrapper = make('label', { className: 'studio-property-field', dataset: { propertyWrapper: field } }, [
    make('span', { className: 'studio-property-label', text: `${labelFor(field)}${REQUIRED_FIELDS.has(field) ? ' *' : ''}` }),
    control,
    make('small', { className: 'studio-property-help', text: helpFor(field, component) }),
    make('small', { className: 'studio-property-error', dataset: { propertyError: 'true' }, attrs: { role: 'alert' } })
  ]);
  validate(control);
  return wrapper;
}

function renderInspector() {
  const mount = workspace();
  const existing = mount?.querySelector('[data-catalog-sheet="properties"]');
  if (!propertiesOpen || !mount || document.querySelector('.visual-studio.is-preview')) return existing?.remove();
  const node = selectedNode();
  const component = getStudioComponent(node?.type);
  const signature = component ? `${node.id}:${component.id}:${fieldsFor(component).map((field) => `${field}:${valueFor(node, component, field)}`).join('|')}` : 'empty';
  if (existing?.dataset.catalogSignature === signature) return;
  existing?.remove();
  const sheet = make('aside', { className: 'studio-sheet studio-component-inspector', dataset: { catalogSheet: 'properties', catalogSignature: signature } }, [
    make('div', { className: 'studio-sheet-header' }, [
      make('div', {}, [make('h2', { text: component ? `${component.name} properties` : 'Component properties' }), make('p', { text: component ? 'Edit content and semantic behavior through the existing Studio state and history system.' : 'Select a component on the canvas.' })]),
      make('button', { className: 'studio-sheet-close', type: 'button', text: '×', dataset: { catalogAction: 'close-properties' }, attrs: { 'aria-label': 'Close properties' } })
    ])
  ]);
  if (!component || !node) {
    sheet.append(make('div', { className: 'studio-empty-state', text: 'Select a registered component to edit its properties.' }));
    return mount.append(sheet);
  }
  sheet.append(
    make('section', { className: 'studio-property-contract' }, [make('span', { text: component.icon || '◈', attrs: { 'aria-hidden': 'true' } }), make('div', {}, [make('strong', { text: component.name }), make('small', { text: component.description })]), make('em', { text: component.designSystem?.contractId || 'card' })]),
    make('form', { className: 'studio-property-form', attrs: { novalidate: 'novalidate' } }, fieldsFor(component).map((field) => propertyField(component, node, field)))
  );
  if (component.fields?.includes('asset') || component.fields?.includes('radius')) sheet.append(make('div', { className: 'studio-property-linked-tools' }, [
    component.fields.includes('asset') ? make('button', { type: 'button', text: 'Open Assets', dataset: { catalogAction: 'open-assets' } }) : null,
    component.fields.includes('radius') ? make('button', { type: 'button', text: 'Open Style', dataset: { catalogAction: 'open-style' } }) : null
  ]));
  sheet.append(make('footer', { className: 'studio-property-footer' }, [make('span', { text: `Design System ${component.designSystem?.version || '2.0.0'}` }), make('span', { text: `${component.designSystem?.source || 'primitives'} • ${component.designSystem?.status || 'stable'}` })]));
  mount.append(sheet);
}

function injectTools() {
  const dock = document.querySelector('.studio-dock');
  if (dock && !dock.querySelector('[data-catalog-tool="properties"]')) dock.append(make('button', { className: 'studio-dock-button', type: 'button', title: 'Component properties', dataset: { catalogTool: 'properties' }, attrs: { 'aria-label': 'Open component properties' } }, [make('span', { text: 'P' }), make('small', { text: 'Props' })]));
  const toolbar = document.querySelector('.studio-context-toolbar');
  if (toolbar && !toolbar.querySelector('[data-catalog-action="open-properties"]')) toolbar.prepend(make('button', { type: 'button', text: 'Properties', dataset: { catalogAction: 'open-properties' } }));
  document.querySelector('[data-catalog-tool="properties"]')?.classList.toggle('is-active', propertiesOpen);
}

function enhance() {
  if (!document.querySelector('[data-visual-studio]')) return;
  injectTools();
  organizeCatalog();
  enhanceNodes();
  renderInspector();
}

function scheduleEnhance() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(enhance);
}

function closeCompetingPanels() {
  document.querySelector('.studio-dock-button.is-active[data-sheet]')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  document.querySelector('[data-layout-tool="layers"].is-active')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  document.querySelector('[data-auto-layout-tool].is-active')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  document.querySelector('.studio-document-history-button.is-active')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

function openNativeSheet(name) {
  propertiesOpen = false;
  renderInspector();
  const button = document.querySelector(`[data-sheet="${CSS.escape(name)}"]`);
  if (button && !button.classList.contains('is-active')) button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

function commitField(control) {
  if (!validate(control)) return;
  const field = control.dataset.propertyField;
  const element = selectedElement();
  if (!field || !element) return;
  window.EvaraStudioPropertyBridge?.updateNodeField?.(
    element.dataset.nodeId,
    field,
    clean(control.value).trim()
  );
  scheduleEnhance();
}

function bindEvents() {
  document.addEventListener('input', (event) => {
    if (event.target.matches('[data-catalog-search]')) applyFilter(event.target.closest('.studio-sheet'), event.target.value);
    if (event.target.matches('[data-property-field]')) validate(event.target);
  });
  document.addEventListener('change', (event) => { if (event.target.matches('[data-property-field]')) commitField(event.target); });
  document.addEventListener('focusout', (event) => { if (event.target.matches('input[data-property-field], textarea[data-property-field]')) commitField(event.target); });
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-catalog-tool="properties"], [data-catalog-action="open-properties"]')) {
      closeCompetingPanels();
      propertiesOpen = true;
      scheduleEnhance();
      return;
    }
    const action = event.target.closest('[data-catalog-action]')?.dataset.catalogAction;
    if (action === 'close-properties') { propertiesOpen = false; renderInspector(); return; }
    if (action === 'open-assets') { openNativeSheet('assets'); return; }
    if (action === 'open-style') { openNativeSheet('style'); return; }
    if (event.target.closest('[data-sheet], [data-layout-tool="layers"], [data-auto-layout-tool], [data-journal-action]')) {
      propertiesOpen = false;
      renderInspector();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && propertiesOpen && !event.target.matches('input,textarea,select')) {
      propertiesOpen = false;
      renderInspector();
    }
  });
}

function boot() {
  if (booted) return;
  booted = true;
  bindEvents();
  if (root()) new MutationObserver(scheduleEnhance).observe(root(), { childList: true });
  scheduleEnhance();
}

window.addEventListener('evara:session-ready', boot, { once: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 650), { once: true });
else setTimeout(boot, 650);
