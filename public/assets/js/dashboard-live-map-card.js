const MAP_PREVIEW_STYLE_ID = 'dashboardLiveMapStyles';
const MAP_PREVIEW_SECTION_ID = 'liveMapSection';

function ensureStyles() {
  if (document.getElementById(MAP_PREVIEW_STYLE_ID)) return;
  const link = document.createElement('link');
  link.id = MAP_PREVIEW_STYLE_ID;
  link.rel = 'stylesheet';
  link.href = '/assets/css/dashboard-live-map-card.css?v=1';
  document.head.appendChild(link);
}

function addSidebarLink() {
  const nav = document.querySelector('.dashboard-sidebar-nav');
  if (!nav || nav.querySelector('a[href="#liveMapSection"]')) return;

  const link = document.createElement('a');
  link.href = '#liveMapSection';
  link.className = 'dashboard-nav-link aurora-card beam-target';
  link.innerHTML = '<span class="dashboard-nav-icon" data-evara-icon="map" aria-hidden="true"></span><span>Live Map</span>';

  const activityLink = nav.querySelector('a[href="#activitySection"]');
  if (activityLink) nav.insertBefore(link, activityLink);
  else nav.appendChild(link);
}

function mountDashboardMap() {
  if (document.getElementById(MAP_PREVIEW_SECTION_ID)) return;

  const main = document.getElementById('dashboardMain');
  const activity = document.getElementById('activitySection');
  if (!main) return;

  ensureStyles();
  addSidebarLink();

  const section = document.createElement('section');
  section.id = MAP_PREVIEW_SECTION_ID;
  section.className = 'dashboard-panel dashboard-live-map-panel glass-card aurora-card active-glow beam-target';
  section.setAttribute('aria-labelledby', 'liveMapSectionTitle');
  section.innerHTML = `
    <div class="dashboard-section-head">
      <div>
        <p class="dashboard-section-kicker">Field Intelligence</p>
        <h2 id="liveMapSectionTitle">Live Operations Map</h2>
        <span id="dashboardMapStatus" class="dashboard-map-status">Connecting compact live workspace</span>
      </div>
      <div class="dashboard-map-actions" aria-label="Live map actions">
        <a href="/operations_map.html" class="btn btn-theme-secondary beam-target">Open compact map</a>
        <a href="/dispatch_map.html" class="btn btn-theme-primary beam-target">Expand full map</a>
      </div>
    </div>
    <div class="dashboard-map-frame-shell">
      <iframe
        id="dashboardLiveMapFrame"
        class="dashboard-map-frame"
        src="/operations_map.html?embed=1"
        title="Interactive compact EvaraOS operations map"
        loading="lazy"
        allow="geolocation 'self'"
      ></iframe>
    </div>`;

  if (activity?.parentNode === main) main.insertBefore(section, activity);
  else main.appendChild(section);

  const frame = section.querySelector('#dashboardLiveMapFrame');
  const status = section.querySelector('#dashboardMapStatus');
  frame?.addEventListener('load', () => {
    if (status) status.textContent = 'Compact live workspace ready';
  }, { once: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountDashboardMap, { once: true });
} else {
  mountDashboardMap();
}
