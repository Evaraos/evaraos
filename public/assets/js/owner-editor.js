import { getSavedUserProfile, getSavedUserRole, normalizeRole } from './firebase.js';

const OWNER_ROLES = new Set(['owner', 'super_admin', 'admin']);
const TOGGLE_KEY = 'evaraos-owner-edit-mode-v4';
const DRAFT_KEY = 'evaraos-owner-page-drafts-v4';
let selectedNode = null;

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
    .filter((node) => !node.closest('.owner-editor-panel,.owner-edit-fab-global,.owner-edit-dock,.eva-nav-layer,.evara-loader-fast'))
    .filter((node) => String(node.textContent || '').trim().length > 0 || node.hasAttribute('data-builder-slot'));
}
function nodeId(node, index = 0) {
  if (node.dataset.ownerEditId) return node.dataset.ownerEditId;
  const id = `${pageKey()}-${node.tagName.toLowerCase()}-${index}`;
  node.dataset.ownerEditId = id;
  return id;
}
function toast(message) {
  let node = document.querySelector('.owner-editor-toast');
  if (!node) { node = document.createElement('div'); node.className = 'owner-editor-toast'; document.body.appendChild(node); }
  node.textContent = message;
  node.classList.add('is-visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('is-visible'), 1400);
}
function style() {
  if (document.getElementById('ownerEditorGlobalStyle')) return;
  const tag = document.createElement('style');
  tag.id = 'ownerEditorGlobalStyle';
  tag.textContent = `
    .owner-edit-dock{position:fixed;right:18px;bottom:calc(92px + env(safe-area-inset-bottom,0px));z-index:9997;display:none;align-items:center;gap:10px;padding:7px;border-radius:999px;background:linear-gradient(145deg,rgba(255,255,255,.22),rgba(255,255,255,.08));border:1px solid rgba(255,255,255,.36);box-shadow:0 18px 44px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.30);backdrop-filter:blur(26px) saturate(1.35);-webkit-backdrop-filter:blur(26px) saturate(1.35)}
    .owner-edit-dock.is-visible{display:flex}.owner-edit-fab-global{position:static!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:8px!important;padding:10px 13px!important;border-radius:999px!important;background:linear-gradient(145deg,rgba(255,255,255,.28),rgba(255,255,255,.10))!important;color:var(--text-primary,#fff)!important;border:1px solid rgba(255,255,255,.38)!important;text-decoration:none!important;font-weight:950!important;white-space:nowrap!important}.owner-edit-fab-global:before{content:'';width:8px;height:8px;border-radius:999px;background:rgba(255,255,255,.9);box-shadow:0 0 16px rgba(255,255,255,.72)}.owner-edit-toggle.is-on,.owner-edit-fab-global:hover{background:linear-gradient(145deg,rgba(255,255,255,.36),rgba(242,23,45,.16))!important;border-color:rgba(255,255,255,.52)!important}
    .owner-editor-active [data-owner-edit-id],.owner-editor-active [data-builder-slot]{position:relative;outline:1.5px dashed rgba(255,255,255,.54)!important;outline-offset:5px!important;border-radius:12px!important;cursor:text!important}.owner-editor-active [data-owner-edit-id]:after,.owner-editor-active [data-builder-slot]:after{content:'edit';position:absolute;right:6px;top:-14px;z-index:30;padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.34);color:var(--text-primary,#fff);font-size:10px;font-weight:950;line-height:1;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}.owner-selected-live{outline:2px solid rgba(242,23,45,.96)!important;outline-offset:7px!important;box-shadow:0 0 0 7px rgba(242,23,45,.10)!important}
    .owner-editor-active [data-builder-slot]:empty{min-height:88px;display:grid;place-items:center}.owner-editor-active [data-builder-slot]:empty:before{content:'+ Add content block';color:var(--text-secondary,rgba(255,255,255,.72));font-weight:900}
    .owner-live-placeholder{position:relative;min-height:108px;border:1.5px dashed rgba(255,255,255,.46);border-radius:26px;background:linear-gradient(145deg,rgba(255,255,255,.18),rgba(255,255,255,.07));display:grid;place-items:center;text-align:center;padding:18px;margin:12px 0;color:var(--text-primary,#fff);box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 18px 42px rgba(0,0,0,.12)}
    .owner-live-placeholder button{width:38px;height:38px;border-radius:999px;border:1px solid rgba(255,255,255,.40);background:rgba(255,255,255,.18);color:inherit;font-size:1rem;font-weight:950}.owner-live-placeholder strong{display:block;margin-top:8px}.owner-live-placeholder small{color:var(--text-secondary,rgba(255,255,255,.72))}
    .owner-editor-panel{position:fixed;right:18px;bottom:calc(156px + env(safe-area-inset-bottom,0px));width:min(430px,calc(100vw - 36px));max-height:calc(100vh - 236px);overflow:auto;z-index:9998;display:none;padding:16px;border-radius:28px;background:linear-gradient(145deg,rgba(255,255,255,.28),rgba(10,12,18,.70));border:1px solid rgba(255,255,255,.40);box-shadow:0 24px 64px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.30);backdrop-filter:blur(30px) saturate(1.45);-webkit-backdrop-filter:blur(30px) saturate(1.45);color:var(--text-primary,#fff)}
    .owner-editor-panel.is-visible{display:grid;gap:12px}.owner-editor-panel h3{margin:0;font-size:1.05rem;letter-spacing:-.04em}.owner-editor-panel p{margin:0;color:var(--text-secondary,rgba(255,255,255,.72));font-size:12px;line-height:1.45}.owner-editor-panel textarea{min-height:104px;border-radius:18px;border:1px solid rgba(255,255,255,.30);background:rgba(255,255,255,.12);color:inherit;padding:12px;font:inherit;resize:vertical}.owner-editor-section{display:grid;gap:9px;padding:11px;border-radius:20px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.07)}.owner-editor-section strong{font-size:.74rem;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.72)}.owner-editor-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.owner-editor-actions button,.owner-editor-actions a{border:1px solid rgba(255,255,255,.30);border-radius:14px;padding:10px 12px;color:inherit;background:linear-gradient(145deg,rgba(255,255,255,.22),rgba(255,255,255,.08));font-weight:900;text-decoration:none;text-align:center}.owner-editor-actions button:hover,.owner-editor-actions a:hover{background:linear-gradient(145deg,rgba(255,255,255,.30),rgba(242,23,45,.13))}
    .owner-editor-toast{position:fixed!important;left:50%!important;top:calc(env(safe-area-inset-top,0px) + 18px)!important;transform:translateX(-50%) translateY(-12px)!important;opacity:0!important;z-index:9999!important;padding:12px 14px!important;border-radius:18px!important;color:#fff!important;background:rgba(10,12,18,.76)!important;border:1px solid rgba(255,255,255,.32)!important;backdrop-filter:blur(22px)!important;transition:.2s ease!important}.owner-editor-toast.is-visible{opacity:1!important;transform:translateX(-50%) translateY(0)!important}
    @media(max-width:760px){.owner-edit-dock{right:12px;left:12px;bottom:calc(86px + env(safe-area-inset-bottom,0px));justify-content:center}.owner-edit-fab-global{flex:1!important}.owner-editor-panel{left:12px;right:12px;width:auto;bottom:calc(146px + env(safe-area-inset-bottom,0px));max-height:44vh}.owner-editor-actions{grid-template-columns:1fr}}
  `;
  document.head.appendChild(tag);
}
function ensureUi() {
  if (document.querySelector('.owner-edit-dock')) return;
  const dock = document.createElement('div');
  dock.className = 'owner-edit-dock';
  const fab = document.createElement('a');
  fab.className = 'owner-edit-fab-global';
  fab.href = '/website-builder.html';
  fab.textContent = 'Edit Page';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'owner-edit-fab-global owner-edit-toggle';
  toggle.textContent = 'Live Edit';
  const panel = document.createElement('aside');
  panel.className = 'owner-editor-panel';
  panel.innerHTML = '<h3>Owner Editor</h3><p>One clean editor. Select text on the page, edit it here, then save the draft.</p><section class="owner-editor-section"><strong>Selected text</strong><textarea data-owner-editor-text placeholder="Select text to edit..."></textarea><div class="owner-editor-actions"><button type="button" data-owner-save>Save Text</button><button type="button" data-owner-clear-selection>Clear</button></div></section><section class="owner-editor-section"><strong>Page blocks</strong><p>Add placeholders for images, maps, CTAs, pricing, screenshots, forms, or future Studio components.</p><div class="owner-editor-actions"><button type="button" data-owner-add-placeholder>Add Placeholder</button><button type="button" data-owner-clear-placeholders>Clear Blocks</button></div></section><section class="owner-editor-section"><strong>Studio</strong><div class="owner-editor-actions"><a href="/website-builder.html">Open Studio</a><button type="button" data-owner-close-editor>Close Editor</button></div></section>';
  dock.append(fab, toggle);
  document.body.append(dock, panel);
  toggle.addEventListener('click', () => toggleEditor());
  panel.querySelector('[data-owner-save]')?.addEventListener('click', () => saveSelected(panel));
  panel.querySelector('[data-owner-add-placeholder]')?.addEventListener('click', addPlaceholder);
  panel.querySelector('[data-owner-clear-placeholders]')?.addEventListener('click', clearPlaceholders);
  panel.querySelector('[data-owner-clear-selection]')?.addEventListener('click', () => clearSelection(panel));
  panel.querySelector('[data-owner-close-editor]')?.addEventListener('click', () => toggleEditor(false));
}
function toggleEditor(force) {
  const next = typeof force === 'boolean' ? force : !document.documentElement.classList.contains('owner-editor-active');
  document.documentElement.classList.toggle('owner-editor-active', next);
  document.querySelector('.owner-edit-toggle')?.classList.toggle('is-on', next);
  document.querySelector('.owner-editor-panel')?.classList.toggle('is-visible', next);
  localStorage.setItem(TOGGLE_KEY, next ? '1' : '0');
  if (next) prepareTargets();
  else selectedNode?.classList.remove('owner-selected-live');
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
      selectedNode?.classList.remove('owner-selected-live');
      selectedNode = node;
      selectedNode.classList.add('owner-selected-live');
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
  if (!id || !value.trim()) return toast('Select text first');
  const draft = readDraft();
  const key = pageKey();
  draft[key] = draft[key] || { text: {}, blocks: [] };
  draft[key].text[id] = value.trim();
  writeDraft(draft);
  document.querySelector(`[data-owner-edit-id="${CSS.escape(id)}"]`)?.replaceChildren(document.createTextNode(value.trim()));
  toast('Text draft saved');
}
function clearSelection(panel) {
  selectedNode?.classList.remove('owner-selected-live');
  selectedNode = null;
  panel.removeAttribute('data-selected-id');
  panel.querySelector('[data-owner-editor-text]').value = '';
}
function addPlaceholder() {
  const draft = readDraft();
  const key = pageKey();
  draft[key] = draft[key] || { text: {}, blocks: [] };
  draft[key].blocks.push({ title: 'New editable block', copy: 'Add image, headline, CTA, pricing, screenshot, or section.' });
  writeDraft(draft);
  renderPlaceholders();
  toast('Placeholder added');
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
  toast('Placeholders cleared');
}
function apply() {
  style();
  ensureUi();
  renderPlaceholders();
  const show = allowed();
  document.querySelector('.owner-edit-dock')?.classList.toggle('is-visible', show);
  if (show && localStorage.getItem(TOGGLE_KEY) === '1') toggleEditor(true);
}
window.addEventListener('evara:session-ready', apply, { passive: true });
window.addEventListener('pageshow', () => setTimeout(apply, 150));
setTimeout(apply, 1200);
