import {
  functions,
  httpsCallable,
  getSavedUserProfile
} from '../firebase.js';
import { projectCanvasPage } from './canvas/graph-projection.js';

const RUNTIME_VERSION = 'studio-published-graph-runtime-v1';
const CACHE_PREFIX = 'evaraos-published-studio-graph-v1:';
const getPublishedReleaseCall = httpsCallable(functions, 'getPublishedStudioRelease');
const ROUTES = Object.freeze({
  '/dashboard.html': 'owner-dashboard',
  '/customer_dashboard.html': 'customer-portal',
  '/jobs.html': 'jobs',
  '/leads.html': 'leads',
  '/settings-v2.html': 'settings'
});
const STYLE_PROPERTIES = new Set([
  'background', 'backgroundColor', 'color', 'borderColor', 'borderWidth', 'borderStyle',
  'borderRadius', 'boxShadow', 'opacity', 'filter', 'fontFamily', 'fontSize', 'fontWeight',
  'lineHeight', 'letterSpacing', 'textAlign', 'textTransform', 'textDecoration', 'transition',
  'objectFit', 'objectPosition'
]);
const ACTIONS = new Set(['navigate', 'open-modal', 'send-email', 'call', 'toggle-visibility']);

const state = {
  loading: false,
  loaded: false,
  active: false,
  release: null,
  graph: null,
  projection: null,
  root: null,
  host: null,
  channel: 'production',
  slug: '',
  device: '',
  observer: null,
  resizeTimer: 0,
  lastError: null
};

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const text = (value, max = 500) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
const number = (value, fallback = 0, min = -100000, max = 100000) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

function profile() {
  return getSavedUserProfile?.() || {};
}

function companyId() {
  return text(profile().companyId || '', 128);
}

function role() {
  return text(profile().role || localStorage.getItem('evaraos-role') || '', 80).toLowerCase();
}

function routeSlug() {
  const pathname = location.pathname.toLowerCase();
  if (ROUTES[pathname]) return ROUTES[pathname];
  const basename = pathname.split('/').filter(Boolean).at(-1) || 'home';
  return basename.replace(/\.html$/i, '').replace(/_/g, '-').replace(/[^a-z0-9-]+/g, '-') || 'home';
}

function releaseChannel() {
  const requested = new URLSearchParams(location.search).get('studioReleaseChannel');
  const privileged = ['owner', 'super_admin', 'admin'].includes(role());
  return privileged && requested === 'staging' ? 'staging' : 'production';
}

function isStudioRoute() {
  return /(?:website-builder|studio|blueprint|design-system)/i.test(location.pathname);
}

function currentDevice() {
  if (matchMedia('(max-width: 600px)').matches) return 'mobile';
  if (matchMedia('(max-width: 960px)').matches) return 'tablet';
  return 'desktop';
}

function cacheKey() {
  return `${CACHE_PREFIX}${companyId() || 'local'}:${state.channel}:${state.slug}`;
}

function readCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey()) || 'null');
    return cached?.release?.status === 'active' && cached?.graphSnapshot ? cached : null;
  } catch {
    return null;
  }
}

function writeCache(payload) {
  try {
    localStorage.setItem(cacheKey(), JSON.stringify({
      release: payload.release,
      graphSnapshot: payload.graphSnapshot,
      cachedAt: new Date().toISOString()
    }));
  } catch {}
}

