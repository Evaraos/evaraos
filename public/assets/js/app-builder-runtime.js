const CACHE_PREFIX = 'evaraos-app-builder-v1:';
const DRAFT_KEY = 'evaraos-owner-page-drafts-v4';
const GLOBAL_SCOPE_ID = 'evaraos-platform';
const DEFAULT_MARK = '/assets/brand/evaraos-mark.png?v=brand-png-3';
const DEFAULT_ICON = '/assets/brand/evaraos-app-icon.png?v=brand-png-1';

let activeConfig = null;
let activeCompanyId = '';
let applying = false;
let scheduled = 0;
let observer = null;
let lastBlocksSignature = '';
let runtimeHiddenAt = 0;

function storedProfile() {
  try {
    return JSON.parse(localStorage.getItem('evaraos-user') || sessionStorage.getItem('evaraos-user') || 'null') || {};
  } catch {
    return {};
  }
}

function companyId() {
  return String(storedProfile().companyId || '').trim();
}

function scopeIds() {
  return [...new Set([GLOBAL_SCOPE_ID, companyId()].filter(Boolean))];
}

function configDocument(db, doc, id) {
  return id === GLOBAL_SCOPE_ID
    ? doc(db, 'public_app_config', 'global')
    : doc(db, 'companies', id);
}

function pageKey() {
  return location.pathname.replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'home';
}

