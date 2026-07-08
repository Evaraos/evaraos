import { getSavedUserProfile, getSavedUserRole, normalizeRole } from './firebase.js';
import { STUDIO_COMPONENTS, renderComponentPreview, componentsByCategory } from './studio/component-registry.js';
import { STUDIO_MODULES } from './studio/module-registry.js';
import { STUDIO_WAVES, STUDIO_CORE_SYSTEMS, studioOverallProgress } from './studio/studio-roadmap.js';
import { EVARA_BLUEPRINTS, blueprintsForStudio } from './studio/blueprint-registry.js';
import { saveDraftBlueprint, publishBlueprint, rollbackBlueprint, blueprintDraftSummary } from './studio/blueprint-drafts.js';

const OWNER_ROLES = new Set(['owner', 'super_admin', 'admin']);
const STUDIO_KEY = 'evaraos-studio-home-draft-v2';
const LEGACY_KEY = 'evaraos-studio-home-draft-v1';
const ASSETS = [
  { name: 'Official App Icon', type: 'Brand', status: 'Needs repository verification' },
  { name: 'Favicon', type: 'Brand', status: 'Synced from app icon' },
  { name: 'Brand Mark', type: 'Logo', status: 'Reusable across nav, splash, and icons' },
  { name: 'Backgrounds', type: 'Media', status: 'Library foundation' },
  { name: 'Marketplace Images', type: 'Media', status: 'Pending service catalog' },
  { name: 'Documents', type: 'Ops', status: 'Future upload vault' }
];
const PAGE_LIBRARY = [
  { id: 'owner-dashboard', title: 'Owner Dashboard', route: '/dashboard.html', role: 'owner', status: 'Live shell' },
  { id: 'customer-portal', title: 'Customer Portal', route: '/customer_dashboard.html', role: 'customer', status: 'Role engine active' },
  { id: 'jobs', title: 'Jobs', route: '/jobs.html', role: 'staff', status: 'Operational module' },
  { id: 'leads', title: 'Leads', route: '/leads.html', role: 'sales', status: 'Pipeline module' },
  { id: 'settings', title: 'Settings', route: '/settings-v2.html', role: 'all', status: 'Account module' },
  { id: 'studio', title: 'Evara Studio', route: '/website-builder.html', role: 'owner', status: 'Command center' }
];
let selectedBlueprintId = 'owner';
let activePanel = 'overview';
let booted = false;

