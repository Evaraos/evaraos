import { getStudioComponent } from './component-registry.js';

const STORAGE_KEY = 'evaraos-studio-visual-builder-v1';
const OMITTED_FIELDS = new Set(['asset', 'radius']);
let booted = false;

const root = () => document.querySelector('#appRoot');

function readState() {
  try {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return state && typeof state === 'object' ? state : null;
  } catch {
    return null;
  }
}

function activePage(state) {
  return state?.pages?.find((page) => page.id === state.activePageId) || state?.pages?.[0] || null;
}

function bridgeFields(component) {
  const fields = [...(component?.fields || [])].filter((field) => !OMITTED_FIELDS.has(field));
  if (component?.defaults?.icon !== undefined && !fields.includes('icon')) fields.push('icon');
  if (fields.includes('action')) {
    if (!fields.includes('actionIntent')) fields.push('actionIntent');
    if (!fields.includes('actionTarget')) fields.push('actionTarget');
  }
  return fields;
}

function fieldValue(node, component, field) {
  if (field === 'actionIntent') return String(node?.props?.actionIntent || 'none');
  if (field === 'actionTarget') return String(node?.props?.actionTarget || '');
  return String(node?.props?.[field] ?? component?.defaults?.[field] ?? '');
}

function makeBridge(field, value) {
  const bridge = document.createElement('span');
  bridge.className = 'studio-catalog-field-bridge';
  bridge.textContent = value;
  bridge.dataset.catalogFieldBridge = 'true';
  bridge.dataset.editableText = 'true';
  bridge.dataset.field = field;
  bridge.tabIndex = -1;
  bridge.setAttribute('aria-hidden', 'true');
  return bridge;
}

function installPropertyBridges() {
  const state = readState();
  const page = activePage(state);
  if (!page) return;

  document.querySelectorAll('.studio-node[data-node-id]').forEach((element) => {
    const node = page.nodes?.find((item) => item.id === element.dataset.nodeId);
    const component = getStudioComponent(node?.type);
    if (!node || !component) return;

    const expected = bridgeFields(component);
    const existing = new Map([...element.querySelectorAll(':scope > [data-catalog-field-bridge][data-field]')].map((bridge) => [bridge.dataset.field, bridge]));
    const fragment = document.createDocumentFragment();

    expected.forEach((field) => {
      const current = existing.get(field);
      if (current) {
        current.textContent = fieldValue(node, component, field);
        fragment.append(current);
        existing.delete(field);
      } else {
        fragment.append(makeBridge(field, fieldValue(node, component, field)));
      }
    });

    existing.forEach((bridge) => bridge.remove());
    element.prepend(fragment);
    element.dataset.propertyBridge = 'canonical-v1';
  });
}

function boot() {
  if (booted) return;
  booted = true;
  const app = root();
  if (!app) return;
  new MutationObserver(installPropertyBridges).observe(app, { childList: true });
  installPropertyBridges();
}

window.EvaraStudioPropertyBridge = Object.freeze({
  version: 'canonical-property-bridge-v1',
  install: installPropertyBridges
});

window.addEventListener('evara:session-ready', boot, { once: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 500), { once: true });
else setTimeout(boot, 500);
