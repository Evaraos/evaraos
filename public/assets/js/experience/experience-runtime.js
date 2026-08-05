const EXPERIENCE_VERSION = 'experience-runtime-v1';
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
    welcome: {
      enabled: true,
      eyebrow: 'EVARAOS',
      title: 'Welcome to Evaraos',
      subtitle: 'Preparing your operating system.',
      minimumMs: 450
    },
    page: {
      enabled: true,
      label: 'Loading EvaraOS',
      delayMs: 20
    },
    resume: {
      enabled: false,
      title: 'Welcome back to Evaraos',
      subtitle: 'Refreshing your workspace.',
      minimumAwayMs: 45000
    }
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

let activePayload = null;
let refreshPromise = null;
let applyQueued = false;

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeObjects(base, patch) {
  if (!isObject(patch)) return clone(base);
  const output = { ...(isObject(base) ? base : {}) };
  Object.entries(patch).forEach(([key, value]) => {
    output[key] = isObject(value) ? mergeObjects(output[key], value) : clone(value);
  });
  return output;
}

function safeAssetUrl(value) {
  const candidate = String(value || '').trim();
  if (!candidate) return '';
  if (candidate.startsWith('/assets/') && !candidate.includes('..') && !candidate.includes('\\')) return candidate;
  try {
    const url = new URL(candidate, location.origin);
    const expectedPrefix = '/v0/b/evaraos-web.firebasestorage.app/o/';
    if (url.protocol !== 'https:' || url.hostname !== 'firebasestorage.googleapis.com') return '';
    if (!url.pathname.startsWith(expectedPrefix) || url.searchParams.get('alt') !== 'media') return '';
    return url.href;
  } catch {
    return '';
  }
}

