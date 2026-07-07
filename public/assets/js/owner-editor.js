import { getSavedUserProfile, getSavedUserRole, normalizeRole } from './firebase.js';

const OWNER_ROLES = new Set(['owner', 'super_admin', 'admin']);
const TOGGLE_KEY = 'evaraos-owner-edit-mode-v2';
const DRAFT_KEY = 'evaraos-owner-live-placeholders-v1';

function role() {
  const profile = getSavedUserProfile?.() || {};
  return normalizeRole?.(profile.role || getSavedUserRole?.() || '') || '';
}
function allowed() { return OWNER_ROLES.has(role()); }
function readDraft() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; } }
function writeDraft(draft) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {} }
function pageKey() { return location.pathname || '/'; }

function style() {
  if (document.getElementById('ownerEditorGlobalStyle')) return;
  const tag = document.createElement('style');
  tag.id = 'ownerEditorGlobalStyle';
  tag.textContent = `
    .owner-edit-fab-global{position:fixed;right:18px;bottom:calc(92px + env(safe-area-inset-bottom,0px));z-index:9999;display:none;align-items:center;gap:9px;padding:12px 14px;border-radius:999px;background:linear-gradient(145deg,rgba(255,255,255,.32),rgba(255,255,255,.12));color:var(--text-primary,#fff);border:1px solid rgba(255,255,255,.46);box-shadow:0 18px 44px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.36);text-decoration:none;font-weight:950;backdrop-filter:blur(24px) saturate(1.35);-webkit-backdrop-filter:blur(24px) saturate(1.35)}
    .owner-edit-fab-global.is-visible{display:flex}.owner-edit-toggle{right:126px!important}.owner-edit-fab-global:before{content:"";width:9px;height:9px;border-radius:99px;background:#40ff9f;box-shadow:0 0 14px rgba(64,255,159,.8)}
    .owner-editor-active [data-builder-slot],.owner-editor-active .glass-card,.owner-editor-active [data-evaraos-brand-icon]{position:relative;outline:1.5px dashed rgba(255,255,255,.58)!important;outline-offset:5px!important}.owner-editor-active [data-builder-slot]:after,.owner-editor-active .glass-card:after{content:'add/edit';position:absolute;right:10px;top:10px;z-index:30;padding:5px 9px;border-radius:999px;background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.38);color:var(--text-primary,#fff);font-size:11px;font-weight:950;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
    .owner-live-placeholder{position:relative;min-height:96px;border:1.5px dashed rgba(255,255,255,.52);border-radius:24px;background:linear-gradient(145deg,rgba(255,255,255,.20),rgba(255,255,255,.07));display:grid;place-items:center;text-align:center;padding:16px;margin:10px 0;color:var(--text-primary,#fff);box-shadow:inset 0 1px 0 rgba(255,255,255,.24)}
    .owner-live-placeholder button{width:40px;height:40px;border-radius:999px;border:1px solid rgba(255,255,255,.45);background:rgba(255,255,255,.22);color:inherit;font-size:1.1rem;font-weight:950}.owner-live-placeholder strong{display:block;margin-top:8px}.owner-live-placeholder small{color:var(--text-secondary,rgba(255,255,255,.72))}
    .owner-editor-panel{position:fixed;left:14px;right:14px;bottom:calc(150px + env(safe-area-inset-bottom,0px));z-index:9998;display:none;padding:14px;border-radius:24px;background:linear-gradient(145deg,rgba(255,255,255,.30),rgba(255,255,255,.12));border:1px solid rgba(255,255,255,.42);box-shadow:0 18px 48px rgba(0,0,0,.25);backdrop-filter:blur(28px) saturate(1.35);-webkit-backdrop-filter:blur(28px) saturate(1.35);color:var(--text-primary,#fff)}
    .owner-editor-panel.is-visible{display:grid;gap:10px}.owner-editor-panel strong{font-size:14px}.owner-editor-panel p{margin:0;color:var(--text-secondary,rgba(255,255,255,.72));font-size:12px}.owner-editor-panel a{color:inherit;font-weight:950}.owner-editor-actions{display:flex;gap:8px;flex-wrap:wrap}.owner-editor-actions button,.owner-editor-actions a{border:0;border-radius:14px;padding:10px 12px;color:#fff;background:rgba(255,255,255,.16);font-weight:900;text-decoration:none}
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
  toggle.textContent = 'Live Edit';
  const panel = document.createElement('div');
  panel.className = 'owner-editor-panel';
  panel.innerHTML = '<strong>Owner live editing</strong><p>Highlight editable zones, add placeholders, and open the Website Builder.</p><div class="owner-editor-actions"><button type="button" data-owner-add-placeholder>Add placeholder</button><button type="button" data-owner-clear-placeholders>Clear placeholders</button><a href="/website-builder.html">Open Builder</a></div>';
  toggle.addEventListener('click', () => {
    const next = !document.documentElement.classList.contains('owner-editor-active');
    document.documentElement.classList.toggle('owner-editor-active', next);
    panel.classList.toggle('is-visible', next);
    localStorage.setItem(TOGGLE_KEY, next ? '1' : '0');
  });
  panel.querySelector('[data-owner-add-placeholder]')?.addEventListener('click', addPlaceholder);
  panel.querySelector('[data-owner-clear-placeholders]')?.addEventListener('click', clearPlaceholders);
  document.body.append(fab, toggle, panel);
}

function renderPlaceholders() {
  document.querySelectorAll('.owner-live-placeholder').forEach((node) => node.remove());
  const list = readDraft()[pageKey()] || [];
  const host = document.querySelector('main') || document.getElementById('appRoot') || document.body;
  list.forEach((item, index) => {
    const node = document.createElement('div');
    node.className = 'owner-live-placeholder';
    node.innerHTML = `<button type="button" data-owner-remove-placeholder="${index}">-</button><strong>${item.title || 'New editable block'}</strong><small>${item.copy || 'Add content, image, CTA, form, or section here.'}</small>`;
    node.querySelector('[data-owner-remove-placeholder]')?.addEventListener('click', () => removePlaceholder(index));
    host.appendChild(node);
  });
}
function addPlaceholder() {
  const draft = readDraft();
  const key = pageKey();
  draft[key] = draft[key] || [];
  draft[key].push({ title: 'New editable block', copy: 'Add image, headline, CTA, pricing, screenshot, or section.' });
  writeDraft(draft);
  renderPlaceholders();
}
function removePlaceholder(index) {
  const draft = readDraft();
  const key = pageKey();
  draft[key] = (draft[key] || []).filter((_, i) => i !== Number(index));
  writeDraft(draft);
  renderPlaceholders();
}
function clearPlaceholders() {
  const draft = readDraft();
  delete draft[pageKey()];
  writeDraft(draft);
  renderPlaceholders();
}
function apply() {
  style();
  ensureUi();
  renderPlaceholders();
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
