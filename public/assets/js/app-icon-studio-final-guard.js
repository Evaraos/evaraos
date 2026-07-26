(() => {
  'use strict';

  const BRAND_VERSION = 'brand-contract-2';
  const OFFICIAL_ICON = '/assets/brand/evaraos-app-icon.png?v=' + BRAND_VERSION;
  const OWNER_ROLES = new Set(['owner', 'super_admin', 'admin']);

  function canonicalIcon() {
    return String(
      window.EvaraBrandAssets?.icon ||
      window.EvaraBrand?.appIcon ||
      window.EvaraAppBuilder?.getConfig?.()?.brand?.appIconUrl ||
      OFFICIAL_ICON
    );
  }

  function ensureOwnerAccess(role = '') {
    const normalized = String(role || '').toLowerCase().replace(/\s+/g, '_');
    const allowed = OWNER_ROLES.has(normalized);
    document.querySelectorAll('[data-owner-icon-tools]').forEach(panel => {
      panel.hidden = !allowed;
      panel.setAttribute('aria-hidden', String(!allowed));
    });
  }

  function bindOwnerAccess() {
    ensureOwnerAccess(document.documentElement.dataset.evaraosRole || document.body?.dataset?.role || '');
    window.addEventListener('evara:session-ready', event => ensureOwnerAccess(event.detail?.role || ''), { passive: true });
  }

  function bindOfficialPreviewNotice() {
    document.querySelectorAll('[data-official-icon-upload]').forEach(input => {
      if (input.dataset.brandContractBound === 'true') return;
      input.dataset.brandContractBound = 'true';
      input.addEventListener('change', event => {
        event.preventDefault();
        const file = input.files?.[0];
        if (file && window.EvaraosAppIcons) {
          const personalInput = document.querySelector('[data-custom-icon-upload]');
          if (personalInput) {
            const transfer = new DataTransfer();
            transfer.items.add(file);
            personalInput.files = transfer.files;
            personalInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        input.value = '';
      });
    });
  }

  function repair() {
    if (window.EvaraosAppIcons?.repair) {
      window.EvaraosAppIcons.repair();
      return;
    }
    const src = canonicalIcon();
    document.querySelectorAll('[data-evaraos-brand-icon]').forEach(node => {
      if (node.tagName === 'IMG') node.src = src;
      else {
        node.style.setProperty('--evaraos-brand-icon', `url("${src}")`);
        node.style.backgroundImage = `url("${src}")`;
        node.style.backgroundSize = 'contain';
        node.style.backgroundPosition = 'center';
        node.style.backgroundRepeat = 'no-repeat';
      }
    });
  }

  function boot() {
    bindOwnerAccess();
    bindOfficialPreviewNotice();
    repair();
  }

  window.EvaraosIconGuard = {
    repair,
    activeIcon: canonicalIcon,
    hydrateOfficialIcon: async () => canonicalIcon(),
    forceImages: repair
  };

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot, { once: true }) : boot();
})();
