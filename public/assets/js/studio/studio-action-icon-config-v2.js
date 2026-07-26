import { getStudioComponent } from './component-registry.js';
import { canAccessPageName, normalizeAccessRole, pagesForRole } from '../access-control.js';
import {
  DEFAULT_COMPONENT_ICONS,
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
const SAFE_ROUTES = Object.freeze([
  'dashboard.html', 'customer_dashboard.html', 'settings-v2.html', 'messages.html', 'customer-messaging.html',
  'jobs.html', 'leads.html', 'dispatch.html', 'schedule.html', 'field.html', 'territory-map.html', 'revenue.html',
  'marketplace-payouts.html', 'customer-commerce.html', 'customer-service-history.html', 'customer_bills.html', 'ai_command.html'
]);

let booted = false;
let frame = 0;

const appRoot = () => document.querySelector('#appRoot');
const selectedElement = () => document.querySelector('.studio-node.is-selected[data-node-id]');
const clean = (value, max = 1200) => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, max);
const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

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

function previewRole(state = readState()) {
  return normalizeAccessRole(state?.previewRole || 'owner');
}

function nodeState(state, nodeId) {
  return activePage(state)?.nodes?.find((node) => node.id === nodeId) || null;
}

function iconIdFor(component, node) {
  return normalizeEvaraIconId(node?.props?.icon, DEFAULT_COMPONENT_ICONS[component?.id] || 'sparkles');
}

