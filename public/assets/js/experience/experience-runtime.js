const CACHE_KEY = 'evaraos-experience-config-v1';
const ENDPOINT = '/__experience/config';
const DEFAULT_CONFIG = Object.freeze({
  schemaVersion: 'evara.experience.v1',
  brand: {
    markUrl: '/assets/brand/evaraos-mark.png',
    appIconUrl: '/assets/brand/evaraos-app-icon.png',
    alt: 'EvaraOS'
  },
  loaderTheme: {
    accent: '#f2172d',
    background: '#eef5fb',
    radius: 34,
    markSize: 42,
    showProgress: true
  },
  loaders: {
    welcome: { enabled: true, eyebrow: 'EVARAOS', title: 'Welcome to Evaraos', subtitle: 'Preparing your operating system.', minimumMs: 1200 },
    page: { enabled: true, label: 'Loading EvaraOS' },
    resume: { enabled: true, title: 'Welcome back to Evaraos', subtitle: 'Refreshing your workspace.', minimumAwayMs: 45000 }
  },
  home: {
    kicker: 'Subsidiaries Allocation SaaS',
    title: 'Run companies like a world-class operating system.',
    subtitle: 'Evaraos Inc is built to power multiple subsidiaries, teams, customer portals, leads, jobs, reporting, approvals, and operations from one premium control center. One platform. Multiple categories. Scalable infrastructure.',
    primaryAction: 'Enter Platform',
    secondaryAction: 'Create Account'
  },
  pageOverrides: {}
});

const clone = (value) => JSON.parse(JSON.stringify(value));
const text = (value, max = 4000) => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, max);
const integer = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Math.round(Number(value)))) : fallback;
const hex = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toLowerCase() : fallback;

function safeAssetUrl(value, fallback = '') {
  const candidate = text(value, 2200).trim();
  if (!candidate) return fallback;
  if (candidate.startsWith('/assets/')) return candidate;
  try {
    const url = new URL(candidate, location.origin);
    return url.protocol === 'https:' || url.origin === location.origin ? url.href : fallback;
  } catch {
    return fallback;
  }
}

function normalizeStyle(raw = {}) {
  return {
    radius: integer(raw.radius, 24, 0, 64),
    padding: integer(raw.padding, 18, 0, 72),
    glass: ['default', 'soft', 'liquid', 'strong'].includes(raw.glass) ? raw.glass : 'default'
  };
}

function normalizePageOverrides(raw = {}) {
  const output = {};
  Object.entries(raw && typeof raw === 'object' ? raw : {}).slice(0, 100).forEach(([pageKey, page]) => {
    const pageId = text(pageKey, 140).replace(/[^a-z0-9:._-]/gi, '-');
    if (!pageId) return;
    const next = { text: {}, media: {}, style: {} };
    Object.entries(page?.text || {}).slice(0, 300).forEach(([key, value]) => {
      const id = text(key, 180);
      if (id) next.text[id] = text(value, 4000);
    });
    Object.entries(page?.media || {}).slice(0, 100).forEach(([key, value]) => {
      const id = text(key, 180);
      const url = safeAssetUrl(value);
      if (id && url) next.media[id] = url;
    });
    Object.entries(page?.style || {}).slice(0, 300).forEach(([key, value]) => {
      const id = text(key, 180);
      if (id) next.style[id] = normalizeStyle(value);
    });
    output[pageId] = next;
  });
  return output;
}

