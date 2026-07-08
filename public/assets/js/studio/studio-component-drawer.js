import { STUDIO_COMPONENTS, renderComponentPreview, getStudioComponent } from './component-registry.js';

function isModeOn() { return localStorage.getItem('evaraos-studio-mode-enabled') === 'true'; }
function selected() { return document.querySelector('.studio-mode-selected'); }
function ensureStyles() {
  if (document.getElementById('evaraStudioComponentDrawerStyles')) return;
  const style = document.createElement('style');
  style.id = 'evaraStudioComponentDrawerStyles';
  style.textContent = `
    .studio-component-drawer{position:fixed;left:14px;bottom:calc(92px + env(safe-area-inset-bottom,0px));width:min(390px,calc(100vw - 28px));max-height:52vh;overflow:auto;z-index:9998;display:none;gap:10px;padding:14px;border-radius:24px;background:linear-gradient(145deg,rgba(255,255,255,.24),rgba(9,10,16,.76));border:1px solid rgba(255,255,255,.30);color:#fff;box-shadow:0 24px 68px rgba(0,0,0,.32);backdrop-filter:blur(30px) saturate(1.32)}
    .studio-component-drawer.is-open{display:grid}.studio-component-drawer h3{margin:0;font-size:1.05rem;letter-spacing:-.04em}.studio-component-drawer p{margin:0;color:rgba(255,255,255,.72);font-size:.82rem}.studio-component-drawer input{height:40px;border-radius:14px;border:1px solid rgba(255,255,255,.26);background:rgba(255,255,255,.12);color:#fff;padding:0 12px}.studio-component-results{display:grid;gap:8px}.studio-component-result{border:1px solid rgba(255,255,255,.18);border-radius:18px;background:rgba(255,255,255,.08);padding:10px;display:grid;gap:6px;text-align:left;color:#fff}.studio-component-result strong{font-size:.92rem}.studio-component-result small{color:rgba(255,255,255,.7);line-height:1.35}.studio-component-result:hover{background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.34)}
  `;
  document.head.appendChild(style);
}
function ensureDrawer() {
  if (document.querySelector('.studio-component-drawer')) return;
  const drawer = document.createElement('aside');
  drawer.className = 'studio-component-drawer';
  drawer.innerHTML = `<h3>Add Component</h3><p>Search, then insert near the selected item.</p><input data-studio-component-search placeholder="Search components"><div class="studio-component-results" data-studio-component-results></div>`;
  document.body.appendChild(drawer);
  drawer.querySelector('[data-studio-component-search]').addEventListener('input', renderResults);
  renderResults();
}
function openDrawer() { ensureStyles(); ensureDrawer(); document.querySelector('.studio-component-drawer')?.classList.add('is-open'); renderResults(); }
function closeDrawer() { document.querySelector('.studio-component-drawer')?.classList.remove('is-open'); }
function componentHtml(component) {
  const wrapper = document.createElement('section');
  wrapper.className = 'eva-card glass-card';
  wrapper.dataset.studioComponent = component.id;
  wrapper.dataset.ownerEdit = component.id;
  wrapper.innerHTML = renderComponentPreview(component);
  return wrapper;
}
function insertComponent(id) {
  const component = getStudioComponent(id);
  if (!component) return;
  const node = componentHtml(component);
  const target = selected();
  const host = target?.parentNode || document.querySelector('main') || document.body;
  if (target?.parentNode) host.insertBefore(node, target.nextSibling); else host.appendChild(node);
  closeDrawer();
  window.EvaraStudioMode?.renderLayers?.();
}
function renderResults() {
  const root = document.querySelector('[data-studio-component-results]');
  if (!root) return;
  const query = (document.querySelector('[data-studio-component-search]')?.value || '').toLowerCase();
  const items = STUDIO_COMPONENTS.filter((component) => !query || `${component.name} ${component.category} ${component.description}`.toLowerCase().includes(query));
  root.innerHTML = items.map((component) => `<button type="button" class="studio-component-result" data-insert-component="${component.id}"><strong>${component.icon} ${component.name}</strong><small>${component.description}</small></button>`).join('');
}
function bind() {
  ensureStyles(); ensureDrawer();
  document.addEventListener('click', (event) => {
    const action = event.target.closest('[data-studio-action="components"]');
    if (action && isModeOn()) { event.preventDefault(); event.stopPropagation(); openDrawer(); return; }
    const insert = event.target.closest('[data-insert-component]');
    if (insert) { event.preventDefault(); insertComponent(insert.dataset.insertComponent); }
    if (isModeOn() && !event.target.closest('.studio-component-drawer') && !event.target.closest('[data-studio-action="components"]')) closeDrawer();
  }, true);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true }); else bind();
