(() => {
  'use strict';

  const FAST_ID = 'evaraFastLoader';
  const WELCOME_ID = 'evaraWelcomeLoader';
  const TRANSITION_ID = 'evaPageTransition';
  const STYLE_ID = 'evaraLoaderStyles';
  const CRITICAL_STYLE_ID = 'evaraLoaderCriticalStyles';
  const INTERNAL_NAV_KEY = 'evaraos-internal-navigation-v1';
  const INTERNAL_NAV_TTL = 15000;
  const LONG_RESUME_MS = 45000;
  const NAV_DELAY = 90;
  const FORCE_UNLOCK = 6000;
  const WATCHDOG_MS = 2600;
  const EXIT_MS = 180;
  const WELCOME_MIN_MS = 1200;
  const BRAND_VERSION = 'brand-contract-2';
  const BRAND_LOGO_SRC = `/assets/img/evaraos_logo.png?v=${BRAND_VERSION}`;
  const BRAND_ICON_SRC = `/assets/brand/evaraos-app-icon.png?v=${BRAND_VERSION}`;
  const MANIFEST_SRC = `/manifest.json?v=${BRAND_VERSION}`;
  const MIGRATION_KEY = `evaraos-brand-assets-migrated:${BRAND_VERSION}`;
  const LEGACY_ICON_KEYS = [
    'evaraos-app-icon-snapshot-v2',
    'evaraos-app-icon-selection-v2',
    'evaraos-custom-app-icon-v2',
    'evaraos-custom-app-icon-v3',
    'evaraos-custom-app-icon-v4',
    'evaraos-custom-app-icon-v5',
    'evaraos-official-app-icon-v1',
    'evaraos-official-app-icon-v2',
    'evaraos-official-app-icon-v3',
    'evaraos-official-app-icon-v4',
    'evaraos-user-app-icon-v1',
    'evaraos-user-app-icon-v2',
    'evaraos-user-app-icon-v3',
    'evaraos-custom-icon-v1'
  ];

  let timer = null;
  let forceTimer = null;
  let watchdogTimer = null;
  let isTransitioning = false;
  let welcomeStartedAt = 0;
  let hiddenAt = 0;
  let domReady = document.readyState !== 'loading';
  let windowLoaded = document.readyState === 'complete';
  let navReady = document.documentElement.dataset.evaraosNavReady === 'true';
  let sessionReady = false;
  let bootResolved = false;
  let launchMode = document.documentElement.dataset.evaraLaunchMode || '';

  function migrateLegacyBrandState() {
    try {
      if (localStorage.getItem(MIGRATION_KEY) === '1') return;
      LEGACY_ICON_KEYS.forEach((key) => localStorage.removeItem(key));
      localStorage.setItem(MIGRATION_KEY, '1');
    } catch {}
  }

  function routeMode() { return document.body?.dataset?.routeGuard || ''; }
  function routeRequiresSession() { return ['private', 'auth'].includes(routeMode()); }
  function navRequired() { return Boolean(document.getElementById('universalNavRoot')); }
  function transition() { return document.getElementById(TRANSITION_ID); }
  function authPending() {
    return document.documentElement.classList.contains('auth-pending') || document.body?.classList.contains('auth-pending');
  }
  function appPending() {
    return !bootResolved || authPending() || document.documentElement.classList.contains('boot-pending') || document.body?.classList.contains('app-loading') || isTransitioning;
  }
  function clearTimers() {
    if (timer) clearTimeout(timer);
    if (forceTimer) clearTimeout(forceTimer);
    timer = null;
    forceTimer = null;
  }

  function logoHtml() {
    return `<img class="evara-loader-mark" data-evaraos-brand-logo src="${BRAND_LOGO_SRC}" fetchpriority="high" decoding="async" alt="" aria-hidden="true">`;
  }

  function ensureCriticalStyles() {
    if (document.getElementById(CRITICAL_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = CRITICAL_STYLE_ID;
    style.textContent = [
      '#evaraWelcomeLoader,#evaraFastLoader{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;z-index:2147483647!important;align-items:center!important;justify-content:center!important}',
      '#evaraWelcomeLoader.active,#evaraFastLoader.active{display:flex!important;opacity:1!important;visibility:visible!important}',
      '#evaraWelcomeLoader{padding:max(20px,env(safe-area-inset-top,0px)) max(20px,env(safe-area-inset-right,0px)) max(20px,env(safe-area-inset-bottom,0px)) max(20px,env(safe-area-inset-left,0px));background:var(--bg-primary,#eef5fb)}',
      '#evaraFastLoader{background:color-mix(in srgb,var(--bg-primary,#eef5fb) 34%,transparent);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}',
      '.evara-welcome-card{width:min(430px,calc(100vw - 40px));min-height:330px;padding:32px 24px;border-radius:34px;display:grid;place-items:center;align-content:center;gap:14px;text-align:center;background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.45);box-shadow:0 32px 110px rgba(27,32,48,.24);backdrop-filter:blur(24px) saturate(150%);-webkit-backdrop-filter:blur(24px) saturate(150%)}',
      '.evara-welcome-brand,.evara-loader-fast-wrap{position:relative;display:grid;place-items:center}',
      '.evara-welcome-brand{width:112px;height:112px}',
      '.evara-loader-fast-wrap{width:80px;height:80px}',
      '.evara-loader-core{display:grid;place-items:center}',
      '.evara-loader-mark{width:72px;height:72px;object-fit:contain}',
      '.evara-loader-fast .evara-loader-mark{width:52px;height:52px}'
    ].join('');
    document.head.appendChild(style);
  }

  function ensureStyles() {
    ensureCriticalStyles();
    if (document.getElementById(STYLE_ID) || document.querySelector('link[href*="/assets/css/loaders/loader-viewport.css"]')) return;
    const link = document.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = '/assets/css/loaders/loader-viewport.css?v=3';
    document.head.appendChild(link);
  }

  function ensureLink(rel, href, type = 'image/png') {
    let link = document.querySelector(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      document.head.appendChild(link);
    }
    if (type) link.type = type;
    link.href = href;
  }

  function paintBackgroundAsset(node, src, property = '--evaraos-brand-icon') {
    node.style.setProperty(property, `url("${src}")`);
    node.style.backgroundImage = `url("${src}")`;
    node.style.backgroundSize = 'contain';
    node.style.backgroundPosition = 'center';
    node.style.backgroundRepeat = 'no-repeat';
  }

  function applyBrand() {
    document.documentElement.style.setProperty('--evaraos-brand-icon', `url("${BRAND_ICON_SRC}")`);
    document.documentElement.style.setProperty('--evaraos-brand-logo', `url("${BRAND_LOGO_SRC}")`);
    document.documentElement.dataset.evaraosBrandVersion = BRAND_VERSION;

    document.querySelectorAll('[data-evaraos-brand-icon]').forEach((node) => {
      if (node.tagName === 'IMG') node.src = BRAND_ICON_SRC;
      else paintBackgroundAsset(node, BRAND_ICON_SRC);
    });
    document.querySelectorAll('[data-evaraos-brand-logo],.sidebar-logo,.brand-logo,.login-badge').forEach((node) => {
      if (node.tagName === 'IMG') node.src = BRAND_LOGO_SRC;
      else paintBackgroundAsset(node, BRAND_LOGO_SRC, '--evaraos-brand-logo');
    });
    document.querySelectorAll('.evara-loader-mark').forEach((img) => { img.src = BRAND_LOGO_SRC; });

    ensureLink('icon', BRAND_ICON_SRC);
    ensureLink('shortcut icon', BRAND_ICON_SRC);
    ensureLink('apple-touch-icon', BRAND_ICON_SRC);
    ensureLink('manifest', MANIFEST_SRC, 'application/manifest+json');

    window.EvaraBrandAssets = Object.freeze({ version: BRAND_VERSION, logo: BRAND_LOGO_SRC, icon: BRAND_ICON_SRC, manifest: MANIFEST_SRC });
    if (window.EvaraBrand) {
      window.EvaraBrand.version = BRAND_VERSION;
      window.EvaraBrand.logo = BRAND_LOGO_SRC;
      window.EvaraBrand.mark = BRAND_ICON_SRC;
      window.EvaraBrand.appIcon = BRAND_ICON_SRC;
    }
  }

  function markInternalNavigation() {
    try { sessionStorage.setItem(INTERNAL_NAV_KEY, String(Date.now())); } catch {}
  }

  function resolveLaunchMode() {
    if (launchMode) return launchMode;
    const preset = document.documentElement.dataset.evaraLaunchMode;
    if (preset) {
      launchMode = preset;
      return launchMode;
    }
    try {
      const started = Number(sessionStorage.getItem(INTERNAL_NAV_KEY) || 0);
      sessionStorage.removeItem(INTERNAL_NAV_KEY);
      launchMode = started > 0 && Date.now() - started < INTERNAL_NAV_TTL ? 'internal' : 'launch';
    } catch {
      launchMode = 'launch';
    }
    document.documentElement.dataset.evaraLaunchMode = launchMode;
    return launchMode;
  }

  function createFastLoader() {
    const node = document.createElement('div');
    node.id = FAST_ID;
    node.className = 'evara-loader-fast evara-loader-fast--compact';
    node.setAttribute('aria-hidden', 'true');
    node.innerHTML = `<div class="evara-loader-fast-wrap" role="status" aria-live="polite" aria-label="Loading EvaraOS"><span class="evara-loader-orbit"></span><span class="evara-loader-core">${logoHtml()}</span></div>`;
    node.style.display = 'none';
    document.body.appendChild(node);
  }

  function createWelcomeLoader() {
    const node = document.createElement('div');
    node.id = WELCOME_ID;
    node.className = 'evara-welcome-loader';
    node.setAttribute('aria-hidden', 'true');
    node.innerHTML = [
      '<section class="evara-welcome-card" role="status" aria-live="polite" aria-label="Opening EvaraOS">',
      `<div class="evara-welcome-brand"><span class="evara-loader-orbit"></span><span class="evara-loader-core">${logoHtml()}</span></div>`,
      '<span class="evara-welcome-eyebrow">EVARAOS</span>',
      '<strong data-evara-welcome-title>Welcome to Evaraos</strong>',
      '<span data-evara-welcome-subtitle>Preparing your operating system.</span>',
      '<span class="evara-welcome-progress" aria-hidden="true"><i></i></span>',
      '</section>'
    ].join('');
    node.style.display = 'none';
    document.body.appendChild(node);
  }

  function ensure() {
    ensureStyles();
    if (!transition()) {
      const node = document.createElement('div');
      node.id = TRANSITION_ID;
      node.className = 'eva-page-transition';
      node.setAttribute('aria-hidden', 'true');
      document.body.appendChild(node);
    }
    if (!document.getElementById(FAST_ID)) createFastLoader();
    if (!document.getElementById(WELCOME_ID)) createWelcomeLoader();
    applyBrand();
  }

  function activate(node) {
    if (!node) return;
    node.style.display = 'flex';
    node.classList.remove('is-exiting');
    node.classList.add('active', 'is-entering');
    node.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => node.classList.remove('is-entering'));
  }

  function deactivate(node, immediate = false) {
    if (!node) return;
    const finish = () => {
      node.classList.remove('active', 'is-entering', 'is-exiting');
      node.setAttribute('aria-hidden', 'true');
      node.style.display = 'none';
    };
    if (immediate) {
      finish();
      return;
    }
    node.classList.add('is-exiting');
    setTimeout(finish, EXIT_MS);
  }

  function showFastLoader() {
    ensure();
    deactivate(document.getElementById(WELCOME_ID), true);
    activate(document.getElementById(FAST_ID));
  }

  function showWelcomeLoader(options = {}) {
    ensure();
    const node = document.getElementById(WELCOME_ID);
    const title = node?.querySelector('[data-evara-welcome-title]');
    const subtitle = node?.querySelector('[data-evara-welcome-subtitle]');
    if (title) title.textContent = options.title || 'Welcome to Evaraos';
    if (subtitle) subtitle.textContent = options.subtitle || 'Preparing your operating system.';
    if (!node?.classList.contains('active') || !welcomeStartedAt) welcomeStartedAt = performance.now();
    deactivate(document.getElementById(FAST_ID), true);
    activate(node);
  }

  function hideWelcomeLoader(immediate = false) {
    const node = document.getElementById(WELCOME_ID);
    if (!node) return;
    const remaining = immediate ? 0 : Math.max(0, WELCOME_MIN_MS - (performance.now() - welcomeStartedAt));
    setTimeout(() => deactivate(node, immediate), remaining);
  }

  function unlockVisualShell() {
    document.documentElement.classList.remove('boot-pending', 'eva-transitioning', 'evara-boot-lock');
    document.documentElement.classList.add('evara-theme-painted');
    document.body?.classList.remove('eva-page-leaving');
    transition()?.classList.remove('active');
    isTransitioning = false;
    if (!authPending()) {
      document.body?.classList.remove('app-loading');
      document.body?.classList.add('app-ready');
    }
  }

  function finishLoad(immediate = false) {
    clearTimers();
    bootResolved = true;
    deactivate(document.getElementById(FAST_ID), immediate);
    hideWelcomeLoader(immediate);
    unlockVisualShell();
  }

  function criticalReady() {
    const navGate = !navRequired() || navReady || document.documentElement.dataset.evaraosNavReady === 'true';
    const sessionGate = !routeRequiresSession() || sessionReady;
    return domReady && navGate && sessionGate && !authPending();
  }

  function maybeCompleteBoot(immediate = false) {
    if (bootResolved || isTransitioning || !criticalReady()) return false;
    finishLoad(immediate);
    return true;
  }

  function completeNavigationLoad(immediate = false) {
    if (isTransitioning) {
      finishLoad(immediate);
      return;
    }
    maybeCompleteBoot(immediate);
  }

  function markNavReady() {
    navReady = true;
    document.documentElement.dataset.evaraosNavReady = 'true';
    maybeCompleteBoot(false);
  }

  function markSessionReady() {
    sessionReady = true;
    maybeCompleteBoot(false);
  }

  function beginNavigationLoad() {
    if (isTransitioning) return;
    isTransitioning = true;
    bootResolved = false;
    markInternalNavigation();
    clearTimers();
    ensure();
    document.body?.classList.add('eva-page-leaving');
    transition()?.classList.add('active');
    timer = setTimeout(showFastLoader, NAV_DELAY);
    forceTimer = setTimeout(() => {
      if (authPending()) showFastLoader();
      else finishLoad(true);
    }, FORCE_UNLOCK);
  }

  function shouldIntercept(anchor) {
    if (!anchor) return false;
    const href = anchor.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return false;
    try {
      const url = new URL(anchor.href, location.origin);
      return url.origin === location.origin && !(url.pathname === location.pathname && url.hash);
    } catch {
      return false;
    }
  }

  function resetLeavingFrame() {
    clearTimers();
    transition()?.classList.remove('active');
    deactivate(document.getElementById(FAST_ID), true);
    document.body?.classList.remove('eva-page-leaving');
    isTransitioning = false;
  }

  function health() {
    return {
      path: location.pathname,
      routeMode: routeMode(),
      launchMode: resolveLaunchMode(),
      appReady: document.body?.classList.contains('app-ready') === true,
      pending: appPending(),
      authPending: authPending(),
      domReady,
      windowLoaded,
      navReady: navReady || document.documentElement.dataset.evaraosNavReady === 'true',
      sessionReady,
      criticalReady: criticalReady(),
      navBuild: document.documentElement.dataset.evaraosNavBuild || window.EVARAOS_NAV_BUILD || '',
      duplicateLoaders: document.querySelectorAll('#evaraFastLoader,#evaraWelcomeLoader,#evaraGlobalLoader').length,
      welcomeVisible: document.getElementById(WELCOME_ID)?.classList.contains('active') === true,
      compactVisible: document.getElementById(FAST_ID)?.classList.contains('active') === true,
      brandLogo: BRAND_LOGO_SRC,
      brandIcon: BRAND_ICON_SRC,
      brandMark: BRAND_ICON_SRC,
      appIcon: BRAND_ICON_SRC,
      brandVersion: BRAND_VERSION
    };
  }

  function shellWatchdog() {
    applyBrand();
    domReady = document.readyState !== 'loading';
    windowLoaded = document.readyState === 'complete';
    navReady = navReady || document.documentElement.dataset.evaraosNavReady === 'true';
    if (maybeCompleteBoot(false)) return;
    if (appPending() && !document.querySelector('#evaraFastLoader.active,#evaraWelcomeLoader.active')) showFastLoader();
    const root = document.getElementById('universalNavRoot');
    if (root && !root.querySelector('.eva-nav-layer') && !document.documentElement.dataset.evaraosNavReady) {
      import('/assets/js/nav.js?v=nav-v58-critical-shell').catch((error) => console.warn('Nav watchdog import failed:', error));
    }
    window.dispatchEvent(new CustomEvent('evaraos:shell-watchdog', { detail: { ...health() } }));
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }
    if (!hiddenAt || Date.now() - hiddenAt < LONG_RESUME_MS || isTransitioning) return;
    hiddenAt = 0;
    bootResolved = false;
    showWelcomeLoader({ title: 'Welcome back to Evaraos', subtitle: 'Refreshing your workspace.' });
    requestAnimationFrame(() => maybeCompleteBoot(false));
  }

  function init() {
    migrateLegacyBrandState();
    ensureCriticalStyles();
    applyBrand();
    ensure();
    domReady = document.readyState !== 'loading';
    windowLoaded = document.readyState === 'complete';
    navReady = navReady || document.documentElement.dataset.evaraosNavReady === 'true';
    if (!routeRequiresSession()) sessionReady = true;
    const welcome = document.getElementById(WELCOME_ID);
    const preRenderedWelcome = welcome?.classList.contains('active') === true;
    const mode = resolveLaunchMode();
    if (preRenderedWelcome || mode === 'launch') showWelcomeLoader();
    else if (document.body?.classList.contains('app-loading')) showFastLoader();

    window.EvaraBrand = { version: BRAND_VERSION, logo: BRAND_LOGO_SRC, mark: BRAND_ICON_SRC, appIcon: BRAND_ICON_SRC, apply: applyBrand, hydrate: async () => applyBrand() };
    window.EvaraBrandAssets = Object.freeze({ version: BRAND_VERSION, logo: BRAND_LOGO_SRC, icon: BRAND_ICON_SRC, manifest: MANIFEST_SRC });
    window.EvaraLoader = {
      beginNavigationLoad,
      completeNavigationLoad,
      showFastLoader,
      hideFastLoader: (immediate = false) => deactivate(document.getElementById(FAST_ID), immediate),
      showFullLoader: showWelcomeLoader,
      hideFullLoader: hideWelcomeLoader,
      hideAllLoaders: completeNavigationLoad,
      markNavReady,
      markSessionReady,
      markAppReady: () => maybeCompleteBoot(false),
      runShellWatchdog: shellWatchdog,
      getState: health,
      health
    };

    document.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target.closest('a[href]');
      if (!shouldIntercept(anchor)) return;
      event.preventDefault();
      beginNavigationLoad();
      setTimeout(() => location.assign(anchor.href), 80);
    });
    addEventListener('evara:nav-ready', markNavReady);
    addEventListener('evara:session-ready', markSessionReady);
    addEventListener('load', () => {
      windowLoaded = true;
      applyBrand();
      maybeCompleteBoot(false);
    });
    addEventListener('pageshow', (event) => {
      windowLoaded = document.readyState === 'complete';
      applyBrand();
      if (event.persisted && (!routeRequiresSession() || sessionReady) && !authPending()) {
        finishLoad(true);
        return;
      }
      if (!maybeCompleteBoot(true) && appPending() && !document.querySelector('#evaraFastLoader.active,#evaraWelcomeLoader.active')) showFastLoader();
    });
    addEventListener('pagehide', resetLeavingFrame);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        domReady = true;
        applyBrand();
        maybeCompleteBoot(false);
      }, { once: true });
    }
    forceTimer = setTimeout(() => {
      if (routeRequiresSession() && (!sessionReady || authPending())) {
        shellWatchdog();
        return;
      }
      if (!maybeCompleteBoot(true)) finishLoad(true);
    }, FORCE_UNLOCK);
    watchdogTimer = setTimeout(shellWatchdog, WATCHDOG_MS);
    maybeCompleteBoot(false);
  }

  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init, { once: true });
})();
