const STYLE_KEY = 'evaraos-studio-inspector-styles-v1';
const TEXT_KEY = 'evaraos-studio-inspector-text-v1';

function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { return {}; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function pageKey() { return location.pathname || '/'; }
function nodeId(node) {
  if (!node) return '';
  if (!node.dataset.studioInspectorId) node.dataset.studioInspectorId = `studio-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${pageKey()}::${node.dataset.studioInspectorId}`;
}
function selected() { return document.querySelector('.studio-mode-selected'); }
function styles() { return read(STYLE_KEY); }
function textEdits() { return read(TEXT_KEY); }
function saveStyle(node, patch) {
  const all = styles();
  const id = nodeId(node);
  all[id] = { ...(all[id] || {}), ...patch };
  write(STYLE_KEY, all);
}
function saveText(node, value) {
  const all = textEdits();
  all[nodeId(node)] = value;
  write(TEXT_KEY, all);
}
function applyGlass(node, value) {
  const backgrounds = {
    Default: '',
    Soft: 'linear-gradient(145deg,rgba(255,255,255,.18),rgba(255,255,255,.06))',
    Liquid: 'linear-gradient(145deg,rgba(255,255,255,.30),rgba(255,255,255,.10))',
    Strong: 'linear-gradient(145deg,rgba(255,255,255,.40),rgba(255,255,255,.15))'
  };
  node.style.background = backgrounds[value] || '';
  saveStyle(node, { background: node.style.background });
}
function applyStored() {
  const s = styles();
  const t = textEdits();
  document.querySelectorAll('[data-studio-inspector-id]').forEach((node) => {
    const id = nodeId(node);
    if (s[id]) Object.assign(node.style, s[id]);
    if (t[id] && !['INPUT','SELECT','TEXTAREA'].includes(node.tagName)) node.textContent = t[id];
  });
}
function enhancePanel() {
  const panel = document.querySelector('.studio-mode-panel');
  if (!panel || panel.dataset.inspectorEnhanced === 'true') return;
  panel.dataset.inspectorEnhanced = 'true';
  const firstGrid = panel.querySelector('.studio-mode-grid');
  const extra = document.createElement('div');
  extra.innerHTML = `<label>Text<input data-studio-prop="text" placeholder="Edit selected text"></label><div class="studio-mode-grid"><label>Radius<input data-studio-prop="radius" type="range" min="0" max="48" value="24"></label><label>Padding<input data-studio-prop="padding" type="range" min="0" max="56" value="16"></label></div><div class="studio-mode-grid"><button type="button" data-studio-action="save-style">Save Style</button><button type="button" data-studio-action="reset-style">Reset Style</button></div>`;
  panel.insertBefore(extra, firstGrid || null);
}
function syncPanelFromSelection() {
  const node = selected();
  if (!node) return;
  enhancePanel();
  const text = document.querySelector('[data-studio-prop="text"]');
  const radius = document.querySelector('[data-studio-prop="radius"]');
  const padding = document.querySelector('[data-studio-prop="padding"]');
  if (text && !['IMG','SVG'].includes(node.tagName)) text.value = node.textContent.trim().slice(0, 200);
  if (radius) radius.value = parseInt(getComputedStyle(node).borderRadius) || 24;
  if (padding) padding.value = parseInt(getComputedStyle(node).padding) || 16;
}
function applyProp(input) {
  const node = selected();
  if (!node) return;
  const prop = input.dataset.studioProp;
  if (prop === 'text' && !['IMG','SVG'].includes(node.tagName)) {
    node.textContent = input.value;
    saveText(node, input.value);
  }
  if (prop === 'visibility') {
    node.hidden = input.value === 'Hidden';
    if (input.value === 'Owner only') node.dataset.featurePermission = 'studio';
  }
  if (prop === 'glass') applyGlass(node, input.value);
  if (prop === 'radius') { node.style.borderRadius = `${input.value}px`; saveStyle(node, { borderRadius: node.style.borderRadius }); }
  if (prop === 'padding') { node.style.padding = `${input.value}px`; saveStyle(node, { padding: node.style.padding }); }
}
function bind() {
  enhancePanel();
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-studio-layer-index]') || event.target.closest('.studio-mode-selected') || event.target.closest('[data-studio-action]')) setTimeout(syncPanelFromSelection, 40);
    const action = event.target.closest('[data-studio-action]');
    const node = selected();
    if (!action || !node) return;
    if (action.dataset.studioAction === 'reset-style') {
      node.removeAttribute('style');
      const all = styles();
      delete all[nodeId(node)];
      write(STYLE_KEY, all);
    }
    if (action.dataset.studioAction === 'save-style') window.dispatchEvent(new CustomEvent('evara:studio-style-saved', { detail: { id: nodeId(node) } }));
  }, true);
  document.addEventListener('input', (event) => {
    const input = event.target.closest('[data-studio-prop]');
    if (input) applyProp(input);
  }, true);
  window.addEventListener('evara:studio-mode', () => { enhancePanel(); applyStored(); });
  applyStored();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
else bind();
