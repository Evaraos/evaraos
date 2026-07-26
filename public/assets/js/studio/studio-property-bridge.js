const BRIDGE_VERSION = 'canonical-property-bridge-v2';
let booted = false;

const root = () => document.querySelector('#appRoot');

function installPropertyBridges() {
  document.querySelectorAll('[data-catalog-field-bridge]').forEach((bridge) => bridge.remove());
  document.querySelectorAll('.studio-node[data-node-id]').forEach((element) => {
    element.dataset.propertyBridge = BRIDGE_VERSION;
  });
}

function updateNodeField(nodeId, field, value) {
  return window.EvaraStudioVisualBuilder?.updateNodeField?.(nodeId, field, value) === true;
}

function boot() {
  if (booted) return;
  booted = true;
  const app = root();
  if (!app) return;
  new MutationObserver(installPropertyBridges).observe(app, { childList: true, subtree: true });
  installPropertyBridges();
}

window.EvaraStudioPropertyBridge = Object.freeze({
  version: BRIDGE_VERSION,
  install: installPropertyBridges,
  updateNodeField
});

window.addEventListener('evara:session-ready', boot, { once: true });
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 500), { once: true });
} else {
  setTimeout(boot, 500);
}