function pageKey() {
  const raw = location.pathname === '/' ? 'index.html' : location.pathname;
  return raw
    .replace(/[^a-zA-Z0-9:._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'index.html';
}

function readPath(object, path) {
  return String(path || '').split('.').reduce((value, key) => value?.[key], object);
}

function normalizePayload(raw) {
  if (!isObject(raw) || !isObject(raw.config)) return null;
  if (String(raw.schemaVersion || raw.config.schemaVersion || '') !== 'evara.experience.v1') return null;
  return {
    schemaVersion: 'evara.experience.v1',
    publishedVersion: Number.isInteger(raw.publishedVersion) ? raw.publishedVersion : 0,
    publishedAtMs: Number.isFinite(raw.publishedAtMs) ? raw.publishedAtMs : null,
    fetchedAtMs: Number.isFinite(raw.fetchedAtMs) ? raw.fetchedAtMs : Date.now(),
    config: mergeObjects(DEFAULT_CONFIG, raw.config)
  };
}

function readCache() {
  try {
    return normalizePayload(JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'));
  } catch {
    return null;
  }
}

function writeCache(payload) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {}
}

function textForSlot(config, slot) {
  const direct = readPath(config, slot);
  if (typeof direct === 'string') return direct;
  const page = config.pageOverrides?.[pageKey()];
  return typeof page?.text?.[slot] === 'string' ? page.text[slot] : null;
}

function applyTextSlots(config) {
  document.querySelectorAll('[data-experience-text]').forEach((node) => {
    const value = textForSlot(config, node.dataset.experienceText);
    if (value !== null && node.textContent !== value) node.textContent = value;
  });
}

function applyMediaSlots(config) {
  const media = config.pageOverrides?.[pageKey()]?.media || {};
  document.querySelectorAll('[data-experience-image]').forEach((node) => {
    const url = safeAssetUrl(media[node.dataset.experienceImage]);
    if (!url) return;
    if (node instanceof HTMLImageElement || node instanceof HTMLSourceElement) {
      if (node.getAttribute('src') !== url) node.setAttribute('src', url);
      if (node instanceof HTMLImageElement && !node.alt) node.alt = String(config.brand?.alt || 'EvaraOS');
      return;
    }
    if (node.style.backgroundImage !== `url("${url}")`) node.style.backgroundImage = `url("${url}")`;
  });
}

function applyStyleSlots(config) {
  const styles = config.pageOverrides?.[pageKey()]?.style || {};
  document.querySelectorAll('[data-experience-style]').forEach((node) => {
    const style = styles[node.dataset.experienceStyle];
    if (!isObject(style)) return;
    if (Number.isFinite(style.radius)) node.style.borderRadius = `${Math.max(0, Math.min(64, style.radius))}px`;
    if (Number.isFinite(style.padding)) node.style.padding = `${Math.max(0, Math.min(72, style.padding))}px`;
    const glass = ['default', 'soft', 'liquid', 'strong'].includes(style.glass) ? style.glass : 'default';
    node.dataset.experienceGlass = glass;
  });
}

function applyBrand(config) {
  const mark = safeAssetUrl(config.brand?.markUrl) || DEFAULT_CONFIG.brand.markUrl;
  const icon = safeAssetUrl(config.brand?.appIconUrl) || DEFAULT_CONFIG.brand.appIconUrl;
  document.documentElement.style.setProperty('--evaraos-brand-icon', `url("${mark.replaceAll('"', '%22')}")`);
  document.querySelectorAll('[data-evaraos-brand-icon]').forEach((node) => {
    node.style.setProperty('--evaraos-brand-icon', `url("${mark.replaceAll('"', '%22')}")`);
  });
  window.EvaraBrand?.apply?.();
  return { mark, icon };
}

function preserveVisibleBoot(config) {
  if (!document.body?.classList.contains('app-loading')) return;
  if (document.querySelector('#evaraFastLoader.active,#evaraWelcomeLoader.active')) return;
  const welcomeDisabled = config.loaders?.welcome?.enabled === false;
  const pageEnabled = config.loaders?.page?.enabled !== false;
  if (welcomeDisabled && pageEnabled) window.EvaraLoader?.showFastLoader?.();
}

function applyPayload(payload = activePayload) {
  if (!payload?.config) return false;
  const config = payload.config;
  window.EvaraLoader?.configureExperience?.(config);
  preserveVisibleBoot(config);
  applyBrand(config);
  applyTextSlots(config);
  applyMediaSlots(config);
  applyStyleSlots(config);
  document.documentElement.dataset.evaraExperienceVersion = String(payload.publishedVersion || 0);
  window.dispatchEvent(new CustomEvent('evara:experience-applied', {
    detail: {
      version: EXPERIENCE_VERSION,
      publishedVersion: payload.publishedVersion || 0,
      pageKey: pageKey()
    }
  }));
  return true;
}

function scheduleApply() {
  if (applyQueued) return;
  applyQueued = true;
  requestAnimationFrame(() => {
    applyQueued = false;
    applyPayload();
  });
}

function publish(payload, source) {
  const normalized = normalizePayload(payload);
  if (!normalized) return false;
  activePayload = normalized;
  window.dispatchEvent(new CustomEvent('evara:experience-config', {
    detail: { ...clone(normalized), source }
  }));
  scheduleApply();
  return true;
}

async function refresh() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const response = await fetch(ENDPOINT, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error(`Experience endpoint returned ${response.status}`);
      const payload = normalizePayload({ ...(await response.json()), fetchedAtMs: Date.now() });
      if (!payload) throw new Error('Experience endpoint returned an invalid payload');
      writeCache(payload);
      publish(payload, 'network');
      return clone(payload);
    } catch (error) {
      window.dispatchEvent(new CustomEvent('evara:experience-unavailable', {
        detail: { message: String(error?.message || error) }
      }));
      return activePayload ? clone(activePayload) : null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

function boot() {
  const cached = readCache();
  if (cached) publish(cached, 'cache');
  else publish({ schemaVersion: 'evara.experience.v1', config: DEFAULT_CONFIG, fetchedAtMs: Date.now() }, 'defaults');
  refresh();
}

window.EvaraExperience = Object.freeze({
  version: EXPERIENCE_VERSION,
  cacheKey: CACHE_KEY,
  endpoint: ENDPOINT,
  getConfig: () => clone(activePayload?.config || DEFAULT_CONFIG),
  getPayload: () => clone(activePayload),
  apply: applyPayload,
  refresh
});

window.addEventListener('evara:nav-ready', scheduleApply);
window.addEventListener('evara:session-ready', scheduleApply);
window.addEventListener('pageshow', scheduleApply);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
