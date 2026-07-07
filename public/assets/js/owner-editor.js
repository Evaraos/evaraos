import { getSavedUserProfile, getSavedUserRole, normalizeRole } from './firebase.js';

const OWNER_ROLES = new Set(['owner', 'super_admin', 'admin']);
const TOGGLE_KEY = 'evaraos-owner-edit-mode-v3';
const DRAFT_KEY = 'evaraos-owner-page-drafts-v3';

function role() {
  const profile = getSavedUserProfile?.() || {};
  return normalizeRole?.(profile.role || getSavedUserRole?.() || '') || '';
}
function allowed() { return OWNER_ROLES.has(role()); }
function pageKey() { return location.pathname.replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'home'; }
function readDraft() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; } }
function writeDraft(draft) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {} }
function editableTargets() {
  return Array.from(document.querySelectorAll('main h1,main h2,main h3,main p,main strong,main small,main .btn,main button:not([data-owner-ignore]),main [data-builder-slot]'))
    .filter((node) => !node.closest('.owner-editor-panel,.owner-edit-fab-global,.eva-nav-layer,.evara-loader-fast'))
    .filter((node) => String(node.textContent || '').trim().length > 0 || node.hasAttribute('data-builder-slot'));
}
function nodeId(node, index) {
  if (node.dataset.ownerEditId) return node.dataset.ownerEditId;
  const id = `${pageKey()}-${node.tagName.toLowerCase()}-${index}`;
  node.dataset.ownerEditId = id;
  return id;
}
function style() {
  if (document.getElementById('ownerEditorGlobalStyle')) return;
  const tag = document.createElement('style');
  tag.id = 'ownerEditorGlobalStyle';
  tag.textContent = `
    .owner-edit-fab-global{position:fixed;right:18px;bottom:calc(92px + env(safe-area-inset-bottom,0px));z-index:9999;display:none;align-items:center;gap:9px;padding:12px 15px;border-radius:999px;background:linear-gradient(145deg,rgba(255,255,255,.32),rgba(255,255,255,.13));color:var(--text-primary,#fff);border:1px solid rgba(255,255,255,.50);box-shadow:0 18px 44px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.42);text-decoration:none;font-weight:950;backdrop-filter:blur(28px) saturate(1.45);-webkit-backdrop-filter:blur(28px) saturate(1.45)}
    .owner-edit-fab-global.is-visible{display:flex}.owner-edit-toggle{right:124px!important}.owner-edit-fab-global:before{content:'';width:9px;height:9px;border-radius:999px;background:rgba(255,255,255,.9);box-shadow:0 0 18px rgba(255,255,255,.85)}
    .owner-editor-active [data-owner-edit-id],.owner-editor-active [data-builder-slot]{position:relative;outline:1.5px dashed rgba(255,255,255,.62)!important;outline-offset:5px!important;border-radius:10px!important;cursor:text!important}.owner-editor-active [data-owner-edit-id]:after,.owner-editor-active [data-builder-slot]:after{content:'✕ edit';position:absolute;right:6px;top:-14px;z-index:30;padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.24);border:1px solid rgba(255,255,255,.40);color:var(--text-primary,#fff);font-size:10px;font-weight:950;line-height:1;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
    .owner-editor-active [data-builder-slot]:empty{min-height:88px;display:grid;place-items:center}.owner-editor-active [data-builder-slot]:empty:before{content:'+ Add content block';color:var(--text-secondary,rgba(255,255,255,.72));font-weight:900}
    .owner-live-placeholder{position:relative;min-height:108px;border:1.5px dashed rgba(255,255,255,.54);border-radius:26px;background:linear-gradient(145deg,rgba(255,255,255,.22),rgba(255,255,255,.08));display:grid;place-items:center;text-align:center;padding:18px;margin:12px 0;color:var(--text-primary,#fff);box-shadow:inset 0 1px 0 rgba(255,255,255,.24),0 18px 42px rgba(0,0,0,.12)}
    .owner-live-placeholder button{width:40px;height:40px;border-radius:999px;border:1px solid rgba(255,255,255,.45);background:rgba(255,255,255,.22);color:inherit;font-size:1.1rem;font-weight:950}.owner-live-placeholder strong{display:block;margin-top:8px}.owner-live-placeholder small{color:var(--text-secondary,rgba(255,255,255,.72))}
    .owner-editor-panel{position:fixed;left:14px;right:14px;bottom:calc(150px + env(safe-area-inset-bottom,0px));z-index:9998;display:none;padding:16px;border-radius:26px;background:linear-gradient(145deg,rgba(255,255,255,.30),rgba(255,255,255,.12));border:1px solid rgba(255,255,255,.44);box-shadow:0 20px 54px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.35);backdrop-filter:blur(30px) saturate(1.45);-webkit-backdrop-filter:blur(30px) saturate(1.45);color:var(--text-primary,#fff)}
    .owner-editor-panel.is-visible{display:grid;gap:10px}.owner-editor-panel strong{font-size:14px}.owner-editor-panel p{margin:0;color:var(--text-secondary,rgba(255,255,255,.72));font-size:12px;line-height:1.45}.owner-editor-panel a{color:inherit;font-weight:950}.owner-editor-panel textarea{min-height:92px;border-radius:18px;border:1px solid rgba(255,255,255,.34);background:rgba(255,255,255,.14);color:inherit;padding:12px;font:inherit;resize:vertical}.owner-editor-actions{display:flex;gap:8px;flex-wrap:wrap}.owner-editor-actions button,.owner-editor-actions a{border:1px solid rgba(255,255,255,.38);border-radius:999px;padding:10px 13px;color:inherit;background:linear-gradient(145deg,rgba(255,255,255,.30),rgba(255,255,255,.12));font-weight:900;text-decoration:none}
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
  panel.innerHTML = '<strong>Owner live editing</strong><p>Tap highlighted text to edit it. Add blanks/placeholders anywhere and manage content from the Website Builder.</p><textarea data-owner-editor-text placeholder="Select text to edit..."></textarea><div class="owner-editor-actions"><button type="button" data-owner-save>Save Draft</button><button type="button" data-owner-add-placeholder>Add Placeholder</button><button type="button" data-owner-clear-placeholders>Clear Placeholders</button><a href="/website-builder.html">Open Builder</a></div>';
  document.body.append(fab, toggle, panel);
  toggle.addEventListener('click', () => {
    const next = !document.documentElement.classList.contains('owner-editor-active');
    document.documentElement.classList.toggle('owner-editor-active', next);
    panel.classList.toggle('is-visible', next);
    localStorage.setItem(TOGGLE_KEY, next ? '1' : '0');
    if (next) prepareTargets();
  });
  panel.querySelector('[data-owner-save]')?.addEventListener('click', () => saveSelected(panel));
  panel.querySelector('[data-owner-add-placeholder]')?.addEventListener('click', addPlaceholder);
  panel.querySelector('[data-owner-clear-placeholders]')?.addEventListener('click', clearPlaceholders);
}
function prepareTargets() {
  const allDrafts = readDraft();
  const pageDrafts = allDrafts[pageKey()]?.text || {};
  editableTargets().forEach((node, index) => {
    const id = nodeId(node, index);
    if (pageDrafts[id]) node.textContent = pageDrafts[id];
    if (node.dataset.ownerBound === 'true') return;
    node.dataset.ownerBound = 'true';
    node.addEventListener('click', (event) => {
      if (!document.documentElement.classList.contains('owner-editor-active')) return;
      event.preventDefault();
      event.stopPropagation();
      const panel = document.querySelector('.owner-editor-panel');
      panel?.classList.add('is-visible');
      panel.dataset.selectedId = id;
      panel.querySelector('[data-owner-editor-text]').value = String(node.textContent || '').trim();
    }, true);
  });
}
function renderPlaceholders() {
  document.querySelectorAll('.owner-live-placeholder').forEach((node) => node.remove());
  const list = readDraft()[pageKey()]?.blocks || [];
  const host = document.querySelector('main') || document.getElementById('appRoot') || document.body;
  list.forEach((item, index) => {
    const node = document.createElement('div');
    node.className = 'owner-live-placeholder';
    node.dataset.builderSlot = 'true';
    node.innerHTML = `<button type="button" data-owner-remove-placeholder="${index}">✕</button><strong>${item.title || 'New editable block'}</strong><small>${item.copy || 'Add content, image, CTA, form, pricing, screenshot, or section here.'}</small>`;
    node.querySelector('[data-owner-remove-placeholder]')?.addEventListener('click', () => removePlaceholder(index));
    host.appendChild(node);
  });
}
function saveSelected(panel) {
  const id = panel.dataset.selectedId;
  const value = panel.querySelector('[data-owner-editor-text]')?.value || '';
  if (!id || !value.trim()) return;
  const draft = readDraft();
  const key = pageKey();
  draft[key] = draft[key] || { text: {}, blocks: [] };
  draft[key].text[id] = value.trim();
  writeDraft(draft);
  document.querySelector(`[data-owner-edit-id="${CSS.escape(id)}"]`)?.replaceChildren(document.createTextNode(value.trim()));
}
function addPlaceholder() {
  const draft = readDraft();
  const key = pageKey();
  draft[key] = draft[key] || { text: {}, blocks: [] };
  draft[key].blocks.push({ title: 'New editable block', copy: 'Add image, headline, CTA, pricing, screenshot, or section.' });
  writeDraft(draft);
  renderPlaceholders();
}
function removePlaceholder(index) {
  const draft = readDraft();
  const key = pageKey();
  draft[key] = draft[key] || { text: {}, blocks: [] };
  draft[key].blocks = draft[key].blocks.filter((_, i) => i !== Number(index));
  writeDraft(draft);
  renderPlaceholders();
}
function clearPlaceholders() {
  const draft = readDraft();
  const key = pageKey();
  if (draft[key]) draft[key].blocks = [];
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
    prepareTargets();
  }
}
window.addEventListener('evara:session-ready', apply, { passive: true });
window.addEventListener('pageshow', () => setTimeout(apply, 150));
setTimeout(apply, 1200);
