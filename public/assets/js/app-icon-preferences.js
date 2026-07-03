const EVARAOS_ICON_KEY = 'evaraos-app-icon';
const EVARAOS_APP_ICONS = {
  red: { id: 'red', label: 'Red Glass', src: '/assets/img/brand/evaraos-mark-red.svg', themeColor: '#e30613' },
  light: { id: 'light', label: 'White Core', src: '/assets/img/brand/evaraos-mark-light.svg', themeColor: '#f4f7f6' },
  dark: { id: 'dark', label: 'Dark Core', src: '/assets/img/brand/evaraos-mark-dark.svg', themeColor: '#050506' }
};
function currentIconId(){
  try { const stored = localStorage.getItem(EVARAOS_ICON_KEY); return EVARAOS_APP_ICONS[stored] ? stored : 'red'; }
  catch { return 'red'; }
}
function upsertLink(rel, href, attrs){
  let link = document.querySelector('link[rel="' + rel + '"]');
  if (!link) { link = document.createElement('link'); link.rel = rel; document.head.appendChild(link); }
  link.href = href + '?v=evaraos-brand-2026';
  Object.entries(attrs || {}).forEach(([key,value]) => link.setAttribute(key, value));
}
function applyIcon(id){
  const icon = EVARAOS_APP_ICONS[id] || EVARAOS_APP_ICONS.red;
  document.documentElement.dataset.evaraosAppIcon = icon.id;
  upsertLink('icon', icon.src, { type: 'image/svg+xml' });
  upsertLink('apple-touch-icon', icon.src, {});
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute('content', icon.themeColor);
  document.querySelectorAll('[data-evaraos-brand-icon]').forEach((node) => {
    if (node.tagName === 'IMG') node.setAttribute('src', icon.src);
    node.style.setProperty('--evaraos-brand-icon', "url('" + icon.src + "')");
  });
  return icon;
}
function saveIcon(id){
  const icon = EVARAOS_APP_ICONS[id] || EVARAOS_APP_ICONS.red;
  try { localStorage.setItem(EVARAOS_ICON_KEY, icon.id); } catch {}
  return applyIcon(icon.id);
}
function hydrateIconPicker(){
  const current = currentIconId();
  document.querySelectorAll('[data-app-icon-choice]').forEach((button) => {
    const id = button.dataset.appIconChoice;
    if (!EVARAOS_APP_ICONS[id]) return;
    button.classList.toggle('is-active', id === current);
    button.setAttribute('aria-pressed', String(id === current));
    button.addEventListener('click', () => {
      const selected = saveIcon(id);
      document.querySelectorAll('[data-app-icon-choice]').forEach((choice) => {
        const active = choice.dataset.appIconChoice === selected.id;
        choice.classList.toggle('is-active', active);
        choice.setAttribute('aria-pressed', String(active));
      });
      const status = document.getElementById('appIconSaveStatus');
      if (status) { status.textContent = selected.label + ' selected.'; status.hidden = false; }
    });
  });
}
window.EvaraosAppIcons = { icons: EVARAOS_APP_ICONS, applyIcon, saveIcon, currentIconId };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { applyIcon(currentIconId()); hydrateIconPicker(); }, { once: true });
else { applyIcon(currentIconId()); hydrateIconPicker(); }