function ensureStyles() {
  if (document.querySelector('link[data-studio-published-graph-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/assets/css/pages/studio-published-graph-v1.css?v=1';
  link.dataset.studioPublishedGraphStyle = 'true';
  document.head.append(link);
}

function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = text(options.text, options.maxText || 3000);
  if (options.type) node.type = options.type;
  if (options.dataset) Object.entries(options.dataset).forEach(([key, value]) => { node.dataset[key] = String(value); });
  if (options.attrs) Object.entries(options.attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  const list = Array.isArray(children) ? children : [children];
  list.filter(Boolean).forEach((child) => node.append(child));
  return node;
}

function safeUrl(value, { sameOrigin = false } = {}) {
  const raw = text(value, 1600);
  if (!raw) return '';
  if (raw.startsWith('/')) return raw;
  try {
    const url = new URL(raw, location.origin);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    if (sameOrigin && url.origin !== location.origin) return '';
    return url.href;
  } catch {
    return '';
  }
}

function visibleForRole(node) {
  if (node.visibility?.hidden === true) return false;
  const roles = node.visibility?.roles;
  if (roles && Object.hasOwn(roles, role()) && roles[role()] === false) return false;
  if (node.responsive?.[state.device]?.visible === false) return false;
  return true;
}

function styleValue(name, value) {
  if (value === undefined || value === null || value === '') return '';
  if (['fontSize', 'borderWidth', 'borderRadius'].includes(name) && typeof value === 'number') return `${value}px`;
  return String(value);
}

function applyStyle(element, projected) {
  const style = projected.style || {};
  STYLE_PROPERTIES.forEach((name) => {
    const value = styleValue(name, style[name]);
    if (value) element.style[name] = value;
  });
  const rotate = number(style.rotate, 0, -3600, 3600);
  const scale = number(style.scale, 1, 0.05, 20);
  const x = projected.layout?.mode === 'spatial' ? number(projected.layout.x, 0) : 0;
  const y = projected.layout?.mode === 'spatial' ? number(projected.layout.y, 0) : 0;
  element.style.transform = `translate(${x}px, ${y}px) rotate(${rotate}deg) scale(${scale})`;
  element.style.zIndex = String(projected.layout?.zIndex || 0);
  element.style.setProperty('--studio-published-span', String(projected.layout?.span || 12));
  if (projected.layout?.mode === 'spatial') {
    element.classList.add('is-spatial');
    element.style.width = `${projected.layout.width}px`;
    element.style.height = `${projected.layout.height}px`;
  }
}

function mediaElement(node) {
  const url = safeUrl(node.content?.assetUrl || node.content?.mediaUrl || '');
  if (!url) return null;
  const type = node.content?.assetType === 'video' ? 'video' : 'image';
  if (type === 'video') {
    const video = el('video', {
      className: 'studio-published-media',
      attrs: { src: url, controls: '', playsinline: '', preload: 'metadata' }
    });
    video.style.objectFit = node.style?.objectFit || 'cover';
    video.style.objectPosition = node.style?.objectPosition || 'center';
    return video;
  }
  const image = el('img', {
    className: 'studio-published-media',
    attrs: {
      src: url,
      alt: text(node.content?.alt || node.name, 240),
      loading: 'lazy',
      decoding: 'async'
    }
  });
  image.style.objectFit = node.style?.objectFit || 'cover';
  image.style.objectPosition = node.style?.objectPosition || 'center';
  return image;
}

function iconElement(value) {
  const raw = text(value, 12);
  return raw ? el('span', { className: 'studio-published-icon', text: raw }) : null;
}

function textPart(tag, className, value) {
  const copy = text(value, tag === 'p' ? 2200 : 500);
  return copy ? el(tag, { className, text: copy }) : null;
}

function componentContents(node) {
  const content = node.content || {};
  const media = mediaElement(node);
  if (node.componentType === 'hero-block') {
    return [
      media,
      el('div', { className: 'studio-published-hero-copy' }, [
        textPart('small', 'studio-published-eyebrow', content.eyebrow),
        textPart('h1', '', content.title || node.name),
        textPart('p', '', content.body),
        content.action ? el('button', { type: 'button', className: 'studio-published-primary-action', text: content.action }) : null
      ])
    ];
  }
  if (node.componentType === 'metric-card') {
    return [
      media,
      iconElement(content.icon),
      textPart('small', '', content.label || node.name),
      textPart('strong', 'studio-published-metric-value', content.value || '0'),
      textPart('em', '', content.trend)
    ];
  }
  if (node.componentType === 'image-block') {
    return [media, textPart('small', 'studio-published-caption', content.caption || content.alt)];
  }
  if (node.componentType === 'action-button') {
    return [el('button', { type: 'button', className: 'studio-published-primary-action', text: content.label || content.title || 'Continue' })];
  }
  if (node.componentType === 'map-block') {
    return [
      textPart('h3', '', content.title || node.name),
      el('div', { className: 'studio-published-map', text: content.location || 'Live operations map' })
    ];
  }
  return [
    media,
    iconElement(content.icon),
    textPart('h3', '', content.title || content.name || node.name),
    textPart('p', '', content.body || content.notes || content.description),
    content.label && content.label !== content.title ? textPart('strong', '', content.label) : null
  ];
}

function actionFor(node) {
  const action = node.action || {};
  return ACTIONS.has(action.type) ? action : null;
}

function executeAction(node, event) {
  const action = actionFor(node);
  if (!action) return;
  const value = text(action.value, 1000);
  event?.preventDefault();
  if (action.type === 'navigate') {
    const target = safeUrl(value, { sameOrigin: true });
    if (!target) return;
    if (action.target === 'new') window.open(target, '_blank', 'noopener,noreferrer');
    else location.assign(target);
  } else if (action.type === 'send-email') {
    location.href = `mailto:${value.replace(/[^a-zA-Z0-9@._+\-]/g, '')}`;
  } else if (action.type === 'call') {
    location.href = `tel:${value.replace(/[^0-9+() .\-]/g, '')}`;
  } else if (action.type === 'open-modal') {
    openModal(node.name, value || node.content?.body || '');
  } else if (action.type === 'toggle-visibility') {
    const target = state.root?.querySelector(`[data-studio-published-node-id="${CSS.escape(value)}"]`);
    target?.toggleAttribute('hidden');
  }
}

function openModal(title, copy) {
  document.querySelector('[data-studio-published-modal]')?.remove();
  const modal = el('div', {
    className: 'studio-published-modal',
    dataset: { studioPublishedModal: 'true' },
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': text(title, 160) || 'Dialog' }
  }, [
    el('section', {}, [
      textPart('h2', '', title),
      textPart('p', '', copy),
      el('button', { type: 'button', className: 'studio-published-primary-action', text: 'Close', dataset: { studioPublishedModalClose: 'true' } })
    ])
  ]);
  document.body.append(modal);
  modal.querySelector('button')?.focus();
}

function renderComponent(node) {
  if (!visibleForRole(node)) return null;
  const article = el('article', {
    className: `studio-published-node studio-published-${text(node.componentType, 80) || 'component'}`,
    dataset: { studioPublishedNodeId: node.id, studioPublishedComponent: node.componentType }
  }, componentContents(node));
  applyStyle(article, node);
  if (actionFor(node)) {
    article.classList.add('has-action');
    article.tabIndex = 0;
    article.setAttribute('role', 'button');
    article.addEventListener('click', (event) => executeAction(node, event));
    article.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') executeAction(node, event);
    });
  }
  return article;
}

