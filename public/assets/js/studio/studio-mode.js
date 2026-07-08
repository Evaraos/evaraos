import { normalizeAccessRole } from '../access-control.js';

const STUDIO_MODE_KEY = 'evaraos-studio-mode-enabled';
const OWNER_ROLES = new Set(['owner', 'admin']);

function role() {
  try {
    const raw = localStorage.getItem('evaraos-user') || sessionStorage.getItem('evaraos-user') || '{}';
    const user = JSON.parse(raw);
    return normalizeAccessRole(user.role || localStorage.getItem('evaraos-role') || sessionStorage.getItem('evaraos-role') || 'customer');
  } catch {
    return 'customer';
  }
}

function allowed() {
  return OWNER_ROLES.has(role());
}

function setEnabled(enabled) {
  localStorage.setItem(STUDIO_MODE_KEY, enabled ? 'true' : 'false');
  document.documentElement.classList.toggle('evara-studio-mode', enabled);
  document.documentElement.dataset.evaraStudioMode = enabled ? 'on' : 'off';
  window.dispatchEvent(new CustomEvent('evara:studio-mode', { detail: { enabled } }));
}

function isEnabled() {
  return localStorage.getItem(STUDIO_MODE_KEY) === 'true';
}

function ensureStyles() {
  if (document.getElementById('evaraStudioModeStyles')) return;
  const style = document.createElement('style');
  style.id = 'evaraStudioModeStyles';
  style.textContent = `
    html.evara-studio-mode [data-owner-edit],
    html.evara-studio-mode .glass-card,
    html.evara-studio-mode .eva-card,
    html.evara-studio-mode .studio-command-card,
    html.evara-studio-mode .studio-registry-card,
    html.evara-studio-mode .studio-module-card {
      outline: 1.5px dashed rgba(255,255,255,.38) !important;
      outline-offset: 6px !important;
      cursor: crosshair !important;
    }
    html.evara-studio-mode .evara-studio-mode-toggle {
      background: linear-gradient(145deg,rgba(255,255,255,.44),rgba(227,6,19,.22)) !important;
    }
    .evara-studio-mode-toggle {
      position: fixed;
      right: 18px;
      bottom: calc(214px + env(safe-area-inset-bottom,0px));
      z-index: 9996;
      display: none;
      border: 1px solid rgba(255,255,255,.42);
      border-radius: 999px;
      padding: 12px 14px;
      color: #fff;
      font-weight: 950;
      background: linear-gradient(145deg,rgba(255,255,255,.30),rgba(255,255,255,.11));
      box-shadow: 0 18px 44px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.36);
      backdrop-filter: blur(24px) saturate(1.28);
      -webkit-backdrop-filter: blur(24px) saturate(1.28);
    }
    .evara-studio-mode-toggle.is-visible { display: inline-flex; }
  `;
  document.head.appendChild(style);
}

function ensureButton() {
  let button = document.querySelector('.evara-studio-mode-toggle');
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'evara-studio-mode-toggle';
    button.textContent = 'Studio Mode';
    button.addEventListener('click', () => setEnabled(!isEnabled()));
    document.body.appendChild(button);
  }
  button.classList.toggle('is-visible', allowed());
}

function boot() {
  ensureStyles();
  ensureButton();
  if (!allowed()) setEnabled(false);
  else setEnabled(isEnabled());
}

window.EvaraStudioMode = { enable: () => setEnabled(true), disable: () => setEnabled(false), toggle: () => setEnabled(!isEnabled()), isEnabled };
window.addEventListener('evara:session-ready', boot);
window.addEventListener('pageshow', boot);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