export function normalizeExperienceConfig(raw = {}) {
  const fallback = DEFAULT_CONFIG;
  return {
    schemaVersion: 'evara.experience.v1',
    brand: {
      markUrl: safeAssetUrl(raw?.brand?.markUrl, fallback.brand.markUrl),
      appIconUrl: safeAssetUrl(raw?.brand?.appIconUrl, fallback.brand.appIconUrl),
      alt: text(raw?.brand?.alt || fallback.brand.alt, 120)
    },
    loaderTheme: {
      accent: hex(raw?.loaderTheme?.accent, fallback.loaderTheme.accent),
      background: hex(raw?.loaderTheme?.background, fallback.loaderTheme.background),
      radius: integer(raw?.loaderTheme?.radius, fallback.loaderTheme.radius, 16, 52),
      markSize: integer(raw?.loaderTheme?.markSize, fallback.loaderTheme.markSize, 24, 96),
      showProgress: typeof raw?.loaderTheme?.showProgress === 'boolean' ? raw.loaderTheme.showProgress : fallback.loaderTheme.showProgress
    },
    loaders: {
      welcome: {
        enabled: typeof raw?.loaders?.welcome?.enabled === 'boolean' ? raw.loaders.welcome.enabled : fallback.loaders.welcome.enabled,
        eyebrow: text(raw?.loaders?.welcome?.eyebrow || fallback.loaders.welcome.eyebrow, 80),
        title: text(raw?.loaders?.welcome?.title || fallback.loaders.welcome.title, 180),
        subtitle: text(raw?.loaders?.welcome?.subtitle || fallback.loaders.welcome.subtitle, 320),
        minimumMs: integer(raw?.loaders?.welcome?.minimumMs, fallback.loaders.welcome.minimumMs, 400, 5000)
      },
      page: {
        enabled: typeof raw?.loaders?.page?.enabled === 'boolean' ? raw.loaders.page.enabled : fallback.loaders.page.enabled,
        label: text(raw?.loaders?.page?.label || fallback.loaders.page.label, 160)
      },
      resume: {
        enabled: typeof raw?.loaders?.resume?.enabled === 'boolean' ? raw.loaders.resume.enabled : fallback.loaders.resume.enabled,
        title: text(raw?.loaders?.resume?.title || fallback.loaders.resume.title, 180),
        subtitle: text(raw?.loaders?.resume?.subtitle || fallback.loaders.resume.subtitle, 320),
        minimumAwayMs: integer(raw?.loaders?.resume?.minimumAwayMs, fallback.loaders.resume.minimumAwayMs, 10000, 600000)
      }
    },
    home: {
      kicker: text(raw?.home?.kicker || fallback.home.kicker, 180),
      title: text(raw?.home?.title || fallback.home.title, 260),
      subtitle: text(raw?.home?.subtitle || fallback.home.subtitle, 1200),
      primaryAction: text(raw?.home?.primaryAction || fallback.home.primaryAction, 100),
      secondaryAction: text(raw?.home?.secondaryAction || fallback.home.secondaryAction, 100)
    },
    pageOverrides: normalizePageOverrides(raw?.pageOverrides)
  };
}

function readCache() {
  try {
    const stored = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    return stored?.config ? normalizeExperienceConfig(stored.config) : normalizeExperienceConfig(stored || DEFAULT_CONFIG);
  } catch {
    return normalizeExperienceConfig(DEFAULT_CONFIG);
  }
}

function writeCache(config, meta = {}) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ config, publishedVersion: meta.publishedVersion || 0, cachedAt: Date.now() }));
  } catch {}
}

function pageKey() {
  return location.pathname.replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'home';
}

function editableTargets() {
  return Array.from(document.querySelectorAll('main h1,main h2,main h3,main p,main strong,main small,main .btn,main button:not([data-owner-ignore]),main img,main .glass-card,main .eva-card,main [data-builder-slot]'))
    .filter((node) => !node.closest('.owner-editor-panel,.owner-edit-fab-global,.owner-edit-dock,.eva-nav-layer,.evara-loader-fast,.evara-welcome-loader,.experience-builder-shell'))
    .filter((node) => String(node.textContent || '').trim().length > 0 || node.hasAttribute('data-builder-slot') || node.tagName === 'IMG' || node.classList.contains('glass-card') || node.classList.contains('eva-card'));
}

function ownerEditId(node, index = 0) {
  if (node.dataset.ownerEditId) return node.dataset.ownerEditId;
  const id = `${pageKey()}-${node.tagName.toLowerCase()}-${index}`;
  node.dataset.ownerEditId = id;
  return id;
}

function glassBackground(glass) {
  if (glass === 'strong') return 'linear-gradient(145deg,rgba(255,255,255,.36),rgba(255,255,255,.14))';
  if (glass === 'liquid') return 'linear-gradient(145deg,rgba(255,255,255,.26),rgba(255,255,255,.09))';
  if (glass === 'soft') return 'linear-gradient(145deg,rgba(255,255,255,.16),rgba(255,255,255,.05))';
  return '';
}

let currentConfig = readCache();
let publishedVersion = 0;
let observer = null;
let observerFrame = 0;
let applying = false;

