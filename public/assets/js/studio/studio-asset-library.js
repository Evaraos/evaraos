const ASSET_KEY = 'evaraos-studio-assets-v1';
const DEFAULT_ASSETS = [
  { id: 'official-app-icon', name: 'Official App Icon', type: 'brand', url: '/assets/img/icon-512.png?v=brand-logo-1' },
  { id: 'favicon', name: 'Favicon', type: 'brand', url: '/assets/img/icon-512.png?v=brand-logo-1' },
  { id: 'brand-mark', name: 'Brand Mark', type: 'brand', url: '/assets/img/icon-512.png?v=brand-logo-1' }
];
function isModeOn() { return localStorage.getItem('evaraos-studio-mode-enabled') === 'true'; }
function selected() { return document.querySelector('.studio-mode-selected'); }
function readAssets() {
  try {
    const saved = JSON.parse(localStorage.getItem(ASSET_KEY) || '[]');
    return Array.isArray(saved) && saved.length ? saved : DEFAULT_ASSETS;
  } catch { return DEFAULT_ASSETS; }
}
function writeAssets(list) { try { localStorage.setItem(ASSET_KEY, JSON.stringify(list)); } catch {} }
function uid() { return `asset-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function ensureStyles() {
  if (document.getElementById('evaraStudioAssetLibraryStyles')) return;
  const style = document.createElement('style');
  style.id = 'evaraStudioAssetLibraryStyles';
  style.textContent = `
    .studio-asset-library{position:fixed;left:14px;bottom:calc(92px + env(safe-area-inset-bottom,0px));width:min(430px,calc(100vw - 28px));max-height:56vh;overflow:auto;z-index:9998;display:none;gap:10px;padding:14px;border-radius:24px;background:linear-gradient(145deg,rgba(255,255,255,.24),rgba(9,10,16,.76));border:1px solid rgba(255,255,255,.30);color:#fff;box-shadow:0 24px 68px rgba(0,0,0,.32);backdrop-filter:blur(30px) saturate(1.32)}
    .studio-asset-library.is-open{display:grid}.studio-asset-library h3{margin:0;font-size:1.05rem;letter-spacing:-.04em}.studio-asset-library p{margin:0;color:rgba(255,255,255,.72);font-size:.82rem;line-height:1.4}.studio-asset-library input,.studio-asset-library select{height:40px;border-radius:14px;border:1px solid rgba(255,255,255,.26);background:rgba(255,255,255,.12);color:#fff;padding:0 12px}.studio-asset-form{display:grid;grid-template-columns:1fr 1fr;gap:8px}.studio-asset-form input:first-child{grid-column:1/-1}.studio-asset-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.studio-asset-card{border:1px solid rgba(255,255,255,.18);border-radius:18px;background:rgba(255,255,255,.08);padding:8px;display:grid;gap:6px;text-align:left;color:#fff}.studio-asset-card img{width:100%;aspect-ratio:1/1;object-fit:contain;border-radius:12px;background:rgba(255,255,255,.08)}.studio-asset-card strong{font-size:.76rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.studio-asset-card small{color:rgba(255,255,255,.64);font-size:.68rem}.studio-asset-card:hover{background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.34)}.studio-asset-library button{border:1px solid rgba(255,255,255,.24);border-radius:14px;background:rgba(255,255,255,.13);color:#fff;font-weight:900;padding:9px 10px}
  `;
  document.head.appendChild(style);
}
function ensureLibrary() {
  if (document.querySelector('.studio-asset-library')) return;
  const panel = document.createElement('aside');
  panel.className = 'studio-asset-library';
  panel.innerHTML = `<h3>Asset Library</h3><p>Save brand assets locally, then apply them to selected images/cards while Studio Mode is on.</p><div class="studio-asset-form"><input data-asset-url placeholder="Image URL or /assets/... path"><input data-asset-name placeholder="Name"><select data-asset-type><option value="brand">Brand</option><option value="image">Image</option><option value="background">Background</option><option value="icon">Icon</option></select><button type="button" data-add-asset>Add</button></div><div class="studio-asset-grid" data-asset-grid></div>`;
  document.body.appendChild(panel);
  panel.querySelector('[data-add-asset]').addEventListener('click', addAsset);
  renderAssets();
}
function openLibrary() { ensureStyles(); ensureLibrary(); document.querySelector('.studio-asset-library')?.classList.add('is-open'); renderAssets(); }
function closeLibrary() { document.querySelector('.studio-asset-library')?.classList.remove('is-open'); }
function addAsset() {
  const url = document.querySelector('[data-asset-url]')?.value?.trim();
  const name = document.querySelector('[data-asset-name]')?.value?.trim() || 'Untitled Asset';
  const type = document.querySelector('[data-asset-type]')?.value || 'image';
  if (!url) return;
  const list = readAssets();
  list.unshift({ id: uid(), name, type, url, createdAt: Date.now() });
  writeAssets(list);
  document.querySelector('[data-asset-url]').value = '';
  document.querySelector('[data-asset-name]').value = '';
  renderAssets();
}
function applyAsset(asset) {
  const node = selected();
  if (!node) return;
  if (node.tagName === 'IMG') node.src = asset.url;
  else {
    node.style.backgroundImage = `linear-gradient(rgba(0,0,0,.18),rgba(0,0,0,.18)), url('${asset.url}')`;
    node.style.backgroundSize = 'cover';
    node.style.backgroundPosition = 'center';
    node.dataset.studioAsset = asset.id;
  }
  window.dispatchEvent(new CustomEvent('evara:studio-asset-applied', { detail: { asset } }));
  closeLibrary();
}
function renderAssets() {
  const root = document.querySelector('[data-asset-grid]');
  if (!root) return;
  root.innerHTML = readAssets().map((asset) => `<button type="button" class="studio-asset-card" data-asset-id="${asset.id}"><img src="${asset.url}" alt=""><strong>${asset.name}</strong><small>${asset.type}</small></button>`).join('');
}
function bind() {
  ensureStyles(); ensureLibrary();
  document.addEventListener('click', (event) => {
    const assetsButton = event.target.closest('[data-studio-action="assets"]');
    if (assetsButton && isModeOn()) { event.preventDefault(); event.stopPropagation(); openLibrary(); return; }
    const assetButton = event.target.closest('[data-asset-id]');
    if (assetButton) { event.preventDefault(); const asset = readAssets().find((item) => item.id === assetButton.dataset.assetId); if (asset) applyAsset(asset); }
    if (isModeOn() && !event.target.closest('.studio-asset-library') && !event.target.closest('[data-studio-action="assets"]')) closeLibrary();
  }, true);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true }); else bind();
