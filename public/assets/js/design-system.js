const DESIGN_SYSTEM_VERSION = 'ds-v2';
const DESIGN_SYSTEM_BUNDLE_VERSION = '2';
let designSystemRegistryPromise = null;

function ensureDesignSystemStyles() {
  const current = document.querySelector('link[data-evara-design-system]');
  if (current) return current;

  const existing = document.querySelector('link[href*="/assets/css/design-system.css"]');
  if (existing) {
    existing.dataset.evaraDesignSystem = DESIGN_SYSTEM_VERSION;
    return existing;
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `/assets/css/design-system.css?v=${DESIGN_SYSTEM_BUNDLE_VERSION}`;
  link.dataset.evaraDesignSystem = DESIGN_SYSTEM_VERSION;
  document.head.appendChild(link);
  return link;
}

function setContract(node, name, value) {
  if (node && !node.hasAttribute(name)) node.setAttribute(name, value);
}

function applyCompatibilityContracts(root = document) {
  root.querySelectorAll('.glass-card').forEach((node) => {
    node.classList.add('eva-surface');
    setContract(node, 'data-ui', 'surface');
    setContract(node, 'data-glass', 'surface');
  });

  root.querySelectorAll('.eva-card').forEach((node) => {
    setContract(node, 'data-ui', 'card');
    setContract(node, 'data-glass', 'card');
  });

  root.querySelectorAll('.btn,.btn-theme-primary,.btn-theme-secondary').forEach((node) => {
    node.classList.add('eva-control');
    setContract(node, 'data-ui', 'control');
    setContract(node, 'data-glass', 'control');
  });

  root.querySelectorAll('.input-shell,.messages-search,.messages-composer-shell').forEach((node) => {
    setContract(node, 'data-ui', 'control');
    setContract(node, 'data-glass', 'control');
  });

  root.querySelectorAll('.eva-icon').forEach((node) => setContract(node, 'data-ui', 'icon'));
}

function loadDesignSystemRegistry() {
  if (!designSystemRegistryPromise) {
    designSystemRegistryPromise = import(`/assets/js/design-system/registry.js?v=${DESIGN_SYSTEM_VERSION}`)
      .then((module) => {
        const registry = module.EVARA_DESIGN_SYSTEM_REGISTRY || null;
        if (window.EvaraDesignSystem) window.EvaraDesignSystem.registry = registry;
        return registry;
      });
  }
  return designSystemRegistryPromise;
}

function applyDesignSystem(root = document) {
  ensureDesignSystemStyles();
  document.documentElement.dataset.evaraDesignSystem = DESIGN_SYSTEM_VERSION;
  applyCompatibilityContracts(root);
  loadDesignSystemRegistry().catch((error) => console.warn('Evara design-system registry unavailable:', error));
}

window.EvaraDesignSystem = {
  version: DESIGN_SYSTEM_VERSION,
  bundleVersion: DESIGN_SYSTEM_BUNDLE_VERSION,
  registry: null,
  apply: applyDesignSystem,
  loadRegistry: loadDesignSystemRegistry
};

window.addEventListener('evara:session-ready', () => applyDesignSystem());
window.addEventListener('evara:design-system-refresh', (event) => applyDesignSystem(event.detail?.root || document));
window.addEventListener('pageshow', () => applyDesignSystem());

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => applyDesignSystem(), { once: true });
} else {
  applyDesignSystem();
}