function applyLoaderConfig(config) {
  window.EvaraLoader?.configure?.(config);
  const theme = config.loaderTheme;
  document.documentElement.style.setProperty('--evara-experience-accent', theme.accent);
  document.documentElement.style.setProperty('--evara-loader-background', theme.background);
  document.documentElement.style.setProperty('--evara-loader-radius', `${theme.radius}px`);
  document.documentElement.style.setProperty('--evara-loader-mark-size', `${theme.markSize}px`);
  const welcomeNode = document.getElementById('evaraWelcomeLoader');
  if (welcomeNode) welcomeNode.style.background = theme.background;
  document.querySelectorAll('.evara-loader-mark').forEach((image) => {
    image.src = config.brand.markUrl;
    image.alt = '';
    image.style.width = `${theme.markSize}px`;
    image.style.height = `${theme.markSize}px`;
  });
  document.querySelectorAll('.evara-welcome-card').forEach((node) => { node.style.borderRadius = `${theme.radius}px`; });
  document.querySelectorAll('.evara-welcome-progress').forEach((node) => { node.hidden = !theme.showProgress; });
  document.querySelectorAll('.evara-welcome-progress i').forEach((node) => { node.style.background = theme.accent; });
}

function applyRegisteredSlots(config) {
  document.querySelectorAll('[data-experience-text]').forEach((node) => {
    const path = node.dataset.experienceText || '';
    const value = path.split('.').reduce((current, key) => current?.[key], config);
    if (typeof value === 'string') node.textContent = value;
  });
  document.querySelectorAll('[data-experience-image]').forEach((node) => {
    const path = node.dataset.experienceImage || '';
    const value = path.split('.').reduce((current, key) => current?.[key], config);
    const url = safeAssetUrl(value);
    if (!url) return;
    if (node.tagName === 'IMG') node.src = url;
    else node.style.backgroundImage = `url('${url.replaceAll("'", '%27')}')`;
  });
}

function applyPageOverrides(config) {
  const page = config.pageOverrides?.[pageKey()];
  if (!page) return;
  editableTargets().forEach((node, index) => {
    const id = ownerEditId(node, index);
    const hasMedia = Boolean(page.media?.[id]);
    if (page.text?.[id] !== undefined && node.tagName !== 'IMG') node.textContent = page.text[id];
    if (hasMedia) {
      if (node.tagName === 'IMG') node.src = page.media[id];
      else {
        node.style.backgroundImage = `linear-gradient(rgba(0,0,0,.12),rgba(0,0,0,.12)),url('${page.media[id].replaceAll("'", '%27')}')`;
        node.style.backgroundSize = 'cover';
        node.style.backgroundPosition = 'center';
      }
    }
    if (page.style?.[id]) {
      const style = page.style[id];
      node.style.borderRadius = `${style.radius}px`;
      node.style.padding = `${style.padding}px`;
      if (!hasMedia) node.style.background = glassBackground(style.glass);
    }
  });
}

export function applyExperienceConfig(config, options = {}) {
  if (applying) return;
  applying = true;
  try {
    currentConfig = normalizeExperienceConfig(config || currentConfig);
    applyLoaderConfig(currentConfig);
    applyRegisteredSlots(currentConfig);
    applyPageOverrides(currentConfig);
    if (options.cache !== false) writeCache(currentConfig, { publishedVersion });
    window.dispatchEvent(new CustomEvent('evara:experience-config', {
      detail: { config: clone(currentConfig), publishedVersion, source: options.source || 'runtime' }
    }));
  } finally {
    applying = false;
  }
}

export async function refreshExperienceConfig() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(`${ENDPOINT}?t=${Date.now()}`, { cache: 'no-store', credentials: 'same-origin', signal: controller.signal });
    if (!response.ok) throw new Error(`Experience configuration returned ${response.status}.`);
    const payload = await response.json();
    publishedVersion = Number(payload?.publishedVersion || 0);
    applyExperienceConfig(payload?.config || DEFAULT_CONFIG, { source: 'published' });
    return clone(currentConfig);
  } finally {
    clearTimeout(timeout);
  }
}

function installObserver() {
  if (observer || !document.body) return;
  observer = new MutationObserver((records) => {
    if (applying) return;
    const relevant = records.some((record) => Array.from(record.addedNodes || []).some((node) => node.nodeType === 1));
    if (!relevant || observerFrame) return;
    observerFrame = requestAnimationFrame(() => {
      observerFrame = 0;
      applyExperienceConfig(currentConfig, { cache: false, source: 'dom-update' });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function boot() {
  applyExperienceConfig(currentConfig, { cache: false, source: 'cache' });
  installObserver();
  refreshExperienceConfig().catch((error) => console.warn('Published experience refresh skipped:', error));
}

window.EvaraExperience = Object.freeze({
  version: 'experience-runtime-v1',
  getConfig: () => clone(currentConfig),
  applyConfig: (config) => applyExperienceConfig(config, { cache: false, source: 'preview' }),
  refresh: refreshExperienceConfig,
  pageKey
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();

export { DEFAULT_CONFIG as DEFAULT_EXPERIENCE_CONFIG };
