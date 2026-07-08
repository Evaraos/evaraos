import { normalizeAccessRole } from '../access-control.js';

const MODE_KEY = 'evaraos-studio-mode-enabled';
const EDIT_KEY = 'evaraos-studio-mode-edits-v1';
const OWNER_ROLES = new Set(['owner', 'admin']);
let selectedNode = null;
let eventsBound = false;
let edits = readEdits();

function readEdits() { try { return JSON.parse(localStorage.getItem(EDIT_KEY) || '{}') || {}; } catch { return {}; } }
function writeEdits() { try { localStorage.setItem(EDIT_KEY, JSON.stringify(edits)); } catch {} }
function isStudioHome() { return location.pathname.includes('website-builder.html'); }
function role() {
  try {
    const raw = localStorage.getItem('evaraos-user') || sessionStorage.getItem('evaraos-user') || '{}';
    const user = JSON.parse(raw);
    return normalizeAccessRole(user.role || localStorage.getItem('evaraos-role') || sessionStorage.getItem('evaraos-role') || 'customer');
  } catch { return 'customer'; }
}
function allowed() { return OWNER_ROLES.has(role()); }
function isEnabled() { return localStorage.getItem(MODE_KEY) === 'true'; }
function editableSelector() { return 'main,section,article,.glass-card,.eva-card,.studio-section,.studio-command-card,.studio-registry-card,.studio-module-card,button,a,img,svg,[data-owner-edit],[data-studio-component],[data-studio-block]'; }
function stableKey(node) {
  if (!node) return '';
  if (!node.dataset.evaraStudioKey) node.dataset.evaraStudioKey = node.dataset.ownerEdit || node.dataset.studioBlock || node.dataset.studioComponent || `${node.tagName?.toLowerCase?.() || 'node'}-${Math.random().toString(16).slice(2)}`;
  return `${location.pathname}::${node.dataset.evaraStudioKey}`;
}
function labelFor(node) {
  if (!node) return 'Nothing selected';
  if (node.dataset?.studioComponent) return node.dataset.studioComponent;
  if (node.dataset?.studioBlock) return node.dataset.studioBlock;
  if (node.dataset?.ownerEdit) return node.dataset.ownerEdit;
  if (node.classList?.contains('glass-card')) return 'Glass Card';
  if (node.classList?.contains('eva-card')) return 'Evara Card';
  return node.tagName?.toLowerCase?.() || 'Component';
}
function editableNodes() {
  return Array.from(document.querySelectorAll(editableSelector())).filter((node) => !node.closest('.studio-mode-shell') && !node.closest('.evara-studio-mode-toggle') && !node.closest('.role-preview-bar') && !node.closest('.role-preview-chip') && !node.closest('#universalNavRoot'));
}
function selectedText(node) { return (node?.innerText || node?.textContent || '').trim().slice(0, 240); }
function applySavedEdits() {
  editableNodes().forEach((node) => {
    const saved = edits[stableKey(node)];
    if (!saved) return;
    if (saved.text && !['IMG', 'SVG'].includes(node.tagName)) node.textContent = saved.text;
    if (saved.hidden === true) node.hidden = true;
    if (saved.style) Object.assign(node.style, saved.style);
  });
}
function ensureStyles() {
  if (document.getElementById('evaraStudioModeStyles')) return;
  const style = document.createElement('style');
  style.id = 'evaraStudioModeStyles';
  style.textContent = `
    .evara-studio-mode-toggle{position:fixed;left:18px;bottom:calc(156px + env(safe-area-inset-bottom,0px));z-index:9996;display:none;align-items:center;gap:8px;padding:12px 14px;border:1px solid rgba(255,255,255,.42);border-radius:999px;color:#fff;font-weight:950;background:linear-gradient(145deg,rgba(255,255,255,.30),rgba(255,255,255,.11));box-shadow:0 18px 44px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.36);backdrop-filter:blur(24px) saturate(1.28);-webkit-backdrop-filter:blur(24px) saturate(1.28)}
    .evara-studio-mode-toggle.is-visible{display:inline-flex}.evara-studio-mode-toggle.is-on{background:linear-gradient(145deg,rgba(255,255,255,.44),rgba(227,6,19,.22))!important}
    body.studio-page .evara-studio-mode-toggle{display:none!important}.studio-mode-shell{position:fixed;inset:0;z-index:9994;pointer-events:none;display:none}.studio-mode-shell.is-on{display:block}body.studio-page .studio-mode-shell{display:none!important}
    .studio-mode-topbar{position:fixed;left:50%;top:calc(14px + env(safe-area-inset-top,0px));transform:translateX(-50%);pointer-events:auto;display:flex;gap:8px;align-items:center;padding:8px 10px;border-radius:999px;background:linear-gradient(145deg,rgba(255,255,255,.26),rgba(9,10,16,.72));border:1px solid rgba(255,255,255,.30);color:#fff;box-shadow:0 16px 44px rgba(0,0,0,.28);backdrop-filter:blur(24px) saturate(1.25);-webkit-backdrop-filter:blur(24px) saturate(1.25)}
    .studio-mode-topbar strong{padding:0 8px;font-size:.82rem}.studio-mode-topbar button,.studio-mode-panel button{border:1px solid rgba(255,255,255,.24);border-radius:14px;background:rgba(255,255,255,.13);color:#fff;font-weight:900;padding:8px 10px}.studio-mode-topbar button:hover,.studio-mode-panel button:hover{background:rgba(255,255,255,.22)}
    .studio-mode-panel{position:fixed;right:14px;top:calc(82px + env(safe-area-inset-top,0px));width:min(360px,calc(100vw - 28px));max-height:calc(100vh - 170px);overflow:auto;pointer-events:auto;display:grid;gap:10px;padding:14px;border-radius:24px;background:linear-gradient(145deg,rgba(255,255,255,.24),rgba(9,10,16,.76));border:1px solid rgba(255,255,255,.30);color:#fff;box-shadow:0 24px 68px rgba(0,0,0,.32);backdrop-filter:blur(30px) saturate(1.32);-webkit-backdrop-filter:blur(30px) saturate(1.32)}
    .studio-mode-panel h3{margin:0;font-size:1.05rem;letter-spacing:-.04em}.studio-mode-panel p{margin:0;color:rgba(255,255,255,.72);font-size:.82rem;line-height:1.42}.studio-mode-panel label{display:grid;gap:6px;font-size:.75rem;font-weight:900;color:rgba(255,255,255,.75)}.studio-mode-panel input,.studio-mode-panel select,.studio-mode-panel textarea{border-radius:13px;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.12);color:#fff;padding:9px 10px}.studio-mode-panel textarea{min-height:82px;resize:vertical}.studio-mode-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .studio-mode-layers{position:fixed;left:14px;top:calc(82px + env(safe-area-inset-top,0px));width:250px;max-height:calc(100vh - 170px);overflow:auto;pointer-events:auto;display:grid;gap:6px;padding:12px;border-radius:22px;background:linear-gradient(145deg,rgba(255,255,255,.22),rgba(9,10,16,.70));border:1px solid rgba(255,255,255,.28);color:#fff;box-shadow:0 22px 58px rgba(0,0,0,.28);backdrop-filter:blur(28px) saturate(1.25)}.studio-mode-layers strong{font-size:.78rem;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.7)}.studio-mode-layer{border:1px solid rgba(255,255,255,.16);border-radius:12px;background:rgba(255,255,255,.08);color:#fff;text-align:left;padding:8px;font-weight:850;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.studio-mode-layer.is-active{background:rgba(242,23,45,.22);border-color:rgba(255,255,255,.36)}
    html.evara-studio-mode-on main,html.evara-studio-mode-on section,html.evara-studio-mode-on article,html.evara-studio-mode-on .glass-card,html.evara-studio-mode-on .eva-card{outline:1px dashed rgba(255,255,255,.22);outline-offset:3px}
    body.studio-page main,body.studio-page section,body.studio-page article,body.studio-page .glass-card,body.studio-page .eva-card{outline:none!important}
    html.evara-studio-mode-on .studio-mode-selected{outline:2px solid rgba(242,23,45,.96)!important;outline-offset:6px!important;box-shadow:0 0 0 8px rgba(242,23,45,.10)!important}
    html.evara-studio-mode-on .studio-mode-hover{outline:2px solid rgba(255,255,255,.72)!important;outline-offset:5px!important}
    @media(max-width:820px){.studio-mode-layers{display:none}.studio-mode-panel{left:12px;right:12px;top:auto;bottom:calc(82px + env(safe-area-inset-bottom,0px));width:auto;max-height:44vh}.evara-studio-mode-toggle{left:14px;bottom:calc(142px + env(safe-area-inset-bottom,0px))}}
  `;
  document.head.appendChild(style);
}
function ensureUi() {
  document.body.classList.toggle('studio-page', isStudioHome());
  let button = document.querySelector('.evara-studio-mode-toggle');
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'evara-studio-mode-toggle';
    button.textContent = 'Studio Mode';
    button.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); setEnabled(!isEnabled()); });
    document.body.appendChild(button);
  }
  if (!document.querySelector('.studio-mode-shell')) {
    const shell = document.createElement('div');
    shell.className = 'studio-mode-shell';
    shell.innerHTML = `<div class="studio-mode-topbar"><strong>Studio Mode</strong><button type="button" data-studio-action="select">Select</button><button type="button" data-studio-action="components">Components</button><button type="button" data-studio-action="assets">Assets</button><button type="button" data-studio-action="exit">Exit</button></div><aside class="studio-mode-layers"><strong>Layers</strong><div data-studio-layers></div></aside><aside class="studio-mode-panel"><h3 data-studio-selected-title>Nothing selected</h3><p data-studio-selected-copy>Click any component in the live app to inspect it.</p><label>Text<textarea data-studio-prop="text" placeholder="Selected text"></textarea></label><label>Visibility<select data-studio-prop="visibility"><option value="visible">Visible</option><option value="hidden">Hidden</option><option value="owner">Owner only</option><option value="role">Role based</option></select></label><label>Glass<select data-studio-prop="glass"><option value="default">Default</option><option value="soft">Soft</option><option value="liquid">Liquid</option><option value="strong">Strong</option></select></label><label>Radius<input data-studio-prop="radius" type="range" min="0" max="48" value="24"></label><label>Padding<input data-studio-prop="padding" type="range" min="0" max="56" value="16"></label><div class="studio-mode-grid"><button type="button" data-studio-action="move-up">Move Up</button><button type="button" data-studio-action="move-down">Move Down</button><button type="button" data-studio-action="duplicate">Duplicate</button><button type="button" data-studio-action="hide">Hide</button></div><div class="studio-mode-grid"><button type="button" data-studio-action="save">Save</button><button type="button" data-studio-action="reset">Reset</button></div></aside>`;
    document.body.appendChild(shell);
  }
  button.classList.toggle('is-visible', allowed() && !isStudioHome());
}
function renderLayers() {
  const root = document.querySelector('[data-studio-layers]');
  if (!root) return;
  root.innerHTML = editableNodes().slice(0, 45).map((node, index) => `<button type="button" class="studio-mode-layer${node === selectedNode ? ' is-active' : ''}" data-studio-layer-index="${index}">${labelFor(node)}</button>`).join('');
}
function syncPanel() {
  const title = document.querySelector('[data-studio-selected-title]');
  const copy = document.querySelector('[data-studio-selected-copy]');
  const text = document.querySelector('[data-studio-prop="text"]');
  const label = labelFor(selectedNode);
  if (title) title.textContent = label;
  if (copy) copy.textContent = selectedNode ? `${selectedNode.tagName?.toLowerCase?.() || 'node'} selected` : 'Click any component in the live app to inspect it.';
  if (text) text.value = selectedNode && !['IMG', 'SVG'].includes(selectedNode.tagName) ? selectedText(selectedNode) : '';
}
function selectNode(node) {
  if (!node || node.closest('.studio-mode-shell') || node.closest('.evara-studio-mode-toggle') || node.closest('.role-preview-bar') || node.closest('.role-preview-chip')) return;
  selectedNode?.classList.remove('studio-mode-selected');
  selectedNode = node;
  selectedNode.classList.add('studio-mode-selected');
  syncPanel();
  renderLayers();
}
function saveSelectedPatch(patch) {
  if (!selectedNode) return;
  const key = stableKey(selectedNode);
  edits[key] = { ...(edits[key] || {}), ...patch };
  writeEdits();
}
function setGlass(value) {
  if (!selectedNode) return;
  const bg = value === 'strong' ? 'linear-gradient(145deg,rgba(255,255,255,.36),rgba(255,255,255,.14))' : value === 'soft' ? 'linear-gradient(145deg,rgba(255,255,255,.18),rgba(255,255,255,.06))' : value === 'liquid' ? 'linear-gradient(145deg,rgba(255,255,255,.28),rgba(255,255,255,.10))' : '';
  selectedNode.style.background = bg;
  saveSelectedPatch({ style: { ...(edits[stableKey(selectedNode)]?.style || {}), background: bg } });
}
function setStyleProp(prop, value) {
  if (!selectedNode) return;
  selectedNode.style[prop] = value;
  saveSelectedPatch({ style: { ...(edits[stableKey(selectedNode)]?.style || {}), [prop]: value } });
}
function moveSelected(direction) {
  if (!selectedNode?.parentNode) return;
  const parent = selectedNode.parentNode;
  if (direction === 'up' && selectedNode.previousElementSibling) parent.insertBefore(selectedNode, selectedNode.previousElementSibling);
  if (direction === 'down' && selectedNode.nextElementSibling) parent.insertBefore(selectedNode.nextElementSibling, selectedNode);
  renderLayers();
}
function duplicateSelected() {
  if (!selectedNode?.parentNode) return;
  const clone = selectedNode.cloneNode(true);
  clone.dataset.evaraStudioKey = `${labelFor(selectedNode)}-${Math.random().toString(16).slice(2)}`;
  selectedNode.parentNode.insertBefore(clone, selectedNode.nextSibling);
  selectNode(clone);
}
function handlePropertyChange(target) {
  if (!selectedNode) return;
  const prop = target.dataset.studioProp;
  if (prop === 'text' && !['IMG', 'SVG'].includes(selectedNode.tagName)) { selectedNode.textContent = target.value; saveSelectedPatch({ text: target.value }); renderLayers(); }
  if (prop === 'visibility') { selectedNode.hidden = target.value === 'hidden'; saveSelectedPatch({ hidden: selectedNode.hidden }); }
  if (prop === 'glass') setGlass(target.value);
  if (prop === 'radius') setStyleProp('borderRadius', `${target.value}px`);
  if (prop === 'padding') setStyleProp('padding', `${target.value}px`);
}
function bindEvents() {
  if (eventsBound) return;
  eventsBound = true;
  document.addEventListener('input', (event) => { if (isEnabled() && event.target.matches('[data-studio-prop]')) handlePropertyChange(event.target); }, true);
  document.addEventListener('mouseover', (event) => {
    if (!isEnabled() || isStudioHome()) return;
    const node = event.target.closest(editableSelector());
    if (!node || node.closest('.studio-mode-shell') || node.closest('.evara-studio-mode-toggle') || node.closest('.role-preview-bar') || node.closest('.role-preview-chip') || node.closest('#universalNavRoot')) return;
    node.classList.add('studio-mode-hover');
  }, true);
  document.addEventListener('mouseout', (event) => event.target?.classList?.remove('studio-mode-hover'), true);
  document.addEventListener('click', (event) => {
    if (!isEnabled() || isStudioHome()) return;
    const action = event.target.closest('[data-studio-action]');
    if (action) {
      event.preventDefault(); event.stopPropagation();
      const value = action.dataset.studioAction;
      if (value === 'exit') setEnabled(false);
      if (value === 'move-up') moveSelected('up');
      if (value === 'move-down') moveSelected('down');
      if (value === 'duplicate') duplicateSelected();
      if (value === 'hide' && selectedNode) { selectedNode.hidden = true; saveSelectedPatch({ hidden: true }); }
      if (value === 'reset' && selectedNode) { delete edits[stableKey(selectedNode)]; writeEdits(); location.reload(); }
      if (value === 'save') writeEdits();
      if (value === 'components') location.assign('/website-builder.html');
      return;
    }
    const layer = event.target.closest('[data-studio-layer-index]');
    if (layer) { event.preventDefault(); event.stopPropagation(); selectNode(editableNodes()[Number(layer.dataset.studioLayerIndex)]); return; }
    const node = event.target.closest(editableSelector());
    if (!node || node.closest('.studio-mode-shell') || node.closest('.evara-studio-mode-toggle') || node.closest('.role-preview-bar') || node.closest('.role-preview-chip') || node.closest('#universalNavRoot')) return;
    event.preventDefault(); event.stopPropagation(); selectNode(node);
  }, true);
}
function setEnabled(enabled) {
  if (!allowed() || isStudioHome()) enabled = false;
  localStorage.setItem(MODE_KEY, enabled ? 'true' : 'false');
  document.documentElement.classList.toggle('evara-studio-mode-on', enabled);
  document.documentElement.dataset.evaraStudioMode = enabled ? 'on' : 'off';
  document.querySelector('.evara-studio-mode-toggle')?.classList.toggle('is-on', enabled);
  document.querySelector('.studio-mode-shell')?.classList.toggle('is-on', enabled);
  renderLayers();
  window.dispatchEvent(new CustomEvent('evara:studio-mode', { detail: { enabled } }));
}
function boot() { ensureStyles(); ensureUi(); if (!isStudioHome()) applySavedEdits(); setEnabled(allowed() && isEnabled() && !isStudioHome()); bindEvents(); }
window.EvaraStudioMode = { enable: () => setEnabled(true), disable: () => setEnabled(false), toggle: () => setEnabled(!isEnabled()), isEnabled, renderLayers };
window.addEventListener('evara:session-ready', boot);
window.addEventListener('pageshow', boot);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();