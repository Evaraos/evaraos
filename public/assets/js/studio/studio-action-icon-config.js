import { getStudioComponent } from './component-registry.js';
import { canAccessPageName, normalizeAccessRole, pagesForRole } from '../access-control.js';
import {
  DEFAULT_COMPONENT_ICONS,
  EVARA_ICONS,
  EVARA_ICON_REGISTRY_VERSION,
  createEvaraIconElement,
  normalizeEvaraIconId,
  searchEvaraIcons
} from '../icons/icon-registry.js';

const STORAGE_KEY = 'evaraos-studio-visual-builder-v1';
const ACTION_BINDING_VERSION = 'action-binding-v1';
const ACTION_INTENTS = Object.freeze([
  ['none', 'No action'],
  ['navigate', 'Navigate to page'],
  ['message', 'Open messages'],
  ['schedule', 'Open scheduling'],
  ['submit', 'Submit workflow'],
  ['approve', 'Approve record'],
  ['open-panel', 'Open approved panel']
]);
const SAFE_ROUTE_ORDER = Object.freeze([
  'dashboard.html',
  'customer_dashboard.html',
  'settings-v2.html',
  'messages.html',
  'customer-messaging.html',
  'jobs.html',
  'leads.html',
  'dispatch.html',
  'schedule.html',
  'field.html',
  'territory-map.html',
  'revenue.html',
  'marketplace-payouts.html',
  'customer-commerce.html',
  'customer-service-history.html',
  'customer_bills.html',
  'ai_command.html'
]);

let booted = false;
let frame = 0;

const appRoot = () => document.querySelector('#appRoot');
const selectedElement = () => document.querySelector('.studio-node.is-selected[data-node-id]');
const clean = (value, max = 1000) => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, max);