function renderContainer(node) {
  if (!visibleForRole(node)) return null;
  const isPage = node.kind === 'page';
  const container = el(isPage ? 'section' : 'div', {
    className: isPage ? 'studio-published-page' : 'studio-published-container',
    dataset: { studioPublishedNodeId: node.id, studioPublishedKind: node.kind }
  });
  applyStyle(container, node);
  const grid = el('div', { className: 'studio-published-grid' });
  (node.children || []).forEach((child) => {
    const rendered = child.kind === 'component-instance' ? renderComponent(child) : renderContainer(child);
    if (rendered) grid.append(rendered);
  });
  container.append(grid);
  return container;
}

function updateSeo(release) {
  if (release?.seoTitle) document.title = text(release.seoTitle, 180);
  if (release?.seoDescription) {
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.append(meta);
    }
    meta.content = text(release.seoDescription, 320);
  }
}

function findHost() {
  return document.querySelector('main:not([data-studio-published-root])')
    || document.querySelector('#appRoot')
    || document.body;
}

function enforceHost() {
  if (!state.active || !state.root || !state.host?.isConnected) return;
  state.host.classList.add('is-studio-published-active');
  if (state.root.parentElement !== state.host) state.host.prepend(state.root);
}

function renderActiveGraph(payload) {
  const graph = payload?.graphSnapshot;
  if (!graph?.graphId) return false;
  state.device = currentDevice();
  state.projection = projectCanvasPage(graph, { device: state.device });
  const renderedPage = renderContainer(state.projection.page);
  if (!renderedPage) return false;

  const root = el('section', {
    className: 'studio-published-root',
    dataset: {
      studioPublishedRoot: 'true',
      releaseId: payload.release?.releaseId || '',
      graphId: graph.graphId,
      channel: state.channel,
      slug: state.slug,
      device: state.device
    },
    attrs: { 'aria-label': payload.release?.seoTitle || 'Published application page' }
  }, [renderedPage]);

  state.host = findHost();
  state.root?.remove();
  state.root = root;
  state.host.classList.add('is-studio-published-active');
  state.host.prepend(root);
  state.graph = clone(graph);
  state.release = clone(payload.release);
  state.active = true;
  updateSeo(payload.release);
  enforceHost();
  window.dispatchEvent(new CustomEvent('evara:published-studio-release-rendered', {
    detail: {
      runtimeVersion: RUNTIME_VERSION,
      releaseId: payload.release?.releaseId || '',
      graphId: graph.graphId,
      channel: state.channel,
      slug: state.slug,
      device: state.device
    }
  }));
  return true;
}

