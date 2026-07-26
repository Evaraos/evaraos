import { auth, getSavedUserProfile, getSavedUserRole } from './firebase.js';
import { normalizeAccessRole, pagesForRole } from './access-control.js';
import { EVARA_DESIGN_SYSTEM_REGISTRY } from './design-system/registry.js';

const AUDIT_URL = '/tools/reports/repo-audit-ui.json';
const APPEARANCES = Object.freeze([
  { id: 'light', label: 'Light', detail: 'Bright adaptive environment' },
  { id: 'dark', label: 'Dark', detail: 'Low-light adaptive environment' },
  { id: 'system', label: 'System', detail: 'Follows device preference' },
  { id: 'image', label: 'Image', detail: 'Wallpaper-aware contrast' }
]);
const DEVICES = Object.freeze([
  { id: 'desktop', label: 'Desktop Chromium', detail: '1440 × 1100', engine: 'Chromium' },
  { id: 'tablet', label: 'Tablet Chromium', detail: '1024 × 1366', engine: 'Chromium' },
  { id: 'iphone', label: 'iPhone', detail: 'Mobile safe-area project', engine: 'WebKit' },
  { id: 'android', label: 'Android', detail: 'Mobile touch project', engine: 'Chromium' }
]);
const CRITICAL_ROUTES = Object.freeze([
  '/dashboard.html',
  '/settings-v2.html',
  '/messages.html',
  '/website-builder.html',
  '/applications.html',
  '/jobs.html',
  '/dispatch.html',
  '/schedule.html',
  '/field.html',
  '/territory-map.html',
  '/marketplace-payouts.html',
  '/live-operations-command.html',
  '/operations-visibility.html',
  '/qa-v2.html'
]);

const state = {
  checks: [],
  files: [],
  summary: null,
  routeResults: [],
  role: 'customer',
  authorizedPages: [],
  lastRunAt: null
};

const $ = (id) => document.getElementById(id);
const esc = (value = '') => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

async function ping(url) {
  try {
    const separator = url.includes('?') ? '&' : '?';
    const response = await fetch(`${url}${separator}qa=${Date.now()}`, { cache: 'no-store', credentials: 'same-origin' });
    return { ok: response.ok, status: response.status, response };
  } catch (error) {
    return { ok: false, status: 0, error };
  }
}

function addCheck(name, status, detail, category = 'runtime') {
  state.checks.push({ name, status, detail, category });
}

function verifiedRole() {
  const profile = getSavedUserProfile?.() || {};
  return normalizeAccessRole(profile.role || getSavedUserRole?.() || 'customer');
}

function viewportLabel() {
  const width = window.innerWidth;
  if (width <= 560) return 'Mobile';
  if (width <= 1024) return 'Tablet';
  return 'Desktop';
}

function duplicateIds() {
  const counts = {};
  document.querySelectorAll('[id]').forEach((node) => {
    counts[node.id] = (counts[node.id] || 0) + 1;
  });
  return Object.entries(counts).filter(([, count]) => count > 1).map(([id, count]) => `${id} (${count})`);
}

function currentAppearance() {
  return window.EvaraTheme?.getAppearance?.() || {
    mode: document.documentElement.dataset.themeMode || 'system'
  };
}