function safeJson(value, fallback = null) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function mergeConfig(base = {}, next = {}) {
  if (!next || typeof next !== 'object' || Array.isArray(next)) return next ?? base;
  const output = { ...(base || {}) };
  Object.entries(next).forEach(([key, value]) => {
    output[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? mergeConfig(output[key] || {}, value)
      : value;
  });
  return output;
}

function safeUrl(value, fallback = '') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  if (raw.startsWith('/')) return raw;
  try {
    const url = new URL(raw, location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : fallback;
  } catch {
    return fallback;
  }
}

function safeColor(value, fallback = '') {
  const raw = String(value || '').trim();
  return /^(#[0-9a-f]{3,8}|rgba?\([^)]{3,80}\)|hsla?\([^)]{3,80}\)|[a-z]{3,24})$/i.test(raw) ? raw : fallback;
}

function normalizeConfig(raw = {}) {
  const brand = raw.brand || {};
  const loaders = raw.loaders || {};
  return {
    version: Number(raw.version) || 1,
    brand: {
      name: String(brand.name || 'Evaraos').slice(0, 120),
      markUrl: safeUrl(brand.markUrl, DEFAULT_MARK),
      appIconUrl: safeUrl(brand.appIconUrl, DEFAULT_ICON),
      accent: safeColor(brand.accent, '#f2172d')
    },
    loaders: {
      launch: {
        eyebrow: String(loaders.launch?.eyebrow || 'EVARAOS').slice(0, 80),
        title: String(loaders.launch?.title || 'Welcome to Evaraos').slice(0, 180),
        subtitle: String(loaders.launch?.subtitle || 'Preparing your operating system.').slice(0, 260),
        logoUrl: safeUrl(loaders.launch?.logoUrl, safeUrl(brand.markUrl, DEFAULT_MARK)),
        background: safeColor(loaders.launch?.background, '')
      },
      resume: {
        title: String(loaders.resume?.title || 'Welcome back to Evaraos').slice(0, 180),
        subtitle: String(loaders.resume?.subtitle || 'Refreshing your workspace.').slice(0, 260)
      },
      compact: {
        label: String(loaders.compact?.label || 'Loading Evaraos').slice(0, 120),
        logoUrl: safeUrl(loaders.compact?.logoUrl, safeUrl(brand.markUrl, DEFAULT_MARK)),
        background: safeColor(loaders.compact?.background, '')
      }
    },
    pages: raw.pages && typeof raw.pages === 'object' ? raw.pages : {},
    updatedAtMs: Number(raw.updatedAtMs) || 0,
    updatedBy: String(raw.updatedBy || '').slice(0, 160)
  };
}

function cacheKey(id = activeCompanyId || companyId()) {
  return `${CACHE_PREFIX}${id || 'local'}`;
}

function readCache(id = companyId()) {
  return safeJson(localStorage.getItem(cacheKey(id)) || 'null', {}) || {};
}

function writeCache(config, id = activeCompanyId || companyId()) {
  try { localStorage.setItem(cacheKey(id), JSON.stringify(normalizeConfig(config))); } catch {}
}

function ensureIconLink(rel, href) {
  if (!href) return;
  let link = document.querySelector(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.type = 'image/png';
  link.href = href;
}

function setText(node, value) {
  if (!node || value === undefined || value === null) return;
  const next = String(value);
  if (node.textContent !== next) node.textContent = next;
}

function applyBrand(config) {
  const brand = config.brand;
  document.documentElement.style.setProperty('--evaraos-brand-icon', `url("${brand.markUrl}")`);
  document.documentElement.style.setProperty('--evaraos-brand-accent', brand.accent);
  document.documentElement.dataset.evaraBrandNameCurrent = brand.name;

  document.querySelectorAll('[data-evara-brand-name]').forEach((node) => setText(node, brand.name));
  document.querySelectorAll('[data-evaraos-brand-icon],[data-evara-brand-mark]').forEach((node) => {
    if (node.tagName === 'IMG') node.src = brand.markUrl;
    else {
      node.style.backgroundImage = `url("${brand.markUrl}")`;
      node.style.backgroundSize = 'contain';
      node.style.backgroundPosition = 'center';
      node.style.backgroundRepeat = 'no-repeat';
    }
  });
  document.querySelectorAll('img[src*="/assets/brand/evaraos-mark"]').forEach((node) => { node.src = brand.markUrl; });

  ensureIconLink('icon', brand.appIconUrl);
  ensureIconLink('shortcut icon', brand.appIconUrl);
  ensureIconLink('apple-touch-icon', brand.appIconUrl);

  if (window.EvaraBrand) {
    window.EvaraBrand.mark = brand.markUrl;
    window.EvaraBrand.appIcon = brand.appIconUrl;
  }
}

function ensureCompactLabel() {
  const wrap = document.querySelector('#evaraFastLoader .evara-loader-fast-wrap');
  if (!wrap) return null;
  let label = wrap.querySelector('[data-evara-compact-label]');
  if (!label) {
    label = document.createElement('span');
    label.dataset.evaraCompactLabel = 'true';
    label.style.cssText = 'position:absolute;top:calc(100% + 12px);left:50%;transform:translateX(-50%);min-width:180px;text-align:center;font-size:12px;font-weight:850;letter-spacing:.02em;color:var(--text-primary,#fff);text-shadow:0 1px 18px rgba(0,0,0,.28)';
    wrap.appendChild(label);
  }
  return label;
}

function applyLoaders(config) {
  const launch = config.loaders.launch;
  const compact = config.loaders.compact;
  const welcome = document.getElementById('evaraWelcomeLoader');
  const fast = document.getElementById('evaraFastLoader');

  setText(welcome?.querySelector('.evara-welcome-eyebrow'), launch.eyebrow);
  setText(welcome?.querySelector('[data-evara-welcome-title]'), launch.title);
  setText(welcome?.querySelector('[data-evara-welcome-subtitle]'), launch.subtitle);
  welcome?.querySelectorAll('.evara-loader-mark').forEach((img) => { img.src = launch.logoUrl; });
  fast?.querySelectorAll('.evara-loader-mark').forEach((img) => { img.src = compact.logoUrl; });
  const compactLabel = ensureCompactLabel();
  setText(compactLabel, compact.label);

  if (welcome && launch.background) welcome.style.background = launch.background;
  if (fast && compact.background) fast.style.background = compact.background;

  welcome?.setAttribute('aria-label', launch.title || 'Opening Evaraos');
  fast?.querySelector('[role="status"]')?.setAttribute('aria-label', compact.label || 'Loading Evaraos');
}

function editableTargets() {
  return Array.from(document.querySelectorAll('main h1,main h2,main h3,main p,main strong,main small,main .btn,main button:not([data-owner-ignore]),main img,main .glass-card,main .eva-card,main [data-builder-slot]'))
    .filter((node) => !node.closest('.owner-editor-panel,.owner-edit-fab-global,.owner-edit-dock,.eva-nav-layer,.evara-loader-fast,.evara-welcome-loader,.studio-owner-control-panel'))
    .filter((node) => String(node.textContent || '').trim().length > 0 || node.hasAttribute('data-builder-slot') || node.tagName === 'IMG' || node.classList.contains('glass-card') || node.classList.contains('eva-card'));
}

function contentId(node, index = 0) {
  if (node.dataset.contentKey) return node.dataset.contentKey;
  if (node.dataset.ownerEditId) return node.dataset.ownerEditId;
  const id = `${pageKey()}-${node.tagName.toLowerCase()}-${index}`;
  node.dataset.ownerEditId = id;
  return id;
}

function applyPageNodes(page = {}) {
  editableTargets().forEach((node, index) => {
    const id = contentId(node, index);
    const text = page.text?.[id];
    if (typeof text === 'string') {
      if (node.tagName === 'IMG') node.alt = text;
      else setText(node, text);
    }
    const style = page.style?.[id];
    if (style && typeof style === 'object') Object.assign(node.style, style);
    const media = safeUrl(page.media?.[id], '');
    if (media) {
      if (node.tagName === 'IMG') node.src = media;
      else {
        node.style.backgroundImage = `linear-gradient(rgba(0,0,0,.12),rgba(0,0,0,.12)),url("${media}")`;
        node.style.backgroundSize = 'cover';
        node.style.backgroundPosition = 'center';
      }
    }
  });
}

function publishedBlock(item = {}, index = 0) {
  const type = ['card', 'image', 'map', 'button', 'section'].includes(item.type) ? item.type : 'card';
  const node = document.createElement(type === 'section' ? 'section' : 'article');
  node.className = 'owner-live-placeholder glass-card owner-published-block';
  node.dataset.publishedOwnerBlock = String(index);
  node.style.cssText = 'min-height:108px;border-radius:26px;display:grid;gap:10px;align-content:center;padding:20px;margin:12px 0';
  const title = document.createElement('strong');
  title.textContent = String(item.title || `New ${type}`).slice(0, 240);
  const copy = document.createElement('small');
  copy.textContent = String(item.copy || 'Editable owner block.').slice(0, 1200);
  node.append(title, copy);
  if (type === 'image') {
    const img = document.createElement('img');
    img.src = safeUrl(item.url, activeConfig?.brand?.markUrl || DEFAULT_MARK);
    img.alt = title.textContent;
    img.style.cssText = 'width:100%;max-height:260px;object-fit:contain;border-radius:20px';
    node.prepend(img);
  } else if (type === 'button') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-theme-primary';
    button.textContent = String(item.label || 'New action').slice(0, 120);
    node.append(button);
  } else if (type === 'map') {
    const map = document.createElement('div');
    map.textContent = 'Map';
    map.style.cssText = 'min-height:160px;border-radius:20px;display:grid;place-items:center;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.18)';
    node.append(map);
  }
  return node;
}

function applyPublishedBlocks(page = {}) {
  const blocks = Array.isArray(page.blocks) ? page.blocks.slice(0, 60) : [];
  const existing = Array.from(document.querySelectorAll('[data-published-owner-block]'));
  const localDraftBlocks = document.querySelector('.owner-live-placeholder:not([data-published-owner-block])');
  if (localDraftBlocks) {
    existing.forEach((node) => node.remove());
    lastBlocksSignature = '';
    return;
  }
  const signature = `${pageKey()}:${JSON.stringify(blocks)}`;
  if (signature === lastBlocksSignature && existing.length === blocks.length) return;
  existing.forEach((node) => node.remove());
  lastBlocksSignature = signature;
  if (!blocks.length) return;
  const host = document.querySelector('main') || document.getElementById('appRoot') || document.body;
  blocks.forEach((item, index) => host.appendChild(publishedBlock(item, index)));
}

function apply(config = activeConfig) {
  if (!config || applying) return;
  applying = true;
  try {
    activeConfig = normalizeConfig(config);
    applyBrand(activeConfig);
    applyLoaders(activeConfig);
    const page = activeConfig.pages?.[pageKey()] || {};
    applyPageNodes(page);
    if (!document.documentElement.classList.contains('owner-editor-active')) applyPublishedBlocks(page);
  } finally {
    applying = false;
  }
}

function scheduleApply(delay = 40) {
  clearTimeout(scheduled);
  scheduled = setTimeout(() => apply(), delay);
}

function announceReady(source = 'cache') {
  window.dispatchEvent(new CustomEvent('evara:app-builder-ready', {
    detail: { companyId: activeCompanyId, config: activeConfig, source, at: Date.now() }
  }));
}

function startObserver() {
  if (observer || !document.body) return;
  observer = new MutationObserver(() => scheduleApply(70));
  observer.observe(document.body, { childList: true, subtree: true });
}

async function loadCompanyConfig() {
  const ids = scopeIds();
  activeCompanyId = companyId() || GLOBAL_SCOPE_ID;
  const cached = ids.reduce((config, id) => mergeConfig(config, readCache(id)), {});
  activeConfig = normalizeConfig(cached);
  apply(activeConfig);
  announceReady('cache');
  try {
    const { db, doc, getDoc } = await import('./firebase.js');
    const snapshots = await Promise.all(ids.map(async (id) => {
      const snapshot = await getDoc(configDocument(db, doc, id));
      const remote = snapshot.exists() ? snapshot.data()?.appBuilder : null;
      if (remote && typeof remote === 'object') writeCache(remote, id);
      return remote && typeof remote === 'object' ? remote : {};
    }));
    activeConfig = normalizeConfig(snapshots.reduce((config, item) => mergeConfig(config, item), {}));
    apply(activeConfig);
    announceReady('remote');
  } catch (error) {
    console.warn('App Builder settings could not be refreshed:', error);
  }
}

function handleRuntimeVisibility() {
  if (document.visibilityState === 'hidden') {
    runtimeHiddenAt = Date.now();
    return;
  }
  if (!runtimeHiddenAt || Date.now() - runtimeHiddenAt < 45000 || !activeConfig) return;
  runtimeHiddenAt = 0;
  setTimeout(() => {
    const welcome = document.getElementById('evaraWelcomeLoader');
    setText(welcome?.querySelector('[data-evara-welcome-title]'), activeConfig.loaders.resume.title);
    setText(welcome?.querySelector('[data-evara-welcome-subtitle]'), activeConfig.loaders.resume.subtitle);
  }, 0);
}

function applyCachedAtBoot() {
  const ids = scopeIds();
  activeCompanyId = companyId() || GLOBAL_SCOPE_ID;
  activeConfig = normalizeConfig(ids.reduce((config, id) => mergeConfig(config, readCache(id)), {}));
  apply(activeConfig);
  announceReady('boot-cache');
}

window.addEventListener('evara:app-builder-updated', (event) => {
  const next = normalizeConfig(event.detail?.config || event.detail || {});
  activeCompanyId = String(event.detail?.companyId || activeCompanyId || companyId());
  activeConfig = next;
  writeCache(next, activeCompanyId);
  apply(next);
});
window.addEventListener('evara:session-ready', loadCompanyConfig);
window.addEventListener('evara:nav-ready', () => scheduleApply(10));
window.addEventListener('pageshow', () => scheduleApply(20));
document.addEventListener('visibilitychange', handleRuntimeVisibility);
document.addEventListener('DOMContentLoaded', () => { startObserver(); scheduleApply(10); }, { once: true });

applyCachedAtBoot();
if (document.body) startObserver();

window.EvaraAppBuilder = {
  apply,
  reload: loadCompanyConfig,
  getConfig: () => activeConfig,
  getCompanyId: () => activeCompanyId || companyId(),
  getPageKey: pageKey,
  draftKey: DRAFT_KEY
};
