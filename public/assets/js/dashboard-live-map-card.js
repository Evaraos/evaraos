const MAP_PREVIEW_STYLE_ID = 'operationsMapPreviewStyles';

function ensureStyles() {
  if (document.getElementById(MAP_PREVIEW_STYLE_ID)) return;
  const link = document.createElement('link');
  link.id = MAP_PREVIEW_STYLE_ID;
  link.rel = 'stylesheet';
  link.href = '/assets/css/dashboard-live-map-card.css?v=1';
  document.head.appendChild(link);
}

function resolvePreviewConfig() {
  const dashboardMain = document.getElementById('dashboardMain');
  if (dashboardMain) {
    return {
      sectionId: 'liveMapSection',
      titleId: 'liveMapSectionTitle',
      heading: 'Live Operations Map',
      kicker: 'Field Intelligence',
      status: 'Connecting compact live workspace',
      readyStatus: 'Compact live workspace ready',
      frameTitle: 'Interactive compact EvaraOS operations map',
      frameSrc: '/operations_map.html?embed=1',
      openHref: '/operations_map.html',
      openLabel: 'Open Operations Map',
      parent: dashboardMain,
      before: document.getElementById('activitySection'),
      sidebarLabel: 'Live Map',
      sidebarBeforeSelector: 'a[href="#activitySection"]'
    };
  }

  const leadsList = document.getElementById('leadsListSection');
  const leadsGrid = leadsList?.closest('.dashboard-grid-2');
  if (leadsGrid?.parentNode) {
    return {
      sectionId: 'leadsMapWorkspace',
      titleId: 'leadsMapWorkspaceTitle',
      heading: 'Lead Operations Map',
      kicker: 'Territory Intelligence',
      status: 'Connecting authorized lead map',
      readyStatus: 'Authorized lead map ready',
      frameTitle: 'Interactive compact EvaraOS lead operations map',
      frameSrc: '/operations_map.html?embed=1&type=lead',
      openHref: '/operations_map.html?type=lead',
      openLabel: 'Open Lead Operations Map',
      parent: leadsGrid.parentNode,
      before: leadsGrid,
      sidebarLabel: 'Lead Map',
      sidebarBeforeSelector: 'a[href="#leadsListSection"]'
    };
  }

  return null;
}

function addSidebarLink(config) {
  const nav = document.querySelector('.dashboard-sidebar-nav');
  if (!nav || nav.querySelector(`a[href="#${config.sectionId}"]`)) return;

  const link = document.createElement('a');
  link.href = `#${config.sectionId}`;
  link.className = 'dashboard-nav-link aurora-card beam-target';
  link.dataset.dashboardDynamicNav = 'true';
  if (nav.classList.contains('eva-subnav')) link.classList.add('eva-subnav__link');
  link.innerHTML = `<span class="dashboard-nav-icon" data-evara-icon="map" aria-hidden="true"></span><span>${config.sidebarLabel}</span>`;

  const before = nav.querySelector(config.sidebarBeforeSelector);
  if (before) nav.insertBefore(link, before);
  else nav.appendChild(link);
}

function mountOperationsMapPreview() {
  const config = resolvePreviewConfig();
  if (!config || document.getElementById(config.sectionId)) return false;

  ensureStyles();
  addSidebarLink(config);

  const section = document.createElement('section');
  section.id = config.sectionId;
  section.className = 'dashboard-panel dashboard-live-map-panel glass-card aurora-card active-glow beam-target';
  section.setAttribute('aria-labelledby', config.titleId);
  section.innerHTML = `
    <div class="dashboard-section-head">
      <div>
        <p class="dashboard-section-kicker">${config.kicker}</p>
        <h2 id="${config.titleId}">${config.heading}</h2>
        <span class="dashboard-map-status" data-map-preview-status>${config.status}</span>
      </div>
      <div class="dashboard-map-actions" aria-label="Map actions">
        <a href="${config.openHref}" class="btn btn-theme-primary beam-target">${config.openLabel}</a>
      </div>
    </div>
    <div class="dashboard-map-frame-shell">
      <iframe
        class="dashboard-map-frame"
        src="${config.frameSrc}"
        title="${config.frameTitle}"
        loading="lazy"
        allow="geolocation 'self'"
      ></iframe>
    </div>`;

  config.parent.insertBefore(section, config.before || null);
  window.EvaraDashboard?.refreshSidebarNavigation?.();

  const frame = section.querySelector('.dashboard-map-frame');
  const status = section.querySelector('[data-map-preview-status]');
  frame?.addEventListener('load', () => {
    if (status) status.textContent = config.readyStatus;
  }, { once: true });

  return true;
}

function start() {
  if (mountOperationsMapPreview()) return;
  const observer = new MutationObserver(() => {
    if (mountOperationsMapPreview()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 12000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