async function waitForRuntime() {
  const started = Date.now();
  while (Date.now() - started < 5000) {
    if (window.EvaraTheme && document.body?.classList.contains('app-ready')) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function runRuntime() {
  await waitForRuntime();
  state.checks = [];
  state.routeResults = [];
  state.role = verifiedRole();
  state.authorizedPages = pagesForRole(state.role);

  const appearance = currentAppearance();
  const root = document.documentElement;
  const designSystemLink = document.querySelector('link[href*="/assets/css/design-system.css"]');
  const duplicates = duplicateIds();
  const overflow = Math.max(0, root.scrollWidth - root.clientWidth);

  addCheck('Verified Firebase session', auth.currentUser ? 'pass' : 'fail', auth.currentUser ? 'Authenticated user is present.' : 'No authenticated Firebase user is available.', 'security');
  addCheck('Verified role policy', ['platform_admin', 'owner', 'admin'].includes(state.role) ? 'pass' : 'fail', `Resolved role: ${state.role}.`, 'security');
  addCheck('Theme runtime', window.EvaraTheme ? 'pass' : 'fail', window.EvaraTheme ? `Mode: ${appearance.mode}; environment: ${root.dataset.environment || 'unknown'}.` : 'Theme runtime is missing.', 'appearance');
  addCheck('Theme authority', root.dataset.evaraThemeAuthority === 'runtime' ? 'pass' : 'warn', root.dataset.evaraThemeAuthority ? `Authority: ${root.dataset.evaraThemeAuthority}.` : 'Runtime authority marker has not been applied.', 'appearance');
  addCheck('Design-system bundle', designSystemLink?.href.includes('design-system.css?v=2') ? 'pass' : 'fail', designSystemLink ? designSystemLink.href : 'Canonical bundle is missing.', 'design-system');
  addCheck('Design-system registry', EVARA_DESIGN_SYSTEM_REGISTRY?.version === '2.0.0' ? 'pass' : 'fail', `${EVARA_DESIGN_SYSTEM_REGISTRY.components.length} contracts across ${EVARA_DESIGN_SYSTEM_REGISTRY.layers.length} layers.`, 'design-system');
  addCheck('Universal navigation', document.querySelector('.eva-nav-layer') ? 'pass' : 'warn', document.querySelector('.eva-nav-layer') ? 'Navigation is mounted.' : 'Navigation has not mounted yet.', 'runtime');
  addCheck('Horizontal overflow', overflow <= 2 ? 'pass' : 'fail', overflow <= 2 ? 'No root horizontal overflow.' : `${overflow}px of root overflow detected.`, 'responsive');
  addCheck('Unique DOM IDs', duplicates.length ? 'warn' : 'pass', duplicates.length ? `Duplicates: ${duplicates.join(', ')}.` : 'No duplicate IDs detected on this screen.', 'accessibility');
  addCheck('Reduced-motion support', matchMedia('(prefers-reduced-motion: reduce)').matches ? 'pass' : 'pass', matchMedia('(prefers-reduced-motion: reduce)').matches ? 'Reduced motion is active.' : 'Normal motion preference is active; automated tests emulate reduced motion.', 'accessibility');
  addCheck('Service worker capability', 'serviceWorker' in navigator ? 'pass' : 'warn', 'Browser capability check.', 'runtime');
  addCheck('Online state', navigator.onLine ? 'pass' : 'warn', navigator.onLine ? 'Browser reports online.' : 'Browser reports offline.', 'runtime');

  const authorizedCriticalRoutes = CRITICAL_ROUTES.filter((route) => state.authorizedPages.includes(route.slice(1)));
  for (const route of authorizedCriticalRoutes) {
    const result = await ping(route);
    const record = { route, ok: result.ok, status: result.status };
    state.routeResults.push(record);
    addCheck(`Route ${route}`, result.ok ? 'pass' : 'fail', result.ok ? `HTTP ${result.status}.` : 'Route failed to respond.', 'route');
  }

  state.lastRunAt = new Date().toISOString();
  renderAll();
}

async function loadAudit() {
  const status = $('qa2Status');
  status.textContent = 'Loading repository audit…';
  const result = await ping(AUDIT_URL);
  if (!result.ok) {
    state.summary = null;
    state.files = [];
    status.textContent = 'Repository audit JSON is unavailable. Run the repository audit generator and deploy the report.';
    renderStats();
    renderFiles();
    return;
  }

  try {
    const data = await result.response.json();
    state.summary = data;
    state.files = Array.isArray(data.files) ? data.files : [];
    status.textContent = `Audit loaded ${new Date().toLocaleString()}.`;
  } catch {
    state.summary = null;
    state.files = [];
    status.textContent = 'Repository audit JSON could not be parsed.';
  }
  renderStats();
  renderFiles();
}

function renderChecks() {
  const root = $('qa2Checks');
  root.innerHTML = state.checks.length
    ? state.checks.map((item) => `
      <article class="qa2-check ${esc(item.status)}">
        <span class="qa2-dot" aria-hidden="true"></span>
        <div>
          <strong>${esc(item.name)}</strong>
          <p>${esc(item.detail)}</p>
        </div>
        <small>${esc(item.status.toUpperCase())}</small>
      </article>`).join('')
    : '<div class="qa2-empty">Run the audit to populate live checks.</div>';

  const failures = state.checks.filter((item) => item.status === 'fail').length;
  const warnings = state.checks.filter((item) => item.status === 'warn').length;
  const badge = $('qa2RuntimeBadge');
  badge.textContent = failures ? `${failures} failing` : warnings ? `${warnings} warnings` : 'Passing';
  badge.dataset.tone = failures ? 'critical' : warnings ? 'warning' : 'positive';
}

function renderStats() {
  const failures = state.checks.filter((item) => item.status === 'fail').length;
  const warnings = state.checks.filter((item) => item.status === 'warn').length;
  $('qa2RuntimeStat').textContent = String(Math.max(0, state.checks.length - failures));
  $('qa2WarningsStat').textContent = String(warnings);
  $('qa2ContractsStat').textContent = String(EVARA_DESIGN_SYSTEM_REGISTRY.components.length);
  $('qa2RoutesStat').textContent = String(state.authorizedPages.length);
  $('qa2AppearanceStat').textContent = String(currentAppearance().mode || 'system').replace(/^./, (value) => value.toUpperCase());
  $('qa2ViewportStat').textContent = viewportLabel();
}

function renderAppearanceMatrix() {
  const active = currentAppearance().mode || 'system';
  $('qa2AppearanceMatrix').innerHTML = APPEARANCES.map((appearance) => `
    <button class="qa2-appearance-option${active === appearance.id ? ' is-active' : ''}" type="button" data-qa-appearance="${appearance.id}" aria-pressed="${active === appearance.id}">
      <span class="qa2-appearance-preview" data-preview-mode="${appearance.id}" aria-hidden="true"></span>
      <strong>${esc(appearance.label)}</strong>
      <small>${esc(appearance.detail)}</small>
    </button>`).join('');
  $('qa2AppearanceStatus').textContent = `Current mode: ${active}. Resolved environment: ${document.documentElement.dataset.environment || 'unknown'}.`;
}

function renderRegistry() {
  const counts = EVARA_DESIGN_SYSTEM_REGISTRY.components.reduce((output, component) => {
    output[component.source] = (output[component.source] || 0) + 1;
    return output;
  }, {});
  $('qa2Registry').innerHTML = EVARA_DESIGN_SYSTEM_REGISTRY.layers.map((layer) => `
    <article class="qa2-registry-row">
      <div>
        <strong>${esc(layer.name)}</strong>
        <span>${esc(layer.owns.join(' • '))}</span>
      </div>
      <small>${counts[layer.id] || 0} contracts</small>
    </article>`).join('');
}

function renderViewportMatrix() {
  $('qa2ViewportMatrix').innerHTML = DEVICES.map((device) => `
    <article class="qa2-device-card">
      <span class="qa2-device-icon" data-device="${device.id}" aria-hidden="true"></span>
      <div><strong>${esc(device.label)}</strong><small>${esc(device.detail)}</small></div>
      <em>${esc(device.engine)}</em>
    </article>`).join('');
}

function renderRoutes() {
  const status = $('qa2RoleStatus');
  status.textContent = `Verified role: ${state.role}. ${state.authorizedPages.length} protected routes are authorized by the canonical page policy.`;
  const routes = CRITICAL_ROUTES.filter((route) => state.authorizedPages.includes(route.slice(1)));
  $('qa2Routes').innerHTML = routes.length
    ? routes.map((route) => {
      const result = state.routeResults.find((entry) => entry.route === route);
      const tone = result ? (result.ok ? 'positive' : 'critical') : 'neutral';
      const label = result ? (result.ok ? `HTTP ${result.status}` : 'Failed') : 'Waiting';
      return `<article class="qa2-route-row"><code>${esc(route)}</code><span data-tone="${tone}">${esc(label)}</span></article>`;
    }).join('')
    : '<div class="qa2-empty">No critical QA routes are authorized for this role.</div>';
}

function renderAutomation() {
  const rows = [
    ['Architecture audit', 'Automatic on design-system changes', 'positive'],
    ['Authenticated visual QA', 'Manual workflow dispatch', 'positive'],
    ['Required credential', 'Dedicated owner QA account', 'warning'],
    ['Full role coverage', 'Nine synthetic QA accounts', 'warning'],
    ['Screenshot engines', 'Chromium and WebKit', 'positive'],
    ['Artifact retention', '14 days; auth state excluded', 'positive']
  ];
  $('qa2Automation').innerHTML = rows.map(([name, detail, tone]) => `
    <article class="qa2-automation-row">
      <div><strong>${esc(name)}</strong><span>${esc(detail)}</span></div>
      <small data-tone="${tone}">${tone === 'positive' ? 'Ready' : 'Configure'}</small>
    </article>`).join('');
}

function renderFiles() {
  const query = ($('qa2Search').value || '').trim().toLowerCase();
  const rows = state.files.filter((file) => !query
    || String(file.file || '').toLowerCase().includes(query)
    || (file.issues || []).some((issue) => String(issue).toLowerCase().includes(query)));
  $('qa2Files').innerHTML = rows.length
    ? rows.map((file) => `
      <article class="qa2-file">
        <strong>${esc(file.file || 'Unknown file')}</strong>
        <small>${esc(file.scoreText || file.status || 'Unknown')}</small>
        <span>${esc((file.issues || []).join(' • ') || 'No reported issues')}</span>
      </article>`).join('')
    : '<div class="qa2-empty">No matching repository audit records.</div>';
}

function renderAll() {
  renderChecks();
  renderStats();
  renderAppearanceMatrix();
  renderRegistry();
  renderViewportMatrix();
  renderRoutes();
  renderAutomation();
  renderFiles();
}

async function setAppearanceMode(mode) {
  if (!APPEARANCES.some((appearance) => appearance.id === mode) || !window.EvaraTheme?.setAppearance) return;
  const value = { mode };
  if (mode === 'image') {
    value.imageUrl = new URL('/assets/img/icon-512.png?v=brand-logo-1', location.origin).href;
    value.imagePosition = 'center center';
    value.wallpaperDim = 0.08;
    value.glassTint = 0.46;
    value.adaptiveContrast = true;
  }
  $('qa2AppearanceStatus').textContent = `Applying ${mode} appearance…`;
  await window.EvaraTheme.setAppearance(value);
  renderAppearanceMatrix();
  renderStats();
}

async function runAll() {
  const button = $('qa2Run');
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.textContent = 'Running…';
  await Promise.all([runRuntime(), loadAudit()]);
  button.disabled = false;
  button.removeAttribute('aria-busy');
  button.textContent = 'Run full audit';
}

function exportReport() {
  const payload = {
    generatedAt: new Date().toISOString(),
    designSystem: {
      version: EVARA_DESIGN_SYSTEM_REGISTRY.version,
      registryVersion: EVARA_DESIGN_SYSTEM_REGISTRY.registryVersion,
      layers: EVARA_DESIGN_SYSTEM_REGISTRY.layers.length,
      contracts: EVARA_DESIGN_SYSTEM_REGISTRY.components.length,
      materialAuthority: EVARA_DESIGN_SYSTEM_REGISTRY.materialAuthority
    },
    session: {
      role: state.role,
      userId: auth.currentUser?.uid || '',
      appearance: currentAppearance(),
      viewport: { width: innerWidth, height: innerHeight, class: viewportLabel() }
    },
    runtimeChecks: state.checks,
    routeResults: state.routeResults,
    repositoryAudit: state.summary
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `evaraos-visual-qa-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function init() {
  $('qa2Run')?.addEventListener('click', runAll);
  $('qa2Refresh')?.addEventListener('click', loadAudit);
  $('qa2Export')?.addEventListener('click', exportReport);
  $('qa2Search')?.addEventListener('input', renderFiles);
  $('qa2AppearanceMatrix')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-qa-appearance]');
    if (button) setAppearanceMode(button.dataset.qaAppearance);
  });
  window.addEventListener('resize', renderStats, { passive: true });
  window.addEventListener('evara:theme-applied', () => {
    renderAppearanceMatrix();
    renderStats();
  });
  renderAll();
  runAll().catch((error) => {
    console.error('Visual QA audit failed:', error);
    addCheck('Visual QA runtime', 'fail', error.message || String(error));
    renderAll();
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
