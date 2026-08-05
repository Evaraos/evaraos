const LEAD_MAP_SECTION_ID = 'leadsMapWorkspace';
const LEAD_MAP_STYLE_ID = 'leadsMapStyles';
const LEAD_MAP_EMBED_URL = '/operations_map.html?embed=1&type=lead&radius=all';
const LEAD_MAP_COMPACT_URL = '/operations_map.html?type=lead&radius=all';
const LEAD_MAP_EXPANDED_URL = '/dispatch_map.html?type=lead&radius=all';

function injectStyles() {
  if (document.getElementById(LEAD_MAP_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = LEAD_MAP_STYLE_ID;
  style.textContent = `
    .leads-map-shared-shell {
      margin-top: 14px;
      min-height: 520px;
      overflow: hidden;
      border-radius: 26px;
      border: 1px solid var(--liquid-border-outer);
      background: var(--liquid-bg-bottom);
    }
    .leads-map-shared-frame {
      display: block;
      width: 100%;
      min-height: 520px;
      border: 0;
      background: transparent;
    }
    .leads-map-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      justify-content: flex-end;
    }
    .leads-map-status {
      display: block;
      margin-top: 6px;
      color: var(--text-secondary);
    }
    @media (max-width: 760px) {
      .leads-map-actions { width: 100%; justify-content: stretch; }
      .leads-map-actions .btn { flex: 1 1 180px; }
      .leads-map-shared-shell,
      .leads-map-shared-frame { min-height: 450px; }
    }
  `;
  document.head.appendChild(style);
}

function mountSharedLeadMap() {
  if (document.getElementById(LEAD_MAP_SECTION_ID)) return true;

  const listSection = document.getElementById('leadsListSection');
  const anchor = listSection?.closest('.dashboard-grid-2');
  if (!anchor) return false;

  injectStyles();

  const section = document.createElement('section');
  section.id = LEAD_MAP_SECTION_ID;
  section.className = 'dashboard-panel glass-card';
  section.setAttribute('aria-labelledby', 'leadsMapTitle');
  section.innerHTML = `
    <div class="dashboard-section-head">
      <div>
        <p class="dashboard-section-kicker">Territory</p>
        <h2 id="leadsMapTitle">Live Lead Map</h2>
        <p>Use the shared EvaraOS live map filtered to leads. Select a pin to open directions or manage the exact lead record.</p>
        <span id="leadsMapStatus" class="leads-map-status">Connecting lead-only live workspace…</span>
      </div>
      <div class="leads-map-actions" aria-label="Lead map actions">
        <a class="btn btn-theme-secondary" href="${LEAD_MAP_COMPACT_URL}">Open compact lead map</a>
        <a class="btn btn-theme-primary" href="${LEAD_MAP_EXPANDED_URL}">Expand full lead map</a>
      </div>
    </div>
    <div class="leads-map-shared-shell">
      <iframe
        id="leadsMapFrame"
        class="leads-map-shared-frame"
        src="${LEAD_MAP_EMBED_URL}"
        title="Interactive EvaraOS live map filtered to leads"
        loading="lazy"
        allow="geolocation 'self'"
      ></iframe>
    </div>`;

  anchor.insertAdjacentElement('beforebegin', section);

  const frame = section.querySelector('#leadsMapFrame');
  const status = section.querySelector('#leadsMapStatus');
  frame?.addEventListener('load', () => {
    if (status) status.textContent = 'Lead-only live workspace ready';
  }, { once: true });

  return true;
}

function init() {
  if (mountSharedLeadMap()) return;
  const observer = new MutationObserver(() => {
    if (mountSharedLeadMap()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 12000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
