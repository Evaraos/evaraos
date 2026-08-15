import { getSavedUserProfile, getSavedUserRole, normalizeRole } from './firebase.js';

const FALLBACK_ICON = '/assets/brand/evaraos-app-icon.png?v=brand-canonical-20260726-1';
const FAVICON_SRC = '/favicon.ico';
const PERSONAL_ICON_KEY = 'evaraos-custom-app-icon-v5';
const OWNER_ROLES = new Set(['owner', 'super_admin', 'admin']);

function personalIcon() {
  try {
    const value = localStorage.getItem(PERSONAL_ICON_KEY) || '';
    return /^data:image\/(png|jpeg|webp);base64,/.test(value) ? value : '';
  } catch {
    return '';
  }
}

function publishedIcon() {
  return String(window.EvaraAppBuilder?.getConfig?.()?.brand?.appIconUrl || FALLBACK_ICON);
}

function activeIcon() {
  return personalIcon() || publishedIcon();
}

function ensureLink(rel, href) {
  let link = document.querySelector(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    document.head.appendChild(link);
  }
  if (rel === 'apple-touch-icon') {
    link.type = 'image/png';
    link.sizes = '512x512';
  } else {
    link.type = 'image/x-icon';
    link.removeAttribute('sizes');
  }
  link.href = href;
}

function applyIcon() {
  const src = activeIcon();
  document.querySelectorAll('[data-brand-title-mark],[data-current-icon-preview],[data-device-preview],[data-device-preview-light],.app-icon-preview').forEach((node) => {
    let image = node.querySelector('img.app-icon-logo-img');
    if (!image) {
      image = document.createElement('img');
      image.className = 'app-icon-logo-img';
      image.alt = '';
      node.appendChild(image);
    }
    image.src = src;
    image.hidden = false;
  });
  document.querySelectorAll('[data-current-icon-name]').forEach((node) => {
    node.textContent = personalIcon() ? 'Personal Icon' : 'Published EvaraOS Icon';
  });
  ensureLink('icon', FAVICON_SRC);
  ensureLink('shortcut icon', FAVICON_SRC);
  ensureLink('apple-touch-icon', src);
}

function ownerRole() {
  const profile = getSavedUserProfile?.() || {};
  return normalizeRole?.(profile.role || getSavedUserRole?.() || '') || '';
}

function configureOwnerPanel() {
  const panel = document.querySelector('[data-owner-icon-tools]');
  if (!panel) return;
  const allowed = OWNER_ROLES.has(ownerRole());
  panel.hidden = !allowed;
  panel.setAttribute('aria-hidden', String(!allowed));
  if (!allowed) return;
  panel.innerHTML = `
    <div>
      <p class="settings-kicker">OWNER EDITOR</p>
      <h2>Universal icon control</h2>
      <p>The published icon is managed through the global App Settings pipeline.</p>
    </div>
    <div class="app-icon-owner-actions">
      <a class="app-icon-owner-button" href="/website-builder.html#app-settings">
        <span><strong>Open App Settings</strong><small>Upload and publish the app icon for every EvaraOS page.</small></span>
      </a>
    </div>`;
}

function scheduleApply() {
  requestAnimationFrame(() => setTimeout(applyIcon, 0));
}

function boot() {
  configureOwnerPanel();
  applyIcon();
  const grid = document.querySelector('[data-app-icon-grid]');
  if (grid) new MutationObserver(scheduleApply).observe(grid, { childList: true, subtree: true });
  document.addEventListener('change', (event) => {
    if (event.target.matches('[data-custom-icon-upload]')) setTimeout(applyIcon, 80);
  });
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-restore-original-icon],[data-apply-selected-icon]')) setTimeout(applyIcon, 80);
  });
  window.addEventListener('evara:app-builder-updated', scheduleApply);
  window.addEventListener('evara:app-builder-ready', scheduleApply);
  window.addEventListener('evara:session-ready', () => {
    configureOwnerPanel();
    scheduleApply();
  });
  window.addEventListener('pageshow', scheduleApply);
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', boot, { once: true })
  : boot();

window.EvaraosAppIconStudio = Object.freeze({ applyIcon, activeIcon, publishedIcon });
