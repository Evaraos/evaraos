import { STUDIO_COMPONENTS, renderComponentPreview } from './component-registry.js';

const PALETTE_ID = 'evaraStudioComponentPalette';

function palette() { return document.getElementById(PALETTE_ID); }
function selected() { return document.querySelector('.studio-mode-selected'); }
function host() { return selected()?.parentElement || document.querySelector('main') || document.body; }
function safe(text = '') { return String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'); }
function toast(message) {
  let node = document.querySelector('.builder-toast');
  if (!node) { node = document.createElement('div'); node.className = 'builder-toast'; document.body.appendChild(node); }
  node.textContent = message;
  node.classList.add('is-visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('is-visible'), 1400);
}
function ensureStyles() {
  if (document.getElementById('evaraStudioPaletteStyles')) return;
  const style = document.createElement('style');
  style.id = 'evaraStudioPaletteStyles';
  style.textContent = `
    .studio-component-palette{position:fixed;left:50%;top:calc(72px + env(safe-area-inset-top,0px));transform:translateX(-50%) translateY(-10px);opacity:0;pointer-events:none;z-index:9998;width:min(760px,calc(100vw - 28px));max-height:calc(100vh - 140px);overflow:auto;padding:14px;border-radius:28px;background:linear-gradient(145deg,rgba(255,255,255,.28),rgba(9,10,16,.78));border:1px solid rgba(255,255,255,.34);box-shadow:0 28px 80px rgba(0,0,0,.36),inset 0 1px 0 rgba(255,255,255,.28);backdrop-filter:blur(32px) saturate(1.35);-webkit-backdrop-filter:blur(32px) saturate(1.35);color:#fff;transition:.2s ease}.studio-component-palette.is-open{opacity:1;pointer-events:auto;transform:translateX(-50%) translateY(0)}
    .studio-palette-top{display:flex;gap:10px;align-items:center;justify-content:space-between;margin-bottom:12px}.studio-palette-top h3{margin:0;font-size:1.1rem;letter-spacing:-.04em}.studio-palette-top button{border:1px solid rgba(255,255,255,.24);border-radius:14px;background:rgba(255,255,255,.13);color:#fff;font-weight:900;padding:8px 10px}.studio-palette-search{width:100%;height:44px;border-radius:16px;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.12);color:#fff;padding:0 12px;font:inherit;margin-bottom:12px}.studio-palette-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.studio-palette-item{border:1px solid rgba(255,255,255,.20);border-radius:22px;background:linear-gradient(145deg,rgba(255,255,255,.16),rgba(255,255,255,.06));padding:10px;color:#fff;text-align:left;cursor:pointer}.studio-palette-item:hover{border-color:rgba(255,255,255,.45);transform:translateY(-1px)}.studio-palette-item .studio-component-preview{min-height:130px}.studio-palette-empty{padding:20px;border-radius:18px;border:1px dashed rgba(255,255,255,.35);color:rgba(255,255,255,.72);text-align:center}@media(max-width:720px){.studio-palette-grid{grid-template-columns:1fr}.studio-component-palette{top:calc(64px + env(safe-area-inset-top,0px))}}
  `;
  document.head.appendChild(style);
}
function componentNode(component) {
  const wrapper = document.createElement('section');
  wrapper.className = 'eva-card glass-card';
  wrapper.dataset.studioComponent = component.id;
  wrapper.dataset.ownerEdit = `${component.id}-${Date.now()}`;
  wrapper.innerHTML = renderComponentPreview(component, component.defaults || {});
  return wrapper;
}
function insertComponent(id) {
  const component = STUDIO_COMPONENTS.find((item) => item.id === id);
  if (!component) return;
  const node = componentNode(component);
  const target = selected();
  if (target?.parentElement) target.parentElement.insertBefore(node, target.nextSibling);
  else host().appendChild(node);
  window.EvaraStudioMode?.renderLayers?.();
  toast(`${component.name} added`);
  closePalette();
}
function renderList(query = '') {
  const root = palette()?.querySelector('[data-studio-palette-grid]');
  if (!root) return;
  const q = query.trim().toLowerCase();
  const list = STUDIO_COMPONENTS.filter((component) => !q || [component.name, component.category, component.description, component.id].join(' ').toLowerCase().includes(q));
  root.innerHTML = list.length ? list.map((component) => `<button type="button" class="studio-palette-item" data-insert-component="${safe(component.id)}"><strong>${safe(component.name)}</strong>${renderComponentPreview(component)}</button>`).join('') : '<div class="studio-palette-empty">No matching components yet.</div>';
}
function ensurePalette() {
  if (palette()) return;
  const panel = document.createElement('aside');
  panel.id = PALETTE_ID;
  panel.className = 'studio-component-palette';
  panel.innerHTML = `<div class="studio-palette-top"><h3>Add Component</h3><button type="button" data-close-palette>Close</button></div><input class="studio-palette-search" data-studio-palette-search placeholder="Search components, maps, cards, AI, buttons..."><div class="studio-palette-grid" data-studio-palette-grid></div>`;
  document.body.appendChild(panel);
  panel.querySelector('[data-close-palette]').addEventListener('click', closePalette);
  panel.querySelector('[data-studio-palette-search]').addEventListener('input', (event) => renderList(event.target.value));
  panel.addEventListener('click', (event) => {
    const item = event.target.closest('[data-insert-component]');
    if (item) insertComponent(item.dataset.insertComponent);
  });
  renderList();
}
export function openPalette() { ensureStyles(); ensurePalette(); renderList(); palette()?.classList.add('is-open'); palette()?.querySelector('input')?.focus(); }
export function closePalette() { palette()?.classList.remove('is-open'); }
function bind() {
  ensureStyles(); ensurePalette();
  document.addEventListener('click', (event) => {
    const action = event.target.closest('[data-studio-action]');
    if (action?.dataset.studioAction === 'components') {
      event.preventDefault(); event.stopPropagation(); openPalette();
    }
  }, true);
  window.EvaraStudioPalette = { open: openPalette, close: closePalette, insert: insertComponent };
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
else bind();
