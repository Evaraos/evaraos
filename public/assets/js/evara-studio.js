import { getSavedUserProfile, getSavedUserRole, normalizeRole } from './firebase.js';
import { STUDIO_COMPONENTS, renderComponentPreview } from './studio/component-registry.js';
import { STUDIO_MODULES, studioProgress } from './studio/module-registry.js';
import { STUDIO_WAVES, STUDIO_CORE_SYSTEMS, studioOverallProgress } from './studio/studio-roadmap.js';

const OWNER_ROLES = new Set(['owner', 'super_admin', 'admin']);
const DRAFT_KEY = 'evaraos-studio-home-draft-v1';
const BLUEPRINTS = ['Owner', 'Admin', 'Organization', 'HR', 'Sales', 'Technician', 'Cleaner', 'Vendor', 'Customer'];
const ASSETS = ['Official App Icon', 'Favicon', 'Brand Mark', 'Splash Screen', 'Backgrounds', 'Service Images', 'Marketplace Images', 'Documents'];

function currentRole() {
  const profile = getSavedUserProfile?.() || {};
  return normalizeRole?.(profile.role || getSavedUserRole?.() || '') || '';
}
function isAllowed() { return OWNER_ROLES.has(currentRole()); }
function data() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; } }
function saveData(value) { localStorage.setItem(DRAFT_KEY, JSON.stringify(value)); }
function toast(message) {
  let node = document.querySelector('.builder-toast');
  if (!node) { node = document.createElement('div'); node.className = 'builder-toast'; document.body.appendChild(node); }
  node.textContent = message;
  node.classList.add('is-visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('is-visible'), 1500);
}
function saveDraft(show = true) {
  const saved = data();
  document.querySelectorAll('[data-studio-field]').forEach((field) => { saved[field.dataset.studioField] = field.value || ''; });
  saved.panel = document.querySelector('[data-studio-panel].is-active')?.dataset.studioPanel || 'overview';
  saveData(saved);
  if (show) toast('Studio draft saved');
}
function safe(text = '') { return String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'); }
function card(title, copy, icon = '◈', attrs = '') {
  return `<article class="eva-card studio-registry-card" ${attrs}><span>${safe(icon)}</span><strong>${safe(title)}</strong><small>${safe(copy)}</small></article>`;
}
function progressLine(item, selectType = 'system') {
  return `<article class="eva-card studio-module-card" data-studio-select="${selectType}" data-name="${safe(item.name)}" data-copy="${safe(item.description || item.status || '')}"><div><span>${safe(item.status || 'active')}</span><strong>${safe(item.name)}</strong></div><small>${safe(item.description || (item.items ? item.items.join(' • ') : ''))}</small><div class="studio-module-progress"><i style="width:${Number(item.progress || 0)}%"></i></div></article>`;
}
function progressCard(module) {
  return `<article class="eva-card studio-module-card" data-studio-select="module" data-name="${safe(module.name)}" data-copy="${safe(module.status)} • ${safe(module.progress)}%"><div><span>${safe(module.status)}</span><strong>${safe(module.name)}</strong></div><small>${module.dependencies.length ? 'Depends on: ' + safe(module.dependencies.join(', ')) : 'No dependencies'}</small><div class="studio-module-progress"><i style="width:${Number(module.progress || 0)}%"></i></div></article>`;
}
function setInspector(title = 'Nothing selected', copy = 'Select a Studio item to view its properties.') {
  document.querySelector('[data-studio-inspector-title]').textContent = title;
  document.querySelector('[data-studio-inspector-copy]').textContent = copy;
  const nameField = document.querySelector('[data-studio-field="name"]');
  if (nameField) nameField.value = title;
}
function renderOverview() {
  const total = studioOverallProgress();
  return `<section class="studio-overview-grid"><article class="eva-card studio-large-card"><p class="settings-kicker">STUDIO CORE</p><h2>The platform that builds the platform.</h2><p>Studio Core now has a roadmap registry, component registry, module registry, and architecture decision record. Next: Studio Mode, Canvas Engine, Layers, Inspector, and Asset Library.</p><div class="studio-module-progress"><i style="width:${total}%"></i></div><small>Overall Studio Core progress: ${total}%</small></article>${card('Component Engine', `${STUDIO_COMPONENTS.length} components registered`, '▣', 'data-studio-panel-jump="components"')}${card('Module Registry', `${STUDIO_MODULES.length} modules tracked`, '◎', 'data-studio-panel-jump="modules"')}${card('Studio Core Roadmap', `${STUDIO_CORE_SYSTEMS.length} systems tracked`, '✦', 'data-studio-panel-jump="project"')}${card('Blueprint Manager', `${BLUEPRINTS.length} role blueprints planned`, '◈', 'data-studio-panel-jump="blueprints"')}</section>`;
}
function renderComponents() {
  return `<section class="studio-component-library">${STUDIO_COMPONENTS.map((component) => `<div data-studio-select="component" data-name="${safe(component.name)}" data-copy="${safe(component.description)}">${renderComponentPreview(component)}</div>`).join('')}</section>`;
}
function renderModules() { return `<section class="studio-module-grid">${STUDIO_MODULES.map(progressCard).join('')}</section>`; }
function renderBlueprints() {
  return `<section class="studio-module-grid">${BLUEPRINTS.map((name) => card(`${name} Blueprint`, `Role-aware workspace for ${name.toLowerCase()} users.`, '◈', `data-studio-select="blueprint" data-name="${name} Blueprint" data-copy="Blueprint controls layout, components, permissions, and data."`)).join('')}</section>`;
}
function renderAssets() {
  return `<section class="studio-module-grid">${ASSETS.map((name) => card(name, 'Managed through the upcoming Asset Library.', '▧', `data-studio-select="asset" data-name="${name}" data-copy="Assets will be uploaded once and reused everywhere."`)).join('')}</section>`;
}
function renderProject() {
  return `<section class="studio-overview-grid"><article class="eva-card studio-large-card"><p class="settings-kicker">PROJECT CENTER</p><h2>Studio Core implementation</h2><p>Current focus: convert Studio from a page into an owner-only platform mode with canvas, layers, inspector, and reusable components.</p><div class="studio-module-progress"><i style="width:${studioOverallProgress()}%"></i></div><small>Studio Core progress: ${studioOverallProgress()}%</small></article>${STUDIO_WAVES.map((wave) => progressLine(wave, 'wave')).join('')}${STUDIO_CORE_SYSTEMS.map((system) => progressLine(system, 'system')).join('')}</section>`;
}
function renderPanel(panel = 'overview') {
  const root = document.querySelector('[data-studio-panel-root]');
  if (!root) return;
  const renderers = { overview: renderOverview, components: renderComponents, modules: renderModules, blueprints: renderBlueprints, assets: renderAssets, project: renderProject };
  root.innerHTML = (renderers[panel] || renderOverview)();
  const kicker = document.querySelector('[data-studio-panel-kicker]');
  const title = document.querySelector('[data-owner-edit="studioPanelTitle"]');
  if (kicker) kicker.textContent = panel.toUpperCase();
  if (title) title.textContent = panel === 'overview' ? 'Studio operating center' : panel.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function setPanel(panel = 'overview') {
  document.querySelectorAll('[data-studio-panel]').forEach((button) => button.classList.toggle('is-active', button.dataset.studioPanel === panel));
  renderPanel(panel);
  saveDraft(false);
}
function updateProgress() {
  const progress = studioOverallProgress();
  const label = document.querySelector('[data-studio-progress]');
  const bar = document.querySelector('[data-studio-progress-bar]');
  if (label) label.textContent = `Studio Core • ${progress}%`;
  if (bar) bar.style.width = `${progress}%`;
}
function boot() {
  if (!isAllowed()) return;
  window.EvaraBrand?.apply?.();
  updateProgress();
  const saved = data();
  document.querySelectorAll('[data-studio-field]').forEach((field) => { field.value = saved[field.dataset.studioField] || ''; });
  setPanel(saved.panel || 'overview');
  document.addEventListener('click', (event) => {
    const panel = event.target.closest('[data-studio-panel], [data-studio-panel-jump], [data-studio-open]');
    if (panel) setPanel(panel.dataset.studioPanel || panel.dataset.studioPanelJump || panel.dataset.studioOpen || 'overview');
    const selected = event.target.closest('[data-studio-select]');
    if (selected) setInspector(selected.dataset.name || 'Selected item', selected.dataset.copy || 'Editable Studio item.');
  });
  document.querySelectorAll('[data-save-studio]').forEach((button) => button.addEventListener('click', () => saveDraft(true)));
  document.querySelector('[data-open-icons]')?.addEventListener('click', () => location.assign('/settings/icons.html'));
  document.querySelectorAll('[data-studio-field]').forEach((field) => field.addEventListener('input', () => saveDraft(false)));
}
window.addEventListener('evara:session-ready', boot, { once: true });
setTimeout(boot, 1200);