function make(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = clean(options.text, 2000);
  if (options.type) node.type = options.type;
  if (options.value !== undefined) node.value = String(options.value);
  if (options.placeholder) node.placeholder = clean(options.placeholder, 200);
  if (options.disabled !== undefined) node.disabled = Boolean(options.disabled);
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

function nodeById(state, nodeId) {
  const page = activePage(state);
  return page?.nodes?.find((node) => node.id === nodeId) || null;
}

function previewRole(state = readState()) {
  return normalizeAccessRole(state?.previewRole || 'owner');
}

function componentIconId(component, node) {
  return normalizeEvaraIconId(node?.props?.icon, DEFAULT_COMPONENT_ICONS[component?.id] || 'sparkles');
}

function routeLabel(pageName) {
  return String(pageName || '')
    .replace(/\.html$/i, '')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function allowedRoutes(role) {
  const allowed = new Set(pagesForRole(role));
  return SAFE_ROUTE_ORDER.filter((page) => allowed.has(page)).map((page) => ({
    page,
    route: `/${page}`,
    label: routeLabel(page)
  }));
}

function intentTarget(intent, role, currentTarget = '') {
  const routes = allowedRoutes(role);
  if (intent === 'message') {
    return routes.find((item) => item.page === (role === 'customer' ? 'customer-messaging.html' : 'messages.html'))?.route || '';
  }
  if (intent === 'schedule') return routes.find((item) => item.page === 'schedule.html')?.route || '';
  if (intent === 'navigate') {
    const candidate = String(currentTarget || '').replace(/^\//, '');
    return routes.some((item) => item.page === candidate) ? `/${candidate}` : (routes[0]?.route || '');
  }
  return '';
}

function ensureBridge(element, field, value = '') {
  let bridge = element?.querySelector(`[data-action-icon-field-bridge][data-field="${CSS.escape(field)}"]`);
  if (bridge) return bridge;
  bridge = make('span', {
    className: 'studio-action-icon-field-bridge',
    text: value,
    dataset: { actionIconFieldBridge: 'true', editableText: 'true', field },
    attrs: { tabindex: '-1', 'aria-hidden': 'true' }
  });
  element?.append(bridge);
  return bridge;
}

function commitField(field, value) {
  const element = selectedElement();
  if (!element || !field) return;
  const bridge = ensureBridge(element, field, value);
  bridge.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  setTimeout(() => {
    const editor = selectedElement()?.querySelector(`[data-action-icon-field-bridge][data-field="${CSS.escape(field)}"]`);
    if (!editor) return;
    editor.textContent = clean(value, 2000).trim();
    editor.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  }, 50);
}

function replaceWithIcon(container, iconId, options = {}) {
  if (!container) return;
  const normalized = normalizeEvaraIconId(iconId, options.fallback || 'sparkles');
  if (container.dataset.evaraIconRendered === normalized) return;
  container.replaceChildren(createEvaraIconElement(normalized, { className: options.className || 'eva-icon' }));
  container.dataset.evaraIconRendered = normalized;
  container.dataset.evaraIconId = normalized;
}

function enhanceCatalogIcons() {
  document.querySelectorAll('[data-add-component]').forEach((tile) => {
    const component = getStudioComponent(tile.dataset.addComponent);
    const holder = tile.querySelector(':scope > span');
    replaceWithIcon(holder, DEFAULT_COMPONENT_ICONS[component?.id], { fallback: 'sparkles' });
  });
}

function enhanceCanvasNodes() {
  const state = readState();
  const page = activePage(state);
  if (!page) return;
  document.querySelectorAll('.studio-node[data-node-id]').forEach((element) => {
    const node = nodeById(state, element.dataset.nodeId);
    const component = getStudioComponent(node?.type);
    if (!node || !component) return;
    const iconId = componentIconId(component, node);
    replaceWithIcon(element.querySelector('.studio-node-icon'), iconId, { fallback: DEFAULT_COMPONENT_ICONS[component.id] });
    element.dataset.iconRegistry = EVARA_ICON_REGISTRY_VERSION;
    element.dataset.iconId = iconId;

    const intent = clean(node.props?.actionIntent || 'none', 40).toLowerCase();
    const target = clean(node.props?.actionTarget || '', 240);
    const role = previewRole(state);
    const targetPage = target.replace(/^\//, '');
    const allowed = !target || canAccessPageName(targetPage, role);
    element.dataset.actionBinding = ACTION_BINDING_VERSION;
    element.dataset.actionIntent = intent;
    element.dataset.actionTarget = target;
    element.dataset.actionAllowed = String(allowed);
  });
}

function normalizeActionLabelControl(panel, node) {
  const wrapper = panel.querySelector('[data-property-wrapper="action"]');
  const control = wrapper?.querySelector('[data-property-field="action"]');
  if (!wrapper || !control || control.dataset.actionLabelNormalized === 'true') return;
  const input = make('input', {
    className: control.className,
    type: 'text',
    value: node?.props?.action || '',
    placeholder: 'Action label',
    dataset: { propertyField: 'action', componentId: control.dataset.componentId || '', actionLabelNormalized: 'true' },
    attrs: { 'aria-label': 'Action label' }
  });
  control.replaceWith(input);
  const label = wrapper.querySelector('.studio-property-label');
  const help = wrapper.querySelector('.studio-property-help');
  if (label) label.textContent = 'Action label *';
  if (help) help.textContent = 'Visible CTA copy only. Behavior and destination are configured separately below.';
}

function propertyWrapper(field, label, control, help, tone = '') {
  return make('label', { className: `studio-property-field studio-action-property${tone ? ` is-${tone}` : ''}`, dataset: { actionConfigField: field } }, [
    make('span', { className: 'studio-property-label', text: label }),
    control,
    make('small', { className: 'studio-property-help', text: help }),
    make('small', { className: 'studio-property-error', dataset: { actionConfigError: field }, attrs: { role: 'alert' } })
  ]);
}

function buildIntentControl(node) {
  const value = clean(node?.props?.actionIntent || 'none', 40).toLowerCase();
  const select = make('select', {
    className: 'studio-property-control',
    value,
    dataset: { actionIntentControl: 'true' },
    attrs: { 'aria-label': 'Action behavior' }
  });
  ACTION_INTENTS.forEach(([intent, label]) => {
    const option = make('option', { value: intent, text: label });
    option.selected = value === intent;
    select.append(option);
  });
  return select;
}

function buildTargetControl(node, role) {
  const intent = clean(node?.props?.actionIntent || 'none', 40).toLowerCase();
  const current = clean(node?.props?.actionTarget || '', 240);
  const routes = allowedRoutes(role);
  const select = make('select', {
    className: 'studio-property-control',
    dataset: { actionTargetControl: 'true' },
    attrs: { 'aria-label': 'Action destination' },
    disabled: !['navigate', 'message', 'schedule'].includes(intent)
  });

  if (intent === 'navigate') {
    routes.forEach(({ route, label }) => {
      const option = make('option', { value: route, text: label });
      option.selected = current === route;
      select.append(option);
    });
  } else if (intent === 'message' || intent === 'schedule') {
    const target = intentTarget(intent, role, current);
    const option = make('option', { value: target, text: target ? routeLabel(target) : 'Unavailable for this role' });
    option.selected = true;
    select.append(option);
  } else {
    select.append(make('option', { value: '', text: 'Handled by the approved runtime' }));
  }
  return select;
}

function actionPermissionMessage(node, role) {
  const intent = clean(node?.props?.actionIntent || 'none', 40).toLowerCase();
  const target = clean(node?.props?.actionTarget || '', 240);
  if (!['navigate', 'message', 'schedule'].includes(intent)) return { tone: 'neutral', message: 'No route permission is required for this intent until its runtime binding is configured.' };
  if (!target) return { tone: 'warning', message: `No authorized destination is available for ${role}.` };
  const allowed = canAccessPageName(target, role);
  return allowed
    ? { tone: 'positive', message: `${role} may access ${target}.` }
    : { tone: 'critical', message: `${role} is not authorized to access ${target}. Choose an approved route.` };
}

function enhanceActionConfig(panel, node, component) {
  if (!component?.fields?.includes('action') || panel.querySelector('[data-action-config]')) return;
  normalizeActionLabelControl(panel, node);
  const role = previewRole();
  const permission = actionPermissionMessage(node, role);
  const block = make('section', { className: 'studio-action-config', dataset: { actionConfig: 'true', permissionTone: permission.tone } }, [
    make('header', { className: 'studio-action-config-header' }, [
      make('div', {}, [make('strong', { text: 'No-code action' }), make('small', { text: `Preview role: ${role}` })]),
      make('span', { text: ACTION_BINDING_VERSION })
    ]),
    propertyWrapper('actionIntent', 'Behavior', buildIntentControl(node), 'Stores a semantic intent instead of executable page-specific code.'),
    propertyWrapper('actionTarget', 'Destination', buildTargetControl(node, role), 'Only routes allowed by the canonical page policy are available.'),
    make('p', { className: 'studio-action-permission', text: permission.message, dataset: { actionPermission: permission.tone }, attrs: { role: 'status' } })
  ]);
  panel.querySelector('.studio-property-form')?.after(block);
}

function iconPickerGrid(query, selectedId) {
  const icons = searchEvaraIcons(query).slice(0, 48);
  return make('div', { className: 'studio-icon-picker-grid', dataset: { iconPickerGrid: 'true' } }, icons.map((icon) => {
    const button = make('button', {
      className: `studio-icon-picker-option${icon.id === selectedId ? ' is-selected' : ''}`,
      type: 'button',
      title: icon.name,
      dataset: { iconChoice: icon.id },
      attrs: { 'aria-label': `Use ${icon.name}`, 'aria-pressed': String(icon.id === selectedId) }
    }, [createEvaraIconElement(icon.id), make('small', { text: icon.name })]);
    return button;
  }));
}

function enhanceIconPicker(panel, node, component) {
  const wrapper = panel.querySelector('[data-property-wrapper="icon"]');
  const control = wrapper?.querySelector('[data-property-field="icon"]');
  if (!wrapper || !control || wrapper.querySelector('[data-icon-picker]')) return;
  const selectedId = componentIconId(component, node);
  control.type = 'hidden';
  control.value = selectedId;
  control.classList.add('studio-icon-id-input');
  const label = wrapper.querySelector('.studio-property-label');
  const help = wrapper.querySelector('.studio-property-help');
  if (label) label.textContent = 'Icon';
  if (help) help.textContent = `Choose a stable ${EVARA_ICON_REGISTRY_VERSION} identifier. Free-text icon symbols are deprecated.`;
  wrapper.append(make('div', { className: 'studio-icon-picker', dataset: { iconPicker: 'true', selectedIcon: selectedId } }, [
    make('label', { className: 'studio-icon-picker-search' }, [
      make('span', { text: 'Search icons' }),
      make('input', { type: 'search', placeholder: 'Search map, team, message…', dataset: { iconSearch: 'true' }, attrs: { autocomplete: 'off' } })
    ]),
    iconPickerGrid('', selectedId)
  ]));
}

function enhancePropertyPanel() {
  const panel = document.querySelector('[data-catalog-sheet="properties"]');
  const state = readState();
  const node = selectedNode(state);
  const component = getStudioComponent(node?.type);
  if (!panel || !node || !component) return;
  const element = selectedElement();
  ensureBridge(element, 'actionIntent', node.props?.actionIntent || 'none');
  ensureBridge(element, 'actionTarget', node.props?.actionTarget || '');
  enhanceActionConfig(panel, node, component);
  enhanceIconPicker(panel, node, component);
  replaceWithIcon(panel.querySelector('.studio-property-contract > span'), componentIconId(component, node), { fallback: DEFAULT_COMPONENT_ICONS[component.id] });
}

function refreshIconGrid(searchInput) {
  const picker = searchInput.closest('[data-icon-picker]');
  if (!picker) return;
  const selectedId = picker.dataset.selectedIcon || 'sparkles';
  picker.querySelector('[data-icon-picker-grid]')?.replaceWith(iconPickerGrid(searchInput.value, selectedId));
}

function scheduleEnhance(delay = 0) {
  cancelAnimationFrame(frame);
  const run = () => {
    enhanceCatalogIcons();
    enhanceCanvasNodes();
    enhancePropertyPanel();
  };
  if (delay) setTimeout(() => { frame = requestAnimationFrame(run); }, delay);
  else frame = requestAnimationFrame(run);
}

function bindEvents() {
  document.addEventListener('input', (event) => {
    if (event.target.matches('[data-icon-search]')) refreshIconGrid(event.target);
  });

  document.addEventListener('change', (event) => {
    if (event.target.matches('[data-action-intent-control]')) {
      const intent = event.target.value;
      const role = previewRole();
      commitField('actionIntent', intent);
      commitField('actionTarget', intentTarget(intent, role, ''));
      scheduleEnhance(140);
    }
    if (event.target.matches('[data-action-target-control]')) {
      const role = previewRole();
      const target = event.target.value;
      if (!target || canAccessPageName(target, role)) commitField('actionTarget', target);
      scheduleEnhance(100);
    }
  });

  document.addEventListener('click', (event) => {
    const choice = event.target.closest('[data-icon-choice]');
    if (choice) {
      event.preventDefault();
      const iconId = normalizeEvaraIconId(choice.dataset.iconChoice);
      commitField('icon', iconId);
      scheduleEnhance(120);
      return;
    }
    if (event.target.closest('[data-catalog-tool="properties"], [data-catalog-action="open-properties"], [data-node-id], [data-sheet="add"]')) scheduleEnhance(80);
  });
}

function boot() {
  if (booted) return;
  booted = true;
  bindEvents();
  if (appRoot()) new MutationObserver(() => scheduleEnhance(30)).observe(appRoot(), { childList: true });
  scheduleEnhance(100);
}

window.EvaraStudioActionIcons = Object.freeze({
  actionBindingVersion: ACTION_BINDING_VERSION,
  iconRegistryVersion: EVARA_ICON_REGISTRY_VERSION,
  intents: ACTION_INTENTS,
  icons: EVARA_ICONS,
  allowedRoutes
});

window.addEventListener('evara:session-ready', boot, { once: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 800), { once: true });
else setTimeout(boot, 800);