function clearPublishedGraph() {
  state.root?.remove();
  state.host?.classList.remove('is-studio-published-active');
  state.root = null;
  state.host = null;
  state.active = false;
  state.release = null;
  state.graph = null;
  state.projection = null;
}

async function load({ force = false } = {}) {
  if (isStudioRoute() || state.loading) return null;
  state.slug = routeSlug();
  state.channel = releaseChannel();
  if (!companyId()) return null;
  state.loading = true;
  state.lastError = null;
  ensureStyles();

  const cached = readCache();
  if (!force && cached) renderActiveGraph(cached);

  try {
    const response = await getPublishedReleaseCall({
      companyId: companyId(),
      channel: state.channel,
      slug: state.slug
    });
    const payload = response.data || {};
    if (payload.active === true && payload.release?.status === 'active' && payload.graphSnapshot?.graphId) {
      writeCache(payload);
      renderActiveGraph(payload);
    } else if (!cached) {
      clearPublishedGraph();
    }
    state.loaded = true;
    return clone(payload);
  } catch (error) {
    state.lastError = { code: text(error?.code, 120), message: text(error?.message || error, 600) };
    if (!cached) clearPublishedGraph();
    window.dispatchEvent(new CustomEvent('evara:published-studio-release-error', {
      detail: { runtimeVersion: RUNTIME_VERSION, channel: state.channel, slug: state.slug, ...clone(state.lastError) }
    }));
    return cached;
  } finally {
    state.loading = false;
  }
}

function rerenderForViewport() {
  if (!state.active || !state.graph) return;
  const next = currentDevice();
  if (next === state.device) return;
  renderActiveGraph({ release: state.release, graphSnapshot: state.graph });
}

function boot() {
  if (isStudioRoute()) return;
  state.observer = new MutationObserver(enforceHost);
  state.observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', () => {
    clearTimeout(state.resizeTimer);
    state.resizeTimer = setTimeout(rerenderForViewport, 120);
  });
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-studio-published-modal-close]')) event.target.closest('[data-studio-published-modal]')?.remove();
  });
  window.addEventListener('evara:app-check-status', (event) => {
    if (event.detail?.state === 'ready') load({ force: true });
  });
  window.addEventListener('evara:session-ready', () => load());
  window.addEventListener('pageshow', () => load());
  if (document.body?.classList.contains('app-ready')) load();
}

window.EvaraPublishedStudioRuntime = Object.freeze({
  version: RUNTIME_VERSION,
  load,
  clear: clearPublishedGraph,
  snapshot: () => ({
    version: RUNTIME_VERSION,
    loading: state.loading,
    loaded: state.loaded,
    active: state.active,
    channel: state.channel,
    slug: state.slug,
    device: state.device,
    release: clone(state.release),
    graphId: state.graph?.graphId || null,
    lastError: clone(state.lastError)
  })
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
