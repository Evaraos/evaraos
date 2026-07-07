import { getSavedUserProfile, getSavedUserRole, normalizeRole } from './firebase.js';

const OWNER_ROLES = new Set(['owner', 'super_admin', 'admin']);
const TOGGLE_KEY = 'evaraos-owner-edit-mode-v1';

function role() {
  const profile = getSavedUserProfile?.() || {};
  return normalizeRole?.(profile.role || getSavedUserRole?.() || '') || '';
}

function allowed() {
  return OWNER_ROLES.has(role());
}

function style() {
  if (document.getElementById('ownerEditorGlobalStyle')) return;
  const tag = document.createElement('style');
  tag.id = 'ownerEditorGlobalStyle';
  tag.textContent = `
    .owner-edit-fab-global{position:fixed;right:18px;bottom:calc(92px + env(safe-area-inset-bottom,0px));z-index:9999;display:none;align-items:center;gap:9px;padding:12px 14px;border-radius:999px;background:linear-gradient(145deg,rgba(255,255,255,.30),rgba(255,255,255,.12));color:var(--text-primary,#fff);border:1px solid rgba(255,255,255,.45);box-shadow:0 18px 44px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.34);text-decoration:none;font-weight:950;backdrop-filter:blur(24px) saturate(1.35);-webkit-backdrop-filter:blur(24px) saturate(1.35)}
    .owner-edit-fab-global.is-visible{display:flex}.owner-editor-active [data-builder-slot],.owner-editor-active .glass-card,.owner-editor-active [data-evaraos-brand-icon]{position:relative;outline:1.5px dashed rgba(255,255,255,.55)!important;outline-offset:5px!important}.owner-editor-active [data-builder-slot]:after,.owner-editor-active .glass-card:after{content:'✕ add/edit';position:absolute;right:10px;top:10px;z-index:30;padding:5px 9px;border-radius:999px;background:rgba(255,255,255,.20);border:1px solid rgba(255,255,255,.35);color:var(--text-primary,#fff);font-size:11px;font-weight:950;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
    .owner-editor-panel{position:fixed;left:14px;right:14px;bottom:calc(150px + env(safe-area-inset-bottom,0px));z-index:9998;display:none;padding:14px;border-radius:24px;background:linear-gradient(145deg,rgba(255,255,255,.28),rgba(255,255,255,.11));border:1px solid rgba(255,255,255,.42);box-shadow:0 18px 48px rgba(0,0,0,.25);backdrop-filter:blur(28px) saturate(1.35);-webkit-backdrop-filter:blur(28px) saturate(1.35);color:var(--text-primary,#fff)}
    .owner-editor-panel.is-visible{display:grid;gap:8px}.owner-editor-panel strong{font-size:14px}.owner-editor-panel p{margin:0;color:var(--text-secondary,rgba(255,255,255,.72));font-size:12px}.owner-editor-panel a{color:inherit;font-weight:950}
  `;
  document.head.appendChild(tag);
}

function ensureUi() {
  if (document.querySelector('.owner-edit-fab-global')) return;
  const fab = document.createElement('a');
  fab.className = 'owner-edit-fab-global';
  fab.href = '/website-builder.html';
  fab.textContent = 'Edit Page';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'owner-edit-fab-global owner-edit-toggle';
  toggle.style.right = '118px';
  toggle.textContent = 'Live Edit';
  const panel = document.createElement('div');
  panel.className = 'owner-editor-panel';
  panel.innerHTML = '<strong>Owner live editing enabled</strong><p>Editable slots are highlighted. Open <a href="/website-builder.html">Website Builder</a> to manage content, assets, and placeholders.</p>';
  toggle.addEventListener('click', () => {
    const next = !document.documentElement.classList.contains('owner-editor-active');
    document.documentElement.classList.toggle('owner-editor-active', next);
    panel.classList.toggle('is-visible', next);
    localStorage.setItem(TOGGLE_KEY, next ? '1' : '0');
  });
  document.body.append(fab, toggle, panel);
}

function apply() {
  style();
  ensureUi();
  const show = allowed();
  document.querySelectorAll('.owner-edit-fab-global').forEach((node) => node.classList.toggle('is-visible', show));
  if (show && localStorage.getItem(TOGGLE_KEY) === '1') {
    document.documentElement.classList.add('owner-editor-active');
    document.querySelector('.owner-editor-panel')?.classList.add('is-visible');
  }
}

window.addEventListener('evara:session-ready', apply, { passive: true });
window.addEventListener('pageshow', () => setTimeout(apply, 150));
setTimeout(apply, 1200);