function currentRole() {
  const profile = getSavedUserProfile?.() || {};
  return normalizeRole?.(profile.role || getSavedUserRole?.() || '') || '';
}
function isAllowed() { return OWNER_ROLES.has(currentRole()); }
function readState() {
  try { return JSON.parse(localStorage.getItem(STUDIO_KEY) || localStorage.getItem(LEGACY_KEY) || '{}') || {}; }
  catch { return {}; }
}
function writeState(patch = {}) {
  const next = { ...readState(), ...patch, selectedBlueprintId, activePanel, updatedAt: new Date().toISOString() };
  localStorage.setItem(STUDIO_KEY, JSON.stringify(next));
}
function safe(text = '') { return String(text ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'); }
function toast(message) {
  let node = document.querySelector('.builder-toast');
  if (!node) { node = document.createElement('div'); node.className = 'builder-toast'; document.body.appendChild(node); }
  node.textContent = message;
  node.classList.add('is-visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('is-visible'), 1800);
}
function draftFor(id) { return blueprintDraftSummary().find((item) => item.id === id) || null; }
function blueprintById(id) { return EVARA_BLUEPRINTS.find((item) => item.id === id || item.role === id) || EVARA_BLUEPRINTS[0]; }
function blueprintSummary(id = selectedBlueprintId) {
  const bp = blueprintById(id);
  const studio = blueprintsForStudio().find((item) => item.id === bp.id) || {};
  const draft = draftFor(bp.id);
  return { ...bp, ...studio, draftVersion: draft?.draftVersion || 1, liveVersion: draft?.liveVersion || 0, draftStatus: draft?.status || bp.status || 'draft' };
}
function progressPill(label, value) {
  return `<div class="studio-progress-row"><span>${safe(label)}</span><strong>${Number(value || 0)}%</strong><div class="studio-module-progress"><i style="width:${Math.max(0, Math.min(100, Number(value || 0)))}%"></i></div></div>`;
}
function stat(label, value, detail = '') {
  return `<article class="studio-stat-card"><span>${safe(label)}</span><strong>${safe(value)}</strong><small>${safe(detail)}</small></article>`;
}
function commandCard(id, icon, title, copy, meta = '') {
  return `<button type="button" class="studio-command-card" data-studio-open="${id}"><span>${safe(icon)}</span><strong>${safe(title)}</strong><small>${safe(copy)}</small>${meta ? `<em>${safe(meta)}</em>` : ''}</button>`;
}
function moduleCard(module) {
  return `<article class="studio-module-card" data-studio-select="module" data-name="${safe(module.name)}" data-copy="${safe(module.status)} • ${module.progress}%"><div><span>${safe(module.status)}</span><strong>${safe(module.name)}</strong></div><small>${module.dependencies?.length ? 'Depends on ' + safe(module.dependencies.join(', ')) : 'Independent module'}</small><div class="studio-module-progress"><i style="width:${Number(module.progress || 0)}%"></i></div></article>`;
}
function blueprintCard(bp) {
  const draft = draftFor(bp.id);
  const selected = bp.id === selectedBlueprintId;
  return `<button type="button" class="studio-blueprint-card${selected ? ' is-selected' : ''}" data-blueprint-id="${bp.id}" data-studio-select="blueprint" data-name="${safe(bp.name)}" data-copy="${safe(bp.role)} workspace"><div><span>${selected ? 'Selected' : (draft?.liveVersion ? 'Published' : bp.status)}</span><strong>${safe(bp.name)}</strong></div><small>${safe(bp.role)} • ${bp.sectionCount} sections • ${bp.componentCount} components</small><div class="studio-blueprint-route">Draft v${draft?.draftVersion || 1} · Live v${draft?.liveVersion || 0}</div></button>`;
}
function renderOverview() {
  const bp = blueprintSummary();
  const total = studioOverallProgress();
  return `<section class="studio-panel-grid">
    <article class="studio-feature-card studio-span-2">
      <p class="settings-kicker">COMMAND CENTER</p>
      <h2>One clean Studio, no floating chaos.</h2>
      <p>Evara Studio is now treated as a controlled command center: pages, blueprints, components, assets, roadmap, and publishing stay inside this workspace instead of spilling overlays across the app.</p>
      <div class="studio-health-grid">${stat('Studio Core', `${total}%`, 'Architecture progress')}${stat('Blueprints', EVARA_BLUEPRINTS.length, 'Role workspaces')}${stat('Components', STUDIO_COMPONENTS.length, 'Reusable UI blocks')}${stat('Modules', STUDIO_MODULES.length, 'Tracked systems')}</div>
    </article>
    <article class="studio-feature-card">
      <p class="settings-kicker">SELECTED BLUEPRINT</p>
      <h3>${safe(bp.name)}</h3>
      <p>${safe(bp.role)} experience • draft v${bp.draftVersion} • live v${bp.liveVersion}</p>
      ${progressPill('Blueprint readiness', Math.min(100, (bp.componentCount || 0) * 12 + (bp.liveVersion ? 18 : 0)))}
      <button type="button" class="studio-primary-action" data-studio-open="blueprints">Manage blueprint</button>
    </article>
    <article class="studio-feature-card studio-span-3">
      <p class="settings-kicker">BUILD QUEUE</p>
      <div class="studio-queue">${STUDIO_CORE_SYSTEMS.slice(0, 6).map((system) => `<div><strong>${safe(system.name)}</strong><span>${safe(system.status)} · ${system.progress}%</span></div>`).join('')}</div>
    </article>
  </section>`;
}
function renderPages() {
  return `<section class="studio-panel-grid"><article class="studio-feature-card studio-span-3"><p class="settings-kicker">PAGE LIBRARY</p><h2>Pages become editable canvases after the architecture reset.</h2><p>This keeps page management inside Studio and avoids scattered live edit buttons across the product.</p></article>${PAGE_LIBRARY.map(page => `<a class="studio-page-card" href="${safe(page.route)}"><span>${safe(page.role)}</span><strong>${safe(page.title)}</strong><small>${safe(page.status)}</small><em>${safe(page.route)}</em></a>`).join('')}</section>`;
}
function renderBlueprints() {
  const selected = blueprintSummary();
  return `<section class="studio-panel-grid">
    <article class="studio-feature-card studio-span-2">
      <p class="settings-kicker">BLUEPRINT MANAGER</p>
      <h2>${safe(selected.name)}</h2>
      <p>Blueprints define each role's navigation, dashboard sections, permissions, and future editable canvas state. Use publish carefully; preview is temporarily simplified until the full Preview Engine is rebuilt.</p>
      <div class="studio-actions studio-actions-primary"><button type="button" data-blueprint-action="save">Save Draft</button><button type="button" data-blueprint-action="publish">Publish</button><button type="button" data-blueprint-action="rollback">Rollback</button><button type="button" data-blueprint-action="open">Open Role Route</button></div>
      <small>Selected: <b data-selected-blueprint>${safe(selectedBlueprintId)}</b></small>
    </article>
    <article class="studio-feature-card">
      <p class="settings-kicker">STRUCTURE</p>
      <div class="studio-queue">${(selected.sections || []).map(section => `<div><strong>${safe(section.title)}</strong><span>${section.components?.length || 0} components</span></div>`).join('')}</div>
    </article>
    <div class="studio-blueprint-grid studio-span-3">${blueprintsForStudio().map(blueprintCard).join('')}</div>
  </section>`;
}
function renderComponents() {
  const groups = componentsByCategory();
  return `<section class="studio-panel-grid"><article class="studio-feature-card studio-span-3"><p class="settings-kicker">COMPONENT LIBRARY</p><h2>Reusable blocks for the future Visual OS Builder.</h2><p>These are the building blocks that will eventually drag into pages, dashboards, customer portals, and role blueprints.</p></article>${Object.entries(groups).map(([category, items]) => `<article class="studio-feature-card"><p class="settings-kicker">${safe(category)}</p><div class="studio-component-stack">${items.map(component => `<div data-studio-select="component" data-name="${safe(component.name)}" data-copy="${safe(component.description)}">${renderComponentPreview(component)}</div>`).join('')}</div></article>`).join('')}</section>`;
}
function renderAssets() {
  return `<section class="studio-panel-grid"><article class="studio-feature-card studio-span-3"><p class="settings-kicker">ASSET LIBRARY</p><h2>Brand, icons, media, and documents in one place.</h2><p>The next asset milestone is repository-backed uploads so the official app icon, favicon, and logos cannot fall out of sync again.</p></article>${ASSETS.map(asset => `<article class="studio-asset-card" data-studio-select="asset" data-name="${safe(asset.name)}" data-copy="${safe(asset.status)}"><span>${safe(asset.type)}</span><strong>${safe(asset.name)}</strong><small>${safe(asset.status)}</small></article>`).join('')}</section>`;
}
function renderModules() {
  return `<section class="studio-panel-grid"><article class="studio-feature-card studio-span-3"><p class="settings-kicker">MODULE REGISTRY</p><h2>Tracked systems before we build more screens.</h2><p>Modules stay visible here so we stop getting sidetracked and build in the right order.</p></article>${STUDIO_MODULES.map(moduleCard).join('')}</section>`;
}
function renderProject() {
  return `<section class="studio-panel-grid"><article class="studio-feature-card studio-span-2"><p class="settings-kicker">PROJECT CENTER</p><h2>Stabilize first. Build second.</h2><p>Current sprint: clean Studio, remove floating clutter, simplify preview, then rebuild the Visual OS Builder as one controlled workspace.</p>${progressPill('Overall Studio Core', studioOverallProgress())}</article><article class="studio-feature-card"><p class="settings-kicker">NEXT CHECKLIST</p><div class="studio-queue"><div><strong>1. Studio page polish</strong><span>Current</span></div><div><strong>2. Blueprint preview engine</strong><span>Next</span></div><div><strong>3. Canvas builder v1</strong><span>Planned</span></div><div><strong>4. Repo-backed assets</strong><span>Planned</span></div></div></article>${STUDIO_WAVES.map(wave => `<article class="studio-module-card"><div><span>${safe(wave.status)}</span><strong>${safe(wave.name)}</strong></div><small>${safe(wave.items.join(' • '))}</small><div class="studio-module-progress"><i style="width:${wave.progress}%"></i></div></article>`).join('')}</section>`;
}
function renderPanel(panel = 'overview') {
  activePanel = panel;
  const root = document.querySelector('[data-studio-panel-root]');
  if (!root) return;
  const renderers = { overview: renderOverview, pages: renderPages, components: renderComponents, modules: renderModules, blueprints: renderBlueprints, assets: renderAssets, project: renderProject, permissions: renderProject, themes: renderAssets };
  root.innerHTML = (renderers[panel] || renderOverview)();
  document.querySelectorAll('[data-studio-panel]').forEach((button) => button.classList.toggle('is-active', button.dataset.studioPanel === panel));
  const kicker = document.querySelector('[data-studio-panel-kicker]');
  const title = document.querySelector('[data-owner-edit="studioPanelTitle"]');
  if (kicker) kicker.textContent = panel.toUpperCase();
  if (title) title.textContent = panel === 'overview' ? 'Studio command center' : panel.replace(/\b\w/g, (letter) => letter.toUpperCase());
  writeState();
}
function routeForBlueprint(id) {
  if (id === 'customer') return '/customer_dashboard.html';
  if (['technician','cleaner','sales','vendor'].includes(id)) return '/dashboard.html';
  return '/dashboard.html';
}
function handleBlueprintAction(action) {
  if (action === 'save') { saveDraftBlueprint(selectedBlueprintId, { updatedFromStudio: true }); toast('Blueprint draft saved'); }
  if (action === 'publish') { publishBlueprint(selectedBlueprintId); toast('Blueprint published'); }
  if (action === 'rollback') { const rolled = rollbackBlueprint(selectedBlueprintId); toast(rolled ? 'Blueprint rolled back' : 'No rollback available'); }
  if (action === 'open') { location.assign(routeForBlueprint(selectedBlueprintId)); return; }
  renderPanel('blueprints');
}
function updateStaticShell() {
  document.body.classList.add('studio-safe-page');
  const progress = studioOverallProgress();
  const label = document.querySelector('[data-studio-progress]');
  const bar = document.querySelector('[data-studio-progress-bar]');
  if (label) label.textContent = `Studio Core • ${progress}%`;
  if (bar) bar.style.width = `${progress}%`;
  const rail = document.querySelector('.studio-rail');
  if (rail && !rail.querySelector('[data-studio-panel="pages"]')) {
    rail.querySelector('[data-studio-panel="components"]')?.insertAdjacentHTML('beforebegin', '<button data-studio-panel="pages">Pages</button>');
  }
}
function bind() {
  if (booted) return;
  booted = true;
  document.addEventListener('click', (event) => {
    const blueprintAction = event.target.closest('[data-blueprint-action]');
    if (blueprintAction) { event.preventDefault(); handleBlueprintAction(blueprintAction.dataset.blueprintAction); return; }
    const blueprint = event.target.closest('[data-blueprint-id]');
    if (blueprint) { selectedBlueprintId = blueprint.dataset.blueprintId; writeState(); renderPanel('blueprints'); return; }
    const panel = event.target.closest('[data-studio-panel], [data-studio-open], [data-studio-panel-jump]');
    if (panel) { event.preventDefault(); renderPanel(panel.dataset.studioPanel || panel.dataset.studioOpen || panel.dataset.studioPanelJump || 'overview'); return; }
    const selected = event.target.closest('[data-studio-select]');
    if (selected) {
      const title = document.querySelector('[data-studio-inspector-title]');
      const copy = document.querySelector('[data-studio-inspector-copy]');
      if (title) title.textContent = selected.dataset.name || 'Selected item';
      if (copy) copy.textContent = selected.dataset.copy || 'Studio item selected.';
    }
  });
  document.querySelector('[data-open-icons]')?.addEventListener('click', () => location.assign('/settings/icons.html'));
  document.querySelectorAll('[data-save-studio]').forEach((button) => button.addEventListener('click', () => { writeState(); toast('Studio state saved'); }));
}
function boot() {
  if (!isAllowed()) return;
  window.EvaraStudioSafeReset?.run?.();
  window.EvaraBrand?.apply?.();
  const saved = readState();
  selectedBlueprintId = saved.selectedBlueprintId || selectedBlueprintId;
  activePanel = saved.activePanel || saved.panel || activePanel;
  updateStaticShell();
  bind();
  renderPanel(activePanel);
}
window.addEventListener('evara:session-ready', boot, { once: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 500), { once: true });
else setTimeout(boot, 500);
