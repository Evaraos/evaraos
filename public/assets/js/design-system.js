const DESIGN_SYSTEM_VERSION = 'ds-v1';

function ensureDesignSystemStyles() {
  if (document.querySelector('link[data-evara-design-system]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `/assets/css/design-system.css?v=${DESIGN_SYSTEM_VERSION}`;
  link.dataset.evaraDesignSystem = DESIGN_SYSTEM_VERSION;
  document.head.appendChild(link);
}

function applyDesignSystem() {
  ensureDesignSystemStyles();
  document.documentElement.dataset.evaraDesignSystem = DESIGN_SYSTEM_VERSION;
  document.querySelectorAll('.glass-card').forEach((node) => node.classList.add('eva-glass'));
  document.querySelectorAll('.btn-theme-primary').forEach((node) => node.classList.add('eva-btn','eva-btn-primary'));
  document.querySelectorAll('.btn-theme-secondary').forEach((node) => node.classList.add('eva-btn','eva-btn-secondary'));
}

window.EvaraDesignSystem = { version: DESIGN_SYSTEM_VERSION, apply: applyDesignSystem };
window.addEventListener('evara:session-ready', applyDesignSystem);
window.addEventListener('pageshow', applyDesignSystem);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyDesignSystem, { once: true });
else applyDesignSystem();