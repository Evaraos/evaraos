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
function pageDraft() { const draft = readDraft(); const key = pageKey(); draft[key] = draft[key] || { text: {}, blocks: [], style: {}, media: {} }; return { draft, key, page: draft[key] }; }
function editableTargets() {
  return Array.from(document.querySelectorAll('main h1,main h2,main h3,main p,main strong,main small,main .btn,main button:not([data-owner-ignore]),main img,main .glass-card,main .eva-card,main [data-builder-slot]'))
    .filter((node) => !node.closest('.owner-editor-panel,.owner-edit-fab-global,.owner-edit-dock,.eva-nav-layer,.evara-loader-fast'))
    .filter((node) => String(node.textContent || '').trim().length > 0 || node.hasAttribute('data-builder-slot') || node.tagName === 'IMG' || node.classList.contains('glass-card') || node.classList.contains('eva-card'));
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
    .owner-editor-active [data-owner-edit-id],.owner-editor-active [data-builder-slot]{position:relative;outline:1.5px dashed rgba(255,255,255,.54)!important;outline-offset:5px!important;border-radius:12px!important;cursor:pointer!important}.owner-editor-active [data-owner-edit-id]:after,.owner-editor-active [data-builder-slot]:after{content:'edit';position:absolute;right:6px;top:-14px;z-index:30;padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.34);color:var(--text-primary,#fff);font-size:10px;font-weight:950;line-height:1;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}.owner-selected-live{outline:2px solid rgba(242,23,45,.96)!important;outline-offset:7px!important;box-shadow:0 0 0 7px rgba(242,23,45,.10)!important}
    .owner-live-placeholder{position:relative;min-height:108px;border:1.5px dashed rgba(255,255,255,.46);border-radius:26px;background:linear-gradient(145deg,rgba(255,255,255,.18),rgba(255,255,255,.07));display:grid;place-items:center;text-align:center;padding:18px;margin:12px 0;color:var(--text-primary,#fff);box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 18px 42px rgba(0,0,0,.12)}
    .owner-live-placeholder button{width:38px;height:38px;border-radius:999px;border:1px solid rgba(255,255,255,.40);background:rgba(255,255,255,.18);color:inherit;font-size:1rem;font-weight:950}.owner-live-placeholder strong{display:block;margin-top:8px}.owner-live-placeholder small{color:var(--text-secondary,rgba(255,255,255,.72))}
    .owner-editor-panel{position:fixed;right:18px;bottom:calc(156px + env(safe-area-inset-bottom,0px));width:min(460px,calc(100vw - 36px));max-height:calc(100vh - 236px);overflow:auto;z-index:9998;display:none;padding:16px;border-radius:28px;background:linear-gradient(145deg,rgba(255,255,255,.28),rgba(10,12,18,.70));border:1px solid rgba(255,255,255,.40);box-shadow:0 24px 64px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.30);backdrop-filter:blur(30px) saturate(1.45);-webkit-backdrop-filter:blur(30px) saturate(1.45);color:var(--text-primary,#fff)}
    .owner-editor-panel.is-visible{display:grid;gap:12px}.owner-editor-panel h3{margin:0;font-size:1.05rem;letter-spacing:-.04em}.owner-editor-panel p{margin:0;color:var(--text-secondary,rgba(255,255,255,.72));font-size:12px;line-height:1.45}.owner-editor-panel textarea{min-height:94px;border-radius:18px;border:1px solid rgba(255,255,255,.30);background:rgba(255,255,255,.12);color:inherit;padding:12px;font:inherit;resize:vertical}.owner-editor-panel input,.owner-editor-panel select{height:38px;border-radius:14px;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.12);color:inherit;padding:0 10px}.owner-editor-section{display:grid;gap:9px;padding:11px;border-radius:20px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.07)}.owner-editor-section strong{font-size:.74rem;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.72)}.owner-editor-grid,.owner-editor-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.owner-editor-actions button,.owner-editor-actions a{border:1px solid rgba(255,255,255,.30);border-radius:14px;padding:10px 12px;color:inherit;background:linear-gradient(145deg,rgba(255,255,255,.22),rgba(255,255,255,.08));font-weight:900;text-decoration:none;text-align:center}.owner-editor-actions button:hover,.owner-editor-actions a:hover{background:linear-gradient(145deg,rgba(255,255,255,.30),rgba(242,23,45,.13))}.owner-editor-section label{display:grid;gap:5px;font-size:.74rem;font-weight:900;color:rgba(255,255,255,.72)}
    .owner-editor-toast{position:fixed!important;left:50%!important;top:calc(env(safe-area-inset-top,0px) + 18px)!important;transform:translateX(-50%) translateY(-12px)!important;opacity:0!important;z-index:9999!important;padding:12px 14px!important;border-radius:18px!important;color:#fff!important;background:rgba(10,12,18,.76)!important;border:1px solid rgba(255,255,255,.32)!important;backdrop-filter:blur(22px)!important;transition:.2s ease!important}.owner-editor-toast.is-visible{opacity:1!important;transform:translateX(-50%) translateY(0)!important}
    @media(max-width:760px){.owner-edit-dock{right:12px;left:12px;bottom:calc(86px + env(safe-area-inset-bottom,0px));justify-content:center}.owner-edit-fab-global{flex:1!important}.owner-editor-panel{left:12px;right:12px;width:auto;bottom:calc(146px + env(safe-area-inset-bottom,0px));max-height:44vh}.owner-editor-actions,.owner-editor-grid{grid-template-columns:1fr}}
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
  panel.innerHTML = '<h3>Owner Editor</h3><p>Select text, images, buttons, cards, or placeholders. Edit content, style, media, and layout from one drawer.</p><section class="owner-editor-section"><strong>Selected content</strong><textarea data-owner-editor-text placeholder="Select text to edit..."></textarea><div class="owner-editor-actions"><button type="button" data-owner-save>Save Text</button><button type="button" data-owner-clear-selection>Clear</button></div></section><section class="owner-editor-section"><strong>Design</strong><div class="owner-editor-grid"><label>Radius<input data-owner-style="radius" type="range" min="0" max="52" value="24"></label><label>Padding<input data-owner-style="padding" type="range" min="0" max="60" value="18"></label></div><label>Glass<select data-owner-style="glass"><option value="default">Default</option><option value="soft">Soft Glass</option><option value="liquid">Liquid Glass</option><option value="strong">Strong Glass</option></select></label></section><section class="owner-editor-section"><strong>Media</strong><label>Image URL<input data-owner-media-url placeholder="Paste /assets/... or image URL"></label><div class="owner-editor-actions"><button type="button" data-owner-apply-media>Apply Image</button><button type="button" data-owner-bg-media>Use as BG</button></div></section><section class="owner-editor-section"><strong>Layout</strong><div class="owner-editor-actions"><button type="button" data-owner-move="up">Move Up</button><button type="button" data-owner-move="down">Move Down</button><button type="button" data-owner-duplicate>Duplicate</button><button type="button" data-owner-remove>Remove</button></div></section><section class="owner-editor-section"><strong>Add blocks</strong><label>Block type<select data-owner-block-type><option value="card">Glass Card</option><option value="image">Image</option><option value="map">Map</option><option value="button">Button</option><option value="section">Section</option></select></label><div class="owner-editor-actions"><button type="button" data-owner-add-block>Add Block</button><button type="button" data-owner-clear-placeholders>Clear Blocks</button></div></section><section class="owner-editor-section"><strong>Studio</strong><div class="owner-editor-actions"><a href="/website-builder.html">Open Studio</a><button type="button" data-owner-close-editor>Close Editor</button></div></section>';
  dock.append(fab, toggle);
  document.body.append(dock, panel);
  toggle.addEventListener('click', () => toggleEditor());
  panel.querySelector('[data-owner-save]')?.addEventListener('click', () => saveSelected(panel));
  panel.querySelector('[data-owner-clear-selection]')?.addEventListener('click', () => clearSelection(panel));
  panel.querySelector('[data-owner-apply-media]')?.addEventListener('click', () => applyMedia(false));
  panel.querySelector('[data-owner-bg-media]')?.addEventListener('click', () => applyMedia(true));
  panel.querySelector('[data-owner-duplicate]')?.addEventListener('click', duplicateSelected);
  panel.querySelector('[data-owner-remove]')?.addEventListener('click', removeSelected);
  panel.querySelector('[data-owner-add-block]')?.addEventListener('click', addSelectedBlock);
  panel.querySelector('[data-owner-clear-placeholders]')?.addEventListener('click', clearPlaceholders);
  panel.querySelector('[data-owner-close-editor]')?.addEventListener('click', () => toggleEditor(false));
  panel.querySelectorAll('[data-owner-move]').forEach((button) => button.addEventListener('click', () => moveSelected(button.dataset.ownerMove)));
  panel.querySelectorAll('[data-owner-style]').forEach((input) => input.addEventListener('input', () => applyStyle(input.dataset.ownerStyle, input.value)));
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
function selectNode(node) {
  selectedNode?.classList.remove('owner-selected-live');
  selectedNode = node;
  selectedNode?.classList.add('owner-selected-live');
  const panel = document.querySelector('.owner-editor-panel');
  panel?.classList.add('is-visible');
  const id = nodeId(node);
  panel.dataset.selectedId = id;
  const text = panel.querySelector('[data-owner-editor-text]');
  if (text) text.value = node.tagName === 'IMG' ? (node.getAttribute('alt') || '') : String(node.textContent || '').trim();
}
function prepareTargets() {
  const { page } = pageDraft();
  editableTargets().forEach((node, index) => {
    const id = nodeId(node, index);
    if (page.text?.[id] && node.tagName !== 'IMG') node.textContent = page.text[id];
    if (page.style?.[id]) Object.assign(node.style, page.style[id]);
    if (page.media?.[id]) {
      if (node.tagName === 'IMG') node.src = page.media[id];
      else node.style.backgroundImage = `linear-gradient(rgba(0,0,0,.12),rgba(0,0,0,.12)),url('${page.media[id]}')`;
    }
    if (node.dataset.ownerBound === 'true') return;
    node.dataset.ownerBound = 'true';
    node.addEventListener('click', (event) => {
      if (!document.documentElement.classList.contains('owner-editor-active')) return;
      event.preventDefault(); event.stopPropagation(); selectNode(node);
    }, true);
  });
}
function blockMarkup(type, index) {
  if (type === 'image') return `<img alt="New image" src="/assets/brand/evaraos-mark.png" style="width:100%;max-height:240px;object-fit:contain;border-radius:22px;background:rgba(255,255,255,.08);padding:18px">`;
  if (type === 'map') return `<strong>Map block</strong><small>Connect this to routes, jobs, leads, or customer locations.</small><div style="min-height:160px;border-radius:20px;display:grid;place-items:center;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.18)">Map</div>`;
  if (type === 'button') return `<button class="btn btn-theme-primary" type="button">New action</button><small>Connect this button to a workflow later.</small>`;
  if (type === 'section') return `<strong>New section</strong><small>Add copy, image, CTA, map, pricing, or form content.</small>`;
  return `<strong>Glass card ${index + 1}</strong><small>Edit the card text, glass, radius, padding, image, or layout.</small>`;
}
function renderPlaceholders() {
  document.querySelectorAll('.owner-live-placeholder').forEach((node) => node.remove());
  const list = readDraft()[pageKey()]?.blocks || [];
  const host = document.querySelector('main') || document.getElementById('appRoot') || document.body;
  list.forEach((item, index) => {
    const node = document.createElement('div');
    node.className = 'owner-live-placeholder glass-card';
    node.dataset.builderSlot = 'true';
    node.innerHTML = `<button type="button" data-owner-remove-placeholder="${index}">✕</button>${blockMarkup(item.type || 'card', index)}`;
    node.querySelector('[data-owner-remove-placeholder]')?.addEventListener('click', () => removePlaceholder(index));
    host.appendChild(node);
  });
}
function saveSelected(panel) {
  const id = panel.dataset.selectedId;
  const value = panel.querySelector('[data-owner-editor-text]')?.value || '';
  if (!id || !selectedNode) return toast('Select text first');
  if (selectedNode.tagName === 'IMG') selectedNode.alt = value.trim();
  else selectedNode.replaceChildren(document.createTextNode(value.trim()));
  const { draft, key, page } = pageDraft();
  page.text[id] = value.trim();
  writeDraft(draft);
  toast('Text draft saved');
}
function clearSelection(panel) {
  selectedNode?.classList.remove('owner-selected-live');
  selectedNode = null;
  panel.removeAttribute('data-selected-id');
  panel.querySelector('[data-owner-editor-text]').value = '';
}
function saveStylePatch(id, patch) {
  const { draft, page } = pageDraft();
  page.style[id] = { ...(page.style[id] || {}), ...patch };
  writeDraft(draft);
}
function applyStyle(kind, value) {
  if (!selectedNode) return toast('Select an item first');
  const id = nodeId(selectedNode);
  if (kind === 'radius') { selectedNode.style.borderRadius = `${value}px`; saveStylePatch(id, { borderRadius: `${value}px` }); }
  if (kind === 'padding') { selectedNode.style.padding = `${value}px`; saveStylePatch(id, { padding: `${value}px` }); }
  if (kind === 'glass') {
    const bg = value === 'strong' ? 'linear-gradient(145deg,rgba(255,255,255,.36),rgba(255,255,255,.14))' : value === 'liquid' ? 'linear-gradient(145deg,rgba(255,255,255,.26),rgba(255,255,255,.09))' : value === 'soft' ? 'linear-gradient(145deg,rgba(255,255,255,.16),rgba(255,255,255,.05))' : '';
    selectedNode.style.background = bg;
    saveStylePatch(id, { background: bg });
  }
}
function applyMedia(asBackground = false) {
  if (!selectedNode) return toast('Select an item first');
  const url = document.querySelector('[data-owner-media-url]')?.value?.trim();
  if (!url) return toast('Paste an image URL first');
  const id = nodeId(selectedNode);
  if (selectedNode.tagName === 'IMG' && !asBackground) selectedNode.src = url;
  else { selectedNode.style.backgroundImage = `linear-gradient(rgba(0,0,0,.12),rgba(0,0,0,.12)),url('${url}')`; selectedNode.style.backgroundSize = 'cover'; selectedNode.style.backgroundPosition = 'center'; }
  const { draft, page } = pageDraft();
  page.media[id] = url;
  writeDraft(draft);
  toast('Media applied');
}
function moveSelected(direction) {
  if (!selectedNode?.parentNode) return toast('Select an item first');
  const parent = selectedNode.parentNode;
  if (direction === 'up' && selectedNode.previousElementSibling) parent.insertBefore(selectedNode, selectedNode.previousElementSibling);
  if (direction === 'down' && selectedNode.nextElementSibling) parent.insertBefore(selectedNode.nextElementSibling, selectedNode);
}
function duplicateSelected() {
  if (!selectedNode?.parentNode) return toast('Select an item first');
  const clone = selectedNode.cloneNode(true);
  clone.dataset.ownerEditId = `${pageKey()}-clone-${Date.now()}`;
  clone.dataset.ownerBound = 'false';
  selectedNode.parentNode.insertBefore(clone, selectedNode.nextSibling);
  prepareTargets(); selectNode(clone); toast('Duplicated');
}
function removeSelected() {
  if (!selectedNode) return toast('Select an item first');
  const next = selectedNode.nextElementSibling || selectedNode.previousElementSibling;
  selectedNode.remove(); selectedNode = null;
  if (next) selectNode(next);
}
function addSelectedBlock() {
  const type = document.querySelector('[data-owner-block-type]')?.value || 'card';
  const { draft, key, page } = pageDraft();
  page.blocks.push({ type, title: `New ${type}`, copy: 'Editable owner block.' });
  writeDraft(draft);
  renderPlaceholders();
  toast('Block added');
}
function removePlaceholder(index) {
  const { draft, page } = pageDraft();
  page.blocks = page.blocks.filter((_, i) => i !== Number(index));
  writeDraft(draft); renderPlaceholders();
}
function clearPlaceholders() {
  const { draft, page } = pageDraft();
  page.blocks = [];
  writeDraft(draft); renderPlaceholders(); toast('Blocks cleared');
}
function apply() {
  style(); ensureUi(); renderPlaceholders();
  const show = allowed();
  document.querySelector('.owner-edit-dock')?.classList.toggle('is-visible', show);
  if (show && localStorage.getItem(TOGGLE_KEY) === '1') toggleEditor(true);
}
window.addEventListener('evara:session-ready', apply, { passive: true });
window.addEventListener('pageshow', () => setTimeout(apply, 150));
setTimeout(apply, 1200);