function routeLabel(pageName = '') {
  return String(pageName).replace(/^\//, '').replace(/\.html$/i, '').replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (value) => value.toUpperCase());
}

function allowedRoutes(role) {
  const authorized = new Set(pagesForRole(role));
  return SAFE_ROUTES.filter((page) => authorized.has(page)).map((page) => ({ page, route: `/${page}`, label: routeLabel(page) }));
}

function resolvedTarget(intent, role, current = '') {
  const routes = allowedRoutes(role);
  if (intent === 'message') return routes.find((item) => item.page === (role === 'customer' ? 'customer-messaging.html' : 'messages.html'))?.route || '';
  if (intent === 'schedule') return routes.find((item) => item.page === 'schedule.html')?.route || '';
  if (intent === 'navigate') {
    const normalized = String(current || '').replace(/^\//, '');
    return routes.some((item) => item.page === normalized) ? `/${normalized}` : (routes[0]?.route || '');
  }
  return '';
}

async function commitField(field, value) {
  const element = selectedElement();
  if (!element || !field) return false;
  const updated = window.EvaraStudioPropertyBridge?.updateNodeField?.(
    element.dataset.nodeId,
    field,
    clean(value, 2000).trim()
  );
  await wait(40);
  return updated === true;
}

async function commitAction(intent, target) {
  await commitField('actionIntent', intent);
  await commitField('actionTarget', target);
  scheduleEnhance(80);
}

function renderIcon(container, value, fallback = 'sparkles') {
  if (!container) return;
  const iconId = normalizeEvaraIconId(value, fallback);
  if (container.dataset.evaraIconRendered === iconId) return;
  container.replaceChildren(createEvaraIconElement(iconId));
  container.dataset.evaraIconRendered = iconId;
  container.dataset.evaraIconId = iconId;
}

function enhanceCatalogAndCanvas() {
  document.querySelectorAll('[data-add-component]').forEach((tile) => {
    const component = getStudioComponent(tile.dataset.addComponent);
    renderIcon(tile.querySelector(':scope > span'), DEFAULT_COMPONENT_ICONS[component?.id], 'sparkles');
  });

  const state = readState();
  const page = activePage(state);
  if (!page) return;
  const role = previewRole(state);
  document.querySelectorAll('.studio-node[data-node-id]').forEach((element) => {
    const node = nodeState(state, element.dataset.nodeId);
    const component = getStudioComponent(node?.type);
    if (!node || !component) return;
    const iconId = iconIdFor(component, node);
    renderIcon(element.querySelector('.studio-node-icon'), iconId, DEFAULT_COMPONENT_ICONS[component.id]);
    const intent = clean(node.props?.actionIntent || 'none', 40).toLowerCase();
    const target = clean(node.props?.actionTarget || '', 240);
    element.dataset.iconRegistry = EVARA_ICON_REGISTRY_VERSION;
    element.dataset.iconId = iconId;
    element.dataset.actionBinding = ACTION_BINDING_VERSION;
    element.dataset.actionIntent = intent;
    element.dataset.actionTarget = target;
    element.dataset.actionAllowed = String(!target || canAccessPageName(target, role));
  });
}

function normalizeActionLabel(panel, node) {
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
  if (help) help.textContent = 'Visible CTA copy only. Behavior and destination are configured separately.';
}

function fieldBlock(label, control, help, field) {
  return make('label', { className: 'studio-property-field studio-action-property', dataset: { actionConfigField: field } }, [
    make('span', { className: 'studio-property-label', text: label }),
    control,
    make('small', { className: 'studio-property-help', text: help })
  ]);
}

function intentControl(value) {
  const select = make('select', { className: 'studio-property-control', dataset: { actionIntentControl: 'true' }, attrs: { 'aria-label': 'Action behavior' } });
  ACTION_INTENTS.forEach(([intent, label]) => {
    const option = make('option', { value: intent, text: label });
    option.selected = value === intent;
    select.append(option);
  });
  return select;
}

function targetControl(intent, target, role) {
  const navigates = ['navigate', 'message', 'schedule'].includes(intent);
  const select = make('select', { className: 'studio-property-control', disabled: !navigates, dataset: { actionTargetControl: 'true' }, attrs: { 'aria-label': 'Action destination' } });
  if (intent === 'navigate') {
    allowedRoutes(role).forEach(({ route, label }) => {
      const option = make('option', { value: route, text: label });
      option.selected = target === route;
      select.append(option);
    });
  } else if (intent === 'message' || intent === 'schedule') {
    const route = resolvedTarget(intent, role, target);
    select.append(make('option', { value: route, text: route ? routeLabel(route) : 'Unavailable for this role' }));
  } else {
    select.append(make('option', { value: '', text: 'Handled by the approved runtime' }));
  }
  return select;
}

function permissionStatus(intent, target, role) {
  if (!['navigate', 'message', 'schedule'].includes(intent)) return ['neutral', 'No route permission is required until this intent receives a production runtime binding.'];
  if (!target) return ['warning', `No authorized destination is available for ${role}.`];
  return canAccessPageName(target, role)
    ? ['positive', `${role} may access ${target}.`]
    : ['critical', `${role} is not authorized to access ${target}.`];
}

function enhanceActions(panel, node, component) {
  if (!component?.fields?.includes('action') || panel.querySelector('[data-action-config]')) return;
  normalizeActionLabel(panel, node);
  const role = previewRole();
  const intent = clean(node.props?.actionIntent || 'none', 40).toLowerCase();
  const target = clean(node.props?.actionTarget || '', 240);
  const [tone, message] = permissionStatus(intent, target, role);
  panel.querySelector('.studio-property-form')?.after(make('section', { className: 'studio-action-config', dataset: { actionConfig: 'true', permissionTone: tone } }, [
    make('header', { className: 'studio-action-config-header' }, [make('div', {}, [make('strong', { text: 'No-code action' }), make('small', { text: `Preview role: ${role}` })]), make('span', { text: ACTION_BINDING_VERSION })]),
    fieldBlock('Behavior', intentControl(intent), 'Stores a semantic intent rather than executable page-specific code.', 'intent'),
    fieldBlock('Destination', targetControl(intent, target, role), 'Only routes approved by the canonical page policy are available.', 'target'),
    make('p', { className: 'studio-action-permission', text: message, dataset: { actionPermission: tone }, attrs: { role: 'status' } })
  ]));
}

function iconGrid(query, selectedId) {
  return make('div', { className: 'studio-icon-picker-grid', dataset: { iconPickerGrid: 'true' } }, searchEvaraIcons(query).slice(0, 48).map((icon) => make('button', {
    className: `studio-icon-picker-option${icon.id === selectedId ? ' is-selected' : ''}`,
    type: 'button',
    title: icon.name,
    dataset: { iconChoice: icon.id },
    attrs: { 'aria-label': `Use ${icon.name}`, 'aria-pressed': String(icon.id === selectedId) }
  }, [createEvaraIconElement(icon.id), make('small', { text: icon.name })])));
}

function enhanceIconPicker(panel, node, component) {
  const wrapper = panel.querySelector('[data-property-wrapper="icon"]');
  const control = wrapper?.querySelector('[data-property-field="icon"]');
  if (!wrapper || !control || wrapper.querySelector('[data-icon-picker]')) return;
  const selectedId = iconIdFor(component, node);
  control.type = 'hidden';
  control.value = selectedId;
  control.classList.add('studio-icon-id-input');
  const label = wrapper.querySelector('.studio-property-label');
  const help = wrapper.querySelector('.studio-property-help');
  if (label) label.textContent = 'Icon';
  if (help) help.textContent = `Choose a stable ${EVARA_ICON_REGISTRY_VERSION} ID. Free-text symbols are deprecated.`;
  wrapper.append(make('div', { className: 'studio-icon-picker', dataset: { iconPicker: 'true', selectedIcon: selectedId } }, [
    make('label', { className: 'studio-icon-picker-search' }, [make('span', { text: 'Search icons' }), make('input', { type: 'search', placeholder: 'Search map, team, message…', dataset: { iconSearch: 'true' }, attrs: { autocomplete: 'off' } })]),
    iconGrid('', selectedId)
  ]));
}

function enhancePanel() {
  const panel = document.querySelector('[data-catalog-sheet="properties"]');
  const state = readState();
  const node = selectedNode(state);
  const component = getStudioComponent(node?.type);
  if (!panel || !node || !component) return;
  enhanceActions(panel, node, component);
  enhanceIconPicker(panel, node, component);
  renderIcon(panel.querySelector('.studio-property-contract > span'), iconIdFor(component, node), DEFAULT_COMPONENT_ICONS[component.id]);
}

function refreshIconGrid(input) {
  const picker = input.closest('[data-icon-picker]');
  if (!picker) return;
  picker.querySelector('[data-icon-picker-grid]')?.replaceWith(iconGrid(input.value, picker.dataset.selectedIcon || 'sparkles'));
}

function scheduleEnhance(delay = 0) {
  cancelAnimationFrame(frame);
  const run = () => { enhanceCatalogAndCanvas(); enhancePanel(); };
  if (delay) setTimeout(() => { frame = requestAnimationFrame(run); }, delay);
  else frame = requestAnimationFrame(run);
}

function bindEvents() {
  document.addEventListener('input', (event) => {
    if (event.target.matches('[data-icon-search]')) refreshIconGrid(event.target);
  });
  document.addEventListener('change', async (event) => {
    if (event.target.matches('[data-action-intent-control]')) {
      const intent = event.target.value;
      await commitAction(intent, resolvedTarget(intent, previewRole(), ''));
    } else if (event.target.matches('[data-action-target-control]')) {
      const target = event.target.value;
      if (!target || canAccessPageName(target, previewRole())) await commitField('actionTarget', target);
      scheduleEnhance(80);
    }
  });
  document.addEventListener('click', async (event) => {
    const choice = event.target.closest('[data-icon-choice]');
    if (choice) {
      event.preventDefault();
      await commitField('icon', normalizeEvaraIconId(choice.dataset.iconChoice));
      scheduleEnhance(80);
      return;
    }
    if (event.target.closest('[data-catalog-tool="properties"], [data-catalog-action="open-properties"], [data-node-id], [data-sheet="add"]')) scheduleEnhance(100);
  });
}

function boot() {
  if (booted) return;
  booted = true;
  bindEvents();
  if (appRoot()) new MutationObserver(() => scheduleEnhance(40)).observe(appRoot(), { childList: true });
  scheduleEnhance(120);
}

window.EvaraStudioActionIcons = Object.freeze({
  actionBindingVersion: ACTION_BINDING_VERSION,
  iconRegistryVersion: EVARA_ICON_REGISTRY_VERSION,
  intents: ACTION_INTENTS,
  allowedRoutes
});

window.addEventListener('evara:session-ready', boot, { once: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 850), { once: true });
else setTimeout(boot, 850);
